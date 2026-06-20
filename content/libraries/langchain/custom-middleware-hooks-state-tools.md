---
title: LangChain custom middleware로 before_model, after_model, state_schema 묶어 에이전트 정책 넣기
description: LangChain custom middleware에서 node-style hook, class-based middleware, state_schema, middleware tools를 조합해 실전 에이전트 정책을 구현하는 방법 정리
date: 2026-06-20
tags:
  - langchain
  - agent
  - middleware
  - python
  - context-engineering
aliases:
  - "/blog/langchain-custom-middleware-hooks-state-tools"
---

# LangChain custom middleware로 before_model, after_model, state_schema 묶어 에이전트 정책 넣기

LangChain v1에서 `create_agent`를 실무형으로 바꾸는 핵심 확장 지점은 middleware입니다.

이미 준비된 `SummarizationMiddleware`, `ToolRetryMiddleware`, `PIIMiddleware` 같은 built-in middleware도 많지만, 실제 서비스에서는 다음처럼 "우리 팀 정책"을 직접 넣어야 할 때가 자주 생깁니다.

- 특정 길이 이상 대화면 더 이상 자동 응답하지 않기
- 모델 호출 횟수를 세다가 임계치를 넘으면 종료하기
- 에이전트가 스스로 현재 티켓 우선순위를 상태에 기록하게 만들기
- 로그, 가드레일, 상태 업데이트를 한 묶음으로 재사용하기

이럴 때 쓰는 것이 `custom middleware`입니다.

2026년 6월 20일 기준 LangChain 공식 문서는 custom middleware를 두 갈래로 설명합니다.

- node-style hook: `before_agent`, `before_model`, `after_model`, `after_agent`
- wrap-style hook: `wrap_model_call`, `wrap_tool_call`

또한 class-based middleware는 `state_schema`, `tools`, `transformers`를 class attribute로 선언할 수 있고, LangChain v1 migration guide는 custom state를 `create_agent(state_schema=...)`에 직접 두기보다 관련 middleware에 묶어 두는 방식을 더 선호한다고 설명합니다.

이 글에서는 아래 실전 포인트만 빠르게 정리합니다.

- `before_model`과 `after_model`을 언제 쓰면 좋은지
- decorator 방식보다 class 방식이 유리한 시점
- `state_schema`를 middleware에 붙여 상태를 관리하는 패턴
- middleware가 자체 tool을 함께 등록하는 방법
- 많이 틀리는 실행 순서와 상태 업데이트 주의점

## 언제 바로 써볼 만한가

다음 중 하나면 custom middleware를 쓰는 편이 맞습니다.

- agent 정책이 "모델 호출 전/후"에 걸쳐 이어진다
- 여러 agent에서 같은 로깅, 제한, 상태 규칙을 재사용하고 싶다
- tool만 추가하는 것이 아니라 agent loop 자체를 건드려야 한다
- built-in middleware 하나로는 부족하지만, 별도 LangGraph를 새로 짜기에는 과하다

반대로 "한 번만 간단히 프롬프트 바꾸기" 정도라면 함수형 decorator 한 개로 충분하고, retry/fallback/PII 같은 문제는 먼저 built-in middleware가 이미 있는지 보는 편이 낫습니다.

## 사전 준비

```bash
pip install -U langchain langchain-openai
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

## 1. 가장 작은 형태: `before_model`, `after_model`로 빠르게 끼워 넣기

공식 문서 기준 node-style hook은 특정 실행 지점에 순서대로 들어갑니다.

- `before_model`: 각 모델 호출 직전
- `after_model`: 각 모델 응답 직후

가장 흔한 첫 활용은 "호출 전 검사 + 호출 후 카운트"입니다.

```python
from typing import Any
from typing_extensions import NotRequired

from langchain.agents import create_agent
from langchain.agents.middleware import AgentState, after_model, before_model
from langchain.messages import AIMessage
from langgraph.runtime import Runtime


class CounterState(AgentState):
    model_call_count: NotRequired[int]


@before_model(state_schema=CounterState, can_jump_to=["end"])
def stop_after_too_many_calls(
    state: CounterState,
    runtime: Runtime,
) -> dict[str, Any] | None:
    count = state.get("model_call_count", 0)
    if count >= 4:
        return {
            "messages": [AIMessage(content="자동 응답 한도를 넘어서 여기서 종료합니다.")],
            "jump_to": "end",
        }
    return None


@after_model(state_schema=CounterState)
def count_model_calls(
    state: CounterState,
    runtime: Runtime,
) -> dict[str, Any] | None:
    return {"model_call_count": state.get("model_call_count", 0) + 1}


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[],
    middleware=[stop_after_too_many_calls, count_model_calls],
)


