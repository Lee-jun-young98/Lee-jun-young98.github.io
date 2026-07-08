---
title: "LangGraph add_node(destinations=...)로 Command 라우팅 그래프를 읽기 좋게 그리기"
description: "LangGraph StateGraph.add_node의 destinations 파라미터를 사용해 Command 기반 라우팅 그래프를 더 읽기 좋은 Mermaid 다이어그램으로 렌더링하는 실전 패턴 정리"
date: 2026-07-08
tags:
  - langgraph
  - workflow
  - python
  - visualization
aliases:
  - /blog/langgraph-add-node-destinations-command-routing-rendering
---

# LangGraph add_node(destinations=...)로 Command 라우팅 그래프를 읽기 좋게 그리기

LangGraph에서 `Command(goto=...)`를 쓰기 시작하면 실행 흐름은 깔끔해지는데, 그래프 그림은 오히려 읽기 어려워질 때가 많습니다.

- 라우팅은 node 안에 있는데 Mermaid에는 다음 후보가 잘 안 보인다
- review, approve, reject 같은 분기가 코드에는 있는데 시각화에서는 빠져 보인다
- 팀 문서나 Quartz 노트에 붙일 그래프가 너무 밋밋해서 의도가 잘 전달되지 않는다

이럴 때 쓰는 보조 파라미터가 `StateGraph.add_node(..., destinations=...)`입니다.  
2026년 7월 8일 기준 LangGraph 공식 reference는 `destinations`를 "node가 어디로 라우팅될 수 있는지"를 알려 주는 렌더링 힌트로 설명합니다.

중요한 점은 하나입니다.

- `destinations`는 **실행 제어가 아니라 그래프 렌더링용 메타데이터**다

공식 reference도 이 값을 "edgeless graph에서 `Command`를 반환하는 node에 유용"하다고 설명하면서, **graph rendering에만 쓰이고 실행에는 영향을 주지 않는다**고 경고합니다.

이 글에서는 아래만 실전 기준으로 정리합니다.

- `destinations`를 언제 붙이면 좋은지
- `tuple`과 `dict` 형태 차이
- `Command[Literal[...]]` 타입 힌트와 함께 쓰는 기본 패턴
- 자주 틀리는 함정

## 언제 유용한가

다음 상황이면 거의 바로 후보입니다.

- `add_conditional_edges(...)` 대신 `Command(goto=...)`로 라우팅을 node 안에 모으고 싶을 때
- 실행 로직은 그대로 두고 Mermaid/Studio 시각화만 더 읽기 좋게 만들고 싶을 때
- Quartz 문서, ADR, 운영 노트에 "이 node가 어디로 갈 수 있는지"를 한눈에 남기고 싶을 때
- review, handoff, escalation 같은 분기 이름에 사람이 읽는 라벨을 붙이고 싶을 때

반대로 이미 정적 edge가 충분히 선명하고 별도 시각화 품질 문제가 없다면 굳이 추가하지 않아도 됩니다.

## 먼저 알아둘 핵심 규칙

공식 문서 기준으로 `Command` 라우팅에는 두 층이 있습니다.

1. 실제 실행 제어: node가 반환하는 `Command(goto=...)`
2. 시각화 힌트: `add_node(..., destinations=...)`

즉 실제로 어느 node가 실행될지는 `Command`가 정하고, `destinations`는 "이 node가 갈 수 있는 후보"를 렌더러에게 알려 주는 역할입니다.

여기서 함께 기억할 규칙이 두 개 더 있습니다.

- `Command`를 반환하는 node는 `Command[Literal["node_a", "node_b"]]`처럼 가능한 목적지를 return type annotation에 적는 편이 좋습니다. 공식 Graph API 문서도 이것이 graph rendering에 필요하다고 설명합니다.
- 같은 node에 `Command(goto=...)`와 정적 `add_edge(...)`를 같이 두면 안 됩니다. 공식 문서는 둘 다 실행될 수 있으니 둘 중 하나만 route 용도로 쓰라고 경고합니다.

## 가장 작은 runnable 예제

아래 예제는 고객 요청을 triage한 뒤 `answer`, `refund_review`, `human_escalation` 중 하나로 보내는 가장 작은 패턴입니다.

```python
from typing import Literal
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Command


class State(TypedDict, total=False):
    user_message: str
    route: str
    result: str


def triage(state: State) -> Command[
    Literal["answer", "refund_review", "human_escalation"]
]:
    message = state["user_message"].lower()

    if "refund" in message:
        return Command(
            update={"route": "refund_review"},
            goto="refund_review",
        )

    if "legal" in message or "complaint" in message:
        return Command(
            update={"route": "human_escalation"},
            goto="human_escalation",
        )

    return Command(
        update={"route": "answer"},
        goto="answer",
    )


def answer(state: State) -> State:
    return {"result": "기본 FAQ 응답으로 처리합니다."}


def refund_review(state: State) -> State:
    return {"result": "환불 검토 큐로 보냈습니다."}


def human_escalation(state: State) -> State:
    return {"result": "사람 상담원 검토로 넘깁니다."}


builder = StateGraph(State)
builder.add_node(
    "triage",
    triage,
    destinations={
        "answer": "auto answer",
        "refund_review": "refund review",
        "human_escalation": "human escalation",
    },
)
builder.add_node("answer", answer)
builder.add_node("refund_review", refund_review)
builder.add_node("human_escalation", human_escalation)

builder.add_edge(START, "triage")
builder.add_edge("answer", END)
builder.add_edge("refund_review", END)
builder.add_edge("human_escalation", END)

graph = builder.compile()

print(graph.invoke({"user_message": "I want a refund for duplicate billing."}))
print(graph.get_graph().draw_mermaid())
```

