---
title: LangGraph subgraph persistence mode 고르기
description: LangGraph에서 subgraph를 쓸 때 checkpointer=None, True, False 차이와 state inspection, namespace 충돌 함정을 정리한 실전 노트
date: 2026-06-21
tags:
  - langgraph
  - subgraph
  - workflow
  - python
aliases:
  - "/blog/langgraph-subgraph-persistence-modes-state-inspection"
---

# LangGraph subgraph persistence mode 고르기

LangGraph에서 subgraph를 붙일 때 처음에는 보통 "부모 graph 안에 작은 graph를 넣는다" 정도로만 이해하기 쉽다.  
그런데 실전에서는 subgraph를 **어떤 persistence mode로 컴파일하느냐**가 behavior를 크게 바꾼다.

- 호출마다 새로 시작하게 둘 것인가
- 같은 `thread_id`에서 이전 subgraph 상태를 이어받게 할 것인가
- 아예 checkpoint 없이 일반 함수처럼 돌릴 것인가

공식 문서 기준으로 이 선택은 `compile(checkpointer=...)` 값으로 결정된다.

- `None`: per-invocation, 호출마다 새 subgraph 상태로 시작
- `True`: per-thread, 같은 thread에서 subgraph 상태가 누적
- `False`: stateless, checkpoint 없이 실행

이번 글에서는 아래만 실전 기준으로 정리한다.

- 세 mode를 언제 고르면 되는지
- 같은 subgraph를 여러 번 부를 때 왜 `checkpointer=True`가 위험해질 수 있는지
- `get_state(..., subgraphs=True)`로 nested state를 어떻게 볼 수 있는지
- 현재 LangGraph API에서 직접 실행해 확인한 최소 예제

## 언제 어떤 mode를 쓰면 되나

공식 subgraphs 문서의 기준을 실무 판단으로 바꾸면 아래처럼 정리할 수 있다.

### 1. `checkpointer=None`

기본값이다.  
부모 graph의 checkpointer를 상속해서 **한 번의 호출 안에서는** interrupt와 durable execution을 쓸 수 있지만, subgraph 자체의 상태는 다음 호출까지 누적하지 않는다.

이 mode가 맞는 경우:

- subgraph를 재사용 가능한 작업 단위처럼 쓰고 싶다
- 같은 thread 안에서도 매 호출 fresh state가 더 자연스럽다
- 같은 subgraph를 한 run 안에서 여러 번 호출할 수 있다

### 2. `checkpointer=True`

같은 `thread_id`에서 subgraph 상태가 누적된다.  
즉 subgraph가 자기만의 멀티턴 메모리를 가지게 된다.

이 mode가 맞는 경우:

- subgraph가 이전 호출 문맥을 계속 기억해야 한다
- research assistant, coding assistant처럼 subgraph 자체가 누적 상태를 가져야 한다
- 부모 graph와는 별도로 "하위 workflow의 장기 흐름"이 필요하다

### 3. `checkpointer=False`

subgraph를 checkpoint 없이 plain function처럼 실행한다.  
interrupt, durable execution, subgraph state inspection을 기대하면 안 된다.

이 mode가 맞는 경우:

- subgraph가 정말 짧고 순수한 계산 블록에 가깝다
- persistence overhead를 피하고 싶다
- 중간 재개나 nested state 확인이 필요 없다

## 사전 준비

예제는 Python 3.10+에서 실행할 수 있다.

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

이번 예제는 외부 LLM 없이 `StateGraph`만 사용한다.

## 1. mode 차이를 바로 보는 최소 예제

아래 예제는 같은 parent graph가 같은 subgraph를 두 번 호출할 때,

- `None`: 매번 새 subgraph 상태로 시작해서 `history_size == 1`
- `True`: 같은 thread에서 subgraph 상태가 누적되어 두 번째 호출에 `history_size == 2`
- `False`: checkpoint가 없어서 역시 fresh call처럼 `history_size == 1`

가 되는 것을 보여 준다.

