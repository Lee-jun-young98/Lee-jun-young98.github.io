---
title: LangGraph RetryPolicy로 일시 실패 노드만 안전하게 재시도하기
description: LangGraph Graph API에서 RetryPolicy로 외부 API, DB, LLM 호출 노드의 일시 실패만 재시도하고 검증 오류는 바로 실패시키는 실전 패턴 정리
date: 2026-06-11
tags:
  - langgraph
  - agent
  - workflow
  - python
aliases:
  - "/blog/langgraph-retry-policy-node-retries"
---

# LangGraph RetryPolicy로 일시 실패 노드만 안전하게 재시도하기

LangGraph workflow를 실전에 붙이면 LLM, 검색 API, DB, 내부 HTTP 서비스 같은 바깥 의존성이 자주 끼어든다.  
이때 실패를 무조건 한 번에 끝내면 일시적인 네트워크 흔들림에도 workflow 전체가 중단되고, 반대로 아무 예외나 재시도하면 검증 오류까지 반복 호출하게 된다.

LangGraph Graph API에서는 `add_node(..., retry_policy=...)`로 노드 단위 재시도 정책을 붙일 수 있다.  
공식 문서 기준으로 `RetryPolicy`는 재시도 간격, backoff, 최대 시도 횟수, jitter, 어떤 예외를 재시도할지까지 제어한다.

이 글에서는 아래만 실전 기준으로 정리한다.

- `RetryPolicy`를 언제 붙이면 좋은지
- 기본 동작과 `max_attempts` 해석
- 바로 실행해 볼 수 있는 Python 예제
- 재시도 때문에 오히려 장애를 키우는 흔한 실수

## 언제 쓰면 좋은가

아래 같은 노드는 거의 항상 재시도 후보라고 보면 된다.

- 외부 HTTP API 호출 노드
- 벡터 DB, SQL DB 조회 노드
- rate limit이나 일시 오류가 날 수 있는 LLM 호출 노드
- 메시지 큐, 내부 마이크로서비스 호출 노드

반대로 아래는 기본적으로 재시도 대상이 아니다.

- 입력 검증 실패
- 프롬프트나 파라미터 구성 버그
- 잘못된 상태 전이 로직
- 이미 실행되면 안 되는 부작용성 작업

핵심은 "잠깐 후 다시 하면 성공할 가능성이 있는 실패만" 재시도하는 것이다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langgraph
```

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langgraph
```

## 1. 가장 작은 예제

아래 예제는 `fetch_profile` 노드가 처음 두 번은 일시 오류를 내고, 세 번째 시도에서 성공하는 흐름이다.

```python
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy


class ProfileState(TypedDict):
    user_id: str
    profile: str


class TemporaryAPIError(Exception):
    pass


attempt_counter = {"fetch_profile": 0}


def fetch_profile(state: ProfileState):
    attempt_counter["fetch_profile"] += 1
    attempt = attempt_counter["fetch_profile"]
    print(f"fetch_profile attempt={attempt}")

    if attempt < 3:
        raise TemporaryAPIError("upstream API timed out")

    return {"profile": f"profile for {state['user_id']}"}


graph = (
    StateGraph(ProfileState)
    .add_node(
        "fetch_profile",
        fetch_profile,
        retry_policy=RetryPolicy(
            retry_on=TemporaryAPIError,
            initial_interval=0.2,
            backoff_factor=2.0,
            max_attempts=4,
        ),
    )
    .add_edge(START, "fetch_profile")
    .add_edge("fetch_profile", END)
    .compile()
)

result = graph.invoke({"user_id": "user-123"})
print(result)
```

예상 출력은 대략 이런 흐름이다.

```text
fetch_profile attempt=1
fetch_profile attempt=2
fetch_profile attempt=3
{'user_id': 'user-123', 'profile': 'profile for user-123'}
```

여기서 중요한 점은 두 가지다.

- `max_attempts=4`는 "재시도 4번"이 아니라 "전체 시도 4번"이다.
- 노드가 다시 실행될 때는 함수 전체가 다시 돈다.

즉 노드 안에 부작용이 있으면 그 부작용도 반복될 수 있다.

## 2. 검증 오류는 바로 실패시키기

실전에서는 일시 오류와 영구 오류를 분리해야 한다.  
예를 들어 사용자 입력이 잘못된 경우는 재시도해도 결과가 바뀌지 않는다.

```python
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import RetryPolicy


class SearchState(TypedDict):
    query: str
    result: str


class TemporarySearchError(Exception):
    pass


def search_docs(state: SearchState):
    query = state["query"].strip()
    if not query:
        raise ValueError("query must not be empty")

    raise TemporarySearchError("search backend is warming up")


graph = (
    StateGraph(SearchState)
    .add_node(
        "search_docs",
        search_docs,
        retry_policy=RetryPolicy(
            retry_on=TemporarySearchError,
            max_attempts=3,
        ),
    )
    .add_edge(START, "search_docs")
    .add_edge("search_docs", END)
    .compile()
)
```

이 패턴의 의도는 분명하다.

- `ValueError`: 바로 실패
- `TemporarySearchError`: 재시도

