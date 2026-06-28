---
title: "LangGraph 병렬 interrupt를 ID 매핑으로 한 번에 재개하기"
description: "LangGraph에서 여러 parallel branch가 동시에 interrupt()에 걸릴 때 Interrupt.id별 resume_map으로 안전하게 재개하는 실전 패턴 정리"
date: 2026-06-28
tags:
  - langgraph
  - python
  - workflow
  - human-in-the-loop
aliases:
  - "/blog/langgraph-parallel-interrupts-resume-map"
---

# LangGraph 병렬 interrupt를 ID 매핑으로 한 번에 재개하기

LangGraph에서 `interrupt()`를 한 번만 쓰는 패턴은 비교적 단순하다.  
하지만 fan-out된 여러 branch가 동시에 `interrupt()`에 걸리면 재개 방식이 바로 중요해진다.

예를 들면 이런 흐름이다.

- 여러 문서 수정안을 병렬로 만들고 각각 사람 승인을 받는다
- 여러 외부 API 호출 초안을 병렬로 준비하고 항목별로 승인/반려를 받는다
- 다수의 tool call 후보를 병렬로 점검한 뒤 일부만 재개한다

이때 가장 중요한 기준은 "resume 값을 순서로 맞추지 말고 interrupt ID로 매핑한다"는 점이다.  
2026-06-28 기준 LangGraph 공식 interrupts 문서도, 여러 parallel branch가 동시에 멈추면 `Command(resume={interrupt_id: value, ...})` 형태를 권장한다.

이 글에서는 아래만 실전 위주로 정리한다.

- 병렬 interrupt가 왜 단일 `resume=value`와 다르게 다뤄져야 하는지
- `stream_events(..., version="v3")`에서 pending interrupt를 모으는 방법
- `Interrupt.id`로 `resume_map`을 만들어 한 번에 재개하는 예제
- 같은 node 안에서 interrupt 순서가 바뀌면 왜 꼬이는지

## 언제 이 패턴이 필요한가

아래 상황이면 거의 바로 필요해진다.

- `START -> review_a`, `START -> review_b`처럼 병렬 branch가 각각 `interrupt()`를 호출한다
- 한 번의 UI 제출에서 여러 승인 결과를 같이 반영하고 싶다
- 브랜치별 완료 순서가 바뀌어도 각 응답이 정확한 interrupt에 연결되어야 한다

반대로 interrupt가 항상 하나만 열리는 흐름이면 기존 `Command(resume=single_value)`만으로 충분하다.

## 사전 준비

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

병렬 interrupt를 재개하려면 persistence가 필요하므로 checkpointer도 같이 써야 한다.  
로컬 예제는 `InMemorySaver`면 충분하고, 운영에서는 SQLite/Postgres 계열 checkpointer가 더 자연스럽다.

## 1. 가장 작은 예제: 두 branch가 동시에 멈출 때

아래 예제는 `a`, `b` 두 노드가 병렬로 시작되고 둘 다 `interrupt()`에서 멈춘다.  
그다음 `stream.interrupts`에 모인 `Interrupt.id`를 키로 해서 한 번에 재개한다.

```python
from typing import Annotated
from typing_extensions import TypedDict
import operator

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt


class ReviewState(TypedDict):
    approvals: Annotated[list[str], operator.add]


def review_a(state: ReviewState):
    decision = interrupt(
        {
            "kind": "document_review",
            "item_id": "draft-a",
            "question": "draft-a를 승인할까요?",
        }
    )
    return {"approvals": [f"a:{decision['approved']}"]}


def review_b(state: ReviewState):
    decision = interrupt(
        {
            "kind": "document_review",
            "item_id": "draft-b",
            "question": "draft-b를 승인할까요?",
        }
    )
    return {"approvals": [f"b:{decision['approved']}"]}


graph = (
    StateGraph(ReviewState)
    .add_node("review_a", review_a)
    .add_node("review_b", review_b)
    .add_edge(START, "review_a")
    .add_edge(START, "review_b")
    .add_edge("review_a", END)
    .add_edge("review_b", END)
    .compile(checkpointer=InMemorySaver())
)

config = {"configurable": {"thread_id": "parallel-review-1"}}

stream = graph.stream_events(
    {"approvals": []},
    config=config,
    version="v3",
)

# stream을 끝까지 소비해야 interrupt 정보와 최종 상태가 채워진다.
_ = stream.output

print(stream.interrupted)
print(stream.interrupts)

resume_map = {
    interrupt_info.id: {"approved": interrupt_info.value["item_id"] == "draft-a"}
    for interrupt_info in stream.interrupts
}

resumed = graph.stream_events(
    Command(resume=resume_map),
    config=config,
    version="v3",
)

print(resumed.output)
```

