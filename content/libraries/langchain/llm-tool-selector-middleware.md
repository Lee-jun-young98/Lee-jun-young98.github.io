---
title: LangChain LLMToolSelectorMiddleware로 많은 도구 중 필요한 것만 고르기
description: LangChain LLMToolSelectorMiddleware로 작은 선택 모델을 앞단에 두고 질의마다 필요한 도구만 남겨 agent의 비용과 정확도를 함께 관리하는 실전 가이드
date: 2026-06-11
tags:
  - langchain
  - agent
  - middleware
  - tools
  - python
---

# LangChain LLMToolSelectorMiddleware로 많은 도구 중 필요한 것만 고르기

LangChain agent에 도구가 몇 개 없을 때는 모든 tool schema를 모델에 그냥 넘겨도 큰 문제가 없다.

하지만 실서비스로 가면 금방 이런 구성이 나온다.

- 검색 도구
- 사내 문서 조회 도구
- 고객 정보 조회 도구
- 주문 상태 조회 도구
- 수학 계산 도구
- 일정 조회 도구
- 알림 전송 도구

도구 수가 10개를 넘어가기 시작하면 매 turn마다 모든 schema를 프롬프트에 넣는 비용이 커지고, 모델이 지금 질문과 무관한 도구 설명까지 같이 읽게 된다.

LangChain의 `LLMToolSelectorMiddleware`는 이 문제를 "본 모델이 답변하기 전에, 더 작은 선택 모델에게 이번 질문에 필요한 도구만 먼저 고르게 하는 방식"으로 푼다.

이번 글에서는 아래 흐름만 실전 기준으로 빠르게 정리한다.

- 언제 `LLMToolSelectorMiddleware`를 붙일 만한가
- 기본 동작 방식
- `model`, `max_tools`, `always_include`를 어떻게 쓰는가
- 동적 도구 선택 글에서 다룬 수동 필터링과 무엇이 다른가
- 흔한 함정은 무엇인가

## 언제 쓰면 좋은가

공식 prebuilt middleware 문서 기준으로 `LLMToolSelectorMiddleware`는 특히 아래 상황에 맞다.

- 도구가 많고 대부분의 turn에서 일부만 필요할 때
- tool schema 토큰 비용이 눈에 띄게 커졌을 때
- 모델이 너무 많은 도구 후보 때문에 자주 엉뚱한 tool을 고를 때

반대로 도구가 3~5개 수준이고 대부분 자주 쓰인다면, 선택 모델을 하나 더 거치는 비용이 오히려 이득보다 클 수 있다.

## 어떻게 동작하나

동작은 단순하다.

1. 선택 모델이 현재 사용자 요청과 도구 설명을 읽는다.
2. structured output으로 "이번 요청에 필요한 도구 이름 목록"을 반환한다.
3. LangChain이 그 도구만 남겨 본 모델 호출에 넘긴다.

즉 본 모델이 매번 전체 도구 목록을 읽는 대신, 먼저 얇은 라우팅 단계를 한 번 거치는 구조다.

이 패턴은 이전에 정리한 `wrap_model_call` 기반 동적 도구 선택과 비슷해 보이지만 성격이 다르다.

- `wrap_model_call` 방식: 개발자가 규칙을 직접 적는다
- `LLMToolSelectorMiddleware`: 선택 자체를 작은 LLM에게 맡긴다

규칙이 명확한 권한 제어나 단계 제어는 `wrap_model_call` 쪽이 더 낫고, 질문 종류가 다양해서 하드코딩 규칙이 지저분해질 때는 `LLMToolSelectorMiddleware`가 편하다.

## 사전 준비

공식 문서 기준으로 LangChain agent middleware에서 바로 사용할 수 있다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

OpenAI 예시:

