---
title: "LangGraph max_concurrency로 병렬 task 동시 실행 수 제한하기"
description: "fan-out workflow에서 RunnableConfig의 max_concurrency로 API와 DB에 몰리는 동시 요청 수를 실행별로 제한하는 방법"
date: 2026-08-15
tags:
  - langgraph
  - agent
  - workflow
  - performance
  - reliability
  - python
aliases:
  - "/blog/langgraph-max-concurrency-parallel-task-limits"
---

# LangGraph max_concurrency로 병렬 task 동시 실행 수 제한하기

`Send`나 병렬 edge로 fan-out을 만들면 같은 super-step의 task가 가능한 만큼 동시에 실행된다. I/O 작업의 지연 시간을 줄이는 데 유리하지만, fan-out 크기가 갑자기 커지면 외부 API의 동시 연결 제한, DB connection pool, 파일 descriptor를 한꺼번에 소모할 수 있다.

이럴 때 graph 호출 config의 최상위 `max_concurrency`를 사용한다.

```python
result = graph.invoke(
    inputs,
    {"max_concurrency": 4},
)
```

핵심은 `max_concurrency`가 **한 graph run 안에서 동시에 실행할 task 수의 상한**이라는 점이다. 전체 서버의 request rate나 여러 run을 합친 전역 동시성을 제한하는 장치는 아니다.

## 사전 준비

```bash
pip install -U langgraph
```

아래 예제는 외부 모델 없이 실행된다. Python 3.14, `langgraph==1.2.9`, `langgraph-checkpoint==4.1.1`에서 확인했다.

## 실행 가능한 fan-out 예제

여섯 작업을 동적으로 만들되 한 번에 두 개만 실행해 peak concurrency를 직접 측정한다.

```python
import threading
import time
from operator import add
from typing import Annotated

from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send


class State(TypedDict, total=False):
    items: list[int]
    item: int
    results: Annotated[list[int], add]


active = 0
peak = 0
lock = threading.Lock()


def dispatch(state: State) -> list[Send]:
    return [Send("worker", {"item": item}) for item in state["items"]]


def worker(state: State) -> dict[str, list[int]]:
    global active, peak

    with lock:
        active += 1
        peak = max(peak, active)

    try:
        time.sleep(0.1)  # 외부 API 또는 DB I/O를 흉내 낸다.
        return {"results": [state["item"] * 10]}
    finally:
        with lock:
            active -= 1


builder = StateGraph(State)
builder.add_node("worker", worker)
builder.add_conditional_edges(START, dispatch, ["worker"])
builder.add_edge("worker", END)
graph = builder.compile()

result = graph.invoke(
    {"items": list(range(6)), "results": []},
    {"max_concurrency": 2},
)

print("peak:", peak)
print("results:", sorted(result["results"]))
```

출력은 다음 형태다.

```text
peak: 2
results: [0, 10, 20, 30, 40, 50]
```

작업은 두 개씩 세 묶음으로 실행되므로 무제한 병렬 실행보다 오래 걸린다. 대신 downstream 시스템에 동시에 도착하는 요청의 폭을 예측할 수 있다. `results`에는 reducer가 필요하다. 같은 super-step의 여러 worker가 동일한 state key를 갱신하기 때문이다.

## config 최상위에 넣어야 한다

`max_concurrency`는 `RunnableConfig`의 최상위 필드다. `thread_id`처럼 `configurable` 아래에 넣으면 현재 로컬 graph scheduler가 concurrency limit로 읽지 않는다.

```python
# 올바름
config = {
    "max_concurrency": 2,
    "configurable": {"thread_id": "batch-42"},
}

# 제한이 적용되지 않음
wrong_config = {
    "configurable": {
        "thread_id": "batch-42",
        "max_concurrency": 2,
    }
}
```

공식 Graph API 가이드의 일부 예제에는 `configurable` 아래에 둔 형태가 보일 수 있지만, 현재 `RunnableConfig` API reference와 LangGraph 1.2.9 동작 기준으로는 최상위에 둬야 한다. 업그레이드할 때는 작은 peak 측정 테스트를 남겨 실제 scheduler 동작도 함께 확인한다.

