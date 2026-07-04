---
title: "LangSmith OpenTelemetry trace를 experiment로 평가하기"
description: "OpenTelemetry로 계측된 앱을 LangSmith experiment와 dataset example에 연결해 평가하는 실전 패턴을 Python 예제로 정리한 한국어 study note"
date: 2026-07-04
tags:
  - langsmith
  - evaluation
  - opentelemetry
  - python
aliases:
  - "/blog/langsmith-evaluate-with-opentelemetry"
---

# LangSmith OpenTelemetry trace를 experiment로 평가하기

LangSmith `evaluate()`를 그대로 쓸 수 있으면 가장 간단하다.  
하지만 실무에서는 이미 OpenTelemetry로 계측된 앱을 그대로 두고 평가만 LangSmith에 붙이고 싶은 경우가 자주 나온다.

- 추론 서비스가 LangChain 없이 자체 런타임에서 돈다
- 여러 마이크로서비스가 이미 OTEL span을 내보내고 있다
- `evaluate()`를 넣기 어려운 프레임워크나 사내 실행기 위에서 평가를 돌린다
- trace는 이미 잘 남는데 dataset example과 experiment 비교 화면까지 연결하고 싶다

이럴 때는 LangSmith experiment를 하나 만들고, 각 실행 span에 `langsmith.trace.session_id`와 `langsmith.reference_example_id`를 같이 심으면 된다.

이 글은 2026년 7월 4일 기준 공식 LangSmith 문서를 바탕으로 아래만 실무적으로 정리한다.

- 언제 OTEL 평가 방식이 맞는지
- experiment session을 어떻게 만들지
- Python OTLP exporter와 span attribute를 어떻게 잡을지
- dataset example 반복 실행을 어떻게 묶을지
- 자주 틀리는 점

## 언제 이 방식이 유용한가

아래 조건이면 이 흐름이 잘 맞는다.

- 애플리케이션 실행은 이미 OTEL 기반이고 LangSmith는 관찰과 평가 UI 역할만 하면 될 때
- 여러 서비스에서 생긴 span을 하나의 평가 실험으로 묶고 싶을 때
- LangSmith dataset에 있는 example별로 앱을 다시 호출하면서 trace를 남기고 싶을 때
- dataset에 연결된 UI evaluator를 자동으로 태우고 싶을 때

반대로 Python에서 target 함수를 직접 넘길 수 있고 단일 프로세스 실험이면 `evaluate()`가 더 단순하다.

## 핵심 개념

LangSmith 공식 문서 기준으로 OTEL 평가에는 네 가지 연결점이 있다.

1. LangSmith dataset
2. dataset에 연결된 experiment session
3. experiment session으로 라우팅되는 OTEL exporter
4. 각 trace를 특정 example에 연결하는 span attribute

실무적으로는 아래 두 줄이 가장 중요하다.

- `client.create_project(..., reference_dataset_id=dataset_id)`로 experiment를 만든다
- 실행 span에 `langsmith.trace.session_id=<experiment_id>`와 `langsmith.reference_example_id=<example_id>`를 넣는다

여기에 dataset에 바인딩된 evaluator가 있으면 experiment trace가 들어올 때 자동으로 평가가 붙는다.

## 사전 준비

공식 문서에서는 OTEL 관련 수정사항 때문에 `langsmith>=0.4.25`를 권장한다.  
Python 예제는 아래 조합이면 충분하다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "langsmith>=0.4.25" opentelemetry-sdk opentelemetry-exporter-otlp
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_ENDPOINT="https://api.smith.langchain.com"
$env:OTEL_EXPORTER_OTLP_ENDPOINT="https://api.smith.langchain.com/otel"
```

self-hosted라면 문서 기준으로 `OTEL_EXPORTER_OTLP_ENDPOINT`는 `<your-base>/api/v1/otel` 형태를 쓰고, `LANGSMITH_ENDPOINT`도 self-hosted API base로 바꿔야 한다.

## 1. 먼저 dataset에 연결된 experiment session을 만든다

OTEL만 붙인다고 평가 실험이 생기지는 않는다.  
먼저 LangSmith 안에 experiment session을 만들어 dataset과 연결해야 한다.

```python
from langsmith import Client

client = Client()

dataset_id = "11111111-2222-3333-4444-555555555555"
experiment_name = "faq-otel-eval-2026-07-04"

project = client.create_project(
    project_name=experiment_name,
    reference_dataset_id=dataset_id,
)

