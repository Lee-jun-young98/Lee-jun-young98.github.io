---
title: LangChain ToolRetryMiddleware로 실패하는 도구 호출 재시도하기
description: LangChain ToolRetryMiddleware로 외부 API나 네트워크 의존 도구의 일시적 실패를 재시도하고, 실패 시 에이전트가 어떻게 복구할지 설계하는 실전 가이드
date: 2026-06-02
tags:
  - langchain
  - agent
  - middleware
  - reliability
  - python
---

# LangChain ToolRetryMiddleware로 실패하는 도구 호출 재시도하기

LangChain 에이전트를 실전 서비스에 붙이면 모델보다 먼저 흔들리는 쪽은 도구 호출인 경우가 많다.

- 외부 API가 순간적으로 `429`, `503`을 반환한다
- 검색 도구가 타임아웃으로 실패한다
- 사내 DB 프록시가 잠깐 끊겼다가 곧 복구된다

이럴 때 매번 tool 함수 안에 직접 retry 로직을 넣으면 코드가 금방 지저분해진다.  
LangChain v1은 이런 문제를 agent 레이어에서 처리하도록 `ToolRetryMiddleware`를 제공한다.

이번 글에서는 아래만 실전 기준으로 정리한다.

- `ToolRetryMiddleware`가 필요한 상황
- 가장 작은 동작 예제
- 특정 도구에만 retry를 거는 방법
- `retry_on`, `on_failure`, backoff 옵션을 어떻게 고를지
- 자주 생기는 운영 실수

## 언제 쓰는가

`ToolRetryMiddleware`는 "실패해도 다시 한 번 시도할 가치가 있는 도구"에 적합하다.

- 웹 검색, REST API 호출, 벡터 DB 조회처럼 네트워크 의존성이 큰 도구
- 간헐적으로 rate limit이나 timeout이 나는 도구
- 동일 입력으로 다시 호출해도 부작용이 거의 없는 읽기성 도구

반대로 아래 상황에는 보수적으로 써야 한다.

- 결제, 주문 생성, 메일 발송처럼 중복 실행이 위험한 쓰기성 도구
- 한 번 실패한 원인이 입력 오류인 경우
- 재시도할수록 비용이 크게 커지는 유료 외부 API

핵심은 "재시도 가능성"보다 "중복 호출이 안전한가"를 먼저 따지는 것이다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

OpenAI 예시:

```bash
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 가장 작은 예제

공식 문서 기준으로 `ToolRetryMiddleware`는 tool 실패를 자동 재시도하고, 재시도 횟수를 넘기면 기본적으로 `ToolMessage`를 반환해 모델이 실패를 해석하게 만든다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ToolRetryMiddleware
from langchain.tools import tool


attempts = {"count": 0}


@tool
def flaky_search(query: str) -> str:
    """일시적으로 실패할 수 있는 검색 도구."""
    attempts["count"] += 1

    if attempts["count"] < 3:
        raise TimeoutError("search backend timed out")

    return f"{query} 검색 성공"


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[flaky_search],
    middleware=[
        ToolRetryMiddleware(
            max_retries=3,
            initial_delay=1.0,
            backoff_factor=2.0,
        )
    ],
    system_prompt="도구가 실패하더라도 가능한 한 복구해서 답하라.",
)

result = agent.invoke(
    {
        "messages": [
            {"role": "user", "content": "LangChain middleware를 검색해줘"}
        ]
    }
)

print(result["messages"][-1].content)
```

이 예제에서 실제 흐름은 다음과 같다.

1. 모델이 `flaky_search`를 호출한다.
2. 첫 번째와 두 번째 호출은 `TimeoutError`로 실패한다.
3. middleware가 지수 백오프로 재시도한다.
4. 세 번째 호출에서 성공하면 그 결과를 그대로 agent loop에 넘긴다.

즉, tool 함수마다 `for retry in ...`를 넣지 않아도 agent 레벨에서 복구 정책을 통일할 수 있다.

## 2. 특정 도구에만 retry 걸기

