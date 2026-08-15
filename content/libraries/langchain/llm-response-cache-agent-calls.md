---
title: LangChain LLM response cache로 agent 모델 호출 재사용하기
description: 동일한 agent 요청의 모델 응답을 InMemoryCache로 재사용하고 graph cache·checkpoint와 구분하는 실전 패턴
date: 2026-08-15
tags:
  - langchain
  - agent
  - cache
  - performance
  - python
---

# LangChain LLM response cache로 agent 모델 호출 재사용하기

LLM agent를 개발하다 보면 같은 입력을 여러 번 실행한다. 테스트를 다시 돌리거나, 데모 화면을 새로 고치거나, 결정적인 분류 단계를 반복할 때마다 모델 API를 다시 호출하면 비용과 지연이 쌓인다.

LangChain의 **LLM response cache**는 직렬화된 prompt와 모델 설정이 같은 호출의 `AIMessage`를 재사용한다. 다만 agent 전체 실행, tool 결과, 대화 checkpoint를 저장하는 기능은 아니다. 이 경계를 모르면 비용을 줄이려다가 오래된 답이나 중복 side effect를 만들 수 있다.

이 글에서는 다음을 다룬다.

- `InMemoryCache`를 특정 chat model에 붙이는 방법
- 같은 model instance를 agent에서 재사용하는 이유
- tool-calling agent에서 cache가 어디까지만 적용되는지
- LLM cache, LangGraph node cache, checkpointer의 차이
- streaming과 운영 환경에서 자주 생기는 함정

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.3" langchain-openai
```

PowerShell에서는 API key를 다음처럼 설정한다.

```powershell
$env:OPENAI_API_KEY="sk-..."
```

## 1. 모델 인스턴스에 cache를 직접 붙이기

가장 범위가 명확한 방법은 `BaseChatModel.cache`에 cache instance를 전달하는 것이다.

```python
from langchain.agents import create_agent
from langchain_core.caches import InMemoryCache
from langchain_openai import ChatOpenAI


llm_cache = InMemoryCache()

model = ChatOpenAI(
    model="gpt-5-mini",
    temperature=0,
    cache=llm_cache,
)

agent = create_agent(
    model=model,
    tools=[],
    system_prompt="답은 한 문장으로만 작성하세요.",
)

inputs = {
    "messages": [
        {"role": "user", "content": "RAG에서 reranker의 역할은 무엇인가요?"}
    ]
}

first = agent.invoke(inputs)
second = agent.invoke(inputs)

print(first["messages"][-1].text)
print(second["messages"][-1].text)
```

두 번째 실행은 prompt와 모델 설정이 같으면 cache hit가 된다. 여기서 중요한 점은 문자열 모델 식별자 대신 **cache가 설정된 model instance**를 `create_agent()`에 넘겼다는 것이다.

cache key에는 prompt만 있는 것이 아니다. 모델 이름, temperature, tool binding처럼 직렬화된 모델 설정도 함께 반영된다. 따라서 system prompt, message history, tool schema 또는 모델 옵션이 달라지면 일반적으로 별도 호출로 취급된다.

## 2. 전역 cache는 적용 범위가 더 넓다

여러 model instance에 같은 정책을 적용해야 한다면 전역 cache도 쓸 수 있다.

```python
from langchain_core.caches import InMemoryCache
from langchain_core.globals import set_llm_cache
from langchain_openai import ChatOpenAI


set_llm_cache(InMemoryCache())

# cache=None이면 설정된 global cache를 사용한다.
model = ChatOpenAI(model="gpt-5-mini", temperature=0)

