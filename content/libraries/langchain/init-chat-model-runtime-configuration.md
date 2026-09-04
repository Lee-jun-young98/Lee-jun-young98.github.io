---
title: init_chat_model로 런타임 모델 설정을 안전하게 전환하기
description: configurable_fields와 config_prefix를 이용해 허용된 모델·생성 파라미터만 요청별로 바꾸는 LangChain 실전 가이드
date: 2026-09-04
tags:
  - langchain
  - model
  - configuration
  - routing
  - security
  - python
---

# init_chat_model로 런타임 모델 설정을 안전하게 전환하기

개발·운영 환경이나 요청 등급에 따라 모델을 바꾸려고 모델 객체를 매번 직접 생성하면 provider 분기, 자격 증명, tool binding 코드가 쉽게 흩어진다. LangChain의 `init_chat_model()`은 같은 Runnable 인터페이스를 유지하면서 모델과 일부 생성 설정을 `RunnableConfig`로 선택하게 해 준다.

핵심은 **클라이언트가 모든 생성자 인자를 덮어쓰게 하지 않고, 서버가 허용한 필드만 configurable하게 여는 것**이다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.3" langchain-openai langchain-anthropic
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
```

PowerShell에서는 환경 변수를 `$env:OPENAI_API_KEY="..."`처럼 설정한다. 실제로 사용할 provider의 integration package와 API key만 설치·설정하면 된다.

## 1. 고정 모델은 가장 단순한 형태로 시작한다

런타임 전환이 필요하지 않다면 모델을 명시하는 편이 가장 안전하다.

```python
from langchain.chat_models import init_chat_model

model = init_chat_model(
    "openai:gpt-5-mini",
    temperature=0,
    timeout=30,
    max_retries=3,
)

response = model.invoke("에이전트의 tool calling을 한 문장으로 설명해 줘.")
print(response.text)
```

`provider:model` 형식은 provider 추론에 의존하지 않아 설정 의도가 분명하다. 운영에서는 움직이는 alias보다 provider가 제공하는 고정된 model ID를 쓸 수 있다면 그쪽이 재현성에 유리하다.

## 2. 필요한 필드만 요청별로 열기

기본 모델은 유지하되 모델·provider·temperature·출력 길이만 바꾸고 싶다면 `configurable_fields`를 명시한다.

```python
from langchain.chat_models import init_chat_model

model = init_chat_model(
    model="openai:gpt-5-mini",
    temperature=0,
    max_tokens=300,
    configurable_fields=(
        "model",
        "model_provider",
        "temperature",
        "max_tokens",
    ),
)

result = model.invoke(
    "이 장애 보고서를 세 문장으로 요약해 줘.",
    config={
        "configurable": {
            "model": "claude-haiku-4-5-20251001",
            "model_provider": "anthropic",
            "temperature": 0.2,
            "max_tokens": 180,
        }
    },
)
print(result.text)
```

`config`는 호출별 설정이므로 공유 모델 객체 자체를 바꾸지 않는다. 하지만 사용자 입력을 그대로 `configurable`에 복사하면 안 된다. 애플리케이션의 요금제·업무 정책을 먼저 검증한 뒤 허용된 값만 만들어 전달해야 한다.

## 3. 외부 요청은 서버 정책으로 변환한다

클라이언트가 실제 provider 이름이나 임의의 temperature를 직접 정하게 두기보다, 공개된 등급을 내부 설정으로 매핑한다.

```python
from typing import Literal

ModelTier = Literal["fast", "quality"]


def model_config_for(tier: ModelTier) -> dict:
    policies = {
        "fast": {
            "model": "gpt-5-mini",
            "model_provider": "openai",
            "temperature": 0,
            "max_tokens": 300,
        },
        "quality": {
            "model": "claude-sonnet-4-5-20250929",
            "model_provider": "anthropic",
            "temperature": 0.1,
            "max_tokens": 800,
        },
    }
    return {"configurable": policies[tier]}


result = model.invoke(
    "배포 계획의 위험을 검토해 줘.",
    config=model_config_for("quality"),
)
```

이 경계에서는 다음을 함께 검사하는 편이 좋다.

- 계정이 해당 등급을 사용할 권한이 있는가
- 입력한 tier가 서버 allowlist에 있는가
- 요청별 token 상한과 timeout이 비용 정책을 넘지 않는가
- 선택한 모델이 tool calling이나 structured output을 지원하는가

## 4. 여러 모델이 있는 chain은 prefix로 충돌을 막는다

하나의 실행에 작성 모델과 검토 모델이 함께 있으면 둘 다 `model`, `temperature` 키를 사용한다. `config_prefix`를 주면 각각 독립된 namespace를 갖는다.

```python
from langchain.chat_models import init_chat_model