모든 도구를 같은 기준으로 재시도하면 위험하다.  
읽기성 검색 도구는 재시도해도 되지만, 메일 발송 도구는 그러면 안 된다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ToolRetryMiddleware
from langchain.tools import tool


@tool
def search_docs(query: str) -> str:
    """문서를 검색한다."""
    raise ConnectionError("temporary search outage")


@tool
def send_email(to: str, subject: str, body: str) -> str:
    """이메일을 발송한다."""
    return f"sent email to={to}"


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[search_docs, send_email],
    middleware=[
        ToolRetryMiddleware(
            tools=["search_docs"],
            max_retries=2,
            retry_on=(ConnectionError, TimeoutError),
        )
    ],
)
```

여기서는 `search_docs`에만 retry가 적용된다.

- `tools=["search_docs"]`: 지정한 도구만 재시도
- `retry_on=(ConnectionError, TimeoutError)`: 진짜 일시적 실패만 재시도

이 패턴이 실무에서 가장 안전하다.  
처음부터 전체 도구에 blanket retry를 거는 것보다, 읽기성 도구만 명시적으로 묶는 편이 낫다.

## 3. 실패 시 에이전트를 어떻게 복구시킬까

공식 문서 기준 `on_failure` 기본값은 `"return_message"`다.  
즉, 모든 재시도가 끝나도 실패하면 예외를 그대로 터뜨리는 대신 `ToolMessage`를 모델에게 넘겨서 다음 행동을 결정하게 만든다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ToolRetryMiddleware
from langchain.tools import tool


@tool
def unstable_weather(city: str) -> str:
    """날씨 API를 조회한다."""
    raise TimeoutError("weather upstream timeout")


def format_tool_error(error: Exception) -> str:
    return (
        "weather 도구가 반복 실패했습니다. "
        "다른 정보 없이 추측하지 말고 사용자에게 재시도를 안내하세요. "
        f"(error={error})"
    )


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[unstable_weather],
    middleware=[
        ToolRetryMiddleware(
            max_retries=2,
            retry_on=(TimeoutError,),
            on_failure=format_tool_error,
        )
    ],
)
```

이렇게 하면 실패 이후에도 agent loop가 완전히 죽지 않고, 모델이 아래처럼 더 안전한 답을 만들 수 있다.

- "현재 날씨 API가 불안정해서 바로 조회하지 못했습니다."
- "잠시 후 다시 시도해 주세요."
- "원하면 일반적인 준비물이나 우천 대비 팁은 안내할 수 있습니다."

반대로 배치 작업이나 내부 자동화처럼 실패를 즉시 surface해야 할 때는 예외를 다시 올리는 편이 낫다.

```python
ToolRetryMiddleware(
    tools=["sync_inventory"],
    max_retries=1,
    on_failure="raise",
)
```

## 4. backoff 옵션은 어떻게 잡나

공식 문서의 핵심 옵션은 아래 다섯 가지다.

- `max_retries`: 초기 호출 이후 몇 번 더 재시도할지
- `initial_delay`: 첫 재시도 전 대기 시간
- `backoff_factor`: 지수 백오프 증가 배수
- `max_delay`: 대기 시간 상한
- `jitter`: 동시 재시도 몰림을 줄이기 위한 랜덤 지터

실무에서 시작점으로는 보통 아래 정도가 무난하다.

```python
ToolRetryMiddleware(
    tools=["search_api"],
    max_retries=2,
    initial_delay=0.5,
    backoff_factor=2.0,
    max_delay=8.0,
    jitter=True,
)
```

이 설정이 잘 맞는 경우:

- 검색이나 조회 실패를 1~2초 안에 복구할 가능성이 높을 때
- 사용자 대기 시간을 너무 길게 늘리고 싶지 않을 때

좀 더 공격적으로 줄일 수 있는 경우:

- 대화형 UX에서 지연에 민감할 때
- 재시도 성공률이 낮아 오래 기다려도 이득이 적을 때

반대로 내부 배치나 야간 동기화 작업이라면 `max_retries`와 `max_delay`를 더 키울 수 있다.

