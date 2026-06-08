---
title: LangChain ModelRetryMiddleware로 모델 호출 재시도 자동화하기
description: LangChain ModelRetryMiddleware로 일시적인 모델 API 실패를 재시도하고 on_failure, retry_on, backoff 설정을 실무적으로 구성하는 방법 정리
date: 2026-06-08
tags:
  - langchain
  - agent
  - middleware
  - reliability
  - python
---

# LangChain ModelRetryMiddleware로 모델 호출 재시도 자동화하기
LangChain 에이전트를 운영하다 보면 tool보다 먼저 흔들리는 것이 모델 호출 자체일 때가 있다.

- 모델 provider가 잠깐 `429`를 반환한다
- 네트워크가 일시적으로 끊기거나 timeout이 난다
- 같은 요청을 몇 초 뒤 다시 보내면 통과되는데 지금 turn만 실패한다

이럴 때 매번 agent 바깥에서 try/except와 sleep을 감싸기 시작하면 호출 정책이 흩어진다.  
LangChain은 이런 상황을 위해 `ModelRetryMiddleware`를 제공한다.

이번 글에서는 아래만 실무 기준으로 빠르게 정리한다.

- `ModelRetryMiddleware`를 언제 붙이면 좋은가
- 최소 예제로 동작 방식 이해하기
- `retry_on`, `on_failure`, backoff 옵션을 어떻게 고를지
- 모델 객체 자체의 `max_retries`와 무엇이 다른지
- `ModelFallbackMiddleware`와 어떻게 조합하면 좋은지

## 언제 쓰면 좋은가
`ModelRetryMiddleware`는 "같은 모델로 한 번 더 호출하면 성공할 가능성이 있는 실패"에 맞다.

- 짧은 네트워크 장애
- 일시적 rate limit
- provider의 순간적인 5xx 오류
- 프록시나 게이트웨이 timeout

반대로 아래는 재시도보다 원인 수정이 먼저다.

- 잘못된 API 키나 권한 오류
- 존재하지 않는 모델 이름
- 입력이 너무 커서 항상 실패하는 요청
- provider 정책에 막히는 요청

핵심은 "다시 보내면 통과될 실패인지"를 먼저 구분하는 것이다.

## 사전 준비
공식 문서 기준으로 `ModelRetryMiddleware`는 LangChain Python agent middleware이며 현재 reference에는 `langchain` v1.3.1, `Since v1.1`로 표시되어 있다.

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
공식 prebuilt middleware 문서 기준으로 기본값은 `max_retries=2`, `backoff_factor=2.0`, `initial_delay=1.0`, `max_delay=60.0`, `jitter=True`다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRetryMiddleware
from langchain.tools import tool


@tool
def search_docs(query: str) -> str:
    """간단한 문서 검색 도구."""
    return f"docs result for: {query}"


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[search_docs],
    middleware=[ModelRetryMiddleware()],
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "LangChain middleware 종류를 짧게 정리해줘",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

이 설정이면 모델 호출이 예외로 실패했을 때 middleware가 자동으로 재시도한다.  
성공하면 agent는 평소와 똑같이 진행되고, 재시도가 모두 소진되면 마지막 실패 처리로 넘어간다.

## 2. 어떤 실패만 재시도할지 좁히기
공식 reference에서 `retry_on` 기본값은 `(Exception,)`이다.  
즉 기본 설정만 두면 모든 예외가 재시도 대상이 될 수 있다.

실무에서는 범위를 줄이는 편이 안전하다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRetryMiddleware


def should_retry(error: Exception) -> bool:
    status_code = getattr(error, "status_code", None)

    if status_code in (429, 500, 502, 503, 504):
        return True

    if isinstance(error, TimeoutError):
        return True

    return False


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    middleware=[
        ModelRetryMiddleware(
            max_retries=3,
            retry_on=should_retry,
            initial_delay=1.0,
            backoff_factor=2.0,
        )
    ],
)
```

이 패턴의 장점은 명확하다.

- `401`, `403` 같은 권한 오류를 헛되이 반복하지 않는다
- 잘못된 요청 포맷을 재시도하지 않는다
- 진짜 일시 장애에만 retry budget을 쓴다

## 3. 최종 실패를 agent가 어떻게 다루게 할지 정하기
공식 reference 기준 `on_failure`는 세 가지 방식이 있다.

- `"continue"`: 기본값, 에러 내용을 담은 `AIMessage`를 반환해 agent가 계속 진행할 수 있게 한다
- `"error"`: 예외를 다시 던져 실행을 멈춘다
- callable: 커스텀 에러 메시지를 만들어 반환한다

사용자-facing assistant라면 `"continue"`나 커스텀 formatter가 편한 경우가 많다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRetryMiddleware


def format_model_error(error: Exception) -> str:
    return (
        "모델 호출이 반복해서 실패했습니다. "
        "확인되지 않은 내용을 추측하지 말고 잠시 후 다시 시도해달라고 안내하세요. "
        f"(error={error})"
    )


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    middleware=[
        ModelRetryMiddleware(
            max_retries=2,
            retry_on=(TimeoutError,),
            on_failure=format_model_error,
        )
    ],
)
```

반대로 배치 작업이나 API 서버 안쪽이라면 실패를 조용히 삼키지 않고 `on_failure="error"`로 surface하는 편이 낫다.

```python
ModelRetryMiddleware(
    max_retries=2,
    on_failure="error",
)
```

