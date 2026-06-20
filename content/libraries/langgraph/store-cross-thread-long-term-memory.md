---
title: LangGraph store로 cross-thread 장기 메모리 붙이기
description: LangGraph Graph API에서 store, Runtime, context_schema를 사용해 thread 밖 사용자 메모리를 저장하고 다시 조회하는 실전 패턴 정리
date: 2026-06-20
tags:
  - langgraph
  - memory
  - workflow
  - python
aliases:
  - "/blog/langgraph-store-cross-thread-long-term-memory"
---

# LangGraph store로 cross-thread 장기 메모리 붙이기

LangGraph에서 `checkpointer`를 붙이면 같은 `thread_id` 안에서는 대화나 workflow 상태를 이어 갈 수 있다.  
그런데 실무에서는 여기서 한 단계 더 필요한 순간이 많다.

- 같은 사용자의 다른 thread에서도 선호를 다시 쓰고 싶다
- 이전 상담에서 저장한 사실을 다음 세션에서 다시 꺼내고 싶다
- 대화 상태와 별개로 운영 메모리를 별도 저장소에 남기고 싶다

이때 쓰는 것이 `store`다.  
공식 문서 기준으로 checkpointer는 thread 안의 상태를 저장하고, store는 thread 밖에서도 공유되는 장기 메모리를 저장한다.

이번 글에서는 아래만 실전 기준으로 정리한다.

- `checkpointer`와 `store`를 어떻게 구분해야 하는지
- Graph API에서 `Runtime`으로 store를 읽고 쓰는 방법
- `context_schema`로 사용자 namespace를 나누는 패턴
- semantic search를 붙일 때 꼭 알아야 할 함정
- 로컬과 운영 환경에서 store를 어떻게 나누면 좋은지

## 언제 store를 먼저 떠올리면 되나

아래 상황이면 state보다 store 쪽 문제일 가능성이 높다.

- 같은 사용자 메모리를 여러 `thread_id`에서 재사용해야 한다
- workflow 결과 중 일부만 JSON 문서 형태로 오래 남기고 싶다
- 사용자 선호, 규칙, 프로필 같은 사실을 대화 밖에 저장해야 한다
- state 전체 replay와는 별도로 "검색 가능한 메모리"가 필요하다

반대로 아래는 store보다 checkpointer 쪽 책임에 가깝다.

- 현재 대화의 message history
- interrupt 후 resume를 위한 진행 상태
- 특정 thread 안에서만 의미가 있는 중간 계산 결과

즉 기준은 단순하다.

- thread 내부 연속성: `checkpointer`
- thread 간 공유 메모리: `store`

## 사전 준비

예제는 Python 3.10+에서 실행할 수 있다.

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

예제는 외부 임베딩 API 없이 동작하도록 간단한 embedding 함수를 직접 사용한다.  
운영에서는 보통 OpenAI, Cohere, 자체 임베딩 모델 같은 실제 embedding provider를 연결한다.

## 1. 최소 구조: checkpointer와 store를 함께 컴파일하기

공식 문서의 기본 형태는 아래와 같다.

```python
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import StateGraph
from langgraph.store.memory import InMemoryStore


checkpointer = InMemorySaver()
store = InMemoryStore()

builder = StateGraph(...)
graph = builder.compile(checkpointer=checkpointer, store=store)
```

여기서 역할을 분리해서 이해하는 것이 중요하다.

- `checkpointer`: 현재 thread 상태를 checkpoint로 저장
- `store`: 여러 thread에서 공유할 장기 메모리 저장

둘 다 persistence처럼 보이지만, scope가 다르다.

## 2. 가장 작은 실전 예제: 다른 thread에서 같은 사용자 메모리 다시 꺼내기

아래 예제는 같은 사용자 `alice`가 서로 다른 두 thread에서 그래프를 실행하더라도, 첫 번째 thread에서 저장한 선호를 두 번째 thread에서 다시 찾는 흐름을 보여 준다.

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime
from langgraph.store.base import IndexConfig
from langgraph.store.memory import InMemoryStore


def embed_texts(texts: Sequence[str]) -> list[list[float]]:
    vectors = []
    for text in texts:
        lowered = text.lower()
        score_python = 1.0 if ("python" in lowered or "코드" in lowered) else 0.0
        score_brief = 1.0 if ("짧" in lowered or "brief" in lowered or "short" in lowered) else 0.0
        vectors.append([score_python, score_brief])
    return vectors


@dataclass
class Context:
    user_id: str


class State(TypedDict):
    user_message: str
    response: str
    recalled: list[str]


def save_preference(state: State, runtime: Runtime[Context]):
    namespace = (runtime.context.user_id, "memories")

    if "python" in state["user_message"].lower():
        runtime.store.put(
            namespace,
            "pref-language",
            {"text": "사용자는 Python 예제를 선호한다.", "kind": "preference"},
            index=["text"],
        )

    if "짧게" in state["user_message"]:
        runtime.store.put(
            namespace,
            "pref-style",
            {"text": "사용자는 답변을 짧고 핵심만 원한다.", "kind": "preference"},
            index=["text"],
        )

    return {}


