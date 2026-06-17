---
title: "LangSmith annotation queue rubric을 코드로 관리하기"
description: "LangSmith에서 feedback config와 annotation queue rubric을 Python SDK로 선언하고, 운영 trace triage 흐름에 연결할 때 알아둘 점을 정리한 실전 노트"
date: 2026-06-17
tags:
  - langsmith
  - feedback
  - human-in-the-loop
  - python
aliases:
  - "/blog/langsmith-annotation-queue-rubric-sdk"
---

# LangSmith annotation queue rubric을 코드로 관리하기

LangSmith를 운영에 붙이고 나면 곧 이런 요구가 생긴다.

- 사람이 봐야 하는 trace를 큐로 모으고 싶다
- annotator마다 다른 기준으로 채점해서 점수가 들쭉날쭉하다
- queue 설정을 UI에서만 바꾸다 보니 staging과 production 기준이 어긋난다
- 나중에 queue rubric을 다시 만들 때 어떤 feedback key를 썼는지 기억이 안 난다

이럴 때는 feedback config와 annotation queue rubric을 코드로 관리하는 편이 낫다.  
LangSmith 공식 문서는 feedback을 세 층으로 나눈다.

1. feedback config: 조직 전체에서 재사용하는 평가 키 스키마
2. annotation queue rubric item: 특정 queue에서 어떤 평가 키를 어떻게 보여줄지
3. feedback: 실제 annotator가 run에 남긴 점수와 메모

이번 글은 이 구조를 기준으로, Python SDK로 rubric을 선언하고 운영 triage 흐름에 연결하는 최소 패턴을 정리한다.

## 언제 이 방식이 특히 유용한가

아래 같은 상황이면 queue 설정을 코드로 잡아두는 편이 좋다.

- support bot, RAG, tool-calling agent 운영에서 품질 검수를 반복한다
- `accuracy`, `correctness`, `notes` 같은 human feedback 기준을 여러 queue에서 재사용한다
- 팀원이 늘어나면서 평가 기준을 버전 관리해야 한다
- automations로 낮은 점수 trace를 queue로 보내고, annotator가 다시 dataset이나 assertion으로 정리하는 흐름을 만들고 싶다

반대로 혼자 잠깐 실험하는 단계라면 UI에서 바로 queue를 만드는 편이 더 빠르다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
```

기본 클라이언트:

```python
from langsmith import Client

client = Client()
```

## 1. 먼저 feedback config를 조직 공통 스키마로 만든다

`create_feedback_config(...)`는 동일한 설정이 이미 있으면 기존 config를 돌려주고, 같은 key에 다른 설정이 있으면 오류를 낸다.  
그래서 배포 스크립트에 넣기 좋다.

```python
from langsmith import Client

client = Client()

client.create_feedback_config(
    "accuracy",
    feedback_config={
        "type": "continuous",
        "min": 0,
        "max": 1,
    },
    is_lower_score_better=False,
)

client.create_feedback_config(
    "correctness",
    feedback_config={
        "type": "categorical",
        "categories": [
            {"value": 1, "label": "Pass"},
            {"value": 0, "label": "Fail"},
        ],
    },
)

client.create_feedback_config(
    "notes",
    feedback_config={"type": "freeform"},
)
```

실무에서는 보통 이렇게 나눈다.

- `continuous`: 0~1, 1~5처럼 연속 점수
- `categorical`: pass/fail, positive/neutral/negative처럼 고정 선택지
- `freeform`: annotator 메모

`continuous`는 집계가 쉬워서 대시보드나 threshold에 좋고, `categorical`은 reviewer 간 기준 맞추기에 유리하다.

## 2. queue별 rubric item으로 annotator 화면을 정리한다

feedback config를 만들었다고 바로 annotator 경험이 정리되지는 않는다.  
실제 queue에서는 rubric item으로 어떤 설명을 보여줄지, 필수 입력인지, 점수별 가이드를 어떻게 줄지 다시 정한다.

```python
from langsmith import Client

client = Client()