## 4. backoff는 어떻게 잡는가
공식 문서의 계산식은 `initial_delay * (backoff_factor ** retry_number)`이며 `max_delay`가 상한을 건다. `jitter=True`면 지연 시간에 `±25%` 랜덤 값이 섞인다.

대부분의 대화형 agent는 아래 정도에서 시작해도 무난하다.

```python
ModelRetryMiddleware(
    max_retries=2,
    initial_delay=0.5,
    backoff_factor=2.0,
    max_delay=8.0,
    jitter=True,
)
```

이렇게 두는 이유는 단순하다.

- 첫 실패는 금방 복구될 수 있으니 짧게 기다린다
- 반복 실패면 조금 더 천천히 재시도한다
- 여러 worker가 동시에 몰릴 때 jitter로 스파이크를 줄인다

반대로 사용자가 답을 기다리는 채팅 UI에서 `max_retries=5`와 긴 delay를 바로 넣으면 체감 지연이 과해질 수 있다.

## 5. 모델 객체의 `max_retries`와 무엇이 다른가
여기서 많이 헷갈린다.  
LangChain 모델 문서에 따르면 chat model 자체도 기본적으로 network error, `429`, `5xx`에 대해 자동 재시도를 수행하며 기본 `max_retries`는 6이다.

즉 retry는 두 층에 존재할 수 있다.

### 모델 객체 레벨 retry

- 개별 provider integration이 처리한다
- 네트워크, rate limit, server error 같은 transport/provider 성격의 실패에 가깝다
- `init_chat_model(..., max_retries=...)` 또는 provider 모델 초기화 옵션으로 조정한다

### agent middleware 레벨 retry

- agent 호출 정책으로 재시도를 통일한다
- 어떤 예외만 재시도할지 `retry_on`으로 더 세밀하게 제어할 수 있다
- 최종 실패를 `AIMessage`로 계속 흘릴지, 예외로 중단할지 `on_failure`로 정할 수 있다

실무적으로는 둘을 중복으로 크게 잡지 않는 편이 좋다.  
모델 내부 retry가 이미 충분한데 middleware까지 과하게 걸면 실제 대기 시간이 예상보다 훨씬 길어질 수 있다.

## 6. `ModelFallbackMiddleware`와의 조합
역할 분리를 이렇게 보면 깔끔하다.

- `ModelRetryMiddleware`: 같은 모델에 다시 시도
- `ModelFallbackMiddleware`: 그래도 실패하면 다른 모델로 전환

공식 agents 문서와 middleware reference를 같이 보면 이 조합이 가장 자연스럽다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import (
    ModelFallbackMiddleware,
    ModelRetryMiddleware,
)


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[],
    middleware=[
        ModelRetryMiddleware(
            max_retries=2,
            retry_on=(TimeoutError,),
            on_failure="error",
        ),
        ModelFallbackMiddleware(
            "openai:gpt-5.4-mini",
            "anthropic:claude-sonnet-4-5-20250929",
        ),
    ],
)
```

이 흐름이면 보통 다음 순서가 된다.

1. 주 모델에서 짧게 재시도한다
2. 그래도 안 되면 예외를 올린다
3. fallback middleware가 다음 모델을 시도한다

사용자 대면 서비스에서는 이 패턴이 비용, 지연, 가용성 균형이 좋다.

## 흔한 실수
### 1. 모든 예외를 재시도한다
입력 오류, 권한 오류, 정책 위반까지 반복하면 비용과 지연만 늘어난다.

### 2. 모델 내부 retry와 middleware retry를 둘 다 크게 잡는다
예상은 "두세 번 retry"였는데 실제로는 provider 레벨과 agent 레벨이 겹쳐 수 초에서 수십 초까지 늘어날 수 있다.

### 3. 최종 실패 UX를 설계하지 않는다
`on_failure="continue"`를 쓰면서도 어떤 문구가 사용자에게 보일지 생각하지 않으면 어색한 에러 메시지가 그대로 노출된다.

### 4. fallback과 retry 역할을 섞는다
일시 장애는 retry가 먼저고, 모델 또는 provider 자체 장애는 fallback이 먼저 해결한다. 둘을 분리해 두는 편이 trace도 읽기 쉽다.

## 운영 팁
- 대화형 agent는 `max_retries=1~2`부터 시작하고 trace를 본 뒤 늘리는 편이 낫다.
- `retry_on`은 timeout, `429`, `5xx`처럼 정말 일시적인 실패만 남겨두는 쪽이 안전하다.
- fallback을 함께 쓴다면 retry는 짧게, fallback 순서는 명확하게 둔다.
- LangSmith trace에서 "주 모델 실패 -> retry -> fallback" 흐름이 보이도록 로그와 태깅을 같이 관리하면 원인 분석이 쉬워진다.

## 마무리
`ModelRetryMiddleware`는 "모델 호출이 잠깐 흔들릴 때 agent 코드 전체를 더럽히지 않고 복구 정책을 한곳에 모으는 방법"에 가깝다.

- 같은 모델로 잠깐 버텨볼지
- 어느 실패만 다시 시도할지
- 최종 실패를 사용자에게 어떻게 보여줄지

이 세 가지를 명확히 정하면 LangChain agent의 운영 안정성이 꽤 올라간다.  
그리고 모델 장애가 조금 더 크다면 그 다음 단계는 `ModelFallbackMiddleware`다.

## 참고 자료

- [LangChain Prebuilt Middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [LangChain ModelRetryMiddleware Reference](https://reference.langchain.com/python/langchain/agents/middleware/model_retry/ModelRetryMiddleware)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain Models](https://docs.langchain.com/oss/python/langchain/models)
