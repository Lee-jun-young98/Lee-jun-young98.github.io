---
title: "LangSmith automation rule과 webhook으로 운영 점검 자동화하기"
description: "LangSmith에서 automation rule, online evaluator, annotation queue, webhook을 조합해 운영 중인 LLM 앱의 점검 흐름을 자동화하는 방법을 Python 예제와 함께 정리한 실전 노트"
date: 2026-06-08
tags:
  - langsmith
  - observability
  - automation
  - python
aliases:
  - "/blog/langsmith-automation-rules-webhooks"
---

# LangSmith automation rule과 webhook으로 운영 점검 자동화하기

LangSmith tracing을 붙여 두면 운영 로그는 쌓이는데, 그다음부터는 보통 같은 문제가 생긴다.  
"실패 run만 자동으로 사람 검토 큐에 넣고 싶다", "특정 점수 이하 run만 외부 시스템으로 보내고 싶다", "online evaluator가 점수를 붙인 뒤에만 후속 작업이 돌았으면 좋겠다" 같은 요구다.

이럴 때 LangSmith의 automation rule이 실용적이다.  
필터에 맞는 run을 annotation queue, dataset, webhook, evaluator 같은 후속 처리로 자동 연결할 수 있기 때문이다.

이번 글에서는 공식 문서를 기준으로 아래 흐름만 실무 중심으로 정리한다.

- tracing project에 automation rule을 붙일 때 어떤 액션 조합이 맞는지
- online evaluator와 webhook을 같은 규칙에 넣으면 왜 순서 문제가 생기는지
- webhook 수신 서버를 Python으로 어떻게 받으면 되는지
- 운영에서 자주 헷갈리는 filter, sampling, backfill, retry 함정을 어떻게 피할지

## 언제 이 방식이 맞는가

아래 상황이면 automation rule을 먼저 붙일 가치가 크다.

- 운영 run이 많아져서 사람이 직접 traces 테이블을 뒤지기 어렵다
- 에러 run, 낮은 사용자 점수 run, 특정 태그 run만 따로 후속 처리하고 싶다
- 사람 검토 큐와 외부 알림을 같은 관측 체계 안에서 이어 붙이고 싶다
- online evaluator 결과를 기준으로 Slack, 티켓 시스템, 내부 API를 호출하고 싶다

반대로 아직 tracing도 붙지 않았거나 운영 로그량이 거의 없으면 rule 설계보다 먼저 project 분리, tags, metadata 정리가 우선이다.

## 사전 준비

run을 만들 최소 앱 예제와 webhook 수신 예제를 위해 아래 정도면 충분하다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith openai fastapi uvicorn
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:OPENAI_API_KEY="sk-..."
$env:LANGSMITH_TRACING="true"
$env:LANGSMITH_PROJECT="support-bot-prod"
```

공식 문서 기준으로 automation rule 자체는 주로 LangSmith UI에서 만든다.  
그래서 Python 예제는 "rule이 걸릴 run을 남기는 앱"과 "webhook을 받는 서버" 쪽에 집중하는 편이 실무적으로 낫다.

## 1. 먼저 rule이 걸릴 run 구조를 깔끔하게 남기기

automation rule은 tracing project 안의 run 필터를 기반으로 동작한다.  
그래서 처음부터 tags와 metadata를 남겨 두면 필터를 훨씬 덜 비틀게 된다.

```python
from openai import OpenAI
from langsmith import traceable
from langsmith.wrappers import wrap_openai

client = wrap_openai(OpenAI())


@traceable(run_type="chain", name="support_answer")
def answer_ticket(question: str, channel: str) -> str:
    result = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": "You answer customer support questions in one short paragraph.",
            },
            {"role": "user", "content": question},
        ],
    )
    return result.choices[0].message.content or ""


if __name__ == "__main__":
    print(
        answer_ticket(
            "결제가 두 번 승인된 것 같아요. 어떻게 확인하나요?",
            langsmith_extra={
                "tags": ["support", "production", "billing"],
                "metadata": {
                    "channel": "email",
                    "feature": "refund-triage",
                    "priority": "high",
                },
            },
        )
    )
