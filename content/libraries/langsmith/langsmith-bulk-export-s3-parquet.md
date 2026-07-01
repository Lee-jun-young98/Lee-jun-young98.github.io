---
title: "LangSmith bulk export로 trace를 S3/Parquet로 내보내기"
description: "LangSmith bulk export API로 tracing project나 experiment를 S3-compatible bucket에 Parquet로 적재하고, Python requests로 생성·모니터링·스케줄링하는 실전 노트"
date: 2026-07-01
tags:
  - langsmith
  - observability
  - data-export
  - python
aliases:
  - "/blog/langsmith-bulk-export-s3-parquet"
---

# LangSmith bulk export로 trace를 S3/Parquet로 내보내기

LangSmith UI와 SDK로 trace를 조회하는 것만으로 충분한 구간이 있다.  
하지만 운영 로그가 쌓이기 시작하면 결국 아래 요구가 나온다.

- 하루치 production trace를 Parquet로 내려 받아 BigQuery나 DuckDB에서 분석하고 싶다
- `inputs`, `outputs` 없이 비용, 지연, 에러 중심 컬럼만 가볍게 적재하고 싶다
- 실험 project를 매시간 S3나 MinIO로 자동 export하고 싶다
- trace query SDK가 아니라 배치 파이프라인으로 장기 보관하고 싶다

이럴 때 쓰는 기능이 LangSmith bulk export다.  
공식 문서 기준으로 bulk export는 tracing project 또는 experiment를 S3-compatible bucket에 Parquet로 적재하는 Smith API 기능이다.

이 글에서는 2026년 7월 1일 기준 공식 LangSmith 문서를 바탕으로 아래 흐름만 실무적으로 정리한다.

- export destination 만들기
- one-time export job 만들기
- `export_fields`와 `filter`로 파일 크기 줄이기
- scheduled export 운영하기
- Python `requests`로 상태 모니터링하기

## 언제 이 기능이 특히 유용한가

아래 상황이면 bulk export가 잘 맞는다.

- trace를 warehouse, notebook, BI 도구로 넘겨 장기 분석하고 싶다
- UI 조회보다 더 큰 기간을 반복적으로 내려 받아야 한다
- daily/hourly batch로 trace 적재 파이프라인을 만들고 싶다
- `feedback_stats`, token usage, error 분포를 LangSmith 밖에서 조인 분석하고 싶다

반대로 최근 며칠치 trace를 빠르게 찾는 수준이면 `list_runs(...)`나 UI 조회가 더 단순하다.

## 사전 준비

bulk export는 공식 문서 기준 LangSmith Plus 또는 Enterprise 플랜에서만 지원된다.

필요한 준비물은 아래와 같다.

- LangSmith API key
- workspace ID
- export 대상 project ID 또는 `all_experiments=true`
- 쓰기 권한이 있는 S3-compatible bucket
- bucket access key / secret key

Python 예제는 `requests`만 있으면 된다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U requests
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_WORKSPACE_ID="your_workspace_id"
```

기본 헬퍼:

```python
import os
import requests


LANGSMITH_API_KEY = os.environ["LANGSMITH_API_KEY"]
LANGSMITH_WORKSPACE_ID = os.environ["LANGSMITH_WORKSPACE_ID"]
LANGSMITH_BASE_URL = os.getenv("LANGSMITH_BASE_URL", "https://api.smith.langchain.com")


def smith_request(method: str, path: str, **kwargs):
    headers = kwargs.pop("headers", {})
    headers.update(
        {
            "Content-Type": "application/json",
            "X-API-Key": LANGSMITH_API_KEY,
            "X-Tenant-Id": LANGSMITH_WORKSPACE_ID,
        }
    )
    response = requests.request(
        method,
        f"{LANGSMITH_BASE_URL}{path}",
        headers=headers,
        timeout=60,
        **kwargs,
    )
    response.raise_for_status()
    return response.json()
```

공식 문서 기준 SaaS 리전이나 self-hosted를 쓰면 base URL이 달라질 수 있다.  
예를 들어 EU SaaS는 `https://eu.api.smith.langchain.com` 형태를 쓴다.

## 1. destination을 먼저 한 번 등록한다

bulk export는 destination을 먼저 만들고, 이후 export job에서 destination ID를 재사용하는 구조다.

AWS S3 기준 예시는 아래처럼 작성하면 된다.

```python
payload = {
    "destination_type": "s3",
    "display_name": "langsmith-prod-export",
    "config": {
        "bucket_name": "my-langsmith-export-bucket",
        "prefix": "langsmith/prod",
        "region": "ap-northeast-2",
    },
    "credentials": {
        "access_key_id": os.environ["AWS_ACCESS_KEY_ID"],
        "secret_access_key": os.environ["AWS_SECRET_ACCESS_KEY"],
    },
}

destination = smith_request(
    "POST",
    "/api/v1/bulk-exports/destinations",
    json=payload,
)

print("destination_id=", destination["id"])
```

MinIO나 GCS 같은 S3-compatible storage를 쓸 때는 `endpoint_url`을 같이 넘긴다.

