---
title: LangChain ToolRuntime와 Command(update=...)로 tool에서 state 쓰기
description: LangChain agent tool이 ToolRuntime으로 현재 state를 읽고 Command(update=...)로 short-term memory를 갱신하는 실전 패턴 정리
date: 2026-06-16
tags:
  - langchain
  - agent
  - memory
  - tools
  - python
---

# LangChain ToolRuntime와 Command(update=...)로 tool에서 state 쓰기
LangChain agent를 실전에 붙이다 보면 "도구 결과를 그냥 문자열로만 돌려주기엔 부족한데?"라는 순간이 자주 옵니다.

- 고객 등급을 한 번 조회한 뒤 다음 tool과 다음 턴에서도 재사용하고 싶을 때
- 주문 번호나 승인 상태를 agent state에 남겨 이후 단계에서 확인하고 싶을 때
- tool이 찾아낸 값을 dynamic prompt나 middleware가 바로 읽게 하고 싶을 때

공식 문서 기준으로 LangChain v1 agent는 `ToolRuntime`으로 현재 `state`와 `context`를 읽을 수 있고, tool에서 `Command(update=...)`를 반환해 short-term memory를 직접 갱신할 수 있습니다.

이 글에서는 아래를 빠르게 정리합니다.

- `ToolRuntime`과 `state_schema`가 각각 무슨 역할을 하는지
- tool이 `Command(update=...)`로 state를 바꾸는 기본 패턴
- 다음 tool과 다음 턴에서 그 값을 다시 쓰는 방법
- 자주 하는 실수와 운영 팁

## 언제 유용한가
이 패턴은 "tool output을 모델에게 한 번 보여 주는 것"을 넘어, agent 실행 흐름 자체에 중간 결과를 남기고 싶을 때 유용합니다.

- 조회형 tool이 가져온 사용자 프로필을 이후 여러 단계에서 재사용할 때
- 승인, triage, 요약 결과 같은 중간 상태를 state로 저장할 때
- tool이 채운 값을 dynamic prompt, middleware, 다른 tool이 함께 읽어야 할 때
- 매 턴마다 같은 외부 API를 다시 부르지 않고 thread 안에서 재사용하고 싶을 때

## 사전 준비
예시는 LangChain v1의 `create_agent`, `ToolRuntime`, `Command`, `InMemorySaver`를 사용합니다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langchain-openai langgraph
```

OpenAI 예시:

```bash
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 핵심 개념 먼저 정리
헷갈리기 쉬운 축은 세 개입니다.

- `state_schema`: agent가 thread 안에서 계속 들고 다닐 short-term memory 구조
- `context_schema`: 실행 시 주입하는 외부 런타임 정보. 예를 들면 `user_id`, DB client, feature flag
- `ToolRuntime`: tool 안에서 `runtime.state`, `runtime.context`, `runtime.tool_call_id` 같은 실행 정보를 꺼내는 진입점

보통은 아래처럼 나눠 생각하면 편합니다.

- thread를 넘어서면 사라져도 되는 중간값은 `state`
- 매 실행마다 주입하는 외부 의존성은 `context`
- tool이 둘 다 읽고 state를 바꿔야 하면 `ToolRuntime[...]` + `Command(update=...)`

## 1. 가장 기본 패턴: tool이 조회 결과를 state에 기록하기
아래 예시는 고객 ID로 프로필을 조회한 뒤, 이후 단계에서 재사용할 `customer_name`과 `customer_tier`를 state에 저장합니다.

중요한 점은 두 가지입니다.

- tool은 `Command(update=...)`를 반환합니다.
- 모델이 이번 tool 결과도 이해할 수 있도록 `messages`에 `ToolMessage`를 함께 넣습니다.