queue = client.create_annotation_queue(
    name="Support Bot Triage",
    description="Negative feedback or suspicious answers for human review",
    rubric_instructions=(
        "정확성과 정답 여부를 먼저 판단하고, "
        "이상한 답변 패턴은 notes에 짧게 남기세요."
    ),
    rubric_items=[
        {
            "feedback_key": "accuracy",
            "description": "답변이 사용자 질문에 얼마나 정확하게 대응하는가?",
            "score_descriptions": {
                "0": "핵심 사실이 틀리거나 관련이 없다",
                "1": "핵심 사실이 정확하고 답변도 충분하다",
            },
            "is_required": True,
        },
        {
            "feedback_key": "correctness",
            "description": "최종 판단은 pass/fail로 남긴다",
            "value_descriptions": {
                "Pass": "사용자에게 그대로 보여도 되는 답변",
                "Fail": "수정 또는 재현 확인이 필요한 답변",
            },
            "is_required": True,
        },
        {
            "feedback_key": "notes",
            "description": "재현 조건, hallucination 포인트, 필요한 후속 조치",
            "is_required": False,
        },
    ],
)

print(queue.id)
```

핵심은 `feedback_key`가 반드시 기존 feedback config key와 일치해야 한다는 점이다.  
queue rubric은 스키마를 새로 만드는 곳이 아니라, 이미 만든 스키마를 queue 상황에 맞게 렌더링하는 층이다.

## 3. rubric 수정은 전체 교체라서 부분 업데이트처럼 생각하면 안 된다

`update_annotation_queue(...)`는 rubric item 일부만 덧붙이는 방식이 아니다.  
공식 문서 기준으로 전체 목록을 교체하므로, 유지할 항목까지 모두 다시 넣어야 한다.

```python
from langsmith import Client

client = Client()

