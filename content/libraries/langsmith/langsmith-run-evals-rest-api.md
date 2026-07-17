---
title: "LangSmith REST API만으로 dataset 기반 evaluation 실행하기"
description: "SDK 없이 LangSmith REST API로 dataset example 조회, experiment(session) 생성, run 업로드, feedback 채점, pairwise 비교까지 묶는 실전 노트"
date: 2026-07-17
tags:
  - langsmith
  - evaluation
  - rest-api
  - python
aliases:
  - "/blog/langsmith-run-evals-rest-api"
---

# LangSmith REST API만으로 dataset 기반 evaluation 실행하기

LangSmith의 `evaluate()`는 편하다.  
하지만 실무에서는 꼭 Python SDK를 바로 넣을 수 있는 환경만 있지는 않다.

- 추론 파이프라인이 다른 언어 또는 사내 배치 시스템에 있다
- 평가 실행은 별도 워커가 맡고 LangSmith는 결과 집계 UI로만 쓰고 싶다
- SDK 없이 HTTP 요청만 허용되는 런타임이 있다
- experiment 생성, run 기록, feedback 채점을 API 단계로 명확히 분리하고 싶다

이럴 때는 LangSmith REST API만으로도 dataset 기반 evaluation을 돌릴 수 있다.  
다만 이 경로에서는 SDK가 대신 해 주던 연결 작업을 직접 해야 한다.

- dataset example을 직접 읽어 와야 한다
- experiment를 API에서는 `session`으로 만들어야 한다
- 각 run에 `reference_example_id`와 `session_id`를 직접 넣어야 한다
- run 종료와 experiment 종료를 `PATCH`로 명시해야 한다

이 글은 2026년 7월 17일 기준 공식 문서를 바탕으로 아래만 실무적으로 정리한다.

- REST API 기반 evaluation이 언제 맞는지
- 단일 experiment를 만드는 최소 흐름
- root run과 child run을 같이 남기는 Python 예제
- feedback 점수와 pairwise preference를 나중에 붙이는 방법
- 자주 막히는 지점

## 언제 이 방식이 맞는가

다음 조건이면 REST API 방식이 꽤 잘 맞는다.

- 추론은 이미 다른 서비스에서 돌고 있고 LangSmith에는 기록만 남기고 싶다
- SDK 의존성을 최소화해야 한다
- 여러 모델 결과를 같은 dataset 기준으로 비교 experiment로 묶고 싶다
- example별 출력과 점수를 LangSmith UI에서 보고 싶다

반대로 Python 환경을 자유롭게 쓸 수 있고 target 함수부터 evaluator까지 한 번에 돌리고 싶다면 `evaluate()`가 더 단순하다.  
공식 문서도 기본 권장 경로는 SDK라고 명시한다.

## 사전 준비

가장 실무적인 준비는 "dataset은 먼저 만들어 두고, 평가 워커는 REST만 호출한다"는 분리다.

- LangSmith dataset 1개
- `LANGSMITH_API_KEY`
- 모델 호출용 API key
- Python `requests`

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U requests openai
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:OPENAI_API_KEY="sk-your_key"
$env:LANGSMITH_DATASET_ID="your-dataset-uuid"
```

기본 헬퍼는 아래 정도면 충분하다.

```python
import os
import requests


LANGSMITH_BASE_URL = os.environ.get(
    "LANGSMITH_BASE_URL",
    "https://api.smith.langchain.com",
)
LANGSMITH_API_KEY = os.environ["LANGSMITH_API_KEY"]


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

`LANGSMITH_BASE_URL`을 변수로 빼 둔 이유는 self-hosted 또는 regional SaaS 환경에서 API 도메인이 다를 수 있기 때문이다.

## 핵심 개념 세 가지만 먼저 잡기

공식 문서 기준으로 REST API 흐름에서 특히 중요한 것은 아래 세 가지다.

1. experiment는 API에서 `session` 또는 `tracer session`으로 다룬다
2. experiment에 속한 run은 `reference_example_id`로 dataset example과 연결된다
3. run과 experiment 모두 끝날 때 `end_time`을 직접 채워 줘야 한다

이 세 가지를 빼먹으면 UI에서 experiment가 이상하게 보이거나, 비교/집계가 비어 있는 경우가 생긴다.

## 1. dataset example을 먼저 읽어 온다

평가 실행 전에 dataset example 목록을 받아 온다.  
REST 경로에서는 이 목록이 이후 run 생성의 기준이 된다.

```python
import os


dataset_id = os.environ["LANGSMITH_DATASET_ID"]

examples = smith_request(
    "GET",
    "/api/v1/examples",
    params={"dataset": dataset_id},
)

print(f"loaded_examples={len(examples)}")
print(examples[0]["id"])
print(examples[0]["inputs"])
```

여기서 가져온 `example["id"]`를 나중에 `reference_example_id`로 그대로 넣는다.

## 2. experiment(session)를 만든다

REST API 기준 experiment는 `/api/v1/sessions`로 생성한다.  
중요한 필드는 `reference_dataset_id`다.

