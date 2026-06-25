---
title: "LangSmith annotation queue를 Python SDK로 운영하기"
description: "LangSmith에서 feedback config, annotation queue, add_runs_to_annotation_queue를 조합해 사람 리뷰 큐를 만드는 실전 흐름을 Python 예제로 정리한 노트"
date: 2026-06-25
tags:
  - langsmith
  - evaluation
  - python
  - human-feedback
aliases:
  - "/blog/langsmith-annotation-queue-sdk"
---

# LangSmith annotation queue를 Python SDK로 운영하기

운영 중인 LLM 앱에서 이런 상황이 자주 생깁니다.

- thumbs-down이 붙은 응답만 사람 검토 큐로 보내고 싶다
- 품질 점수를 팀 공통 기준으로 재사용하고 싶다
- UI에서 수동으로 큐를 만들기보다 코드로 설정을 버전 관리하고 싶다
- production trace를 골라 사람이 검토한 뒤 dataset이나 evaluator 개선으로 이어가고 싶다

이럴 때 LangSmith의 annotation queue를 SDK로 다루면 작업 흐름이 훨씬 명확해집니다. 핵심은 세 단계입니다.

1. 조직 공통 피드백 스키마를 `feedback config`로 정의한다
2. 특정 리뷰 목적에 맞는 `annotation queue`와 rubric을 만든다
3. `list_runs(...)`로 고른 run들을 `add_runs_to_annotation_queue(...)`로 큐에 넣는다

2026년 6월 25일 기준 공식 문서와 Python SDK 레퍼런스를 기준으로 정리했습니다. 메서드가 보이지 않으면 먼저 `langsmith` 패키지 버전을 확인하는 편이 안전합니다.

## 언제 특히 유용한가

아래 같은 운영 루프에서 annotation queue가 잘 맞습니다.

- 사용자 불만 trace를 triage 큐로 모아 원인 분류하기
- 새 프롬프트 배포 후 샘플링된 응답을 사람이 빠르게 검수하기
- evaluator를 만들기 전에 pass/fail 기준을 팀이 먼저 수집하기
- 같은 rubric으로 여러 프로젝트를 비교 평가하기

반대로 단건 trace에 메모만 남기면 되는 상황이라면 inline annotation이 더 단순할 수 있습니다.

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

## 1. 먼저 feedback config를 조직 공통 스키마로 만든다

annotation queue의 rubric은 아무 키나 바로 쓰는 구조가 아닙니다. 먼저 조직 단위에서 재사용 가능한 feedback config를 만들어야 합니다.

```python
from langsmith import Client

client = Client()

client.create_feedback_config(
    "response_accuracy",
    feedback_config={
        "type": "continuous",
        "min": 0,
        "max": 1,
    },
    is_lower_score_better=False,
)

client.create_feedback_config(
    "response_pass_fail",
    feedback_config={
        "type": "categorical",
        "categories": [
            {"value": 1, "label": "Pass"},
            {"value": 0, "label": "Fail"},
        ],
    },
)

client.create_feedback_config(
    "review_notes",
    feedback_config={"type": "freeform"},
)
```

실무에서는 보통 이렇게 나눠 두면 편합니다.

- 연속 점수: 정확도, 관련성, 톤 품질
- 범주형: pass/fail, severity, 정책 위반 여부
- 자유 입력: 사람이 남기는 보충 메모

이미 같은 config가 있으면 재사용되고, 같은 key에 다른 구성을 다시 만들려고 하면 오류가 날 수 있습니다. 공통 metric key는 팀에서 먼저 정해 두는 편이 좋습니다.

## 2. queue마다 rubric을 다르게 입힌다

feedback config가 조직 공통 스키마라면, annotation queue rubric은 "이번 큐에서 무엇을 반드시 검토할지"를 정하는 레이어입니다.

