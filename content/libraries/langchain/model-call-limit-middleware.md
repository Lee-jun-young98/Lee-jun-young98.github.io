---
title: "LangChain ModelCallLimitMiddleware로 에이전트 모델 호출 상한 걸기"
description: "LangChain의 ModelCallLimitMiddleware로 run_limit, thread_limit, exit_behavior를 설정해 에이전트의 과도한 모델 호출과 무한 루프를 막는 방법을 정리한 한국어 학습 노트"
date: 2026-06-14
tags:
  - langchain
  - agent
  - python
  - middleware
  - guardrails
aliases:
  - "/blog/langchain-model-call-limit-middleware"
---

# LangChain ModelCallLimitMiddleware로 에이전트 모델 호출 상한 걸기

LangChain 에이전트를 운영하다 보면 가장 먼저 터지는 문제 중 하나가 "도구 호출이 아니라 모델 호출이 너무 많이 돈다"는 점이다. 모델이 답을 내지 못하고 계속 생각만 하거나, 실패한 도구 결과를 받고 다시 모델을 반복 호출하면서 비용과 지연이 빠르게 커질 수 있다.

이때 `ModelCallLimitMiddleware`를 붙이면 한 번의 실행(`run`) 안에서, 또는 같은 대화 스레드(`thread`) 전체에서 모델 호출 횟수 상한을 걸 수 있다. 2026년 6월 14일 기준 LangChain 공식 문서에서도 이 미들웨어를 과도한 비용과 무한 루프 방지용 기본 안전장치로 소개한다.

이 글에서는 아래만 실무 기준으로 정리한다.

- `run_limit`과 `thread_limit`의 차이
- `checkpointer`가 왜 필요한지
- `exit_behavior="end"`와 `"error"`를 언제 쓰는지
- 실제 운영에서 자주 하는 실수

## 언제 필요한가

다음 상황이면 초기에 붙여 둘 가치가 높다.

- 도구 실패 후 모델이 재시도 설명만 반복하는 에이전트
- 멀티턴 대화에서 한 사용자가 지나치게 많은 모델 호출을 유발할 수 있는 제품
- 비용 한도나 응답 시간 상한이 중요한 고객지원, 사내 업무 자동화 에이전트
- 테스트 중 무한 루프성 동작을 빠르게 잡고 싶은 경우

`ToolCallLimitMiddleware`가 도구 호출 횟수를 제한한다면, `ModelCallLimitMiddleware`는 그 바깥의 모델 루프 자체를 제한한다고 보면 이해가 쉽다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "langchain[openai]" langgraph
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 가장 작은 예제

공식 문서 기준 최소 형태는 아래와 같다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware
from langgraph.checkpoint.memory import InMemorySaver

agent = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[],
    checkpointer=InMemorySaver(),  # thread_limit를 쓰려면 필요
    middleware=[
        ModelCallLimitMiddleware(
            thread_limit=10,
            run_limit=5,
            exit_behavior="end",
        )
    ],
)
```

핵심 파라미터는 세 개다.

- `run_limit`: 한 번의 `agent.invoke(...)` 안에서 허용할 최대 모델 호출 수
- `thread_limit`: 같은 `thread_id`로 이어지는 대화 전체에서 허용할 최대 모델 호출 수
- `exit_behavior`: 제한에 걸렸을 때 종료 방식

## 2. `run_limit`은 한 턴 예산이다

`run_limit`은 "이번 사용자 요청 한 번 처리하는 동안 모델이 몇 번까지 생각할 수 있나"를 제한한다.

예를 들어 검색 도구가 실패하거나 모델이 계속 도구 선택을 망설이는 상황을 막고 싶다면 `run_limit`부터 거는 편이 좋다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware
from langchain.tools import tool


@tool
def flaky_search(query: str) -> str:
    """가끔 실패하는 검색 도구."""
    raise RuntimeError("temporary upstream error")


agent = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[flaky_search],
    middleware=[
        ModelCallLimitMiddleware(
            run_limit=3,
            exit_behavior="end",
        )
    ],
)
```

이 설정이면 한 번의 요청에서 모델이 무한히 다시 호출되는 것을 막을 수 있다.

