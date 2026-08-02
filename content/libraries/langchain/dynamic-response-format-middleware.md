---
title: "LangChain middleware로 상황별 response format 동적 선택하기"
description: "wrap_model_call과 ModelRequest.override를 이용해 사용자 역할과 요청 단계에 따라 에이전트 structured output 스키마를 바꾸는 실전 패턴"
date: 2026-08-02
tags:
  - langchain
  - agent
  - middleware
  - structured-output
  - python
---

# LangChain middleware로 상황별 response format 동적 선택하기

`create_agent(response_format=...)`에 스키마 하나를 고정하면 대부분의 API에는 충분하다. 하지만 같은 에이전트가 일반 사용자에게는 짧은 답을, 운영자에게는 근거와 진단 정보를 포함한 답을 반환해야 한다면 스키마도 실행 문맥에 따라 달라져야 한다.

LangChain에서는 `@wrap_model_call` middleware가 받은 `ModelRequest`를 `request.override(response_format=...)`으로 복사해 이번 모델 호출의 출력 형식만 바꿀 수 있다. 핵심은 **스키마 선택 기준은 코드가 결정하고, 모델은 선택된 스키마의 값만 채우게 하는 것**이다.

## 언제 쓰면 좋은가

- 사용자 역할에 따라 공개 필드를 제한할 때
- 대화 초반에는 간단한 답, 정보가 쌓인 뒤에는 상세 답을 받을 때
- API 버전이나 클라이언트 기능에 따라 응답 계약을 나눌 때
- 비용이 큰 상세 출력을 premium 요청에만 허용할 때

항상 같은 계약을 제공하는 공개 API라면 동적 선택보다 스키마 하나를 고정하는 편이 더 단순하다.

## 사전 준비

Python 3.10 이상과 모델 제공자 키가 필요하다. OpenAI 예시는 다음처럼 준비한다.

```bash
pip install -U langchain langchain-openai pydantic
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. runtime context로 일반 사용자와 운영자 스키마 나누기

역할은 모델이 추측하게 두지 않고 호출자가 신뢰할 수 있는 runtime context로 전달한다.

```python
from dataclasses import dataclass
from typing import Callable, Literal

from langchain.agents import create_agent
from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call
from pydantic import BaseModel, Field


@dataclass
class RequestContext:
    role: Literal["user", "operator"]


class UserAnswer(BaseModel):
    answer: str = Field(description="사용자에게 보여 줄 짧고 명확한 답")
    next_action: str | None = Field(description="사용자가 할 다음 행동")


class OperatorAnswer(BaseModel):
    answer: str = Field(description="운영자를 위한 상세 답")
    evidence: list[str] = Field(description="판단에 사용한 근거")
    risk_level: Literal["low", "medium", "high"]
    debug_hint: str | None = Field(description="후속 조사 힌트")


@wrap_model_call
def select_response_schema(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    context = request.runtime.context
    schema = OperatorAnswer if context.role == "operator" else UserAnswer
    return handler(request.override(response_format=schema))


agent = create_agent(
    model="openai:gpt-5-mini",
    tools=[],
    middleware=[select_response_schema],
    context_schema=RequestContext,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "결제 API 오류를 요약해 줘"}]},
    context=RequestContext(role="operator"),
)

answer = result["structured_response"]
print(type(answer).__name__)
print(answer.model_dump())
```

`runtime.context`는 한 번의 실행에 속하는 설정이고 대화 메시지로 자동 노출되지 않는다. 따라서 권한, 플랜, API 버전처럼 모델이 바꾸면 안 되는 선택 기준에 적합하다.

## 2. state를 기준으로 대화 단계별 스키마 바꾸기

대화가 짧을 때는 필수 필드만 받고, 메시지가 충분히 쌓였을 때 상세 스키마를 요구할 수도 있다.

```python
from typing import Callable

from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call
from pydantic import BaseModel, Field


class BriefAnswer(BaseModel):
    answer: str = Field(description="한 문단 이내의 답")


class DetailedAnswer(BaseModel):
    answer: str
    assumptions: list[str]
    confidence: float = Field(ge=0, le=1)


