---
title: "LangGraph error_handler로 실패 후 보상 흐름과 대체 경로 만들기"
description: "LangGraph에서 error_handler, NodeError, Command를 사용해 재시도 소진 뒤 보상 상태를 남기고 다음 노드로 우회하는 실전 패턴 정리"
date: 2026-06-16
tags:
  - langgraph
  - workflow
  - reliability
  - python
aliases:
  - "/blog/langgraph-error-handler-recovery-routing"
---

# LangGraph `error_handler`로 실패 후 보상 흐름과 대체 경로 만들기

LangGraph workflow를 운영하다 보면 "실패하면 그냥 graph 전체를 죽이는 것"보다 더 나은 대응이 필요할 때가 많다.

- 결제 승인 실패 뒤 예약 상태를 보상 처리하고 싶다
- 외부 API가 끝내 복구되지 않으면 fallback 경로로 보내고 싶다
- 사람 검토 큐로 넘기면서 실패 원인을 state에 남기고 싶다

이럴 때 LangGraph는 노드 단위 `error_handler`를 제공한다.  
공식 문서 기준으로 `error_handler`는 해당 노드의 재시도가 모두 끝난 뒤 실행되며, `NodeError`를 받아 상태를 갱신하거나 `Command`로 다른 노드로 라우팅할 수 있다.

이번 글에서는 Python Graph API 기준으로 아래만 실전적으로 정리한다.

- `error_handler`가 정확히 언제 실행되는지
- `RetryPolicy`와 어떤 순서로 조합되는지
- 보상 상태 기록과 fallback 라우팅 예제
- `interrupt()`나 validation error와 헷갈리기 쉬운 지점

## 언제 유용한가

아래 조건이면 `error_handler`를 먼저 검토할 가치가 크다.

- 실패를 "예외 발생"으로 끝내지 말고 상태에 남겨야 할 때
- 실패 뒤 사람 검토, fallback 응답, 정리 단계로 우회해야 할 때
- saga처럼 보상 흐름을 graph 안에서 명시하고 싶을 때
- 재시도는 하되, 끝내 실패하면 graph 전체 중단은 피하고 싶을 때

반대로 입력 검증 오류처럼 즉시 호출자에게 실패를 돌려줘야 하는 경우에는 굳이 handler를 두지 않는 편이 더 단순하다.

## 사전 준비

공식 문서 기준 `error_handler`는 `langgraph>=1.2`가 필요하다.

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

## 핵심 동작 먼저 이해하기

LangGraph fault tolerance 흐름은 아래 순서로 생각하면 된다.

1. 노드 실행
2. 예외 발생
3. `RetryPolicy`가 재시도 여부 판단
4. 재시도가 모두 소진되면 `error_handler` 실행
5. handler가 state를 갱신하거나 `Command`로 다음 노드를 지정

즉 `error_handler`는 "재시도 대신 쓰는 것"이 아니라 "재시도 이후 최종 복구 경로"에 가깝다.

## 가장 작은 예제

아래 예제는 결제 승인 노드가 두 번 재시도한 뒤에도 실패하면, handler가 상태를 남기고 `finalize` 노드로 우회한다.

```python
from typing_extensions import TypedDict

from langgraph.errors import NodeError
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, RetryPolicy


class OrderState(TypedDict):
    order_id: str
    status: str
    failure_reason: str


attempt_counter = {"charge_payment": 0}


def reserve_inventory(state: OrderState) -> OrderState:
    return {"status": "inventory_reserved", "failure_reason": ""}


def charge_payment(state: OrderState) -> OrderState:
    attempt_counter["charge_payment"] += 1
    attempt = attempt_counter["charge_payment"]
    print(f"charge_payment attempt={attempt}")
    raise ConnectionError("payment gateway timeout")


def payment_error_handler(state: OrderState, error: NodeError) -> Command:
    return Command(
        update={
            "status": "manual_review_required",
            "failure_reason": f"{error.node}: {error.error}",
        },
        goto="finalize",
    )


def finalize(state: OrderState) -> OrderState:
    if state["status"] == "manual_review_required":
        print("fallback: notify ops queue")
    return state


graph = (
    StateGraph(OrderState)
    .add_node("reserve_inventory", reserve_inventory)
    .add_node(
        "charge_payment",
        charge_payment,
        retry_policy=RetryPolicy(max_attempts=2, retry_on=ConnectionError),
        error_handler=payment_error_handler,
    )
    .add_node("finalize", finalize)
    .add_edge(START, "reserve_inventory")
    .add_edge("reserve_inventory", "charge_payment")
    .add_edge("finalize", END)
    .compile()
)

result = graph.invoke(
    {"order_id": "order-42", "status": "created", "failure_reason": ""}
)
print(result)
```

예상 흐름은 대략 이렇다.

```text
charge_payment attempt=1
charge_payment attempt=2
fallback: notify ops queue
{
  'order_id': 'order-42',
  'status': 'manual_review_required',
  'failure_reason': 'charge_payment: payment gateway timeout'
}
```

핵심은 세 가지다.

- `max_attempts=2`는 첫 시도 포함 총 2번이다
- 두 번 다 실패한 뒤에만 handler가 실행된다
- handler가 `goto="finalize"`를 반환하므로 graph는 abort 대신 우회한다

## `NodeError`에서 무엇을 받을 수 있나

공식 문서 기준 error handler는 `error: NodeError`를 타입 주입받을 수 있다.

- `error.node`: 실패한 노드 이름
- `error.error`: 원본 예외 객체