## 5. `retry_on`은 넓게 잡지 말기

공식 문서상 `retry_on` 기본값은 `(Exception,)`이라 사실상 모든 예외를 재시도 대상으로 본다.  
이 기본값을 그대로 쓰면 입력 검증 오류까지 다시 호출할 수 있다.

아래처럼 범위를 줄이는 편이 안전하다.

```python
from langchain.agents.middleware import ToolRetryMiddleware


def should_retry(error: Exception) -> bool:
    if isinstance(error, TimeoutError):
        return True

    status_code = getattr(error, "status_code", None)
    return status_code in (429, 500, 502, 503, 504)


retry_middleware = ToolRetryMiddleware(
    tools=["search_docs"],
    max_retries=3,
    retry_on=should_retry,
)
```

이렇게 하면 아래 같은 실패는 재시도하지 않게 만들 수 있다.

- 사용자 인자가 잘못된 `ValueError`
- 없는 리소스를 찾는 `404`
- 권한 부족 `401`, `403`

즉 "다시 하면 될 실패"와 "다시 해도 안 될 실패"를 분리해야 한다.

## 6. 쓰기성 도구에는 idempotency부터 확인하기

가장 흔한 운영 사고는 재시도 자체보다 "중복 실행"이다.

- 메일이 두 번 발송된다
- 주문 생성이 두 번 들어간다
- 결제 요청이 중복된다

그래서 쓰기성 도구에 retry를 붙이려면 최소한 아래 중 하나는 있어야 한다.

- 외부 API가 idempotency key를 지원한다
- 내부적으로 요청 중복 방지 키를 저장한다
- 이미 처리된 요청인지 확인하는 검증 단계가 있다

예를 들면:

```python
@tool
def create_order(order_id: str, sku: str, qty: int) -> str:
    """중복 방지 키를 사용해 주문을 생성한다."""
    # 실제 구현에서는 order_id를 idempotency key로 전달
    return f"created order order_id={order_id}"
```

이런 준비가 없다면 쓰기성 도구는 middleware retry보다 human approval이나 명시적 복구 플로우가 먼저다.

## 자주 막히는 포인트

### 1. 재시도는 했는데 UX가 더 나빠진다

성공률은 조금 올랐지만 응답 시간이 10초 넘게 늘어나면 대화형 agent에서는 오히려 체감 품질이 떨어진다.  
대화형 경로와 배치 경로의 retry 정책을 분리하는 편이 낫다.

### 2. 모든 예외를 재시도한다

입력 오류, 권한 오류, 비즈니스 규칙 오류를 다시 호출하면 비용만 늘어난다.  
`retry_on`은 좁게 잡는 편이 안전하다.

### 3. tool 내부 retry와 middleware retry를 중복으로 넣는다

tool 함수 안에서도 3번, middleware에서도 3번 재시도하면 실제 호출 수가 예상보다 크게 늘어난다.  
특별한 이유가 없으면 정책은 한 군데에 모으는 편이 낫다.

### 4. 쓰기성 도구에 무심코 적용한다

읽기 도구에서 잘 먹힌 설정을 그대로 주문/메일/결제 도구에 복사하면 사고 난다.  
부작용 있는 도구는 idempotency 검증이 먼저다.

## 마무리

`ToolRetryMiddleware`는 "tool 함수마다 복구 코드를 흩뿌리지 않고", agent 레이어에서 실패 복구 정책을 통일하는 가장 실용적인 방법 중 하나다.

- 읽기성 도구부터 제한적으로 적용하고
- `retry_on`으로 일시적 실패만 골라내고
- `on_failure`로 최종 실패 시 사용자 경험을 설계하면
- LangChain agent의 실전 안정성을 꽤 쉽게 끌어올릴 수 있다

실무에서는 `HumanInTheLoopMiddleware`, `ContextEditingMiddleware`, 모델 fallback과 같이 붙여서 "실패해도 망가지지 않는 agent"를 만드는 방향으로 보는 편이 좋다.

## 참고 자료

- [LangChain Prebuilt Middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [LangChain Middleware Overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)