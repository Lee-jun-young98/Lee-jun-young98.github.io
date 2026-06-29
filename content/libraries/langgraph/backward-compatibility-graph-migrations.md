---
title: "LangGraph backward compatibility로 in-flight thread 안 깨고 그래프 변경하기"
description: "LangGraph에서 graph migrations, checkpointer, thread state versioning을 이용해 기존 checkpoint를 깨지 않고 노드, edge, state를 변경하는 실전 패턴 정리"
date: 2026-06-29
tags:
  - langgraph
  - production
  - workflow
  - python
aliases:
  - "/blog/langgraph-backward-compatibility-graph-migrations"
---

# LangGraph backward compatibility로 in-flight thread 안 깨고 그래프 변경하기

LangGraph를 운영에 붙이고 나면 금방 이런 순간이 온다.

- `interrupt()`로 멈춘 thread가 아직 남아 있는데 노드 이름을 바꾸고 싶다.
- 새 정책 체크 단계를 넣고 싶은데 이미 진행 중인 thread까지 강제로 새 경로를 타게 하면 안 된다.
- state에 새 키를 넣고 싶은데 기존 checkpoint가 그대로 살아 있어야 한다.

이때 중요한 점이 하나 있다.  
LangGraph는 "예전에 시작한 run은 예전 코드에 묶인다"는 식으로 동작하지 않는다. 공식 문서 기준으로 LangGraph는 최신 배포 그래프를 새 thread와 기존 thread 재개에 모두 바로 적용한다.  
즉 그래프 코드 변경은 사실상 "기존 checkpoint를 상대로 한 backward-compatible API 변경"으로 봐야 한다.

이 글에서는 실무에서 바로 필요한 기준만 정리한다.

- 어떤 graph 변경이 기본적으로 안전한지
- 새 state 필드는 어떻게 추가해야 하는지
- business rule 변경은 왜 `flow_version`으로 분기해야 하는지
- 왜 paused thread가 남아 있을 때 노드 rename/remove가 위험한지
- 배포 전에 무엇을 확인하면 되는지

## 먼저 공식 문서 기준 안전 범위를 짧게 잡자

2026-06-29 기준 LangGraph 공식 Graph API / backward compatibility 문서를 합치면 핵심 규칙은 이렇다.

- 이미 끝난 thread에는 그래프 topology를 어떻게 바꿔도 상관없다.
- 아직 interrupted 상태인 thread에는 대부분의 edge 변경이 안전하다.
- 다만 paused thread가 진입하려는 노드를 rename/remove 하면 재개가 깨질 수 있다.
- state key 추가/제거는 기본적으로 호환되지만, key rename은 기존 saved state를 잃는다.
- state type을 더 빡빡하게 바꾸거나 새 required 필드를 넣으면 기존 checkpoint가 새 schema를 못 만족할 수 있다.

즉 실무 판단은 대체로 아래 순서로 하면 된다.

1. 이 thread들이 이미 끝났는가
2. 아직 살아 있다면 어떤 node에서 멈춰 있는가
3. 이번 변경이 edge 수준인가, node 이름 수준인가, state schema 수준인가

## 언제 이 패턴이 꼭 필요한가

아래 상황이면 backward compatibility를 별도 설계해야 한다.

- human approval, review queue, long-running job처럼 며칠 뒤 재개되는 thread가 있다.
- checkpointer를 붙여 short-term memory나 durable execution을 쓰고 있다.
- 운영 중인 graph에 새 node, 새 state, 새 policy branch를 넣으려 한다.
- time travel이나 replay를 자주 써서 checkpoint를 오래 보관한다.

반대로 checkpointer 없이 매번 새 graph만 실행한다면 이 글의 중요도는 훨씬 낮다.

## 사전 준비

예제는 Python 3.10+에서 `langgraph`만 있으면 된다.

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

## 1. 새 state 필드는 `NotRequired`로 추가하는 쪽이 가장 안전하다

