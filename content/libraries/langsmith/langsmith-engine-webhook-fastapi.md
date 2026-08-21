---
title: "LangSmith Engine webhook을 FastAPI로 안전하게 받기"
description: "LangSmith Engine issue 이벤트의 HMAC 서명 검증, event id 멱등 처리, request_id 묶음 처리, 빠른 2xx 응답을 FastAPI 예제로 정리한 실전 노트"
date: 2026-08-22
tags:
  - langsmith
  - observability
  - webhook
  - python
aliases:
  - "/blog/langsmith-engine-webhook-fastapi"
---

# LangSmith Engine webhook을 FastAPI로 안전하게 받기

LangSmith Engine은 운영 trace에서 반복되는 agent 문제를 찾아 issue로 묶는다. 하지만 issue를 매번 UI에서 확인하면 대응이 늦어진다. Engine webhook을 incident bot, 사내 알림, ticket queue에 연결하면 새 문제와 재발 trace를 자동으로 전달할 수 있다.

수신 서버에서 중요한 것은 JSON 필드보다 전달 계약이다.

- 원본 body로 `X-LangSmith-Signature`를 검증한다.
- retry에도 유지되는 event `id`로 중복 실행을 막는다.
- 저장까지 끝낸 뒤 빠르게 `2xx`를 반환하고 느린 작업은 queue로 넘긴다.
- 모르는 event type과 새 필드를 허용한다.

LangSmith Engine은 현재 활발히 개발되는 기능이다. 아래 payload와 전달 규칙은 2026년 8월 22일 공식 문서를 기준으로 한다.

## 사전 준비

- trace가 수집되는 LangSmith project
- 해당 project에서 활성화한 LangSmith Engine
- Engine Settings에서 만든 webhook destination과 signing secret
- 외부에서 접근 가능한 HTTPS endpoint
- Python 3.10 이상

```bash
pip install -U fastapi "uvicorn[standard]" pydantic
```

```powershell
$env:LANGSMITH_ENGINE_WEBHOOK_SECRET="replace-with-signing-secret"
uvicorn app:app --host 0.0.0.0 --port 8000
```

subscription마다 최소 priority와 event type을 선택할 수 있다. event type을 명시하지 않으면 `issue.created`만 받는다는 점을 먼저 확인한다.

## 이벤트 세 종류를 구분한다

| `type` | 의미 | 주요 데이터 |
| --- | --- | --- |
| `issue.created` | 새 issue가 만들어짐 | `data.object` issue snapshot |
| `issue.trace.added` | 기존 issue에 새 trace가 연결됨 | `data.object`, `data.trace` |
| `issue.agent_run.failed` | Engine 실행 자체가 실패함 | session-scoped 실패 정보 |

issue priority 숫자는 작을수록 긴급하다. `0`은 urgent, `1`은 high, `2`는 medium, `3`은 low다. 예를 들어 threshold `1`은 urgent와 high를 전달한다. 다만 `issue.agent_run.failed`는 issue가 아니라 Engine session 범위라 이 priority filter가 적용되지 않는다.

## 1. JSON을 파싱하기 전에 HMAC 서명을 검증한다

LangSmith는 signing secret을 key로, **정확한 raw request body bytes**를 message로 사용해 HMAC-SHA256 서명을 만든다. header 형식은 `sha256=<hex digest>`다. JSON을 파싱한 뒤 다시 직렬화하면 공백과 key 순서가 달라질 수 있으므로 검증이 실패한다.

```python
import hashlib
import hmac


def verify_signature(body: bytes, secret: str, header: str | None) -> bool:
    if not header or not header.startswith("sha256="):
        return False

    expected = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, header)
```

`==` 대신 `hmac.compare_digest()`를 사용하면 timing 차이로 서명 값을 추측하기 어렵다. custom `Authorization` header를 추가 인증에 쓸 수 있지만 HMAC 검증을 대체하지는 않는다.

## 2. 느슨한 schema로 envelope만 검증한다

공식 문서는 기존 event에 field가 추가되거나 새 type이 생길 수 있다고 명시한다. Pydantic model은 필요한 공통 필드만 고정하고 extra field를 허용한다.

```python
from typing import Any

from pydantic import BaseModel, ConfigDict


class EngineEvent(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    type: str
    created: int
    request_id: str
    data: dict[str, Any]
```

`data.trace`를 항상 필수로 두면 `issue.created`와 `issue.agent_run.failed`가 validation error가 된다. type별로 필요한 순간에만 읽는다.

## 3. event id를 unique key로 저장해 retry를 멱등 처리한다

LangSmith는 transport error, `408`, `425`, `429`, `5xx`에 대해 최대 네 번 전달한다. retry payload는 같은 bytes와 같은 `id`를 유지한다. 따라서 downstream ticket 생성 전에 event `id`를 unique key로 저장해야 한다.

아래 SQLite 코드는 데모와 단일 프로세스 개발용이다. 운영에서는 같은 unique constraint를 Postgres 같은 공유 DB에 둔다.

```python
import json
import sqlite3


db = sqlite3.connect("engine-events.db", check_same_thread=False)
db.execute(
    """
    CREATE TABLE IF NOT EXISTS engine_events (
        event_id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL
    )
    """
)


def persist_once(event: EngineEvent) -> bool:
    try:
        with db:
            db.execute(
                "INSERT INTO engine_events VALUES (?, ?, ?, ?)",
                (
                    event.id,
                    event.request_id,
                    event.type,
                    json.dumps(event.model_dump(), ensure_ascii=False),
                ),
            )
        return True
    except sqlite3.IntegrityError:
        return False
```

