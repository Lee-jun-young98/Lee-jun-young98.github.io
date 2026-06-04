---
title: LangChain ToolCallLimitMiddleware로 agent tool 호출 한도 걸기
description: LangChain ToolCallLimitMiddleware로 run 단위와 thread 단위의 tool 호출 횟수를 제한하고, 비용 폭주와 무한 루프를 막는 실전 패턴 정리
date: 2026-06-04
tags:
  - langchain
  - agent
  - middleware
  - tools
  - python
---

# LangChain ToolCallLimitMiddleware로 agent tool 호출 한도 걸기

LangChain agent를 실서비스에 붙이면 model 호출 수보다 먼저 비용이 커지는 지점이 tool 호출인 경우가 많다.

- 검색 API를 너무 많이 두드린다
- DB 조회를 반복하면서 같은 질문을 맴돈다
- 웹 스크래퍼를 무한히 재시도하지는 않아도 너무 자주 호출한다

이럴 때 tool 함수마다 직접 카운터를 넣는 대신 LangChain의 `ToolCallLimitMiddleware`로 실행 한도를 공통 정책으로 걸 수 있다.  
공식 문서 기준으로 이 미들웨어는 전체 tool 집합에 대한 전역 제한과 특정 tool별 제한을 모두 지원한다.

이번 글에서는 아래 순서로 정리한다.

- `run_limit`와 `thread_limit`를 언제 다르게 써야 하는지
- 전역 제한과 tool별 제한을 함께 거는 방법
- `exit_behavior`를 어떻게 고를지
- 실무에서 자주 놓치는 체크포인트와 함정

## 언제 필요한가

`ToolCallLimitMiddleware`는 "tool이 실패하느냐"보다 "tool을 너무 많이 부르느냐"가 문제일 때 쓴다.

- 비싼 외부 API 호출 예산을 강제로 묶고 싶을 때
- agent가 검색과 조회를 반복하며 루프에 빠지는 것을 막고 싶을 때
- 같은 대화 스레드에서 특정 tool 사용량을 누적 제한하고 싶을 때
- 운영 환경마다 허용 가능한 tool budget을 다르게 두고 싶을 때

반대로 tool이 일시적으로 실패하는 상황을 복구하는 목적이라면 `ToolRetryMiddleware`가 더 직접적이다.  
두 미들웨어는 경쟁 관계가 아니라 서로 다른 문제를 다룬다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

macOS / Linux:

```bash
export OPENAI_API_KEY="your-api-key"
```

## 1. 가장 단순한 시작점: 한 번의 실행에서 tool 호출 수 제한하기

공식 문서 기준 `run_limit`는 "한 번의 agent invoke 안에서" 허용할 최대 tool 호출 수다.  
즉, 사용자 메시지 하나를 처리하는 동안 tool을 몇 번까지 쓸 수 있는지 정한다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain.tools import tool


@tool
def search_docs(query: str) -> str:
    """문서를 검색한다."""
    return f"docs result for: {query}"


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[search_docs],
    middleware=[
        ToolCallLimitMiddleware(
            run_limit=2,
        )
    ],
    system_prompt="필요할 때만 tool을 호출하고, 이미 찾은 정보는 반복 검색하지 마라.",
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "LangChain middleware에서 tool limit 설정법을 찾아 정리해줘.",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

이 설정이면 agent가 한 번의 응답 과정에서 `search_docs`를 세 번 이상 호출하려 할 때 제한에 걸린다.  
기본 `exit_behavior="continue"`에서는 초과 호출이 에러 메시지 형태로 model에 다시 전달되고, model이 남은 맥락으로 답변을 마무리할지 판단한다.

## 2. thread 전체에 누적 한도 걸기

대화형 agent에서는 "이번 턴"보다 "이 사용자 스레드 전체" 예산이 더 중요할 때가 많다.  
이때는 `thread_limit`를 쓰고, 공식 문서대로 checkpointer를 함께 붙여야 한다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver


@tool
def search_docs(query: str) -> str:
    """문서를 검색한다."""
    return f"docs result for: {query}"


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[search_docs],
    checkpointer=InMemorySaver(),
    middleware=[
        ToolCallLimitMiddleware(
            thread_limit=5,
            run_limit=2,
        )
    ],
)

config = {"configurable": {"thread_id": "support-thread-001"}}

agent.invoke(
    {"messages": [{"role": "user", "content": "에이전트 미들웨어 문서를 찾아줘."}]},
    config=config,
)

agent.invoke(
    {"messages": [{"role": "user", "content": "이번엔 tool limit 부분만 다시 찾아줘."}]},
    config=config,
)
```

핵심은 두 가지다.

- `run_limit=2`: 각 턴마다 최대 2회
- `thread_limit=5`: 같은 `thread_id` 전체에서 누적으로 최대 5회

즉, 한 턴에서 과하게 쓰는 것도 막고 긴 대화에서 예산이 새는 것도 막는다.

## 3. 전체 tool 제한과 특정 tool 제한 함께 쓰기

실무에서는 보통 모든 tool에 대한 전역 제한 하나와, 특히 비싼 tool에 대한 개별 제한 하나를 같이 둔다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ToolCallLimitMiddleware
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver


@tool
def search_docs(query: str) -> str:
    """문서를 검색한다."""
    return f"docs result for: {query}"


@tool
def query_database(question: str) -> str:
    """내부 데이터베이스를 조회한다."""
    return f"db result for: {question}"


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[search_docs, query_database],
    checkpointer=InMemorySaver(),
    middleware=[
        ToolCallLimitMiddleware(thread_limit=12, run_limit=4),
        ToolCallLimitMiddleware(
            tool_name="search_docs",
            thread_limit=4,
            run_limit=2,
        ),
    ],
)
```

