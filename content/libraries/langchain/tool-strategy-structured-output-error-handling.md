---
title: LangChain ToolStrategy handle_errors로 structured output 재시도 제어하기
description: structured output 검증 실패와 복수 출력 오류를 분류하고 안전한 피드백으로 선택적으로 재시도하는 방법
date: 2026-08-22
tags:
  - langchain
  - agent
  - structured-output
  - python
---

# LangChain ToolStrategy handle_errors로 structured output 재시도 제어하기

에이전트의 structured output은 스키마를 선언하는 것만으로 끝나지 않는다. 모델이 범위를 벗어난 값을 만들거나, union schema에서 여러 출력 도구를 동시에 호출하면 실패 정책이 필요하다.

LangChain의 `ToolStrategy`는 `handle_errors`로 이 정책을 정한다. 검증 오류를 `ToolMessage` 피드백으로 바꿔 모델이 다시 시도하게 할 수도 있고, 재시도하면 안 되는 오류는 즉시 호출자에게 올릴 수도 있다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.3" langchain-openai pydantic
```

PowerShell에서는 `.venv\Scripts\Activate.ps1`로 활성화한다. 실제 호출에는 `OPENAI_API_KEY`가 필요하다.

## 1. 기본값은 모든 structured output 오류 재시도

```python
from pydantic import BaseModel, Field
from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy


class ProductRating(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=1)


agent = create_agent(
    model="openai:gpt-5-mini",
    tools=[],
    response_format=ToolStrategy(ProductRating),  # handle_errors=True
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "평점 10/10, 정말 좋아요"}]}
)
rating = result["structured_response"]
```

기본 `handle_errors=True`는 structured output 오류를 잡아 설명이 담긴 `ToolMessage`를 대화에 추가하고 모델을 다시 호출한다. 예를 들어 `rating=10`은 Pydantic 범위 검증에 실패하므로 모델은 1~5 범위로 고쳐야 한다는 피드백을 받는다.

이 동작은 Python 함수 수준의 자동 재실행과 다르다. 모델 호출이 한 번 더 발생하므로 latency와 token 비용, 전체 model call limit에 포함된다.

## 2. 사용자에게 보여도 안전한 고정 피드백 사용하기

기본 검증 메시지는 필드 구조를 자세히 노출할 수 있다. 외부 사용자 입력을 다루거나 내부 schema 이름을 숨겨야 한다면 고정 문자열을 쓴다.

```python
safe_strategy = ToolStrategy(
    schema=ProductRating,
    handle_errors=(
        "rating은 1~5 정수이고 comment는 비어 있지 않아야 합니다. "
        "조건에 맞는 출력 하나만 다시 제출하세요."
    ),
)
```

문자열을 지정하면 모든 structured output 오류에 같은 피드백을 보낸다. 단순하고 안전하지만, 복수 출력과 필드 검증 실패를 구분하지 못한다.

## 3. 오류 종류별 피드백 만들기

```python
from langchain.agents.structured_output import (
    MultipleStructuredOutputsError,
    StructuredOutputValidationError,
)


def structured_output_feedback(error: Exception) -> str:
    if isinstance(error, MultipleStructuredOutputsError):
        return "후보를 하나만 선택해 structured output을 다시 제출하세요."
    if isinstance(error, StructuredOutputValidationError):
        return "필드 타입과 허용 범위를 확인해 다시 제출하세요."
    return "structured output을 생성하지 못했습니다. 형식을 확인하세요."


strategy = ToolStrategy(
    schema=ProductRating,
    handle_errors=structured_output_feedback,
)
```

callback은 exception을 받아 모델에게 돌려줄 문자열을 반환한다. 여기서 원본 `str(error)`를 그대로 반환하면 사용자 데이터, 내부 필드명, provider 세부 정보가 대화 history와 trace에 남을 수 있다. 모델이 수정하는 데 필요한 최소 정보만 반환한다.

`MultipleStructuredOutputsError`는 한 개만 기대하는데 여러 structured output tool call이 나온 경우다. `StructuredOutputValidationError`는 선택한 schema로 arguments를 파싱하거나 검증하지 못한 경우다.

## 4. 선택한 오류만 재시도하고 나머지는 실패시키기

```python
strict_strategy = ToolStrategy(
    schema=ProductRating,
    handle_errors=StructuredOutputValidationError,
)
```

exception type 하나 또는 tuple을 지정하면 해당 종류만 잡는다.

```python
selective_strategy = ToolStrategy(
    schema=ProductRating,
    handle_errors=(
        StructuredOutputValidationError,
        MultipleStructuredOutputsError,
    ),
)
```

예상 가능한 모델 출력 오류는 재시도하되, 설정 오류나 예상하지 못한 프로그램 오류는 감추지 않고 호출자에게 전파하고 싶을 때 적합하다.

## 5. 배치 추출에서는 즉시 실패시키기

```python
fail_fast_agent = create_agent(
    model="openai:gpt-5-mini",
    tools=[],
    response_format=ToolStrategy(
        ProductRating,
        handle_errors=False,
    ),
)

