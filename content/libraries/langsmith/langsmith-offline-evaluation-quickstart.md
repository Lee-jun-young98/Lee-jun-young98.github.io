---
title: "LangSmith offline evaluation quickstart with dataset and evaluate()"
description: "LangSmith에서 dataset, create_examples, evaluate(), aevaluate(), upload_results=False를 조합해 오프라인 평가를 시작하는 실전 Python 노트"
date: 2026-06-14
tags:
  - langsmith
  - evaluation
  - python
  - observability
aliases:
  - "/blog/langsmith-offline-evaluation-quickstart"
---

# LangSmith offline evaluation quickstart with dataset and evaluate()

LangSmith를 tracing 용도로만 붙여두면 "실패를 재현해서 비교하는 루프"가 약합니다.
실제로는 작은 평가 데이터셋을 만들고 `evaluate()`를 돌려서, 프롬프트나 모델을 바꿨을 때 무엇이 좋아졌는지 같은 기준으로 보는 흐름이 먼저 자리잡아야 합니다.

이 글은 그 시작점을 Python 기준으로 정리한 실전 메모입니다.

- dataset을 코드에서 바로 만들기
- `create_examples()`로 입력/정답 쌓기
- target function과 evaluator 분리하기
- `evaluate()`와 `aevaluate()`를 언제 쓰는지 구분하기
- `upload_results=False`로 로컬 smoke test 하기
- dataset version, split, filtered example을 평가에 다시 넣는 패턴 익히기

2026-06-14 기준 LangSmith 공식 문서의 evaluation 가이드는 Python 예제 일부에서 `langsmith>=0.3.13`를 전제로 설명합니다.

## 언제 먼저 써보면 좋은가

아래 상황이면 tracing보다 offline evaluation을 먼저 붙이는 편이 낫습니다.

- 프롬프트를 자주 바꾸는데 좋아졌는지 감으로만 판단하고 있다
- production trace를 보고 고친 뒤 같은 실패를 다시 막고 싶은데 회귀 체크가 없다
- 작은 FAQ bot, classifier, router, extractor를 운영하는데 정답셋은 이미 조금씩 있다
- 팀에서 "이번 변경이 나아졌는지"를 실험 이름과 점수로 남기고 싶다

반대로 아직 입력/출력 형식도 안정되지 않았고 예제셋이 전혀 없다면 tracing과 수동 리뷰를 먼저 두는 편이 낫습니다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "langsmith>=0.3.13" openai
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:OPENAI_API_KEY="sk-your-key"
```

기본 클라이언트:

```python
from langsmith import Client

client = Client()
```

## 1. 작은 dataset을 코드에서 만든다

처음에는 UI보다 코드로 dataset을 만드는 편이 재현성과 버전 관리가 좋습니다.
공식 문서 기준 기본 흐름은 `create_dataset()` 후 `create_examples()`입니다.

```python
from langsmith import Client

client = Client()

dataset_name = "support-tone-eval"

dataset = client.create_dataset(
    dataset_name=dataset_name,
    description="고객지원 답변의 정중함과 사실 일치 여부를 확인하는 소규모 평가셋",
)

examples = [
    {
        "inputs": {
            "question": "환불은 언제 처리돼?",
            "policy": "환불은 승인 후 영업일 기준 3일 안에 처리됩니다.",
        },
        "outputs": {
            "answer": "환불은 승인 후 영업일 기준 3일 안에 처리됩니다."
        },
        "metadata": {"split": "baseline", "source": "handwritten"},
    },
    {
        "inputs": {
            "question": "배송 주소를 바꿔줘",
            "policy": "출고 전 주문만 배송지 변경이 가능합니다.",
        },
        "outputs": {
            "answer": "출고 전 주문만 배송지 변경이 가능합니다."
        },
        "metadata": {"split": "baseline", "source": "handwritten"},
    },
]

client.create_examples(
    dataset_id=dataset.id,
    examples=examples,
)
```

핵심은 example마다 `inputs`, `outputs`, `metadata`를 분리해서 넣는 것입니다.
나중에 metadata나 split 기준으로 다시 평가할 수 있어야 실험을 계속 굴리기 쉽습니다.

## 2. target function은 "평가 대상 코드"만 감싼다

`evaluate()`에 넣는 target function은 dataset example의 `inputs`를 받아서 앱 출력을 dict로 반환하면 됩니다.
공식 가이드처럼 tracing을 같이 남기고 싶다면 `traceable`과 `wrap_openai`를 붙이면 됩니다.

```python
from langsmith import traceable, wrappers
from openai import OpenAI

