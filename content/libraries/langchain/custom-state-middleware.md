---
title: "LangChain custom state와 middleware로 사용자별 컨텍스트 다루기"
description: "create_agent에서 custom state를 정의하고 middleware와 ToolRuntime으로 사용자 컨텍스트, 호출 횟수, 종료 조건을 함께 관리하는 실전 패턴"
date: 2026-06-23
tags:
  - langchain
  - agent
  - middleware
  - python
  - state
aliases:
  - "/blog/custom-state-middleware"
---

# LangChain custom state와 middleware로 사용자별 컨텍스트 다루기

LangChain `create_agent`를 조금만 실전에 가깝게 쓰기 시작하면 금방 이런 요구가 생긴다.

- 사용자 등급에 따라 답변 정책을 바꾸고 싶다
- tool 안에서 현재 사용자 ID나 권한을 읽고 싶다
- 에이전트가 너무 오래 돌면 중간에 멈추고 싶다
- model 호출 횟수나 승인 상태를 state에 남기고 싶다

이럴 때 핵심은 프롬프트 문자열에 변수를 억지로 끼워 넣는 대신, `AgentState`, `ToolRuntime`, middleware를 같이 쓰는 것이다.

LangChain v1 문서 기준으로 custom state는 두 가지 방식으로 정의할 수 있다.

1. `create_agent(..., state_schema=...)`
2. middleware의 `state_schema`

공식 가이드는 tool이 읽어야 하는 state는 `create_agent` 쪽 `state_schema`가 가장 단순하고, 특정 middleware만 관리하는 필드는 middleware 쪽 `state_schema`로 범위를 좁히는 방식을 권장한다. 이 글에서는 먼저 실무에서 가장 바로 쓰기 쉬운 "공유 state 하나 + middleware로 갱신" 패턴을 정리한다.

## 언제 이 패턴이 특히 유용한가

아래 같은 경우라면 custom state를 빨리 도입하는 편이 낫다.

- 사용자별 권한, 플랜, locale을 tool과 agent가 같이 봐야 한다
- 짧은 세션 메모리 외에 "이번 실행에서만 살아 있는 제어 값"이 필요하다
- model 호출 횟수, tool 예산, 승인 여부 같은 값을 middleware에서 누적해야 한다
- 추후 LangGraph로 내려가더라도 같은 state 개념을 유지하고 싶다

반대로 단일 프롬프트와 한두 개 tool만 있는 아주 작은 데모라면 기본 `messages` state만으로도 충분하다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langchain-openai langgraph
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

예제는 `langchain-openai`의 `ChatOpenAI`를 사용한다.

## 1. custom state는 "agent가 들고 다닐 TypedDict"라고 보면 된다

LangChain 문서 기준으로 `create_agent`의 state schema는 `TypedDict` 계열이어야 한다.  
즉 v0 시절처럼 Pydantic 모델이나 dataclass를 state schema로 넘기는 방식은 더 이상 기본 패턴이 아니다.

가장 간단한 예시는 아래 정도다.

```python
from langchain.agents import AgentState
from typing_extensions import NotRequired


class SupportAgentState(AgentState):
    user_id: str
    membership: str
    model_call_count: NotRequired[int]
```

여기서 의미를 나눠 보면:

- `messages`: 기본 `AgentState`가 이미 관리하는 대화 기록
- `user_id`, `membership`: tool도 읽을 가능성이 있는 비즈니스 상태
- `model_call_count`: middleware가 누적하는 실행 제어 값

## 2. tool에서는 `ToolRuntime.state`로 custom state를 읽는다

실무에서는 "현재 사용자 정보를 tool에 어떻게 넘기지?"에서 가장 많이 막힌다.  
LangChain은 이 용도로 `ToolRuntime`을 숨겨진 인자로 넣을 수 있게 해 둔다.

```python
from langchain.tools import tool, ToolRuntime


@tool
def lookup_benefit(runtime: ToolRuntime[None, SupportAgentState]) -> str:
    """Return the support benefit available to the current user."""
    membership = runtime.state["membership"]

    if membership == "enterprise":
        return "Priority support and 24/7 incident escalation are enabled."
    if membership == "pro":
        return "Business-hours priority support is enabled."
    return "Standard support is enabled."
```

