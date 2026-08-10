---
title: "LangChain Anthropic prompt cache와 cross-provider fallback 안전하게 조합하기"
description: "AnthropicPromptCachingMiddleware와 ModelFallbackMiddleware의 순서, provider별 cache_control 정리, 운영 검증 포인트를 다루는 실전 노트"
date: 2026-08-10
tags:
  - langchain
  - agent
  - middleware
  - anthropic
  - reliability
  - performance
  - python
---

# LangChain Anthropic prompt cache와 cross-provider fallback 안전하게 조합하기

긴 system prompt와 많은 tool schema를 쓰는 Claude agent에는 prompt caching이 유용하다. 하지만 장애 대응용 fallback을 OpenAI 같은 다른 provider로 넘기면 Anthropic 전용 `cache_control` 메타데이터가 호환성 문제가 될 수 있다.

현재 LangChain의 `ModelFallbackMiddleware`는 이 조합을 고려한다.

- fallback도 Anthropic 모델이면 cache marker를 유지한다.
- fallback이 Anthropic marker를 받을 수 없는 모델이면 marker를 제거한다.
- 원래 요청 객체를 직접 고쳐 다음 시도까지 오염시키지 않고 fallback 요청 단위로 정리한다.

따라서 캐시 절감과 provider 장애 격리를 함께 설계할 수 있다. 다만 middleware 순서와 실제 응답 provider의 usage metadata는 직접 확인해야 한다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.3" "langchain-anthropic>=1.4" langchain-openai langgraph
```

Windows PowerShell에서는 API key를 다음처럼 설정한다.

```powershell
$env:ANTHROPIC_API_KEY="your-anthropic-key"
$env:OPENAI_API_KEY="your-openai-key"
```

이 노트는 Anthropic 자동 prompt caching을 지원하는 `langchain-anthropic>=1.4`와, provider가 다른 fallback 요청에서 Anthropic cache marker를 정리하는 현재 LangChain 1.3 계열 API를 기준으로 한다.

## 1. caching을 fallback 바깥에 둔다

LangChain middleware는 목록의 앞 항목이 바깥쪽 wrapper가 된다. prompt caching이 최초 Claude 요청을 꾸민 뒤 fallback loop가 실행되게 하려면 caching middleware를 먼저 둔다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ModelFallbackMiddleware
from langchain_anthropic import ChatAnthropic
from langchain_anthropic.middleware import AnthropicPromptCachingMiddleware
from langchain_openai import ChatOpenAI


agent = create_agent(
    model=ChatAnthropic(model="claude-sonnet-4-6"),
    tools=[],
    system_prompt=(
        "당신은 사내 정책 도우미다. "
        "아래의 긴 정책 원문에 근거해서만 답한다.\n"
        "<stable policy text ...>"
    ),
    middleware=[
        AnthropicPromptCachingMiddleware(
            ttl="5m",
            unsupported_model_behavior="raise",
        ),
        ModelFallbackMiddleware(
            ChatAnthropic(model="claude-haiku-4-5-20251001"),
            ChatOpenAI(model="gpt-5.4-mini"),
        ),
    ],
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "환불 승인 조건을 요약해 줘."}]}
)
print(result["messages"][-1].content)
```

호출 경로는 다음과 같다.

1. caching middleware가 system message, tool definitions, 대화 prefix에 Anthropic cache 정보를 적용한다.
2. 주 모델 호출이 실패하면 fallback middleware가 후보를 순서대로 시도한다.
3. Claude fallback에는 유효한 marker를 남기고, OpenAI fallback에는 Anthropic 전용 marker를 제거한다.

`unsupported_model_behavior="raise"`는 주 요청에 caching middleware를 잘못 붙인 구성을 빠르게 찾는 데 유용하다. 이 예제처럼 바깥 caching middleware가 Anthropic 주 모델을 처리한 뒤, 내부 fallback middleware가 provider 전환을 정리하는 경우와는 역할이 다르다.

## 2. 같은 provider fallback을 먼저 두는 이유

첫 fallback을 Anthropic 모델로 두면 장애 범위가 특정 모델에 한정된 경우 기존 prompt cache를 계속 활용할 가능성이 있다. 그 다음에 다른 provider를 배치하면 provider 전체 장애에도 대응할 수 있다.

```python
fallback = ModelFallbackMiddleware(
    # 같은 provider: cache marker를 유지할 수 있는 경로
    ChatAnthropic(model="claude-haiku-4-5-20251001"),
    # 다른 provider: Anthropic 전용 marker를 제거해야 하는 경로
    ChatOpenAI(model="gpt-5.4-mini"),
)
```

이 순서가 항상 정답은 아니다. SLA가 최우선이면 가장 안정적인 다른 provider를 첫 후보로 둘 수 있고, 품질이 최우선이면 주 모델과 동급인 후보를 먼저 둘 수 있다. 중요한 것은 각 후보에서 tool calling, structured output, system prompt 해석이 같은 제품 계약을 만족하는지 미리 회귀 테스트하는 것이다.

