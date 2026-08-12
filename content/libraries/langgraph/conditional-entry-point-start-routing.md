---
title: LangGraph conditional entry point로 시작 노드 바로 고르기
description: START에서 add_conditional_edges로 입력별 첫 노드를 선택하고 병렬 진입, 타입 힌트, 정적 edge 혼용 함정을 다루는 방법
date: 2026-08-12
tags:
  - langgraph
  - workflow
  - python
  - routing
aliases:
  - /blog/langgraph-conditional-entry-point-start-routing
---

# LangGraph conditional entry point로 시작 노드 바로 고르기

요청 종류에 따라 첫 작업부터 다르다면 모든 입력을 공통 `router` 노드에 통과시킬 필요가 없습니다. LangGraph의 가상 시작 노드인 `START`에 conditional edge를 연결하면, 입력 state를 읽어 실제 첫 노드를 바로 선택할 수 있습니다.

```python
builder.add_conditional_edges(START, route_entry)
```

이 패턴은 읽기 전용 요청과 쓰기 요청, 무료 사용자와 유료 사용자, 문서 처리와 이미지 처리처럼 **입력 시점에 이미 경로를 결정할 수 있을 때** 유용합니다. 반대로 라우팅 전에 state를 계산하거나 기록해야 한다면 실제 router 노드를 두는 편이 맞습니다.

## 사전 준비

Python 3.10 이상과 LangGraph를 설치합니다. 아래 예제는 모델이나 API key 없이 실행할 수 있습니다.

```bash
pip install -U langgraph
```

## 실행 가능한 예제

`kind` 값에 따라 주문 조회 또는 주문 생성 노드로 바로 진입합니다.

```python
from typing import Literal
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


class RequestState(TypedDict, total=False):
    kind: Literal["read", "write"]
    order_id: str
    result: str


def route_entry(state: RequestState) -> Literal["read_order", "create_order"]:
    if state["kind"] == "read":
        return "read_order"
    return "create_order"


def read_order(state: RequestState):
    return {"result": f"found:{state['order_id']}"}


def create_order(state: RequestState):
    return {"result": f"created:{state['order_id']}"}


builder = StateGraph(RequestState)
builder.add_node("read_order", read_order)
builder.add_node("create_order", create_order)
builder.add_conditional_edges(START, route_entry)
builder.add_edge("read_order", END)
builder.add_edge("create_order", END)
graph = builder.compile()

print(graph.invoke({"kind": "read", "order_id": "A-17"})["result"])
print(graph.invoke({"kind": "write", "order_id": "B-42"})["result"])
```

출력은 다음과 같습니다.

```text
found:A-17
created:B-42
```

conditional entry point는 별도 state update를 만들지 않습니다. 라우팅 함수는 현재 입력 state를 읽고 다음 목적지만 반환합니다. 입력 정규화, 권한 조회, 분류 결과 저장처럼 state를 먼저 바꿔야 한다면 실제 노드에서 `Command(update=..., goto=...)`를 반환하거나, 전처리 노드 뒤에 conditional edge를 두어야 합니다.

## 라우팅 값과 노드 이름을 분리하기

업무 용어를 그대로 반환하고 실제 노드 이름은 `path_map`으로 연결할 수도 있습니다.

```python
def route_role(state: RequestState) -> Literal["reader", "writer"]:
    return "reader" if state["kind"] == "read" else "writer"


builder.add_conditional_edges(
    START,
    route_role,
    {"reader": "read_order", "writer": "create_order"},
)
```

`Literal` 반환 타입이나 `path_map`을 명시하면 컴파일된 그래프의 Mermaid 시각화도 가능한 목적지만 표시합니다. 둘 다 없으면 실행은 되더라도 시각화기가 라우팅 함수가 모든 노드로 갈 수 있다고 추정해 불필요한 edge를 그릴 수 있습니다.

## 여러 시작 노드를 병렬로 실행하기

라우팅 함수는 노드 이름 하나뿐 아니라 여러 목적지를 반환할 수 있습니다. 반환된 노드들은 다음 super-step에서 병렬로 실행됩니다.

```python
from typing import Sequence


def route_checks(state: RequestState) -> Sequence[str]:
    if state["kind"] == "write":
        return ["validate_policy", "check_inventory"]
    return ["read_order"]
```

이때 병렬 노드들이 같은 state key에 동시에 값을 쓰면 충돌할 수 있습니다. 각 노드가 서로 다른 key를 쓰게 하거나, 해당 channel에 reducer를 선언해야 합니다. 단순히 리스트를 반환했다고 순차 실행되는 것은 아닙니다.

## 언제 실제 router 노드가 필요한가

conditional entry point는 **결정만** 할 때 가장 깔끔합니다.

- 원본 입력만 보고 첫 노드를 고른다: `add_conditional_edges(START, ...)`
- 정규화나 분류 결과를 state에 남긴 뒤 고른다: router 노드 + conditional edge
- state update와 목적지 선택을 한 함수에서 처리한다: 노드에서 `Command(update=..., goto=...)` 반환
- 모든 요청이 반드시 공통 검증을 거쳐야 한다: `START -> validate` 정적 edge

라우팅 함수에서 외부 API 호출이나 DB 쓰기 같은 부작용을 수행하면 replay와 재시도 시 동작을 추론하기 어려워집니다. 가능하면 라우팅은 순수 함수로 유지하고, 부작용은 이름이 있는 노드에 배치합니다.

## 자주 놓치는 함정

- `START`에 정적 edge와 conditional edge를 함께 추가합니다. 두 경로가 모두 활성화되어 의도하지 않은 노드들이 같은 super-step에서 실행될 수 있습니다.
- 라우팅 함수가 등록되지 않은 노드 이름을 반환합니다. 가능한 목적지를 `Literal`로 제한하거나 `path_map`을 사용해 오타를 줄입니다.
- 여러 목적지 반환을 순차 fallback으로 오해합니다. 리스트 반환은 병렬 fan-out이며, fallback은 명시적인 후속 조건 분기로 설계해야 합니다.
- 라우팅 중 state를 수정하려고 합니다. conditional edge의 반환값은 state update가 아니라 목적지입니다.
- 입력 검증 없이 `state["kind"]`를 읽습니다. 외부 입력이라면 Pydantic state 또는 진입 전 API schema validation으로 잘못된 값을 차단합니다.

## 정리

입력만으로 첫 작업을 결정할 수 있다면 `START`에 conditional edge를 연결해 불필요한 router 노드를 없앨 수 있습니다. `Literal` 또는 `path_map`으로 목적지를 명시하고, 여러 목적지 반환은 병렬 실행이라는 점을 기억해야 합니다. 공통 검증이나 state update가 필요한 순간에는 실제 노드로 책임을 옮기면 그래프의 실행 경계가 더 분명해집니다.

## 참고 자료

- [LangGraph Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph use the Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [StateGraph.add_conditional_edges reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_conditional_edges)
