---
title: LangChain dynamic_prompt로 상황별 system prompt 주입하기
description: LangChain dynamic_prompt 미들웨어로 사용자 역할, 대화 길이, 저장된 선호도에 따라 system prompt를 런타임에 바꾸는 실전 패턴 정리
date: 2026-06-03
tags:
  - langchain
  - agent
  - middleware
  - prompt
  - python
---

# LangChain dynamic_prompt로 상황별 system prompt 주입하기

LangChain `create_agent`는 `system_prompt`에 고정 문자열을 넣는 것만으로도 충분히 시작할 수 있다.  
하지만 실제 서비스에서는 모든 사용자와 모든 turn에 같은 지시문을 쓰면 금방 한계가 온다.

- 초보 사용자에게는 쉬운 설명이 필요하다
- 관리자에게는 운영용 도구 사용 지침이 더 필요하다
- 대화가 길어지면 답변을 더 짧게 강제하고 싶다
- 저장된 사용자 선호도를 system prompt에 반영하고 싶다

이럴 때 쓰는 기능이 `dynamic_prompt`다.  
공식 문서 기준으로 `@dynamic_prompt`는 각 model call 직전에 `ModelRequest`를 받아 현재 `state`, `runtime.context`, `runtime.store`를 읽고 system prompt 문자열을 동적으로 만든다.

이번 글에서는 아래 순서로 정리한다.

- `dynamic_prompt`가 언제 유용한지
- 가장 작은 예제로 role 기반 프롬프트 만들기
- store에서 선호도를 읽어 prompt에 반영하는 방법
- `dynamic_prompt`와 tool 제어를 섞을 때 주의할 점
- 운영에서 자주 생기는 실수

## 언제 쓰면 좋은가

`dynamic_prompt`는 "도구를 바꾸는 기능"이 아니라 "모델에게 줄 지시문을 매 호출마다 다시 조립하는 기능"이다.

다음 상황에서 특히 실용적이다.

- 같은 에이전트를 여러 사용자 등급에서 공유할 때
- 대화 길이나 현재 상태에 따라 답변 스타일을 바꾸고 싶을 때
- long-term memory나 사용자 설정을 system prompt에 녹여야 할 때
- 배포 환경별로 안전 가이드를 다르게 넣고 싶을 때

반대로 아래 문제는 다른 미들웨어가 더 직접적이다.

- 실제 사용 가능한 도구 집합을 제한하고 싶다  
  `wrap_model_call` 기반 tool filtering이 더 적합하다.
- 도구 실행 전에 사람 승인이 필요하다  
  `HumanInTheLoopMiddleware`가 더 적합하다.
- 오래된 tool output이 너무 길다  
  `ContextEditingMiddleware`나 `SummarizationMiddleware`가 더 적합하다.

## 사전 준비

공식 설치 문서 기준으로 LangChain은 Python 3.10+ 환경을 권장한다.

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

## 1. 가장 작은 예제: 사용자 역할에 따라 system prompt 바꾸기

공식 agents, runtime 문서 흐름대로 보면 `dynamic_prompt`는 `context_schema`와 같이 쓸 때 가장 이해하기 쉽다.

```python
from dataclasses import dataclass

from langchain.agents import create_agent
from langchain.agents.middleware import dynamic_prompt, ModelRequest


@dataclass
class Context:
    user_role: str


@dynamic_prompt
def role_based_prompt(request: ModelRequest) -> str:
    user_role = request.runtime.context.user_role
    base = "You are a helpful Korean AI assistant."

    if user_role == "beginner":
        return base + " Explain concepts simply and avoid jargon."
    if user_role == "expert":
        return base + " Use technical language and include trade-offs."
    return base


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    middleware=[role_based_prompt],
    context_schema=Context,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "vector database가 뭐야?"}]},
    context=Context(user_role="beginner"),
)

print(result["messages"][-1].content)
```

핵심은 세 가지다.

