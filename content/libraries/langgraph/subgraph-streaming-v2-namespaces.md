---
title: LangGraph subgraph 스트림을 v2 namespace로 라우팅하기
description: subgraphs=True와 StreamPart의 ns 필드로 루트·중첩 그래프 업데이트를 한 스트림에서 구분하는 방법
date: 2026-08-03
tags:
  - langgraph
  - workflow
  - python
  - streaming
  - subgraph
aliases:
  - /blog/langgraph-subgraph-streaming-v2-namespaces
---

# LangGraph subgraph 스트림을 v2 namespace로 라우팅하기

부모 그래프만 `stream()`하면 기본적으로 부모가 내보내는 결과만 보입니다. subgraph 안의 어느 노드가 진행 중인지 UI에 표시하거나 중첩 실행 로그를 분리하려면 `subgraphs=True`를 켜고 각 이벤트의 namespace를 읽어야 합니다.

LangGraph 1.1 이상에서는 `version="v2"`를 함께 쓰는 편이 단순합니다. 루트와 subgraph 이벤트가 모두 `{"type", "ns", "data"}` 형태의 `StreamPart`로 나오므로, 옵션 조합에 따라 tuple 모양이 달라지는 v1보다 소비 코드를 안정적으로 유지할 수 있습니다.

## 사전 준비

Python 3.10 이상과 LangGraph 1.1 이상이 필요합니다.

```bash
pip install -U "langgraph>=1.1"
```

아래 예제는 모델이나 API 키가 필요하지 않습니다.

## 실행 가능한 최소 예제

부모와 자식 그래프가 `order_id`를 공유하고, 자식이 검증과 포장을 순서대로 처리한다고 가정합니다.

```python
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


class OrderState(TypedDict, total=False):
    order_id: str
    validated: bool
    package_label: str


def validate_order(state: OrderState):
    return {"validated": state["order_id"].startswith("ORD-")}


def make_label(state: OrderState):
    if not state["validated"]:
        raise ValueError("invalid order")
    return {"package_label": f"PKG:{state['order_id']}"}


packing_builder = StateGraph(OrderState)
packing_builder.add_node("validate_order", validate_order)
packing_builder.add_node("make_label", make_label)
packing_builder.add_edge(START, "validate_order")
packing_builder.add_edge("validate_order", "make_label")
packing_builder.add_edge("make_label", END)
packing_graph = packing_builder.compile()


def receive_order(state: OrderState):
    return {"order_id": state["order_id"].strip().upper()}


parent_builder = StateGraph(OrderState)
parent_builder.add_node("receive_order", receive_order)
parent_builder.add_node("packing", packing_graph)
parent_builder.add_edge(START, "receive_order")
parent_builder.add_edge("receive_order", "packing")
parent_builder.add_edge("packing", END)
graph = parent_builder.compile()


for part in graph.stream(
    {"order_id": " ord-42 "},
    stream_mode="updates",
    subgraphs=True,
    version="v2",
):
    scope = "root" if not part["ns"] else part["ns"][-1].split(":", 1)[0]
    print(scope, part["type"], part["data"])
```

출력의 runtime ID는 실행마다 달라지지만 구조는 다음과 같습니다.

```text
root updates {'receive_order': {'order_id': 'ORD-42'}}
packing updates {'validate_order': {'validated': True}}
packing updates {'make_label': {'package_label': 'PKG:ORD-42'}}
root updates {'packing': {'order_id': 'ORD-42', 'validated': True, 'package_label': 'PKG:ORD-42'}}
```

자식 노드의 세부 업데이트 뒤에 부모의 `packing` 노드 결과가 다시 나오는 것은 중복 실행이 아닙니다. 앞의 두 이벤트는 subgraph 내부 진행이고 마지막 이벤트는 subgraph 전체 출력이 부모 state에 반영된 결과입니다.

## `ns`를 읽는 기준

`part["ns"]`는 이벤트가 발생한 그래프까지의 경로를 tuple로 담습니다.

