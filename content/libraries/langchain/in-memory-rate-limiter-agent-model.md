---
title: "LangChain InMemoryRateLimiter로 agent 모델 호출 속도 제어하기"
description: "token bucket 기반 InMemoryRateLimiter를 agent 모델에 연결해 동시 요청의 burst를 줄이고 429 재시도 폭증을 예방하는 실전 패턴"
date: 2026-08-12
tags:
  - langchain
  - agent
  - model
  - rate-limiting
  - reliability
  - python
---

# LangChain InMemoryRateLimiter로 agent 모델 호출 속도 제어하기

여러 사용자가 같은 agent를 동시에 호출하면 짧은 순간에 model request가 몰릴 수 있다. provider가 429를 반환한 뒤 재시도하는 것만으로는 이미 실패한 요청과 지연이 생긴다. LangChain의 `InMemoryRateLimiter`를 chat model에 연결하면 **요청을 보내기 전에** process 안의 호출 속도를 평탄화할 수 있다.

이 limiter는 LLM token 수가 아니라 **model request 한 번당 bucket token 하나**를 소비한다. 따라서 RPM 보호에는 유용하지만 TPM, 비용 예산, 사용자별 quota를 대신하지는 않는다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.3" langchain-openai
export OPENAI_API_KEY="your-api-key"
```

PowerShell에서는 다음처럼 환경 변수를 설정한다.

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. agent의 model instance에 limiter 연결하기

문자열 모델 식별자 대신 model instance를 만들고 `rate_limiter`를 전달한다.

```python
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langchain_core.rate_limiters import InMemoryRateLimiter

rate_limiter = InMemoryRateLimiter(
    requests_per_second=2.0,
    check_every_n_seconds=0.05,
    max_bucket_size=2,
)

model = init_chat_model(
    "openai:gpt-5-mini",
    rate_limiter=rate_limiter,
    max_retries=3,
)

agent = create_agent(model=model, tools=[])

result = agent.invoke(
    {"messages": [{"role": "user", "content": "token bucket을 한 문장으로 설명해 줘"}]}
)
print(result["messages"][-1].content)
```

세 설정의 의미는 다음과 같다.

- `requests_per_second=2.0`: 초당 bucket token을 2개 보충한다.
- `check_every_n_seconds=0.05`: 대기 중인 호출이 50ms마다 사용 가능 여부를 확인한다.
- `max_bucket_size=2`: 쉬는 동안 쌓아 둘 수 있는 token을 2개로 제한한다. 즉 최대 burst도 2개다.

`max_retries`는 실패한 요청의 복구 정책이고, `rate_limiter`는 요청 전 진입 속도 정책이다. 둘은 경쟁 관계가 아니라 함께 쓰는 안전장치다.

## 2. agent loop에서는 사용자 요청 수보다 model 호출 수가 많다

tool-calling agent는 한 번의 `agent.invoke()` 안에서도 model을 여러 번 호출할 수 있다.

```text
사용자 입력 -> model -> tool -> model -> 최종 응답
```

위 흐름은 limiter token을 두 번 소비한다. 따라서 예상 RPM은 HTTP 요청 수가 아니라 다음처럼 잡아야 한다.

```python
expected_model_rpm = peak_agent_requests_per_minute * average_model_calls_per_run
requests_per_second = expected_model_rpm / 60
```

예를 들어 peak가 분당 agent 30건이고 평균 model call이 2회라면 최소 분당 60회가 필요하다. provider quota와 여유 폭을 고려해 그보다 낮은 허용값부터 부하 테스트로 조정한다.

## 3. 같은 quota를 쓰는 model들이 limiter를 공유하게 하기

동일 provider 계정과 quota를 쓰는 primary, fallback model에 limiter를 따로 만들면 각각 허용량을 소비해 합산 burst가 커진다. 하나의 limiter instance를 공유한다.

```python
from langchain.chat_models import init_chat_model
from langchain_core.rate_limiters import InMemoryRateLimiter

