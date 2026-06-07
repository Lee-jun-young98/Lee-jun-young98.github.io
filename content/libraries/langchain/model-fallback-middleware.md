---
title: LangChain ModelFallbackMiddleware로 모델 장애에 대비하기
description: LangChain의 ModelFallbackMiddleware로 주 모델 장애, provider 이중화, 저비용 대체 모델 전환을 실무적으로 구성하는 방법을 정리한 가이드
date: 2026-06-07
tags:
  - langchain
  - agent
  - middleware
  - reliability
  - python
---

# LangChain ModelFallbackMiddleware로 모델 장애에 대비하기

LangChain 에이전트를 운영하다 보면 tool 실패만이 아니라 모델 호출 자체가 깨지는 순간이 있다.

- 특정 provider가 일시적으로 장애를 겪는다
- 주 모델이 rate limit이나 5xx 오류를 반복한다
- 비싼 주 모델이 실패했을 때 더 싼 대체 모델로라도 응답을 끝내고 싶다

이때 각 호출 경로마다 직접 fallback 분기를 넣기 시작하면 agent 코드가 금방 지저분해진다.  
LangChain은 이런 상황을 위해 `ModelFallbackMiddleware`를 제공한다.

이번 글에서는 아래를 실무 기준으로 정리한다.

- `ModelFallbackMiddleware`가 정확히 언제 필요한지
- 가장 단순한 fallback 예제
- 다른 provider로 넘기는 이중화 예제
- `ModelRetryMiddleware`와 무엇이 다른지
- 자주 하는 실수와 운영 팁

## 언제 쓰면 좋은가

`ModelFallbackMiddleware`는 "같은 요청을 다른 모델로 이어서 시도해도 되는 경우"에 맞는다.

- 주 모델이 완전히 실패했을 때 응답 성공률을 높이고 싶을 때
- OpenAI 하나에만 의존하지 않고 Anthropic 같은 다른 provider를 예비 경로로 둘 때
- 비싼 주 모델이 죽었을 때 더 저렴한 모델로라도 작업을 마무리하고 싶을 때

반대로 아래 상황은 먼저 점검해야 한다.

- 응답 품질 편차가 큰데 fallback 모델 품질 검증을 하지 않은 경우
- structured output 스키마는 엄격한데 fallback 모델의 지원 여부를 확인하지 않은 경우
- provider별 tool calling 동작 차이를 감당하지 못하는 경우

핵심은 "실패 복구"보다 먼저 "대체 모델로 넘어가도 제품 동작이 여전히 안전한가"를 확인하는 것이다.

## 사전 준비