핵심은 아주 단순하다.

- pending interrupt는 `stream.interrupts`에 모인다
- 각 항목은 `Interrupt(value=..., id=...)` 형태다
- 재개할 때는 `Command(resume=resume_map)`으로 넘긴다

즉 "첫 번째 응답은 a, 두 번째 응답은 b"처럼 순서에 기대지 않고, "이 응답은 이 interrupt ID의 것"이라고 직접 연결하는 방식이다.

## 2. 실전 패턴: UI에서 여러 승인 입력을 모아 한 번에 재개하기

보통 서버는 아래 두 단계로 나뉜다.

1. 워크플로를 실행해서 interrupt payload 목록을 프론트엔드로 보낸다
2. 사용자가 여러 항목을 확인한 뒤 한 번에 제출하면 `resume_map`으로 재개한다

```python
from langgraph.types import Command


def start_parallel_review(graph, payload: dict, thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    stream = graph.stream_events(payload, config=config, version="v3")
    _ = stream.output

    if stream.interrupted:
        return {
            "status": "waiting_review",
            "interrupts": [
                {
                    "interrupt_id": item.id,
                    "payload": item.value,
                }
                for item in stream.interrupts
            ],
        }

    return {"status": "completed", "result": stream.output}


def resume_parallel_review(graph, thread_id: str, decisions: list[dict]):
    config = {"configurable": {"thread_id": thread_id}}

    resume_map = {
        item["interrupt_id"]: {
            "approved": item["approved"],
            "note": item.get("note", ""),
        }
        for item in decisions
    }

    resumed = graph.stream_events(
        Command(resume=resume_map),
        config=config,
        version="v3",
    )
    return resumed.output
```

여기서 API 계약을 이렇게 잡아 두면 운영이 훨씬 편해진다.

- 프론트엔드는 `interrupt_id`를 숨기지 않고 그대로 보관한다
- 사용자는 항목 순서를 바꿔도 된다
- 서버는 제출 순서가 아니라 `interrupt_id` 기준으로 정확히 매칭한다

특히 UI에서 drag-and-drop 정렬, 필터링, 일부 항목 접기 같은 기능이 들어가면 "리스트 순서 의존" 방식은 빠르게 깨진다.

## 3. 왜 `invoke()`보다 `stream_events(..., version="v3")`가 실전에서 더 편한가

`graph.invoke(...)`도 여전히 쓸 수 있고, interrupt는 `result["__interrupt__"]`로 확인할 수 있다.  
다만 병렬 interrupt를 실제 서비스에 붙일 때는 공식 문서 기준 `stream_events(..., version="v3")`가 보통 더 자연스럽다.

이유는 아래와 같다.

- `stream.messages`로 모델 토큰을 같이 흘려보낼 수 있다
- `stream.values`로 step별 state snapshot을 관찰할 수 있다
- `stream.interrupts`에 pending interrupt가 구조화되어 모인다
- 재개 후에도 같은 인터페이스로 계속 루프를 돌릴 수 있다

즉 "스트리밍 UI + 승인 대기 + 재개"를 하나의 런타임 모델로 묶기 쉽다.

## 4. 같은 node 안의 여러 interrupt는 다른 규칙을 가진다

