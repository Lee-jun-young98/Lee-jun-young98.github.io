---
title: LangChain trim_messages로 context window 넘치기 전에 대화 기록 자르기
description: LangChain v1 agent에서 trim_messages, RemoveMessage, before_model middleware를 조합해 긴 대화 히스토리를 안전하게 줄이는 실전 패턴 정리
date: 2026-07-01
tags:
  - langchain
  - agent
  - memory
  - middleware
  - python
aliases:
  - "/blog/langchain-trim-messages-before-model"
---

# LangChain trim_messages로 context window 넘치기 전에 대화 기록 자르기

LangChain agent를 며칠만 운영해도 꽤 빨리 부딪히는 문제가 있다.

- 대화 turn이 길어질수록 응답이 느려진다
- tool call과 tool result까지 히스토리에 쌓여 토큰이 급격히 늘어난다
- 요약 메모리까지는 필요 없는데 최근 문맥만 남기고 싶다

이럴 때 가장 먼저 검토할 만한 패턴이 `before_model`에서 `trim_messages`를 적용하는 방식이다.
2026년 7월 1일 기준 LangChain 공식 문서는 긴 히스토리를 다루는 기본 전략을 `trim`, `delete`, `summarize` 세 가지로 나눠 설명하고, 단순한 컨텍스트 절단에는 `trim_messages` 유틸리티와 `RemoveMessage`를 함께 쓰는 예시를 제공한다.

이 글에서는 아래만 빠르게 정리한다.

- `trim_messages`가 `SummarizationMiddleware`보다 나은 상황
- `before_model`에서 최근 문맥만 남기는 최소 예제
- `RemoveMessage(id=REMOVE_ALL_MESSAGES)`가 왜 필요한지
- tool call이 섞인 히스토리에서 자주 깨지는 포인트

## 언제 이 패턴이 맞는가

다음 조건이면 요약보다 trimming이 먼저다.

- 최근 몇 turn만 정확하면 되고 오래된 세부 대화는 버려도 된다
- 멀티턴 agent 응답 속도와 토큰 비용을 먼저 줄이고 싶다
- 대화 요약을 위해 추가 모델 호출을 넣고 싶지 않다
- 고객지원, 내부 업무 assistant처럼 최근 작업 맥락만 중요하다

반대로 오래된 사용자 선호, 약속, 결정 사항까지 보존해야 하면 `SummarizationMiddleware`나 long-term memory 쪽이 더 맞다.

## 사전 준비

예시는 LangChain v1 Python agent 기준이다.

```bash
pip install -U langchain langgraph langchain-openai
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

모델 문자열은 공식 문서 예시 흐름에 맞춰 `openai:gpt-5.5`를 사용했다. 실제 실행에서는 계정에서 접근 가능한 모델로 바꿔도 된다.

## 핵심 아이디어

핵심은 단순하다.

1. `state["messages"]`에서 현재 메시지 목록을 읽는다.
2. `trim_messages(...)`로 모델에 보낼 최근 메시지만 고른다.
3. 반환값에서 기존 히스토리를 `RemoveMessage(id=REMOVE_ALL_MESSAGES)`로 지운 뒤 새 목록으로 교체한다.

여기서 중요한 점은 "파이썬 리스트를 자르는 것"만으로 끝나지 않는다는 것이다.
LangChain agent 상태는 message reducer를 통해 누적되므로, 오래된 항목을 실제 graph state에서 치우려면 명시적인 삭제 이벤트가 필요하다.

## runnable 예제: 최근 문맥만 남기는 before_model middleware

아래 예제는 시스템 메시지는 유지하고, 나머지 메시지는 토큰 기준으로 잘라 최근 문맥만 남기는 가장 실용적인 패턴이다.

```python
from typing import Any

from langchain.agents import AgentState, create_agent
from langchain.agents.middleware import before_model
from langchain.messages import RemoveMessage, trim_messages
from langchain_core.messages.utils import count_tokens_approximately
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph.message import REMOVE_ALL_MESSAGES
from langgraph.runtime import Runtime


@before_model
def keep_recent_context(
    state: AgentState, runtime: Runtime
) -> dict[str, Any] | None:
    """Trim message history before each model call."""
    messages = state["messages"]

    if len(messages) <= 6:
        return None

    system_messages = [m for m in messages if m.type == "system"]
    non_system_messages = [m for m in messages if m.type != "system"]

    trimmed_non_system = trim_messages(
        non_system_messages,
        strategy="last",
        token_counter=count_tokens_approximately,
        max_tokens=1200,
        start_on="human",
        end_on=("human", "tool"),
        include_system=False,
    )

    new_messages = [*system_messages, *trimmed_non_system]

    if len(new_messages) == len(messages):
        return None

    return {
        "messages": [
            RemoveMessage(id=REMOVE_ALL_MESSAGES),
            *new_messages,
        ]
    }


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[],
    system_prompt=(
        "You are a concise support assistant. Keep answers short and actionable."
    ),
    middleware=[keep_recent_context],
    checkpointer=InMemorySaver(),
)

config: RunnableConfig = {"configurable": {"thread_id": "support-session-1"}}