가장 흔한 변경은 state에 새 필드를 추가하는 것이다.  
예를 들어 기존 support workflow에 `summary`를 뒤늦게 넣고 싶을 수 있다.

공식 backward compatibility 문서 기준으로 이런 필드는 `NotRequired` 또는 `Optional[...] = None` 형태로 추가하는 것이 안전하다.  
그래야 예전 checkpoint에 그 키가 없어도 새 코드가 그대로 로드된다.

```python
from typing_extensions import NotRequired, TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


class TicketState(TypedDict):
    request: str
    triage: str
    summary: NotRequired[str]


def classify(state: TicketState):
    request = state["request"].lower()
    triage = "billing" if "refund" in request else "general"
    return {"triage": triage}


def summarize(state: TicketState):
    return {"summary": f"{state['triage']} issue"}


builder = StateGraph(TicketState)
builder.add_node("classify", classify)
builder.add_node("summarize", summarize)
builder.add_edge(START, "classify")
builder.add_edge("classify", "summarize")
builder.add_edge("summarize", END)

graph = builder.compile(checkpointer=InMemorySaver())

result = graph.invoke(
    {"request": "Need refund for duplicate charge", "triage": ""},
    config={"configurable": {"thread_id": "ticket-1"}},
)

print(result)
```

중요한 포인트는 입력에 `summary`를 넣지 않아도 graph가 정상 동작한다는 점이다.  
기존 checkpoint도 같은 방식으로 읽힌다.

반대로 아래처럼 바로 required 필드로 만들면 기존 checkpoint가 깨질 수 있다.

```python
class TicketState(TypedDict):
    request: str
    triage: str
    summary: str
```

예전 thread에는 `summary`가 저장돼 있지 않을 수 있기 때문이다.

## 2. edge 변경은 대체로 안전하지만 business logic 변경은 version flag가 필요하다

공식 문서에서 특히 중요한 구분이 있다.

- technical compatibility: 실행은 되지만
- business compatibility: 기존 thread에 새 정책을 적용하면 안 될 수 있다

예를 들어 기존 flow가 아래였다고 하자.

- `intake -> triage -> respond`

그런데 새 배포에서 `policy_check`를 `triage` 뒤에 넣고 싶다.  
새 thread는 이 경로를 타야 하지만, 이미 `triage`를 지난 오래된 thread까지 갑자기 새 정책 검사를 타게 만들면 제품 동작이 바뀐다.

이때는 state 시작점에서 version을 찍고 conditional edge로 분기하는 쪽이 가장 안전하다.

```python
from typing_extensions import NotRequired, TypedDict

from langgraph.graph import END, START, StateGraph


class FlowState(TypedDict):
    request: str
    flow_version: NotRequired[int]
    triage: NotRequired[str]
    response: NotRequired[str]


def intake(state: FlowState):
    return {"flow_version": state.get("flow_version", 2)}


def triage(state: FlowState):
    category = "refund" if "refund" in state["request"].lower() else "general"
    return {"triage": category}


def policy_check(state: FlowState):
    return {}


def respond(state: FlowState):
    return {"response": f"handled as {state['triage']}"}


def after_triage(state: FlowState):
    if state.get("flow_version", 1) >= 2:
        return "policy_check"
    return "respond"


builder = StateGraph(FlowState)
builder.add_node("intake", intake)
builder.add_node("triage", triage)
builder.add_node("policy_check", policy_check)
builder.add_node("respond", respond)
builder.add_edge(START, "intake")
builder.add_edge("intake", "triage")
builder.add_conditional_edges("triage", after_triage, ["policy_check", "respond"])
builder.add_edge("policy_check", "respond")
builder.add_edge("respond", END)

graph = builder.compile()
```

이 패턴의 핵심은 단순하다.

- 새 thread는 `intake`에서 `flow_version=2`를 받는다.
- 예전 thread는 checkpoint에 version이 없으므로 `state.get("flow_version", 1)`로 이전 경로를 유지한다.

