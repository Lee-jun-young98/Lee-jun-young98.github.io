---
title: "LangChain ChatOpenAI.with_structured_output()로 JSON Schema 강제하기"
description: "ChatOpenAI에서 with_structured_output(..., method=\"json_schema\")로 구조화된 응답을 안정적으로 받는 방법과 tool calling과 함께 쓸 때의 패턴을 정리한 노트"
date: 2026-07-13
tags:
  - langchain
  - openai
  - structured-output
  - extraction
  - python
aliases:
  - "/blog/chatopenai-structured-output-json-schema"
---

# LangChain ChatOpenAI.with_structured_output()로 JSON Schema 강제하기

LangChain에서 structured output을 다룰 때 가장 먼저 헷갈리는 지점은 둘이다.

- agent의 `response_format=...`
- model의 `with_structured_output(...)`

간단한 추출, 분류, 정규화 작업이라면 agent 전체를 만들 필요 없이 `ChatOpenAI.with_structured_output()`만으로 끝나는 경우가 많다. 특히 OpenAI의 provider-native structured output을 쓰려면 `method="json_schema"`를 명시하는 패턴이 실무에서 꽤 유용하다.

이번 노트는 다음만 빠르게 정리한다.

- 언제 agent 대신 model structured output을 쓰면 좋은지
- `Pydantic`, `TypedDict`, raw JSON Schema 중 무엇을 고를지
- `method="json_schema"`와 `function_calling`, `json_mode` 차이
- tool calling과 structured output을 같이 붙이는 법
- 자주 틀리는 포인트

## 언제 유용한가

아래 같은 작업은 agent보다 model structured output이 더 단순하다.

- 문의 텍스트에서 필드 추출
- free-form 응답을 정해진 JSON 형태로 정규화
- 등급 분류, 라벨링, boolean 판단
- 후속 파이프라인이 바로 읽을 수 있는 typed object 생성

반대로 여러 도구를 반복 호출하며 계획을 세우는 작업이면 `create_agent(...)` 쪽이 더 맞다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "langchain[openai]"
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

## 1. 가장 단순한 패턴: Pydantic 모델로 받기

LangChain 모델 문서 기준으로 `with_structured_output()`은 Pydantic, `TypedDict`, JSON Schema를 모두 받을 수 있다. 가장 다루기 쉬운 쪽은 보통 Pydantic이다.

```python
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI


class SupportTicket(BaseModel):
    """Normalized support ticket."""

    product: str = Field(description="Affected product name")
    issue_type: str = Field(description="Type of issue")
    urgency: str = Field(description="low, medium, or high")
    needs_human: bool = Field(description="Whether a human should review it")


llm = ChatOpenAI(model="gpt-5.5")

structured_llm = llm.with_structured_output(
    SupportTicket,
    method="json_schema",
)

result = structured_llm.invoke(
    "결제가 두 번 청구됐고 오늘 안에 환불이 안 되면 팀장이 바로 항의할 예정입니다."
)

print(result)
print(type(result))
```

이 방식의 장점은 분명하다.

- 응답이 바로 `SupportTicket` 인스턴스로 들어온다
- 필드 설명을 schema에 같이 넣을 수 있다
- 후속 코드에서 `.urgency`, `.needs_human`처럼 타입 안전하게 읽기 쉽다

## 2. `method="json_schema"`를 굳이 명시하는 이유

LangChain 모델 문서 기준으로 structured output 방법은 크게 셋이다.

- `json_schema`: provider가 제공하는 native structured output 사용
- `function_calling`: schema를 tool call처럼 강제
- `json_mode`: JSON은 만들지만 schema 자체는 프롬프트에 설명해야 함

OpenAI에서 schema adherence를 더 강하게 원하면 `method="json_schema"`를 명시하는 편이 낫다.

```python
from pydantic import BaseModel
from langchain_openai import ChatOpenAI


class Movie(BaseModel):
    title: str
    year: int
    director: str


llm = ChatOpenAI(model="gpt-5.5")
structured_llm = llm.with_structured_output(Movie, method="json_schema")

movie = structured_llm.invoke("영화 인터스텔라 정보를 뽑아줘")
print(movie)
```

실무 감각으로 요약하면 이렇다.

- schema를 최대한 엄격히 맞추고 싶다: `json_schema`
- provider native 지원이 약하거나 tool forcing으로 맞추고 싶다: `function_calling`
- 단순히 JSON 텍스트만 필요하다: `json_mode`

## 3. `TypedDict`나 raw JSON Schema도 가능하다

Pydantic이 무거운 경우에는 `TypedDict`나 raw JSON Schema가 더 편할 수 있다.

### `TypedDict` 예시

```python
from typing_extensions import Annotated, TypedDict
from langchain.chat_models import init_chat_model


class ProductReview(TypedDict):
    sentiment: Annotated[str, ..., "positive, neutral, or negative"]
    summary: Annotated[str, ..., "One-sentence summary"]
    refund_risk: Annotated[bool, ..., "Whether refund risk exists"]


model = init_chat_model("openai:gpt-5.5")
structured_model = model.with_structured_output(
    ProductReview,
    method="json_schema",
)

result = structured_model.invoke("배송은 빨랐지만 제품이 계속 꺼져서 반품을 고민 중입니다.")
print(result)
print(type(result))
```

