---
title: LangGraph update_state()로 thread 상태를 수동 수정하고 이어서 실행하기
description: LangGraph checkpointer와 update_state()를 이용해 과거 checkpoint에서 상태를 수정하고, 분기 실행이나 테스트용 부분 실행을 이어가는 실전 패턴 정리
date: 2026-07-06
tags:
  - langgraph
  - workflow
  - python
  - debugging
aliases:
  - /blog/langgraph-update-state-manual-patching
---

# LangGraph update_state()로 thread 상태를 수동 수정하고 이어서 실행하기

LangGraph를 운영하다 보면 "이 thread를 처음부터 다시 돌리기보다 저장된 상태만 조금 고쳐서 이어가고 싶다"는 순간이 자주 옵니다.

- human-in-the-loop 검토 후 잘못된 state만 수정하고 싶을 때
- 이전 checkpoint에서 다른 입력으로 분기 실행해 보고 싶을 때
- 테스트에서 중간 state를 바로 심고 특정 node부터 실행하고 싶을 때

이럴 때 쓰는 API가 `graph.update_state()`입니다.  
공식 문서 기준으로 `update_state()`는 과거 checkpoint를 덮어쓰지 않고, 새로운 checkpoint를 추가로 만들며 그 지점에서 실행을 이어가게 합니다.

## 언제 유용한가

`update_state()`는 특히 아래 상황에서 실전성이 높습니다.

- 이미 저장된 thread를 디버깅하면서 일부 필드만 바꿔 재실행할 때
- `interrupt()` 이후 사람이 승인값이나 보정값을 넣고 이어갈 때
- `get_state_history()`로 특정 super-step 직전 checkpoint를 찾은 뒤 fork 실험을 할 때
- 테스트 코드에서 node 1 결과를 직접 심고 node 2부터 검증할 때

반대로 단순 재시도가 목적이면 `RetryPolicy`나 `error_handler`가 더 맞고, 장기 메모리 수정이 목적이면 graph state보다 `store`를 먼저 볼 필요가 있습니다.

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

`update_state()`를 쓰려면 checkpointer가 필요합니다. 메모리 예제는 `InMemorySaver`로 충분합니다.

## 핵심 동작 먼저 정리

공식 문서 기준으로 기억할 점은 네 가지입니다.

1. `update_state()`는 과거 checkpoint를 수정하지 않고 새 checkpoint를 만든다.
2. 업데이트 값은 일반 node update처럼 처리되므로 reducer가 있으면 누적 규칙이 그대로 적용된다.
3. 어떤 node가 이 값을 만든 것처럼 볼지 `as_node`로 지정할 수 있다.
4. 상태를 수정한 뒤에는 `graph.invoke(None, config)`처럼 `None`으로 재개하는 패턴이 자주 나온다.

## 예제 1. 이전 checkpoint에서 값만 바꿔 분기 실행하기

아래 예제는 topic을 만든 뒤 reply를 쓰는 간단한 graph입니다.  
한 번 실행한 뒤 `write_reply` 직전 checkpoint를 찾아 topic만 바꾸고, 그 지점에서 다시 이어갑니다.

```python
from typing_extensions import NotRequired, TypedDict

from langchain_core.utils.uuid import uuid7
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import START, StateGraph


class State(TypedDict):
    topic: NotRequired[str]
    reply: NotRequired[str]


def choose_topic(state: State):
    return {"topic": "환불 요청"}


def write_reply(state: State):
    return {"reply": f"{state['topic']}에 대한 초안을 작성했습니다."}


checkpointer = InMemorySaver()

graph = (
    StateGraph(State)
    .add_node("choose_topic", choose_topic)
    .add_node("write_reply", write_reply)
    .add_edge(START, "choose_topic")
    .add_edge("choose_topic", "write_reply")
    .compile(checkpointer=checkpointer)
)

config = {"configurable": {"thread_id": str(uuid7())}}

first_result = graph.invoke({}, config)
print(first_result["reply"])

history = list(graph.get_state_history(config))
before_reply = next(snapshot for snapshot in history if snapshot.next == ("write_reply",))

fork_config = graph.update_state(
    before_reply.config,
    values={"topic": "배송 지연"},
)

fork_result = graph.invoke(None, fork_config)
print(fork_result["reply"])
```

예상 출력:

```python
환불 요청에 대한 초안을 작성했습니다.
배송 지연에 대한 초안을 작성했습니다.
```

이 패턴의 포인트는 명확합니다.

- 원래 thread 이력은 그대로 남는다
- 새 checkpoint가 분기처럼 추가된다
- `write_reply` 이후 node만 다시 실행된다

처음부터 graph 전체를 다시 돌리지 않아도 되므로 운영 디버깅과 재현에 매우 편합니다.

## 예제 2. 테스트에서 중간 state를 심고 특정 node부터 실행하기

공식 테스트 가이드에서도 `update_state()`를 이용한 partial execution 패턴을 권장합니다.  
아래 예제는 `node1` 결과를 직접 저장한 것처럼 처리하고 `node2`부터 실행합니다.

