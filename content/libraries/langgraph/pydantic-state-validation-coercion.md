---
title: "LangGraph Pydantic state로 입력 검증과 타입 coercion 붙이기"
description: "LangGraph Graph API에서 Pydantic BaseModel state를 사용해 입력 검증, 기본값, 타입 coercion을 붙이는 방법을 Python 예제로 정리한 실전 노트"
date: 2026-07-02
tags:
  - langgraph
  - pydantic
  - python
  - state
aliases:
  - "/blog/langgraph-pydantic-state-validation-coercion"
---

# LangGraph Pydantic state로 입력 검증과 타입 coercion 붙이기

LangGraph를 쓰다 보면 state를 `TypedDict`로 두는 예제를 가장 먼저 보게 된다.  
그런데 실무에서는 이런 요구가 자주 붙는다.

- 입력에서 숫자와 불리언이 문자열로 들어와도 안전하게 정규화하고 싶다
- 중첩된 설정 객체를 validation과 함께 다루고 싶다
- 기본값을 state 스키마에 명시하고 싶다
- 잘못된 입력을 노드 실행 전에 fail-fast로 막고 싶다

이럴 때 LangGraph Graph API에서 `Pydantic BaseModel` state가 꽤 실용적이다.  
2026년 7월 2일 기준 LangGraph 공식 문서는 graph state를 `TypedDict`, dataclass, Pydantic model로 정의할 수 있고, Pydantic은 recursive validation이 필요할 때 적합하지만 `TypedDict`나 dataclass보다 느릴 수 있다고 설명한다.

이 글에서는 아래 흐름만 실무 기준으로 정리한다.

- 언제 `TypedDict` 대신 Pydantic state를 쓰면 좋은지
- 입력 검증과 타입 coercion이 실제로 어디서 도움이 되는지
- 바로 실행해 볼 수 있는 Python 예제
- 자주 틀리는 점과 선택 기준

## 언제 Pydantic state가 특히 유용한가

아래 같은 상황이면 Pydantic state를 먼저 고려할 만하다.

- API, queue, webhook처럼 입력 품질이 들쭉날쭉하다
- `list`, `dict`, nested object를 validation과 함께 관리해야 한다
- 기본값과 필드 제약을 state 정의에 같이 묶고 싶다
- 그래프를 시작하기 전에 schema mismatch를 바로 잡고 싶다

반대로 state가 단순하고 성능이 더 중요하면 `TypedDict`가 더 가볍다.  
공식 문서도 기본 선택지는 `TypedDict`, 기본값 위주면 dataclass, recursive validation이 필요하면 Pydantic이라는 흐름을 권장한다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langgraph pydantic
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langgraph pydantic
```

## 1. 가장 작은 예제: 문자열 입력을 안전하게 정규화하기

아래 예제는 webhook으로 들어온 문의를 graph state로 받는다.  
`retry_count`와 `needs_callback`이 문자열이어도 Pydantic이 먼저 coercion하고, 노드는 이미 정리된 타입을 기준으로만 동작한다.

```python
from pydantic import BaseModel, Field
from langgraph.graph import END, START, StateGraph


class IntakeState(BaseModel):
    issue_summary: str
    retry_count: int = 0
    needs_callback: bool = False
    tags: list[str] = Field(default_factory=list)


def normalize_ticket(state: IntakeState):
    return {
        "retry_count": state.retry_count + 1,
        "tags": [tag.lower() for tag in state.tags],
    }


builder = StateGraph(IntakeState)
builder.add_node("normalize_ticket", normalize_ticket)
builder.add_edge(START, "normalize_ticket")
builder.add_edge("normalize_ticket", END)

graph = builder.compile()

result = graph.invoke(
    {
        "issue_summary": "Billing page fails intermittently",
        "retry_count": "1",
        "needs_callback": "true",
        "tags": ["Billing", "URGENT"],
    }
)

print(result)
```

이 패턴의 장점은 분명하다.

- 노드에서는 `retry_count`를 `int`로 가정하고 코드를 쓸 수 있다
- `"true"` 같은 문자열 입력도 일관된 `bool`로 맞춰진다
- `tags` 기본값이 안정적으로 생성된다

## 2. nested model이 있을 때 더 빛난다

복잡한 graph일수록 state 안에 중첩 구조가 들어오기 쉽다.  
예를 들어 SLA 설정과 고객 정보를 같이 들고 가는 경우다.

```python
from typing import Literal

from pydantic import BaseModel, Field
from langgraph.graph import END, START, StateGraph


class SlaConfig(BaseModel):
    tier: Literal["free", "pro", "enterprise"]
    response_minutes: int


class TicketState(BaseModel):
    issue_summary: str
    customer_id: str
    sla: SlaConfig
    assignee: str | None = None
    notes: list[str] = Field(default_factory=list)


def assign_ticket(state: TicketState):
    assignee = "enterprise-desk" if state.sla.tier == "enterprise" else "support-queue"
    return {
        "assignee": assignee,
        "notes": [f"sla={state.sla.tier}:{state.sla.response_minutes}m"],
    }


graph = (
    StateGraph(TicketState)
    .add_node("assign_ticket", assign_ticket)
    .add_edge(START, "assign_ticket")
    .add_edge("assign_ticket", END)
    .compile()
)

