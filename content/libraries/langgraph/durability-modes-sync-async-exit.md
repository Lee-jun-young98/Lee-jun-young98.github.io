---
title: "LangGraph durability 모드로 sync, async, exit 언제 고를까"
description: "LangGraph checkpointer와 durability='sync' | 'async' | 'exit'를 조합해 성능과 복구 가능성을 어떻게 맞출지 Python 예제로 정리한 실전 노트"
date: 2026-07-01
tags:
  - langgraph
  - persistence
  - reliability
  - python
  - orchestration
aliases:
  - "/blog/langgraph-durability-modes"
---

# LangGraph durability 모드로 sync, async, exit 언제 고를까

LangGraph를 운영 환경에 올리면 곧바로 이런 질문이 나옵니다.

- "체크포인트를 매 스텝마다 꼭 디스크에 써야 하나?"
- "속도는 챙기고 싶은데 프로세스가 죽었을 때 어디까지 복구되나?"
- "interrupt, 긴 배치 작업, 외부 API 호출이 섞인 그래프에서 durability는 뭘로 두는 게 맞나?"

이때 보는 옵션이 `durability="sync" | "async" | "exit"` 입니다.  
LangGraph 공식 체크포인터 문서 기준으로 durability는 그래프 실행 중 checkpoint를 언제 영속화할지 정하는 설정입니다.

이 글에서는 다음만 실무 기준으로 정리합니다.

- 각 durability 모드가 실제로 무엇을 보장하는지
- 어떤 워크로드에서 `sync`, `async`, `exit`를 고르면 되는지
- checkpointer와 함께 바로 실행해 볼 수 있는 Python 예제
- 자주 생기는 오해와 함정

## 먼저 결론

대부분의 선택은 아래 표로 충분합니다.

| 상황                                                          | 추천 모드 | 이유                                                                |
| ------------------------------------------------------------- | --------- | ------------------------------------------------------------------- |
| 일반적인 agent, 운영 API, 사람 승인 흐름                      | `async`   | 성능과 복구 가능성의 균형이 가장 좋고, LangGraph 기본값도 이 모드다 |
| 각 step 사이 checkpoint 유실이 특히 민감함                    | `sync`    | 다음 step으로 넘어가기 전에 checkpoint를 먼저 저장한다              |
| 긴 배치인데 중간 step 유실을 감수해도 되고 처리량이 더 중요함 | `exit`    | 실행 종료 시점에만 저장해서 오버헤드가 가장 낮다                    |

## durability가 제어하는 것

공식 문서 기준으로 durability는 "그래프 실행 메서드를 호출할 때 checkpoint를 어느 시점에 저장할지"를 제어합니다.

```python
graph.stream(
    {"input": "test"},
    durability="sync",
)
```

핵심은 "상태를 저장할 저장소가 있어야 의미가 있다"는 점입니다.  
실질적인 장애 복구 이점은 checkpointer를 붙였을 때 생깁니다. 그래서 durability 이야기는 checkpointer와 항상 같이 봐야 합니다.

## 세 모드의 차이

공식 체크포인터 문서의 설명을 실무 말로 풀면 이렇습니다.

### `exit`

- 그래프가 끝날 때만 checkpoint를 저장합니다
- 정상 종료, 에러 종료, human-in-the-loop interrupt 종료 시점에 저장됩니다
- 중간 step 상태는 따로 저장하지 않으므로 프로세스 크래시가 나면 중간부터 복구할 수 없습니다
- 대신 성능 오버헤드는 가장 낮습니다

배치성 요약, 재실행 비용이 낮은 ETL, "실패하면 처음부터 다시 돌려도 된다"는 작업에 어울립니다.

### `async`

- 현재 step의 checkpoint 저장을 비동기로 넘기고 다음 step을 이어서 실행합니다
- 성능과 durability를 균형 있게 가져가기 좋은 기본값입니다
- 다만 실행 중 프로세스가 갑자기 죽으면 마지막 몇 step checkpoint가 저장되지 않았을 가능성은 남습니다

대부분의 API 기반 agent, 대화형 앱, 승인 흐름에서 먼저 고를 모드입니다.

### `sync`

