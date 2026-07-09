---
title: "LangGraph PostgresSaver로 durable checkpointer 운영하기"
description: "LangGraph에서 PostgresSaver를 붙여 thread 상태를 저장하고 interrupt, 재시작 복구, 멀티턴 메모리를 운영 환경에서 다루는 실전 패턴 정리"
date: 2026-07-09
tags:
  - langgraph
  - persistence
  - postgres
  - python
aliases:
  - "/blog/langgraph-postgres-checkpointer-production"
---

# LangGraph PostgresSaver로 durable checkpointer 운영하기

LangGraph를 로컬에서 처음 써볼 때는 `InMemorySaver()`만으로도 충분하다.
하지만 실제 서비스에서는 프로세스 재시작 뒤에도 같은 `thread_id`를 이어 받아야 하고, `interrupt()`로 멈춘 승인 흐름이나 멀티턴 대화를 잃어버리면 안 된다.

이때 가장 먼저 검토할 선택지가 `PostgresSaver`다.

이 글에서는 다음만 실무 기준으로 정리한다.

- 왜 `InMemorySaver` 대신 `PostgresSaver`를 붙이는지
- 처음 한 번 필요한 `checkpointer.setup()`
- 같은 `thread_id`로 상태를 이어서 실행하는 최소 예제
- `interrupt()`와 함께 쓸 때의 장점
- 운영에서 자주 막히는 함정

공식 문서 기준으로 LangGraph checkpointer는 thread 단위 체크포인트를 저장해서 human-in-the-loop, 메모리, time travel, fault tolerance를 가능하게 한다. 또한 production에서는 메모리 saver 대신 DB-backed checkpointer를 쓰는 것을 권장한다.

## 언제 `PostgresSaver`가 필요한가

아래 중 하나라도 해당하면 `InMemorySaver`보다 `PostgresSaver` 쪽이 맞다.

- 서버 재시작 뒤에도 같은 workflow를 이어서 실행해야 한다
- `interrupt()`로 사람 승인 대기 상태를 안정적으로 보존해야 한다
- 대화형 agent에서 같은 `thread_id`로 멀티턴 상태를 계속 쌓아야 한다
- 실패 후 replay, state inspection, 운영 디버깅이 필요하다

반대로 노트북 실험이나 짧은 로컬 데모처럼 프로세스 생명주기 안에서만 실행한다면 `InMemorySaver()`로도 충분하다.

## 사전 준비

공식 메모리 문서 기준으로 Python에서는 `langgraph-checkpoint-postgres`와 `psycopg[binary,pool]`를 함께 설치한다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langgraph langgraph-checkpoint-postgres "psycopg[binary,pool]"
```

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langgraph langgraph-checkpoint-postgres "psycopg[binary,pool]"
```

로컬 Postgres가 없다면 Docker로 바로 띄워도 된다.

```powershell
docker run --name langgraph-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=postgres `
  -e POSTGRES_DB=postgres `
  -p 5442:5432 `
  -d postgres:17
```

연결 문자열 예시는 공식 문서와 같은 형태를 쓰면 된다.

```text
postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable
```

## 1. 가장 작은 durable checkpointer 예제

아래 예제는 `MessagesState` 기반 그래프에 `PostgresSaver`를 붙여 같은 `thread_id`로 멀티턴 대화를 이어가는 가장 작은 패턴이다.

```python
from langchain.chat_models import init_chat_model
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import MessagesState, START, StateGraph

DB_URI = "postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable"

model = init_chat_model("openai:gpt-5.1-mini")


def call_model(state: MessagesState):
    response = model.invoke(state["messages"])
    return {"messages": response}


builder = StateGraph(MessagesState)
builder.add_node("call_model", call_model)
builder.add_edge(START, "call_model")

