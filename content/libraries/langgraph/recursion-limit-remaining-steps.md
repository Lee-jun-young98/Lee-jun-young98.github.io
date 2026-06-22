---
title: LangGraph recursion_limit과 RemainingSteps로 루프 안전장치 두기
description: LangGraph Graph API에서 GraphRecursionError, recursion_limit, RemainingSteps를 사용해 루프형 workflow의 무한 반복을 막고 안전하게 종료하는 실전 패턴 정리
date: 2026-06-22
tags:
  - langgraph
  - workflow
  - reliability
  - python
aliases:
  - "/blog/langgraph-recursion-limit-remaining-steps"
---

# LangGraph `recursion_limit`과 `RemainingSteps`로 루프 안전장치 두기

LangGraph로 loop가 있는 workflow를 만들면 "언젠가는 끝난다"는 가정이 코드에 숨어 들어가기 쉽다.

- 모델이 계속 같은 판단을 반복한다
- tool 결과가 기대와 달라 종료 조건을 못 탄다
- conditional edge가 잘못 연결돼 같은 node를 맴돈다

이때 LangGraph는 기본적으로 step 수 상한을 두고, 그 한도를 넘기면 `GraphRecursionError`를 발생시킨다.  
공식 문서 기준으로 이 에러는 대개 cycle 버그를 뜻하지만, 의도적으로 여러 번 반복하는 복잡한 graph라면 정상적으로도 기본 limit에 걸릴 수 있다.

이 글에서는 아래만 실전 기준으로 정리한다.

- `recursion_limit`이 정확히 무엇을 세는지
- `GraphRecursionError`를 언제 그냥 올리고, 언제 잡아야 하는지
- `RemainingSteps`로 예외 대신 "안전 종료"를 만드는 방법
- loop형 agent/workflow에서 자주 생기는 함정

## 언제 이 패턴이 필요한가

아래처럼 반복 실행이 들어가는 graph라면 거의 바로 고려해도 된다.

- planner가 `done`일 때까지 다시 도는 agent loop
- 문서/배치 처리를 chunk 단위로 반복하는 workflow
- tool 호출 결과에 따라 재시도성 loop를 도는 구조
- supervisor가 worker를 여러 번 왕복 호출하는 multi-step flow

핵심은 간단하다.  
종료 조건이 있어도, 그 종료 조건이 항상 도달 가능하다는 보장은 별개다.

## 사전 준비

예제는 `langgraph==1.2.6`에서 확인했다.

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

## 1. 가장 작은 `GraphRecursionError` 예제

아래 graph는 `history` 길이가 5가 되면 끝나도록 설계돼 있지만, 실행 config에서 `recursion_limit=3`을 주기 때문에 중간에 멈춘다.

```python
import operator
from typing import Annotated, Literal
from typing_extensions import TypedDict

from langgraph.errors import GraphRecursionError
from langgraph.graph import END, START, StateGraph


class LoopState(TypedDict):
    history: Annotated[list[str], operator.add]


def think(state: LoopState):
    next_n = len(state["history"]) + 1
    return {"history": [f"think-{next_n}"]}


def route(state: LoopState) -> Literal["think", "__end__"]:
    if len(state["history"]) >= 5:
        return END
    return "think"


builder = StateGraph(LoopState)
builder.add_node("think", think)
builder.add_edge(START, "think")
builder.add_conditional_edges("think", route)
graph = builder.compile()

try:
    result = graph.invoke({"history": []}, {"recursion_limit": 3})
    print(result)
except GraphRecursionError as exc:
    print(type(exc).__name__)
    print(str(exc))
```

실행하면 아래처럼 나온다.

```text
GraphRecursionError
Recursion limit of 3 reached without hitting a stop condition.
```

여기서 중요한 점은 `recursion_limit`이 함수 호출 횟수 하나하나가 아니라 graph의 step 진행 상한이라는 점이다.  
공식 Graph API 문서도 이 값을 superstep 기준 상한으로 설명한다.

즉 아래 두 경우를 구분해야 한다.

- 정말 무한 루프다
- 종료 조건은 맞지만, 이번 config의 한도가 너무 낮다

## 2. 복잡한 workflow라면 limit을 올려도 된다

공식 에러 문서도 복잡한 graph는 기본 상한에 자연스럽게 걸릴 수 있다고 안내한다.  
그래서 반복 횟수가 의도적으로 큰 workflow라면 invoke할 때 limit을 명시하는 편이 낫다.

```python
result = graph.invoke(
    {"history": []},
    {"recursion_limit": 20},
)
```

이 패턴이 맞는 경우는 아래와 같다.

- "최대 10~15번 정도는 정상 반복"이라는 도메인 지식이 있다
- planner/worker loop가 원래 여러 번 왕복한다
- tool fan-in/out 이후 정리 step까지 포함해 step 수가 많다

반대로 종료 조건 자체가 흔들리는 상황에서 무작정 limit만 키우면 장애를 늦게 발견하게 된다.

## 3. 예외 대신 정상 종료하고 싶다면 `RemainingSteps`

실전에서는 "한도를 넘으면 예외로 터뜨리기"보다, 남은 step이 거의 없을 때 안전하게 끝내고 현재까지의 결과를 반환하고 싶을 때가 있다.

LangGraph는 이를 위해 `RemainingSteps`를 제공한다.  
공식 Graph API 문서 기준으로 이 값은 graph run 동안만 존재하는 managed state 채널이다.

