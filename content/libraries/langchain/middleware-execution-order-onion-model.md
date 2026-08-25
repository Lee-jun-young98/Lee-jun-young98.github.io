---
title: LangChain middleware 실행 순서와 onion model 이해하기
description: before·after hook과 wrap_model_call의 실행 순서를 검증하고 인증, 재시도, 관측 레이어를 안전하게 배치하는 실전 가이드
date: 2026-08-25
tags:
  - langchain
  - agent
  - middleware
  - reliability
  - python
---

# LangChain middleware 실행 순서와 onion model 이해하기

여러 middleware를 `create_agent`에 넘기면 목록 위에서 아래로만 실행된다고 생각하기 쉽다. 실제로는 hook 종류마다 순서가 다르다.

- `before_agent`, `before_model`: 목록의 앞에서 뒤로 실행한다.
- `after_model`, `after_agent`: 목록의 뒤에서 앞으로 실행한다.
- `wrap_model_call`, `wrap_tool_call`: 첫 middleware가 가장 바깥쪽을 감싸는 onion 구조다.

따라서 인증, 재시도, fallback, cache, tracing을 어떤 순서로 넣느냐에 따라 같은 요청도 관측 범위와 실패 처리 방식이 달라진다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.0" langchain-openai
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell에서는 다음처럼 활성화한다.

```powershell
.\.venv\Scripts\Activate.ps1
$env:OPENAI_API_KEY = "your-api-key"
```

## 1. hook별 실행 순서

`middleware=[auth, trace, retry]`라면 한 번의 model call은 개념적으로 다음 순서로 흐른다.

```text
auth.before_model
trace.before_model
retry.before_model
auth.wrap(before)
  trace.wrap(before)
    retry.wrap(before)
      model
    retry.wrap(after)
  trace.wrap(after)
auth.wrap(after)
retry.after_model
trace.after_model
auth.after_model
```

`before_*`와 `after_*`는 서로 반대 방향이며, wrap hook은 함수 호출처럼 들어갔다가 역순으로 빠져나온다. agent loop에서 tool 호출 뒤 model이 다시 호출되면 `before_model`부터 `after_model`까지의 구간도 다시 실행된다.

## 2. API 없이 순서를 검증하는 테스트

middleware 순서는 문서만 보고 추측하지 말고 작은 fake model 테스트로 고정해 두는 편이 안전하다.

```python
from collections.abc import Callable

from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, ModelRequest, ModelResponse
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.messages import AIMessage


events: list[str] = []


class OrderProbe(AgentMiddleware):
    def __init__(self, label: str) -> None:
        super().__init__()
        self.label = label

    @property
    def name(self) -> str:
        # 같은 class의 여러 instance를 등록할 때 graph node 이름이 겹치지 않게 한다.
        return f"order_probe_{self.label}"

    def before_model(self, state, runtime):
        events.append(f"{self.label}.before")

    def wrap_model_call(
        self,
        request: ModelRequest,
        handler: Callable[[ModelRequest], ModelResponse],
    ) -> ModelResponse:
        events.append(f"{self.label}.wrap.enter")
        response = handler(request)
        events.append(f"{self.label}.wrap.exit")
        return response

    def after_model(self, state, runtime):
        events.append(f"{self.label}.after")


model = FakeMessagesListChatModel(responses=[AIMessage(content="완료")])
agent = create_agent(
    model=model,
    tools=[],
    middleware=[OrderProbe("outer"), OrderProbe("inner")],
)
agent.invoke({"messages": [{"role": "user", "content": "테스트"}]})

assert events == [
    "outer.before",
    "inner.before",
    "outer.wrap.enter",
    "inner.wrap.enter",
    "inner.wrap.exit",
    "outer.wrap.exit",
    "inner.after",
    "outer.after",
]
```

이 테스트는 네트워크와 API key가 필요 없다. LangChain을 업그레이드하거나 middleware 목록을 재배치할 때 회귀 테스트로 쓸 수 있다.

## 3. 관측과 재시도의 순서가 만드는 차이

