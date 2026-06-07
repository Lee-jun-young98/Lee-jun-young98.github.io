---
title: "LangGraph time travel로 체크포인트 replay와 fork 디버깅하기"
description: "LangGraph checkpointer와 get_state_history, update_state를 사용해 이전 체크포인트에서 replay하거나 상태를 바꿔 fork하는 실전 패턴 정리"
date: 2026-06-07
tags:
  - langgraph
  - agent
  - workflow
  - python
aliases:
  - "/blog/langgraph-time-travel-replay-fork"
---

# LangGraph time travel로 체크포인트 replay와 fork 디버깅하기

LangGraph를 실무에 붙이면 금방 마주치는 요구가 있다.

- 이전 실행의 어느 단계에서 잘못됐는지 확인하고 싶다
- 마지막 LLM 호출만 다시 태워 보고 싶다
- 중간 상태를 살짝 바꿔서 "만약 여기서 다른 결정을 했다면?"을 시험하고 싶다

이럴 때 LangGraph의 `time travel`이 바로 맞는 도구다. 공식 문서 기준으로 time travel은 체크포인트를 기반으로 동작하고, 크게 두 가지를 지원한다.

- `replay`: 과거 체크포인트부터 다시 실행
- `fork`: 과거 체크포인트에서 상태를 바꿔 새 분기 생성

핵심은 "과거를 덮어쓰는 것"이 아니라 "과거 체크포인트를 기준으로 새 실행을 이어 가는 것"이다.  
그래서 디버깅, 회귀 재현, 승인 플로우 재실험에 특히 유용하다.

이 글에서는 다음만 실전 기준으로 정리한다.

- time travel을 쓰기 위한 최소 조건
- `get_state_history()`로 원하는 체크포인트 찾는 법
- replay와 fork의 차이
- `update_state(..., as_node=...)`를 언제 명시해야 하는지
- 자주 생기는 오해와 함정

## 언제 이 패턴이 필요한가

아래 상황이면 거의 바로 쓸 수 있다.

- 에이전트가 잘못된 초안이나 잘못된 검색 결과를 만든 지점을 재현하고 싶을 때
- 마지막 노드만 다시 태워 보고 싶은데 앞단의 API 호출은 다시 하고 싶지 않을 때
- 승인 workflow에서 중간 상태를 바꿔 다른 경로를 검증하고 싶을 때
- 디버깅 중 "현재 thread의 체크포인트 히스토리"를 보고 실행 흐름을 복기하고 싶을 때

특히 LangGraph 문서에서 강조하는 점은, replay와 fork 모두 "이전 체크포인트 이후 노드들은 다시 실행된다"는 것이다.  
즉 캐시 조회가 아니라 재실행이다.

## 사전 준비

time travel은 checkpointer가 있어야만 의미가 있다.  
또 실행마다 `thread_id`를 넣어야 체크포인트 히스토리가 쌓인다.

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

## 1. 가장 작은 replay / fork 예제

아래 예제는 블로그 초안을 만드는 간단한 그래프다.

- `pick_topic`: 주제를 고른다
- `write_copy`: 주제로 한 줄 소개문을 만든다

첫 실행 후 체크포인트 히스토리를 읽고:

- `replay`: `write_copy` 직전 체크포인트부터 다시 실행
- `fork`: 같은 지점에서 `topic`을 바꾼 새 분기를 만든 뒤 다시 실행

