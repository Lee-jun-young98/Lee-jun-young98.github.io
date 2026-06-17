---
title: LangGraph ToolNode로 tool 결과와 state 업데이트 함께 반영하기
description: LangGraph ToolNode를 사용해 tool 호출 결과를 ToolMessage로 돌려주고 Command(update=...)로 graph state까지 함께 갱신하는 실전 패턴 정리
date: 2026-06-17
tags:
  - langgraph
  - agent
  - tool-calling
  - python
aliases:
  - "/blog/langgraph-toolnode-command-state-updates"
---

# LangGraph ToolNode로 tool 결과와 state 업데이트 함께 반영하기

LangGraph에서 tool calling loop를 직접 짜다 보면 금방 두 가지가 같이 필요해진다.

- tool 결과를 `ToolMessage`로 메시지 히스토리에 넣기
- tool이 알아낸 값을 graph state에도 함께 저장하기

예를 들면 이런 경우다.

- 고객 ID를 조회한 뒤 `user_info`를 state에 저장하고 다음 응답에 반영하고 싶다.
- 환불 요청처럼 민감한 작업을 tool이 human queue로 넘기고, escalation 상태를 남기고 싶다.
- 여러 tool call이 한 번에 나오면 병렬 실행은 하되 message history 형식은 안전하게 유지하고 싶다.

이때 직접 custom tool executor node를 만드는 것도 가능하지만, 공식 문서 기준으로 `ToolNode`가 이미 병렬 tool 실행, 에러 처리, state injection, `Command` 전파를 처리해 준다.  
특히 tool이 `Command(update=...)`를 반환하는 순간부터는 `ToolNode`를 기본값으로 두는 편이 훨씬 안전하다.

이 글에서는 다음만 빠르게 정리한다.

- `ToolNode`를 언제 쓰는지
- tool이 `Command(update=...)`를 반환할 때 어떤 점이 중요한지
- LLM 없이도 바로 실행해볼 수 있는 최소 예제
- `INVALID_CHAT_HISTORY` 같은 흔한 함정

## 언제 `ToolNode`를 쓰면 좋은가

공식 LangGraph 문서에서 `ToolNode`는 "LangGraph workflow에서 tool을 실행하는 prebuilt node"로 설명한다.  
특히 아래 요구가 있으면 직접 루프를 짜기보다 `ToolNode`부터 보는 편이 좋다.

- 마지막 `AIMessage.tool_calls`를 읽어 tool을 실행해야 한다
- 여러 tool call을 한 번에 처리해야 한다
- tool이 단순 문자열이 아니라 `Command`를 반환해 state를 갱신해야 한다
- tool 결과를 `ToolMessage` 형식으로 안전하게 message history에 남겨야 한다

반대로 tool 호출이 전혀 없거나, 완전히 다른 입출력 스키마의 비메시지 workflow라면 일반 노드 함수만으로 충분하다.

## 사전 준비

Python 3.10+ 환경에서 아래 정도면 예제를 바로 실행할 수 있다.

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

## 1. 최소 예제: tool이 `Command(update=...)`를 반환하는 경우

아래 예제는 "VIP 고객 환불 요청은 human review queue로 escalate한다"는 상황을 단순화한 것이다.  
중요한 점은 tool이 단순 문자열이 아니라 `Command(update=...)`를 반환하면서

- `messages`에 `ToolMessage`를 넣고
- `escalation_reason`, `handled_by` 같은 state도 함께 업데이트한다는 점이다.

