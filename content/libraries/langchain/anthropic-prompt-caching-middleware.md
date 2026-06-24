---
title: "LangChain AnthropicPromptCachingMiddleware로 긴 system prompt 비용과 지연 줄이기"
description: "LangChain AnthropicPromptCachingMiddleware로 Claude 에이전트의 긴 system prompt, tool schema, 대화 prefix를 캐시해 반복 호출 비용과 지연을 줄이는 실전 학습 노트"
date: 2026-06-24
tags:
  - langchain
  - agent
  - middleware
  - anthropic
  - performance
  - python
aliases:
  - "/blog/langchain-anthropic-prompt-caching-middleware"
---

# LangChain AnthropicPromptCachingMiddleware로 긴 system prompt 비용과 지연 줄이기

LangChain agent를 Claude 계열 모델로 운영하다 보면, 모델 응답보다 먼저 비용이 커지는 구간이 보인다.

- 긴 system prompt를 매 턴 다시 보낸다
- tool schema가 많아서 매 호출 입력 토큰이 커진다
- 같은 thread에서 대화 prefix를 반복 처리한다

이럴 때 `AnthropicPromptCachingMiddleware`를 붙이면 LangChain agent 레이어에서 Anthropic prompt caching을 자동으로 활용할 수 있다.

2026년 6월 24일 기준 LangChain 공식 Anthropic middleware 문서에는 다음 옵션이 정리되어 있다.

- `ttl="5m"` 또는 `ttl="1h"`
- `type="ephemeral"`만 지원
- `min_messages_to_cache`
- `unsupported_model_behavior="ignore" | "warn" | "raise"`

공식 문서 설명대로 이 middleware는 system prompt, tools, 이전 메시지 같은 안정적인 prefix를 캐시에 재사용하게 도와주지만, 대화 상태 자체를 저장하지는 않는다. 상태 지속은 별도의 checkpointer가 맡는다.

이 글에서는 아래만 실무 기준으로 짧게 정리한다.

- 언제 바로 붙일 가치가 큰지
- checkpointer와 어떤 역할 분담을 하는지
- `ttl`, `min_messages_to_cache`를 어떻게 고를지
- 운영에서 자주 나는 실수

## 언제 바로 붙일 만한가

아래 중 하나라도 해당하면 우선 검토할 가치가 크다.

- agent의 system prompt가 길고 자주 바뀌지 않는 경우
- tool 개수가 많아 tool schema 토큰이 큰 경우
- 같은 `thread_id`로 여러 턴을 이어가는 고객 응대형 agent
- Claude 모델 응답 품질은 유지하고 입력 비용과 지연만 줄이고 싶은 경우

반대로 아래 상황에서는 기대 효과가 작을 수 있다.

- 매 요청마다 prompt 구조가 크게 달라지는 one-shot 작업
- 턴 간 상태를 저장하지 않아 대화 prefix가 매번 바뀌는 경우
- Anthropic이 아닌 모델을 주로 쓰는 경우

핵심은 "같은 prefix가 반복되는가"다.  
반복 prefix가 없다면 캐싱 미들웨어를 붙여도 체감 이득이 작다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langchain-anthropic langgraph
```

PowerShell:

```powershell
$env:ANTHROPIC_API_KEY="your-api-key"
```

## 1. 가장 작은 예제

LangChain 공식 Anthropic middleware 문서의 가장 기본 예제는 아래 형태다.

```python
from langchain.agents import create_agent
from langchain_anthropic import ChatAnthropic
from langchain_anthropic.middleware import AnthropicPromptCachingMiddleware


LONG_PROMPT = """
You are a careful support agent.

Follow the company policy exactly.
Use the refund guide below.
<lots of stable policy text here>
"""