shared_limiter = InMemoryRateLimiter(
    requests_per_second=1.5,
    check_every_n_seconds=0.05,
    max_bucket_size=1,
)

primary_model = init_chat_model(
    "openai:gpt-5-mini",
    rate_limiter=shared_limiter,
)
fallback_model = init_chat_model(
    "openai:gpt-5-nano",
    rate_limiter=shared_limiter,
)
```

반대로 provider나 API key별 quota가 완전히 분리돼 있다면 limiter도 quota 경계별로 나누는 편이 맞다. 중요한 기준은 model 이름이 아니라 실제 과금·제한 경계다.

## 4. 외부 API 없이 token bucket 동작 확인하기

`acquire()`와 `aacquire()`를 직접 호출하면 API 비용 없이 limiter 설정을 검증할 수 있다.

```python
import time

from langchain_core.rate_limiters import InMemoryRateLimiter

limiter = InMemoryRateLimiter(
    requests_per_second=5,
    check_every_n_seconds=0.01,
    max_bucket_size=1,
)

started = time.perf_counter()
for _ in range(3):
    assert limiter.acquire(blocking=True)

elapsed = time.perf_counter() - started
assert elapsed >= 0.35
print(f"3 acquisitions: {elapsed:.2f}s")
```

첫 token도 보충될 때까지 기다릴 수 있으므로 정확히 `0.4s` 같은 값으로 고정하지 않는다. CI에서는 scheduler 오차를 감안해 하한을 넉넉하게 두거나 `blocking=False`로 즉시 성공 여부만 검사한다.

async agent에서도 같은 instance의 `aacquire()` 경로가 사용된다. 공식 reference에 따르면 limiter는 thread-safe하며 sync와 async context에서 쓸 수 있다.

## 자주 하는 실수

### LLM token 제한기로 이해한다

bucket token은 호출권을 세는 내부 단위다. prompt와 output token 크기는 보지 않는다. TPM 보호가 필요하면 provider별 usage budget 또는 별도 분산 quota 계층을 둔다.

### worker마다 limiter를 하나씩 만든다

`InMemoryRateLimiter`는 process 간 상태를 공유하지 않는다. worker 4개에 초당 2회 limiter를 각각 두면 전체는 초당 약 8회까지 나갈 수 있다. 다중 process·pod에서는 Redis나 gateway 기반 분산 rate limit을 사용한다.

### `max_bucket_size`를 quota 전체 크기로 둔다

bucket이 오래 쉬었다가 큰 burst를 허용할 수 있다. steady traffic을 원하면 `1` 또는 작은 값부터 시작한다.

### limiter만 있으면 429가 사라진다고 가정한다

provider는 RPM 외에도 TPM, 동시성, 계정·모델별 제한을 적용할 수 있다. timeout, 제한적인 retry/backoff, 관측 지표를 함께 둔다.

### agent 요청 수만 보고 설정한다

tool loop, structured output 재시도, middleware retry와 fallback은 한 run의 model call 수를 늘린다. trace에서 run당 model call 분포를 먼저 측정한다.

## 실전 체크리스트

1. quota 경계별로 limiter instance를 공유하는가?
2. 평균과 상위 백분위 run당 model call 수를 반영했는가?
3. `max_bucket_size`가 의도하지 않은 burst를 만들지 않는가?
4. 다중 process·pod에서는 분산 limiter를 사용하는가?
5. 429, 대기 시간, retry 수, model call 수를 함께 관측하는가?
6. RPM과 별도로 TPM·비용 예산을 관리하는가?

## 참고 자료

- [LangChain models: Rate limiting](https://docs.langchain.com/oss/python/langchain/models#rate-limiting)
- [InMemoryRateLimiter API reference](https://reference.langchain.com/python/langchain-core/rate_limiters/InMemoryRateLimiter)
- [LangChain agents guide](https://docs.langchain.com/oss/python/langchain/agents)
