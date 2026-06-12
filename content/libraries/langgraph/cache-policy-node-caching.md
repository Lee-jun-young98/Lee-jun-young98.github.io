---
title: LangGraph cache_policy로 비싼 노드 결과 재사용하기
description: LangGraph Graph API에서 CachePolicy, InMemoryCache, SqliteCache를 조합해 비용 큰 노드 결과를 재사용하는 실전 패턴 정리
date: 2026-06-12
tags:
  - langgraph
  - agent
  - workflow
  - python
aliases:
  - "/blog/langgraph-cache-policy-node-caching"
---

# LangGraph cache_policy로 비싼 노드 결과 재사용하기

LangGraph로 workflow를 만들다 보면 매번 다시 계산할 필요가 없는 노드가 생긴다.

- 같은 질의에 대한 문서 검색
- 비슷한 전처리 결과
- 외부 API에서 가져온 느린 메타데이터
- 비용이 큰 LLM 분류나 요약

이런 노드를 매 실행마다 그대로 다시 호출하면 응답 시간이 늘고 비용도 커진다.  
LangGraph는 노드 단위 캐싱을 위해 `cache_policy`와 그래프 컴파일 시 `cache=` 설정을 제공한다.

이번 글에서는 아래를 실전 기준으로 정리한다.

- `cache_policy`를 언제 붙이면 좋은지
- `CachePolicy(ttl=..., key_func=...)`의 핵심 동작
- `InMemoryCache`와 `SqliteCache`를 어떻게 고를지
- `checkpointer`와 캐시를 왜 구분해야 하는지
- 캐시 적중률을 망치는 흔한 실수

## 언제 쓰면 좋은가

캐시는 "같은 입력이면 같은 결과를 다시 써도 되는 노드"에 붙이는 것이 핵심이다.

잘 맞는 예시는 아래와 같다.

- 검색 인덱스 조회
- 문서 파싱, 청크 정규화, 메타데이터 추출
- 사용자 프로필이나 권한 정보 조회
- 같은 입력에 대해 결정론적으로 동작하는 분류 노드

반대로 아래 같은 노드는 캐시를 신중하게 써야 한다.

- 최신성이 중요한 실시간 시세, 재고, 상태 조회
- 매번 새 응답을 기대하는 생성 노드
- 결제, 메일 발송, 티켓 생성처럼 부작용이 있는 노드

캐시는 실패 복구가 아니라 결과 재사용이다.  
일시 실패 복구는 `RetryPolicy`, 실행 중단 후 이어서 하기는 `checkpointer`가 맡는다.

## 사전 준비

가장 단순한 예제는 `langgraph`만 있으면 된다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langgraph
```

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langgraph
```

## 1. 가장 작은 예제: 같은 입력이면 두 번째 호출은 캐시 적중

공식 문서 기준으로 캐싱은 두 단계가 모두 있어야 동작한다.

1. `add_node(..., cache_policy=CachePolicy(...))`
2. `compile(cache=InMemoryCache() 또는 SqliteCache(...))`

아래 예제는 비싼 문서 검색 노드를 캐시한다.

```python
import time
from typing_extensions import TypedDict

from langgraph.cache.memory import InMemoryCache
from langgraph.graph import END, START, StateGraph
from langgraph.types import CachePolicy


class SearchState(TypedDict):
    query: str
    docs: list[str]


call_counter = {"retrieve_docs": 0}


def retrieve_docs(state: SearchState):
    call_counter["retrieve_docs"] += 1
    print(f"retrieve_docs call={call_counter['retrieve_docs']}")

    time.sleep(1.5)
    query = state["query"]
    return {
        "docs": [
            f"{query} official guide",
            f"{query} production checklist",
        ]
    }


builder = StateGraph(SearchState)
builder.add_node(
    "retrieve_docs",
    retrieve_docs,
    cache_policy=CachePolicy(ttl=300),
)
builder.add_edge(START, "retrieve_docs")
builder.add_edge("retrieve_docs", END)

graph = builder.compile(cache=InMemoryCache())

first = graph.invoke({"query": "langgraph cache"})
second = graph.invoke({"query": "langgraph cache"})

print(first["docs"])
print(second["docs"])
```

예상 흐름은 이렇다.

