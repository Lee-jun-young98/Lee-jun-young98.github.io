---
title: "LangSmith create_feedback와 list_feedback으로 사용자 평가 수집하고 분석하기"
description: "LangSmith에서 create_feedback(), list_feedback(), list_runs()를 조합해 운영 중인 사용자 평가를 저장하고 다시 분석하는 실전 흐름을 Python 예제로 정리한 한국어 학습 노트"
date: 2026-06-29
tags:
  - langsmith
  - feedback
  - observability
  - python
aliases:
  - "/blog/langsmith-create-feedback-list-feedback"
---

# LangSmith create_feedback와 list_feedback으로 사용자 평가 수집하고 분석하기

LangSmith tracing을 붙이고 나면 다음 단계에서 자주 막힙니다.

- thumbs up/down, 별점, 짧은 코멘트를 trace에 구조적으로 남기고 싶다
- annotation queue를 만들기 전에 어떤 실패가 실제로 들어오는지 먼저 보고 싶다
- 낮은 점수 trace만 다시 모아 evaluator, prompt, retrieval 개선으로 연결하고 싶다
- 프론트엔드 수집과 내부 운영자 수집을 같은 feedback key 체계로 묶고 싶다

이럴 때 핵심은 `create_feedback()`으로 평가를 남기고, `list_feedback()`으로 다시 읽어 운영 루프를 만드는 것입니다.  
presigned token은 브라우저 수집 채널에 가깝고, annotation queue는 사람 검수 워크플로우에 가깝습니다. 그 사이에서 실제 품질 데이터를 쌓고 분석하는 기본 축은 feedback API입니다.

2026년 6월 29일 기준 LangSmith 공식 문서와 Python SDK 기준으로, 이 글에서는 아래 흐름만 실무적으로 정리합니다.

- root run과 child run에 피드백을 어떻게 나눠 붙일지
- `create_feedback()`으로 점수, 코멘트, correction, metadata를 남기는 법
- `list_feedback()`으로 최근 저품질 사례만 다시 읽는 법
- feedback을 `list_runs()` 조회와 연결해 triage 스크립트로 쓰는 법

## 언제 특히 유용한가

아래 같은 상황이면 이 패턴이 잘 맞습니다.

- 운영 서비스에서 thumbs down 원인을 매일 점검하고 싶다
- retrieval/tool 품질과 최종 답변 만족도를 분리해 저장하고 싶다
- evaluator를 만들기 전에 사람 평가 분포를 먼저 보고 싶다
- 나중에 annotation queue나 dataset 개선으로 이어질 수 있게 feedback key를 고정하고 싶다

반대로 브라우저나 모바일 앱이 직접 LangSmith에 피드백을 보내야 한다면 `create_presigned_feedback_token()` 쪽이 더 적합합니다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_PROJECT="support-agent-prod"
```

기본 클라이언트:

```python
from langsmith import Client

client = Client()
```

## 1. 먼저 피드백 key를 작게 고정한다

운영 초반에는 피드백 key를 너무 많이 늘리기보다 아래 정도로 작게 시작하는 편이 좋습니다.

- `user_score`: 최종 답변 만족도
- `retrieval_correctness`: 검색/근거 품질
- `hallucination_flag`: 환각 여부
- `review_notes`: 사람이 남기는 짧은 메모

핵심은 "어디에 붙은 평가인지"를 key 이름만 봐도 구분할 수 있게 만드는 것입니다.  
최종 답변 만족도와 child run 검색 품질을 둘 다 `score` 하나로 저장하면 나중에 집계가 거의 불가능해집니다.

## 2. root run과 child run을 구분해 피드백을 남긴다

사용자 만족도는 보통 root run에, retrieval/tool 단계 품질은 child run에 붙이는 편이 분석하기 쉽습니다.

```python
from langsmith import Client

client = Client()

trace_id = "11111111-1111-1111-1111-111111111111"
retrieval_run_id = "22222222-2222-2222-2222-222222222222"

client.create_feedback(
    key="user_score",
    score=0,
    trace_id=trace_id,
    comment="답변은 자연스러웠지만 환불 조건이 틀렸습니다.",
    metadata={"surface": "web", "locale": "ko-KR"},
)

