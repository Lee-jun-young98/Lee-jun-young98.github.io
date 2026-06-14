---
title: "LangGraph RunControl로 graceful shutdown 후 안전하게 재개하기"
description: "LangGraph에서 RunControl, GraphDrained, thread_id, checkpointer를 묶어 배포 중단이나 워커 종료 시점을 superstep 경계에서 안전하게 멈추고 이어서 실행하는 패턴 정리"
date: 2026-06-14
tags:
  - langgraph
  - workflow
  - reliability
  - python
aliases:
  - "/blog/langgraph-graceful-shutdown-runcontrol-resume"
---

# LangGraph `RunControl`로 graceful shutdown 후 안전하게 재개하기

LangGraph workflow를 운영 환경에 올리면 "지금 당장 프로세스를 죽이기보다, 현재 step까지만 끝내고 안전하게 멈춘 뒤 나중에 이어서 돌리고 싶다"는 요구가 자주 생긴다.

- 배포 중 `SIGTERM`을 받아 워커를 내릴 때
- 긴 배치 workflow를 다음 maintenance window 전에 멈출 때
- 비용이 큰 graph를 supervisor가 회수해야 할 때

이럴 때 LangGraph는 `RunControl`과 `GraphDrained`를 제공한다.  
공식 문서 기준으로 drain은 실행 중인 node를 강제로 끊지 않고, 현재 superstep이 끝난 뒤 체크포인트를 남기고 멈추는 cooperative shutdown이다.

이번 글에서는 아래만 실전 기준으로 빠르게 정리한다.

- `request_drain()`이 정확히 언제 멈추는지
- 재개를 위해 왜 `checkpointer`와 `thread_id`가 필요한지
- 바로 실행 가능한 Python 예제
- `timeout`, `interrupt`, 강제 종료와의 역할 차이
- 흔한 실수

## 언제 쓰면 좋은가

아래 조건이면 graceful shutdown을 먼저 떠올리면 된다.

- node 중간이 아니라 step 경계에서 안전하게 멈추고 싶다
- 이후 같은 workflow를 이어서 실행해야 한다
- 현재까지 성공한 상태를 버리지 않고 checkpoint로 남기고 싶다

대표 예시는 이렇다.

- Kubernetes rolling deploy 중 agent worker drain
- 백그라운드 문서 처리 graph를 야간 점검 전에 중단
- supervisor가 "지금은 자원 회수, 나중에 이어서 처리"를 지시

반대로 아래 상황에는 다른 도구가 더 맞다.

- 지금 실행 중인 node를 즉시 끊어야 한다: LangGraph drain만으로는 부족하고 별도 취소/timeout 설계가 필요하다
- 사람 입력을 기다리며 멈춰야 한다: `interrupt()`
- 실패한 node를 자동 복구하고 싶다: `RetryPolicy`, `timeout`, `error_handler`

## 사전 준비

graceful shutdown은 공식 문서 기준 `langgraph>=1.2`가 필요하다.

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

예제는 `InMemorySaver`를 쓰지만, 운영 환경에서는 프로세스 재시작 뒤에도 이어서 실행할 수 있도록 durable checkpointer를 쓰는 편이 맞다.

## 1. 핵심 개념 세 가지

### 1-1. `RunControl`

`RunControl`은 현재 graph run에 "다음 superstep 경계에서 멈춰라"라는 신호를 보내는 객체다.  
`graph.invoke(..., control=control)` 또는 `graph.stream(..., control=control)`로 넘기고, 다른 스레드나 signal handler에서 `control.request_drain("reason")`를 호출하면 된다.

### 1-2. `GraphDrained`

drain 요청이 실제로 적용되고 이후에 더 실행할 step이 남아 있으면 LangGraph는 `GraphDrained`를 raise한다.  
이 예외는 "실패"라기보다 "중간 저장 후 멈춤"에 가깝다.

### 1-3. `checkpointer` + `thread_id`

재개하려면 checkpoint가 있어야 하므로 checkpointer가 필요하다.  
또 어떤 실행 흐름을 이어갈지 식별하려면 같은 `thread_id`를 계속 써야 한다.

공식 문서도 재개 예제로 같은 config에서 `invoke(None, config)`를 보여 준다.

## 2. 가장 작은 실행 예제

아래 예제는 두 단계 workflow를 돌리다가 첫 번째 긴 step이 끝난 뒤 drain을 걸고, 같은 `thread_id`로 재개해서 마지막 step까지 완료한다.

```python
import threading
import time
from typing import Annotated
import operator
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.errors import GraphDrained
from langgraph.graph import END, START, StateGraph
from langgraph.runtime import RunControl


class JobState(TypedDict):
    logs: Annotated[list[str], operator.add]
    completed: bool


def prepare(state: JobState):
    return {"logs": ["prepare"]}


def process_batch(state: JobState):
    time.sleep(0.7)
    return {"logs": ["process_batch"]}


def finalize(state: JobState):
    return {"logs": ["finalize"], "completed": True}


builder = StateGraph(JobState)
builder.add_node("prepare", prepare)
builder.add_node("process_batch", process_batch)
builder.add_node("finalize", finalize)
builder.add_edge(START, "prepare")
builder.add_edge("prepare", "process_batch")
builder.add_edge("process_batch", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile(checkpointer=InMemorySaver())

config = {"configurable": {"thread_id": "job-42"}}
control = RunControl()

# process_batch가 도는 동안 drain을 요청한다.
timer = threading.Timer(0.2, lambda: control.request_drain("deploy"))
timer.start()

try:
    graph.invoke({"logs": [], "completed": False}, config=config, control=control)
except GraphDrained as exc:
    print("drained:", exc.reason)

snapshot = graph.get_state(config)
print("saved values:", snapshot.values)

resumed = graph.invoke(None, config=config)
print("resumed logs:", resumed["logs"])
print("completed:", resumed["completed"])
```

