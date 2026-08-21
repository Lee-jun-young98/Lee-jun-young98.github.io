---
title: LangGraph multi-start edge로 병렬 fan-in barrier 만들기
description: add_edge에 여러 시작 노드를 전달해 병렬 작업을 모두 기다린 뒤 후속 노드를 한 번 실행하는 정적 fan-in 패턴
date: 2026-08-22
tags:
  - langgraph
  - workflow
  - python
  - composition
  - parallelism
aliases:
  - /blog/langgraph-multi-start-edge-fan-in-barrier
---

# LangGraph multi-start edge로 병렬 fan-in barrier 만들기

서로 독립적인 조회는 병렬로 실행하되, 보고서 생성은 모든 조회가 끝난 뒤 시작해야 할 때가 있습니다. LangGraph에서는 `add_edge()`의 시작 노드에 문자열 하나가 아니라 **노드 이름 목록**을 전달하면 명시적인 fan-in barrier를 만들 수 있습니다.

```python
builder.add_edge(["fetch_price", "fetch_stock"], "summarize")
```

이 edge는 두 시작 노드가 모두 완료된 뒤 `summarize`를 실행합니다. 완료 순서와 관계없이 필요한 결과가 같은 super-step의 state에 반영된 다음 후속 노드가 한 번 실행되므로, 코드 안에서 별도의 카운터나 대기 플래그를 관리할 필요가 없습니다.

## 사전 준비

Python 3.10 이상과 LangGraph를 설치합니다. 아래 예제는 LLM이나 API key 없이 실행할 수 있습니다.

```bash
pip install -U langgraph
```

## 실행 가능한 예제

가격과 재고를 병렬 조회한 다음 두 결과를 합쳐 주문 가능 여부를 만드는 예제입니다.

```python
import operator
import time
from typing import Annotated

from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


class OrderState(TypedDict, total=False):
    sku: str
    price: int
    stock: int
    completed: Annotated[list[str], operator.add]
    summary: str


def fetch_price(state: OrderState):
    time.sleep(0.15)
    return {"price": 12_000, "completed": ["price"]}


def fetch_stock(state: OrderState):
    time.sleep(0.05)
    return {"stock": 3, "completed": ["stock"]}


def summarize(state: OrderState):
    assert set(state["completed"]) == {"price", "stock"}
    return {
        "summary": f'{state["sku"]}: {state["price"]}원, 재고 {state["stock"]}개'
    }


builder = StateGraph(OrderState)
builder.add_node("fetch_price", fetch_price)
builder.add_node("fetch_stock", fetch_stock)
builder.add_node("summarize", summarize)

# 같은 super-step에서 두 조회를 시작한다.
builder.add_edge(START, "fetch_price")
builder.add_edge(START, "fetch_stock")

# 두 조회가 모두 끝나야 summarize가 실행된다.
builder.add_edge(["fetch_price", "fetch_stock"], "summarize")
builder.add_edge("summarize", END)

graph = builder.compile()
result = graph.invoke({"sku": "A-42", "completed": []})
print(result["summary"])
print(sorted(result["completed"]))
```

출력은 다음과 같습니다.

```text
A-42: 12000원, 재고 3개
['price', 'stock']
```

두 조회가 같은 super-step에서 `completed`를 동시에 갱신하므로 reducer가 필요합니다. 반면 `price`와 `stock`은 서로 다른 key를 쓰므로 각 key에 reducer를 붙일 필요가 없습니다.

## 별도 edge 두 개와 다른 점

다음 코드는 같은 의미가 아닙니다.

```python
# barrier가 아니다.
builder.add_edge("fetch_price", "summarize")
builder.add_edge("fetch_stock", "summarize")
```

각 edge는 자기 시작 노드가 끝났을 때 `summarize`를 활성화합니다. 즉, “두 노드가 모두 끝나면 한 번 실행”이라는 의도를 표현하지 못합니다. 필요한 선행 노드 집합을 하나의 목록으로 묶어야 AND 조건의 barrier가 됩니다.