```

이 정도만 해도 LangSmith UI에서 아래 같은 rule 설계가 쉬워진다.

- `tag = "production"` 인 run만 샘플링
- `metadata.feature = "refund-triage"` 인 run만 annotation queue로 보내기
- 에러 run 또는 `feedback_score < 0.5` 인 run만 webhook으로 보내기

핵심은 "나중에 filter 문법으로 억지로 추론하지 말고, tracing 시점에 분류 기준을 함께 남긴다"는 점이다.

## 2. automation rule은 액션보다 실행 순서를 먼저 이해해야 한다

공식 문서 기준으로 automation rule은 filter, sampling rate, action 조합으로 만든다.  
여기서 중요한 건 단순히 "무슨 액션이 있나"보다 "어떤 순서로 실행되나"다.

현재 문서 기준으로 한 rule 안에서 여러 액션을 함께 두면 아래 순서로 실행된다.

1. annotation queue 추가
2. dataset 추가
3. webhook 호출
4. online evaluator 실행
5. custom code evaluator 실행
6. alert 트리거

이 순서 때문에 가장 흔한 실수가 바로 이것이다.

- webhook과 evaluator를 같은 rule에 넣고
- webhook payload 안에 evaluator 점수가 들어오길 기대하는 것

하지만 같은 rule 안에서는 webhook이 evaluator보다 먼저 돈다.  
즉 점수가 아직 없는 상태로 webhook이 먼저 발사될 수 있다.

## 3. online evaluator 뒤에 webhook이 필요하면 rule을 둘로 나누기

운영에서 자주 필요한 흐름은 아래와 비슷하다.

1. production run에 online evaluator를 붙인다
2. evaluator가 `answer_usefulness` 같은 점수를 남긴다
3. 점수가 낮은 run만 외부 시스템으로 보낸다

이 경우 권장 방식은 rule을 하나로 합치는 게 아니라 둘로 나누는 것이다.

- Rule A: production run에 online evaluator 적용
- Rule B: `has(feedback_key, "answer_usefulness") and feedback_score < 0.5` 인 run만 webhook 호출

공식 webhook 문서도 같은 방향을 권장한다.  
rule들은 서로 독립적인 polling schedule로 실행되므로, evaluator가 먼저 끝났는지를 downstream rule의 feedback filter로 명시해야 한다.

실무에서는 보통 아래처럼 나누면 된다.

- Rule A
  `tag = "production"`
  액션: online evaluator
- Rule B
  `tag = "production" and has(feedback_key, "answer_usefulness") and feedback_score < 0.5`
  액션: webhook
- Rule C
  `error = true`
  액션: annotation queue

이 구조가 좋은 이유는 점수 계산, 사람 검토, 외부 통합을 서로 느슨하게 분리할 수 있기 때문이다.

## 4. webhook 수신 서버는 5초 안에 끝내는 쪽으로 설계하기

공식 문서 기준으로 LangSmith webhook delivery는 몇 가지 제약이 있다.

- 연결 실패 시 최대 2회 재시도
- 5초보다 오래 걸리면 실패 처리
- 5xx는 재시도 가능
- 4xx는 재시도 없이 실패 처리

그래서 webhook 엔드포인트 안에서 무거운 후처리를 다 해버리면 실패율이 올라간다.  
보통은 "검증 후 큐에 넣고 바로 200 반환" 구조가 더 안전하다.

아래는 FastAPI로 받는 최소 예제다.

```python
import os

from fastapi import FastAPI, HTTPException, Request

app = FastAPI()
WEBHOOK_SECRET = os.environ["LANGSMITH_WEBHOOK_SECRET"]


@app.post("/langsmith/webhook")
async def receive_langsmith_webhook(request: Request, secret: str):
    if secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="invalid secret")

    payload = await request.json()

    rule_id = payload["rule_id"]
    runs = payload.get("runs", [])
    feedback_stats = payload.get("feedback_stats", {})

    # 실서비스에서는 여기서 바로 장기 작업을 하지 말고 큐에 넣는 편이 안전하다.
    for run in runs:
        print(
            {
                "rule_id": rule_id,
                "run_id": run["id"],
                "trace_id": run.get("trace_id"),
                "feedback_keys": list(feedback_stats.keys()),
            }
        )

    return {"accepted": len(runs)}
