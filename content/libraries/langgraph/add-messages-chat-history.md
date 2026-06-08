---
title: "LangGraph add_messages로 채팅 히스토리 안전하게 누적하고 수정하기"
description: "LangGraph MessagesState와 add_messages reducer를 사용해 메시지 히스토리를 append, replace, delete하는 실전 패턴 정리"
date: 2026-06-08
tags:
  - langgraph
  - agent
  - workflow
  - python
aliases:
  - "/blog/langgraph-add-messages-chat-history"
---

# LangGraph add_messages로 채팅 히스토리 안전하게 누적하고 수정하기

LangGraph로 채팅형 agent를 만들다 보면 `messages` 상태를 그냥 `list`로만 다루기엔 금방 한계가 보인다.

- 새 메시지는 뒤에 계속 붙이고 싶다
- 이미 있는 메시지를 같은 ID로 교체하고 싶다
- 오래된 메시지를 지우거나 전체 히스토리를 비우고 싶다
- 입력은 OpenAI 스타일 dict로 넣고, 내부에서는 message object로 다루고 싶다

공식 Graph API 문서 기준으로 이런 경우에는 일반적인 `operator.add` 대신 `add_messages` reducer를 쓰는 편이 안전하다. `MessagesState`도 내부적으로 같은 reducer를 전제로 한 편의 스키마다.

이 글에서는 다음만 실전 기준으로 짧게 정리한다.

- `add_messages`가 필요한 이유
- `MessagesState`로 최소 예제 시작하기
- 기존 메시지 교체와 삭제 패턴
- `Overwrite`로 누적 대신 전체 교체가 필요한 경우
- 자주 하는 실수

## 언제 이 패턴을 쓰면 좋은가

아래 조건이면 거의 바로 후보에 올리면 된다.

- LLM 호출 전후 메시지 히스토리를 상태에 계속 쌓아야 한다
- 사람 메시지, AI 메시지, tool 결과 메시지를 한 상태 키에서 함께 관리해야 한다
- 특정 메시지를 수정하거나 삭제하는 후처리 단계가 필요하다
- `thread_id` 기반 checkpointer와 함께 짧은 메모리 패턴을 만들고 싶다

반대로 단순 문자열 로그를 누적하는 정도면 `Annotated[list[str], operator.add]`만으로도 충분하다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langgraph
```

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langgraph
```

## 1. 가장 작은 `MessagesState` 예제

공식 문서에서 권장하는 가장 실용적인 시작점은 `MessagesState`다.  
직접 `TypedDict`에 reducer를 쓰지 않아도 `messages` 채널이 이미 준비돼 있다.

```python
from langchain_core.messages import AIMessage
from langgraph.graph import MessagesState, START, StateGraph


def answer(state: MessagesState):
    last_user_message = state["messages"][-1].content
    return {
        "messages": [
            AIMessage(content=f"질문을 받았습니다: {last_user_message}")
        ]
    }


graph = (
    StateGraph(MessagesState)
    .add_node("answer", answer)
    .add_edge(START, "answer")
    .compile()
)

result = graph.invoke(
    {
        "messages": [
            {"role": "user", "content": "LangGraph에서 messages 상태는 어떻게 다루나요?"}
        ]
    }
)

for message in result["messages"]:
    print(type(message).__name__, "->", message.content)
```

핵심은 노드가 기존 `messages` 전체를 다시 만들어서 반환하지 않는다는 점이다.  
새 메시지 한 개만 반환해도 `add_messages` reducer가 기존 히스토리에 안전하게 합쳐 준다.

## 2. 왜 `operator.add` 대신 `add_messages`인가

일반 reducer를 아래처럼 두면:

```python
from typing import Annotated
import operator
from typing_extensions import TypedDict
from langchain_core.messages import AnyMessage


class BadState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
```

겉으로는 append-only 히스토리처럼 보이지만, 채팅 메시지에는 추가 고려사항이 있다.