## 3. 캐시 효과와 fallback을 함께 관측한다

Anthropic 응답에서는 `usage_metadata["input_token_details"]`로 cache read와 creation을 확인할 수 있다.

```python
message = result["messages"][-1]
details = (message.usage_metadata or {}).get("input_token_details", {})

print("cache_read:", details.get("cache_read", 0))
print("cache_creation:", details.get("cache_creation", 0))
```

그러나 OpenAI fallback 응답에 Anthropic의 `cache_read` 필드가 없는 것은 정상이다. 응답 metadata만 보고 어떤 fallback이 선택됐는지 추측하지 말고 LangSmith trace나 model-call middleware 로그에 실제 model/provider를 함께 기록하는 편이 안전하다.

운영 대시보드에서는 최소한 다음을 나눠 본다.

- 주 모델 성공률과 fallback 후보별 선택 횟수
- Anthropic 호출의 cache creation 대비 cache read
- fallback 전환 뒤 응답 지연과 비용
- 후보별 tool call 및 structured output 실패율

## 4. 실패 경로를 재현하는 작은 테스트

실제 장애가 날 때만 fallback을 확인하면 늦다. staging에서는 잘못된 API key를 쓰기보다, 주 모델 자리에 항상 실패하는 test double을 넣고 성공 후보가 호출되는지 검사한다. 별도의 integration test에서는 Anthropic → Anthropic과 Anthropic → 다른 provider 두 경로를 각각 실행한다.

```python
import pytest


@pytest.mark.parametrize(
    "fallback_kind",
    ["anthropic", "openai"],
)
def test_fallback_contract(fallback_kind: str):
    """실제 test double과 recording model을 주입해 아래 계약을 검증한다."""
    observed = run_recording_fallback_scenario(fallback_kind)

    assert observed.answer_is_valid
    assert observed.tool_schema_is_valid

    if fallback_kind == "anthropic":
        assert observed.anthropic_cache_markers_present
    else:
        assert not observed.anthropic_cache_markers_present
```

`run_recording_fallback_scenario`는 프로젝트의 fake chat model로 구현하는 테스트 helper다. 핵심은 외부 API의 우연한 5xx를 기다리는 대신 fallback 요청에 전달된 messages, tools, model settings를 기록해 계약을 고정하는 것이다.

## 자주 하는 실수

### middleware 순서를 반대로 둔다

`ModelFallbackMiddleware`를 바깥에 두면 fallback handler 안에서 caching middleware가 다시 실행되는 것처럼 오해하기 쉽다. 목록의 첫 middleware가 outermost라는 규칙을 기준으로 호출 경로를 그린 뒤 배치한다.

### prompt cache를 대화 memory로 생각한다

캐시는 반복 prefix의 처리 비용을 줄일 뿐 thread state를 저장하지 않는다. 여러 `invoke()` 사이에 대화를 이어가려면 checkpointer와 고정 `thread_id`가 별도로 필요하다.

### 모든 fallback에서 같은 기능을 기대한다

cache marker 정리는 provider 오류를 막아 줄 뿐, 모델 간 tool calling이나 structured output 의미 차이까지 없애 주지는 않는다. 실제 tool schema와 대표 입력으로 후보별 테스트를 수행한다.

### cache hit만 보고 안정성을 판단한다

fallback 빈도가 높아지면 cache hit가 좋아도 전체 비용과 지연이 악화될 수 있다. 캐시 지표와 provider 전환 지표를 함께 본다.

### 버전을 고정하지 않는다

이 동작은 middleware와 provider integration 양쪽에 걸쳐 있다. `langchain`과 `langchain-anthropic`을 함께 잠그고, 업그레이드할 때 실패 경로 테스트를 다시 실행한다.

## 정리

Anthropic prompt caching과 cross-provider fallback을 함께 쓸 때 핵심은 세 가지다.

1. `AnthropicPromptCachingMiddleware`를 `ModelFallbackMiddleware`보다 앞에 둔다.
2. 같은 Anthropic fallback에는 cache marker를 유지하고, 다른 provider에는 marker가 전달되지 않는 현재 동작을 테스트한다.
3. cache usage와 실제 fallback provider를 별도 지표로 관측한다.

이 조합은 긴 고정 prompt의 비용을 줄이면서도 provider 장애에 대응해야 하는 production agent에 특히 유용하다.

## 참고 자료

- [LangChain Anthropic middleware integration](https://docs.langchain.com/oss/python/integrations/middleware/anthropic)
- [LangChain ModelFallbackMiddleware API reference](https://reference.langchain.com/python/langchain/agents/middleware/model_fallback/ModelFallbackMiddleware)
- [LangChain model fallback module notes](https://reference.langchain.com/python/langchain/agents/middleware/model_fallback)
- [LangChain ChatAnthropic integration: prompt caching](https://docs.langchain.com/oss/python/integrations/chat/anthropic)