- `@dynamic_prompt` 함수는 `ModelRequest`를 입력으로 받는다
- `request.runtime.context`에서 런타임 컨텍스트를 읽는다
- 반환값은 최종 system prompt 문자열이다

즉 "user_role을 tool에 넘기는 것"이 아니라 "user_role에 맞는 지시문을 그 turn의 model call에 주입하는 것"이다.

## 2. 상태 길이에 따라 답변 톤 조절하기

공식 context engineering 문서에는 `request.messages`를 `request.state["messages"]`의 shortcut으로 쓸 수 있다고 나온다.  
이 점을 이용하면 대화가 길어질수록 답변을 더 짧고 압축적으로 유도할 수 있다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import dynamic_prompt, ModelRequest
from langgraph.checkpoint.memory import InMemorySaver


@dynamic_prompt
def conversation_length_prompt(request: ModelRequest) -> str:
    message_count = len(request.messages)
    prompt = "You are a helpful assistant."

    if message_count > 12:
        prompt += " This is a long conversation. Be concise and avoid repetition."

    return prompt


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    middleware=[conversation_length_prompt],
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": "prompt-demo-thread"}}

agent.invoke(
    {"messages": [{"role": "user", "content": "앞으로 내 질문은 모두 한국어로 답해줘."}]},
    config=config,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "지금까지 맥락을 유지하면서 답변 규칙을 정리해줘."}]},
    config=config,
)

print(result["messages"][-1].content)
```

여기서 중요한 점은 `dynamic_prompt`가 호출 단위로 동작한다는 것이다.  
같은 `thread_id`를 이어 쓰면 누적된 message 상태를 읽고, 그 길이에 맞춰 다음 model call의 system prompt를 다시 만든다.

## 3. store에서 사용자 선호도를 읽어 prompt에 반영하기

실무에서는 "초보/전문가" 같은 role보다 사용자별 응답 선호도가 더 자주 필요하다.  
공식 context engineering 문서 기준으로 `dynamic_prompt` 안에서는 `request.runtime.store`도 읽을 수 있다.

```python
from dataclasses import dataclass

from langchain.agents import create_agent
from langchain.agents.middleware import dynamic_prompt, ModelRequest
from langgraph.store.memory import InMemoryStore


store = InMemoryStore()
store.put(
    ("preferences",),
    "user-123",
    {"communication_style": "bullet-first", "language": "ko"},
)


@dataclass
class Context:
    user_id: str


@dynamic_prompt
def preference_prompt(request: ModelRequest) -> str:
    user_id = request.runtime.context.user_id
    prefs = request.runtime.store.get(("preferences",), user_id)

    prompt = "You are a helpful assistant."

    if prefs:
        style = prefs.value.get("communication_style", "balanced")
        language = prefs.value.get("language", "en")
        prompt += f" Reply in {language}."

        if style == "bullet-first":
            prompt += " Start with a short bullet summary before details."

    return prompt


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    middleware=[preference_prompt],
    context_schema=Context,
    store=store,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "RAG 파이프라인 설계 포인트를 설명해줘."}]},
    context=Context(user_id="user-123"),
)

