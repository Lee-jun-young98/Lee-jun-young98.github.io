---
title: "LangSmith에서 민감정보를 가리고 trace는 남기는 방법"
description: "LangSmith의 hide_inputs, anonymizer, process_inputs, tracing_context를 이용해 PII를 마스킹하면서 운영 trace 구조는 유지하는 실전 노트"
date: 2026-06-26
tags:
  - langsmith
  - observability
  - privacy
  - python
aliases:
  - "/blog/langsmith-mask-sensitive-traces"
---

# LangSmith에서 민감정보를 가리고 trace는 남기는 방법

LangSmith tracing을 운영에 붙이면 금방 이런 문제가 생긴다.

- "trace는 남기고 싶은데 이메일, 전화번호, 카드번호는 그대로 보내면 안 된다"
- "일부 고객은 zero-retention 정책이라 아예 trace를 끄고 싶다"
- "대부분은 그대로 추적하되 특정 tenant만 입력/출력만 비우고 싶다"
- "마스킹 로직이 무거워서 요청마다 동기 처리하면 느려진다"

이럴 때 핵심은 tracing을 통째로 끄는 것과, trace 구조는 남기되 내용만 가리는 것을 구분하는 것이다.  
2026년 6월 26일 기준 LangSmith 공식 문서는 아래 옵션을 각각 제공한다.

- 전체 입력/출력 숨기기: `hide_inputs`, `hide_outputs`
- 메타데이터 숨기기: `hide_metadata`
- 규칙 기반 익명화: `create_anonymizer(...)`
- 함수 단위 가공: `@traceable(process_inputs=..., process_outputs=...)`
- 요청 단위 제어: `tracing_context(...)`
- 고처리량 배치 익명화: `process_buffered_run_ops`

이 글에서는 실무에서 바로 쓰는 선택 기준과 Python 예제만 정리한다.

## 언제 어떤 방식이 맞는가

### 1. trace는 필요 없고 해당 요청은 아예 저장하면 안 된다

이 경우는 masking보다 `tracing_context(enabled=False)` 같은 조건부 tracing disable이 더 맞다.

### 2. trace timing, error, parent-child 구조는 남기고 싶다

이 경우는 tracing은 유지하고 입력/출력만 비우거나 익명화한다.

### 3. 모든 요청에 공통 정책이 있다

클라이언트 레벨 `hide_inputs`, `hide_outputs`, `hide_metadata`, `anonymizer`가 단순하다.

### 4. 특정 함수 한 곳만 payload를 줄이고 싶다

`@traceable(process_inputs=..., process_outputs=...)`가 가장 명확하다.

### 5. 외부 PII 탐지기나 무거운 정규식 때문에 요청당 비용이 크다

Python SDK의 `process_buffered_run_ops` 배치 처리까지 고려할 가치가 있다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith openai
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_TRACING="true"
```

## 1. 가장 강한 옵션은 입력/출력을 통째로 숨기는 것이다

공식 문서 기준으로 가장 단순한 방법은 `LANGSMITH_HIDE_INPUTS=true`, `LANGSMITH_HIDE_OUTPUTS=true`를 쓰거나 `Client(...)`에서 숨김 함수를 주는 것이다.

```python
from openai import OpenAI
from langsmith import Client
from langsmith.wrappers import wrap_openai

openai_client = wrap_openai(OpenAI())
langsmith_client = Client(
    hide_inputs=lambda inputs: {},
    hide_outputs=lambda outputs: {},
)

response = openai_client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[
        {"role": "system", "content": "You are a support assistant."},
        {"role": "user", "content": "My email is user@example.com"},
    ],
    langsmith_extra={"client": langsmith_client},
)

print(response.choices[0].message.content)
```

이 방식의 장점은 확실하다는 점이다.  
단점은 나중에 trace를 디버깅할 때 실제 prompt나 response 내용을 전혀 볼 수 없다는 점이다.

그래서 보통은 아래처럼 고른다.

- 규제가 매우 강한 요청: 통째로 숨김
- 일반 운영 요청: 부분 익명화

## 2. 메타데이터도 종종 같이 정리해야 한다

입력/출력만 가려도 `metadata`에 `user_id`, `email`, `internal_ticket_id`를 그대로 넣어 두면 소용이 없다.  
LangSmith 공식 문서는 `hide_metadata=True` 또는 변환 함수를 지원한다.

```python
from langsmith import Client