```python
from dataclasses import dataclass

from langchain.agents import AgentState, create_agent
from langchain.messages import ToolMessage
from langchain.tools import ToolRuntime, tool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command


class SupportState(AgentState):
    customer_name: str | None
    customer_tier: str | None


@dataclass
class SupportContext:
    user_id: str


FAKE_CUSTOMERS = {
    "user_123": {"name": "Kim Minji", "tier": "gold"},
    "user_999": {"name": "Lee Jisoo", "tier": "free"},
}


@tool
def load_customer_profile(
    runtime: ToolRuntime[SupportContext, SupportState],
) -> Command:
    """현재 사용자의 고객 프로필을 조회해 state에 저장합니다."""
    profile = FAKE_CUSTOMERS.get(
        runtime.context.user_id,
        {"name": "Unknown", "tier": "free"},
    )

    return Command(
        update={
            "customer_name": profile["name"],
            "customer_tier": profile["tier"],
            "messages": [
                ToolMessage(
                    content=(
                        f"Loaded profile: name={profile['name']}, "
                        f"tier={profile['tier']}"
                    ),
                    tool_call_id=runtime.tool_call_id,
                )
            ],
        }
    )


@tool
def greet_customer(runtime: ToolRuntime[SupportContext, SupportState]) -> str:
    """state에 저장된 고객 이름과 등급으로 인사합니다."""
    name = runtime.state.get("customer_name")
    tier = runtime.state.get("customer_tier")

    if not name:
        return "먼저 load_customer_profile 도구로 고객 정보를 조회하세요."

    return f"{name}님 안녕하세요. 현재 등급은 {tier}입니다."


agent = create_agent(
    model="openai:gpt-5.5-mini",
    tools=[load_customer_profile, greet_customer],
    state_schema=SupportState,
    context_schema=SupportContext,
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": "support-thread-1"}}

result = agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "고객 정보를 불러오고 인사해 줘."}
        ]
    },
    config=config,
    context=SupportContext(user_id="user_123"),
)

print(result["messages"][-1].content)
```

이 예시에서 흐름은 다음과 같습니다.

1. 모델이 `load_customer_profile`을 호출합니다.
2. tool이 `runtime.context.user_id`로 프로필을 찾습니다.
3. `Command(update=...)`가 `customer_name`, `customer_tier`, `messages`를 state에 반영합니다.
4. 이어지는 단계에서 `greet_customer`가 `runtime.state`로 방금 저장한 값을 읽습니다.

## 2. 다음 턴에서도 같은 state를 재사용하기
`checkpointer`와 같은 `thread_id`를 함께 쓰면, 방금 tool이 기록한 값은 다음 턴에도 이어집니다.

```python
follow_up = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "지금 고객 등급만 다시 말해 줘.",
            }
        ]
    },
    config=config,
    context=SupportContext(user_id="user_123"),
)

print(follow_up["messages"][-1].content)
```

이때 agent는 같은 thread의 short-term memory를 다시 읽기 때문에, 같은 고객 프로필을 굳이 매번 다시 조회하지 않아도 됩니다.

실무에서는 특히 아래 조합이 자주 나옵니다.

- 첫 턴에서 profile/search/retrieval tool이 state를 채움
- 다음 턴에서 prompt나 tool이 그 값을 재사용
- 필요하면 오래된 값만 middleware에서 지우거나 요약함

## 3. tool이 state를 쓰면 prompt와 다른 tool도 같이 단순해진다
tool이 중간 결과를 state에 써 두면 이후 구성 요소들이 그 값을 공유하기 쉬워집니다.

- 다른 tool은 다시 API를 치지 않고 `runtime.state`만 읽으면 됩니다.
- `dynamic_prompt`는 고객 등급, 승인 상태, 현재 단계 같은 값을 바로 system prompt에 반영할 수 있습니다.
- middleware는 `before_model`, `after_model`, `wrap_tool_call`에서 같은 state를 기준으로 로깅과 가드레일을 넣을 수 있습니다.

