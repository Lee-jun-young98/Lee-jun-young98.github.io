---
title: "LangSmith pairwise evaluation으로 두 실험을 비교하기"
description: "LangSmith Python SDK에서 evaluate()와 pairwise evaluator를 사용해 기존 두 experiment를 비교하고, randomize_order와 runs 매핑으로 순서 편향을 줄이는 방법을 정리한 실전 노트"
date: 2026-06-19
tags:
  - langsmith
  - evaluation
  - python
  - comparison
aliases:
  - "/blog/langsmith-pairwise-evaluation-experiments"
---

# LangSmith pairwise evaluation으로 두 실험을 비교하기

LangSmith로 offline evaluation을 돌리다 보면 각 실험의 절대 점수만으로는 결정이 잘 안 날 때가 많다.

- 두 응답 다 정답은 비슷하지만 어느 쪽이 더 간결한지 보고 싶다
- 프롬프트를 바꿨는데 "전체 평균 점수"보다 실제로 어느 예제에서 더 나아졌는지가 중요하다
- 사람이 보기에 더 좋은 답변 기준을 코드나 LLM judge로 붙여 baseline과 candidate를 바로 비교하고 싶다

이럴 때는 각 실험을 따로 점수화한 뒤, LangSmith의 pairwise evaluation으로 "A가 더 낫다 / B가 더 낫다 / 비슷하다"를 붙이는 흐름이 실용적이다.

공식 문서 기준으로 `evaluate()`는 기존 두 experiment를 비교하는 데 쓰고, 세 개 이상을 비교하려면 `evaluate_comparative()`를 쓸 수 있다. 또한 pairwise evaluator는 `outputs`, `runs`, `reference_outputs`를 받아 두 run에 대한 선호 점수를 기록할 수 있다.

## 언제 쓰면 좋은가

아래 같은 상황이면 pairwise evaluation이 잘 맞는다.

- 새 프롬프트가 더 정확한지보다 "더 읽기 좋은지"를 비교하고 싶을 때
- 모델 교체 후 일부 예제에서만 퇴보가 생기는지 찾고 싶을 때
- 절대 점수 evaluator는 이미 있고, 최종 의사결정용 비교 evaluator를 하나 더 얹고 싶을 때
- annotation queue로 사람 비교 검토를 하기 전에 자동 비교를 먼저 돌려 보고 싶을 때

반대로 reference answer가 명확하고 pass/fail이 더 중요하면 일반 row evaluator가 더 단순하다.

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

이 글의 코드는 LangSmith Python SDK의 현재 pairwise evaluation 문서 흐름을 기준으로 정리했다. pairwise 비교 자체는 OpenAI 같은 별도 모델 없이도 가능하다.

## 1. 먼저 비교할 dataset과 두 experiment를 만든다

pairwise evaluation은 "기존 실험끼리 비교"가 핵심이다.  
즉, target 함수를 두 개 넘겨 바로 비교하는 방식이 아니라 먼저 baseline과 candidate experiment를 따로 만들어 두는 편이 가장 명확하다.

아래 예제는 작은 QA dataset을 만들고, 답변 길이만 다른 두 버전을 평가한다.

