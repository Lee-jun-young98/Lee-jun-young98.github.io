---
title: "LangGraph checkpoint history를 filter, before, limit로 페이지네이션하기"
description: "get_state_history()에서 metadata filter와 checkpoint cursor를 조합해 긴 thread 이력을 운영 화면에 안전하게 나누어 읽는 방법"
date: 2026-08-14
tags:
  - langgraph
  - agent
  - workflow
  - observability
  - python
aliases:
  - "/blog/langgraph-checkpoint-history-pagination-filter"
---

# LangGraph checkpoint history를 filter, before, limit로 페이지네이션하기

checkpointer를 붙인 LangGraph는 각 super-step 경계마다 `StateSnapshot`을 남긴다. 짧은 예제에서는 `list(graph.get_state_history(config))`로 전부 읽어도 되지만, 오래 실행된 thread를 운영 화면이나 진단 API에서 매번 모두 불러오면 응답 크기와 메모리 사용량이 계속 커진다.

이럴 때 `get_state_history()`의 세 인자를 함께 쓰면 된다.

- `filter`: checkpoint metadata가 일치하는 항목만 조회한다.
- `limit`: 한 번에 반환할 snapshot 수를 제한한다.
- `before`: 특정 checkpoint보다 오래된 이력을 이어서 조회한다.

핵심은 offset 대신 **마지막 snapshot의 config를 다음 페이지 cursor로 쓰는 것**이다.

## 사전 준비

```bash
pip install -U langgraph
```

예제는 외부 모델 없이 실행되며, `langgraph==1.2.9`와 `langgraph-checkpoint==4.1.1`에서 확인했다.

## 실행 가능한 최소 예제

```python
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


class State(TypedDict, total=False):
    value: int


def plus_one(state: State) -> dict[str, int]:
    return {"value": state.get("value", 0) + 1}


def plus_ten(state: State) -> dict[str, int]:
    return {"value": state["value"] + 10}


builder = StateGraph(State)
builder.add_node("plus_one", plus_one)
builder.add_node("plus_ten", plus_ten)
builder.add_edge(START, "plus_one")
builder.add_edge("plus_one", "plus_ten")
builder.add_edge("plus_ten", END)

graph = builder.compile(checkpointer=InMemorySaver())

config = {
    "configurable": {"thread_id": "history-demo"},
    "metadata": {"run_kind": "study"},
}
graph.invoke({"value": 0}, config)

# 최신 checkpoint부터 2개를 읽는다.
page_1 = list(
    graph.get_state_history(
        config,
        filter={"run_kind": "study"},
        limit=2,
    )
)

for snapshot in page_1:
    print(snapshot.metadata["step"], snapshot.values, snapshot.next)

# 마지막 항목의 config가 다음 페이지 cursor다.
page_2 = list(
    graph.get_state_history(
        config,
        filter={"run_kind": "study"},
        before=page_1[-1].config,
        limit=2,
    )
)

for snapshot in page_2:
    print(snapshot.metadata["step"], snapshot.values, snapshot.next)
```

출력의 핵심 흐름은 다음과 같다.

```text
# page_1: 최신순
2 {'value': 11} ()
1 {'value': 1} ('plus_ten',)

# page_2: page_1보다 오래된 항목
0 {'value': 0} ('plus_one',)
-1 {} ('__start__',)
```

`get_state_history()`는 최신 checkpoint를 먼저 반환한다. 따라서 `page_1[-1].config`를 `before`에 넘기면 그 항목보다 오래된 snapshot부터 이어진다.

## API 응답용 cursor 만들기

클라이언트에 전체 `RunnableConfig`를 그대로 노출할 필요는 없다. root graph 기준으로는 checkpoint ID를 opaque cursor처럼 전달하고, 서버에서 다시 config 형태로 조립할 수 있다.