print(result["messages"][-1].content)
```

이 패턴의 장점은 prompt를 하드코딩하지 않고, 사용자 프로필이나 장기 메모리를 바탕으로 지시문을 조립할 수 있다는 점이다.

## 4. `dynamic_prompt`는 권한 제어가 아니다

여기서 많이 헷갈린다.  
system prompt에 "관리자만 삭제 가능"이라고 적는 것과 실제로 삭제 도구를 노출하지 않는 것은 완전히 다르다.

예를 들어 운영용 에이전트라면 보통 이렇게 나눈다.

1. `dynamic_prompt`로 역할별 안내 문구를 넣는다.
2. `wrap_model_call`로 노출 가능한 tool 집합을 실제로 줄인다.
3. 위험 도구에는 `HumanInTheLoopMiddleware`를 추가한다.

즉 `dynamic_prompt`는 행동 유도 레이어이고, 권한 보장은 tool filtering이나 approval 레이어가 맡아야 한다.

## 5. 실전에서 자주 쓰는 조합

개인적으로는 아래 조합이 가장 실용적이다.

### 5-1. runtime context + dynamic prompt

- 사용자 역할
- 고객 티어
- 배포 환경
- 실험 플래그

이런 per-run 정보를 `context`로 넘기고 prompt를 조립한다.

### 5-2. store + dynamic prompt

- 선호 언어
- 답변 길이 취향
- 이전 세션에서 저장한 작업 규칙

이런 장기 정보를 store에서 읽어온다.

### 5-3. summarization + dynamic prompt

대화가 길어지면 `SummarizationMiddleware`로 message 비용을 줄이고,  
동시에 `dynamic_prompt`로 "긴 대화이므로 중복 설명을 줄이라"는 지시를 추가한다.

## 6. 운영에서 자주 생기는 실수

### 6-1. `context_schema` 없이 context를 아무렇게나 넘긴다

필드는 명시적으로 정의해 두는 편이 안전하다.  
특히 여러 미들웨어가 같은 context를 읽으면 schema가 없을 때 추적이 어렵다.

### 6-2. prompt를 너무 길게 만든다

`dynamic_prompt`는 매 model call마다 실행된다.  
여기에 장문의 정책 문서나 너무 많은 선호도 텍스트를 붙이면 토큰 비용이 계속 누적된다.

정말 필요한 규칙만 남기고, 긴 데이터는 retrieval이나 tool로 분리하는 편이 낫다.

### 6-3. store가 항상 있다고 가정한다

`request.runtime.store`를 읽는 코드는 agent에 `store=`를 연결해야 정상 동작한다.  
배포 환경과 로컬 테스트 환경이 다르면 여기서 바로 깨지기 쉽다.

### 6-4. prompt만 바꾸면 안전하다고 생각한다

민감한 도구나 쓰기 동작은 prompt만으로 막지 말아야 한다.  
권한, tool 노출, human approval를 같이 설계해야 한다.

### 6-5. 비결정적인 규칙을 계속 추가한다

"상황에 맞게 적당히", "필요하면 길게" 같은 규칙이 많아질수록 prompt 충돌이 생긴다.  
role, style, safety처럼 목적이 다른 규칙을 짧고 명시적으로 나누는 편이 훨씬 안정적이다.

## 언제 바로 써볼 만한가

다음 조건 중 하나라도 있으면 `dynamic_prompt`를 바로 붙여볼 가치가 있다.

- 같은 에이전트를 서로 다른 사용자 계층에 제공한다
- 사용자별 응답 스타일을 저장해 두고 재사용하고 싶다
- 대화 길이에 따라 응답 톤을 자동 조절하고 싶다
- 운영/스테이징 같은 환경 차이를 prompt에 반영해야 한다

고정 `system_prompt` 하나로 서비스 요구사항이 점점 버거워질 때, 가장 작은 확장 포인트가 바로 이 미들웨어다.

## 마무리

`dynamic_prompt`는 거창한 프롬프트 엔지니어링 도구라기보다,  
"지금 이 호출에 필요한 system prompt를 현재 상태와 컨텍스트로 다시 조립하는 함수"에 가깝다.

- `request.messages`로 현재 대화 길이를 읽을 수 있고
- `request.runtime.context`로 호출별 설정을 읽을 수 있고
- `request.runtime.store`로 저장된 선호도까지 반영할 수 있다

다만 prompt는 어디까지나 지시문이다.  
실제 도구 권한과 안전 장치는 `wrap_model_call`, tool filtering, human-in-the-loop 같은 다른 레이어와 함께 설계해야 한다.

## 참고 자료

- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain Custom Middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
- [LangChain Context Engineering](https://docs.langchain.com/oss/python/langchain/context-engineering)
- [LangChain Runtime](https://docs.langchain.com/oss/python/langchain/runtime)
