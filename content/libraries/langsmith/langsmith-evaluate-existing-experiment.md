---
title: "LangSmith 기존 experiment에 evaluator만 다시 붙이기"
description: "LangSmith에서 이미 실행된 experiment를 다시 돌리지 않고 evaluate()와 aevaluate()로 새 evaluator만 추가하는 실전 패턴을 정리한 한국어 study note"
date: 2026-06-22
tags:
  - langsmith
  - evaluation
  - python
  - experiment
aliases:
  - "/blog/langsmith-evaluate-existing-experiment"
---

# LangSmith 기존 experiment에 evaluator만 다시 붙이기

LangSmith로 offline evaluation을 돌리고 나면 이런 순간이 자주 온다.

- target 함수는 다시 돌리고 싶지 않은데 새 evaluator만 추가하고 싶다
- 실험 결과는 이미 있는데 pass/fail 기준을 하나 더 검증하고 싶다
- 비용이 큰 agent 실험이라 baseline을 재실행하지 않고 추가 점수만 붙이고 싶다
- 사람이 큐에서 모아 둔 실패 패턴을 새 evaluator로 만들어 과거 experiment에 일괄 적용하고 싶다

이럴 때 LangSmith는 기존 experiment를 다시 실행하지 않고, 이미 저장된 trace에 evaluator만 추가로 돌릴 수 있다.

공식 문서 기준으로 이 기능은 현재 Python SDK에서 지원된다.
핵심은 새 target 함수를 넘기는 대신 기존 `experiment`의 이름이나 ID를 `evaluate()` 또는 `aevaluate()`에 넘기는 것이다.

## 언제 이 방식이 유용한가

다음 상황이면 특히 효율적이다.

- LLM 호출 비용이 큰 실험을 다시 재생성하고 싶지 않을 때
- evaluator 로직만 바뀌었고 모델 출력은 그대로 재사용해도 될 때
- 기존 결과에 새 품질 기준을 빠르게 추가하고 싶을 때
- CI에서 "새 evaluator 통과 여부"만 확인하고 싶을 때

반대로 target 로직, prompt, tool 호출 경로 자체가 바뀌었다면 새 experiment를 다시 실행하는 편이 맞다.

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

## 1. 기존 experiment 이름이나 ID를 그대로 넘기면 된다

가장 단순한 형태는 아래와 같다.

```python
from langsmith import evaluate


def always_half(inputs: dict, outputs: dict) -> float:
    return 0.5


experiment_name = "my-experiment:abc"

results = evaluate(
    experiment_name,
    evaluators=[always_half],
)
```

중요한 점은 다음과 같다.

- 첫 번째 인자가 target 함수가 아니라 기존 experiment 식별자다
- evaluator는 기존 trace의 `inputs`, `outputs`, intermediate steps를 기준으로 실행된다
- 애플리케이션 target 자체는 다시 실행되지 않는다

즉, "실험을 다시 돌리는 것"이 아니라 "기존 실험 결과에 새 채점 기준을 덧붙이는 것"에 가깝다.

## 2. 실무에서는 key를 명시하는 evaluator를 먼저 붙이는 편이 안전하다

간단한 float 반환도 가능하지만, 실무에서는 key를 명시한 dict 형태가 나중에 보기에 더 낫다.

```python
from langsmith import evaluate


def policy_check(inputs: dict, outputs: dict) -> dict:
    text = (outputs or {}).get("output", "")
    mentions_refund = "refund" in text.lower()
    return {
        "key": "refund_policy_mentioned",
        "score": 1 if mentions_refund else 0,
        "comment": "Refund guidance detected" if mentions_refund else "No refund guidance found",
    }


results = evaluate(
    "support-agent-prod:baseline-a1b2c3",
    evaluators=[policy_check],
)
```

이 패턴이 좋은 이유는 명확하다.

- LangSmith UI에서 evaluator 이름이 분명하게 남는다
- 후속 집계나 비교에서 어떤 기준이 추가됐는지 읽기 쉽다
- categorical 성격의 pass/fail 점수를 안정적으로 남기기 쉽다

## 3. run과 example을 함께 쓰는 evaluator도 그대로 붙일 수 있다

기존 experiment 재평가라고 해서 evaluator 형태가 단순해야 하는 것은 아니다.
예제 정답과 실제 run을 같이 보는 evaluator도 그대로 쓸 수 있다.

```python
from langsmith import evaluate


def exact_match(run, example):
    predicted = ((run.outputs or {}).get("output") or "").strip().lower()
    expected = ((example.outputs or {}).get("output") or "").strip().lower()
    return {
        "key": "exact_match",
        "score": int(predicted == expected),
    }


results = evaluate(
    "faq-eval:2026-06-20",
    evaluators=[exact_match],
)
```

