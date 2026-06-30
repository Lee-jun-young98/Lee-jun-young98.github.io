---
title: "LangGraph store semantic search로 장기 메모리 검색 붙이기"
description: "LangGraph store에 embedding index를 붙여 사용자 장기 메모리를 semantic search로 조회하는 패턴을 Python 예제로 정리한 실전 노트"
date: 2026-06-30
tags:
  - langgraph
  - memory
  - python
  - semantic-search
aliases:
  - "/blog/store-semantic-search-memory"
---

# LangGraph store semantic search로 장기 메모리 검색 붙이기

LangGraph에서 thread 안의 단기 상태는 checkpointer가 맡고, thread를 넘어서는 장기 메모리는 `store`가 맡는다.  
메모리가 조금만 쌓여도 "최근 항목을 전부 읽기"보다 "이번 질문과 관련 있는 기억만 semantic search로 찾기"가 훨씬 실용적이다.

공식 문서 기준으로 LangGraph store는 embedding index를 붙여 semantic search를 지원한다.  
이 글에서는 `InMemoryStore(index=...)`로 시작해서, graph node 안에서 `runtime.store.search(...)` 또는 `runtime.store.asearch(...)`로 관련 기억을 꺼내는 최소 패턴만 정리한다.

## 언제 이 패턴이 특히 유용한가

아래 같은 경우라면 `store.search(query=...)`를 먼저 검토하는 편이 좋다.

- 사용자 선호, 과거 요청, 금지 조건 같은 장기 메모리를 누적하고 있다
- 매 턴마다 메모리 전체를 프롬프트에 넣기엔 비용이 크다
- thread는 달라도 같은 사용자의 기억을 재사용해야 한다
- 최근순보다 "지금 질문과 의미적으로 가까운 기억"이 더 중요하다

반대로 메모리가 아주 적거나 정확한 key lookup이면 semantic search 없이 `store.get(...)`나 namespace 나열만으로 충분하다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langgraph langchain-openai
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langgraph langchain-openai
```

환경 변수 예시:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

## 1. store에 embedding index를 붙인다

공식 문서의 핵심은 store 생성 시 `index` 설정을 주는 것이다.

```python
from langchain.embeddings import init_embeddings
from langgraph.store.memory import InMemoryStore

embeddings = init_embeddings("openai:text-embedding-3-small")

store = InMemoryStore(
    index={
        "embed": embeddings,
        "dims": 1536,
    }
)
```

이 설정이 없으면 `store.search(...)`는 semantic ranking이 아니라 일반 namespace 조회에 가깝게 동작한다.

## 2. namespace를 먼저 안정적으로 정한다

LangGraph store는 tuple namespace를 쓴다. 보통 사용자별 장기 메모리는 아래처럼 잡는다.

```python
user_id = "user-123"
namespace = (user_id, "memories")

store.put(namespace, "m1", {"text": "나는 매운 음식을 좋아한다"})
store.put(namespace, "m2", {"text": "제주도 여행은 8월 첫째 주를 선호한다"})
store.put(namespace, "m3", {"text": "답변은 짧고 체크리스트 형태를 좋아한다"})
```

메모리를 어떤 namespace 체계로 나눌지는 초반에 정해 두는 편이 좋다.

- `(user_id, "memories")`: 일반 사용자 장기 메모리
- `(org_id, "policies")`: 조직 공통 정책
- `(user_id, "shopping-preferences")`: 기능별 별도 메모리

## 3. semantic search는 `query`를 넘겨서 호출한다

메모리를 넣은 뒤에는 `store.search(...)`로 관련 기억만 꺼낼 수 있다.

```python
items = store.search(
    ("user-123", "memories"),
    query="휴가 일정과 여행 취향이 뭐였지?",
    limit=2,
)

for item in items:
    print(item.key, item.value)
```

이 패턴은 "유저가 지난번에 어떤 스타일을 좋아한다고 했지?" 같은 질문에서 바로 쓸 수 있다.

## 4. graph node 안에서는 `runtime.store`를 쓴다

실제 그래프에서는 전역 store를 직접 만지기보다 `Runtime`을 주입받는 쪽이 자연스럽다.

```python
from dataclasses import dataclass

from langchain.chat_models import init_chat_model
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.runtime import Runtime


@dataclass
class Context:
    user_id: str


model = init_chat_model("openai:gpt-4.1-mini")