```python
payload = {
    "destination_type": "s3",
    "display_name": "langsmith-minio-export",
    "config": {
        "bucket_name": "langsmith-exports",
        "prefix": "prod",
        "endpoint_url": "https://minio.example.com",
    },
    "credentials": {
        "access_key_id": os.environ["MINIO_ACCESS_KEY"],
        "secret_access_key": os.environ["MINIO_SECRET_KEY"],
    },
}
```

공식 문서 기준 destination 생성 시 LangSmith가 실제로 bucket 접근 가능 여부를 검증한다.  
그래서 권한이나 endpoint 설정이 틀리면 export job 생성 전에 여기서 먼저 실패한다.

## 2. one-time export는 project ID와 UTC 시간 구간으로 만든다

export job은 `session_id` 또는 `all_experiments=true` 중 하나를 받는다.  
일반 운영 trace export에서는 보통 특정 tracing project ID를 `session_id`로 주는 편이 가장 명확하다.

```python
from datetime import datetime, timezone, timedelta


destination_id = "your_destination_id"
project_id = "your_project_uuid"

end_time = datetime.now(timezone.utc)
start_time = end_time - timedelta(days=1)

payload = {
    "bulk_export_destination_id": destination_id,
    "session_id": project_id,
    "start_time": start_time.isoformat().replace("+00:00", "Z"),
    "end_time": end_time.isoformat().replace("+00:00", "Z"),
    "format_version": "v2_beta",
}

export_job = smith_request(
    "POST",
    "/api/v1/bulk-exports",
    json=payload,
)

print("export_id=", export_job["id"])
```

여기서 중요한 점은 공식 문서 기준 `start_time`은 inclusive, `end_time`은 exclusive라는 것이다.  
즉 연속된 배치 구간을 붙여도 겹치지 않게 설계할 수 있다.

## 3. 운영 export는 `filter`와 `export_fields`를 같이 쓰는 편이 낫다

무작정 모든 필드를 다 내보내면 파일이 커지고 timeout 위험도 커진다.  
특히 `inputs`, `outputs`가 큰 agent trace는 차이가 크다.

예를 들어 production 에러 run만 비용/지연 중심으로 export하고 싶다면:

```python
payload = {
    "bulk_export_destination_id": destination_id,
    "session_id": project_id,
    "start_time": "2026-06-30T00:00:00Z",
    "end_time": "2026-07-01T00:00:00Z",
    "filter": 'and(has(tags, "production"), neq(error, null))',
    "export_fields": [
        "id",
        "trace_id",
        "parent_run_id",
        "name",
        "run_type",
        "start_time",
        "end_time",
        "status",
        "error",
        "tags",
        "feedback_stats",
        "total_tokens",
        "total_cost",
        "first_token_time",
    ],
    "format_version": "v2_beta",
}

export_job = smith_request("POST", "/api/v1/bulk-exports", json=payload)
print(export_job["id"])
```

이 패턴이 실용적인 이유는 분명하다.

- `filter`로 대상 run 수를 줄인다
- `export_fields`로 row당 payload를 줄인다
- 쿼리용 SDK와 warehouse 적재용 export를 역할 분리할 수 있다

공식 문서 기준 `feedback_stats`에는 문자열 feedback breakdown만 포함되고, 숫자/불리언/복합 타입 feedback 값은 raw feedback export가 필요하다는 점도 기억해 둘 만하다.

## 4. experiment 전체를 내보내려면 `all_experiments=true`를 쓴다

오프라인 평가 결과를 workspace 단위로 모으고 싶다면 `all_experiments=true`를 쓸 수 있다.

```python
payload = {
    "bulk_export_destination_id": destination_id,
    "all_experiments": True,
    "start_time": "2026-06-01T00:00:00Z",
    "end_time": "2026-07-01T00:00:00Z",
    "format_version": "v2_beta",
}

export_job = smith_request("POST", "/api/v1/bulk-exports", json=payload)
print(export_job["id"])
```

다만 공식 문서 기준 Cloud에서는 `all_experiments` export 하나에 최대 250개 experiment 제한이 있다.  
그래서 평가 project가 많으면 다음처럼 쪼개는 편이 안전하다.

1. 먼저 `all_experiments`로 전체 범위를 확인한다.
2. 부족한 실험은 `session_id` 기반 export를 따로 만든다.

또한 `all_experiments`와 `session_id`는 동시에 줄 수 없다.

## 5. scheduled export는 `end_time` 없이 `interval_hours`로 만든다

매시간 또는 매일 export하려면 one-time job 대신 scheduled export가 맞다.

```python
payload = {
    "bulk_export_destination_id": destination_id,
    "session_id": project_id,
    "start_time": "2026-07-01T00:00:00Z",
    "interval_hours": 24,
    "export_fields": [
        "id",
        "trace_id",
        "name",
        "run_type",
        "start_time",
        "end_time",
        "status",
        "error",
        "total_tokens",
        "total_cost",
    ],
    "format_version": "v2_beta",
}

scheduled_export = smith_request("POST", "/api/v1/bulk-exports", json=payload)
print("schedule_id=", scheduled_export["id"])
```

