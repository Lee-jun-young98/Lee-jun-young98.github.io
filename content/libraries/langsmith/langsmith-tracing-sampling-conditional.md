---
title: "LangSmith tracing sampling과 conditional tracing으로 비용과 가시성 균형 잡기"
description: "LANGSMITH_TRACING_SAMPLING_RATE, Client(tracing_sampling_rate=...), tracing_context(enabled=...)를 조합해 운영 trace 볼륨을 줄이면서 중요한 요청은 놓치지 않는 방법을 정리한 실전 노트"
date: 2026-06-28
tags:
  - langsmith
  - observability
  - tracing
  - python
aliases:
  - "/blog/langsmith-tracing-sampling-conditional"
---

# LangSmith tracing sampling과 conditional tracing으로 비용과 가시성 균형 잡기

LangSmith tracing을 운영에 붙이고 나면 금방 이런 고민이 생깁니다.

- "모든 요청을 다 trace로 남기니 볼륨이 너무 많다"
- "디버깅에 필요한 production 오류는 놓치면 안 된다"
- "일부 고객은 zero-retention 정책이라 trace 자체를 끄고 싶다"
- "중요 기능은 100% 남기고, 일반 트래픽은 일부만 샘플링하고 싶다"

이럴 때 핵심은 **sampling**과 **conditional tracing**을 구분해서 쓰는 것입니다.

- sampling: 전체 트래픽 중 일부만 확률적으로 남긴다
- conditional tracing: 특정 요청은 규칙에 따라 확정적으로 남기거나 끈다

2026년 6월 28일 기준 LangSmith 공식 문서에서는 이 둘을 함께 쓰는 방식을 권장한다.  
이번 글에서는 Python 기준으로 실무에서 바로 쓰기 좋은 패턴만 정리한다.

## 언제 어떤 방식이 맞는가

### sampling이 맞는 경우

- 요청량이 많아서 trace 비용과 노이즈를 먼저 줄여야 할 때
- 전체 분포는 보고 싶지만 모든 요청을 다 볼 필요는 없을 때
- 장애 분석보다 장기적인 운영 관측 비중이 클 때

### conditional tracing이 맞는 경우

- 특정 고객은 trace를 절대 남기면 안 될 때
- 특정 tenant, feature, region만 따로 보고 싶을 때
- 장애 대응용 요청은 반드시 남겨야 할 때
- 개인정보나 민감 워크플로우는 deterministic 하게 꺼야 할 때

실무에서는 보통 아래처럼 조합한다.

1. 기본은 sampling으로 볼륨을 줄인다
2. 민감 고객은 conditional tracing으로 아예 끈다
3. 중요한 기능이나 디버깅 세션은 conditional tracing으로 100% 남긴다

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
$env:OPENAI_API_KEY="sk-..."
```

기본 예제에서 사용할 최소 코드:

```python
from openai import OpenAI
from langsmith.wrappers import wrap_openai

client = wrap_openai(OpenAI())


def ask_llm(question: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": "Answer briefly."},
            {"role": "user", "content": question},
        ],
    )
    return response.choices[0].message.content or ""
```

## 1. 전체 프로젝트에 전역 sampling rate를 먼저 걸 수 있다

공식 문서 기준으로 LangSmith SDK와 LangChain tracing에서는 `LANGSMITH_TRACING_SAMPLING_RATE` 환경 변수를 써서 전역 샘플링 비율을 줄일 수 있다. 값은 `0`에서 `1` 사이 실수다.

```powershell
$env:LANGSMITH_TRACING="true"
$env:LANGSMITH_TRACING_SAMPLING_RATE="0.2"
```

이 설정이면 대략 20%의 trace만 LangSmith로 전송된다.

운영에서 가장 무난한 시작점은 보통 아래 정도다.

- 저트래픽 서비스: `0.5` ~ `1.0`
- 일반 production: `0.05` ~ `0.2`
- 매우 고트래픽 서비스: `0.01` 부근부터 시작

중요한 점은 이 방식이 **전체 볼륨 절감**에는 좋지만, 특정 요청을 반드시 남긴다는 보장은 없다는 점이다.

## 2. 요청 단위로 sampling rate를 다르게 주려면 Client를 나눈다

공식 문서에는 `Client(tracing_sampling_rate=...)`와 `tracing_context(client=...)`를 함께 쓰는 패턴이 나온다. 이 방식이 실무에서 더 유연하다.

```python
from langsmith import Client, tracing_context