메모리 `set`은 재시작과 여러 worker 사이에서 공유되지 않으므로 운영 멱등 장치로는 부족하다.

## 4. FastAPI endpoint를 구성한다

```python
import json
import os

from fastapi import FastAPI, HTTPException, Request, Response, status
from pydantic import ValidationError

app = FastAPI()
SIGNING_SECRET = os.environ["LANGSMITH_ENGINE_WEBHOOK_SECRET"]
KNOWN_TYPES = {
    "issue.created",
    "issue.trace.added",
    "issue.agent_run.failed",
}


@app.post("/webhooks/langsmith-engine", status_code=status.HTTP_202_ACCEPTED)
async def receive_engine_event(request: Request) -> Response:
    body = await request.body()
    signature = request.headers.get("X-LangSmith-Signature")

    if not verify_signature(body, SIGNING_SECRET, signature):
        raise HTTPException(status_code=401, detail="invalid signature")

    try:
        event = EngineEvent.model_validate(json.loads(body))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(status_code=400, detail="invalid payload") from exc

    inserted = persist_once(event)
    if not inserted:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    if event.type not in KNOWN_TYPES:
        # 저장은 하되 새 type 때문에 retry storm을 만들지 않는다.
        return Response(status_code=status.HTTP_202_ACCEPTED)

    # 여기서는 durable queue에 event.id만 enqueue한다.
    # ticket/Slack/paging 호출은 별도 worker에서 실행한다.
    return Response(status_code=status.HTTP_202_ACCEPTED)
```

이 예제의 순서는 `raw body 읽기 → 서명 검증 → 최소 schema 검증 → 멱등 저장 → enqueue → 응답`이다. 실제 enqueue가 durable하지 않다면 저장 table에 `processing_status`를 두고 worker가 pending row를 가져가는 outbox 패턴이 더 안전하다.

## 5. `id`와 `request_id`의 역할을 섞지 않는다

- `id`: 전달 하나의 고유 ID이며 retry dedupe key다.
- `request_id`: 한 upstream action에서 함께 발생한 여러 event를 묶는 correlation key다.

Engine이 issue 하나를 만들고 trace 다섯 개를 연결하면 `issue.created` 한 개와 `issue.trace.added` 다섯 개가 올 수 있다. 여섯 event는 각각 다른 `id`를 갖지만 같은 `request_id`를 공유한다. 알림을 한 건으로 합칠 때는 잠깐의 coalescing window를 두고 `request_id`로 묶되, 저장과 멱등 처리는 반드시 `id`로 한다.

## 운영 전 테스트 체크리스트

1. 샘플 body를 임의 secret으로 서명해 정상 요청이 `202`인지 확인한다.
2. 같은 body와 signature를 두 번 보내 DB row와 downstream action이 한 건인지 확인한다.
3. body 한 글자를 바꾼 요청이 `401`인지 확인한다.
4. 알 수 없는 `type`과 extra field가 포함되어도 `2xx`인지 확인한다.
5. downstream API를 일부러 느리게 해도 webhook 응답은 20초보다 훨씬 빠른지 확인한다.
6. signing secret을 roll한 직후 수신 서버 secret도 함께 교체한다. 이전 secret은 roll 완료 즉시 사용되지 않는다.

## 자주 틀리는 점

### parsed JSON을 다시 직렬화해 서명 검증하기

서명 대상은 재구성한 JSON이 아니라 원본 bytes다. `await request.body()` 결과를 그대로 사용한다.

### `request_id`로 중복 제거하기

같은 action에서 나온 정상 event 여러 개까지 사라진다. dedupe는 event `id`, 묶음 알림은 `request_id`다.

### endpoint 안에서 ticket과 paging API를 모두 호출하기

LangSmith의 attempt timeout은 20초다. 느린 downstream 때문에 retry가 발생하면 중복 ticket 위험도 커진다. 먼저 durable storage 또는 queue에 넣고 응답한다.

### 모든 4xx가 retry될 것이라 기대하기

공식 규칙상 retry 대상은 transport error, `408`, `425`, `429`, `5xx`다. 다른 `4xx`는 영구 실패로 본다. 일시적으로 처리할 수 없으면 상태 코드 선택을 신중히 해야 한다.

### severity 숫자의 방향을 반대로 이해하기

숫자가 작을수록 긴급하다. threshold `1`은 `0`과 `1`을 포함한다.

## 추천 운영 구조

```text
LangSmith Engine
  -> HTTPS endpoint
  -> raw-body HMAC 검증
  -> event id unique 저장 / outbox
  -> 빠른 2xx
  -> worker가 request_id 단위로 묶음
  -> ticket, paging, chat 알림
```

핵심은 webhook을 단순 알림 POST가 아니라 **at-least-once 전달을 받는 event ingestion endpoint**로 다루는 것이다. 그러면 retry, 중복, 새 event type, 느린 외부 서비스가 생겨도 incident 흐름을 안정적으로 유지할 수 있다.

## 참고 자료

- [LangSmith Engine webhook events](https://docs.langchain.com/langsmith/engine-webhooks)
- [Find and fix your agent's issues with LangSmith Engine](https://docs.langchain.com/langsmith/engine)
