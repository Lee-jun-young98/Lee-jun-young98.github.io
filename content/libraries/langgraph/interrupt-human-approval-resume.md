---
title: "LangGraph interrupt()로 사람 승인 대기 후 Command(resume=...)로 재개하기"
description: "LangGraph Graph API에서 interrupt, checkpointer, thread_id, Command(resume=...)를 묶어 human-in-the-loop 승인 단계를 만드는 실전 패턴 정리"
date: 2026-06-03
tags:
  - langgraph
  - agent
  - workflow
  - python
aliases:
  - "/blog/langgraph-interrupt-human-approval-resume"
---

# LangGraph interrupt()로 사람 승인 대기 후 Command(resume=...)로 재개하기

LangGraph를 쓰다 보면 "모델이 초안을 만들고, 실제 발송 전에는 사람이 한 번 승인한다" 같은 단계가 자주 필요하다.

이때 단순한 `input()`이나 별도 큐를 붙이기보다, LangGraph의 `interrupt()`와 `Command(resume=...)`를 쓰면 그래프 실행을 정확한 지점에서 멈추고 나중에 같은 상태로 이어서 실행할 수 있다.

이 글에서는 다음만 실무 관점에서 정리한다.

- `interrupt()`가 언제 적합한지
- checkpointer와 `thread_id`가 왜 같이 필요한지
- 승인/반려를 받아 다시 실행하는 최소 예제
- 재개 시 자주 생기는 함정

## 언제 `interrupt()`를 쓰면 좋은가

공식 문서 기준으로 `interrupt()`는 그래프를 멈추고 외부 입력을 기다려야 할 때 쓰는 기능이다. 대표적으로 아래 상황이 맞는다.

- 결제, 메일 발송, DB 변경처럼 실행 전 사람이 승인해야 하는 작업
- LLM이 만든 요약이나 답변을 사람이 수정한 뒤 계속 진행해야 하는 작업
- long-running workflow를 잠시 멈추고 나중에 같은 상태에서 이어가야 하는 작업

반대로 "조건만 보고 다음 노드를 고른다" 수준이면 `add_conditional_edges(...)`나 `Command(goto=...)`만으로 충분하다. 사람 입력이 실제로 필요할 때만 `interrupt()`를 쓰는 편이 구조가 깔끔하다.

## 사전 준비

`interrupt()`는 persistence 계층이 있어야 동작하므로 checkpointer 없이 쓰면 안 된다. 로컬 실험은 `InMemorySaver`로 충분하고, 운영에서는 SQLite/Postgres 같은 지속성 checkpointer를 쓰는 편이 맞다.

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

## 1. 가장 작은 승인 workflow

아래 예제는 초안 메시지를 만들고, 발송 전에 `interrupt()`로 승인 여부를 물어본 다음, 승인되면 `send_email`, 반려되면 `revise_draft`로 간다.

```python
from typing import Literal
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt


class ApprovalState(TypedDict):
    recipient: str
    draft: str
    approved: bool
    review_note: str
    status: str


def write_draft(state: ApprovalState):
    return {
        "draft": f"{state['recipient']}님, 내일 오전 배포 일정 공유드립니다.",
        "status": "draft_ready",
    }


def review_draft(
    state: ApprovalState,
) -> Command[Literal["send_email", "revise_draft"]]:
    decision = interrupt(
        {
            "kind": "approval",
            "question": "이 메일을 발송할까요?",
            "draft": state["draft"],
            "recipient": state["recipient"],
        }
    )

    approved = bool(decision.get("approved", False))
    note = decision.get("note", "")

    if approved:
        return Command(
            update={
                "approved": True,
                "review_note": note,
                "status": "approved",
            },
            goto="send_email",
        )

    return Command(
        update={
            "approved": False,
            "review_note": note,
            "status": "needs_revision",
        },
        goto="revise_draft",
    )


def send_email(state: ApprovalState):
    return {
        "status": f"sent_to_{state['recipient']}",
    }


def revise_draft(state: ApprovalState):
    revision_note = state["review_note"] or "톤을 더 부드럽게 조정"
    return {
        "draft": state["draft"] + f"\n\n수정 반영: {revision_note}",
        "status": "revised",
    }


builder = StateGraph(ApprovalState)
builder.add_node("write_draft", write_draft)
builder.add_node("review_draft", review_draft)
builder.add_node("send_email", send_email)
builder.add_node("revise_draft", revise_draft)
builder.add_edge(START, "write_draft")
builder.add_edge("write_draft", "review_draft")
builder.add_edge("send_email", END)
builder.add_edge("revise_draft", END)

graph = builder.compile(checkpointer=InMemorySaver())

config = {"configurable": {"thread_id": "approval-demo-1"}}

# 1) 첫 실행: review_draft에서 멈춘다.
first = graph.invoke(
    {
        "recipient": "ops-team",
        "draft": "",
        "approved": False,
        "review_note": "",
        "status": "",
    },
    config=config,
)

print(first["__interrupt__"])

# 2) 같은 thread_id로 재개: 사람 응답이 interrupt()의 반환값이 된다.
second = graph.invoke(
    Command(
        resume={
            "approved": True,
            "note": "문구 확인 완료",
        }
    ),
    config=config,
)

print(second)
```

핵심은 세 가지다.

- `compile(checkpointer=...)`로 persistence를 붙인다.
- `configurable.thread_id`로 "어느 실행을 이어갈지" 지정한다.
- 재개할 때는 같은 `thread_id`로 `Command(resume=...)`를 넘긴다.

## 2. 실행 흐름을 어떻게 이해하면 편한가

위 예제를 실행하면 흐름은 아래처럼 본다.