```bash
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 가장 작은 예제

아래 예제에서는 본 모델 앞에 더 저렴한 선택 모델을 둔다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import LLMToolSelectorMiddleware
from langchain.tools import tool


@tool
def search_docs(query: str) -> str:
    """제품 문서에서 기능 설명을 찾는다."""
    return f"docs result for: {query}"


@tool
def lookup_order(order_id: str) -> str:
    """주문 번호로 배송 상태를 조회한다."""
    return f"order {order_id}: in transit"


@tool
def calculate(expression: str) -> str:
    """간단한 수식을 계산한다."""
    return str(eval(expression))


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[search_docs, lookup_order, calculate],
    middleware=[
        LLMToolSelectorMiddleware(
            model="openai:gpt-5.4-mini",
            max_tools=2,
        )
    ],
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "주문 10321 배송 상태를 확인하고, 지연이면 고객 안내 문구도 같이 써줘.",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

이 흐름에서 선택 모델은 보통 `lookup_order`를 고르고, `search_docs`나 `calculate`는 제외한다.

핵심은 본 모델이 매 turn마다 모든 도구 설명을 읽지 않아도 된다는 점이다.

## 2. `always_include`로 공통 도구 남기기

실무에서는 어떤 도구는 거의 항상 열어 두고 싶을 때가 있다.

예를 들어 검색 도구는 대부분의 요청에서 안전한 fallback이 되므로 항상 포함시키고, 나머지만 선택 모델이 고르게 할 수 있다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import LLMToolSelectorMiddleware
from langchain.tools import tool


@tool
def search_docs(query: str) -> str:
    """내부 제품 문서와 FAQ를 검색한다."""
    return f"searched docs: {query}"


@tool
def lookup_customer(customer_id: str) -> str:
    """고객 계정 상태와 요금제를 조회한다."""
    return f"customer {customer_id}: premium"


@tool
def lookup_invoice(invoice_id: str) -> str:
    """청구서 상태와 결제 여부를 조회한다."""
    return f"invoice {invoice_id}: unpaid"


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[search_docs, lookup_customer, lookup_invoice],
    middleware=[
        LLMToolSelectorMiddleware(
            model="openai:gpt-5.4-mini",
            max_tools=1,
            always_include=["search_docs"],
        )
    ],
)
```

이 설정이면 선택 모델이 `lookup_customer`만 골라도 실제 본 모델에는 `search_docs + lookup_customer`가 같이 전달된다.

공식 문서 기준으로 `always_include`로 남긴 도구는 `max_tools` 제한에 포함되지 않는다.

## 3. 어떤 선택 모델을 써야 하나

공식 문서 기준 `model`은 문자열 모델 ID나 `BaseChatModel` 인스턴스를 받을 수 있고, 지정하지 않으면 agent의 메인 모델을 기본값으로 쓴다.

실무적으로는 아래처럼 생각하면 편하다.

- 본 모델보다 더 저렴한 모델을 선택 모델로 둔다
- structured output이 안정적인 모델을 고른다
- 너무 약한 모델을 써서 계속 엉뚱한 도구를 고르면 절감한 비용보다 품질 손실이 커질 수 있다

처음에는 `main model`보다 한 단계 작은 같은 provider 모델로 시작하는 편이 안전하다.

## 4. 도구 설명 품질이 선택 품질을 좌우한다

`LLMToolSelectorMiddleware`는 도구 이름과 설명을 보고 선택한다.

그래서 tool 품질이 좋지 않으면 middleware를 붙여도 별 효과가 없다.

공식 tools 문서 기준으로 다음 원칙이 특히 중요하다.

- tool 이름은 `snake_case`로 단순하게 짓기
- docstring을 짧고 구체적으로 쓰기
- 입력 스키마의 필드 설명을 모호하지 않게 쓰기

예를 들어 아래처럼 설명이 겹치면 선택 모델도 헷갈린다.

```python
@tool
def search_data(query: str) -> str:
    """데이터를 검색한다."""
    ...


@tool
def search_info(query: str) -> str:
    """정보를 검색한다."""
    ...
```

이런 식보다 아래처럼 책임을 분리하는 편이 낫다.