try:
    result = fail_fast_agent.invoke(
        {"messages": [{"role": "user", "content": "평점 10/10"}]}
    )
except StructuredOutputValidationError as error:
    # dead-letter queue, metric 기록, 별도 fallback 처리
    print(type(error).__name__)
```

대량 추출 파이프라인에서는 한 record가 모델 재시도 루프에 머무르는 것보다 실패 record를 별도 queue로 보내는 편이 예측 가능할 수 있다. `handle_errors=False`는 모든 structured output 오류를 전파하므로 호출자 쪽 retry budget과 dead-letter 정책을 명확히 둔다.

## ProviderStrategy와 혼동하지 않기

`handle_errors`는 tool calling으로 구조화 응답을 만드는 `ToolStrategy`의 정책이다. provider-native structured output을 쓰는 `ProviderStrategy`에는 같은 인자가 없다.

schema type을 `response_format=ProductRating`처럼 바로 넘기면 모델 profile에 따라 전략이 자동 선택될 수 있다. 오류 처리 방식을 반드시 고정해야 한다면 `ToolStrategy(...)`를 명시한다. 대신 모델이 tool calling을 지원하는지 확인해야 한다.

## 자주 막히는 지점

### 1. 무제한 재시도로 생각한다

`handle_errors=True`는 오류를 모델 피드백으로 바꾸는 설정이지 전체 실행 budget이 아니다. `ModelCallLimitMiddleware` 같은 별도 상한과 timeout을 함께 둔다.

### 2. 모든 예외를 같은 성격으로 취급한다

모델이 고칠 수 있는 schema validation 실패와 인증·네트워크·설정 오류는 다르다. 선택적 exception type이나 callback으로 범위를 좁힌다.

### 3. 오류 원문을 모델에게 그대로 돌려준다

상세 validation error는 유용하지만 내부 구조와 입력값을 노출할 수 있다. 운영 환경에서는 allowlist 기반의 짧은 교정 문구로 바꾼다.

### 4. 재시도 횟수만 세지 않는다

structured output 교정도 model call이다. 성공률뿐 아니라 최초 성공률, 교정 횟수, 추가 token, p95 latency를 함께 측정한다.

### 5. union schema에서 복수 선택을 무시한다

서로 겹치는 schema 설명은 모델이 여러 출력 도구를 고르게 만든다. 각 schema의 용도와 배타 조건을 docstring과 field description에 분명히 쓴다.

## 운영 체크리스트

- 대화형 agent와 배치 추출의 실패 정책을 분리한다.
- 모델이 고칠 수 있는 오류만 재시도한다.
- 피드백 문자열에 사용자 원문과 내부 schema 정보를 불필요하게 넣지 않는다.
- model call limit, timeout, 전체 retry budget을 함께 설정한다.
- 최종 결과는 반드시 `result["structured_response"]`에서 읽는다.
- 오류 종류, 교정 횟수, 비용과 latency를 trace나 metric으로 기록한다.

## 마무리

structured output의 신뢰성은 schema뿐 아니라 실패를 어떻게 되돌려 주는지에 달려 있다. 대화형 흐름은 짧고 안전한 교정 피드백으로 복구하고, 배치 작업은 fail-fast와 외부 retry queue로 예측 가능하게 운영할 수 있다.

핵심은 `handle_errors`를 단순한 편의 옵션이 아니라 모델 재호출, 보안, 비용을 함께 결정하는 오류 정책으로 보는 것이다.

## 참고 자료

- [LangChain structured output guide](https://docs.langchain.com/oss/python/langchain/structured-output)
- [LangChain `ToolStrategy` API reference](https://reference.langchain.com/python/langchain/agents/structured_output/ToolStrategy)
- [LangChain `StructuredOutputValidationError` API reference](https://reference.langchain.com/python/langchain/agents/structured_output/StructuredOutputValidationError)
- [LangChain `MultipleStructuredOutputsError` API reference](https://reference.langchain.com/python/langchain/agents/structured_output/MultipleStructuredOutputsError)
