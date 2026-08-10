---
title: LangGraph tasks와 checkpoints 스트림으로 실행 중 노드 진단하기
description: tasks, checkpoints, debug 스트림을 구분해 노드 생명주기와 super-step 상태를 실시간으로 관찰하는 방법
date: 2026-08-10
tags:
  - langgraph
  - workflow
  - python
  - streaming
  - observability
aliases:
  - /blog/langgraph-task-checkpoint-debug-streaming
---

# LangGraph tasks와 checkpoints 스트림으로 실행 중 노드 진단하기

완료된 실행을 `get_state()`로 조사하기 전에, 실행 중인 노드와 checkpoint 경계를 실시간으로 보고 싶을 때가 있습니다. LangGraph의 `tasks`, `checkpoints`, `debug` stream mode는 이 목적에 맞지만 관찰하는 단위가 서로 다릅니다.

- `tasks`: 각 node task의 시작과 종료, 결과, 오류를 보여 줍니다.
- `checkpoints`: super-step 경계에서 저장된 전체 state와 다음 실행 대상을 보여 줍니다.
- `debug`: task와 checkpoint 정보를 합쳐 가장 상세하게 보여 줍니다.

운영 progress와 latency 측정에는 `tasks`, 재개 지점과 state 전이를 추적할 때는 `checkpoints`, 로컬 문제 재현에는 `debug`가 잘 맞습니다.

## 사전 준비

Python 3.10 이상과 LangGraph 1.1 이상을 사용합니다. `tasks`와 `checkpoints` mode는 checkpointer가 필요합니다.

```bash
pip install -U "langgraph>=1.1"
```

아래 예제는 외부 모델이나 API key 없이 실행할 수 있습니다. `InMemorySaver`는 테스트용이며, 프로세스를 다시 시작해도 기록을 남겨야 하는 운영 환경에서는 SQLite나 Postgres checkpointer를 사용해야 합니다.

## 실행 가능한 예제

```python
from time import monotonic
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


class OrderState(TypedDict, total=False):
    order_id: str
    normalized: str
    label: str


def normalize(state: OrderState):
    return {"normalized": state["order_id"].strip().upper()}


def make_label(state: OrderState):
    return {"label": f"SHIP-{state['normalized']}"}


builder = StateGraph(OrderState)
builder.add_node("normalize", normalize)
builder.add_node("make_label", make_label)
builder.add_edge(START, "normalize")
builder.add_edge("normalize", "make_label")
builder.add_edge("make_label", END)
graph = builder.compile(checkpointer=InMemorySaver())

config = {"configurable": {"thread_id": "order-42"}}
started_at: dict[str, float] = {}

for part in graph.stream(
    {"order_id": " 42 "},
    config,
    stream_mode=["tasks", "checkpoints"],
    version="v2",
):
    data = part["data"]

    if part["type"] == "tasks":
        task_id = data["id"]
        if "input" in data:  # task 시작 이벤트
            started_at[task_id] = monotonic()
            print(f"START {data['name']}")
        else:  # task 종료 이벤트
            elapsed = monotonic() - started_at.pop(task_id)
            status = "ERROR" if data.get("error") else "DONE"
            print(f"{status} {data['name']} {elapsed:.3f}s")

    elif part["type"] == "checkpoints":
        step = data["metadata"]["step"]
        print(f"CHECKPOINT step={step} next={data['next']}")
```

출력 순서는 다음과 비슷합니다. checkpoint ID와 시간은 실행마다 달라집니다.

```text
CHECKPOINT step=-1 next=['__start__']
CHECKPOINT step=0 next=['normalize']
START normalize
DONE normalize 0.001s
CHECKPOINT step=1 next=['make_label']
START make_label
DONE make_label 0.001s
CHECKPOINT step=2 next=[]
```

`tasks` 이벤트는 같은 `id`로 시작과 종료를 연결할 수 있습니다. 시작 payload에는 `input`과 `triggers`가 있고, 종료 payload에는 `result`, `error`, `interrupts`가 있습니다. 따라서 task ID를 key로 시작 시각을 저장하면 node별 경과 시간을 계산할 수 있습니다.

## checkpoint는 node 완료 이벤트가 아니다

checkpoint는 node 하나가 끝날 때마다 무조건 생기는 로그가 아니라 **super-step 경계의 상태 스냅샷**입니다. 병렬 node 여러 개가 같은 super-step에서 실행되면 각각의 시작·종료는 `tasks`로 보이지만, 모두의 write가 합쳐진 뒤 다음 checkpoint가 만들어집니다.