def redact_metadata(metadata: dict) -> dict:
    result = {}
    for key, value in metadata.items():
        if key in {"email", "phone", "customer_name"}:
            result[key] = "[REDACTED]"
        else:
            result[key] = value
    return result


client = Client(hide_metadata=redact_metadata)
```

메타데이터를 운영 필터에 쓰고 있다면, 완전 제거보다 "필터링에 필요한 최소값만 남기는 변환"이 더 실용적이다.

## 3. 부분 익명화는 `create_anonymizer(...)`가 가장 다루기 쉽다

공식 문서 기준으로 rule-based masking은 Python SDK `0.1.81+`에서 지원된다.  
이 방식은 문자열 전체를 JSON 직렬화 후 처리하므로, 부분 치환이 필요할 때 가장 편하다.

```python
from openai import OpenAI
from langsmith import Client
from langsmith.anonymizer import create_anonymizer
from langsmith.wrappers import wrap_openai

anonymizer = create_anonymizer(
    [
        {
            "pattern": r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
            "replace": "<email>",
        },
        {
            "pattern": r"\b(?:\d[ -]*?){13,16}\b",
            "replace": "<card-number>",
        },
    ]
)

langsmith_client = Client(anonymizer=anonymizer)
openai_client = wrap_openai(OpenAI())

openai_client.chat.completions.create(
    model="gpt-5.4-mini",
    messages=[
        {"role": "system", "content": "Summarize the issue."},
        {
            "role": "user",
            "content": "Customer email is jane@example.com and card is 4111 1111 1111 1111.",
        },
    ],
    langsmith_extra={"client": langsmith_client},
)
```

이 방식은 trace 구조를 유지하면서 값 일부만 치환할 수 있어서 운영성이 좋다.  
다만 공식 문서도 큰 payload와 복잡한 정규식에서는 성능 저하가 있을 수 있다고 명시한다.

## 4. 특정 함수만 가공할 때는 `process_inputs`와 `process_outputs`가 더 낫다

공식 문서 기준으로 `process_outputs`는 Python SDK `0.1.98+`에서 지원된다.  
한 함수의 입력/출력 표현만 바꾸고 싶다면 클라이언트 전체 정책보다 이쪽이 훨씬 안전하다.

```python
from langsmith import traceable


def process_inputs(inputs: dict) -> dict:
    user_text = inputs.get("message", "")
    return {
        "message_preview": user_text[:40],
        "message_length": len(user_text),
    }


def process_outputs(output: dict) -> dict:
    return {
        "answer_preview": output["answer"][:60],
        "used_tools": output.get("used_tools", []),
    }


@traceable(process_inputs=process_inputs, process_outputs=process_outputs)
def answer_customer(message: str) -> dict:
    return {
        "answer": f"Processed: {message}",
        "used_tools": ["lookup_order"],
    }


answer_customer("주문자 이메일은 jane@example.com 이고 환불 계좌는 123-456-789 입니다.")
```

이 패턴은 아래 상황에 특히 좋다.

- prompt 전문은 남기지 않고 길이와 일부 미리보기만 보고 싶다
- binary나 대형 JSON을 trace에서 가볍게 축약하고 싶다
- 특정 tool 출력만 커스텀 형식으로 남기고 싶다

## 5. tenant별로 정책이 다르면 `tracing_context(...)`가 가장 중요하다

공식 문서에서 `tracing_context`는 전역 tracing 설정보다 높은 우선순위를 가진다.  
그래서 `LANGSMITH_TRACING=true`를 켜 둔 상태에서도 요청별로 끄거나, 다른 project로 보내거나, 일부 필드만 비울 수 있다.

### 아예 tracing을 끄는 예시

```python
import langsmith as ls
from langsmith import traceable


@traceable
def run_agent(user_input: str) -> str:
    return f"processed: {user_input}"


def handle_request(tenant_id: str, user_input: str) -> str:
    zero_retention_tenants = {"enterprise-a", "enterprise-b"}
    with ls.tracing_context(enabled=tenant_id not in zero_retention_tenants):
        return run_agent(user_input)
```

### trace는 남기되 입력/출력만 비우는 예시

공식 문서는 이 경우 `replicas`와 `updates`를 사용한 요청 단위 redaction을 안내한다.

```python
import langsmith as ls
from langsmith import traceable


@traceable
def run_agent(user_input: str) -> str:
    return f"processed: {user_input}"


