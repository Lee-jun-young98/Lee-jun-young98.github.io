---
title: "LangSmith presigned feedback token으로 프론트엔드 평가 수집하기"
description: "LangSmith에서 create_feedback(), create_presigned_feedback_token(), create_feedback_from_token()을 조합해 사용자 피드백을 안전하게 수집하고 child run까지 연결하는 실전 패턴을 정리한 한국어 학습 노트"
date: 2026-06-15
tags:
  - langsmith
  - feedback
  - observability
  - python
aliases:
  - "/blog/langsmith-presigned-feedback-tokens"
---

# LangSmith presigned feedback token으로 프론트엔드 평가 수집하기

LangSmith tracing까지 붙이고 나면 다음 단계에서 자주 막힌다.

- "좋아요 / 별점 / 수정 코멘트를 사용자에게 직접 받고 싶다"
- "브라우저나 모바일 앱에서 피드백을 받되 LangSmith API 키는 노출하면 안 된다"
- "응답 전체뿐 아니라 retrieval 같은 child run에도 평가를 남기고 싶다"
- "나중에 annotation queue, online eval, dataset 개선으로 이어질 수 있게 피드백을 구조화하고 싶다"

이럴 때 핵심이 `create_feedback()`과 presigned feedback token이다.  
신뢰된 백엔드에서는 SDK로 바로 피드백을 남기고, 클라이언트에서는 API 키 대신 짧게 살아있는 token URL로 피드백만 제출하게 만들면 된다.

이 글에서는 공식 문서 기준으로 아래 흐름만 실무적으로 정리한다.

- root run과 child run에 피드백을 붙이는 기준
- Python SDK의 `create_feedback()`을 언제 바로 쓰는지
- `create_presigned_feedback_token()`으로 프론트엔드 전용 URL을 만드는 법
- token 만료, 허용 점수 범위, GET/POST 차이에서 자주 나는 실수

## 언제 쓰면 좋은가

아래 상황이면 presigned feedback token 패턴이 잘 맞는다.

- 웹 앱에서 thumbs up/down, 1~5점, 짧은 코멘트를 받는다
- 이메일이나 Slack 링크 클릭만으로 간단 피드백을 받고 싶다
- 프론트엔드는 LangSmith 키를 몰라야 한다
- 나중에 낮은 점수 trace만 automation rule이나 annotation queue로 다시 모으고 싶다

반대로 서버 내부 배치 작업이나 평가 파이프라인처럼 이미 안전한 환경이라면 token 없이 `create_feedback()`만으로 충분한 경우가 많다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith
```

PowerShell:

```powershell
$env:LANGSMITH_TRACING="true"
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_PROJECT="support-chat-prod"
```

## 1. 먼저 피드백을 붙일 run ID를 확보한다

LangSmith 피드백은 trace 전체(root run)에도 붙일 수 있고, 특정 child run에도 붙일 수 있다.  
예를 들어 "최종 답변은 좋았지만 retrieval이 틀렸다" 같은 경우는 child run 피드백이 훨씬 유용하다.

아래 예시는 root run 하나와 retrieval child run 하나를 만든 뒤, 두 ID를 꺼내는 최소 예제다.

```python
from langsmith import Client, trace, traceable


@traceable(run_type="tool")
def retrieve_docs(question: str) -> dict:
    return {
        "docs": [
            "환불은 배송 완료 후 7일 이내에 신청할 수 있습니다.",
            "디지털 상품은 다운로드 후 환불이 제한됩니다.",
        ]
    }


@traceable(name="answer_customer")
def answer_customer(question: str) -> dict:
    docs = retrieve_docs(question)
    answer = f"질문: {question}\n답변: {docs['docs'][0]}"
    return {"answer": answer}


client = Client()

with trace(
    name="support_turn",
    inputs={"question": "전자책 환불은 언제까지 가능한가요?"},
) as root_run:
    result = answer_customer(root_run.inputs["question"])
    root_run.outputs = result
    trace_id = root_run.id
    child_runs = root_run.child_runs

retrieval_run_id = next(run.id for run in child_runs if run.name == "retrieve_docs")

print("trace_id =", trace_id)
print("retrieval_run_id =", retrieval_run_id)
```

## 2. 백엔드에서 바로 남길 때는 `create_feedback()`이 가장 단순하다

운영 백엔드나 내부 리뷰 도구처럼 API 키를 안전하게 쥐고 있는 환경이라면 SDK로 바로 피드백을 쓰는 편이 가장 간단하다.

```python
from langsmith import Client

client = Client()

trace_id = "<root_trace_id>"
retrieval_run_id = "<child_run_id>"

client.create_feedback(
    key="user_score",
    score=1,
    trace_id=trace_id,
    comment="최종 답변이 바로 도움이 됐습니다.",
)

client.create_feedback(
    key="retrieval_correctness",
    score=0,
    run_id=retrieval_run_id,
    trace_id=trace_id,
    comment="근거 문서가 질문 의도와 살짝 달랐습니다.",
)
```

공식 문서 기준으로 중요한 점은 두 가지다.

- 피드백은 root run뿐 아니라 child run에도 붙일 수 있다.
- Python에서는 `trace_id=`를 같이 넘기면 피드백 생성이 background 처리되어 저지연 환경에 유리하다.

즉, 사용자 클릭 직후 백엔드가 피드백을 기록해야 하는 구조라면 `run_id` 또는 `trace_id`를 잡고 `create_feedback()`으로 끝내면 된다.

## 3. 클라이언트에서 받으려면 presigned token URL을 발급한다

브라우저나 모바일 앱에서 직접 LangSmith에 점수를 보내게 하려면 API 키 대신 presigned feedback token URL을 내보내야 한다.

```python
import datetime as dt
from langsmith import Client

