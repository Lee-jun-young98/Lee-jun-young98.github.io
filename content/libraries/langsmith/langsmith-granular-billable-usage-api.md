---
title: "LangSmith granular usage API로 팀별 trace와 deployment 사용량 분석하기"
description: "granular billable usage API로 workspace·project·user·API key별 trace 및 LangSmith Deployment 사용량을 조회하고 CSV 비용 보고서를 만드는 방법을 정리한 실전 노트"
date: 2026-08-20
tags:
  - langsmith
  - observability
  - cost
  - api
aliases:
  - "/blog/langsmith-granular-billable-usage-api"
---

# LangSmith granular usage API로 팀별 trace와 deployment 사용량 분석하기

LangSmith 사용량이 늘면 전체 trace 수만 보는 것으로는 비용 원인을 찾기 어렵다. 어느 workspace와 project가 많이 쓰는지, 특정 사용자나 API key에서 갑자기 사용량이 늘었는지까지 나눠 봐야 한다.

granular billable usage API는 하나의 엔드포인트에서 두 사용량 영역을 제공한다.

| `kind` | 측정 대상 | 주요 지표 |
| --- | --- | --- |
| `traces` | 수집된 trace | `traces` |
| `langsmith_deployments` | LangSmith Deployment | `nodes_executed`, `agent_runs`, `agent_uptime_seconds` |

같은 기간과 grouping을 사용할 수 있지만 두 영역의 데이터 원본은 별개다. 따라서 trace 수와 deployment agent run 수를 같은 단위로 합산하면 안 된다.

## 사전 준비

- LangSmith API key
- 조회할 workspace UUID
- 조직 수준 `organization:read` 권한
- 대상 workspace에 대한 read 권한
- Python 3.10 이상과 `pip install -U httpx`

LangSmith Cloud의 granular trace usage는 2026년 1월 5일부터 수집되므로 그 이전 trace는 이 API에 나타나지 않는다. self-hosted 환경은 기능을 활성화한 시점부터 수집되며 과거 데이터가 소급 생성되지 않는다.

환경 변수는 코드에 직접 쓰지 않는다.

```powershell
$env:LANGSMITH_API_KEY="lsv2_..."
$env:LANGSMITH_WORKSPACE_ID="00000000-0000-0000-0000-000000000000"
```

## 1. workspace별 trace 사용량 조회하기

엔드포인트는 `GET /api/v1/orgs/current/billing/granular-usage`다. `kind`를 생략하면 이전 호출과 호환되도록 `traces`가 기본값이다. 운영 코드에서는 의도를 명확히 하려고 직접 적는 편이 낫다.

```python
import os
from datetime import datetime, timedelta, timezone

import httpx

API_KEY = os.environ["LANGSMITH_API_KEY"]
WORKSPACE_ID = os.environ["LANGSMITH_WORKSPACE_ID"]

end_time = datetime.now(timezone.utc)
start_time = end_time - timedelta(days=30)

with httpx.Client(
    base_url="https://api.smith.langchain.com",
    headers={"x-api-key": API_KEY},
    timeout=30.0,
) as client:
    response = client.get(
        "/api/v1/orgs/current/billing/granular-usage",
        params={
            "kind": "traces",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "workspace_ids": WORKSPACE_ID,
            "group_by": "workspace",
        },
    )
    response.raise_for_status()
    report = response.json()

print("bucket stride:", report["stride"])
for row in report["usage"]:
    print(row["time_bucket"], row["dimensions"]["workspace_name"], row["traces"])
```

`workspace_ids`는 필수다. 여러 workspace를 조회할 때는 `httpx`에 list를 전달하면 같은 query parameter가 반복된다.

## 2. project와 API key별 원인 좁히기

`group_by`는 `workspace`, `project`, `user`, `api_key` 중 하나다. 먼저 project별 상위 사용처를 찾고, 이상이 있는 workspace를 API key별로 다시 조회하면 비용 원인을 단계적으로 좁힐 수 있다.

```python
def get_trace_usage(client: httpx.Client, *, group_by: str) -> list[dict]:
    response = client.get(
        "/api/v1/orgs/current/billing/granular-usage",
        params={
            "kind": "traces",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "workspace_ids": WORKSPACE_ID,
            "group_by": group_by,
        },
    )
    response.raise_for_status()
    return response.json()["usage"]


with httpx.Client(
    base_url="https://api.smith.langchain.com",
    headers={"x-api-key": API_KEY},
    timeout=30.0,
) as client:
    project_rows = get_trace_usage(client, group_by="project")
    api_key_rows = get_trace_usage(client, group_by="api_key")

top_projects = sorted(project_rows, key=lambda row: row["traces"], reverse=True)[:10]
for row in top_projects:
    print(row["dimensions"].get("project_name", "unknown"), row["traces"])
```

응답은 시간 bucket별 행이므로 위 정렬은 “가장 큰 하루”를 찾는다. 전체 기간 합계를 비교하려면 dimension별로 먼저 합쳐야 한다.

```python
from collections import defaultdict

totals = defaultdict(int)
for row in project_rows:
    project_id = row["dimensions"].get("project_id", "unknown")
    totals[project_id] += row["traces"]

for project_id, traces in sorted(totals.items(), key=lambda item: item[1], reverse=True):
    print(project_id, traces)
```

API key grouping은 전체 secret을 반환하지 않고 `api_key_short_key`를 제공한다. 내부 key inventory와 연결할 때도 전체 key를 로그나 보고서에 복사하지 않는다.

