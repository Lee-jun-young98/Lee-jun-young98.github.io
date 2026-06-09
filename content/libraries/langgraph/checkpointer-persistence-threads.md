---
title: LangGraph checkpointer로 thread 상태 저장하고 이어서 실행하기
description: LangGraph에서 checkpointer, thread_id, get_state_history를 사용해 workflow 상태를 저장하고 재개하는 실전 패턴 정리
date: 2026-06-09
tags:
  - langgraph
  - agent
  - workflow
  - python
aliases:
  - "/blog/langgraph-checkpointer-persistence-threads"
---

# LangGraph checkpointer로 thread 상태 저장하고 이어서 실행하기

LangGraph를 쓰다 보면 `interrupt()`나 time travel처럼 눈에 띄는 기능부터 먼저 보게 된다.  
그런데 실무에서 더 먼저 잡아야 하는 것은 "이 workflow 상태를 어디에 저장하고, 어떤 ID로 다시 이어 갈 것인가?"이다.

LangGraph에서는 이 역할을 `checkpointer`와 `thread_id`가 맡는다.  
그래프를 `compile(checkpointer=...)`로 컴파일하고 실행 시 `configurable.thread_id`를 넘기면, 각 step의 상태가 checkpoint로 저장된다.

이 글에서는 다음만 실전 기준으로 빠르게 정리한다.

- `checkpointer`가 정확히 무엇을 해 주는지
- `thread_id`를 어떻게 잡아야 하는지
- `InMemorySaver`로 바로 실행되는 최소 예제
- 로컬/운영 환경에서 saver를 어떻게 나누면 좋은지
- 자주 생기는 함정

## 언제 꼭 써야 하나

공식 문서 기준으로 persistence는 다음 기능의 기반이다.

- human-in-the-loop
- short-term memory
- time travel / replay / fork
- fault-tolerant execution

즉 `interrupt()`만 쓸 생각이더라도 결국 checkpointer가 필요하다.  
반대로 "이번 한 번만 실행하고 상태를 남길 필요가 없는" 아주 짧은 그래프라면 checkpointer 없이 시작해도 된다.

## 핵심 개념 세 가지

### 1. checkpointer

checkpointer는 각 super-step 경계에서 그래프 상태를 저장하는 객체다.  
LangGraph 기본 패키지에는 개발용 `InMemorySaver`가 포함되어 있고, 공식 문서에서는 SQLite와 Postgres용 saver도 별도 패키지로 제공한다.

- 빠른 실험: `InMemorySaver`
- 로컬 파일 기반 테스트: `SqliteSaver`
- 운영 환경: `PostgresSaver`

### 2. thread_id

`thread_id`는 "이 실행 흐름이 어느 대화/작업/승인 요청에 속하는가"를 식별하는 키다.  
같은 `thread_id`로 다시 호출하면 이전 checkpoint를 기준으로 이어서 실행할 수 있다.

실무에서는 보통 아래 중 하나와 1:1로 매핑한다.

- 대화 세션 ID
- approval request ID
- 백그라운드 job ID
- user + workflow 조합 ID

### 3. checkpoint history

checkpoint를 저장해 두면 현재 상태뿐 아니라 과거 상태도 조회할 수 있다.

- `graph.get_state(config)`: 현재 상태 스냅샷
- `graph.get_state_history(config)`: 과거 checkpoint 목록

이게 있어야 interrupt 재개, replay, 디버깅이 쉬워진다.

## 사전 준비

가장 단순한 예제는 `langgraph`만 있으면 된다.

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

SQLite saver까지 써 보고 싶다면 공식 패키지를 추가로 설치한다.

```bash
pip install -U langgraph langgraph-checkpoint-sqlite
```

## 1. 가장 작은 persistence 예제

아래 예제는 주문 상태를 단계별로 누적하고, 같은 `thread_id`로 다시 호출했을 때 이전 상태가 이어지는 모습을 보여 준다.

```python
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


class OrderState(TypedDict):
    order_id: str
    status: str
    paid: bool
    packed: bool


def mark_paid(state: OrderState):
    return {
        "status": "paid",
        "paid": True,
    }


def pack_order(state: OrderState):
    if not state["paid"]:
        raise ValueError("payment required before packing")

    return {
        "status": "packed",
        "packed": True,
    }


builder = StateGraph(OrderState)
builder.add_node("mark_paid", mark_paid)
builder.add_node("pack_order", pack_order)
builder.add_edge(START, "mark_paid")
builder.add_edge("mark_paid", "pack_order")
builder.add_edge("pack_order", END)

graph = builder.compile(checkpointer=InMemorySaver())

config = {"configurable": {"thread_id": "order-1001"}}

result = graph.invoke(
    {
        "order_id": "order-1001",
        "status": "created",
        "paid": False,
        "packed": False,
    },
    config=config,
)

print(result)

snapshot = graph.get_state(config)
print(snapshot.values)

history = list(graph.get_state_history(config))
print(len(history))
for item in history[:3]:
    print(item.metadata, item.values)
```

실행 후 확인할 포인트는 세 가지다.

- `invoke(..., config=config)`에 `thread_id`가 들어간다.
- 실행이 끝난 뒤 `graph.get_state(config)`로 최신 상태를 볼 수 있다.
- `graph.get_state_history(config)`로 checkpoint 누적 이력을 확인할 수 있다.

## 2. 같은 thread에 이어서 입력을 넣는 패턴

LangGraph의 persistence는 "한 번 실행 후 끝"보다 "같은 thread에 후속 입력을 붙이는 흐름"에서 더 유용하다.