```python
from operator import add
from typing import Annotated
from uuid import uuid4

from typing_extensions import NotRequired, TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import START, StateGraph


class DraftState(TypedDict):
    request: str
    topic: NotRequired[str]
    copy: NotRequired[str]
    logs: Annotated[list[str], add]


def pick_topic(state: DraftState):
    request = state["request"].lower()
    if "stream" in request:
        topic = "streaming"
    else:
        topic = "time travel"

    return {
        "topic": topic,
        "logs": [f"pick_topic -> {topic}"],
    }


def write_copy(state: DraftState):
    topic = state["topic"]
    return {
        "copy": f"이번 글은 LangGraph {topic} 기능을 빠르게 실험하는 방법을 설명한다.",
        "logs": [f"write_copy -> {topic}"],
    }


graph = (
    StateGraph(DraftState)
    .add_node("pick_topic", pick_topic)
    .add_node("write_copy", write_copy)
    .add_edge(START, "pick_topic")
    .add_edge("pick_topic", "write_copy")
    .compile(checkpointer=InMemorySaver())
)

config = {"configurable": {"thread_id": str(uuid4())}}

first_result = graph.invoke(
    {"request": "langgraph article draft", "logs": []},
    config,
)
print("first_result =", first_result)

history = list(graph.get_state_history(config))
before_write = next(snapshot for snapshot in history if snapshot.next == ("write_copy",))

print("history order:")
for snapshot in history:
    checkpoint_id = snapshot.config["configurable"]["checkpoint_id"]
    print(snapshot.next, checkpoint_id, snapshot.metadata["source"])

# 1) Replay: 같은 체크포인트에서 다시 실행
replay_result = graph.invoke(None, before_write.config)
print("replay_result =", replay_result)

# 2) Fork: topic을 바꾼 새 체크포인트를 만든 뒤 실행
fork_config = graph.update_state(
    before_write.config,
    values={"topic": "streaming"},
    as_node="pick_topic",
)
fork_result = graph.invoke(None, fork_config)
print("fork_result =", fork_result)
```

실행 흐름은 이렇게 이해하면 된다.

1. 첫 실행에서 `pick_topic -> write_copy`가 순서대로 돈다.
2. `get_state_history(config)`로 thread의 체크포인트 목록을 읽는다.
3. `next == ("write_copy",)` 인 스냅샷을 찾으면, 바로 `write_copy` 직전 상태를 잡을 수 있다.
4. 그 체크포인트 config로 `invoke(None, ...)` 하면 replay다.
5. 같은 체크포인트에 `update_state(...)`를 적용한 뒤 `invoke(None, ...)` 하면 fork다.

## 2. replay에서 꼭 알아둘 점

공식 문서 기준으로 replay는 "이전 체크포인트 이후 노드들을 다시 실행"한다.  
즉 다음처럼 이해해야 안전하다.

- 체크포인트 이전 노드: 다시 실행되지 않음
- 체크포인트 이후 노드: 다시 실행됨
- LLM 호출, 외부 API 호출, `interrupt()`: 다시 발생할 수 있음

그래서 replay는 "같은 결과를 보장하는 복원"이라기보다 "같은 지점부터 재실행"에 가깝다.

예를 들어 마지막 노드가 LLM 호출이면 replay 결과가 원본과 달라질 수 있다.  
디버깅 관점에서는 오히려 이 점이 중요하다.

## 3. fork는 rollback이 아니라 새 분기다

`update_state()`를 처음 쓰면 "기존 thread 상태를 덮어쓴다"라고 오해하기 쉽다.  
하지만 LangGraph 문서 기준으로 `update_state()`는 기존 체크포인트를 수정하지 않고, 새 체크포인트를 만든다.

즉 fork 이후에도 원래 히스토리는 그대로 남는다.

```python
history = list(graph.get_state_history(config))
forks = [s for s in history if s.metadata["source"] == "update"]

print("fork checkpoints =", len(forks))
for snapshot in forks:
    print(snapshot.values)
```

이 패턴이 실무에서 좋은 이유는 다음과 같다.

- 원본 실행을 보존한 채 실험 가능
- 잘못된 상태를 "되돌리기"보다 "대안 분기"로 비교 가능
- 장애 분석 중 원본 audit trail을 망가뜨리지 않음

## 4. `as_node`는 왜 중요할까

`update_state()`는 "이 상태 업데이트를 어떤 노드가 만든 것으로 볼지"도 함께 다룬다.  
이 정보가 다음 실행 노드를 정하는 데 쓰인다.

그래서 공식 문서에서는 아래 경우 `as_node`를 명시하라고 안내한다.

- 병렬 브랜치가 있어서 마지막 상태 작성 노드를 추론하기 어려울 때
- 새 thread를 테스트용으로 초기화할 때
- 특정 노드를 건너뛰고 그 다음 노드부터 실행시키고 싶을 때