- 기존 메시지를 ID 기준으로 교체해야 할 수 있다
- dict shorthand를 message object로 변환해야 할 수 있다
- `RemoveMessage` 같은 삭제 연산을 처리해야 한다

공식 Graph API 문서와 reference 문서 기준으로 `add_messages`는 이런 요구를 처리하도록 설계돼 있다.  
즉, "메시지 리스트 전용 reducer"라고 이해하는 편이 맞다.

직접 스키마를 선언하고 싶다면 이렇게 쓴다.

```python
from typing import Annotated
from typing_extensions import TypedDict
from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


class ChatState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    user_id: str
```

실무에서는 특별한 이유가 없으면 `MessagesState`를 먼저 쓰고, 추가 필드가 필요할 때 확장하는 편이 단순하다.

```python
from langgraph.graph import MessagesState


class ChatState(MessagesState):
    user_id: str
    summary: str
```

## 3. 기존 메시지를 수정할 때는 ID가 중요하다

`add_messages`의 좋은 점은 같은 ID를 가진 메시지가 들어오면 기존 메시지를 교체할 수 있다는 점이다.  
아래 예제는 초안 답변을 만든 뒤, 같은 메시지 ID로 정제된 답변으로 바꾸는 흐름이다.

```python
from langchain_core.messages import AIMessage
from langgraph.graph import MessagesState, START, END, StateGraph


def draft_answer(state: MessagesState):
    draft = AIMessage(
        content="초안: LangGraph는 상태 기반 오케스트레이션 프레임워크입니다.",
        id="answer-1",
    )
    return {"messages": [draft]}


def refine_answer(state: MessagesState):
    refined = AIMessage(
        content="수정본: LangGraph는 상태 기반 workflow와 agent orchestration을 위한 프레임워크입니다.",
        id="answer-1",
    )
    return {"messages": [refined]}


graph = (
    StateGraph(MessagesState)
    .add_node("draft_answer", draft_answer)
    .add_node("refine_answer", refine_answer)
    .add_edge(START, "draft_answer")
    .add_edge("draft_answer", "refine_answer")
    .add_edge("refine_answer", END)
    .compile()
)

result = graph.invoke({"messages": [{"role": "user", "content": "LangGraph를 한 줄로 설명해줘"}]})

for message in result["messages"]:
    print(message.id, "->", message.content)
```

최종 결과에는 `answer-1`이 두 번 쌓이지 않고, 마지막 버전 하나만 남는다.

이 패턴은 아래 상황에서 특히 유용하다.

- streaming 중간 텍스트를 최종 답변으로 치환할 때
- tool 호출 전 임시 안내 메시지를 나중에 정리된 메시지로 바꿀 때
- review 단계를 거친 AI 답변으로 같은 메시지를 갱신할 때

## 4. 오래된 메시지 삭제는 `RemoveMessage`로 한다

공식 memory 문서 기준으로 메시지 삭제는 `RemoveMessage`를 써야 한다.  
이 패턴은 `add_messages` reducer가 있는 상태 키에서만 제대로 동작한다.

```python
from langchain_core.messages import RemoveMessage
from langgraph.graph import MessagesState


def trim_old_messages(state: MessagesState):
    messages = state["messages"]
    if len(messages) <= 4:
        return {}

    return {
        "messages": [RemoveMessage(id=message.id) for message in messages[:-4]]
    }
```

전체 대화를 비우고 싶으면 `REMOVE_ALL_MESSAGES`를 쓴다.

```python
from langchain_core.messages import RemoveMessage
from langgraph.graph.message import REMOVE_ALL_MESSAGES


def reset_conversation(state: MessagesState):
    return {
        "messages": [RemoveMessage(id=REMOVE_ALL_MESSAGES)]
    }
```

다만 삭제 후 히스토리가 모델 provider 요구사항을 깨지 않는지 확인해야 한다.

- 첫 메시지가 `user`여야 하는 provider가 있다
- tool call이 포함된 assistant 메시지 뒤에는 대응되는 tool 메시지가 필요할 수 있다

메시지 삭제는 "토큰 절약"보다 "유효한 대화 구조 유지"를 먼저 봐야 한다.