중요한 점은 `runtime`이 tool schema에는 노출되지 않는다는 것이다.  
즉 모델은 `lookup_benefit()`만 본다. 하지만 tool 구현은 `runtime.state`로 현재 state를 읽을 수 있다.

## 3. middleware는 state를 갱신하거나 중간 종료를 걸 때 가장 깔끔하다

이제 같은 state를 middleware에서도 읽고 갱신해 보자.  
아래 예시는 매 model 응답 뒤에 호출 횟수를 1씩 올리고, 6번을 넘기면 종료 메시지를 남기고 agent를 끝낸다.

```python
from typing import Any

from langchain.agents.middleware import AgentMiddleware, hook_config
from langchain.messages import AIMessage
from langgraph.runtime import Runtime


class CallLimitMiddleware(AgentMiddleware[SupportAgentState]):
    def __init__(self, max_model_calls: int = 6) -> None:
        super().__init__()
        self.max_model_calls = max_model_calls

    @hook_config(can_jump_to=["end"])
    def before_model(
        self,
        state: SupportAgentState,
        runtime: Runtime,
    ) -> dict[str, Any] | None:
        count = state.get("model_call_count", 0)
        if count >= self.max_model_calls:
            return {
                "messages": [
                    AIMessage(
                        content="호출 제한에 도달했습니다. 현재까지의 결과를 바탕으로 마무리합니다."
                    )
                ],
                "jump_to": "end",
            }
        return None

    def after_model(
        self,
        state: SupportAgentState,
        runtime: Runtime,
    ) -> dict[str, Any] | None:
        return {"model_call_count": state.get("model_call_count", 0) + 1}
```

이 패턴이 좋은 이유는 다음과 같다.

- tool 코드에 호출 제한 로직이 섞이지 않는다
- prompt에 "6번 넘게 생각하지 마" 같은 약한 지시를 넣지 않아도 된다
- 이후 `HumanInTheLoopMiddleware`, `SummarizationMiddleware`와도 같은 계층에서 조합된다

## 4. runnable 예제: 사용자 등급을 tool에서 읽고, middleware로 호출 횟수를 제한하기

아래 예제는 바로 실행 가능한 최소 패턴이다.

```python
from typing import Any

from langchain.agents import AgentState, create_agent
from langchain.agents.middleware import AgentMiddleware, hook_config
from langchain.messages import AIMessage
from langchain.tools import ToolRuntime, tool
from langchain_openai import ChatOpenAI
from langgraph.runtime import Runtime
from typing_extensions import NotRequired


class SupportAgentState(AgentState):
    user_id: str
    membership: str
    model_call_count: NotRequired[int]


@tool
def lookup_benefit(runtime: ToolRuntime[None, SupportAgentState]) -> str:
    """Return the support benefit available to the current user."""
    membership = runtime.state["membership"]

    if membership == "enterprise":
        return "Priority support and 24/7 incident escalation are enabled."
    if membership == "pro":
        return "Business-hours priority support is enabled."
    return "Standard support is enabled."


class CallLimitMiddleware(AgentMiddleware[SupportAgentState]):
    def __init__(self, max_model_calls: int = 6) -> None:
        super().__init__()
        self.max_model_calls = max_model_calls

    @hook_config(can_jump_to=["end"])
    def before_model(
        self,
        state: SupportAgentState,
        runtime: Runtime,
    ) -> dict[str, Any] | None:
        count = state.get("model_call_count", 0)
        if count >= self.max_model_calls:
            return {
                "messages": [AIMessage(content="호출 제한에 도달해 여기서 종료합니다.")],
                "jump_to": "end",
            }
        return None

    def after_model(
        self,
        state: SupportAgentState,
        runtime: Runtime,
    ) -> dict[str, Any] | None:
        return {"model_call_count": state.get("model_call_count", 0) + 1}


agent = create_agent(
    model=ChatOpenAI(model="gpt-4.1-mini"),
    tools=[lookup_benefit],
    state_schema=SupportAgentState,
    middleware=[CallLimitMiddleware(max_model_calls=4)],
    system_prompt=(
        "You are a support agent. "
        "Use lookup_benefit when the answer depends on the user's membership."
    ),
)


result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "내 지원 등급 기준으로 어떤 혜택이 있는지 짧게 정리해줘.",
            }
        ],
        "user_id": "user_123",
        "membership": "enterprise",
    }
)

print(result["messages"][-1].content)
```

이 예제에서 봐야 할 포인트는 세 가지다.