- 다음 step을 시작하기 전에 현재 checkpoint 저장이 끝날 때까지 기다립니다
- step 경계마다 상태를 최대한 보수적으로 보존합니다
- 대신 저장 지연이 곧 실행 지연으로 이어집니다

결제, 외부 시스템 반영, 고비용 tool 호출처럼 "다음 step 전에 현재 상태가 반드시 저장되어야 안심되는" 흐름에 적합합니다.

## 사전 준비

로컬에서 바로 확인하려면 SQLite checkpointer가 제일 간단합니다.

```bash
pip install -U langgraph langgraph-checkpoint-sqlite
```

공식 reference 기준으로 `SqliteSaver`는 데모와 작은 프로젝트에 적합하고, production 용도는 PostgresSaver 계열이 권장됩니다.

## 예제 1. SQLite checkpointer와 함께 durability 지정하기

아래 예제는 주문 처리 워크플로를 아주 단순화한 것입니다.  
중요한 포인트는 `graph.invoke(..., durability="sync")`처럼 실행 시점마다 durability를 고를 수 있다는 점입니다.

```python
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.checkpoint.sqlite import SqliteSaver


class OrderState(TypedDict):
    order_id: str
    validated: bool
    charged: bool


def validate_order(state: OrderState):
    print("validate_order")
    return {"validated": True}


def charge_card(state: OrderState):
    print("charge_card")
    return {"charged": True}


builder = StateGraph(OrderState)
builder.add_node("validate_order", validate_order)
builder.add_node("charge_card", charge_card)
builder.add_edge(START, "validate_order")
builder.add_edge("validate_order", "charge_card")
builder.add_edge("charge_card", END)


with SqliteSaver.from_conn_string("checkpoints.sqlite") as checkpointer:
    graph = builder.compile(checkpointer=checkpointer)

    config = {"configurable": {"thread_id": "order-1001"}}

    result = graph.invoke(
        {
            "order_id": "order-1001",
            "validated": False,
            "charged": False,
        },
        config=config,
        durability="sync",
    )

    print(result)

    history = list(graph.get_state_history(config))
    print("checkpoints:", len(history))
    for snapshot in history[:3]:
        print(snapshot.metadata)
```

이 예제에서 바꿔 볼 값은 딱 하나입니다.

```python
durability="sync"
```

여기를 `async`나 `exit`로 바꾸면 그래프 로직은 그대로 두고 checkpoint 쓰기 전략만 바꿀 수 있습니다.

## 예제 2. 같은 그래프를 상황별로 다른 durability로 실행하기

실무에서는 그래프 정의보다 "호출 맥락"이 durability를 결정하는 경우가 많습니다.

- 운영 API 요청은 `async`
- 야간 재처리 배치는 `exit`
- 금전성 후처리는 `sync`

그래서 같은 compiled graph를 호출별로 다르게 쓰는 패턴이 자연스럽습니다.

```python
from typing import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.checkpoint.memory import InMemorySaver


class JobState(TypedDict):
    text: str
    cleaned: str
    uploaded: bool


def clean_text(state: JobState):
    return {"cleaned": state["text"].strip().lower()}


def upload_result(state: JobState):
    print(f"uploading: {state['cleaned']}")
    return {"uploaded": True}


builder = StateGraph(JobState)
builder.add_node("clean_text", clean_text)
builder.add_node("upload_result", upload_result)
builder.add_edge(START, "clean_text")
builder.add_edge("clean_text", "upload_result")
builder.add_edge("upload_result", END)

graph = builder.compile(checkpointer=InMemorySaver())

config = {"configurable": {"thread_id": "job-1"}}
payload = {"text": "  Hello LangGraph  ", "cleaned": "", "uploaded": False}

print(graph.invoke(payload, config=config, durability="async"))
print(graph.invoke(payload, config=config, durability="sync"))
print(graph.invoke(payload, config=config, durability="exit"))
```

`InMemorySaver()`는 디버깅과 테스트용이라 프로세스가 내려가면 저장 내용이 사라집니다.  
그래도 예제처럼 API 사용 방식 자체를 확인하기에는 가장 간단합니다.

## 어떤 기준으로 고르면 되나

### `async`를 기본값으로 두는 경우

아래 조건이면 먼저 `async`로 시작하는 편이 무난합니다.

