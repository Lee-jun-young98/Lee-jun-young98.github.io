---
title: "LangGraph subgraph를 node로 직접 붙일지, node 안에서 invoke할지 고르기"
description: "LangGraph에서 subgraph를 add_node로 직접 연결하는 방식과 wrapper node 안에서 invoke하는 방식을 상태 스키마, interrupt 재개, checkpointer 관점에서 비교한 실전 노트"
date: 2026-07-04
tags:
  - langgraph
  - subgraph
  - multi-agent
  - python
aliases:
  - "/blog/langgraph-subgraph-node-vs-invoke"
---

# LangGraph subgraph를 node로 직접 붙일지, node 안에서 invoke할지 고르기

LangGraph에서 그래프가 조금만 커져도 "이 흐름은 하위 그래프로 분리해야겠다"는 순간이 바로 온다.

하지만 subgraph를 나누는 방법은 생각보다 두 가지가 다르다.

1. 컴파일된 subgraph를 부모 그래프의 `add_node(...)`에 직접 붙이는 방식
2. 부모 node 함수 안에서 `subgraph.invoke(...)`를 호출하는 방식

둘 다 동작은 하지만, 어떤 상태를 공유할지, `interrupt()`가 걸렸을 때 어디부터 다시 실행될지, 디버깅과 운영이 얼마나 쉬운지가 꽤 달라진다.

공식 LangGraph 문서 기준으로 고르는 기준은 단순하다.

- 부모와 subgraph가 같은 state key를 공유하면: subgraph를 node로 직접 붙이는 쪽이 자연스럽다
- 부모와 subgraph의 state schema가 다르거나, 중간 변환이 필요하면: 부모 node 안에서 `invoke()`하는 쪽이 맞다

## 언제 이 구분이 중요해지나

아래 같은 상황에서 바로 차이가 난다.

- supervisor graph 아래에 역할별 subgraph를 붙이고 싶다
- agent마다 private message history를 따로 들고 가고 싶다
- 부모 state는 간단하게 유지하고, 하위 워크플로만 복잡한 전용 state를 쓰고 싶다
- subgraph 안에서 `interrupt()`나 checkpoint inspection까지 써야 한다

## 패턴 1: state key를 공유하면 subgraph를 node로 직접 붙인다

부모와 subgraph가 같은 상태 채널을 읽고 쓰는 구조라면 이 방식이 가장 간단하다.

```python
from typing import TypedDict

from langgraph.graph import START, END, StateGraph


class State(TypedDict):
    topic: str
    draft: str


def write_intro(state: State):
    return {"draft": f"주제: {state['topic']}\n\n초안 시작"}


def write_body(state: State):
    return {"draft": state["draft"] + "\n- 핵심 내용 추가"}


subgraph_builder = StateGraph(State)
subgraph_builder.add_node("write_intro", write_intro)
subgraph_builder.add_node("write_body", write_body)
subgraph_builder.add_edge(START, "write_intro")
subgraph_builder.add_edge("write_intro", "write_body")
subgraph_builder.add_edge("write_body", END)
writer_subgraph = subgraph_builder.compile()


parent_builder = StateGraph(State)
parent_builder.add_node("writer", writer_subgraph)
parent_builder.add_edge(START, "writer")
parent_builder.add_edge("writer", END)
graph = parent_builder.compile()


result = graph.invoke({"topic": "LangGraph subgraph"})
print(result["draft"])
```

이 패턴의 장점은 명확하다.

- wrapper node 없이 바로 연결된다
- 부모와 subgraph가 같은 key를 공유하므로 데이터 이동 코드가 거의 없다
- 나중에 `subgraphs=True`로 상태나 스트림을 볼 때 구조가 더 직관적이다

## 패턴 2: state schema가 다르면 부모 node 안에서 `invoke()`한다

부모와 subgraph가 다른 state를 써야 한다면 wrapper node를 두는 편이 맞다.