```python
from langsmith import Client, evaluate

client = Client()

dataset = client.create_dataset(
    dataset_name="pairwise-demo-qa",
    description="Pairwise evaluation demo dataset",
)

client.create_examples(
    dataset_id=dataset.id,
    examples=[
        {
            "inputs": {"question": "대한민국의 수도는?"},
            "outputs": {"answer": "서울"},
            "metadata": {"difficulty": "easy"},
        },
        {
            "inputs": {"question": "파이썬의 창시자는?"},
            "outputs": {"answer": "귀도 반 로섬"},
            "metadata": {"difficulty": "easy"},
        },
        {
            "inputs": {"question": "HTTP의 기본 포트는?"},
            "outputs": {"answer": "80"},
            "metadata": {"difficulty": "easy"},
        },
    ],
)


def baseline_app(inputs: dict) -> dict:
    lookup = {
        "대한민국의 수도는?": "서울은 대한민국의 수도입니다.",
        "파이썬의 창시자는?": "귀도 반 로섬입니다.",
        "HTTP의 기본 포트는?": "기본 포트는 80번입니다.",
    }
    return {"answer": lookup[inputs["question"]]}


def candidate_app(inputs: dict) -> dict:
    lookup = {
        "대한민국의 수도는?": "서울",
        "파이썬의 창시자는?": "귀도 반 로섬",
        "HTTP의 기본 포트는?": "80",
    }
    return {"answer": lookup[inputs["question"]]}


def exact_match(outputs: dict, reference_outputs: dict) -> bool:
    return outputs["answer"] == reference_outputs["answer"]


baseline_results = evaluate(
    baseline_app,
    data=dataset.name,
    evaluators=[exact_match],
    experiment_prefix="pairwise-demo-baseline",
)

candidate_results = evaluate(
    candidate_app,
    data=dataset.name,
    evaluators=[exact_match],
    experiment_prefix="pairwise-demo-candidate",
)

print(baseline_results.experiment_name)
print(candidate_results.experiment_name)
```

여기서 중요한 점은 pairwise evaluation이 dataset 자체를 다시 실행하는 것이 아니라, 이미 저장된 두 experiment 결과를 비교 대상으로 쓴다는 점이다.

## 2. pairwise evaluator는 `outputs`와 `runs`를 함께 쓰는 편이 안전하다

공식 문서 기준으로 pairwise evaluator는 `outputs: list[dict]`, `runs: list[Run]`, `reference_outputs: dict` 같은 인자를 받을 수 있다.

실무에서는 `randomize_order=True`를 자주 켜게 되는데, 이때 `outputs[0]`이 항상 baseline이라고 가정하면 잘못된 점수를 남기기 쉽다.  
그래서 점수는 가능하면 run ID 기준으로 명시적으로 매핑하는 쪽이 안전하다.

```python
def pairwise_exact_then_shorter(
    outputs: list[dict],
    reference_outputs: dict,
    runs: list,
) -> dict:
    scores = {str(run.id): 0 for run in runs}

    answer_a = outputs[0].get("answer", "").strip()
    answer_b = outputs[1].get("answer", "").strip()
    target = reference_outputs["answer"].strip()

    if answer_a == target and answer_b != target:
        scores[str(runs[0].id)] = 1
        comment = "A만 exact match"
    elif answer_b == target and answer_a != target:
        scores[str(runs[1].id)] = 1
        comment = "B만 exact match"
    elif answer_a == target and answer_b == target:
        if len(answer_a) < len(answer_b):
            scores[str(runs[0].id)] = 1
            comment = "둘 다 정답이지만 A가 더 간결함"
        elif len(answer_b) < len(answer_a):
            scores[str(runs[1].id)] = 1
            comment = "둘 다 정답이지만 B가 더 간결함"
        else:
            comment = "동점"
    else:
        comment = "둘 다 exact match 아님"

    return {
        "key": "pairwise_exact_then_shorter",
        "scores": scores,
        "comment": comment,
    }
```

문서에서 권장하듯 pairwise feedback key는 기존 단일-run feedback과 충돌하지 않게 `pairwise_` 접두어를 붙이는 편이 낫다.

## 3. `evaluate()`에 두 experiment를 넣어 pairwise 비교를 실행한다

이제 baseline과 candidate experiment 이름을 넣어서 비교를 실행하면 된다.

```python
from langsmith import evaluate

evaluate(
    (baseline_results.experiment_name, candidate_results.experiment_name),
    evaluators=[pairwise_exact_then_shorter],
    experiment_prefix="pairwise-demo-comparison",
    randomize_order=True,
    max_concurrency=4,
    metadata={
        "baseline": baseline_results.experiment_name,
        "candidate": candidate_results.experiment_name,
        "judge_policy": "exact_match_then_shorter",
    },
)
```

이 흐름의 장점은 명확하다.

- 기존 experiment를 다시 생성하지 않는다
- 비교 기준만 바꿔 pairwise experiment를 여러 개 만들 수 있다
- 같은 dataset 위에서 baseline, candidate, pairwise 결과를 나란히 본다

## 4. 결과는 Pairwise Experiments 탭과 Compare 뷰에서 같이 본다

