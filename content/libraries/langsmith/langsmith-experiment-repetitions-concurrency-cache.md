---
title: "LangSmith 평가 반복·동시성·캐시로 실험 비용과 분산 관리하기"
description: "num_repetitions, max_concurrency, LANGSMITH_TEST_CACHE를 조합해 비결정적 LLM 평가의 분산을 측정하면서 속도와 API 비용을 통제하는 실전 노트"
date: 2026-08-06
tags:
  - langsmith
  - evaluation
  - python
  - experiment
  - cost-control
aliases:
  - "/blog/langsmith-experiment-repetitions-concurrency-cache"
---

# LangSmith 평가 반복·동시성·캐시로 실험 비용과 분산 관리하기

LLM과 agent는 같은 입력에도 다른 답이나 tool 경로를 만들 수 있다. 한 번씩만 실행한 평균은 우연히 좋은 결과를 실제 개선으로 보이게 할 수 있고, 반대로 반복 수를 무작정 늘리면 비용과 rate limit이 빠르게 커진다.

LangSmith의 실험 설정 세 가지를 함께 쓰면 이 균형을 명시적으로 관리할 수 있다.

- `num_repetitions`: example 하나를 여러 번 실행해 점수 분산을 관찰한다.
- `max_concurrency`: 동시에 처리할 example 수를 제한한다.
- `LANGSMITH_TEST_CACHE`: 동일한 HTTP 요청의 응답을 디스크에 저장해 이후 실험에서 재사용한다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langsmith[pytest]" openai
```

PowerShell에서는 다음처럼 환경 변수를 지정한다.

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:OPENAI_API_KEY="sk-your-key"
$env:LANGSMITH_TEST_CACHE=".langsmith-cache"
```

캐시 폴더에는 모델 요청과 응답이 들어갈 수 있다. 비밀 값이나 개인정보가 포함되는 환경에서는 저장 위치, 접근 권한, 보존 정책을 먼저 정해야 한다.

## 반복 수가 실제 실행량을 어떻게 바꾸는가

dataset example이 `N`개이고 `num_repetitions=R`이면 target 실행은 `N × R`회다. evaluator도 각 결과마다 다시 실행된다. LLM-as-a-judge를 쓴다면 target 모델뿐 아니라 judge 비용도 같은 배수로 증가한다.

예를 들어 example 20개, 반복 3회, target 호출 1회, judge 호출 1회라면 모델 호출 예산은 대략 다음과 같다.

```text
20 examples × 3 repetitions × (1 target + 1 judge) = 120 calls
```

따라서 smoke test는 1회, release 후보 비교는 3~5회처럼 목적에 따라 반복 수를 다르게 두는 편이 실용적이다.

## 실행 가능한 동기식 평가 예제

아래 코드는 dataset을 한 번 만들고, 각 example을 3회 평가한다. `max_concurrency=4`는 target과 evaluator를 실행하는 worker thread의 최대 수를 제한한다.

```python
from langsmith import Client
from langsmith.wrappers import wrap_openai
from openai import OpenAI

client = Client()
llm = wrap_openai(OpenAI())
dataset_name = "support-routing-stability-v1"


def ensure_dataset() -> None:
    if client.has_dataset(dataset_name=dataset_name):
        return

    dataset = client.create_dataset(
        dataset_name=dataset_name,
        description="고객 문의 라우팅 안정성 평가",
    )
    client.create_examples(
        dataset_id=dataset.id,
        examples=[
            {
                "inputs": {"text": "결제는 됐는데 주문이 보이지 않아요"},
                "outputs": {"label": "billing"},
            },
            {
                "inputs": {"text": "비밀번호 재설정 메일이 오지 않아요"},
                "outputs": {"label": "account"},
            },
            {
                "inputs": {"text": "배송지를 바꾸고 싶어요"},
                "outputs": {"label": "shipping"},
            },
        ],
    )


def route(inputs: dict) -> dict:
    response = llm.chat.completions.create(
        model="gpt-5.4-mini",
        temperature=0.2,
        messages=[
            {
                "role": "system",
                "content": (
                    "문의 분류기다. billing, account, shipping 중 "
                    "하나만 소문자로 답하라."
                ),
            },
            {"role": "user", "content": inputs["text"]},
        ],
    )
    return {"label": response.choices[0].message.content.strip().lower()}


def correct(outputs: dict, reference_outputs: dict) -> bool:
    return outputs["label"] == reference_outputs["label"]


ensure_dataset()
results = client.evaluate(
    route,
    data=dataset_name,
    evaluators=[correct],
    experiment_prefix="routing-stability",
    num_repetitions=3,
    max_concurrency=4,
    metadata={
        "models": "openai:gpt-5.4-mini",
        "purpose": "release-candidate",
    },
)

print(results.to_pandas())
```

LangSmith UI는 반복된 feedback score의 평균을 표시하며, 개별 실행 점수와 표준편차도 확인할 수 있다. 평균이 같더라도 표준편차가 큰 후보는 운영에서 흔들릴 가능성이 크므로 개별 반복을 함께 본다.

## async target은 `aevaluate`로 제한하기

