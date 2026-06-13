---
title: "LangSmith read_project(include_stats=True)로 experiment 지표 가져오기"
description: "LangSmith evaluate() 결과에서 experiment_name을 받고 read_project(include_stats=True)로 latency, cost, token, feedback 통계를 조회하는 방법을 정리한 실전 노트"
date: 2026-06-13
tags:
  - langsmith
  - evaluation
  - analytics
  - python
aliases:
  - "/blog/langsmith-experiment-metrics-sdk"
---

# LangSmith read_project(include_stats=True)로 experiment 지표 가져오기

LangSmith에서 평가를 한 번 돌리고 나면 다음 질문이 바로 따라온다.

- 이번 실험에서 총 토큰과 비용이 얼마나 들었나
- latency p50, p99가 이전 실험보다 나아졌나
- evaluator 점수와 비용을 같이 보고 싶은데 어디서 한 번에 읽나
- 반복 실행(`num_repetitions`)까지 포함한 집계치를 코드에서 가져오고 싶다

이럴 때 가장 먼저 볼 메서드는 `read_project(include_stats=True)`다.  
LangSmith 문서 기준으로 experiment, tracing project, session은 백엔드에서 같은 기반 구조를 쓰며, `evaluate(...)`로 만든 experiment도 `read_project(...)`로 통계를 읽는다.

이 글에서는 아래 흐름만 실무 기준으로 정리한다.

1. `evaluate(...)`로 experiment를 만든다
2. `results.experiment_name`을 받아 둔다
3. `client.read_project(..., include_stats=True)`로 집계 지표를 읽는다
4. `feedback_stats`, token, cost, latency를 후처리한다

## 언제 유용한가

- 회귀 평가 결과를 사내 리포트나 Slack 요약으로 자동 전송할 때
- 모델 교체 전후의 비용, 토큰, latency 차이를 코드에서 비교할 때
- `num_repetitions`를 켠 실험의 평균 지표를 별도 저장하고 싶을 때
- UI에서 보는 실험 결과를 CI/CD 파이프라인이나 노트북으로 이어 붙이고 싶을 때

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
```

## 1. 작은 dataset으로 experiment를 만든다

아래 예제는 LangSmith 공식 문서의 `evaluate(...)` + `read_project(...)` 흐름을 약간 확장한 버전이다.

```python
from langsmith import Client, evaluate
from langsmith.schemas import Example, Run

client = Client()

dataset = client.create_dataset(
    dataset_name="hello-metrics-demo",
    description="experiment metrics 조회용 데모 dataset",
)

client.create_examples(
    dataset_id=dataset.id,
    examples=[
        {
            "inputs": {"input": "Harrison"},
            "outputs": {"expected": "Hello Harrison"},
            "metadata": {"locale": "en"},
            "split": ["smoke"],
        },
        {
            "inputs": {"input": "Ankush"},
            "outputs": {"expected": "Hello Ankush"},
            "metadata": {"locale": "en"},
            "split": ["smoke", "regression"],
        },
    ],
)


def app(inputs: dict) -> str:
    return "Hello " + inputs["input"]


def exact_match(root_run: Run, example: Example) -> dict:
    predicted = root_run.outputs["output"]
    expected = example.outputs["expected"]
    return {"key": "exact_match", "score": float(predicted == expected)}


results = evaluate(
    app,
    data=dataset.name,
    evaluators=[exact_match],
    experiment_prefix="hello-metrics",
    metadata={
        "models": ["demo:rule-based"],
        "prompts": ["hello-v1"],
    },
)

print(results.experiment_name)
```

핵심은 `results.experiment_name`을 받아 두는 것이다.  
이 값이 있어야 나중에 같은 experiment를 정확히 다시 읽을 수 있다.

## 2. `read_project(include_stats=True)`로 집계 지표를 가져온다

```python
from langsmith import Client

client = Client()

experiment = client.read_project(
    project_name=results.experiment_name,
    include_stats=True,
)

print(experiment.name)
print(experiment.latency_p50)
print(experiment.total_tokens)
print(experiment.total_cost)
print(experiment.feedback_stats)
```

공식 문서 예시 기준으로 여기서 확인할 수 있는 대표 필드는 다음과 같다.

- `run_count`
- `latency_p50`, `latency_p99`
- `first_token_p50`, `first_token_p99`
- `total_tokens`, `prompt_tokens`, `completion_tokens`
- `total_cost`, `prompt_cost`, `completion_cost`
- `feedback_stats`
- `extra.metadata.dataset_version`
- `extra.metadata.dataset_splits`
- `extra.metadata.num_repetitions`

## 3. 자주 보는 숫자만 요약해서 뽑는다

실무에서는 raw 객체를 그대로 쓰기보다 필요한 값만 추려서 dict로 만드는 편이 편하다.

```python
summary = {
    "experiment_name": experiment.name,
    "run_count": experiment.run_count,
    "latency_p50": experiment.latency_p50,
    "latency_p99": experiment.latency_p99,
    "total_tokens": experiment.total_tokens,
    "prompt_tokens": experiment.prompt_tokens,
    "completion_tokens": experiment.completion_tokens,
    "total_cost": experiment.total_cost,
    "feedback_stats": experiment.feedback_stats,
    "dataset_version": (experiment.extra or {}).get("metadata", {}).get("dataset_version"),
    "dataset_splits": (experiment.extra or {}).get("metadata", {}).get("dataset_splits"),
}

