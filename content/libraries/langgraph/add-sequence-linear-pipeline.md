---
title: LangGraph add_sequence로 순차 파이프라인 간결하게 만들기
description: StateGraph.add_sequence로 노드 등록과 순차 edge를 묶고 START 연결, 이름 지정, 분기 결합 시 주의점을 다루는 방법
date: 2026-08-18
tags:
  - langgraph
  - workflow
  - python
  - composition
aliases:
  - /blog/langgraph-add-sequence-linear-pipeline
---

# LangGraph add_sequence로 순차 파이프라인 간결하게 만들기

전처리, 검증, 계산, 출력 정리처럼 항상 같은 순서로 실행되는 구간은 `add_node()`와 `add_edge()`를 반복하기보다 `StateGraph.add_sequence()`로 묶을 수 있습니다.

```python
builder.add_sequence([normalize, validate, calculate])
builder.add_edge(START, "normalize")
builder.add_edge("calculate", END)
```

`add_sequence()`는 전달한 노드를 등록하고 **서로 이웃한 노드 사이의 edge**를 순서대로 추가합니다. 다만 그래프의 가상 시작점 `START`에서 첫 노드로 들어가는 edge까지 만들지는 않습니다. 이 경계를 알아야 짧은 코드가 실행 구조를 숨기지 않습니다.

## 사전 준비

Python 3.10 이상과 LangGraph를 설치합니다. 아래 예제는 모델이나 API key 없이 실행할 수 있습니다.

```bash
pip install -U langgraph
```

## 실행 가능한 예제

문자열 금액을 정규화하고, 유효성을 검사한 뒤, 세금을 계산하는 세 단계 파이프라인입니다.

```python
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


class InvoiceState(TypedDict, total=False):
    raw_amount: str
    amount: int
    tax: int
    status: str


def normalize(state: InvoiceState):
    amount = int(state["raw_amount"].replace(",", "").strip())
    return {"amount": amount}


def validate(state: InvoiceState):
    if state["amount"] < 0:
        raise ValueError("amount must be non-negative")
    return {"status": "validated"}


def calculate_tax(state: InvoiceState):
    return {"tax": round(state["amount"] * 0.1), "status": "completed"}


builder = StateGraph(InvoiceState)
builder.add_sequence([normalize, validate, calculate_tax])
builder.add_edge(START, "normalize")
builder.add_edge("calculate_tax", END)
graph = builder.compile()

result = graph.invoke({"raw_amount": "12,000"})
print(result)
```

출력은 다음과 같습니다.

```text
{'raw_amount': '12,000', 'amount': 12000, 'tax': 1200, 'status': 'completed'}
```

함수만 전달하면 기본 노드 이름은 함수의 `__name__`에서 추론됩니다. 따라서 `normalize`, `validate`, `calculate_tax`가 edge에서 사용하는 실제 이름이 됩니다.

## 노드 이름을 명시하기

업무 단계 이름을 함수 이름과 분리하고 싶다면 `(이름, 함수)` 튜플을 전달합니다.

```python
builder = StateGraph(InvoiceState)
builder.add_sequence(
    [
        ("parse_amount", normalize),
        ("check_amount", validate),
        ("price_tax", calculate_tax),
    ]
)
builder.add_edge(START, "parse_amount")
builder.add_edge("price_tax", END)
```

명시적 이름은 lambda, `functools.partial`, 같은 callable을 여러 역할로 재사용할 때 특히 유용합니다. 한 그래프 안의 노드 이름은 고유해야 하므로 같은 함수를 두 번 넣어야 한다면 각각 다른 이름을 지정해야 합니다.

## 수동 edge와 무엇이 같은가

다음 두 구성은 핵심 실행 흐름이 같습니다.

```python
# 축약형
builder.add_sequence([normalize, validate, calculate_tax])

# 수동 구성
builder.add_node("normalize", normalize)
builder.add_node("validate", validate)
builder.add_node("calculate_tax", calculate_tax)
builder.add_edge("normalize", "validate")
builder.add_edge("validate", "calculate_tax")
```

`add_sequence()`는 별도의 런타임이나 새로운 실행 단위를 만드는 API가 아닙니다. 컴파일 결과에는 일반 노드와 일반 edge가 들어가므로 각 노드의 state update, retry, checkpoint, streaming 동작도 그대로 유지됩니다.

## 분기와 합칠 때는 선형 구간만 묶기

조건 분기 전체를 억지로 sequence로 표현할 필요는 없습니다. 공통 전처리 구간만 `add_sequence()`로 만들고, 마지막 노드에서 conditional edge를 시작하면 됩니다.

```python
builder.add_sequence([normalize, validate])
builder.add_edge(START, "normalize")
builder.add_conditional_edges(
    "validate",
    lambda state: "large_order" if state["amount"] >= 1_000_000 else "normal_order",
)
```

반대로 병렬 실행이 필요한 노드들을 sequence에 넣으면 의도와 달리 직렬화됩니다. 순서 의존성이 없는 I/O 작업은 각각 edge를 연결해 같은 super-step에서 실행하게 두는 편이 낫습니다.

## 자주 놓치는 함정

- `START` edge도 자동 생성된다고 생각합니다. 첫 노드로 진입하는 `builder.add_edge(START, "첫_노드")`를 별도로 추가해야 합니다.
- 빈 리스트를 전달합니다. 실행할 노드가 없는 sequence는 의미가 없고 오류가 발생하므로, 동적으로 목록을 만들 때 먼저 비어 있는지 확인합니다.
- 같은 이름의 함수를 두 번 넣습니다. 재사용할 때는 `(고유한_이름, callable)` 튜플을 사용합니다.
- 함수 이름을 바꾼 뒤 외부 edge 문자열을 갱신하지 않습니다. 안정적인 그래프 계약이 필요하면 노드 이름을 명시합니다.
- 분기나 병렬 구간까지 sequence에 넣습니다. 이 API는 선형 구간을 표현하는 축약형이며, conditional edge나 fan-out을 대신하지 않습니다.
- sequence 내부 노드 사이에 수동 edge를 중복 추가합니다. 실행상 이득은 없고 그래프 정의만 읽기 어려워집니다.

## 정리

`add_sequence()`는 선형 파이프라인의 노드 등록과 내부 edge 연결을 한 번에 표현하는 작은 구성 API입니다. 첫 진입과 마지막 종료 edge는 명시하고, 이름 안정성이 필요하면 튜플로 노드 이름을 지정해야 합니다. 분기와 병렬 처리는 기존 edge API에 맡기고 순차 구간만 묶으면 그래프 코드와 실제 실행 구조가 함께 읽기 쉬워집니다.

## 참고 자료

- [LangGraph Graph API 사용 가이드](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [StateGraph.add_sequence API reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_sequence)
- [StateGraph API reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph)