### raw JSON Schema 예시

```python
from langchain_openai import ChatOpenAI


schema = {
    "title": "Lead",
    "description": "Extract a sales lead",
    "type": "object",
    "properties": {
        "company": {"type": "string"},
        "contact_name": {"type": "string"},
        "budget_confirmed": {"type": "boolean"},
    },
    "required": ["company", "contact_name", "budget_confirmed"],
}


llm = ChatOpenAI(model="gpt-5.5")
structured_llm = llm.with_structured_output(schema, method="json_schema")

result = structured_llm.invoke(
    "에이콘헬스의 김민수 이사가 예산은 이미 확보됐다고 했습니다."
)
print(result)
```

보통은 아래 기준이면 충분하다.

- 애플리케이션 내부 타입 안정성이 중요하다: Pydantic
- 런타임 검증보다 가벼운 타입 힌트가 중요하다: `TypedDict`
- 다른 시스템과 JSON Schema 자체를 공유해야 한다: raw JSON Schema

## 4. tool calling과 structured output을 같이 붙일 수도 있다

ChatOpenAI integration 문서 기준으로 OpenAI는 structured output과 tool calling을 함께 쓸 수 있다. 이때 모델은 "도구를 호출할지" 또는 "최종 schema 응답을 낼지"를 상황에 따라 고른다.

```python
from pydantic import BaseModel
from langchain_openai import ChatOpenAI


def get_weather(location: str) -> str:
    """Get weather at a location."""
    return "맑음, 31도"


class WeatherAnswer(BaseModel):
    answer: str
    justification: str


llm = ChatOpenAI(model="gpt-5.5")

structured_llm = llm.bind_tools(
    [get_weather],
    response_format=WeatherAnswer,
    strict=True,
)

response = structured_llm.invoke("서울 날씨를 알려줘")

print(response.tool_calls)
print(response.additional_kwargs.get("parsed"))
```

여기서 중요한 포인트는 이것이다.

- 도구가 필요하면 먼저 tool call이 나올 수 있다
- 도구가 필요 없으면 곧바로 structured output이 나올 수 있다
- parsed 결과는 `additional_kwargs["parsed"]` 쪽에서 확인한다

즉 "항상 바로 schema 객체만 나온다"라고 가정하면 안 된다.

## 5. agent의 `response_format`과 model의 `with_structured_output()`은 용도가 다르다

둘 다 structured output이지만 쓰임새가 다르다.

- `create_agent(..., response_format=...)`
  에이전트 루프 전체의 최종 응답을 구조화할 때 적합
- `ChatOpenAI(...).with_structured_output(...)`
  단일 모델 호출 자체를 구조화할 때 적합

예를 들어 "문의 분류기"라면 model structured output이 더 단순하고, "도구를 돌려 조사한 뒤 최종 JSON 보고서를 내는 agent"라면 agent `response_format`이 더 자연스럽다.

## 자주 틀리는 포인트

### 1. `json_mode`를 schema guarantee로 착각한다

문서 기준으로 `json_mode`는 valid JSON 생성에 가깝고, schema 자체는 프롬프트로 설명해야 한다. schema adherence가 중요하면 `json_schema` 쪽이 더 맞다.

### 2. agent 문제를 model structured output으로 풀려고 한다

도구 호출 루프, 상태 관리, 인간 승인 같은 흐름이 필요한데도 model 호출 하나로 억지로 풀면 오히려 복잡해진다.

### 3. 필드 설명을 너무 비워 둔다

`description`이 빈약하면 모델이 비슷한 필드를 헷갈릴 수 있다. `priority`, `urgency`, `needs_human`처럼 경계가 애매한 필드는 설명을 꼭 쓰는 편이 낫다.

### 4. `parsed`와 `content`를 혼동한다

tool calling과 structured output을 함께 쓴 경우에는 `content`만 보지 말고 `tool_calls`와 `additional_kwargs["parsed"]`를 같이 봐야 한다.

### 5. 모델 지원 범위를 확인하지 않고 method를 고정한다

문서 기준으로 provider별 structured output 방식 지원이 다를 수 있다. 특히 다른 provider로 옮길 가능성이 있으면 `json_schema` 고정이 맞는지 먼저 확인해야 한다.

## 추천 적용 순서

1. 먼저 Pydantic schema 하나로 `with_structured_output(..., method="json_schema")`를 붙인다.
2. 실제 입력 샘플 몇 개로 필드 설명과 required 항목을 다듬는다.
3. schema가 안정되면 downstream 코드에서 문자열 파싱을 없앤다.
4. 도구 호출이 필요해지면 `bind_tools(..., response_format=..., strict=True)` 패턴으로 확장한다.
5. 여러 단계 추론이 필요해지면 그때 agent `response_format`으로 올린다.

structured output은 "출력을 예쁘게 만드는 기능"이 아니라 후속 코드가 신뢰할 수 있는 인터페이스를 만드는 기능에 가깝다. 추출 파이프라인, 분류기, triage 단계처럼 계약이 분명한 작업일수록 효과가 크다.

## 참고 자료

- [LangChain Python models docs](https://docs.langchain.com/oss/python/langchain/models)
- [LangChain ChatOpenAI integration docs](https://docs.langchain.com/oss/python/integrations/chat/openai)