```python
from typing import Annotated
from typing_extensions import TypedDict

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.tools import InjectedToolCallId, tool
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import Command


class SupportState(TypedDict):
    messages: Annotated[list, add_messages]
    escalation_reason: str
    handled_by: str


@tool
def escalate_to_human(
    issue: str,
    tool_call_id: Annotated[str, InjectedToolCallId],
) -> Command:
    """Escalate sensitive issues to a human queue."""
    return Command(
        update={
            "escalation_reason": issue,
            "handled_by": "human-review",
            "messages": [
                ToolMessage(
                    content=f"Escalated issue: {issue}",
                    tool_call_id=tool_call_id,
                )
            ],
        }
    )


def agent(state: SupportState):
    tool_call = {
        "name": "escalate_to_human",
        "args": {"issue": "refund over 1000 USD"},
        "id": "call-1",
        "type": "tool_call",
    }
    return {
        "messages": [
            AIMessage(
                content="This needs manual review.",
                tool_calls=[tool_call],
            )
        ]
    }


def should_continue(state: SupportState):
    last_message = state["messages"][-1]
    return "tools" if getattr(last_message, "tool_calls", None) else END


builder = StateGraph(SupportState)
builder.add_node("agent", agent)
builder.add_node("tools", ToolNode([escalate_to_human]))
builder.add_edge(START, "agent")
builder.add_conditional_edges("agent", should_continue, ["tools", END])
builder.add_edge("tools", END)

graph = builder.compile()

result = graph.invoke(
    {
        "messages": [HumanMessage(content="Please refund this VIP customer.")],
        "escalation_reason": "",
        "handled_by": "",
    }
)

print(type(result["messages"][-1]).__name__)
print(result["messages"][-1].content)
print(result["escalation_reason"])
print(result["handled_by"])
```

예상 출력:

```text
ToolMessage
Escalated issue: refund over 1000 USD
refund over 1000 USD
human-review
```

이 예제가 보여주는 핵심은 세 가지다.

- `ToolNode`가 마지막 `AIMessage.tool_calls`를 읽어 적절한 tool을 실행한다.
- tool이 `Command(update=...)`를 반환하면 state 업데이트가 graph state에 반영된다.
- `messages` 안의 `ToolMessage`도 함께 반영되어 이후 LLM 호출이 깨지지 않는다.

## 2. 왜 `messages` 안에 `ToolMessage`를 꼭 넣어야 하나

공식 문서에서 가장 중요하게 강조하는 규칙 중 하나가 이것이다.  
tool이 `Command`를 반환해 message history를 갱신할 때는 `messages` 키를 포함해야 하고, 그 안에는 대응되는 `ToolMessage`가 들어 있어야 한다.

이유는 단순하다.

- LLM은 `AIMessage`의 tool call 뒤에 그 결과인 `ToolMessage`가 따라오길 기대한다.
- 이 형식이 깨지면 이후 model node에서 message history를 정상적으로 읽지 못할 수 있다.
- 실제로 이 문제가 커지면 `INVALID_CHAT_HISTORY` 오류로 이어진다.

즉 "tool이 state만 갱신하고 메시지는 안 남겨도 되겠지"라고 생각하면 쉽게 꼬인다.

## 3. 직접 custom tool node를 만들 때보다 무엇이 편한가

공식 docs의 quickstart 예제처럼 직접 tool executor node를 만들 수도 있다.  
하지만 tool이 단순 문자열을 돌려주는 수준을 넘어서면 `ToolNode` 쪽이 이점이 분명하다.

- 여러 tool call 병렬 실행을 기본으로 처리한다
- tool 에러 처리 경로를 표준 방식으로 가져가기 쉽다
- `Command(update=...)` 반환을 state에 자동 반영한다
- message history를 `ToolMessage` 중심으로 맞추기 쉽다

특히 공식 Graph API 문서는 "tool이 `Command`를 통해 state를 업데이트한다면 prebuilt `ToolNode` 사용을 권장한다"고 명시한다.  
custom node에서 tool을 직접 호출할 경우에는 tool이 반환한 `Command`를 노드가 다시 수동 전파해야 한다.

## 4. `goto`를 tool 안에서 쓸 때 주의할 점

LangGraph는 tool에서도 `Command(goto=...)`를 반환할 수 있다.  
다만 공식 Graph API 문서 기준으로 tool 안의 `goto`는 "동적 edge를 추가"하는 방식이다.

이 말은 곧 아래를 뜻한다.

