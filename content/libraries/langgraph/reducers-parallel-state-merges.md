---
title: "LangGraph reducer로 병렬 state update 안전하게 합치기"
description: "LangGraph Graph API에서 Annotated reducer를 사용해 병렬 노드의 state update를 안전하게 병합하고 INVALID_CONCURRENT_GRAPH_UPDATE를 피하는 실전 패턴 정리"
date: 2026-06-19
tags:
  - langgraph
  - workflow
  - state
  - python
aliases:
  - "/blog/langgraph-reducers-parallel-state-merges"
---

# LangGraph reducer로 병렬 state update 안전하게 합치기

LangGraph를 쓰다 보면 어느 순간 이런 상황을 만나게 된다.

- 문서 후보 여러 개를 병렬로 점수화한다
- 여러 tool 결과를 같은 리스트에 모은다
- fan-out된 노드들이 같은 key에 동시에 write한다

이때 reducer 없이 같은 state key를 병렬로 갱신하면 `INVALID_CONCURRENT_GRAPH_UPDATE`가 난다.  
공식 문서 기준으로 LangGraph는 병렬 노드가 같은 key를 업데이트할 때 "어떤 규칙으로 합칠지"를 알아야 하며, 그 규칙을 `Annotated[..., reducer]`로 선언한다.

이번 글에서는 실전에서 바로 필요한 기준만 정리한다.

- reducer가 왜 필요한지
- `operator.add`로 가장 흔한 리스트 누적을 처리하는 방법
- custom reducer를 쓸 때 주의할 점
- `update_state()`와 체크포인트 재구성에서 왜 reducer 설계가 중요해지는지

## 언제 reducer를 먼저 떠올리면 되나

아래 조건 중 둘 이상이 보이면 reducer를 의심하면 된다.

- `Send`나 parallel edge를 쓴다
- 같은 step에서 여러 노드가 같은 key에 write한다
- message list, result list, score map 같은 누적 state가 있다
- 사람이 `update_state()`로 state를 보정할 수 있다

반대로 한 step에서 오직 한 노드만 key를 갱신한다면 기본 overwrite만으로 충분하다.

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

## 1. reducer가 없으면 왜 깨질까

아래 graph는 상품 후보를 병렬로 분류하고 결과를 `tags`에 모으려는 예제다.

```python
from typing_extensions import TypedDict

from langgraph.graph import START, END, StateGraph
from langgraph.types import Send


class State(TypedDict):
    products: list[str]
    tags: list[str]


class ProductState(TypedDict):
    product: str


def route_products(state: State):
    return [Send("tag_product", {"product": name}) for name in state["products"]]


def tag_product(state: ProductState):
    return {"tags": [state["product"].upper()]}


builder = StateGraph(State)
builder.add_node("tag_product", tag_product)
builder.add_conditional_edges(START, route_products)
builder.add_edge("tag_product", END)
graph = builder.compile()

graph.invoke({"products": ["keyboard", "mouse"], "tags": []})
```

의도는 단순하지만, 같은 super-step에서 `tag_product`가 여러 번 실행되며 모두 `tags`에 write한다.  
공식 에러 문서 기준 이 경우 LangGraph는 어떤 값을 남겨야 할지 결정할 수 없어서 `INVALID_CONCURRENT_GRAPH_UPDATE`를 던진다.

## 2. 가장 흔한 해법: `operator.add`

리스트를 그냥 이어 붙이면 되는 경우는 reducer를 한 줄로 끝낼 수 있다.

```python
from typing import Annotated
import operator
from typing_extensions import TypedDict

from langgraph.graph import START, END, StateGraph
from langgraph.types import Send


class State(TypedDict):
    products: list[str]
    tags: Annotated[list[str], operator.add]


class ProductState(TypedDict):
    product: str


def route_products(state: State):
    return [Send("tag_product", {"product": name}) for name in state["products"]]


def tag_product(state: ProductState):
    tag = state["product"].upper()
    return {"tags": [tag]}


builder = StateGraph(State)
builder.add_node("tag_product", tag_product)
builder.add_conditional_edges(START, route_products)
builder.add_edge("tag_product", END)
graph = builder.compile()

result = graph.invoke({"products": ["keyboard", "mouse"], "tags": []})
print(result["tags"])
```

예상 결과:

```text
['KEYBOARD', 'MOUSE']
```

핵심은 이 줄이다.

```python
tags: Annotated[list[str], operator.add]
```

이 선언은 병렬 노드가 `tags`에 여러 번 write하면 리스트 덧셈 규칙으로 누적하라는 뜻이다.

## 3. custom reducer가 필요한 경우

실무에서는 단순 append보다 "ID 기준 병합", "중복 제거", "dict merge"가 더 자주 필요하다.

예를 들어 문서별 최고 점수만 유지하고 싶다면 reducer를 직접 정의할 수 있다.

```python
from typing import Annotated
from typing_extensions import TypedDict

from langgraph.graph import START, END, StateGraph
from langgraph.types import Send


def merge_scores(left: dict[str, float], right: dict[str, float]) -> dict[str, float]:
    merged = dict(left)
    for doc_id, score in right.items():
        merged[doc_id] = max(score, merged.get(doc_id, float("-inf")))
    return merged


class ScoreState(TypedDict):
    queries: list[str]
    scores: Annotated[dict[str, float], merge_scores]


class QueryState(TypedDict):
    query: str


def route_queries(state: ScoreState):
    return [Send("score_docs", {"query": query}) for query in state["queries"]]


def score_docs(state: QueryState):
    token_count = float(len(state["query"].split()))
    return {
        "scores": {
            "langgraph-docs": token_count,
            "internal-notes": token_count - 1.0,
        }
    }


builder = StateGraph(ScoreState)
builder.add_node("score_docs", score_docs)
builder.add_conditional_edges(START, route_queries)
builder.add_edge("score_docs", END)
graph = builder.compile()

result = graph.invoke(
    {
        "queries": ["langgraph reducers", "parallel state merges"],
        "scores": {},
    }
)
print(result["scores"])
```