```python
from langsmith import Client

client = Client()

queue = client.create_annotation_queue(
    name="Production Triage Queue",
    description="Thumbs-down 또는 에러가 있는 응답을 사람이 재검토하는 큐",
    rubric_instructions=(
        "응답 정확도를 먼저 점검하고, 실패 원인이 보이면 notes에 짧게 남깁니다."
    ),
    rubric_items=[
        {
            "feedback_key": "response_accuracy",
            "description": "사실성과 답변 정확도를 0~1로 평가합니다.",
            "score_descriptions": {
                "0": "주요 사실 오류 또는 질문 미해결",
                "1": "정확하고 바로 사용 가능",
            },
            "is_required": True,
        },
        {
            "feedback_key": "response_pass_fail",
            "description": "최소 품질 기준 통과 여부를 표시합니다.",
            "value_descriptions": {
                "Pass": "사용자에게 그대로 보여도 무리 없음",
                "Fail": "수정 또는 재생성이 필요함",
            },
            "is_required": True,
        },
        {
            "feedback_key": "review_notes",
            "description": "실패 원인, 환각, 누락 정보 등을 적습니다.",
            "is_required": False,
        },
    ],
)

print(queue.id)
```

이 구조의 장점은 rubric 기준은 큐마다 달라도 feedback key는 공통으로 유지된다는 점입니다.  
즉 triage 큐, release review 큐, pairwise 비교 큐가 서로 다른 설명을 쓰더라도 나중에 `response_accuracy` 기준으로 집계할 수 있습니다.

## 3. 기존 queue를 수정할 때는 rubric 전체를 다시 보낸다

운영 중에 항목 하나만 추가하고 싶은 경우가 많지만, 공식 문서 기준 `update_annotation_queue(...)`는 rubric item 목록을 부분 병합하지 않고 교체합니다.

```python
from langsmith import Client

client = Client()

queue_id = "11111111-1111-1111-1111-111111111111"

client.update_annotation_queue(
    queue_id,
    rubric_instructions="정확도와 통과 여부를 먼저 보고, tone은 선택적으로 남깁니다.",
    rubric_items=[
        {
            "feedback_key": "response_accuracy",
            "is_required": True,
        },
        {
            "feedback_key": "response_pass_fail",
            "is_required": True,
        },
        {
            "feedback_key": "review_notes",
            "is_required": False,
        },
    ],
)
```

따라서 운영 스크립트에서는 보통 이렇게 처리합니다.

1. `read_annotation_queue(...)` 또는 `list_annotation_queues(...)`로 현재 상태를 읽는다
2. 유지할 rubric item까지 포함해 전체 목록을 다시 만든다
3. 그 전체 목록을 `update_annotation_queue(...)`에 넘긴다

## 4. 운영 trace를 골라 큐에 넣는다

annotation queue는 큐를 만드는 것보다 "어떤 run을 보낼지"가 더 중요합니다. 보통은 production에서 바로 전부 보내지 않고, `list_runs(...)`로 조건을 좁힌 다음 큐에 넣습니다.

아래 예시는 최근 24시간 동안의 root run 중 에러가 있거나 `thumbs_down` 피드백이 붙은 run만 골라 큐에 추가하는 흐름입니다.

```python
from datetime import datetime, timedelta, timezone
from langsmith import Client

client = Client()

queue = next(
    client.list_annotation_queues(name="Production Triage Queue"),
    None,
)
if queue is None:
    raise RuntimeError("Queue not found")

candidate_runs = client.list_runs(
    project_name="support-agent-prod",
    is_root=True,
    start_time=datetime.now(timezone.utc) - timedelta(days=1),
    filter=(
        'or('
        'neq(error, null), '
        'and(eq(feedback_key, "thumbs_down"), eq(feedback_score, 1))'
        ')'
    ),
    select=["id", "name", "start_time", "error"],
    limit=100,
)

run_ids = [run.id for run in candidate_runs]

if run_ids:
    client.add_runs_to_annotation_queue(queue.id, run_ids=run_ids)
    print(f"queued={len(run_ids)}")
else:
    print("No matching runs")
```

이 패턴이 실무에서 좋은 이유는 분명합니다.

- 큐 생성과 큐 채우기를 분리할 수 있다
- 운영 조건이 바뀌면 `list_runs(...)` 쪽만 수정하면 된다
- sampling, metadata, tags, feedback 기반 triage를 코드로 남길 수 있다

## 5. queue 존재 여부를 확인하고 재사용하는 패턴

큐를 매번 새로 만들면 이름 충돌이나 운영 혼선이 생기기 쉽습니다. 보통은 먼저 조회하고 없을 때만 생성합니다.

