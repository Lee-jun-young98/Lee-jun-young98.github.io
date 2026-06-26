---
title: "LangGraph ToolRuntime으로 ToolNode 안에서 state, store, context 함께 주입하기"
description: "LangGraph ToolNode에서 ToolRuntime으로 graph state, runtime context, persistent store를 읽고 Command(update=...)로 반영하는 실전 패턴 정리"
date: 2026-06-26
tags:
  - langgraph
  - python
  - tool-calling
  - memory
aliases:
  - "/blog/langgraph-toolruntime-toolnode-state-store-context"
---

# LangGraph `ToolRuntime`으로 `ToolNode` 안에서 state, store, context 함께 주입하기

LangGraph에서 tool을 붙이다 보면 곧 이런 요구가 나온다.

- 모델이 만든 tool 인자 말고도 현재 대화 state를 읽고 싶다
- 사용자 ID 같은 런타임 context를 tool 안에서 써야 한다
- 선호 설정이나 캐시를 store에 저장하고 다음 thread에서도 다시 꺼내고 싶다
- tool 결과를 `ToolMessage`로 남기면서 graph state도 함께 바꾸고 싶다

예전 예제에서는 `InjectedState`, `InjectedStore`, `InjectedToolCallId`가 자주 보였는데, 현재 공식 문서 기준 권장 패턴은 `runtime: ToolRuntime` 하나로 접근하는 방식이다.  
즉 "숨겨진 tool 인자 주입"을 여러 개 나눠 쓰기보다, tool 실행 시점의 state, context, store, config, `tool_call_id`를 한 객체로 받는 쪽이 현재 기준선에 가깝다.

이 글에서는 아래 흐름만 실전 위주로 정리한다.

- `ToolRuntime`이 `ToolNode`에서 정확히 무엇을 주는지
- 현재 state와 사용자 context를 같이 읽는 최소 예제
- store 저장과 state 업데이트를 tool 하나에서 같이 처리하는 예제
- `Command(update=...)`를 쓸 때 자주 깨지는 함정

## 언제 이 패턴이 특히 유용한가

아래 같은 경우면 `ToolRuntime` 감각이 바로 필요해진다.

- 고객 지원 agent가 `user_tier`, `messages`, `cart_total` 같은 state를 보고 분기한다
- tool이 `user_id`를 읽어 개인화 설정을 조회하거나 저장한다
- 모델에는 보여 주고 싶지 않은 내부 state를 tool만 읽어야 한다
- tool이 단순 문자열 반환을 넘어 state와 장기 메모리를 같이 바꿔야 한다

공식 문서 기준으로 `ToolNode`는 병렬 tool 실행, 에러 처리, state injection을 자동 처리하는 prebuilt node다. 그래서 Graph API에서 tool을 직접 다루기 시작하면 custom executor를 먼저 짜기보다 `ToolNode`와 `ToolRuntime` 조합부터 보는 편이 안전하다.

## 사전 준비

아래 정도면 예제를 바로 따라갈 수 있다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langgraph langchain-core
```

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langgraph langchain-core
```

공식 tools 문서 기준으로 `execution_info`, `server_info` 같은 일부 `ToolRuntime` 필드는 `langgraph>=1.1.5`가 필요하다.  
이 글의 예제는 핵심 state/store/context 흐름만 쓰므로 최신 `langgraph`면 충분하다.

## 1. 최소 예제: `ToolRuntime`으로 state와 context 같이 읽기

가장 먼저 익혀 둘 점은, `ToolRuntime` 인자는 모델이 생성하는 tool schema에 노출되지 않는다는 점이다.  
즉 모델은 `question`만 넘기지만, 실제 tool 함수는 숨겨진 `runtime`으로 graph state와 context를 읽을 수 있다.

