---
title: "LangSmith dataset example을 metadata로 골라 bulk update하기"
description: "LangSmith Python SDK에서 evaluation dataset example을 metadata로 조회하고, update_examples로 metadata·reference output·split을 일괄 정리한 뒤 dataset version을 검증하는 실전 노트"
date: 2026-08-14
tags:
  - langsmith
  - evaluation
  - dataset
  - python
aliases:
  - "/blog/langsmith-bulk-curate-dataset-examples"
---

# LangSmith dataset example을 metadata로 골라 bulk update하기

evaluation dataset이 커지면 잘못된 정답 하나를 고치는 일보다 다음 작업이 더 자주 필요해진다.

- `review_status=pending`인 example만 찾아 검수 완료로 바꾼다.
- 특정 source에서 들어온 example에 `test` split을 붙인다.
- reference output의 key를 새 evaluator 계약에 맞게 통일한다.
- 일괄 수정 후 실제 반영 건수와 dataset version을 확인한다.

이때 example마다 `update_example()`을 호출할 수도 있지만, 운영 스크립트에서는 먼저 대상을 좁히고 `update_examples(updates=[...])`로 한 번에 갱신하는 편이 요청 수와 부분 실패 위험을 줄이기 좋다.

## 사전 준비

- LangSmith workspace와 API key
- 수정할 dataset의 이름 또는 ID
- Python 3.10 이상
- 이 글의 최신 bulk payload 형식을 쓰려면 최근 `langsmith` SDK

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U langsmith
```

PowerShell에서는 다음처럼 환경 변수를 설정한다.

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
```

## 1. 생성할 때부터 provenance metadata를 남긴다

나중에 안전하게 골라내려면 example의 `inputs` 문자열을 검색하기보다 source, review 상태, schema version 같은 metadata를 구조적으로 남겨야 한다.

```python
from langsmith import Client

client = Client()
dataset_name = "support-agent-regression"

dataset = client.create_dataset(
    dataset_name=dataset_name,
    description="고객지원 agent 회귀 평가셋",
)

client.create_examples(
    dataset_id=dataset.id,
    examples=[
        {
            "inputs": {"question": "배송지를 바꿀 수 있나요?"},
            "outputs": {"answer": "출고 전에는 변경할 수 있습니다."},
            "metadata": {
                "source": "production_review",
                "review_status": "pending",
                "schema_version": 1,
            },
        },
        {
            "inputs": {"question": "환불은 며칠 걸리나요?"},
            "outputs": {"answer": "결제 수단에 따라 3~7영업일 걸립니다."},
            "metadata": {
                "source": "production_review",
                "review_status": "pending",
                "schema_version": 1,
            },
        },
    ],
)
```

`outputs`는 evaluation에서 reference output으로 쓰인다. 애플리케이션의 실제 출력과 혼동하지 않도록 evaluator가 기대하는 key를 일정하게 유지한다.

## 2. 수정 전에 대상 ID와 현재 값을 고정한다

단순 metadata 포함 조건은 `metadata={...}`로 조회할 수 있다.

```python
from langsmith import Client

client = Client()
dataset_name = "support-agent-regression"

candidates = list(
    client.list_examples(
        dataset_name=dataset_name,
        metadata={
            "source": "production_review",
            "review_status": "pending",
        },
    )
)

for example in candidates:
    print(example.id, example.inputs, example.outputs, example.metadata)

if not candidates:
    raise SystemExit("수정할 example이 없습니다.")
```

metadata key 존재 여부나 부정 조건이 필요하면 structured filter를 쓴다. 공식 문서 기준으로 example structured filter는 metadata field에 적용한다.

```python
candidates = list(
    client.list_examples(
        dataset_name=dataset_name,
        filter=(
            "and("
            "has(metadata, '{\"source\": \"production_review\"}'), "
            "not(has(metadata, '{\"review_status\": \"approved\"}'))"
            ")"
        ),
    )
)
```

실제 수정 전에 ID, 기존 metadata, 기존 outputs를 JSONL로 별도 보관하면 사람 검토와 복구가 쉬워진다. API script 자체는 항상 먼저 dry-run 출력부터 제공하는 것이 좋다.

## 3. `update_examples`에 example별 update 객체를 넘긴다

현재 Python SDK의 bulk update는 각 항목에 `id`와 바꿀 field를 넣는 `updates` 형식을 지원한다. 다음 예제는 기존 metadata를 보존하면서 review 상태와 schema version을 바꾸고 `test` split을 붙인다.

```python
from langsmith import Client

client = Client()
dataset_name = "support-agent-regression"

candidates = list(
    client.list_examples(
        dataset_name=dataset_name,
        metadata={"review_status": "pending"},
    )
)

updates = []
for example in candidates:
    old_metadata = example.metadata or {}
    updates.append(
        {
            "id": example.id,
            "metadata": {
                **old_metadata,
                "review_status": "approved",
                "schema_version": 2,
            },
            "split": ["test", "reviewed"],
        }
    )

if updates:
    result = client.update_examples(
        dataset_name=dataset_name,
        updates=updates,
    )
    print(result)
```

