---
title: LangGraph set_node_defaults()로 retry, timeout, error_handler 기본값 한 번에 깔기
description: LangGraph 1.2+에서 set_node_defaults()로 graph-wide retry_policy, timeout, error_handler, cache_policy를 공통 적용하는 실전 패턴 정리
date: 2026-07-03
tags:
  - langgraph
  - python
  - workflow
  - reliability
aliases:
  - "/blog/langgraph-set-node-defaults-graph-wide-fault-tolerance"
---

# LangGraph `set_node_defaults()`로 `retry`, `timeout`, `error_handler` 기본값 한 번에 깔기

LangGraph graph가 커지면 금방 비슷한 설정이 반복된다.

- 모든 외부 API 노드에 `RetryPolicy(max_attempts=3)`를 붙인다
- 대부분 노드에 `TimeoutPolicy(...)`를 붙인다
- 실패 시 공통 보상 로직이나 fallback 상태 갱신을 넣는다
- 일부 비싼 노드에는 캐시를 붙인다

처음에는 `add_node(..., retry_policy=..., timeout=..., error_handler=...)`로 충분하다.  
하지만 노드가 10개, 20개를 넘기면 중복이 빠르게 늘고, 어떤 노드만 예외 정책이 다른지 읽기도 어려워진다.

공식 문서 기준으로 `langgraph>=1.2`에서는 `StateGraph.set_node_defaults()`로 이런 공통 정책을 graph 단위 기본값으로 둘 수 있다.  
이 글에서는 아래만 실전 기준으로 정리한다.

- `set_node_defaults()`가 정확히 무엇을 기본값으로 깔아 주는지
- per-node override가 어떻게 동작하는지
- 바로 실행 가능한 Python 예제
- 기본값으로 두면 오히려 헷갈리는 함정

## 언제 특히 유용한가

아래 같은 graph라면 `set_node_defaults()` 체감이 크다.

- 여러 노드가 같은 외부 API, DB, LLM provider에 의존한다
- 대부분 노드에 비슷한 timeout과 retry 기준을 적용하고 싶다
- 공통 error handler로 상태를 남기고 특정 마무리 노드로 보내고 싶다
- 팀 단위로 "이 graph의 기본 실패 정책"을 코드 한곳에서 읽히게 만들고 싶다

반대로 노드별 정책이 거의 모두 다르면 기본값보다 개별 `add_node()` 설정이 더 명확할 수 있다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "langgraph>=1.2"
```

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U "langgraph>=1.2"
```

`set_node_defaults()`와 per-node `timeout`, node-level `error_handler`는 공식 문서 기준 `langgraph>=1.2`가 필요하다.

## 1. 가장 작은 예제

아래 예제는 두 노드에 공통 `retry_policy`, `timeout`, `error_handler`를 깔고, `charge_payment`만 개별 정책으로 override한다.

```python
from typing_extensions import TypedDict

from langgraph.errors import NodeError
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, RetryPolicy, TimeoutPolicy


class OrderState(TypedDict):
    order_id: str
    inventory_status: str
    payment_status: str
    final_status: str


class TemporaryGatewayError(Exception):
    pass


def reserve_inventory(state: OrderState) -> OrderState:
    return {"inventory_status": f"reserved:{state['order_id']}"}


attempts = {"charge_payment": 0}


def charge_payment(state: OrderState) -> OrderState:
    attempts["charge_payment"] += 1
    print(f"charge_payment attempt={attempts['charge_payment']}")

    if attempts["charge_payment"] < 3:
        raise TemporaryGatewayError("gateway timed out")

    return {"payment_status": "paid"}


def default_error_handler(state: OrderState, error: NodeError) -> Command:
    return Command(
        update={"final_status": f"failed_at:{error.node}:{error.error}"},
        goto="finalize",
    )


def finalize(state: OrderState) -> OrderState:
    return {
        "final_status": state.get("final_status", "completed"),
    }


graph = (
    StateGraph(OrderState)
    .set_node_defaults(
        retry_policy=RetryPolicy(
            max_attempts=2,
            initial_interval=0.2,
        ),
        timeout=TimeoutPolicy(run_timeout=10),
        error_handler=default_error_handler,
    )
    .add_node("reserve_inventory", reserve_inventory)
    .add_node(
        "charge_payment",
        charge_payment,
        retry_policy=RetryPolicy(
            max_attempts=4,
            retry_on=TemporaryGatewayError,
            initial_interval=0.2,
        ),
    )
    .add_node("finalize", finalize)
    .add_edge(START, "reserve_inventory")
    .add_edge("reserve_inventory", "charge_payment")
    .add_edge("charge_payment", "finalize")
    .add_edge("finalize", END)
    .compile()
)


result = graph.invoke(
    {
        "order_id": "ord-123",
        "inventory_status": "",
        "payment_status": "",
        "final_status": "",
    }
)

print(result)
```

이 예제의 핵심은 아래다.

- `reserve_inventory`는 기본 retry/timeout/error_handler를 그대로 쓴다
- `charge_payment`는 기본값 대신 더 긴 재시도 정책으로 override한다
- 어떤 노드가 최종 실패하든 공통 `default_error_handler`가 상태를 남기고 `finalize`로 보낸다

즉 "기본 정책은 한 번만 선언하고, 진짜 예외 노드만 개별 설정"하는 구조가 된다.

## 2. 기본값과 override 우선순위

공식 문서 기준으로 per-node 값은 항상 `set_node_defaults()`보다 우선한다.  
또한 기본값은 `compile()` 시점에 해석되므로, 선언 순서도 크게 중요하지 않다.