```python
# 명시적인 AND join
builder.add_edge(["fetch_price", "fetch_stock"], "summarize")
```

그래프를 읽는 사람도 `summarize`가 두 결과에 모두 의존한다는 사실을 edge 정의만 보고 확인할 수 있습니다.

## 어떤 fan-in에 적합한가

multi-start edge는 그래프를 만들 때 선행 노드 집합을 이미 아는 **정적 fan-out/fan-in**에 적합합니다.

- 서로 독립적인 여러 API 조회 후 결과 조합
- 여러 검증 단계를 모두 통과한 뒤 승인 처리
- 병렬 전처리 결과를 모아 최종 문서 생성
- 고정된 여러 feature 계산 후 점수 산출

입력 데이터에 따라 작업 개수가 달라지는 map-reduce라면 `Send`와 reducer가 더 자연스럽습니다. 런타임 조건에 따라 일부 branch만 실행할 수 있다면, 항상 전체 고정 목록을 기다리는 barrier를 그대로 쓰지 말고 실제 라우팅 구조에 맞는 join을 설계해야 합니다.

## 실패와 재시도 경계

한 선행 노드가 실패하면 barrier의 조건이 충족되지 않으므로 후속 노드는 실행되지 않습니다. checkpointer와 retry policy를 사용하면 성공한 병렬 작업의 pending write를 보존하고 실패한 작업만 재시도할 수 있지만, 외부 부작용은 여전히 idempotent하게 설계해야 합니다.

후속 노드에는 모든 선행 결과가 존재한다고 가정할 수 있습니다. 다만 각 branch가 선택적으로 key를 생략할 수 있다면 TypedDict를 `total=False`로 선언한 것만 믿지 말고, join 노드에서 값의 존재와 업무 규칙을 명시적으로 검사하는 편이 안전합니다.

## 자주 놓치는 함정

- 시작 노드마다 후속 노드로 edge를 따로 연결하고 AND join이라고 생각합니다. 필요한 시작 노드 이름을 하나의 list로 전달해야 합니다.
- 병렬 노드들이 같은 state key를 갱신하면서 reducer를 선언하지 않습니다. 이 경우 `INVALID_CONCURRENT_GRAPH_UPDATE`가 발생할 수 있습니다.
- 완료 순서에 의존합니다. 병렬 branch의 실행 또는 reducer 적용 순서를 업무 순서로 간주하지 말고, 식별자나 정렬 key를 결과에 포함합니다.
- 조건부로 실행되지 않을 수 있는 노드를 고정 barrier 목록에 넣습니다. 모든 목록 원소가 완료되어야 하므로 라우팅 구조와 join 조건을 함께 설계해야 합니다.
- 동적 작업 수까지 고정 edge로 표현합니다. 런타임 fan-out에는 `Send`와 reducer를 사용합니다.
- join 노드에서 외부 쓰기를 수행하면서 재실행 가능성을 무시합니다. durable execution에서는 멱등성 key나 upsert를 사용합니다.

## 정리

`add_edge(["a", "b"], "join")`은 고정된 병렬 branch를 모두 기다리는 선언적 barrier입니다. 각 branch는 같은 super-step에서 독립적으로 실행하고, 공유 key에는 reducer를 붙이며, join 노드는 모든 필수 결과가 모인 뒤 한 번 실행되도록 구성할 수 있습니다. 정적 의존성에는 multi-start edge를, 작업 수가 런타임에 달라지는 경우에는 `Send`를 선택하면 fan-in 의도가 분명해집니다.

## 참고 자료

- [LangGraph Graph API 사용 가이드](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [StateGraph.add_edge API reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_edge)
- [INVALID_CONCURRENT_GRAPH_UPDATE 오류 가이드](https://docs.langchain.com/oss/python/langgraph/errors/INVALID_CONCURRENT_GRAPH_UPDATE)
