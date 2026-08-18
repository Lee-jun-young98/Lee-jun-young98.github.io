---
title: "LangSmith trace retention으로 보존 기간과 관측 비용 제어하기"
description: "Base·Extended trace 보존 등급, 자동 승격 조건, metadata 기반 선별 보존, usage limit 부작용을 운영 관점에서 정리한 LangSmith 실전 노트"
date: 2026-08-18
tags:
  - langsmith
  - observability
  - cost
  - compliance
aliases:
  - "/blog/langsmith-trace-retention-cost-controls"
---

# LangSmith trace retention으로 보존 기간과 관측 비용 제어하기

운영 trace를 모두 오래 보관하면 디버깅에는 편하지만 비용과 개인정보 보존 범위가 커진다. 반대로 너무 빨리 지우면 장애 분석이나 회귀 평가에 쓸 근거가 사라진다.

LangSmith Cloud는 trace를 두 보존 등급으로 나눈다.

| 등급 | 기본 보존 기간 | 적합한 용도 |
| --- | ---: | --- |
| Base | 14일 | 정상 요청의 단기 디버깅과 모니터링 |
| Extended | 기본 400일 | 오류, 사람 검토, 장기 분석이 필요한 trace |

핵심은 모든 trace를 Extended로 보내는 것이 아니라 **Base를 프로젝트 기본값으로 두고 가치가 높은 trace만 선별 승격하는 것**이다. Enterprise에서는 Extended 기간을 workspace 단위로 조정할 수 있지만, 변경은 새 trace에만 적용된다.

## 사전 준비

- LangSmith workspace와 tracing project
- Python 3.10 이상
- `pip install -U langsmith`
- `LANGSMITH_API_KEY`, `LANGSMITH_TRACING=true`, `LANGSMITH_PROJECT` 환경 변수
- project retention이나 usage limit을 바꿀 수 있는 권한

보존 정책은 데이터가 이미 LangSmith로 전송된 뒤 적용된다. 전송 자체를 막아야 하는 비밀값은 retention이 아니라 client-side masking이나 conditional tracing으로 처리해야 한다.

## 먼저 자동 승격 조건을 이해한다

Base trace라도 다음 작업이 trace 안의 run 하나에 적용되면 trace 전체가 Extended로 자동 승격될 수 있다.

- run 또는 같은 thread의 trace에 feedback 추가
- annotation queue에 run 추가
- automation rule이 run과 일치

따라서 “오류 trace에 알림만 걸었으니 보존 비용은 그대로”라고 가정하면 안 된다. automation rule은 명시적인 `Extend data retention` 액션이 아니어도 일치 자체가 승격 조건이다.

Monitoring 차트는 Base trace 본문이 만료된 뒤에도 집계 metadata를 이용해 유지될 수 있다. 반면 tracing UI와 API에서는 만료 trace의 inputs·outputs를 다시 읽을 수 없다. 장기 평가 자료가 필요하면 만료 전에 dataset으로 옮겨야 하며, dataset은 trace retention과 별도로 지속 보관된다.

## 1. 보존 판단에 쓸 metadata를 root trace에 남긴다

자동화 규칙이 안정적으로 대상을 고르려면 자유로운 자연어보다 값의 종류가 제한된 metadata가 낫다.

```python
import os
from langsmith import traceable

os.environ["LANGSMITH_TRACING"] = "true"
os.environ.setdefault("LANGSMITH_PROJECT", "support-production")


@traceable(name="answer_support_request", run_type="chain")
def answer_support_request(question: str, *, tenant_tier: str) -> dict:
    # 실제 애플리케이션에서는 이곳에서 model 또는 agent를 호출한다.
    return {
        "answer": f"요청을 접수했습니다: {question}",
        "needs_human_review": tenant_tier == "enterprise",
    }


answer_support_request(
    "환불 정책을 알려 주세요",
    tenant_tier="enterprise",
    langsmith_extra={
        "metadata": {
            "environment": "production",
            "tenant_tier": "enterprise",
            "retention_candidate": True,
            "app_version": "2026.08.18",
        },
        "tags": ["support", "retention-policy-v1"],
    },
)
```

`retention_candidate`는 보존을 즉시 바꾸는 특별한 필드가 아니다. automation filter가 읽을 운영용 신호다. 정책 버전을 tag로 남기면 규칙 변경 전후의 승격량도 비교하기 쉽다.

## 2. project 기본값은 Base로 두고 자동화로 선별한다

LangSmith UI에서 tracing project를 연 뒤 retention 기본값을 Base로 설정한다. 이 변경은 원칙적으로 이후 들어오는 trace에 적용된다.

그다음 **Tracing project → Automations → New Automation**에서 규칙을 만든다.

1. root trace 기준으로 `metadata.retention_candidate = true` 또는 `error = true`를 필터링한다.
2. 전체 오류를 보존해야 한다면 sampling rate를 `1`로 둔다.
3. 정상 트래픽의 장기 추세 표본만 필요하다면 별도 규칙에 `0.01`처럼 작은 sampling rate를 둔다.
4. 보존만 필요하면 `Extend data retention` 액션을 선택한다.
5. 생성 직후 Logs에서 실제 매칭 수와 오류를 확인한다.