1. `write_draft`가 상태를 채운다.
2. `review_draft`가 `interrupt(...)`를 호출한다.
3. LangGraph가 현재 상태를 checkpointer에 저장하고 실행을 멈춘다.
4. 호출자는 `__interrupt__`에서 승인 요청 payload를 받는다.
5. 나중에 같은 `thread_id`로 `Command(resume=...)`를 넘기면, 그 값이 `decision = interrupt(...)` 자리로 들어온다.
6. 노드는 `Command(update=..., goto=...)`를 반환하고 그래프가 계속 진행된다.

즉 `interrupt()`는 "값을 기다리는 함수"처럼 보이지만, 실제로는 상태를 저장하고 나갔다가 나중에 같은 노드를 다시 시작하는 제어 장치에 가깝다.

## 3. `thread_id`를 빼먹으면 왜 꼬이는가

공식 문서에서도 `thread_id`를 persistent cursor처럼 다루라고 설명한다. 같은 `thread_id`를 재사용해야 같은 체크포인트를 읽고 이어서 실행할 수 있다.

- 같은 `thread_id`: 이전 interrupt 지점에서 이어짐
- 다른 `thread_id`: 새 실행으로 간주되어 처음부터 시작

실무에서는 보통 아래 값과 1:1로 매핑한다.

- approval request id
- user session id
- job id
- conversation id

중간에 프로세스가 재시작되더라도 같은 실행을 재개하려면 이 식별자가 안정적으로 보존되어야 한다.

## 4. 승인 UI나 API와 연결할 때 최소 패턴

서버에서 LangGraph를 호출할 때는 보통 아래 두 단계로 나눈다.

```python
from langgraph.types import Command


def start_workflow(graph, payload, thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    result = graph.invoke(payload, config=config)

    if "__interrupt__" in result:
        interrupt_info = result["__interrupt__"][0].value
        return {"status": "waiting_approval", "interrupt": interrupt_info}

    return {"status": "completed", "result": result}


def resume_workflow(graph, thread_id: str, approved: bool, note: str = ""):
    config = {"configurable": {"thread_id": thread_id}}
    return graph.invoke(
        Command(
            resume={
                "approved": approved,
                "note": note,
            }
        ),
        config=config,
    )
```

이 구조를 쓰면 API 서버에서는

- 첫 요청에서 interrupt payload를 프론트엔드로 전달하고
- 사람이 승인/반려를 누르면
- 같은 `thread_id`로 `resume_workflow(...)`를 호출하는 식으로 붙이면 된다.

## 5. 자주 생기는 함정

### 5-1. checkpointer 없이 `interrupt()`를 쓰면 안 된다

`interrupt()`는 중단 지점을 저장해야 하므로 persistence가 전제다. 로컬 예제는 `InMemorySaver`로 충분하지만, 서버 재시작 뒤에도 이어가야 하면 메모리 saver만으로는 부족하다.

### 5-2. 재개 시 노드가 처음부터 다시 실행된다

공식 문서에서 가장 중요한 주의점 중 하나다. `interrupt()`가 있던 노드는 재개할 때 그 줄부터 이어지는 것이 아니라 노드 함수 처음부터 다시 시작된다.

그래서 `interrupt()` 앞에서 아래 같은 부작용을 만들면 위험하다.

```python
def bad_review_node(state):
    send_slack_alert("승인 요청 생성")  # 재개 시 다시 실행될 수 있음
    decision = interrupt({"question": "approve?"})
    return {"approved": decision}
```

이런 작업은 idempotent하게 만들거나, 중복 실행되어도 괜찮은 위치로 옮겨야 한다.

### 5-3. `Command(update=...)`를 재개 입력으로 넣으면 안 된다

재개할 때 호출자 쪽에서 넣는 `Command`는 `resume` 용도다. `update`, `goto`, `graph`는 노드 함수가 반환할 때 쓰는 패턴이다.

즉 아래처럼 써야 한다.

```python
graph.invoke(Command(resume={"approved": True}), config=config)
```

아래는 의도와 다르다.

```python
graph.invoke(Command(update={"approved": True}), config=config)
```

### 5-4. interrupt payload는 JSON-serializable 값으로 유지하는 편이 안전하다

문서 기준으로 `interrupt()`에 넘기는 값과 `resume` 값은 JSON-serializable 형태를 유지하는 편이 맞다. 문자열 하나보다 객체 형태로 넘기면 UI와 API 사이 계약을 유지하기 쉽다.

좋은 예:

```python
interrupt(
    {
        "kind": "approval",
        "question": "이 변경을 적용할까요?",
        "draft": "...",
    }
)
```

## 6. 언제 다음 단계로 확장하면 좋은가

이 패턴이 익숙해지면 다음 주제로 자연스럽게 이어진다.

- 여러 승인 지점을 다루는 multi-interrupt 패턴
- subgraph 안에서 interrupt를 쓰는 패턴
- durable execution과 영속 checkpointer를 붙여 서버 재시작 뒤에도 복구하기
- event streaming으로 UI에 토큰 스트림과 승인 대기 상태를 함께 보여주기

특히 운영 환경에서는 `interrupt()` 하나만 이해하는 것보다, persistence와 durable execution을 같이 보는 편이 훨씬 실전적이다.

## 마무리

LangGraph의 `interrupt()`는 단순한 입력 대기 함수가 아니라, "그래프를 여기서 멈추고 나중에 같은 실행을 이어가겠다"는 workflow 제어 장치다.

- 멈출 지점은 `interrupt()`
- 이어갈 실행은 `thread_id`
- 재개 입력은 `Command(resume=...)`
- 중단 상태 보존은 checkpointer

이 네 가지를 함께 이해하면 승인 단계가 있는 agent/workflow를 훨씬 안정적으로 구성할 수 있다.

## 참고 자료

- [LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph Graph API Overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
