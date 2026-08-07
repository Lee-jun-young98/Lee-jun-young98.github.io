---
title: "LangChain ExtendedModelResponse로 model call 결과와 state 함께 갱신하기"
description: "wrap_model_call에서 모델 응답을 유지하면서 토큰 사용량과 감사 메타데이터를 Command로 agent state에 누적하는 실전 패턴"
date: 2026-08-07
tags:
  - langchain
  - agent
  - middleware
  - state
  - observability
  - python
---

# LangChain ExtendedModelResponse로 model call 결과와 state 함께 갱신하기

`wrap_model_call`은 모델 호출 전후를 감싸므로 응답의 `usage_metadata`, 선택한 모델, 지연 시간처럼 **호출 결과를 본 뒤에만 알 수 있는 값**을 기록하기 좋다. 하지만 handler가 반환한 `ModelResponse`를 그대로 돌려주면 agent state를 추가로 갱신할 수 없다.

LangChain 1.2부터 제공되는 `ExtendedModelResponse`는 이 간격을 메운다. 원래 모델 응답은 `model_response`에 보존하고, `Command(update=...)`로 같은 model node의 state 업데이트를 함께 반환한다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.2" langchain-openai
export OPENAI_API_KEY="your-api-key"
```

PowerShell에서는 마지막 줄 대신 다음처럼 설정한다.

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 한 번의 model call 토큰 수를 state에 누적하기

누적 필드에는 reducer를 선언한다. 각 model call이 반환한 토큰 수를 delta로 보내면 `operator.add`가 agent loop 전체의 합계를 만든다.

```python
import operator
from collections.abc import Callable
from typing import Annotated

from langchain.agents import AgentState, create_agent
from langchain.agents.middleware import (
    ExtendedModelResponse,
    ModelRequest,
    ModelResponse,
    wrap_model_call,
)
from langgraph.types import Command
from typing_extensions import NotRequired


class UsageState(AgentState):
    total_model_tokens: NotRequired[Annotated[int, operator.add]]


def total_tokens(response: ModelResponse) -> int:
    return sum(
        message.usage_metadata.get("total_tokens", 0)
        for message in response.result
        if getattr(message, "usage_metadata", None)
    )


@wrap_model_call(state_schema=UsageState)
def track_model_tokens(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ExtendedModelResponse:
    response = handler(request)
    return ExtendedModelResponse(
        model_response=response,
        command=Command(
            update={"total_model_tokens": total_tokens(response)}
        ),
    )


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[],
    middleware=[track_model_tokens],
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "서울을 한 문장으로 소개해 줘"}]}
)
print(result["messages"][-1].content)
print("total tokens:", result.get("total_model_tokens", 0))
```

`response.result`에는 모델이 만든 message들이 들어 있다. provider가 token usage를 제공하지 않는 경우도 있으므로 `usage_metadata`가 없을 때 0으로 처리한다.

## 2. 왜 `ModelResponse`를 버리면 안 될까

`ExtendedModelResponse`는 모델 응답을 state update로 바꾸는 객체가 아니다. 두 값을 함께 전달하는 envelope다.

```python
def wrap_response(response: ModelResponse) -> ExtendedModelResponse:
    return ExtendedModelResponse(
        model_response=response,       # AIMessage와 structured response 보존
        command=Command(update={...}), # 추가 state update
    )