```python
builder = StateGraph(OrderState)

builder.add_node("step_a", reserve_inventory)
builder.add_node(
    "step_b",
    charge_payment,
    timeout=TimeoutPolicy(run_timeout=30),
)

builder.set_node_defaults(
    timeout=TimeoutPolicy(run_timeout=5),
    retry_policy=RetryPolicy(max_attempts=3),
)

graph = builder.compile()
```

이 경우:

- `step_a`는 `run_timeout=5`
- `step_b`는 `run_timeout=30`

즉 공통 정책은 baseline이고, 명시적 node 설정이 최종값이다.

## 3. 어떤 옵션을 기본값으로 둘 수 있나

공식 fault tolerance 문서 기준으로 `set_node_defaults()`는 아래 항목을 받을 수 있다.

- `retry_policy`
- `timeout`
- `error_handler`
- `cache_policy`

실전에서는 보통 아래 조합이 먼저 유용하다.

### 공통 retry + timeout

외부 의존성이 많은 graph라면 가장 먼저 붙일 조합이다.

```python
builder.set_node_defaults(
    retry_policy=RetryPolicy(max_attempts=3),
    timeout=TimeoutPolicy(idle_timeout=20),
)
```

### 공통 error handler

실패 시 무조건 graph 전체를 터뜨리기보다, 상태를 남기고 마무리 노드로 보내고 싶을 때 유용하다.

```python
from langgraph.errors import NodeError
from langgraph.types import Command


def default_handler(state, error: NodeError) -> Command:
    return Command(
        update={"status": f"recovered_from:{error.node}"},
        goto="finalize",
    )
```

### 공통 cache policy

같은 입력으로 반복 호출되는 비싼 pure node가 많다면 캐시도 기본값으로 줄 수 있다.

다만 모든 노드가 캐시 대상인 것은 아니다. 부작용이 있는 쓰기 노드나 시간 의존 노드는 기본 캐시 대상에서 빼는 편이 안전하다.

## 4. error handler node에는 일부 기본값이 자동 제외된다

이 부분이 꽤 중요하다.  
공식 문서의 applicability matrix 기준으로 error-handler node에는 모든 기본값이 그대로 적용되지는 않는다.

- `retry_policy`: 적용됨
- `timeout`: 적용됨
- `error_handler`: 적용되지 않음
- `cache_policy`: 적용되지 않음

이 제약은 합리적이다.

- handler가 자기 자신을 다시 handler로 감싸면 무한 self-catch가 생길 수 있다
- handler 결과를 캐시하면 복구 로직이 상황과 어긋날 수 있다

그래서 "기본 error handler를 graph 전체에 깔았는데 handler 내부 예외는 왜 다시 잡히지 않지?" 같은 상황은 정상 동작일 수 있다.

## 5. 자주 겪는 함정

### 1. 모든 노드에 같은 재시도 정책이 맞다고 가정한다

기본값은 baseline일 뿐이다.  
예를 들어 아래는 성격이 다르다.

- 짧은 조회 노드
- 결제 승인 노드
- LLM 호출 노드
- cleanup/finalizer 노드

특히 부작용 있는 쓰기 노드는 재시도보다 멱등성 설계가 먼저다.

### 2. 공통 error handler를 넣고 원래 예외 원인을 잃어버린다

`NodeError`에는 실패한 node 이름과 원래 예외가 들어 있다.  
상태만 `"failed"`로 바꾸고 끝내면 어떤 노드가 왜 실패했는지 추적이 어려워진다.

보통은 최소한 아래 둘 중 하나는 남기는 편이 좋다.

- `error.node`
- `str(error.error)`

### 3. parent graph 기본값이 subgraph에도 자동 상속된다고 생각한다

공식 문서 기준으로 기본값 scope는 graph별이다.  
즉 parent graph의 `set_node_defaults()`는 subgraph에 자동 상속되지 않는다.

subgraph에도 같은 기본 정책이 필요하면 그 graph 안에서 다시 선언해야 한다.

### 4. timeout과 retry 순서를 반대로 이해한다

문서 기준 동작 순서는 이렇다.

1. node attempt가 예외를 낸다
2. `retry_policy`가 재시도 여부를 결정한다
3. 재시도가 모두 소진된 뒤에야 `error_handler`가 실행된다

즉 timeout이 났다고 바로 error handler가 도는 것이 아니라, timeout 예외도 재시도 정책을 먼저 통과한다.

## 정리

`set_node_defaults()`는 LangGraph graph의 실패 정책을 "복붙된 옵션 모음"이 아니라 "graph 차원의 기본 운영 규칙"으로 끌어올리는 도구에 가깝다.

- 공통 `retry_policy`, `timeout`, `error_handler`, `cache_policy`를 한 곳에서 선언한다
- 예외 노드만 `add_node()`에서 override한다
- error-handler node와 subgraph에는 적용 범위를 따로 이해해야 한다
- `langgraph>=1.2` 기준 기능이라 버전 조건을 먼저 확인한다

노드 수가 늘수록 이 패턴은 단순한 편의 기능이 아니라 유지보수 장치가 된다.  
특히 fault tolerance 정책을 팀 규약처럼 읽히게 만들고 싶다면, `set_node_defaults()`를 graph 초반에 선언해 두는 편이 가장 깔끔하다.

## References

- [LangGraph Fault tolerance](https://docs.langchain.com/oss/python/langgraph/fault-tolerance)
- [LangGraph StateGraph.set_node_defaults reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/set_node_defaults/)
- [LangGraph RetryPolicy reference](https://reference.langchain.com/python/langgraph/types/#langgraph.types.RetryPolicy)
- [LangGraph TimeoutPolicy reference](https://reference.langchain.com/python/langgraph/types/#langgraph.types.TimeoutPolicy)