예를 들어 부모는 `task`만 알고, subgraph는 내부적으로 `question`, `answer`, `scratchpad`를 따로 관리하고 싶을 수 있다.

```python
from typing import TypedDict

from langgraph.graph import START, END, StateGraph


class ResearchSubgraphState(TypedDict):
    question: str
    answer: str
    scratchpad: str


def collect_notes(state: ResearchSubgraphState):
    return {
        "scratchpad": f"조사 메모: {state['question']}",
    }


def draft_answer(state: ResearchSubgraphState):
    return {
        "answer": f"{state['question']}에 대한 답변\n{state['scratchpad']}",
    }


research_builder = StateGraph(ResearchSubgraphState)
research_builder.add_node("collect_notes", collect_notes)
research_builder.add_node("draft_answer", draft_answer)
research_builder.add_edge(START, "collect_notes")
research_builder.add_edge("collect_notes", "draft_answer")
research_builder.add_edge("draft_answer", END)
research_subgraph = research_builder.compile()


class ParentState(TypedDict):
    task: str
    final_report: str


def run_research(state: ParentState):
    subgraph_result = research_subgraph.invoke(
        {
            "question": state["task"],
            "answer": "",
            "scratchpad": "",
        }
    )
    return {"final_report": subgraph_result["answer"]}


parent_builder = StateGraph(ParentState)
parent_builder.add_node("run_research", run_research)
parent_builder.add_edge(START, "run_research")
parent_builder.add_edge("run_research", END)
graph = parent_builder.compile()


result = graph.invoke({"task": "LangGraph subgraph 선택 기준 정리"})
print(result["final_report"])
```

이 방식은 조금 더 장황하지만, 아래 상황에서는 오히려 안전하다.

- subgraph 내부 key를 부모에 노출하고 싶지 않을 때
- 부모와 subgraph 사이에 입력/출력 변환이 필요할 때
- subagent마다 완전히 다른 상태 구조를 가져가고 싶을 때

## 실무 기준으로 어떻게 고르면 좋은가

빠르게 판단하려면 아래 기준이면 충분하다.

### subgraph를 node로 직접 붙여도 되는 경우

- 부모와 subgraph가 같은 state key를 공유한다
- wrapper 변환 로직이 거의 필요 없다
- 부모 입장에서 subgraph가 하나의 확장된 워크플로처럼 보이면 된다

### node 안에서 `invoke()`해야 하는 경우

- 부모와 subgraph의 state schema가 다르다
- subgraph 내부 상태를 private하게 숨기고 싶다
- 입력/출력 매핑, 전처리, 후처리를 같이 넣어야 한다

## `interrupt()`가 섞이면 특히 조심할 점

공식 interrupts 문서에서 매우 중요한 차이를 하나 짚는다.

subgraph를 부모 node 안에서 `invoke()`했고, 그 subgraph 내부에서 `interrupt()`가 발생하면:

- 부모 그래프는 subgraph를 호출한 부모 node의 처음부터 다시 실행될 수 있고
- subgraph도 `interrupt()`가 있던 subgraph node의 처음부터 다시 실행될 수 있다

즉, wrapper node 안에 아래처럼 재실행되면 곤란한 작업을 섞어두면 안 된다.

```python
def run_subgraph(state: ParentState):
    # 이 코드도 resume 시 다시 실행될 수 있다
    expensive_lookup = load_external_context()
    result = child_graph.invoke(...)
    return {"final_report": result["answer"]}
```

이 구조라면:

- 외부 호출은 idempotent하게 만들거나
- 아예 별도 node로 분리하거나
- shared state가 가능하면 subgraph를 직접 node로 붙이는 편이 낫다

## checkpointer는 보통 부모에만 붙이면 된다

공식 memory 문서 기준으로 subgraph가 있을 때는 일반적으로 부모 graph를 compile할 때만 checkpointer를 주면 된다.  
child subgraph는 그 checkpointer를 상속받는다.

