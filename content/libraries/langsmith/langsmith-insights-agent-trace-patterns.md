---
title: "LangSmith Insights로 대량 trace의 실패 패턴 찾기"
description: "LangSmith Insights가 trace를 요약하고 계층형 category로 묶는 흐름, 외부 chat history를 Python SDK로 분석하는 방법, sampling·비용·재현성 함정을 정리한 실전 노트"
date: 2026-08-22
tags:
  - langsmith
  - observability
  - monitoring
  - python
aliases:
  - "/blog/langsmith-insights-agent-trace-patterns"
---

# LangSmith Insights로 대량 trace의 실패 패턴 찾기

운영 trace가 수천 개로 늘어나면 오류율이나 평균 latency만으로는 다음 질문에 답하기 어렵다.

- 사용자가 실제로 어떤 요청을 많이 하는가?
- 성공 응답처럼 보이지만 반복해서 불만을 만드는 패턴은 무엇인가?
- 특정 실패가 검색, 도구 선택, 답변 형식 중 어디에 몰려 있는가?

LangSmith Insights는 trace마다 짧은 요약과 속성을 만들고, 비슷한 사례를 top-level category와 subcategory로 묶는다. 개별 trace를 무작위로 읽기 전에 **어떤 패턴부터 조사할지 찾는 탐색 단계**에 적합하다.

다만 Insights는 pass/fail 판정을 고정하는 evaluator가 아니다. 발견된 패턴을 검증 가능한 evaluator와 regression dataset으로 옮겨야 운영 품질 루프가 완성된다.

## 사전 준비

- LangSmith Plus 또는 Enterprise plan
- workspace에 Insights용 model configuration
- report 생성에는 rule 생성 권한, 기존 report 조회에는 tracing project 조회 권한
- Python SDK 방식은 `LANGSMITH_API_KEY`와 분석 모델의 API key 또는 workspace secret

```bash
pip install -U langsmith
```

PowerShell 예시:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:OPENAI_API_KEY="your-provider-key"
```

Insights report는 background job이며 공식 문서상 완료까지 최대 30분이 걸릴 수 있다.

## 1. 먼저 분석 질문과 단위를 고정한다

좋지 않은 요청은 너무 넓다.

> 우리 agent의 문제를 찾아줘.

분석 대상과 원하는 결과를 함께 적는 편이 낫다.

> 최근 고객 지원 대화에서 해결되지 않은 환불 요청을 찾고, 실패 원인을 정책 정보 부족, 도구 선택 실패, 사용자 정보 부족으로 구분해 줘. 단순 인사와 테스트 대화는 제외해 줘.

그리고 한 행이 무엇인지 명확히 해야 한다.

- 단발성 API라면 root run의 input/output이 핵심이다.
- 멀티턴 agent라면 `thread_id`를 남기고 전체 대화를 분석해야 한다.
- 여러 child run이 있어도 `run.*` 변수는 thread의 가장 최근 root run을 가리킨다.
- 전체 대화가 필요하면 summary prompt에 `{{all_thread_messages}}`를 넣는다.

질문과 분석 단위가 흔들리면 category 변화가 실제 사용자 변화인지 설정 변화인지 구분하기 어렵다.

## 2. LangSmith 밖의 chat history도 SDK로 분석한다

공식 Python SDK의 `generate_insights()`는 외부 chat history를 새 LangSmith project의 trace로 업로드하고 Insights job을 시작한다.

```python
import os

from langsmith import Client

client = Client()

chat_histories = [
    [
        {"role": "user", "content": "배송 전 주문을 취소하고 싶어요."},
        {
            "role": "assistant",
            "content": "주문 번호를 알려 주시면 취소 가능 여부를 확인할게요.",
        },
        {"role": "user", "content": "A-1042입니다."},
        {"role": "assistant", "content": "주문 조회 도구에 연결하지 못했습니다."},
    ],
    [
        {"role": "user", "content": "반품 배송비는 누가 내나요?"},
        {
            "role": "assistant",
            "content": "상품 하자라면 판매자, 단순 변심이면 구매자 부담입니다.",
        },
    ],
]

