---
title: "LangSmith dashboards와 alerts로 운영 trace 감시하기"
description: "LangSmith dashboard와 alert를 이용해 운영 trace의 에러율, 지연시간, 비용, feedback score를 감시하는 실전 패턴을 한국어로 정리한 스터디 노트"
date: 2026-07-10
tags:
  - langsmith
  - observability
  - monitoring
  - python
aliases:
  - "/blog/langsmith-dashboards-alerts-monitoring"
---

# LangSmith dashboards와 alerts로 운영 trace 감시하기

LangSmith를 운영에 붙인 뒤 가장 먼저 부딪히는 문제는 "trace는 쌓이는데, 언제 이상 징후를 알아차릴 것인가"다.

- 에러율이 갑자기 올라갔는데 언제 알림을 받을까
- 특정 고객군에서만 latency가 느려진 걸 어떻게 볼까
- evaluator score나 user feedback이 떨어지는 구간을 어떻게 잡을까
- 비용이 튀는 날을 trace 단위로 역추적하려면 뭘 먼저 붙여야 할까

이럴 때 LangSmith의 `dashboard + alert` 조합이 실용적이다.  
dashboard는 추세를 보고, alert는 임계치를 넘었을 때 바로 반응하게 해 준다.

이번 글은 아래 흐름에 집중한다.

1. trace에 태그와 metadata를 일관되게 남긴다
2. feedback score나 비용 같은 감시 지표를 준비한다
3. dashboard에서 group by와 chart를 설계한다
4. alert로 에러율, latency, feedback score, cost를 감시한다

## 이 글이 특히 필요한 상황

아래 중 하나라도 해당하면 dashboard와 alert를 먼저 정리해 두는 편이 좋다.

- 운영 trace는 이미 많지만, 매번 UI에서 수동으로 확인하고 있다
- 특정 프로젝트나 태그별로 이상 징후를 나눠 보고 싶다
- online evaluator나 사용자 feedback을 운영 품질 지표로 삼고 싶다
- 장애 알림을 Slack, PagerDuty, webhook으로 넘기고 싶다

반대로 아직 로컬 실험 단계이고 트래픽이 거의 없다면 tracing과 basic query부터 먼저 붙이는 편이 낫다.

## 먼저 알아둘 핵심

공식 문서 기준으로 LangSmith monitoring은 크게 두 층으로 나뉜다.

- dashboard: 추세와 분포를 시각적으로 보는 도구
- alert: 정한 임계치를 넘을 때 통지하는 도구

둘은 같은 데이터를 보지만 목적이 다르다.

- dashboard는 "무슨 패턴이 있었나"를 본다
- alert는 "언제 바로 대응해야 하나"를 본다

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith openai
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:OPENAI_API_KEY="sk-your_key"
```

## 1. dashboard와 alert가 읽을 수 있는 trace 구조부터 만든다

dashboard는 나중에 클릭 몇 번으로 만드는 것 같지만, 실제로는 tracing 시점의 태그와 metadata 품질에 크게 좌우된다.  
공식 문서에서도 group by는 tag나 metadata 기반으로 나눌 수 있고, parent/child run 사이에 metadata와 tags가 자동 전파되지 않는다고 설명한다.

즉, 아래처럼 root run과 필요한 child run에 둘 다 명시적으로 넣는 습관이 중요하다.

```python
from openai import OpenAI
from langsmith import traceable

client = OpenAI()


@traceable(
    run_type="chain",
    name="support_agent",
    tags=["production", "support_agent", "tier_paid"],
    metadata={
        "tenant": "acme",
        "channel": "chat",
        "region": "kr",
    },
)
def answer_customer(question: str) -> str:
    response = client.responses.create(
        model="gpt-4.1-mini",
        input=f"고객 질문에 답하세요: {question}",
    )
    return response.output_text


print(answer_customer("환불 정책을 알려줘"))
```

운영에서 많이 쓰는 분류 키는 아래 정도다.

- `tenant`
- `channel`
- `region`
- `plan`
- `feature_flag`
- `release`

이 키들이 있어야 dashboard에서 "전체는 괜찮은데 `region=kr`만 느리다" 같은 패턴을 빠르게 본다.

## 2. feedback score를 감시하려면 피드백을 trace에 남겨야 한다

alert는 feedback score 평균도 감시할 수 있다.  
이때 점수가 trace에 남아 있어야 하므로 evaluator 결과나 사용자 평점을 일관된 feedback key로 기록하는 습관이 필요하다.

아래는 root run ID를 알고 있다는 가정에서 사용자 thumbs-up/down을 수집하는 최소 예제다.

```python
from langsmith import Client

