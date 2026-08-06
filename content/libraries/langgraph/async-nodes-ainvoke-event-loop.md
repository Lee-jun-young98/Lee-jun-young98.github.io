---
title: LangGraph async 노드와 ainvoke로 I/O 병렬 처리하기
description: async def 노드와 ainvoke, astream을 사용해 I/O 대기를 겹치고 이벤트 루프를 막지 않는 LangGraph 실행 패턴
date: 2026-08-06
tags:
  - langgraph
  - workflow
  - python
  - async
  - performance
aliases:
  - /blog/langgraph-async-nodes-ainvoke-event-loop
---

# LangGraph async 노드와 ainvoke로 I/O 병렬 처리하기

LangGraph 노드는 동기 함수와 비동기 함수를 모두 받을 수 있습니다. HTTP 요청, 모델 호출, 데이터베이스 조회처럼 대기 시간이 큰 작업은 `async def` 노드에서 비동기 클라이언트를 `await`하고, 그래프도 `ainvoke()` 또는 `astream()`으로 실행하면 같은 super-step의 독립 노드들이 대기 시간을 겹쳐 처리할 수 있습니다.

중요한 점은 함수 선언만 `async def`로 바꾸는 것이 아닙니다. 노드 안에서 `time.sleep()`이나 동기 HTTP 클라이언트를 호출하면 이벤트 루프가 그대로 멈춥니다. 끝까지 비동기 I/O를 사용해야 동시성 이점이 생깁니다.

## 사전 준비

Python 3.10 이상과 LangGraph가 필요합니다. async context 전파와 streaming 호환성을 단순하게 유지하려면 Python 3.11 이상을 권장합니다.

```bash
pip install -U langgraph
```

## 실행 가능한 병렬 I/O 예제

아래 그래프는 `START`에서 두 async 노드를 동시에 실행합니다. 각 노드는 0.2초짜리 I/O를 흉내 내지만 전체 실행 시간은 약 0.2초입니다. 두 노드가 같은 state key에 쓰므로 `operator.add` reducer도 선언합니다.

```python
import asyncio
import operator
import time
from typing import Annotated

from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    query: str
    results: Annotated[list[str], operator.add]


async def search_catalog(state: State):
    await asyncio.sleep(0.2)  # 비동기 HTTP 요청을 흉내 낸다.
    return {"results": [f"catalog:{state['query']}"]}


async def search_inventory(state: State):
    await asyncio.sleep(0.2)  # 비동기 DB 조회를 흉내 낸다.
    return {"results": [f"inventory:{state['query']}"]}


builder = StateGraph(State)
builder.add_node("catalog", search_catalog)
builder.add_node("inventory", search_inventory)
builder.add_edge(START, "catalog")
builder.add_edge(START, "inventory")
builder.add_edge("catalog", END)
builder.add_edge("inventory", END)
graph = builder.compile()


async def main():
    started = time.perf_counter()
    result = await graph.ainvoke({"query": "keyboard", "results": []})
    elapsed = time.perf_counter() - started

    print(result["results"])
    print(f"elapsed={elapsed:.2f}s")
    assert sorted(result["results"]) == [
        "catalog:keyboard",
        "inventory:keyboard",
    ]
    assert elapsed < 0.35


asyncio.run(main())
```

실제 머신과 CI 부하에 따라 시간은 흔들릴 수 있으므로, 운영 테스트에서는 `elapsed < 0.35` 같은 촘촘한 시간 단언보다 결과와 호출 횟수를 먼저 검증하는 편이 안전합니다.

## ainvoke와 astream 고르기

최종 state만 필요하면 `await graph.ainvoke(input)`를 사용합니다. 노드 완료나 사용자 정의 진행 상황을 실행 중에 소비하려면 async iterator인 `astream()`을 사용합니다.

```python
async for part in graph.astream(
    {"query": "keyboard", "results": []},
    stream_mode="updates",
    version="v2",
):
    print(part["type"], part["data"])
```

현재 v2 stream 형식에서는 각 항목이 `type`, `ns`, `data`를 가진 `StreamPart`입니다. `stream_mode="updates"`이면 각 병렬 노드의 update가 완료되는 순서대로 도착할 수 있으므로, 출력 순서를 비즈니스 규칙으로 사용하면 안 됩니다.

## 동기 라이브러리를 섞어야 할 때

동기 함수가 짧고 CPU를 거의 쓰지 않으면 일반 `def` 노드로 분리할 수 있습니다. 하지만 async 노드 안에서 오래 걸리는 동기 함수를 직접 호출하면 안 됩니다. 교체할 비동기 API가 없다면 `asyncio.to_thread()`로 이벤트 루프 밖에 보내는 방법을 고려합니다.

```python
import asyncio


def blocking_sdk_call(query: str) -> str:
    # 동기 전용 외부 SDK 호출
    return query.upper()


async def call_legacy_sdk(state: State):
    value = await asyncio.to_thread(blocking_sdk_call, state["query"])
    return {"results": [value]}
```

`to_thread()`는 I/O 중심 동기 API를 감싸는 임시 다리입니다. 순수 Python CPU 연산은 GIL 때문에 충분히 빨라지지 않을 수 있으므로 process pool이나 별도 worker를 검토해야 합니다.

## 운영에서 자주 놓치는 함정

- `async def` 안에서 `time.sleep()`, `requests`, 동기 DB 드라이버를 호출하면 이벤트 루프가 막힙니다. 각각 `asyncio.sleep()`, async HTTP client, async DB driver로 바꿉니다.
- `graph.invoke()`에서 async-only 노드를 실행하지 않습니다. async 노드가 하나라도 있으면 호출 경로도 `await graph.ainvoke()` 또는 `async for ... in graph.astream()`으로 통일합니다.
- 병렬 노드가 같은 state key를 갱신하면 reducer가 필요합니다. reducer 없이 동시에 쓰면 update 충돌이 발생합니다.
- 비동기 실행에서 영속화가 필요하면 `AsyncSqliteSaver`, `AsyncPostgresSaver`처럼 async 메서드를 제공하는 checkpointer를 선택하고 수명 주기를 `async with`로 관리합니다.
- 취소는 이미 외부 시스템에 전달된 부작용을 되돌리지 않습니다. 결제·메일·쓰기 API에는 idempotency key와 재시도 정책을 별도로 둡니다.
- Python 3.11 미만에서는 async callback context가 자동 전파되지 않는 경우가 있습니다. 하위 모델의 `ainvoke()`에 `config`를 명시적으로 넘기고, 가능하면 3.11 이상으로 올립니다.

## 언제 async가 실제로 유리한가

async는 네트워크와 저장소 I/O 대기가 많은 그래프에서 특히 유리합니다. 반대로 노드가 대부분 CPU 연산이거나, 그래프의 edge 때문에 항상 한 노드씩 순차 실행된다면 `ainvoke()`로 바꾸는 것만으로 처리량이 커지지 않습니다. 먼저 그래프에서 같은 super-step에 놓인 독립 작업과 실제 I/O 대기 구간을 확인해야 합니다.

## 참고 자료

- [LangGraph Graph API: Async](https://docs.langchain.com/oss/python/langgraph/use-graph-api#async)
- [LangGraph Streaming](https://docs.langchain.com/oss/python/langgraph/streaming)
- [LangGraph `ainvoke` API reference](https://reference.langchain.com/python/langgraph/pregel/main/Pregel/ainvoke)
- [LangGraph Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
