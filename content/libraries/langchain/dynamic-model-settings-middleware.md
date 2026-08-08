---
title: "LangChain middleware로 요청별 model settings 동적 조정하기"
description: "ModelRequest.override(model_settings=...)로 사용자 등급과 작업 종류에 따라 temperature, max_tokens 같은 생성 설정을 안전하게 바꾸는 패턴"
date: 2026-08-08
tags:
  - langchain
  - agent
  - middleware
  - model
  - configuration
  - python
---

# LangChain middleware로 요청별 model settings 동적 조정하기

같은 agent라도 코드 생성에는 낮은 `temperature`, 브레인스토밍에는 높은 `temperature`, 무료 사용자에게는 짧은 출력 제한이 필요할 수 있다. 이때 agent를 여러 개 복제하지 않고 `wrap_model_call`에서 `ModelRequest.model_settings`를 바꾸면 **이번 model call에만 적용되는 생성 설정**을 만들 수 있다.

핵심은 원본 request를 직접 수정하지 않고 `request.override(model_settings=...)`로 새 request를 만든 뒤 handler에 넘기는 것이다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.3" langchain-openai
export OPENAI_API_KEY="your-api-key"
```

PowerShell에서는 마지막 줄 대신 다음처럼 설정한다.

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. runtime context로 출력 예산 정하기

클라이언트가 임의로 `max_tokens`를 보내게 두기보다 서버가 신뢰하는 runtime context에서 등급을 읽고 허용값으로 변환한다.

```python
from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal

from langchain.agents import create_agent
from langchain.agents.middleware import (
    ModelRequest,
    ModelResponse,
    wrap_model_call,
)


@dataclass(frozen=True)
class RequestContext:
    plan: Literal["free", "pro"]
    task: Literal["precise", "creative"]


@wrap_model_call
def apply_generation_policy(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    context = request.runtime.context
    settings = {
        **request.model_settings,
        "temperature": 0.2 if context.task == "precise" else 0.8,
        "max_tokens": 400 if context.plan == "free" else 1600,
    }
    return handler(request.override(model_settings=settings))


agent = create_agent(
    model="openai:gpt-5.5-mini",
    tools=[],
    context_schema=RequestContext,
    middleware=[apply_generation_policy],
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "이 함수의 버그를 설명해 줘"}]},
    context=RequestContext(plan="free", task="precise"),
)
print(result["messages"][-1].content)
```

`model_settings`는 model call에 추가 keyword arguments로 전달된다. 따라서 키 이름과 허용 범위는 실제 chat model integration이 지원하는 값을 사용해야 한다.

## 2. 기존 설정은 병합하고 정책 값만 덮어쓰기

여러 middleware가 settings를 추가하거나 agent 내부가 값을 준비할 수 있으므로 새 dict를 처음부터 만들지 않는다.

```python
settings = {
    **request.model_settings,
    "temperature": policy_temperature,
    "max_tokens": policy_max_tokens,
}
updated_request = request.override(model_settings=settings)
```

이 순서에서는 기존 값을 복사한 뒤 정책이 관리하는 두 키만 덮어쓴다. 반대로 정책 기본값보다 기존 값을 우선하려면 순서를 뒤집을 수 있지만, 사용자가 넣은 값이 서버 상한을 우회하지 않는지 먼저 확인해야 한다.

## 3. 모델 교체와 settings 교체를 분리해서 생각하기

`model`과 `model_settings`는 별도 override 항목이다.

```python
if request.runtime.context.plan == "pro":
    updated = request.override(
        model=pro_model,
        model_settings={
            **request.model_settings,
            "max_tokens": 1600,
        },
    )
else:
    updated = request.override(
        model_settings={
            **request.model_settings,
            "max_tokens": 400,
        }
    )

return handler(updated)
```

모델을 바꾸면 같은 setting 키라도 지원 여부나 의미가 달라질 수 있다. OpenAI integration에서 동작하는 옵션을 Anthropic 또는 다른 provider가 그대로 받는다고 가정하지 말고, 선택된 모델별 allowlist를 두는 편이 안전하다.

## 4. API 호출 없이 전달 계약 테스트하기

fake chat model이 받은 kwargs를 기록하면 middleware 정책을 비용 없이 검증할 수 있다.

```python
from typing import Any

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage
from langchain_core.outputs import ChatGeneration, ChatResult


class RecordingChatModel(BaseChatModel):
    calls: list[dict[str, Any]] = []

    @property
    def _llm_type(self) -> str:
        return "recording"

    def _generate(
        self,
        messages,
        stop=None,
        run_manager=None,
        **kwargs: Any,
    ) -> ChatResult:
        self.calls.append(kwargs)
        return ChatResult(
            generations=[ChatGeneration(message=AIMessage(content="ok"))]
        )


model = RecordingChatModel()
test_agent = create_agent(
    model=model,
    tools=[],
    context_schema=RequestContext,
    middleware=[apply_generation_policy],
)

test_agent.invoke(
    {"messages": [{"role": "user", "content": "정확히 답해 줘"}]},
    context=RequestContext(plan="free", task="precise"),
)

assert model.calls[-1]["temperature"] == 0.2
assert model.calls[-1]["max_tokens"] == 400
```

통합 테스트에서는 각 provider가 해당 옵션을 실제로 허용하는지, streaming과 structured output에서도 예상대로 동작하는지 별도로 확인한다.

## 자주 하는 실수

### request를 직접 수정한다

`ModelRequest`는 immutable replacement 패턴을 전제로 한다. `request.model_settings[...] = ...` 대신 새 dict와 `request.override(...)`를 사용한다.

### 기존 settings를 통째로 버린다

`model_settings={"temperature": 0.2}`만 넘기면 앞선 middleware가 넣은 timeout 또는 provider 설정을 잃을 수 있다. 소유한 키만 명시적으로 덮어쓴다.

### provider가 다른데 같은 키를 보낸다

지원하지 않는 keyword는 호출 시 오류가 되거나 integration에 따라 무시될 수 있다. 모델 routing과 settings 정책을 함께 테스트하고 provider별 allowlist를 유지한다.

### 사용자 입력을 그대로 전달한다

출력 한도와 sampling 값은 비용, 지연, 결과 안정성에 직접 영향을 준다. 외부 입력을 그대로 kwargs로 펼치지 말고 enum, 최소·최대 범위, 서버 기본값으로 정규화한다.

### 모든 turn에 같은 정책이 적용된다고 잊는다

`wrap_model_call`은 agent loop의 model call마다 실행된다. tool 결과를 받은 다음 turn에는 state가 달라질 수 있으므로, 정책이 turn마다 재평가되어도 일관적인지 확인한다.

## 실전 체크리스트

1. `langchain>=1.3`에서 `model_settings` 지원을 확인했는가?
2. 원본 request 대신 `request.override(...)`를 사용하는가?
3. 기존 settings를 보존하고 정책 소유 키만 덮어쓰는가?
4. 외부 값을 enum과 범위 제한으로 정규화하는가?
5. 선택될 수 있는 모든 provider에서 옵션을 검증했는가?
6. 여러 model turn과 streaming 경로를 테스트했는가?

## 참고 자료

- [LangChain ModelRequest.override API reference](https://reference.langchain.com/python/langchain/agents/middleware/types/ModelRequest/override)
- [LangChain custom middleware guide](https://docs.langchain.com/oss/python/langchain/middleware/custom)
- [LangChain agents guide](https://docs.langchain.com/oss/python/langchain/agents)