공식 문서 기준 scheduled export는 아래 제약을 가진다.

- `interval_hours`는 1 이상 168 이하
- scheduled export에서는 `end_time`을 넣지 않는다
- spawned export는 각 구간 종료 후 약 10분 뒤 실행된다
- 스케줄을 중지하려면 source export를 cancel해야 한다

실무에서는 "전날 UTC 하루치"처럼 해석이 쉬운 구간으로 맞추는 편이 운영 실수를 줄인다.

## 6. 상태 모니터링은 export와 export run을 나눠서 본다

export는 내부적으로 여러 run으로 쪼개져 처리된다.  
그래서 전체 export 상태와 개별 export run 상태를 같이 보는 편이 좋다.

```python
import time


export_id = "your_export_id"

while True:
    export_job = smith_request("GET", f"/api/v1/bulk-exports/{export_id}")
    status = export_job["status"]
    print("status=", status)

    if status in {"COMPLETED", "FAILED", "CANCELLED", "TIMEDOUT"}:
        break

    time.sleep(30)
```

개별 run 목록도 바로 조회할 수 있다.

```python
export_runs = smith_request("GET", f"/api/v1/bulk-exports/{export_id}/runs")

for run in export_runs:
    print(
        run["id"],
        run["status"],
        run.get("rows_exported"),
        run.get("created_at"),
    )
```

공식 문서 기준 export 상태는 `CREATED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`, `TIMEDOUT` 중 하나다.

## 7. export 결과는 Hive-style partition 경로로 쌓인다

문서 기준 export 파일 경로 구조는 아래 형태다.

```text
<bucket>/<prefix>/export_id=<export_id>/tenant_id=<tenant_id>/session_id=<session_id>/runs/year=<year>/month=<month>/day=<day>
```

즉 downstream에서는 DuckDB, Spark, BigQuery external table 같은 도구로 partition pruning을 걸기 쉬운 편이다.  
trace를 notebook 분석으로만 볼지, warehouse 테이블로 적재할지에 따라 prefix를 미리 나눠 두면 이후 운영이 편하다.

## 자주 막히는 점

### 1. Python SDK 메서드를 먼저 찾는다

현재 공식 문서 흐름은 bulk export를 Smith API endpoint로 설명한다.  
그래서 Python에서는 `langsmith.Client()`보다 `requests`나 `langsmith api` CLI 래핑으로 접근하는 편이 현실적이다.

### 2. `inputs`, `outputs`를 기본 포함해 timeout과 파일 폭증을 만든다

큰 trace일수록 `export_fields`를 먼저 줄이는 편이 안전하다.  
비용, 지연, 에러 분석이 목적이면 payload 본문이 꼭 필요하지 않은 경우가 많다.

### 3. local timezone으로 구간을 자른다

공식 문서 기준 `start_time`, `end_time`은 UTC ISO 8601이다.  
배치 스케줄이 Asia/Seoul 기준이더라도 실제 export 구간은 UTC로 명시해 두는 편이 덜 헷갈린다.

### 4. `all_experiments`를 tracing project 전체 export로 오해한다

`all_experiments`는 dataset 기반 평가에서 생긴 experiment project 전체를 대상으로 한다.  
일반 production tracing project 전체를 내려받고 싶다면 보통 `session_id`를 써야 한다.

### 5. destination 권한 문제를 LangSmith 장애로 착각한다

destination 생성 단계에서 bucket write 권한, endpoint URL, credential rotation 상태를 먼저 확인하는 편이 빠르다.  
문서에서도 storage/destination 오류는 자동 재시도보다 설정 수정 후 재생성을 권장한다.

## 추천 운영 흐름

개인적으로는 아래 순서가 가장 무난하다.

1. 평소 운영 분석은 `list_runs(...)`로 가볍게 탐색한다.
2. 장기 보관이나 warehouse 분석이 필요할 때만 bulk export를 붙인다.
3. 첫 export는 `export_fields`를 최소화한 one-time job으로 검증한다.
4. 문제가 없으면 `interval_hours` 기반 scheduled export로 늘린다.
5. 실패 시에는 destination 권한, date range, 필드 수부터 먼저 줄인다.

LangSmith bulk export는 "trace를 바로 보는 기능"이라기보다, tracing 데이터를 외부 분석 파이프라인으로 넘기는 경계면에 가깝다.  
query SDK와 bulk export를 분리해서 쓰면 관측과 데이터 적재를 서로 덜 꼬이게 운영할 수 있다.

## 참고 자료

- [Bulk export trace data](https://docs.langchain.com/langsmith/data-export)
- [Manage bulk export destinations](https://docs.langchain.com/langsmith/data-export-destinations)
- [Monitor and troubleshoot bulk exports](https://docs.langchain.com/langsmith/data-export-monitor)
- [Export trace data to BigQuery](https://docs.langchain.com/langsmith/big-query-bulk-export)
- [Run (span) data format](https://docs.langchain.com/langsmith/run-data-format)
- [Trace query syntax](https://docs.langchain.com/langsmith/trace-query-syntax)