실행 결과는 평범합니다.

```python
{"user_message": "I want a refund for duplicate billing.", "route": "refund_review", "result": "환불 검토 큐로 보냈습니다."}
```

핵심은 Mermaid 쪽입니다.

- `triage`가 세 후보로 갈 수 있다는 점이 렌더링에 더 선명하게 드러납니다
- `dict`를 썼기 때문에 edge label도 함께 붙일 수 있습니다
- 실행 로직은 전부 `Command(goto=...)`에 있고, `destinations`는 그림만 보강합니다

## `tuple`과 `dict`는 어떻게 다를까

공식 reference 기준으로 `destinations`는 두 형태를 받습니다.

### 1. `tuple[str, ...]`: 목적지 이름만 알려 주기

```python
builder.add_node(
    "triage",
    triage,
    destinations=("answer", "refund_review", "human_escalation"),
)
```

이 형태는 간단합니다.

- edge label 없이
- "이 node는 이 후보들로 갈 수 있다"만 표시합니다

분기 의미가 이름만으로 충분하면 이쪽이 더 간단합니다.

### 2. `dict[str, str]`: 목적지 이름 + 사람이 읽는 라벨

```python
builder.add_node(
    "triage",
    triage,
    destinations={
        "answer": "auto answer",
        "refund_review": "refund review",
        "human_escalation": "human escalation",
    },
)
```

여기서:

- key는 실제 target node 이름
- value는 렌더링용 edge label

문서화용 그래프에서는 대개 `dict`가 더 좋습니다.  
특히 node 이름은 짧게 유지하고, edge label에는 도메인 의미를 조금 더 친절하게 적을 수 있기 때문입니다.

## 이 기능이 특히 좋은 이유

`Command` 기반 라우팅은 로직 응집도가 높습니다.

- 상태 판단
- state update
- 다음 node 선택

이 세 가지를 한 node 안에서 함께 처리할 수 있습니다.

문제는 이 구조가 시각화에서는 덜 친절할 수 있다는 점입니다.  
`destinations`는 바로 그 틈을 메웁니다.

- 실행 코드는 `Command`로 유지
- 문서와 Mermaid는 더 읽기 좋게 유지
- routing 후보를 edge 선언으로 중복하지 않음

즉 "실행 로직 중복 없이 그림만 보강"하는 쪽에 가깝습니다.

## 자주 틀리는 점

### 1. `destinations`가 실행을 바꾼다고 오해한다

이게 가장 흔한 착각입니다.

```python
builder.add_node(
    "triage",
    triage,
    destinations=("answer", "refund_review"),
)
```

이 코드만으로는 어디에도 실행되지 않습니다.  
실제 실행은 여전히 `triage()`가 반환하는 `Command(goto=...)`가 정합니다.

즉 `goto="refund_review"`를 반환하지 않으면 `refund_review`는 실행되지 않습니다.

### 2. `Command` return type annotation을 빼먹는다

공식 Graph API 문서는 `Command`를 반환하는 node에 `Command[Literal["..."]]` 형태의 타입 힌트가 rendering에 필요하다고 설명합니다.

```python
def triage(state: State) -> Command[
    Literal["answer", "refund_review", "human_escalation"]
]:
    ...
```

이 힌트를 빼면:

- 에디터 도움도 약해지고
- 시각화가 덜 정확하거나 덜 친절해질 수 있습니다

### 3. 같은 node에 `Command`와 정적 edge를 같이 둔다

이 패턴은 피하는 편이 좋습니다.

```python
builder.add_edge("triage", "answer")  # route 용도로 추가
```

공식 문서 경고대로 `triage`가 `Command(goto="refund_review")`를 반환해도 정적 edge가 함께 실행될 수 있습니다.  
즉 `answer`와 `refund_review`가 둘 다 돌 수 있습니다.

정리하면:

- route는 `Command`
- 그림 보강은 `destinations`

이렇게 역할을 분리하는 편이 안전합니다.

### 4. `destinations`의 key와 실제 `goto` 문자열이 어긋난다

```python
destinations={"refund": "refund review"}
```

그런데 실제 코드는:

```python
return Command(goto="refund_review")
```

이렇게 되면 렌더링 의도와 실제 실행 이름이 어긋납니다.  
`dict`의 key는 반드시 실제 target node 이름과 맞춰 두는 편이 안전합니다.

## 추천 사용 패턴

개인적으로는 아래 방식이 가장 무난합니다.

1. 라우팅 로직은 `Command(goto=...)`로 node 안에 모은다
2. 같은 node에는 route 용도의 `add_edge(...)`를 두지 않는다
3. `Command[Literal[...]]`로 가능한 목적지를 타입에 적는다
4. 시각화 품질이 중요하면 `destinations={node: label}`을 붙인다
5. 최종 Mermaid는 `graph.get_graph().draw_mermaid()`로 확인한다

이렇게 두면 실행 로직과 문서화 품질을 동시에 챙기기 쉽습니다.

## 참고 자료

- [LangGraph Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [StateGraph.add_node reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node)
- [Command reference](https://reference.langchain.com/python/langgraph/types/Command)