## 5. 누적이 아니라 완전 교체가 필요하면 `Overwrite`

`add_messages`를 쓰면 기본 동작은 누적 또는 ID 기반 교체다.  
그런데 요약본만 남기고 원본 히스토리를 통째로 교체하고 싶은 경우도 있다.

이럴 때는 공식 Graph API 문서의 `Overwrite` 패턴을 쓰면 된다.

```python
from langchain_core.messages import AIMessage
from langgraph.graph import MessagesState
from langgraph.types import Overwrite


def collapse_to_summary(state: MessagesState):
    summary_message = AIMessage(
        content="이전 대화 요약: 사용자는 LangGraph message reducer 패턴을 공부 중입니다."
    )
    return {
        "messages": Overwrite([summary_message])
    }
```

주의할 점은 병렬 실행 같은 같은 super-step 안에서 여러 노드가 같은 키를 동시에 `Overwrite`하면 오류가 날 수 있다는 점이다.  
전체 교체는 fan-out 이후 reduce 단계처럼 단일 노드에서 수행하는 편이 안전하다.

## 6. 실무에서 자주 하는 실수

### 6-1. `messages`를 일반 문자열 리스트처럼 다룬다

채팅 히스토리는 단순 append 리스트가 아니다.  
수정, 삭제, 포맷 변환까지 고려하면 `operator.add`보다 `add_messages`가 맞다.

### 6-2. 기존 메시지를 교체하고 싶은데 ID를 지정하지 않는다

ID가 없으면 새 메시지로 append될 가능성이 크다.  
"수정"이 목적이라면 같은 ID를 유지해야 한다.

### 6-3. 삭제 후 잘못된 대화 구조를 만든다

tool call만 남기고 tool result를 지우거나, system/user 균형을 깨면 모델 호출이 실패할 수 있다.

### 6-4. `MessagesState`를 쓰면서 매번 전체 히스토리를 다시 반환한다

필요 이상으로 큰 상태 업데이트를 만들면 읽기도 어렵고 실수도 늘어난다.  
보통은 새 메시지 또는 삭제/교체에 필요한 최소 메시지만 반환하면 충분하다.

### 6-5. 요약 단계에서 누적과 교체를 구분하지 않는다

요약 메시지를 기존 히스토리에 그냥 append하면 토큰이 줄지 않는다.  
원본을 접고 싶다면 `Overwrite` 또는 `RemoveMessage` 기반 정리 단계를 따로 둬야 한다.

## 7. `MessagesState`와 커스텀 상태를 어떻게 고를까

아래 기준이면 대부분 충분하다.

- 메시지 채널만 필요하다: `MessagesState`
- 메시지 외에 사용자 정보, summary, retrieval 결과도 같이 든다: `class MyState(MessagesState): ...`
- 메시지 채널 이름을 바꾸거나 완전히 다른 reducer 구성이 필요하다: 직접 `TypedDict` 정의

실무에서는 채팅형 agent의 시작점으로 `MessagesState`가 가장 빠르다.  
필요한 추가 필드만 얹어 가는 방식이 유지보수도 쉽다.

## 마무리

LangGraph에서 `messages`는 그냥 리스트가 아니라 상태 병합 규칙이 붙은 채널로 보는 편이 정확하다.

- 기본 채팅 상태 시작점: `MessagesState`
- 메시지 전용 병합 규칙: `add_messages`
- 메시지 교체: 같은 ID로 다시 쓰기
- 메시지 삭제: `RemoveMessage`
- 전체 교체: `Overwrite`

이 기준만 잡아도 짧은 메모리, 대화 요약, tool-call 후처리, human review 후 답변 교체 같은 흐름을 훨씬 덜 헷갈리게 설계할 수 있다.

## 참고 자료

- [LangGraph Use the Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [LangGraph Memory](https://docs.langchain.com/oss/python/langgraph/add-memory)
- [LangGraph `add_messages` Reference](https://reference.langchain.com/python/langgraph/graph/message)
