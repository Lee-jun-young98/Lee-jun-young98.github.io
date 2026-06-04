---
title: "LangSmith annotation queue로 사람 검토 흐름 만들기"
description: "LangSmith에서 annotation queue와 feedback config를 써서 사람이 직접 run을 검토하는 평가 흐름을 만들고 Python SDK로 큐를 구성하는 방법을 정리한 실전 노트"
date: 2026-06-04
tags:
  - langsmith
  - evaluation
  - human-feedback
  - python
aliases:
  - "/blog/langsmith-annotation-queues-sdk"
---

# LangSmith annotation queue로 사람 검토 흐름 만들기

LangSmith tracing과 offline evaluation을 붙이고 나면 다음으로 자주 부딪히는 문제가 있다.  
"실패한 run 몇 개만 사람이 직접 빠르게 보고 싶다", "좋은 답변과 나쁜 답변 기준을 팀 공통 rubric으로 굳히고 싶다", "리뷰하면서 바로 dataset 후보도 모으고 싶다" 같은 요구다.

이럴 때 LangSmith의 annotation queue가 실용적이다.  
trace를 그냥 흩어진 로그로 보지 않고, 사람이 검토해야 할 run만 모아 리뷰 순서를 만들고 점수 기준을 고정할 수 있다.

이번 글에서는 공식 문서 기준으로 아래 흐름만 실전 위주로 정리한다.

- feedback config를 재사용 가능한 평가 스키마로 정의하기
- annotation queue를 Python SDK로 만들고 rubric 붙이기
- 최근 실패 run을 큐에 넣어 사람이 검토할 작업 목록 만들기
- queue 설계에서 자주 생기는 함정 피하기

## 언제 이 방식이 특히 좋은가

아래 상황이면 annotation queue를 먼저 고려할 만하다.

- 온라인 평가 점수만으로는 왜 실패했는지 부족해서 사람이 직접 판정해야 한다
- 팀원이 같은 기준으로 accuracy, pass/fail, note를 남기게 만들고 싶다
- 에러 run, 낮은 유저 점수 run, 특정 feature 태그 run만 모아서 리뷰하고 싶다
- 리뷰한 run을 나중에 dataset이나 evaluator 개선으로 다시 연결하고 싶다

반대로 "숫자 점수만 자동으로 붙이면 충분하다"면 queue보다 online evaluator나 automation rule부터 보는 편이 낫다.

## 사전 준비

Python SDK 예시는 `langsmith`만 있으면 된다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith
```

필수 환경 변수는 보통 이 정도다.

```bash
export LANGSMITH_API_KEY="ls__your_key"
export LANGSMITH_ENDPOINT="https://api.smith.langchain.com"
```

PowerShell에서는:

```powershell
$env:LANGSMITH_API_KEY="ls__your_key"
$env:LANGSMITH_ENDPOINT="https://api.smith.langchain.com"
```

EU 또는 다른 리전을 쓰는 계정이면 `LANGSMITH_ENDPOINT`를 계정 리전에 맞춰 바꿔야 한다.

## 1. feedback config를 먼저 고정하기

LangSmith는 사람 평가를 세 층으로 나눈다.

- feedback config: 조직 전체에서 재사용하는 평가 키 정의
- queue rubric item: 특정 queue에서 어떤 키를 어떻게 보이게 할지 정하는 층
- feedback: 실제 리뷰어가 run에 남긴 점수와 코멘트

실무에서는 queue를 만들기 전에 팀 공통 feedback key를 먼저 정해 두는 편이 낫다.  
예를 들어 `accuracy`, `correctness`, `notes`를 여러 queue에서 반복 사용할 수 있다.

```python
from langsmith import Client

client = Client()

client.create_feedback_config(
    "accuracy",
    feedback_config={
        "type": "continuous",
        "min": 0.0,
        "max": 1.0,
    },
)

client.create_feedback_config(
    "correctness",
    feedback_config={
        "type": "categorical",
        "categories": ["pass", "fail"],
    },
)

client.create_feedback_config(
    "notes",
    feedback_config={
        "type": "freeform",
    },
)
```

핵심 포인트는 두 가지다.

- 같은 key로 같은 설정을 다시 만들면 기존 config를 재사용한다
- 같은 key인데 다른 설정으로 만들면 오류가 난다

그래서 팀에서 이미 쓰는 `accuracy` 의미가 있는데 다른 queue에서 0~5 척도로 다시 만들려 하면 충돌이 생긴다.

## 2. queue를 만들면서 rubric을 붙이기

feedback config가 준비되면 queue는 비교적 단순하다.  
queue 자체에는 "이 큐에서 리뷰어가 뭘 보게 할지"를 rubric item으로 넣는다.

```python
from langsmith import Client

client = Client()

queue = client.create_annotation_queue(
    name="support-failures-review",
    description="고객지원 봇 실패 run을 사람이 검토하는 큐",
    rubric_instructions=(
        "각 답변을 정확성과 통과 여부로 평가하고, "
        "실패 원인이 보이면 notes에 짧게 남긴다."
    ),
    rubric_items=[
        {
            "feedback_key": "accuracy",
            "description": "답변이 질문 의도와 사실에 얼마나 맞는가?",
            "score_descriptions": {
                "0": "핵심이 틀리거나 무관함",
                "1": "사실과 의도를 모두 충족함",
            },
            "is_required": True,
        },
        {
            "feedback_key": "correctness",
            "description": "출시 기준에서 통과 가능한가?",
            "value_descriptions": {
                "pass": "바로 허용 가능",
                "fail": "수정이 필요함",
            },
            "is_required": True,
        },
        {
            "feedback_key": "notes",
            "description": "문제 원인, 누락 문맥, 개선 아이디어",
            "is_required": False,
        },
    ],
)

