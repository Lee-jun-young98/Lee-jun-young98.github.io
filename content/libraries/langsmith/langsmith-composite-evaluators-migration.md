---
title: "LangSmith composite evaluator로 여러 품질 점수를 하나로 묶기"
description: "종료된 feedback formula 대신 composite evaluator의 weighted average·sum과 Python SDK 사용자 정의 집계를 사용해 품질 점수를 운영하는 방법"
date: 2026-09-04
tags:
  - langsmith
  - evaluation
  - composite-evaluator
  - migration
aliases:
  - "/blog/langsmith-composite-evaluators-migration"
---

# LangSmith composite evaluator로 여러 품질 점수를 하나로 묶기

챗봇 품질을 `correctness`, `helpfulness`, `safety`처럼 여러 점수로 측정하면 모델 버전을 한 줄로 비교하거나 alert 기준을 정하기 어렵다. 이때 원자 지표는 그대로 보존하면서 의사결정용 점수 하나를 만드는 기능이 **composite evaluator**다.

기존 `feedback formula` API는 2026년 8월 20일 제거 예정으로 문서화되었다. 새 구현은 feedback formula를 더 만들기보다 composite evaluator로 옮겨야 한다. UI에서는 weighted average와 weighted sum을 제공하고, Python SDK에서는 실험 결과를 읽어 사용자 정의 집계를 feedback으로 기록할 수 있다.

## 사전 준비

- 개별 evaluator가 숫자 `score`를 같은 범위로 반환해야 한다.
- SDK 예제는 `langsmith>=0.4.29`가 필요하다.
- `LANGSMITH_API_KEY`를 설정한다.
- offline 용도라면 dataset과 완료된 experiment, online 용도라면 tracing project가 필요하다.

```powershell
pip install -U "langsmith>=0.4.29"
$env:LANGSMITH_API_KEY="lsv2_..."
```

categorical `value`는 그대로 가중 평균할 수 없다. `pass/fail`을 합치고 싶다면 evaluator 단계에서 `1.0/0.0`처럼 의미가 명확한 숫자 score도 함께 반환한다.

## 1. 먼저 원자 지표를 안정화하기

아래 evaluator는 하나의 실행에서 세 점수를 반환한다. 키 이름과 범위는 composite 계약의 일부이므로 자주 바꾸지 않는다.

```python
def quality_dimensions(outputs: dict, reference_outputs: dict) -> list[dict]:
    answer = outputs["answer"]
    expected = reference_outputs["answer"]

    return [
        {
            "key": "correctness",
            "score": float(answer.strip() == expected.strip()),
        },
        {
            "key": "conciseness",
            "score": max(0.0, 1.0 - len(answer) / 1000),
        },
        {
            "key": "safety",
            "score": float("password" not in answer.lower()),
        },
    ]
```

실전에서는 correctness나 helpfulness를 LLM judge로 평가할 수 있다. 중요한 것은 세 점수의 방향을 맞추는 것이다. 어떤 지표는 높을수록 좋고 다른 지표는 낮을수록 좋다면 먼저 `1 - normalized_risk`처럼 변환해야 한다.

## 2. UI에서 weighted average 만들기

dataset의 offline evaluation과 tracing project의 online evaluation 모두 같은 방식으로 시작한다.

1. dataset 또는 tracing project의 **Evaluators** 탭으로 이동한다.
2. **+ Evaluator → Composite score**를 선택한다.
3. 결과 key를 `overall_quality`로 정한다.
4. `correctness=0.6`, `safety=0.3`, `conciseness=0.1`을 추가한다.
5. **Average** 또는 **Sum**을 선택해 저장한다.

Average는 다음 식을 사용한다.

```text
sum(weight_i * score_i) / sum(weight_i)
```

가중치 합이 1이 아니어도 정규화되므로 0~1 지표의 결과 범위를 유지하기 쉽다. Sum은 정규화하지 않으므로 penalty, point budget, 비용처럼 합 자체에 의미가 있을 때 쓴다.

구성 지표 중 하나라도 해당 run에 없으면 composite score는 계산되지 않는다. 누락 지표를 암묵적으로 0점 처리하지 않는 점은 장점이지만, evaluator마다 서로 다른 filter나 sampling rate를 쓰면 composite 데이터가 예상보다 적어질 수 있다.

## 3. SDK로 사용자 정의 composite feedback 만들기

SDK 방식은 UI의 average/sum보다 복잡한 규칙이 필요할 때 적합하다. 예를 들어 safety가 기준 미달이면 평균과 무관하게 전체 점수를 0으로 만들 수 있다.

