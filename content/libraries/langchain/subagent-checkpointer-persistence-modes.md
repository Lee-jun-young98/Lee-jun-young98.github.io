---
title: LangChain subagent checkpointer 모드로 기억 범위 설계하기
description: subagent의 inherited, continuations, stateless checkpoint 모드를 구분하고 대화 기억, interrupt, 병렬 호출 경계를 설계하는 실전 가이드
date: 2026-08-22
tags:
  - langchain
  - agent
  - multi-agent
  - persistence
  - python
---

# LangChain subagent checkpointer 모드로 기억 범위 설계하기

supervisor가 subagent를 tool처럼 호출할 때 하위 agent는 기본적으로 이전 호출을 기억하지 않는다. 이 격리는 불필요한 문맥 누적을 막지만, 같은 전문가와 여러 번 이어서 대화해야 하는 작업에는 맞지 않을 수 있다.

LangChain의 `create_agent`는 LangGraph graph를 반환한다. 따라서 subagent를 만들 때 `checkpointer`에 무엇을 넘기는지에 따라 기억과 복구 범위가 달라진다.

| 설정 | 동작 | 적합한 작업 |
| --- | --- | --- |
| 생략 또는 `None` | 호출마다 새 state, 부모 checkpointer 상속 | 독립 조사, 요약, 병렬 위임 |
| `True` | 같은 thread에서 state 누적 | 여러 차례 이어지는 전문가 상담 |
| `False` | checkpoint를 전혀 사용하지 않음 | interrupt·복구가 필요 없는 순수 계산 |

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U langchain langgraph langchain-openai
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell에서는 활성화와 환경 변수 설정을 다음처럼 바꾼다.

```powershell
.\.venv\Scripts\Activate.ps1
$env:OPENAI_API_KEY = "your-api-key"
```

## 1. 기본값은 호출 단위 격리다

독립적인 조사 요청이라면 subagent에 checkpointer를 따로 지정하지 않는 것이 안전하다.

```python
from langchain.agents import create_agent
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver


research_agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    system_prompt="질문 하나를 독립적으로 조사해 핵심 근거만 반환하라.",
    # checkpointer를 생략하면 호출마다 subagent state가 새로 시작한다.
)


@tool
def research(query: str) -> str:
    """독립적인 조사 작업을 실행한다."""
    result = research_agent.invoke(
        {"messages": [{"role": "user", "content": query}]}
    )
    return result["messages"][-1].content


supervisor = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[research],
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": "support-42"}}
result = supervisor.invoke(
    {"messages": [{"role": "user", "content": "RAG 평가 방법을 조사해 줘"}]},
    config,
)
print(result["messages"][-1].content)
```

부모의 checkpointer는 supervisor 대화를 보존한다. 기본 subagent는 그 저장소를 상속해 한 번의 호출 안에서 interrupt와 durable execution을 지원하지만, 다음 tool 호출에는 이전 하위 대화가 자동으로 이어지지 않는다.

이 모드는 같은 subagent를 병렬로 호출해도 각 호출의 checkpoint namespace가 분리된다는 장점이 있다.

## 2. 이어지는 전문가 대화에는 `checkpointer=True`

subagent 자체가 같은 thread 안에서 이전 상담을 기억해야 한다면 continuations 모드를 사용한다.

```python
from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver


billing_agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    system_prompt="결제 상담 내역을 이어서 처리하라.",
    checkpointer=True,
)

parent_checkpointer = InMemorySaver()

# 실제 구성에서는 billing_agent를 고유한 parent graph node로 연결하고,
# parent graph를 parent_checkpointer로 compile한다.
config = {"configurable": {"thread_id": "customer-1007"}}
```

`True`는 새 `InMemorySaver()`를 subagent마다 만드는 뜻이 아니다. 부모 graph의 checkpointer를 사용하면서 같은 thread의 하위 state를 호출 사이에도 누적하겠다는 선언이다. 부모도 반드시 실제 checkpointer로 compile되어 있어야 한다.

