---
title: "LangChain RemoveMessage로 대화 기록 일부만 안전하게 지우기"
description: "LangChain agent에서 RemoveMessage와 REMOVE_ALL_MESSAGES를 사용해 오래된 메시지, 잘못된 응답, 민감한 기록을 안전하게 삭제하는 방법을 Python 예제로 정리한 실전 노트"
date: 2026-07-06
tags:
  - langchain
  - agents
  - memory
  - python
aliases:
  - "/blog/delete-messages-removemessage"
---

# LangChain RemoveMessage로 대화 기록 일부만 안전하게 지우기

LangChain agent를 오래 돌리다 보면 "메시지를 요약할까?"보다 먼저 "이 기록을 그냥 지워도 되나?"가 문제로 나온다.

- 인증 전 대화는 버리고 싶다
- 잘못 생성된 assistant 응답만 상태에서 제거하고 싶다
- tool call이 끝난 뒤 오래된 메시지 몇 개를 잘라내고 싶다
- 민감한 내용이 섞인 메시지를 아예 short-term memory에서 빼고 싶다

이때 쓰는 기본 도구가 `RemoveMessage`다.  
LangChain 공식 short-term memory 문서는 `RemoveMessage(id=...)`로 특정 메시지를 삭제하고, `REMOVE_ALL_MESSAGES`로 전체 히스토리를 비운 뒤 원하는 메시지만 다시 남기는 패턴을 보여준다.

이 글에서는 아래만 실무 기준으로 정리한다.

- `RemoveMessage`가 trim과 어떻게 다른지
- 특정 메시지 몇 개만 지우는 패턴
- `REMOVE_ALL_MESSAGES`로 히스토리를 재구성하는 패턴
- provider 제약 때문에 쉽게 깨지는 경우

## 언제 이 방식이 특히 유용한가

아래 상황이면 summarization보다 먼저 delete 패턴을 고려할 만하다.

- context window보다 "특정 기록을 남기면 안 된다"가 더 중요한 경우
- approval, login, onboarding 같은 선행 단계가 끝난 뒤 초기 메시지를 버리고 싶은 경우
- assistant가 민감정보를 잘못 내보냈을 때 그 응답을 state에서 제거하고 싶은 경우
- tool 결과를 오래 state에 남기지 않고 다음 턴부터 깔끔하게 시작하고 싶은 경우

반대로 과거 맥락을 보존해야 하는 상담형 agent라면 삭제보다 요약이 더 적합할 수 있다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

메시지 삭제는 short-term memory를 실제로 저장해야 의미가 있으므로, 예제에서는 `InMemorySaver`와 `thread_id`를 같이 쓴다.

## 1. `RemoveMessage`는 "요약"이 아니라 "state에서 삭제"다

trim은 보통 다음 모델 호출 직전에 입력 문맥을 줄이는 데 가깝고, summarization은 과거 내용을 압축해 남긴다.  
반면 `RemoveMessage`는 그래프 state의 메시지 항목 자체를 치환하거나 제거하는 패턴이다.

이 차이를 먼저 구분해 두는 편이 좋다.

- trim: 다음 모델 호출에 들어갈 기록을 줄인다
- summarize: 과거 정보를 압축해 남긴다
- delete: 특정 메시지를 state에서 없앤다

예를 들어 "이 assistant 답변은 잘못 나갔으니 다음 턴부터는 기억하지 마"는 삭제 문제에 가깝다.

## 2. 가장 단순한 패턴은 오래된 메시지 몇 개를 지우는 것이다

공식 문서 기준으로 `after_model`에서 오래된 메시지 ID를 골라 `RemoveMessage` 목록을 반환하면 된다.

```python
from langchain.agents import AgentState, create_agent
from langchain.agents.middleware import after_model
from langchain.messages import RemoveMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.runtime import Runtime


@after_model
def delete_old_messages(state: AgentState, runtime: Runtime) -> dict | None:
    """가장 오래된 메시지 두 개를 삭제한다."""
    messages = state["messages"]
    if len(messages) <= 2:
        return None

    return {
        "messages": [RemoveMessage(id=m.id) for m in messages[:2]]
    }


agent = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[],
    middleware=[delete_old_messages],
    checkpointer=InMemorySaver(),
)
```

이 패턴은 아래처럼 가볍게 쓸 수 있다.

- 첫 인삿말과 온보딩 문구 제거
- 오래된 small talk 제거
- 테스트 중 생성된 불필요한 응답 제거

## 3. 전체를 비우고 일부만 다시 남기고 싶을 때는 `REMOVE_ALL_MESSAGES`가 편하다

특정 메시지 몇 개를 골라 지우는 것보다 "남길 것만 다시 구성"하는 편이 더 안전할 때가 많다.  
예를 들어 system 역할을 대신하는 첫 사용자 메시지와 최근 몇 턴만 남기고 싶다면 아래처럼 간다.

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
    """첫 메시지와 최근 4개 메시지만 유지한다."""
    messages = state["messages"]
    if len(messages) <= 5:
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
    middleware=[keep_recent_messages],
    checkpointer=InMemorySaver(),
)
```

이 방식이 좋은 이유는 삭제 대상 ID를 하나하나 계산하지 않아도 state의 최종 모양을 명시적으로 통제할 수 있기 때문이다.

## 4. 잘못된 assistant 응답만 지우는 패턴도 실용적이다

민감한 단어가 섞였거나, 형식 검증에 실패했거나, 사내 정책을 어긴 답변을 short-term memory에 남기고 싶지 않을 때가 있다.  
이때는 방금 생성된 마지막 assistant 메시지만 지우면 된다.

```python
from langchain.agents import AgentState, create_agent
from langchain.agents.middleware import after_model
from langchain.messages import AIMessage, RemoveMessage
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.runtime import Runtime