```python
from __future__ import annotations

import operator
from typing import Annotated
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import START, END, StateGraph


class ChildState(TypedDict):
    topic: str
    history: Annotated[list[str], operator.add]


class ParentState(TypedDict):
    topic: str
    history_size: int


def remember(state: ChildState):
    return {"history": [state["topic"]]}


def build_subgraph(mode: str):
    builder = StateGraph(ChildState)
    builder.add_node("remember", remember)
    builder.add_edge(START, "remember")
    builder.add_edge("remember", END)

    if mode == "per_thread":
        return builder.compile(checkpointer=True)
    if mode == "stateless":
        return builder.compile(checkpointer=False)
    return builder.compile()  # checkpointer=None


def run_demo(mode: str):
    subgraph = build_subgraph(mode)

    def call_child(state: ParentState):
        result = subgraph.invoke({"topic": state["topic"], "history": []})
        return {"history_size": len(result["history"])}

    parent = StateGraph(ParentState)
    parent.add_node("child", call_child)
    parent.add_edge(START, "child")
    parent.add_edge("child", END)
    graph = parent.compile(checkpointer=InMemorySaver())

    config = {"configurable": {"thread_id": mode}}
    first = graph.invoke({"topic": "apples", "history_size": 0}, config=config)
    second = graph.invoke({"topic": "bananas", "history_size": 0}, config=config)
    return first["history_size"], second["history_size"]


for mode in ["per_invocation", "per_thread", "stateless"]:
    print(mode, run_demo(mode))
```

실행 결과:

```text
per_invocation (1, 1)
per_thread (1, 2)
stateless (1, 1)
```

핵심은 `per_thread`만 두 번째 호출에서 누적 상태를 다시 읽는다는 점이다.

즉 다음처럼 이해하면 된다.

- subgraph를 재사용 가능한 "작업 함수"처럼 쓸 때: `None`
- subgraph 자체가 독립 메모리를 가져야 할 때: `True`
- checkpoint 기능이 전혀 필요 없을 때: `False`

## 2. `None`이 기본값인데도 interrupt가 되는 이유

여기서 많이 헷갈리는 지점이 있다.  
`checkpointer=None`은 fresh state인데, 왜 interrupt와 durable execution은 동작할까?

공식 문서 기준으로 per-invocation mode는 **부모 graph의 checkpointer를 상속**한다.  
그래서 한 번의 subgraph 호출 안에서는 pause/resume가 가능하지만, 다음 호출까지 상태를 들고 가지는 것은 아니다.

실전 해석은 이렇다.

- "이번 호출 안에서 끊겼다가 다시 이어야 한다": `None`으로도 충분할 수 있다
- "다음 호출에서도 이 subgraph가 이전 맥락을 기억해야 한다": `True`가 필요하다

## 3. subgraph state inspection은 언제 가능한가

공식 문서 기준 `get_state(config, subgraphs=True)`는 nested graph 상태를 볼 때 쓰는 진입점이다.  
다만 아무 때나 보이는 것은 아니고, checkpoint가 있어야 하고 LangGraph가 subgraph를 정적으로 추적할 수 있어야 한다.

아래 예제는 subgraph 안에서 `interrupt()`로 멈춘 뒤, 부모 graph에서 nested state를 확인하는 가장 작은 형태다.

```python
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import START, StateGraph
from langgraph.types import Command, interrupt


class State(TypedDict):
    foo: str


def subgraph_node(state: State):
    suffix = interrupt("Provide suffix")
    return {"foo": state["foo"] + suffix}


sub_builder = StateGraph(State)
sub_builder.add_node("subgraph_node", subgraph_node)
sub_builder.add_edge(START, "subgraph_node")
subgraph = sub_builder.compile()  # per-invocation

parent_builder = StateGraph(State)
parent_builder.add_node("child", subgraph)
parent_builder.add_edge(START, "child")
graph = parent_builder.compile(checkpointer=InMemorySaver())

config = {"configurable": {"thread_id": "inspect-demo"}}
graph.invoke({"foo": "A"}, config=config)

snapshot = graph.get_state(config, subgraphs=True)
subgraph_state = snapshot.tasks[0].state
print(subgraph_state.values)  # {'foo': 'A'}

resumed = graph.invoke(Command(resume="B"), config=config)
print(resumed)  # {'foo': 'AB'}
```

이 패턴에서 봐야 할 점은 두 가지다.

- top-level `get_state()`만 보지 말고 `subgraphs=True`를 켜야 nested state가 보인다
- `checkpointer=False`로 컴파일한 subgraph는 이런 inspection 대상이 되지 않는다

## 4. `checkpointer=True`에서 가장 흔한 함정

이 mode는 강력하지만, 실전에서는 제약도 분명하다.

### 4-1. 같은 subgraph를 병렬로 여러 번 호출하면 충돌할 수 있다