ls_client = Client()


def log_user_score(run_id: str, score: int, comment: str | None = None) -> None:
    ls_client.create_feedback(
        run_id=run_id,
        key="user_score",
        score=score,
        comment=comment,
    )


log_user_score(
    run_id="11111111-2222-3333-4444-555555555555",
    score=0,
    comment="정책 링크가 잘못됨",
)
```

운영에서 feedback score alert를 쓰려면 `key`를 자주 바꾸지 않는 편이 좋다.  
예를 들어 `user_score`, `groundedness`, `correctness`처럼 의미가 고정된 key를 두는 쪽이 관리가 쉽다.

## 3. prebuilt dashboard는 기본 건강검진 용도로 먼저 본다

공식 문서 기준으로 tracing project마다 prebuilt dashboard가 자동 생성된다.  
여기서 바로 볼 수 있는 대표 섹션은 아래와 같다.

- Traces: trace count, latency, error rate
- LLM Calls: LLM 호출 수와 지연시간
- Cost & Tokens: 비용, 토큰 사용량
- Tools: tool run 수, error rate, latency
- Run Types: root 바로 아래 run name 기준 요약
- Feedback Scores: 숫자형 평균, categorical count

처음에는 custom dashboard를 바로 만들기보다 prebuilt dashboard로 "어떤 축으로 이상이 보이는지"부터 익히는 편이 효율적이다.

## 4. custom dashboard는 비교 대상을 분명하게 만든다

custom dashboard는 단순히 예쁜 차트를 늘리는 기능이 아니다.  
운영에서 진짜 필요한 건 "무엇과 무엇을 비교할 것인지"를 명확히 하는 일이다.

### 추천 차트 1. 지역별 latency

- project: production tracing project
- metric: latency
- group by: `metadata.region`
- chart type: line

### 추천 차트 2. 릴리스별 error rate

- filter: `tags`에 `production`
- metric: errors
- group by: `metadata.release`
- chart type: bar

### 추천 차트 3. 고객군별 user score

- metric: feedback score
- feedback key: `user_score`
- group by: `metadata.plan`

### 추천 차트 4. 모델별 비용 추이

- metric: cost
- group by: run name 또는 metadata의 모델 식별자

공식 문서 기준으로 chart는 `group by` 또는 `data series` 두 방식으로 여러 선을 만들 수 있다.  
단순 비교는 group by가 편하고, 아주 구체적인 A/B 비교는 data series가 더 낫다.

## 5. alert는 한 번에 많이 만들지 말고 운영 시나리오별로 나눈다

공식 문서 기준으로 alert는 project 단위로 설정되고, 아래 metric type을 감시할 수 있다.

- Run Count
- Cost
- Errors
- Feedback Score
- Latency

실무에서는 보통 아래 네 종류부터 시작한다.

### 1. 에러율 alert

- metric: Errors
- aggregation: Percentage
- threshold 예시: 최근 5분 error rate `>= 5%`

이건 장애를 제일 빨리 잡는 기본 알림이다.

### 2. latency alert

- metric: Latency
- aggregation: Average
- threshold 예시: 최근 5분 평균 latency `>= 15s`

대기 시간이 갑자기 길어지는 배포 회귀를 잡기 좋다.

### 3. feedback score alert

- metric: Feedback Score
- feedback key: `user_score`
- threshold 예시: 최근 15분 평균 `<= 0.8`

기능은 살아 있어도 답변 품질이 무너지는 경우를 잡기 좋다.

### 4. cost alert

- metric: Cost
- threshold 예시: 최근 15분 평균 비용 급증

프롬프트 길이 증가, tool loop, 모델 변경 같은 비용 회귀를 빨리 본다.

## 6. filter를 잘 쓰면 noisy alert를 많이 줄일 수 있다

공식 문서 기준으로 Errors와 Latency alert는 Status, Run Type, Tag, Error 같은 필드를 필터로 겹쳐 걸 수 있다.  
이 기능이 없으면 운영 알림이 금방 시끄러워진다.

예를 들어 아래처럼 좁히는 식이다.

- `Tag = support_agent`
- `Run Type = llm`
- `Error contains RateLimitExceeded`

이렇게 하면 "전체 프로젝트 에러" 대신 "support agent의 LLM provider rate limit 문제"만 따로 감시할 수 있다.

## 7. 알림 채널은 Slack보다 webhook fallback도 같이 생각한다

공식 문서 기준으로 alert는 Slack, PagerDuty, Dynatrace, webhook으로 보낼 수 있다.

- Slack: LangSmith Cloud에서 native integration 지원
- PagerDuty: Events API v2 연동
- Dynatrace: Events API v2 연동
- Webhook: 범용 HTTP POST

실무에서는 Slack만 붙여도 시작은 충분하지만, 아래 조건이면 webhook도 같이 설계하는 편이 좋다.

- 내부 incident bot이 따로 있다
- 이슈 트래커나 티켓 시스템과 붙여야 한다
- self-hosted라 Slack native integration 대신 webhook recipe를 써야 한다

## 8. 추천 운영 레이아웃

개인적으로는 dashboard와 alert를 아래 레이어로 나누면 관리가 쉽다.

### Dashboard A. 서비스 전체 건강 상태

- trace count
- error rate
- average latency
- total cost

### Dashboard B. 세그먼트 비교

- `tenant`
- `region`
- `channel`
- `release`

### Dashboard C. 품질 감시

- `user_score`
- evaluator `correctness`
- evaluator `groundedness`

그리고 alert는 다음처럼 최소 세트부터 시작한다.

1. 에러율
2. 평균 latency
3. feedback score
4. 비용

## 자주 틀리는 점

### 1. metadata를 root run에만 넣고 child run chart까지 기대한다

공식 문서 기준으로 metadata와 tags는 parent/child 사이에 자동 전파되지 않는다.  
LLM Calls 차트와 trace 차트를 둘 다 같은 키로 group by하려면 필요한 run 쪽에도 직접 넣어야 한다.

### 2. cost alert를 만들면서 cost tracking 준비를 안 한다

비용 alert는 cost tracking이 구성돼 있어야 의미 있게 동작한다.  
모델 비용 계산이 빠져 있으면 cost 차트와 alert가 비어 보일 수 있다.

### 3. alert를 프로젝트 공통이라고 생각한다

문서 기준으로 alert는 project-scoped다.  
운영 프로젝트가 여러 개면 각 프로젝트에 따로 설정해야 한다.

### 4. prebuilt dashboard 하나만 보고 모든 문제를 다 찾으려 한다

prebuilt dashboard는 기본 health check에는 좋지만, 고객군 비교나 릴리스 비교는 custom dashboard가 훨씬 낫다.

### 5. noisy alert를 threshold만으로 해결하려 한다

대부분은 threshold보다 filter 설계가 더 중요하다.  
run type, tag, error 문자열, feedback key를 잘 나눠야 실제 대응 가능한 알림만 남는다.

### 6. self-hosted에서 Slack native integration을 당연하게 생각한다

공식 문서 기준으로 native Slack notification은 LangSmith Cloud 전용이다.  
self-hosted면 webhook recipe를 써야 한다. 또 alerts 기능 자체도 self-hosted Helm chart `0.10.3` 이상이 필요하다.

## 추천 시작안

처음 세팅한다면 아래 정도로 시작하면 충분하다.

1. production trace에 `tenant`, `region`, `release` metadata를 남긴다
2. `user_score` feedback key 하나를 운영에 고정한다
3. prebuilt dashboard로 기본 추세를 본다
4. custom dashboard 1개를 만들어 `region`별 latency를 본다
5. alert 2개를 만든다

추천 alert 두 개:

- 최근 5분 error rate `>= 5%`
- 최근 15분 average `user_score <= 0.8`

이 정도만 있어도 "trace는 남는데 아무도 못 보는 상태"에서 벗어나기 시작한다.

## 참고 자료

- [Monitor projects with dashboards](https://docs.langchain.com/langsmith/dashboards)
- [Alerts in LangSmith](https://docs.langchain.com/langsmith/alerts)
- [Log user feedback using the SDK](https://docs.langchain.com/langsmith/attach-user-feedback)
- [Add metadata and tags to traces](https://docs.langchain.com/langsmith/add-metadata-tags)
- [Usage and billing](https://docs.langchain.com/langsmith/usage-and-billing)
