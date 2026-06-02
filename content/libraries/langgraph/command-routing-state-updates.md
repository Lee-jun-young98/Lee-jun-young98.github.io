---
title: LangGraph Command로 상태 업데이트와 라우팅을 한 번에 처리하기
description: LangGraph Graph API에서 Command를 사용해 상태 업데이트와 다음 노드 분기를 한 노드 안에서 함께 처리하는 실전 패턴 정리
date: 2026-06-02
tags:
  - langgraph
  - agent
  - workflow
  - python
aliases:
  - "/blog/langgraph-command-routing-state-updates"
---

# LangGraph Command로 상태 업데이트와 라우팅을 한 번에 처리하기

LangGraph를 처음 쓸 때 가장 자주 보게 되는 분기 방식은 `add_conditional_edges(...)`다.  
그런데 실전에서는 "상태를 갱신한 뒤", "그 결과를 기준으로 다음 노드를 정한다"는 흐름이 더 흔하다.

예를 들면 이런 경우다.

- 리뷰 점수가 낮으면 수정 단계로 보낸다.
- 승인 여부를 상태에 기록한 뒤 발송 단계 또는 중단 단계로 보낸다.
- 검색 결과 개수를 저장하고, 0건이면 재질문 노드로 보낸다.

이럴 때 라우팅 함수와 상태 업데이트 함수를 따로 쪼개면 코드가 금방 흩어진다.  
LangGraph는 이 상황을 위해 `Command`를 제공한다. 공식 문서 기준으로 `Command`는 `update`, `goto`, `graph`, `resume`를 묶는 제어 primitive이고, 상태 업데이트와 라우팅을 한 함수에서 함께 처리할 때 쓰는 것이 맞다.

이 글에서는 다음만 빠르게 정리한다.

- `Command`를 언제 쓰는지
- `add_conditional_edges`와 어떻게 구분하는지
- 바로 실행해볼 수 있는 Python 예제
- 실전에서 자주 생기는 함정

## 언제 `Command`가 좋은가

공식 LangGraph Graph API 문서에서는 "상태 업데이트와 라우팅을 한 함수에서 같이 처리해야 하면 `Command`를 쓰고, 단순 라우팅만 필요하면 conditional edges를 쓰라"고 설명한다.

즉 기준은 단순하다.

- 상태만 바꾼다: 노드가 `dict` 업데이트를 반환
- 분기만 한다: `add_conditional_edges(...)`
- 상태도 바꾸고 분기도 한다: `Command(update=..., goto=...)`

이 기준을 잡아두면 그래프가 커져도 제어 흐름을 읽기 쉬워진다.

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

## 1. 가장 작은 `Command` 예제

아래 예제는 초안 품질을 점수로 판단해서 `publish` 또는 `revise` 노드로 보낸다.  
중요한 점은 점수와 판정 이유를 상태에 저장하는 일과 다음 노드 결정이 `review_draft` 한 곳에서 같이 일어난다는 점이다.

```python
from typing import Literal
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Command


class DraftState(TypedDict):
    draft: str
    score: int
    decision: str
    notes: str


def score_draft(text: str) -> int:
    text = text.strip()
    if len(text) >= 80 and "예시" in text:
        return 85
    if len(text) >= 40:
        return 65
    return 45


def review_draft(state: DraftState) -> Command[Literal["publish", "revise"]]:
    score = score_draft(state["draft"])

    if score >= 80:
        return Command(
            update={
                "score": score,
                "decision": "publish",
                "notes": "길이와 예시가 충분해서 바로 발행 가능",
            },
            goto="publish",
        )

    return Command(
        update={
            "score": score,
            "decision": "revise",
            "notes": "설명이 짧거나 예시가 부족해서 수정 필요",
        },
        goto="revise",
    )


def publish(state: DraftState):
    return {"notes": state["notes"] + " / publish 단계 실행"}


def revise(state: DraftState):
    improved = state["draft"] + "\n\n예시: 운영 환경에서는 검토 단계를 추가한다."
    return {
        "draft": improved,
        "notes": state["notes"] + " / revise 단계 실행",
    }


builder = StateGraph(DraftState)
builder.add_node("review_draft", review_draft)
builder.add_node("publish", publish)
builder.add_node("revise", revise)
builder.add_edge(START, "review_draft")
builder.add_edge("publish", END)
builder.add_edge("revise", END)

graph = builder.compile()

result = graph.invoke(
    {
        "draft": "LangGraph 초안입니다. 길이는 짧지만 상태 제어의 방향은 설명합니다.",
        "score": 0,
        "decision": "",
        "notes": "",
    }
)

print(result)
```

이 코드에서 핵심은 세 가지다.

- 노드 반환형을 `Command[Literal["publish", "revise"]]`로 적어 가능한 목적지를 명시한다.
- `update=`에서 상태를 갱신한다.
- `goto=`에서 다음 노드를 고른다.

공식 문서에서는 이 반환형 annotation이 그래프 렌더링과 정적 이해에 필요하다고 설명한다.

## 2. `add_conditional_edges` 대신 언제 더 낫나

`add_conditional_edges`는 여전히 좋은 기본 도구다.  
다만 아래처럼 "판정 결과를 상태에도 남겨야 하는" 순간부터 `Command` 쪽이 더 자연스럽다.