print(model.invoke("벡터 검색을 한 문장으로 설명하세요.").text)
print(model.invoke("벡터 검색을 한 문장으로 설명하세요.").text)
```

전역 cache는 편리하지만 테스트 간 상태가 섞이기 쉽다. 서비스 코드에서는 model instance에 cache를 명시적으로 주입하면 어느 호출이 cache 대상인지 추적하기 쉽다.

`cache=False`는 전역 설정이 있어도 해당 모델의 cache를 끈다. `cache=True`는 전역 cache가 이미 설정되어 있어야 한다. 정책이 중요한 코드라면 boolean보다 cache instance를 직접 넘기는 편이 분명하다.

## 3. tool-calling agent에서는 모델 응답만 재사용된다

LLM cache는 tool 실행 결과를 저장하지 않는다. 더 주의할 점은 cached `AIMessage` 안에 tool call이 있으면 agent가 그 tool을 다시 실행할 수 있다는 것이다.

```python
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_core.caches import InMemoryCache
from langchain_openai import ChatOpenAI


@tool
def lookup_shipping_policy(country: str) -> str:
    """Return the current shipping policy for a country."""
    # 실제 서비스에서는 여기서 최신 DB나 API를 조회한다.
    return f"{country}: standard shipping takes 3-5 business days"


model = ChatOpenAI(
    model="gpt-5-mini",
    temperature=0,
    cache=InMemoryCache(),
)

agent = create_agent(model=model, tools=[lookup_shipping_policy])

result = agent.invoke(
    {"messages": [{"role": "user", "content": "한국 배송 정책을 확인해 줘."}]}
)
print(result["messages"][-1].text)
```

이 흐름에서는 첫 번째 모델 호출의 tool 선택이 cache될 수 있고, tool 결과가 message history에 추가된 다음 모델 호출도 별도의 key로 cache될 수 있다. 그러나 `lookup_shipping_policy` 함수 자체는 cache 대상이 아니다.

따라서 결제, 이메일 발송, 레코드 생성처럼 side effect가 있는 tool은 다음 중 하나를 적용해야 한다.

- tool을 idempotent하게 만들고 요청 id를 중복 제거 key로 사용한다.
- 쓰기 tool이 포함된 agent에서는 model cache를 끈다.
- 읽기 단계와 쓰기 단계를 분리하고 읽기 전용 모델 호출만 cache한다.
- TTL과 데이터 버전을 key에 반영할 수 있는 persistent cache 구현을 사용한다.

## 4. 세 종류의 저장 기능을 구분하기

이름이 비슷하지만 목적과 key가 다르다.

| 기능 | 저장 대상 | 주된 목적 |
|---|---|---|
| LLM response cache | prompt + 모델 설정에 대한 generation | 같은 모델 호출의 비용·지연 절감 |
| LangGraph node cache | cache policy가 설정된 node의 입력과 출력 | 비싼 graph node 계산 재사용 |
| checkpointer | thread별 graph state와 checkpoint | 대화 지속, interrupt 재개, time travel |

특히 `create_agent(cache=...)`의 `cache`는 `langgraph.cache` 계열의 **graph cache**다. `langchain_core.caches.InMemoryCache`인 LLM cache와 타입도 목적도 다르다.

```python
from langchain_core.caches import InMemoryCache as LLMInMemoryCache
from langgraph.cache.memory import InMemoryCache as GraphInMemoryCache


llm_cache = LLMInMemoryCache()       # model generation cache
graph_cache = GraphInMemoryCache()   # CachePolicy가 있는 graph node cache
```

또한 graph에 cache backend만 전달한다고 모든 node가 자동으로 cache되는 것은 아니다. LangGraph node cache는 해당 node에 `CachePolicy`가 지정되어야 한다. 기본 `create_agent()`의 model/tool node 전체를 통째로 cache하는 장치로 오해하면 안 된다.

## 5. cache hit를 테스트하는 방법

운영 모델의 청구 내역만 보고 확인하지 말고, 테스트에서는 같은 cache instance를 직접 조회해 key 수가 늘지 않는지 또는 fake model의 호출 횟수가 유지되는지 검증하는 편이 좋다. 통합 테스트에서는 LangSmith trace의 model run 수와 provider usage도 함께 확인한다.

```python
from langchain_core.caches import InMemoryCache


cache = InMemoryCache()
assert cache.lookup("missing-prompt", "missing-model") is None

