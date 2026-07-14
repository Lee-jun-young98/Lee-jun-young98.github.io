---
title: "LangGraph Overwrite로 reducer를 우회해 state를 리셋하기"
description: "LangGraph에서 Overwrite와 __overwrite__ 형식으로 reducer를 우회해 누적 state를 교체하는 방법, 메시지 초기화 패턴, 병렬 super-step 충돌 주의점을 Python 예제로 정리한 노트"
date: 2026-07-14
tags:
  - langgraph
  - python
  - state-management
  - agents
aliases:
  - "/blog/langgraph-overwrite-bypass-reducers-reset-state"
---

# LangGraph Overwrite로 reducer를 우회해 state를 리셋하기

LangGraph를 쓰다 보면 reducer가 붙은 state가 점점 누적되는 쪽이 기본 동작이다.

- `messages`에 대화 이력이 계속 쌓인다
- `operator.add`로 만든 list channel에 중간 결과가 계속 붙는다
- map-reduce 결과를 모은 뒤 다음 단계에서 "이제 새 값으로 갈아끼우고 싶다"는 순간이 생긴다

이럴 때 단순히 새 값을 반환하면 reducer가 또 합쳐 버린다.  
즉 "추가"가 아니라 "완전 교체"가 필요할 때는 `Overwrite`를 써야 한다.

이 글에서는 아래를 정리한다.

- `Overwrite`가 reducer 동작을 어떻게 바꾸는지
- list/message 누적 state를 리셋하는 가장 작은 예제
- JSON 형식 `{"__overwrite__": ...}`를 언제 쓰는지
- 병렬 super-step에서 왜 충돌이 나는지

## 언제 필요한가

다음 상황이면 `Overwrite`를 검토할 만하다.

- 누적된 `messages`를 요약 후 새 히스토리로 갈아끼우고 싶다
- reducer로 모은 중간 산출물을 특정 단계에서 초기화하고 싶다
- 이전 branch 결과를 버리고 정제된 값만 남기고 싶다
- 테스트용 fixture state를 한 번에 교체하고 싶다

반대로 값이 자연스럽게 누적되어야 한다면 reducer 기본 동작을 그대로 두는 편이 맞다. `Overwrite`는 예외 처리 수단에 가깝다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langgraph
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langgraph
```

공식 Graph API 문서 기준으로 `Overwrite`는 reducer가 붙은 key를 "이번 업데이트만 직접 대입"하고 싶을 때 쓰는 타입이다.

## 1. reducer가 붙어 있으면 그냥 반환해도 합쳐진다

먼저 기본 동작을 짧게 보면 이해가 쉽다.

```python
import operator
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    items: Annotated[list[str], operator.add]


def collect_a(state: State):
    return {"items": ["a"]}


def collect_b(state: State):
    return {"items": ["b"]}


builder = StateGraph(State)
builder.add_node("collect_a", collect_a)
builder.add_node("collect_b", collect_b)
builder.add_edge(START, "collect_a")
builder.add_edge("collect_a", "collect_b")
builder.add_edge("collect_b", END)

graph = builder.compile()
result = graph.invoke({"items": ["seed"]})
print(result["items"])  # ['seed', 'a', 'b']
```

여기서 `collect_b`가 `["b"]`를 반환해도 기존 값을 덮지 않고 append된다.  
이 동작 자체는 맞지만, 어떤 단계에서는 오히려 누적 결과를 초기화하고 싶을 수 있다.

## 2. `Overwrite(...)`를 쓰면 reducer를 우회해서 교체된다

그럴 때는 `langgraph.types.Overwrite`를 반환값에 감싸면 된다.

```python
import operator
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Overwrite


class State(TypedDict):
    items: Annotated[list[str], operator.add]


def collect_a(state: State):
    return {"items": ["a"]}


def replace_items(state: State):
    return {"items": Overwrite(["final-only"])}


builder = StateGraph(State)
builder.add_node("collect_a", collect_a)
builder.add_node("replace_items", replace_items)
builder.add_edge(START, "collect_a")
builder.add_edge("collect_a", "replace_items")
builder.add_edge("replace_items", END)

graph = builder.compile()
result = graph.invoke({"items": ["seed"]})
print(result["items"])  # ['final-only']
```

핵심은 `Overwrite(["final-only"])`가 reducer를 아예 건너뛴다는 점이다.  
`operator.add`, `add_messages` 같은 reducer가 붙어 있어도 이번 업데이트는 merge 대신 replace가 된다.

## 3. 메시지 이력을 요약 후 새 히스토리로 갈아끼우기

실무에서는 `messages`를 다룰 때 가장 체감이 크다.  
긴 대화를 요약한 뒤 예전 message를 계속 남겨두면 비용과 컨텍스트 오염이 커진다.

```python
from typing import Annotated, TypedDict

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.types import Overwrite


class ChatState(TypedDict):
    messages: Annotated[list, add_messages]
    summary: str


