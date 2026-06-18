---
title: LangGraph Functional API로 @entrypoint와 @task workflow 만들기
description: LangGraph Functional API에서 @entrypoint, @task, checkpointer를 사용해 기존 Python 제어 흐름에 persistence와 replay-safe 실행을 붙이는 실전 패턴 정리
date: 2026-06-18
tags:
  - langgraph
  - agent
  - workflow
  - python
aliases:
  - "/blog/langgraph-functional-api-entrypoint-task-workflows"
---

# LangGraph Functional API로 `@entrypoint`와 `@task` workflow 만들기

LangGraph를 쓰고 싶지만 매번 `StateGraph`부터 꺼내 들 필요는 없다.  
이미 Python 함수와 `if`, `for`, 함수 호출 중심으로 짠 workflow가 있고, 여기에 persistence, replay-safe 실행, human-in-the-loop만 붙이고 싶을 때는 Functional API가 더 자연스럽다.

핵심은 두 가지다.

- `@entrypoint`: workflow 시작점
- `@task`: 체크포인트 가능한 작업 단위

이 조합을 쓰면 기존 imperative 코드 스타일을 크게 바꾸지 않고도 다음을 붙일 수 있다.

- 실패 후 resume
- 사람 승인 대기
- 병렬 task 실행
- 장시간 작업 결과 재사용

이 글에서는 실무에서 바로 중요한 기준만 정리한다.

- 언제 Functional API가 Graph API보다 단순한지
- `@task`를 어디까지 잘게 나눠야 하는지
- 실패 후 `invoke(None, config=...)`로 이어서 실행하는 패턴
- in-flight thread를 깨뜨리는 흔한 실수

## 언제 Functional API가 잘 맞나

공식 문서 기준으로 Functional API는 기존 코드에 persistence, memory, interrupt, streaming을 "최소한의 구조 변경"으로 붙이기 위한 방식이다.

특히 아래 조건이면 잘 맞는다.

- workflow 흐름이 이미 Python 제어문으로 명확하다
- 시각적인 graph 구조보다 코드 가독성이 더 중요하다
- 긴 API 호출, 파일 처리, 외부 작업을 task 단위로 체크포인트하고 싶다
- 실패나 승인 대기 뒤에도 이미 끝난 작업은 다시 돌리고 싶지 않다

반대로 아래 조건이면 Graph API가 더 낫다.

- 여러 노드가 shared state를 함께 갱신한다
- reducer와 병합 규칙이 중요하다
- 복잡한 branch와 subgraph를 시각적으로 관리해야 한다

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

## 1. 최소 예제: 병렬 task와 실패 후 resume

아래 예제는 주문 금액을 계산한 뒤 결제를 시도하는 workflow다.

- 상품별 가격 조회는 병렬로 실행한다
- 결제 task는 첫 번째 실행에서 일부러 실패시킨다
- 같은 `thread_id`로 `invoke(None, config=...)`를 다시 호출하면 이미 끝난 task는 재실행하지 않는다

```python
import time
from typing import Any

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint, task


attempts = {"charge": 0}


@task
def fetch_price(item: dict[str, Any]) -> int:
    time.sleep(0.2)
    print(f"fetch_price -> {item['sku']}")
    return item["unit_price"] * item["qty"]


@task
def reserve_inventory(order_id: str) -> str:
    time.sleep(0.2)
    print(f"reserve_inventory -> {order_id}")
    return f"reserved:{order_id}"


@task
def charge_card(order_id: str, amount: int) -> str:
    attempts["charge"] += 1
    print(f"charge_card attempt -> {attempts['charge']}")
    if attempts["charge"] == 1:
        raise RuntimeError("temporary pg timeout")
    return f"charged:{order_id}:{amount}"


checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def checkout(order: dict[str, Any]) -> dict[str, Any]:
    price_futures = [fetch_price(item) for item in order["items"]]
    subtotal = sum(f.result() for f in price_futures)

    reserve_result = reserve_inventory(order["order_id"]).result()
    charge_result = charge_card(order["order_id"], subtotal).result()

    return {
        "order_id": order["order_id"],
        "subtotal": subtotal,
        "inventory": reserve_result,
        "payment": charge_result,
    }


config = {"configurable": {"thread_id": "order-2001"}}
payload = {
    "order_id": "order-2001",
    "items": [
        {"sku": "A-1", "unit_price": 120, "qty": 2},
        {"sku": "B-2", "unit_price": 80, "qty": 1},
    ],
}

try:
    checkout.invoke(payload, config=config)
except RuntimeError as exc:
    print(f"first run failed: {exc}")

result = checkout.invoke(None, config=config)
print(result)
```

