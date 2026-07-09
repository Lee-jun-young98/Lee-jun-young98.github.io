---
title: "LangSmith summary_evaluators로 pass rate와 F1 한 번에 집계하기"
description: "LangSmith evaluate()의 summary_evaluators를 써서 row-level 점수를 experiment-level pass rate, F1, p95 latency로 집계하는 실전 노트"
date: 2026-07-09
tags:
  - langsmith
  - evaluation
  - python
  - analytics
aliases:
  - "/blog/langsmith-summary-evaluators-pass-rate-f1"
---

# LangSmith summary_evaluators로 pass rate와 F1 한 번에 집계하기

LangSmith에서 `evaluate()`를 돌리면 보통 example 단위 점수부터 보게 된다. 그런데 실제 운영에서는 아래 질문이 더 자주 나온다.

- 이번 실험의 전체 pass rate가 몇 퍼센트인가?
- `billing` 클래스만 보면 F1이 얼마나 나오는가?
- 정답률은 유지되는데 latency tail이 늘어난 건 아닌가?

이런 지표는 개별 row가 아니라 experiment 전체를 한 번에 모아야 계산된다. LangSmith에서는 이럴 때 `summary_evaluators`를 쓴다.

이 글은 Python 기준으로 아래 흐름을 정리한다.

1. row-level evaluator로 기본 점수를 남긴다.
2. `summary_evaluators`로 pass rate와 F1을 계산한다.
3. 필요하면 `runs`를 받아 p95 latency 같은 운영 지표도 같이 집계한다.

## 언제 `summary_evaluators`가 필요한가

row-level evaluator는 example 하나씩 보고 점수를 매긴다. 반면 summary evaluator는 experiment 전체 결과를 모아서 지표를 만든다.

summary evaluator가 특히 잘 맞는 경우는 아래와 같다.

- 전체 pass rate, accuracy, success ratio를 보고 싶을 때
- precision, recall, F1처럼 전체 confusion matrix가 필요한 지표를 계산할 때
- 특정 split만 모은 experiment에서 aggregate metric을 남기고 싶을 때
- run metadata를 이용해 p95 latency, 평균 token 수 같은 운영 지표를 추가하고 싶을 때

반대로 각 example마다 정답 여부만 기록하면 충분한 초기 smoke test라면 row-level evaluator만으로도 충분하다.

## 사전 준비

공식 문서 기준으로 summary evaluator는 `evaluate()`에 `summary_evaluators=[...]`를 넘겨 쓰면 된다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "langsmith>=0.3.13"
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
```

## 1. 작게 시작할 dataset과 target 함수

예시는 support triage 분류기를 가정한다. 일부러 완벽하지 않은 규칙 기반 target을 써서 집계 지표가 어떻게 나오는지 보기 쉽게 만든다.

```python
from langsmith import Client

ls_client = Client()

examples = [
    {
        "inputs": {"message": "Please refund the duplicate charge."},
        "outputs": {"label": "billing"},
        "metadata": {"split": "smoke"},
    },
    {
        "inputs": {"message": "The mobile app crashes on login."},
        "outputs": {"label": "technical"},
        "metadata": {"split": "smoke"},
    },
    {
        "inputs": {"message": "How do I update my invoice details?"},
        "outputs": {"label": "billing"},
        "metadata": {"split": "regression"},
    },
    {
        "inputs": {"message": "Where can I change notification settings?"},
        "outputs": {"label": "general"},
        "metadata": {"split": "regression"},
    },
]

dataset = ls_client.create_dataset(dataset_name="Support Triage Summary Eval Demo")
ls_client.create_examples(dataset_id=dataset.id, examples=examples)
```

```python
def classify_ticket(inputs: dict) -> dict:
    text = inputs["message"].lower()
    if "refund" in text or "invoice" in text or "charge" in text:
        label = "billing"
    elif "crash" in text or "error" in text or "login" in text:
        label = "technical"
    else:
        label = "general"
    return {"label": label}
```

## 2. row-level evaluator는 가능한 단순하게 둔다

summary evaluator는 aggregate 지표를 만들 뿐, 개별 example의 정답 여부를 대신 기록해 주지는 않는다. 그래서 기본 row-level evaluator를 먼저 두는 편이 좋다.

```python
def exact_match(outputs: dict, reference_outputs: dict) -> bool:
    return outputs["label"] == reference_outputs["label"]
```

이렇게 해 두면 UI에서 example별 결과를 보고, 동시에 experiment-level 요약 지표도 같이 볼 수 있다.

## 3. `summary_evaluators`로 pass rate를 만든다

공식 문서 기준으로 summary evaluator는 `inputs`, `outputs`, `reference_outputs`, `runs`, `examples` 중 필요한 인자만 받으면 된다. 가장 단순한 aggregate metric은 pass rate다.

```python
def pass_rate_summary(outputs: list[dict], reference_outputs: list[dict]) -> dict:
    total = len(outputs)
    passed = sum(
        output["label"] == reference["label"]
        for output, reference in zip(outputs, reference_outputs)
    )
    return {
        "key": "pass_rate",
        "score": passed / total if total else 0.0,
    }