위 예제에서 `as_node="pick_topic"`을 준 이유도 같다.  
LangGraph가 "이 `topic` 값은 `pick_topic`이 만든 결과"라고 이해해야 다음으로 `write_copy`를 실행할 수 있다.

## 5. 체크포인트 히스토리를 읽을 때의 팁

`get_state_history()`는 최신 체크포인트가 먼저 오는 역순 목록이다.  
이걸 모르고 첫 번째 원소를 "가장 오래된 상태"라고 가정하면 디버깅 판단이 꼬이기 쉽다.

실무에서는 보통 아래 기준으로 필터링하면 빠르다.

```python
history = list(graph.get_state_history(config))

before_specific_node = next(s for s in history if s.next == ("write_copy",))
step_1 = next(s for s in history if s.metadata["step"] == 1)
forks = [s for s in history if s.metadata["source"] == "update"]
```

특히 `metadata["source"]`는 아래처럼 보면 된다.

- `"input"`: 초기 입력 체크포인트
- `"loop"`: 일반 실행 중 생성된 체크포인트
- `"update"`: `update_state()`로 생성한 분기 체크포인트

## 6. interrupt가 있는 그래프에서는 더 조심해야 한다

time travel을 승인 workflow에 붙일 때 가장 자주 놓치는 점은 이것이다.

- replay해도 `interrupt()`는 다시 트리거된다
- fork해도 `interrupt()`는 다시 트리거될 수 있다
- 따라서 새 `Command(resume=...)`를 다시 넣어야 할 수 있다

즉 "중간 승인값만 바꿔서 그대로 끝까지 자동 복원"된다고 기대하면 어긋날 수 있다.  
공식 문서도 interrupts는 replay/fork 시 재실행된다고 명확히 설명한다.

## 7. 자주 생기는 함정

### 7-1. checkpointer 없이 time travel을 기대하면 안 된다

`compile(checkpointer=...)`가 없으면 체크포인트 히스토리가 없다.  
이 경우 replay나 fork를 논할 기반 자체가 없다.

### 7-2. `thread_id`를 빼먹으면 히스토리가 이어지지 않는다

LangGraph는 checkpointer가 `thread_id`를 기준으로 상태를 저장하고 다시 찾는다.  
사람 승인 재개, 체크포인트 조회, time travel 모두 여기에 의존한다.

### 7-3. replay를 "캐시 복원"으로 착각하면 안 된다

replay는 읽기 전용 탐색이 아니라 재실행이다.  
외부 API 호출 비용이나 부작용이 있는 노드는 특히 주의해야 한다.

### 7-4. reducer 채널은 `update_state()`에서도 누적될 수 있다

문서 기준으로 `update_state()`는 일반 노드 업데이트처럼 reducer를 통과한다.  
즉 list 누적 채널에 값을 넣으면 overwrite가 아니라 append처럼 동작할 수 있다.

### 7-5. 병렬 그래프에서는 `as_node` 추론이 실패할 수 있다

같은 step에 여러 노드가 상태를 쓴 경우 LangGraph가 어느 노드 기준으로 이어야 하는지 못 고를 수 있다.  
이때는 `as_node`를 명시하는 편이 가장 안전하다.

## 마무리

LangGraph의 time travel은 단순한 디버깅 보조 기능이 아니라, 체크포인트 기반으로 workflow를 재현하고 분기 실험하는 핵심 운영 도구에 가깝다.

- 과거 실행을 그대로 다시 태워 보고 싶다: replay
- 과거 상태를 바꿔 대안 경로를 실험하고 싶다: fork
- 원본 히스토리는 보존하고 싶다: `update_state()`
- 다음 실행 노드를 정확히 제어하고 싶다: `as_node`

LangGraph를 실제 서비스에 붙인 뒤 "왜 이 상태가 나왔지?"를 자주 묻게 된다면, `interrupt` 다음으로 빨리 익혀 둘 기능이 바로 time travel이다.

## 참고 자료

- [LangGraph Use time-travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph Graph API Overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
