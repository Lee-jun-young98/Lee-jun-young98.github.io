---
title: "LangSmith prompt webhook으로 프롬프트 배포 자동화하기"
description: "LangSmith에서 push_prompt와 prompt-webhooks API를 함께 써서 prompt commit과 tag 변경을 배포 훅으로 연결하는 방법을 Python 예제로 정리한 실전 노트"
date: 2026-07-13
tags:
  - langsmith
  - prompts
  - automation
  - python
aliases:
  - "/blog/langsmith-prompt-webhooks-deploy-automation"
---

# LangSmith prompt webhook으로 프롬프트 배포 자동화하기

LangSmith에 프롬프트를 올려 두고 commit tag로 버전을 고정하면 운영이 훨씬 편해진다.  
하지만 실무에서는 한 단계가 더 필요해진다. "누가 프롬프트 commit을 만들었을 때 Slack이나 CI를 바로 깨우고 싶다", "tag가 바뀌면 캐시 무효화나 재검증 작업을 자동으로 돌리고 싶다" 같은 요구다.

이럴 때 쓰는 기능이 `prompt webhook`이다.  
LangSmith 공식 문서 기준으로 prompt webhook은 prompt commit 생성과 tag 변경 이벤트를 외부 HTTP 엔드포인트로 밀어 줄 수 있다.

이 글에서는 아래 흐름만 실무 기준으로 정리한다.

- `push_prompt(...)`로 LangSmith prompt 버전을 만들기
- `POST /api/v1/prompt-webhooks`로 webhook 등록하기
- `POST /api/v1/prompt-webhooks/test`로 payload를 미리 검증하기
- FastAPI 수신 서버에서 빠르게 받고 후속 배포 작업으로 넘기기
- commit tag와 resource tag를 헷갈리지 않게 운영 규칙 잡기

## 언제 이 방식이 잘 맞는가

아래 상황이면 prompt webhook이 실용적이다.

- 프롬프트 변경이 코드 배포와 분리돼 있다
- `staging`, `production` 승격 시 후속 검증이나 캐시 무효화가 필요하다
- LangSmith Playground에서 프롬프트를 바꾸는 팀과 앱을 운영하는 팀이 다르다
- prompt commit 내역을 외부 시스템에 남기고 싶다

반대로 프롬프트가 코드와 항상 같이 배포되고, 별도 운영 자동화가 필요 없다면 webhook까지 붙일 필요는 없다.

## 사전 준비

공식 문서 기준으로 프롬프트 관리용 SDK는 `langsmith >= 0.1.99`가 필요하다.  
REST API 호출 예제를 위해 `requests`, 수신 서버 예제를 위해 `fastapi`, `uvicorn`을 같이 설치한다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "langsmith>=0.1.99" langchain-core requests fastapi uvicorn
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_ENDPOINT="https://api.smith.langchain.com"
```

프롬프트 캐시를 함께 쓰는 앱이라면 `langsmith >= 0.7.0`도 확인해 두는 편이 좋다.

## 1. 먼저 LangSmith에 프롬프트 commit을 만든다

prompt webhook은 prompt 이벤트를 외부로 보내는 기능이므로, 출발점은 당연히 LangSmith prompt다.

```python
from langsmith import Client
from langchain_core.prompts import ChatPromptTemplate

client = Client()

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", "당신은 한국어 환불 정책 도우미입니다."),
        ("human", "질문: {question}"),
    ]
)

url = client.push_prompt("refund-policy-bot", object=prompt)
print(url)
```

같은 이름으로 다시 `push_prompt(...)`를 호출하면 새 commit이 추가된다.  
공식 문서 기준으로 prompt webhook은 이 commit 생성 이벤트와 tag 생성/이동 이벤트를 기준으로 동작한다.

## 2. webhook이 감시할 이벤트를 먼저 좁혀서 생각한다

현재 공식 문서 기준으로 prompt webhook trigger는 세 가지다.

- `commit`
- `tag:create`
- `tag:update`

실무에서는 보통 둘 중 하나로 출발하면 된다.

1. commit마다 테스트 자동화 실행
2. `staging` 또는 `production` 같은 tag 이동 때만 실제 배포 작업 실행

대부분의 운영 환경에서는 두 번째가 더 안전하다.  
commit은 실험 단위로 자주 생기지만, tag 이동은 "이 버전을 쓰겠다"는 의사결정에 더 가깝기 때문이다.

## 3. REST API로 prompt webhook을 만든다

공식 API 문서 기준으로 webhook 생성 엔드포인트는 `POST /api/v1/prompt-webhooks`이고, `X-Api-Key` 헤더가 필요하다.  
body에는 `url`, `headers`, `include_prompts`, `exclude_prompts`, `triggers`를 넣을 수 있다.

아래 예제는 특정 프롬프트에 대해서만 `commit`, `tag:update` 이벤트를 받는 최소 구성이다.

```python
import os
import requests

