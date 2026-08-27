---
title: "LangSmith Audit Logs API를 OCSF 형식으로 수집해 SIEM에 연결하기"
description: "LangSmith 조직 변경 이력을 cursor 기반으로 수집하고 OCSF 이벤트를 정규화해 보안 모니터링과 SIEM 전달에 사용하는 방법"
date: 2026-08-27
tags:
  - langsmith
  - security
  - audit
  - api
aliases:
  - "/blog/langsmith-audit-logs-ocsf-siem"
---

# LangSmith Audit Logs API를 OCSF 형식으로 수집해 SIEM에 연결하기

운영 장애나 권한 사고가 생겼을 때 trace만으로는 “누가 API key를 삭제했는가”, “언제 workspace 권한이 바뀌었는가”를 답하기 어렵다. LangSmith Audit Logs는 조직의 관리·설정 작업을 변경 불가능한 감사 이벤트로 남기고, API에서는 이를 **OCSF 1.7.0 API Activity(Class UID 6003)** 형식으로 반환한다.

실무에서는 UI 조회에 그치지 않고 짧은 시간창을 주기적으로 수집해 SIEM이나 데이터 레이크로 보내는 편이 유용하다. 이 글은 API key 삭제와 역할 변경처럼 위험도가 높은 작업을 놓치지 않는 최소 수집기를 만든다.

## 사전 준비

- LangSmith **Enterprise** 플랜
- Organization Admin 또는 Organization Operator 역할(`organization:manage` 권한)
- 조직 UUID와 LangSmith API key
- Python 3.10 이상, `pip install -U httpx`
- self-hosted라면 Helm chart 0.12.33 이상과 audit log 기능 활성화

Cloud API 기본 URL은 `https://api.smith.langchain.com`이다. EU 또는 self-hosted 환경에서는 자신의 endpoint로 바꾼다.

```powershell
$env:LANGSMITH_API_KEY="lsv2_..."
$env:LANGSMITH_ORG_ID="00000000-0000-0000-0000-000000000000"
```

API key는 조직 범위의 감사 로그를 읽으므로 애플리케이션 tracing key와 분리하고 secret manager에서 주입하는 것이 좋다.

## 1. 작은 시간창으로 조회하기

`GET /api/v1/audit-logs`에는 `start_time`과 `end_time`이 모두 필수다. 두 경계는 inclusive이며, 한 페이지는 최대 100건이다. 같은 시간창을 재시도할 수 있도록 수집 시각을 UTC ISO 8601로 고정한다.

```python
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import httpx

BASE_URL = os.getenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")
API_KEY = os.environ["LANGSMITH_API_KEY"]
ORG_ID = os.environ["LANGSMITH_ORG_ID"]

end = datetime.now(timezone.utc).replace(microsecond=0)
start = end - timedelta(hours=1, minutes=5)  # 지연 이벤트를 위한 5분 overlap

response = httpx.get(
    f"{BASE_URL.rstrip('/')}/api/v1/audit-logs",
    headers={
        "X-API-Key": API_KEY,
        "X-Organization-Id": ORG_ID,
        "Accept": "application/json",
    },
    params={
        "start_time": start.isoformat().replace("+00:00", "Z"),
        "end_time": end.isoformat().replace("+00:00", "Z"),
        "limit": 100,
    },
    timeout=30.0,
)
response.raise_for_status()
page = response.json()
print(len(page["items"]), page.get("cursor"))
```

`X-Organization-Id`를 workspace ID와 혼동하면 안 된다. 특정 workspace만 보고 싶다면 헤더는 조직 ID로 유지하고 query parameter에 `workspace_id`를 추가한다.

## 2. cursor가 끝날 때까지 순회하기

응답의 `cursor`는 서버가 만든 불투명한 값이다. decode하거나 다음 cursor를 직접 계산하지 말고 그대로 다음 요청에 전달한다.

```python
from collections.abc import Iterator


def iter_audit_events(
    client: httpx.Client,
    start_time: str,
    end_time: str,
    operations: list[str] | None = None,
) -> Iterator[dict]:
    cursor: str | None = None

    while True:
        params: list[tuple[str, str | int]] = [
            ("start_time", start_time),
            ("end_time", end_time),
            ("limit", 100),
        ]
        if cursor:
            params.append(("cursor", cursor))
        for operation in operations or []:
            params.append(("operations", operation))

        response = client.get("/api/v1/audit-logs", params=params)
        response.raise_for_status()
        body = response.json()

        yield from body["items"]
        cursor = body.get("cursor")
        if not cursor:
            break


with httpx.Client(
    base_url=BASE_URL.rstrip("/"),
    headers={
        "X-API-Key": API_KEY,
        "X-Organization-Id": ORG_ID,
    },
    timeout=30.0,
) as client:
    events = list(
        iter_audit_events(
            client,
            start.isoformat().replace("+00:00", "Z"),
            end.isoformat().replace("+00:00", "Z"),
            operations=[
                "delete_api_key",
                "update_role",
                "delete_workspace",
                "update_ttl_settings",
            ],
        )
    )
```