## async graph에서도 호출 config는 같다

async node에서는 `threading.Lock` 대신 `asyncio.Lock`이나 간단한 semaphore 계측을 사용할 수 있다. concurrency limit 전달 방식은 동일하다.

```python
result = await graph.ainvoke(
    inputs,
    {"max_concurrency": 8},
)

async for part in graph.astream(
    inputs,
    {"max_concurrency": 8},
    stream_mode="updates",
    version="v2",
):
    print(part)
```

`max_concurrency`는 동시에 시작되는 graph task 수를 제한할 뿐, sync 함수를 non-blocking으로 바꾸지 않는다. async event loop에서 blocking SDK를 호출한다면 async client를 사용하거나 `asyncio.to_thread()`로 분리해야 한다.

## 값을 정하는 방법

고정된 정답보다 가장 좁은 downstream 한도를 기준으로 시작한다.

- DB pool이 20개이고 다른 endpoint도 pool을 공유한다면 graph 하나에 20을 모두 주지 않는다.
- provider가 request-per-second를 제한한다면 concurrency cap과 별도로 rate limiter와 retry backoff를 둔다.
- node 하나가 내부에서 다시 여러 요청을 병렬 호출한다면 실제 외부 동시성은 `max_concurrency × node 내부 fan-out`까지 커질 수 있다.
- 동시에 여러 graph run을 처리하는 서버라면 run별 cap 외에 process 또는 distributed semaphore가 필요하다.

운영에서는 429/503 비율, connection pool 대기 시간, graph 전체 지연 시간, 실행 중 task 수를 함께 보고 값을 조정한다.

## 자주 생기는 함정

### 전역 rate limit로 오해하기

두 사용자가 각각 `max_concurrency=5`인 run을 시작하면 합계는 최대 10 task가 될 수 있다. process 전체 또는 여러 replica 전체 한도는 Redis semaphore, queue worker 수, provider rate limiter 같은 별도 계층에서 제어한다.

### 처리 순서를 보장한다고 가정하기

limit는 동시에 실행되는 수만 제한한다. 완료 순서와 reducer가 값을 합치는 순서는 입력 순서와 다를 수 있다. 순서가 중요하면 결과에 입력 index를 넣고 fan-in 뒤 정렬한다.

### sync node 안에서 event loop를 막기

async graph라도 node 내부의 blocking HTTP/DB 호출은 event loop를 막을 수 있다. concurrency cap은 blocking code 문제를 해결하지 않는다.

### 너무 작은 값으로 timeout을 유발하기

동시성을 1로 낮추면 downstream은 편해지지만 긴 queue 대기로 graph의 전체 timeout이나 사용자 요청 timeout을 넘길 수 있다. 부하 보호와 end-to-end latency를 함께 측정한다.

### 병렬 state update에 reducer를 빼먹기

여러 task가 같은 key를 동시에 쓰면 concurrency 값을 1로 낮춰도 같은 super-step의 충돌 규칙은 바뀌지 않는다. 누적 결과에는 `Annotated[..., reducer]`를 선언한다.

## 정리

- `max_concurrency`는 한 graph run 안의 병렬 task 수를 제한한다.
- `{"max_concurrency": N}`처럼 `RunnableConfig` 최상위에 둔다.
- `configurable`에는 `thread_id` 같은 configurable 값을 두고 concurrency limit를 섞지 않는다.
- 전역 동시성, 초당 요청 수, node 내부 fan-out은 별도 제어가 필요하다.
- 낮은 값은 downstream을 보호하지만 전체 latency를 늘리므로 운영 지표로 조정한다.

## 참고 자료

- [LangGraph Graph API: Set max concurrency](https://docs.langchain.com/oss/python/langgraph/use-graph-api#set-max-concurrency)
- [RunnableConfig.max_concurrency Python API reference](https://reference.langchain.com/python/langchain-core/runnables/config/RunnableConfig/max_concurrency)
- [LangGraph patch_config Python API reference](https://reference.langchain.com/python/langgraph/_internal/_config/patch_config)
- [LangGraph Send API를 이용한 map-reduce](https://docs.langchain.com/oss/python/langgraph/use-graph-api#map-reduce-and-the-send-api)
