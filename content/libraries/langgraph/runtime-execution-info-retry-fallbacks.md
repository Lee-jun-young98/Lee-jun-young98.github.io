---
title: LangGraph runtime.execution_info로 재시도 차수별 fallback 분기하기
description: LangGraph runtime.execution_info의 node_attempt와 실행 식별자를 이용해 재시도 시 fallback provider, 로깅, 운영 분기를 넣는 실전 패턴 정리
date: 2026-07-05
tags:
  - langgraph
  - workflow
  - python
  - reliability
aliases:
  - /blog/langgraph-runtime-execution-info-retry-fallbacks
---

# LangGraph runtime.execution_info로 재시도 차수별 fallback 분기하기

LangGraph에서 `RetryPolicy`를 붙이면 실패한 node를 다시 시도하는 것까지는 쉽게 만들 수 있습니다.  
하지만 실무에서는 "재시도에 들어갔을 때 행동을 어떻게 바꿀지"가 더 중요할 때가 많습니다.

- 첫 시도는 primary provider로 호출하고, 재시도부터는 fallback provider로 바꾸고 싶다
- 재시도 차수에 따라 timeout, prompt, batch 크기, 로그 레벨을 다르게 두고 싶다
- 운영 로그에 현재 thread, checkpoint, task 식별자를 남기고 싶다

이럴 때 쓰는 값이 `runtime.execution_info`입니다.  
공식 문서 기준으로 이 값은 node 안에서 현재 시도 횟수와 실행 식별자를 읽는 진입점이며, `langgraph>=1.1.3`에서 사용할 수 있습니다.

## 언제 유용한가

다음 같은 node에서 특히 효과가 큽니다.

- 외부 API가 가끔 429, 502, 503을 내는 경우
- provider 장애 시 다른 provider로 우회하고 싶은 LLM 호출
- 같은 로직이라도 재시도에서는 더 보수적인 파라미터를 쓰고 싶은 경우
- 장애 분석을 위해 node 단위 실행 식별자를 구조적으로 남기고 싶은 경우

반대로 입력 검증 오류나 비즈니스 규칙 위반처럼 다시 해도 바뀌지 않을 실패에는 fallback보다 즉시 실패가 맞습니다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "langgraph>=1.1.3"
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U "langgraph>=1.1.3"
```

## `execution_info`에서 먼저 볼 값

공식 fault tolerance 문서 기준으로 `runtime.execution_info`에서 먼저 확인할 값은 아래입니다.

- `node_attempt`: 현재 시도 횟수. 첫 시도는 `1`, 첫 재시도는 `2`
- `node_first_attempt_time`: 첫 시도가 시작된 Unix timestamp. 재시도되어도 유지
- `thread_id`: 현재 thread 식별자. checkpointer가 없으면 `None`
- `run_id`: 현재 실행 식별자. config에 없으면 `None`
- `checkpoint_id`, `task_id`: 현재 실행 단위를 추적할 때 유용한 식별자

실무적으로는 `node_attempt` 하나만 알아도 fallback 분기 대부분을 만들 수 있습니다.

## 가장 작은 runnable 예제

아래 예제는 첫 시도에는 primary API를 쓰고, 첫 시도가 실패해 재시도에 들어가면 자동으로 fallback API를 쓰는 패턴입니다.

```python
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime
from langgraph.types import RetryPolicy


class State(TypedDict, total=False):
    result: str
    provider_used: str


class TemporaryAPIError(Exception):
    pass


attempt_counter = {"primary": 0}


def call_primary_api() -> str:
    attempt_counter["primary"] += 1
    if attempt_counter["primary"] == 1:
        raise TemporaryAPIError("primary provider temporarily unavailable")
    return "primary-success"


def call_fallback_api() -> str:
    return "fallback-success"


def fetch_with_fallback(state: State, runtime: Runtime):
    info = runtime.execution_info

    if info.node_attempt > 1:
        return {
            "result": call_fallback_api(),
            "provider_used": "fallback",
        }

    return {
        "result": call_primary_api(),
        "provider_used": "primary",
    }


builder = StateGraph(State)
builder.add_node(
    "fetch_with_fallback",
    fetch_with_fallback,
    retry_policy=RetryPolicy(
        max_attempts=3,
        initial_interval=0.1,
        retry_on=TemporaryAPIError,
    ),
)
builder.add_edge(START, "fetch_with_fallback")
builder.add_edge("fetch_with_fallback", END)

graph = builder.compile()

result = graph.invoke({})
print(result)
```

예상 결과:

```python
{"result": "fallback-success", "provider_used": "fallback"}
```

흐름은 단순합니다.

1. 첫 시도에서 `call_primary_api()`가 `TemporaryAPIError`를 던진다
2. `RetryPolicy`가 해당 예외를 재시도 대상으로 보고 다시 실행한다
3. 두 번째 진입에서는 `runtime.execution_info.node_attempt == 2`가 된다
4. node 안에서 fallback API로 분기한다

## 운영 로그를 남길 때 같이 보면 좋은 값

`execution_info`는 단순 retry counter가 아니라 실행 컨텍스트이기도 합니다.

```python
def fetch_with_logging(state: State, runtime: Runtime):
    info = runtime.execution_info
    print(
        {
            "attempt": info.node_attempt,
            "thread_id": info.thread_id,
            "run_id": info.run_id,
            "checkpoint_id": info.checkpoint_id,
            "task_id": info.task_id,
        }
    )
    return {"result": "ok"}
