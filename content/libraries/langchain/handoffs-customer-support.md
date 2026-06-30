---
title: "LangChain handoffs로 고객지원 상태 전환 에이전트 만들기"
description: "LangChain handoffs 패턴으로 warranty 수집, 분류, 해결 단계를 한 에이전트 안에서 순차적으로 전환하는 방법을 Python 예제로 정리한 학습 노트"
date: 2026-06-30
tags:
  - langchain
  - agents
  - multi-agent
  - handoffs
  - python
aliases:
  - "/blog/langchain-handoffs-customer-support"
---

# LangChain handoffs로 고객지원 상태 전환 에이전트 만들기

LangChain에서 `handoffs`는 에이전트가 다음 담당 상태나 다음 담당 에이전트에게 제어권을 넘기는 패턴이다.
2026년 6월 30일 기준 공식 문서는 handoff를 두 방식으로 설명한다.

- 단일 에이전트 + middleware로 상태에 따라 프롬프트와 도구를 바꾸는 방식
- 여러 agent subgraph 사이를 `Command.PARENT`로 오가는 방식

처음에는 첫 번째 방식이 훨씬 실용적이다.
특히 고객지원처럼 "보증 상태를 먼저 받고 -> 문제 유형을 분류하고 -> 그다음 해결책을 제시한다" 같은 순차 제약이 있을 때 잘 맞는다.

## 언제 handoffs가 맞는가

다음 조건이면 handoffs 패턴을 우선 검토할 만하다.

- 어떤 정보를 받기 전에는 특정 도구를 열어 주면 안 될 때
- 사용자와 대화는 계속 같은 창에서 이어 가되 내부 상태는 분명히 나눠야 할 때
- triage, specialist, escalation 같은 단계 전환이 여러 turn에 걸쳐 이어질 때

반대로 subagent를 잠깐 도구처럼 호출하고 결과만 받아 오면 되는 구조라면 `subagents` 패턴이 더 단순하다.

## 핵심 아이디어

handoff의 핵심은 거창하지 않다.

1. state에 `current_step` 같은 필드를 둔다.
2. tool이 실행되면 `Command(update=...)`로 그 필드를 바꾼다.
3. middleware가 그 state를 읽고 다음 턴의 system prompt와 tool 목록을 바꾼다.

즉 "에이전트를 여러 개 따로 만드는 것"보다 "같은 에이전트가 현재 단계에 따라 다른 성격으로 동작하게 만드는 것"에 가깝다.

## 사전 준비

공식 tutorial 흐름에 맞춰 OpenAI 예제로 시작하면 아래 정도가 무난하다.

```bash
pip install -U langchain langgraph langchain-openai
```

환경 변수:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

이 예제는 대화 상태를 turn 간 유지해야 하므로 checkpointer를 함께 쓴다.

## runnable 예제: warranty -> specialist로 넘기는 단일 agent handoff

아래 코드는 보증 상태를 수집한 뒤, 다음 턴부터 해결 전용 설정으로 전환하는 가장 작은 handoff 예제다.

```python
from typing import Callable, Literal
from typing_extensions import NotRequired

from langchain.agents import AgentState, create_agent
from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call
from langchain.chat_models import init_chat_model
from langchain.messages import ToolMessage
from langchain.tools import ToolRuntime, tool
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command


SupportStep = Literal["triage", "specialist"]
WarrantyStatus = Literal["in_warranty", "out_of_warranty"]


class SupportState(AgentState):
    current_step: NotRequired[SupportStep]
    warranty_status: NotRequired[WarrantyStatus]


@tool
def record_warranty_status(
    status: WarrantyStatus, runtime: ToolRuntime[None, SupportState]
) -> Command:
    """보증 상태를 기록하고 specialist 단계로 넘긴다."""
    return Command(
        update={
            "messages": [
                ToolMessage(
                    content=f"Warranty status recorded: {status}",
                    tool_call_id=runtime.tool_call_id,
                )
            ],
            "warranty_status": status,
            "current_step": "specialist",
        }
    )


@tool
def provide_solution(issue: str, runtime: ToolRuntime[None, SupportState]) -> str:
    """수집된 보증 상태를 바탕으로 해결 가이드를 준다."""
    warranty = runtime.state.get("warranty_status", "unknown")
    if warranty == "in_warranty":
        return (
            f"문제: {issue}. 무상수리 대상일 가능성이 높습니다. "
            "구매 영수증과 시리얼 번호를 준비해 서비스 센터 접수를 안내하세요."
        )
    return (
        f"문제: {issue}. 보증 만료로 보여 유상수리 또는 원격 점검 옵션을 먼저 안내하세요."
    )


@tool
def escalate_to_human(reason: str) -> str:
    """사람 상담원에게 넘겨야 하는 이유를 기록한다."""
    return f"상담원 이관 필요: {reason}"


STEP_CONFIGS = {
    "triage": {
        "prompt": (
            "너는 고객지원 접수 담당이다. 아직 해결책을 말하지 말고 "
            "반드시 보증 상태부터 확인해라. 상태가 확인되면 "
            "record_warranty_status 도구를 호출해 specialist 단계로 넘겨라."
        ),
        "tools": [record_warranty_status],
    },
    "specialist": {
        "prompt": (
            "너는 해결 담당자다. 현재 warranty_status={warranty_status} 이다. "
            "문제 설명을 듣고 provide_solution 또는 escalate_to_human 중 하나를 사용해라."
        ),
        "tools": [provide_solution, escalate_to_human],
    },
}


@wrap_model_call
def apply_step_config(
    request: ModelRequest, handler: Callable[[ModelRequest], ModelResponse]
) -> ModelResponse:
    step = request.state.get("current_step", "triage")
    config = STEP_CONFIGS[step]
    request = request.override(
        system_prompt=config["prompt"].format(**request.state),
        tools=config["tools"],
    )
    return handler(request)


model = init_chat_model("gpt-5.5", model_provider="openai")

agent = create_agent(
    model=model,
    tools=[record_warranty_status, provide_solution, escalate_to_human],
    state_schema=SupportState,
    middleware=[apply_step_config],
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": "support-ticket-1001"}}

turn1 = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "노트북 전원이 안 켜져요. 아직 보증기간 안입니다.",
            }
        ]
    },
    config=config,
)

print(turn1["messages"][-1].content)

turn2 = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "전원 버튼을 눌러도 아무 반응이 없어요.",
            }
        ]
    },
    config=config,
)

print(turn2["messages"][-1].content)
```