```python
import operator
from typing import Annotated, Literal
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.managed.is_last_step import RemainingSteps


class SafeLoopState(TypedDict):
    history: Annotated[list[str], operator.add]
    remaining_steps: RemainingSteps


def think(state: SafeLoopState):
    next_n = len(state["history"]) + 1
    return {"history": [f"think-{next_n}"]}


def route(state: SafeLoopState) -> Literal["think", "__end__"]:
    if state["remaining_steps"] <= 1:
        return END
    if len(state["history"]) >= 5:
        return END
    return "think"


builder = StateGraph(SafeLoopState)
builder.add_node("think", think)
builder.add_edge(START, "think")
builder.add_conditional_edges("think", route)
graph = builder.compile()

result = graph.invoke({"history": []}, {"recursion_limit": 3})
print(result)
```

위 예제는 예외 대신 아래처럼 현재까지 상태를 반환한다.

```text
{'history': ['think-1', 'think-2']}
```

이 패턴이 좋은 이유는 분명하다.

- 사용자에게 부분 결과를 보여 줄 수 있다
- batch workflow에서 checkpoint/로그를 남기고 다음 배치로 넘기기 쉽다
- "이번 run은 여기까지만"이라는 경계를 business logic 안으로 가져올 수 있다

## 4. 언제 `GraphRecursionError`를 그대로 두고, 언제 `RemainingSteps`를 쓸까

둘은 경쟁 관계라기보다 failure semantics가 다르다.

### `GraphRecursionError`가 더 맞는 경우

- 종료 조건이 안 맞으면 버그로 봐야 한다
- agent가 일정 횟수 안에 끝나지 않으면 실패 처리해야 한다
- 운영 경보를 띄우고 trace를 조사해야 한다

### `RemainingSteps`가 더 맞는 경우

- 부분 결과라도 반환하는 편이 낫다
- 장기 workflow를 여러 run으로 쪼개고 싶다
- 루프가 길어질 수 있다는 사실 자체는 정상이다

예를 들어 승인 대기, 외부 배치 반영, 큰 문서 처리 같은 workflow는 `RemainingSteps`로 우아하게 잘라 두는 편이 운영에 유리할 수 있다.

## 5. 흔한 실수

### 5-1. limit을 높이는 것으로 루프 버그를 가린다

`GraphRecursionError`가 났다고 바로 `100`, `1000`으로 올리면 원인을 놓치기 쉽다.

먼저 봐야 할 것은 아래다.

- conditional edge가 실제로 `END`를 탈 수 있는지
- reducer 때문에 state가 예상과 다르게 누적되지 않는지
- model/tool 결과가 종료 조건과 맞물리도록 정규화됐는지

## 5-2. loop body에 부작용을 넣고 무한 반복을 허용한다

반복 노드 안에서 아래 작업을 한다면 recursion limit은 곧 비용/중복 실행 보호장치가 된다.

- 외부 API 쓰기
- 이메일 발송
- 결제/승인 요청
- 티켓 생성

이 경우는 recursion limit만 둘 게 아니라 아래를 같이 봐야 한다.

- idempotency key
- RetryPolicy 범위
- 사람이 끊을 수 있는 interrupt 또는 drain

### 5-3. `RemainingSteps`를 business state처럼 저장하려 한다

`RemainingSteps`는 graph run 동안만 살아 있는 managed channel이다.  
영구 상태처럼 저장하거나 다음 thread에서 재사용하는 값으로 생각하면 안 된다.

즉 "남은 예산" 같은 도메인 개념이 필요하면 별도 state key를 직접 두는 편이 맞다.

### 5-4. recursion limit과 retry를 같은 것으로 본다

둘은 역할이 다르다.

- `RetryPolicy`: 한 node의 일시 실패 복구
- `recursion_limit`: graph 전체 반복 상한

node 하나가 자꾸 실패해 retry를 반복하는 상황과, graph가 조건을 못 만나 loop를 반복하는 상황은 별도 문제로 나눠야 한다.

## 6. 실무에서 바로 쓰는 기준

처음에는 아래 기준만 있어도 충분하다.

1. loop가 있으면 종료 조건과 `recursion_limit`를 같이 설계한다.
2. limit 초과가 버그면 `GraphRecursionError`를 그대로 surface한다.
3. 부분 결과가 더 중요하면 `RemainingSteps`로 우아하게 종료한다.
4. 반복 노드에 부작용이 있으면 멱등성과 비용 상한을 같이 둔다.
5. trace에서 실제 step 수를 보고 적정 limit을 조정한다.

## 마무리

LangGraph의 recursion limit은 단순 보호장치가 아니라 "이 workflow가 어디까지 반복해도 정상인가"를 코드로 못 박는 경계다.

- 실패로 다루고 싶으면 `GraphRecursionError`
- 부분 결과로 마감하고 싶으면 `RemainingSteps`

loop가 있는 agent나 workflow를 운영할수록 이 둘을 명시적으로 설계하는 편이 훨씬 안전하다.

## 참고 자료

- [LangGraph GRAPH_RECURSION_LIMIT](https://docs.langchain.com/oss/python/langgraph/errors/GRAPH_RECURSION_LIMIT)
- [LangGraph Graph API - Impose a recursion limit](https://docs.langchain.com/oss/python/langgraph/use-graph-api#impose-a-recursion-limit)
- [LangGraph Graph API - Create and control loops](https://docs.langchain.com/oss/python/langgraph/use-graph-api#create-and-control-loops)
- [LangGraph `GraphRecursionError` Reference](https://reference.langchain.com/python/langgraph/errors/#langgraph.errors.GraphRecursionError)
