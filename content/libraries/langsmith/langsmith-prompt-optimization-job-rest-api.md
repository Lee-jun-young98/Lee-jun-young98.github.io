---
title: "LangSmith Prompt Optimization Job을 REST API로 자동화하기"
description: "LangSmith Prompt Optimization Job을 REST API로 시작하고 상태와 로그를 폴링한 뒤 생성된 prompt를 평가·승격하는 흐름을 Python 예제로 정리한 실전 노트"
date: 2026-07-24
tags:
  - langsmith
  - prompts
  - promptops
  - evaluation
  - rest-api
aliases:
  - "/blog/langsmith-prompt-optimization-job-rest-api"
---

# LangSmith Prompt Optimization Job을 REST API로 자동화하기

프롬프트 개선을 사람의 감에만 맡기면 후보 생성과 평가가 반복 작업이 된다. LangSmith의 Prompt Optimization Job은 기존 prompt와 평가 dataset을 연결해 이 반복을 비동기 job으로 실행한다.

특히 다음 상황에서 실용적이다.

- 같은 회귀 dataset으로 prompt 후보를 반복 개선하고 싶다.
- 긴 최적화 작업을 CI나 내부 운영 도구에서 시작하고 추적하고 싶다.
- 최적화 결과를 바로 운영에 반영하지 않고 검증 후 승격하고 싶다.

현재 공식 REST API의 흐름은 세 단계다.

1. `POST /api/v1/repos/optimize-job`으로 job을 시작한다.
2. prompt의 `owner`, `repo`, 반환된 `job_id`로 상태와 로그를 조회한다.
3. 성공 후 생성된 prompt 후보를 기존 evaluation 절차로 다시 검증한다.

## 사전 준비

다음 리소스가 있어야 한다.

- LangSmith workspace와 API key
- 개선할 prompt
- 입력과 reference output이 있는 dataset
- Promptim에서 사용할 evaluator UUID
- prompt에서 수정할 message의 0-based index

예제는 별도 SDK 메서드에 의존하지 않고 `requests`로 REST API를 호출한다.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U requests
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_ENDPOINT="https://api.smith.langchain.com"
```

세분화된 역할을 쓰는 workspace라면 job 생성에는 prompt 생성 권한이, 조회에는 prompt 읽기 권한이 필요하다. Viewer는 최적화 job을 조회할 수 있지만 생성할 수 없다.

## 1. Promptim job 시작하기

공식 OpenAPI 스키마에서 `algorithm`은 `promptim` 또는 `demo`다. 평가 dataset으로 prompt를 반복 개선하려면 `promptim`을 사용한다.

```python
import os
import requests

BASE_URL = os.getenv(
    "LANGSMITH_ENDPOINT",
    "https://api.smith.langchain.com",
).rstrip("/")

headers = {
    "X-API-Key": os.environ["LANGSMITH_API_KEY"],
    "Content-Type": "application/json",
}

payload = {
    "algorithm": "promptim",
    "prompt_name": "support-answerer",
    "config": {
        "message_index": 0,
        "task_description": (
            "고객 문의에 한국어로 정확하고 간결하게 답하고, "
            "reference answer의 핵심 정책을 빠뜨리지 않는다."
        ),
        "dataset_name": "support-answer-regression",
        "train_split": "train",
        "dev_split": "dev",
        "test_split": "test",
        "evaluators": [
            "11111111-2222-3333-4444-555555555555",
        ],
        "num_epochs": 3,
        "auto_commit": False,
    },
}

response = requests.post(
    f"{BASE_URL}/api/v1/repos/optimize-job",
    headers=headers,
    json=payload,
    timeout=30,
)
response.raise_for_status()

job_id = response.json()["optimization_job_id"]
print(f"job_id={job_id}")
```

`message_index`는 message 배열에서 최적화할 위치다. system message가 첫 번째라면 보통 `0`이지만 실제 prompt 구조를 확인하지 않고 고정하면 엉뚱한 message를 수정할 수 있다.

split을 쓰지 않는 dataset이라면 `train_split`, `dev_split`, `test_split`에 `None`을 넣는다. 현재 스키마에서는 이 필드 자체가 필수이므로 통째로 생략하지 않는다.

## 2. 상태를 폴링하되 무한 대기하지 않기

생성 API는 결과가 아니라 `optimization_job_id`를 즉시 반환한다. 상태는 `created`, `running`, `successful`, `failed` 중 하나다. 조회 URL에는 prompt owner handle도 필요하다.

```python
import time
from urllib.parse import quote


def wait_for_job(
    *,
    owner: str,
    repo: str,
    job_id: str,
    timeout_seconds: int = 1800,
    interval_seconds: int = 10,
) -> dict:
    owner_path = quote(owner, safe="")
    repo_path = quote(repo, safe="")
    url = (
        f"{BASE_URL}/api/v1/repos/{owner_path}/{repo_path}"
        f"/optimization-jobs/{job_id}"
    )
    deadline = time.monotonic() + timeout_seconds

    while time.monotonic() < deadline:
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        job = response.json()
        status = job["status"]
        print(f"status={status} updated_at={job['updated_at']}")

        if status == "successful":
            return job
        if status == "failed":
            raise RuntimeError(f"optimization failed: {job}")

        time.sleep(interval_seconds)

    raise TimeoutError(
        f"job {job_id} did not finish within {timeout_seconds}s"
    )