예를 들어 하루 100만 trace 중 오류 0.5%와 정상 표본 1%를 Extended로 남기면 대략적인 후보 수는 다음처럼 계산할 수 있다.

```python
daily_traces = 1_000_000
error_rate = 0.005
normal_sample_rate = 0.01

errors = daily_traces * error_rate
normal_traces = daily_traces - errors
extended_candidates = errors + normal_traces * normal_sample_rate

print(f"하루 Extended 후보: {extended_candidates:,.0f}")
# 하루 Extended 후보: 14,950
```

이는 예산 추정치일 뿐이다. 여러 규칙이 같은 trace에 겹치거나 feedback·annotation이 추가되면 실제 승격 경로가 달라질 수 있으므로 Usage 화면의 실측값과 함께 봐야 한다.

## 3. 규칙 순서와 feedback 의존성을 명시한다

서로 다른 automation rule은 독립적인 polling 주기로 실행된다. 온라인 evaluator가 점수를 만들기 전에 webhook 또는 보존 규칙이 먼저 실행될 수 있다.

“점수가 낮은 trace만 보존”하려면 다음 규칙의 filter가 평가 결과의 feedback key를 명시적으로 요구하도록 구성한다.

```text
Rule A: production trace → online evaluator가 quality_score 기록
Rule B: quality_score < 0.6 → annotation queue 또는 보존 대상 처리
```

한 규칙 안에 여러 action이 있다면 공식 실행 순서는 annotation queue, dataset, webhook, online evaluator, custom code evaluator, alert 순이다. 같은 규칙의 뒤 action이 앞선 evaluator 결과를 당연히 볼 것이라고 기대하지 말고, 의존 단계는 규칙을 나누고 filter로 연결한다.

## 4. usage limit은 안전장치이자 기능 차단점이다

LangSmith에는 전체 trace와 Extended trace의 월간 limit을 둘 수 있다. 다만 limit은 근사치라 짧은 시간 동안 초과 수집될 수 있다.

더 중요한 함정은 Extended limit에 도달했을 때다. 새 trace 승격을 일으킬 수 있는 다음 기능도 막힐 수 있다.

- automation rule match
- trace feedback 추가
- annotation queue 추가

즉 limit을 너무 낮게 잡으면 비용만 제한되는 것이 아니라 품질 검토 파이프라인도 멈춘다. 알림 임계값은 limit 도달 전으로 잡고, Base/Extended 분포를 주기적으로 확인해야 한다.

## 흔한 실수

### retention을 개인정보 마스킹으로 오해하기

14일 뒤 삭제되더라도 그 기간 동안 원문은 저장된다. API key, 주민번호, 의료정보처럼 전송해서는 안 되는 값은 trace 생성 전에 가린다.

### automation을 추가 비용 없는 필터로 보기

rule이 일치하는 것만으로 trace가 Extended로 승격될 수 있다. 너무 넓은 filter와 `1.0` sampling을 함께 배포하기 전에 최근 트래픽으로 예상 매칭량을 계산한다.

### 변경한 기간이 기존 trace에도 소급된다고 믿기

workspace의 Extended 기간 변경과 project 기본 retention 변경은 기본적으로 새 trace를 대상으로 한다. 기존 데이터의 상태는 별도로 확인한다.

### dataset 복사를 임시 보존으로 생각하기

dataset은 indefinite retention 대상이다. 장기 보존이 목적에 맞는 데이터만 복사하고, 원본 trace 삭제가 dataset example 삭제까지 대신해 주지 않는다는 점을 고려한다.

### 모니터링 그래프가 남아 있으니 원문도 남아 있다고 판단하기

집계 그래프와 trace inputs·outputs의 수명은 다르다. 사고 조사에 원문이 필요하다면 Base 만료 전에 선별 승격하거나 dataset/export 정책을 둔다.

## 운영 체크리스트

- project 기본 보존 등급과 실제 목적이 맞는가?
- 자동 승격을 만드는 feedback, queue, automation의 범위를 파악했는가?
- metadata key와 정책 tag가 root trace에 일관되게 기록되는가?
- 오류 100%와 정상 표본을 서로 다른 규칙으로 관리하는가?
- Extended limit 도달 전에 경고를 받을 수 있는가?
- 개인정보는 retention 이전 단계에서 마스킹되는가?
- 장기 평가 데이터의 dataset 보존 근거와 삭제 절차가 있는가?

## 참고 자료

- [LangSmith Administration overview: Data retention](https://docs.langchain.com/langsmith/administration-overview#data-retention)
- [LangSmith Billing: Configure trace tier distribution](https://docs.langchain.com/langsmith/billing#configure-trace-tier-distribution)
- [LangSmith Set up automation rules](https://docs.langchain.com/langsmith/rules)
- [LangSmith Data purging for compliance](https://docs.langchain.com/langsmith/data-purging-compliance)
- [LangSmith Set a sampling rate for traces](https://docs.langchain.com/langsmith/sample-traces)