low_value_client = Client(tracing_sampling_rate=0.05)
default_client = Client(tracing_sampling_rate=0.2)
debug_client = Client(tracing_sampling_rate=1.0)
no_trace_client = Client(tracing_sampling_rate=0.0)


def run_with_policy(question: str, mode: str) -> str:
    if mode == "background":
        selected = low_value_client
    elif mode == "debug":
        selected = debug_client
    elif mode == "off":
        selected = no_trace_client
    else:
        selected = default_client

    with tracing_context(client=selected):
        return ask_llm(question)
```

이 패턴이 좋은 이유는 sampling 정책을 코드에서 명시적으로 분리할 수 있기 때문이다.

- 일반 사용자 요청: 20%
- 배치성 저가치 요청: 5%
- 장애 재현 세션: 100%
- 정책상 금지 고객: 0%

## 3. trace를 확정적으로 꺼야 하면 `tracing_context(enabled=False)`를 쓴다

sampling은 확률적이므로, zero-retention 고객처럼 "절대 남기면 안 되는" 케이스에는 맞지 않는다. 이때는 conditional tracing으로 끄는 것이 맞다.

```python
import langsmith as ls
from langsmith import traceable


ZERO_RETENTION_TENANTS = {"enterprise-a", "enterprise-b"}


@traceable
def answer_question(question: str) -> str:
    return ask_llm(question)


def handle_request(tenant_id: str, question: str) -> str:
    should_trace = tenant_id not in ZERO_RETENTION_TENANTS

    with ls.tracing_context(enabled=should_trace):
        return answer_question(question)
```

이 방식은 다음 상황에서 특히 중요하다.

- 계약상 trace 저장 금지
- 특정 요청에 민감정보가 반드시 포함됨
- 내부 관리자 기능이라 별도 로깅 정책이 있음

## 4. 중요한 요청만 100% 남기고 싶으면 conditional tracing으로 override 한다

실무에서는 "평소에는 샘플링하지만, 특정 feature나 incident 대응 요청은 반드시 trace"가 자주 필요하다.

```python
import langsmith as ls


def is_must_trace_request(feature: str, priority: str) -> bool:
    return feature in {"checkout", "refund"} or priority == "p0"


def handle_support_request(question: str, feature: str, priority: str) -> str:
    if is_must_trace_request(feature, priority):
        with ls.tracing_context(
            enabled=True,
            tags=["production", feature, priority, "must-trace"],
            metadata={"feature": feature, "priority": priority},
        ):
            return ask_llm(question)

    return ask_llm(question)
```

여기서 핵심은 "평소엔 샘플링, 중요한 요청은 강제 추적"이라는 운영 규칙을 코드로 드러내는 것이다.

## 5. tenant별로 project를 나누면서 tracing을 제어할 수도 있다

공식 문서 기준으로 `tracing_context(...)`는 단순 on/off만이 아니라 project, tags, metadata도 요청 단위로 덮어쓸 수 있다.

```python
import langsmith as ls


ENTERPRISE_PROJECTS = {
    "acme": "support-acme-prod",
    "globex": "support-globex-prod",
}


def route_request(tenant_id: str, region: str, question: str) -> str:
    project_name = ENTERPRISE_PROJECTS.get(tenant_id, "support-shared-prod")

    with ls.tracing_context(
        enabled=True,
        project_name=project_name,
        tags=["production", f"tenant:{tenant_id}", f"region:{region}"],
        metadata={"tenant_id": tenant_id, "region": region},
    ):
        return ask_llm(question)
```

이 패턴은 아래와 같이 연결된다.

- enterprise 고객별로 trace 분리
- region별 성능 관찰
- feature flag 실험 트래픽만 별도 project로 라우팅

## 6. sampling과 conditional tracing은 같이 써야 운영이 편하다

가장 실용적인 기본 전략은 아래와 같다.

```python
import langsmith as ls
from langsmith import Client, tracing_context

default_client = Client(tracing_sampling_rate=0.1)
full_trace_client = Client(tracing_sampling_rate=1.0)


ZERO_RETENTION_TENANTS = {"enterprise-a"}
CRITICAL_FEATURES = {"checkout", "refund"}