```python
from dataclasses import dataclass
from typing import Annotated
from typing_extensions import TypedDict

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.tools import tool
from langchain.tools import ToolRuntime
from langgraph.graph import START, END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode


@dataclass
class UserContext:
    user_id: str
    plan: str


class SupportState(TypedDict):
    messages: Annotated[list, add_messages]
    account_status: str


@tool
def answer_account_question(question: str, runtime: ToolRuntime[UserContext, SupportState]) -> str:
    """Answer an account question using graph state and runtime context."""
    plan = runtime.context.plan
    status = runtime.state["account_status"]
    last_user_message = runtime.state["messages"][-1].content
    return (
        f"user={runtime.context.user_id}, plan={plan}, status={status}\n"
        f"question={question}\n"
        f"last_message={last_user_message}"
    )


def agent(state: SupportState):
    return {
        "messages": [
            AIMessage(
                content="I'll inspect the account state first.",
                tool_calls=[
                    {
                        "name": "answer_account_question",
                        "args": {"question": "계정 상태를 요약해 줘"},
                        "id": "call-1",
                        "type": "tool_call",
                    }
                ],
            )
        ]
    }


builder = StateGraph(SupportState, context_schema=UserContext)
builder.add_node("agent", agent)
builder.add_node("tools", ToolNode([answer_account_question]))
builder.add_edge(START, "agent")
builder.add_edge("agent", "tools")
builder.add_edge("tools", END)

graph = builder.compile()

result = graph.invoke(
    {
        "messages": [HumanMessage(content="내 계정 상태 확인해 줘")],
        "account_status": "past_due",
    },
    context=UserContext(user_id="u-123", plan="pro"),
)

print(result["messages"][-1].content)
```

이 예제의 포인트는 명확하다.

- 모델은 `question`만 안다
- tool은 `runtime.context.plan`, `runtime.context.user_id`를 읽는다
- tool은 `runtime.state["account_status"]`, `runtime.state["messages"]`도 같이 읽는다

즉 "LLM이 만든 인자"와 "graph가 이미 알고 있는 정보"를 분리할 수 있다.

## 2. `store`와 `Command(update=...)`를 같이 쓰는 실전 패턴

실전에서는 tool이 읽기만 하고 끝나는 경우보다, 사용자 선호를 store에 저장하고 state도 같이 갱신하는 경우가 더 많다.  
이때 `ToolRuntime`이 있으면 `runtime.store`와 `runtime.tool_call_id`까지 한 번에 쓸 수 있다.

```python
from dataclasses import dataclass
from typing import Annotated
from typing_extensions import TypedDict

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.tools import tool
from langchain.tools import ToolRuntime
from langgraph.graph import START, END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.store.memory import InMemoryStore
from langgraph.types import Command


@dataclass
class UserContext:
    user_id: str


class PreferenceState(TypedDict):
    messages: Annotated[list, add_messages]
    preferred_language: str


@tool
def set_language(
    language: str,
    runtime: ToolRuntime[UserContext, PreferenceState],
) -> Command:
    """Persist the user's preferred language and update graph state."""
    namespace = ("preferences", runtime.context.user_id)
    runtime.store.put(namespace, "language", {"value": language})

    return Command(
        update={
            "preferred_language": language,
            "messages": [
                ToolMessage(
                    content=f"Language set to {language}.",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


def agent(state: PreferenceState):
    return {
        "messages": [
            AIMessage(
                content="I will save the user's preference.",
                tool_calls=[
                    {
                        "name": "set_language",
                        "args": {"language": "ko"},
                        "id": "call-1",
                        "type": "tool_call",
                    }
                ],
            )
        ]
    }


store = InMemoryStore()

builder = StateGraph(PreferenceState, context_schema=UserContext)
builder.add_node("agent", agent)
builder.add_node("tools", ToolNode([set_language]))
builder.add_edge(START, "agent")
builder.add_edge("agent", "tools")
builder.add_edge("tools", END)

graph = builder.compile(store=store)

result = graph.invoke(
    {
        "messages": [HumanMessage(content="앞으로 한국어로 답해 줘")],
        "preferred_language": "",
    },
    context=UserContext(user_id="u-123"),
)

saved = store.get(("preferences", "u-123"), "language")

print(result["preferred_language"])
print(result["messages"][-1].content)
print(saved.value)
```

이 패턴에서 중요한 순서는 아래와 같다.

1. tool이 `runtime.context.user_id`로 저장 namespace를 만든다
2. `runtime.store.put(...)`으로 장기 메모리를 쓴다
3. `Command(update=...)`로 thread state를 같이 바꾼다
4. `ToolMessage(..., tool_call_id=runtime.tool_call_id)`를 함께 넣어 message history를 정상 상태로 유지한다

즉 store는 cross-thread 메모리, state는 현재 thread의 즉시 반영값이라고 생각하면 구조가 깔끔해진다.

## 3. `ToolNode`에 무엇을 넘기느냐에 따라 tool이 볼 수 있는 state가 달라진다

공식 workflows and agents 문서에서 꽤 중요하게 짚는 부분이다.  
`ToolNode`가 접근할 수 있는 state는 "그 노드에 실제로 전달된 입력"까지만이다.

예를 들어 아래 둘은 의미가 다르다.

```python
tool_node.invoke(state)
```

```python
tool_node.invoke({"messages": state["messages"]})
```

