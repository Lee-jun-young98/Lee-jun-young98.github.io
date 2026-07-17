---
title: "LangGraph 기존 thread에 새 입력을 넣을 때는 dict를 쓰고, interrupt 재개에만 Command(resume=...) 쓰기"
description: "LangGraph checkpointer를 쓸 때 새 사용자 입력은 plain dict로 다시 시작하고, Command는 interrupt 재개에만 써야 하는 이유를 검증 예제와 함께 정리한 노트"
date: 2026-07-17
tags:
  - langgraph
  - python
  - agents
  - persistence
aliases:
  - "/blog/langgraph-command-resume-vs-dict-thread-inputs"
---

# LangGraph 기존 thread에 새 입력을 넣을 때는 dict를 쓰고, interrupt 재개에만 Command(resume=...) 쓰기

LangGraph에서 `checkpointer`와 `thread_id`를 붙여 멀티턴 흐름을 만들다 보면 아래처럼 쓰고 싶어질 때가 많다.

```python
graph.invoke(Command(update={"messages": [...]}), config)
```

겉보기에는 "기존 thread에 새 메시지를 추가하고 이어서 실행"처럼 보이지만, 공식 Graph API 문서 기준 이 패턴은 멀티턴 대화 이어가기 용도가 아니다.

문서가 명확하게 말하는 핵심은 하나다.

- 새 사용자 입력으로 같은 thread를 계속할 때는 plain dict를 넣는다
- `Command(resume=...)`는 `interrupt()` 이후 멈춘 실행을 재개할 때 쓴다

이 차이를 놓치면 graph가 멈춘 것처럼 보이거나, state 일부만 바뀌고 node는 다시 돌지 않는 상황을 만나기 쉽다.

## 언제 이 글이 필요한가

아래 중 하나라도 해당하면 이 주제가 바로 실전 이슈다.

- `InMemorySaver`, `PostgresSaver` 같은 checkpointer를 붙였다
- `thread_id`로 같은 대화를 여러 번 이어서 호출한다
- `interrupt()` 기반 승인 흐름과 일반 사용자 follow-up 메시지를 둘 다 다룬다
- `Command(update=...)`를 input으로 넣었는데 새 응답이 생성되지 않았다

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langgraph
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langgraph
```

이 글의 예제는 2026년 7월 17일에 `langgraph==1.2.9`로 로컬 검증했다.

## 먼저 기억할 규칙 3개

헷갈림을 줄이려면 아래 세 줄로 기억하는 게 가장 쉽다.

1. 같은 `thread_id`에 새 사용자 입력을 넣을 때는 plain dict를 `graph.invoke(...)`에 전달한다.
2. `Command(resume=...)`는 `interrupt()`가 반환값을 기다리는 지점에 값을 넣어 재개할 때 쓴다.
3. `Command(update=...)`를 input으로 넣으면 `__start__`에서 새 턴을 시작하는 것이 아니라, 최신 checkpoint에서 resume semantics로 동작한다.

세 번째가 특히 중요하다. 문서 표현대로 이미 graph가 끝난 thread에 `Command(update=...)`를 input으로 넣으면 "latest checkpoint에서 resume"하려고 하기 때문에, 끝난 뒤에는 실행할 다음 step이 없어 graph가 멈춘 것처럼 보일 수 있다.

## 예제 1. 끝난 thread에 `Command(update=...)`를 넣으면 새 응답이 생성되지 않는다

아래 예제는 가장 작은 재현이다.

```python
from typing import Annotated
from typing_extensions import TypedDict

from langchain_core.messages import AnyMessage, AIMessage, HumanMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import Command


class ChatState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]
    draft: str


def respond(state: ChatState):
    text = state["messages"][-1].content
    return {
        "messages": [AIMessage(content=f"echo:{text}")],
        "draft": text.upper(),
    }


graph = (
    StateGraph(ChatState)
    .add_node("respond", respond)
    .add_edge(START, "respond")
    .add_edge("respond", END)
    .compile(checkpointer=InMemorySaver())
)

config = {"configurable": {"thread_id": "cmd-input-demo"}}

first = graph.invoke(
    {"messages": [HumanMessage(content="hello")], "draft": ""},
    config,
)
print(first["messages"][-1].content, first["draft"])

