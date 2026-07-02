---
title: "LangSmith REST API로 외부 실험 결과 업로드하기"
description: "LangSmith SDK 밖에서 실행한 평가 결과를 externally-managed dataset에 업로드하고, 비교 가능한 experiment로 묶어 보는 실전 노트"
date: 2026-07-02
tags:
  - langsmith
  - evaluation
  - rest-api
  - python
aliases:
  - "/blog/langsmith-upload-external-experiments-rest-api"
---

# LangSmith REST API로 외부 실험 결과 업로드하기

LangSmith SDK로 `evaluate()`를 돌릴 수 있으면 그쪽이 가장 편하다.  
하지만 실무에서는 꼭 그 흐름만 있는 것은 아니다.

- 모델 추론과 평가가 이미 사내 배치 시스템에서 끝난다
- Python SDK를 직접 넣기 어려운 언어 또는 제한된 런타임을 쓴다
- 기존 평가 결과를 LangSmith UI에서만 비교하고 싶다
- 로컬 CSV/JSON 결과를 LangSmith dataset + experiment 뷰로 가져오고 싶다

이럴 때 쓰는 기능이 `/api/v1/datasets/upload-experiment`다.  
이 엔드포인트를 쓰면 LangSmith 밖에서 만든 평가 결과를 LangSmith의 externally-managed dataset과 experiment로 업로드할 수 있다.

이 글은 2026년 7월 2일 기준 공식 LangSmith 문서를 바탕으로 아래만 실무적으로 정리한다.

- 어떤 경우에 이 방식이 맞는지
- request body를 어떻게 잡아야 하는지
- Python `requests`로 업로드하는 최소 예제
- 업로드 직후 experiment를 확인하는 방법
- 자주 틀리는 제약 사항

## 언제 이 방식이 유용한가

아래 조건이면 upload-experiment 방식이 잘 맞는다.

- 이미 다른 시스템에서 example별 입력, 정답, 실제 출력이 계산되어 있다
- SDK 기반 tracing 없이 결과만 LangSmith UI에 모으고 싶다
- 여러 배치 실험을 같은 외부 dataset 기준으로 비교하고 싶다
- 토큰 비용이나 latency보다 정답률, 사람 평가, rule-based score를 우선 보고 싶다

반대로 LangSmith 안에서 target 함수 실행부터 evaluator 추가까지 한 번에 하고 싶다면 `evaluate()` 기반 워크플로가 더 단순하다.

## 핵심 개념

이 엔드포인트는 "LangSmith에 없는 외부 실험 결과를 나중에 가져오는" 용도다.

- `dataset_id` 또는 `dataset_name`은 LangSmith 내부 dataset ID가 아니라 외부 시스템 기준 식별자 역할을 한다
- 같은 `dataset_id` 또는 `dataset_name`으로 여러 번 업로드하면 하나의 externally-managed dataset 아래에 여러 experiment가 묶인다
- 각 `results[]` 항목은 dataset row 1개 + 그 row에 대한 run 결과 1개를 같이 표현한다
- row별 `start_time`과 `end_time`은 experiment 전체 시간 범위 안에 있어야 한다

가장 중요한 제약은 이것이다.

- 이 업로드는 externally-managed dataset에만 지원된다
- 일반 LangSmith dataset에는 이 엔드포인트로 experiment를 붙일 수 없다

즉 이미 UI나 SDK로 만든 일반 dataset에 외부 실험만 나중에 붙이려 하면 막힌다.

## 사전 준비

필요한 준비물은 아래와 같다.

- LangSmith API key
- 업로드할 외부 평가 결과
- example별로 안정적으로 재현 가능한 `row_id`
- experiment 이름과 시간 범위
- 외부 dataset을 대표하는 `dataset_id` 또는 `dataset_name`

Python 예제는 `requests`만 있으면 된다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U requests langsmith
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
```

기본 헬퍼:

```python
import os
import requests


LANGSMITH_API_KEY = os.environ["LANGSMITH_API_KEY"]
LANGSMITH_BASE_URL = os.environ.get(
    "LANGSMITH_BASE_URL",
    "https://api.smith.langchain.com",
)