즉 이 패턴은 "tool 결과 저장"이 아니라 "agent 내부 공용 작업 메모리 만들기"에 가깝습니다.

## 4. 어떤 값을 state에 넣고 어떤 값은 context에 둬야 할까
둘을 섞으면 금방 복잡해집니다. 아래 기준이 실무에서 가장 단순합니다.

- `state`: 현재 thread에서 누적되는 값
  예: 고객 이름, 주문 번호, triage 결과, 최근 검색 결과, 승인 상태
- `context`: 호출 시점에 밖에서 넣는 값
  예: `user_id`, DB 세션, API client, 조직 ID, feature flag

`context`는 외부 의존성이고, `state`는 agent가 실행 중에 축적하는 작업 메모리라고 보면 됩니다.

## 자주 하는 실수
### 1. state를 바꾸면서 `ToolMessage`를 빼먹는 경우
`Command(update=...)`로 state만 바꾸고 `messages`를 남기지 않으면, 모델은 이번 tool이 무엇을 했는지 대화 문맥에서 이해하기 어려울 수 있습니다.

값을 숨겨진 메모리로만 저장할 것인지, 모델에게도 이번 실행 결과를 보여 줄 것인지 의도를 나눠서 설계하는 편이 좋습니다.

### 2. `checkpointer` 없이 다음 턴 재사용을 기대하는 경우
tool이 state를 갱신해도, thread persistence가 없으면 다음 턴에는 남아 있지 않습니다.

멀티턴 재사용이 필요하면 `checkpointer`와 같은 `thread_id`가 같이 있어야 합니다.

### 3. 외부 의존성을 state에 넣어 버리는 경우
DB connection, API client, request-scoped auth 정보까지 state에 넣기 시작하면 직렬화와 재현성이 금방 꼬입니다.

이런 값은 `context_schema`로 주입하는 편이 맞습니다.

### 4. tool이 너무 많은 state 필드를 동시에 덮어쓰는 경우
state를 넓게 쓰기 시작하면 어떤 tool이 어떤 필드를 책임지는지 모호해질 수 있습니다.

필드 단위를 작게 나누고, 이름을 구체적으로 잡는 편이 디버깅에 유리합니다.

### 5. thread마다 달라야 하는 값을 전역 캐시처럼 쓰는 경우
short-term memory는 기본적으로 thread 단위입니다.

사용자 전체 선호나 세션 밖 장기 데이터는 `store` 기반 long-term memory나 별도 DB로 빼는 편이 맞습니다.

## 운영 팁
- profile, retrieval, classification tool처럼 "다음 단계가 계속 참조할 값"부터 state 저장 대상으로 잡는 편이 효과적입니다.
- 저장 필드는 작게 유지하고, 큰 문서 본문은 필요한 경우만 요약해서 남기는 편이 좋습니다.
- state 변경이 중요한 workflow라면 LangSmith trace에서 tool 호출 전후 state를 같이 보며 검증하는 편이 안전합니다.
- 오래된 중간값이 다음 단계 판단을 오염시키면 `before_model`이나 `after_model` middleware로 정리 규칙을 추가하세요.

## 마무리
LangChain에서 tool은 더 이상 "문자열 하나 반환하는 함수"에만 머물지 않습니다.

`ToolRuntime`과 `Command(update=...)`를 쓰면 tool이:

1. 현재 실행 문맥을 읽고
2. 필요한 값을 thread state에 기록하고
3. 다음 tool, 다음 prompt, 다음 턴이 그 값을 다시 쓰게 만들 수 있습니다.

agent가 여러 단계로 길어질수록, 이 패턴은 단순한 convenience가 아니라 workflow 설계의 핵심이 됩니다.

## 참고 자료

- [LangChain Short-term memory](https://docs.langchain.com/oss/python/langchain/short-term-memory)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain Custom middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
- [LangChain ToolRuntime reference](https://reference.langchain.com/python/langchain/tools/)