agent.invoke({"messages": [{"role": "user", "content": "내 이름은 준영이야."}]}, config)
agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "오늘 오전에 얘기했던 장애 대응 체크리스트를 다시 정리해줘.",
            }
        ]
    },
    config,
)
agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "이번에는 너무 길지 않게 3단계로 줄여줘.",
            }
        ]
    },
    config,
)
```

이 패턴에서 실무적으로 중요한 점은 세 가지다.

- trimming은 매 turn 직전 `before_model`에서 일어난다
- `checkpointer + thread_id`가 있어야 줄인 히스토리가 turn 간 유지된다
- tool result가 섞인 히스토리도 message 타입 경계를 맞춰 남겨야 한다

## 왜 `trim_messages`와 `RemoveMessage`를 같이 써야 하나

둘의 역할이 다르다.

`trim_messages(...)`:

- 어떤 메시지를 남길지 계산한다
- `strategy`, `max_tokens`, `start_on`, `end_on` 같은 규칙을 담는다

`RemoveMessage(...)`:

- graph state에서 기존 메시지를 실제로 지우는 업데이트를 만든다
- 단순히 "모델 호출 직전 입력만 줄이는 것"이 아니라 이후 turn에 저장될 상태 자체를 바꾼다

즉 `trim_messages`만 쓰고 `RemoveMessage`를 안 쓰면, 그 턴의 모델 입력은 짧아져도 누적 상태가 계속 비대해질 수 있다.

## `start_on`과 `end_on`을 왜 신경 써야 하나

공식 문서가 trimming과 deletion 예제에서 반복해서 강조하는 부분이 메시지 히스토리의 유효성이다.
특히 tool call이 들어간 agent에서는 아래 두 조건이 자주 문제를 만든다.

- 어떤 provider는 첫 메시지가 `user`여야 한다
- 대부분의 provider는 `assistant`의 tool call 뒤에 대응하는 `tool` result가 바로 따라와야 한다

그래서 `trim_messages(...)`를 쓸 때도 무조건 "마지막 N개"만 남기는 것보다 경계를 의식하는 편이 안전하다.

```python
trimmed = trim_messages(
    messages,
    strategy="last",
    token_counter=count_tokens_approximately,
    max_tokens=1200,
    start_on="human",
    end_on=("human", "tool"),
)
```

이 설정은 보통 아래 의도를 반영한다.

- 시작은 사람이 말한 지점부터 잡는다
- 마지막 메시지는 `human` 또는 `tool`에서 끊어 비정상적인 tool-call 쌍 분리를 줄인다

## trimming과 summarization은 어떻게 고를까

둘 다 긴 히스토리 대응이지만 목적이 다르다.

`trim_messages`가 더 나은 경우:

- 최근 문맥만 있으면 된다
- 추가 모델 호출 없이 비용을 바로 줄이고 싶다
- 규칙이 단순해 예측 가능성이 중요하다

`SummarizationMiddleware`가 더 나은 경우:

- 오래된 사실을 잃으면 안 된다
- 사용자의 이름, 선호, 이전 결정 같은 정보가 뒤 turn에도 중요하다
- 약간의 비용을 더 내더라도 의미를 압축해 보존하고 싶다

실무에서는 trimming으로 먼저 비용과 지연을 줄인 뒤, 정보 손실이 실제 문제로 드러날 때 summarization으로 올리는 순서가 대체로 안전하다.

## 자주 막히는 포인트

### 1. system 메시지까지 같이 날려 버린다

에이전트 정책, 응답 형식, 안전 규칙이 system prompt에 있다면 trimming 후 품질이 급격히 흔들린다.
최근 대화만 자르고 system 메시지는 따로 보존하는 편이 안전하다.

### 2. `thread_id`만 넣고 checkpointer는 안 둔다

`thread_id`는 저장 위치를 식별할 뿐이다.
실제 상태 유지와 메시지 교체는 checkpointer가 담당하므로 둘 다 있어야 multi-turn trimming이 의미를 가진다.

### 3. tool call과 tool result를 분리한 채 잘라 버린다

assistant가 도구 호출을 한 메시지만 남고, 그 결과를 담은 `tool` 메시지가 잘려 나가면 이후 모델 호출이 이상해질 수 있다.
tool-heavy agent일수록 `end_on=("human", "tool")` 같은 경계 설정을 적극적으로 검토해야 한다.

### 4. 토큰 계산 함수를 너무 정확하게만 보려 한다

운영 초반에는 `count_tokens_approximately` 정도로도 충분한 경우가 많다.
대부분의 목적은 완벽한 회계가 아니라 "컨텍스트가 터지기 전에 충분히 빨리 줄이는 것"이기 때문이다.

### 5. 정보를 잃어버리는 문제를 trimming만으로 해결하려 한다

사용자 선호나 이전 결정을 계속 기억해야 하는 제품이라면 trimming만으로는 한계가 있다.
이 경우는 summarization이나 long-term memory store를 같이 설계해야 한다.

## 운영 팁

처음 도입할 때는 아래 순서가 실용적이다.

1. `before_model` + `trim_messages`로 최근 몇 turn만 남긴다
2. LangSmith trace에서 실제 어떤 메시지가 잘리는지 확인한다
3. tool call 경계가 깨지면 `start_on`, `end_on` 조건을 조정한다
4. 그래도 중요한 정보 손실이 남으면 summarization을 추가한다

즉 trimming은 "영구 기억"이 아니라 "모델 입력 정리"에 가깝다.
이 관점을 분명히 잡고 쓰면 비용과 지연을 줄이면서도 agent 동작을 꽤 안정적으로 유지할 수 있다.

## 참고 자료

- [LangChain Short-term memory](https://docs.langchain.com/oss/python/langchain/short-term-memory)
- [LangChain Messages](https://docs.langchain.com/oss/python/langchain/messages)
- [LangChain Custom middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
- [LangChain v1 release notes](https://docs.langchain.com/oss/python/releases/langchain-v1)
