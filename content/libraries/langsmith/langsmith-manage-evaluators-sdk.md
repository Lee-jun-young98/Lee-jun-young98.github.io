---
title: "LangSmith evaluators를 SDK로 생성·수정·비용 추적하기"
description: "LangSmith SDK로 code evaluator와 LLM-as-a-judge evaluator를 생성하고, prompt 연결, variable mapping, few-shot correction, spend 추적, 삭제까지 관리하는 실전 가이드"
date: 2026-07-07
tags:
  - langsmith
  - evaluation
  - python
  - llmops
aliases:
  - "/blog/langsmith-manage-evaluators-sdk"
---

# LangSmith evaluators를 SDK로 생성·수정·비용 추적하기

LangSmith를 쓰다 보면 평가 자체보다 "평가기를 어떻게 운영 자산처럼 관리할지"가 더 중요해질 때가 많습니다.

- 같은 evaluator를 여러 dataset과 tracing project에 재사용하고 싶다
- UI에서 수동으로 만들지 말고 코드로 버전 관리하고 싶다
- prompt judge와 code evaluator를 환경별로 같은 방식으로 배포하고 싶다
- online eval 비용이 어디서 많이 나가는지 추적하고 싶다

이럴 때는 `evaluate()`만 호출하는 단계에서 한 번 더 나아가, evaluator 자체를 SDK로 관리하는 패턴이 필요합니다.

공식 문서 기준으로 LangSmith evaluator는 workspace-level 리소스입니다. 한 번 만들어 두면 여러 tracing project와 dataset에 붙여 재사용할 수 있습니다.

## 사전 준비

공식 문서 기준으로 이 기능은 Python에서 `langsmith>=0.9.8`가 필요합니다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "langsmith>=0.9.8"
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_ENDPOINT="https://api.smith.langchain.com"
```

```python
from langsmith import Client

client = Client()
```

## 1. code evaluator 생성

문서 기준으로 code evaluator는 `client.evaluators.create()`에 `type="code"`와 `code_evaluator`를 넘겨 만들 수 있습니다.

```python
from langsmith import Client

client = Client()

created = client.evaluators.create(
    name="Correctness evaluator",
    type="code",
    code_evaluator={
        "code": (
            "def perform_eval(run, example):\n"
            "    predicted = (run.outputs or {}).get('answer', '')\n"
            "    expected = (example.outputs or {}).get('answer', '')\n"
            "    return {'score': float(predicted.strip() == expected.strip())}"
        ),
        "language": "python",
    },
)

evaluator_id = created.evaluator.id
print("created:", evaluator_id)
```

## 2. LLM-as-a-judge evaluator 생성

LLM judge evaluator는 structured prompt를 참조하고, run/example 필드를 prompt 변수에 매핑합니다.

```python
created = client.evaluators.create(
    name="Support answer judge",
    type="llm",
    llm_evaluator={
        "prompt_repo_handle": "<prompt-repo-handle>",
        "commit_hash_or_tag": "<commit-hash-or-tag>",
        "variable_mapping": {
            "input": "inputs.question",
            "output": "outputs.answer",
            "reference": "reference.answer",
        },
    },
)

llm_evaluator_id = created.evaluator.id
print("created:", llm_evaluator_id)
```

여기서 중요한 점은 `prompt_repo_handle`이 프롬프트 제목이나 URL이 아니라 내부 repo 이름이라는 점입니다.

## 3. prompt repo handle 조회

```python
for prompt in client.list_prompts(limit=10).repos:
    print("repo_handle =", prompt.repo_handle)
    print("full_name   =", prompt.full_name)
    print("description =", prompt.description)
    print("---")
```

특정 prompt를 바로 읽고 싶다면:

```python
prompt = client.get_prompt("<prompt-identifier>")
print(prompt.repo_handle)
```

## 4. evaluator 조회와 수정

```python
evaluator = client.evaluators.retrieve(llm_evaluator_id)

