---
title: LangGraph checkpoint를 thread 단위로 보존하고 삭제하기
description: checkpointer의 delete_thread로 완료된 thread의 checkpoint와 pending write를 함께 정리하고 안전한 보존 정책을 설계하는 방법
date: 2026-08-04
tags:
  - langgraph
  - workflow
  - python
  - persistence
  - operations
aliases:
  - /blog/langgraph-checkpoint-thread-retention-delete
---

# LangGraph checkpoint를 thread 단위로 보존하고 삭제하기

LangGraph checkpointer는 실행 상태를 자동으로 남기지만, 로컬 checkpointer API가 checkpoint마다 TTL을 자동 적용해 주는 것은 아닙니다. 오래된 실행을 정리하려면 애플리케이션이 보존 정책을 정하고 `delete_thread(thread_id)`를 호출해야 합니다.

삭제 단위가 **개별 checkpoint가 아니라 thread 전체**라는 점이 핵심입니다. 한 thread를 지우면 그 thread의 checkpoint history와 실행 중 저장된 pending write도 함께 없어져 더는 재개하거나 time travel할 수 없습니다.

## 사전 준비

Python 3.10 이상과 LangGraph가 필요합니다.

```bash
pip install -U langgraph
```

아래 예제는 동작을 빠르게 확인하려고 `InMemorySaver`를 사용합니다. 프로세스를 다시 시작해도 데이터를 유지해야 하는 운영 환경에서는 SQLite 또는 Postgres checkpointer를 사용합니다.

## 실행 가능한 최소 예제

LLM 없이 두 번 실행한 thread의 checkpoint 수를 세고, thread를 삭제한 뒤 비어 있는지 확인합니다.

```python
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    count: int


def increment(state: State):
    return {"count": state["count"] + 1}


builder = StateGraph(State)
builder.add_node("increment", increment)
builder.add_edge(START, "increment")
builder.add_edge("increment", END)

checkpointer = InMemorySaver()
graph = builder.compile(checkpointer=checkpointer)
config = {"configurable": {"thread_id": "demo-user-42"}}

graph.invoke({"count": 0}, config)
graph.invoke({"count": 10}, config)

before = list(checkpointer.list(config))
print("before:", len(before), graph.get_state(config).values)

checkpointer.delete_thread("demo-user-42")

after = list(checkpointer.list(config))
print("after:", len(after), graph.get_state(config).values)

assert before
assert after == []
assert graph.get_state(config).values == {}
```

출력에서 `before`의 checkpoint 개수는 0보다 크고 최신 state는 `{'count': 11}`입니다. 삭제 뒤에는 checkpoint 목록과 최신 state가 모두 비어 있습니다.

`graph.get_state()`는 조회용 graph API지만 삭제는 checkpointer API입니다. `graph` 객체에서 `delete_thread()`를 찾지 말고, compile할 때 넘긴 checkpointer를 보관해 관리 작업에서 사용합니다.

## SQLite와 Postgres에서 삭제하기

동기 checkpointer는 같은 메서드 계약을 사용합니다.

```python
from langgraph.checkpoint.postgres import PostgresSaver

DB_URI = "postgresql://postgres:postgres@localhost:5432/postgres"

with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()
    checkpointer.delete_thread("completed-order-2026-001")
```

비동기 서버에서는 event loop를 막지 않도록 `adelete_thread()`를 호출합니다.

```python
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver


async def delete_completed_thread(db_uri: str, thread_id: str) -> None:
    async with AsyncPostgresSaver.from_conn_string(db_uri) as checkpointer:
        await checkpointer.setup()
        await checkpointer.adelete_thread(thread_id)
```

SQLite의 `SqliteSaver`와 `AsyncSqliteSaver`도 각각 `delete_thread()`와 `adelete_thread()` 계약을 따릅니다. 테이블을 직접 지우기보다 이 API를 써야 checkpoint와 연관 write를 구현체가 일관되게 정리할 수 있습니다.

## 보존 정책은 애플리케이션 메타데이터로 관리하기

checkpointer의 `list()`는 이미 알고 있는 thread의 checkpoint를 조회하는 데 적합하지만, 전체 서비스의 만료 후보를 찾는 검색 인덱스는 아닙니다. 운영에서는 별도 thread registry에 다음 정보를 둡니다.

- `thread_id`
- 업무 상태: `active`, `interrupted`, `completed`, `failed`
- 마지막 활동 시각과 완료 시각
- 법적 보존 또는 사용자 삭제 요청 여부
- 삭제 작업의 상태와 감사 로그

예를 들어 완료 후 30일이 지난 thread만 registry에서 골라 삭제하고, 성공한 ID를 다시 기록합니다. `interrupted`와 `busy` 상태는 재개 가능성을 잃을 수 있으므로 기본 삭제 대상에서 제외합니다.

```python
def purge_expired_threads(checkpointer, registry, cutoff):
    for thread in registry.find_expired_completed(cutoff=cutoff):
        checkpointer.delete_thread(thread.thread_id)
        registry.mark_checkpoint_deleted(thread.thread_id)
```

후보 조회와 삭제 사이에 실행이 다시 시작될 수 있으므로, 실제 시스템에서는 registry row lock, 상태 전이, lease 같은 동시성 제어가 필요합니다. 삭제 작업 자체도 재시도될 수 있게 같은 `thread_id`를 다시 삭제해도 성공으로 취급하는 방식이 편합니다.

## 자주 하는 실수

- `delete_thread()`를 checkpoint 하나만 지우는 API로 생각한다. 해당 thread의 전체 실행 이력과 pending write가 대상입니다.
- TTL 옵션이 checkpointer에 있다고 가정한다. node cache의 `CachePolicy(ttl=...)`는 checkpoint 보존 기간이 아니며 서로 다른 기능입니다.
- 실행 중이거나 interrupt에서 대기 중인 thread를 지운다. 이후 `Command(resume=...)`나 `invoke(None, config)`로 복구할 기준점이 사라집니다.
- 데이터베이스 테이블을 직접 `DELETE`한다. checkpoint, blob, write 사이의 관계를 빠뜨리면 고아 데이터나 불완전한 thread가 남을 수 있습니다.
- checkpointer만 지우고 cross-thread 장기 메모리인 store도 지워졌다고 생각한다. checkpointer와 store는 수명 주기가 별도이므로 사용자 삭제 정책에서 각각 처리해야 합니다.
- `thread_id`에 이메일 같은 개인정보를 그대로 넣는다. 삭제 후에도 로그와 trace에 ID가 남을 수 있으므로 불투명한 식별자를 사용합니다.

## 정리

LangGraph checkpoint 정리는 `delete_thread(thread_id)`를 중심으로 설계합니다. 자동 TTL을 기대하기보다 애플리케이션 registry에서 완료 상태와 마지막 활동 시각을 관리하고, 재개할 수 없는 thread만 골라 삭제해야 합니다. 삭제 전에 실행 상태를 잠그고, 삭제 뒤에는 registry와 감사 기록을 갱신하면 보존 비용과 복구 가능성을 함께 관리할 수 있습니다.

## 참고 자료

- [LangGraph memory: manage checkpoints](https://docs.langchain.com/oss/python/langgraph/add-memory#manage-checkpoints)
- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [BaseCheckpointSaver.delete_thread API](https://reference.langchain.com/python/langgraph.checkpoint/base/BaseCheckpointSaver/delete_thread)
- [LangGraph checkpointing API reference](https://reference.langchain.com/python/langgraph/checkpoints)