def answer(state: State, runtime: Runtime[Context]):
    namespace = (runtime.context.user_id, "memories")
    memories = runtime.store.search(
        namespace,
        query=state["user_message"],
        filter={"kind": "preference"},
        limit=3,
    )
    recalled = [item.value["text"] for item in memories]
    return {
        "recalled": recalled,
        "response": " | ".join(recalled) if recalled else "기억 없음",
    }


store = InMemoryStore(
    index=IndexConfig(embed=embed_texts, dims=2, fields=["text"])
)
checkpointer = InMemorySaver()

builder = StateGraph(State, context_schema=Context)
builder.add_node("save_preference", save_preference)
builder.add_node("answer", answer)
builder.add_edge(START, "save_preference")
builder.add_edge("save_preference", "answer")
builder.add_edge("answer", END)
graph = builder.compile(checkpointer=checkpointer, store=store)

thread_1 = {"configurable": {"thread_id": "thread-1"}}
thread_2 = {"configurable": {"thread_id": "thread-2"}}
context = Context(user_id="alice")

graph.invoke(
    {
        "user_message": "앞으로는 Python 예제를 짧게 보여줘",
        "response": "",
        "recalled": [],
    },
    config=thread_1,
    context=context,
)

result = graph.invoke(
    {
        "user_message": "지금 내 답변 선호를 반영해줘",
        "response": "",
        "recalled": [],
    },
    config=thread_2,
    context=context,
)

print(result["recalled"])
print(result["response"])
```

실행 후 기대 포인트는 세 가지다.

- 첫 번째 호출은 `thread-1`에서 선호를 저장한다
- 두 번째 호출은 다른 `thread-2`지만 같은 `user_id="alice"`라서 기존 메모리를 다시 찾는다
- 즉 continuity는 `thread_id`가 맡고, cross-thread recall은 `store`가 맡는다

## 3. 왜 `Runtime`과 `context_schema`를 같이 써야 하나

공식 memory 문서는 store 접근을 node 함수의 `Runtime` 객체로 받는 방식을 권장한다.  
이 패턴의 핵심은 두 가지다.

### 3-1. `runtime.store`

노드 안에서 store를 직접 읽고 쓰는 통로다.

```python
def node(state, runtime: Runtime[Context]):
    runtime.store.put(...)
    items = runtime.store.search(...)
```

### 3-2. `runtime.context`

현재 호출의 사용자나 조직 정보를 상태와 분리해서 넣는 통로다.

```python
@dataclass
class Context:
    user_id: str