```python
from __future__ import annotations

import math
import os

from langsmith import Client

client = Client(api_key=os.environ["LANGSMITH_API_KEY"])

EXPERIMENT_NAME = "support-bot-v12"
WEIGHTS = {
    "correctness": 0.6,
    "safety": 0.3,
    "conciseness": 0.1,
}


def composite_score(feedback_stats: dict) -> float:
    if not set(WEIGHTS).issubset(feedback_stats):
        return math.nan

    scores: dict[str, float] = {}
    for key in WEIGHTS:
        stats = feedback_stats[key]
        if stats.get("n", 0) < 1 or "avg" not in stats:
            return math.nan
        scores[key] = float(stats["avg"])

    # 안전성은 평균으로 상쇄할 수 없는 hard gate로 취급한다.
    if scores["safety"] < 1.0:
        return 0.0

    return sum(scores[key] * weight for key, weight in WEIGHTS.items())


results = client.get_experiment_results(name=EXPERIMENT_NAME)

for example_with_runs in results["examples_with_runs"]:
    for run in example_with_runs.runs:
        score = composite_score(run.feedback_stats or {})
        if math.isnan(score):
            continue
        client.create_feedback(
            run_id=run.id,
            key="overall_quality_v1",
            score=score,
            comment="60% correctness + 30% safety + 10% conciseness; safety gate",
        )
```

이 스크립트는 constituent evaluator 처리가 끝난 뒤 실행해야 한다. 실험이 아직 평가 중이면 일부 run의 `feedback_stats`가 비어 있어 결과가 빠질 수 있다.

## 4. feedback formula에서 옮길 때의 체크리스트

1. 기존 formula의 source feedback key, aggregation, weight를 기록한다.
2. 각 key가 숫자 score인지, 범위와 방향이 같은지 확인한다.
3. 동일한 dataset 또는 project에 composite evaluator를 만든다.
4. 새 key에는 `overall_quality_v1`처럼 버전을 넣어 기존 결과와 섞이지 않게 한다.
5. 일정 기간 두 결과를 비교한 뒤 dashboard와 alert를 새 key로 전환한다.
6. 원자 지표 차트는 유지한다. composite가 하락했을 때 원인을 찾는 데 필요하다.

UI composite evaluator의 weight를 수정하면 해당 evaluator가 구성된 run의 결과도 갱신된다. 따라서 장기 추세를 재현해야 한다면 이름에 정책 버전을 넣고 새 evaluator를 만드는 편이 안전하다.

## 5. online evaluation에서 비용까지 확인하기

online evaluator가 trace 안의 run에서 실행되면 해당 trace가 extended retention으로 자동 승격될 수 있다. composite 자체만 보는 것이 아니라 constituent evaluator의 sampling과 filter까지 합쳐 비용을 계산해야 한다.

또한 세 구성 evaluator의 적용 대상이 정확히 같아야 한다. 예를 들어 `safety`는 모든 root run, `helpfulness`는 성공 run의 10%에만 적용하면 두 key가 동시에 존재하는 표본에서만 composite가 만들어져 대표성이 흔들린다.

## 흔한 실수

### 서로 다른 척도를 바로 더한다

0~1 점수와 1~5 점수를 그대로 더하면 후자가 weight보다 더 큰 영향력을 갖는다. 먼저 같은 범위로 정규화한다.

### 필수 지표 누락을 0점으로 바꾼다

평가 실패와 품질 실패는 다르다. 누락은 별도 운영 지표로 세고 composite 계산에서는 제외하거나 재평가한다.

### safety를 평균으로 상쇄한다

정확도가 높다는 이유로 보안 위반을 통과시키면 안 된다. hard gate 또는 배포 차단 assertion으로 분리한다.

### composite 하나만 저장한다

종합 점수만 남기면 회귀 원인을 찾을 수 없다. constituent feedback은 삭제하지 않고 함께 보존한다.

## 정리

composite evaluator는 여러 품질 지표를 대시보드, experiment 정렬, alert에 쓸 하나의 점수로 압축한다. 단순한 가중 평균이나 합은 UI에서 구성하고, hard gate나 비선형 규칙은 SDK로 계산해 feedback으로 기록한다. 핵심은 원자 지표의 범위·방향·적용 대상을 먼저 맞추고, 정책 버전을 결과 key에 남기는 것이다.

## 참고 자료

- [How to create a composite evaluator (UI)](https://docs.langchain.com/langsmith/composite-evaluators-ui)
- [How to create a composite evaluator (SDK)](https://docs.langchain.com/langsmith/composite-evaluators-sdk)
- [Set up composite online evaluators](https://docs.langchain.com/langsmith/online-evaluations-composite)
- [Evaluation types](https://docs.langchain.com/langsmith/evaluation-types)
- [Organization and workspace operations reference](https://docs.langchain.com/langsmith/organization-workspace-operations)