공식 문서 기준 per-thread subgraph는 같은 namespace에 체크포인트를 쓴다.  
그래서 같은 subgraph 인스턴스를 한 run 안에서 동시에 여러 번 부르면 충돌 위험이 있다.

대표적인 상황:

- LLM이 같은 subagent tool을 병렬로 두 번 호출한다
- 한 노드에서 동일한 per-thread subgraph를 fan-out처럼 재사용한다

이때는 아래 중 하나로 정리하는 편이 안전하다.

- 정말 누적 메모리가 필요 없다면 `checkpointer=None`으로 내린다
- 병렬 호출을 막는다
- 서로 다른 subgraph 인스턴스를 분리한다

### 4-2. 서로 다른 per-thread subgraph도 namespace를 안정적으로 나눠야 한다

공식 문서에는 한 node 안에서 여러 subgraph를 부를 때 호출 순서 기반 namespace가 생길 수 있다고 적혀 있다.  
순서를 바꾸면 어떤 상태를 누가 이어받는지 꼬일 수 있다.

그래서 실전에서는:

- subgraph를 `add_node("stable_name", subgraph)` 형태로 직접 붙이거나
- 고유한 node name을 가진 래퍼 graph를 만들어 namespace를 고정하는 편

이 더 안전하다.

## 5. mode 선택 기준을 실무 문장으로 바꾸면

아래 질문에 답하면 거의 바로 정해진다.

### 질문 1. 이 subgraph가 다음 호출에서도 이전 호출을 기억해야 하나

- 아니오: `None`
- 예: `True`

### 질문 2. interrupt, resume, nested state inspection이 필요한가

- 아니오: `False`도 가능
- 예: `None` 또는 `True`

### 질문 3. 같은 run 안에서 같은 subgraph를 여러 번 호출할 수 있나

- 예: 기본값 `None`이 대체로 더 안전
- 아니오, 그리고 누적 메모리가 꼭 필요함: `True`

## 자주 하는 실수

### 1. `checkpointer=True`가 항상 더 좋은 상위 옵션이라고 생각한다

아니다.  
상태 누적이 필요한 subgraph에만 써야 한다. 재사용형 작업 블록에는 오히려 과하다.

### 2. `checkpointer=None`이면 interrupt도 안 될 거라고 생각한다

부모 graph가 checkpointer를 가지고 있으면, per-invocation subgraph도 한 호출 안에서는 interrupt/resume이 된다.

### 3. 같은 per-thread subgraph를 병렬 fan-out에 그대로 쓴다

checkpoint namespace 충돌을 만들기 쉽다.

### 4. `checkpointer=False`인데 `get_state(..., subgraphs=True)`까지 기대한다

stateless subgraph는 checkpoint를 남기지 않으므로 inspection도 기대하면 안 된다.

### 5. subgraph를 tool 함수 뒤에 숨겨 놓고 nested state가 안 보인다고 당황한다

공식 문서 기준 정적 추적이 가능한 형태여야 subgraph state inspection이 잘 동작한다.

## 실전 체크리스트

1. 특별한 이유가 없으면 subgraph 기본값은 `checkpointer=None`부터 시작한다
2. subgraph가 자기만의 멀티턴 메모리를 가져야 할 때만 `checkpointer=True`로 올린다
3. 같은 per-thread subgraph의 병렬 재호출 가능성을 먼저 점검한다
4. nested debug가 필요하면 `get_state(config, subgraphs=True)` 또는 event stream을 준비한다
5. 짧은 순수 계산 블록이면 `checkpointer=False`로 단순화할 수 있는지 본다

## 마무리

LangGraph subgraph에서 `checkpointer`는 단순 성능 옵션이 아니라,  
**그 subgraph가 상태를 어떤 수명으로 가질지 결정하는 설계 선택**에 가깝다.

실전에서는 아래 기준만 명확해도 대부분 덜 꼬인다.

- 호출마다 fresh 하게 써도 되나: `None`
- 같은 thread에서 하위 workflow 기억이 필요하나: `True`
- persistence 자체가 필요 없나: `False`

subgraph를 많이 쓸수록 graph 구조 자체보다 이 수명 모델을 먼저 정하는 편이 운영 사고를 줄여 준다.

## 참고 자료

- [LangGraph Subgraphs](https://docs.langchain.com/oss/python/langgraph/use-subgraphs)
- [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