공식 문서 기준으로 기본 `retry_on`도 모든 예외를 재시도하지는 않는다.  
기본값은 `ValueError`, `TypeError`, `RuntimeError`, `OSError` 같은 여러 예외를 제외하고 재시도하며, `requests`/`httpx` 계열은 5xx만 재시도한다.

그래도 실전에서는 "기본값에 맡기기"보다 재시도할 예외를 직접 좁히는 편이 안전하다.

## 3. 노드마다 다른 정책을 두기

모든 노드가 같은 강도의 재시도를 가질 필요는 없다.

- DB 조회: 짧고 빠르게 2~3회
- LLM 호출: rate limit을 고려해 더 긴 backoff
- 멱등하지 않은 쓰기 작업: 재시도 금지 또는 별도 보호 장치

예를 들면 이런 식이다.

```python
from langgraph.graph import MessagesState, START, StateGraph
from langgraph.types import RetryPolicy


def read_cache(state: MessagesState):
    ...


def call_model(state: MessagesState):
    ...


builder = StateGraph(MessagesState)
builder.add_node(
    "read_cache",
    read_cache,
    retry_policy=RetryPolicy(max_attempts=2, initial_interval=0.1),
)
builder.add_node(
    "call_model",
    call_model,
    retry_policy=RetryPolicy(max_attempts=5, initial_interval=1.0, backoff_factor=2.0),
)
builder.add_edge(START, "read_cache")
builder.add_edge("read_cache", "call_model")
```

재시도는 workflow 전체 정책이 아니라 노드 책임에 맞춰 붙이는 것이 유지보수에 유리하다.

## 4. 실전에서 가장 중요한 주의점

### 4-1. 부작용 있는 노드를 그대로 재시도하지 말기

노드가 아래 작업을 한다면 그대로 재시도할 때 중복 실행 위험이 있다.

- 결제 승인
- 이메일 발송
- 티켓 생성
- 외부 시스템에 쓰기 요청

이런 작업은 최소한 아래 중 하나가 필요하다.

- idempotency key
- 이미 처리했는지 확인하는 저장소
- 읽기와 쓰기를 별도 노드로 분리

재시도는 실패 복구 도구이지, 중복 실행 방지 장치가 아니다.

### 4-2. 너무 넓은 예외를 재시도하지 말기

`Exception` 전체를 재시도 대상으로 잡으면 버그도 같이 반복된다.  
예를 들어 prompt 변수 누락, 파싱 코드 버그, 잘못된 state shape도 계속 다시 돈다.

가능하면 아래처럼 업무상 의미 있는 예외 타입을 직접 정의하는 편이 낫다.

```python
class TemporaryVectorStoreError(Exception):
    pass


class PermanentConfigurationError(Exception):
    pass
```

### 4-3. `max_attempts`를 과하게 키우지 말기

LLM 호출이나 외부 API 호출에서 `max_attempts`를 크게 잡으면 지연 시간이 급격히 늘어난다.  
특히 여러 노드가 직렬로 이어진 graph에서는 tail latency가 쉽게 폭증한다.

처음에는 보통 아래 정도에서 시작하면 충분하다.

- 짧은 조회 노드: 2~3회
- LLM/API 노드: 3~5회
- 사람이 체감하는 인터랙티브 요청: 가능한 짧게

### 4-4. 재시도 대상과 관측 지표를 같이 설계하기

재시도를 붙였는데 실패가 줄어든 것처럼만 보일 수도 있다.  
실제로는 upstream 품질이 나빠졌는데 workflow가 조용히 버티고 있을 수 있기 때문이다.

최소한 아래는 같이 보는 편이 좋다.

- 노드별 시도 횟수
- 최종 성공까지 걸린 시간
- 재시도 후 성공 비율
- 최종 실패 비율

LangSmith tracing이나 별도 로그를 붙이면 이런 지표를 보기 쉬워진다.

## 5. 정리

LangGraph의 `RetryPolicy`는 "실패하면 다시 돌린다" 수준의 장식이 아니라, 노드의 실패 성격을 명시하는 제어 장치에 가깝다.

- 재시도는 노드 단위로 붙인다
- `max_attempts`는 첫 시도까지 포함한다
- 일시 실패와 영구 실패를 예외 타입으로 분리한다
- 부작용 있는 노드는 멱등성 없이 재시도하지 않는다

LangGraph graph를 운영 환경에 올릴수록 `Command`, `interrupt`, `checkpointer`만큼이나 재시도 설계가 중요해진다.  
특히 외부 API나 LLM을 여러 단계로 엮는 workflow라면 `RetryPolicy`를 초기에 같이 설계하는 편이 훨씬 안전하다.

## 참고 자료

- [LangGraph Graph API - Add retry policies](https://docs.langchain.com/oss/python/langgraph/use-graph-api#add-retry-policies)
- [LangGraph `RetryPolicy` Reference](https://reference.langchain.com/python/langgraph/types/#langgraph.types.RetryPolicy)
- [LangGraph `StateGraph.add_node` Reference](https://reference.langchain.com/python/langgraph/graphs/#langgraph.graph.state.StateGraph.add_node)
