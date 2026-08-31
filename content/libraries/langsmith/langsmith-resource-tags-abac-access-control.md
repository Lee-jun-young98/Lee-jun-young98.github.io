---
title: "LangSmith resource tags와 ABAC로 리소스 접근 범위 제한하기"
description: "LangSmith 프로젝트와 데이터셋에 resource tag를 원자적으로 적용하고 RBAC와 ABAC 정책을 조합해 환경·팀·PII 기준 접근을 제한하는 방법"
date: 2026-08-31
tags:
  - langsmith
  - security
  - abac
  - access-control
aliases:
  - "/blog/langsmith-resource-tags-abac-access-control"
---

# LangSmith resource tags와 ABAC로 리소스 접근 범위 제한하기

하나의 workspace에서 여러 팀이 운영 프로젝트, 평가 데이터셋, prompt를 함께 쓰면 역할만으로는 경계가 너무 넓을 수 있다. 예를 들어 Viewer에게 프로젝트 읽기 권한을 주되 `Environment=Production` 프로젝트는 숨기거나, annotator가 `Annotation-Team=Team-A` 데이터셋만 읽게 해야 한다.

LangSmith에서는 **RBAC**가 역할별 기본 권한을 정하고, **ABAC**가 resource tag 조건으로 개별 리소스의 허용·거부 범위를 좁히거나 넓힌다. 이 글은 태그를 API로 만들고 프로젝트 생성과 동시에 적용한 뒤, 정책을 안전하게 설계하는 흐름을 정리한다.

## 사전 준비

- Resource tags: Plus 또는 Enterprise 플랜
- ABAC와 custom workspace role: Enterprise 플랜
- tag key 생성·일반 tag 적용: `workspaces:manage` 권한
- ABAC policy 관리: Organization Admin의 PAT 또는 Organization Admin 권한을 가진 organization-scoped service key
- Python 3.10 이상, `pip install -U requests`

Cloud 기본 endpoint는 `https://api.smith.langchain.com`이다. EU, APAC, AWS 또는 self-hosted에서는 자신의 endpoint를 사용한다.

```powershell
$env:LANGSMITH_API_KEY="lsv2_..."
$env:LANGSMITH_ENDPOINT="https://api.smith.langchain.com"
```

ABAC는 현재 policy의 `attribute_name`으로 `resource_tag_key`만 지원한다. 사용자 부서나 IP 같은 임의 속성을 직접 조건에 넣는 방식은 아니다.

## 1. resource tag와 trace tag를 구분하기

LangSmith에는 이름이 비슷한 tag가 여러 종류 있다.

- **resource tag**: 프로젝트, 데이터셋, prompt 같은 workspace 리소스를 분류하고 ABAC 판단에 사용한다.
- **trace tag**: 개별 run을 검색·분석하기 위한 tracing 데이터다.
- **prompt commit tag**: `production`, `staging`처럼 특정 prompt commit을 가리킨다.

ABAC에서 run 권한은 개별 run tag가 아니라 **부모 tracing project의 resource tag**로 평가된다. 따라서 운영 trace를 보호하려면 run마다 tag를 붙이는 것이 아니라 프로젝트를 `Environment=Production`으로 분류해야 한다.

## 2. 기존 tag를 조회하고 없을 때만 만들기

기본 `Application`, `Environment` key가 이미 있을 수 있다. 매번 POST하지 말고 먼저 전체 tag를 읽어 동일한 key/value를 재사용한다.

```python
from __future__ import annotations

import os
import requests

BASE_URL = os.getenv(
    "LANGSMITH_ENDPOINT",
    "https://api.smith.langchain.com",
).rstrip("/")

session = requests.Session()
session.headers.update({
    "x-api-key": os.environ["LANGSMITH_API_KEY"],
    "content-type": "application/json",
})


def list_tags() -> list[dict]:
    response = session.get(
        f"{BASE_URL}/api/v1/workspaces/current/tags",
        timeout=30,
    )
    response.raise_for_status()
    return response.json()


def find_value_id(key: str, value: str) -> str | None:
    for tag in list_tags():
        if tag["key"] == key:
            for item in tag["values"]:
                if item["value"] == value:
                    return item["id"]
    return None


production_tag_id = find_value_id("Environment", "Production")
print(production_tag_id)
```

