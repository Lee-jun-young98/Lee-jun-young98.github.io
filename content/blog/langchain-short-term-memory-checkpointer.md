---
title: LangChain short-term memory로 대화 문맥 유지하기
description: LangChain create_agent에 checkpointer를 붙여 thread 단위 short-term memory를 만들고, 운영 환경에서 이어가기 위한 핵심 포인트를 정리한 실전 가이드
date: 2026-05-28
tags:
  - langchain
  - agent
  - memory
  - python
aliases:
  - "/blog/langchain-short-term-memory-checkpointer"
---

# LangChain short-term memory로 대화 문맥 유지하기

LangChain agent를 처음 만들면 한 번의 질문에는 잘 답한다.  
하지만 바로 다음 턴에서 이런 문제가 나온다.

- "아까 말한 고객사 기준으로 다시 정리해줘"
- "방금 찾은 도시 말고 그 옆 지역은?"
- "내 이름 기억하고 계속 이어서 답해줘"

이때 필요한 것이 short-term memory다.  
LangChain v1 기준으로는 별도의 memory 체인보다 `checkpointer`와 `thread_id`를 이해하는 편이 더 중요하다.

이번 글에서는 아래만 실전 기준으로 빠르게 정리한다.

- `create_agent`에 short-term memory 붙이는 최소 예제
- `thread_id`를 어떻게 관리해야 하는지
- 로컬 테스트용 `InMemorySaver`와 운영용 `PostgresSaver` 차이
- 대화가 길어질 때 메시지를 trimming하는 방법
- 자주 막히는 함정

## 언제 short-term memory가 필요한가

short-term memory는 "한 대화 스레드 안에서 이전 턴을 이어받고 싶을 때" 쓴다.

- 챗봇이 직전 질문과 답변을 기억해야 할 때
- agent가 여러 번 tool call을 거치며 중간 상태를 이어가야 할 때
- human-in-the-loop나 interrupt 뒤에 같은 스레드를 재개해야 할 때

반대로 서로 다른 세션 간에 사용자 취향이나 장기 프로필을 저장하려는 목적이면 long-term memory나 별도 저장소를 봐야 한다. short-term memory는 기본적으로 thread 범위다.

## 사전 준비

LangChain 공식 문서 기준으로 Python 3.10+ 환경을 가정한다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

OpenAI를 예시로 쓴다면:

```bash
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 가장 작은 short-term memory 예제

LangChain 공식 short-term memory 문서 기준으로 핵심은 간단하다.

- agent 생성 시 `checkpointer`를 넣는다
- 호출 시 `configurable.thread_id`를 같이 넘긴다

아래 예제는 사용자의 이름을 기억하는 가장 작은 흐름이다.

```python
from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[],
    system_prompt="사용자 정보를 기억하며 한국어로 짧게 답하라.",
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": "demo-user-1"}}

first = agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "안녕, 내 이름은 민수야."}
        ]
    },
    config=config,
)
print(first["messages"][-1].content)

second = agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "내 이름이 뭐였는지 기억해?"}
        ]
    },
    config=config,
)
print(second["messages"][-1].content)
```

여기서 중요한 것은 `thread_id`다.  
같은 `thread_id`를 쓰면 이전 대화 상태를 읽어오고, 다른 `thread_id`를 쓰면 별도 대화로 분리된다.

## 2. tool calling agent에도 같은 방식으로 붙는다

short-term memory는 단순 채팅뿐 아니라 tool calling agent에도 그대로 적용된다.

```python
from langchain.agents import create_agent
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver


@tool
def get_customer_tier(customer_name: str) -> str:
    """고객사의 지원 등급을 조회한다."""
    tiers = {
        "acme": "enterprise",
        "beta": "starter",
    }
    return tiers.get(customer_name.lower(), "unknown")


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[get_customer_tier],
    system_prompt=(
        "고객사 이름이 나오면 필요할 때만 도구를 호출하고, "
        "같은 대화에서는 이미 확인한 고객사를 문맥으로 활용하라."
    ),
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": "support-ticket-42"}}

agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "Acme 고객 등급 확인해줘."}
        ]
    },
    config=config,
)

follow_up = agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "그 고객 기준으로 응답 우선순위도 알려줘."}
        ]
    },
    config=config,
)

print(follow_up["messages"][-1].content)
```

이 패턴이 중요한 이유는 "tool 호출 결과를 포함한 대화 상태"가 같은 스레드 안에서 이어지기 때문이다.  
앞선 글에서 본 human-in-the-loop나 supervisor 패턴도 결국 이런 thread 단위 상태 관리 위에서 더 안정적으로 돌아간다.

## 3. `thread_id`는 애플리케이션에서 직접 관리해야 한다

실무에서 가장 자주 헷갈리는 지점은 메모리 기능보다 `thread_id` 운영이다.

- 웹 서비스라면 대개 `user_id + conversation_id` 조합을 쓴다
- Slack bot이라면 `channel_id`나 `thread_ts`가 자연스러운 키가 된다
- 고객 지원 시스템이라면 `ticket_id`가 thread_id 후보가 된다

중요한 점은 임의 UUID를 매 호출마다 새로 만들면 memory가 이어지지 않는다는 것이다.

나쁜 예:

```python
from uuid import uuid4