LANGSMITH_ENDPOINT = os.getenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")
LANGSMITH_API_KEY = os.environ["LANGSMITH_API_KEY"]

# prompt UUID는 LangSmith UI의 prompt detail 페이지나 관련 API 응답에서 확인한다.
prompt_id = "11111111-2222-3333-4444-555555555555"

response = requests.post(
    f"{LANGSMITH_ENDPOINT}/api/v1/prompt-webhooks",
    headers={
        "X-Api-Key": LANGSMITH_API_KEY,
        "Content-Type": "application/json",
    },
    json={
        "url": "https://ops.example.com/langsmith/prompt-webhook",
        "headers": {
            "X-Webhook-Secret": "replace-me",
        },
        "include_prompts": [prompt_id],
        "triggers": ["commit", "tag:update"],
    },
    timeout=30,
)
response.raise_for_status()

webhook = response.json()
print(webhook["id"])
print(webhook["url"])
```

여기서 중요한 점은 `include_prompts`가 prompt 이름이 아니라 UUID 목록이라는 점이다.  
운영 초반에는 모든 prompt에 공통 webhook을 두기보다, 실제 배포 자동화가 필요한 prompt만 명시적으로 포함시키는 편이 덜 시끄럽다.

## 4. webhook을 만들기 전에 test endpoint로 payload를 먼저 검증한다

공식 문서 기준으로 LangSmith는 `POST /api/v1/prompt-webhooks/test` 엔드포인트를 따로 제공한다.  
실서비스 URL에 webhook을 걸기 전에 payload 형태와 인증 로직을 먼저 맞출 수 있어서 꽤 유용하다.

```python
import os
import requests

LANGSMITH_ENDPOINT = os.getenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")
LANGSMITH_API_KEY = os.environ["LANGSMITH_API_KEY"]

response = requests.post(
    f"{LANGSMITH_ENDPOINT}/api/v1/prompt-webhooks/test",
    headers={
        "X-Api-Key": LANGSMITH_API_KEY,
        "Content-Type": "application/json",
    },
    json={
        "webhook": {
            "url": "https://ops.example.com/langsmith/prompt-webhook",
            "headers": {
                "X-Webhook-Secret": "replace-me",
            },
            "triggers": ["tag:update"],
        },
        "payload": {
            "event": "tag:update",
            "prompt_id": "11111111-2222-3333-4444-555555555555",
            "prompt_name": "refund-policy-bot",
            "manifest": {"lc": 1, "type": "constructor"},
            "commit_hash": "abcdef12",
            "created_at": "2026-07-13T00:00:00Z",
            "created_by": "ops@example.com",
            "tag_name": "production",
        },
    },
    timeout=30,
)
response.raise_for_status()
print(response.json())
```

문서상 `test` 호출은 `webhook` 설정과 `payload`를 함께 보내는 형태다.  
즉 실제 LangSmith 이벤트를 기다리지 않고도 수신 서버가 기대한 필드와 인증 헤더를 처리하는지 먼저 볼 수 있다.

## 5. 수신 서버는 "빠르게 받고 큐에 넘기기" 쪽으로 만든다

prompt webhook을 받는 서버는 배포 엔진 그 자체라기보다 "이벤트 수신기"로 두는 편이 안전하다.  
수신 즉시 검증하고 내부 큐, CI, 잡 러너로 넘기면 retry나 장애 처리도 단순해진다.

```python
import os

from fastapi import FastAPI, Header, HTTPException, Request

app = FastAPI()
EXPECTED_SECRET = os.environ["LANGSMITH_PROMPT_WEBHOOK_SECRET"]


@app.post("/langsmith/prompt-webhook")
async def receive_prompt_webhook(
    request: Request,
    x_webhook_secret: str | None = Header(default=None),
):
    if x_webhook_secret != EXPECTED_SECRET:
        raise HTTPException(status_code=401, detail="invalid webhook secret")

    payload = await request.json()

    event = payload.get("event")
    prompt_name = payload.get("prompt_name")
    tag_name = payload.get("tag_name")
    commit_hash = payload.get("commit_hash")

    # 여기서 바로 긴 배포 작업을 하지 말고 내부 큐나 CI 트리거로 넘기는 편이 안전하다.
    print(
        {
            "event": event,
            "prompt_name": prompt_name,
            "tag_name": tag_name,
            "commit_hash": commit_hash,
        }
    )

    return {"accepted": True}
