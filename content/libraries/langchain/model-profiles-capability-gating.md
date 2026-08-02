---
title: LangChain model profile로 모델 기능을 실행 전에 검사하기
description: LangChain 1.1+의 model.profile로 context window, tool calling, structured output, multimodal 지원을 확인하고 안전하게 fallback하는 방법
date: 2026-08-02
tags:
  - langchain
  - agent
  - model
  - python
---

# LangChain model profile로 모델 기능을 실행 전에 검사하기

모델 이름만 바꿨는데 agent가 갑자기 tool을 호출하지 못하거나 이미지 입력을 거절하는 경우가 있다. 공급자 API가 같아 보여도 모델마다 context window와 tool calling, structured output, multimodal 지원 범위가 다르기 때문이다.

LangChain 1.1부터 chat model의 `profile` 속성으로 이런 capability를 코드에서 조회할 수 있다. 이 글에서는 profile을 단순 출력하는 데서 끝내지 않고, 요청을 보내기 전에 요구 기능을 검사하고 fallback 모델을 고르는 패턴을 정리한다.

## 사전 준비

```bash
pip install -U "langchain>=1.1" langchain-openai langchain-anthropic
```

실제로 모델을 호출하려면 사용하는 공급자의 API key도 환경 변수로 설정한다.

```powershell
$env:OPENAI_API_KEY="your-api-key"
$env:ANTHROPIC_API_KEY="your-api-key"
```

profile 조회와 검증 자체는 API 요청을 만들지 않으므로, 모델 호출 전 구성 검사에도 활용할 수 있다.

## 1. profile에서 필요한 값만 읽기

```python
from langchain.chat_models import init_chat_model

model = init_chat_model("openai:gpt-5.5")
profile = model.profile or {}

print("context:", profile.get("max_input_tokens"))
print("tool calling:", profile.get("tool_calling"))
print("structured output:", profile.get("structured_output"))
print("image input:", profile.get("image_inputs"))
print("reasoning output:", profile.get("reasoning_output"))
```

profile은 일반 `dict`다. 필드는 공급자와 모델에 따라 없을 수 있으므로 `profile["tool_calling"]`처럼 바로 접근하기보다 `get()`을 사용하는 편이 안전하다.

여기서 가장 중요한 규칙은 **값이 없다는 사실을 `False`와 같게 취급하지 않는 것**이다.

- `True`: 지원한다고 알려져 있다.
- `False`: 지원하지 않는다고 알려져 있다.
- `None` 또는 키 없음: 현재 metadata만으로 판단할 수 없다.

## 2. agent 생성 전에 capability gate 두기

도구 호출이 필수인 agent라면 모델 실행 뒤의 오류보다 시작 시점의 명확한 오류가 낫다.

```python
from collections.abc import Iterable
from typing import Any

from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langchain.tools import tool


def require_capabilities(model: Any, required: Iterable[str]) -> None:
    profile = model.profile or {}
    unsupported = [name for name in required if profile.get(name) is False]
    unknown = [name for name in required if profile.get(name) is None]

    if unsupported:
        raise ValueError(f"지원하지 않는 기능: {', '.join(unsupported)}")
    if unknown:
        raise ValueError(
            "profile에서 지원 여부를 확인할 수 없는 기능: "
            + ", ".join(unknown)
        )


@tool
def get_order_status(order_id: str) -> str:
    """주문 상태를 조회한다."""
    return f"{order_id}: 배송 준비 중"


model = init_chat_model("openai:gpt-5.5")
require_capabilities(model, ["tool_calling"])

agent = create_agent(model=model, tools=[get_order_status])
```

`unknown`을 허용할지 차단할지는 서비스 정책이다. 결제·파일 쓰기처럼 실패 비용이 큰 agent는 fail closed가 안전하고, 일반 채팅처럼 fallback이 쉬운 경로는 경고만 남긴 뒤 probe 요청으로 확인할 수 있다.

## 3. 요구 기능에 맞는 fallback 모델 고르기

후보를 순서대로 검사하면 공급자 장애 fallback뿐 아니라 capability fallback도 구성할 수 있다.

```python
from langchain.chat_models import init_chat_model


def choose_model(candidates: list[str], required: set[str]):
    unknown_candidates = []

    for name in candidates:
        model = init_chat_model(name)
        profile = model.profile or {}

        if all(profile.get(capability) is True for capability in required):
            return model

        if not any(profile.get(capability) is False for capability in required):
            unknown_candidates.append(name)

    raise RuntimeError(
        f"요구 기능 {sorted(required)}을 확인한 모델이 없습니다. "
        f"metadata가 불완전한 후보: {unknown_candidates}"
    )


model = choose_model(
    ["openai:gpt-5.5", "anthropic:claude-sonnet-4-6"],
    required={"tool_calling", "structured_output"},
)
```