# 실제 key 형식은 chat model이 만들므로 애플리케이션 코드에서 직접 조합하지 않는다.
# model.invoke(...)를 두 번 호출하고 provider/model 호출 횟수를 관찰한다.
```

애플리케이션이 cache key를 직접 만들기 시작하면 LangChain 내부 serialization 변경과 어긋나기 쉽다. custom persistent cache를 구현하더라도 `BaseCache.lookup(prompt, llm_string)`과 `update(...)` 계약을 지키고, 직접 호출하는 쪽에서는 model API를 그대로 사용하는 것이 안전하다.

## 자주 막히는 지점

### 1. streaming 호출에는 모델 cache가 적용되지 않는다

공식 `BaseLanguageModel.cache` 문서 기준으로 모델의 streaming method는 현재 cache를 지원하지 않는다. `agent.stream()`을 사용하면서 `cache=...`만 추가해 hit를 기대하면 안 된다. cache가 꼭 필요한 단계는 `invoke()`/`ainvoke()`로 분리하거나, 완성된 응답을 애플리케이션 계층에서 별도로 cache한다.

### 2. `InMemoryCache`는 프로세스를 넘지 못한다

프로세스가 재시작되면 사라지고 여러 worker가 공유하지도 않는다. 로컬 개발과 단위 테스트에는 적합하지만, 운영에서는 Redis 같은 공유 backend와 TTL·eviction·tenant 격리를 함께 설계해야 한다.

### 3. 사용자별 prompt가 key에 충분히 반영되어야 한다

권한이나 tenant에 따라 답이 달라지는데 그 정보가 message/system prompt/model settings에 없다면 부적절한 재사용 위험이 생긴다. runtime context만 읽어 prompt를 바꾸지 않는 외부 로직이 있다면 cache를 끄거나 tenant·정책 버전을 실제 모델 입력에 포함한다.

### 4. 비결정적 응답을 영구히 고정할 수 있다

temperature가 높거나 최신 정보가 필요한 요청을 cache하면 최초 결과가 계속 재사용된다. cache 대상은 분류, 정규화, 고정 문서 요약처럼 재현성이 높고 freshness 요구가 낮은 호출부터 시작하는 것이 좋다.

### 5. tool schema 변경도 배포 검증 대상이다

tool 이름과 schema는 모델 설정에 포함되므로 변경 후 cache miss가 나는 것이 정상이다. 반대로 custom model/cache 구현이 이 설정을 key에서 빠뜨리면 예전 tool call이 재생될 수 있으므로 회귀 테스트가 필요하다.

## 운영 체크리스트

- 읽기 전용이고 결정적인 모델 호출부터 cache한다.
- model instance에 cache를 명시적으로 주입해 적용 범위를 좁힌다.
- tenant, 권한, prompt 버전, tool schema가 key에 반영되는지 확인한다.
- side-effect tool은 idempotency key로 중복 실행을 막는다.
- streaming 경로는 별도의 application-level cache가 필요한지 판단한다.
- hit rate뿐 아니라 stale response와 잘못된 cross-tenant hit도 모니터링한다.

## 마무리

LangChain agent의 LLM response cache는 동일한 model call을 반복하는 개발·평가·읽기 전용 workflow에서 즉시 비용과 지연을 줄일 수 있다. 핵심은 agent 전체가 아니라 **모델 generation만** 재사용된다는 점이다.

`langchain_core`의 LLM cache, `langgraph`의 node cache, checkpointer를 목적에 맞게 분리하고, tool side effect와 streaming 경계를 따로 다루면 cache를 안전하게 운영할 수 있다.

## 참고 자료

- [LangChain BaseLanguageModel cache reference](https://reference.langchain.com/python/langchain-core/language_models/base/BaseLanguageModel/cache)
- [LangChain BaseCache reference](https://reference.langchain.com/python/langchain-core/caches/BaseCache)
- [LangChain create_agent reference](https://reference.langchain.com/python/langchain/agents/factory/create_agent)
- [LangGraph node caching](https://docs.langchain.com/oss/python/langgraph/use-graph-api#add-node-caching)
- [LangGraph Graph API: node caching](https://docs.langchain.com/oss/python/langgraph/graph-api#node-caching)
