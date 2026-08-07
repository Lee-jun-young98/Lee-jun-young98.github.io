---
title: "LangSmith에 OpenTelemetry Python trace 보내기"
description: "LangChain 없이 만든 Python 서비스의 OpenTelemetry span을 LangSmith로 내보내고 입력·출력·토큰·metadata를 올바른 run 필드로 매핑하는 실전 노트"
date: 2026-08-07
tags:
  - langsmith
  - tracing
  - opentelemetry
  - python
  - observability
aliases:
  - "/blog/langsmith-trace-with-opentelemetry-python"
---

# LangSmith에 OpenTelemetry Python trace 보내기

LangChain을 쓰지 않는 FastAPI 서비스, 자체 agent runtime, 다른 LLM SDK에도 이미 OpenTelemetry가 붙어 있다면 tracing 코드를 LangSmith 전용 API로 다시 작성할 필요가 없다. 표준 OTLP/HTTP exporter가 span을 LangSmith 수집 endpoint로 보내게 하고, LangSmith가 이해하는 attribute를 추가하면 된다.

이 글은 **일반 Python 애플리케이션 → OTLP exporter → LangSmith project** 흐름만 다룬다. OpenTelemetry trace를 dataset experiment로 평가하는 방법은 [[libraries/langsmith/langsmith-evaluate-with-opentelemetry|OpenTelemetry trace를 LangSmith experiment로 평가하기]]에서 이어서 볼 수 있다.

## 사전 준비

- LangSmith API key
- Python 3.10 이상 권장
- SaaS region에 맞는 LangSmith API endpoint

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U opentelemetry-sdk opentelemetry-exporter-otlp
```

PowerShell에서는 다음처럼 설정한다.

```powershell
$env:OTEL_EXPORTER_OTLP_ENDPOINT="https://api.smith.langchain.com/otel"
$env:OTEL_EXPORTER_OTLP_HEADERS="x-api-key=lsv2_your_key,Langsmith-Project=otel-python-demo"
```

EU 또는 AWS-hosted US SaaS, self-hosted LangSmith를 쓴다면 base URL이 다르다. self-hosted endpoint에는 `/api/v1/otel`을 붙인다. API key가 여러 workspace에 연결되어 있다면 현재 공식 문서의 workspace routing 설정도 함께 확인한다.

## 최소 실행 예제

아래 예제는 외부 LLM 호출 없이 실행된다. `OTLPSpanExporter()`는 위의 표준 환경 변수를 읽고, `BatchSpanProcessor`는 application thread를 오래 막지 않도록 span을 묶어 전송한다.

```python
import json

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor


provider = TracerProvider(
    resource=Resource.create({"service.name": "support-router"})
)
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(timeout=10)))
trace.set_tracer_provider(provider)
tracer = trace.get_tracer("support-router")


def route_question(question: str) -> dict[str, str]:
    with tracer.start_as_current_span("route-support-question") as span:
        result = {"queue": "billing" if "결제" in question else "general"}

        span.set_attribute("langsmith.trace.name", "support-router")
        span.set_attribute("langsmith.span.kind", "chain")
        span.set_attribute("langsmith.span.tags", "production,router")
        span.set_attribute("langsmith.metadata.release", "2026-08-07")
        span.set_attribute("langsmith.metadata.tenant_tier", "free")
        span.set_attribute("input.value", json.dumps({"question": question}, ensure_ascii=False))
        span.set_attribute("output.value", json.dumps(result, ensure_ascii=False))
        return result


print(route_question("결제 내역을 확인하고 싶어요"))

