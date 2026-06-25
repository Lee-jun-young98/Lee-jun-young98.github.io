---
title: "LangGraph event streaming v3로 상태, 토큰, interrupt를 한 스트림에서 다루기"
description: 'LangGraph `stream_events(..., version="v3")`의 typed projection, raw protocol event, interrupt resume 패턴을 Python 예제로 정리한 실전 노트'
date: 2026-06-25
tags:
  - langgraph
  - python
  - streaming
  - observability
aliases:
  - "/blog/langgraph-event-streaming-v3-projections"
---

# LangGraph event streaming v3로 상태, 토큰, interrupt를 한 스트림에서 다루기

LangGraph로 workflow나 agent를 만들다 보면 `invoke()`로 최종 결과만 받는 방식이 곧 답답해진다.

- UI에 중간 상태를 바로 보여 주고 싶다
- LLM 토큰과 state 변화를 같은 실행에서 함께 다루고 싶다
- subgraph 실행이나 human approval interrupt를 스트림으로 보고 싶다
- `stream_mode` 튜플 분기보다 더 읽기 쉬운 API가 필요하다

이럴 때 공식 문서가 현재 가장 먼저 권장하는 방식이 `stream_events(..., version="v3")` 기반 event streaming이다.

LangGraph 공식 문서 기준으로 event streaming은 typed projection을 제공한다. 즉 하나의 실행 스트림 위에서 `stream.values`, `stream.messages`, `stream.subgraphs`, `stream.output`, `stream.interrupts` 같은 프로젝션을 각각 읽을 수 있다. LangGraph 릴리스 노트도 이 기능을 v1.2.0의 핵심 추가 사항으로 소개한다.

이 글에서는 다음 흐름만 실무 기준으로 정리한다.

- 언제 `stream()`보다 `stream_events(..., version="v3")`가 더 좋은지
- `stream.values`와 `stream.output`으로 상태를 읽는 방법
- raw protocol event로 `custom`, `updates` 같은 채널을 직접 보는 방법
- `stream.messages`, `stream.interrupts`, `stream.interrupted`를 언제 쓰는지
- 자주 생기는 함정

## 언제 이 패턴이 특히 유용한가

아래 상황이면 event streaming부터 보는 편이 좋다.

- 프론트엔드에서 토큰, 상태, 중단 이벤트를 동시에 보여 줘야 한다
- raw `stream_mode` 분기보다 projection 기반 API가 더 읽기 쉽다
- human-in-the-loop 승인 흐름을 한 run 객체로 다루고 싶다
- subgraph나 agent 내부 실행을 namespace 문자열 파싱 없이 추적하고 싶다

반대로 특정 low-level stream mode만 빠르게 받고 싶다면 기존 `stream()` API가 더 단순할 수 있다. 공식 문서도 application code에는 event streaming을, raw runtime event 접근에는 stream-mode API를 권장한다.

## 사전 준비

상태 스트리밍과 interrupt 예제는 `langgraph`만 있으면 된다.

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

LLM 토큰 예제까지 직접 돌려 보려면 모델 integration이 추가로 필요하다.

```bash
pip install -U langchain-openai
```

## 1. 가장 작은 상태 스트리밍 예제

event streaming의 가장 간단한 시작점은 `stream.values`와 `stream.output`이다.

```python
from typing import TypedDict

from langgraph.graph import END, START, StateGraph


class DraftState(TypedDict):
    topic: str
    outline: list[str]
    draft: str


def make_outline(state: DraftState):
    return {
        "outline": [
            f"{state['topic']} 개요",
            f"{state['topic']} 사용 예제",
            f"{state['topic']} 주의점",
        ]
    }


def write_draft(state: DraftState):
    return {"draft": "\n".join(f"- {item}" for item in state["outline"])}


builder = StateGraph(DraftState)
builder.add_node("make_outline", make_outline)
builder.add_node("write_draft", write_draft)
builder.add_edge(START, "make_outline")
builder.add_edge("make_outline", "write_draft")
builder.add_edge("write_draft", END)

graph = builder.compile()

stream = graph.stream_events({"topic": "LangGraph event streaming"}, version="v3")

for snapshot in stream.values:
    print(snapshot)

final_state = stream.output
print(final_state["draft"])
```

여기서 중요한 점은 두 가지다.