def handle_request(tenant_id: str, feature: str, question: str) -> str:
    if tenant_id in ZERO_RETENTION_TENANTS:
        with ls.tracing_context(enabled=False):
            return ask_llm(question)

    if feature in CRITICAL_FEATURES:
        with tracing_context(
            client=full_trace_client,
            project_name="support-critical-prod",
            tags=["production", feature, "critical"],
            metadata={"tenant_id": tenant_id, "feature": feature},
        ):
            return ask_llm(question)

    with tracing_context(
        client=default_client,
        project_name="support-default-prod",
        tags=["production", feature],
        metadata={"tenant_id": tenant_id, "feature": feature},
    ):
        return ask_llm(question)
```

이 정도만 해도 운영 정책이 꽤 깔끔해진다.

- 금지 고객: 추적 안 함
- 핵심 기능: 100% 추적
- 일반 기능: 10%만 추적

## 7. `tracing_context` 우선순위를 이해해야 설정 충돌이 줄어든다

공식 문서 기준 Python tracing 제어 우선순위는 아래와 같다.

1. `tracing_context(enabled=...)`
2. `ls.configure(enabled=...)`
3. `LANGSMITH_TRACING` 환경 변수

즉 전역에서 `LANGSMITH_TRACING=true`를 켜 두더라도, 특정 요청에서는 `tracing_context(enabled=False)`가 우선한다.

이 우선순위를 모르고 있으면 다음 같은 혼동이 생긴다.

- "환경 변수로 켰는데 왜 어떤 요청은 trace가 안 남지?"
- "전역에서 껐는데 특정 함수는 왜 trace가 남지?"

실제로는 대개 request scope override가 더 높은 우선순위로 적용된 것이다.

## 자주 틀리는 점

### 1. sampling으로 zero-retention 요구사항을 해결하려고 한다

sampling은 확률 제어일 뿐이다.  
"남길 수도 있고 안 남길 수도 있음"이라서 규제나 계약 요구사항 대응에는 맞지 않는다.

### 2. sampling rate를 너무 낮게 시작해서 장애 단서를 못 본다

초기 운영에서는 `0.01`이 너무 낮을 수 있다.  
장애 탐지와 디버깅 용도가 크면 먼저 `0.1` 이상으로 운영하면서 패턴을 본 뒤 줄이는 편이 낫다.

### 3. high-value 트래픽도 전역 sampling에 그대로 맡긴다

결제, 환불, 에러 재현, VIP 고객 이슈처럼 놓치면 안 되는 요청은 별도 조건으로 100% 추적해야 한다.

### 4. `project_name`, `tags`, `metadata`를 안 남겨서 trace가 쌓여도 분류가 안 된다

볼륨만 줄이는 것보다 중요한 것은 나중에 다시 찾을 수 있게 만드는 것이다.  
sampling 정책과 함께 feature, tenant, region 정도는 같이 남겨 두는 편이 좋다.

### 5. 여러 `Client`를 만들었지만 `tracing_context(client=...)`로 감싸지 않는다

`Client(tracing_sampling_rate=...)`를 만들어도 실제 호출 스코프에 연결하지 않으면 기대한 sampling 정책이 적용되지 않는다.

## 추천 운영 기준

개인적으로는 아래 순서가 가장 무난하다.

1. 전역 sampling rate를 먼저 `0.1` 정도로 시작한다
2. zero-retention tenant는 conditional tracing으로 확실히 끈다
3. checkout, refund, incident 대응 요청은 100% trace로 승격한다
4. tenant, feature, region 태그를 붙여 나중에 필터링 가능하게 만든다
5. 1~2주 운영 후 실제 검색 패턴을 보고 sampling rate를 다시 조정한다

LangSmith tracing은 "많이 남기는 것"보다 "무엇을 확정적으로 남기고, 무엇을 확률적으로 줄일지"를 운영 규칙으로 명시하는 쪽이 훨씬 중요하다.  
sampling과 conditional tracing을 분리해서 설계하면 비용, 개인정보, 디버깅 가시성을 동시에 관리하기 쉬워진다.

## 참고 자료

- [Conditional tracing](https://docs.langchain.com/langsmith/conditional-tracing)
- [Set a sampling rate for traces](https://docs.langchain.com/langsmith/sample-traces)
- [Log traces to a specific project](https://docs.langchain.com/langsmith/log-traces-to-project)
- [Prevent logging of sensitive data in traces](https://docs.langchain.com/langsmith/mask-inputs-outputs)
- [Observability concepts](https://docs.langchain.com/langsmith/observability-concepts)
