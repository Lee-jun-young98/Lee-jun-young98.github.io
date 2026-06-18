---
title: "LangSmith evaluation에서 실패한 example만 재시도하기"
description: "LangSmith Python SDK에서 error_handling='ignore', list_runs, list_examples, experiment=results.experiment_name을 조합해 실패한 evaluation example만 다시 실행하는 방법을 정리한 실전 노트"
date: 2026-06-18
tags:
  - langsmith
  - evaluation
  - python
  - operations
aliases:
  - "/blog/langsmith-retry-failed-evaluation-examples"
---

# LangSmith evaluation에서 실패한 example만 재시도하기

LangSmith로 offline evaluation을 돌리다 보면 전체 실험이 완전히 망가지는 경우보다 일부 example만 실패하는 경우가 훨씬 많다.

- 외부 API rate limit 때문에 몇 개만 실패했다
- 특정 입력에서만 tool timeout이 났다
- dataset 수백 개를 다시 전부 돌리기에는 비용이 아깝다
- 같은 experiment 이름 아래에서 재시도 기록까지 이어 보고 싶다

이럴 때는 전체 evaluation을 처음부터 다시 돌리기보다, 실패한 example만 골라서 같은 experiment에 이어 붙이는 편이 훨씬 실용적이다.

공식 문서 기준으로 핵심은 세 가지다.

1. 첫 실행에서 `error_handling="ignore"`로 실패 example을 건너뛴다
2. `list_runs(...)`로 성공한 example ID를 모은다
3. 빠진 example만 다시 `aevaluate(..., experiment=results.experiment_name)`로 재실행한다

이 글은 그 흐름을 Python 기준으로 바로 쓸 수 있게 정리한다.

## 언제 유용한가

아래 같은 상황이면 이 패턴이 잘 맞는다.

- 모델 호출이 간헐적으로 실패해서 일부 example만 비었다
- evaluator는 정상인데 target 함수가 외부 의존성 때문에 흔들린다
- experiment 이름과 비교 뷰를 유지한 채 누락분만 채우고 싶다
- 대규모 eval 비용을 줄이면서 최종 결과를 완성하고 싶다

반대로 target 함수나 prompt를 크게 바꿨다면 같은 experiment에 덧붙이기보다 새 experiment를 만드는 편이 낫다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
```

이 글의 예제는 현재 Python SDK `langsmith==0.8.16` 시그니처를 기준으로 확인했다.

## 1. 첫 실행은 `error_handling="ignore"`로 돌린다

공식 문서 기준으로 실패 example을 나중에 골라 재시도하려면, 첫 evaluation에서 에러 때문에 전체 흐름이 끊기지 않도록 `error_handling="ignore"`를 주는 것이 출발점이다.

아래 예제는 일부 입력에서만 실패하는 target을 일부러 만들어 둔 것이다.

```python
import asyncio
from langsmith import Client

client = Client()


async def target(inputs: dict) -> dict:
    question = inputs["question"]
    if "timeout" in question:
        raise RuntimeError("temporary upstream timeout")
    return {"answer": question.upper()}


def exact_match(inputs: dict, outputs: dict, reference_outputs: dict) -> bool:
    return outputs["answer"] == reference_outputs["answer"]


async def main() -> None:
    results = await client.aevaluate(
        target,
        data="support-eval-dataset",
        evaluators=[exact_match],
        experiment_prefix="support-bot-retry-demo",
        error_handling="ignore",
    )
    print(results.experiment_name)


asyncio.run(main())
```

이렇게 해 두면 실패한 example 때문에 전체 작업이 멈추지 않고, 성공한 example 결과만 우선 experiment에 기록된다.

## 2. 성공한 example ID를 먼저 모은다

재시도는 "실패한 것만 다시 찾기"보다 "성공해서 이미 기록된 것들을 먼저 빼기" 방식이 단순하다.

공식 문서 예제도 같은 흐름을 쓴다. `list_runs(project_name=results.experiment_name)`로 해당 experiment에 기록된 run을 가져오고, `reference_example_id`를 모아서 성공 목록을 만든다.

```python
from langsmith import Client

client = Client()


def get_successful_example_ids(experiment_name: str) -> set[str]:
    successful_ids = set()

    runs = client.list_runs(
        project_name=experiment_name,
        is_root=True,
        select=["id", "reference_example_id", "error"],
    )

    for run in runs:
        if run.reference_example_id and run.error is None:
            successful_ids.add(str(run.reference_example_id))

    return successful_ids
```

실무에서는 `is_root=True`와 `select=[...]`를 같이 주는 편이 안전하다. child run까지 섞이면 example 기준 중복 계산이 헷갈릴 수 있기 때문이다.

## 3. dataset 전체에서 빠진 example만 다시 뽑는다

이제 dataset example 목록에서 성공한 ID를 제외하면 재시도 대상이 된다.

```python
from langsmith import Client

client = Client()


def iter_unsuccessful_examples(dataset_name: str, successful_ids: set[str]):
    for example in client.list_examples(dataset_name=dataset_name):
        if str(example.id) not in successful_ids:
            yield example