job = wait_for_job(
    owner="your-workspace-handle",
    repo="support-answerer",
    job_id=job_id,
)
```

CI에서는 polling 간격, 전체 timeout, HTTP timeout을 각각 둔다. HTTP timeout만 있으면 job 자체가 끝나지 않을 때 runner를 계속 점유할 수 있다.

## 3. 실패 원인은 job logs에서 찾기

job 응답만으로 원인이 충분하지 않으면 logs endpoint를 조회한다.

```python
def list_job_logs(*, owner: str, repo: str, job_id: str) -> list[dict]:
    owner_path = quote(owner, safe="")
    repo_path = quote(repo, safe="")
    url = (
        f"{BASE_URL}/api/v1/repos/{owner_path}/{repo_path}"
        f"/optimization-jobs/{job_id}/logs"
    )
    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json()


for log in list_job_logs(
    owner="your-workspace-handle",
    repo="support-answerer",
    job_id=job_id,
):
    print(log["log_type"], log["message"], log.get("data"))
```

현재 스키마의 `log_type`은 `info`, `result`, `error`, `link` 중 하나다. 자동화에서는 모든 message를 합치기보다 `error`를 실패 요약에, `link`를 결과 링크에 따로 매핑하는 편이 낫다.

## 4. `auto_commit`은 보수적으로 선택하기

`auto_commit=True`는 최적화 결과를 prompt commit으로 자동 저장한다. 빠른 실험에는 편하지만 운영 prompt와 가까운 리소스에서는 다음 순서가 안전하다.

1. `auto_commit=False`로 후보를 만든다.
2. 결과와 logs를 검토한다.
3. 같은 test split으로 기존 prompt와 후보를 평가한다.
4. 품질, latency, 비용 기준을 통과한 결과만 commit한다.
5. 검증된 commit을 `staging`, 이후 `production`으로 승격한다.

최적화 성공은 “운영 품질이 개선됐다”가 아니라 “job이 정상 완료됐다”는 뜻이다. test split을 별도로 남기는 이유다.

## 자주 만나는 함정

### 1. 학습과 검증에 같은 example을 쓴다

train 결과만 좋아지고 실제 문의에서 성능이 떨어질 수 있다. dev/test split을 분리하고 최종 판단은 optimization에 직접 사용하지 않은 test split으로 한다.

### 2. evaluator UUID 대신 이름을 넣는다

`evaluators`는 evaluator UUID 목록이다. UI 표시 이름을 넣으면 validation 또는 실행 단계에서 실패할 수 있다.

### 3. `prompt_name`과 조회 URL의 `repo`를 다르게 쓴다

이전 명칭 때문에 prompt를 `repo`라고 부르는 endpoint가 남아 있다. 생성 때 쓴 prompt와 조회 URL의 `{repo}`가 같은 리소스를 가리켜야 한다.

### 4. 422 응답을 그대로 재시도한다

422는 대개 누락 필드, 잘못된 enum, UUID 형식, config 불일치 문제다. 같은 payload를 재시도하기보다 response body와 현재 OpenAPI 스키마를 확인한다.

### 5. 성공 직후 운영 환경을 옮긴다

최적화 목표가 evaluator의 편향을 학습했거나 latency와 비용이 악화됐을 수 있다. 기존 prompt와의 offline experiment 비교를 배포 gate로 둔다.

## 실무 체크리스트

- prompt 구조와 `message_index`를 확인했다.
- train/dev/test split이 실제 dataset에 존재한다.
- evaluator UUID와 평가 기준이 안정적이다.
- polling에 간격과 전체 timeout이 있다.
- 실패 시 logs를 수집한다.
- optimization 성공과 품질 검증을 분리한다.
- 검증 전에는 production 환경을 변경하지 않는다.

Prompt Optimization Job의 핵심은 “좋은 prompt를 자동으로 얻는다”보다 “후보 생성 과정을 재현 가능한 비동기 job으로 만든다”에 있다. 결과를 기존 evaluation과 환경 승격 흐름에 연결해야 실제 PromptOps가 된다.

## 참고 자료

- [Optimize prompt job REST API](https://docs.langchain.com/langsmith/smith-api/repos/optimize-prompt-job)
- [Get an optimization job](https://docs.langchain.com/langsmith/smith-api/optimization-jobs/get-job)
- [List optimization job logs](https://docs.langchain.com/langsmith/smith-api/optimization-jobs/list-job-logs)
- [Organization and workspace operations reference](https://docs.langchain.com/langsmith/organization-workspace-operations)
- [Manage prompt versions and environments](https://docs.langchain.com/langsmith/manage-prompts)