def handle_request(tenant_id: str, user_input: str) -> str:
    replica = {"project_name": "support-prod"}

    if tenant_id in {"privacy-strict-a", "privacy-strict-b"}:
        replica["updates"] = {"inputs": {}, "outputs": {}}

    with ls.tracing_context(replicas=[replica]):
        return run_agent(user_input)
```

여기서 중요한 함정도 공식 문서에 있다.  
`updates`로 redact할 때는 replica에 `project_name`을 명시해야 한다. 그렇지 않으면 업데이트가 드롭되어 원문 입력/출력이 기록될 수 있다.

## 6. 고처리량 마스킹은 `process_buffered_run_ops`로 넘기는 편이 낫다

공식 문서 기준으로 `process_buffered_run_ops`는 Python SDK 전용이다.  
이 방식은 run dict 배치를 한 번에 가로채고 가공하므로, 외부 PII 탐지기나 모델 호출 기반 익명화에 유리하다.

문서 기준 배치 flush 조건도 중요하다.

- `run_ops_buffer_size` 개수에 도달하면 flush
- 또는 `run_ops_buffer_timeout_ms`가 지나면 flush
- `process_buffered_run_ops`와 `run_ops_buffer_size`는 함께 설정해야 한다
- 종료 전 `client.flush()` 호출이 필요하다

```python
from langsmith import Client, traceable


def redact_batch(runs: list[dict]) -> list[dict]:
    for run in runs:
        if isinstance(run.get("inputs"), dict) and "messages" in run["inputs"]:
            for message in run["inputs"]["messages"]:
                content = message.get("content", "")
                message["content"] = content.replace("@", "[at]")
    return runs


client = Client(
    process_buffered_run_ops=redact_batch,
    run_ops_buffer_size=100,
    run_ops_buffer_timeout_ms=3000,
)


@traceable(client=client)
def call_model(messages: list[dict]) -> dict:
    return {"ok": True}


try:
    call_model([{"role": "user", "content": "email me at jane@example.com"}])
finally:
    client.flush()
```

이건 정확한 PII 탐지 품질보다 처리량과 비용 최적화가 더 중요한 환경에서 쓸 만하다.

## 자주 틀리는 점

### 1. 입력/출력만 가리면 끝이라고 생각한다

`metadata`, `tags`, `extra`에 민감정보가 남는 경우가 많다.  
trace payload 전체를 기준으로 정책을 봐야 한다.

### 2. 모든 요청에 같은 익명화 정책을 강제한다

tenant별 계약이 다르면 `tracing_context(...)`로 요청 단위 정책을 나누는 편이 낫다.

### 3. 익명화가 무거운데 요청마다 동기 처리한다

공식 문서도 큰 payload나 복잡한 익명화는 성능 비용이 있다고 적고 있다.  
처리량이 크면 배치 가공이나 더 단순한 규칙으로 내려야 한다.

### 4. trace를 꺼야 할 요청까지 굳이 마스킹만 한다

zero-retention 요구가 명확하면 masking보다 tracing disable이 맞다.  
trace 구조 자체가 남지 않아야 하는 경우가 있다.

### 5. 함수 가공기에서 원본 객체를 직접 변형한다

공식 문서는 processor 함수에서 원본 mutate보다 새 객체 반환을 권장한다.  
원본 공유 객체를 건드리면 애플리케이션 로직까지 엉킬 수 있다.

## 추천 운영 기준

개인적으로는 아래 기준이 가장 무난하다.

1. 기본 운영 프로젝트는 partial anonymization을 쓴다
2. strict tenant는 `tracing_context(enabled=False)` 또는 replica redaction을 쓴다
3. metadata는 allowlist 방식으로 최소 필드만 남긴다
4. 특정 함수는 `process_inputs`/`process_outputs`로 payload를 축약한다
5. 고처리량 환경은 배치 익명화로 넘기고 flush를 명시한다

핵심은 "관측 가능성을 유지할지"와 "데이터 원문을 남길지"를 분리해서 설계하는 것이다.  
이 기준만 잡혀도 LangSmith를 운영에 붙이면서 privacy 요구를 훨씬 덜 불안하게 다룰 수 있다.

## 참고 자료

- [Prevent logging of sensitive data in traces](https://docs.langchain.com/langsmith/mask-inputs-outputs)
- [Conditional tracing](https://docs.langchain.com/langsmith/conditional-tracing)
- [Add metadata and tags to traces](https://docs.langchain.com/langsmith/add-metadata-tags)
- [Observability concepts](https://docs.langchain.com/langsmith/observability-concepts)