```

이렇게 두면 `user_id`를 state에 섞지 않아도 된다.  
즉 공개 workflow 상태와 호출별 운영 문맥을 분리할 수 있다.

## 4. namespace는 어떻게 나누는가

store는 `(namespace, key, value)` 구조다.  
공식 stores 문서 기준 namespace는 tuple이며 길이는 자유롭다.

예를 들면:

```python
("alice", "memories")
("org-7", "users", "preferences")
("tenant-a", "support", "facts")
```

실무에서는 보통 아래 기준으로 정리하는 편이 낫다.

- 첫 번째 축: tenant, org, user 같은 소유 범위
- 두 번째 축: `memories`, `preferences`, `policies` 같은 데이터 종류
- `key`: 개별 문서 식별자

예제의 `"pref-language"`, `"pref-style"`처럼 고정 key를 쓰면 upsert처럼 동작한다.  
반대로 매번 새 메모리를 쌓고 싶다면 `uuid` 같은 새 key를 생성하면 된다.

## 5. `search()`를 쓸 때 알아둘 것

공식 stores 문서에는 `store.search()`에 대해 놓치기 쉬운 동작이 몇 가지 정리돼 있다.

### 5-1. namespace는 exact match가 아니라 prefix match다

예를 들어:

```python
store.search(("alice",))
```

이 호출은 `("alice", "memories")`, `("alice", "preferences")` 같은 하위 namespace도 함께 반환할 수 있다.  
특정 한 단계만 보고 싶다면 full namespace를 넘기거나, 반환된 `item.namespace`를 다시 필터링해야 한다.

### 5-2. backend마다 기본 정렬이 다를 수 있다

공식 문서 기준:

- `InMemoryStore`: insertion order
- `PostgresStore`: 보통 `updated_at` 내림차순

즉 "항상 마지막 결과가 최신 메모리일 것"이라고 가정하면 backend를 바꿀 때 깨질 수 있다.  
정렬이 중요하면 client 쪽에서 `updated_at` 기준으로 다시 정렬하는 편이 안전하다.

### 5-3. `limit`를 넘는 결과는 조용히 잘린다

overflow 신호가 따로 없으니 namespace가 커질 가능성이 있으면 `offset` 기반 pagination도 같이 염두에 둬야 한다.

## 6. semantic search를 붙일 때의 기준

공식 memory/stores 문서는 store에 embedding index를 붙이면 exact key lookup이 아니라 의미 기반 검색도 할 수 있다고 설명한다.

```python
store = InMemoryStore(
    index=IndexConfig(embed=embed_texts, dims=2, fields=["text"])
)
```

여기서 중요한 기준은 세 가지다.

### 6-1. 어떤 필드를 embed할지 먼저 정한다

예제에서는 `fields=["text"]`로 텍스트 필드만 임베딩했다.  
운영 메타데이터까지 전부 임베딩하면 검색 품질이 오히려 흐려질 수 있다.

### 6-2. item별로 `index=[...]` 또는 `index=False`를 덮어쓸 수 있다

공식 stores 문서 기준 저장 시점에 개별 문서마다 임베딩 여부를 바꿀 수 있다.

```python
runtime.store.put(namespace, "doc-1", value, index=["text"])
runtime.store.put(namespace, "raw-log", value, index=False)
```

즉 검색용 메모리와 단순 보관용 문서를 분리해서 다룰 수 있다.

### 6-3. 정확 조회와 의미 검색을 혼동하면 안 된다

다음처럼 이미 key를 알고 있으면:

```python
runtime.store.get(namespace, "pref-style")
```

굳이 semantic search를 쓸 이유가 없다.  
선호, 프로필처럼 구조가 고정된 정보는 `get()`이 더 단순하고 예측 가능하다.

## 7. 운영에서는 왜 `InMemoryStore`가 아니라 DB-backed store를 봐야 하나

공식 문서는 개발용으로 `InMemoryStore`, 운영용으로는 `PostgresStore`, `MongoDBStore`, `RedisStore` 같은 영속 store를 권장한다.

이유는 단순하다.

- 프로세스가 내려가도 데이터가 남아야 한다
- 여러 worker가 같은 메모리를 공유해야 한다
- 백업, 접근 제어, 마이그레이션이 가능해야 한다

예를 들어 Postgres store는 이런 형태로 시작한다.

```python
from langgraph.store.postgres import PostgresStore  # type: ignore[import-not-found]


DB_URI = "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable"

with PostgresStore.from_conn_string(DB_URI) as store:
    store.setup()
    graph = builder.compile(checkpointer=checkpointer, store=store)
```

처음에는 `InMemoryStore`로 구조를 검증하고, 실제 운영에 들어갈 때 영속 backend로 옮기는 편이 무난하다.

## 자주 하는 실수

### 1. checkpointer가 장기 메모리까지 해결해 준다고 생각한다

checkpointer는 thread 내부 상태 저장용이다.  
같은 사용자 다른 session에서 메모리를 꺼내려면 store가 따로 필요하다.

### 2. user_id를 state에 섞어 넣는다

이 값은 보통 workflow 상태보다 runtime context에 가깝다.  
`context_schema`로 분리하는 편이 상태 스키마를 덜 오염시킨다.

### 3. `search()` 결과 순서를 backend 공통 규칙처럼 가정한다

개발 중 `InMemoryStore`에서는 우연히 잘 맞아도 Postgres에서 순서가 달라질 수 있다.

### 4. namespace를 너무 넓게 잡는다

`("memories",)`처럼 전역 namespace에 다 밀어 넣으면 사용자 격리, 삭제, 검색 범위 제한이 곧바로 어려워진다.

### 5. 모든 저장값에 무조건 semantic search를 붙인다

exact lookup이 더 맞는 데이터까지 임베딩하면 비용과 복잡도만 늘어난다.

## 실전 체크리스트

1. thread continuity와 cross-thread memory를 분리해서 설계한다
2. `context_schema`로 user/org 식별자를 runtime context로 주입한다
3. namespace는 소유 범위와 데이터 종류가 드러나게 tuple로 나눈다
4. key를 알고 있는 메모리는 `get()`, 의미 검색이 필요한 메모리는 `search(query=...)`로 나눈다
5. backend별 ordering 차이와 prefix namespace 동작을 가정하지 않는다

## 마무리

LangGraph `store`는 "대화 로그를 더 오래 들고 있는 기능"이 아니라,  
thread 밖에서도 재사용되는 메모리를 별도 persistence 계층으로 분리하는 기능에 가깝다.

실전에서는 아래 식으로 생각하면 헷갈림이 줄어든다.

- 지금 thread를 이어 가는가: `checkpointer`
- 다음 thread에서도 기억을 꺼내야 하는가: `store`

이 구분만 명확해도 interrupt, time travel, personalization, 운영 메모리 설계를 훨씬 덜 꼬이게 만들 수 있다.

## 참고 자료

- [LangGraph Memory](https://docs.langchain.com/oss/python/langgraph/add-memory)
- [LangGraph Stores](https://docs.langchain.com/oss/python/langgraph/stores)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