`metadata`를 일부 key만 patch한다고 가정하지 말고, 보존할 기존 값을 합쳐 완성된 객체를 보내는 편이 안전하다. reference output도 바꿔야 한다면 update 객체에 `outputs`를 추가한다.

```python
updates.append(
    {
        "id": example.id,
        "outputs": {"expected_answer": example.outputs["answer"]},
        "metadata": {**old_metadata, "schema_version": 2},
        "split": "test",
    }
)
```

## 4. bulk update 뒤에는 다시 조회해 불변식을 검사한다

API 응답 성공만 확인하지 말고 대상 ID를 다시 읽어 예상한 상태인지 검증한다.

```python
candidate_ids = [example.id for example in candidates]

updated = list(client.list_examples(example_ids=candidate_ids))

assert len(updated) == len(candidate_ids)
assert all(item.metadata.get("review_status") == "approved" for item in updated)
assert all(item.metadata.get("schema_version") == 2 for item in updated)

print(f"verified={len(updated)}")
```

수정 대상을 다시 metadata filter로 조회해 pending 건수가 0인지 확인하는 검사도 유용하다.

```python
remaining = list(
    client.list_examples(
        dataset_name=dataset_name,
        metadata={"review_status": "pending"},
        limit=1,
    )
)
assert not remaining
```

## 5. dataset version을 배포 단위로 다룬다

LangSmith dataset은 example을 추가·수정·삭제할 때 새 version이 생긴다. 따라서 bulk update 직전 version으로 과거 상태를 조회할 수 있고, 검증이 끝난 시점에는 의미 있는 tag를 붙여 evaluation 입력을 고정할 수 있다.

```python
from datetime import datetime, timezone
from langsmith import Client

client = Client()
dataset_name = "support-agent-regression"

approved_at = datetime.now(timezone.utc)
client.update_dataset_tag(
    dataset_name=dataset_name,
    as_of=approved_at,
    tag="reviewed-v2",
)

frozen_examples = client.list_examples(
    dataset_name=dataset_name,
    as_of="reviewed-v2",
)

results = client.evaluate(
    lambda inputs: {"answer": "여기에 실제 target 함수를 연결한다."},
    data=frozen_examples,
    evaluators=[],
    experiment_prefix="support-agent-reviewed-v2",
)
```

tag는 데이터를 복사하는 기능이 아니라 특정 시점의 dataset version에 붙는 이름이다. 같은 tag를 어떤 시점에 붙였는지 변경 기록과 함께 관리한다.

## 흔한 함정

### metadata filter 없이 전체 dataset을 갱신한다

dataset name만 지정하고 모든 example을 update 대상으로 만들지 않는다. source, review status, schema version을 함께 좁히고 dry-run 대상 수에 상한을 둔다.

```python
MAX_BULK_UPDATE = 200
if len(candidates) > MAX_BULK_UPDATE:
    raise RuntimeError(f"unexpected update size: {len(candidates)}")
```

### 오래된 bulk signature를 그대로 복사한다

문서나 과거 코드에는 `example_ids`, `inputs`, `outputs`, `metadata`, `splits`를 병렬 list로 넘기는 예제가 남아 있을 수 있다. 설치된 SDK의 `Client.update_examples` signature를 확인하고, 최근 SDK에서는 `updates=[{"id": ...}]` 형식을 사용한다.

### metadata 일부만 보내도 자동 merge된다고 가정한다

보존해야 할 metadata는 기존 객체와 명시적으로 합친다. 특히 provenance나 reviewer 정보를 실수로 잃지 않도록 update 전후를 비교한다.

### 삭제를 rollback처럼 사용한다

`delete_example()`은 dataset version을 새로 만들며 현재 view에서 example을 제거한다. 수정 실수를 되돌리려고 즉시 삭제하기보다 과거 version을 조회해 올바른 값을 다시 update하고, 검증 후 새 tag를 붙인다.

### generator를 여러 번 순회한다

`list_examples()` 반환값은 iterator다. 대상 수 확인, update 생성, 사후 비교에서 반복 사용할 때는 처음에 `list(...)`로 materialize한다.

## 정리

안전한 dataset 정리는 **구조화된 metadata로 대상 선택 → dry-run과 건수 상한 → `updates` bulk payload → ID 기반 재조회 검증 → version tag 고정** 순서로 잡으면 된다. 이 흐름을 스크립트로 표준화하면 evaluation dataset을 수동 표처럼 다루지 않고, 리뷰 가능한 데이터 자산으로 운영할 수 있다.

## 참고 자료

- [Create and manage datasets programmatically](https://docs.langchain.com/langsmith/manage-datasets-programmatically)
- [Manage datasets](https://docs.langchain.com/langsmith/manage-datasets)
- [Example data format](https://docs.langchain.com/langsmith/example-data-format)
- [LangSmith Python SDK reference](https://docs.langchain.com/langsmith/reference)