여기서 많이 헷갈리는 부분이 하나 있다.

- 병렬 branch 여러 개가 각자 interrupt에 걸릴 때: `interrupt_id -> resume_value` 매핑이 안전하다
- 같은 node 함수 안에서 `interrupt()`를 여러 번 호출할 때: task 내부 resume 값은 순서 기반으로 대응된다

공식 interrupts 문서는 같은 node 안의 여러 `interrupt()` 호출에 대해 "matching is strictly index-based"라고 설명한다.  
즉 node 재실행 시 interrupt 호출 순서가 바뀌면 resume 값이 엇갈릴 수 있다.

안전한 예:

```python
from langgraph.types import interrupt


def collect_profile(state):
    name = interrupt("이름을 입력해 주세요")
    age = interrupt("나이를 입력해 주세요")
    city = interrupt("도시를 입력해 주세요")
    return {"profile": {"name": name, "age": age, "city": city}}
```

위험한 예:

```python
from langgraph.types import interrupt


def collect_profile(state):
    name = interrupt("이름을 입력해 주세요")

    if state.get("needs_age"):
        age = interrupt("나이를 입력해 주세요")

    city = interrupt("도시를 입력해 주세요")
    return {"name": name, "city": city}
```

재개할 때 node는 interrupt가 있던 지점부터가 아니라 "그 node의 처음부터" 다시 실행된다.  
그래서 조건 분기나 비결정적 loop 때문에 interrupt 호출 개수나 순서가 달라지면 곧바로 mismatch가 난다.

실무 규칙으로는 아래 정도가 안전하다.

- 같은 node 안에서는 interrupt 호출 순서를 항상 고정한다
- validation loop 때문에 interrupt를 반복 호출하지 않는다
- 동적으로 여러 승인을 받아야 하면 branch fan-out 후 branch별 interrupt로 나눈다

## 자주 겪는 함정

### 1. 여러 승인 결과를 리스트 순서로 다시 붙인다

가장 흔한 실수다.

```python
# 위험한 방식
Command(
    resume=[
        {"approved": True},
        {"approved": False},
    ]
)
```

병렬 branch의 interrupt는 완료 순서나 UI 정렬 순서에 영향을 받을 수 있다.  
공식 문서처럼 `interrupt_id` 기준 `dict`로 매핑하는 편이 맞다.

### 2. 재개할 때 다른 `thread_id`를 쓴다

interrupt는 checkpointer에 저장된 checkpoint를 기준으로 이어지므로, 재개 시에도 반드시 같은 `thread_id`를 써야 한다.

### 3. interrupt 전에 부작용을 실행한다

node는 재개 시 처음부터 다시 실행된다.  
따라서 `interrupt()` 앞에 메일 발송, 결제 요청, Slack 전송 같은 부작용을 두면 중복 실행될 수 있다.

### 4. `stream.output`을 끝까지 소비하지 않고 `stream.interrupts`만 바로 읽는다

공식 예제처럼 run을 끝까지 drive해야 interrupt projection이 안정적으로 채워진다.  
보통 `_ = stream.output` 한 줄로 마무리하는 이유가 여기에 있다.

## 정리

병렬 interrupt의 핵심은 "재개 값을 순서가 아니라 ID에 붙인다"는 한 문장으로 요약된다.

- 병렬 branch가 동시에 멈추면 `stream.interrupts`에서 pending interrupt를 모은다
- 각 `Interrupt.id`를 키로 `resume_map`을 만든다
- `Command(resume=resume_map)`으로 한 번에 재개한다
- 같은 node 안의 다중 interrupt는 여전히 순서 기반이라는 점을 구분한다

단일 승인 패턴을 이미 써 봤다면, 다음 단계는 대부분 이 패턴이다.  
fan-out된 human-in-the-loop workflow를 붙일 때 순서 꼬임을 막는 가장 실용적인 기준선이기도 하다.

## References

- [LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph Event streaming](https://docs.langchain.com/oss/python/langgraph/event-streaming)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