예를 들어 같은 주문 thread에 후속 검수 단계를 붙이고 싶다면 다음처럼 호출한다.

```python
second_result = graph.invoke(
    {
        "order_id": "order-1001",
        "status": "packed",
        "paid": True,
        "packed": True,
    },
    config={"configurable": {"thread_id": "order-1001"}},
)

print(second_result)
```

실무에서는 보통 node를 더 늘리고, 후속 입력은 새 사용자 메시지나 승인 결과, 외부 작업 완료 이벤트로 바뀐다.  
중요한 것은 "같은 흐름이면 같은 `thread_id`를 유지한다"는 점이다.

## 3. 로컬에서는 SQLite, 운영에서는 Postgres를 고려하기

공식 문서 기준으로 saver 선택은 대체로 이렇게 보면 된다.

- `InMemorySaver`: 빠른 실험용
- `SqliteSaver`: 로컬 워크플로, 데모, 가벼운 동기 환경
- `PostgresSaver`: 운영 환경

SQLite 예제는 다음처럼 시작할 수 있다.

```python
import sqlite3

from langgraph.checkpoint.sqlite import SqliteSaver


conn = sqlite3.connect("langgraph-checkpoints.sqlite", check_same_thread=False)
checkpointer = SqliteSaver(conn)
graph = builder.compile(checkpointer=checkpointer)
```

공식 reference에서는 `SqliteSaver`를 가벼운 동기 use case용으로 설명하고, 여러 thread를 강하게 확장하는 용도에는 적합하지 않다고 안내한다.  
운영 서버에서 재시작 이후에도 복구해야 한다면 Postgres 계열 saver가 더 자연스럽다.

## 4. persistence가 있으면 바로 할 수 있는 것

checkpointer를 붙여 두면 이후 주제들이 전부 쉬워진다.

- `interrupt()` 후 같은 thread에서 재개
- `get_state_history()` 기반 replay 디버깅
- thread 단위 short-term memory 유지
- 장애 후 마지막 성공 step부터 복구

특히 공식 문서에서는 super-step 단위 checkpoint 외에도 task 수준의 pending writes를 저장해, 같은 super-step의 다른 node가 실패해도 성공한 node 결과를 다시 계산하지 않게 만든다고 설명한다.

## 5. 자주 하는 실수

### 5-1. `thread_id`를 빼먹는다

checkpointer를 붙였더라도 `thread_id`가 없으면 이어서 실행할 기준이 없다.  
interrupt 재개나 multi-turn memory가 안 붙는 이유의 상당수가 여기서 나온다.

```python
config = {"configurable": {"thread_id": "user-42-session-3"}}
graph.invoke(payload, config=config)
```

### 5-2. `InMemorySaver`를 운영 persistence로 착각한다

`InMemorySaver`는 프로세스 메모리에만 남는다.  
서버가 재시작되면 상태도 사라진다. 로컬 예제와 테스트에는 좋지만 운영 복구용 저장소로 쓰면 안 된다.

### 5-3. thread 간 공유 메모리까지 checkpointer가 해 준다고 생각한다

checkpointer는 thread 내부 상태 persistence용이다.  
여러 thread에서 공통으로 읽는 사용자 선호나 장기 메모리는 `Store`가 필요한 별도 문제다.

예를 들어 "사용자 A의 선호를 모든 대화 thread에서 공유"하려면 persistence만으로는 부족하고 store를 같이 써야 한다.

### 5-4. 저장 비용과 직렬화를 무시한다

상태가 커지면 checkpoint 저장량도 커진다.  
공식 문서에는 append-heavy 채널의 저장량을 줄이는 `DeltaChannel`과 serializer 설정, 암호화 옵션까지 따로 설명돼 있다.

대용량 state를 오래 보관할 계획이면 처음부터 아래를 같이 봐야 한다.

- 어떤 state 키가 계속 누적되는지
- 기본 serializer로 직렬화 가능한지
- 민감한 데이터를 암호화해야 하는지

## 6. 실무에서 바로 쓰는 운영 체크리스트

아주 작게 시작하면 아래 정도만 챙겨도 대부분의 시행착오를 줄일 수 있다.

1. 모든 실행 흐름에 안정적인 `thread_id`를 부여한다.
2. 개발은 `InMemorySaver`, 로컬 통합 테스트는 `SqliteSaver`, 운영은 `PostgresSaver`를 우선 검토한다.
3. `graph.get_state()`와 `graph.get_state_history()`를 디버깅 루틴에 넣는다.
4. thread 내부 persistence와 thread 간 장기 메모리를 구분한다.
5. 상태가 커질수록 serializer, 암호화, 저장량 최적화를 같이 본다.

## 마무리

LangGraph의 checkpointer는 부가 기능이 아니라 durable execution의 바닥이다.  
`interrupt`, time travel, short-term memory, 장애 복구를 제대로 쓰려면 결국 `checkpointer + thread_id` 설계를 먼저 잡아야 한다.

처음에는 아래 한 줄만 정확히 습관화해도 충분하다.

```python
graph = builder.compile(checkpointer=InMemorySaver())
config = {"configurable": {"thread_id": "stable-id-for-this-run"}}
```

여기서 시작하면 이후 interrupt, replay, store, production saver로 자연스럽게 확장된다.

## 참고 자료

- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph Memory](https://docs.langchain.com/oss/python/langgraph/add-memory)
- [LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [Checkpointer integrations](https://docs.langchain.com/oss/python/integrations/checkpointers/index)
- [SqliteSaver reference](https://reference.langchain.com/python/langgraph.checkpoint.sqlite/SqliteSaver)