```python
from typing import Literal
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Command


class TicketState(TypedDict):
    priority: str
    assignee: str
    route_reason: str


def route_ticket(state: TicketState) -> Command[Literal["urgent_queue", "normal_queue"]]:
    if state["priority"] == "high":
        return Command(
            update={
                "assignee": "senior-oncall",
                "route_reason": "high priority ticket",
            },
            goto="urgent_queue",
        )

    return Command(
        update={
            "assignee": "support-rotation",
            "route_reason": "normal priority ticket",
        },
        goto="normal_queue",
    )


def urgent_queue(state: TicketState):
    return {}


def normal_queue(state: TicketState):
    return {}


graph = (
    StateGraph(TicketState)
    .add_node("route_ticket", route_ticket)
    .add_node("urgent_queue", urgent_queue)
    .add_node("normal_queue", normal_queue)
    .add_edge(START, "route_ticket")
    .add_edge("urgent_queue", END)
    .add_edge("normal_queue", END)
    .compile()
)
```

이런 구조는 라우팅 근거가 그대로 상태에 남기 때문에 나중에 로그를 보거나 UI에 노출하기 쉽다.

## 3. 실무에서 바로 쓰는 패턴

`Command`는 아래 패턴에서 특히 자주 쓴다.

- 승인 워크플로: 승인 상태를 저장하고 `approve`/`reject` 분기
- 검색 후 재시도: 검색 건수나 실패 원인을 저장하고 `retry`/`answer` 분기
- 품질 게이트: LLM 결과 점수나 validator 결과를 저장하고 `revise`/`publish` 분기
- 서브그래프 탈출: subgraph 안에서 부모 그래프의 다른 노드로 점프

마지막 경우에는 공식 문서 기준으로 `graph=Command.PARENT`를 지정할 수 있다.  
다만 부모와 자식 그래프가 같은 상태 키를 공유한다면, 부모 쪽에 reducer 정의가 필요할 수 있다.

## 4. 자주 생기는 함정

### 4-1. 상태를 직접 mutate하고 끝내면 안 된다

LangGraph 노드는 상태 객체를 직접 바꾸는 대신 "업데이트 딕셔너리"를 반환해야 한다.  
`Command(update=...)`도 같은 규칙 위에서 동작한다.

나쁜 예:

```python
def bad_node(state):
    state["decision"] = "publish"
    return Command(goto="publish")
```

좋은 예:

```python
def good_node(state) -> Command[Literal["publish"]]:
    return Command(update={"decision": "publish"}, goto="publish")
```

### 4-2. 단순 라우팅인데 `Command`를 남발하면 그래프가 오히려 무거워진다

상태 업데이트가 전혀 없고, 분기 로직만 따로 보여주는 편이 더 읽기 쉽다면 `add_conditional_edges(...)`가 낫다.  
공식 문서도 이 기준을 분명히 나눈다.

### 4-3. 반환형 annotation을 빼면 유지보수가 불편해진다

`Command[Literal["node_a", "node_b"]]`를 빼도 일부 코드는 돌 수 있지만, 문서 기준으로 가능한 목적지를 LangGraph가 정적으로 알기 어려워진다.  
그래프 시각화나 협업 시 가독성이 바로 떨어진다.

### 4-4. `Command` 하나로 모든 제어를 해결하려고 하면 안 된다

LangGraph에는 역할이 나뉜 도구가 있다.

- `add_conditional_edges`: 분기만 필요할 때
- `Send`: map-reduce 형태 fan-out이 필요할 때
- `interrupt` + `Command(resume=...)`: 외부 입력을 받아 재개할 때
- `Command(update=..., goto=...)`: 한 노드에서 상태와 흐름을 함께 바꿀 때

처음부터 전부 `Command`로 밀어붙이기보다, 제어 목적에 맞는 도구를 고르는 편이 구조가 오래 간다.

## 5. 언제 다음 단계로 넘어가면 좋나

`Command`가 익숙해지면 다음 주제를 이어서 보면 흐름이 좋다.

- `interrupt()`로 사람 승인 입력을 기다리는 패턴
- `Send`로 리스트 아이템별 fan-out 처리하기
- subgraph와 `Command.PARENT`로 부모 그래프 이동하기
- checkpointer를 붙여 durable execution 구성하기

특히 "검토 -> 수정 -> 재검토" 같은 loop를 만들 때 `Command` 감각이 잡혀 있으면 LangGraph 코드가 훨씬 덜 복잡해진다.

## 마무리

LangGraph의 `Command`는 단순한 분기 문법이 아니라, "이 노드가 상태를 어떻게 바꾸고 다음 어디로 갈지"를 한 덩어리로 표현하는 도구다.

- 상태 업데이트와 분기가 강하게 연결돼 있다면 `Command`
- 분기만 필요하면 `add_conditional_edges`
- fan-out이면 `Send`

이 구분만 명확해도 작은 workflow를 큰 그래프로 확장할 때 설계가 덜 흔들린다.

## 참고 자료

- [LangGraph Graph API Overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph Use the Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [LangGraph Thinking in LangGraph](https://docs.langchain.com/oss/python/langgraph/thinking-in-langgraph)