oai_client = wrappers.wrap_openai(OpenAI())


@traceable
def support_bot(inputs: dict) -> dict:
    prompt = (
        "너는 한국어 고객지원 도우미다. "
        "제공된 policy만 사용해서 짧고 정확하게 답해라."
    )
    response = oai_client.chat.completions.create(
        model="gpt-5.4-mini",
        temperature=0,
        messages=[
            {"role": "system", "content": prompt},
            {
                "role": "user",
                "content": (
                    f"질문: {inputs['question']}\n"
                    f"정책: {inputs['policy']}"
                ),
            },
        ],
    )
    return {"answer": response.choices[0].message.content}
```

실무에서는 target function 안에서 앱 전체를 부르기보다, 바꾸려는 범위만 좁게 감싸는 쪽이 좋습니다.
예를 들어 router만 바꾸는 중이면 router만, retrieval prompt만 바꾸는 중이면 retrieval 단계만 평가 대상으로 두는 편이 비교가 명확합니다.

## 3. evaluator는 작고 해석 가능하게 시작한다

처음부터 복잡한 judge prompt를 넣기보다, 정답 비교나 형식 검사처럼 해석 가능한 evaluator를 먼저 두는 편이 안전합니다.

```python
def answer_matches_reference(outputs: dict, reference_outputs: dict) -> bool:
    return outputs["answer"].strip() == reference_outputs["answer"].strip()


def answer_is_concise(outputs: dict) -> bool:
    return len(outputs["answer"]) <= 120
```

평가 함수는 보통 아래 둘 중 하나로 시작하면 충분합니다.

- reference output과 직접 비교하는 exact/normalized match
- 길이, 필수 키 존재, 금지 표현 여부 같은 규칙 기반 검사

LLM-as-judge는 그 다음 단계로 올리는 편이 디버깅이 쉽습니다.

## 4. `evaluate()`로 첫 실험을 만든다

가장 단순한 실행은 dataset 이름을 `data`에 넣고 evaluators를 배열로 넘기는 형태입니다.

```python
from langsmith import evaluate

results = evaluate(
    support_bot,
    data=dataset_name,
    evaluators=[answer_matches_reference, answer_is_concise],
    experiment_prefix="support-bot-baseline",
    metadata={
        "model": "gpt-5.4-mini",
        "prompt_version": "v1",
        "owner": "cx-team",
    },
)

for row in results:
    print(row["run"].id)
    print(row["evaluation_results"])
```

여기서 자주 쓰게 되는 값은 아래입니다.

- `experiment_prefix`: 실험 이름 접두사
- `metadata`: 모델 버전, 프롬프트 버전, 배포 후보 식별자 기록
- `evaluators`: 각 결과를 어떤 기준으로 채점할지

팀 단위로 비교하려면 실험 metadata를 빼먹지 않는 편이 좋습니다.

## 5. 로컬 smoke test는 `upload_results=False`로 빠르게 돌린다

공식 문서 기준 Python SDK에서는 `upload_results=False`를 주면 LangSmith에 실험 결과와 trace를 올리지 않고 로컬에서만 평가를 돌릴 수 있습니다.

```python
from langsmith import evaluate

results = evaluate(
    support_bot,
    data=dataset_name,
    evaluators=[answer_matches_reference],
    experiment_prefix="support-bot-local-check",
    upload_results=False,
)

rows = list(results)
failed = [
    row for row in rows
    if not all(result.score for result in row["evaluation_results"]["results"])
]

print(f"failed={len(failed)}")
```

아래 용도에 특히 좋습니다.

- evaluator 함수가 제대로 동작하는지 확인
- 프롬프트 초안의 치명적 실패만 빠르게 확인
- CI 전에 개발자 로컬에서 몇 개만 smoke test

## 6. 데이터셋 전체 대신 특정 version, split, subset만 평가할 수 있다

LangSmith dataset은 버전이 생기고, `list_examples()` 결과를 `data`로 넘겨서 특정 시점이나 부분집합만 평가할 수 있습니다.

### 특정 version tag 기준으로 평가

```python
from langsmith import evaluate, Client

client = Client()

results = evaluate(
    support_bot,
    data=client.list_examples(
        dataset_name=dataset_name,
        as_of="prod",
    ),
    evaluators=[answer_matches_reference],
    experiment_prefix="support-bot-prod-dataset",
)
```

### metadata filter나 split 기준으로 평가

```python
from langsmith import evaluate, Client