STOP_WORDS = {"password", "secret", "ssn"}


@after_model
def remove_sensitive_answer(state: AgentState, runtime: Runtime) -> dict | None:
    """민감 단어가 포함된 마지막 assistant 메시지를 제거한다."""
    last_message = state["messages"][-1]
    if not isinstance(last_message, AIMessage):
        return None

    content = str(last_message.content).lower()
    if any(word in content for word in STOP_WORDS):
        return {"messages": [RemoveMessage(id=last_message.id)]}

    return None


agent = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[],
    middleware=[remove_sensitive_answer],
    checkpointer=InMemorySaver(),
)
```

이 패턴은 guardrail을 넣었더라도 "이미 나온 응답이 다음 턴 state에 남는 문제"를 줄이는 데 유용하다.

## 5. tool call이 있었던 턴은 메시지 짝을 깨지 않도록 더 조심해야 한다

공식 문서가 분명히 경고하는 부분이 있다.  
provider에 따라 메시지 히스토리는 유효한 구조를 유지해야 한다.

대표적인 함정은 아래 두 가지다.

- 일부 provider는 대화가 `user` 메시지로 시작하길 기대한다
- `assistant`의 tool call 뒤에는 대응되는 `tool` 결과 메시지가 따라와야 한다

그래서 아래처럼 assistant/tool 짝을 반쯤만 지우면 다음 호출에서 깨질 수 있다.

```python
from langchain.messages import AIMessage, ToolMessage


def find_safe_cut(messages: list) -> int:
    """tool call 짝이 끝난 지점까지만 잘라내기 위한 예시 함수."""
    for idx in range(len(messages) - 1, -1, -1):
        message = messages[idx]
        if isinstance(message, ToolMessage):
            continue
        if isinstance(message, AIMessage) and getattr(message, "tool_calls", None):
            continue
        return idx
    return 0
```

실무에서는 "최근 N개"를 남기더라도 tool call pair가 완결된 지점에서 자르는 편이 안전하다.

## 6. 전체 동작을 확인하려면 `thread_id`를 고정하고 여러 턴 호출해 봐야 한다

삭제 미들웨어는 단일 호출만 보면 티가 약하다.  
아래처럼 같은 `thread_id`로 여러 번 호출해야 실제 short-term memory 재구성이 보인다.

```python
from langchain_core.runnables import RunnableConfig

config: RunnableConfig = {
    "configurable": {
        "thread_id": "support-thread-1"
    }
}

agent.invoke({"messages": [{"role": "user", "content": "내 이름은 민수야"}]}, config)
agent.invoke({"messages": [{"role": "user", "content": "고양이 시 한 편 써줘"}]}, config)
agent.invoke({"messages": [{"role": "user", "content": "내 이름 기억해?"}]}, config)
```

삭제 정책에 따라 마지막 질문의 답이 달라질 수 있다.  
즉 이 기능은 단순 최적화가 아니라 agent 기억 동작 자체를 바꾼다.

## 자주 틀리는 점

### 1. `checkpointer` 없이 삭제 미들웨어만 넣는다

이러면 턴 간 state가 유지되지 않아서 삭제 효과를 체감하기 어렵다.  
`InMemorySaver`든 DB-backed saver든 thread 기반 저장이 먼저 필요하다.

### 2. `RemoveMessage`와 `trim_messages`를 같은 것으로 본다

trim은 입력 길이 제어에 가깝고, delete는 state 재구성이다.  
특히 다음 턴에서 "기억 자체가 사라져야 하는가"가 기준이 된다.

### 3. tool call이 섞인 메시지 쌍을 반쪽만 지운다

assistant tool call만 남기거나 tool result만 남기면 provider 검증에서 바로 깨질 수 있다.

### 4. 첫 메시지 역할을 무시하고 전체를 비운다

앱 구조에 따라 첫 메시지가 사실상 system 역할을 대신할 수 있다.  
`REMOVE_ALL_MESSAGES`를 쓸 때는 무엇을 다시 남길지 명시적으로 정해야 한다.

### 5. 민감정보를 "보이지 않게만" 하고 state에는 남겨 둔다

UI에서 숨기는 것과 state에서 삭제하는 것은 다르다.  
다음 턴 모델 입력에서 빼려면 `RemoveMessage`나 요약 치환이 필요하다.

## 추천 운영 흐름

개인적으로는 아래 기준이 가장 무난하다.

1. 짧은 성능 최적화면 `trim_messages`
2. 맥락은 남겨야 하면 `SummarizationMiddleware`
3. 특정 기록을 남기면 안 되면 `RemoveMessage`
4. tool call이 있으면 pair 단위로 삭제
5. 삭제 후에는 `stream_events(..., version="v3")`나 snapshot 로그로 실제 state를 꼭 확인

메시지 삭제는 사소한 메모리 관리가 아니라 agent의 기억 정책을 결정하는 작업이다.  
LangChain에서 short-term memory를 운영 수준으로 다루기 시작하면 `RemoveMessage`를 알아두는 편이 확실히 유리하다.

## 참고 자료

- [LangChain Short-term memory](https://docs.langchain.com/oss/python/langchain/short-term-memory)
- [LangChain Tools](https://docs.langchain.com/oss/python/langchain/tools)
- [LangChain Middleware overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)
