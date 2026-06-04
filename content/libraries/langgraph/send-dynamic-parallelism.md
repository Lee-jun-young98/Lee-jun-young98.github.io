---
title: "LangGraph Send로 동적 병렬 fan-out/map-reduce 처리하기"
description: "LangGraph Graph API에서 Send와 reducer를 사용해 입력 목록을 동적으로 병렬 처리하고 결과를 안전하게 합치는 실전 패턴 정리"
date: 2026-06-04
tags:
  - langgraph
  - agent
  - workflow
  - python
aliases:
  - "/blog/langgraph-send-dynamic-parallelism"
---

# LangGraph Send로 동적 병렬 fan-out/map-reduce 처리하기

LangGraph로 workflow를 만들다 보면 "문서 여러 개를 각각 요약하고 마지막에 합치기", "검색어 후보 여러 개를 병렬 실행하고 결과를 모으기" 같은 fan-out 패턴이 자주 나온다.

이때 미리 고정된 edge만으로 처리하려고 하면 입력 개수마다 노드를 따로 늘리거나, 한 노드 안에서 반복문으로 모든 작업을 몰아넣게 된다. LangGraph는 이런 상황을 위해 `Send`를 제공한다.

공식 문서 기준으로 `Send`는 conditional edge에서 특정 노드로 "개별 상태 묶음"을 동적으로 여러 번 보내는 제어 primitive다. 특히 map-reduce 패턴에서 많이 쓰이며, 병렬로 실행된 결과를 다시 메인 state로 합치려면 reducer도 같이 설계해야 한다.

이 글에서는 다음만 빠르게 정리한다.

- `Send`가 언제 적합한지
- 최소 실행 예제
- 결과 병합에 reducer가 필요한 이유
- 실무에서 자주 하는 실수

## 언제 `Send`를 쓰면 좋은가

아래 조건이 같이 나오면 `Send`를 먼저 떠올리면 된다.

- 다음에 실행할 작업 수가 입력에 따라 달라진다
- 같은 노드를 여러 번 호출하되 각 호출의 입력 state는 조금씩 다르다
- 각 호출 결과를 다시 하나의 state로 합쳐야 한다

대표 예시는 이런 것들이다.

- 문단 리스트를 각자 요약한 뒤 최종 요약 만들기
- 검색 쿼리 후보 여러 개를 병렬 실행해 문서 후보 수집하기
- 상품 목록마다 검증 노드를 돌린 뒤 실패 항목만 따로 모으기

반대로 fan-out 없이 단순 분기만 필요하면 `add_conditional_edges(...)`가 더 단순하다. 상태 업데이트와 라우팅을 같은 노드에서 같이 결정해야 하면 `Command`가 더 잘 맞는다.

## 사전 준비

Python 3.10+ 환경에서 아래 정도면 예제를 바로 실행할 수 있다.

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

## 1. 가장 작은 `Send` 예제

아래 예제는 여러 문장을 각각 정리한 뒤 `summaries` 리스트에 모으는 구조다.

핵심은 두 가지다.

- `route_chunks(...)`가 `Send(...)` 목록을 반환한다
- `summaries`는 여러 병렬 노드의 결과를 합쳐야 하므로 reducer를 둔다

```python
from typing import Annotated
import operator
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send


class OverallState(TypedDict):
    paragraphs: list[str]
    summaries: Annotated[list[str], operator.add]


class ParagraphState(TypedDict):
    paragraph: str


def route_chunks(state: OverallState):
    return [
        Send("summarize_one", {"paragraph": paragraph})
        for paragraph in state["paragraphs"]
    ]


def summarize_one(state: ParagraphState):
    text = state["paragraph"].strip()
    short = text[:40] + ("..." if len(text) > 40 else "")
    return {"summaries": [f"- {short}"]}


builder = StateGraph(OverallState)
builder.add_node("summarize_one", summarize_one)
builder.add_conditional_edges(START, route_chunks)
builder.add_edge("summarize_one", END)

graph = builder.compile()

result = graph.invoke(
    {
        "paragraphs": [
            "LangGraph는 상태 기반 workflow와 agent orchestration을 위한 저수준 프레임워크다.",
            "Send를 사용하면 입력 개수에 따라 동적으로 같은 노드를 여러 번 실행할 수 있다.",
            "병렬 실행 결과를 안전하게 합치려면 reducer 설계가 중요하다.",
        ],
        "summaries": [],
    }
)

print(result["summaries"])
```

흐름은 간단하다.

1. `START`에서 `route_chunks`가 실행된다.
2. 각 paragraph마다 `Send("summarize_one", {...})`가 만들어진다.
3. LangGraph가 `summarize_one`을 여러 번 실행한다.
4. 각 실행 결과의 `summaries`가 reducer를 통해 하나로 합쳐진다.

## 2. 왜 reducer가 꼭 필요한가

`Send`를 처음 쓸 때 가장 많이 막히는 지점이 여기다. 병렬 실행된 노드들이 같은 state key에 값을 쓰면 LangGraph는 "이 값을 어떤 규칙으로 합칠지" 알아야 한다.

예제의 이 줄이 그 역할이다.

```python
summaries: Annotated[list[str], operator.add]
```

이 선언은 `summaries`에 여러 업데이트가 들어오면 리스트 덧셈으로 누적하라는 뜻이다. reducer 없이 같은 key에 여러 병렬 쓰기가 발생하면 충돌하거나 기대와 다른 동작이 나올 수 있다.

실무에서는 보통 아래처럼 잡는다.

- 리스트 누적: `Annotated[list[T], operator.add]`
- 숫자 합산: `Annotated[int, operator.add]`
- 커스텀 병합: 직접 reducer 함수 정의

