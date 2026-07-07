---
title: LangGraph DeltaChannel로 긴 thread checkpoint 크기 줄이기
description: LangGraph DeltaChannel로 messages 같은 append-heavy state를 delta 단위로 저장해 checkpoint 크기를 줄이고 snapshot_frequency로 읽기 비용을 제어하는 실전 패턴 정리
date: 2026-07-07
tags:
  - langgraph
  - workflow
  - python
  - performance
  - checkpointing
aliases:
  - /blog/langgraph-delta-channel-checkpoint-storage
---

# LangGraph DeltaChannel로 긴 thread checkpoint 크기 줄이기

LangGraph에서 `messages`, audit log, intermediate events처럼 매 step마다 조금씩 늘어나는 channel은 thread가 길어질수록 checkpoint 저장량이 빠르게 커집니다.

- 기본 checkpoint 방식은 super-step마다 channel의 누적값 전체를 다시 저장합니다.
- 대화 기록처럼 list가 계속 길어지는 channel은 thread 길이에 비례해서 blob도 커집니다.
- checkpointer가 느려지거나 저장소 비용이 커질 때는 모델보다 state 저장이 병목이 되기도 합니다.

이럴 때 쓰는 기능이 `DeltaChannel`입니다. 공식 문서 기준으로 `DeltaChannel`은 `langgraph>=1.2`가 필요하고 현재는 beta입니다. 핵심은 "누적 결과 전체" 대신 "이번 step에서 추가된 delta"만 저장하고, 읽을 때 reducer로 다시 복원하는 것입니다.

## 언제 쓰면 좋은가

다음 조건이 같이 맞으면 `DeltaChannel` 후보입니다.

- 같은 state key에 append성 write가 자주 들어온다
- channel 값이 thread가 길어질수록 계속 커진다
- checkpointer 저장량이나 checkpoint 직렬화 시간이 문제로 보이기 시작한다

대표적인 예시는 아래입니다.

- `messages` 대화 기록
- tool 실행 로그 리스트
- 감사용 이벤트 목록
- step별 산출물을 누적하는 dict/list

반대로 매번 마지막 값만 덮어쓰는 필드라면 `LastValue`나 일반 state key로 충분합니다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "langgraph>=1.2"
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U "langgraph>=1.2"
```

## 핵심 차이

일반 reducer channel은 checkpoint마다 현재 누적값 전체가 저장됩니다.  
`DeltaChannel`은 step별 write만 저장하고, 나중에 state를 읽을 때 reducer로 누적 상태를 다시 만듭니다.

이 차이 때문에 설계 포인트가 바뀝니다.

- 저장은 가벼워지지만 읽을 때는 과거 write 재생 비용이 생깁니다.
- reducer는 "한 번의 update"가 아니라 "이번 step의 write 묶음 전체"를 받는 bulk reducer여야 합니다.
- reducer 안에 랜덤성, 현재 시간, ID 생성 같은 부작용을 넣으면 replay 때 결과가 흔들립니다.

## 최소 runnable 예제

아래 예제는 같은 `thread_id`로 여러 번 호출하면서 `messages`를 delta 방식으로 누적합니다.

```python
from typing import Annotated, Sequence
from typing_extensions import TypedDict

from langgraph.channels import DeltaChannel
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


def list_reducer(state: list[str], writes: Sequence[list[str]]) -> list[str]:
    result = list(state)
    for write in writes:
        result.extend(write)
    return result


class State(TypedDict, total=False):
    incoming: str
    messages: Annotated[list[str], DeltaChannel(list_reducer, snapshot_frequency=3)]


def append_message(state: State):
    # DeltaChannel에는 전체 누적 목록이 아니라 이번 step의 새 항목만 쓴다.
    return {"messages": [state["incoming"]]}


graph = (
    StateGraph(State)
    .add_node("append_message", append_message)
    .add_edge(START, "append_message")
    .add_edge("append_message", END)
    .compile(checkpointer=InMemorySaver())
)

config = {"configurable": {"thread_id": "demo-thread"}}

for text in ["hello", "need budget review", "send final summary"]:
    graph.invoke({"incoming": text}, config=config)