# 짧게 실행되는 script·job은 process 종료 전에 남은 batch를 보낸다.
provider.shutdown()
```

실행 후 LangSmith의 `otel-python-demo` project에서 `support-router` trace를 확인한다. parent span 안에서 child span을 만들면 OpenTelemetry context가 같은 thread/task에서 자동으로 전달되어 LangSmith에도 하나의 trace tree로 표시된다.

## attribute가 LangSmith 화면에서 보이는 위치

단순히 span 이름과 duration만 보내도 trace는 생성된다. 하지만 LLM application 분석에 필요한 필드를 얻으려면 의미 있는 attribute를 넣어야 한다.

| OpenTelemetry attribute | LangSmith 필드 | 용도 |
|---|---|---|
| `langsmith.trace.name` | run name | span 이름 대신 보여 줄 업무 이름 |
| `langsmith.span.kind` | run type | `llm`, `chain`, `tool`, `retriever` 등 |
| `langsmith.span.tags` | tags | 쉼표로 구분한 검색·dashboard tag |
| `langsmith.metadata.<key>` | metadata | release, tenant, environment 같은 filter 기준 |
| `input.value` | inputs | OpenInference 호환 입력 JSON 문자열 |
| `output.value` | outputs | OpenInference 호환 출력 JSON 문자열 |
| `gen_ai.request.model` | invocation model | 요청한 model 이름 |
| `gen_ai.usage.input_tokens` | input token usage | 비용·사용량 집계 입력 |
| `gen_ai.usage.output_tokens` | output token usage | 비용·사용량 집계 출력 |

`langsmith.span.kind`에는 `llm`, `chain`, `tool`, `retriever`, `embedding`, `prompt`, `parser` 중 실제 역할과 맞는 값을 쓴다. 임의 값을 넣으면 LangSmith의 run type 기반 분석이 기대대로 동작하지 않을 수 있다.

## LLM child span 기록하기

실제 provider SDK 호출을 `llm` child span으로 감싸면 latency, model, token 사용량을 상위 request와 함께 볼 수 있다. 다음 함수의 `call_model()` 부분만 사용하는 provider SDK로 바꾸면 된다.

```python
import json
from opentelemetry import trace

tracer = trace.get_tracer("support-router")


def call_model(prompt: str) -> dict:
    # 예제용 고정 응답. 실제 코드에서는 provider SDK를 호출한다.
    return {
        "text": "billing",
        "model": "example-model-v1",
        "input_tokens": 18,
        "output_tokens": 3,
    }


def classify(prompt: str) -> str:
    with tracer.start_as_current_span("classify-request") as root:
        root.set_attribute("langsmith.span.kind", "chain")
        root.set_attribute("input.value", json.dumps({"prompt": prompt}))

        with tracer.start_as_current_span("chat-completion") as llm_span:
            llm_span.set_attribute("langsmith.span.kind", "llm")
            llm_span.set_attribute("gen_ai.system", "custom")
            llm_span.set_attribute("gen_ai.request.model", "example-model-v1")
            response = call_model(prompt)
            llm_span.set_attribute("gen_ai.response.model", response["model"])
            llm_span.set_attribute(
                "gen_ai.usage.input_tokens", response["input_tokens"]
            )
            llm_span.set_attribute(
                "gen_ai.usage.output_tokens", response["output_tokens"]
            )
            llm_span.set_attribute(
                "output.value", json.dumps({"text": response["text"]})
            )

        root.set_attribute("output.value", json.dumps({"label": response["text"]}))
        return response["text"]
```

LangSmith pricing table에 provider와 model 조합이 등록되어 있어야 token 수가 비용으로 환산된다. 자체 model은 [[libraries/langsmith/langsmith-custom-cost-tracking-usage-metadata|custom model과 tool 비용 추적하기]]의 가격·usage 조건을 함께 확인한다.

## project와 endpoint를 코드에서 명시하기

환경 변수 대신 exporter 생성자에 값을 넘길 수도 있다. 특히 `/v1/traces`가 필요한 exporter 설정인지 명확하게 통제하고 싶을 때 유용하다.

```python
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