client.create_feedback(
    key="retrieval_correctness",
    score=0,
    run_id=retrieval_run_id,
    trace_id=trace_id,
    comment="관련 없는 문서를 근거로 사용했습니다.",
    metadata={"retriever": "kb-v2"},
)
```

실무에서 중요한 점은 두 가지입니다.

- 최종 경험 평가는 root run에 남긴다
- 원인 분석용 평가는 child run에 따로 남긴다

이렇게 나눠야 "사용자는 불만인데 retrieval이 문제였는지, generation이 문제였는지"를 다시 볼 수 있습니다.

## 3. correction과 value를 함께 쓰면 정성 평가가 덜 모호해진다

숫자 점수만 남기면 왜 낮은 점수였는지 다시 사람이 읽어야 하는 경우가 많습니다.  
LangSmith feedback에는 `value`, `comment`, `correction`도 같이 남길 수 있습니다.

```python
from langsmith import Client

client = Client()

client.create_feedback(
    key="answer_grade",
    score=0,
    value="fail",
    correction={
        "expected_policy": "전자책은 다운로드 후 환불이 제한됩니다.",
        "should_mention": ["디지털 상품", "다운로드 이후 제한"],
    },
    trace_id="11111111-1111-1111-1111-111111111111",
    comment="전자책과 실물 상품 정책을 혼동했습니다.",
    metadata={"reviewer": "ops-bot"},
)
```

개인적으로는 아래 기준이 무난합니다.

- `score`: 집계용 숫자
- `value`: pass/fail, thumbs_up/down 같은 범주형 상태
- `comment`: 사람이 읽는 짧은 설명
- `correction`: 나중에 재학습이나 evaluator 개선에 쓸 구조화된 정답 힌트

## 4. 최근 저품질 사례만 `list_feedback()`으로 다시 읽는다

운영에서는 모든 feedback을 다 읽기보다 최근 며칠의 낮은 점수만 다시 보는 경우가 많습니다.

```python
from datetime import datetime, timedelta, timezone
from langsmith import Client

client = Client()

recent_feedback = client.list_feedback(
    key="user_score",
    score=0,
    created_after=datetime.now(timezone.utc) - timedelta(days=3),
)

for fb in recent_feedback:
    print(
        fb.id,
        fb.trace_id,
        fb.run_id,
        fb.score,
        fb.comment,
        fb.metadata,
    )
```

이 흐름은 아래 같은 질문에 바로 연결됩니다.

- 최근 3일 동안 thumbs down이 몇 건이었나
- 특정 locale이나 surface에서만 점수가 낮은가
- user_score가 낮은데 retrieval_correctness도 같이 낮았나

문서와 SDK 버전에 따라 `list_feedback()`에서 제공되는 필터 인자 이름이 달라질 수 있으니, 로컬 패키지가 오래되면 먼저 `Client` 레퍼런스와 설치 버전을 같이 확인하는 편이 안전합니다.

## 5. feedback과 trace 조회를 연결해 triage 스크립트를 만든다

실제로는 feedback만 보면 맥락이 부족하고, trace만 보면 왜 나빴는지 모를 때가 많습니다.  
그래서 보통 `list_feedback()`으로 대상을 고르고 `list_runs()` 또는 `read_run()`으로 상세 trace를 다시 읽습니다.

```python
from datetime import datetime, timedelta, timezone
from langsmith import Client

client = Client()

feedback_items = list(
    client.list_feedback(
        key="user_score",
        score=0,
        created_after=datetime.now(timezone.utc) - timedelta(days=1),
    )
)

trace_ids = [str(item.trace_id) for item in feedback_items if item.trace_id]

if trace_ids:
    runs = client.list_runs(
        project_name="support-agent-prod",
        run_ids=trace_ids,
        select=["id", "name", "start_time", "latency", "error", "inputs", "outputs"],
    )

    for run in runs:
        print(run.id)
        print(run.inputs)
        print(run.outputs)
        print("-" * 40)