client = Client()

results = evaluate(
    support_bot,
    data=client.list_examples(
        dataset_name=dataset_name,
        metadata={"source": "handwritten"},
        splits=["baseline"],
    ),
    evaluators=[answer_matches_reference],
    experiment_prefix="support-bot-baseline-split",
)
```

이 패턴을 익혀두면 production trace에서 뽑아온 예제, hand-curated 예제, 회귀 실패셋을 분리해 관리하기 쉬워집니다.

## 7. 평가 건수가 커지면 `aevaluate()`와 `max_concurrency`를 본다

공식 문서에서는 Python 대규모 평가에 `aevaluate()`를 권장합니다.
인터페이스는 거의 같고, 차이는 비동기 실행과 동시성 제어입니다.

```python
import asyncio
from langsmith import Client

client = Client()


async def main() -> None:
    results = await client.aevaluate(
        support_bot,
        data=dataset_name,
        evaluators=[answer_matches_reference],
        experiment_prefix="support-bot-async",
        max_concurrency=4,
    )
    rows = [row async for row in results]
    print(f"rows={len(rows)}")


asyncio.run(main())
```

모델 호출이나 evaluator 호출이 느리면 `max_concurrency`를 조정해야 합니다.
너무 크게 잡으면 OpenAI나 기타 모델 API rate limit을 먼저 맞을 수 있습니다.

## 자주 막히는 지점

### 1. target function 반환 형식과 reference output 키가 안 맞는다

`outputs["answer"]`를 evaluator가 기대하는데 target function은 `{"result": ...}`를 반환하면 바로 어긋납니다.
평가 전에 output schema를 먼저 고정하는 편이 낫습니다.

### 2. dataset metadata를 안 넣어서 부분 평가가 어려워진다

처음엔 대충 돌아가도, 나중에 "회귀셋만 다시 돌리기", "source가 prod_import인 것만 보기"가 필요해집니다.
example metadata는 초기에 넣어두는 편이 싸게 먹힙니다.

### 3. exact match evaluator만 두고 끝내면 실제 품질을 놓친다

짧은 분류나 추출은 exact match가 잘 맞지만, 자유 생성 답변은 그렇지 않습니다.
규칙 기반 evaluator와 judge evaluator를 같이 두는 구조로 확장해야 합니다.

### 4. 실험 metadata 없이 결과만 남기면 비교가 흐려진다

실험 이름만으로는 나중에 어떤 모델, 어떤 프롬프트였는지 헷갈립니다.
`metadata={"model": ..., "prompt_version": ...}`를 습관처럼 붙이는 편이 낫습니다.

### 5. 무조건 서버 업로드부터 하면 디버깅 비용이 커진다

evaluator 초안 단계에서는 `upload_results=False`가 훨씬 빠릅니다.
로컬 검증으로 함수 모양을 먼저 맞춘 뒤 업로드 평가로 넘어가는 편이 효율적입니다.

## 추천 운영 순서

개인적으로는 아래 흐름이 가장 무난합니다.

1. 수작업 예제 10~30개로 작은 dataset 생성
2. exact match 또는 규칙 기반 evaluator 1~2개 추가
3. `upload_results=False`로 로컬 smoke test
4. `evaluate()`로 첫 baseline 실험 업로드
5. 실패 예제를 dataset에 계속 추가
6. 평가가 커지면 `aevaluate()`와 filtered dataset으로 분리 운영

LangSmith를 tracing UI로만 쓰면 "무슨 일이 있었는지"는 잘 보입니다.
반대로 evaluation까지 붙이면 "이번 변경이 실제로 나아졌는지"를 반복 가능하게 판단할 수 있습니다.

## 참고 자료

- [Evaluation quickstart](https://docs.langchain.com/langsmith/evaluation-quickstart)
- [How to evaluate an LLM application](https://docs.langchain.com/langsmith/evaluate-llm-application)
- [How to create and manage datasets programmatically](https://docs.langchain.com/langsmith/manage-datasets-programmatically)
- [Manage datasets](https://docs.langchain.com/langsmith/manage-datasets)
- [How to run an evaluation asynchronously](https://docs.langchain.com/langsmith/evaluation-async)
- [How to run an evaluation locally (Python only)](https://docs.langchain.com/langsmith/local)