두 wrap middleware를 아래처럼 생각해 보자.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRetryMiddleware


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    middleware=[
        RequestTracingMiddleware(),
        ModelRetryMiddleware(max_retries=2),
    ],
)
```

첫 항목인 tracing이 retry를 바깥에서 감싸므로 논리 요청 전체의 지연 시간과 최종 성공·실패를 한 번 기록하기 좋다. 반대로 순서를 바꾸면 retry가 tracing을 여러 번 호출할 수 있어 각 시도를 별도 span으로 관측하기 쉽다.

실무에서는 보통 두 수준을 모두 둔다.

- 바깥 span: 사용자 요청 한 건의 전체 결과와 총 지연 시간
- 안쪽 span: 모델 호출 시도 번호, provider 오류, 각 시도의 token·지연 시간

단, `ModelRetryMiddleware` 같은 구현이 handler를 몇 번 호출하는지는 설정과 예외 종류에 따라 달라진다. 단순히 middleware 객체가 몇 번 생성되었는지를 재시도 횟수로 해석하면 안 된다.

## 4. 권한 검사는 재시도 바깥에 둔다

권한 검사는 모델을 호출하기 전에 한 번 확정하고, retry나 fallback이 이를 우회하지 못하게 가장 바깥 레이어에 두는 것이 안전하다.

```python
from collections.abc import Callable

from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call


@wrap_model_call
def authorize_model_call(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    role = request.runtime.context.get("role")
    if role not in {"member", "admin"}:
        raise PermissionError("model access denied")
    return handler(request)


# 첫 항목이 가장 바깥쪽이다.
middleware = [authorize_model_call, RequestTracingMiddleware(), retry]
```

여기서 `context` 값은 서버가 인증된 세션이나 token claim으로 만들어야 한다. 사용자가 message 본문에 적은 role을 그대로 신뢰하면 middleware 순서와 무관하게 권한 검사가 무너진다.

## 흔한 실수

### after hook도 같은 순서라고 가정한다

cleanup이나 metric 집계를 `before_*`와 같은 방향으로 생각하면 아직 종료되지 않은 안쪽 레이어의 결과를 읽게 된다. after hook은 역순임을 테스트로 고정한다.

### wrap hook에서 handler를 호출하지 않는다

의도적인 short-circuit가 아니라면 model 또는 tool이 전혀 실행되지 않는다. 반대로 handler를 두 번 호출하면 실제 API 요청도 두 번 나갈 수 있다.

### retry 안쪽에 비멱등 side effect를 넣는다

안쪽 middleware는 handler 재호출 때 반복 실행될 수 있다. 과금, 이메일, DB insert는 idempotency key를 사용하거나 retry 바깥으로 옮긴다.

### sync와 async hook을 섞는다

비동기 agent 경로에서는 `awrap_model_call` 같은 async hook을 구현한다. 동기 handler를 무리하게 event loop 안에서 호출하면 blocking이나 hook 미지원 오류가 생길 수 있다.

### middleware 목록을 읽기 좋은 순서로만 정한다

목록 순서는 곧 실행 의미다. 각 항목 옆에 `outer request scope`, `per-attempt scope`처럼 범위를 주석으로 남기고, 실패 한 번 뒤 성공하는 fake model로 호출 횟수까지 검증한다.

## 운영 체크리스트

- 인증·quota처럼 전체 요청에 한 번 적용할 정책은 바깥에 둔다.
- retry별로 실행해야 하는 metric과 request mutation은 retry 안쪽에 둔다.
- cache와 fallback은 provider 전용 metadata를 어느 레이어가 추가·제거하는지 확인한다.
- tool middleware도 같은 onion 규칙으로 보고 side effect의 멱등성을 검사한다.
- middleware 순서 자체를 단위 테스트의 예상 event 목록으로 관리한다.

## 참고 자료

- [LangChain 공식 문서: Custom middleware와 execution order](https://docs.langchain.com/oss/python/langchain/middleware/custom)
- [LangChain API Reference: AgentMiddleware](https://reference.langchain.com/python/langchain/agents/middleware/types/AgentMiddleware)
- [LangChain API Reference: wrap_model_call](https://reference.langchain.com/python/langchain/agents/middleware/types/wrap_model_call)