즉 edge 변경 자체보다 "기존 thread의 의미를 바꿔도 되는가"를 먼저 따져야 한다.

## 3. paused thread가 남아 있을 때 node rename은 가장 위험한 변경이다

공식 문서에서 가장 직접적으로 경고하는 항목이 이것이다.  
thread가 pause된 시점에 진입할 node 이름이 checkpoint에 남아 있는데, 새 코드에서 그 node를 rename/remove 하면 재개할 entry point를 잃는다.

아래 예제는 그 상황을 의도적으로 재현한다.

### v1: `review_request`에서 interrupt

```python
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt


class ApprovalState(TypedDict):
    request: str
    approved: bool


checkpointer = InMemorySaver()


def draft(state: ApprovalState):
    return {}


def review_request(state: ApprovalState):
    approved = interrupt({"kind": "approval", "request": state["request"]})
    return {"approved": bool(approved)}


builder_v1 = StateGraph(ApprovalState)
builder_v1.add_node("draft", draft)
builder_v1.add_node("review_request", review_request)
builder_v1.add_edge(START, "draft")
builder_v1.add_edge("draft", "review_request")
builder_v1.add_edge("review_request", END)
graph_v1 = builder_v1.compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": "approval-1"}}

paused = graph_v1.invoke(
    {"request": "refund $20", "approved": False},
    config=config,
)
print(paused)
```

여기까지 실행하면 thread는 `review_request` 부근에서 멈춰 있다.

### v2: 같은 의미지만 node 이름을 `approval_gate`로 바꿈

```python
def approval_gate(state: ApprovalState):
    approved = interrupt({"kind": "approval", "request": state["request"]})
    return {"approved": bool(approved)}


builder_v2 = StateGraph(ApprovalState)
builder_v2.add_node("draft", draft)
builder_v2.add_node("approval_gate", approval_gate)
builder_v2.add_edge(START, "draft")
builder_v2.add_edge("draft", "approval_gate")
builder_v2.add_edge("approval_gate", END)
graph_v2 = builder_v2.compile(checkpointer=checkpointer)

# same thread_id, same checkpoint, but different node name
graph_v2.invoke(Command(resume=True), config=config)
```

이 코드는 "똑같은 thread를 새 코드로 재개한다"는 실전 상황을 축약한 것이다.  
공식 문서 기준으로 이런 rename/remove는 interrupted thread를 깨뜨릴 수 있다.

그래서 node rename은 보통 아래처럼 처리하는 편이 안전하다.

1. 새 node를 추가한다.
2. 한동안 old node도 그대로 둔다.
3. active thread가 모두 빠졌는지 확인한다.
4. 그 뒤 old node를 제거한다.

## 4. state key rename도 add-then-remove로 가져가는 편이 낫다

공식 Graph migrations 요약 기준으로 state key 추가/제거는 대체로 호환되지만, rename은 기존 thread의 saved state를 잃는다.  
그래서 `customer_tier`를 `account_tier`로 한 번에 바꾸기보다 deprecation window를 두는 편이 안전하다.

```python
from typing_extensions import NotRequired, TypedDict


class UserState(TypedDict):
    customer_tier: NotRequired[str]
    account_tier: NotRequired[str]


def normalize_tier(state: UserState):
    tier = state.get("account_tier") or state.get("customer_tier") or "free"
    return {
        "customer_tier": tier,
        "account_tier": tier,
    }
```

이렇게 해 두면 과거 checkpoint는 `customer_tier`로 들어와도 읽히고, 새 코드와 새 thread는 `account_tier`를 기준으로 움직일 수 있다.  
모든 in-flight thread가 drain된 뒤에야 `customer_tier`를 제거하는 식이다.

## 5. 배포 전에 in-flight thread를 어떻게 확인할까

공식 backward compatibility 문서는 "제거 전에는 실제로 아직 그 node나 field를 쓰는 thread가 남아 있는지 확인하라"고 권장한다.

