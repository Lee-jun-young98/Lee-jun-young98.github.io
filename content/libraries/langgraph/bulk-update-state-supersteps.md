---
title: "LangGraph bulk_update_state()로 여러 superstep checkpoint를 한 번에 심기"
description: "LangGraph checkpointer와 bulk_update_state()를 이용해 여러 checkpoint를 한 번에 만들고, 테스트 fixture나 상태 backfill 뒤 이어서 실행하는 실전 패턴 정리"
date: 2026-07-13
tags:
  - langgraph
  - workflow
  - python
  - testing
aliases:
  - /blog/langgraph-bulk-update-state-supersteps
---

# LangGraph bulk_update_state()로 여러 superstep checkpoint를 한 번에 심기

LangGraph를 운영하거나 테스트하다 보면 `update_state()` 한 번으로는 부족한 순간이 있다.

- 비싼 앞단 node를 다시 돌리지 않고 "중간까지 진행된 thread"를 여러 단계로 만들어 두고 싶을 때
- migration이나 backfill 과정에서 checkpoint 이력을 한 단계씩 심어 넣고 싶을 때
- replay, time travel, partial execution 테스트용 fixture를 코드로 만들고 싶을 때

이럴 때 볼 API가 `graph.bulk_update_state()`다.  
공식 reference 기준으로 이 메서드는 graph state에 update를 bulk로 적용하고, checkpointer가 반드시 있어야 한다.

핵심은 이름보다 `supersteps` 인자 구조다.

- 바깥 list: checkpoint를 몇 단계 만들지
- 안쪽 list: 해당 superstep에서 적용할 state update들
- 각 update: `(values, as_node, task_id)` 형태

즉 `update_state()`가 "checkpoint 하나 추가"라면, `bulk_update_state()`는 "checkpoint 여러 개를 순서대로 추가"에 가깝다.

## 언제 유용한가

`bulk_update_state()`는 특히 아래 상황에서 실전성이 있다.

- 긴 workflow 앞단을 건너뛴 테스트 fixture 만들기
- production thread를 복구하기 전 여러 중간 checkpoint를 재구성하기
- `get_state_history()` 기반 replay/debug 예제를 코드로 고정하기
- manual patch를 여러 단계로 쪼개서 명시적으로 남기기

반대로 checkpoint 하나만 고치고 바로 재개하면 되는 경우는 `update_state()`가 더 단순하다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langgraph
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langgraph
```

`bulk_update_state()`는 checkpointer가 없으면 바로 `ValueError`를 낸다. 로컬 예제는 `InMemorySaver`로 충분하다.

## 먼저 이해할 점 네 가지

공식 reference와 로컬 검증 기준으로 먼저 기억할 점은 아래 네 가지다.

1. `bulk_update_state()`는 여러 checkpoint를 순서대로 만든다.
2. 반환값은 state 자체가 아니라 최신 checkpoint를 가리키는 새 `config`다.
3. reducer가 있는 channel은 일반 node write처럼 reducer 규칙을 그대로 탄다.
4. `supersteps`의 각 update는 실전에서는 `(values, as_node, None)`처럼 3-튜플로 주는 편이 안전하다.

네 번째는 문서에 `task_id`가 optional이라고 적혀 있지만, 2026년 7월 13일 기준 `langgraph==1.2.9` 로컬 실행에서는 2-튜플 대신 3-튜플이 바로 통과했다. 그래서 글의 예제도 `None`을 명시한다.

## 예제 1. 중간 checkpoint 하나를 심고 그 지점부터 이어서 실행하기

가장 실용적인 시작점은 "앞단 node 결과만 저장한 뒤 뒤쪽 node부터 계속 실행"하는 패턴이다.

```python
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


class DraftState(TypedDict):
    topic: str
    draft: str
    status: str


def choose_topic(state: DraftState):
    return {"topic": "환불 요청", "status": "topic_ready"}


