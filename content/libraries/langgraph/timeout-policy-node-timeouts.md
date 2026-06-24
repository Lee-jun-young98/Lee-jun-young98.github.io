---
title: LangGraph TimeoutPolicy로 느린 노드를 run_timeout, idle_timeout으로 끊기
description: LangGraph fault tolerance에서 TimeoutPolicy, NodeTimeoutError, heartbeat를 사용해 느리거나 멈춘 async 노드를 안전하게 제한하는 실전 패턴 정리
date: 2026-06-24
tags:
  - langgraph
  - workflow
  - reliability
  - python
aliases:
  - "/blog/langgraph-timeout-policy-node-timeouts"
---

# LangGraph TimeoutPolicy로 느린 노드를 run_timeout, idle_timeout으로 끊기

LangGraph workflow를 운영하다 보면 "실패"보다 더 골치 아픈 경우가 있다.

- 외부 API가 아주 느리지만 완전히 죽지는 않는다.
- LLM 스트리밍은 조금씩 오는데, 실제로는 의미 있는 진전이 없다.
- 배치 처리 노드가 중간에 멈춘 듯 보이는데 언제까지 기다려야 할지 기준이 없다.

이럴 때는 `RetryPolicy`만으로 부족하다.  
재시도는 "실패한 뒤 다시 시도"하는 장치이고, timeout은 "한 번의 시도가 얼마나 오래 버틸 수 있는지"를 정하는 장치다.

공식 LangGraph fault tolerance 문서 기준으로 `add_node(..., timeout=...)`에는 초 단위 숫자, `timedelta`, 또는 `TimeoutPolicy`를 줄 수 있다.  
특히 `TimeoutPolicy`를 쓰면 아래 두 종류를 분리해서 다룰 수 있다.

- `run_timeout`: 한 번의 시도 전체에 거는 하드 제한
- `idle_timeout`: 진행 신호가 멈췄을 때만 발동하는 제한

이 글에서는 실무 기준으로 아래만 정리한다.

- `run_timeout`과 `idle_timeout`을 언제 어떻게 나눌지
- `NodeTimeoutError`와 재시도를 어떻게 같이 붙일지
- `refresh_on="heartbeat"`와 `runtime.heartbeat()`가 필요한 상황
- timeout을 붙여도 장애가 줄지 않는 흔한 실수

## 언제 쓰면 좋은가

아래 같은 노드는 timeout 후보라고 보면 된다.

- 외부 HTTP API 호출
- 느린 DB 조회나 검색 노드
- 스트리밍 LLM 호출
- 긴 배치 처리나 파일 파싱
- 서드파티 SDK가 응답은 하지만 너무 오래 붙잡는 작업

반대로 아주 짧고 순수한 계산 노드는 timeout보다 입력 검증과 재시도 설계가 더 중요할 때가 많다.

## 사전 준비

공식 문서 기준으로 per-node timeout은 `langgraph>=1.2`가 필요하다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "langgraph>=1.2"
```

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U "langgraph>=1.2"
```

중요한 제약도 하나 있다.

- timeout은 async 노드에만 적용된다.
- sync 노드에 `timeout=`을 주면 compile 시점에 거부된다.

즉 기존 동기 I/O를 쓰고 있다면 `asyncio.to_thread(...)` 같은 방식으로 async 노드 안으로 감싸는 편이 안전하다.

## 1. 가장 단순한 제한: `run_timeout`

`run_timeout`은 "이 시도가 아무리 바쁘게 일하고 있어도 여기까지만"이라는 하드 캡이다.  
공식 문서 기준으로 node activity와 관계없이 절대 시간이 지나면 `NodeTimeoutError`가 발생한다.

```python
import asyncio
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import TimeoutPolicy


class State(TypedDict):
    prompt: str
    answer: str


async def slow_model(state: State):
    await asyncio.sleep(5)
    return {"answer": f"done: {state['prompt']}"}


builder = StateGraph(State)
builder.add_node(
    "slow_model",
    slow_model,
    timeout=TimeoutPolicy(run_timeout=2),
)
builder.add_edge(START, "slow_model")
builder.add_edge("slow_model", END)

graph = builder.compile()

result = graph.invoke({"prompt": "hello"})
```

이 예제는 약 2초쯤 지나면 timeout으로 끊긴다.

`run_timeout`이 잘 맞는 경우는 아래와 같다.

- 사용자 요청 하나당 응답 상한이 분명할 때
- 외부 호출이 가끔 끝없이 길어질 수 있을 때
- "진행 중인지 여부"보다 "최대 몇 초 기다릴지"가 더 중요할 때

## 2. "멈춰 있는지"를 보려면 `idle_timeout`

`idle_timeout`은 `run_timeout`과 다르게 "진행 신호가 계속 나오면 살려 두고, 조용해지면 끊는" 방식이다.  
공식 문서 기준으로 기본 `refresh_on="auto"`에서는 아래 같은 이벤트가 idle clock을 리셋한다.