```

이 패턴을 잡아두면 다음 자동화가 쉬워집니다.

- 낮은 점수 trace만 Slack 알림으로 보내기
- 특정 feedback key가 붙은 run만 annotation queue에 넣기
- 실패 사례를 dataset example로 다시 정리하기

## 6. 운영자 평가와 사용자 평가를 metadata로 구분한다

같은 `user_score`라도 누가 남겼는지 구분하지 않으면 지표가 섞이기 쉽습니다.

```python
from langsmith import Client

client = Client()

client.create_feedback(
    key="user_score",
    score=1,
    trace_id="11111111-1111-1111-1111-111111111111",
    metadata={
        "source": "human-review",
        "reviewer_team": "support-qa",
        "app_version": "2026.06.29",
    },
)
```

실무에서는 보통 아래 정도를 `metadata`에 남기면 충분합니다.

- `source`: end-user, human-review, auto-evaluator
- `surface`: web, mobile, admin
- `locale`: ko-KR, en-US
- `app_version` 또는 `prompt_version`

이렇게 해 두면 나중에 feedback 분포가 깨졌을 때 원인을 훨씬 빨리 좁힐 수 있습니다.

## 자주 틀리는 점

### 1. root run과 child run 평가를 같은 key로 뒤섞는다

최종 만족도와 retrieval 품질은 서로 다른 질문입니다.  
분리하지 않으면 낮은 점수가 어느 단계 문제인지 알기 어렵습니다.

### 2. 점수만 남기고 comment나 correction을 전혀 안 남긴다

숫자만 있으면 집계는 되지만 개선 포인트가 약합니다.  
운영 초반일수록 짧은 `comment`나 구조화된 `correction`이 훨씬 가치가 큽니다.

### 3. 브라우저 수집에도 바로 `create_feedback()`만 쓰려 한다

클라이언트가 LangSmith API 키를 직접 가지면 안 됩니다.  
브라우저/모바일 수집은 presigned feedback token 패턴으로 분리하는 편이 맞습니다.

### 4. 운영자 평가와 자동 evaluator 결과를 같은 집계로 섞는다

둘 다 `score=0/1`이라도 의미가 다릅니다.  
`metadata["source"]` 같은 구분값을 초반부터 남겨야 나중에 깨끗하게 분석할 수 있습니다.

### 5. feedback만 보고 trace 상세를 다시 안 읽는다

실패 원인 분류는 결국 trace 문맥이 필요합니다.  
낮은 점수 목록을 만든 뒤 `read_run(..., load_child_runs=True)`나 `list_runs()`로 다시 연결하는 흐름이 실무에서는 거의 필수입니다.

## 추천 운영 흐름

개인적으로는 아래 순서가 가장 무난합니다.

1. `user_score`, `retrieval_correctness`, `review_notes` 정도로 key를 작게 시작한다
2. root run 만족도와 child run 품질을 분리해서 저장한다
3. `metadata`에 source, surface, locale 정도를 같이 남긴다
4. 매일 `list_feedback()`으로 낮은 점수만 다시 읽는다
5. 필요한 trace만 `list_runs()` 또는 `read_run()`으로 상세 조회한다
6. 반복되는 실패 유형이 보이면 annotation queue, evaluator, dataset 개선으로 연결한다

LangSmith feedback API는 단순한 "좋아요 버튼 저장"이 아니라, production trace를 사람이 해석 가능한 품질 데이터로 바꾸는 접점에 가깝습니다.  
이 지점을 먼저 정리해 두면 이후의 annotation queue, online eval, regression dataset 흐름이 훨씬 자연스럽게 이어집니다.

## 참고 자료

- [Log user feedback using the SDK](https://docs.langchain.com/langsmith/attach-user-feedback)
- [Feedback data format](https://docs.langchain.com/langsmith/feedback-data-format)
- [Collect feedback with presigned URLs](https://docs.langchain.com/langsmith/presigned-feedback-tokens)
- [Manage feedback and annotation queues programmatically](https://docs.langchain.com/langsmith/annotation-queues-sdk)
- [Query traces using the SDK](https://docs.langchain.com/langsmith/export-traces)
- [Client reference](https://reference.langchain.com/python/langsmith/client/Client)
