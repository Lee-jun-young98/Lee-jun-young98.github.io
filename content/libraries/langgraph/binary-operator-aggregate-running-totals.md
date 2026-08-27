---
title: LangGraph BinaryOperatorAggregate로 running total 만들기
description: Pregel의 BinaryOperatorAggregate 채널로 여러 super-step의 update를 reducer에 즉시 반영해 합계와 카운터를 유지하는 방법
date: 2026-08-27
tags:
  - langgraph
  - pregel
  - python
  - channels
  - reducer
aliases:
  - /blog/langgraph-binary-operator-aggregate-running-totals
---

# LangGraph BinaryOperatorAggregate로 running total 만들기

저수준 Pregel API에서 여러 actor가 만든 숫자를 실행 내내 합산해야 할 때 모든 값을 `Topic` 목록에 저장한 뒤 다시 더할 필요는 없습니다. `BinaryOperatorAggregate`는 현재 값과 새 update에 이항 연산자를 적용해 **하나의 누적값**을 유지합니다.

```python
import operator
from langgraph.channels import BinaryOperatorAggregate

total = BinaryOperatorAggregate(int, operator.add)
```

`int()`가 초기값 `0`을 만들고, 각 write가 들어올 때마다 `operator.add(current, update)`가 실행됩니다. 합계, 카운터, 최댓값처럼 전체 원본보다 집계 결과가 중요한 workflow에 잘 맞습니다.

## 사전 준비

Python 3.10 이상과 LangGraph를 설치합니다. 아래 예제는 LLM이나 API key 없이 실행할 수 있습니다.

```bash
pip install -U langgraph
```

## 실행 가능한 예제

첫 actor가 주문 금액을 검증해 `subtotal`과 `total`에 쓰고, 다음 actor가 수수료를 계산해 같은 `total` 채널에 추가하는 예제입니다.

```python
import operator

from langgraph.channels import BinaryOperatorAggregate, EphemeralValue
from langgraph.pregel import NodeBuilder, Pregel


validate_order = (
    NodeBuilder()
    .subscribe_only("order_amount")
    .do(lambda amount: amount if amount >= 0 else 0)
    .write_to("subtotal", "total")
)

add_fee = (
    NodeBuilder()
    .subscribe_only("subtotal")
    .do(lambda subtotal: round(subtotal * 0.1, 2))
    .write_to("total")
)

app = Pregel(
    nodes={"validate_order": validate_order, "add_fee": add_fee},
    channels={
        "order_amount": EphemeralValue(float),
        "subtotal": EphemeralValue(float),
        "total": BinaryOperatorAggregate(float, operator.add),
    },
    input_channels=["order_amount"],
    output_channels=["total"],
)

result = app.invoke({"order_amount": 120.0})
print(result)
assert result == {"total": 132.0}
```

출력은 다음과 같습니다.

```text
{'total': 132.0}
```

첫 super-step에서 `120.0`, 다음 step에서 수수료 `12.0`이 쓰입니다. 채널은 원본 목록 대신 reducer 적용 결과인 `132.0`만 유지합니다.

## 초기값은 타입 생성자가 만든다

첫 번째 인자인 타입은 값 검증 표시에만 쓰이지 않습니다. 채널 생성 시 인자 없는 생성자 호출로 초기값을 만듭니다.

- `int`는 `0`, `float`는 `0.0`, `list`는 `[]`에서 시작합니다.
- 인자 없이 만들 수 없는 사용자 정의 타입은 그대로 넘기지 말고 기본 생성 가능한 누적 상태 타입을 설계합니다.
- `max`처럼 항등원이 애매한 연산은 초기값이 실제 데이터에 영향을 주지 않는지 확인합니다. 음수만 들어오는 최댓값에 `int()`의 `0`을 쓰면 결과가 틀릴 수 있습니다.

초기값 의미가 불분명하다면 `None`을 허용하는 payload와 명시적인 reducer를 사용하거나, 첫 값 초기화를 별도 node에서 처리하는 편이 안전합니다.

## 같은 step의 여러 write도 reducer로 합친다