- `stream.values`는 step이 끝날 때마다 full state snapshot을 준다
- `stream.output`은 같은 실행의 최종 결과를 기다리는 projection이다

즉 "실행 중간에는 snapshot을 보고, 마지막에는 최종 상태를 받는다"는 패턴을 같은 run 객체에서 처리할 수 있다.

## 2. `custom`, `updates`, `tasks`까지 보고 싶으면 raw protocol event를 읽는다

typed projection이 편하긴 하지만, 모든 채널이 projection으로 바로 노출되는 것은 아니다.  
공식 문서 기준으로 raw event를 직접 순회하면 `values`, `updates`, `messages`, `tools`, `lifecycle`, `checkpoints`, `tasks`, `custom` 같은 채널을 모두 볼 수 있다.

아래 예제는 node 내부에서 `custom` 진행 이벤트를 보내고, raw event에서 필요한 채널만 골라 읽는 방식이다.

```python
from typing import TypedDict

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    topic: str
    outline: list[str]
    draft: str


def make_outline(state: State):
    writer = get_stream_writer()
    writer({"stage": "outline", "progress": 25})
    return {"outline": [f"{state['topic']} 소개", f"{state['topic']} 예제"]}


def write_draft(state: State):
    writer = get_stream_writer()
    writer({"stage": "draft", "progress": 75})
    return {"draft": "\n".join(f"- {item}" for item in state["outline"])}


builder = StateGraph(State)
builder.add_node("make_outline", make_outline)
builder.add_node("write_draft", write_draft)
builder.add_edge(START, "make_outline")
builder.add_edge("make_outline", "write_draft")
builder.add_edge("write_draft", END)
graph = builder.compile()

stream = graph.stream_events({"topic": "LangGraph"}, version="v3")

for event in stream:
    method = event["method"]
    data = event["params"]["data"]

    if method == "custom":
        print("[custom]", data)
    elif method == "values":
        print("[values]", data)
```

이 방식은 다음처럼 이해하면 편하다.

- projection API: `stream.values`, `stream.messages`, `stream.subgraphs`, `stream.output`
- raw event API: `for event in stream: ...`

UI 레이어는 projection을 쓰고, 디버깅이나 운영 관측은 raw event를 일부 섞는 식이 실무에서 가장 무난하다.

## 3. LLM 토큰은 `stream.messages`로 읽는다

공식 문서 기준으로 `stream.messages`는 LLM 호출마다 하나의 `ChatModelStream`을 제공한다. 여기서 `message.text`는 동기 코드에서는 iterable이고, `str(message.text)`로 완성된 텍스트를 바로 얻을 수도 있다.

```python
from langchain_openai import ChatOpenAI
from langgraph.graph import MessagesState, START, StateGraph


model = ChatOpenAI(model="gpt-4.1-mini")


def call_model(state: MessagesState):
    response = model.invoke(state["messages"])
    return {"messages": [response]}


builder = StateGraph(MessagesState)
builder.add_node("call_model", call_model)
builder.add_edge(START, "call_model")
graph = builder.compile()

stream = graph.stream_events(
    {"messages": [{"role": "user", "content": "LangGraph event streaming을 한 문장으로 설명해줘."}]},
    version="v3",
)

for message in stream.messages:
    for token in message.text:
        print(token, end="", flush=True)
```

토큰만 필요한 프론트엔드라면 이 projection 하나로도 충분하다.  
반면 text, reasoning, tool-call delta를 "도착 순서 그대로" 합쳐 보여 줘야 한다면 문서 권장대로 raw message event를 직접 읽는 편이 더 정확하다.

## 4. interrupt 재개도 같은 패턴으로 다룬다

event streaming이 특히 편한 지점은 human-in-the-loop 승인 흐름이다.  
공식 문서 기준으로 interrupt를 쓰려면 checkpointer와 `thread_id`가 필요하고, 승인 대기 여부는 `stream.interrupted`와 `stream.interrupts`로 확인한다.

```python
from typing import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt


class ApprovalState(TypedDict):
    draft: str
    approved: bool


def review(state: ApprovalState):
    approved = interrupt(
        {
            "kind": "approval",
            "question": "이 초안을 게시할까요?",
            "draft": state["draft"],
        }
    )
    return {"approved": bool(approved)}


builder = StateGraph(ApprovalState)
builder.add_node("review", review)
builder.add_edge(START, "review")
builder.add_edge("review", END)

graph = builder.compile(checkpointer=InMemorySaver())
config = {"configurable": {"thread_id": "approval-demo"}}

stream = graph.stream_events({"draft": "배포 전 초안", "approved": False}, config=config, version="v3")
final_before_pause = stream.output

if stream.interrupted:
    print(stream.interrupts)

resumed = graph.stream_events(Command(resume=True), config=config, version="v3")
final_after_resume = resumed.output
print(final_after_resume["approved"])
```