예상 흐름은 이렇다.

```text
fetch_price -> A-1
fetch_price -> B-2
reserve_inventory -> order-2001
charge_card attempt -> 1
first run failed: temporary pg timeout
charge_card attempt -> 2
{'order_id': 'order-2001', 'subtotal': 320, 'inventory': 'reserved:order-2001', 'payment': 'charged:order-2001:320'}
```

두 번째 실행에서 `fetch_price`, `reserve_inventory`가 다시 찍히지 않는 점이 중요하다.  
공식 문서 기준으로 Functional API는 task 결과를 체크포인트에 기록하고, resume 시 entrypoint 본문을 replay하면서 이미 저장된 task 결과를 다시 사용한다.

## 2. 이 패턴에서 꼭 이해해야 할 점

### 2-1. `@task`는 future-like 객체를 반환한다

`fetch_price(item)`를 호출하면 즉시 최종 값이 오는 것이 아니라 future-like 객체가 돌아온다.  
그래서 아래처럼 먼저 여러 task를 시작해 두고 나중에 `.result()`를 모아 읽으면 병렬 실행 패턴을 만들 수 있다.

```python
futures = [fetch_price(item) for item in items]
subtotal = sum(f.result() for f in futures)
```

공식 Functional API 가이드도 병렬 실행을 이 방식으로 설명한다.

### 2-2. `invoke(None, config=...)`는 같은 thread의 이어 달리기다

실패 뒤 이어서 실행할 때 새 payload를 다시 넣는 게 아니라 `None`으로 resume하는 패턴이 중요하다.

```python
checkout.invoke(None, config=config)
```

여기서 핵심은 `configurable.thread_id`가 같아야 한다는 점이다.  
thread가 달라지면 완전히 새 workflow 실행으로 취급된다.

### 2-3. side effect는 entrypoint 본문보다 task 안에 두는 편이 안전하다

결제 API 호출, 파일 쓰기, 외부 네트워크 호출 같은 작업을 entrypoint 본문에 직접 넣으면 replay 때 다시 실행될 수 있다.  
공식 문서는 non-deterministic 작업과 side effect를 `@task` 안에 두라고 권장한다.

실무 감각으로 바꾸면 이렇다.

- entrypoint: orchestration
- task: 오래 걸리거나 실패 가능하거나 재실행되면 곤란한 실제 작업

## 3. interrupt와 같이 쓸 때 왜 더 중요해지나

Functional API는 `interrupt()`도 잘 맞는다.  
예를 들어 할인 승인, 관리자 확인, 고객 응답 대기 같은 단계를 task 안에 넣어두면 그 전에 끝난 task 결과는 그대로 보존된다.

이 구조가 좋은 이유는 단순하다.

- 가격 계산은 이미 끝났다
- 재고 예약도 이미 끝났다
- 사람 승인만 기다리면 된다

이때 resume 후 다시 처음부터 API를 치지 않아도 된다.

즉 Functional API는 "승인 전까지 준비 작업을 해 두고, 재개 시 그 직전부터 자연스럽게 이어가기"에 강하다.

## 4. Graph API와 어떻게 역할을 나누면 좋나