공식 문서 기준으로 `ModelFallbackMiddleware`는 `langchain` v1 계열 middleware다.  
교차 provider fallback을 쓰려면 해당 provider 패키지도 같이 설치해야 한다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai langchain-anthropic
```

OpenAI만 쓰는 최소 예제라면 `langchain-openai`만 있어도 된다.

macOS / Linux:

```bash
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your-openai-key"
$env:ANTHROPIC_API_KEY="your-anthropic-key"
```

## 1. 가장 단순한 fallback 예제

공식 문서 기준으로 주 모델은 `create_agent(...)`의 `model=`에 두고, fallback 후보만 middleware에 넣는다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ModelFallbackMiddleware
from langchain.tools import tool


@tool
def search_docs(query: str) -> str:
    """간단한 문서 검색 도구."""
    return f"docs result for: {query}"


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[search_docs],
    middleware=[
        ModelFallbackMiddleware(
            "openai:gpt-5.4-mini",
        )
    ],
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "LangChain middleware 종류를 짧게 정리해줘",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

흐름은 단순하다.

1. 먼저 주 모델 `openai:gpt-5.4`를 호출한다.
2. 주 모델 호출이 예외로 실패하면 `openai:gpt-5.4-mini`를 시도한다.
3. fallback도 실패하면 마지막 예외가 바깥으로 전달된다.

즉 성공 경로는 그대로 두고, 실패 경로만 middleware에서 복구한다.

## 2. 다른 provider로 넘기는 이중화 예제

실무에서 더 유용한 형태는 같은 provider 안의 작은 모델이 아니라 아예 다른 provider를 예비 경로로 두는 방식이다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ModelFallbackMiddleware
from langchain.tools import tool


@tool
def search_status_page(service_name: str) -> str:
    """외부 서비스 상태를 조회한다고 가정한 예제 도구."""
    return f"{service_name} status page checked"


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[search_status_page],
    middleware=[
        ModelFallbackMiddleware(
            "openai:gpt-5.4-mini",
            "anthropic:claude-sonnet-4-5-20250929",
        )
    ],
    system_prompt=(
        "도구가 필요할 때만 호출하고, 확인하지 못한 내용은 추측하지 마라."
    ),
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "OpenAI 장애 대응 체크리스트를 세 줄로 정리해줘",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

이 구성이 좋은 이유는 아래와 같다.

- OpenAI 전면 장애처럼 provider 레벨 실패에도 대응할 수 있다
- 비슷한 에이전트 코드를 유지한 채 provider 의존성을 줄일 수 있다
- 주 모델과 예비 모델의 비용, 속도, 품질 균형을 따로 설계할 수 있다

다만 provider를 섞을 때는 아래를 꼭 확인해야 한다.

- 같은 system prompt와 tool 설명에서 응답 품질이 크게 흔들리지 않는지
- structured output 스키마를 동일하게 만족하는지
- tool calling이 없는 단순 Q&A와 tool-heavy workflow에서 결과 차이가 과하지 않은지

## 3. `ModelRetryMiddleware`와 무엇이 다른가

이 둘은 같이 쓰기 쉽지만 역할은 다르다.

### `ModelRetryMiddleware`

- 같은 모델을 다시 시도한다
- rate limit, 일시적 timeout, 순간적인 5xx처럼 "잠깐 실패"에 맞는다
- backoff, jitter, 재시도 횟수 설정이 중요하다

### `ModelFallbackMiddleware`

- 다른 모델로 넘긴다
- 주 모델이나 provider가 아예 불안정하거나 완전히 죽은 상황에 맞는다
- 재시도보다 모델 품질 호환성이 더 중요하다

보통은 아래 순서가 실용적이다.

1. 같은 모델에서 짧게 재시도한다
2. 그래도 실패하면 다른 모델로 넘긴다

예:

```python
from langchain.agents import create_agent
from langchain.agents.middleware import (
    ModelFallbackMiddleware,
    ModelRetryMiddleware,
)


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[],
    middleware=[
        ModelRetryMiddleware(
            max_retries=2,
            initial_delay=1.0,
            backoff_factor=2.0,
        ),
        ModelFallbackMiddleware(
            "openai:gpt-5.4-mini",
            "anthropic:claude-sonnet-4-5-20250929",
        ),
    ],
)
```

실무에서는 이 조합이 가장 이해하기 쉽다.

- 짧은 네트워크 흔들림은 retry가 해결한다
- provider 자체 장애는 fallback이 해결한다

## 4. 어떤 fallback 순서가 좋은가

fallback 순서는 보통 아래 셋 중 하나로 설계한다.

### 품질 우선

- 주 모델: 최고 품질 모델
- 1차 fallback: 같은 provider의 한 단계 작은 모델
- 2차 fallback: 다른 provider의 비슷한 급 모델

품질 저하를 최소화하고 싶을 때 좋다.

### 비용 우선

- 주 모델: 기본 운영 모델
- 1차 fallback: 더 저렴한 모델
- 2차 fallback: 다른 provider의 저비용 모델

장애 시에도 응답 자체는 유지하되 비용 폭증을 막고 싶을 때 맞는다.

### 가용성 우선

- 주 모델: 주 provider
- 1차 fallback: 완전히 다른 provider
- 2차 fallback: 내부 정책상 허용되는 마지막 예비 모델

SLA가 중요한 운영 경로라면 이쪽이 더 낫다.

핵심은 "좋은 모델 순서"가 아니라 "실패했을 때 어떤 열화가 허용되는가"를 먼저 정하는 것이다.

## 5. 자주 하는 실수

### 1. fallback 모델이 같은 기능을 지원한다고 가정한다

공식 문서상 `ModelFallbackMiddleware`는 모델 호출 실패 시 다른 모델을 순차 시도하는 역할만 한다.  
structured output, tool calling, 긴 컨텍스트 처리 품질까지 자동으로 맞춰주지는 않는다.

특히 아래는 미리 확인해야 한다.

- schema 기반 structured output
- 긴 system prompt
- 병렬 tool call
- provider별 safety policy 차이

### 2. 같은 provider의 같은 계정만 써 놓고 "이중화"라고 생각한다

`openai:gpt-5.4` 다음에 `openai:gpt-5.4-mini`를 두는 것은 유용하지만, provider 전체 장애에는 약하다.  
진짜 가용성 이중화가 목적이면 다른 provider를 포함시키는 편이 낫다.

### 3. fallback이 일어났는지 관찰하지 않는다

fallback은 성공률을 올려 주지만, 너무 자주 일어나면 주 모델이 이미 불안정하다는 뜻이다.  
LangSmith trace나 자체 로깅에서 "주 모델 실패 후 fallback 사용"을 꼭 구분해서 봐야 한다.

### 4. 품질 검증 없이 운영 경로에 넣는다

요약, 고객 응대, 내부 운영 자동화처럼 출력 품질 기준이 있는 작업에서는 fallback 모델 결과를 별도로 검증해야 한다.  
특히 agent가 tool을 여러 번 호출하는 경로에서는 단순 채팅보다 차이가 커질 수 있다.

## 6. 운영 팁

- 단순 장애 복구라면 `ModelRetryMiddleware`와 함께 쓴다
- provider 이중화가 목적이면 최소 한 개는 다른 provider로 둔다
- fallback 모델에서도 같은 tool set과 prompt가 무리 없이 동작하는지 trace로 확인한다
- structured output을 쓴다면 fallback 모델까지 실제 스키마 검증 테스트를 돌린다

개인적으로는 처음부터 fallback 후보를 많이 넣기보다 1~2개만 두고, 실제 장애나 성능 데이터를 본 뒤 늘리는 편이 낫다.

## 마무리

`ModelFallbackMiddleware`는 "모델 호출 실패를 다른 모델로 넘겨서 복구하는 가장 단순한 운영 장치"에 가깝다.

- 주 모델이 잠깐 흔들리면 retry로 버티고
- 그래도 안 되면 fallback으로 다른 모델에 넘기고
- 그 결과를 trace로 계속 관찰하는 식이 가장 실용적이다

LangChain 에이전트를 로컬 데모에서 실제 서비스로 옮길수록, prompt 최적화보다 이런 복구 경로가 더 큰 차이를 만든다.

## 참고 자료

- [LangChain Prebuilt Middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [LangChain ModelFallbackMiddleware Reference](https://reference.langchain.com/python/langchain/agents/middleware/model_fallback/ModelFallbackMiddleware)
- [LangChain ModelRetryMiddleware Reference](https://reference.langchain.com/python/langchain/agents/middleware/model_retry/ModelRetryMiddleware)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain Going to Production](https://docs.langchain.com/oss/python/deepagents/going-to-production)