print(summary)
```

이 정도만 정리해도 아래 용도에 바로 붙는다.

- 실험 종료 후 Slack 요약 메시지
- PR 코멘트에 비용과 점수 자동 첨부
- 기준 실험 대비 latency, cost 비교
- 데이터셋 버전 추적 로그

## 4. feedback 점수는 `feedback_stats`에서 읽는다

`feedback_stats`에는 evaluator key별 집계가 들어간다.  
구조는 evaluator 구성에 따라 달라질 수 있으므로, key를 고정 문자열로 쓰기 전에 한 번 출력해 보는 편이 안전하다.

```python
feedback_stats = experiment.feedback_stats or {}

for key, value in feedback_stats.items():
    print(key, value)
```

예를 들어 `exact_match` evaluator만 붙였다면 아래처럼 후처리할 수 있다.

```python
exact_match_stats = (experiment.feedback_stats or {}).get("exact_match", {})
average_score = exact_match_stats.get("avg")

print("exact_match avg =", average_score)
```

## 5. 반복 실험을 켰다면 `num_repetitions`와 평균 지표를 같이 본다

모델 출력 분산을 보고 싶으면 `evaluate(...)`에서 `num_repetitions`를 줄 수 있다.

```python
results = evaluate(
    app,
    data=dataset.name,
    evaluators=[exact_match],
    experiment_prefix="hello-metrics-repeated",
    num_repetitions=3,
)

experiment = client.read_project(
    project_name=results.experiment_name,
    include_stats=True,
)

print(experiment.run_count)
print((experiment.extra or {}).get("metadata", {}).get("num_repetitions"))
```

LangSmith 문서 기준으로 repetition을 사용하면 UI에서는 평균 score를 보여 주고, 세부 화면에서 각 반복 결과를 펼쳐 볼 수 있다.  
코드 쪽에서도 repetition 여부를 metadata와 함께 저장해 두면 실험 해석이 쉬워진다.

## 6. 실험 메타데이터를 같이 남기면 나중에 비교가 훨씬 쉽다

`evaluate(...)`의 `metadata`는 단순 장식이 아니다.  
공식 문서 기준으로 `models`, `prompts`, `tools` 키를 쓰면 UI 테이블의 전용 컬럼에도 반영된다.

```python
results = evaluate(
    app,
    data=dataset.name,
    evaluators=[exact_match],
    experiment_prefix="hello-metrics",
    metadata={
        "models": ["openai:gpt-5.4-mini"],
        "prompts": ["support-faq-v3"],
        "tools": [
            {
                "name": "knowledge_base_search",
                "description": "Search the FAQ index",
            }
        ],
    },
)
```

이 메타데이터를 남겨 두면 나중에 "어떤 모델/프롬프트/도구 조합이 비용 대비 점수가 좋았는가"를 실험 테이블과 코드 양쪽에서 맞춰 보기 좋다.

## 자주 하는 실수

### 1. `include_stats=True`를 빼먹는다

`read_project(...)`만 호출하면 원하는 비용/토큰/latency 집계가 비어 있다고 느낄 수 있다.  
실험 지표가 목적이면 `include_stats=True`를 같이 넘기는 습관이 필요하다.

### 2. dataset 이름과 experiment 이름을 섞어 쓴다

`evaluate(..., data=dataset.name)`에 넣는 값과 `read_project(project_name=...)`에 넣는 값은 다르다.  
후자는 실험 이름이고, 보통 `results.experiment_name`에서 받아 와야 안전하다.

### 3. `first_token_p50`가 항상 있다고 가정한다

문서 예시에서도 `first_token_p50`, `first_token_p99`는 `null`일 수 있다.  
스트리밍이나 모델 설정에 따라 값이 없을 수 있으니 바로 산술 연산하지 않는 편이 좋다.

### 4. `feedback_stats` 구조를 고정 포맷이라고 생각한다

evaluator key와 세부 필드는 평가기 구성에 따라 달라질 수 있다.  
새 evaluator를 붙였으면 먼저 전체 구조를 출력해 보고 후처리 코드를 맞추는 편이 안전하다.

### 5. 실험 컨텍스트 없이 숫자만 저장한다

비용과 latency만 남기면 나중에 왜 숫자가 달라졌는지 설명하기 어렵다.  
최소한 모델, 프롬프트, dataset version, split, repetition 수는 함께 남겨 두는 편이 좋다.

## 추천 운영 패턴

개인적으로는 아래 흐름이 가장 실용적이다.

1. `evaluate(...)` 직후 `results.experiment_name`을 저장한다
2. 곧바로 `read_project(..., include_stats=True)`를 다시 호출한다
3. 비용, latency, feedback 점수, dataset version만 요약 dict로 만든다
4. 이 요약을 Slack, CSV, 실험 로그 테이블 중 하나에 자동 저장한다
5. 중요한 실험은 모델/프롬프트 metadata를 함께 남긴다

이 정도만 해도 LangSmith experiment가 단순 실행 기록이 아니라, 회귀 기준과 비용 추적을 함께 보는 운영 데이터로 바뀐다.

## 참고 자료

- [How to fetch performance metrics for an experiment](https://docs.langchain.com/langsmith/fetch-perf-metrics-experiment)
- [How to evaluate an LLM application](https://docs.langchain.com/langsmith/evaluate-llm-application)
- [Analyze an experiment](https://docs.langchain.com/langsmith/analyze-an-experiment)
- [How to evaluate with repetitions](https://docs.langchain.com/langsmith/repetition)