```

로컬 실행:

```bash
uvicorn prompt_webhook_app:app --reload --port 8000
```

추천 흐름은 아래 정도면 충분하다.

1. header secret 검증
2. payload를 로그에 남김
3. `tag_name == "production"` 같은 조건에서만 배포 큐로 전달
4. HTTP 200은 빨리 반환

## 6. commit 이벤트와 tag 이벤트를 분리하면 운영이 덜 꼬인다

보통 처음에는 `commit`과 `tag:update`를 한 webhook에 다 넣고 싶어진다.  
가능은 하지만 후속 작업은 분리하는 편이 낫다.

예를 들면 아래처럼 나누면 된다.

- `commit` 이벤트
  새 프롬프트에 대한 smoke test, regression eval, preview 생성
- `tag:create` / `tag:update` 이벤트
  운영 캐시 무효화, 배포 전환, Slack 공지, audit 기록

이렇게 분리하면 "실험 저장"과 "운영 승격"을 같은 의미로 오해하지 않게 된다.

## 자주 틀리는 점

### 1. commit tag와 resource tag를 같은 태그라고 생각하면 안 된다

공식 관리 문서 기준으로 commit tag는 프롬프트 버전을 가리키는 포인터고, resource tag는 워크스페이스 리소스를 분류하는 key-value 태그다.  
배포 자동화는 보통 commit tag 이동에 걸고, 검색과 정리는 resource tag로 따로 가져가는 편이 맞다.

### 2. 모든 commit마다 실제 배포를 걸면 운영이 과민해진다

prompt commit은 실험 저장에도 쓰인다.  
그래서 운영 전환은 `tag:update`에만 반응하고, `commit`은 테스트 전용으로 쓰는 편이 안전하다.

### 3. webhook에 prompt 이름만 넣고 prompt UUID는 무시하면 범위 제어가 불편해진다

생성 API는 `include_prompts`와 `exclude_prompts`에 UUID 배열을 받는다.  
운영 중인 핵심 프롬프트만 선택적으로 묶고 싶다면 이 필드를 적극적으로 쓰는 편이 낫다.

### 4. 수신 서버에서 배포를 동기 처리하면 timeout과 중복 실행이 생기기 쉽다

외부 webhook은 재시도나 일시 장애를 전제로 설계해야 한다.  
HTTP 요청 안에서 빌드, 캐시 삭제, 모델 워밍까지 한 번에 하려 하지 말고 큐 기반으로 넘기는 편이 낫다.

### 5. 앱이 prompt cache를 쓰면 tag 이동 직후 바로 새 버전이 안 보일 수 있다

공식 문서 기준으로 prompt caching은 기본 활성화이며 stale-while-revalidate 패턴으로 동작한다.  
즉 webhook으로 배포 전환을 감지했더라도, 앱 프로세스는 TTL 동안 이전 prompt를 들고 있을 수 있으니 캐시 무효화 전략을 같이 잡아야 한다.

## 추천 운영 흐름

개인적으로는 아래 정도가 가장 단순하다.

1. 개발자가 Playground나 코드에서 프롬프트를 수정하고 commit을 만든다
2. `commit` webhook이 preview test를 돌린다
3. 검증된 commit을 `staging` 또는 `production`으로 승격한다
4. `tag:update` webhook이 캐시 무효화와 운영 전환 작업을 트리거한다
5. 실제 앱 코드는 여전히 `prompt-name:production` 같은 commit tag만 참조한다

이 구조가 좋은 이유는 앱 코드는 단순하게 유지하면서, prompt 운영 자동화만 외부 이벤트 기반으로 분리할 수 있기 때문이다.

## 참고 자료

- [Manage prompts programmatically](https://docs.langchain.com/langsmith/manage-prompts-programmatically)
- [Manage prompts](https://docs.langchain.com/langsmith/manage-prompts)
- [LangSmith API reference](https://docs.langchain.com/langsmith/smith-api-ref)
- [Create Prompt Webhook](https://docs.langchain.com/langsmith/smith-api/prompt-webhooks/create-prompt-webhook)
- [Test Prompt Webhook](https://docs.langchain.com/langsmith/smith-api/prompt-webhooks/test-prompt-webhook)
