---
title: "LangSmith custom run ID로 feedback과 조회 흐름 안정적으로 연결하기"
description: "LangSmith에서 uuid7 기반 custom run ID를 미리 만들고, feedback 수집·재조회·종료 시 flush까지 안정적으로 연결하는 Python 패턴 정리"
date: 2026-07-05
tags:
  - langsmith
  - observability
  - python
  - feedback
aliases:
  - "/blog/langsmith-custom-run-id-feedback"
---

# LangSmith custom run ID로 feedback과 조회 흐름 안정적으로 연결하기

LangSmith tracing을 붙여 두면 보통은 run ID를 자동 생성해도 충분하다.  
하지만 운영 단계에서는 다음처럼 "run ID를 실행 전에 알고 있어야 하는" 순간이 꽤 자주 나온다.

- API 응답과 함께 run ID를 프론트엔드로 내려 보내고 싶다
- 사용자 thumbs up/down을 나중에 정확히 같은 run에 붙이고 싶다
- 외부 시스템의 request ID와 LangSmith run을 1:1로 대응시키고 싶다
- 재시도 시 중복 추적을 줄이기 위해 run ID를 직접 통제하고 싶다

LangSmith 공식 문서에서는 이런 경우 custom run ID를 쓰라고 안내한다.  
특히 Python 기준으로는 `langsmith_extra={"run_id": ...}` 또는 `trace(..., run_id=...)` 패턴이 가장 실용적이다.

이 글에서는 다음만 짧게 정리한다.

- 왜 `uuid7()`이 권장되는지
- `@traceable` 호출 시점에 run ID를 주입하는 방법
- `trace(...)` context manager에 run ID를 직접 넣는 방법
- feedback 수집과 재조회 흐름을 run ID 기준으로 연결하는 방법
- 프로세스 종료 전에 `flush()`가 필요한 이유

## 언제 유용한가

다음 상황이면 custom run ID를 먼저 고려하는 편이 좋다.

- 별도 백엔드 요청 ID, 주문 ID, 세션 ID와 trace를 연결해야 하는 경우
- 사용자 평가를 프론트엔드에서 받아 나중에 서버가 LangSmith에 적재하는 경우
- run 생성 직후 바로 feedback, 링크, 디버그 버튼을 노출해야 하는 경우
- worker, queue, webhook처럼 비동기 시스템에서 run correlation이 중요한 경우

반대로 단순 실험 코드이고 추적을 UI에서만 볼 거라면 자동 run ID로도 충분하다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith openai
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_TRACING="true"
$env:LANGSMITH_PROJECT="support-agent-prod"
$env:OPENAI_API_KEY="sk-your-key"
```

## 1. custom run ID는 `uuid7()`로 만드는 편이 안전하다

LangSmith 공식 문서 기준으로 custom run ID에는 UUID v7 사용이 권장된다.  
이유는 UUID v7이 timestamp를 포함해서 trace 안에서 시간 순서가 자연스럽게 유지되기 때문이다.

문서 기준 지원 버전은 다음과 같다.

- Python SDK `0.4.43+`
- JS/TS SDK `0.3.80+`

Python에서는 이렇게 시작하면 된다.

```python
from langsmith import uuid7

run_id = uuid7()
print(run_id)
```

외부 시스템에서 이미 UUID v7을 쓰고 있다면 그 값을 그대로 LangSmith run ID로 써도 된다.

## 2. `@traceable` 함수는 호출 시점에 `langsmith_extra["run_id"]`로 연결한다

실무에서 가장 자주 쓰는 패턴이다.  
run ID를 먼저 만들고, traced function 호출 시점에 넘긴다.

```python
from langsmith import Client, traceable, uuid7

client = Client()


@traceable(name="answer_customer", run_type="chain")
def answer_customer(question: str) -> str:
    return f"answer for: {question}"


run_id = uuid7()
result = answer_customer(
    "환불 조건을 요약해 주세요.",
    langsmith_extra={"run_id": run_id},
)

print("run_id =", run_id)
print("result =", result)
```

이 패턴의 장점은 분명하다.

- API 응답에 `run_id`를 같이 내려 주기 쉽다
- 이후 `read_run(run_id)`나 feedback 적재에서 같은 식별자를 재사용할 수 있다
- 외부 request ID 저장소와 LangSmith trace를 느슨하게 연결하기 좋다

## 3. manual span을 쓰면 `trace(..., run_id=...)`로 직접 지정할 수 있다

LangSmith SDK를 조금 더 수동적으로 쓰는 코드라면 `trace` context manager 쪽이 더 편하다.

```python
from langsmith import trace, uuid7

run_id = uuid7()