첫 번째는 full state를 tool에 노출한다.  
두 번째는 `messages`만 보이게 한다.

그래서 custom node 안에서 `ToolNode`를 수동 호출할 때는 아래를 먼저 점검하는 편이 좋다.

- tool이 `messages` 외의 custom state를 읽는가
- tool이 `account_status`, `cart`, `user_profile` 같은 채널을 기대하는가
- partial state만 넘겨서 tool이 KeyError를 내고 있지는 않은가

직접 `StateGraph` node로 붙이는 경우에는 현재 graph state가 그대로 들어가므로 보통 이 함정이 덜하다.

## 4. 예전 `InjectedState` / `InjectedStore` 예제는 어떻게 봐야 할까

현재 공식 tools 문서는 `InjectedState`, `InjectedStore`, `get_runtime()`, `InjectedToolCallId`를 older injection patterns로 분류하고 `ToolRuntime` 사용을 권장한다.

개념적으로는 이렇게 치환하면 된다.

- `InjectedState` -> `runtime.state`
- `InjectedStore` -> `runtime.store`
- `InjectedToolCallId` -> `runtime.tool_call_id`

예전 코드가 틀렸다는 뜻은 아니다.  
다만 새 코드나 새 문서를 쓸 때는 `ToolRuntime` 하나로 통일해 두는 편이 읽기 쉽고, state/context/store/stream writer까지 확장하기도 좋다.

## 자주 겪는 함정

### 1. `Command(update=...)`를 반환하면서 `ToolMessage`를 빼먹는다

공식 Graph API 문서 기준으로 tool이 state를 업데이트할 때는 `messages` 키를 같이 넣고, 그 안에 `ToolMessage`가 포함되어 있어야 message history가 유효하다.  
이걸 빼먹으면 나중 LLM 호출에서 malformed chat history 문제가 바로 난다.

즉 아래는 위험하다.

```python
return Command(update={"preferred_language": language})
```

보통은 아래처럼 쓴다.

```python
return Command(
    update={
        "preferred_language": language,
        "messages": [
            ToolMessage(
                content=f"Language set to {language}.",
                tool_call_id=runtime.tool_call_id,
            )
        ],
    }
)
```

### 2. 병렬 tool call이 같은 state key를 같이 갱신한다

공식 tools 문서도 이 점을 강조한다.  
LLM이 여러 tool을 병렬 호출할 수 있으므로 같은 state key를 동시에 바꿀 수 있다면 reducer를 먼저 설계해야 한다.

예를 들면 아래가 대표적이다.

- `messages`: `add_messages`
- 누적 목록: 리스트 append형 reducer
- 카운터: 합산 reducer

reducer 없이 마지막 write만 남는 구조로 두면 tool이 늘어날수록 디버깅이 어려워진다.

### 3. `ToolRuntime`과 node용 `Runtime`을 헷갈린다

`ToolRuntime`은 tool 전용이고, `Runtime`은 graph node나 middleware 쪽에 주입되는 객체다.  
둘 다 context와 store를 다룰 수 있지만, `ToolRuntime`에는 `tool_call_id`, tool 실행 config 같은 tool 전용 정보가 추가로 있다.

### 4. 모델에게는 숨기고 싶은 값을 tool 인자로 직접 받게 만든다

`customer_tier`, `internal_ticket_id`, `allowed_actions` 같은 값은 모델이 생성할 인자가 아니다.  
이런 값은 tool schema에 노출하지 말고 `runtime.state`나 `runtime.context`에서 읽는 편이 맞다.

## 정리

LangGraph에서 `ToolRuntime`은 "tool이 graph 런타임과 만나는 표준 인터페이스"에 가깝다.

- 현재 thread state를 읽는다: `runtime.state`
- 사용자별 실행 context를 읽는다: `runtime.context`
- 장기 메모리를 저장한다: `runtime.store`
- `ToolMessage`를 정확히 연결한다: `runtime.tool_call_id`

특히 `ToolNode`와 같이 쓰면 state injection, store 접근, `Command(update=...)` 반영을 한 흐름으로 묶을 수 있다.  
예전 `InjectedState` 계열 예제를 새 프로젝트에 옮길 일이 있다면, 개인적으로는 가장 먼저 `ToolRuntime` 기준으로 재정리하는 편이 유지보수에 훨씬 유리했다.

## References

- [LangChain Tools docs](https://docs.langchain.com/oss/python/langchain/tools)
- [LangGraph Workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents)
- [LangGraph Use the Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [LangGraph Agents reference](https://reference.langchain.com/python/langgraph/agents/)