```python
from datetime import datetime, timezone
from uuid import uuid4


experiment = smith_request(
    "POST",
    "/api/v1/sessions",
    json={
        "name": f"support-eval-api-only-{str(uuid4())[:8]}",
        "description": "SDK 없이 REST API만으로 실행한 evaluation 예제",
        "reference_dataset_id": dataset_id,
        "start_time": datetime.now(timezone.utc).isoformat(),
        "extra": {
            "metadata": {
                "runner": "nightly-batch",
                "model": "gpt-4.1-mini",
                "source": "api-only-eval",
            }
        },
    },
)

experiment_id = experiment["id"]
print("experiment_id:", experiment_id)
```

이 시점부터 이 experiment에 들어가는 모든 run은 `session_id=experiment_id`를 가져야 한다.

## 3. example마다 root run과 child run을 직접 기록한다

공식 문서 예제도 같은 구조를 쓴다.  
부모 `chain` run을 만들고, 실제 모델 호출은 child `llm` run으로 남긴 뒤, 둘 다 `PATCH`로 닫는다.

아래 예제는 toxic / not toxic 분류처럼 구조가 단순한 dataset을 가정한다.

```python
import os
from datetime import datetime, timezone
from uuid import uuid4

from openai import OpenAI


client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_run(
    *,
    run_id: str,
    name: str,
    run_type: str,
    inputs: dict,
    reference_example_id: str,
    session_id: str,
    parent_run_id: str | None = None,
) -> None:
    payload = {
        "id": run_id,
        "name": name,
        "run_type": run_type,
        "inputs": inputs,
        "start_time": now_iso(),
        "reference_example_id": reference_example_id,
        "session_id": session_id,
    }
    if parent_run_id:
        payload["parent_run_id"] = parent_run_id

    smith_request("POST", "/api/v1/runs", json=payload)


def finish_run(run_id: str, outputs: dict) -> None:
    smith_request(
        "PATCH",
        f"/api/v1/runs/{run_id}",
        json={
            "outputs": outputs,
            "end_time": now_iso(),
        },
    )


def run_one_example(example: dict, experiment_id: str, model_name: str) -> None:
    text = example["inputs"]["text"]
    reference_example_id = example["id"]

    messages = [
        {
            "role": "system",
            "content": (
                "Classify the user text as either 'Toxic' or 'Not toxic'. "
                "Return only one of those labels."
            ),
        },
        {"role": "user", "content": text},
    ]

    parent_run_id = str(uuid4())
    child_run_id = str(uuid4())

    create_run(
        run_id=parent_run_id,
        name="toxicity-pipeline",
        run_type="chain",
        inputs={"text": text},
        reference_example_id=reference_example_id,
        session_id=experiment_id,
    )

    create_run(
        run_id=child_run_id,
        name="openai-chat-completion",
        run_type="llm",
        inputs={"messages": messages},
        reference_example_id=reference_example_id,
        session_id=experiment_id,
        parent_run_id=parent_run_id,
    )

    response = client.chat.completions.create(
        model=model_name,
        messages=messages,
    )
    predicted_label = response.choices[0].message.content.strip()

    finish_run(
        child_run_id,
        {
            "model": model_name,
            "label": predicted_label,
            "messages": messages,
        },
    )
    finish_run(parent_run_id, {"label": predicted_label})
```

이 패턴의 장점은 두 가지다.

- experiment 비교 뷰에서는 root run 출력이 보기 쉽다
- trace 상세 화면에서는 child `llm` run까지 내려가며 디버깅할 수 있다

## 4. 전체 example을 돌린 뒤 experiment를 닫는다

experiment를 만들기만 하고 닫지 않으면 집계가 늦거나 UI에서 진행 중처럼 보일 수 있다.

```python
model_name = "gpt-4.1-mini"

for example in examples:
    run_one_example(example, experiment_id, model_name)

smith_request(
    "PATCH",
    f"/api/v1/sessions/{experiment_id}",
    json={"end_time": now_iso()},
)
```

이 단계까지 끝나면 "dataset 기반 experiment 한 번"이 LangSmith에 기록된다.

## 5. run을 다시 조회해 feedback 점수를 붙인다

이제 평가 점수를 넣는다.  
공식 문서 예제처럼 `/api/v1/runs/query`로 root run을 읽고, 각 run에 `/api/v1/feedback`을 POST하면 된다.

```python
examples_by_id = {example["id"]: example for example in examples}

runs_response = smith_request(
    "POST",
    "/api/v1/runs/query",
    json={
        "session": [experiment_id],
        "is_root": True,
        "select": ["id", "reference_example_id", "outputs"],
    },
)

for run in runs_response["runs"]:
    example = examples_by_id[run["reference_example_id"]]
    expected_label = example["outputs"]["label"]
    actual_label = (run.get("outputs") or {}).get("label", "")
    is_correct = expected_label.lower() == actual_label.lower()

    smith_request(
        "POST",
        "/api/v1/feedback",
        json={
            "run_id": str(run["id"]),
            "key": "correctness",
            "score": 1.0 if is_correct else 0.0,
            "comment": f"expected={expected_label}, actual={actual_label}",
        },
    )
```

