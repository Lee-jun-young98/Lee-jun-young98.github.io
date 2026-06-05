---
title: "LangSmith dataset split과 version tag로 평가셋 고정하기"
description: "LangSmith에서 dataset example을 split으로 나누고, version tag를 붙여서 재현 가능한 평가셋을 운영하는 방법을 Python SDK 예제로 정리한 실전 노트"
date: 2026-06-05
tags:
  - langsmith
  - evaluation
  - dataset
  - python
aliases:
  - "/blog/langsmith-dataset-splits-version-tags"
---

# LangSmith dataset split과 version tag로 평가셋 고정하기

LangSmith로 evaluation을 시작하면 금방 부딪히는 문제가 있다.  
"처음엔 몇 개 예제로만 돌렸는데 점점 데이터가 늘어난다", "실패 케이스만 따로 보고 싶다", "지난주와 같은 평가셋으로 다시 비교하고 싶은데 기준이 흔들린다" 같은 문제다.

이때 dataset을 그냥 예제 저장소처럼만 쓰지 말고 `split`과 `version tag`까지 같이 써야 평가가 재현 가능해진다.

이번 글에서는 공식 문서 기준으로 아래 흐름만 실전 위주로 정리한다.

- Python SDK로 dataset과 example 만들기
- `split`과 `metadata`를 나눠 써서 평가 뷰 고정하기
- 특정 시점의 dataset version에 `prod` 같은 tag 붙이기
- tagged version과 split을 그대로 evaluation에 넘기기

## 언제 이 방식이 특히 유용한가

아래 상황이면 초반부터 이 구조를 잡아두는 편이 낫다.

- test / train / failure-review 같은 평가 대상을 나눠 보고 싶다
- 운영 trace에서 가져온 예제와 손으로 만든 예제를 구분하고 싶다
- CI나 배포 전 비교에서 "같은 평가셋"을 반복 사용하고 싶다
- dataset이 계속 바뀌더라도 특정 배포 기준 셋은 고정해 두고 싶다

반대로 예제가 5~10개 수준이고 한 번만 수동 확인하면 되는 단계라면 split과 tag를 너무 일찍 복잡하게 설계할 필요는 없다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="ls__your_key"
$env:LANGSMITH_TRACING="true"
```

평가까지 바로 실행할 계획이면 애플리케이션 쪽 모델 API 키도 같이 준비해야 한다.

## 1. dataset 만들고 example를 한 번에 넣기

공식 SDK 문서 기준으로 여러 예제를 넣을 때는 `create_examples(...)`가 가장 편하다.

```python
from langsmith import Client

client = Client()
dataset_name = "support-routing-v1"

dataset = client.create_dataset(
    dataset_name=dataset_name,
    description="고객 문의 라우팅 평가용 데이터셋",
)

examples = [
    {
        "inputs": {"question": "환불은 언제 처리되나요?"},
        "outputs": {"route": "billing"},
        "metadata": {"source": "handwritten", "difficulty": "easy"},
        "split": "test",
    },
    {
        "inputs": {"question": "비밀번호 재설정 메일이 안 와요"},
        "outputs": {"route": "account"},
        "metadata": {"source": "production", "difficulty": "easy"},
        "split": "test",
    },
    {
        "inputs": {"question": "법인 세금계산서 발행 절차가 궁금합니다"},
        "outputs": {"route": "billing"},
        "metadata": {"source": "production", "difficulty": "hard"},
        "split": "failure-review",
    },
]

client.create_examples(dataset_id=dataset.id, examples=examples)

print(dataset.id)
```

여기서 초반에 정할 것은 두 가지다.

- `split`: 평가에서 직접 고를 상위 그룹
- `metadata`: 예제 출처, 난이도, 기능명 같은 부가 정보

## 2. split과 metadata를 역할별로 나눠 쓰기

LangSmith 문서 기준으로 split은 평가 단위 구분에, metadata는 예제 속성 기록에 더 가깝다.

실무에서는 아래처럼 나누면 덜 꼬인다.

- `split`: `train`, `test`, `failure-review`, `smoke`
- `metadata`: `source=production`, `feature=router`, `difficulty=hard`

예제 하나를 나중에 다른 split으로 옮기거나 추가 split에 넣고 싶다면 `update_example(...)`로 수정하면 된다.

```python
from langsmith import Client

client = Client()

example = next(
    client.list_examples(
        dataset_name="support-routing-v1",
        metadata={"difficulty": "hard"},
    )
)

client.update_example(
    example_id=example.id,
    metadata={
        **(example.metadata or {}),
        "source": "production",
        "difficulty": "hard",
        "feature": "router",
    },
    split=["test", "failure-review"],
)
```

문서상 LangSmith는 예제가 여러 split에 동시에 속하는 것도 허용한다.  
다만 운영 기준 평가셋을 만들 때는 한 예제가 너무 많은 split에 걸치지 않게 두는 편이 결과 해석이 쉽다.

## 3. split이나 metadata로 원하는 평가 뷰만 가져오기

dataset 전체를 그대로 평가에 넣기 시작하면 금방 "무엇을 비교한 결과인지"가 흐려진다.  
그래서 보통은 `list_examples(...)`로 필요한 뷰만 잘라서 평가에 넘긴다.

### test split만 가져오기

```python
from langsmith import Client

client = Client()

test_examples = list(
    client.list_examples(
        dataset_name="support-routing-v1",
        splits=["test"],
    )
)

