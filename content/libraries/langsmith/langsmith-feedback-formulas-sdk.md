---
title: "LangSmith feedback formula로 여러 평가 점수를 composite metric으로 묶기"
description: "LangSmith Python SDK로 feedback formula를 만들어 accuracy, groundedness, policy 같은 개별 점수를 하나의 composite metric으로 합성하는 실전 노트"
date: 2026-06-30
tags:
  - langsmith
  - evaluation
  - analytics
  - python
aliases:
  - "/blog/langsmith-feedback-formulas-sdk"
---

# LangSmith feedback formula로 여러 평가 점수를 composite metric으로 묶기

LangSmith로 평가를 운영하다 보면 점수 키가 빠르게 늘어난다.

- `accuracy`
- `groundedness`
- `policy_pass`
- `helpfulness`

개별 점수는 필요한데, 실험 비교나 리뷰 우선순위 결정에서는 결국 "종합 점수 하나"가 다시 필요해진다.  
이럴 때 쓰는 기능이 `feedback formula`다.

feedback formula는 이미 존재하는 feedback key들을 가중치와 집계 방식으로 묶어 새로운 feedback key 하나를 정의한다.  
즉 atomic metric은 유지하면서, dataset이나 experiment 단위로 composite metric을 추가하는 방식이다.

이 글에서는 LangSmith Python SDK 기준으로 아래 흐름만 실전 위주로 정리한다.

- dataset 또는 experiment에 붙일 formula scope 정하기
- `create_feedback_formula(...)`로 composite metric 만들기
- `list_feedback_formulas(...)`와 `update_feedback_formula(...)`로 운영하기
- 자주 헷갈리는 제약 조건 피하기

2026년 6월 30일 기준 Python SDK 시그니처와 공식 Smith API 문서를 함께 확인했다.

## 언제 이 기능이 특히 유용한가

아래 상황이면 feedback formula를 붙일 가치가 크다.

- evaluator가 여러 개라서 실험 결과를 한 숫자로 우선 정렬하고 싶다.
- 사람 리뷰 점수와 자동 evaluator 점수를 같은 축으로 요약하고 싶다.
- `accuracy`만 봐서는 부족하고, `policy_pass`나 `groundedness`까지 함께 반영한 운영 점수가 필요하다.
- dataset별 기준과 production experiment 기준을 따로 운용하고 싶다.

반대로 점수 키가 아직 1~2개뿐이라면 굳이 composite metric을 만들기보다 개별 점수를 그대로 보는 편이 더 단순할 수 있다.

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

기본 클라이언트:

```python
from langsmith import Client

client = Client()
```

## 1. formula는 기존 feedback key를 재조합하는 층이다

공식 SDK 기준으로 `create_feedback_formula(...)`는 아래 입력을 받는다.

- `feedback_key`: 새로 만들 composite metric 이름
- `aggregation_type`: 현재 `sum` 또는 `avg`
- `formula_parts`: 어떤 feedback key를 어떤 weight로 묶을지
- `dataset_id` 또는 `session_id`: 이 formula를 어느 범위에 붙일지

즉 formula를 만들기 전에 이미 atomic feedback key가 있어야 한다.  
예를 들어 이런 점수들이 먼저 존재한다고 가정하면 자연스럽다.

- `accuracy`
- `groundedness`
- `policy_pass`

이 키들은 사람이 직접 남긴 feedback일 수도 있고, evaluator가 기록한 feedback일 수도 있다.

## 2. dataset용 formula와 experiment용 formula는 scope를 다르게 잡는다

Python SDK 기준으로 formula scope는 `dataset_id` 또는 `session_id`로 준다.  
실무에서는 보통 이렇게 이해하면 된다.

- `dataset_id`: 특정 eval dataset 기준 composite metric
- `session_id`: 특정 tracing project 또는 experiment 기준 composite metric

먼저 ID를 읽어 오는 패턴은 아래처럼 단순하다.