```

이 함수는 experiment 전체 outputs를 한 번에 받아 계산한다. 즉 `exact_match`가 row를 찍고, `pass_rate_summary`가 그 결과들을 aggregate하는 구조라고 보면 된다.

## 4. 특정 클래스 기준 F1을 같이 계산한다

분류 문제에서는 accuracy만 보면 위험하다. 예를 들어 `billing` 케이스가 실제로 중요한데 전부 `general`로 보내도, 데이터 분포에 따라 accuracy가 그럭저럭 나올 수 있다.

이럴 때 summary evaluator로 클래스별 F1을 같이 남기면 좋다.

```python
def billing_f1_summary(outputs: list[dict], reference_outputs: list[dict]) -> dict:
    true_positives = 0
    false_positives = 0
    false_negatives = 0

    for output, reference in zip(outputs, reference_outputs):
        predicted = output["label"]
        expected = reference["label"]

        if predicted == "billing" and expected == "billing":
            true_positives += 1
        elif predicted == "billing" and expected != "billing":
            false_positives += 1
        elif predicted != "billing" and expected == "billing":
            false_negatives += 1

    if true_positives == 0:
        return {"key": "billing_f1", "score": 0.0}

    precision = true_positives / (true_positives + false_positives)
    recall = true_positives / (true_positives + false_negatives)
    f1 = 2 * precision * recall / (precision + recall)

    return {"key": "billing_f1", "score": f1}
```

이 패턴은 `technical_f1`, `refund_recall`, `escalation_precision`처럼 중요한 실패 유형별 지표로 그대로 확장할 수 있다.

## 5. `runs`를 받아 p95 latency도 함께 집계할 수 있다

공식 문서에서 summary evaluator는 `runs: list[Run]`도 받을 수 있다. 이걸 쓰면 앱 출력 자체가 아니라 run metadata까지 포함한 운영 지표를 같이 계산할 수 있다.

```python
import math


def p95_latency_summary(runs: list) -> dict:
    latencies = sorted(
        run.latency
        for run in runs
        if getattr(run, "latency", None) is not None
    )
    if not latencies:
        return {"key": "p95_latency_s", "score": 0.0}

    index = max(0, math.ceil(len(latencies) * 0.95) - 1)
    return {
        "key": "p95_latency_s",
        "score": latencies[index],
    }
```

이 방식이 좋은 이유는 정확도와 운영 비용/성능을 같은 experiment 화면에서 같이 볼 수 있기 때문이다.

## 6. `evaluate()`에 row-level + summary evaluator를 같이 넣는다

```python
results = ls_client.evaluate(
    classify_ticket,
    data="Support Triage Summary Eval Demo",
    evaluators=[exact_match],
    summary_evaluators=[
        pass_rate_summary,
        billing_f1_summary,
        p95_latency_summary,
    ],
    experiment_prefix="support-triage-summary-demo",
    metadata={
        "models": ["rules:baseline"],
        "prompts": ["support-triage/rules-v1"],
    },
)

list(results)
```

이렇게 실행하면:

- 각 example에는 `exact_match` 결과가 남고
- experiment 전체에는 `pass_rate`, `billing_f1`, `p95_latency_s`가 추가된다

즉 "어느 예제가 틀렸는지"와 "이번 실험 전체가 이전보다 좋아졌는지"를 한 번에 볼 수 있다.

## 추천 운영 패턴

실무에서는 아래 식으로 쓰면 편하다.

1. row-level evaluator는 최대한 단순하게 유지한다.
2. summary evaluator에는 pass rate, 주요 클래스 F1, latency tail만 넣는다.
3. smoke split과 regression split을 나눠 experiment를 따로 남긴다.
4. 배포 직전 비교는 summary metric부터 보고, 이상하면 row-level failure를 내려간다.

특히 summary metric key 이름은 초반에 안정적으로 정해 두는 편이 좋다. 나중에 실험끼리 비교할 때 같은 이름으로 누적되어야 읽기 쉽다.

## 자주 막히는 부분

### 1. row-level evaluator 없이 summary만 두고 왜 어떤 예제가 틀렸는지 찾으려 한다

summary evaluator는 aggregate만 보여 준다. 실패 예제를 바로 찾으려면 row-level evaluator를 같이 둬야 한다.

### 2. accuracy만 보고 중요한 클래스 실패를 놓친다

운영에서는 전체 accuracy보다 특정 클래스 recall이나 F1이 더 중요할 때가 많다. `billing_f1`처럼 비즈니스 크리티컬 클래스 지표를 따로 두는 편이 낫다.

### 3. summary evaluator에서 row-level metric 결과를 직접 참조하려고 한다

summary evaluator는 기본적으로 `outputs`, `reference_outputs`, `runs`, `examples`를 받는다. row-level evaluator의 반환 dict를 그대로 다시 받는 구조로 생각하면 헷갈리기 쉽다.

### 4. latency 집계를 출력값으로만 해결하려 한다

latency나 token 사용량처럼 run metadata 기반 지표는 `runs` 인자를 받는 summary evaluator로 처리하는 편이 맞다.

### 5. aggregate metric key 이름을 매번 바꾼다

실험 비교 화면에서 추세를 읽으려면 `pass_rate`, `billing_f1`, `p95_latency_s`처럼 key를 고정하는 편이 좋다.

## 마무리

LangSmith에서 `summary_evaluators`를 붙이면 example 단위 채점에서 끝나지 않고, experiment 전체를 바로 비교 가능한 지표로 올릴 수 있다.

실무적으로는 `exact_match` 같은 row-level evaluator 하나와 `pass_rate`, 핵심 클래스 F1, latency tail 정도의 summary evaluator 조합이면 이미 충분히 강하다. 이 정도만 있어도 프롬프트 수정이나 모델 교체를 감이 아니라 수치로 비교할 수 있다.

## 참고 자료

- [How to define a summary evaluator](https://docs.langchain.com/langsmith/summary)
- [How to evaluate agents](https://docs.langchain.com/langsmith/evaluate-llm-application)
- [How to define a code evaluator](https://docs.langchain.com/langsmith/code-evaluator-sdk)
- [How to create a composite evaluator](https://docs.langchain.com/langsmith/composite-evaluators-sdk)