wrong = graph.invoke(
    Command(update={"messages": [HumanMessage(content="follow up")]}),
    config,
)
print(wrong["messages"][-1].content, wrong["draft"])
```

로컬 검증 출력은 아래였다.

```text
echo:hello HELLO
follow up HELLO
```

왜 이상할까.

- `messages`에는 새 사람 메시지가 들어갔다
- 하지만 `respond` node는 다시 실행되지 않았다
- 그래서 마지막 메시지는 `AIMessage("echo:follow up")`가 아니라 그냥 새 `HumanMessage("follow up")`로 끝난다
- `draft`도 이전 값 `HELLO` 그대로 남아 있다

즉 이 패턴은 "새 입력으로 새 턴 시작"이 아니라 "마지막 checkpoint에서 재개 시도"에 가깝다.

## 예제 2. 같은 thread의 새 턴은 plain dict로 넣어야 한다

같은 예제에서 두 번째 호출만 plain dict로 바꾸면 의도한 대로 동작한다.

```python
correct = graph.invoke(
    {"messages": [HumanMessage(content="follow up")]},
    config,
)
print(correct["messages"][-1].content, correct["draft"])
```

검증 출력:

```text
echo:follow up FOLLOW UP
```

이게 맞는 이유는 분명하다.

- 같은 `thread_id`라서 이전 checkpoint state는 유지된다
- 하지만 input이 plain dict이므로 graph는 `__start__`부터 새 턴처럼 다시 시작한다
- 따라서 `respond` node가 정상적으로 다시 실행된다

실무 기준으로는 아래처럼 나누면 거의 안 틀린다.

- 새 사용자 질문, follow-up, 추가 요청: plain dict
- 중단된 승인/검토/입력 대기 지점 재개: `Command(resume=...)`

## 예제 3. `Command(resume=...)`가 맞는 경우는 interrupt 재개다

이번에는 정말 `Command` input이 필요한 경우다.

```python
from typing import Annotated
from typing_extensions import TypedDict

from langchain_core.messages import AnyMessage, AIMessage, HumanMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import Command, interrupt


class ApprovalState(TypedDict):
    messages: Annotated[list[AnyMessage], add_messages]


def ask(state: ApprovalState):
    answer = interrupt("승인할까요?")
    return {
        "messages": [
            HumanMessage(content=str(answer)),
            AIMessage(content=f"approved:{answer}"),
        ]
    }


graph = (
    StateGraph(ApprovalState)
    .add_node("ask", ask)
    .add_edge(START, "ask")
    .add_edge("ask", END)
    .compile(checkpointer=InMemorySaver())
)

config = {"configurable": {"thread_id": "cmd-resume-demo"}}

for event in graph.stream({"messages": []}, config):
    print(event)

final_state = graph.invoke(Command(resume="yes"), config)
print([message.content for message in final_state["messages"]])
```

검증 출력은 아래처럼 나왔다.

```text
{'__interrupt__': (...)}
['yes', 'approved:yes']
```

이 경우에는 graph가 실제로 `interrupt()` 지점에서 멈춰 있었기 때문에 `Command(resume="yes")`가 정확한 입력이다.  
즉 `Command` input은 "멈춘 실행을 다시 움직일 때"가 핵심이지, "끝난 실행에 새 메시지를 추가할 때"가 아니다.

## 내부 동작을 어떻게 이해하면 좋을까

공식 문서 표현을 기준으로 정리하면 input 의미는 아래처럼 나뉜다.

- plain dict input: 같은 thread state를 바탕으로 `__start__`부터 새 실행 시작
- `Command(resume=...)`: 가장 최근 interrupt 지점에 재개값 전달
- `Command(update=...)` input: 최신 checkpoint에서 resume semantics로 처리

그래서 이미 종료된 graph에 `Command(update=...)`를 넣으면 아래 현상이 자연스럽다.

- state update 일부는 들어갈 수 있다
- 하지만 다음 node 실행은 일어나지 않을 수 있다
- 결과적으로 "새 메시지는 들어갔는데 응답은 안 생김" 같은 어색한 상태가 나온다

## 자주 하는 실수

### 1. `Command(update=...)`를 멀티턴 채팅 append API처럼 본다

LangGraph 문맥에서 input용 `Command`는 일반 append 요청이 아니다.  
문서 기준으로 input에서 권장되는 패턴은 사실상 `resume` 중심이다.

### 2. `thread_id`가 같으면 어떤 input이든 같은 방식으로 처리된다고 생각한다

`thread_id`는 어떤 checkpoint를 읽을지 정할 뿐이고, 실행을 어디서 시작할지는 input 형태가 결정한다.

### 3. 종료된 thread와 interrupt된 thread를 같은 흐름으로 다룬다

둘은 다르다.

- 종료된 thread: 새 턴 input dict
- interrupt된 thread: `Command(resume=...)`

### 4. 새 사용자 입력과 운영자 수동 patch를 구분하지 않는다

운영 중 state patch가 목적이면 `update_state()`나 `bulk_update_state()`가 더 직접적일 수 있다.  
사용자 follow-up 메시지를 넣는 문제와는 분리해서 생각하는 편이 안전하다.

## 추천 사용 기준

내 기준에서는 아래 규칙이면 충분하다.

1. 대화형 agent의 일반 턴은 늘 plain dict input으로 넣는다.
2. `interrupt()`를 쓴 노드가 멈춘 경우에만 `Command(resume=...)`를 쓴다.
3. 새 입력이 들어갔는데 node가 다시 돌지 않으면 `Command(update=...)`를 input으로 넣고 있지 않은지 먼저 본다.
4. 수동 상태 수정이 필요하면 input `Command`보다 `update_state()` 계열 API가 더 맞는지 먼저 검토한다.

이 규칙만 지켜도 checkpointer 기반 LangGraph 앱에서 "왜 새 메시지엔 답을 안 하지?" 같은 디버깅 시간을 꽤 줄일 수 있다.

## 참고 자료

- [LangGraph Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph use the graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers)
