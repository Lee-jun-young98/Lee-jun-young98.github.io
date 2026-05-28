---
title: LangChain short-term memory로 대화 맥락 유지하기
description: LangChain agent에 checkpointer와 thread_id를 붙여 이전 대화를 기억하게 만들고, 긴 대화에서는 메시지 trim까지 적용하는 실전 가이드
date: 2026-05-28
tags:
  - langchain
  - llm
  - agent
  - memory
  - python
aliases:
  - "/blog/langchain-short-term-memory"
---

# LangChain short-term memory로 대화 맥락 유지하기

`create_agent(...)`로 도구 호출 agent를 만들고 나면 금방 부딪히는 문제가 하나 있다.  
첫 질문에는 잘 답하는데, 다음 턴에서 "내 이름 기억해?" 같은 질문을 하면 바로 맥락을 잃는 경우다.

LangChain 최신 문서 기준으로 이 문제는 별도 memory class를 붙이기보다, agent 생성 시 `checkpointer`를 넣고 호출할 때 `thread_id`를 넘기는 방식으로 푼다.  
이번 글에서는 이 현재 흐름을 기준으로 다음만 짧게 정리한다.

- thread 단위 short-term memory 붙이기
- `thread_id`가 실제로 왜 필요한지 이해하기
- 긴 대화에서 message trimming 적용하기
- 예전 memory API를 그대로 따라가다 막히는 지점 정리하기

## 언제 필요한가

short-term memory는 아래 상황에서 바로 필요해진다.

- 여러 turn에 걸쳐 사용자의 맥락을 이어가야 할 때
- 이전 tool 결과를 다음 질문에서도 참고해야 할 때
- 사람 승인, 재시도, 중간 상태 저장처럼 thread를 이어받아야 할 때

반대로 "질문 1개 -> 응답 1개"로 끝나는 stateless 호출이라면 굳이 붙이지 않아도 된다.

## 사전 준비

공식 설치 문서 기준으로 `langchain`은 Python 3.10+가 필요하다.  
OpenAI 예시로 시작하면 아래 정도면 된다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

환경 변수도 준비한다.

```bash
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell이라면:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 가장 작은 short-term memory 예제

핵심은 두 가지다.

- agent를 만들 때 `checkpointer=`를 넣는다
- `invoke()`할 때 같은 `thread_id`를 계속 넘긴다

아래 예제는 첫 턴에서 이름을 말하고, 두 번째 턴에서 agent가 그 이름을 기억하는지 확인한다.

```python
from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver

agent = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[],
    system_prompt="사용자의 정보를 기억하고 짧고 정확하게 답하라.",
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": "demo-user-1"}}

agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "안녕, 내 이름은 민수야."}
        ]
    },
    config,
)

result = agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "내 이름이 뭐였지?"}
        ]
    },
    config,
)

print(result["messages"][-1].content)
```

여기서 `InMemorySaver()`는 프로세스가 살아 있는 동안만 상태를 들고 있는다.  
개발용 데모에는 편하지만, 서버를 재시작하면 memory도 같이 사라진다.

## 2. `thread_id`를 빼먹으면 왜 안 되나

처음 보면 `checkpointer`만 붙이면 자동으로 기억할 것 같지만, 실제로는 같은 thread를 식별할 값도 필요하다.

- `checkpointer`: 상태를 어디에 저장할지
- `thread_id`: 어떤 대화 세션인지

즉 둘 중 하나만 있어서는 부족하다.  
특히 웹 서비스나 API 서버에서는 사용자 ID 하나만 그대로 `thread_id`로 쓰기보다, "사용자 ID + 대화방 ID"처럼 더 구체적으로 잡는 편이 안전하다.

예를 들어 아래처럼 thread를 나누면 대화가 섞이지 않는다.

```python
config_a = {"configurable": {"thread_id": "user-7:chat-1"}}
config_b = {"configurable": {"thread_id": "user-7:chat-2"}}
```

같은 사용자가 두 개의 대화를 동시에 열어도, 저장되는 short-term memory는 분리된다.

## 3. 운영 환경에서는 DB 기반 checkpointer가 낫다

공식 문서도 production에서는 DB-backed checkpointer를 권장한다.  
로컬 메모리 saver는 편하지만, 멀티 프로세스나 재시작 환경에서는 금방 한계가 드러난다.

Postgres를 쓰는 가장 단순한 예시는 아래와 비슷하다.

```python
from langchain.agents import create_agent
from langgraph.checkpoint.postgres import PostgresSaver