experiment_id = str(project.id)
print("experiment_id:", experiment_id)
```

여기서 `experiment_id`가 이후 OTEL trace를 LangSmith experiment 뷰로 라우팅하는 기준이 된다.

dataset 기반 자동 평가를 쓰려면 evaluator도 dataset 쪽에 미리 연결해 두는 편이 좋다.  
공식 문서 기준으로 dataset에 바인딩된 UI evaluator는 이 experiment trace들에 자동으로 실행된다.

## 2. OTLP exporter를 LangSmith experiment로 보낸다

OTEL exporter는 LangSmith endpoint와 API key만 알아도 동작한다.  
평가 실험에서는 여기에 `Langsmith-Project=<experiment_id>` 헤더를 같이 넣어 프로젝트 목적지를 고정하는 편이 실무적으로 안전하다.

```python
import os

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor


def configure_otel(experiment_id: str) -> None:
    endpoint_base = os.environ.get(
        "OTEL_EXPORTER_OTLP_ENDPOINT",
        "https://api.smith.langchain.com/otel",
    ).rstrip("/")

    exporter = OTLPSpanExporter(
        endpoint=f"{endpoint_base}/v1/traces",
        headers={
            "x-api-key": os.environ["LANGSMITH_API_KEY"],
            "Langsmith-Project": experiment_id,
        },
        timeout=10,
    )

    provider = TracerProvider(
        resource=Resource.create(
            {
                "service.name": "faq-otel-eval",
                "deployment.environment": "study",
            }
        )
    )
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
```

이미 애플리케이션이 OTEL provider를 직접 세팅하고 있다면 새 provider를 또 만들기보다 기존 provider에 exporter 또는 processor를 붙이는 편이 낫다.

## 3. 각 실행 span을 example과 experiment에 연결한다

실제 평가 연결은 span attribute에서 끝난다.  
공식 문서 기준으로 OTEL 평가에서 특히 중요한 필드는 아래 다섯 개다.

- `langsmith.trace.session_id`: trace를 experiment session으로 라우팅
- `langsmith.reference_example_id`: trace를 dataset example과 연결
- `langsmith.span.kind`: `llm`, `chain`, `tool` 같은 span 타입 지정
- `inputs`: 실행 입력 기록
- `outputs`: 실행 출력 기록

아래 예제는 외부 OTEL 계측 앱을 흉내 낸 최소 패턴이다.

```python
import json
from opentelemetry import trace


def answer_faq(question: str) -> str:
    question_lc = question.lower()
    if "환불" in question_lc:
        return "환불은 결제 후 7일 이내에 신청할 수 있습니다."
    if "배송" in question_lc:
        return "평균 배송 기간은 영업일 기준 2일에서 3일입니다."
    return "정책 문서를 확인한 뒤 다시 안내하겠습니다."


def run_example(question: str, example_id: str, experiment_id: str) -> str:
    tracer = trace.get_tracer("langsmith.otel.eval")

    with tracer.start_as_current_span("faq_app") as span:
        span.set_attribute("langsmith.trace.session_id", experiment_id)
        span.set_attribute("langsmith.reference_example_id", example_id)
        span.set_attribute("langsmith.span.kind", "chain")
        span.set_attribute(
            "inputs",
            json.dumps({"question": question}, ensure_ascii=False),
        )

        answer = answer_faq(question)

        span.set_attribute(
            "outputs",
            json.dumps({"answer": answer}, ensure_ascii=False),
        )
        return answer
```

문서 예시처럼 `inputs`와 `outputs`는 간단한 문자열로 넣어도 되지만, 나중에 비교 뷰와 디버깅에서 읽기 쉽게 JSON 문자열 형태로 남겨 두는 편이 무난하다.

## 4. dataset example을 순회하면서 실험을 실행한다

이제 LangSmith dataset example을 읽어 와서 각 example마다 한 번씩 앱을 호출하면 된다.

```python
from langsmith import Client
from opentelemetry import trace


client = Client()
dataset_id = "11111111-2222-3333-4444-555555555555"

project = client.create_project(
    project_name="faq-otel-eval-2026-07-04",
    reference_dataset_id=dataset_id,
)
experiment_id = str(project.id)

configure_otel(experiment_id)

for example in client.list_examples(dataset_id=dataset_id):
    question = str(example.inputs["question"])
    output = run_example(
        question=question,
        example_id=str(example.id),
        experiment_id=experiment_id,
    )
    print(example.id, output)