result = agent.invoke(
    {
        "messages": [{"role": "user", "content": "회의록 요약 초안을 만들어 줘."}],
        "model_call_count": 0,
    }
)

print(result["messages"][-1].content)
```

이 패턴의 장점은 분명합니다.

- `before_model`에서 종료, 차단, 메시지 삽입을 할 수 있다
- `after_model`에서 usage 카운트나 응답 검사 결과를 상태에 남길 수 있다
- 둘 다 dict를 반환하면 LangGraph reducer 규칙에 따라 상태 업데이트가 합쳐진다

실무에서는 이 정도만으로도 "모델 호출 수 제한", "특정 사용자군 차단", "간단한 감사 로그 플래그 기록" 같은 요구사항을 꽤 많이 처리합니다.

## 2. 실무형 패턴: class-based middleware + `state_schema` + middleware tool

함수형 hook만 늘어나기 시작하면 agent 설정이 금방 흩어집니다.

- 상태 스키마는 여기
- `before_model` 함수는 저기
- 관련 tool은 또 다른 파일

이럴 때는 class-based middleware가 더 낫습니다. 공식 문서 기준 이 방식은 여러 hook을 한 군데에 묶고, `state_schema`와 `tools`도 함께 선언할 수 있습니다.

아래 예시는 "지원 티켓 agent"에 우선순위 상태와 모델 호출 제한을 같이 붙이는 형태입니다.

```python
from typing import Any, Literal
from typing_extensions import NotRequired

from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, AgentState
from langchain.messages import AIMessage
from langchain.tools import ToolRuntime, tool
from langgraph.types import Command


class SupportState(AgentState):
    model_call_count: NotRequired[int]
    priority: NotRequired[str]


@tool
def set_ticket_priority(
    priority: Literal["low", "normal", "high"],
    runtime: ToolRuntime[None, SupportState],
) -> Command:
    """Persist the current ticket priority into agent state."""
    return Command(update={"priority": priority})


class SupportPolicyMiddleware(AgentMiddleware[SupportState]):
    state_schema = SupportState
    tools = [set_ticket_priority]

    def __init__(self, max_model_calls: int = 4):
        super().__init__()
        self.max_model_calls = max_model_calls

    def before_model(self, state: SupportState, runtime) -> dict[str, Any] | None:
        count = state.get("model_call_count", 0)
        if count >= self.max_model_calls:
            return {
                "messages": [
                    AIMessage(
                        content="호출 한도를 넘어 상담원에게 넘겨야 합니다. 현재까지의 요약만 제공합니다."
                    )
                ],
                "jump_to": "end",
            }
        return None

    def after_model(self, state: SupportState, runtime) -> dict[str, Any] | None:
        return {"model_call_count": state.get("model_call_count", 0) + 1}


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[],
    middleware=[SupportPolicyMiddleware(max_model_calls=4)],
)


result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "환불 문의 티켓을 정리하고, 긴급하면 set_ticket_priority로 우선순위를 기록해 줘."
                ),
            }
        ],
        "model_call_count": 0,
    }
)

print(result["messages"][-1].content)
```

여기서 핵심은 세 가지입니다.

### 1. `state_schema`가 middleware에 붙어 있다

`SupportState`는 이 정책 middleware가 관리하는 상태입니다.  
LangChain v1 migration guide도 이런 상태는 `create_agent(state_schema=...)`에 전역으로 두기보다 관련 middleware에 붙여 두는 방식을 권장합니다.

### 2. `tools`에 넣으면 middleware와 함께 tool이 따라간다

`tools = [set_ticket_priority]`처럼 붙이면 agent를 만들 때 매번 따로 tool 목록을 맞춰 주지 않아도 됩니다.

이 패턴이 특히 좋은 경우는 아래와 같습니다.

- 특정 middleware가 있어야만 의미 있는 tool
- 특정 상태 스키마가 있어야 안전한 tool
- 재사용 가능한 운영 정책 패키지로 묶고 싶은 경우

### 3. 정책과 상태 업데이트가 한 클래스 안에 모인다

나중에 읽을 때도 "이 상태는 누가 쓰지?"를 역추적할 필요가 줄어듭니다.

## 3. `before_model`과 `wrap_model_call`은 역할이 다르다

처음 보면 둘 다 "모델 호출 전에 뭔가 한다"처럼 보여서 헷갈리기 쉽습니다.

### `before_model`

- 순차 실행 hook
- 검사, 간단한 상태 갱신, 조기 종료에 적합
- dict를 반환해 상태를 업데이트

### `wrap_model_call`

- 모델 호출 바깥을 감싸는 제어용 hook
- retry, fallback, request 변형, response 변형에 적합
- 필요하면 handler를 0번, 1번, 여러 번 호출할 수 있다

예를 들어 실제 요청 객체를 바꾸고 싶으면 `wrap_model_call`이 더 맞습니다.

```python
from typing import Callable