```python
from langsmith import Client

client = Client()

dataset = client.read_dataset(dataset_name="customer-support-regression")
project = client.read_project(project_name="support-agent-eval-2026-06-30")

print("dataset_id=", dataset.id)
print("project_id=", project.id)
```

dataset과 project를 둘 다 쓰고 싶더라도 formula 하나는 한 scope에만 묶는 편이 명확하다.  
운영 기준과 평가셋 기준을 섞기 시작하면 나중에 점수 의미가 흐려진다.

## 3. 가장 흔한 예시: weighted average composite metric 만들기

아래 예시는 `accuracy`, `groundedness`, `policy_pass`를 하나의 `release_score`로 합성하는 패턴이다.

```python
from langsmith import Client

client = Client()

dataset = client.read_dataset(dataset_name="customer-support-regression")

formula = client.create_feedback_formula(
    feedback_key="release_score",
    aggregation_type="avg",
    dataset_id=dataset.id,
    formula_parts=[
        {
            "part_type": "weighted_key",
            "key": "accuracy",
            "weight": 0.5,
        },
        {
            "part_type": "weighted_key",
            "key": "groundedness",
            "weight": 0.3,
        },
        {
            "part_type": "weighted_key",
            "key": "policy_pass",
            "weight": 0.2,
        },
    ],
)

print(formula.id, formula.feedback_key, formula.aggregation_type)
```

핵심은 formula가 원본 점수를 대체하지 않는다는 점이다.  
개별 metric은 그대로 남고, 추가로 `release_score`라는 derived metric을 하나 더 두는 구조다.

이 방식이 좋은 이유는 분명하다.

- 실험 비교에서는 composite metric으로 빠르게 정렬할 수 있다.
- 문제 분석 단계에서는 다시 atomic metric으로 내려가 원인을 볼 수 있다.
- 팀 합의가 바뀌면 weight만 조정해 composite 기준을 바꿀 수 있다.

## 4. sum formula는 "중요 신호 누적"용으로 쓰기 좋다

`avg`가 평균형 종합 점수라면, `sum`은 특정 신호를 누적하는 운영 지표에 더 잘 맞는다.

예를 들어 안전성 위반, 정책 실패, 사람 escalatation 필요 여부를 하나의 risk score로 더할 수 있다.

```python
from langsmith import Client

client = Client()

project = client.read_project(project_name="support-agent-prod-review")

formula = client.create_feedback_formula(
    feedback_key="risk_score",
    aggregation_type="sum",
    session_id=project.id,
    formula_parts=[
        {
            "part_type": "weighted_key",
            "key": "policy_violation",
            "weight": 1.0,
        },
        {
            "part_type": "weighted_key",
            "key": "hallucination_flag",
            "weight": 1.0,
        },
        {
            "part_type": "weighted_key",
            "key": "needs_escalation",
            "weight": 2.0,
        },
    ],
)

print(formula.id)
```

이 패턴은 "낮을수록 좋은 평균 점수"보다 "위험 신호가 얼마나 누적됐는가"를 보고 싶을 때 더 자연스럽다.

## 5. formula는 조회와 수정 루프까지 같이 생각해야 한다

처음 한 번 만들고 끝나는 경우보다, 팀 기준이 바뀌어 weight를 조정하는 경우가 더 많다.

현재 등록된 formula를 확인하려면:

```python
from langsmith import Client

client = Client()

project = client.read_project(project_name="support-agent-prod-review")

for formula in client.list_feedback_formulas(session_id=project.id, limit=20):
    print(
        formula.id,
        formula.feedback_key,
        formula.aggregation_type,
        [(part.key, part.weight) for part in formula.formula_parts],
    )
```

weight를 바꾸고 싶으면 formula ID를 기준으로 전체 파트를 다시 넘겨 수정한다.