with trace(
    name="support_pipeline",
    run_type="chain",
    run_id=run_id,
    inputs={"question": "배송 지연 보상 기준이 뭐야?"},
) as run:
    result = {"answer": "3일 이상 지연 시 포인트 보상이 가능합니다."}
    run.end(outputs=result)

print("run_id =", run_id)
```

이 방식은 다음처럼 유용하다.

- LangChain이 아닌 순수 Python 코드에 tracing을 얹을 때
- parent/child span을 더 명시적으로 제어하고 싶을 때
- custom ingestion 흐름을 단계별로 나눠 기록하고 싶을 때

## 4. custom run ID를 알면 feedback 연결이 훨씬 단순해진다

공식 문서에서 custom run ID의 대표 use case로 바로 feedback 연결을 든다.  
특히 Python SDK의 `create_feedback()`는 `trace_id=`를 함께 주면 background ingestion을 활용할 수 있어서 저지연 경로에 유리하다.

아래 예시는 traced run을 만들고, 같은 run ID에 사용자 점수를 붙이는 흐름이다.

```python
from langsmith import Client, traceable, uuid7

client = Client()


@traceable(name="draft_answer", run_type="chain")
def draft_answer(question: str) -> str:
    return "환불은 결제 후 7일 이내에 가능합니다."


run_id = uuid7()
answer = draft_answer(
    "환불 가능 기간이 며칠이야?",
    langsmith_extra={"run_id": run_id},
)

# root run에 바로 feedback 연결
client.create_feedback(
    key="user_score",
    score=1,
    run_id=run_id,
    trace_id=run_id,
    comment="정확하고 짧게 답변함",
)

print(answer)
```

운영 흐름에서는 보통 이렇게 쓴다.

1. 서버가 `run_id`를 먼저 생성한다
2. traced 함수 호출에 `run_id`를 넣는다
3. API 응답과 함께 `run_id`를 프론트엔드에 전달한다
4. 사용자가 남긴 점수나 코멘트를 나중에 같은 `run_id`로 적재한다

## 5. 종료 직전에는 `flush()`를 고려해야 한다

LangSmith 공식 문서 기준으로 tracing은 background thread에서 비동기로 전송된다.  
그래서 짧게 끝나는 스크립트나 worker에서는 프로세스가 먼저 종료되어 trace가 덜 올라갈 수 있다.

SDK standalone 코드라면 종료 전에 `flush()`를 한 번 넣는 편이 안전하다.

```python
import asyncio
from langsmith import Client, traceable

client = Client()


@traceable(client=client)
async def run_job():
    return "done"


async def main():
    try:
        await run_job()
    finally:
        await client.flush()


asyncio.run(main())
```

CLI 스크립트, cron job, queue worker처럼 실행 시간이 짧은 환경에서는 이 한 줄 차이가 크다.

## 추천 패턴

개인적으로는 아래 흐름이 가장 무난하다.

1. request가 들어오면 `uuid7()`으로 `run_id`를 만든다
2. `langsmith_extra={"run_id": run_id}`로 traced function을 실행한다
3. API 응답, 로그, DB 이벤트에 같은 `run_id`를 남긴다
4. 사용자 평가나 후처리 이벤트를 같은 `run_id`에 연결한다
5. 짧게 끝나는 worker라면 마지막에 `flush()`를 호출한다

이렇게 하면 "어느 평가가 어느 답변에 붙은 건지"가 운영 중에 훨씬 덜 헷갈린다.

## 자주 틀리는 점

### 1. run ID를 매 실행마다 알 수 없는 값으로 남겨 놓고 나중에 feedback을 맞추려 한다

UI에서 복사해 붙이는 방식으로도 가능하지만 운영 자동화에는 맞지 않는다.  
feedback, audit, request correlation이 필요하면 run ID를 미리 만드는 편이 낫다.

### 2. UUID v7 대신 시간 정렬이 안 되는 임의 문자열을 쓴다

공식 문서 기준 권장안은 UUID v7이다.  
특별한 이유가 없다면 `uuid7()`을 그대로 쓰는 편이 안전하다.

### 3. 서로 다른 논리적 요청에 같은 run ID를 재사용한다

run ID는 "나중에 다시 같은 run을 찾기 위한 식별자"다.  
서로 다른 요청에서 같은 값을 재사용하면 feedback과 조회가 뒤섞인다.

### 4. 짧게 끝나는 프로세스에서 trace 전송 완료 전에 종료한다

특히 배치 스크립트, serverless 함수, worker에서는 `flush()` 누락이 추적 누락으로 이어질 수 있다.

## 참고 자료

- [Custom instrumentation: Specify a custom run ID](https://docs.langchain.com/langsmith/annotate-code)
- [Log user feedback using the SDK](https://docs.langchain.com/langsmith/attach-user-feedback)
- [Trace without setting environment variables](https://docs.langchain.com/langsmith/trace-without-env-vars)