report = client.generate_insights(
    chat_histories=chat_histories,
    name="support-failure-patterns-2026-08-22",
    instructions=(
        "고객 지원 대화의 주요 의도와 해결 실패 원인을 분류해 줘. "
        "도구 연결 실패, 정책 정보 부족, 사용자 정보 부족을 특히 구분해 줘."
    ),
    openai_api_key=os.environ["OPENAI_API_KEY"],
)

print(report)

# 동기적으로 완료를 기다려야 하는 스크립트에서만 사용한다.
completed_report = client.poll_insights(report=report)
print(completed_report)
```

`openai_api_key`는 workspace secret에 이미 설정되어 있다면 생략할 수 있다. 외부 데이터를 쓰는 이 방식은 원본 chat history를 LangSmith에 업로드하므로, 개인정보·보존 정책을 먼저 확인해야 한다.

## 3. summary prompt에는 분류에 필요한 정보만 넣는다

Insights는 먼저 각 trace를 요약하고 그 요약을 category로 묶는다. 따라서 요약에서 빠진 정보는 분류에도 영향을 줄 수 없다.

Manual configuration에서는 Mustache 변수로 전달 범위를 줄일 수 있다.

```text
다음 대화에서 사용자의 핵심 의도, 해결 여부, 실패 원인만 요약하라.
인사말과 일반적인 정중 표현은 무시하라.

전체 대화:
{{all_thread_messages}}

최종 오류:
{{run.error}}