- tool이 `goto`를 반환해도
- tool을 호출한 노드에 이미 정의된 static edge가 있으면
- 둘이 함께 실행되어 의도하지 않은 흐름이 생길 수 있다

그래서 한 노드 기준으로는 보통 둘 중 하나만 택하는 편이 안전하다.

- 다음 경로를 static edge로 관리한다
- 또는 tool-driven `goto`로 관리한다

둘을 섞어 쓰면 디버깅이 빠르게 어려워진다.

## 5. 자주 생기는 함정

### 5-1. `ToolMessage` 없이 state만 업데이트하면 `INVALID_CHAT_HISTORY`로 이어질 수 있다

공식 오류 문서 기준으로, `AIMessage.tool_calls`에 대응하는 `ToolMessage`가 없으면 message history가 malformed 상태가 된다.  
이 오류는 `create_agent`에서 특히 자주 보이지만, 근본 원인은 message history 불일치다.

### 5-2. tool 실행 전에 interrupt가 걸렸다면 재개 입력을 조심해야 한다

문서 기준으로 `tools` 노드 전에 interrupt가 걸린 상태에서, `None`이나 적절한 `ToolMessage` 대신 엉뚱한 새 `HumanMessage`를 넣고 재개하면 역시 chat history가 깨질 수 있다.

이럴 때는 아래 둘 중 하나로 복구한다.

- 맞는 `ToolMessage`를 넣어 다시 이어간다
- `graph.get_state()`와 `graph.update_state()`로 message history를 정리한 뒤 `graph.invoke(None, config)`로 재개한다

### 5-3. custom node가 tool의 `Command`를 먹어버릴 수 있다

직접 tool executor node를 만들면 이런 실수를 하기 쉽다.

```python
def bad_tool_executor(state):
    result = my_tool.invoke(...)
    return {"messages": [result]}
```

tool이 사실 `Command`를 반환했는데 노드가 이를 일반 값처럼 처리하면 state update가 사라진다.  
이 지점 때문에도 `ToolNode`가 실전 기본값에 가깝다.

### 5-4. state key와 message reducer를 같이 설계해야 한다

메시지 기반 graph에서는 보통 `messages: Annotated[list, add_messages]`를 쓴다.  
이 reducer가 없으면 `messages` 업데이트가 기존 히스토리를 덮어써서 예상과 다른 결과가 나올 수 있다.

## 6. 언제 특히 유용한가

개인적으로는 아래 상황에서 `ToolNode` 감각이 확실히 중요해진다.

- customer support agent가 tool 결과를 state에 저장해야 할 때
- tool 실행 이후 human review나 approval queue로 넘겨야 할 때
- tool call이 여러 개 나오는 agent loop를 직접 제어하고 싶을 때
- `create_agent`보다 낮은 레벨에서 graph를 커스텀하고 싶을 때

이런 경우 `ToolNode`를 이해하면 LangGraph agent를 "LLM + tool + state update" 단위로 훨씬 안정적으로 쪼갤 수 있다.

## 마무리

`ToolNode`는 단순히 tool 함수를 호출하는 헬퍼가 아니라, LangGraph의 메시지 규약과 state 업데이트 규약을 같이 지켜 주는 prebuilt 실행 노드다.

- tool 결과만 필요하다: `ToolMessage`
- tool이 state도 바꿔야 한다: `Command(update=...)`
- 둘을 안전하게 graph에 반영하고 싶다: `ToolNode`

LangGraph를 조금만 깊게 쓰기 시작하면 custom tool loop를 직접 짜고 싶어지는 순간이 오는데, 그 전에 `ToolNode`가 대신 해결해 주는 범위를 정확히 아는 편이 유지보수에 훨씬 유리하다.

## 참고 자료

- [LangGraph Workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents)
- [LangGraph Use the Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [LangGraph Graph API Overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph INVALID_CHAT_HISTORY](https://docs.langchain.com/oss/python/langgraph/errors/INVALID_CHAT_HISTORY)
