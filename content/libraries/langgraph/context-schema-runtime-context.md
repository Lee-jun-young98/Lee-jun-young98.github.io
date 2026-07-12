---
title: "LangGraph context_schema와 Runtime[Context]로 요청별 설정 주입하기"
description: "LangGraph Graph API에서 context_schema, Runtime[Context], graph.invoke(..., context=...)를 사용해 모델 선택, 사용자 티어, locale 같은 요청별 설정을 state 밖에서 다루는 실전 패턴 정리"
date: 2026-07-12
tags:
  - langgraph
  - python
  - workflow
  - runtime
aliases:
  - "/blog/langgraph-context-schema-runtime-context"
---

# LangGraph `context_schema`와 `Runtime[Context]`로 요청별 설정 주입하기

LangGraph를 쓰다 보면 state에 넣기 애매한 값이 자주 생깁니다.

- 사용자 티어, 조직 ID, locale 같은 요청별 컨텍스트
- 어떤 모델 provider를 쓸지 같은 실행 시점 설정
- DB 연결, feature flag, system prompt 같은 런타임 의존성

이런 값을 state에 넣어도 돌아가기는 합니다.  
하지만 checkpoint, trace, replay 기준으로 보면 "흐름 상태"와 "이번 실행에서만 필요한 설정"은 분리하는 편이 낫습니다.

LangGraph 공식 문서 기준으로 이럴 때 쓰는 도구가 `context_schema`와 `Runtime[Context]`입니다.

- `StateGraph(..., context_schema=...)`로 런타임 컨텍스트 스키마를 선언하고
- node나 conditional edge에서 `runtime: Runtime[Context]`를 받아 읽고
- `graph.invoke(..., context=...)`로 실행 시점에 값을 주입합니다.

이 글에서는 아래만 실전 기준으로 짧게 정리합니다.

- 언제 state 대신 runtime context를 써야 하는지
- `context_schema` 기본 패턴
- node와 conditional edge에서 함께 쓰는 runnable 예제
- checkpoint, interrupt, replay에서 자주 헷갈리는 포인트

## 언제 유용한가

아래 같은 경우면 거의 바로 쓸 가치가 있습니다.

- 같은 graph를 고객 플랜별로 다르게 라우팅하고 싶을 때
- thread 상태와 무관한 실행 옵션을 요청마다 바꾸고 싶을 때
- checkpointer에는 남기고 싶지 않은 실행별 설정을 분리하고 싶을 때
- node 내부에서 tenant 정보, locale, provider 선택값을 읽고 싶을 때

반대로 값 자체가 workflow의 누적 상태라면 state 쪽이 맞습니다.

- 주문 진행 상태
- 승인 여부
- 이전 step 결과
- 대화 메시지 기록

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

## 1. 가장 작은 패턴: `context_schema` 선언 -> `runtime.context` 읽기

공식 문서의 핵심 패턴은 단순합니다.

1. context 스키마를 `TypedDict`나 dataclass로 만든다
2. `StateGraph(..., context_schema=...)`에 연결한다
3. node에서 `runtime.context`를 읽는다
4. 실행할 때 `context=...`를 넘긴다