사용자나 업무 케이스마다 안정적인 `thread_id`를 배정해야 한다. 서로 다른 사용자가 같은 ID를 공유하면 대화가 섞이고, 매 요청마다 새 ID를 만들면 continuations를 켠 의미가 사라진다.

## 3. checkpoint가 필요 없을 때만 `False`

순수 변환처럼 중단 후 재개할 필요가 전혀 없는 하위 graph는 checkpoint 비용을 명시적으로 끌 수 있다.

```python
from langchain.agents import create_agent


formatter_agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    system_prompt="입력 문장을 지정 형식으로만 변환하라.",
    checkpointer=False,
)
```

이 모드에서는 state 저장, interrupt 재개, 장애 후 durable execution을 기대하면 안 된다. 단순히 “기억은 필요 없다”는 이유만으로 `False`를 고르지 말자. 기억은 없어도 승인 interrupt나 실패 복구가 필요하다면 기본 inherited 모드가 맞다.

## 4. 선택 규칙을 테스트로 고정하기

LLM 응답 문구보다 어떤 persistence 모드를 쓰는지가 시스템 계약이다. 구성 코드를 한곳에 모아 의도를 테스트하면 실수로 모드가 바뀌는 것을 막기 쉽다.

```python
from enum import Enum


class PersistenceMode(str, Enum):
    INHERITED = "inherited"
    CONTINUATIONS = "continuations"
    STATELESS = "stateless"


def choose_mode(*, needs_memory: bool, needs_resume: bool) -> PersistenceMode:
    if needs_memory:
        return PersistenceMode.CONTINUATIONS
    if needs_resume:
        return PersistenceMode.INHERITED
    return PersistenceMode.STATELESS


def test_subagent_persistence_policy() -> None:
    assert choose_mode(needs_memory=True, needs_resume=True) == "continuations"
    assert choose_mode(needs_memory=False, needs_resume=True) == "inherited"
    assert choose_mode(needs_memory=False, needs_resume=False) == "stateless"
```

운영 테스트에서는 같은 `thread_id`의 두 번째 호출이 기억을 이어 가는지, 다른 `thread_id`에는 state가 새지 않는지도 함께 확인한다.

## 흔한 실수

- `checkpointer=True` subagent의 같은 인스턴스를 한 node 안에서 여러 번 호출하면 checkpoint namespace 충돌이 날 수 있다. 병렬·반복 위임은 기본 inherited 모드를 우선한다.
- tool 함수 내부에서 subagent를 호출하면 LangGraph가 하위 graph를 정적으로 발견하지 못한다. 이 구조에서는 `get_state(config, subgraphs=True)`로 내부 state를 볼 수 없다.
- 하위 state 검사나 interrupt 중간 상태 관찰이 필요하면 subagent를 tool 뒤에 숨기지 말고 custom graph의 고유한 node로 연결한다.
- 개발용 `InMemorySaver`는 프로세스 재시작을 견디지 못한다. 운영에서는 Postgres 같은 durable checkpointer를 사용하고 필요한 schema migration을 실행한다.
- checkpointer는 thread 내부 state를 저장한다. 여러 thread가 공유할 사용자 선호나 지식은 LangGraph Store 같은 long-term memory에 둔다.

## 정리

subagent의 기본값은 “무상태”가 아니라 **호출 단위로 격리되지만 interrupt와 복구는 가능한 inherited persistence**다. 대부분의 독립 위임에는 이 기본값이 가장 안전하다.

`checkpointer=True`는 같은 전문가가 이전 대화를 이어야 할 때만 사용하고, `False`는 interrupt와 durable execution까지 포기해도 되는 작업에 한정한다. 모드를 정한 뒤에는 thread ID 격리, 병렬 호출 방식, state 검사 필요성까지 함께 설계해야 한다.

## 참고 자료

- [LangChain Subagents](https://docs.langchain.com/oss/python/langchain/multi-agent/subagents)
- [LangGraph Subgraphs](https://docs.langchain.com/oss/python/langgraph/use-subgraphs)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph MULTIPLE_SUBGRAPHS 오류](https://docs.langchain.com/oss/python/langgraph/errors/MULTIPLE_SUBGRAPHS)
