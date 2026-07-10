---
title: "LangGraph interrupt() 검증 루프를 while True 대신 conditional edge로 만들기"
description: "LangGraph에서 interrupt()로 사람 입력을 받을 때 while loop를 피하고 conditional edge로 안전한 validation loop를 만드는 실전 패턴 정리"
date: 2026-07-10
tags:
  - langgraph
  - interrupts
  - human-in-the-loop
  - python
aliases:
  - "/blog/langgraph-interrupt-validation-loop-conditional-edges"
---

# LangGraph interrupt() 검증 루프를 while True 대신 conditional edge로 만들기

LangGraph로 사람 입력을 받는 워크플로를 만들다 보면 이런 요구가 자주 나온다.

- "나이를 받을 때 숫자가 아니면 다시 물어보고 싶다"
- "승인 사유가 비어 있으면 입력 폼을 다시 띄우고 싶다"
- "이메일 주소 형식이 틀리면 같은 단계로 되돌리고 싶다"

이때 Python 감각대로 node 안에서 `while True`와 `interrupt()`를 같이 쓰면 곧바로 꼬이기 쉽다.  
LangGraph 공식 문서는 `interrupt()`가 걸린 node는 resume 시점에 그 줄부터 이어지는 것이 아니라 node 처음부터 다시 실행된다고 설명하고, validation loop는 `interrupt()`를 한 번만 호출하는 node + `add_conditional_edges(...)` 패턴으로 만들라고 권장한다.

이 글에서는 그 차이를 실전 기준으로 정리한다.

- 왜 `while True` + `interrupt()`가 위험한지
- validation loop를 state와 conditional edge로 분리하는 방법
- FastAPI나 UI에서 재개할 때 어떤 payload 계약을 잡아야 하는지
- 자주 터지는 함정과 회피 기준

## 언제 이 패턴이 필요한가

아래처럼 사람 입력을 받을 때 값이 유효하지 않으면 같은 질문을 다시 보여줘야 하는 흐름이면 이 패턴이 맞다.

- 나이, 수량, 금액처럼 형식 검증이 필요한 입력
- 승인/반려 사유처럼 필수 필드가 있는 review form
- 이메일, 전화번호, 날짜처럼 규칙이 명확한 값
- 프론트엔드가 interrupt payload를 그대로 UI로 렌더링하는 구조

반대로 한 번만 승인 여부를 받고 끝나는 단순 `True/False` 승인 흐름이면 기존 `interrupt()` 승인 패턴만으로 충분하다.

## 왜 `while True` + `interrupt()`가 안 맞는가

공식 문서 기준으로 `interrupt()`는 내부적으로 pause를 만들기 위해 특별한 예외를 던지고, resume가 되면 node 함수가 처음부터 다시 실행된다.  
그래서 아래 같은 코드는 얼핏 자연스러워 보여도 구조적으로 좋지 않다.

```python
from langgraph.types import interrupt


def collect_age_bad(state):
    while True:
        answer = interrupt("나이를 입력해 주세요")
        if isinstance(answer, int) and answer > 0:
            return {"age": answer}
```

문제는 두 가지다.

1. 재개할 때마다 node 전체가 다시 실행되므로 loop 본문이 이전 회차까지 통째로 재생된다.
2. 같은 node 안의 여러 `interrupt()` 호출은 순서 기반으로 resume 값이 매칭되므로, loop 횟수가 바뀌면 호출 순서와 개수가 흔들린다.

LangGraph 공식 문서는 이런 패턴을 피하고, 한 번의 node invocation마다 `interrupt()`를 정확히 한 번만 호출하라고 안내한다.

## 권장 구조: 질문 상태를 저장하고 conditional edge로 다시 들어간다

핵심은 단순하다.

1. 현재 질문 문구를 state에 둔다.
2. node 안에서는 `interrupt()`를 한 번만 호출한다.
3. 값이 유효하면 결과를 저장한다.
4. 값이 유효하지 않으면 다음 질문 문구를 state에 저장한다.
5. conditional edge가 같은 node로 되돌린다.

즉 반복을 Python loop가 아니라 graph edge로 표현하는 방식이다.

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

로컬 예제는 메모리 checkpointer면 충분하다.

## 1. 가장 작은 validation loop 예제

아래 예제는 양의 정수 나이를 받을 때까지 같은 node를 다시 호출한다.