- `()`이면 루트 그래프 이벤트입니다.
- `("packing:<runtime_id>",)`이면 `packing` subgraph에서 나온 이벤트입니다.
- 더 깊게 중첩하면 `("packing:<id>", "carrier:<id>")`처럼 경로가 늘어납니다.

콜론 앞의 이름은 그래프 구성에서 정한 안정적인 node 이름이고, 뒤의 ID는 해당 invocation을 구분하는 값입니다. UI 섹션이나 metric label은 이름으로 묶고, 동시에 실행된 호출을 서로 구분할 때는 전체 namespace를 키로 쓰는 편이 안전합니다.

```python
def namespace_names(ns: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(segment.split(":", 1)[0] for segment in ns)


def route(part):
    path = namespace_names(part["ns"])
    if not path:
        return "workflow"
    if path[0] == "packing":
        return "packing-panel"
    return "other-subgraphs"
```

runtime ID까지 버리고 이름만 cache key로 사용하면 같은 subgraph가 병렬 실행될 때 이벤트가 섞일 수 있습니다. 화면 그룹 이름과 실행 인스턴스 키를 분리해야 합니다.

## 여러 stream mode도 같은 envelope로 다루기

v2에서는 여러 모드를 요청해도 `type`으로 분기할 수 있습니다.

```python
for part in graph.stream(
    {"order_id": "ORD-42"},
    stream_mode=["updates", "values"],
    subgraphs=True,
    version="v2",
):
    if part["type"] == "updates":
        handle_delta(part["ns"], part["data"])
    elif part["type"] == "values":
        replace_snapshot(part["ns"], part["data"])
```

`updates`는 node별 delta를 진행 표시나 audit log에 쓰기 좋고, `values`는 각 단계의 전체 state snapshot을 화면 상태 동기화에 쓰기 좋습니다. 큰 state에서는 모든 `values` 이벤트를 저장하기보다 `updates`를 기본으로 두고 필요한 시점에만 snapshot을 쓰는 편이 효율적입니다.

## 흔한 실수

- `subgraphs=True`를 빼고 자식 이벤트가 안 보인다고 판단한다. 기본값은 `False`입니다.
- v1 출력 예제와 v2 소비 코드를 섞는다. v1은 옵션에 따라 `(namespace, data)` 같은 tuple을 반환하지만 v2는 `StreamPart` dict를 반환합니다.
- `ns[-1]` 전체를 고정 node 이름으로 비교한다. 뒤에는 실행마다 달라지는 runtime ID가 붙습니다.
- runtime ID를 전부 버린다. 같은 subgraph의 병렬 호출을 별도 실행으로 추적할 수 없게 됩니다.
- 자식의 마지막 update와 부모 subgraph node update를 같은 의미의 중복 이벤트로 제거한다. 두 이벤트의 scope와 데이터 계약이 다릅니다.
- `stream_mode="values"`를 무조건 로그에 영구 저장한다. state에 메시지나 문서가 누적되면 로그 크기와 민감정보 노출 범위가 빠르게 커집니다.
- 운영 코드에서 아직 preview인 `stream_events(version="v3")`와 안정적인 `stream(..., version="v2")` 계약을 같은 API로 취급한다. typed projection이 꼭 필요하지 않다면 현재는 v2부터 적용하는 편이 보수적입니다.

## 정리

중첩 LangGraph 실행을 하나의 스트림으로 관찰하려면 부모의 `stream()`에 `subgraphs=True`와 `version="v2"`를 지정합니다. 소비자는 `type`으로 payload 종류를, `ns`로 루트와 subgraph scope를 구분하면 됩니다. 표시용 경로에는 namespace의 이름 부분을 쓰고 병렬 실행 식별에는 runtime ID가 포함된 전체 경로를 유지하는 것이 핵심입니다.

## 참고 자료

- [LangGraph Streaming](https://docs.langchain.com/oss/python/langgraph/streaming)
- [LangGraph Subgraphs](https://docs.langchain.com/oss/python/langgraph/use-subgraphs)
- [LangGraph stream API reference](https://reference.langchain.com/python/langgraph/pregel/remote/RemoteGraph/stream)