print(queue.id)
```

이 구조가 좋은 이유는 평가 스키마와 queue별 안내 문구를 분리할 수 있기 때문이다.  
예를 들어 `accuracy`라는 key는 그대로 두고도, support queue와 RAG queue에서 설명 문구만 다르게 줄 수 있다.

## 3. 최근 실패 run만 골라 queue에 넣기

queue만 만들어 놓으면 비어 있으므로, 실제로는 어떤 run을 넣을지 정해야 한다.  
가장 단순한 패턴은 tracing project에서 최근 root run을 조회한 뒤 일부를 queue에 추가하는 방식이다.

```python
from datetime import datetime, timedelta, timezone

from langsmith import Client

client = Client()

project_name = "customer-support-prod"
queue_name = "support-failures-review"

queue = next(client.list_annotation_queues(name=queue_name, limit=1))

runs = list(
    client.list_runs(
        project_name=project_name,
        is_root=True,
        error=True,
        start_time=datetime.now(timezone.utc) - timedelta(days=1),
        limit=20,
    )
)

run_ids = [run.id for run in runs]

if run_ids:
    client.add_runs_to_annotation_queue(queue.id, run_ids=run_ids)
    print(f"Queued {len(run_ids)} runs")
else:
    print("No failed runs found")
```

이 예시는 최근 24시간 동안 에러가 난 root run만 최대 20개 집어넣는다.  
실제로는 여기에 project 이름, metadata, tags, 또는 trace filter를 더해 특정 기능군만 뽑는 식으로 좁혀 가면 된다.

## 4. queue를 수동 운영할지 automation과 연결할지 결정하기

처음에는 위처럼 SDK 배치 스크립트로 queue를 채워도 충분하다.  
하지만 운영 트래픽에서 계속 같은 패턴을 잡아야 한다면 automation rule과 연결하는 편이 덜 번거롭다.

공식 문서 기준으로 automation rule은 다음 같은 작업을 할 수 있다.

- 조건에 맞는 trace를 annotation queue에 추가
- dataset에 추가
- webhook 호출
- 데이터 보존 기간 연장

예를 들어 아래 같은 흐름이 실용적이다.

1. tracing에서 `user_score < 0.5` 또는 error run을 감지한다
2. automation rule이 해당 run을 annotation queue로 보낸다
3. 사람이 queue에서 판정하고 notes를 남긴다
4. 반복 실패 유형을 dataset과 evaluator 개선으로 다시 연결한다

즉 queue는 평가의 끝이 아니라, 운영 로그를 개선 작업으로 바꾸는 중간 허브에 가깝다.

## 자주 헷갈리는 점

### 1. feedback config와 queue rubric을 같은 것으로 보면 안 된다

`accuracy`라는 key를 정의하는 것과, 특정 queue에서 그 key를 어떤 설명과 필수 여부로 보여주는 것은 별개다.  
조직 공통 metric과 queue별 안내 문구를 섞어 버리면 나중에 관리가 꼬인다.

### 2. root run과 child run을 섞어 담으면 리뷰 기준이 흔들린다

문서 기준으로 queue에는 intermediate run도 넣을 수 있지만, 처음부터 root run과 tool/llm child run을 섞어 넣으면 리뷰어가 무엇을 평가해야 하는지 헷갈리기 쉽다.  
초기 운영에서는 `is_root=True`로 통일하는 편이 안전하다.

### 3. 동일 key 의미를 queue마다 바꾸면 비교가 어려워진다

한 queue에서는 `accuracy=사실성`, 다른 queue에서는 `accuracy=문장 자연스러움`처럼 써 버리면 나중에 aggregate가 무의미해진다.  
metric 이름보다 metric 의미를 먼저 고정해야 한다.

### 4. 큐를 만들기만 하고 reviewer workflow를 안 정하면 금방 쌓인다

queue는 backlog를 예쁘게 보여줄 뿐 자동으로 해결해 주지 않는다.  
누가 매일 몇 개를 볼지, fail이면 어디에 옮길지, notes를 어떤 수준으로 남길지를 팀 규칙으로 정해 두는 편이 좋다.

### 5. webhook과 evaluator 순서를 막연히 기대하면 안 된다

공식 webhook 문서 기준으로 하나의 automation rule 안에서는 `annotation queue -> dataset -> webhook -> evaluation` 순서로 액션이 실행된다.  
즉 같은 rule에 evaluator와 webhook을 같이 넣으면 webhook이 평가 점수보다 먼저 나갈 수 있다.

## 추천하는 최소 운영 패턴

개인적으로는 아래 조합이 가장 실용적이다.

1. tracing project를 기능 단위로 나눈다
2. `accuracy`, `correctness`, `notes` 같은 공통 feedback key를 먼저 고정한다
3. 실패 run 전용 annotation queue를 하나 만든다
4. 처음엔 SDK 스크립트나 rule로 하루치 run만 넣는다
5. 리뷰 결과가 반복되면 dataset과 evaluator를 추가한다

이렇게 가면 처음부터 복잡한 품질 체계를 만들지 않아도, 사람 검토를 구조화된 피드백 자산으로 남길 수 있다.

## 참고 자료

- [Use annotation queues](https://docs.langchain.com/langsmith/annotation-queues)
- [Manage feedback & annotation queues programmatically](https://docs.langchain.com/langsmith/annotation-queues-sdk)
- [Set up automation rules](https://docs.langchain.com/langsmith/rules)
- [Configure webhook notifications for rules](https://docs.langchain.com/langsmith/webhooks)
- [LangSmith Python Client reference](https://reference.langchain.com/python/langsmith/client/Client)