주요 필드는 다음처럼 읽습니다.

- `values`: 해당 경계에서 저장된 전체 graph state
- `next`: 다음 super-step에 실행할 node 이름 목록
- `tasks`: 그 경계에서 예정됐거나 실패·중단된 task 정보
- `metadata.step`: 입력 checkpoint는 보통 `-1`, 첫 실행 경계는 `0`부터 증가
- `config.configurable.checkpoint_id`: replay나 fork에 사용할 수 있는 checkpoint 식별자

node 결과 delta만 필요하다면 `updates`가 더 가볍습니다. `checkpoints`는 전체 state를 포함할 수 있으므로 큰 message history나 민감정보를 매번 로그에 복사하지 않는 편이 좋습니다.

## 실패를 실시간으로 분기하기

종료 task payload의 `error`는 성공 시 `None`이고 실패 시 오류 문자열을 담습니다. 예외를 다시 던지는 graph라도 오류 task event는 먼저 소비할 수 있습니다.

```python
try:
    for part in graph.stream(
        {"order_id": "bad"},
        config,
        stream_mode="tasks",
        version="v2",
    ):
        if part["type"] != "tasks":
            continue
        data = part["data"]
        if data.get("error"):
            report_node_failure(
                thread_id=config["configurable"]["thread_id"],
                task_id=data["id"],
                node=data["name"],
                error=data["error"],
            )
except Exception:
    mark_run_failed()
    raise
```

오류 문자열에는 내부 정보가 섞일 수 있으므로 사용자 화면에 그대로 노출하지 말고, 내부 로그에서도 secret과 개인정보를 마스킹해야 합니다. 재시도가 설정된 node는 같은 업무가 여러 번 실행될 수 있으므로 task event를 과금이나 외부 부작용의 유일한 원장으로 쓰면 안 됩니다.

## `debug`는 언제 쓸까

```python
for part in graph.stream(
    {"order_id": "42"},
    config,
    stream_mode="debug",
    version="v2",
):
    if part["type"] == "debug":
        print(part["data"])
```

`debug`는 checkpoint와 task를 포함한 상세 metadata를 한꺼번에 내보내므로 문제 재현에는 편하지만 payload가 큽니다. 운영 대시보드에 필요한 것이 node 생명주기뿐이라면 `tasks`, 저장 경계뿐이라면 `checkpoints`를 직접 고르는 편이 비용과 노출 범위를 줄입니다.

## 자주 놓치는 점

- checkpointer 없이 `tasks`나 `checkpoints`를 요청합니다. graph를 checkpointer와 함께 compile하고 `thread_id`도 전달해야 합니다.
- v1 tuple 예제를 v2 소비 코드에 섞습니다. `version="v2"`에서는 항상 `type`, `ns`, `data` envelope로 분기합니다.
- 시작과 종료를 node 이름만으로 연결합니다. 같은 node가 병렬 또는 반복 실행될 수 있으므로 `data["id"]`를 correlation key로 사용합니다.
- 모든 `tasks` payload에 `input`이나 `result`가 있다고 가정합니다. 시작·성공·실패·interrupt 상태에 따라 존재하는 key가 다릅니다.
- `checkpoints.values` 전체를 영구 로그에 남깁니다. state가 커질수록 로그 비용과 개인정보 노출이 함께 증가합니다.
- `debug`를 기본 운영 stream으로 고정합니다. 필요한 관찰 단위만 선택하고 상세 debug는 제한된 환경에서 켜는 것이 안전합니다.

## 정리

실행 중 node progress와 오류를 보고 싶다면 `tasks`, 저장된 state 전이와 재개 경계를 보고 싶다면 `checkpoints`, 모든 실행 정보를 한 번에 조사해야 할 때만 `debug`를 사용합니다. v2 envelope와 task ID 상관관계를 기준으로 소비 코드를 만들면 병렬·반복 실행에서도 이벤트를 안정적으로 묶을 수 있습니다.

## 참고 자료

- [LangGraph Streaming](https://docs.langchain.com/oss/python/langgraph/streaming)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph TasksStreamPart reference](https://reference.langchain.com/python/langgraph/types/TasksStreamPart)
- [LangGraph CheckpointStreamPart reference](https://reference.langchain.com/python/langgraph/types/CheckpointStreamPart)