값이 없다면 key ID를 찾은 후 value를 만든다. 새 key 생성에는 `workspaces:manage`가 필요하다.

```python
def ensure_tag_value(key: str, value: str) -> str:
    existing = find_value_id(key, value)
    if existing:
        return existing

    tags = list_tags()
    tag_key = next((tag for tag in tags if tag["key"] == key), None)

    if tag_key is None:
        response = session.post(
            f"{BASE_URL}/api/v1/workspaces/current/tag-keys",
            json={"key": key, "description": f"{key} access boundary"},
            timeout=30,
        )
        response.raise_for_status()
        tag_key_id = response.json()["id"]
    else:
        tag_key_id = tag_key["id"]

    response = session.post(
        f"{BASE_URL}/api/v1/workspaces/current/tag-keys/"
        f"{tag_key_id}/tag-values",
        json={"value": value},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["id"]


production_tag_id = ensure_tag_value("Environment", "Production")
```

조직에서 tag 이름의 대소문자 규칙을 고정하는 것이 좋다. ABAC의 `equals`는 대소문자를 구분하므로 `Production`과 `production`은 다른 값이다.

## 3. 프로젝트 생성과 tag 적용을 한 요청으로 묶기

ABAC가 켜진 상태에서 프로젝트를 먼저 만들고 나중에 tag를 붙이면, 두 요청 사이에 프로젝트가 태그 없이 존재한다. 정책이 RBAC fallback을 허용하면 그 짧은 동안 예상보다 넓게 보일 수 있다.

`POST /api/v1/sessions`의 `tag_value_ids`를 사용하면 프로젝트와 tag가 같은 데이터베이스 transaction에서 생성된다.

```python
application_tag_id = ensure_tag_value("Application", "support-agent")

response = session.post(
    f"{BASE_URL}/api/v1/sessions",
    json={
        "name": "support-agent-prod",
        "tag_value_ids": [production_tag_id, application_tag_id],
    },
    timeout=30,
)
response.raise_for_status()
project = response.json()
print(project["id"], project["name"])
```

같은 원자적 패턴은 project뿐 아니라 dataset 생성·clone, prompt 생성·fork에도 지원된다. tag value는 미리 존재해야 하며 한 요청에 최대 100개까지 전달할 수 있다.

SDK tracing이 trace 수신 중 프로젝트를 자동 생성하는 경로에는 `tag_value_ids`를 넣을 수 없다. ABAC 보호가 처음부터 필요하다면 tracing을 시작하기 전에 REST API로 프로젝트를 미리 만든다.

## 4. allow와 deny 정책을 함께 설계하기

아래 정책은 `Annotator` 역할이 Team-A 데이터셋만 읽게 하는 allow 예시다.

```python
team_a_allow = {
    "name": "Team A annotation datasets",
    "description": "Allow Team A annotators to read assigned datasets",
    "effect": "allow",
    "condition_groups": [{
        "permission": "datasets:read",
        "resource_type": "dataset",
        "conditions": [{
            "attribute_name": "resource_tag_key",
            "attribute_key": "Annotation-Team",
            "operator": "equals",
            "attribute_value": "Team-A",
        }],
    }],
    "role_ids": ["<annotator-role-uuid>"],
}
```

다음 deny 정책은 같은 역할이 `Contains-PII=true` 데이터셋을 읽지 못하게 한다.

```python
pii_deny = {
    "name": "Block PII datasets",
    "effect": "deny",
    "condition_groups": [{
        "permission": "datasets:read",
        "resource_type": "dataset",
        "conditions": [{
            "attribute_name": "resource_tag_key",
            "attribute_key": "Contains-PII",
            "operator": "equals_ignore_case",
            "attribute_value": "true",
        }],
    }],
    "role_ids": ["<annotator-role-uuid>"],
}
```