```python
@tool
def search_product_docs(query: str) -> str:
    """제품 기능, API 사용법, 설정 문서를 검색한다."""
    ...


@tool
def search_customer_tickets(query: str) -> str:
    """고객 지원 티켓과 장애 이력을 검색한다."""
    ...
```

## 5. 수동 도구 선택과 같이 쓰는 방법

`LLMToolSelectorMiddleware`만으로 모든 제어를 해결하려고 하면 오히려 설계가 흐려진다.

보통은 아래 식의 2단 구성이 실용적이다.

1. `wrap_model_call`이나 권한 규칙으로 아예 노출 가능한 도구 집합을 먼저 좁힌다.
2. 그 안에서 `LLMToolSelectorMiddleware`가 현재 질문에 맞는 후보만 더 줄인다.

예를 들어 일반 사용자에게는 `refund_order`를 숨기고, 운영자 role에서만 노출한 다음, 운영자에게 보이는 도구들 사이에서만 선택 모델이 추가 필터링하도록 만들 수 있다.

## 흔한 함정

### 1. 도구가 적은데도 무조건 붙이는 경우

도구가 적으면 선택 모델 호출이 한 번 더 늘어날 뿐이다.

`10+ tools` 같은 상황에서 특히 효과가 좋다는 공식 문서의 조건을 먼저 체크하는 편이 낫다.

### 2. `max_tools`를 너무 작게 잡는 경우

질문 하나를 처리하는 데 실제로 두세 개 도구가 필요한데 `max_tools=1`로 묶어 두면 모델이 답을 억지로 만들거나, 필요한 도구를 못 써서 품질이 떨어진다.

처음에는 2~4 정도로 시작해서 trace를 보고 줄이는 편이 안전하다.

### 3. 공통 fallback 도구를 빼먹는 경우

검색이나 FAQ 조회처럼 자주 필요한 보조 도구는 `always_include`로 남겨 두는 편이 운영이 편하다.

### 4. 설명이 겹치는 tool을 여러 개 두는 경우

선택 모델은 도구 구현 코드를 읽는 것이 아니라 이름과 설명을 읽는다.

즉 selector 품질 문제처럼 보여도 실제 원인은 tool schema 설계인 경우가 많다.

### 5. 비용만 보고 너무 작은 선택 모델을 쓰는 경우

선택 모델이 계속 잘못 고르면 본 모델이 필요한 도구를 못 보고 답변 품질이 흔들린다.

작은 모델로 시작하되, 잘못 고른 비율을 LangSmith trace로 반드시 확인하는 편이 좋다.

## 운영 팁

- LangSmith trace에서 selector 단계와 main agent 단계를 분리해 본다.
- "선택된 도구 수", "실제로 호출된 도구 수", "불필요하게 제외된 도구"를 같이 본다.
- 자주 같이 선택되는 도구 조합이 있으면 tool 책임 분리를 다시 본다.
- 권한 제어는 selector에 맡기지 말고, selector 이전 단계에서 강제로 제한한다.

## 마무리

`LLMToolSelectorMiddleware`는 "도구가 많아진 agent에서 매번 전체 도구 목록을 다 읽게 하지 말자"는 문제를 가장 간단하게 풀어주는 패턴에 가깝다.

- 도구 수가 많아졌는가
- schema 토큰 비용이 부담되는가
- 규칙 기반 필터링만으로는 도구 선택 로직이 지저분해지는가

이 세 가지가 맞으면 붙여 볼 가치가 크다.

반대로 권한, 단계, 조직 정책처럼 결정 규칙이 명확한 부분은 계속 코드 규칙으로 제어하고, 그 안에서만 selector를 쓰는 편이 더 안정적이다.

## 참고 자료

- [LangChain Prebuilt Middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain Tools](https://docs.langchain.com/oss/python/langchain/tools)
- [LangChain LLMToolSelectorMiddleware Reference](https://reference.langchain.com/python/langchain/agents/middleware/tool_selection/LLMToolSelectorMiddleware)