client.update_annotation_queue(
    queue.id,
    rubric_items=[
        {
            "feedback_key": "accuracy",
            "description": "정확성 점수",
            "is_required": True,
        },
        {
            "feedback_key": "correctness",
            "description": "pass/fail 판단",
            "is_required": True,
        },
        {
            "feedback_key": "notes",
            "description": "리뷰어 메모",
            "is_required": False,
        },
    ],
)
```

이 제약 때문에 운영 환경에서는 queue 정의를 코드 한 군데에 모아 두는 편이 안전하다.  
UI에서 항목 하나만 고친다고 생각하고 저장했다가 기존 rubric이 빠지는 실수를 줄일 수 있다.

## 4. queue에 run을 넣는 경로는 "수동 triage"와 "자동 triage"를 분리해서 생각한다

LangSmith annotation queue 문서를 기준으로 single-run queue는 아래 경로로 채울 수 있다.

- trace 상세 화면에서 특정 intermediate run 추가
- runs table에서 여러 run 선택 후 추가
- automation rule로 조건에 맞는 trace 자동 추가
- dataset / experiment에서 annotate 흐름으로 추가

운영에서는 보통 다음처럼 역할을 나눈다.

- 사람이 즉시 확인해야 하는 이슈: queue에 자동 라우팅
- 조사 중인 특정 패턴: `list_runs(...)`로 후보를 좁힌 뒤 수동으로 queue에 보냄
- 실험 비교: pairwise queue로 별도 운영

특히 automation rule은 trace 안의 어떤 run이 조건에 맞아도 동작한다.  
공식 문서 기준으로 rule이 매치된 trace는 extended data retention으로 auto-upgrade될 수 있으므로, 비용과 retention도 같이 봐야 한다.

## 5. 운영 triage용 queue를 만들고 싶다면 automation과 짝지어 생각한다

LangSmith automation rule은 filter, sampling, action으로 구성된다.  
여기서 annotation queue 추가 액션을 걸어두면, 예를 들어 낮은 사용자 점수나 error trace를 사람 검토로 바로 보낼 수 있다.

실무적으로는 이런 분리가 무난하다.

- 1차 신호: user thumbs down, `error != null`, 특정 metadata/tag
- 2차 검토: annotation queue에서 human feedback 입력
- 3차 재사용: 수정한 run을 dataset이나 assertion으로 승격

문서 기준으로 한 rule 안에서 여러 action이 있으면 실행 순서가 정해져 있다.

1. annotation queue 추가
2. dataset 추가
3. webhook
4. online evaluator
5. custom code evaluator
6. alert

따라서 "웹훅이 evaluator 점수를 포함해야 한다" 같은 요구가 있으면, 한 rule 안에서 순서를 기대하기보다 downstream rule filter로 의존성을 명시하는 편이 안전하다.

## 6. 점수 체계는 처음부터 aggregation을 염두에 두고 고른다

feedback config를 만들 때 가장 많이 꼬이는 부분이 점수 의미다.

### `continuous`를 너무 넓게 잡는 경우

0~100 점수는 세밀해 보이지만 reviewer 간 편차가 커진다.  
운영 triage에는 0~1 또는 1~5처럼 짧은 스케일이 보통 더 낫다.

### `categorical`에서 label과 value를 헷갈리는 경우

문서 기준으로 categorical feedback은 label과 score 역할을 같이 가진다.  
annotator가 보는 것은 label이고, 집계에는 value/score가 쓰인다.  
그래서 `Pass=1`, `Fail=0`처럼 후처리하기 쉬운 값으로 두는 편이 편하다.

### `freeform`만 남기고 구조화 점수를 안 남기는 경우

메모는 유용하지만 나중에 집계와 필터링이 어렵다.  
최소 하나 이상의 structured score와 함께 쓰는 편이 좋다.

## 7. queue 리뷰는 "문제 수집"에서 끝내지 말고 dataset이나 assertion으로 닫는다

annotation queue의 실무 가치는 단순 검토 화면이 아니라, 후속 개선 루프에 있다.

- annotator가 corrected output을 붙여 dataset 예제로 승격
- assertion을 적어 future offline evaluation 기준으로 재사용
- `notes`를 바탕으로 evaluator prompt나 guardrail 규칙 수정

single-run queue는 이런 "운영 trace -> 사람 검토 -> 평가 자산화" 흐름을 만드는 데 특히 잘 맞는다.

## 자주 틀리는 점

### 1. feedback config와 rubric item을 같은 개념으로 본다

config는 조직 공통 스키마고, rubric은 queue별 표현 계층이다.  
한 개의 `accuracy` config를 여러 queue가 서로 다른 설명으로 재사용할 수 있다.

### 2. queue 수정이 부분 수정이라고 생각한다

`update_annotation_queue(...)`는 rubric 전체 교체다.  
남겨둘 항목도 다시 포함해야 한다.

### 3. root trace와 intermediate run을 같은 방식으로 queue에 넣을 수 있다고 생각한다

annotation queue 문서 기준으로 single-run queue에는 root span이 아니라 intermediate run을 추가한다.  
어떤 레벨의 run을 리뷰 대상으로 삼을지 먼저 정해야 한다.

### 4. automation 여러 개를 만들어 놓고 실행 순서를 암묵적으로 기대한다

공식 문서 기준으로 각 rule은 독립 polling schedule로 동작한다.  
다른 rule이 먼저 evaluator 점수를 채워 줄 것이라고 가정하면 race가 날 수 있다.

### 5. reviewer 메모만 쌓고 나중 활용 경로를 안 만든다

queue를 많이 돌려도 dataset, assertion, evaluator 개선으로 연결되지 않으면 운영 비용만 늘어난다.

## 추천 운영 패턴

개인적으로는 아래 흐름이 가장 무난하다.

1. 조직 공통 feedback config를 코드로 선언한다
2. queue별 rubric item은 역할별로 얇게 나눈다
3. error, 낮은 user score, 특정 tag를 automation으로 triage queue에 보낸다
4. annotator는 structured score + freeform note를 함께 남긴다
5. 중요한 케이스는 dataset 또는 assertion으로 승격한다
6. queue 정의와 점수 기준은 저장소에서 버전 관리한다

이 정도만 해도 LangSmith가 단순 trace 뷰어가 아니라, 사람 검토를 포함한 운영 품질 루프로 바뀐다.

## 참고 자료

- [Manage feedback & annotation queues programmatically](https://docs.langchain.com/langsmith/annotation-queues-sdk)
- [Use annotation queues](https://docs.langchain.com/langsmith/annotation-queues)
- [Set up automation rules](https://docs.langchain.com/langsmith/rules)
- [Set up feedback criteria](https://docs.langchain.com/langsmith/set-up-feedback-criteria)
- [Use assertions](https://docs.langchain.com/langsmith/assertions)