```python
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    text: str


def node1(state: State):
    return {"text": "draft"}


def node2(state: State):
    return {"text": state["text"].upper()}


graph = (
    StateGraph(State)
    .add_node("node1", node1)
    .add_node("node2", node2)
    .add_edge(START, "node1")
    .add_edge("node1", "node2")
    .add_edge("node2", END)
    .compile(checkpointer=InMemorySaver())
)

config = {"configurable": {"thread_id": "test-thread"}}

graph.update_state(
    config,
    values={"text": "draft"},
    as_node="node1",
)

result = graph.invoke(None, config)
print(result["text"])
```

예상 출력:

```python
DRAFT
```

이 방식은 다음 상황에서 특히 좋습니다.

- node 1이 비싼 API 호출이라 테스트마다 다시 실행하고 싶지 않을 때
- 특정 branch 이후 동작만 단위 테스트하고 싶을 때
- `interrupt()` 직전 state를 고정해 재현 테스트를 만들고 싶을 때

## `as_node`는 언제 직접 써야 하나

보통 과거 checkpoint에서 fork할 때는 LangGraph가 자동으로 추론합니다.  
하지만 아래 상황에서는 `as_node`를 직접 적는 편이 안전합니다.

- 새 thread에 아직 실행 이력이 없을 때
- 병렬 branch 때문에 마지막 writer가 모호할 때
- graph가 "어느 node 다음으로 이어져야 하는지" 추론하지 못할 때
- 중간 node를 이미 지난 것처럼 간주하고 뒤쪽 node만 실행하고 싶을 때

정리하면 `as_node`는 "이 상태 변경을 누가 만들었다고 간주할지"를 명시하는 스위치입니다.

## reducer가 있으면 덮어쓰기가 아닐 수 있다

이 부분을 많이 놓칩니다.  
공식 checkpointer 문서 기준으로 `update_state()`는 일반 node write처럼 reducer를 통과합니다.

예를 들어 `messages` 채널이 `add_messages` reducer를 쓰고 있다면:

- 새 list를 넣어도 단순 교체가 아니라 merge 규칙이 적용될 수 있습니다
- message 삭제나 교체를 기대했다면 결과가 예상과 다를 수 있습니다

즉 "그냥 state dict를 통째로 갈아끼운다"는 감각으로 쓰면 틀릴 수 있습니다.  
수정 전에는 해당 channel이 reducer를 쓰는지 먼저 확인하는 게 안전합니다.

## 운영에서 자주 쓰는 패턴

### 1. human review 후 보정값 넣고 재개

`interrupt()`로 멈춘 thread에서 사람이 `approved=True`, `risk_level="low"` 같은 필드를 넣고 다음 단계로 넘길 수 있습니다.

### 2. 장애 재현용 fork 만들기

`get_state_history()`에서 문제 직전 checkpoint를 찾고, provider 설정이나 입력 텍스트만 바꿔 여러 분기를 실험할 수 있습니다.

### 3. 긴 graph의 뒷부분만 테스트하기

앞단 retrieval, parsing, tool call을 모두 실제로 태우지 않고 필요한 state만 심어 후반 node 로직만 빠르게 검증할 수 있습니다.

## 자주 틀리는 부분

### 1. checkpointer 없이 쓰려는 경우

`update_state()`와 `get_state_history()`는 persisted thread를 전제로 합니다.  
실전에서는 `InMemorySaver`, `SqliteSaver`, `PostgresSaver` 중 하나라도 있어야 합니다.

### 2. 과거 checkpoint를 수정한다고 생각하는 경우

`update_state()`는 rollback이 아니라 새 checkpoint 생성입니다.  
기존 이력은 남고, 새로운 분기가 추가됩니다.

### 3. `invoke({})`로 다시 시작해 버리는 경우

중간 state에서 이어가려면 보통 `graph.invoke(None, config)`를 써야 합니다.  
새 입력 dict를 넘기면 START부터 새 실행이 시작될 수 있습니다.

### 4. 병렬 branch에서 `as_node`를 생략하는 경우

같은 super-step에서 여러 node가 state를 썼다면 LangGraph가 writer를 못 고를 수 있습니다.  
이때는 `as_node`를 명시해 다음 실행 경로를 분명히 잡아야 합니다.

## 추천 사용 순서

실전에서는 아래 순서가 가장 무난합니다.

1. `graph.get_state(config)`나 `graph.get_state_history(config)`로 현재 위치를 확인한다.
2. 어느 checkpoint에서 다시 시작할지 고른다.
3. 필요한 필드만 최소한으로 `update_state()` 한다.
4. 병렬 또는 fresh thread면 `as_node`를 명시한다.
5. `graph.invoke(None, config)`로 재개한다.

이 흐름을 익혀 두면 LangGraph thread를 "검은 상자"처럼 다시 돌리는 대신, 원하는 지점에서 정밀하게 수술하듯 수정하고 이어갈 수 있습니다.

## 참고 자료

- [Use time-travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)
- [Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers)
- [Test](https://docs.langchain.com/oss/python/langgraph/test)
- [update_state reference](https://reference.langchain.com/python/langgraph/pregel/main/Pregel/update_state)