공식 문서 기준으로 dataset 페이지에는 Pairwise Experiments 탭이 있고, 일반 experiment 비교는 Datasets & Experiments 페이지에서 두 개 이상을 선택해 `Compare`로 열 수 있다.

실제로는 아래 순서가 가장 편하다.

1. dataset 페이지에서 pairwise experiment를 열어 어떤 run이 이겼는지 본다
2. 같은 dataset의 Experiments 탭에서 baseline과 candidate를 `Compare`로 연다
3. regression / improvement 필터와 diff view로 어느 예제가 달라졌는지 확인한다

특히 pairwise가 "후보가 더 낫다"고 찍은 예제만 좁혀 본 다음, Compare 뷰에서 원문 출력 차이를 보는 흐름이 빠르다.

## 5. 사람 비교 검토가 필요하면 Pairwise Annotation Queue로 넘긴다

자동 pairwise evaluator만으로 결정하기 애매하면 사람 검토 흐름으로 이어 가면 된다.

공식 문서 기준으로 Pairwise Annotation Queue(PAQ)는 두 run을 좌우로 나란히 보여 주고, 리뷰어가 A/B/동점 형태로 판단하게 해 준다. UI에서 정확히 두 experiment를 선택해야 만들 수 있다.

즉 운영 흐름을 이렇게 잡을 수 있다.

1. 코드 기반 pairwise evaluation으로 대량 자동 비교
2. 애매한 케이스만 사람 검토용 PAQ로 보냄
3. 사람 판단을 기준으로 evaluator 프롬프트나 규칙을 개선

## 추천 운영 패턴

개인적으로는 아래 순서가 가장 실용적이다.

1. 새 프롬프트나 모델 버전마다 일반 `evaluate()`로 baseline/candidate experiment를 만든다
2. 절대 점수 evaluator와 별도로 pairwise evaluator를 둔다
3. `randomize_order=True`를 켜서 위치 편향을 줄인다
4. evaluator 내부에서는 `runs` 기반 score mapping을 사용한다
5. Pairwise Experiments에서 승패를 보고, Compare 뷰에서 퇴보 예제를 판다
6. 애매한 예제만 PAQ로 보내 사람 검토를 붙인다

## 자주 틀리는 점

### 1. pairwise evaluation에 target 함수 두 개를 바로 넘기려 한다

pairwise 비교는 기존 experiment를 대상으로 한다.  
먼저 일반 `evaluate()`로 각 버전을 실행해 experiment를 만든 뒤, 그 이름이나 ID를 pairwise evaluation에 넣어야 한다.

### 2. `randomize_order=True`인데도 `outputs[0]`을 baseline으로 가정한다

이 설정을 켜면 출력 순서가 섞일 수 있다.  
점수는 `runs`의 실제 ID를 기준으로 기록하는 편이 안전하다.

### 3. pairwise feedback key를 기존 점수 key와 같은 이름으로 둔다

공식 문서에서도 별도 접두어를 권장한다.  
`pairwise_accuracy`, `pairwise_preference`처럼 분리해 두면 비교 분석이 훨씬 쉽다.

### 4. 자동 pairwise evaluation과 Pairwise Annotation Queue를 같은 기능으로 본다

전자은 SDK 기반 자동 비교이고, 후자는 사람 검토용 UI다.  
둘은 경쟁 관계가 아니라 순차적으로 연결하는 편이 좋다.

### 5. 세 개 이상 실험을 `evaluate()` 한 번으로 비교하려 한다

문서 기준으로 `evaluate()` pairwise 모드는 두 experiment 비교에 맞춰져 있다.  
비교 대상이 셋 이상이면 `evaluate_comparative()`를 검토하는 편이 맞다.

## 참고 자료

- [How to run a pairwise evaluation](https://docs.langchain.com/langsmith/evaluate-pairwise)
- [How to create and manage datasets programmatically](https://docs.langchain.com/langsmith/manage-datasets-programmatically)
- [How to compare experiment results](https://docs.langchain.com/langsmith/compare-experiment-results)
- [Use annotation queues](https://docs.langchain.com/langsmith/annotation-queues)