```text
retrieve_docs call=1
['langgraph cache official guide', 'langgraph cache production checklist']
['langgraph cache official guide', 'langgraph cache production checklist']
```

두 번째 `invoke()`에서는 노드 본문이 다시 실행되지 않으므로 `call=2`가 찍히지 않는다.

## 2. 실무에서 더 중요한 포인트: 기본 key는 "입력 전체"

공식 reference 기준으로 `CachePolicy.key_func` 기본값은 노드 입력을 pickle로 해시하는 함수다.  
즉 입력 state 전체가 바뀌면 같은 비즈니스 요청이어도 캐시 miss가 날 수 있다.

예를 들어 아래처럼 `request_id`가 매번 달라지는 상태를 생각해 보자.

```python
from typing_extensions import TypedDict

from langgraph.cache.memory import InMemoryCache
from langgraph.graph import END, START, StateGraph
from langgraph.types import CachePolicy


class SearchState(TypedDict):
    query: str
    request_id: str
    docs: list[str]


def retrieve_docs(state: SearchState):
    print("expensive search executed")
    return {"docs": [f"result for {state['query']}"]}


builder = StateGraph(SearchState)
builder.add_node(
    "retrieve_docs",
    retrieve_docs,
    cache_policy=CachePolicy(ttl=300),
)
builder.add_edge(START, "retrieve_docs")
builder.add_edge("retrieve_docs", END)
graph = builder.compile(cache=InMemoryCache())

graph.invoke({"query": "langgraph", "request_id": "req-001"})
graph.invoke({"query": "langgraph", "request_id": "req-002"})
```

이 코드는 `query`는 같아도 `request_id`가 달라서 캐시 적중이 깨질 가능성이 크다.

그래서 실전에서는 캐시 대상 노드의 의미상 입력만으로 key를 줄이는 경우가 많다.

```python
from typing import Any
from typing_extensions import TypedDict

from langgraph.cache.memory import InMemoryCache
from langgraph.graph import END, START, StateGraph
from langgraph.types import CachePolicy


class SearchState(TypedDict):
    query: str
    request_id: str
    docs: list[str]


def cache_key(state: dict[str, Any]) -> str:
    return state["query"].strip().lower()


def retrieve_docs(state: SearchState):
    print("expensive search executed")
    return {"docs": [f"result for {state['query']}"]}


builder = StateGraph(SearchState)
builder.add_node(
    "retrieve_docs",
    retrieve_docs,
    cache_policy=CachePolicy(
        key_func=cache_key,
        ttl=300,
    ),
)
builder.add_edge(START, "retrieve_docs")
builder.add_edge("retrieve_docs", END)
graph = builder.compile(cache=InMemoryCache())

graph.invoke({"query": "LangGraph", "request_id": "req-001"})
graph.invoke({"query": "langgraph", "request_id": "req-002"})
```

이제는 `request_id` 변화나 대소문자 차이를 무시하고 같은 검색 요청으로 묶을 수 있다.

## 3. 프로세스 재시작 이후에도 유지하려면 SqliteCache

`InMemoryCache`는 빠르고 간단하지만 프로세스가 내려가면 캐시도 사라진다.  
로컬 배치나 단일 서버에서 재시작 이후에도 캐시를 유지하고 싶다면 `SqliteCache`가 더 실용적이다.

```python
from typing_extensions import TypedDict

from langgraph.cache.sqlite import SqliteCache
from langgraph.graph import END, START, StateGraph
from langgraph.types import CachePolicy


class ProfileState(TypedDict):
    user_id: str
    profile: dict


def load_profile(state: ProfileState):
    print("profile API executed")
    return {
        "profile": {
            "user_id": state["user_id"],
            "tier": "pro",
        }
    }


builder = StateGraph(ProfileState)
builder.add_node(
    "load_profile",
    load_profile,
    cache_policy=CachePolicy(ttl=600),
)
builder.add_edge(START, "load_profile")
builder.add_edge("load_profile", END)

graph = builder.compile(
    cache=SqliteCache(path="langgraph-node-cache.sqlite")
)

graph.invoke({"user_id": "u-123"})
```

이 패턴은 아래 같은 경우에 특히 쓸 만하다.

- 야간 배치가 같은 참조 데이터를 반복 조회할 때
- RAG 전처리 과정에서 비싼 파싱 노드를 반복 실행할 때
- 개발 중 그래프를 여러 번 재실행하면서 비용을 줄이고 싶을 때