정책 JSON은 LangSmith Access Policy API에 등록한다. 생성 전에는 최소 권한의 테스트 role과 비운영 리소스로 검증한다. 중요한 평가 순서는 다음과 같다.

1. 한 condition group 안의 여러 condition은 **AND**다.
2. 여러 condition group은 **OR**다.
3. deny가 하나라도 일치하면 allow와 RBAC보다 우선한다.
4. 일치하는 ABAC policy가 없으면 기존 RBAC 결과로 돌아간다.

따라서 “allow policy를 추가했으니 다른 모든 리소스는 자동으로 차단된다”고 가정하면 안 된다. 그 역할의 RBAC에 이미 `datasets:read`가 있으면 ABAC가 일치하지 않는 데이터셋도 RBAC fallback으로 읽을 수 있다. 좁은 allow-list를 만들려면 역할의 기본 권한과 deny 정책을 함께 검토해야 한다.

## 5. 누락 tag를 `_if_exists`로 다룰 때의 위험

`equals_if_exists` 같은 연산자는 tag key가 없을 때도 일치한다.

- allow 정책의 `_if_exists`: 조건과 일치하거나 해당 key가 없는 리소스를 허용한다.
- deny 정책의 `_if_exists`: 조건과 일치하거나 해당 key가 없는 리소스를 차단한다.

새 리소스의 tag 누락을 fail-closed로 막고 싶다면 deny 정책에서 신중히 활용할 수 있다. 반대로 allow 정책에서 무심코 쓰면 태그되지 않은 리소스까지 열릴 수 있다.

glob이 필요하면 `matches`에서 `*`, `?`를 쓸 수 있다. 정규표현식이 아니라 glob이라는 점도 주의한다.

```python
chatbot_family = {
    "attribute_name": "resource_tag_key",
    "attribute_key": "Application",
    "operator": "matches",
    "attribute_value": "chatbot-*",
}
```

## 자주 겪는 함정

- **trace tag로 ABAC를 제어한다**: run 접근은 부모 project의 resource tag를 따른다.
- **allow policy만 만들면 allow-list라고 생각한다**: 불일치 시 RBAC fallback이 적용될 수 있다.
- **여러 condition group을 AND로 이해한다**: group 사이는 OR이고, group 내부 condition만 AND다.
- **deny보다 allow가 우선한다고 생각한다**: deny는 항상 우선한다.
- **프로젝트 자동 생성을 그대로 둔다**: auto-create 경로는 생성 시 `tag_value_ids`를 받지 못한다.
- **`_if_exists`를 단순 null-safe 연산자로 본다**: key가 없을 때도 policy가 일치하므로 접근 범위가 크게 달라진다.
- **tag value를 삭제해도 영향이 없다고 생각한다**: value 삭제는 해당 value의 모든 resource association도 제거한다.
- **Application tag와 prompt commit tag를 섞는다**: 전자는 리소스 분류·접근, 후자는 prompt 버전 포인터다.

## 운영 체크리스트

1. workspace를 1차 trust boundary로 두고 ABAC는 workspace 내부 세분화에 사용한다.
2. `Application`, `Environment`, `Contains-PII`, `Annotation-Team` 같은 key의 소유자와 값 규칙을 정한다.
3. 보호 대상 project·dataset·prompt는 생성 요청에 `tag_value_ids`를 포함한다.
4. 정책 배포 전 RBAC fallback, deny 우선순위, tag 누락 사례를 테스트 role로 검증한다.
5. policy 변경과 tag 삭제를 audit log 및 변경 승인 흐름에 연결한다.
6. 서비스에는 개인 PAT보다 만료일과 workspace role이 명확한 service key를 사용한다.

## 참고 자료

- [LangSmith Attribute-based access control](https://docs.langchain.com/langsmith/abac)
- [Set up resource tags](https://docs.langchain.com/langsmith/set-up-resource-tags)
- [Role-based access control](https://docs.langchain.com/langsmith/rbac)
- [Workload isolation](https://docs.langchain.com/langsmith/workload-isolation)
- [Create an account and API key](https://docs.langchain.com/langsmith/create-account-api-key)