이 코드는 profile이 불완전한 모델을 무조건 탈락시키되, 오류 메시지에서 별도로 알려 준다. 운영 환경에서는 선택 결과를 캐시해야 매 요청마다 모델 객체를 다시 만들지 않는다.

## 4. context window와 입력 modality 검사하기

긴 문서나 이미지가 섞인 입력은 호출 전에 별도 gate를 두면 비용 낭비를 줄일 수 있다.

```python
def validate_request(
    model,
    *,
    estimated_input_tokens: int,
    has_images: bool,
) -> None:
    profile = model.profile or {}
    max_input_tokens = profile.get("max_input_tokens")

    if max_input_tokens is not None and estimated_input_tokens > max_input_tokens:
        raise ValueError(
            f"예상 입력 {estimated_input_tokens:,} tokens가 "
            f"한도 {max_input_tokens:,}를 넘습니다."
        )

    if has_images and profile.get("image_inputs") is not True:
        raise ValueError("이미지 입력 지원을 profile에서 확인할 수 없습니다.")
```

token 수는 tokenizer로 별도 계산해야 한다. `max_input_tokens`는 한도 metadata이지 현재 prompt의 token 수를 세어 주는 기능이 아니다. 출력 token과 tool schema, system message에 필요한 여유도 남겨야 한다.

## 5. 잘못되거나 없는 profile 보정하기

사내 gateway나 새 모델처럼 metadata가 아직 없으면 초기화할 때 검증된 profile을 넘길 수 있다.

```python
from langchain.chat_models import init_chat_model

verified_profile = {
    "max_input_tokens": 128_000,
    "tool_calling": True,
    "structured_output": True,
    "image_inputs": False,
}

model = init_chat_model(
    "openai:company-model",
    base_url="https://llm.example.com/v1",
    profile=verified_profile,
)
```

공유 중인 모델의 `profile`을 제자리에서 수정하면 다른 요청에도 영향을 준다. 이미 생성된 공용 객체를 보정해야 한다면 복사본을 만들거나, 애플리케이션 설정 단계에서 profile을 주입해 immutable configuration처럼 다루는 편이 낫다.

## 흔한 실수

### profile을 실제 동작 보증서로 생각하기

profile은 capability metadata다. 계정 권한, 지역 제한, 공급자 장애, API 버전까지 보증하지는 않는다. startup validation과 실제 호출의 timeout·retry·fallback은 함께 필요하다.

또한 공식 문서에서 model profile은 아직 beta로 표시된다. 필드 형식이 바뀔 수 있으므로 profile 접근을 작은 adapter 함수에 모아 두는 편이 안전하다.

### 키가 없으면 지원하지 않는다고 단정하기

새 모델이나 커스텀 endpoint는 metadata가 늦게 반영될 수 있다. `False`와 unknown을 분리하고, unknown을 허용할 때는 실제 probe와 관측 결과를 남긴다.

### context 한도를 prompt budget으로 그대로 쓰기

입력 한도 끝까지 채우면 출력 공간과 agent의 다음 tool loop가 부족해질 수 있다. system message, tool schema, 예상 출력, 후속 호출용 안전 여유를 뺀 예산을 사용한다.

### profile만 보고 동적으로 tool을 붙였다 떼기

capability 확인은 모델이 도구 호출을 지원하는지 알려 줄 뿐, 현재 사용자가 어떤 도구를 사용할 권한이 있는지는 알려 주지 않는다. 권한과 업무 단계에 따른 tool filtering은 middleware나 runtime context에서 별도로 처리한다.

## 마무리

`model.profile`은 모델 선택을 문자열과 경험칙에서 검증 가능한 configuration으로 바꿔 준다. 특히 여러 공급자를 섞거나 이미지·도구·structured output을 함께 쓰는 agent에서 효과가 크다.

- 필수 capability를 agent 생성 전에 검사한다.
- `False`와 unknown을 구분한다.
- context window에는 출력과 반복 호출을 위한 여유를 둔다.
- 보정 profile은 실제 검증 결과와 함께 버전 관리한다.
- profile 검사와 런타임 오류 처리 모두 유지한다.

## 참고 자료

- [LangChain Models — Model profiles](https://docs.langchain.com/oss/python/langchain/models#model-profiles)
- [LangChain Providers and models](https://docs.langchain.com/oss/python/concepts/providers-and-models)
- [LangChain ModelProfile API reference](https://reference.langchain.com/python/langchain-core/language_models/model_profile/ModelProfile)
