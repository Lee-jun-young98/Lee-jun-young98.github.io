---
title: LangGraph MessagesState에 사용자 정의 필드 확장하기
description: 내장 MessagesState를 상속해 add_messages reducer를 재사용하고 대화 상태에 업무 필드를 안전하게 추가하는 방법
date: 2026-08-20
tags:
  - langgraph
  - messages
  - state
  - python
aliases:
  - /blog/langgraph-messages-state-custom-fields
---

# LangGraph MessagesState에 사용자 정의 필드 확장하기

채팅형 그래프를 만들 때마다 `messages` 필드와 `add_messages` reducer를 직접 선언할 필요는 없습니다. LangGraph의 `MessagesState`에는 이미 메시지 목록과 전용 reducer가 정의되어 있습니다.

```python
from langgraph.graph import MessagesState


class SupportState(MessagesState):
    customer_id: str
    turn_count: int
```

이렇게 상속하면 메시지의 추가·ID 기반 교체·입력 역직렬화는 `MessagesState`에 맡기고, 도메인에 필요한 필드만 선언할 수 있습니다.

## 사전 준비

Python 3.10 이상과 최신 LangGraph를 설치합니다. 아래 예제는 모델이나 API key 없이 실행할 수 있습니다.

```bash
pip install -U langgraph
```

## 실행 가능한 예제

사용자 메시지를 받아 간단한 상담 답변을 만들고 턴 수를 증가시키는 그래프입니다.

```python
from langchain_core.messages import AIMessage
from langgraph.graph import END, START, MessagesState, StateGraph


class SupportState(MessagesState):
    customer_id: str
    turn_count: int


def reply(state: SupportState):
    question = state["messages"][-1].content
    return {
        "messages": [
            AIMessage(
                content=f"{state['customer_id']} 고객님, '{question}' 문의를 확인했습니다.",
                id=f"reply-{state['turn_count'] + 1}",
            )
        ],
        "turn_count": state["turn_count"] + 1,
    }


builder = StateGraph(SupportState)
builder.add_node("reply", reply)
builder.add_edge(START, "reply")
builder.add_edge("reply", END)
graph = builder.compile()

result = graph.invoke(
    {
        "messages": [{"role": "user", "content": "배송 상태를 알려 주세요"}],
        "customer_id": "C-42",
        "turn_count": 0,
    }
)

print(type(result["messages"][0]).__name__)
print(result["messages"][-1].content)
print(result["turn_count"])
```

예상 출력은 다음과 같습니다.

```text
HumanMessage
C-42 고객님, '배송 상태를 알려 주세요' 문의를 확인했습니다.
1
```

입력은 `{"role": "user", ...}` 형태의 짧은 dict였지만, 노드가 읽을 때는 `HumanMessage`로 변환됩니다. 노드는 전체 메시지 목록을 다시 반환하지 않고 **이번에 추가할 메시지만** 반환합니다. 나머지 병합은 상속받은 `add_messages` reducer가 처리합니다.

## MessagesState가 실제로 제공하는 것

현재 Python API의 정의는 개념적으로 다음과 같습니다.

```python
from typing import Annotated
from typing_extensions import TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class MessagesState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
```

따라서 `MessagesState`는 실행 엔진이나 메모리 저장소가 아니라 **미리 정의된 state schema**입니다. 상속해도 checkpoint가 자동으로 생기거나 모델이 자동 호출되지는 않습니다. 대화를 호출 사이에 유지하려면 별도의 checkpointer와 같은 `thread_id`가 필요합니다.

## 일반 필드는 기본적으로 교체된다

상속으로 추가한 `turn_count`, `customer_id`에는 reducer를 붙이지 않았습니다. 이런 필드는 노드가 새 값을 반환하면 이전 값을 교체합니다.

```python
return {
    "messages": [AIMessage(content="답변")],  # add_messages로 병합
    "turn_count": state["turn_count"] + 1,   # 새 값으로 교체
}
```