이 reducer는 같은 `doc_id`가 여러 번 들어와도 더 높은 score만 남긴다.

## 4. reducer를 설계할 때 꼭 알아야 할 기준

### 4-1. reducer는 state를 직접 mutate하지 않는 편이 안전하다

노드는 state를 직접 바꾸는 대신 update dict를 반환해야 한다. reducer도 같은 감각으로 새 값을 만들어 반환하는 편이 안전하다.

나쁜 예:

```python
def reducer(left, right):
    left.update(right)
    return left
```

좋은 예:

```python
def reducer(left, right):
    merged = dict(left)
    merged.update(right)
    return merged
```

## 4-2. 순서 의존 reducer는 병렬 graph에서 디버깅을 어렵게 만든다

공식 runtime 문서는 reducer가 batching에 따라 결과가 바뀌지 않는 쪽이 안전하다고 설명한다.  
특히 `DeltaChannel` 같은 bulk reducer에서는 결합 법칙이 중요하다고 명시한다.

실무 기준으로 바꾸면 이렇다.

- 리스트 append: 대체로 안전
- dict merge: 규칙이 명확하면 안전
- 랜덤 값 생성, 현재 시각 주입, 외부 side effect: reducer에서 하면 안 됨

## 4-3. 메시지 채널은 무조건 `operator.add`가 정답이 아니다

공식 Graph API 문서는 message list를 수동 수정할 가능성이 있다면 `operator.add` 대신 `add_messages`를 쓰라고 설명한다.  
이유는 message ID 기준 overwrite와 삭제 같은 동작이 필요할 수 있기 때문이다.

즉 기준은 단순하다.

- 그냥 append-only 리스트: `operator.add`
- 메시지 수정/삭제까지 고려: `add_messages`

## 4-4. `update_state()`도 reducer를 탄다

공식 checkpointer/time-travel 문서 기준 `update_state()`로 값을 넣어도 reducer가 정의돼 있으면 그 규칙으로 적용된다.

이 점이 중요한 이유는 다음과 같다.

- 운영 중 사람이 state를 보정할 때도 같은 병합 규칙이 적용된다
- "이건 덮어쓴다고 생각했는데 누적됐다" 같은 혼동이 생길 수 있다

예를 들어 `tags: Annotated[list[str], operator.add]`라면 아래 호출은 overwrite가 아니라 append다.

```python
graph.update_state(config, {"tags": ["MANUAL_REVIEW"]})
```

수동 교체가 필요하면 reducer 없는 별도 key를 두거나, overwrite 의미를 가진 reducer를 명확히 설계해야 한다.

## 5. 자주 생기는 실수

### 5-1. 병렬 fan-out을 만들고 reducer를 나중에 붙이려 한다

`Send`나 병렬 edge를 추가하는 순간 어떤 key가 동시에 write될지 먼저 봐야 한다.  
대부분은 그래프를 짠 다음 에러를 보고 reducer를 덧붙이는데, state 설계부터 같이 하는 편이 훨씬 안정적이다.

### 5-2. `list[str]`를 반환하면서 reducer key 초기값을 빼먹는다

리스트 누적 key는 보통 초기값도 같이 넣어 두는 편이 읽기 쉽다.

```python
graph.invoke({"products": ["keyboard", "mouse"], "tags": []})
```

### 5-3. custom reducer 안에서 wall-clock이나 UUID를 만든다

runtime 문서 기준 재구성 시 reducer가 다시 실행될 수 있으므로 reducer 안의 비결정적 로직은 replay 결과를 흔든다.

### 5-4. reducer 하나로 overwrite와 append 요구를 동시에 해결하려 한다

예를 들어 "운영 중 수동 교체도 필요하고, 평소에는 append도 필요하다"면 보통 key를 분리하는 편이 낫다.

- `messages`: `add_messages`
- `review_notes`: `operator.add`
- `latest_status`: overwrite

## 실전 체크리스트

1. 병렬 노드가 같은 key를 write하는지 먼저 확인한다
2. 리스트 누적이면 `Annotated[list[T], operator.add]`부터 검토한다
3. 메시지 상태는 `add_messages`가 더 맞는지 따진다
4. custom reducer는 순수 함수처럼 작성한다
5. `update_state()`와 checkpoint replay에서도 같은 규칙이 적용된다는 점을 기억한다

## 마무리

LangGraph reducer는 문법 장식이 아니라 병렬 state 설계의 핵심이다.

- 병렬 write가 있으면 reducer가 필요하고
- 가장 흔한 시작점은 `Annotated[..., operator.add]`이며
- 운영 중 수동 수정과 replay까지 고려하면 reducer 선택이 곧 state 계약이 된다

LangGraph에서 graph 구조만큼 중요한 것이 state 병합 규칙이다.  
fan-out을 쓰기 시작했다면 edge보다 reducer부터 점검하는 편이 맞다.

## 참고 자료

- [LangGraph Use the Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [LangGraph Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph INVALID_CONCURRENT_GRAPH_UPDATE](https://docs.langchain.com/oss/python/langgraph/errors/INVALID_CONCURRENT_GRAPH_UPDATE)
- [LangGraph runtime / Pregel](https://docs.langchain.com/oss/python/langgraph/pregel)
- [LangGraph Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers)
- [LangGraph Time travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)
