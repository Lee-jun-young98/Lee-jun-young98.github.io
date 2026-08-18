---
title: LangGraph entrypoint.final로 반환값과 저장 상태 분리하기
description: Functional API에서 entrypoint.final의 value와 save를 나눠 공개 응답과 다음 호출의 previous 상태를 독립적으로 설계하는 방법
date: 2026-08-18
tags:
  - langgraph
  - functional-api
  - persistence
  - python
aliases:
  - /blog/langgraph-entrypoint-final-return-save-state
---

# LangGraph entrypoint.final로 반환값과 저장 상태 분리하기

Functional API의 `@entrypoint`는 같은 `thread_id`로 다시 호출할 때 직전 반환값을 `previous`에 넣어 줍니다. 하지만 API 응답과 다음 실행에 필요한 내부 상태가 항상 같지는 않습니다.

예를 들어 호출자에게는 이번 주문의 간단한 영수증만 반환하고, checkpoint에는 누적 금액과 처리 건수를 저장하고 싶을 수 있습니다. 이때 `entrypoint.final(value=..., save=...)`을 사용하면 두 값을 분리할 수 있습니다.

```python
return entrypoint.final(
    value={"charged": amount},  # 이번 호출의 반환값
    save={"total": total, "count": count},  # 다음 호출의 previous
)
```

## 사전 준비

Python 3.10 이상과 LangGraph를 설치합니다. 예제에는 모델이나 API key가 필요하지 않습니다.

```bash
pip install -U langgraph
```

checkpoint를 사용해야 호출 사이의 저장 상태가 유지됩니다. 운영 환경에서는 SQLite나 Postgres checkpointer를 쓰고, 아래 예제는 동작 확인을 위해 `InMemorySaver`를 사용합니다.

## 실행 가능한 예제

같은 고객 thread에서 결제 금액을 누적하되, 각 호출에는 이번 결제 결과만 반환합니다.

```python
from typing import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.func import entrypoint


class Ledger(TypedDict):
    total: int
    count: int


class Receipt(TypedDict):
    charged: int
    transaction_no: int


checkpointer = InMemorySaver()


@entrypoint(checkpointer=checkpointer)
def charge(
    amount: int,
    *,
    previous: Ledger | None = None,
) -> entrypoint.final[Receipt, Ledger]:
    ledger = previous or {"total": 0, "count": 0}
    next_ledger: Ledger = {
        "total": ledger["total"] + amount,
        "count": ledger["count"] + 1,
    }
    receipt: Receipt = {
        "charged": amount,
        "transaction_no": next_ledger["count"],
    }
    return entrypoint.final(value=receipt, save=next_ledger)


config = {"configurable": {"thread_id": "customer-42"}}

print(charge.invoke(10_000, config=config))
print(charge.invoke(5_000, config=config))
```

실행 결과는 다음과 같습니다.

```text
{'charged': 10000, 'transaction_no': 1}
{'charged': 5000, 'transaction_no': 2}
```

두 번째 호출의 `previous`는 첫 번째 영수증이 아니라 첫 번째 호출에서 지정한 `save`, 즉 `{"total": 10000, "count": 1}`입니다. 호출자는 내부 누적 상태를 받지 않지만 workflow는 같은 thread에서 계속 사용할 수 있습니다.

## 일반 return과 무엇이 다른가

일반 값을 반환하면 그 값이 호출 결과이면서 다음 호출의 `previous`가 됩니다.

```python
@entrypoint(checkpointer=checkpointer)
def accumulate(amount: int, *, previous: int | None = None) -> int:
    return (previous or 0) + amount
```

반면 `entrypoint.final[R, S]`은 공개 반환 타입 `R`과 저장 타입 `S`를 별도로 표현합니다.

```python
@entrypoint(checkpointer=checkpointer)
def workflow(...) -> entrypoint.final[Receipt, Ledger]:
    return entrypoint.final(value=receipt, save=ledger)
```