실무에서는 보통 아래 용도로 충분하다.

- 어떤 노드에서 실패했는지 state에 기록
- 사람 검토 큐 payload에 원인 포함
- 특정 노드 실패일 때만 보상 로직 분기

```python
def payment_error_handler(state: OrderState, error: NodeError) -> Command:
    if error.node == "charge_payment":
        next_status = "manual_review_required"
    else:
        next_status = "unknown_failure"

    return Command(
        update={
            "status": next_status,
            "failure_reason": str(error.error),
        },
        goto="finalize",
    )
```

## 언제 `Command`를 쓰고, 언제 그냥 state만 반환할까

둘 다 가능하지만 목적이 다르다.

- 그냥 state 반환: 현재 흐름을 유지하면서 상태만 바꾸고 싶을 때
- `Command(update=..., goto=...)`: 실패 후 다른 노드로 우회하고 싶을 때

복구 노드, 사람 검토 노드, 취소/정산 노드처럼 "실패 후 전용 경로"가 있다면 `Command`가 더 명확하다.

## `interrupt()`는 error handler로 가지 않는다

이건 운영에서 자주 헷갈린다.  
공식 문서 기준 `interrupt()`는 `GraphBubbleUp` 메커니즘으로 pause를 만들기 때문에 retry와 error handler를 우회한다.

즉 아래처럼 역할을 나누면 된다.

- 사람 입력 대기: `interrupt()`
- 일시 실패 복구: `RetryPolicy`
- 최종 실패 후 보상/우회: `error_handler`

## 실전에서 많이 쓰는 패턴

### 1. 사람 검토 큐로 우회하기

자동 처리 실패 시 전체 graph를 죽이기보다 review queue state를 남기고 종료하는 방식이다.

```python
def error_handler(state: OrderState, error: NodeError) -> Command:
    return Command(
        update={
            "status": "queued_for_review",
            "failure_reason": str(error.error),
        },
        goto="finalize",
    )
```

### 2. 보상 상태를 분리해서 남기기

`status` 하나만 바꾸면 나중에 왜 그런 상태가 되었는지 추적이 어렵다.  
최소한 아래 둘은 분리하는 편이 좋다.

- 현재 업무 상태
- 실패 원인 또는 보상 이유

### 3. subgraph 감싸는 부모 노드에 handler 두기

공식 문서 기준 subgraph 내부의 미처리 예외는 부모 노드까지 올라온다.  
그래서 "하위 워크플로 전체 실패 시 부모에서 한 번에 보상" 패턴을 만들 수 있다.

## 자주 틀리는 점

### 1. validation error까지 전부 복구하려고 한다

빈 입력, 잘못된 enum, state shape 오류 같은 것은 보통 retry나 fallback보다 즉시 실패가 맞다.  
모든 실패를 handler로 삼키면 버그가 늦게 드러난다.

### 2. handler 안에서 또 부작용을 멱등성 없이 실행한다

예를 들어 handler가 티켓 생성, 이메일 발송, DB 쓰기를 하면 그 자체도 실패하거나 재실행될 수 있다.  
보상 로직도 일반 노드처럼 멱등성을 생각해야 한다.

### 3. `interrupt()`도 handler가 잡아 줄 거라고 생각한다

그렇지 않다.  
사람 승인 대기와 오류 복구는 별도 흐름이다.

### 4. 재시도 없는 handler만 붙이고 transient failure를 놓친다

일시적인 네트워크 오류라면 바로 fallback으로 보내기보다 `RetryPolicy`를 먼저 두는 편이 낫다.  
`error_handler`는 보통 "정말 끝까지 실패했을 때"의 마지막 경로다.

### 5. 실패 원인을 state에 남기지 않는다

실패 후 우회만 하고 원인을 기록하지 않으면, 나중에 "왜 manual review로 갔는가"를 다시 추적하기 어렵다.  
최소한 `error.node`와 `str(error.error)`는 남겨 두는 편이 좋다.

## 추천 기준

개인적으로는 아래 기준이면 대부분 충분하다.

1. 재시도 가능한 예외만 `RetryPolicy`로 먼저 좁힌다
2. 최종 실패 시 남길 상태 필드를 미리 만든다
3. handler에서는 가능하면 `Command`로 복구 경로를 명시한다
4. 사람 승인 대기와 오류 복구는 분리한다
5. handler 안의 부작용도 멱등성 있게 설계한다

## 마무리

LangGraph의 `error_handler`는 단순한 예외 후처리가 아니라, 실패를 workflow 안의 명시적인 상태 전이로 바꾸는 도구에 가깝다.

- retry 이후 마지막 복구 경로를 정의할 수 있고
- `NodeError`로 실패 맥락을 읽을 수 있고
- `Command`로 fallback, compensation, review queue 흐름을 연결할 수 있다

실전 workflow는 "성공 경로"만큼 "어떻게 실패를 수습할지"가 중요하다.  
`error_handler`를 붙이면 그 수습 절차를 코드 바깥 주석이 아니라 graph 안의 흐름으로 남길 수 있다.

## 참고 자료

- [LangGraph Fault tolerance](https://docs.langchain.com/oss/python/langgraph/fault-tolerance)
- [LangGraph Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph `NodeError` Reference](https://reference.langchain.com/python/langgraph/errors/#langgraph.errors.NodeError)
- [LangGraph `StateGraph.add_node` Reference](https://reference.langchain.com/python/langgraph/graphs/#langgraph.graph.state.StateGraph.add_node)