- 사용자 응답 속도가 중요하다
- 마지막 한두 step checkpoint 유실 가능성을 운영적으로 감수할 수 있다
- 완전한 step-by-step durability보다 throughput이 더 중요하다
- interrupt, thread resume, short-term memory는 필요하지만 매 step fsync 급 보장은 필요 없다

LangGraph reference 기준으로 `invoke()`의 기본 durability도 `async`입니다.

### `sync`로 올려야 하는 경우

아래 상황이면 `sync`를 검토할 만합니다.

- step 사이 상태 유실 비용이 크다
- 다음 step이 외부 부작용을 만들기 전에 checkpoint를 확실히 남기고 싶다
- 사람이 사후 감사해야 해서 step 경계를 최대한 보수적으로 보존해야 한다

예를 들면 "승인 완료 상태 저장 -> 결제 요청 전송" 사이가 대표적입니다.

### `exit`로 낮춰도 되는 경우

아래 조건이면 `exit`가 더 효율적일 수 있습니다.

- 긴 배치를 최대 throughput으로 처리하고 싶다
- 중간 실패 시 처음부터 재실행해도 된다
- checkpoint 저장 비용이 실제 처리 병목이다
- 중간 replay/debug보다 최종 결과만 중요하다

단, 문서 그대로 중간 실행 중 프로세스 크래시에는 약합니다.

## 자주 헷갈리는 점

### 1. durability를 retry처럼 생각한다

durability는 "언제 저장할지"를 정하는 옵션이지, 실패한 노드를 자동으로 재시도하는 옵션이 아닙니다.  
재시도는 `RetryPolicy`, 실패 후 분기 처리는 `error_handler`가 맡습니다.

### 2. checkpointer 없이 durability만 바꾸면 복구가 될 거라고 생각한다

durability는 checkpoint 저장 시점을 정할 뿐입니다.  
복구 가능한 실행 이력을 원하면 graph를 compile할 때 checkpointer가 있어야 합니다.

### 3. `InMemorySaver`로 운영 durability를 검증한다

공식 reference도 `InMemorySaver`를 디버깅/테스트 용도로만 권장합니다.  
재시작 이후 복구를 보려면 SQLite나 Postgres 같은 실제 저장소 기반 saver가 필요합니다.

### 4. `sync`가 항상 더 "좋다"고 생각한다

`sync`는 더 보수적이지만 더 비쌉니다.  
각 step마다 저장 대기를 하므로 지연과 저장소 부하가 늘 수 있습니다. 중요한 경계에서만 올리는 편이 현실적입니다.

### 5. `exit`를 사람 승인 흐름에 무심코 쓴다

interrupt가 있더라도 exit는 중간 step 체크포인트를 세밀하게 남기는 모드가 아닙니다.  
사람 승인 전후 state를 안정적으로 남기고 재개 가능성을 높이려면 대개 `async` 또는 `sync`가 더 맞습니다.

## 추천 운영 패턴

개인적으로는 아래 순서를 가장 자주 씁니다.

1. 처음 운영 배포는 `async`
2. 감사나 부작용 리스크가 큰 특정 그래프만 `sync`
3. 재처리 배치나 오프라인 파이프라인은 `exit`

그리고 saver는 보통 이렇게 나눕니다.

- 로컬 실험: `InMemorySaver`, `SqliteSaver`
- 작은 내부 도구: `SqliteSaver`
- production: `PostgresSaver` 계열

## 정리

LangGraph durability는 "checkpoint를 남길지 말지"보다 "언제 남길지"에 대한 선택입니다.

- `async`: 대부분의 운영 agent 기본값
- `sync`: step 경계 보존이 특히 중요할 때
- `exit`: 처리량 우선 배치 작업

이 선택은 graph 로직보다 운영 요구사항에 더 가깝습니다.  
그래프를 바꾸기 전에 먼저 "프로세스가 중간에 죽었을 때 어디까지 복구되어야 하는가"를 정하고 durability를 고르는 편이 실전에서 덜 흔들립니다.

## 참고 자료

- [LangGraph checkpointers guide](https://docs.langchain.com/oss/python/langgraph/checkpointers)
- [LangGraph invoke reference](https://reference.langchain.com/python/langgraph/pregel/main/Pregel/invoke)
- [LangGraph checkpoint savers reference](https://reference.langchain.com/python/langgraph/checkpoints)