def write_draft(state: DraftState):
    return {
        "draft": f"{state['topic']} 안내 초안",
        "status": "draft_ready",
    }


graph = (
    StateGraph(DraftState)
    .add_node("choose_topic", choose_topic)
    .add_node("write_draft", write_draft)
    .add_edge(START, "choose_topic")
    .add_edge("choose_topic", "write_draft")
    .add_edge("write_draft", END)
    .compile(checkpointer=InMemorySaver())
)

base_config = {"configurable": {"thread_id": "bulk-demo-1"}}

patched_config = graph.bulk_update_state(
    base_config,
    [
        [
            (
                {
                    "topic": "배송 지연",
                    "status": "topic_ready",
                },
                "choose_topic",
                None,
            )
        ]
    ],
)

print(graph.get_state(patched_config).values)
print(graph.get_state(patched_config).next)

result = graph.invoke(None, patched_config)
print(result)
```

예상 흐름은 이렇다.

1. `choose_topic`이 이미 실행된 것처럼 checkpoint를 하나 만든다.
2. 그 checkpoint의 다음 node는 `write_draft`가 된다.
3. `graph.invoke(None, patched_config)`로 이어서 실행하면 뒤쪽 node만 돈다.

즉 비싼 retrieval, parsing, approval 이전 단계 등을 건너뛴 재현 테스트에 잘 맞는다.

## 예제 2. checkpoint 이력을 두 단계로 한 번에 만들기

이번에는 topic 선택과 draft 작성까지 완료된 thread를 코드로 직접 만든다.

```python
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


class DraftState(TypedDict):
    topic: str
    draft: str
    status: str


def choose_topic(state: DraftState):
    return {"topic": "환불 요청", "status": "topic_ready"}


def write_draft(state: DraftState):
    return {
        "draft": f"{state['topic']} 안내 초안",
        "status": "draft_ready",
    }


graph = (
    StateGraph(DraftState)
    .add_node("choose_topic", choose_topic)
    .add_node("write_draft", write_draft)
    .add_edge(START, "choose_topic")
    .add_edge("choose_topic", "write_draft")
    .add_edge("write_draft", END)
    .compile(checkpointer=InMemorySaver())
)

base_config = {"configurable": {"thread_id": "bulk-demo-2"}}

patched_config = graph.bulk_update_state(
    base_config,
    [
        [
            (
                {
                    "topic": "배송 지연",
                    "status": "topic_ready",
                },
                "choose_topic",
                None,
            )
        ],
        [
            (
                {
                    "draft": "배송 지연 안내 초안",
                    "status": "draft_ready",
                },
                "write_draft",
                None,
            )
        ],
    ],
)

for snapshot in graph.get_state_history(base_config):
    print(
        snapshot.metadata.get("step"),
        snapshot.metadata.get("source"),
        snapshot.next,
        snapshot.values,
    )