이 방식은 다음 상황에서 특히 유용하다.

- 과거 dataset 기반 experiment에 deterministic evaluator를 나중에 추가할 때
- annotation queue에서 정리한 정답 output을 dataset으로 승격한 뒤 다시 채점할 때
- LLM-as-judge 대신 코드 evaluator로 regression gate를 만들고 싶을 때

## 4. 비동기 평가가 필요하면 `aevaluate()`로 같은 패턴을 쓴다

문서 기준으로 기존 experiment 평가는 `evaluate()`뿐 아니라 `aevaluate()`에도 같은 방식으로 적용된다.

```python
import asyncio
from langsmith import aevaluate


def brevity_score(inputs: dict, outputs: dict) -> dict:
    text = (outputs or {}).get("output", "")
    return {
        "key": "brevity",
        "score": 1 if len(text) < 400 else 0,
    }


async def main():
    await aevaluate(
        "support-agent-prod:baseline-a1b2c3",
        evaluators=[brevity_score],
    )


asyncio.run(main())
```

대량 실험 후 후처리 파이프라인을 async 코드로 짜고 있다면 이 형태가 맞다.

## 5. 결과를 로컬 스크립트에서 바로 읽어 quality gate로 이어갈 수 있다

기존 experiment에 evaluator를 추가한 뒤, 결과를 스크립트에서 바로 순회해 배포 기준으로 써도 된다.

```python
from langsmith import evaluate


def answer_present(inputs: dict, outputs: dict) -> dict:
    text = (outputs or {}).get("output", "").strip()
    return {"key": "answer_present", "score": int(bool(text))}


results = evaluate(
    "faq-eval:2026-06-20",
    evaluators=[answer_present],
    blocking=True,
)

failures = 0

for result in results:
    eval_results = result["evaluation_results"]["results"]
    if any(item["key"] == "answer_present" and item["score"] == 0 for item in eval_results):
        failures += 1

if failures:
    raise SystemExit(f"quality gate failed: {failures} empty answers")
```

이렇게 하면 LangSmith를 단순한 실험 저장소가 아니라 배포 전 검증 파이프라인의 일부로 쓸 수 있다.

## 자주 틀리는 점

### 1. 새 evaluator를 붙이는데 target 함수도 같이 다시 넘긴다

기존 experiment 재평가의 핵심은 "experiment 식별자"를 넘기는 것이다.
target 함수를 넘기면 새 experiment 실행이 될 수 있다.

### 2. target 로직이 바뀌었는데 기존 experiment에 evaluator만 추가한다

이 기능은 기존 출력물을 재채점하는 용도다.
prompt, tool 호출, retrieval 경로가 달라졌다면 새 experiment를 만들어야 한다.

### 3. Python SDK 전용이라는 점을 놓친다

공식 문서 기준으로 기존 experiment 평가 추가는 현재 Python SDK에서 지원된다.
다른 언어 SDK 흐름을 전제로 설계하면 막힐 수 있다.

### 4. evaluator가 기존 trace에 필요한 필드를 안 남긴 실험에 붙는다

새 evaluator가 intermediate steps나 특정 output 필드를 기대한다면, 원래 experiment trace에 그 정보가 남아 있어야 한다.
기록되지 않은 데이터를 나중에 evaluator가 복구해 주지는 않는다.

### 5. "과거 experiment에 새 점수 추가"와 "실험 비교"를 같은 단계로 본다

먼저 필요한 evaluator를 각 experiment에 붙여 점수를 채우고, 그 다음에 compare view나 지표 조회로 넘어가는 편이 정리된다.

## 추천 운영 패턴

개인적으로는 아래 흐름이 가장 무난하다.

1. baseline experiment를 먼저 안정적으로 저장한다
2. annotation queue나 실서비스 실패 사례에서 새 evaluator 아이디어를 뽑는다
3. 기존 experiment에 evaluator만 다시 붙여 빠르게 점수를 채운다
4. 결과를 quality gate나 compare view로 연결한다

이렇게 하면 expensive experiment를 재실행하지 않고도 평가 기준을 계속 발전시킬 수 있다.

## 참고 자료

- [How to add evaluators to an existing experiment (Python only)](https://docs.langchain.com/langsmith/evaluate-existing-experiment)
- [How to read experiment results locally](https://docs.langchain.com/langsmith/read-local-experiment-results)
- [Run an evaluation](https://docs.langchain.com/langsmith/evaluation-quickstart)