config = {"configurable": {"thread_id": str(uuid4())}}
```

이 코드는 매번 새 스레드를 만들기 때문에 "왜 기억을 못 하지?"라는 문제를 만든다.

좋은 예는 대화의 수명 주기와 맞는 안정적인 식별자를 쓰는 것이다.

```python
config = {"configurable": {"thread_id": "user-17:conversation-3"}}
```

## 4. 운영 환경에서는 메모리 저장소를 메모리 밖으로 빼야 한다

`InMemorySaver`는 로컬 데모와 테스트에는 편하지만, 프로세스가 재시작되면 상태가 사라진다.  
운영 환경에서는 공식 문서가 안내하는 데이터베이스 기반 checkpointer를 쓰는 편이 안전하다.

대표 예시는 PostgreSQL이다.

```bash
pip install -U langgraph-checkpoint-postgres
```

```python
from langchain.agents import create_agent
from langgraph.checkpoint.postgres import PostgresSaver


DB_URI = "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable"

with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()

    agent = create_agent(
        model="openai:gpt-5.4",
        tools=[],
        checkpointer=checkpointer,
    )
```

실무에서는 아래를 같이 점검하는 편이 좋다.

- `thread_id`가 어느 테이블 키와 대응되는지
- 재시도나 동시 요청에서 같은 스레드를 어떻게 다룰지
- 개인정보가 메시지에 포함될 때 보관 기간과 마스킹 정책을 어떻게 둘지

## 5. 대화가 길어지면 trimming이 필요하다

short-term memory를 붙였다고 해서 무조건 긴 대화를 그대로 다 보내는 것이 좋은 것은 아니다.  
공식 문서도 긴 문맥에서는 trimming, deletion, summarization 같은 전략을 권장한다.

가장 먼저 시도하기 쉬운 것은 `@before_model` 미들웨어에서 최근 메시지만 남기는 방식이다.

```python
from typing import Any

from langchain.agents import AgentState, create_agent
from langchain.agents.middleware import before_model
from langchain.messages import RemoveMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph.message import REMOVE_ALL_MESSAGES
from langgraph.runtime import Runtime


@before_model
def keep_recent_messages(state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
    messages = state["messages"]

    if len(messages) <= 6:
        return None

    first_message = messages[0]
    recent_messages = messages[-5:]

    return {
        "messages": [
            RemoveMessage(id=REMOVE_ALL_MESSAGES),
            first_message,
            *recent_messages,
        ]
    }


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[],
    middleware=[keep_recent_messages],
    checkpointer=InMemorySaver(),
)
```

처음부터 복잡한 요약 메모리를 넣기보다:

1. 최근 메시지 몇 개만 유지
2. 그래도 길면 요약 추가
3. 그래도 복잡하면 상태 스키마를 분리

이 순서가 보통 더 안전하다.

## 6. 자주 막히는 함정

### 6-1. `checkpointer` 없이 `thread_id`만 넘긴다

이 경우 스레드 키를 넘겨도 실제로 저장할 곳이 없어서 대화가 이어지지 않는다.  
`thread_id`와 `checkpointer`는 같이 봐야 한다.

### 6-2. 스레드 키를 요청마다 새로 만든다

memory 기능 자체는 붙였는데 매 요청마다 새 `thread_id`를 넣으면 결국 stateless 호출과 다르지 않다.

### 6-3. short-term memory와 long-term memory를 혼동한다

이번 대화 안의 문맥 유지는 short-term memory다.  
사용자 취향, 계정 정보, 장기 선호 저장은 long-term memory나 별도 store 영역 문제다.

### 6-4. tool 결과를 너무 길게 쌓는다

검색 결과, 문서 원문, 대량 JSON을 그대로 대화 히스토리에 넣으면 컨텍스트 비용이 급격히 커진다.  
tool 단계에서 먼저 요약하거나 필요한 필드만 남기는 편이 낫다.

### 6-5. 운영 저장소 초기화를 빼먹는다

Postgres 예제처럼 checkpointer 백엔드를 붙일 때는 초기 테이블 생성이나 연결 수명 주기를 같이 점검해야 한다.  
로컬 데모는 되는데 운영에서만 실패하는 이유가 여기서 자주 나온다.

## 마무리

LangChain v1에서 short-term memory의 핵심은 "예전 memory 클래스를 찾는 것"보다 `checkpointer + thread_id` 구조를 이해하는 데 있다.

- 같은 스레드의 이전 대화를 읽어야 한다
- interrupt 뒤에도 상태를 이어가야 한다
- 대화가 길어지면 trimming 전략이 필요하다

실전에서는 이 세 가지를 먼저 안정화한 뒤, 그 다음에 long-term memory나 더 복잡한 상태 스키마로 가는 편이 보통 덜 흔들린다.

다음 글로 이어간다면 short-term memory 위에 사용자 프로필을 분리 저장하는 long-term memory나, state schema를 확장해 tool 상태를 구조화하는 주제가 자연스럽다.

## 참고 자료

- [LangChain Short-term memory](https://docs.langchain.com/oss/python/langchain/short-term-memory)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangChain Long-term memory](https://docs.langchain.com/oss/python/langchain/long-term-memory)