## 4. checkpointer와 캐시는 다르다

둘 다 "뭔가를 저장한다"는 점 때문에 자주 섞어 쓰지만 역할은 다르다.

- `checkpointer`: 그래프 실행 상태를 저장해서 thread를 이어서 실행하거나 time travel, interrupt 재개를 가능하게 한다.
- `cache`: 특정 노드의 입력과 결과를 저장해서 같은 계산을 반복하지 않게 한다.

예를 들어 사람 승인 workflow에서는 `checkpointer`가 필요하지만, 같은 문서 검색을 반복하는 노드에는 `cache_policy`가 더 직접적인 최적화다.  
실전에서는 둘을 함께 쓰는 경우도 많다.

## 5. 흔한 함정

### 5-1. 캐시 붙여 놓고 `compile(cache=...)`를 빼먹기

노드에 `cache_policy`만 붙이고 그래프를 `compile()`만 하면 캐시는 실제로 동작하지 않는다.  
반대로 `compile(cache=...)`만 하고 노드별 `cache_policy`를 안 붙여도 캐시 대상이 생기지 않는다.

### 5-2. 최신성이 필요한 데이터를 너무 오래 캐싱하기

`ttl`이 길수록 적중률은 좋아질 수 있지만 stale data 위험도 커진다.

- 사용자 권한: 수 분
- 검색 결과: 인덱스 갱신 주기 기준
- 실시간 가격/재고: 캐시 금지 또는 매우 짧게

핵심은 "같은 결과를 다시 써도 안전한 시간"을 비즈니스 기준으로 정하는 것이다.

### 5-3. 부작용이 있는 노드를 캐시 대상으로 선택하기

메일 발송, 결제 승인, 외부 시스템 쓰기 작업은 캐시 hit가 나면 실행 자체가 생략된다.  
이런 노드는 캐싱보다 멱등성 제어와 상태 저장이 먼저다.

### 5-4. key_func를 너무 좁게 잡아서 다른 입력을 같은 요청으로 섞기

예를 들어 문서 검색 노드에서 `query`만 key로 쓰면서 `top_k`, `filters`, `tenant_id`를 무시하면 잘못된 결과가 재사용될 수 있다.

실전에서는 아래처럼 생각하면 안전하다.

- 결과를 바꾸는 입력은 key에 포함
- 로깅, 추적, request metadata는 key에서 제외

### 5-5. pickle 해시가 어려운 입력을 그대로 넘기기

기본 key 함수는 pickle 기반 해시를 사용하므로, 직렬화가 까다로운 객체나 매번 달라지는 객체를 state에 많이 넣으면 캐시 hit율이 떨어지거나 key 생성이 불안정해질 수 있다.  
이 경우 문자열, 튜플, dict 같은 안정적인 값으로 `key_func`를 직접 만드는 편이 낫다.

## 6. 정리

LangGraph 캐싱은 "그래프 전체를 저장"하는 기능이 아니라 "특정 노드 계산을 다시 하지 않기" 위한 최적화다.

- 노드별로 `cache_policy`를 붙인다.
- 그래프 compile 시 `cache=InMemoryCache()` 또는 `cache=SqliteCache(...)`를 함께 설정한다.
- 기본 key는 입력 전체 기준이므로 실전에서는 `key_func`를 자주 직접 정의한다.
- `ttl`은 적중률보다 데이터 신선도를 먼저 보고 정한다.
- `checkpointer`, `RetryPolicy`, 캐시는 서로 해결하는 문제가 다르다.

LangGraph workflow가 길어질수록 작은 노드 최적화 하나가 전체 체감 속도와 비용에 크게 영향을 준다.  
문서 검색, 프로필 조회, 전처리 같은 반복 노드부터 캐싱을 붙여 보는 것이 가장 효과적이다.

## 참고 자료

- [LangGraph Use the Graph API - Add node caching](https://docs.langchain.com/oss/python/langgraph/use-graph-api#add-node-caching)
- [LangGraph `CachePolicy` Reference](https://reference.langchain.com/python/langgraph/types/#langgraph.types.CachePolicy)
- [LangGraph Caching Reference](https://reference.langchain.com/python/langgraph/cache/)