```

이 방식의 장점은 간단하다는 점이다.

- 별도 실패 테이블을 만들 필요가 없다
- experiment run만 읽어도 재시도 대상을 복원할 수 있다
- 같은 dataset으로 여러 번 retry를 반복해도 로직이 그대로 간다

## 4. 같은 experiment 이름으로 재실행한다

재시도의 핵심은 새 experiment를 만들지 않고 기존 experiment에 이어 붙이는 것이다. 공식 문서 기준으로 `experiment=results.experiment_name`을 주면 된다.

```python
import asyncio
from langsmith import Client

client = Client()


async def target(inputs: dict) -> dict:
    question = inputs["question"]
    if "timeout" in question:
        raise RuntimeError("temporary upstream timeout")
    return {"answer": question.upper()}


def exact_match(inputs: dict, outputs: dict, reference_outputs: dict) -> bool:
    return outputs["answer"] == reference_outputs["answer"]


def get_successful_example_ids(experiment_name: str) -> set[str]:
    successful_ids = set()
    for run in client.list_runs(
        project_name=experiment_name,
        is_root=True,
        select=["reference_example_id", "error"],
    ):
        if run.reference_example_id and run.error is None:
            successful_ids.add(str(run.reference_example_id))
    return successful_ids


def iter_unsuccessful_examples(dataset_name: str, successful_ids: set[str]):
    for example in client.list_examples(dataset_name=dataset_name):
        if str(example.id) not in successful_ids:
            yield example


async def main() -> None:
    dataset_name = "support-eval-dataset"

    results = await client.aevaluate(
        target,
        data=dataset_name,
        evaluators=[exact_match],
        experiment_prefix="support-bot-retry-demo",
        error_handling="ignore",
    )

    successful_ids = get_successful_example_ids(results.experiment_name)
    retry_examples = list(iter_unsuccessful_examples(dataset_name, successful_ids))

    print(f"retry_count={len(retry_examples)}")

    if retry_examples:
        await client.aevaluate(
            target,
            data=retry_examples,
            evaluators=[exact_match],
            experiment=results.experiment_name,
            error_handling="ignore",
        )


asyncio.run(main())
```

이 패턴을 쓰면 LangSmith UI에서 같은 experiment 아래에 재시도 결과가 누적되므로, 누락분을 채우면서도 결과 비교 흐름을 유지할 수 있다.

## 5. evaluator만 바뀌었다면 target 재실행 없이 기존 experiment를 다시 평가할 수 있다

실패 example 재시도와 함께 자주 섞이는 요구가 하나 더 있다. target은 다시 돌리고 싶지 않고, evaluator만 새로 붙이고 싶은 경우다.

공식 문서 기준으로 이때는 experiment 이름이나 ID를 `evaluate()`에 직접 넣으면 된다.

```python
from langsmith import evaluate


def len_score(inputs: dict, outputs: dict) -> float:
    return min(len(outputs["answer"]) / 20, 1.0)


evaluate(
    "support-bot-retry-demo:abc123",
    evaluators=[len_score],
)
```

즉 정리하면:

- target 실패로 비어 있는 example을 채우는 일: `aevaluate(target, ..., experiment=...)`
- 이미 있는 traces에 새 점수를 붙이는 일: `evaluate(existing_experiment, evaluators=[...])`

둘은 비슷해 보여도 목적이 다르다.

## 추천 운영 흐름

개인적으로는 아래 순서가 제일 무난하다.

1. 첫 eval은 `error_handling="ignore"`로 돌린다
2. `results.experiment_name`을 저장한다
3. `list_runs(...)`로 성공한 `reference_example_id`를 모은다
4. `list_examples(...)`와 비교해 빠진 example만 골라낸다
5. 같은 `experiment` 이름으로 retry를 다시 건다
6. evaluator만 추가하고 싶으면 `evaluate(existing_experiment, ...)`를 별도로 쓴다

## 자주 틀리는 점

### 1. 첫 실행에서 `error_handling="log"` 기본값을 그대로 둔다

실패 상황을 어떻게 다루는지 팀 정책에 따라 다르지만, "일단 끝까지 돌리고 빠진 것만 다시 채우기"가 목적이면 `ignore`가 더 맞다.

### 2. retry를 새 experiment로 보내 버린다

`experiment=results.experiment_name`을 빼면 결과가 흩어져서 같은 실험을 보강한다는 장점이 사라진다.

### 3. child run까지 섞어서 example 성공 여부를 계산한다

example 단위 판정은 보통 root run 기준이 더 안전하다. `is_root=True`를 같이 주는 편이 낫다.

### 4. "실패 example 재시도"와 "새 evaluator 추가"를 같은 작업으로 본다

전자는 target 재실행이 필요하고, 후자는 기존 traces만 다시 읽어도 된다.

### 5. retry 전에 왜 실패했는지 확인하지 않는다

rate limit, timeout, deterministic bug는 대응이 다르다. 재시도 패턴은 임시 실패를 복구하는 데 유용하지, 영구 버그를 가리는 용도는 아니다.

## 참고 자료

- [How to retry failed runs in experiments (Python only)](https://docs.langchain.com/langsmith/evaluate-with-retry)
- [How to add evaluators to an existing experiment (Python only)](https://docs.langchain.com/langsmith/evaluate-existing-experiment)
- [How to evaluate an LLM application](https://docs.langchain.com/langsmith/evaluate-llm-application)