## 3. `thread_limit`은 대화 전체 예산이다

`thread_limit`은 같은 `thread_id`를 공유하는 대화 전체에서 누적 모델 호출 수를 제한한다. 이 값은 여러 턴에 걸쳐 유지되므로, 공식 문서 기준 `checkpointer`가 필요하다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware
from langgraph.checkpoint.memory import InMemorySaver

agent = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[],
    checkpointer=InMemorySaver(),
    middleware=[
        ModelCallLimitMiddleware(
            thread_limit=20,
            exit_behavior="end",
        )
    ],
)

config = {"configurable": {"thread_id": "support-user-42"}}

agent.invoke(
    {"messages": [{"role": "user", "content": "내 요금제 알려줘"}]},
    config=config,
)

agent.invoke(
    {"messages": [{"role": "user", "content": "환불 조건도 정리해줘"}]},
    config=config,
)
```

## 4. `exit_behavior`는 운영 정책에 맞춰 고른다

공식 문서 기준 `ModelCallLimitMiddleware`의 `exit_behavior`는 `"end"` 또는 `"error"`를 쓴다.

### `exit_behavior="end"`

에이전트를 예외 없이 종료하고 싶을 때 쓴다.

- 사용자-facing 챗봇
- 비용 상한 도달 시 조용히 멈추고 싶은 경우
- 운영 중 500 에러보다 graceful stop이 나은 경우

### `exit_behavior="error"`

호출 제한 초과를 애플리케이션 코드에서 명시적으로 잡고 싶을 때 쓴다.

- 테스트 환경
- 내부 배치/오케스트레이션 시스템
- 상한 도달 자체를 실패 신호로 보고 알람을 보내야 하는 경우

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ModelCallLimitMiddleware

agent = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[],
    middleware=[
        ModelCallLimitMiddleware(
            run_limit=2,
            exit_behavior="error",
        )
    ],
)
```

## 5. `ToolCallLimitMiddleware`와 같이 쓰면 더 안정적이다

모델 호출 수와 도구 호출 수는 다른 문제다.  
그래서 아래처럼 둘을 같이 두면 운영 안전성이 높아진다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import (
    ModelCallLimitMiddleware,
    ToolCallLimitMiddleware,
)

agent = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[search_tool, calculator_tool],
    middleware=[
        ModelCallLimitMiddleware(run_limit=4, thread_limit=20, exit_behavior="end"),
        ToolCallLimitMiddleware(tool_name="search_tool", run_limit=2, exit_behavior="continue"),
    ],
)
```

## 자주 하는 실수

### 1. `thread_limit`를 쓰면서 `checkpointer`를 빼먹기

공식 문서 기준 thread 단위 제한은 여러 턴에 걸친 상태를 기억해야 한다.

### 2. `thread_id`를 매번 새로 만들어서 누적 제한이 안 걸리기

같은 사용자의 대화를 계속 같은 세션으로 보려면 같은 `thread_id`를 재사용해야 한다.

### 3. 너무 작은 `run_limit`로 정상 루프까지 잘라 버리기

도구를 한두 번 거쳐야 하는 에이전트인데 `run_limit=1`이나 `2`를 걸면 정상적인 tool calling 패턴도 막을 수 있다.

### 4. 모델 제한과 도구 제한을 같은 것으로 생각하기

모델 호출 상한만으로는 검색 API 폭주를 못 막고, 도구 호출 상한만으로는 모델이 계속 생각만 하는 루프를 못 막는다.

## 실전 추천 시작점

1. 단순 챗봇: `run_limit=3`
2. 도구가 1~2개 있는 지원 에이전트: `run_limit=4~6`
3. 멀티턴 대화 제어: `thread_limit=20~50` + 안정적인 `thread_id`
4. 사용자 서비스: `exit_behavior="end"`
5. 테스트/내부 잡: `exit_behavior="error"`

정답은 없고, LangSmith trace로 실제 평균 모델 호출 수를 본 뒤 조정하는 것이 가장 안전하다.

## 참고 자료

- [LangChain built-in middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [LangChain middleware overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)
- [LangChain agents](https://docs.langchain.com/oss/python/langchain/agents)