trace.get_tracer_provider().force_flush()
```

이렇게 실행하면 LangSmith experiment 안에 example별 trace가 쌓이고, dataset에 연결된 evaluator가 있다면 점수도 함께 붙는다.

## 5. 실행 직후 experiment 통계를 다시 읽어 확인한다

trace 전송과 evaluator 반영은 약간의 지연이 있을 수 있다.  
실행 직후 `read_project(..., include_stats=True)`로 다시 읽어 보면 experiment가 제대로 채워졌는지 확인하기 쉽다.

```python
import time
from langsmith import Client


client = Client()

time.sleep(5)
project = client.read_project(
    project_id=experiment_id,
    include_stats=True,
)

print(project.name)
print(project.run_count)
print(project.feedback_stats)
```

이 단계에서 `run_count`는 늘었는데 `feedback_stats`가 비어 있다면 보통 dataset evaluator가 연결되지 않았거나 아직 처리 중인 경우가 많다.

## 운영 팁

OTEL 기반 실험은 아래 기준으로 굴리면 정리가 쉽다.

1. experiment 이름에 날짜나 git SHA를 넣어 배치 실행과 연결한다
2. `service.name`, `deployment.environment`, `langsmith.metadata.*`를 같이 남겨 서비스 단위 필터를 쉽게 만든다
3. example 입력 키를 한 가지로 고정해 반복 실행 코드를 단순화한다
4. exporter는 batch processor를 쓰고 마지막에 `force_flush()`를 호출한다
5. 여러 서비스가 같은 trace에 참여하면 parent-child 관계보다 먼저 experiment/example 연결부터 안정화한다

## 자주 틀리는 점

### 1. `reference_dataset_id` 없이 project만 만든다

experiment는 생겨도 dataset example과 비교 실험으로 이어지지 않는다.  
OTEL 평가 목적이면 `create_project(..., reference_dataset_id=dataset_id)`를 먼저 확인하는 편이 좋다.

### 2. `langsmith.reference_example_id`에 외부 row ID를 넣는다

여기에는 LangSmith dataset 내부의 example ID가 들어가야 한다.  
사내 DB row ID나 CSV 인덱스를 넣으면 experiment trace와 example이 연결되지 않는다.

### 3. 헤더의 `Langsmith-Project`와 span의 `langsmith.trace.session_id`를 따로 논다

문서 예시는 둘 다 experiment 흐름을 가리키도록 잡는다.  
실무에서도 둘을 같은 experiment ID로 맞춰 두는 편이 예측 가능하다.

### 4. exporter flush 전에 프로세스가 종료된다

BatchSpanProcessor는 비동기로 보내기 때문에 짧은 배치 스크립트에서는 마지막 `force_flush()`나 `shutdown()`이 중요하다.

### 5. self-hosted endpoint를 cloud 기본값 그대로 둔다

문서 기준으로 self-hosted는 `.../api/v1/otel`와 LangSmith API base를 따로 맞춰야 한다.  
cloud 예제를 그대로 쓰면 trace가 아예 안 들어오거나 다른 환경으로 날아간다.

### 6. 점수가 안 보이는데 trace 연결 문제로만 생각한다

trace는 정상이어도 dataset evaluator가 없으면 score는 자동으로 생기지 않는다.  
OTEL 평가는 trace 라우팅과 evaluator 연결을 따로 점검해야 한다.

## 이 방식과 `evaluate()`의 차이

정리하면 역할이 다르다.

- `evaluate()`: LangSmith가 실행 루프와 evaluator 연결을 더 많이 대신해 준다
- OTEL 평가: 기존 애플리케이션 실행 방식을 유지한 채 trace와 example 연결만 LangSmith에 맡긴다

이미 OTEL 표준 계측이 깔린 서비스라면 두 번째 방식이 아키텍처를 덜 흔든다.  
반대로 Python 실험 스크립트를 새로 짜는 단계라면 `evaluate()`가 더 단순하다.

## 참고 자료

- [How to evaluate with OpenTelemetry](https://docs.langchain.com/langsmith/evaluate-with-opentelemetry)
- [Trace with OpenTelemetry](https://docs.langchain.com/langsmith/trace-with-opentelemetry)
- [Run an evaluation with the LangSmith SDK](https://docs.langchain.com/langsmith/evaluation-quickstart)