확인 포인트는 크게 두 가지다.

- 특정 `thread_id`를 알고 있으면 `graph.get_state(config)`와 `graph.get_state_history(config)`로 현재 위치와 checkpoint 이력을 본다.
- LangSmith / Agent Server를 쓰고 있으면 `idle`, `busy`, `interrupted`, `error` 상태로 thread를 필터링해 남은 thread를 먼저 확인한다.

즉 운영 절차로 바꾸면 대략 이렇게 된다.

1. rename/remove 대상 node를 정한다.
2. 아직 `interrupted`거나 `busy`인 thread가 남아 있는지 본다.
3. tracing이나 thread 조회에서 더 이상 그 node 진입 흔적이 없을 때 제거한다.

## 자주 생기는 함정

### 1. edge를 바꾸는 것과 node 이름을 바꾸는 것을 같은 위험도로 본다

공식 문서 기준으로 edge topology 자체는 checkpoint에 저장되지 않는다.  
그래서 interrupted thread에서도 edge 추가/삭제/재배선은 대체로 안전하다.

진짜 위험한 것은 paused thread가 기대하는 node 이름을 없애는 일이다.

### 2. 새 required state 필드를 바로 넣는다

새 키는 `NotRequired`로 한 번 들어가는 쪽이 안전하다.  
특히 오래 살아 있는 approval thread가 있으면 이 차이가 바로 난다.

### 3. business rule 변경을 technical change로만 본다

실행이 된다고 해서 맞는 변경은 아니다.  
기존 thread가 원래 정책을 따라야 한다면 `flow_version`처럼 state에 버전을 찍고 분기해야 한다.

### 4. state rename을 "어차피 값 이름만 바꾸는 것"으로 가볍게 본다

rename은 add/remove와 다르다.  
기존 checkpoint 안에 저장된 옛 key를 새 코드가 더 이상 안 읽으면 값이 사실상 사라진다.

### 5. Functional API의 `@task` / `interrupt()` 순서를 중간에 바꾼다

공식 backward compatibility 문서 기준으로 non-determinism 문제는 Functional API에 특히 민감하다.  
`@task` 호출이나 `interrupt()` 호출 순서를 resume 지점 앞에서 바꾸면 cached result 매칭이 어긋날 수 있다.

이 글은 Graph API 중심이지만, Functional API entrypoint를 운영 중이라면 이 규칙을 별도로 더 엄격하게 봐야 한다.

## 실무 체크리스트

1. paused thread가 남아 있는 동안에는 node rename/remove를 피한다.
2. 새 state 필드는 `NotRequired` 또는 optional default로 먼저 추가한다.
3. state rename은 old+new key를 함께 유지하는 deprecation window로 처리한다.
4. 새 정책 분기는 state version flag와 conditional edge로 제어한다.
5. 제거 전에 `graph.get_state(...)`, `get_state_history(...)`, tracing, thread status로 실제 사용 여부를 확인한다.

## 마무리

LangGraph 운영에서 backward compatibility는 부가 고려사항이 아니라 checkpointer를 쓰는 순간 바로 생기는 설계 문제다.

- 실행만 안 깨지면 되는가: technical compatibility
- 기존 thread 의미도 보존해야 하는가: business compatibility
- resume replay 순서까지 영향을 받는가: Functional API determinism

실무에서는 결국 아래 한 줄로 요약된다.

"새 코드는 항상 예전 checkpoint를 다시 읽는다."

이 전제를 놓치지 않으면, node rename 시점과 state schema 변경 순서를 훨씬 보수적으로 잡게 되고 실제 운영 사고도 많이 줄어든다.

## 참고 자료

- [LangGraph Backward compatibility](https://docs.langchain.com/oss/python/langgraph/backward-compatibility)
- [LangGraph Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph Time travel](https://docs.langchain.com/oss/python/langgraph/use-time-travel)
