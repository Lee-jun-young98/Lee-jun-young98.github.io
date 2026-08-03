---
title: "LangSmith usage_metadata로 custom model과 tool 비용 추적하기"
description: "LangSmith trace에 token usage와 직접 계산한 비용을 기록해 custom·self-hosted model과 유료 tool의 비용을 한곳에서 분석하는 방법을 정리한 실전 노트"
date: 2026-08-03
tags:
  - langsmith
  - observability
  - cost-tracking
  - python
aliases:
  - "/blog/langsmith-custom-cost-tracking-usage-metadata"
---

# LangSmith usage_metadata로 custom model과 tool 비용 추적하기

OpenAI나 Anthropic용 LangSmith wrapper를 쓰면 token과 비용이 대부분 자동으로 기록된다. 하지만 사내 inference server, 직접 만든 model wrapper, 검색 API처럼 표준 응답 형식 밖의 구성 요소는 비용이 비어 있기 쉽다.

이때 trace의 `usage_metadata`에 사용량 또는 비용을 넣으면 LangSmith의 trace tree, project stats, dashboard에서 애플리케이션 비용을 함께 볼 수 있다. 핵심은 다음 두 경로를 구분하는 것이다.

- token 수와 model 정보를 보내고 LangSmith pricing table로 비용을 계산한다.
- 비선형 요금이나 tool 호출은 애플리케이션이 계산한 비용을 직접 보낸다.

## 언제 쓰면 좋은가

- vLLM, TGI 같은 self-hosted endpoint를 자체 wrapper로 호출할 때
- OpenAI 호환 API가 token usage를 자동 계측 형식으로 반환하지 않을 때
- cache read, reasoning, image token을 일반 token과 나눠 보고 싶을 때
- web search, OCR, vector search처럼 요청당 과금되는 tool 비용을 trace에 합산할 때

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U langsmith
```

PowerShell에서는 tracing 환경 변수를 설정한다.

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_TRACING="true"
$env:LANGSMITH_PROJECT="support-agent-cost-lab"
```

custom model의 비용을 token 수로 자동 계산하려면 LangSmith의 **Settings → Model Pricing**에서 provider와 model에 맞는 가격 항목도 준비해야 한다. 기본 pricing table에 있는 model이면 기존 항목을 사용할 수 있다.

## 1. custom model의 token usage 기록하기

`run_type="llm"`인 run에 `ls_provider`, `ls_model_name`, `usage_metadata`가 함께 있어야 pricing table과 안정적으로 연결된다. 실제 provider 호출 부분을 mock으로 바꾼 아래 예제는 그대로 실행할 수 있다.

```python
from langsmith import get_current_run_tree, traceable


@traceable(
    name="InternalChatModel",
    run_type="llm",
    metadata={
        "ls_provider": "internal",
        "ls_model_name": "support-8b-v3",
    },
)
def chat_model(messages: list[dict]) -> dict:
    # 실제 코드에서는 provider 응답에서 token usage를 꺼낸다.
    response = {
        "message": {
            "role": "assistant",
            "content": "환불 접수 번호를 알려 주세요.",
        },
        "usage": {
            "prompt_tokens": 31,
            "completion_tokens": 12,
        },
    }

    input_tokens = response["usage"]["prompt_tokens"]
    output_tokens = response["usage"]["completion_tokens"]

    get_current_run_tree().set(
        usage_metadata={
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
        }
    )
    return response["message"]


result = chat_model(
    [{"role": "user", "content": "환불 진행 상황을 확인하고 싶어요."}]
)
print(result)
```

`run.set(...)`을 쓰면 애플리케이션의 반환 형식을 바꾸지 않아도 된다. 반환 dict의 최상위 `usage_metadata`로 보내는 방식도 지원하지만, 호출자가 그 필드를 실제 model 출력으로 오해하지 않도록 계약을 분명히 해야 한다.

## 2. cache와 reasoning token 세분화하기

전체 token만 보내도 되지만 subtype을 함께 기록하면 가격이 다른 token을 구분할 수 있다.

```python
run.set(
    usage_metadata={
        "input_tokens": 1_000,
        "output_tokens": 220,
        "total_tokens": 1_220,
        "input_token_details": {"cache_read": 600, "text": 400},
        "output_token_details": {"reasoning": 80, "text": 140},
    }
)
```

`input_tokens`와 `output_tokens`는 각각 subtype의 전체 합이다. 예를 들어 `input_tokens=1_000`에 `cache_read=600`을 넣으면 기본 input 가격은 남은 400 token에 적용된다. subtype을 전체 token에 더해 1,600으로 계산하면 이중 집계가 된다.

## 3. 비선형 model 비용을 직접 보내기

subscription credit, batch discount, GPU 실행 시간처럼 token당 단가로 표현하기 어려우면 비용을 애플리케이션에서 계산해 보낸다.