```python
from langsmith import Client

client = Client()

queue = next(
    client.list_annotation_queues(name="Production Triage Queue"),
    None,
)

if queue is None:
    queue = client.create_annotation_queue(
        name="Production Triage Queue",
        description="운영 불만 응답 검토 큐",
        rubric_items=[
            {"feedback_key": "response_accuracy", "is_required": True},
            {"feedback_key": "response_pass_fail", "is_required": True},
        ],
    )

print(queue.id)
```

큐 이름을 사람 친화적으로 두고, 실제 자동화 스크립트에서는 생성 후 `queue.id`를 설정 파일이나 secret-backed config에 저장해 두는 편이 더 안정적입니다.

## 6. pairwise queue와 single-run queue를 어떻게 나눌까

공식 문서 기준 LangSmith는 크게 두 종류의 annotation queue를 제공합니다.

- single-run queue: 한 run씩 보고 rubric을 채우는 검수 흐름
- pairwise annotation queue: 두 결과를 나란히 비교해 어느 쪽이 더 나은지 고르는 흐름

운영 초기에는 single-run queue부터 붙이는 편이 현실적입니다.  
왜 실패했는지 이유를 모으는 단계에서는 pass/fail, severity, notes 같은 단일 검수 항목이 먼저 필요하기 때문입니다.

반대로 프롬프트 A/B 비교나 모델 교체 검증처럼 "둘 중 어느 쪽이 더 낫나"가 핵심이면 pairwise queue가 더 맞습니다.

## 자주 틀리는 점

### 1. feedback config와 queue rubric을 같은 것으로 생각한다

`feedback config`는 조직 공통 스키마이고, `rubric_items`는 특정 큐에 붙는 표시 방식입니다.  
같은 `feedback_key`를 여러 큐에서 재사용할 수 있다는 점이 핵심입니다.

### 2. `update_annotation_queue(...)`가 부분 수정일 것이라고 착각한다

공식 문서 기준 rubric item 업데이트는 전체 교체입니다.  
기존 항목을 유지하려면 다시 포함해서 보내야 합니다.

### 3. 범주형 config에 `min`, `max`를 넣는다

categorical 타입은 `categories`가 필요하고 `min`, `max`를 두지 않습니다.  
연속 점수와 범주형 점수를 섞어 설계할 때 가장 흔히 헷갈리는 부분입니다.

### 4. 큐에 넣을 대상을 무조건 전량 적재한다

annotation queue는 사람 시간을 쓰는 작업입니다.  
`start_time`, `limit`, `tags`, `feedback`, `error` 같은 조건으로 좁혀서 넣는 편이 훨씬 운영 가능성이 높습니다.

### 5. SDK 메서드가 없는데 코드부터 복사한다

2026년 6월 25일 기준 공식 문서에는 관련 메서드가 정리되어 있지만, 로컬 환경 패키지가 오래되면 일부 메서드가 보이지 않을 수 있습니다.  
문서와 예제가 맞지 않으면 먼저 `pip show langsmith` 또는 `python -c "import langsmith; print(langsmith.__version__)"`로 버전을 확인하는 편이 낫습니다.

## 추천 운영 흐름

개인적으로는 아래 순서가 가장 무난합니다.

1. `feedback_key`를 팀 공통 언어로 먼저 정한다
2. queue는 리뷰 목적별로 나눈다
3. `list_runs(...)` 조건을 작게 시작해 소량만 큐에 넣는다
4. 사람이 남긴 notes를 바탕으로 evaluator나 prompt 개선으로 연결한다
5. 안정화되면 automation rule이나 webhook으로 큐 적재를 자동화한다

LangSmith annotation queue는 단순한 "사람이 보는 inbox"가 아니라, 운영 trace를 사람이 구조화된 데이터로 바꾸는 접점에 가깝습니다.  
이 지점을 잘 만들면 production 관찰, human feedback, dataset 구축, evaluator 개선이 한 흐름으로 이어집니다.

## 참고 자료

- [Manage feedback & annotation queues programmatically](https://docs.langchain.com/langsmith/annotation-queues-sdk)
- [Use annotation queues](https://docs.langchain.com/langsmith/annotation-queues)
- [Query traces using the SDK](https://docs.langchain.com/langsmith/export-traces)
- [Set up automation rules](https://docs.langchain.com/langsmith/rules)
- [Client reference](https://reference.langchain.com/python/langsmith/client/Client)
- [add_runs_to_annotation_queue reference](https://reference.langchain.com/python/langsmith/client/Client/add_runs_to_annotation_queue)
