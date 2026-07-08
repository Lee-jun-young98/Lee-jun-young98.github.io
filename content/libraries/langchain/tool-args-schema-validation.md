---
title: "LangChain @tool과 args_schema로 도구 입력 스키마를 단단하게 만들기"
description: "LangChain @tool, Pydantic args_schema, parse_docstring, return_direct를 활용해 에이전트 도구 입력을 검증하고 모델이 더 정확히 도구를 고르게 만드는 실전 가이드"
date: 2026-07-08
tags:
  - langchain
  - agent
  - tools
  - python
  - pydantic
aliases:
  - "/blog/langchain-tool-args-schema-validation"
---

# LangChain `@tool`과 `args_schema`로 도구 입력 스키마를 단단하게 만들기

LangChain 에이전트가 도구를 잘못 고르는 경우를 보면 의외로 모델 자체보다 도구 정의가 흐린 경우가 많다.  
도구 이름이 모호하거나, 인자 설명이 없거나, 문자열 하나로 여러 옵션을 억지로 받게 만들면 tool calling 품질이 바로 떨어진다.

이번 글은 LangChain 공식 `Tools` 문서와 Python reference를 기준으로, 실무에서 바로 체감되는 도구 정의 포인트만 정리한다.

- `@tool` 기본 사용법과 `snake_case` 이름 규칙
- `args_schema`로 입력을 강하게 검증하는 방법
- `parse_docstring=True`로 인자 설명을 schema에 자동 반영하는 패턴
- `return_direct=True`를 언제 써야 하는지
- `runtime`, `config` 같은 예약 인자 함정

## 언제 유용한가

아래 상황이면 단순 함수 등록보다 `args_schema`를 먼저 검토하는 편이 낫다.

- 도구 입력에 enum, boolean, optional field가 섞여 있다
- 주문 취소, 환불, 배포 같은 민감한 작업이라 입력 검증이 중요하다
- 같은 역할의 도구가 여러 개라서 설명 품질이 tool selection 정확도에 직접 영향을 준다
- 프런트엔드나 다른 서비스와 schema를 공유해야 한다

공식 문서 기준으로 LangChain은 함수 시그니처의 타입 힌트에서 schema를 추론하고, 가능하면 도구 이름은 `snake_case`를 권장한다. 일부 provider는 공백이나 특수문자가 섞인 이름을 거부할 수 있기 때문이다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai pydantic
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langchain langgraph langchain-openai pydantic
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 가장 작은 시작점: `@tool` + 타입 힌트

함수 시그니처가 단순하면 이것만으로도 충분하다.

```python
from langchain.tools import tool


@tool
def search_docs(query: str, top_k: int = 5) -> str:
    """사내 문서에서 키워드 기반 검색을 수행한다."""
    return f"query={query}, top_k={top_k}"


print(search_docs.name)
print(search_docs.args_schema.model_json_schema())
```

이 패턴의 장점은 빠르다는 점이다.  
다만 인자가 늘어나기 시작하면 모델이 각 필드의 의미를 헷갈리기 쉬워진다. 그때는 `args_schema`로 넘어가는 편이 낫다.

## 2. `args_schema`로 입력 계약을 명시하기

실무에서는 이 단계부터 효과가 크다. `Field(description=...)`를 붙이면 모델이 어떤 값을 넣어야 하는지 훨씬 안정적으로 이해한다.

```python
from typing import Literal

from pydantic import BaseModel, Field
from langchain.tools import tool


class RefundTicketInput(BaseModel):
    """환불 요청 접수 입력."""

    order_id: str = Field(description="환불할 주문 ID")
    reason: Literal["duplicate", "damaged", "fraud", "customer_request"] = Field(
        description="환불 사유 코드"
    )
    include_shipping: bool = Field(
        default=False,
        description="배송비도 함께 환불할지 여부",
    )


@tool(args_schema=RefundTicketInput)
def create_refund_ticket(
    order_id: str,
    reason: str,
    include_shipping: bool = False,
) -> str:
    """환불 요청 티켓을 생성한다."""
    return (
        f"refund ticket created: order_id={order_id}, "
        f"reason={reason}, include_shipping={include_shipping}"
    )
```

이 구조의 장점은 명확하다.

- `Literal`로 허용 가능한 값 범위를 제한할 수 있다
- `Field(description=...)`로 모델에게 의미를 더 정확히 알려줄 수 있다
- Pydantic validation으로 잘못된 입력을 조기에 막을 수 있다

특히 `"cancel"`, `"refund"`, `"exchange"`처럼 헷갈리기 쉬운 액션은 자유 텍스트보다 enum이 훨씬 안전하다.

## 3. `parse_docstring=True`로 설명을 schema에 자동 반영하기

LangChain reference 기준으로 `tool(..., parse_docstring=True)`를 쓰면 Google style docstring의 `Args:` 섹션을 읽어 파라미터 설명을 schema에 넣는다.

```python
from langchain.tools import tool


@tool(parse_docstring=True)
def schedule_callback(customer_id: str, urgency: int = 3) -> str:
    """고객 콜백 일정을 등록한다.

    Args:
        customer_id: 콜백을 요청한 고객 ID
        urgency: 1은 가장 긴급하고 5는 가장 낮은 우선순위
    """
    return f"callback scheduled for {customer_id} with urgency={urgency}"


print(schedule_callback.args_schema.model_json_schema())
```

이 방식은 작은 도구가 많을 때 특히 편하다.  
함수 시그니처와 설명을 한 곳에서 관리할 수 있어서 문서와 schema가 쉽게 어긋나지 않는다.