공식 runtime 문서도 reducer는 결합 법칙을 만족하는 쪽이 안전하다고 설명한다. 병렬 배치 순서에 따라 결과가 달라지는 reducer는 재현성과 디버깅 가능성을 해칠 수 있다.

## 3. 실전형 map-reduce 예제

아래 예제는 문서 후보별 점수를 계산하고 최고 점수를 고르는 흐름이다.

```python
from typing import Annotated
import operator
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Send


class Candidate(TypedDict):
    doc_id: str
    score: float


class SearchState(TypedDict):
    query: str
    candidates: list[str]
    scored: Annotated[list[Candidate], operator.add]
    best_doc_id: str


class ScoreState(TypedDict):
    query: str
    candidate: str


def distribute_candidates(state: SearchState):
    return [
        Send(
            "score_candidate",
            {
                "query": state["query"],
                "candidate": candidate,
            },
        )
        for candidate in state["candidates"]
    ]


def score_candidate(state: ScoreState):
    overlap = len(set(state["query"].split()) & set(state["candidate"].split()))
    return {
        "scored": [
            {
                "doc_id": state["candidate"],
                "score": float(overlap),
            }
        ]
    }


def choose_best(state: SearchState):
    best = max(state["scored"], key=lambda item: item["score"], default=None)
    if best is None:
        return {"best_doc_id": ""}
    return {"best_doc_id": best["doc_id"]}


builder = StateGraph(SearchState)
builder.add_node("score_candidate", score_candidate)
builder.add_node("choose_best", choose_best)
builder.add_conditional_edges(START, distribute_candidates)
builder.add_edge("score_candidate", "choose_best")
builder.add_edge("choose_best", END)

graph = builder.compile()

result = graph.invoke(
    {
        "query": "langgraph reducer send",
        "candidates": [
            "langgraph send api reducer example",
            "vector database tuning notes",
            "langgraph command interrupt guide",
        ],
        "scored": [],
        "best_doc_id": "",
    }
)

print(result["scored"])
print(result["best_doc_id"])
```

이 구조가 useful한 이유는 scoring 로직을 각 candidate 단위로 격리할 수 있다는 점이다. 나중에 LLM 호출, 외부 검색, 랭킹 모델로 바꾸더라도 fan-out 구조는 유지된다.

## 4. 자주 하는 실수

### 4-1. 병렬 노드 입력 state와 전체 state를 구분하지 않는다

`Send("node_name", arg)`의 `arg`는 메인 graph의 전체 state와 같을 필요가 없다. 오히려 각 작업에 필요한 최소 입력만 넘기는 편이 안전하다.

나쁜 예:

```python
Send("score_candidate", state)
```

좋은 예:

```python
Send(
    "score_candidate",
    {"query": state["query"], "candidate": candidate},
)
```

입력을 줄여두면 각 병렬 작업이 어떤 값에 의존하는지 바로 보이고, 상태 충돌도 줄어든다.

### 4-2. reducer 없이 같은 key에 병렬로 쓴다

아래처럼 여러 병렬 노드가 모두 `results`에 쓰는데 reducer가 없으면 설계가 불완전하다.

```python
class BadState(TypedDict):
    items: list[str]
    results: list[str]
```

이 경우는 보통 아래처럼 바꿔야 한다.

```python
class GoodState(TypedDict):
    items: list[str]
    results: Annotated[list[str], operator.add]
```

### 4-3. fan-out 후 reduce 단계를 빼먹는다

`Send`로 병렬 노드를 실행한 뒤 끝내 버리면 "모은 결과로 다음에 무엇을 할지"가 graph에 잘 드러나지 않는다. 대부분은 fan-out 뒤에 `choose_best`, `aggregate`, `merge_results` 같은 reduce 노드를 하나 더 두는 편이 읽기 쉽다.

### 4-4. 순서가 항상 고정된다고 가정한다

병렬 수집 결과 리스트의 순서에 강하게 의존하면 나중에 디버깅이 어려워진다. 결과 순서가 중요하면 reducer 이후에 명시적으로 정렬하는 편이 낫다.

```python
def choose_best(state: SearchState):
    scored = sorted(state["scored"], key=lambda item: item["doc_id"])
    ...
```

## 5. `Send`, `Command`, conditional edges를 어떻게 구분할까

실무에서는 아래 기준으로 고르면 대부분 맞는다.

- 단순 분기: `add_conditional_edges(...)`
- 상태 업데이트와 라우팅을 같은 노드에서 처리: `Command`
- 입력 개수에 따라 같은 노드를 동적으로 여러 번 실행: `Send`

셋을 섞어 쓰는 것도 자연스럽다. 예를 들어 검색 workflow라면:

1. `Command`로 검색 전략 선택
2. `Send`로 후보별 병렬 검색
3. reduce 노드에서 병합
4. 필요하면 `interrupt()`로 사람 승인

이 식으로 조합하면 graph가 길어져도 역할이 비교적 선명하게 유지된다.

## 마무리

LangGraph의 `Send`는 "병렬 처리" 자체보다도 "입력 개수에 따라 graph 구조를 동적으로 펼친다"는 점이 핵심이다.

- fan-out이 필요하면 `Send`
- 병렬 결과 병합 규칙은 reducer로 명시
- 대부분은 reduce 노드를 하나 더 둬서 후속 결정을 분리

이 세 가지만 지켜도 문서 요약, 검색 후보 평가, 배치 검증 같은 workflow를 훨씬 읽기 좋은 graph로 바꿀 수 있다.

## 참고 자료

- [LangGraph Graph API Overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph Use the Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [LangGraph `Send` Reference](https://reference.langchain.com/python/langgraph/types/Send)
- [LangGraph Runtime / Pregel](https://docs.langchain.com/oss/python/langgraph/pregel)