print(len(test_examples))
```

### metadata로 production 예제만 가져오기

```python
from langsmith import Client

client = Client()

prod_examples = list(
    client.list_examples(
        dataset_name="support-routing-v1",
        metadata={"source": "production"},
    )
)

print(len(prod_examples))
```

### structured filter로 더 세밀하게 가져오기

공식 문서 기준으로 Python SDK `v0.1.83+`에서는 metadata 대상 structured filter를 쓸 수 있다.

```python
from langsmith import Client

client = Client()

hard_prod_examples = list(
    client.list_examples(
        dataset_name="support-routing-v1",
        filter=(
            'and('
            'has(metadata, \'{"source": "production"}\'), '
            'has(metadata, \'{"difficulty": "hard"}\')'
            ')'
        ),
    )
)

print(len(hard_prod_examples))
```

## 4. dataset version에 tag 붙여서 기준 셋 고정하기

LangSmith dataset은 example이 추가·수정·삭제될 때마다 version이 생긴다.  
문제는 timestamp 기반 version만 기억하면 "배포 기준 셋"을 다시 찾기 불편하다는 점이다.

이럴 때 특정 시점에 `prod`, `release-2026-06-05`, `baseline` 같은 tag를 붙여두면 된다.

```python
from datetime import datetime, timezone
from langsmith import Client

client = Client()

frozen_at = datetime(2026, 6, 5, 9, 0, 0, tzinfo=timezone.utc)

client.update_dataset_tag(
    dataset_name="support-routing-v1",
    as_of=frozen_at,
    tag="prod",
)
```

실제로는 `as_of`에 정확한 version 시각을 넣어야 한다.  
운영에서는 "배포 직전 dataset을 확정한 시각"을 기록해 두고 그 시점에 tag를 붙이는 방식이 가장 단순하다.

## 5. tagged version과 split을 그대로 evaluation에 넘기기

이제 평가할 때 dataset 이름만 넘기지 말고, tagged version의 split 뷰를 직접 넘기면 된다.

```python
from langsmith import Client, evaluate

client = Client()


def predict(inputs: dict) -> dict:
    question = inputs["question"]
    if "환불" in question or "세금계산서" in question:
        return {"route": "billing"}
    return {"route": "account"}


def route_correct(outputs: dict, reference_outputs: dict) -> bool:
    return outputs["route"] == reference_outputs["route"]


results = evaluate(
    predict,
    data=client.list_examples(
        dataset_name="support-routing-v1",
        as_of="prod",
        splits=["test"],
    ),
    evaluators=[route_correct],
    experiment_prefix="support-routing-prod-baseline",
)

print(results)
```

이 방식의 핵심은 두 가지다.

- `as_of="prod"`로 dataset version을 고정한다
- `splits=["test"]`로 평가 대상을 고정한다

그러면 dataset에 새 예제가 추가돼도 기존 기준 평가셋은 그대로 유지된다.

## 자주 막히는 지점

### 1. split과 metadata를 같은 용도로 섞어 쓰는 경우

`test`, `train` 같은 평가 그룹을 metadata에 넣기 시작하면 나중에 평가 호출마다 filter 문자열이 길어진다.  
반대로 `source=production`, `difficulty=hard` 같은 세부 속성을 split으로 밀어 넣으면 split 개수가 과하게 늘어난다.

### 2. dataset version을 안 고정하고 매번 최신값으로 평가하는 경우

처음에는 편하지만, 며칠 뒤 다시 비교하면 데이터가 바뀌어 결과 해석이 흔들린다.  
배포 비교, 회귀 테스트, CI 용도라면 tag나 `as_of` 기준을 반드시 잡아두는 편이 낫다.

### 3. 운영 trace에서 가져온 예제와 수작업 예제를 구분하지 않는 경우

둘을 섞는 것 자체는 문제 없다.  
다만 `metadata.source` 정도는 남겨 두지 않으면 "실패가 실제 사용자 패턴인지, 손으로 만든 엣지 케이스인지"를 나중에 다시 구분하기 어렵다.

### 4. split을 너무 많이 만드는 경우

처음부터 `test-ko-hard-billing-prod-v2` 같은 식으로 split을 세분화하면 관리가 빠르게 복잡해진다.  
상위 그룹은 split으로, 나머지 축은 metadata로 두는 편이 보통 더 오래 간다.

## 추천하는 최소 운영 패턴

개인적으로는 아래 정도면 대부분의 LangSmith 평가 흐름을 무리 없이 시작할 수 있다.

1. dataset 하나를 기능 단위로 만든다.
2. `test`, `failure-review`, `smoke` 정도만 split으로 둔다.
3. `source`, `difficulty`, `feature`는 metadata로 둔다.
4. 배포 기준 시점마다 `prod` 또는 릴리스 이름으로 dataset version tag를 붙인다.
5. evaluation은 항상 `as_of + splits` 조합으로 호출한다.

이렇게 하면 dataset이 커져도 기준 셋이 흔들리지 않고, 실패 예제만 따로 뽑아 annotation queue나 후속 evaluator 개선으로 넘기기 쉽다.

## 참고 자료

- [How to create and manage datasets programmatically](https://docs.langchain.com/langsmith/manage-datasets-programmatically)
- [Manage datasets](https://docs.langchain.com/langsmith/manage-datasets)
- [Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)
- [Evaluation quickstart](https://docs.langchain.com/langsmith/evaluation-quickstart)