이렇게 하면 LangSmith UI에서 experiment별 정확도 지표를 확인하기 쉬워진다.  
실무에서는 `correctness` 하나만 넣기보다 `policy_pass`, `format_ok`, `latency_bucket` 같은 key를 함께 두는 편이 좋다.

## 6. 두 experiment를 pairwise 비교 experiment로 묶을 수도 있다

공식 문서에는 comparative experiment도 같은 흐름으로 나온다.  
이미 만들어 둔 두 experiment ID가 있으면 `/api/v1/datasets/comparative`로 묶고, 각 example에 대해 선호 결과를 feedback으로 남긴다.

```python
from collections import defaultdict
from uuid import uuid4


comparative = smith_request(
    "POST",
    "/api/v1/datasets/comparative",
    json={
        "experiment_ids": [baseline_experiment_id, candidate_experiment_id],
        "reference_dataset_id": dataset_id,
        "name": f"support-pairwise-{str(uuid4())[:8]}",
        "description": "baseline vs candidate pairwise comparison",
    },
)

comparative_experiment_id = comparative["id"]

runs_response = smith_request(
    "POST",
    "/api/v1/runs/query",
    json={
        "session": [baseline_experiment_id, candidate_experiment_id],
        "is_root": True,
        "select": ["id", "reference_example_id", "outputs"],
    },
)

runs_by_example_id = defaultdict(list)
for run in runs_response["runs"]:
    runs_by_example_id[run["reference_example_id"]].append(run)

for example_id, runs in runs_by_example_id.items():
    ranked_runs = sorted(
        runs,
        key=lambda run: 0 if "refund" in str(run.get("outputs", {})).lower() else 1,
    )
    feedback_group_id = str(uuid4())

    for index, run in enumerate(ranked_runs):
        smith_request(
            "POST",
            "/api/v1/feedback",
            json={
                "run_id": str(run["id"]),
                "key": "ranked_preference",
                "score": 1 if index == 0 else 0,
                "feedback_group_id": feedback_group_id,
                "comparative_experiment_id": comparative_experiment_id,
            },
        )
```

실전에서는 위의 정렬 기준 자리에 사람 평가나 LLM judge 결과를 넣으면 된다.

## 추천 운영 패턴

개인적으로는 아래 흐름이 가장 안정적이다.

1. dataset은 UI나 별도 관리 스크립트에서 먼저 고정한다
2. 배치 워커는 example 조회, session 생성, run 업로드만 담당한다
3. 후처리 워커가 `runs/query` 기준으로 feedback을 붙인다
4. pairwise 비교는 baseline과 candidate가 모두 끝난 뒤 별도 단계에서 만든다

이렇게 나누면 모델 실행, trace 적재, evaluator 채점을 독립적으로 재실행하기 쉬워진다.

## 자주 막히는 점

### 1. `session_id`만 넣고 `reference_example_id`를 빼먹는다

experiment run의 핵심은 dataset example과의 연결이다.  
`reference_example_id`가 없으면 dataset 기반 평가 흐름이 깨진다.

### 2. run은 만들었는데 `PATCH`로 종료하지 않는다

run 생성만 하고 `outputs`, `end_time`을 안 채우면 결과가 비어 있는 trace가 남는다.  
child run과 root run 둘 다 닫는 편이 안전하다.

### 3. experiment(session)를 끝내지 않는다

`PATCH /api/v1/sessions/{id}`로 `end_time`을 안 넣으면 집계가 늦고, 완료된 실험처럼 안 보일 수 있다.

### 4. root run 대신 child run에만 최종 label을 남긴다

trace 디버깅에는 child run이 유용하지만, experiment 비교에서는 root run 출력이 훨씬 읽기 쉽다.  
최종 비교용 출력은 root run에도 한 번 더 남겨 두는 편이 좋다.

### 5. `runs/query`에서 필요한 필드를 `select`로 줄이지 않는다

feedback 후처리 작업은 보통 root run의 `id`, `reference_example_id`, `outputs`만 있으면 충분하다.  
매번 무거운 전체 payload를 읽으면 쿼리 비용과 응답 시간이 불필요하게 커진다.

### 6. SDK 없는 흐름인데 `uuid7()` 같은 SDK 헬퍼를 전제로 짠다

공식 문서 예제에는 `uuid7()`가 나오지만, REST-only 워커라면 일반 UUID 생성기로도 충분하다.  
중요한 것은 고유하고 충돌하지 않는 run ID다.

## 참고 자료

- [How to use the REST API](https://docs.langchain.com/langsmith/run-evals-api-only)
- [How to upload experiments run outside of LangSmith with the REST API](https://docs.langchain.com/langsmith/upload-existing-experiments)
- [How to run a pairwise evaluation](https://docs.langchain.com/langsmith/pairwise-evals)