exporter = OTLPSpanExporter(
    endpoint="https://api.smith.langchain.com/otel/v1/traces",
    headers={
        "x-api-key": "lsv2_your_key",
        "Langsmith-Project": "otel-python-demo",
    },
    timeout=10,
)
```

API key를 source code에 하드코딩하지 말고 secret manager에서 읽는다. 환경변수의 `OTEL_EXPORTER_OTLP_ENDPOINT`는 exporter 종류에 따라 base endpoint 뒤에 `/v1/traces`를 자동으로 붙일 수 있지만, `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`나 생성자의 `endpoint=`는 trace 전용 최종 URL로 설정하는 것이 안전하다.

## 운영에서는 Collector를 사이에 두기

application이 LangSmith로 직접 내보내는 구성은 시작하기 쉽다. 여러 backend로 fan-out하거나 retry queue, sampling, redaction을 중앙화해야 한다면 application은 로컬 OpenTelemetry Collector로 보내고 Collector가 LangSmith와 다른 observability backend로 전달하게 한다.

```text
Python service
  -> OTLP/HTTP
OpenTelemetry Collector
  -> LangSmith OTLP endpoint
  -> 기존 APM backend
```

이 구조에서는 Collector 설정에 LangSmith API key가 들어가므로 application image에 key를 배포하지 않아도 된다. 반면 Collector 장애가 모든 telemetry 경로에 영향을 주므로 health check, memory limiter, retry·queue 크기를 운영 부하에 맞춰야 한다.

## 흔한 실수

### endpoint path를 두 번 붙인다

base endpoint와 trace-specific endpoint의 규칙을 섞으면 `/v1/traces/v1/traces`처럼 잘못된 URL이 된다. 실제로 사용하는 exporter가 어느 환경 변수를 읽는지 확인하고 debug log에서 최종 요청 URL을 본다.

### 짧은 script가 끝나자마자 trace가 사라진다

`BatchSpanProcessor`는 background batch를 사용한다. CLI, test, serverless handler처럼 process가 바로 끝나는 경로에서는 정상 종료 시 `provider.shutdown()` 또는 `force_flush()`를 호출한다.

### 모든 span을 `llm`으로 표시한다

request orchestration은 `chain`, 외부 함수는 `tool`, vector search는 `retriever`, 실제 model 호출만 `llm`으로 구분한다. 그래야 latency와 error를 역할별로 분석할 수 있다.

### 입력과 출력을 평문 attribute로 무조건 남긴다

prompt, tool argument, 검색 문서에는 개인정보와 secret이 들어갈 수 있다. span 생성 전 allowlist·redaction을 적용하고, Collector gateway에서 한 번 더 방어하는 구성을 고려한다.

### server에서 global provider를 여러 번 설정한다

`trace.set_tracer_provider()`는 application startup에서 한 번만 호출한다. hot reload나 request handler 안에서 재설정하면 provider override 경고, 중복 exporter, 누락된 parent context가 생길 수 있다.

### 200 응답만 보고 필드 매핑까지 성공했다고 가정한다

trace tree, run type, inputs/outputs, metadata, token usage를 LangSmith UI에서 각각 확인한다. 수집 성공과 semantic mapping 성공은 다른 문제다.

## 확인 체크리스트

- root와 child span이 같은 trace tree로 묶였는가
- project가 `default`가 아니라 의도한 이름인가
- `chain`, `llm`, `tool`, `retriever` run type이 맞는가
- 입력·출력이 JSON 구조로 읽히는가
- release와 tenant metadata로 filter할 수 있는가
- token usage와 비용이 기대대로 집계되는가
- CLI와 worker 종료 시 남은 batch를 flush하는가
- 민감정보가 exporter 앞에서 제거되는가

## 참고 자료

- [Trace with OpenTelemetry](https://docs.langchain.com/langsmith/trace-with-opentelemetry)
- [Evaluate with OpenTelemetry](https://docs.langchain.com/langsmith/evaluate-with-opentelemetry)
- [Log traces to a specific project](https://docs.langchain.com/langsmith/log-traces-to-project)
- [OpenTelemetry Python SDK](https://opentelemetry.io/docs/languages/python/)