agent = create_agent(
    model=ChatAnthropic(model="claude-sonnet-4-6"),
    tools=[],
    system_prompt=LONG_PROMPT,
    middleware=[
        AnthropicPromptCachingMiddleware(ttl="5m"),
    ],
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "환불 규정을 세 줄로 요약해줘.",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

이 설정이면 LangChain이 Anthropic prompt caching을 활용할 수 있게 요청 prefix를 구성한다.  
특히 길고 잘 안 바뀌는 system prompt가 있을 때 첫 요청 이후 이득이 생기기 쉽다.

## 2. prompt caching은 memory가 아니다

이 부분을 가장 많이 헷갈린다.

- prompt caching: 같은 prefix를 다시 계산하지 않도록 비용과 지연을 줄임
- checkpointer: 대화 state와 메시지 히스토리를 다음 호출에서도 이어감

LangChain 공식 문서도 prompt caching은 memory를 제공하지 않으며, 대화 지속에는 `MemorySaver` 같은 checkpointer가 필요하다고 설명한다.

실무에서는 둘을 같이 붙이는 경우가 많다.

```python
from langchain.agents import create_agent
from langchain.messages import HumanMessage
from langchain_core.runnables import RunnableConfig
from langchain_anthropic import ChatAnthropic
from langchain_anthropic.middleware import AnthropicPromptCachingMiddleware
from langgraph.checkpoint.memory import MemorySaver


LONG_PROMPT = """
You are a helpful assistant.
<lots more stable context here>
"""


agent = create_agent(
    model=ChatAnthropic(model="claude-sonnet-4-6"),
    tools=[],
    system_prompt=LONG_PROMPT,
    middleware=[AnthropicPromptCachingMiddleware(ttl="5m")],
    checkpointer=MemorySaver(),
)

config: RunnableConfig = {"configurable": {"thread_id": "user-123"}}

agent.invoke(
    {"messages": [HumanMessage("안녕, 내 이름은 Bob이야")]},
    config=config,
)

result = agent.invoke(
    {"messages": [HumanMessage("내 이름이 뭐였지?")]},
    config=config,
)

print(result["messages"][-1].content)
```

여기서 `thread_id`와 checkpointer가 대화 이력을 유지하고, prompt caching middleware는 그 반복 prefix의 재처리 비용을 줄여 준다.

즉 "기억"은 checkpointer가 하고, "반복 입력 최적화"는 caching middleware가 한다.

## 3. 설정값은 어떻게 고르나

공식 Anthropic middleware 문서 기준으로 실무에서 먼저 봐야 할 옵션은 네 가지다.

### `ttl`

- `"5m"`: 짧은 세션성 대화에 무난한 기본값
- `"1h"`: 같은 고객 세션이나 긴 작업 세션을 오래 이어갈 때 검토

짧은 고객 상담, 내부 Copilot 대화처럼 세션이 촘촘하면 `5m`부터 시작하는 편이 보수적이다.  
오래 이어지는 분석 세션이라면 `1h`가 맞을 수 있다.

### `min_messages_to_cache`

대화가 너무 짧을 때는 캐싱을 서두를 이유가 약할 수 있다.

```python
AnthropicPromptCachingMiddleware(
    ttl="5m",
    min_messages_to_cache=2,
)
```

이런 식으로 두면 첫 몇 턴은 일반 호출로 보내고, 대화가 어느 정도 쌓인 뒤부터 캐싱을 시작하게 만들 수 있다.

### `unsupported_model_behavior`

Anthropic 전용 미들웨어를 다른 모델과 섞어 쓰는 경우를 대비한 옵션이다.

```python
AnthropicPromptCachingMiddleware(
    ttl="5m",
    unsupported_model_behavior="raise",
)
```

개발 단계에서는 `"raise"`가 안전하다.  
실수로 OpenAI나 Gemini 모델에 이 미들웨어를 붙여도 바로 드러나기 때문이다.

운영에서 여러 provider를 라우팅한다면 `"warn"`으로 두고 로그를 보는 선택도 가능하다.

### `type`

공식 문서 기준 현재 지원 타입은 `type="ephemeral"`뿐이다.  
즉 이 미들웨어는 Anthropic의 ephemeral cache 흐름에 맞춰 쓰는 것으로 이해하면 된다.

## 4. usage metadata를 같이 보자

LangChain models 문서는 prompt cache 사용 여부가 모델 응답의 usage metadata에 반영된다고 설명한다.  
따라서 붙였는지만 보고 끝내지 말고 실제로 캐시 hit가 나는지 관측해야 한다.

실무 체크 포인트는 보통 이 정도다.

- 첫 요청 대비 두 번째 요청의 입력 비용이 줄었는가
- 같은 `thread_id`에서 후속 턴 지연이 줄었는가
- 긴 prompt가 실제로 반복되고 있는가

캐시가 안 먹는다면 middleware보다 상위 설계를 먼저 의심해야 한다.

- system prompt가 매번 달라진다
- tool 목록이 요청마다 바뀐다
- 같은 thread를 유지하지 않는다
- 캐시 가능한 길이보다 prompt가 너무 짧다

Anthropic 공식 prompt caching 문서도 model별 최소 캐시 가능 길이와 cache_control 동작이 다를 수 있다고 안내하므로, 운영 모델 기준으로 확인하는 편이 안전하다.

## 5. 운영에서 자주 하는 실수

### 1. checkpointer 없이 "이제 agent가 기억하겠지"라고 기대한다

prompt caching은 계산 최적화지 메모리 저장소가 아니다.  
멀티턴 기억은 `MemorySaver`, DB-backed saver 같은 checkpointer가 맡는다.

### 2. 매 턴 system prompt를 다시 생성한다

사용자별 템플릿을 매번 크게 다시 쓰면 캐시 hit가 줄어든다.  
안정적인 정책 문구와 자주 바뀌는 문맥을 분리하는 편이 낫다.

### 3. tool schema가 매번 바뀌는데 캐시 이득을 기대한다

runtime tool registration이나 동적 tool 집합이 잦으면 prefix 안정성이 깨질 수 있다.  
이 경우는 tool selection 전략과 함께 봐야 한다.

### 4. 너무 짧은 요청에도 무조건 캐싱이 이득이라고 본다

LangChain models 문서와 Anthropic 문서 모두 prompt caching이 모델별 최소 길이와 provider 동작에 영향을 받는다고 본다.  
짧은 요청에서는 효과가 거의 없을 수 있다.

### 5. provider별 caching 방식 차이를 무시한다

LangChain models 문서 기준 prompt caching 방식은 provider마다 다르다.

- OpenAI: `prompt_cache_key` 같은 provider-level 제어
- Anthropic: `cache_control` 기반 prompt caching
- Bedrock: `cachePoint` 기반 흐름

그래서 이 미들웨어는 "Claude를 LangChain agent로 쓸 때의 가장 간단한 Anthropic 최적화"로 이해하는 편이 정확하다.

## 추천 시작점

개인적으로는 아래 조합이 가장 실용적이다.

1. Claude agent + 긴 system prompt
2. `AnthropicPromptCachingMiddleware(ttl="5m")`
3. `MemorySaver()`와 고정된 `thread_id`
4. usage metadata와 응답 지연을 같이 관측

그 다음에야 `ttl="1h"`, `min_messages_to_cache`, tool 구성 안정화 같은 세부 튜닝으로 들어가면 된다.

## 참고 자료

- [LangChain Anthropic middleware integration](https://docs.langchain.com/oss/python/integrations/middleware/anthropic)
- [LangChain Models: Prompt caching](https://docs.langchain.com/oss/python/langchain/models)
- [Anthropic Prompt caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching)