다만 공식 reference 기준으로 `parse_docstring=True`인데 Google style 형식이 잘못되어 있으면 `error_on_invalid_docstring=True` 기본값 때문에 `ValueError`가 날 수 있다.

## 4. 실제 agent에 붙이면 어떤 차이가 나나

아래처럼 schema가 명확할수록 모델이 도구를 더 안정적으로 고른다.

```python
from langchain.agents import create_agent
from langchain.tools import tool


@tool
def lookup_order(order_id: str) -> str:
    """주문 ID로 현재 배송 상태를 조회한다."""
    return f"{order_id}: in transit"


@tool(parse_docstring=True)
def escalate_ticket(order_id: str, severity: int = 2) -> str:
    """주문 이슈를 운영팀으로 이관한다.

    Args:
        order_id: 문제가 발생한 주문 ID
        severity: 1은 긴급, 3은 일반
    """
    return f"ticket opened for {order_id} with severity={severity}"


agent = create_agent(
    model="openai:gpt-5.5-mini",
    tools=[lookup_order, escalate_ticket],
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "주문 A-1024 배송 상태를 보고, 분실이면 높은 우선순위로 운영팀에 넘겨 줘.",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

도구 설명이 선명하면 모델이 `lookup_order`와 `escalate_ticket`의 역할을 분리해서 이해하기 쉽다.  
반대로 둘 다 "주문 처리" 정도로만 적혀 있으면 잘못 고를 가능성이 커진다.

## 5. `return_direct=True`는 출력이 곧 최종 답일 때만

공식 `Tools` 문서 기준으로 `return_direct=True`를 주면 도구 결과를 받은 뒤 agent loop를 멈추고 그 값을 바로 최종 응답으로 반환한다.

```python
from langchain.tools import tool


@tool(return_direct=True)
def lookup_tracking(order_id: str) -> str:
    """주문 배송 조회 결과를 사용자에게 바로 보여줄 수 있는 문장으로 반환한다."""
    return f"주문 {order_id}는 배송 중이며 2일 내 도착 예정입니다."
```

잘 맞는 경우:

- 결과가 이미 사용자에게 보여줄 완성된 문장이다
- 추가 추론이나 요약이 필요 없다
- 모델이 다시 말 바꾸지 말아야 한다

잘 안 맞는 경우:

- 여러 도구 결과를 합쳐 판단해야 한다
- 툴 결과를 바탕으로 후속 도구 호출이 필요하다
- 정책 검토, 요약, 번역 같은 후처리가 필요하다

## 6. 자주 걸리는 함정

### 1. `runtime`, `config`를 일반 인자 이름으로 쓰면 안 된다

공식 문서 기준으로 `config`와 `runtime`은 예약 이름이다.  
`ToolRuntime` 접근이나 내부 `RunnableConfig` 전달에 쓰이므로 일반 비즈니스 인자로 사용하면 런타임 오류가 날 수 있다.

```python
from langchain.tools import ToolRuntime, tool


@tool
def get_message_count(runtime: ToolRuntime) -> str:
    """현재 대화 메시지 수를 확인한다."""
    return str(len(runtime.state["messages"]))
```

### 2. 설명이 짧다고 좋은 것이 아니다

도구 이름이 짧아도 설명이 모호하면 selection 품질이 떨어진다.

나쁜 예:

```python
@tool
def search_data(query: str) -> str:
    """데이터를 검색한다."""
    ...
```

더 나은 예:

```python
@tool
def search_billing_docs(query: str) -> str:
    """청구, 결제 실패, 세금계산서 관련 내부 문서를 검색한다."""
    ...
```

### 3. enum 대신 자유 텍스트를 남발하면 validation보다 해석 비용이 커진다

정해진 코드 체계가 있는 값은 `Literal`이나 enum으로 묶는 편이 낫다.  
모델이 `"refund shipping"`, `"shipping_refund"`, `"refund-shipping"` 같은 변형을 만들어 내는 문제를 줄일 수 있다.

### 4. `args_schema`와 함수 시그니처 의미가 어긋나면 유지보수가 무너진다

예를 들어 schema에는 `include_shipping=False`인데 함수 내부는 `shipping_refund=True`로 해석하면 나중에 trace를 봐도 혼란스럽다.  
schema 이름, 설명, 함수 파라미터 의미를 같은 방향으로 맞춰 두는 것이 중요하다.

## 추천 적용 순서

개인적으로는 아래 순서가 가장 덜 꼬인다.

1. 단순 도구는 `@tool` + 타입 힌트로 시작한다
2. 분기나 정책이 생기면 `args_schema`와 `Field(description=...)`를 붙인다
3. 작은 도구가 많아지면 `parse_docstring=True`로 설명 관리 비용을 줄인다
4. 결과가 완성형 답이면 그때만 `return_direct=True`를 검토한다

도구 입력 schema는 사소한 디테일처럼 보여도, 실제로는 agent 품질을 꽤 크게 좌우한다.  
모델을 바꾸기 전에 도구 이름, 필드 설명, enum 설계부터 다듬는 편이 종종 더 싸고 빠르다.

## 참고 자료

- [LangChain Tools docs](https://docs.langchain.com/oss/python/langchain/tools)
- [LangChain `tool` reference](https://reference.langchain.com/python/langchain-core/tools/convert/tool)
- [LangChain Agents docs](https://docs.langchain.com/oss/python/langchain/agents)