여기서 `final`은 실행을 조기에 끝내는 제어문이 아닙니다. entrypoint가 최종적으로 반환할 때 결과와 checkpoint 상태를 포장하는 값 객체입니다.

## 언제 유용한가

- 채팅 API에는 최신 `AIMessage`만 반환하고, `save`에는 전체 대화 기록을 보관할 때
- 호출자에게는 성공 여부나 요약만 노출하고, 다음 실행에는 누적 통계나 내부 cursor가 필요할 때
- 공개 응답 스키마를 작고 안정적으로 유지하면서 workflow 메모리 구조를 독립적으로 바꿀 때
- 상태에 민감한 내부 필드가 있지만 응답에는 노출하면 안 될 때

단, `save`는 애플리케이션 응답에서 숨겨질 뿐 checkpoint에는 기록됩니다. 비밀 값이나 불필요한 개인정보를 저장해도 된다는 뜻은 아닙니다.

## thread별 상태는 독립적이다

`previous`는 같은 `thread_id`의 직전 저장 상태입니다. 다른 고객이나 세션이 같은 ID를 공유하면 상태도 섞이므로, 인증된 사용자와 대화 세션을 기준으로 안정적이고 충돌 없는 ID를 만들어야 합니다.

```python
other = {"configurable": {"thread_id": "customer-99"}}
print(charge.invoke(2_000, config=other))
# {'charged': 2000, 'transaction_no': 1}
```

새 thread의 `previous`는 `None`에서 시작합니다. 같은 thread의 새 입력은 평범한 값으로 `invoke()`하고, `Command(resume=...)`는 `interrupt()`로 멈춘 실행을 재개할 때만 사용합니다.

## 자주 놓치는 함정

- checkpointer 없이 `previous`가 유지되기를 기대합니다. 호출 간 상태에는 checkpointer와 같은 `thread_id`가 모두 필요합니다.
- `value`와 `save`의 의미를 반대로 넣습니다. `value`는 현재 호출자에게, `save`는 다음 호출의 `previous`로 갑니다.
- `entrypoint.final`을 함수 중간의 조기 반환이나 그래프 종료 명령으로 이해합니다. Python의 `return`과 함께 entrypoint의 최종 결과로 사용해야 합니다.
- `get_state().values`가 곧 `save`라고 가정합니다. Functional API의 state snapshot에는 최신 공개 출력이 보일 수 있으므로, 다음 호출에 주입된 `previous`나 checkpointer의 checkpoint channel을 기준으로 저장 동작을 확인합니다.
- 같은 thread에서 `save` 타입을 예고 없이 바꿉니다. 이미 저장된 `previous`와 새 코드가 충돌할 수 있으므로 schema migration이나 새 thread namespace를 준비합니다.
- 직렬화할 수 없는 객체를 저장합니다. durable checkpoint를 고려해 dict, list, 문자열, 숫자처럼 serializer가 처리할 수 있는 값으로 구성합니다.
- 내부 상태를 응답에서 숨겼으니 안전하다고 생각합니다. checkpoint 접근 통제, 암호화, 보존 기간은 별도로 설계해야 합니다.

## 정리

`entrypoint.final(value, save)`은 Functional API의 공개 결과와 단기 메모리를 분리합니다. `value`는 이번 호출의 응답이고 `save`는 같은 thread의 다음 호출에서 `previous`가 됩니다. 응답 계약과 내부 누적 상태의 수명이 다를 때 이 경계를 명시하면 API는 단순하게 유지하면서도 stateful workflow를 만들 수 있습니다.

## 참고 자료

- [Functional API overview](https://docs.langchain.com/oss/python/langgraph/functional-api)
- [Use the Functional API: Decouple return value from saved value](https://docs.langchain.com/oss/python/langgraph/use-functional-api#decouple-return-value-from-saved-value)
- [entrypoint.final API reference](https://reference.langchain.com/python/langgraph/func/entrypoint/final)
- [entrypoint API reference](https://reference.langchain.com/python/langgraph/func/entrypoint)