이 예제에서 중요한 포인트는 네 가지다.

- `record_warranty_status()`가 단순 문자열이 아니라 `Command(update=...)`를 반환한다.
- `current_step`이 `"specialist"`로 바뀌면 다음 턴부터 middleware가 다른 prompt와 tool 세트를 적용한다.
- `thread_id`와 checkpointer가 있어야 turn 사이 상태가 유지된다.
- specialist 단계에서는 triage용 도구가 더 이상 노출되지 않는다.

## 왜 `ToolMessage`가 꼭 필요한가

handoff tool에서 가장 자주 놓치는 부분이 `ToolMessage`다.
공식 handoffs 문서 기준으로, LLM이 tool call을 만들었으면 그 호출에 대응하는 tool 응답 메시지가 대화 히스토리에 꼭 들어가야 한다.

즉 아래 둘이 세트다.

- `runtime.tool_call_id`
- 그 ID를 그대로 쓰는 `ToolMessage(...)`

이걸 빼먹으면 handoff 상태는 바뀌더라도 메시지 히스토리가 깨져 이후 턴에서 이상한 동작이 나오기 쉽다.

## handoff와 subagent의 차이

둘 다 멀티 에이전트처럼 보이지만 성격이 다르다.

`handoff`:

- 사용자와 직접 대화하는 주체가 현재 상태에 따라 바뀐다
- 이전 단계의 tool이 다음 단계를 열어 준다
- 순차 워크플로우, 고객지원, onboarding, 승인 플로우에 적합하다

`subagent`:

- 현재 agent가 다른 specialist agent를 tool처럼 호출한다
- 결과를 받아 다시 현재 agent가 사용자에게 응답한다
- 병렬 분업, 검색/분석 위임, supervisor 패턴에 더 잘 맞는다

공식 문서도 대부분의 handoff 사용 사례는 단일 agent + middleware가 더 단순하다고 안내한다.

## 여러 agent subgraph handoff는 언제 쓰나

두 번째 방식은 각 specialist를 아예 별도 graph node로 둘 때 쓴다.
이때 handoff tool은 보통 `Command(goto=..., graph=Command.PARENT)` 형태를 반환한다.

이 패턴은 강력하지만 초반 난이도가 확 올라간다.
특히 아래를 직접 설계해야 한다.

- 어떤 메시지를 다음 agent에 넘길지
- 전체 히스토리를 줄지, 최근 AI/Tool 메시지만 줄지
- active agent 상태를 어디에 저장할지

단일 agent 설정 변경으로 충분하면 굳이 subgraph handoff로 올라가지 않는 편이 낫다.

## 자주 막히는 포인트

### 1. `current_step`만 바꾸고 tool 목록은 그대로 둔다

이러면 specialist 단계에서도 triage 도구가 계속 보인다.
handoff의 핵심은 상태 전환 자체보다, 전환 후 노출되는 행동 집합을 함께 바꾸는 것이다.

### 2. checkpointer 없이 `thread_id`만 넣는다

`thread_id`는 식별자일 뿐이다.
실제 상태 저장은 checkpointer가 맡으므로, 둘 중 하나만 있으면 기대한 multi-turn handoff가 유지되지 않는다.

### 3. tool 안에서 상태만 바꾸고 `ToolMessage`를 안 남긴다

이 경우 모델 입장에서는 자신이 만든 tool call이 끝나지 않은 것처럼 보일 수 있다.
handoff tool에서는 `ToolMessage(tool_call_id=runtime.tool_call_id, ...)`를 습관처럼 같이 넣는 편이 안전하다.

### 4. 첫 구현부터 subgraph handoff로 간다

서로 다른 agent 간 메시지 전달을 잘못 설계하면 문맥이 깨지거나 너무 부풀어 오른다.
고객지원처럼 단계형 플로우는 먼저 단일 agent middleware 버전으로 검증하는 편이 디버깅 비용이 낮다.

## 다음 단계

handoff가 한 번 안정적으로 돌아가면 그다음 확장은 보통 아래 순서가 자연스럽다.

1. `issue_type`, `priority`, `customer_tier` 같은 state 필드를 추가한다.
2. specialist 단계를 hardware/software로 더 세분화한다.
3. 사람 승인이나 상담원 이관에 `Human-in-the-Loop`를 붙인다.
4. LangSmith tracing으로 각 단계 전환과 tool call을 추적한다.

실무에서는 "에이전트를 더 똑똑하게 만들기"보다 "어느 단계에서 무엇을 할 수 있는지 제한하기"가 더 중요할 때가 많다.
handoffs는 바로 그 제어를 가장 이해하기 쉬운 형태로 제공한다.

## 참고 자료

- [LangChain Handoffs Overview](https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs)
- [Build customer support with handoffs](https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs-customer-support)
- [LangChain Multi-agent Overview](https://docs.langchain.com/oss/python/langchain/multi-agent)
- [LangChain Context Engineering](https://docs.langchain.com/oss/python/langchain/context-engineering)