```

다음처럼 새 `ModelResponse`를 임의로 만들거나 `Command`만 반환하면 model node가 기대하는 응답 계약을 깨뜨린다.

```python
# 잘못된 패턴: wrap_model_call은 Command만 반환할 수 없다.
wrong_return_value = Command(update={"total_model_tokens": 42})
```

모델 호출 전 request만 바꾸려는 경우에는 여전히 `handler(request.override(...))`의 반환값을 그대로 돌려주면 된다. 호출 후 state까지 바꿔야 할 때만 `ExtendedModelResponse`를 사용한다.

## 3. reducer와 middleware 합성 순서 이해하기

여러 `wrap_model_call` middleware가 각각 `ExtendedModelResponse`를 반환해도 command들은 모두 적용된다.

- `messages`처럼 reducer가 있는 필드는 각 업데이트가 reducer를 통과해 합쳐진다.
- reducer가 없는 일반 필드가 충돌하면 안쪽 command가 먼저, 바깥쪽 command가 나중에 적용되어 바깥 middleware 값이 남는다.
- 카운터를 누적하려면 현재 state의 누적값을 다시 보내지 말고 이번 호출의 delta만 보낸다.

예를 들어 현재 누적값이 100이고 이번 응답이 30 tokens라면 `130`이 아니라 `30`을 update해야 한다.

```python
# operator.add reducer가 있으므로 이번 호출의 증가분만 보낸다.
Command(update={"total_model_tokens": 30})
```

운영에서는 서로 다른 middleware가 같은 일반 필드에 쓰지 않도록 `billing_*`, `audit_*`처럼 소유권이 드러나는 이름을 쓰는 편이 안전하다.

## 4. LLM 없이 핵심 계산 테스트하기

토큰 추출 함수와 envelope 계약은 실제 API 호출 없이 확인할 수 있다.

```python
from langchain.agents.middleware import ModelResponse
from langchain.messages import AIMessage


def test_total_tokens_reads_usage_metadata():
    response = ModelResponse(
        result=[
            AIMessage(
                content="ok",
                usage_metadata={
                    "input_tokens": 7,
                    "output_tokens": 3,
                    "total_tokens": 10,
                },
            )
        ]
    )
    assert total_tokens(response) == 10


def test_extended_response_keeps_both_parts():
    response = ModelResponse(result=[AIMessage(content="ok")])
    wrapped = ExtendedModelResponse(
        model_response=response,
        command=Command(update={"total_model_tokens": 10}),
    )
    assert wrapped.model_response is response
    assert wrapped.command.update == {"total_model_tokens": 10}
```

통합 테스트에서는 tool call로 model turn이 두 번 이상 발생하는 fake model을 사용해 reducer가 각 call의 usage를 모두 더하는지도 확인한다.

## 자주 하는 실수

### `after_model`과 목적을 구분하지 않는다

단순히 최신 state를 읽고 dict를 반환하면 되는 로직은 `after_model`도 충분하다. 재시도, fallback, latency 측정처럼 handler 호출 자체를 감싸야 하고 그 결과와 state update를 결합해야 할 때 `wrap_model_call`과 `ExtendedModelResponse`가 자연스럽다.

### 누적 필드에 reducer를 빼먹는다

reducer가 없으면 model turn마다 이전 값이 덮어써진다. 합계에는 `Annotated[int, operator.add]`처럼 의도를 명시한다.

### 누적값 전체를 update한다

`operator.add` 필드에 `기존 합계 + 이번 값`을 보내면 기존 합계가 두 번 더해진다. command에는 delta만 넣는다.

### provider가 항상 usage를 준다고 가정한다

모델과 스트리밍 설정에 따라 `usage_metadata`가 비어 있을 수 있다. 누락을 0 또는 unknown으로 처리하고, 비용 정산처럼 정확성이 중요한 경로에서는 provider 응답과 별도 청구 데이터를 대조한다.

### `Command`로 라우팅까지 하려 한다

`ExtendedModelResponse`에 넣는 command는 추가 state update 용도다. 현재 `goto`, `resume`, `graph`는 지원되지 않으며 사용하면 `NotImplementedError`가 발생한다. 제어 흐름 변경은 해당 기능을 지원하는 node-style hook이나 graph 설계로 분리한다.

## 실전 체크리스트

1. `langchain>=1.2`를 사용하고 있는가?
2. handler의 원래 `ModelResponse`를 그대로 보존하는가?
3. 누적 필드에 올바른 reducer를 선언했는가?
4. command에는 누적값이 아니라 이번 호출의 delta를 넣는가?
5. 여러 middleware가 같은 non-reducer 필드를 덮어쓰지 않는가?
6. usage metadata 누락과 provider별 차이를 처리하는가?
7. `goto`, `resume`, `graph`를 이 command에 넣지 않았는가?

## 참고 자료

- [LangChain Custom middleware - State updates](https://docs.langchain.com/oss/python/langchain/middleware/custom#state-updates)
- [LangChain ExtendedModelResponse API reference](https://reference.langchain.com/python/langchain/agents/middleware/types/ExtendedModelResponse)
- [LangChain ModelCallResult API reference](https://reference.langchain.com/python/langchain/agents/middleware/types/ModelCallResult)