def smith_request(method: str, path: str, **kwargs):
    response = requests.request(
        method=method,
        url=f"{LANGSMITH_BASE_URL}{path}",
        headers={
            "x-api-key": LANGSMITH_API_KEY,
            "content-type": "application/json",
        },
        timeout=30,
        **kwargs,
    )
    response.raise_for_status()
    return response.json()
```

`LANGSMITH_BASE_URL`을 따로 둔 이유는 self-hosted 또는 regional SaaS 환경에서 API 도메인이 달라질 수 있기 때문이다.

## request body에서 꼭 잡아야 할 필드

실무에서는 아래 필드만 제대로 잡아도 대부분 충분하다.

- `experiment_name`
- `experiment_start_time`
- `experiment_end_time`
- `dataset_id` 또는 `dataset_name`
- `results`

`results`의 각 항목에는 보통 아래가 들어간다.

- `row_id`
- `inputs`
- `expected_outputs`
- `actual_outputs`
- `evaluation_scores`
- `start_time`
- `end_time`
- `run_name`
- `run_metadata`

업로드 후 LangSmith 비교 뷰에서 보기 좋게 하려면 `evaluation_scores[].key` 이름을 실험 간에 일관되게 유지하는 편이 좋다.

## 최소 업로드 예제

아래 예제는 외부 분류기 평가 결과 두 건을 LangSmith에 업로드한다.

```python
from datetime import datetime, timedelta, timezone
from uuid import uuid4


experiment_started_at = datetime.now(timezone.utc)
experiment_finished_at = experiment_started_at + timedelta(seconds=8)

rows = [
    {
        "row_id": str(uuid4()),
        "inputs": {
            "question": "7 * 8은 얼마야?"
        },
        "expected_outputs": {
            "answer": "56"
        },
        "actual_outputs": {
            "answer": "56"
        },
        "evaluation_scores": [
            {
                "key": "correctness",
                "score": 1.0,
                "comment": "정답과 일치",
                "feedback_source": {"type": "api"},
            }
        ],
        "start_time": experiment_started_at.isoformat(),
        "end_time": (experiment_started_at + timedelta(seconds=2)).isoformat(),
        "run_name": "batch-math-checker",
        "run_metadata": {
            "model": "gpt-4.1-mini",
            "batch_id": "eval-2026-07-02-01",
        },
    },
    {
        "row_id": str(uuid4()),
        "inputs": {
            "question": "대한민국의 수도는 어디야?"
        },
        "expected_outputs": {
            "answer": "서울"
        },
        "actual_outputs": {
            "answer": "부산"
        },
        "evaluation_scores": [
            {
                "key": "correctness",
                "score": 0.0,
                "comment": "정답 불일치",
                "feedback_source": {"type": "api"},
            },
            {
                "key": "hallucination",
                "score": 1.0,
                "comment": "근거 없이 오답 생성",
                "feedback_source": {"type": "api"},
            },
        ],
        "start_time": (experiment_started_at + timedelta(seconds=3)).isoformat(),
        "end_time": (experiment_started_at + timedelta(seconds=6)).isoformat(),
        "run_name": "batch-math-checker",
        "run_metadata": {
            "model": "gpt-4.1-mini",
            "batch_id": "eval-2026-07-02-01",
        },
    },
]

payload = {
    "experiment_name": "external-eval-gpt-4.1-mini-2026-07-02",
    "experiment_description": "외부 배치 평가 결과 업로드 예제",
    "experiment_start_time": experiment_started_at.isoformat(),
    "experiment_end_time": experiment_finished_at.isoformat(),
    "dataset_name": "external-qa-regression",
    "dataset_description": "외부 시스템에서 관리하는 QA 회귀 평가셋",
    "experiment_metadata": {
        "pipeline": "nightly-regression",
        "model": "gpt-4.1-mini",
        "source_system": "internal-batch-runner",
    },
    "summary_experiment_scores": [
        {
            "key": "accuracy",
            "score": 0.5,
            "comment": "2개 중 1개 정답",
            "feedback_source": {"type": "api"},
        }
    ],
    "results": rows,
}

result = smith_request(
    "POST",
    "/api/v1/datasets/upload-experiment",
    json=payload,
)