병렬 노드 여러 개가 같은 일반 필드를 동시에 갱신하면 충돌할 수 있습니다. 병렬 결과를 모아야 하는 필드는 `Annotated`로 별도 reducer를 선언합니다.

```python
import operator
from typing import Annotated

from langgraph.graph import MessagesState


class ParallelState(MessagesState):
    evidence: Annotated[list[str], operator.add]
```

## 메시지를 수정할 때는 ID를 유지한다

`messages`는 단순한 `list + list`가 아닙니다. 같은 ID의 메시지를 반환하면 기존 항목을 교체할 수 있습니다.

```python
from langchain_core.messages import AIMessage


def correct_reply(state: SupportState):
    return {
        "messages": [
            AIMessage(content="정정된 답변입니다.", id="reply-1")
        ]
    }
```

기존 메시지에 `id="reply-1"`이 있다면 새 항목을 뒤에 중복 추가하지 않고 해당 메시지를 교체합니다. 반대로 ID를 새로 만들거나 생략하면 새 메시지로 추가됩니다.

## 언제 직접 schema를 선언할까

다음 경우에는 `MessagesState` 상속보다 직접 `TypedDict`를 선언하는 편이 명확합니다.

- 메시지 필드 이름을 `messages`가 아닌 다른 이름으로 써야 할 때
- `add_messages(format="langchain-openai")`처럼 reducer 옵션을 직접 고정해야 할 때
- 공개 input/output schema에서 메시지 필드를 별도로 숨기거나 제한해야 할 때
- Pydantic 또는 dataclass 기반 state가 필요한 그래프일 때

직접 선언할 때는 메시지 직렬화 호환성을 위해 `AnyMessage`를 사용합니다.

```python
from typing import Annotated
from typing_extensions import TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class CustomMessageState(TypedDict):
    messages: Annotated[
        list[AnyMessage],
        add_messages(format="langchain-openai"),
    ]
```

## 자주 놓치는 함정

- 노드에서 `state["messages"] + [new_message]`를 반환합니다. reducer가 기존 목록과 다시 병합하므로 이전 메시지가 중복될 수 있습니다. 새 update만 반환합니다.
- `MessagesState`가 대화를 호출 사이에 자동 저장한다고 생각합니다. 영속성은 checkpointer와 `thread_id`의 역할입니다.
- dict 입력을 계속 dict로 가정합니다. reducer가 메시지 객체로 역직렬화하므로 노드에서는 `message.content`처럼 속성으로 읽습니다.
- 사용자 정의 list 필드도 자동 누적된다고 생각합니다. `messages` 이외 필드에는 필요한 reducer를 직접 붙여야 합니다.
- 여러 병렬 노드가 reducer 없는 같은 필드를 갱신합니다. 병합 규칙을 정하거나 노드별 필드로 분리합니다.
- 메시지 수정 시 새 ID를 사용합니다. 기존 메시지를 고치려면 같은 ID를 유지해야 합니다.

## 정리

`MessagesState`는 채팅형 `StateGraph`의 반복적인 메시지 schema 선언을 줄여 줍니다. 상속한 state에는 업무 필드만 추가하고, 노드는 전체 기록 대신 새 메시지 update만 반환하면 됩니다. 다만 메시지 외 필드의 reducer, 호출 간 persistence, input/output 경계는 자동으로 생기지 않으므로 그래프 요구사항에 맞게 별도로 설계해야 합니다.

## 참고 자료

- [LangGraph Graph API 개요](https://docs.langchain.com/oss/python/langgraph/graph-api#messagesstate)
- [LangGraph Graph API 사용 가이드](https://docs.langchain.com/oss/python/langgraph/use-graph-api#messagesstate)
- [MessagesState API reference](https://reference.langchain.com/python/langgraph/graph/message/MessagesState)
- [add_messages API reference](https://reference.langchain.com/python/langgraph/graph/message/add_messages)