둘 중 하나만 강제로 고를 필요는 없다. 공식 문서도 같은 애플리케이션 안에서 같이 쓸 수 있다고 설명한다.

개인적으로는 아래처럼 나누는 편이 실용적이다.

- workflow 뼈대가 함수형 순차 로직에 가깝다: Functional API
- shared state가 많고 분기/병합이 복잡하다: Graph API
- 기존 Graph API 노드를 크게 바꾸기 싫다: 상위 orchestration만 Functional API로 감싼다

예를 들어 "배치 작업 1개 안에서 여러 graph를 순서대로 호출"하는 경우는 Functional API가 바깥 orchestration 레이어로 잘 맞는다.

## 5. 자주 생기는 함정

### 5-1. task 순서를 바꾸면 in-flight thread가 깨질 수 있다

공식 backward compatibility 문서 기준으로 Functional API resume는 task와 interrupt 호출 순서를 위치 기반으로 replay한다.  
그래서 resume 지점 앞에 있는 `@task` 호출을 추가, 삭제, 재배치하면 기존 thread가 잘못된 cached 결과를 읽을 수 있다.

운영 중인 workflow를 바꿔야 한다면 아래가 더 안전하다.

- in-flight thread가 모두 끝난 뒤 배포한다
- 새 로직을 새 task로 감싼다
- 필요하면 새 entrypoint 이름으로 버전 분리한다

### 5-2. entrypoint 본문에 `random()`, `time.time()`, API 호출을 직접 넣는다

resume 시 entrypoint 본문은 처음부터 replay된다.  
이때 task 밖의 비결정적 코드가 제어 흐름을 바꾸면 같은 thread를 이어서 실행해도 결과가 달라질 수 있다.

### 5-3. 입력과 출력을 아무 객체로나 넘긴다

공식 문서 기준으로 entrypoint의 입력과 출력은 체크포인트를 위해 JSON-serializable 해야 한다.  
복잡한 Python 객체를 그대로 넘기면 나중에 persistence에서 막히기 쉽다.

### 5-4. sync task에 timeout을 붙이려 한다

현재 공식 문서 기준으로 timeout은 async task와 async entrypoint에서만 지원된다.  
동기 함수에 timeout을 붙이면 선언 시점에 오류가 난다.

## 6. 실전 체크리스트

Functional API workflow를 처음 붙일 때는 아래만 먼저 보면 된다.

1. 오래 걸리거나 외부 부작용이 있는 작업을 `@task`로 분리했는가
2. resume 가능한 실행 단위를 `thread_id`로 안정적으로 식별하는가
3. 병렬화할 작업은 future를 먼저 만들고 나중에 `.result()`를 모으는가
4. 운영 중인 workflow에서 task 순서를 함부로 바꾸지 않는가
5. entrypoint 본문은 가능한 한 deterministic orchestration만 담당하는가

## 마무리

LangGraph Functional API의 장점은 "graph를 몰라도 된다"가 아니라, 기존 Python workflow에 durable execution을 얹는 비용이 낮다는 점에 있다.

- 기존 함수형 제어 흐름을 유지하고 싶다: `@entrypoint`
- 재실행되면 아까운 작업을 체크포인트하고 싶다: `@task`
- 실패 뒤 이어서 실행하고 싶다: 같은 `thread_id` + `invoke(None, config=...)`

Graph API가 workflow 구조를 명시적으로 설계하는 도구라면, Functional API는 이미 있는 workflow를 replay-safe하게 운영하는 도구에 가깝다.

## 참고 자료

- [LangGraph Functional API overview](https://docs.langchain.com/oss/python/langgraph/functional-api)
- [LangGraph Use the Functional API](https://docs.langchain.com/oss/python/langgraph/use-functional-api)
- [LangGraph Choosing between Graph and Functional APIs](https://docs.langchain.com/oss/python/langgraph/choosing-apis)
- [LangGraph Backward compatibility](https://docs.langchain.com/oss/python/langgraph/backward-compatibility)