사용자 만족도:
{{run.feedback.user_satisfaction}}
```

단발성 trace라면 필요한 nested field만 선택할 수도 있다.

```text
요청: {{run.inputs.request.text}}
응답: {{run.outputs.answer}}
```

큰 input/output 전체를 무조건 넣으면 모델 비용과 noise가 함께 늘어난다. category를 가르는 데 필요한 필드부터 시작한다.

## 4. attribute로 category에 운영 관점을 주입한다

Insights attribute는 string, number, boolean 값을 trace마다 추출한다. 비슷한 attribute 값을 가진 trace가 같은 category로 모이는 경향이 있고, category별 집계도 볼 수 있다.

예를 들어 다음 속성이 실용적이다.

- `resolved: boolean`: 사용자 문제가 실제로 해결되었는가
- `intent: string`: 환불, 배송, 계정, 기술 지원 중 무엇인가
- `tool_calls: number`: 외부 도구 호출 횟수
- `needs_human: boolean`: 사람 상담원 전달이 필요한가

boolean attribute에 `filter_by: true`를 지정하면, LLM이 그 속성을 `true`로 판정한 trace만 category 생성 단계로 넘길 수 있다. 예를 들어 `is_actionable_failure`만 분석할 수 있다.

주의할 점은 이 필터도 LLM 판정이라는 사실이다. 정확한 HTTP error, metadata, feedback threshold로 줄일 수 있는 범위는 먼저 trace filter로 좁히고, 의미 판단이 필요한 부분만 attribute filter에 맡기는 편이 안정적이다.

## 5. 탐색과 추세 비교의 category 전략을 나눈다

처음에는 top-level category를 비워 두고 bottom-up discovery를 수행하면 예상하지 못한 패턴을 찾기 좋다. 이후 주간 report를 비교할 때는 발견된 category를 저장해 재사용한다.

공식 동작상 category를 미리 정의하지 않은 config는 첫 job에서 발견된 top-level category를 config에 저장하며, 이후 scheduled run이 이를 재사용할 수 있다. subcategory는 계속 자동 생성된다.

실무에서는 두 config를 나누는 편이 이해하기 쉽다.

1. **Discovery config**: category를 비워 두고 새로운 패턴을 탐색한다.
2. **Trend config**: 고정 category로 주별 비율과 error·latency·cost·feedback 변화를 비교한다.

같은 이름의 report라도 summary prompt, filter, category가 달라지면 비율을 직접 비교하면 안 된다.

## 6. sample과 schedule을 운영 비용에 맞춘다

Manual configuration의 한 report sample 상한은 1,000 traces다. 시간 범위와 trace filter로 모집단을 먼저 정하고 sample을 선택한다.

공식 문서의 대략적인 비용 예시는 1,000 threads 기준 OpenAI model이 1~2달러, Anthropic model이 3~4달러이며, thread 수와 길이에 따라 증가한다. 실제 비용은 model과 trace 크기에 따라 달라지므로 소규모 sample로 summary prompt를 먼저 검증한다.

Insights는 역할이 다른 두 모델을 사용한다.

- summarization model: trace별 요약 생성, 상대적으로 빠르고 저렴함
- thinking model: clustering 수행, 상대적으로 성능과 비용이 큼

schedule은 daily 08:00 UTC, Monday weekly 08:00 UTC, 또는 UTC cron으로 설정할 수 있다. 한국 시간으로 해석할 때 시차를 놓치지 말아야 한다. `last 24 hours` 같은 상대 시간 범위는 실행 시점마다 동적으로 계산된다.

## 7. report를 평가와 개선 작업으로 연결한다

report를 읽고 끝내지 말고 다음 순서로 연결한다.

1. 비율이 높거나 비용·오류·feedback이 나쁜 category를 선택한다.
2. category와 subcategory의 실제 trace를 여러 개 열어 오분류 여부를 확인한다.
3. 대표 실패 trace를 dataset example로 큐레이션한다.
4. 반복 가능한 code evaluator 또는 LLM-as-a-judge rubric을 만든다.
5. 수정 전후 offline experiment와 production online evaluator로 회귀를 확인한다.

Insights의 percentage는 sample에서 발견된 분포이지 전체 트래픽의 확정 통계가 아니다. 제품 의사결정에는 원본 trace filter와 dashboard 지표도 함께 확인한다.

## 흔한 함정

### Insights를 evaluator처럼 사용한다

category는 탐색과 설명에 좋지만 고정된 release gate가 아니다. 발견한 실패 조건을 evaluator로 명시해야 한다.

### multi-turn인데 마지막 run만 요약한다

`run.inputs`와 `run.outputs`만 쓰면 앞선 대화 맥락을 잃을 수 있다. `thread_id`와 `{{all_thread_messages}}`가 필요한지 확인한다.

### raw payload 전체를 summary prompt에 넣는다

도구 원문, 검색 문서, 큰 JSON은 비용과 noise를 키운다. nested field를 골라 최소 입력으로 시작한다.

### 첫 discovery report와 다음 report의 비율을 바로 비교한다

새 category가 매번 생성되면 label 의미가 달라질 수 있다. 추세 분석은 저장된 config와 고정 top-level category를 사용한다.

### attribute filter를 정확한 규칙으로 오해한다

`filter_by`는 LLM이 설명을 해석한다. 결정론적 metadata/error/feedback filter를 먼저 적용하고 표본 trace를 사람이 감사한다.

### 외부 chat history 업로드를 로컬 분석으로 오해한다

`generate_insights()`는 데이터를 새 LangSmith project의 trace로 업로드한다. 민감정보 마스킹과 데이터 보존 정책을 먼저 적용한다.

## 체크리스트

- [ ] 분석 질문에 대상, 시간 범위, 제외 조건을 적었다
- [ ] single run과 thread 중 분석 단위를 정했다
- [ ] summary prompt에 분류에 필요한 필드만 넣었다
- [ ] metadata filter와 LLM attribute filter의 역할을 나눴다
- [ ] 작은 sample로 category 품질과 비용을 확인했다
- [ ] discovery config와 trend config를 분리했다
- [ ] 대표 trace를 dataset과 evaluator로 연결했다
- [ ] 외부 chat history의 개인정보와 보존 정책을 확인했다

## 참고 자료

- [Discover errors and usage patterns with Insights](https://docs.langchain.com/langsmith/insights)
- [Configure model providers for LangSmith](https://docs.langchain.com/langsmith/model-config)
- [Configure threads](https://docs.langchain.com/langsmith/threads)
- [Filter traces in the application](https://docs.langchain.com/langsmith/filter-traces-in-application)
- [Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)