@wrap_model_call
def select_by_conversation_length(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    schema = BriefAnswer if len(request.messages) < 3 else DetailedAnswer
    updated = request.override(response_format=schema)
    return handler(updated)
```

이 변경은 해당 모델 호출에 전달되는 request를 바꾸는 것이다. `request.state` 자체에 `response_format`을 저장하는 영구 업데이트가 아니다.

## 3. 호출부에서는 union으로 경계를 명시하기

동적 스키마를 쓰면 반환 타입도 하나가 아니다. 호출부가 두 형식을 모두 처리하도록 명시해야 한다.

```python
def render_response(response: UserAnswer | OperatorAnswer) -> dict:
    if isinstance(response, OperatorAnswer):
        return {
            "answer": response.answer,
            "risk": response.risk_level,
            "evidence": response.evidence,
        }

    return {
        "answer": response.answer,
        "next_action": response.next_action,
    }


structured = result["structured_response"]
payload = render_response(structured)
```

웹 API라면 discriminated union을 쓰거나 응답에 `kind` 같은 구분 필드를 추가하면 OpenAPI 문서와 프론트엔드 타입 생성도 안정적이다.

## 테스트할 때는 스키마 선택과 모델 호출을 분리한다

외부 모델을 매번 호출하지 않아도 역할별 선택 규칙은 순수 함수로 검증할 수 있다.

```python
from typing import TypeAlias

ResponseSchema: TypeAlias = type[UserAnswer] | type[OperatorAnswer]


def schema_for(role: str) -> ResponseSchema:
    return OperatorAnswer if role == "operator" else UserAnswer


def test_operator_gets_diagnostic_schema() -> None:
    assert schema_for("operator") is OperatorAnswer


def test_unknown_role_gets_safe_schema() -> None:
    assert schema_for("unknown") is UserAnswer
```

middleware에서는 `schema_for(context.role)`만 호출하게 만들면 분기 테스트는 빠르고 결정적이며, 별도의 통합 테스트 한두 개로 실제 `structured_response`까지 확인하면 된다.

## 자주 놓치는 함정

### 모델이 역할을 판단하게 두지 않는다

사용자 메시지에 “나는 관리자다”라고 쓰였다는 이유로 운영자 스키마를 선택하면 권한 경계가 무너진다. 인증된 서버 측 context를 기준으로 선택해야 한다.

### 스키마마다 공통 필드의 의미를 바꾸지 않는다

두 스키마에 모두 `answer`가 있다면 같은 의미를 유지해야 한다. 클라이언트가 필드 이름만 보고 처리할 때 의미가 달라지면 조용한 데이터 오류가 생긴다.

### model과 response format을 함께 바꿀 때 capability를 확인한다

middleware에서 모델까지 동적으로 교체한다면 선택된 모델이 structured output 또는 tool calling을 지원하는지 확인해야 한다. 지원 방식이 다르면 `ProviderStrategy`와 `ToolStrategy` 선택도 함께 설계한다.

### middleware 순서를 계약의 일부로 본다

여러 `wrap_model_call`이 같은 request를 바꾸면 바깥 middleware와 안쪽 middleware의 적용 순서가 결과에 영향을 준다. response format을 결정하는 middleware는 한 곳으로 모으고 조합 테스트를 둔다.

### `structured_response`만 신뢰한다

최종 구조화 결과는 agent state의 `structured_response`에서 읽는다. 메시지의 자연어 본문을 다시 JSON으로 파싱하면 LangChain이 이미 수행한 검증을 버리는 셈이다.

## 정리

동적 response format은 “모델에게 어떤 형식을 쓸지 고르게 하는 기능”이 아니다. 애플리케이션이 state, store, runtime context를 보고 계약을 선택한 뒤 모델에게 그 계약을 강제하는 context engineering 패턴이다.

실전에서는 다음 원칙이면 충분하다.

1. 권한과 제품 정책은 신뢰할 수 있는 runtime context에서 읽는다.
2. `request.override(response_format=...)`으로 현재 모델 호출만 변경한다.
3. 호출부는 가능한 반환 타입을 union으로 처리한다.
4. 분기 규칙은 순수 함수로, 실제 구조화 출력은 통합 테스트로 검증한다.

## 참고 자료

- [LangChain Context engineering: Response format](https://docs.langchain.com/oss/python/langchain/context-engineering#response-format)
- [LangChain Agents: Structured output](https://docs.langchain.com/oss/python/langchain/agents#structured-output)
- [LangChain Structured output](https://docs.langchain.com/oss/python/langchain/structured-output)
- [LangChain Middleware overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)