print(evaluator.name)
print(evaluator.type)
print(evaluator.feedback_keys)
print(evaluator.run_rules)
```

`update()`는 partial update 방식입니다.

```python
updated = client.evaluators.update(
    evaluator_id,
    name="Correctness evaluator v2",
    code_evaluator={
        "code": (
            "def perform_eval(run, example):\n"
            "    predicted = (run.outputs or {}).get('answer', '')\n"
            "    expected = (example.outputs or {}).get('answer', '')\n"
            "    return {'score': float(expected.lower() in predicted.lower())}"
        ),
        "language": "python",
    },
)

print(updated.evaluator.name if updated.evaluator else None)
```

```python
client.evaluators.update(
    llm_evaluator_id,
    llm_evaluator={
        "prompt_repo_handle": "<prompt-repo-handle>",
        "commit_hash_or_tag": "prod",
        "variable_mapping": {
            "input": "inputs.question",
            "output": "outputs.answer",
        },
        "use_corrections_dataset": True,
        "num_few_shot_examples": 3,
    },
)
```

문서 기준으로 이런 runtime 설정은 다음 평가 실행부터 반영됩니다.

## 5. `list()`와 `spend()`

`client.evaluators.list()`는 필터링과 정렬을 지원하고, 반환 객체를 직접 순회하면 전체 매치를 auto-pagination 합니다. `limit`은 총 결과 수가 아니라 요청당 페이지 크기입니다.

```python
page = client.evaluators.list(
    name_contains="judge",
    type="llm",
    limit=10,
)

for evaluator in page.evaluators:
    print(evaluator.id, evaluator.name, evaluator.type)
```

```python
evaluators = list(
    client.evaluators.list(
        feedback_key="correctness",
        limit=20,
    )
)

for evaluator in evaluators:
    print(evaluator.id, evaluator.name)
```

비용 추적은 `spend()`가 핵심입니다.

```python
evaluator_uuid = "<evaluator-uuid>"
start_date = "2026-06-29"

spend = client.evaluators.spend(
    period_start=start_date,
    evaluator_id=evaluator_uuid,
)

for group in spend.groups or []:
    print(group.evaluator_name, group.total_spend_usd, group.total_trace_count)
```

문서 기준으로 `period_start`는 날짜만 있는 ISO 문자열이어야 하고, 조회 창은 고정 7일의 half-open 구간 `[period_start, period_start + 7 days)`입니다.

## 6. 삭제 전에는 run rule 연결을 확인한다

```python
client.evaluators.delete(
    llm_evaluator_id,
    delete_run_rules=True,
)
```

`delete_run_rules=True`는 편하지만 실제로는 project나 dataset의 자동 평가 흐름을 끊을 수 있으니 주의가 필요합니다.

## 자주 틀리는 점

### 1. `prompt_repo_handle`에 프롬프트 제목이나 URL을 넣는다

내부 repo handle을 써야 합니다. `list_prompts()` 또는 `get_prompt()`로 확인하는 편이 안전합니다.

### 2. structured prompt가 아닌 prompt를 judge에 연결한다

LLM judge evaluator는 structured prompt를 요구합니다.

### 3. `limit`을 총 결과 제한으로 이해한다

`list()`에서 `limit`은 페이지 크기입니다.

### 4. `spend()`에 datetime을 넣는다

문서 기준으로 날짜만 있는 ISO 문자열이어야 합니다.

### 5. evaluator를 삭제하면서 연결된 run rule 영향을 확인하지 않는다

`delete_run_rules=True`는 편하지만 project나 dataset의 자동 평가 흐름을 끊을 수 있습니다.

## 참고 자료

- [Manage evaluators with the SDK](https://docs.langchain.com/langsmith/manage-evaluators-sdk)
- [Manage evaluators](https://docs.langchain.com/langsmith/evaluators)
- [Set up LLM-as-a-judge online evaluators](https://docs.langchain.com/langsmith/online-evaluations-llm-as-judge)
- [Set up online code evaluators](https://docs.langchain.com/langsmith/online-evaluations-code)