여러 actor가 같은 super-step에서 한 채널에 update를 써도 `BinaryOperatorAggregate`는 각 update를 reducer로 결합합니다. 이때 병렬 write의 적용 순서를 업무 규칙으로 사용하면 안 됩니다.

덧셈처럼 결합 순서에 결과가 흔들리지 않는 연산이 가장 안전합니다. 문자열 연결이나 순서 의존적인 list 조작이 필요하면 producer ID와 정렬 key를 함께 저장하거나, `Topic`으로 모은 뒤 후속 actor에서 명시적으로 정렬합니다.

## Topic과 무엇이 다른가

- 모든 원본 update를 후속 actor가 각각 소비해야 하면 `Topic`을 사용합니다.
- 현재 값과 update를 즉시 합쳐 running total 하나만 유지하려면 `BinaryOperatorAggregate`를 사용합니다.
- 다음 step에만 필요한 단일 신호라면 `EphemeralValue`가 더 적합합니다.
- 일반적인 `StateGraph` field라면 `Annotated[value_type, reducer]`가 같은 의도를 더 높은 수준에서 표현합니다. 직접 채널을 조립해야 할 때만 Pregel API를 우선 고려합니다.

`BinaryOperatorAggregate`는 reducer를 write 시점에 실행하고 합쳐진 값이 checkpoint에 저장됩니다. 반면 `DeltaChannel`은 raw delta를 저장하고 값을 읽거나 복원할 때 bulk reducer를 실행하므로, 긴 누적 state의 checkpoint 크기와 읽기 비용 사이의 선택이 다릅니다.

## 체크포인트와 재실행 경계

checkpointer를 붙이면 누적 결과도 channel state로 저장됩니다. 실패한 step을 재개할 때 LangGraph의 pending write가 성공한 task를 재사용할 수 있지만, 외부 결제나 DB 증가 연산까지 자동으로 멱등해지는 것은 아닙니다.

누적값 계산은 순수 reducer로 유지하고, 외부 부수 효과에는 thread ID와 task별 안정적인 idempotency key를 사용합니다. 서로 다른 주문이나 실행의 합계를 장기간 공유해야 한다면 graph channel 대신 Store나 데이터베이스를 사용합니다.

## 자주 놓치는 함정

- 타입 생성자가 만드는 기본값을 확인하지 않습니다. 특히 `max`, `min`, 곱셈은 항등원을 명시적으로 검토합니다.
- reducer가 전달받은 list나 dict를 제자리에서 수정합니다. checkpoint와 재실행을 예측하기 쉽도록 새 값을 반환하는 순수 함수로 작성합니다.
- 병렬 update의 적용 순서에 의존합니다. 가능한 한 결합법칙과 교환법칙을 만족하는 연산을 사용합니다.
- `Topic(accumulate=True)`처럼 모든 원본이 보존될 것으로 기대합니다. 이 채널에는 합쳐진 현재 값만 남습니다.
- 여러 `invoke()`가 자동으로 같은 합계를 공유한다고 생각합니다. 실행 간 상태를 이어가려면 checkpointer와 같은 `thread_id`가 필요합니다.
- StateGraph reducer로 충분한데 Pregel actor와 channel을 직접 구성합니다. 저수준 제어가 필요한지 먼저 확인합니다.

## 정리

`BinaryOperatorAggregate`는 각 channel write를 현재 값에 바로 접어 넣어 하나의 누적 결과를 유지합니다. 원본 이벤트가 아니라 합계나 카운터가 필요할 때 메모리와 checkpoint를 단순하게 만들 수 있습니다. 다만 초기값, reducer의 순수성, 병렬 update 순서를 명시적으로 설계해야 안전합니다.

## 참고 자료

- [LangGraph Pregel과 채널 가이드](https://docs.langchain.com/oss/python/langgraph/pregel)
- [BinaryOperatorAggregate API reference](https://reference.langchain.com/python/langgraph/channels/binop/BinaryOperatorAggregate)
- [LangGraph channels API reference](https://reference.langchain.com/python/langgraph/channels)