- state write
- async stream output
- child task scheduling
- runtime stream writer 호출
- LangChain callback 이벤트

즉 토큰 스트리밍이나 자식 작업이 꾸준히 흘러나오면 idle timeout은 발동하지 않을 수 있다.

```python
import asyncio
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import TimeoutPolicy


class State(TypedDict):
    batches: int
    status: str


async def process_batches(state: State):
    for _ in range(state["batches"]):
        await asyncio.sleep(1)
    return {"status": "done"}


builder = StateGraph(State)
builder.add_node(
    "process_batches",
    process_batches,
    timeout=TimeoutPolicy(idle_timeout=2),
)
builder.add_edge(START, "process_batches")
builder.add_edge("process_batches", END)

graph = builder.compile()
```

실무 해석은 대략 이렇다.

- `run_timeout`: 총 작업 시간을 제한
- `idle_timeout`: 멈춤 상태를 감지

둘은 대체 관계가 아니라 함께 쓰는 경우가 많다.

## 3. 보통은 둘을 같이 건다

공식 문서 기준으로 `run_timeout`과 `idle_timeout`은 동시에 줄 수 있고, 먼저 도달한 쪽이 시도를 취소한다.

```python
from langgraph.types import TimeoutPolicy

builder.add_node(
    "call_model",
    call_model,
    timeout=TimeoutPolicy(
        run_timeout=60,
        idle_timeout=15,
    ),
)
```

이 조합이 실무에서 편한 이유는 분명하다.

- 총 60초는 넘기지 않는다.
- 그 전에라도 15초 동안 진전이 없으면 끊는다.

예를 들어 검색, 정리, 생성이 섞인 노드라면 아래처럼 생각하면 된다.

- `run_timeout`: SLA 상한
- `idle_timeout`: hung detection

## 4. `NodeTimeoutError`는 기본적으로 retryable하다

공식 문서 기준으로 timeout이 발생하면 `NodeTimeoutError`가 올라오고, 이 예외는 기본적으로 재시도 가능하다.  
또 timed-out attempt의 writes는 다음 재시도 전에 정리된다.

```python
import asyncio
from typing_extensions import TypedDict

from langgraph.errors import NodeTimeoutError
from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy, TimeoutPolicy


class State(TypedDict):
    query: str
    result: str


attempts = {"search_api": 0}


async def search_api(state: State):
    attempts["search_api"] += 1
    attempt = attempts["search_api"]
    print(f"attempt={attempt}")

    if attempt == 1:
        await asyncio.sleep(3)
    else:
        await asyncio.sleep(0.5)

    return {"result": f"ok: {state['query']}"}


builder = StateGraph(State)
builder.add_node(
    "search_api",
    search_api,
    timeout=TimeoutPolicy(run_timeout=1),
    retry_policy=RetryPolicy(
        max_attempts=3,
        retry_on=NodeTimeoutError,
    ),
)
builder.add_edge(START, "search_api")
builder.add_edge("search_api", END)

graph = builder.compile()

print(graph.invoke({"query": "langgraph timeout"}))
```

이 예제에서는 첫 시도가 timeout으로 끊기고, 두 번째 시도에서 성공할 수 있다.

여기서 기억할 점은 세 가지다.

- `max_attempts`는 첫 시도까지 포함한다.
- timeout 시계는 새 시도마다 다시 시작된다.
- 재시도된다는 이유만으로 부작용 안전성이 생기지는 않는다.

## 5. `heartbeat` 모드는 "시끄러운 하위 작업"에 속지 않게 해 준다

기본 `refresh_on="auto"`는 편하지만, 때로는 너무 관대하다.  
예를 들어 하위 라이브러리가 로그나 callback 이벤트를 계속 내보내면 실제 진전이 없어도 idle timeout이 계속 밀릴 수 있다.

공식 문서 기준으로 이럴 때 `refresh_on="heartbeat"`를 주면 idle clock은 `runtime.heartbeat()` 호출로만 리셋된다.

```python
import asyncio
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime
from langgraph.types import TimeoutPolicy


class State(TypedDict):
    items: list[int]
    processed: int


async def index_items(state: State, runtime: Runtime):
    processed = 0
    for item in state["items"]:
        await asyncio.sleep(0.5)
        _ = item * 2
        processed += 1
        runtime.heartbeat()
    return {"processed": processed}


builder = StateGraph(State)
builder.add_node(
    "index_items",
    index_items,
    timeout=TimeoutPolicy(
        idle_timeout=2,
        refresh_on="heartbeat",
    ),
)
builder.add_edge(START, "index_items")
builder.add_edge("index_items", END)

graph = builder.compile()
```

