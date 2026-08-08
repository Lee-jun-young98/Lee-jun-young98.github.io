---
title: LangGraph invoke v2와 GraphOutput으로 결과와 interrupt 분리하기
description: invoke와 ainvoke의 version="v2"가 반환하는 GraphOutput.value와 interrupts를 사용해 정상 완료와 human-in-the-loop 대기를 명시적으로 구분하는 방법
date: 2026-08-08
tags:
  - langgraph
  - invocation
  - interrupts
  - typing
  - python
---

# LangGraph invoke v2와 GraphOutput으로 결과와 interrupt 분리하기

LangGraph 1.1부터 `invoke()`와 `ainvoke()`에 `version="v2"`를 전달하면 반환값이 `GraphOutput`으로 통일된다. graph의 출력은 `result.value`, 실행 중 발생한 동적 interrupt는 `result.interrupts`에서 읽는다.

기존 v1에서는 interrupt가 state dict의 `__interrupt__` 키에 섞였다. 애플리케이션이 정상 출력과 제어 메타데이터를 같은 dict에서 구분해야 했고, Pydantic이나 dataclass 출력 스키마와도 경계가 흐려졌다. v2는 이 둘을 별도 필드로 나눠 호출부의 분기를 명확하게 만든다.

> [!important]
> 2026년 8월 기준 v2는 opt-in이다. `version="v2"`를 생략하면 기본값은 여전히 v1이므로, 반환 타입을 바꾸는 호출부터 명시적으로 마이그레이션한다.

## 사전 준비

Python 3.10+와 LangGraph 1.1 이상이 필요하다.

```bash
pip install -U "langgraph>=1.1"
```

interrupt를 재개하려면 checkpointer와 안정적인 `thread_id`가 필요하다. 아래 예제는 동작 확인을 위해 `InMemorySaver`를 쓰지만, 운영에서는 SQLite나 PostgreSQL 기반 checkpointer를 사용한다.

## 실행 가능한 최소 예제

아래 graph는 주문 금액을 계산한 뒤 승인을 기다린다. 최초 호출은 interrupt 정보를 반환하고, 같은 thread를 `Command(resume=...)`로 재개하면 최종 state를 반환한다.

```python
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, GraphOutput, interrupt


class State(TypedDict):
    order_id: str
    amount: int
    approved: bool
    status: str


def request_approval(state: State):
    approved = interrupt(
        {
            "question": "이 주문을 승인할까요?",
            "order_id": state["order_id"],
            "amount": state["amount"],
        }
    )
    return {
        "approved": bool(approved),
        "status": "approved" if approved else "rejected",
    }


builder = StateGraph(State)
builder.add_node("request_approval", request_approval)
builder.add_edge(START, "request_approval")
builder.add_edge("request_approval", END)
graph = builder.compile(checkpointer=InMemorySaver())

config = {"configurable": {"thread_id": "order-1001"}}

paused = graph.invoke(
    {"order_id": "1001", "amount": 50_000, "approved": False, "status": "new"},
    config=config,
    version="v2",
)

assert isinstance(paused, GraphOutput)
assert len(paused.interrupts) == 1
print(paused.interrupts[0].value)
print(paused.value["status"])  # new: interrupt 이전까지 저장된 state

finished = graph.invoke(
    Command(resume=True),
    config=config,
    version="v2",
)

assert finished.interrupts == ()
print(finished.value["status"])  # approved
```

`interrupt()`가 실행되면 node는 완료된 것이 아니므로 `paused.value`에는 해당 node가 반환할 update가 아직 없다. 승인 값은 재개 시 `interrupt()`의 반환값이 되고, node가 처음부터 다시 실행된 뒤 최종 state에 반영된다.

## 호출부를 완료와 대기로 나누기

HTTP handler나 worker에서는 state 안의 특수 키보다 `interrupts` 자체를 먼저 검사한다.

```python
result = graph.invoke(payload, config=config, version="v2")

if result.interrupts:
    response = {
        "status": "waiting_for_input",
        "requests": [item.value for item in result.interrupts],
        "state": result.value,
    }
else:
    response = {
        "status": "completed",
        "result": result.value,
    }
```

병렬 node 여러 개가 동시에 멈추면 `interrupts`에 여러 항목이 들어올 수 있다. 첫 항목만 있다고 가정하지 말고, 각 `Interrupt.id`를 UI 요청과 연결한 뒤 `{interrupt_id: answer}` 형태의 resume map을 사용한다.

`ainvoke()`도 같은 계약을 사용한다.

```python
result = await graph.ainvoke(payload, config=config, version="v2")
if result.interrupts:
    await save_pending_review(result.interrupts, result.value)
```

## v1에서 점진적으로 옮기기

v1 코드는 보통 다음처럼 state와 interrupt를 한 dict에서 읽는다.

```python
result = graph.invoke(payload, config=config)
pending = result.get("__interrupt__", ())
```

v2에서는 다음처럼 바꾼다.

```python
result = graph.invoke(payload, config=config, version="v2")
state = result.value
pending = result.interrupts
```

`GraphOutput`의 dict 방식 접근은 점진적 전환을 위해 호환되지만 deprecated 상태다. 새 코드에서 `result["key"]`, `"key" in result`, `result["__interrupt__"]`에 의존하지 않는다. wrapper 함수 하나에서 v1/v2를 섞기보다 API endpoint나 worker 단위로 반환 계약을 전환하고 타입 검사를 함께 갱신하는 편이 안전하다.

## 흔한 함정

- `version="v2"`를 `config["configurable"]` 안에 넣지 않는다. `invoke()`와 `ainvoke()`의 직접 keyword argument다.
- `result.value`만 반환하면 interrupt를 정상 완료로 오해할 수 있다. 항상 `result.interrupts`를 먼저 확인한다.
- 재개할 때 새 `thread_id`를 만들면 기존 checkpoint를 찾지 못한다. 최초 호출과 같은 ID를 사용한다.
- interrupt 재개에는 `Command(resume=...)`를 사용한다. 일반적인 후속 사용자 메시지는 plain dict 입력으로 새 graph run을 시작한다.
- node는 재개 시 `interrupt()`가 있던 줄부터가 아니라 처음부터 다시 실행된다. interrupt 앞의 결제, 전송 같은 side effect는 멱등하게 만든다.
- `GraphOutput`은 stream chunk 형식이 아니다. `stream()`과 `astream()`의 v2 `StreamPart` 처리와 혼동하지 않는다.
- 라이브러리 코드와 RemoteGraph의 지원 버전이 다를 수 있으므로 client/server 패키지를 함께 업그레이드하고 계약 테스트를 둔다.

## 참고 자료

- [LangGraph Streaming: invoke v2와 GraphOutput](https://docs.langchain.com/oss/python/langgraph/streaming#invoke-and-ainvoke)
- [LangGraph Interrupts 공식 가이드](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [GraphOutput 공식 API 레퍼런스](https://reference.langchain.com/python/langgraph/types/GraphOutput)
- [LangGraph changelog: v1.1](https://docs.langchain.com/oss/python/releases/changelog#langgraph-v11)