```

로컬 실행:

```bash
uvicorn webhook_app:app --reload --port 8000
```

LangSmith rule의 webhook URL은 예를 들어 아래처럼 둘 수 있다.

```text
https://api.example.com/langsmith/webhook?secret=YOUR_SHARED_SECRET
```

공식 문서상 LangSmith는 webhook body 자체를 서명해 주는 방식이 아니라, URL 비밀값이나 커스텀 헤더를 써서 엔드포인트를 보호하는 방향을 안내한다.

## 5. annotation queue와 같이 쓰면 사람 검토 루프까지 닫을 수 있다

automation rule의 장점은 단순 알림보다 "후속 작업을 같은 관측 체계 안에 남긴다"는 데 있다.

예를 들어 아래 조합이 실용적이다.

1. `error = true` 또는 `feedback_score < 0.5` 인 run을 annotation queue로 보낸다
2. 리뷰어가 correctness, notes를 남긴다
3. 반복되는 실패 유형만 dataset으로 승격하거나 evaluator 개선 대상으로 삼는다

이미 annotation queue를 쓰고 있다면 이번 주제에서 중요한 연결점은 이것이다.

- rule은 queue를 채우는 자동 분류기
- queue는 사람이 실제 원인을 판정하는 작업대
- webhook은 LangSmith 바깥 시스템과 이어 붙이는 출구

즉 셋을 한꺼번에 넣더라도 역할을 섞지 않는 편이 운영이 덜 꼬인다.

## 6. backfill과 sampling은 작게 시작하는 편이 안전하다

automation rule 생성 시 문서 기준으로 sampling rate와 "Apply to past runs" backfill 옵션을 줄 수 있다.  
둘 다 강력하지만 초반에 과하게 쓰면 잡음이 많아진다.

개인적으로는 아래 순서가 가장 덜 위험하다.

1. 새 production run만 대상으로 rule을 만든다
2. sampling rate를 0.05~0.2 정도로 작게 시작한다
3. 로그를 보면서 false positive를 줄인다
4. 괜찮아지면 sampling을 올리거나, 필요한 rule만 backfill한다

특히 webhook rule을 처음부터 과거 run까지 대량 backfill하면 외부 시스템에 한꺼번에 부하를 줄 수 있다.

## 자주 틀리는 점

### 1. evaluator와 webhook을 같은 rule에 넣고 점수를 기대하면 안 된다

현재 공식 문서 기준으로 같은 rule 안에서는 webhook이 evaluation보다 먼저 실행된다.  
점수가 필요하면 evaluator rule과 webhook rule을 분리하고, webhook rule에 feedback filter를 걸어야 한다.

### 2. filter 기준 없이 에러 여부만 보면 운영 맥락이 부족하다

에러 run 자체는 유용하지만, feature, tenant, channel 같은 metadata가 없으면 나중에 왜 실패했는지 운영적으로 묶어 보기 어렵다.  
tracing 시점 분류 정보가 나중에 rule 품질을 좌우한다.

### 3. webhook에서 무거운 동기 작업을 하면 실패율이 올라간다

5초 제한 때문에 티켓 생성, 장문 요약, 외부 API 연쇄 호출을 한 번에 처리하면 timeout이 나기 쉽다.  
빠르게 검증하고 내부 큐로 넘기는 구조가 더 안전하다.

### 4. sampling rate를 1.0으로 바로 두면 사람 검토 큐가 금방 포화된다

초기에는 운영 품질 감시보다 rule 정확도 보정이 먼저다.  
queue backlog가 쌓이면 결국 아무도 안 보게 되므로 작은 샘플로 시작하는 편이 낫다.

### 5. backfill 결과가 바로 보이지 않는다고 rule이 실패한 것은 아니다

공식 문서 기준으로 backfill은 background job으로 처리된다.  
즉 생성 직후 traces나 queue 변화가 바로 안 보여도 automation logs에서 진행 상태를 먼저 확인해야 한다.

## 추천 운영 흐름

개인적으로는 아래 정도면 대부분의 LangSmith 운영 자동화를 무리 없이 시작할 수 있다.

1. tracing project를 기능 단위로 나눈다
2. tags와 metadata를 먼저 정리한다
3. Rule A로 online evaluator를 붙인다
4. Rule B로 낮은 점수 run만 webhook이나 annotation queue로 보낸다
5. queue 리뷰 결과를 dataset/evaluator 개선으로 다시 연결한다

핵심은 "모든 후속 처리를 한 rule에 욱여넣지 말고, 평가와 후속 액션의 의존성을 filter로 명시한다"는 점이다.  
이 원칙만 지켜도 LangSmith automation은 꽤 안정적으로 굴러간다.

## 참고 자료

- [Set up automation rules](https://docs.langchain.com/langsmith/rules)
- [Configure webhook notifications for rules](https://docs.langchain.com/langsmith/webhooks)
- [LangSmith Evaluation](https://docs.langchain.com/langsmith/evaluation)
- [Set up online evaluators](https://docs.langchain.com/langsmith/online-evaluations)
- [How to define a code evaluator](https://docs.langchain.com/langsmith/code-evaluator)
- [Use annotation queues](https://docs.langchain.com/langsmith/annotation-queues)