비동기 application은 `aevaluate`를 쓰는 편이 자연스럽다. 이때 `max_concurrency`는 동시에 처리하는 example task 수를 semaphore로 제한한다. 각 task 안에서 target과 evaluator가 순서대로 실행된다.

```python
import asyncio
from langsmith import Client

client = Client()


async def run_agent(inputs: dict) -> dict:
    # 실제 코드에서는 await agent.ainvoke(inputs) 등을 호출한다.
    await asyncio.sleep(0.05)
    return {"label": "billing" if "결제" in inputs["text"] else "account"}


def correct(outputs: dict, reference_outputs: dict) -> bool:
    return outputs["label"] == reference_outputs["label"]


async def main() -> None:
    results = await client.aevaluate(
        run_agent,
        data="support-routing-stability-v1",
        evaluators=[correct],
        experiment_prefix="routing-async",
        num_repetitions=3,
        max_concurrency=4,
    )
    print(results.to_pandas())


asyncio.run(main())
```

provider가 허용하는 요청 수가 낮다면 `max_concurrency=1`부터 올린다. 값이 클수록 항상 빠른 것은 아니다. 429 재시도, 연결 제한, judge 병목이 생기면 총 시간이 오히려 늘 수 있다.

## 캐시는 반복과 다른 문제를 푼다

`LANGSMITH_TEST_CACHE`는 평가 점수를 캐시하는 기능이 아니다. target이나 evaluator가 보내는 **동일한 HTTP 요청**의 응답을 디스크에서 재사용한다. 그래서 다음 조건이 같아야 cache hit을 기대할 수 있다.

- provider URL과 요청 body
- model, prompt, messages, tool schema
- temperature 등 generation parameter

prompt나 model을 바꾼 후보 비교에서는 요청이 달라지므로 새 호출이 발생하는 것이 정상이다. 반대로 같은 코드로 CI를 다시 실행하거나 evaluator wiring만 디버깅할 때는 비용과 시간을 크게 줄일 수 있다.

캐시를 사용한 결과는 새로운 모델 응답 표본이 아니다. 변동성을 측정하려는 공식 실험에서는 비어 있는 별도 cache directory를 쓰거나 캐시를 끄고, 빠른 회귀 확인에서만 기존 cache를 재사용하는 편이 안전하다.

```powershell
# 빠른 반복 개발: 기존 응답 재사용
$env:LANGSMITH_TEST_CACHE=".langsmith-cache\dev"
python .\eval_routing.py

# 새 표본을 뽑는 release 평가: 새 폴더 사용
$env:LANGSMITH_TEST_CACHE=".langsmith-cache\release-2026-08-06"
python .\eval_routing.py
```

## 흔한 실수

### 반복 평균만 보고 안정적이라고 판단한다

평균과 함께 표준편차, 최솟값, 실패 횟수를 본다. 안전성처럼 한 번의 실패가 중요한 metric은 평균보다 `min`이나 pass-all 조건이 더 적절할 수 있다.

### `num_repetitions`를 올리고 비용 계산을 생략한다

target, evaluator, tool call 수를 모두 곱해 호출량을 추정한다. 특히 agent는 한 번의 target 실행 안에 여러 모델·tool 호출이 있을 수 있다.

### concurrency를 provider rate limit보다 높인다

작은 값에서 시작해 429 비율과 p95 latency를 보며 올린다. 여러 CI job이 동시에 돌면 각 job의 concurrency 합계가 실제 부하가 된다.

### cache hit을 새 반복 표본으로 해석한다

캐시된 동일 응답을 여러 번 채점해도 모델의 실제 분산을 측정한 것이 아니다. 실험 metadata에 cache 사용 여부와 cache directory 세대를 남겨 비교 조건을 구분한다.

### 캐시 폴더를 무조건 Git에 커밋한다

응답에 사용자 데이터나 proprietary prompt가 들어갈 수 있다. 공유가 승인된 test cassette만 버전 관리하고, 일반 cache directory는 `.gitignore`에 추가한다.

## 실무 권장값

| 목적 | 반복 | 동시성 | 캐시 |
|---|---:|---:|---|
| evaluator wiring 확인 | 1 | 1~2 | 재사용 |
| PR smoke test | 1 | provider 한도 내 2~4 | 재사용 가능 |
| release 후보 안정성 비교 | 3~5 | 낮게 시작 후 조정 | 새 폴더 또는 끔 |
| 고변동 agent 분석 | 5회 이상을 표본 예산에 맞춤 | tool/API 한도 기준 | 새 표본 사용 |

핵심은 빠르게 많이 돌리는 것이 아니라, **반복은 분산 측정**, **동시성은 처리량 제어**, **캐시는 동일 요청 재사용**이라는 서로 다른 역할을 구분하는 것이다.

## 참고 자료

- [Experiment configuration](https://docs.langchain.com/langsmith/experiment-configuration)
- [How to evaluate with repetitions](https://docs.langchain.com/langsmith/repetition)
- [How to run evaluations with pytest](https://docs.langchain.com/langsmith/pytest)
- [How to evaluate an LLM application](https://docs.langchain.com/langsmith/evaluate-llm-application)
- [Analyze an experiment](https://docs.langchain.com/langsmith/analyze-an-experiment)