```python
from typing import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt


class FormState(TypedDict):
    age: int | None
    pending_question: str | None
    attempts: int


def collect_age(state: FormState):
    question = state.get("pending_question") or "나이를 입력해 주세요"
    answer = interrupt(
        {
            "kind": "collect_age",
            "question": question,
            "attempt": state.get("attempts", 0) + 1,
        }
    )

    attempts = state.get("attempts", 0) + 1

    if isinstance(answer, int) and answer > 0:
        return {
            "age": answer,
            "pending_question": None,
            "attempts": attempts,
        }

    return {
        "age": None,
        "pending_question": f"'{answer}'는 올바른 나이가 아닙니다. 1 이상의 숫자를 넣어 주세요.",
        "attempts": attempts,
    }


def route_after_collect(state: FormState):
    return END if state.get("age") is not None else "collect_age"


builder = StateGraph(FormState)
builder.add_node("collect_age", collect_age)
builder.add_edge(START, "collect_age")
builder.add_conditional_edges("collect_age", route_after_collect)

graph = builder.compile(checkpointer=InMemorySaver())
config = {"configurable": {"thread_id": "form-001"}}

first = graph.invoke(
    {"age": None, "pending_question": None, "attempts": 0},
    config=config,
)
print(first["__interrupt__"][0].value)

second = graph.invoke(Command(resume="열둘"), config=config)
print(second["__interrupt__"][0].value)

third = graph.invoke(Command(resume=12), config=config)
print(third)
```

실행 흐름은 아래처럼 된다.

1. 첫 호출에서 `collect_age`가 interrupt payload를 반환하고 멈춘다.
2. `"열둘"`로 재개하면 검증 실패 후 `pending_question`을 업데이트한다.
3. conditional edge가 다시 `collect_age`로 돌아간다.
4. 다음 invocation에서 `interrupt()`가 새 질문 문구로 한 번만 다시 호출된다.
5. `12`로 재개하면 `END`로 종료된다.

이 구조에서는 resume마다 node가 다시 시작돼도 문제 없다. 매번 `interrupt()` 호출 수가 1회로 고정되기 때문이다.

## 2. 실전형 패턴: form payload를 객체로 고정한다

단순 문자열보다 객체 형태가 보통 더 안전하다. 프론트엔드가 질문 종류, 필수 필드, 에러 메시지를 안정적으로 렌더링할 수 있기 때문이다.

```python
from typing import Literal, TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt


class ReviewState(TypedDict):
    email: str | None
    pending_form: dict | None
    approved: bool | None


def collect_reviewer_email(state: ReviewState):
    form = state.get("pending_form") or {
        "kind": "reviewer_email",
        "title": "검토자 이메일 입력",
        "question": "알림을 받을 이메일 주소를 입력해 주세요.",
        "error": None,
    }
    payload = interrupt(form)

    email = payload.get("email", "").strip() if isinstance(payload, dict) else ""
    if "@" in email and "." in email:
        return {
            "email": email,
            "pending_form": None,
        }

    return {
        "email": None,
        "pending_form": {
            **form,
            "error": f"'{email}'은(는) 올바른 이메일 형식이 아닙니다.",
        },
    }


def route_after_email(state: ReviewState) -> Literal["collect_reviewer_email", "__end__"]:
    return END if state.get("email") else "collect_reviewer_email"


builder = StateGraph(ReviewState)
builder.add_node("collect_reviewer_email", collect_reviewer_email)
builder.add_edge(START, "collect_reviewer_email")
builder.add_conditional_edges("collect_reviewer_email", route_after_email)

graph = builder.compile(checkpointer=InMemorySaver())
config = {"configurable": {"thread_id": "review-form-01"}}

initial = graph.invoke(
    {"email": None, "pending_form": None, "approved": None},
    config=config,
)
print(initial["__interrupt__"][0].value)

retry = graph.invoke(
    Command(resume={"email": "not-an-email"}),
    config=config,
)
print(retry["__interrupt__"][0].value)

done = graph.invoke(
    Command(resume={"email": "reviewer@example.com"}),
    config=config,
)
print(done["email"])
```

이 방식의 장점은 아래와 같다.

- UI가 `kind`, `title`, `question`, `error`를 그대로 렌더링할 수 있다
- 백엔드는 resume payload 계약을 `{"email": ...}`처럼 명확히 잡을 수 있다
- 나중에 같은 패턴을 이름, 전화번호, 승인 사유 입력에도 재사용하기 쉽다

## 3. API 계층에서는 interrupt payload 전달과 resume 입력 제출을 분리한다