1. `state_schema=SupportAgentState`로 tool과 middleware가 같은 state를 공유한다
2. tool은 `runtime.state["membership"]`를 읽는다
3. middleware는 `model_call_count`를 갱신하고 `jump_to="end"`로 종료를 건다

## 5. 언제 `create_agent.state_schema`를 쓰고, 언제 middleware `state_schema`로 빼야 할까

공식 migration guide의 권장 기준을 실무식으로 바꾸면 아래 정도가 가장 이해하기 쉽다.

### `create_agent(..., state_schema=...)`가 맞는 경우

- tool이 그 필드를 읽어야 한다
- 호출 입력에서 직접 주입할 값이다
- 스레드 메모리처럼 대화 state와 함께 보존하고 싶다

예:

- `user_id`
- `membership`
- `locale`
- `approval_status`

### middleware `state_schema`가 더 자연스러운 경우

- 특정 middleware만 그 값을 관리한다
- 호출 횟수, 내부 플래그, 추적용 필드처럼 실행 제어에 가깝다
- tool이 그 값을 직접 알 필요가 없다

예:

- `model_call_count`
- `retry_budget_remaining`
- `last_model_call_tokens`

내 경험상 처음에는 공유 schema 하나로 시작하고, state 필드가 늘어나기 시작하면 middleware 전용 필드를 분리하는 편이 가장 무난하다.

## 자주 틀리는 점

### 1. state schema에 `TypedDict`가 아닌 타입을 넣는다

LangChain v1 문서 기준으로 `create_agent` state schema는 `TypedDict` 계열만 지원한다.  
기존 Pydantic state 예제를 그대로 옮기면 여기서 바로 막히기 쉽다.

### 2. tool 인자에 `user_id`를 직접 넣으려 한다

이 방식은 tool schema가 불필요하게 커지고, 모델이 항상 그 인자를 채워야 해서 오류가 늘어난다.  
사용자 컨텍스트는 가능하면 `runtime.state` 또는 `runtime.context`로 숨겨서 넣는 편이 낫다.

### 3. state에 넣을 값과 `context`에 넣을 값을 섞는다

대략 기준은 이렇다.

- 실행 중 변할 수 있는 값: state
- 실행 내내 고정된 의존성/설정: context

예를 들어 `user_id`는 둘 다 가능하지만, tool이 stateful하게 바꾸거나 thread에 저장해야 하면 state가 더 자연스럽다.

### 4. middleware에서 메시지를 직접 덮어써서 기존 기록을 날린다

문서 기준으로 state update는 reducer를 거친다.  
특히 메시지 수정은 additive update인지, `RemoveMessage`를 써야 하는지 구분해야 한다. 오래된 메시지를 삭제하거나 치환할 때는 short-term memory 가이드 패턴을 그대로 따르는 편이 안전하다.

### 5. "tool이 읽는 필드"와 "middleware 내부 카운터"를 같은 수준으로 방치한다

처음에는 괜찮지만 프로젝트가 커지면 schema가 금방 지저분해진다.  
tool 공개 상태와 내부 제어 상태를 분리할 시점을 미리 생각해 두는 편이 좋다.

## 추천 운영 흐름

개인적으로는 아래 순서가 가장 덜 꼬였다.

1. 먼저 tool이 꼭 읽어야 하는 상태만 `state_schema`에 넣는다
2. middleware에서 필요한 제어 필드는 `NotRequired`로 시작한다
3. 호출 제한, 승인 플래그, 사용량 추적처럼 공통 concern은 middleware로 올린다
4. 대화가 길어지면 `checkpointer`와 short-term memory 패턴을 붙인다
5. 여러 agent로 커지면 같은 개념을 LangGraph state로 그대로 확장한다

즉 custom state는 "메모리 저장소"라기보다, agent 실행 중 공유되는 구조화 컨텍스트라고 보는 편이 실전 감각에 더 가깝다.

## 참고 자료

- [LangChain custom middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
- [LangChain short-term memory](https://docs.langchain.com/oss/python/langchain/short-term-memory)
- [LangChain v1 migration guide: custom state](https://docs.langchain.com/oss/python/migrate/langchain-v1)
- [LangChain runtime overview](https://docs.langchain.com/oss/python/langchain/runtime)
- [LangChain tools guide](https://docs.langchain.com/oss/python/langchain/tools)