DB_URI = "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable"

with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup()

    agent = create_agent(
        model="openai:gpt-4.1-mini",
        tools=[],
        checkpointer=checkpointer,
    )
```

추가 설치가 필요하다.

```bash
pip install -U langgraph-checkpoint-postgres
```

작게 시작할 때는 `InMemorySaver`, 서비스에서는 DB 기반 saver로 넘어간다고 생각하면 된다.

## 4. 긴 대화는 그대로 쌓기보다 trim이 필요하다

short-term memory를 붙였다고 해서 메시지를 무한정 쌓아두는 것이 좋은 것은 아니다.  
대화가 길어질수록 비용, 응답 속도, 맥락 오염 문제가 같이 커진다.

최신 문서에서는 이런 경우 `@before_model` middleware로 오래된 메시지를 정리하는 패턴을 보여준다.

```python
from typing import Any

from langchain.agents import AgentState, create_agent
from langchain.agents.middleware import before_model
from langchain.messages import RemoveMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph.message import REMOVE_ALL_MESSAGES
from langgraph.runtime import Runtime


@before_model
def trim_messages(state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
    messages = state["messages"]

    if len(messages) <= 4:
        return None

    first_message = messages[0]
    recent_messages = messages[-4:]

    return {
        "messages": [
            RemoveMessage(id=REMOVE_ALL_MESSAGES),
            first_message,
            *recent_messages,
        ]
    }


agent = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[],
    middleware=[trim_messages],
    checkpointer=InMemorySaver(),
)
```

이 패턴의 장점은 "memory를 끄는 것"이 아니라 "지금 모델에게 정말 필요한 맥락만 남기는 것"에 가깝다는 점이다.

## 5. 자주 막히는 포인트

### 5-1. 예전 memory 클래스를 그대로 찾는다

오래된 튜토리얼을 보면 `ConversationBufferMemory`나 chain 중심 예제가 많이 나온다.  
지금 agent 문서의 기본 흐름은 `create_agent + checkpointer + thread_id` 쪽이다.

새 프로젝트라면 예전 memory 예제를 출발점으로 잡기보다, 현재 short-term memory 문서의 패턴으로 시작하는 편이 덜 헷갈린다.

### 5-2. 같은 thread에 넣어야 할 요청이 매번 새 thread로 들어간다

`thread_id`를 요청마다 랜덤으로 생성하면 memory가 있는 것처럼 보여도 실제로는 turn이 이어지지 않는다.  
반대로 서로 다른 대화를 같은 `thread_id`로 몰아넣으면 맥락이 오염된다.

### 5-3. tool call이 있는 대화에서 메시지를 함부로 지운다

공식 문서도 지적하듯이, 일부 provider는 message history의 형태에 제약이 있다.  
예를 들어 tool call이 있는 assistant 메시지를 남겨두었다면, 대응하는 tool 결과 메시지도 같이 유지해야 한다.

즉 trim 로직은 "오래된 메시지 삭제" 자체보다 "유효한 메시지 시퀀스 유지"를 먼저 봐야 한다.

### 5-4. short-term memory와 long-term memory를 혼동한다

이번 글의 대상은 thread 내부 대화 기억이다.  
"사용자의 장기 선호", "계정 수준 프로필", "여러 세션에 걸친 개인화"는 long-term memory나 별도 저장소 설계에 더 가깝다.

## 정리

LangChain 최신 agent 흐름에서 short-term memory의 핵심은 복잡하지 않다.

- `create_agent(...)`에 `checkpointer`를 넣고
- 호출 시 같은 `thread_id`를 유지하고
- 대화가 길어지면 middleware로 message trim을 넣는다

예전 memory API를 억지로 이어 붙이기보다, 현재 공식 문서가 기준으로 삼는 `checkpointer` 패턴으로 시작하면 구조가 훨씬 선명하다.

## 참고

- [LangChain Install](https://docs.langchain.com/oss/python/langchain/install)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain Short-term Memory](https://docs.langchain.com/oss/python/langchain/short-term-memory)