client = Client()

run_id = "<root_trace_id>"

token = client.create_presigned_feedback_token(
    run_id,
    feedback_key="user_score",
    expiration=dt.timedelta(hours=24),
    feedback_config={
        "type": "continuous",
        "min": 0,
        "max": 1,
    },
)

print("token_id =", token.id)
print("feedback_url =", token.url)
```

이 예제에서 실무적으로 중요한 설정은 다음이다.

- 기본 만료 시간은 3시간이다
- `expiration`으로 상대 시간 또는 절대 시간을 줄 수 있다
- `feedback_config`로 허용 점수 범위를 제한할 수 있다

thumbs up/down처럼 키를 여러 개 나눠 쓰고 싶다면 Python에서는 복수 발급도 가능하다.

```python
from langsmith import Client

client = Client()

tokens = client.create_presigned_feedback_tokens(
    "<root_trace_id>",
    feedback_keys=["thumbs_up", "thumbs_down"],
)

for token in tokens:
    print(token.id, token.url)
```

## 4. 프론트엔드는 token URL로만 제출한다

프론트엔드는 발급받은 URL에 `POST` 또는 `GET` 요청만 보내면 된다.  
일반적인 앱 UI에서는 `POST`가 더 낫다. `metadata`까지 함께 보낼 수 있기 때문이다.

```javascript
await fetch(feedbackUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    score: 1,
    comment: "답변이 바로 문제를 해결해줬습니다.",
    metadata: { surface: "web", locale: "ko-KR" },
  }),
})
```

링크 클릭만 필요한 이메일/Slack 시나리오라면 `GET`도 가능하다.

```text
https://api.smith.langchain.com/api/v1/feedback/tokens/<token_id>?score=1&comment=helpful
```

다만 공식 문서 기준으로 `GET`은 `metadata`를 지원하지 않는다.  
사용자 채널, 실험군, 화면 위치 같은 추가 문맥이 필요하면 `POST`를 택하는 편이 낫다.

## 5. 다른 서비스가 만든 token도 서버에서 다시 사용할 수 있다

토큰 URL을 다른 서비스가 발급했고, 실제 피드백 반영은 별도 서버 워커가 하도록 만들 수도 있다. 그때는 `create_feedback_from_token()`이 단순하다.

```python
from langsmith import Client

client = Client()

client.create_feedback_from_token(
    "<token_or_url>",
    score=1,
    comment="서버 후처리로 저장한 피드백입니다.",
)
```

이미 발급된 token 상태를 점검하고 싶다면 `list_presigned_feedback_tokens()`으로 run별 토큰 목록을 확인할 수 있다.

```python
from langsmith import Client

client = Client()

for token in client.list_presigned_feedback_tokens("<root_trace_id>"):
    print(token.id, token.url, token.expires_at)
```

## 추천 운영 패턴

개인적으로는 아래처럼 나누는 편이 가장 안정적이다.

1. trace 저장 시 root run ID와 주요 child run ID를 애플리케이션 DB에도 같이 저장한다.
2. 신뢰된 백엔드 관리자 화면에서는 `create_feedback()`으로 바로 남긴다.
3. 일반 사용자 웹/모바일 화면에서는 presigned token만 발급해 전달한다.
4. `user_score`, `retrieval_correctness`, `comment`처럼 key를 초반에 고정한다.
5. 낮은 점수 trace는 나중에 automation, annotation queue, offline eval dataset으로 다시 연결한다.

이 흐름을 잡아두면 LangSmith 피드백이 단순 thumbs up/down 로그를 넘어서, 실제 품질 개선 데이터 파이프라인으로 이어지기 시작한다.

## 자주 틀리는 점

### 1. 브라우저에서 API 키로 `create_feedback()`을 직접 호출하려는 경우

이건 가장 피해야 한다.  
클라이언트는 LangSmith API 키를 몰라야 하고, 외부 노출이 필요한 경우는 presigned token URL만 전달해야 한다.

### 2. root run에 붙일지 child run에 붙일지 기준 없이 섞는 경우

최종 만족도는 root run, retrieval/tool 품질은 child run처럼 역할을 나눠야 나중에 분석이 쉬워진다.  
모든 평가를 root run에만 붙이면 어느 단계가 문제였는지 다시 쪼개기 어렵다.

### 3. Python 백엔드에서 `trace_id` 없이 child run 피드백만 기록하는 경우

동작은 할 수 있지만, 공식 문서 기준으로 `trace_id`를 함께 주는 편이 batched/background ingestion에 유리하다.  
지연 시간에 민감한 서비스라면 습관적으로 같이 넘기는 편이 안전하다.

### 4. `GET` 링크로 보내면서 `metadata`까지 들어갈 거라고 기대하는 경우

`GET`은 `score`, `value`, `comment`, `correction`만 다룬다.  
실험군, 앱 버전, locale 같은 문맥을 같이 남겨야 하면 `POST` 요청을 써야 한다.

### 5. token을 너무 오래 살려두는 경우

token URL은 인증을 대신하므로 필요 이상으로 오래 열어두지 않는 편이 낫다.  
일반 사용자 피드백은 짧게, 이메일/비동기 회수 플로우만 조금 길게 주는 식으로 만료 시간을 다르게 잡는 것이 보통 안전하다.

## 참고 자료

- [Log user feedback using the SDK](https://docs.langchain.com/langsmith/attach-user-feedback)
- [Collect feedback with presigned URLs](https://docs.langchain.com/langsmith/presigned-feedback-tokens)
- [Feedback data format](https://docs.langchain.com/langsmith/feedback-data-format)
- [Use annotation queues](https://docs.langchain.com/langsmith/annotation-queues)
- [Set up automation rules](https://docs.langchain.com/langsmith/rules)