```

위 예제를 실행하면 최신 checkpoint만 생기는 것이 아니라, base thread 기준으로는 대략 아래 형태의 history를 확인할 수 있다.

```python
1 update () {'topic': '배송 지연', 'draft': '배송 지연 안내 초안', 'status': 'draft_ready'}
0 update ('write_draft',) {'topic': '배송 지연', 'status': 'topic_ready'}
```

이 구조가 중요한 이유는 명확하다.

- 단일 최종 state만 심는 게 아니라
- "어떤 단계 다음에 무엇이 실행될 예정이었는지"까지 남길 수 있고
- replay, fork, debug 예제를 더 현실적인 checkpoint history 위에서 돌릴 수 있다

## `update_state()`와 어떻게 나눠 쓰면 좋을까

둘을 아래처럼 보면 실무에서 헷갈림이 적다.

- `update_state()`: checkpoint 하나만 추가하고 싶다
- `bulk_update_state()`: checkpoint 여러 개를 순서대로 만들고 싶다

예를 들어:

- approval 이후 사람 보정값 하나만 넣는다 -> `update_state()`
- 긴 workflow의 1단계, 2단계, 3단계를 테스트 fixture로 한 번에 심는다 -> `bulk_update_state()`

`bulk_update_state()`는 사실상 `update_state()`를 여러 번 수동 호출하는 과정을 더 명시적으로 묶는 쪽에 가깝다.

## 운영과 테스트에서 자주 쓰는 패턴

### 1. expensive prefix 건너뛰기

retrieval, external API, ranking 같은 앞단 node를 다시 돌리지 않고, 필요한 checkpoint까지만 미리 만들어 후반 로직만 검증한다.

### 2. replay-safe fixture 만들기

`get_state_history()`와 `time travel` 예제를 문서나 테스트에 넣을 때, 실제 운영 trace 없이도 checkpoint history를 재현할 수 있다.

### 3. migration/backfill 스크립트

state schema가 바뀌었을 때 thread 하나를 통째로 다시 실행하는 대신, 필요한 중간 단계만 새 규칙으로 채운 checkpoint를 순서대로 쌓을 수 있다.

## 자주 틀리는 부분

### 1. checkpointer 없이 호출한다

공식 reference대로 checkpointer는 필수다. `compile()`만 하고 saver를 붙이지 않으면 `ValueError: No checkpointer set`이 난다.

### 2. node가 실제로 실행된다고 생각한다

`bulk_update_state()`는 state write를 적용해 checkpoint를 만드는 API다.  
skipped node의 외부 부작용까지 대신 실행해 주지는 않는다.

예를 들어 원래 node가 아래 작업을 했다면:

- Slack 알림 전송
- DB row insert
- 외부 결제 API 호출

`bulk_update_state()`는 그런 부작용을 재현하지 않는다. 상태만 만들어 준다.

### 3. 여러 update를 한 superstep에 과하게 몰아 넣는다

inner list에 update 여러 개를 넣을 수는 있지만, 이건 같은 superstep semantics를 직접 다루는 것이다.  
다음 node 계산이 생각보다 헷갈릴 수 있어서, 특별한 이유가 없으면 "superstep 하나당 update 하나"가 가장 안전하다.

### 4. reducer 채널을 단순 덮어쓰기라고 생각한다

`messages`, `tags`, custom reducer channel은 일반 node update처럼 merge 규칙이 적용될 수 있다.  
`bulk_update_state()`라고 해서 dict를 통째로 갈아끼우는 API로 보면 오해하기 쉽다.

### 5. 최신 checkpoint만 보고 history가 없다고 오해한다

반환된 `patched_config`는 최신 checkpoint를 가리킨다.  
여러 단계 history를 보려면 보통 base thread config로 `graph.get_state_history(base_config)`를 보는 편이 이해하기 쉽다.

## 추천 사용 순서

실전에서는 아래 순서가 가장 단순하다.

1. 어떤 중간 상태를 재현할지 먼저 정한다.
2. 각 단계가 어느 node write처럼 보여야 하는지 `as_node`를 정한다.
3. `supersteps`를 바깥 list 단위로 한 단계씩 작성한다.
4. reducer가 있는 channel인지 확인한다.
5. `bulk_update_state()` 후 `get_state()`와 `get_state_history()`로 결과를 검증한다.
6. 필요하면 최신 `patched_config`로 `invoke(None, ...)` 하여 뒤쪽 실행만 이어간다.

이렇게 쓰면 LangGraph thread를 처음부터 다시 태우지 않고도 원하는 중간 실행 상태를 꽤 정밀하게 재현할 수 있다.

## 참고 자료

- [bulk_update_state reference](https://reference.langchain.com/python/langgraph/pregel/main/Pregel/bulk_update_state)
- [update_state reference](https://reference.langchain.com/python/langgraph/pregel/main/Pregel/update_state)
- [Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers)
- [Use time-travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)