이 패턴은 아래 같은 상황에 특히 잘 맞는다.

- 긴 루프가 있는데 state write는 마지막에만 할 때
- 내부에서 CPU 작업만 오래 돌고 외부 이벤트가 거의 없을 때
- callback noise와 진짜 progress를 구분하고 싶을 때

공식 문서 기준으로 `runtime.heartbeat()`는 idle timeout이 없는 경우 no-op이므로, heartbeat 기반 노드에서는 그냥 조건 없이 호출해도 된다.

## 6. sync 노드 timeout이 막히는 이유

공식 문서는 sync 노드에 `timeout=`을 붙이면 compile time에 거부된다고 분명히 적고 있다.  
이 제한은 실무적으로 꽤 타당하다.

- 동기 함수는 cooperative cancellation이 어렵다.
- timeout이 걸려도 내부 blocking call을 깔끔하게 끊기 어렵다.
- 억지로 쓰면 "LangGraph는 timeout 됐다고 했는데 실제 외부 호출은 계속 돈다" 같은 상태가 생기기 쉽다.

기존 코드가 동기식이면 보통 이렇게 바꾼다.

```python
import asyncio
import requests


def blocking_fetch(url: str) -> str:
    return requests.get(url, timeout=30).text[:100]


async def fetch_url(state):
    text = await asyncio.to_thread(blocking_fetch, state["url"])
    return {"preview": text}
```

그 다음 async 노드 쪽에 LangGraph timeout을 붙인다.

## 자주 겪는 함정

### 1. `RetryPolicy`만 붙이고 hung call은 못 막는다

재시도는 실패 후에만 동작한다.  
느리지만 끝나지 않는 호출은 timeout 없이는 재시도 단계까지 못 간다.

### 2. `idle_timeout`을 붙였는데 로그나 토큰 스트리밍 때문에 안 끊긴다

기본 `refresh_on="auto"`는 생각보다 많은 이벤트를 progress로 본다.  
엄격한 idle 판정이 필요하면 `refresh_on="heartbeat"`로 좁혀야 한다.

### 3. timeout을 걸면 부작용도 안전할 거라고 생각한다

timeout 뒤 재시도 시 함수 본문은 다시 실행된다.  
외부 쓰기 작업이 있다면 idempotency key, upsert, read-before-write 같은 보호 장치가 필요하다.

### 4. sync 함수에 timeout을 바로 붙이려 한다

이건 공식 동작상 막힌다.  
동기 I/O는 async 노드 안에서 `asyncio.to_thread(...)`로 감싸는 편이 낫다.

### 5. `run_timeout`과 `idle_timeout`을 같은 숫자로 대충 맞춘다

두 값은 의미가 다르다.

- `run_timeout`: 비즈니스 전체 상한
- `idle_timeout`: 진전 없는 정지 감지

같은 숫자를 넣어도 되지만, 의도 없이 맞추면 운영 중 해석이 어려워진다.

## 추천 설정 감각

개인적으로는 아래처럼 시작하는 편이 무난하다.

1. 사용자-facing 요청이면 먼저 전체 SLA를 기준으로 `run_timeout`을 잡는다.
2. 스트리밍이나 긴 루프가 있으면 그보다 훨씬 짧은 `idle_timeout`을 둔다.
3. 하위 작업 noise가 많으면 `refresh_on="heartbeat"`로 바꾼다.
4. timeout 이후 다시 해 볼 가치가 있으면 `RetryPolicy`를 함께 둔다.
5. 부작용 있는 노드는 재시도 전에 멱등성부터 확인한다.

## 마무리

LangGraph의 `TimeoutPolicy`는 단순한 "몇 초 제한" 기능보다 조금 더 정교하다.

- `run_timeout`: 한 번의 시도 전체를 자른다.
- `idle_timeout`: 진전이 멈춘 시도를 자른다.
- `refresh_on="heartbeat"`: progress 정의를 직접 통제한다.
- `NodeTimeoutError` + `RetryPolicy`: 느린 외부 의존성을 자동 복구 흐름에 연결한다.

LangGraph workflow가 길어질수록 "실패 처리"만큼이나 "너무 오래 붙잡는 시도 끊기"가 중요해진다.  
외부 API, 검색, LLM 호출이 섞인 노드부터 timeout 설계를 같이 넣어 두는 편이 운영 안정성에 훨씬 도움이 된다.

## 참고 자료

- [LangGraph Fault tolerance](https://docs.langchain.com/oss/python/langgraph/fault-tolerance)
- [LangGraph Graph API Overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph Use the Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [LangGraph `TimeoutPolicy` Reference](https://reference.langchain.com/python/langgraph/types/#langgraph.types.TimeoutPolicy)
- [LangGraph `NodeTimeoutError` Reference](https://reference.langchain.com/python/langgraph/errors/#langgraph.errors.NodeTimeoutError)