```python
from dataclasses import dataclass
from typing import Literal
from typing_extensions import TypedDict

from langgraph.graph import START, END, StateGraph
from langgraph.runtime import Runtime


@dataclass
class RequestContext:
    user_tier: str
    locale: str = "ko"


class TicketState(TypedDict):
    ticket: str
    priority: str
    reply_language: str
    route: str


def inspect_request(state: TicketState, runtime: Runtime[RequestContext]):
    tier = runtime.context.user_tier
    locale = runtime.context.locale

    priority = "high" if tier in {"pro", "enterprise"} else "normal"
    reply_language = "ko" if locale.startswith("ko") else "en"
    route = "priority_queue" if priority == "high" else "standard_queue"

    return {
        "priority": priority,
        "reply_language": reply_language,
        "route": route,
    }


def route_ticket(
    state: TicketState,
    runtime: Runtime[RequestContext],
) -> Literal["priority_queue", "standard_queue"]:
    return state["route"]


def priority_queue(state: TicketState):
    return {"ticket": f"[PRIORITY] {state['ticket']}"}


def standard_queue(state: TicketState):
    return {"ticket": f"[STANDARD] {state['ticket']}"}


builder = StateGraph(TicketState, context_schema=RequestContext)
builder.add_node("inspect_request", inspect_request)
builder.add_node("priority_queue", priority_queue)
builder.add_node("standard_queue", standard_queue)
builder.add_edge(START, "inspect_request")
builder.add_conditional_edges("inspect_request", route_ticket)
builder.add_edge("priority_queue", END)
builder.add_edge("standard_queue", END)

graph = builder.compile()

result_pro = graph.invoke(
    {
        "ticket": "refund request",
        "priority": "",
        "reply_language": "",
        "route": "",
    },
    context=RequestContext(user_tier="pro", locale="ko-KR"),
)

result_free = graph.invoke(
    {
        "ticket": "refund request",
        "priority": "",
        "reply_language": "",
        "route": "",
    },
    context={"user_tier": "free", "locale": "en-US"},
)

print(result_pro)
print(result_free)
```

출력 예시:

```python
{
    "ticket": "[PRIORITY] refund request",
    "priority": "high",
    "reply_language": "ko",
    "route": "priority_queue",
}
{
    "ticket": "[STANDARD] refund request",
    "priority": "normal",
    "reply_language": "en",
    "route": "standard_queue",
}
```

이 예제에서 중요한 점은 세 가지입니다.

- `user_tier`, `locale`는 state가 아니라 runtime context에 있다
- node뿐 아니라 conditional edge도 `runtime`을 받아 쓸 수 있다
- 같은 graph라도 `context=` 값에 따라 동작이 바뀐다

## 2. state에 넣지 말고 context로 빼야 하는 값

실무에서는 아래 기준으로 나누면 크게 틀리지 않습니다.

### state에 두는 값

- 다음 step이 반드시 읽어야 하는 값
- checkpoint에 남아야 하는 값
- replay나 time travel에서 다시 봐야 하는 값
- workflow 결과 그 자체인 값

예시:

- `messages`
- `approval_status`
- `retrieved_docs`
- `final_answer`

### context에 두는 값

- 요청별 실행 옵션
- 사용자/조직 식별자
- 권한, 플랜, locale
- 이번 실행에서만 필요한 provider 선택값

예시:

- `user_id`
- `organization_id`
- `model_provider`
- `system_message`
- `feature_flags`

특히 `thread_id`와 같이 workflow 자체를 식별하는 값은 보통 `config["configurable"]`에 두고,  
사용자/조직/권한처럼 node 로직이 직접 읽어야 하는 값은 `context=`로 주입하는 식으로 역할을 나누면 깔끔합니다.

## 3. 모델 선택도 같은 방식으로 다룬다

공식 문서에는 runtime context로 모델 provider와 system message를 바꾸는 예제가 있습니다.  
실무에서도 이 패턴이 자주 필요합니다.

- 사내 tenant A는 OpenAI
- tenant B는 Anthropic
- premium 플랜만 더 비싼 모델 사용
- 국가별 system prompt 분기

형태는 거의 같습니다.

```python
from dataclasses import dataclass

from langchain.chat_models import init_chat_model
from langgraph.graph import MessagesState, START, END, StateGraph
from langgraph.runtime import Runtime


@dataclass
class ModelContext:
    model_provider: str = "openai"
    system_message: str | None = None


MODELS = {
    "openai": init_chat_model("gpt-4.1-mini"),
    "anthropic": init_chat_model("claude-haiku-4-5-20251001"),
}


def call_model(state: MessagesState, runtime: Runtime[ModelContext]):
    model = MODELS[runtime.context.model_provider]
    messages = state["messages"]
    if runtime.context.system_message:
        messages = [
            {"role": "system", "content": runtime.context.system_message},
            *messages,
        ]
    response = model.invoke(messages)
    return {"messages": [response]}


builder = StateGraph(MessagesState, context_schema=ModelContext)
builder.add_node("model", call_model)
builder.add_edge(START, "model")
builder.add_edge("model", END)
```