```python
from langsmith import get_current_run_tree, traceable


@traceable(
    name="BatchInference",
    run_type="llm",
    metadata={
        "ls_provider": "internal",
        "ls_model_name": "support-8b-batch",
    },
)
def batch_inference(prompts: list[str]) -> list[str]:
    outputs = [f"answer:{prompt}" for prompt in prompts]
    input_cost = 0.0008
    output_cost = 0.0012

    get_current_run_tree().set(
        usage_metadata={
            "input_tokens": 400,
            "output_tokens": 120,
            "input_cost": input_cost,
            "output_cost": output_cost,
            "total_cost": input_cost + output_cost,
        }
    )
    return outputs


print(batch_inference(["배송 조회", "환불 정책"]))
```

직접 비용을 보내는 run에서는 pricing table 계산과 어느 쪽을 신뢰할지 팀 규칙을 정한다. 같은 비용을 두 경로에서 중복 반영하지 않도록 실제 trace 한 건으로 UI 값을 먼저 검증하는 편이 안전하다.

## 4. tool과 retrieval 비용도 trace에 넣기

`usage_metadata`는 LLM run에만 한정되지 않는다. 요청당 과금되는 API나 retrieval service에는 `total_cost`를 직접 기록할 수 있다.

```python
from langsmith import get_current_run_tree, traceable


@traceable(name="search_docs", run_type="tool")
def search_docs(query: str) -> list[dict]:
    documents = [
        {"title": "환불 정책", "score": 0.93},
        {"title": "결제 취소", "score": 0.87},
    ]

    # 예: search API 요청 1회 가격
    get_current_run_tree().set(
        usage_metadata={"total_cost": 0.0015}
    )
    return documents


print(search_docs("환불 가능한 기간"))
```

parent trace에서는 child run의 비용이 합산되어 보이므로 model, 검색, OCR 비용을 하나의 사용자 요청 단위로 비교할 수 있다.

## 5. thread 비용 집계가 필요하면 child run에도 thread metadata 넣기

대화 단위 비용을 보려면 관련 run들이 같은 thread 식별자를 가져야 한다. 특히 직접 만든 child run에서 metadata를 누락하면 thread-level 합계에서 비용이 빠질 수 있다.

```python
from langsmith import tracing_context


thread_metadata = {"thread_id": "support-case-20260803-001"}

with tracing_context(metadata=thread_metadata):
    answer = chat_model(
        [{"role": "user", "content": "환불 진행 상황을 확인하고 싶어요."}]
    )
    docs = search_docs("환불 가능한 기간")
```

서비스 경계를 넘는 분산 trace라면 trace header뿐 아니라 thread metadata의 전파도 별도로 확인한다.

## 자주 틀리는 부분

### `ls_model_name`만 넣으면 비용이 계산된다고 생각한다

자동 계산에는 token usage, `ls_provider`, `ls_model_name`, 일치하는 pricing entry가 모두 필요하다. 하나라도 빠지면 token은 보이지만 cost가 비어 있을 수 있다.

### provider 응답의 키를 그대로 넣는다

provider가 `prompt_tokens`, `completion_tokens`를 반환하더라도 LangSmith `usage_metadata`에는 `input_tokens`, `output_tokens`로 변환한다.

### subtype token을 전체 token에 다시 더한다

`input_token_details`와 `output_token_details`는 합계의 구성 요소다. 별도 추가분이 아니다.

### pricing table을 바꾸면 과거 trace도 재계산된다고 기대한다

공식 문서 기준으로 model pricing 변경은 이미 기록된 trace 비용에 소급 적용되지 않으며 backfill도 지원하지 않는다. 단가를 바꿀 때는 적용 시점과 model name version을 함께 관리한다.

### LangSmith 사용료와 model 호출 비용을 같은 지표로 본다

이 글의 cost tracking은 애플리케이션이 사용한 model/tool 비용을 trace에 기록하는 기능이다. LangSmith 자체 billing의 trace 사용량과는 다른 개념이다.

## 추천 운영 흐름

1. provider adapter에서 응답별 token key를 표준 `usage_metadata`로 변환한다.
2. `ls_provider`와 version이 포함된 `ls_model_name`을 고정한다.
3. pricing table 항목을 만들고 대표 trace의 계산값을 수동 계산과 비교한다.
4. token 기반이 아닌 tool 비용은 해당 child run에 `total_cost`로 기록한다.
5. dashboard에서 project, model, environment별 비용 추세와 이상치를 감시한다.

이 구조를 잡아 두면 custom model로 옮기거나 agent에 유료 tool을 추가해도 비용 비교 기준을 같은 trace 안에서 유지할 수 있다.

## 참고 자료

- [Cost tracking](https://docs.langchain.com/langsmith/cost-tracking)
- [Log LLM calls](https://docs.langchain.com/langsmith/log-llm-trace)
- [Metadata parameters reference](https://docs.langchain.com/langsmith/ls-metadata-parameters)
- [Configure threads](https://docs.langchain.com/langsmith/threads)