def summarize(state: ChatState):
    summary = "사용자는 환불 상태와 배송 지연을 문의했고, 이미 신원 확인을 마쳤다."
    compact_history = [
        SystemMessage(content="이전 대화 요약을 바탕으로 이어서 응답하세요."),
        HumanMessage(content=f"지금까지 대화 요약: {summary}"),
    ]
    return {
        "summary": summary,
        "messages": Overwrite(compact_history),
    }


builder = StateGraph(ChatState)
builder.add_node("summarize", summarize)
builder.add_edge(START, "summarize")
builder.add_edge("summarize", END)

graph = builder.compile()
result = graph.invoke(
    {
        "messages": [
            HumanMessage(content="주문이 아직 안 왔어요."),
            AIMessage(content="주문번호를 알려주세요."),
            HumanMessage(content="A-1024입니다."),
        ],
        "summary": "",
    }
)

for message in result["messages"]:
    print(type(message).__name__, message.content)
```

이 패턴은 다음과 잘 맞는다.

- 장기 대화 압축
- 이전 tool output 제거 후 핵심 문맥만 유지
- thread state를 운영 비용 관점에서 slim하게 재구성

## 4. JSON 형태 `__overwrite__`도 쓸 수 있다

공식 문서에는 Python 타입 외에 JSON 친화적인 표현도 있다.

```python
import operator
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    items: Annotated[list[str], operator.add]


def replace_items(state: State):
    return {"items": {"__overwrite__": ["replaced-from-json"]}}


builder = StateGraph(State)
builder.add_node("replace_items", replace_items)
builder.add_edge(START, "replace_items")
builder.add_edge("replace_items", END)

graph = builder.compile()
result = graph.invoke({"items": ["seed"]})
print(result["items"])  # ['replaced-from-json']
```

이 표현은 외부 시스템이 graph update payload를 JSON으로만 만들 수 있을 때 특히 편하다.

## 5. 병렬 브랜치에서는 같은 super-step에 한 번만 overwrite해야 한다

주의할 점도 분명하다.  
여러 노드가 같은 super-step에서 같은 key를 동시에 `Overwrite`하려고 하면 충돌한다.

```python
import operator
from typing import Annotated, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Overwrite


class State(TypedDict):
    items: Annotated[list[str], operator.add]


def left_branch(state: State):
    return {"items": Overwrite(["left"])}


def right_branch(state: State):
    return {"items": Overwrite(["right"])}


graph = (
    StateGraph(State)
    .add_node("left_branch", left_branch)
    .add_node("right_branch", right_branch)
    .add_edge(START, "left_branch")
    .add_edge(START, "right_branch")
    .add_edge("left_branch", END)
    .add_edge("right_branch", END)
    .compile()
)

graph.invoke({"items": []})  # InvalidUpdateError
```

즉 `Overwrite`는 "이 key의 최종 값을 내가 단독으로 정한다"는 의미에 가깝다.  
병렬 fan-out 안에서 여러 노드가 동시에 같은 key를 덮으면 런타임이 어느 쪽을 채택해야 할지 결정할 수 없다.

안전한 설계는 보통 둘 중 하나다.

- 병렬 브랜치에서는 각자 다른 key에 쓰고, fan-in 이후 단일 노드에서 한 번만 overwrite한다
- overwrite가 꼭 필요 없다면 reducer로 병합 가능한 구조를 유지한다

## 자주 하는 실수

### 1. reducer key를 "그냥 새 리스트 반환"으로 초기화하려고 한다

reducer가 붙은 key는 기본적으로 merge된다.  
새 값처럼 보여도 실제로는 append 또는 custom merge가 일어날 수 있다.

### 2. `messages`를 요약했는데 예전 히스토리가 계속 남는다

`add_messages`는 message ID 갱신과 message 포맷 처리에는 편하지만, 기본적으로는 누적 쪽에 가깝다.  
요약 후 compact history만 남기고 싶다면 `Overwrite`가 더 직접적이다.

### 3. 병렬 브랜치 양쪽에서 같은 key를 동시에 overwrite한다

공식 문서 기준으로 같은 super-step에서 같은 key에 여러 overwrite가 오면 `InvalidUpdateError`가 난다.

### 4. overwrite와 update_state()를 같은 문제로 본다

`Overwrite`는 "이번 노드 반환값 처리 방식"이고, `update_state()`는 "외부에서 checkpoint state를 수동 수정"하는 흐름이다.  
운영 중 thread를 고치는 작업이면 `update_state()`가 맞고, 그래프 실행 중 교체 로직이면 `Overwrite`가 더 자연스럽다.

## 실전 적용 기준

내 기준에서는 이렇게 나누면 깔끔하다.

- 누적이 기본이어야 하는 channel: reducer 유지
- 특정 단계에서 스냅샷을 새 기준값으로 갈아껴야 하는 channel: `Overwrite`
- 병렬 결과를 정리한 뒤 최종 state만 남기고 싶을 때: fan-in 이후 단일 노드에서 `Overwrite`
- 메시지 압축/슬리밍: 요약 생성 후 `messages`를 compact history로 `Overwrite`

## 참고 자료

- [LangGraph Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [LangGraph Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
