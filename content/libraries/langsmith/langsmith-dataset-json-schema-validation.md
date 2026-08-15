---
title: "LangSmith dataset JSON Schema로 evaluation 입력 계약 고정하기"
description: "LangSmith dataset에 inputs_schema와 outputs_schema를 설정하고, Python에서 로컬 사전 검증과 서버 검증을 함께 사용해 잘못된 evaluation example을 차단하는 방법"
date: 2026-08-15
tags:
  - langsmith
  - evaluation
  - dataset
  - json-schema
  - python
aliases:
  - "/blog/langsmith-dataset-json-schema-validation"
---

# LangSmith dataset JSON Schema로 evaluation 입력 계약 고정하기

LangSmith dataset은 `inputs`, `outputs`에 임의의 JSON 객체를 저장할 수 있다. 유연하지만 dataset이 커질수록 `question`과 `query`가 섞이거나, 정답의 `answer`가 빠지거나, 숫자여야 할 값이 문자열로 들어오는 문제가 생긴다. 이런 오류는 `evaluate()`를 실행한 뒤 target이나 evaluator에서 늦게 발견되기 쉽다.

dataset을 만들 때 `inputs_schema`와 `outputs_schema`를 지정하면 example이 평가 파이프라인에 들어오기 전에 데이터 계약을 명시할 수 있다. 핵심은 다음 두 단계를 함께 쓰는 것이다.

1. 로컬에서 같은 JSON Schema로 batch 전체를 검사한다.
2. 검사를 통과한 example만 LangSmith에 업로드해 서버 검증도 받는다.

## 사전 준비

- LangSmith workspace와 API key
- Python 3.10 이상
- 최근 `langsmith` SDK
- 로컬 사전 검증용 `jsonschema`

```bash
pip install -U langsmith jsonschema
```

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
```

## 1. target과 evaluator가 기대하는 계약부터 적는다

아래 예시는 고객지원 분류기를 평가한다. target은 `question`과 선택적 `locale`을 받고, reference output은 허용된 `category`와 `answer`를 가진다.

```python
INPUTS_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
        "question": {"type": "string", "minLength": 1},
        "locale": {"type": "string", "enum": ["ko-KR", "en-US"]},
    },
    "required": ["question"],
    "additionalProperties": False,
}

OUTPUTS_SCHEMA = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
        "category": {
            "type": "string",
            "enum": ["shipping", "refund", "account"],
        },
        "answer": {"type": "string", "minLength": 1},
    },
    "required": ["category", "answer"],
    "additionalProperties": False,
}
```

`required`는 반드시 필요한 key를, `enum`은 evaluator가 처리할 수 있는 label 집합을 고정한다. `additionalProperties: false`는 오타 난 key를 조용히 받아들이지 않게 한다. 다만 schema를 점진적으로 확장해야 하는 팀이라면 이 옵션을 켜기 전에 기존 example을 먼저 점검한다.

## 2. schema와 함께 dataset을 생성한다

현재 Python SDK의 `Client.create_dataset()`은 `inputs_schema`와 `outputs_schema`를 직접 받는다.

```python
from langsmith import Client

client = Client()

dataset = client.create_dataset(
    dataset_name="support-intent-regression-v1",
    description="고객지원 intent와 답변 회귀 평가셋",
    inputs_schema=INPUTS_SCHEMA,
    outputs_schema=OUTPUTS_SCHEMA,
    metadata={"owner": "support-ai", "schema_version": 1},
)

print(dataset.id)
```

schema는 dataset 단위 계약이다. target이 `inputs["question"]`을 읽고 evaluator가 `reference_outputs["category"]`를 읽는다면, 두 key를 schema와 같은 이름으로 유지해야 한다.

## 3. 업로드 전에 batch 전체를 로컬에서 검증한다

서버가 첫 오류를 반환할 때마다 수정하고 재요청하면 느리고, batch에서 어느 행이 잘못됐는지 찾기도 어렵다. `jsonschema`로 전체를 먼저 검사하면 행 번호와 JSON 경로를 한 번에 보고할 수 있다.

```python
from jsonschema import Draft202012Validator

examples = [
    {
        "inputs": {"question": "환불은 며칠 걸리나요?", "locale": "ko-KR"},
        "outputs": {
            "category": "refund",
            "answer": "결제 수단에 따라 보통 3~7영업일이 걸립니다.",
        },
        "metadata": {"source": "human_review"},
    },
    {
        "inputs": {"question": "배송지를 바꿀 수 있나요?", "locale": "ko-KR"},
        "outputs": {
            "category": "shipping",
            "answer": "출고 전에는 배송지를 변경할 수 있습니다.",
        },
        "metadata": {"source": "human_review"},
    },
]


def validate_examples(rows: list[dict]) -> None:
    validators = {
        "inputs": Draft202012Validator(INPUTS_SCHEMA),
        "outputs": Draft202012Validator(OUTPUTS_SCHEMA),
    }
    failures = []

    for index, row in enumerate(rows):
        for field, validator in validators.items():
            for error in validator.iter_errors(row.get(field)):
                path = ".".join(map(str, error.absolute_path)) or "<root>"
                failures.append(f"row={index} {field}.{path}: {error.message}")

    if failures:
        raise ValueError("Invalid examples:\n" + "\n".join(failures))