이 패턴의 장점은 model 선택 로직이 state를 오염시키지 않는다는 점입니다.  
대화 기록이나 워크플로 상태와 "이번 호출에서 어떤 모델을 쓸지"는 성격이 다르기 때문입니다.

## 4. checkpoint와 함께 쓸 때 기억할 점

`context_schema`를 처음 붙이면 가장 많이 헷갈리는 부분이 여기입니다.

runtime context는 state가 아닙니다.  
즉, checkpointer가 저장하는 thread 상태와는 역할이 다릅니다.

실무 감각으로 정리하면:

- state: 저장되고 이어서 실행되는 workflow 메모리
- context: 매 실행 때 다시 넣어주는 request-scoped 값

그래서 `interrupt()`가 있는 graph를 재개하거나, 같은 thread를 다른 시점에 다시 invoke할 때는  
필요한 context를 다시 넘겨주는 편이 안전합니다.

예를 들어 아래 값은 resume 시점에도 다시 주입할지 먼저 정하는 게 좋습니다.

- `user_id`
- `organization_id`
- `plan`
- `locale`
- `feature_flags`

체크포인트에 남는 실행 상태와, 호출자가 책임지고 다시 주입해야 하는 실행 컨텍스트를 혼동하면  
재개 시점 버그가 생기기 쉽습니다.

## 자주 하는 실수

### 1. 요청별 설정을 state에 넣어 checkpoint를 불필요하게 오염시킨다

`model_provider`, `locale`, `tenant_id` 같은 값이 다음 step 간 공유 메모리가 아니라면  
state보다 context가 더 맞습니다.

### 2. context가 자동으로 저장된다고 생각한다

`thread_id`로 이어서 실행된다고 해서 이전 `context=`가 자동 복원된다고 가정하면 위험합니다.  
재개 경로에서 어떤 context를 다시 넣을지 호출부 계약을 분명히 두는 편이 좋습니다.

### 3. 보안상 민감한 값을 state에 넣는다

state는 checkpoint, trace, 디버깅 흐름에서 더 넓게 노출될 수 있습니다.  
API 키나 내부 권한 정보처럼 state에 남길 이유가 없는 값은 애초에 넣지 않는 편이 낫습니다.

### 4. node와 tool의 runtime 객체를 같은 것으로 생각한다

graph node에서는 `Runtime[...]`를 쓰고, tool 쪽에서는 `ToolRuntime[...]`를 씁니다.  
tool 호출까지 섞인 패턴은 별도 글인 [[libraries/langgraph/toolruntime-toolnode-state-store-context|LangGraph ToolRuntime으로 ToolNode 안에서 state, store, context 함께 주입하기]]를 같이 보는 편이 좋습니다.

## 추천 기준

개인적으로는 아래 기준이면 대부분 빠르게 판단할 수 있습니다.

1. 이 값이 다음 step 결과를 재현하는 데 꼭 필요한 workflow 상태인가
2. checkpoint/history에 남아야 하는가
3. 같은 graph라도 요청마다 바뀔 수 있는 실행 옵션인가

판단이 아래처럼 나오면 방향이 분명해집니다.

- "남아야 한다" -> state
- "이번 호출에서만 필요하다" -> context
- "tool 내부에서 읽는다" -> `ToolRuntime`

## 정리

LangGraph의 `context_schema`는 "state 밖에 있어야 하는 실행별 값"을 정리하는 가장 기본적인 도구입니다.

- graph 상태는 state에
- 요청별 설정은 context에
- node 접근은 `Runtime[Context]`에

이 경계를 먼저 나눠두면 checkpoint, replay, multi-tenant 분기, 모델 선택 로직이 훨씬 덜 꼬입니다.  
특히 운영 graph에서 `thread state`와 `request-scoped config`를 분리하는 첫 단계로 가장 실용적인 기능 중 하나입니다.

## References

- [LangGraph Use the Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [LangGraph Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph Runtime reference](https://reference.langchain.com/python/langgraph/runtime/)