## 3. long-lived trace 비용만 따로 보기

trace 영역은 `trace_tier=longlived` 또는 `shortlived`로 retention tier를 제한할 수 있다.

```python
response = httpx.get(
    "https://api.smith.langchain.com/api/v1/orgs/current/billing/granular-usage",
    headers={"x-api-key": API_KEY},
    params={
        "kind": "traces",
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "workspace_ids": WORKSPACE_ID,
        "group_by": "project",
        "trace_tier": "longlived",
    },
    timeout=30.0,
)
response.raise_for_status()
```

online evaluator, annotation queue, automation rule 등이 trace를 Extended retention으로 올릴 수 있다. long-lived 사용량이 예상보다 크다면 project별 결과를 먼저 보고 해당 project의 evaluator와 automation 조건을 함께 점검한다.

self-hosted 0.16.0 이상에서는 long-lived trace usage를 더 이상 추적하지 않아 이 필터가 항상 0을 반환한다. 또한 `trace_tier`는 deployment 사용량에는 적용되지 않는다.

## 4. Deployment 사용량을 별도 조회하기

`kind=langsmith_deployments`로 바꾸면 같은 응답 구조 안에 세 지표가 함께 들어온다.

```python
response = httpx.get(
    "https://api.smith.langchain.com/api/v1/orgs/current/billing/granular-usage",
    headers={"x-api-key": API_KEY},
    params={
        "kind": "langsmith_deployments",
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "workspace_ids": WORKSPACE_ID,
        "group_by": "project",
    },
    timeout=30.0,
)
response.raise_for_status()

for row in response.json()["usage"]:
    print(
        row["time_bucket"],
        row["dimensions"].get("project_name", "unknown"),
        row["nodes_executed"],
        row["agent_runs"],
        row["agent_uptime_seconds"],
    )
```

여기서 `project`는 tracing project가 아니라 배포된 agent의 LangSmith Deployment project를 뜻한다. `agent_uptime_seconds`는 replica uptime의 원시 합계이며 청구 파이프라인의 중복 제거된 standby minute와 동일한 값이라고 가정하면 안 된다.

## 5. CSV 비용 보고서 저장하기

`/export`는 같은 query parameter를 받고 CSV를 돌려준다. JSON을 임의로 CSV로 바꾸는 것보다 공식 export를 쓰면 dimension column과 지표 이름을 안정적으로 받을 수 있다.

```python
from pathlib import Path

response = httpx.get(
    "https://api.smith.langchain.com/api/v1/orgs/current/billing/granular-usage/export",
    headers={"x-api-key": API_KEY},
    params={
        "kind": "traces",
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "workspace_ids": WORKSPACE_ID,
        "group_by": "project",
    },
    timeout=30.0,
)
response.raise_for_status()
Path("langsmith_trace_usage.csv").write_bytes(response.content)
```

공식 CSV export는 spreadsheet formula로 해석될 수 있는 문자로 시작하는 cell을 방어 처리한다. 보고서를 다시 가공할 때 이 보호 문자를 무심코 제거하지 않는다.

## 시간 범위에서 자주 생기는 함정

사용량은 최소 하루 단위다. API는 `start_time`을 UTC 자정으로 내리고, 자정이 아닌 `end_time`은 다음 UTC 자정으로 올린다. 예를 들어 1월 1일 정오부터 1월 2일 정오까지 요청해도 1월 1일과 2일 전체 bucket이 포함된다.

기간에 따라 `stride`도 달라진다.

| 요청 기간 | bucket |
| --- | --- |
| 31일 이하 | 1일 |
| 32~93일 | 7일 |
| 94~366일 | 30일 |
| 366일 초과 | 365일 |

따라서 일별 임계치 경보를 만들려면 31일 이하로 조회하고, 응답의 `stride`를 검사해야 한다. KST 기준 월간 보고서도 API의 UTC bucket 경계를 명시해 두지 않으면 다른 청구 자료와 하루 차이가 날 수 있다.

## 흔한 실수

- `organization:read` 없이 workspace key만 있으면 조회할 수 있다고 생각한다.
- `workspace_ids`를 빼거나 workspace 이름을 UUID 대신 전달한다.
- bucket별 행을 기간 합계로 오해한다.
- `kind`를 바꾸지 않고 trace 수와 deployment 지표를 한 데이터로 취급한다.
- deployment 요청에 trace retention filter를 적용한다.
- `agent_uptime_seconds`를 최종 청구 standby minute와 동일시한다.
- self-hosted 기능 활성화 전에 과거 사용량도 복원될 것이라고 기대한다.
- 24시간 범위가 정확히 24시간만 집계될 것이라고 가정한다.

## 운영 체크리스트

1. 비용 보고서의 UTC 범위와 응답 `stride`를 함께 저장한다.
2. workspace → project → user/API key 순서로 drill-down한다.
3. trace와 deployment 보고서를 별도 지표로 유지한다.
4. long-lived trace 급증은 evaluator·annotation·automation 설정과 함께 조사한다.
5. API key short key를 소유 팀과 연결하는 inventory를 관리한다.
6. 월별 CSV를 보관하고 전월 대비 증감률에 임계치를 둔다.

## 참고 자료

- [Granular billable usage](https://docs.langchain.com/langsmith/granular-usage)
- [Manage billing in your account](https://docs.langchain.com/langsmith/manage-billing)
- [Organization and workspace operations](https://docs.langchain.com/langsmith/administration-overview)
- [Trace retention and data lifecycle](https://docs.langchain.com/langsmith/administration-overview#data-retention)