```python
from langsmith import Client

client = Client()

formula_id = "11111111-1111-1111-1111-111111111111"

updated = client.update_feedback_formula(
    formula_id,
    feedback_key="release_score",
    aggregation_type="avg",
    formula_parts=[
        {
            "part_type": "weighted_key",
            "key": "accuracy",
            "weight": 0.6,
        },
        {
            "part_type": "weighted_key",
            "key": "groundedness",
            "weight": 0.25,
        },
        {
            "part_type": "weighted_key",
            "key": "policy_pass",
            "weight": 0.15,
        },
    ],
)

print(updated.modified_at)
```

이때 부분 수정으로 생각하지 말고 "현재 정의 전체를 교체한다"는 마음으로 다루는 편이 안전하다.

## 6. 실무에서 가장 무난한 설계 순서

개인적으로는 아래 순서가 가장 덜 흔들렸다.

1. atomic feedback key를 먼저 안정화한다.
2. composite metric은 하나만 추가해 의미를 좁게 둔다.
3. dataset용 formula와 production project용 formula를 분리한다.
4. composite metric으로 순위를 보되, 원인 분석은 atomic metric으로 내려간다.

예를 들어 이런 식이다.

- dataset regression 평가: `release_score`
- production triage: `risk_score`

이렇게 나누면 점수 목적이 달라져도 metric 이름과 해석이 비교적 깔끔하게 유지된다.

## 자주 틀리는 점

### 1. formula가 raw run 필드를 직접 합성한다고 생각한다

공식 SDK 기준 formula part는 현재 `weighted_key` 형태의 feedback key 조합이다.  
즉 `latency`, `total_tokens` 같은 raw run 필드를 그대로 섞는 구조로 생각하면 안 된다.

### 2. atomic metric 의미가 불안정한데 composite부터 만든다

`accuracy`가 어떤 큐에서는 사실성, 다른 큐에서는 UX 만족도라면 composite metric은 더 빨리 망가진다.  
기초 key 의미를 먼저 고정해야 한다.

### 3. dataset 기준과 project 기준을 같은 formula 이름으로 섞는다

같은 `release_score`라도 dataset용과 production project용 의미가 다를 수 있다.  
scope가 다르면 이름도 약간 구분하는 편이 운영상 안전하다.

### 4. `avg`와 `sum`을 아무 설명 없이 바꾼다

평균형 품질 점수와 위험도 누적 점수는 해석이 전혀 다르다.  
aggregation type이 바뀌면 대시보드 설명과 팀 운영 규칙도 같이 바뀌어야 한다.

### 5. 권한 문제를 코드 문제로 오해한다

feedback formula 생성과 수정이 막히면 SDK 버그보다 먼저 워크스페이스 권한과 대상 scope 접근 권한을 확인하는 편이 낫다.

## 마무리

LangSmith feedback formula는 "점수를 더 많이 만들기 위한 기능"이라기보다, 이미 쌓인 feedback을 운영 의사결정에 맞는 composite metric으로 정리하는 층에 가깝다.

atomic metric을 버리지 않고 유지한 채, 실험 비교용 종합 점수나 운영 위험 점수를 추가로 만드는 용도로 쓰면 가장 실용적이다.

다음 단계로는 `list_feedback(...)`와 experiment 지표를 함께 봐서 composite metric이 실제 운영 품질과 얼마나 맞는지 검증해 보는 흐름이 좋다.

## 참고 자료

- [Client reference](https://reference.langchain.com/python/langsmith/client/Client)
- [FeedbackFormulaWeightedVariable schema](https://reference.langchain.com/python/langsmith/schemas/FeedbackFormulaWeightedVariable)
- [Create Feedback Formula API](https://docs.langchain.com/langsmith/smith-api/feedback/create-feedback-formula-ep)
- [List Feedback Formula API](https://docs.langchain.com/langsmith/smith-api/feedback/list-feedback-formula-ep)
- [Update Feedback Formula API](https://docs.langchain.com/langsmith/smith-api/feedback/update-feedback-formula-ep)
- [Organization and workspace operations](https://docs.langchain.com/langsmith/organization-workspace-operations)