이 구조는 다음처럼 해석하면 된다.

- 전체 tool 호출은 한 턴에 4번, 스레드 전체에 12번까지
- 그중에서도 `search_docs`는 더 빡세게 한 턴 2번, 스레드 전체 4번까지

검색은 비싸고 DB 조회는 상대적으로 싸다면 이런 식으로 차등 제한을 두는 편이 현실적이다.

## 4. `exit_behavior`는 운영 UX를 바꾼다

공식 문서 기준 `exit_behavior`에는 세 가지 선택지가 있다.

- `'continue'`: 초과 호출을 막고 model이 나머지 답변을 이어가게 둔다
- `'error'`: 즉시 예외를 던져 실행을 중단한다
- `'end'`: 초과된 tool 호출 지점에서 바로 종료한다

기본값은 `'continue'`다.  
대화형 assistant에서는 보통 이 기본값이 가장 무난하다. 이미 가진 정보로 답을 정리하거나 "더 이상 검색 예산이 없다"는 식으로 자연스럽게 마무리할 수 있기 때문이다.

반면 자동화 배치나 내부 운영 도구라면 초과 즉시 실패시키는 편이 더 안전할 수 있다.

```python
ToolCallLimitMiddleware(
    tool_name="scrape_webpage",
    run_limit=1,
    exit_behavior="error",
)
```

`'end'`는 주의가 필요하다.  
공식 문서 기준 이 동작은 단일 tool 제한 시나리오에서만 안전하게 동작하고, 다른 tool 호출이 함께 대기 중이면 `NotImplementedError`가 날 수 있다.

즉, `'end'`는 "이 tool 하나만 넘기면 바로 끝내도 된다"는 흐름에 제한적으로 쓰는 편이 낫다.

## 5. 흔히 놓치는 포인트

### 5-1. `thread_limit`만 걸고 checkpointer를 안 붙인다

공식 문서대로 `thread_limit`는 상태를 스레드 단위로 저장해야 하므로 checkpointer가 필요하다.  
이 구성이 없으면 대화 간 누적 한도가 유지되지 않는다.

### 5-2. `thread_id`를 매번 새로 만든다

checkpointer가 있어도 매번 다른 `thread_id`를 쓰면 사실상 누적 제한이 사라진다.  
사용자 세션 또는 대화 단위를 기준으로 안정적인 `thread_id`를 유지해야 한다.

### 5-3. 제한 초과를 막는 것과 tool 선택을 잘하는 것을 혼동한다

`ToolCallLimitMiddleware`는 "너무 많이 부르는 것"을 막아준다.  
하지만 애초에 불필요한 tool이 많이 노출되어 있으면 model은 여전히 잘못된 선택을 시도할 수 있다.

그래서 보통 아래 조합이 잘 맞는다.

- `wrap_model_call` 기반 tool filtering
- `ToolCallLimitMiddleware`
- 필요하면 `HumanInTheLoopMiddleware`

### 5-4. 모든 tool에 같은 한도를 복사한다

검색, 결제, 메일 발송, 내부 DB 조회는 비용과 위험이 다르다.  
전역 제한 하나만 두고 끝내기보다, 비싼 tool과 위험한 tool은 별도 `tool_name` 제한을 추가하는 편이 운영상 낫다.

### 5-5. limit 초과 이후 사용자 경험을 설계하지 않는다

`continue`를 쓰면 model이 제한 초과 메시지를 보고 답을 이어간다.  
이때 system prompt에 "예산 초과 시 이미 수집한 정보만으로 답하고, 모르면 추측하지 말라" 같은 규칙을 넣어두면 결과가 더 안정적이다.

## 어떤 조합으로 시작하면 좋은가

처음 붙일 때는 대개 아래 정도면 충분하다.

```python
middleware = [
    ToolCallLimitMiddleware(thread_limit=8, run_limit=3),
    ToolCallLimitMiddleware(
        tool_name="search_docs",
        thread_limit=4,
        run_limit=2,
    ),
]
```

이후 운영 로그를 보면서 아래 질문으로 조정하면 된다.

- 실제로 초과가 자주 나는 tool이 무엇인가
- 초과가 났을 때 `continue`가 좋은가 `error`가 좋은가
- 전역 한도가 문제인가, 특정 tool 한도가 문제인가

## 마무리

`ToolCallLimitMiddleware`는 LangChain agent에 비용 가드레일을 넣는 가장 단순한 방법 중 하나다.

- `run_limit`로 한 번의 응답 안에서 폭주를 막고
- `thread_limit`로 긴 대화 전체 예산을 묶고
- `tool_name` 제한으로 비싼 tool만 더 엄격하게 관리할 수 있다

특히 공식 문서 기준 `thread_limit`에는 checkpointer가 필요하고, `exit_behavior="end"`는 단일 tool 시나리오에 더 적합하다는 점은 바로 실무에서 걸리는 부분이다.

검색, 스크래핑, 내부 조회가 섞인 agent를 운영하기 시작했다면 `ToolRetryMiddleware` 다음 단계로 붙이기 좋은 미들웨어다.

## 참고 자료

- [LangChain Prebuilt Middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain Custom Middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
