---
title: LangGraph static breakpoint로 노드 전후 실행을 멈춰 디버깅하기
description: LangGraph에서 interrupt_before와 interrupt_after를 사용해 노드 전후에 정지점을 걸고 같은 thread_id로 실행을 재개하는 디버깅 패턴 정리
date: 2026-06-23
tags:
  - langgraph
  - debugging
  - workflow
  - python
aliases:
  - "/blog/langgraph-static-breakpoints-interrupt-before-after"
---

# LangGraph static breakpoint로 노드 전후 실행을 멈춰 디버깅하기

LangGraph를 쓰다 보면 이런 순간이 온다.

- 어떤 노드에 들어가기 직전 state가 정확히 무엇인지 보고 싶다.
- 특정 노드가 끝난 뒤 state가 어떻게 바뀌는지 한 단계씩 확인하고 싶다.
- human-in-the-loop가 아니라 순수 디버깅 용도로 graph를 잠깐 멈추고 싶다.

이럴 때 쓰는 기능이 static breakpoint다.  
공식 interrupts 문서 기준으로 LangGraph는 `interrupt_before`와 `interrupt_after`를 통해 노드 실행 전후에 정지점을 걸 수 있다.

중요한 구분은 이렇다.

- `interrupt()` 함수: 실제 서비스 흐름에서 외부 입력을 기다리는 동적 인터럽트
- `interrupt_before` / `interrupt_after`: 디버깅과 테스트를 위한 정적 breakpoint

공식 문서도 static interrupts는 human-in-the-loop workflow용이 아니라 디버깅/테스트용이라고 분명히 설명한다.

## 언제 쓰면 좋은가

아래 같은 상황이면 static breakpoint가 바로 유용하다.

- reducer 적용 전후를 비교하고 싶을 때
- tool 호출 직전 state를 검사하고 싶을 때
- 특정 분기가 왜 일어났는지 한 단계씩 좁혀 보고 싶을 때
- LangSmith trace만으로는 부족해서 로컬에서 step-by-step으로 재현하고 싶을 때

반대로 사용자 승인이나 검토 입력을 실제로 받아야 한다면 `interrupt()`를 써야 한다.

## 사전 준비

Python 3.10+ 환경에서 아래 정도면 예제를 실행할 수 있다.

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

## 1. `interrupt_before`로 노드 진입 직전에 멈추기

가장 단순한 패턴은 "이 노드가 실행되기 직전" 멈추는 것이다.

```python
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


class DraftState(TypedDict):
    draft: str
    score: int
    status: str


def score_draft(state: DraftState):
    score = 90 if "예시" in state["draft"] else 60
    return {"score": score}


def finalize(state: DraftState):
    status = "ready" if state["score"] >= 80 else "needs_revision"
    return {"status": status}


builder = StateGraph(DraftState)
builder.add_node("score_draft", score_draft)
builder.add_node("finalize", finalize)
builder.add_edge(START, "score_draft")
builder.add_edge("score_draft", "finalize")
builder.add_edge("finalize", END)

graph = builder.compile(
    checkpointer=InMemorySaver(),
    interrupt_before=["finalize"],
)

config = {"configurable": {"thread_id": "draft-debug-1"}}

first = graph.invoke(
    {"draft": "LangGraph 초안입니다. 예시를 포함합니다.", "score": 0, "status": ""},
    config=config,
)

print(first)
```

여기서 기대하는 동작은 이렇다.

1. `score_draft`는 실행된다.
2. `finalize`가 실행되기 직전에 graph가 멈춘다.
3. 같은 `thread_id`로 다시 호출하면 다음 단계로 이어진다.

공식 문서 기준으로 breakpoint는 checkpointer가 있어야 작동하고, 재개할 때는 같은 `thread_id`를 써야 한다.

## 2. `graph.invoke(None, config=...)`로 다음 breakpoint까지 재개하기

정지된 뒤에는 입력을 다시 주지 않고 `None`으로 재개한다.

```python
resumed = graph.invoke(None, config=config)
print(resumed)
```

이 패턴이 중요한 이유는 static breakpoint가 "새 입력을 받는 인터럽트"가 아니라 "현재 실행 위치를 잠깐 멈추는 디버그 포인트"이기 때문이다.

공식 문서 기준으로 재개 시 `None`을 넘기면 다음 breakpoint 또는 graph 종료 지점까지 실행된다.

## 3. `interrupt_after`로 노드 실행 직후 상태 보기

이번에는 노드가 끝난 직후 멈춰 보자.

```python
graph = builder.compile(
    checkpointer=InMemorySaver(),
    interrupt_after=["score_draft"],
)

config = {"configurable": {"thread_id": "draft-debug-2"}}

paused = graph.invoke(
    {"draft": "예시 없는 초안", "score": 0, "status": ""},
    config=config,
)

print(paused)
```