`operations`는 반복 query parameter다. 쉼표로 합친 한 문자열을 보내지 않는다. 지원 작업 이름은 제품과 self-hosted 버전에 따라 늘어날 수 있으므로 공식 tracked operations 목록을 기준으로 관리한다.

## 3. OCSF 이벤트를 탐지용 레코드로 정규화하기

SIEM 규칙에는 전체 원본보다 안정적인 핵심 필드가 편하다. 다만 조사 시 조직·workspace 정보가 필요하므로 `unmapped.original_audit_log`도 원본 저장소에 보존한다.

```python
from datetime import datetime, timezone


def normalize(event: dict) -> dict:
    actor = event.get("actor", {}).get("user", {})
    original = event.get("unmapped", {}).get("original_audit_log", {})

    # OCSF time은 Unix epoch milliseconds다.
    occurred_at = datetime.fromtimestamp(
        event["time"] / 1000,
        tz=timezone.utc,
    ).isoformat()

    return {
        "event_id": event["metadata"]["uid"],
        "occurred_at": occurred_at,
        "operation": event.get("api", {}).get("operation"),
        "status": event.get("status", "Unknown"),
        "actor_user_id": actor.get("uid"),
        "credential_id": actor.get("credential_uid"),
        "workspace_id": original.get("workspace_id"),
        "resource_ids": [item["uid"] for item in event.get("resources", [])],
        "source_ip": event.get("src_endpoint", {}).get("ip"),
        "http_status": event.get("http_response", {}).get("code"),
        "raw": event,
    }
```

세션으로 수행한 UI 작업은 `credential_uid`가 `null`일 수 있다. 이를 누락 이벤트로 처리하지 말고 `actor_user_id`와 함께 해석한다. `status`도 `Success`, `Failure`, `Unknown` 세 값을 모두 허용해야 한다.

## 4. overlap 수집을 멱등하게 만들기

매시간 직전 65분을 다시 읽으면 네트워크 지연과 스케줄러 정지를 견디기 쉽지만, 5분 동안의 이벤트가 중복된다. `metadata.uid`를 저장소의 unique key로 사용해 upsert한다.

```python
HIGH_RISK = {
    "delete_api_key",
    "delete_service_key",
    "update_role",
    "delete_workspace",
    "update_login_methods",
    "update_ttl_settings",
}


def should_alert(row: dict) -> bool:
    return (
        row["operation"] in HIGH_RISK
        or row["status"] == "Failure"
    )


rows_by_id = {
    row["event_id"]: row
    for row in map(normalize, events)
}

for row in rows_by_id.values():
    # 실제 운영에서는 event_id를 unique key로 DB/SIEM에 upsert한다.
    if should_alert(row):
        print(row["occurred_at"], row["operation"], row["actor_user_id"])
```

checkpoint에는 “마지막 이벤트 시각”보다 **성공적으로 적재한 시간창의 끝**을 저장하는 편이 안전하다. 중간 페이지에서 실패하면 checkpoint를 전진시키지 않고 전체 창을 다시 읽는다. API는 감사 로그를 최대 400일 보존하므로 외부 시스템의 장기 보존 요구가 더 길다면 미리 내보내야 한다.

## 자주 겪는 함정

- **workspace 역할만으로 호출한다**: audit log 조회에는 조직 수준 `organization:manage` 권한이 필요하다.
- **첫 100건만 저장한다**: `cursor`가 사라질 때까지 순회하지 않으면 조용히 이벤트가 누락된다.
- **경계 시각을 그대로 이어 붙인다**: 양쪽 시간 경계가 inclusive라 중복 가능하다. 이벤트 ID 기반 멱등 적재가 필요하다.
- **모든 읽기 작업이 기록된다고 가정한다**: 현재 audit log는 주로 write 작업 중심이다. 데이터 접근 감사 요구를 이것 하나로 충족한다고 판단하면 안 된다.
- **작업 이름을 영구 상수로 본다**: Cloud와 self-hosted 버전별 지원 범위가 달라질 수 있다. alert 목록은 정기적으로 공식 목록과 비교한다.
- **원본 OCSF 이벤트를 버린다**: 평탄화한 레코드에 없는 조직·workspace·HTTP 맥락이 사후 조사에 필요할 수 있다.

## 운영 체크리스트

1. 최소 권한의 조직용 credential을 별도로 발급한다.
2. UTC 기준 5분 overlap을 둔 짧은 시간창으로 예약 실행한다.
3. cursor 전체를 읽은 뒤에만 checkpoint를 갱신한다.
4. `metadata.uid`로 중복 제거하고 원본 OCSF JSON을 함께 보관한다.
5. credential·role·SSO·workspace·retention 변경과 실패 이벤트에 우선 alert를 건다.
6. 수집 실패는 dead-letter queue나 별도 모니터링으로 다시 처리한다.

## 참고 자료

- [LangSmith Audit logs](https://docs.langchain.com/langsmith/audit-logs)
- [Get audit logs REST API](https://docs.langchain.com/langsmith/smith-api/audit-logs/get-audit-logs)
- [OCSF 1.7.0 API Activity](https://schema.ocsf.io/1.7.0/classes/api_activity)