validate_examples(examples)
client.create_examples(dataset_id=dataset.id, examples=examples)
```

로컬 검증은 API key 없이도 CI에서 실행할 수 있다. 하지만 LangSmith 서버 검증을 대체하는 것은 아니다. 실제 업로드에서도 schema 불일치를 오류로 처리하고, 예외를 무시한 채 일부만 성공했다고 간주하지 않는다.

## 4. chat message와 tool은 LangSmith의 prebuilt schema를 참조한다

대화형 dataset에서 message 구조를 직접 다시 정의할 필요는 없다. LangSmith는 공개 JSON Schema를 제공한다.

```python
MESSAGE_SCHEMA = {
    "type": "object",
    "properties": {
        "messages": {
            "type": "array",
            "items": {
                "$ref": "https://api.smith.langchain.com/public/schemas/v1/message.json"
            },
        }
    },
    "required": ["messages"],
    "additionalProperties": False,
}

TOOLS_SCHEMA = {
    "type": "object",
    "properties": {
        "tools": {
            "type": "array",
            "items": {
                "$ref": "https://api.smith.langchain.com/public/schemas/v1/tooldef.json"
            },
        }
    },
    "required": ["tools"],
}
```

공식 문서 기준으로 message schema는 OpenAI 표준 형태의 메시지, tool schema는 OpenAI JSON Schema 기반 function calling 정의를 표현한다. trace에서 dataset을 만들 때 형식 변환까지 필요하다면 schema만 추가하지 말고 dataset transformations 또는 Chat Model schema를 함께 검토한다.

외부 `$ref`를 로컬에서 해석하려면 네트워크와 resolver 정책이 추가로 필요하다. CI를 완전히 재현 가능하게 만들고 싶다면 검증 시점에 공식 schema를 고정된 파일로 받아 저장하고, 갱신 절차와 버전을 별도로 관리한다.

## 5. 평가 코드는 schema 계약을 그대로 소비한다

```python
from langsmith import evaluate


def target(inputs: dict) -> dict:
    question = inputs["question"]
    # 실제 애플리케이션 호출로 교체한다.
    return {"category": "refund", "answer": f"답변: {question}"}


def category_accuracy(outputs: dict, reference_outputs: dict) -> dict:
    return {
        "key": "category_accuracy",
        "score": int(outputs["category"] == reference_outputs["category"]),
    }


evaluate(
    target,
    data="support-intent-regression-v1",
    evaluators=[category_accuracy],
    experiment_prefix="support-intent-schema-v1",
)
```

schema가 reference output을 검증하더라도 target의 실제 output까지 자동으로 같은 schema에 맞춰 주는 것은 아니다. target 반환값은 별도 테스트나 evaluator에서 검사해야 한다.

## 자주 겪는 함정

### 기존 데이터가 있는데 엄격한 schema부터 적용한다

`additionalProperties: false`, 새 `required` key, 좁은 `enum`은 기존 example을 바로 깨뜨릴 수 있다. 먼저 `list_examples()`로 전체 데이터를 읽어 로컬 검증하고, migration이 끝난 뒤 새 dataset 또는 새 schema version으로 전환한다.

### `outputs`를 모델의 실제 출력으로 착각한다

dataset example의 `outputs`는 보통 평가용 reference output이다. 실험에서 target이 만든 실제 출력은 experiment run에 저장된다. schema와 evaluator 인자 이름을 이 구분에 맞춘다.

### schema가 의미 품질까지 보장한다고 생각한다

JSON Schema는 key, type, 범위, enum 같은 구조를 검증한다. 답변의 사실성이나 유용성은 code evaluator, LLM-as-a-judge, human review로 별도 평가해야 한다.

### schema 변경을 같은 dataset에 무계획하게 섞는다

계약 변경에는 `schema_version` metadata를 남기고, breaking change라면 dataset 이름도 `v1`, `v2`처럼 분리하는 편이 안전하다. 그래야 과거 experiment를 어떤 계약으로 재현했는지 추적할 수 있다.

## 운영 체크리스트

- target input key와 `inputs_schema`가 같은가
- evaluator가 읽는 reference key와 `outputs_schema`가 같은가
- upload 전에 batch 전체를 로컬 검증하는가
- schema 위반 API 오류를 무시하지 않는가
- breaking change에 dataset/schema version을 남기는가
- message와 tool 형식은 공식 prebuilt schema 또는 transformation을 재사용하는가
- 구조 검증과 의미 품질 평가를 분리했는가

## 참고 자료

- [Dataset prebuilt JSON schema types](https://docs.langchain.com/langsmith/dataset-json-types)
- [Create and manage datasets in the UI](https://docs.langchain.com/langsmith/manage-datasets-in-application)
- [How to create and manage datasets programmatically](https://docs.langchain.com/langsmith/manage-datasets-programmatically)
- [Example data format](https://docs.langchain.com/langsmith/example-data-format)
- [JSON Schema specification](https://json-schema.org/specification)