result = graph.invoke(
    {
        "issue_summary": "Export API returns 504",
        "customer_id": "cust_123",
        "sla": {"tier": "enterprise", "response_minutes": "15"},
    }
)

print(result)
```

여기서도 `response_minutes`가 문자열로 와도 `int`로 맞춰진다.  
중첩 구조 validation을 state 입구에서 처리하므로, downstream node는 비즈니스 로직에만 집중할 수 있다.

## 3. validation error를 "입구 차단"으로 활용할 수 있다

Pydantic state의 가장 실용적인 장점 중 하나는 잘못된 입력을 노드 실행 전에 막는 점이다.

예를 들어 아래 입력은 바로 실패한다.

```python
bad_input = {
    "issue_summary": "Need urgent help",
    "customer_id": "cust_123",
    "sla": {"tier": "gold", "response_minutes": "soon"},
}

graph.invoke(bad_input)
```

이런 식의 실패는 초기에는 번거롭게 느껴질 수 있지만, 운영에서는 오히려 장점인 경우가 많다.

- 잘못된 enum을 초기에 차단한다
- 필수 필드 누락을 노드 내부 분기문으로 뒤늦게 처리하지 않아도 된다
- queue consumer나 API layer에서 어떤 입력이 깨졌는지 명확히 잡기 쉽다

## 4. `TypedDict`, dataclass와는 어떻게 고를까

LangGraph 공식 문서 기준으로 선택 기준은 대략 이렇게 정리할 수 있다.

- `TypedDict`: 기본 선택지. 가장 가볍고 빠르다
- dataclass: 기본값이 필요하지만 Pydantic 수준 validation은 필요 없을 때
- Pydantic `BaseModel`: nested validation, coercion, 필드 제약이 중요할 때

개인적으로는 아래 기준이 가장 실용적이다.

1. state가 대부분 내부 코드에서만 만들어지면 `TypedDict`
2. 외부 입력이 섞이고 필드 모양이 자주 깨지면 Pydantic
3. 기본값만 필요하고 성능이 더 중요하면 dataclass

## 5. checkpointer와도 함께 쓸 수 있다

2026년 7월 2일 기준 LangGraph checkpointer 문서는 기본 `JsonPlusSerializer`가 Pydantic v2 model도 serialize할 수 있다고 설명한다.  
즉 Pydantic state를 쓴다고 해서 persistence를 포기해야 하는 것은 아니다.

다만 운영 기준에서는 아래를 따로 생각하는 편이 좋다.

- validation 비용이 super-step마다 누적되는지
- state model이 너무 비대해지지 않는지
- checkpointer에 남길 값과 runtime context를 분리하고 있는지

## 자주 틀리는 점

### 1. `create_agent`의 state schema와 LangGraph Graph API state를 같은 것으로 생각한다

공식 문서 기준으로 LangChain의 상위 `create_agent` factory는 Pydantic state schema를 지원하지 않는다.  
이 글에서 말하는 방식은 LangGraph Graph API 기준이다.

즉 아래는 맞지 않는다.

- "LangChain agent에서 쓰던 Pydantic state를 그대로 `create_agent`에 넣으면 되겠지"

이건 안 되고, Graph API를 직접 다룰 때의 패턴으로 이해하는 편이 정확하다.

### 2. mutable default를 그냥 `[]`로 둔다

Pydantic model에서도 리스트나 딕셔너리 기본값은 `Field(default_factory=list)` 같은 패턴이 안전하다.  
state가 누적될수록 이런 기본값 실수는 디버깅을 어렵게 만든다.

### 3. Pydantic을 쓰면 무조건 더 안전하고 더 좋은 줄 안다

validation이 강한 대신 비용이 있다.  
공식 문서도 Pydantic이 `TypedDict`나 dataclass보다 덜 performant할 수 있다고 명시한다.

간단한 state인데 매 호출마다 고비용 validation을 돌리면 얻는 것보다 잃는 것이 많을 수 있다.

### 4. validation과 business rule을 섞는다

예를 들어 "tier는 enterprise만 허용" 같은 운영 정책을 전부 schema validation에 넣기 시작하면, 나중에 정책 변경 시 state model이 과하게 비대해질 수 있다.

보통은 이렇게 나누는 편이 좋다.

- schema validation: 타입, 필수 필드, enum 범위
- node logic: 우선순위 계산, 라우팅, 권한 정책

## 추천 운영 흐름

실무에서는 아래 흐름이 가장 무난하다.

1. 외부 입력이 들어오는 graph 입구에 Pydantic state를 둔다
2. node에서는 검증보다 비즈니스 로직에 집중한다
3. 성능 병목이 보이면 `TypedDict` 또는 dataclass로 되돌릴 수 있게 모델을 단순하게 유지한다
4. state에 넣기 애매한 요청별 값은 runtime context로 분리한다

LangGraph에서 Pydantic state를 잘 쓰면 "상태 모델이 문서이자 검증기" 역할을 같이 하게 된다.  
특히 webhook, form, queue input처럼 입력 품질이 균일하지 않은 시스템에서 체감 효과가 크다.

## 참고 자료

- [Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [Use the graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers)