핵심은 아래 순서다.

1. 첫 실행이 interrupt에서 멈춘다
2. `stream.interrupts`에 승인 요청 payload가 들어온다
3. 같은 `thread_id`로 `Command(resume=...)`를 넣어 재개한다
4. 재개 후 최종 state는 다시 `stream.output`으로 받는다

이 패턴은 승인 UI, 검토 대기 큐, 백오피스 수동 확인 흐름에 바로 연결하기 좋다.

## 5. `stream()`과 event streaming은 어떻게 고를까

event streaming이 더 적합한 경우:

- application code에서 projection 단위로 소비하고 싶다
- 상태, 토큰, subgraph, interrupt를 각자 읽기 쉬운 형태로 다루고 싶다
- 프론트엔드나 API 계층에서 run handle을 직접 들고 처리한다

기존 `stream()`이 더 직접적인 경우:

- `updates`, `custom`, `debug` 같은 low-level mode를 바로 받고 싶다
- 이미 `stream_mode` 기반 코드가 있고 migration 필요성이 낮다
- 프로젝션보다 raw runtime event 구조가 더 잘 맞는다

공식 문서도 "새 애플리케이션이면 event streaming, low-level access면 stream-mode API"라는 방향을 명확히 잡고 있다.

## 6. 흔한 실수

### 1. `version="v3"`를 빼먹는다

event streaming 글의 예제는 `version="v3"` 기준이다.  
이 값을 빼면 다른 스트리밍 버전 동작을 기대하게 되어 예제가 그대로 맞지 않을 수 있다.

### 2. projection과 raw event의 역할을 섞어 생각한다

`stream.messages`는 편하지만 `custom`이나 `updates`를 자동으로 모두 대신해 주지는 않는다.  
필요한 채널이 projection으로 없으면 raw event를 순회하거나 transformer를 붙이는 쪽으로 가야 한다.

### 3. interrupt에 checkpointer 없이 들어간다

interrupt 재개는 persistence 전제다.  
checkpointer 없이 interrupt 흐름을 만들면 문서에 있는 `MISSING_CHECKPOINTER` 계열 문제를 바로 만나기 쉽다.

### 4. 여러 projection의 도착 순서가 항상 같다고 가정한다

문서 기준으로 여러 projection은 동시에 소비할 수 있지만, text와 reasoning, tool-call chunk의 "정확한 도착 순서"가 중요하면 raw event 쪽이 더 적합하다.

### 5. `stream.output`과 `stream.values`를 용도 구분 없이 쓴다

`stream.values`는 중간 snapshot, `stream.output`은 최종 결과라는 역할 분리가 분명하다.  
중간 진행률 UI와 최종 응답 처리를 분리하면 코드가 훨씬 읽기 쉬워진다.

## 마무리

LangGraph event streaming v3의 장점은 "하나의 실행 스트림을 여러 관점으로 동시에 읽을 수 있다"는 점이다.

핵심만 요약하면 이렇다.

- 중간 상태는 `stream.values`
- 최종 결과는 `stream.output`
- 토큰은 `stream.messages`
- 승인 대기는 `stream.interrupts`, `stream.interrupted`
- low-level 채널은 raw protocol event 순회

`stream()`을 버리라는 뜻은 아니다. 다만 새 애플리케이션에서 상태, 토큰, interrupt, subgraph를 함께 다뤄야 한다면 `stream_events(..., version="v3")`부터 잡는 편이 구조가 훨씬 깔끔하다.

## References

- LangChain Docs, Event streaming: https://docs.langchain.com/oss/python/langgraph/event-streaming
- LangChain Docs, Streaming: https://docs.langchain.com/oss/python/langgraph/streaming
- LangChain Docs, Interrupts: https://docs.langchain.com/oss/python/langgraph/interrupts
- LangChain Docs, Changelog (`langgraph` v1.2.0): https://docs.langchain.com/oss/python/releases/changelog