```

특히 운영 환경에서는 어느 thread의 어느 checkpoint에서 fallback이 발생했는가를 남겨 두면 장애 분석 속도가 확실히 빨라집니다.

## 재시도 차수별 전략을 어떻게 나눌까

가장 흔한 패턴은 아래 셋입니다.

### 1. provider fallback

- 1회차: primary model 또는 primary API
- 2회차 이후: fallback model, fallback region, fallback endpoint

### 2. 비용 절감형 degradation

- 1회차: 고성능 모델
- 2회차 이후: 더 싼 모델, 더 짧은 prompt, 더 작은 batch

### 3. 디버깅 강화

- 1회차: 일반 로그
- 2회차 이후: 상세 로그, request/response 샘플, 경고 알림

핵심은 retry 자체와 retry 시 동작 변화를 분리해서 설계하는 것입니다.  
재시도 여부는 `RetryPolicy`, 재시도 시 행동 변화는 `runtime.execution_info`가 맡는다고 보면 정리가 쉽습니다.

## `RetryPolicy`와 역할 분담하기

둘은 서로 대체재가 아닙니다.

- `RetryPolicy`: 어떤 예외를 몇 번, 어떤 간격으로 다시 시도할지
- `runtime.execution_info`: 지금이 몇 번째 시도인지, 어떤 실행 단위인지

즉 아래처럼 나누면 됩니다.

```python
builder.add_node(
    "fetch",
    fetch_with_fallback,
    retry_policy=RetryPolicy(max_attempts=3, retry_on=TemporaryAPIError),
)
```

- 재시도 정책 결정은 graph 선언부
- fallback 분기 결정은 node 본문

이 분리가 안 되면 retry 기준과 비즈니스 분기가 한 함수 안에서 뒤엉켜 유지보수가 어려워집니다.

## checkpointer가 없어도 쓸 수 있나

쓸 수 있습니다.  
공식 문서 기준으로 `execution_info`는 retry policy가 없어도 접근 가능하고, 그 경우 `node_attempt`는 기본값 `1`입니다.

다만 `thread_id`는 checkpointer가 없으면 `None`일 수 있으니, 운영 로그에 thread 식별자가 꼭 필요하면 checkpointer와 `thread_id` config를 같이 설계하는 편이 낫습니다.

## 자주 틀리는 점

### 1. fallback 분기만 만들고 `retry_on`을 느슨하게 둔다

모든 예외를 다 재시도하면 검증 오류나 프로그래밍 오류까지 fallback으로 흘러갈 수 있습니다.  
재시도 대상은 `TemporaryAPIError`, 특정 HTTP 5xx, rate limit 계열처럼 일시 실패로 좁히는 편이 안전합니다.

### 2. side effect가 있는 node를 그대로 재시도한다

결제 요청, 메일 발송, 외부 write 같은 작업은 첫 시도에서 일부 성공했을 수 있습니다.  
이런 node에서 retry를 쓰려면 idempotency key, 중복 방지 키, write-before-ack 설계를 먼저 확인해야 합니다.

### 3. `node_attempt > 1` 분기에 너무 많은 정책을 몰아넣는다

처음에는 provider fallback만 필요했는데, 나중에는 timeout, prompt, batch, logging 분기까지 다 들어가서 node가 비대해질 수 있습니다.  
분기 규칙이 커지면 helper 함수나 전략 객체로 빼는 편이 낫습니다.

### 4. retry 간 상태가 누적된다고 착각한다

재시도는 node를 다시 실행하는 것입니다.  
시도 횟수에 따라 바뀌는 값은 state가 아니라 `runtime.execution_info`에서 읽는 편이 더 정확합니다.

## 추천 패턴

실무에서는 아래 정도로 시작하면 무난합니다.

1. retry 대상 예외를 좁게 정의한다
2. `max_attempts`는 2 또는 3부터 시작한다
3. `node_attempt == 1`은 primary, `> 1`은 fallback으로 둔다
4. fallback 발생 시 `thread_id`, `checkpoint_id`, `task_id`를 로그에 남긴다
5. side effect node에는 idempotency 전략 없이 retry를 붙이지 않는다

이 정도만 해도 가끔 죽는 외부 의존성 때문에 workflow 전체가 깨지는 문제를 꽤 많이 줄일 수 있습니다.

## 참고 자료

- [Use the graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [Fault tolerance](https://docs.langchain.com/oss/python/langgraph/fault-tolerance)
- [RetryPolicy Reference](https://reference.langchain.com/python/langgraph/types/#langgraph.types.RetryPolicy)