```python
from langgraph.checkpoint.memory import InMemorySaver

graph = parent_builder.compile(checkpointer=InMemorySaver())
```

다만 운영 관점에서 더 세밀한 subgraph checkpoint 이력이나 subgraph 내부 time travel이 필요하면, 관련 문서처럼 subgraph 쪽 persistence 전략을 따로 가져갈 이유가 생긴다.

## 스트리밍과 상태 확인도 생각보다 중요하다

subgraph를 쓰기 시작하면 지금 어느 하위 그래프에서 무슨 일이 일어났는지가 바로 중요해진다.

공식 streaming 문서 기준으로 부모 graph에서 `subgraphs=True`를 켜면 subgraph 출력까지 같이 스트리밍할 수 있다.

```python
for chunk in graph.stream(
    {"topic": "LangGraph"},
    stream_mode="updates",
    subgraphs=True,
):
    print(chunk)
```

nested 상태를 점검할 때도 subgraph 관련 옵션을 켜서 보는 흐름을 먼저 준비해 두는 편이 좋다.  
subgraph를 많이 쓰는데 부모 graph top-level 상태만 보면 디버깅 정보가 크게 부족해진다.

## 흔히 막히는 지점

### 1. state가 다르면서도 subgraph를 직접 node로 붙이려 한다

공유 key가 거의 없는데 direct node 방식으로 밀어붙이면 state contract가 금방 꼬인다.  
이 경우는 wrapper node를 두고 명시적으로 변환하는 편이 맞다.

### 2. private state가 필요한데 부모 state에 전부 섞어 넣는다

초기에는 편하지만, 나중에 부모 state가 금방 비대해진다.  
특히 multi-agent 구조에서는 agent별 scratchpad, intermediate output, reviewer note를 전부 부모에 올리지 않는 편이 낫다.

### 3. `interrupt()`가 있는 subgraph를 함수처럼 부르면서 부모 node 재실행을 잊는다

이건 실제 운영에서 가장 자주 문제를 만든다.  
wrapper node 안의 전처리 코드가 재실행될 수 있다는 점을 기준으로 설계해야 한다.

### 4. subgraph를 썼는데 스트림이나 상태 확인을 부모 기준으로만 본다

하위 그래프를 쪼갠 이유가 관찰성과 구조화인데, 디버깅에서 subgraph 정보를 안 보면 오히려 원인 추적이 더 어려워진다.

## 추천 설계 패턴

내 기준에서는 아래처럼 정리하면 대부분 무난하다.

1. shared state workflow면 subgraph를 직접 node로 붙인다
2. private state workflow면 wrapper node 안에서 `invoke()`한다
3. `interrupt()`가 있는 subgraph를 함수처럼 부를 때는 wrapper node를 아주 얇게 유지한다
4. checkpointer는 부모에 먼저 붙이고, 정말 필요할 때만 subgraph persistence를 더 세분화한다
5. 스트림과 상태 조회는 처음부터 subgraph 관찰 기준으로 준비한다

## 정리

LangGraph subgraph에서 가장 중요한 판단 기준은 코드를 어떻게 나눌까보다 상태를 어디까지 공유할까에 가깝다.

- 같은 state를 함께 쓰면 `add_node(subgraph)`가 단순하고
- 다른 state를 써야 하면 wrapper node + `subgraph.invoke()`가 안전하다

그리고 `interrupt()`와 재개, checkpointer 상속, subgraph 스트리밍까지 엮이기 시작하면 이 차이가 구조 전체에 영향을 준다.  
처음 설계할 때부터 state 경계와 resume 경계를 같이 보는 것이 좋다.

## 참고 자료

- [Subgraphs](https://docs.langchain.com/oss/python/langgraph/use-subgraphs)
- [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [Memory](https://docs.langchain.com/oss/python/langgraph/add-memory)
- [Streaming](https://docs.langchain.com/oss/python/langgraph/streaming)
- [Use the graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
