---
title: LangGraph StateSnapshot.tasks로 실패 노드 진단하기
description: 실패한 thread의 checkpoint에서 task 이름, error, interrupt, next를 읽어 재시도 전에 원인을 분류하는 실전 패턴
date: 2026-08-02
tags:
  - langgraph
  - workflow
  - python
  - observability
  - reliability
aliases:
  - /blog/langgraph-state-snapshot-tasks-failure-diagnostics
---

# LangGraph StateSnapshot.tasks로 실패 노드 진단하기

그래프 실행이 예외로 끝났을 때 애플리케이션 로그만 보면 “어느 thread의 어느 node가 멈췄는가”를 다시 조합해야 합니다. checkpointer를 붙였다면 `graph.get_state(config)`가 반환하는 `StateSnapshot`에서 마지막 checkpoint와 task 상태를 바로 읽을 수 있습니다.

핵심 필드는 다음과 같습니다.

- `values`: checkpoint까지 확정된 state
- `next`: 다음에 실행할 node. 완료되면 빈 tuple
- `tasks`: 현재 super-step의 task 목록. 각 task에는 `name`, `error`, `interrupts` 등이 들어감
- `metadata`: checkpoint 출처와 step, node write 정보
- `config`: `thread_id`, `checkpoint_id`, `checkpoint_ns`

## 사전 준비

Python 3.10 이상과 LangGraph가 필요합니다.

```bash
pip install -U langgraph
```

운영에서는 `InMemorySaver` 대신 SQLite나 Postgres checkpointer를 사용해야 프로세스가 재시작되어도 진단 정보를 보존할 수 있습니다.

## 실행 가능한 최소 예제

아래 그래프는 `prepare` 결과를 checkpoint에 저장한 뒤 `charge` node에서 의도적으로 실패합니다.

```python
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    order_id: str
    prepared: bool
    receipt: str


def prepare(state: State):
    return {"prepared": True}


def charge(state: State):
    raise RuntimeError(f"payment gateway timeout: {state['order_id']}")


builder = StateGraph(State)
builder.add_node("prepare", prepare)
builder.add_node("charge", charge)
builder.add_edge(START, "prepare")
builder.add_edge("prepare", "charge")
builder.add_edge("charge", END)

graph = builder.compile(checkpointer=InMemorySaver())
config = {"configurable": {"thread_id": "order-42"}}

try:
    graph.invoke({"order_id": "A-42"}, config)
except RuntimeError:
    snapshot = graph.get_state(config)

    print("values:", snapshot.values)
    print("next:", snapshot.next)
    print("checkpoint_id:", snapshot.config["configurable"]["checkpoint_id"])

    for task in snapshot.tasks:
        print(
            {
                "node": task.name,
                "error": task.error,
                "interrupts": task.interrupts,
            }
        )
```

출력에서 `values`에는 성공한 `prepare`의 결과가 남고, `next`에는 아직 완료되지 않은 `charge`가 보입니다. `tasks`의 `charge` task에는 예외 정보가 기록됩니다. 이 정보로 thread와 checkpoint를 장애 알림에 연결할 수 있습니다.

## 실패와 interrupt를 구분하기

둘 다 실행이 멈춘 것처럼 보이지만 처리 방식은 다릅니다.

```python
failed = [task for task in snapshot.tasks if task.error]
paused = [task for task in snapshot.tasks if task.interrupts]

if failed:
    print("오류 복구 또는 재시도 검토")
elif paused:
    print("사용자 입력이나 승인을 기다리는 정상 중단")
elif not snapshot.next:
    print("실행 완료")
```

`interrupt()`는 승인 대기 같은 정상적인 pause이므로 error alert로 분류하면 안 됩니다. 반대로 `task.error`가 있으면 예외 유형과 node 이름을 기준으로 재시도 가능 오류인지 먼저 판단해야 합니다.

## 이력에서 실패 지점 찾기

`get_state()`는 최신 snapshot 하나만 반환합니다. 여러 checkpoint를 비교하려면 최신순으로 반환되는 `get_state_history()`를 사용합니다.

```python
history = list(graph.get_state_history(config))

for snapshot in history:
    errors = [task for task in snapshot.tasks if task.error]
    if errors:
        print(snapshot.metadata["step"], errors[0].name, errors[0].error)
```

운영 도구에는 전체 `values` 대신 `thread_id`, `checkpoint_id`, `metadata.step`, task 이름과 정제한 error만 남기는 편이 안전합니다. state에 사용자 입력이나 비밀값이 포함될 수 있기 때문입니다.

## 흔한 실수

- checkpointer 없이 `get_state()`로 과거 실행을 진단하려고 한다. snapshot 조회에는 persistence가 필요합니다.
- 예외 메시지 전체를 외부 알림에 그대로 보낸다. 토큰, 개인정보, provider 응답이 섞일 수 있으므로 마스킹해야 합니다.
- `next`만 보고 실패로 단정한다. interrupt로 정상 대기 중일 수 있으므로 `tasks[*].error`와 `interrupts`를 함께 봐야 합니다.
- `InMemorySaver`를 운영 저장소로 쓴다. 프로세스 종료와 함께 기록이 사라집니다.
- checkpoint에서 바로 replay한다. 이후 node의 결제·메일·외부 API 호출은 다시 실행될 수 있으므로 멱등성을 먼저 확인해야 합니다.

## 정리

`StateSnapshot.tasks`는 실패한 실행을 node 단위로 좁히는 가장 가까운 진단 정보입니다. `values`, `next`, `metadata`, checkpoint 식별자와 함께 읽으면 “어디까지 확정됐고, 무엇이 실패했으며, 재개해도 안전한가”를 판단할 수 있습니다.

## 참고 자료

- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph Time travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)