async def respond(state: MessagesState, runtime: Runtime[Context]):
    namespace = (runtime.context.user_id, "memories")
    items = await runtime.store.asearch(
        namespace,
        query=state["messages"][-1].content,
        limit=3,
    )

    memory_lines = [item.value["text"] for item in items]
    memory_block = "\n".join(f"- {line}" for line in memory_lines)

    prompt = (
        "사용자 장기 메모리를 참고해 답하세요.\n"
        f"{memory_block}\n\n"
        f"사용자 질문: {state['messages'][-1].content}"
    )

    response = await model.ainvoke(prompt)
    return {"messages": [response]}


builder = StateGraph(MessagesState, context_schema=Context)
builder.add_node("respond", respond)
builder.add_edge(START, "respond")

graph = builder.compile(store=store)
```

호출은 같은 `thread_id`와 별개로 `context`에 `user_id`를 넘겨서 구분하면 된다.

```python
config = {"configurable": {"thread_id": "thread-7"}}

result = graph.invoke(
    {
        "messages": [
            {"role": "user", "content": "이번 여행 계획은 어떻게 잡으면 좋을까?"}
        ]
    },
    config=config,
    context=Context(user_id="user-123"),
)
```

핵심은 `thread_id`는 실행 흐름을 위한 값이고, 장기 메모리 namespace는 `user_id` 같은 별도 식별자로 분리하는 점이다.

## 5. "전체 기억 나열"과 "semantic search"는 용도가 다르다

공식 문서 기준으로 `store.search(namespace, limit=...)`를 `query` 없이 호출하면 namespace 아래 항목을 나열하는 용도다.  
반면 semantic search는 `query="..."`를 줬을 때 의미 기반으로 관련 항목을 찾는다.

```python
# namespace 항목 나열
all_items = store.search(("user-123", "memories"), limit=100)

# semantic search
relevant_items = store.search(
    ("user-123", "memories"),
    query="매운 음식 취향",
    limit=3,
)
```

운영에서는 보통 아래처럼 나눈다.

- 백오피스 목록 화면: `query` 없이 나열
- 모델 프롬프트 주입: `query`를 넣어 관련 기억만 검색

## 자주 틀리는 점

### 1. index 설정 없이 semantic search가 될 거라고 기대하기 쉽다

`InMemoryStore()`만 만들고 `query=`를 넣어도 원하는 semantic ranking이 나오지 않는다.  
embedding 모델과 `dims`를 포함한 `index` 설정이 먼저 있어야 한다.

### 2. namespace prefix 동작을 정확히 모르면 메모리가 섞일 수 있다

공식 문서 기준으로 `search`는 namespace prefix 기준으로 동작할 수 있다.  
정확히 한 그룹만 보고 싶다면 `("user-123", "memories")`처럼 충분히 구체적인 namespace를 쓰는 편이 안전하다.

### 3. backend마다 반환 순서를 고정값처럼 가정하면 안 된다

문서 기준으로 `InMemoryStore`와 Postgres 계열 store는 기본 정렬이 다를 수 있다.  
정렬 의미가 중요하면 `updated_at` 기준으로 애플리케이션 쪽에서 다시 정렬하는 편이 낫다.

### 4. thread 상태와 장기 메모리를 같은 식별자로만 엮으면 운영이 불편해진다

`thread_id`는 대화 흐름, `user_id`는 메모리 namespace처럼 역할을 나눠야 여러 thread에서 같은 기억을 재사용하기 쉽다.

### 5. 메모리 전체를 매번 프롬프트에 넣으면 semantic search의 이점이 줄어든다

장기 메모리는 "모두 주입"보다 "관련 있는 몇 개만 검색"하는 쪽이 비용과 품질 양쪽에 유리하다.

## 추천 적용 순서

개인적으로는 아래 순서가 가장 무난하다.

1. `store.put(...)`로 사용자 장기 메모리 구조부터 안정화한다
2. `index={"embed": ..., "dims": ...}`를 붙여 semantic search를 켠다
3. node 안에서 `runtime.store.asearch(...)`로 관련 기억만 꺼낸다
4. `thread_id`와 `user_id`를 분리해 실행 흐름과 장기 메모리를 나눈다
5. 개발 단계는 `InMemoryStore`, 운영 단계는 영속 store backend로 옮긴다

이렇게 하면 LangGraph memory가 단순한 "이전 대화 복사"를 넘어서, 여러 thread를 가로질러 사용자 맥락을 다시 찾는 retrieval layer로 바뀐다.

## 참고 자료

- [Memory](https://docs.langchain.com/oss/python/langgraph/add-memory)
- [Stores](https://docs.langchain.com/oss/python/langgraph/stores)