writer = init_chat_model(
    "openai:gpt-5-mini",
    temperature=0.4,
    configurable_fields=("model", "temperature"),
    config_prefix="writer",
)

reviewer = init_chat_model(
    "openai:gpt-5-mini",
    temperature=0,
    configurable_fields=("model", "temperature"),
    config_prefix="reviewer",
)

config = {
    "configurable": {
        "writer_model": "gpt-5-mini",
        "writer_temperature": 0.6,
        "reviewer_model": "gpt-5.4",
        "reviewer_temperature": 0,
    }
}

draft = writer.invoke("LangChain agent 운영 체크리스트를 작성해 줘.", config=config)
review = reviewer.invoke(
    f"다음 초안에서 빠진 위험을 지적해 줘:\n\n{draft.text}",
    config=config,
)
print(review.text)
```

prefix는 단순 이름 꾸미기가 아니라, 복합 chain에서 잘못된 모델 설정이 다른 단계로 새는 것을 막는 경계다.

## 5. tool binding 뒤에도 호출 시점에 모델을 고를 수 있다

configurable model은 일반 모델처럼 `bind_tools()`나 `with_structured_output()` 같은 선언적 연산을 연결할 수 있다.

```python
from pydantic import BaseModel, Field
from langchain.chat_models import init_chat_model


class GetWeather(BaseModel):
    """도시의 현재 날씨를 조회한다."""

    city: str = Field(description="조회할 도시 이름")


base = init_chat_model(
    temperature=0,
    configurable_fields=("model", "model_provider"),
)
model_with_tools = base.bind_tools([GetWeather])

message = model_with_tools.invoke(
    "서울 날씨를 확인해 줘.",
    config={
        "configurable": {
            "model": "gpt-5-mini",
            "model_provider": "openai",
        }
    },
)
print(message.tool_calls)
```

모델을 바꾸더라도 모든 후보가 같은 도구 스키마와 호출 방식을 충분히 지원하는지 먼저 검증해야 한다. 모델 이름만 바뀐다고 capability가 같아지는 것은 아니다.

## 자주 틀리는 점

### `configurable_fields="any"`를 편의상 사용한다

공식 API reference는 `any`가 `api_key`, `base_url` 같은 필드까지 런타임 변경 가능하게 만들 수 있다고 경고한다. 신뢰하지 않는 설정이 들어오면 요청이 다른 endpoint나 계정으로 향할 수 있다. 운영 경계에서는 필요한 필드를 tuple로 열고 값도 allowlist로 검증한다.

### 기본 모델을 주면 자동으로 모델 전환도 가능하다고 생각한다

`model`을 지정한 경우 기본 `configurable_fields`는 `None`이다. 런타임 전환이 필요하면 허용 필드를 명시해야 한다. 반대로 `model`을 생략하면 `model`과 `model_provider`가 기본 configurable field가 된다.

### prefix를 선언하고 원래 키를 전달한다

`config_prefix="writer"`이면 `model`이 아니라 `writer_model`을 전달해야 한다. 여러 configurable model이 같은 config를 공유할 때 특히 테스트로 확인한다.

### provider별 인자를 무조건 교차 적용한다

모델 공통 필드처럼 보이는 설정도 provider마다 지원 범위와 의미가 다를 수 있다. provider 전용 옵션은 해당 integration 문서를 확인하고, 교차 provider 전환 경로에서는 공통으로 검증한 최소 집합만 사용한다.

### 런타임 설정을 권한 검사로 착각한다

`configurable_fields`는 기술적인 노출 범위를 줄일 뿐 사용자별 권한·예산을 판단하지 않는다. tier-to-config 매핑, 사용량 제한, 감사 metadata는 애플리케이션 계층에서 별도로 적용한다.

## 추천 운영 흐름

1. 먼저 고정 `provider:model` 설정으로 정상 동작을 검증한다.
2. 실제로 요청별 전환이 필요한 필드만 `configurable_fields`에 추가한다.
3. 외부 입력은 공개 tier에서 서버 소유 allowlist로 변환한다.
4. 여러 모델이 한 실행에 있으면 `config_prefix`로 namespace를 나눈다.
5. 후보 모델마다 tools, structured output, streaming 회귀 테스트를 돌린다.
6. 선택된 tier와 모델 ID는 비밀값 없이 trace metadata로 기록한다.

이렇게 구성하면 provider 교체의 유연성은 유지하면서도 설정 주입과 비용 폭증 위험을 작게 만들 수 있다.

## 참고 자료

- [LangChain models](https://docs.langchain.com/oss/python/langchain/models)
- [init_chat_model API reference](https://reference.langchain.com/python/langchain/chat_models/base/init_chat_model)
- [Providers and models](https://docs.langchain.com/oss/python/concepts/providers-and-models)
- [RunnableConfig API reference](https://reference.langchain.com/python/langchain-core/runnables/config/RunnableConfig)