서비스에 붙일 때는 보통 아래 두 동작이 분리된다.

1. 첫 호출: graph를 실행하고 `__interrupt__` 또는 `stream.interrupts`를 프론트엔드에 전달
2. 재개 호출: 같은 `thread_id`로 `Command(resume=...)` 제출

예를 들면 이런 형태다.

```python
def start_form(graph, thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    result = graph.invoke(
        {"age": None, "pending_question": None, "attempts": 0},
        config=config,
    )

    if "__interrupt__" in result:
        return {
            "status": "waiting_input",
            "interrupt": result["__interrupt__"][0].value,
        }

    return {"status": "completed", "result": result}


def resume_form(graph, thread_id: str, payload):
    config = {"configurable": {"thread_id": thread_id}}
    result = graph.invoke(Command(resume=payload), config=config)

    if "__interrupt__" in result:
        return {
            "status": "waiting_input",
            "interrupt": result["__interrupt__"][0].value,
        }

    return {"status": "completed", "result": result}
```

중요한 점은 항상 같다.

- 재개할 때도 같은 `thread_id`
- 새 사용자 메시지가 아니라 `Command(resume=...)`
- node 안에서는 매 invocation마다 `interrupt()` 한 번

## 자주 하는 실수

### 1. node 안에서 `while True`로 재질문한다

가장 흔한 실수다.  
문서 기준으로 resume 시 node가 처음부터 재실행되기 때문에 validation loop를 Python loop로 만들면 interrupt 호출 순서가 꼬이거나 재실행 비용이 눈덩이처럼 커질 수 있다.

### 2. bare `try/except`로 `interrupt()`를 감싼다

공식 문서는 `interrupt()`가 pause를 만들기 위해 special exception을 사용한다고 설명한다.  
그래서 아래처럼 쓰면 interrupt가 graph 바깥으로 전달되지 않을 수 있다.

```python
def bad_node(state):
    try:
        answer = interrupt("값을 입력해 주세요")
        return {"answer": answer}
    except Exception:
        return {"answer": None}
```

에러 처리가 필요하면 `interrupt()` 바깥으로 분리하거나, 정말 필요한 구체 예외만 잡는 편이 안전하다.

### 3. 검증 함수나 객체 인스턴스를 interrupt payload에 넣는다

interrupt payload는 JSON-serializable 값으로 유지하는 편이 좋다.  
validator 함수 자체를 payload에 넣지 말고, `"kind": "email"` 같은 식별자와 에러 문자열만 넘기는 쪽이 안전하다.

### 4. 입력 대기 전에 부작용을 먼저 실행한다

resume 시 node 앞부분이 다시 돌기 때문에 `interrupt()` 전에 메일 발송, DB insert, Slack 전송을 해 두면 중복 실행될 수 있다.  
부작용은 되도록 `interrupt()` 뒤나 별도 node로 분리하는 편이 맞다.

### 5. 재개 시 새 입력 dict를 그냥 `graph.invoke({...})`로 넣는다

interrupt 재개는 일반 입력이 아니라 `Command(resume=...)`가 맞다.  
새 dict를 넣으면 기존 interrupted thread를 잇는 것이 아니라 전혀 다른 실행 의미가 섞일 수 있다.

## 언제 다른 패턴을 고를까

- 단순 승인/반려: `interrupt()` 한 번 + `Command(goto=...)`
- 여러 branch의 동시 승인: branch별 interrupt + `interrupt_id -> resume_value` 매핑
- tool 실행 직전 승인: tool 내부 `interrupt()` 또는 LangChain HITL middleware
- 사람 입력 없이 schema 검증만 필요: Pydantic state validation

즉 validation loop는 사람 입력이 여러 번 올 수 있고, 매번 질문 문구를 바꾸며 같은 단계를 반복해야 할 때에만 꺼내면 된다.

## 정리

LangGraph에서 `interrupt()` 검증 루프의 핵심은 반복을 code loop가 아니라 graph edge로 표현하는 점이다.

- node 한 번 실행할 때 `interrupt()`는 한 번만 호출한다
- 질문 문구와 에러 메시지는 state에 저장한다
- 검증 실패 시 conditional edge로 같은 node를 다시 탄다
- resume는 항상 같은 `thread_id` + `Command(resume=...)`

이 기준만 지켜도 사람 입력이 섞인 workflow를 훨씬 안정적으로 운영할 수 있다.

## 참고 자료

- [LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers)