이 경우에는 `score_draft`가 이미 실행된 뒤라서, 다음 단계로 넘어가기 전에 score가 state에 반영된 상태를 확인하기 좋다.

실무에서는 보통 이렇게 나눈다.

- `interrupt_before`: 입력 state가 맞는지 보기
- `interrupt_after`: 출력 state가 기대대로 갱신됐는지 보기

## 4. compile-time 대신 run-time으로 breakpoint를 바꾸기

공식 문서 기준으로 breakpoint는 compile 시점뿐 아니라 invocation 시점에도 줄 수 있다.  
즉 같은 graph를 두고, 실행마다 멈출 노드를 바꿀 수 있다.

```python
graph = builder.compile(checkpointer=InMemorySaver())

config = {"configurable": {"thread_id": "draft-debug-3"}}

paused = graph.invoke(
    {"draft": "런타임 breakpoint 테스트", "score": 0, "status": ""},
    config=config,
    interrupt_before=["score_draft"],
    interrupt_after=["finalize"],
)

print(paused)
```

이 방식은 테스트 코드에서 특히 편하다.

- 같은 graph 정의를 재사용할 수 있다.
- 어떤 노드에서 멈출지 테스트마다 바꿀 수 있다.
- 운영 graph 코드에 디버깅 전용 설정을 고정하지 않아도 된다.

## 5. `interrupt()`와 헷갈리지 않기

둘 다 이름에 interrupt가 들어가서 처음에는 많이 헷갈린다.

### static breakpoint

- 목적: 디버깅, 테스트
- 설정 위치: `compile(...)` 또는 `invoke(...)`
- 재개 방식: `graph.invoke(None, config=...)`
- 사용자 입력: 받지 않음

### dynamic interrupt

- 목적: 승인, 검토, 수정 같은 human-in-the-loop
- 설정 위치: 노드 내부 `interrupt(...)`
- 재개 방식: `Command(resume=...)`
- 사용자 입력: JSON-serializable payload로 받음

이 구분이 흐려지면 디버깅 코드와 실제 제품 흐름이 섞여서 graph가 금방 읽기 어려워진다.

## 자주 겪는 함정

### 1. checkpointer 없이 breakpoint가 될 거라고 생각한다

공식 문서 기준으로 static breakpoint에는 checkpointer가 필요하다.  
실행 위치를 저장해야 재개할 수 있기 때문이다.

### 2. 재개할 때 다른 `thread_id`를 쓴다

같은 `thread_id`를 써야 멈춰 있던 checkpoint를 다시 읽는다.  
새 ID를 쓰면 완전히 새 thread로 시작한다.

### 3. human approval 용도로 static breakpoint를 쓴다

이건 공식 문서에서도 권장하지 않는다.  
사람 입력을 받아 계속 진행해야 하는 실제 workflow라면 `interrupt()`와 `Command(resume=...)`를 써야 한다.

### 4. breakpoint 재개 시 새 입력 dict를 다시 넣는다

static breakpoint 재개는 `graph.invoke(None, config=...)`가 기본이다.  
불필요하게 입력을 다시 넣으면 "디버그 재개"와 "새 실행" 의도가 섞여 헷갈리기 쉽다.

### 5. 노드 전후 어느 시점에 멈추는지 명확히 안 정한다

`interrupt_before`와 `interrupt_after`는 보는 정보가 다르다.

- 전자는 "실행 직전의 입력 state"
- 후자는 "실행 직후의 출력 state"

버그를 좁힐 때 이 차이를 분명히 잡아야 시간을 덜 낭비한다.

## 추천 디버깅 흐름

개인적으로는 아래 순서가 가장 빠르다.

1. `interrupt_before`로 문제 노드 직전 state를 본다.
2. 이상이 없으면 `interrupt_after`로 바꿔서 노드 출력 state를 본다.
3. 그래도 애매하면 LangSmith trace와 나란히 비교한다.
4. 원인이 reducer인지 라우팅인지 tool side effect인지 분리한다.

이렇게 보면 "어느 노드에서 state가 틀어졌는지"를 꽤 빠르게 찾을 수 있다.

## 마무리

LangGraph static breakpoint는 graph 전체를 갈아엎지 않고도, 원하는 노드 전후에서 실행을 멈춰 state를 단계별로 확인하게 해 주는 디버깅 도구다.

- 노드 진입 직전 확인: `interrupt_before`
- 노드 실행 직후 확인: `interrupt_after`
- 재개: 같은 `thread_id`로 `graph.invoke(None, config=...)`
- 실제 사용자 입력 대기: static breakpoint가 아니라 `interrupt()`

LangGraph workflow가 커질수록 이 구분이 디버깅 시간을 꽤 줄여준다.

## 참고 자료

- [LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph Graph API Overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