```python
def history_page(graph, thread_id: str, cursor: str | None, size: int = 20):
    base = {"configurable": {"thread_id": thread_id}}
    before = None

    if cursor is not None:
        before = {
            "configurable": {
                "thread_id": thread_id,
                "checkpoint_id": cursor,
            }
        }

    snapshots = list(
        graph.get_state_history(
            base,
            before=before,
            limit=size,
        )
    )

    next_cursor = None
    if len(snapshots) == size:
        next_cursor = snapshots[-1].config["configurable"]["checkpoint_id"]

    return {
        "items": [
            {
                "checkpoint_id": s.config["configurable"]["checkpoint_id"],
                "created_at": s.created_at,
                "step": s.metadata.get("step"),
                "source": s.metadata.get("source"),
                "next": list(s.next),
            }
            for s in snapshots
        ],
        "next_cursor": next_cursor,
    }
```

subgraph 이력까지 다룬다면 `checkpoint_ns`도 cursor에 포함해야 한다. checkpoint ID 하나만으로 모든 namespace를 대표한다고 가정하면 다른 subgraph의 위치를 잘못 가리킬 수 있다.

## filter는 state 검색이 아니라 metadata 검색이다

`filter={"run_kind": "study"}`는 `State.values` 안의 값을 검색하지 않는다. 실행 config의 `metadata`로 저장된 checkpoint metadata를 대상으로 checkpointer의 `list` 구현이 필터링한다.

따라서 나중에 조회할 운영 키는 실행 전에 metadata로 넣는 편이 좋다.

```python
config = {
    "configurable": {"thread_id": "customer-42"},
    "metadata": {
        "tenant_id": "acme",
        "workflow_version": "2026-08-14",
        "environment": "production",
    },
}
```

metadata에는 비밀번호, access token, 원문 사용자 입력 같은 민감정보를 넣지 않는다. 검색과 운영 식별에 필요한 작은 값만 저장한다.

## 자주 생기는 함정

### history 전체를 list로 만든 뒤 자르기

```python
# 긴 thread에서는 비효율적이다.
page = list(graph.get_state_history(config))[:20]
```

반드시 `limit=20`을 checkpointer 조회에 전달해야 저장소에서부터 반환량을 줄일 수 있다.

### 정렬 방향을 반대로 이해하기

반환 순서는 최신순이다. 화면에서 오래된 순서로 보여 주고 싶다면 한 페이지를 받은 뒤 UI 계층에서만 뒤집는다. cursor 계산은 원래 최신순 목록의 마지막 항목을 기준으로 유지한다.

### 잘못된 cursor를 다른 thread에 재사용하기

`before`에는 cursor가 속한 `thread_id`와 checkpoint 식별 정보가 함께 들어가야 한다. API에서는 cursor에 thread ID를 서명하거나, 요청 thread와 cursor 소유 thread가 일치하는지 서버에서 검증하는 편이 안전하다.

### InMemorySaver를 운영 저장소처럼 사용하기

`InMemorySaver`는 학습과 테스트용이다. 재시작 뒤에도 이력이 필요하면 Postgres 같은 durable checkpointer를 사용하고, 해당 saver의 metadata filter 지원 범위와 인덱스를 확인한다.

### sync와 async API를 섞기

async 애플리케이션에서는 `aget_state_history()`를 사용한다.

```python
items = [
    snapshot
    async for snapshot in graph.aget_state_history(
        config,
        before=cursor_config,
        limit=20,
    )
]
```

## 정리

- `get_state_history()`는 최신 checkpoint부터 반환한다.
- 첫 페이지는 `limit`, 다음 페이지는 `before=마지막_snapshot.config`를 함께 쓴다.
- `filter`는 state 본문이 아니라 checkpoint metadata를 대상으로 한다.
- subgraph cursor에는 `checkpoint_ns`까지 보존한다.
- 운영 API에서는 state 전체보다 checkpoint ID, step, source, next 같은 필요한 필드만 반환한다.

## 참고 자료

- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [get_state_history Python API reference](https://reference.langchain.com/python/langgraph/pregel/protocol/PregelProtocol/get_state_history)
- [LangGraph Time Travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)
