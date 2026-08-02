---
title: LangGraph pending writes로 병렬 실패를 이어서 복구하기
description: 같은 super-step의 일부 node가 실패해도 성공한 node의 write를 보존하고 재개 시 중복 실행을 피하는 방법
date: 2026-08-02
tags:
  - langgraph
  - workflow
  - python
  - reliability
  - persistence
aliases:
  - /blog/langgraph-pending-writes-parallel-failure-resume
---

# LangGraph pending writes로 병렬 실패를 이어서 복구하기

병렬로 실행한 두 node 중 하나만 실패하면 성공한 node까지 다시 실행해야 할까요? LangGraph는 checkpointer가 있을 때 성공한 node의 출력을 **pending writes**로 먼저 저장합니다. 같은 thread를 재개하면 이미 완료된 task는 건너뛰고 실패한 task만 다시 실행합니다.

이 동작은 결제 준비, 검색, 문서 변환처럼 한 super-step에 여러 작업을 fan-out하는 workflow의 복구 비용과 중복 호출을 줄여 줍니다.

## 사전 준비

Python 3.10 이상과 LangGraph가 필요합니다.

```bash
pip install -U langgraph
```

아래 예제는 동작 확인을 위해 `InMemorySaver`를 사용합니다. 프로세스 재시작까지 견뎌야 하는 운영 환경에서는 SQLite 또는 Postgres checkpointer를 사용해야 합니다.

## 실행 가능한 최소 예제

`reserve`와 `quote`는 같은 super-step에서 병렬 실행됩니다. `quote`만 첫 호출에 실패하도록 만들고, 호출 횟수로 어떤 node가 다시 실행되는지 확인합니다.

```python
import operator
from typing import Annotated

from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


calls = {"reserve": 0, "quote": 0}
fail_once = True


class State(TypedDict, total=False):
    order_id: str
    events: Annotated[list[str], operator.add]


def reserve(state: State):
    calls["reserve"] += 1
    return {"events": [f"reserved:{state['order_id']}"]}


def quote(state: State):
    global fail_once
    calls["quote"] += 1
    if fail_once:
        fail_once = False
        raise RuntimeError("temporary quote failure")
    return {"events": ["quoted"]}


builder = StateGraph(State)
builder.add_node("reserve", reserve)
builder.add_node("quote", quote)
builder.add_edge(START, "reserve")
builder.add_edge(START, "quote")
builder.add_edge("reserve", END)
builder.add_edge("quote", END)

graph = builder.compile(checkpointer=InMemorySaver())
config = {"configurable": {"thread_id": "order-42"}}

try:
    graph.invoke({"order_id": "A-42", "events": []}, config)
except RuntimeError:
    snapshot = graph.get_state(config)
    print(snapshot.values)
    print(snapshot.next)
    print(calls)

result = graph.invoke(None, config)
print(result)
print(calls)
```

첫 실패 직후 핵심 출력은 다음과 같습니다.

```text
{'order_id': 'A-42', 'events': ['reserved:A-42']}
('quote',)
{'reserve': 1, 'quote': 1}
```

`reserve`의 write는 성공한 super-step 전체가 끝나지 않았는데도 조회됩니다. `graph.invoke(None, config)`로 같은 thread를 재개한 뒤 호출 횟수는 `{'reserve': 1, 'quote': 2}`가 됩니다. 성공한 `reserve`는 건너뛰고 실패한 `quote`만 다시 실행된 것입니다.

## checkpoint와 pending write의 차이

checkpoint는 super-step 경계의 전체 state snapshot입니다. 반면 pending write는 진행 중인 super-step에서 개별 task가 성공할 때 저장한 출력입니다.

1. 병렬 node들이 같은 checkpoint에서 시작합니다.
2. 성공한 node의 출력은 task 단위 write로 저장됩니다.
3. 다른 node가 실패하면 super-step은 완료되지 않지만 성공한 write는 남습니다.
4. 같은 `thread_id`를 `None` 입력으로 재개하면 저장된 write를 재사용하고 미완료 task만 실행합니다.

직접 checkpointer의 `put_writes()`를 호출할 필요는 없습니다. 그래프 실행기가 처리하며, custom checkpointer를 구현할 때만 동기 `put_writes()`와 비동기 `aput_writes()` 계약을 지켜야 합니다.

## side effect는 여전히 멱등하게 만들기

Pending writes는 **성공 결과가 checkpointer에 기록된 뒤의 재개**에서 중복 실행을 막습니다. 외부 API 호출은 성공했지만 결과를 기록하기 전에 프로세스가 죽으면 해당 node가 다시 실행될 수 있습니다.

따라서 결제, 예약, 메일 발송 같은 작업에는 업무 식별자를 idempotency key로 사용해야 합니다.

```python
def reserve(state: State):
    reservation = payment_api.reserve(
        order_id=state["order_id"],
        idempotency_key=f"reserve:{state['order_id']}",
    )
    return {"events": [f"reserved:{reservation.id}"]}
```

복구 가능성과 외부 시스템의 exactly-once 처리는 같은 문제가 아닙니다. LangGraph가 중복 실행 가능성을 줄여도 side effect의 멱등성은 애플리케이션이 보장해야 합니다.

## 흔한 실수

- checkpointer 없이 재개한다. pending writes를 보존할 저장소가 없으므로 장애를 넘는 복구를 기대할 수 없습니다.
- 실패 후 초기 입력 dict를 다시 넣는다. 기존 실행을 재개하려면 같은 `thread_id`와 `None` 입력을 사용해야 합니다. 새 dict는 thread에 새 입력을 추가하는 별도 실행입니다.
- 성공 node는 절대 다시 실행되지 않는다고 가정한다. 외부 side effect 이후 write 저장 전 장애에는 재실행될 수 있습니다.
- 병렬 reducer 결과의 항목 순서에 의존한다. 완료·복구 순서에 따라 누적 list의 순서가 달라질 수 있으므로 ID나 명시적 정렬 기준을 사용합니다.
- `InMemorySaver`를 운영에 사용한다. 프로세스가 종료되면 checkpoint와 pending writes가 함께 사라집니다.
- custom checkpointer에서 `put_writes()`만 생략한다. 전체 checkpoint 저장만 구현하면 병렬 실패 복구의 핵심 정보가 유실됩니다.

## 정리

Pending writes는 병렬 super-step의 성공 결과를 task 단위로 내구화해 부분 실패 복구를 효율적으로 만듭니다. checkpointer를 붙이고 같은 thread를 `None`으로 재개하면 완료된 node는 건너뛰지만, 외부 side effect에는 별도의 idempotency key가 여전히 필요합니다.

## 참고 자료

- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph Checkpointing API reference](https://reference.langchain.com/python/langgraph/checkpoints)
- [LangGraph Functional API: idempotency and side effects](https://docs.langchain.com/oss/python/langgraph/functional-api)