예상 흐름은 대략 이렇다.

```text
drained: deploy
saved values: {'logs': ['prepare', 'process_batch'], 'completed': False}
resumed logs: ['prepare', 'process_batch', 'finalize']
completed: True
```

핵심은 세 가지다.

- `request_drain()`을 호출해도 `process_batch`는 끝까지 실행된다
- 대신 다음 superstep으로 넘어가기 전에 checkpoint를 남기고 `GraphDrained`로 빠진다
- 이후 같은 `thread_id`로 `invoke(None, config)`를 호출하면 남은 step부터 이어진다

## 3. drain은 "즉시 중단"이 아니라 "경계에서 멈춤"이다

공식 문서가 강조하는 지점도 여기다. drain은 cooperative shutdown이며, 이미 실행 중인 작업을 선점해서 끊지 않는다.

- node가 실행 중이면 그 node는 끝까지 돈다
- retry 중이면 retry loop가 끝난 뒤 drain이 적용된다
- graph가 같은 tick에 자연 종료되면 예외 없이 정상 종료될 수도 있다

즉 "몇 초 안에 무조건 끊어라"가 요구사항이면 drain만으로는 부족하다.  
그 경우는 `timeout`, asyncio cancellation, supervisor kill policy를 같이 설계해야 한다.

## 4. node 안에서도 drain 상태를 읽을 수 있다

아직 superstep 경계에 도달하지 않았더라도, node 내부에서는 `runtime.drain_requested`와 `runtime.drain_reason`을 읽어 비싼 후속 작업을 건너뛸 수 있다.

```python
from langgraph.runtime import Runtime


async def expensive_step(state: JobState, runtime: Runtime):
    if runtime.drain_requested:
        return {"logs": ["skip_expensive_step_due_to_drain"]}

    result = await run_expensive_call()
    return {"logs": [f"expensive={result}"]}
```

이 패턴은 drain이 이미 들어온 상태에서 "지금 이 안에서 더 큰 외부 호출을 시작할지"를 줄일 때 유용하다.

## 5. `interrupt()`, `timeout`과 어떻게 구분할까

- 사람이 승인할 때까지 멈춘다: `interrupt()`
- 한 node가 너무 오래 걸리면 실패 또는 재시도한다: `timeout`
- 배포/운영 이유로 현재 경계에서 저장 후 멈춘다: `RunControl.request_drain()`

셋은 경쟁 관계가 아니라 같이 쓰는 경우가 많다. 예를 들면:

1. `timeout`으로 개별 node 상한 관리
2. `RetryPolicy`로 일시 실패 복구
3. 운영 이벤트가 오면 `request_drain()`으로 안전 정지
4. 재기동 후 같은 `thread_id`로 재개

## 6. 흔한 실수

### 6-1. checkpointer 없이 재개를 기대한다

drain 뒤에 다시 이어서 돌리려면 checkpoint가 남아 있어야 한다.  
데모에서는 `InMemorySaver`로 충분하지만, 프로세스가 내려가면 메모리도 함께 사라진다.

운영 환경이라면 최소한 SQLite나 Postgres 계열 saver를 검토하는 편이 맞다.

### 6-2. drain이 현재 node를 즉시 취소한다고 생각한다

이건 가장 흔한 오해다.  
공식 문서 기준 drain은 superstep 경계에서만 적용된다. 이미 시작한 작업을 강제로 끊지 않는다.

외부 API를 길게 기다리는 node가 있다면:

- `timeout`을 같이 둔다
- blocking I/O를 async + cancellation 가능한 구조로 감싼다
- node 내부에서 `runtime.drain_requested`를 보고 추가 작업을 줄인다

### 6-3. 재개할 때 새 입력을 다시 넣는다

graceful resume의 기본형은 같은 config로 `graph.invoke(None, config)`다.  
이미 저장된 thread 상태를 이어야 하는데 새 payload를 넣으면 의도와 다른 흐름을 만들기 쉽다.

### 6-4. drain만 걸고 종료 기한을 보장하지 않는다

`request_drain()`은 안전 정지 신호이지 hard kill이 아니다.  
공식 문서도 hard upper bound가 필요하면 graceful timeout과 task cancellation을 함께 쓰라고 안내한다.

## 마무리

LangGraph의 graceful shutdown은 "프로세스를 죽이기 전에 workflow를 어디까지 안전하게 보존할지"를 분리해서 다루게 해 준다.

- 운영 중단 신호는 `RunControl.request_drain()`
- 중간 저장 후 멈춤은 `GraphDrained`
- 재개는 같은 `thread_id`와 checkpointer로 `invoke(None, config)`

배포, autoscaling, maintenance window 같은 운영 이벤트가 있는 graph라면 `interrupt()`나 `RetryPolicy`만큼이나 중요한 패턴이다.

## 참고 자료

- [LangGraph Fault tolerance - Graceful shutdown](https://docs.langchain.com/oss/python/langgraph/fault-tolerance#graceful-shutdown)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph Runtime / RunControl Reference](https://reference.langchain.com/python/langgraph/runtime/)
- [LangGraph GraphDrained Reference](https://reference.langchain.com/python/langgraph/errors/GraphDrained)