from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call


@wrap_model_call
def force_small_model_for_short_queries(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    last_user_message = request.state["messages"][-1].content
    if isinstance(last_user_message, str) and len(last_user_message) < 40:
        request = request.override(model="openai:gpt-5.5-mini")
    return handler(request)
```

즉 정리하면:

- 정책 검사와 종료는 `before_model`
- 모델 요청 자체를 바꾸거나 재시도 로직을 감싸려면 `wrap_model_call`

## 4. 실행 순서를 틀리면 예상과 다르게 동작한다

공식 문서 기준 middleware 여러 개를 쌓았을 때 실행 순서는 아래처럼 고정됩니다.

- `before_*`: 앞에서 뒤 순서
- `wrap_*`: 바깥 middleware가 안쪽 middleware를 감싼다
- `after_*`: 뒤에서 앞 순서

예를 들어:

```python
middleware=[audit, throttling, guardrail]
```

이면 대략 이렇게 동작합니다.

1. `audit.before_model()`
2. `throttling.before_model()`
3. `guardrail.before_model()`
4. `audit.wrap_model_call(...) -> throttling.wrap_model_call(...) -> guardrail.wrap_model_call(...) -> model`
5. `guardrail.after_model()`
6. `throttling.after_model()`
7. `audit.after_model()`

이 규칙 때문에 보통은 아래처럼 놓는 편이 안정적입니다.

- 가장 바깥 관찰/로깅 계층
- 그 다음 제한/라우팅 계층
- 가장 안쪽에 실제 모델 제어 계층

## 5. 많이 하는 실수

### 1. 상태를 전역 agent 스키마에 다 몰아넣기

tool이 실제로 읽어야 하는 상태가 아니라면 middleware에 귀속시키는 편이 낫습니다.  
상태 범위가 넓어질수록 "누가 이 필드를 관리하는지"가 흐려집니다.

### 2. `after_model`에서 메시지를 덮어쓴다고 생각하기

node-style hook가 반환한 dict는 reducer를 거칩니다.  
특히 `messages`는 보통 append 성격으로 합쳐지므로 기존 대화가 통째로 교체되는 것이 아닙니다.

### 3. `wrap_model_call`에서 상태 업데이트 방식을 혼동하기

공식 문서 기준 node-style hook는 dict를 바로 반환하면 되지만, `wrap_model_call`에서 상태를 함께 갱신하려면 `ExtendedModelResponse`와 `Command(update=...)`를 써야 합니다.

### 4. 실행 순서를 고려하지 않고 middleware를 나열하기

guardrail보다 먼저 비용 최적화 라우터가 돌면, 차단되어야 할 요청도 불필요하게 모델 선택 로직을 타게 됩니다.  
순서가 곧 정책 우선순위입니다.

### 5. middleware에 너무 많은 책임을 넣기

하나의 middleware는 하나의 관심사에 가깝게 두는 편이 좋습니다.

- 호출 제한
- 로그/감사
- 동적 모델 선택
- 가드레일

이 네 가지를 한 클래스에 다 넣으면 재사용성과 테스트성이 급격히 떨어집니다.

## 추천 적용 순서

처음부터 거대한 middleware를 만들 필요는 없습니다.

1. `before_model` 한 개로 조기 종료 규칙부터 붙인다
2. `after_model`로 호출 수나 플래그를 상태에 남긴다
3. 같은 규칙을 다른 agent에도 써야 하면 class-based middleware로 올린다
4. 해당 정책 전용 tool이 필요하면 `tools` class attribute로 함께 묶는다
5. request override, retry, fallback이 필요해지면 그때 `wrap_model_call`을 추가한다

## 마무리

LangChain custom middleware는 "에이전트 바깥에서 감시하는 부가 기능"이 아니라, agent loop 안쪽에 정책을 꽂는 공식 확장 포인트입니다.

특히 아래 조합이 실전성이 높습니다.

- `before_model`: 조기 종료, 차단, 간단한 정책 검사
- `after_model`: 호출 카운트, 후처리 플래그 기록
- `state_schema`: 정책 전용 상태를 좁은 범위에 유지
- `tools`: 그 상태를 다루는 tool까지 같은 단위로 묶기

LangChain에서 built-in middleware를 여러 개 써보다가 "이제 우리 팀 규칙이 필요하다"는 시점이 오면, custom middleware가 가장 자연스러운 다음 단계입니다.

## 참고 자료

- [LangChain custom middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
- [LangChain agents overview](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain v1 migration guide](https://docs.langchain.com/oss/python/migrate/langchain-v1)
- [LangChain middleware overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)