with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    # 최초 1회만 필요하다.
    checkpointer.setup()

    graph = builder.compile(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": "chat-user-42"}}

    first = graph.invoke(
        {"messages": [{"role": "user", "content": "내 이름은 Junyoung이야"}]},
        config=config,
    )
    print(first["messages"][-1].content)

    second = graph.invoke(
        {"messages": [{"role": "user", "content": "내 이름을 기억해?"}]},
        config=config,
    )
    print(second["messages"][-1].content)
```

핵심은 네 가지다.

- `compile(checkpointer=checkpointer)`로 DB-backed persistence를 붙인다
- `checkpointer.setup()`은 Postgres 스키마 초기화 용도로 최초 1회 필요하다
- `configurable.thread_id`가 같은 실행 흐름의 키가 된다
- 두 번째 호출에서도 같은 `thread_id`를 써야 첫 호출의 상태를 이어받는다

## 2. 왜 `thread_id`가 더 중요해지는가

메모리 saver에서는 프로세스가 살아 있는 동안만 상태가 남으니 `thread_id`의 중요성을 체감하지 못할 때가 있다.
하지만 PostgresSaver를 붙이면 `thread_id`가 사실상 "복구 가능한 대화/작업 ID"가 된다.

- 같은 `thread_id`: 기존 체크포인트를 읽고 이어서 실행
- 다른 `thread_id`: 완전히 새로운 thread로 시작

실무에서는 보통 아래 중 하나로 고정한다.

- 채팅 세션 ID
- 승인 요청 ID
- 백그라운드 잡 ID
- 사용자 ID와 워크플로우 ID를 합친 복합 키

중요한 점은 "사용자가 다시 들어왔을 때 어떤 실행을 이어야 하는가"가 애플리케이션 계층에서 명확해야 한다는 것이다.

## 3. `interrupt()`와 함께 쓰면 왜 실전성이 올라가는가

공식 interrupt 문서 기준으로 `interrupt()`는 checkpointer가 있어야 동작한다. 또한 재개 시에는 같은 `thread_id`로 `Command(resume=...)`를 다시 보내야 한다.

즉 `PostgresSaver`는 단순 대화 메모리뿐 아니라 승인 대기 같은 사람 개입 흐름을 프로세스 재시작 너머로 보존할 수 있게 해 준다.

```python
from typing import Literal
from typing_extensions import TypedDict

from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

DB_URI = "postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable"


class ApprovalState(TypedDict):
    draft: str
    approved: bool
    status: str


def write_draft(state: ApprovalState):
    return {"draft": "배포 공지 초안", "status": "awaiting_review"}


def review(
    state: ApprovalState,
) -> Command[Literal["send_notice", "stop_notice"]]:
    decision = interrupt(
        {
            "kind": "approval",
            "question": "이 공지를 발송할까요?",
            "draft": state["draft"],
        }
    )

    approved = bool(decision.get("approved", False))
    if approved:
        return Command(
            update={"approved": True, "status": "approved"},
            goto="send_notice",
        )

    return Command(
        update={"approved": False, "status": "rejected"},
        goto="stop_notice",
    )


def send_notice(state: ApprovalState):
    return {"status": "sent"}


def stop_notice(state: ApprovalState):
    return {"status": "stopped"}


builder = StateGraph(ApprovalState)
builder.add_node("write_draft", write_draft)
builder.add_node("review", review)
builder.add_node("send_notice", send_notice)
builder.add_node("stop_notice", stop_notice)
builder.add_edge(START, "write_draft")
builder.add_edge("write_draft", "review")
builder.add_edge("send_notice", END)
builder.add_edge("stop_notice", END)

with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    graph = builder.compile(checkpointer=checkpointer)
    config = {"configurable": {"thread_id": "approval-2026-07-09-001"}}

    first = graph.invoke(
        {"draft": "", "approved": False, "status": ""},
        config=config,
    )
    print(first["__interrupt__"][0].value)

    resumed = graph.invoke(
        Command(resume={"approved": True}),
        config=config,
    )
    print(resumed)
```

이 흐름의 장점은 승인 요청을 받은 뒤 애플리케이션 프로세스가 내려가더라도, 다시 살아났을 때 같은 `thread_id`로 안전하게 재개할 수 있다는 점이다.

## 4. 운영에서 유용한 점

### 4-1. 상태 조회와 디버깅이 쉬워진다

checkpointer 문서 기준으로 LangGraph는 thread 상태 조회와 state history 조회를 지원한다.
운영 이슈가 생겼을 때 "지금 어떤 노드까지 갔는지", "어느 시점에 값이 바뀌었는지"를 확인할 수 있다는 점이 크다.

```python
snapshot = graph.get_state(config)
print(snapshot.values)

history = list(graph.get_state_history(config))
print(len(history))
```

### 4-2. time travel과 replay 기반 복구가 가능해진다

DB-backed checkpointer가 있으면 특정 checkpoint에서 되짚어 다시 실행하는 흐름이 가능하다.
실패한 production thread를 로컬에서 같은 상태로 재현하는 데 특히 유용하다.

### 4-3. 멀티 인스턴스 환경에서 메모리 손실 위험이 줄어든다

웹 서버가 여러 대이거나 재배포가 잦으면 메모리 saver는 사실상 사용할 수 없다.
PostgresSaver는 상태를 프로세스 바깥으로 빼기 때문에 worker 교체와 재시작에 훨씬 강하다.

## 자주 생기는 함정

### 1. `checkpointer.setup()`을 빼먹고 바로 실행한다

공식 문서 기준으로 Postgres checkpointer를 처음 쓸 때는 `setup()`이 필요하다.
초기 스키마 준비 전에는 테이블이 없어 바로 에러가 날 수 있다.

운영에서는 보통 아래 둘 중 하나로 처리한다.

- 배포 시 마이그레이션 단계에서 한 번 실행
- 앱 시작 시 idempotent하게 최초 한 번 실행

### 2. 재개 요청에서 `thread_id`를 바꿔 버린다

이 경우 resume가 아니라 새 thread를 시작한 것처럼 동작한다.
승인 API, 채팅 API, 백그라운드 잡 재개 API가 모두 같은 thread 키 규칙을 공유해야 한다.

### 3. `InMemorySaver`와 같은 기대를 가진다

PostgresSaver를 붙였다고 해서 모든 값이 자동으로 "사용자 장기 메모리"가 되는 것은 아니다.
checkpointer는 thread 범위 상태 저장이고, 사용자 선호나 여러 thread에 걸친 사실 저장은 `store`가 담당한다.

즉 아래처럼 역할을 나눠 생각하는 편이 맞다.

- checkpointer: 현재 실행 중인 thread 상태
- store: thread를 넘어가는 장기 메모리

### 4. `interrupt()` 앞의 부작용을 멱등하게 만들지 않는다

interrupt 문서 기준으로 재개 시 노드는 처음부터 다시 시작된다.
그래서 `interrupt()` 전에 메일 전송, 슬랙 알림, DB 쓰기 같은 작업을 넣으면 재개 시 중복 실행될 수 있다.

### 5. Agent Server에서도 직접 saver를 또 붙이려 한다

공식 checkpointer 문서에는 Agent Server가 checkpointing을 자동 처리한다고 명시돼 있다.
즉 self-hosted Python graph를 직접 실행할 때와 Agent Server에 배포할 때의 운영 방식은 구분해서 봐야 한다.

## 추천 운영 패턴

개인적으로는 아래 순서가 가장 덜 꼬인다.

1. 로컬에서는 `InMemorySaver()`로 흐름을 먼저 검증한다
2. 운영 연결 전 `PostgresSaver`로 바꾸고 같은 `thread_id` 정책을 정한다
3. `setup()`을 배포 초기화 단계로 분리한다
4. 승인, 재개, 멀티턴 대화 API가 모두 같은 `thread_id`를 사용하게 맞춘다
5. 장기 메모리가 필요하면 checkpointer와 별도로 `store`를 추가한다

## 마무리

`PostgresSaver`는 LangGraph에서 단순히 saver 구현 하나를 바꾸는 수준이 아니다.
thread를 복구 가능한 단위로 만들고, `interrupt()`와 멀티턴 대화를 운영 환경에서 버틸 수 있게 만드는 핵심 인프라에 가깝다.

요약하면 아래만 기억하면 된다.

- 로컬 실험은 `InMemorySaver()`
- 운영 persistence는 `PostgresSaver`
- 최초 1회 `checkpointer.setup()`
- 재개와 메모리 연속성의 핵심은 같은 `thread_id`
- thread 밖 장기 메모리는 `store`로 분리

## 참고 자료

- [LangGraph Memory](https://docs.langchain.com/oss/python/langgraph/add-memory)
- [LangGraph Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers)
- [LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph Checkpointer Integrations](https://docs.langchain.com/oss/python/integrations/checkpointers)