snapshot = graph.get_state(config)
print(snapshot.values["messages"])
```

예상 출력:

```python
['hello', 'need budget review', 'send final summary']
```

실행 관점에서 보면 node는 매번 새 message 하나만 쓰지만, `graph.get_state()`나 다음 node가 state를 읽을 때는 누적된 `messages` 전체가 복원됩니다.

## `snapshot_frequency`는 왜 필요한가

`DeltaChannel`은 읽을 때 write history를 재생합니다. snapshot이 전혀 없으면 긴 thread에서 읽기 비용이 커질 수 있습니다.

공식 문서 기준으로 `snapshot_frequency=K`를 주면 K개의 pregel step마다 전체 snapshot을 한 번 저장해서, 읽을 때 최대 K step 정도만 되감으면 되게 만들 수 있습니다.

```python
class State(TypedDict):
    messages: Annotated[
        list[str],
        DeltaChannel(list_reducer, snapshot_frequency=20),
    ]
```

실무에서는 보통 이렇게 잡으면 무난합니다.

- 읽기보다 저장량 절감이 더 중요하다: 큰 값으로 시작
- 같은 thread를 자주 조회하거나 time travel을 자주 본다: 더 작은 값으로 시작
- 정확한 값은 checkpointer 저장량과 `get_state()` 지연을 같이 보고 조정

## 일반 reducer와 제일 다른 함정

### 1. reducer 시그니처를 pairwise reducer처럼 작성하는 경우

`DeltaChannel` reducer는 `(state, writes)`를 받고 `writes`는 이번 step에 들어온 write들의 시퀀스입니다.

```python
def list_reducer(state: list[str], writes: Sequence[list[str]]) -> list[str]:
    result = list(state)
    for write in writes:
        result.extend(write)
    return result
```

일반 `Annotated[..., reducer]`에서 자주 쓰는 "기존값 하나 + 새값 하나" 형태로 쓰면 의도한 누적이 깨질 수 있습니다.

### 2. reducer 안에서 ID 생성, 시간 기록, mutation을 하는 경우

공식 문서 기준으로 `DeltaChannel` reducer는 write 시점이 아니라 reconstruction 시점에 실행됩니다.  
즉 reducer 안에서 `uuid4()`, `datetime.now()`를 호출하거나, 들어온 write를 직접 mutate해서 ID를 붙이면 replay 때 결과가 달라질 수 있습니다.

안전한 규칙은 하나입니다.

- reducer는 순수 함수로 유지
- stable ID나 timestamp는 reducer 전에 upstream node에서 이미 채워 넣기

### 3. node가 매번 전체 누적 리스트를 다시 쓰는 경우

`DeltaChannel`은 "이번 step의 delta"를 쓰는 게 핵심입니다.

```python
return {"messages": [state["incoming"]]}
```

이렇게 새 항목만 반환해야 저장 효율이 나옵니다. 매번 전체 `messages`를 다시 반환하면 저장량 절감 효과를 스스로 줄이게 됩니다.

### 4. append-heavy가 아닌 필드까지 모두 DeltaChannel로 바꾸는 경우

모든 channel을 delta화할 필요는 없습니다.

- 자주 append되는 큰 channel만 우선 적용
- 작은 scalar 값, 마지막 값만 필요한 key는 그대로 유지

대개 `messages`, `events`, `tool_logs` 같은 필드 몇 개만 바꿔도 효과가 큽니다.

### 5. beta 기능이라는 점을 무시하는 경우

공식 문서와 reference 모두 `DeltaChannel`을 beta로 표시합니다. 저장 포맷이나 API가 바뀔 수 있으니 운영 도입 전에는 아래를 먼저 확인하는 편이 안전합니다.

- 현재 사용하는 `langgraph` 버전 고정
- staging에서 checkpoint restore, replay, time travel 확인
- checkpointer 백엔드별 저장량과 조회 지연 측정

## 추천 적용 순서

1. checkpoint가 커지는 channel이 정확히 무엇인지 먼저 확인합니다.
2. `messages`나 `events`처럼 append-heavy한 key 하나만 `DeltaChannel`로 바꿉니다.
3. node가 "전체 누적값"이 아니라 "이번 write"만 반환하도록 고칩니다.
4. `snapshot_frequency`를 작게 하나 정해서 읽기 지연을 확인합니다.
5. 저장량 절감과 조회 latency를 보고 frequency를 조정합니다.

긴 thread를 많이 운영하는 agent에서는 모델 호출 최적화만큼 checkpoint 저장 전략도 중요합니다. `DeltaChannel`은 그중 가장 실용적인 저장 최적화 옵션입니다.

## 참고 자료

- [LangGraph runtime: DeltaChannel](https://docs.langchain.com/oss/python/langgraph/pregel)
- [Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers)
- [DeltaChannel reference](https://reference.langchain.com/python/langgraph/channels/delta/DeltaChannel)