print("dataset_id:", result["dataset"]["id"])
print("experiment_id:", result["experiment"]["id"])
print("externally_managed:", result["dataset"]["externally_managed"])
```

이 요청이 성공하면 response에는 새로 생성되거나 재사용된 dataset 정보와 experiment 정보가 함께 돌아온다.

## 업로드 직후 확인할 것

공식 문서 예시처럼 업로드 직후에는 experiment 통계가 아직 비어 있을 수 있다.  
몇 초 뒤 다시 읽으면 `feedback_stats`, `latency_p50` 같은 집계가 채워진다.

간단히 확인하려면 Python SDK의 `read_project(..., include_stats=True)`를 같이 쓰면 편하다.

```python
import time
from langsmith import Client


client = Client(
    api_key=LANGSMITH_API_KEY,
    api_url=LANGSMITH_BASE_URL,
)

experiment_id = result["experiment"]["id"]

time.sleep(5)

project = client.read_project(project_id=experiment_id, include_stats=True)

print(project.name)
print(project.run_count)
print(project.feedback_stats)
print(project.error_rate)
```

LangSmith 문서에서 project, experiment, session 용어가 섞여 보일 수 있는데, 현재 문서 기준으로 backend에서는 같은 기반 구조를 공유한다. 그래서 SDK 메서드 이름은 `read_project()`인데 experiment 조회에도 쓰인다.

## 운영 패턴

실제로는 아래 패턴으로 운영하면 깔끔하다.

1. 외부 평가셋마다 고정된 `dataset_name` 또는 `dataset_id`를 둔다.
2. 각 nightly run마다 새 `experiment_name`을 만든다.
3. row별 `row_id`는 평가 데이터 원본 row와 안정적으로 연결되게 유지한다.
4. `evaluation_scores[].key`는 `correctness`, `groundedness`, `policy_pass`처럼 고정한다.
5. `experiment_metadata`와 `run_metadata`에 모델명, 배치 ID, git SHA를 남긴다.

이렇게 하면 LangSmith UI의 dataset 비교 뷰에서 회귀를 찾기가 쉬워진다.

## 자주 하는 실수

### 1. 기존 일반 dataset에 붙이려 한다

가장 흔한 실수다.  
이 엔드포인트는 externally-managed dataset 전용이다. 기존 UI/SDK dataset에 임의의 외부 experiment를 추가하는 용도가 아니다.

### 2. `dataset_id`를 LangSmith 내부 dataset UUID로 착각한다

이 필드는 외부 시스템 식별자로 생각하는 편이 안전하다.  
문서에서도 이 endpoint로 생성된 dataset이 아니라면 기존 dataset에 연결하지 말라고 안내한다.

### 3. row 시간 범위가 experiment 범위를 벗어난다

`results[].start_time`과 `results[].end_time`은 반드시 `experiment_start_time`과 `experiment_end_time` 사이에 들어가야 한다.

### 4. `row_id`를 매번 랜덤으로만 만든다

샘플 코드에서는 `uuid4()`를 썼지만, 실무에서는 외부 원본 row와 다시 연결할 수 있는 안정적인 키가 더 낫다.  
업로드 후 회귀 원인을 다시 찾을 때 훨씬 편하다.

### 5. 실험 간 score key 이름이 들쭉날쭉하다

어제는 `accuracy`, 오늘은 `acc`, 내일은 `correctness`처럼 섞이면 비교 뷰가 지저분해진다.  
지표 이름을 고정해 두는 편이 좋다.

## 이 방식과 `evaluate()`의 차이

`evaluate()`는 LangSmith가 run 생성과 evaluator 연결을 대부분 대신 해 준다.  
반면 upload-experiment는 이미 끝난 외부 결과를 "한 번에 적재"하는 흐름에 가깝다.

정리하면 아래 기준으로 고르면 된다.

- LangSmith가 실행 주체면: `evaluate()`
- 외부 시스템이 실행 주체고 LangSmith는 결과 관찰/비교 UI 역할이면: upload-experiment

## 참고 자료

- [How to upload experiments run outside of LangSmith with the REST API](https://docs.langchain.com/langsmith/upload-existing-experiments)
- [How to fetch performance metrics for an experiment](https://docs.langchain.com/langsmith/fetch-perf-metrics-experiment)
- [How to use the REST API](https://docs.langchain.com/langsmith/run-evals-api-only)
