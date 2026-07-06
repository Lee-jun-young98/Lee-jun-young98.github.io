---
title: "LangSmith assertion으로 human review를 offline eval로 연결하기"
description: "LangSmith single-run annotation queue의 assertion을 dataset example로 저장하고, reference_outputs[\"assertions\"] 기반 evaluator로 다시 점수화하는 실전 흐름 정리"
date: 2026-07-06
tags:
  - langsmith
  - evaluation
  - human-feedback
  - python
aliases:
  - "/blog/langsmith-assertions-offline-evals"
---

# LangSmith assertion으로 human review를 offline eval로 연결하기

LangSmith를 쓰다 보면 사람 검토와 offline evaluation이 따로 놀 때가 많다.

- 운영 trace는 annotation queue에서 사람이 본다
- offline eval은 dataset의 reference answer를 기준으로 돈다
- 그런데 실제 실패 사례는 "정답 문장"보다 "이 답변에 꼭 들어가야 할 조건"으로 적는 편이 더 빠를 때가 많다

이럴 때 LangSmith `assertions`가 맞다.  
single-run annotation queue에서 리뷰어가 자연어 기준을 적으면, LangSmith가 그 기준을 dataset example의 `outputs["assertions"]`로 저장한다. 이후 `evaluate()`에서 `reference_outputs["assertions"]`를 읽어 새 출력이 그 기준을 만족하는지 다시 채점하면 된다.

2026년 7월 6일 기준 공식 문서를 바탕으로 정리하면 핵심은 네 가지다.

1. assertions는 single-run annotation queue에서만 쓸 수 있다
2. assertions는 LangSmith UI 전용 기능이다
3. 저장된 example의 실제 reference output 대신 assertion 목록이 `outputs`에 들어간다
4. evaluator는 `reference_outputs["assertions"]`를 읽어 여러 점수를 한 번에 반환할 수 있다

## 언제 특히 유용한가

아래 같은 경우에 assertion 기반 흐름이 잘 맞는다.

- 사람은 "정답 문장 전체"보다 "반드시 환불 기한을 말해야 한다" 같은 acceptance criteria를 더 빨리 적는다
- production 실패 사례를 바로 dataset으로 승격해 회귀 테스트에 넣고 싶다
- 동일한 실패 유형을 LLM judge와 rule-based check로 함께 막고 싶다
- 팀이 정답 텍스트보다 리뷰 기준을 먼저 모으고, 이후 prompt나 retriever를 고치고 싶다

반대로 reference answer가 이미 명확하고 deterministic한 exact match가 충분하면 assertions까지 갈 필요는 없다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith openai
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:OPENAI_API_KEY="sk-your-key"
```

```python
from langsmith import Client

client = Client()
```

## 1. single-run queue에 default dataset을 먼저 연결한다

공식 문서 기준 assertions는 single-run annotation queue에서 리뷰하면서 작성한다.  
이때 queue에 default dataset이 연결돼 있으면, 리뷰어가 `Add to Dataset & Next`를 누를 때 저장 경로를 매번 고르지 않아도 된다.

실무에서는 보통 이렇게 잡는다.

- queue 목적: production triage, release review, safety audit 중 하나로 좁힌다
- default dataset: 그 queue에서 건져 올린 케이스를 쌓을 전용 평가셋으로 연결한다
- rubric: 점수형 feedback과 reviewer notes는 계속 쓰되, "정답 문장 대신 기준만 적고 싶을 때" assertions를 쓴다

queue 자체를 SDK로 만들 수는 있지만, assertions 입력은 현재 UI 전용이다.  
즉 queue 생성 자동화와 assertion 작성은 분리해서 생각하는 편이 낫다.

## 2. assertion을 저장하면 example output은 이런 모양이 된다

공식 문서에 나온 저장 형태는 아래와 같다.

```json
{
  "assertions": [
    {
      "key": "must_cite_source",
      "comment": "The response cites the source URL it is drawing from."
    },
    {
      "key": "must_not_invent_url",
      "comment": "The response does not include URLs that do not appear in the inputs."
    }
  ]
}
```

중요한 점은 두 가지다.

- `must_`, `must_not_` 접두사는 관례일 뿐이고 LangSmith가 특별 취급하지 않는다
- assertion을 하나라도 추가하면 queue 편집기의 Outputs 패널은 실제 run output이 아니라 assertion preview를 저장 대상으로 보여 준다

즉 assertions는 "이 run이 뭐라고 답했나"를 dataset에 남기는 기능이 아니라, "앞으로는 어떤 답이 맞다고 볼 것인가"를 남기는 기능에 가깝다.

## 3. 데모나 부트스트랩용으로는 assertion-shaped example을 코드로도 만들 수 있다

여기서부터는 공식 문서의 example data format을 바탕으로 한 실무적 추론이다.  
문서에는 example `outputs`가 assertions를 담을 수 있다고 되어 있으므로, 초기 부트스트랩이나 테스트용 dataset이라면 같은 JSON 구조를 SDK `create_examples()`로 직접 넣어도 된다.

```python
from langsmith import Client

client = Client()

dataset_name = "support-assertion-regression"

if not client.has_dataset(dataset_name=dataset_name):
    dataset = client.create_dataset(
        dataset_name=dataset_name,
        description="Assertion-based regression checks for support answers",
    )
    client.create_examples(
        dataset_id=dataset.id,
        examples=[
            {
                "inputs": {
                    "question": "환불은 언제까지 가능한가요?"
                },
                "outputs": {
                    "assertions": [
                        {
                            "key": "must_include_refund_window",
                            "comment": "답변은 구매 후 7일 이내 환불 가능 기간을 분명하게 말해야 한다."
                        },
                        {
                            "key": "must_not_promise_unlimited_refund",
                            "comment": "답변은 무기한 환불이 가능하다고 말하면 안 된다."
                        }
                    ]
                },
                "metadata": {"topic": "refund-policy"},
            }
        ],
    )
```

운영 케이스를 사람 검토로 쌓을 때는 UI assertions가 정석이고, 테스트 초기에는 이런 식으로 assertion-shaped example을 코드에서 미리 만들 수 있다.

## 4. evaluator는 `reference_outputs["assertions"]`를 읽어서 여러 점수를 반환하면 된다

공식 문서 기준 Python evaluator는 여러 metric을 한 번에 반환할 수 있다.  
assertion마다 한 개의 feedback result를 만들면 queue에서 모은 acceptance criteria를 그대로 experiment 점수로 다시 쓸 수 있다.

아래 예시는 간단한 rule-based check다.

```python
from typing import Any


def grade_against_assertions(
    outputs: dict[str, Any],
    reference_outputs: dict[str, Any],
) -> list[dict[str, Any]]:
    answer = outputs["answer"].lower()
    results = []

    for assertion in reference_outputs.get("assertions", []):
        key = assertion["key"]

        if key == "must_include_refund_window":
            score = 1 if "7일" in answer or "7 days" in answer else 0
            comment = "환불 가능 기간 언급 여부"
        elif key == "must_not_promise_unlimited_refund":
            banned = ["무기한 환불", "unlimited refund", "언제든 환불"]
            score = 0 if any(token in answer for token in banned) else 1
            comment = "무기한 환불 약속 금지"
        else:
            score = 0
            comment = f"Unknown assertion key: {key}"

        results.append(
            {
                "key": key,
                "score": score,
                "comment": comment,
            }
        )

    return results
```

이 패턴의 장점은 분명하다.

- 한 run이 여러 acceptance criteria를 동시에 통과했는지 본다
- 실패한 기준이 metric key로 바로 남는다
- 동일한 evaluator 안에서 deterministic check와 LLM judge를 섞을 수 있다

## 5. LLM judge를 섞고 싶으면 assertion `comment`를 그대로 판정 기준으로 넘긴다

assertion의 진짜 장점은 reviewer가 남긴 자연어 기준을 그대로 판정 프롬프트에 재사용할 수 있다는 점이다.

```python
from openai import OpenAI

oai = OpenAI()


def judge_one_assertion(answer: str, assertion: dict) -> int:
    prompt = f"""
You are grading a support answer.

Assertion key: {assertion["key"]}
Assertion requirement: {assertion["comment"]}

Answer:
{answer}

Return only 1 if the answer satisfies the assertion, otherwise 0.
""".strip()

    response = oai.responses.create(
        model="gpt-5.1-mini",
        input=prompt,
    )
    text = response.output_text.strip()
    return 1 if text == "1" else 0


def llm_assertion_evaluator(outputs: dict, reference_outputs: dict) -> list[dict]:
    answer = outputs["answer"]
    results = []

    for assertion in reference_outputs.get("assertions", []):
        results.append(
            {
                "key": assertion["key"],
                "score": judge_one_assertion(answer, assertion),
                "comment": assertion["comment"],
            }
        )

    return results
```

처음에는 rule-based evaluator로 빠르게 시작하고, 애매한 기준만 LLM judge로 넘기는 혼합형이 운영 부담이 적다.

## 6. `evaluate()`와 `blocking=False`를 붙이면 로컬 디버깅이 빠르다

assertion evaluator는 기준 수가 늘어나면 어떤 케이스에서 무엇이 깨졌는지 먼저 보고 싶을 때가 많다.  
공식 문서 기준 `blocking=False`를 쓰면 `ExperimentResults`를 스트리밍처럼 받아 바로 확인할 수 있다.

```python
from langsmith import Client

client = Client()


def support_bot(inputs: dict) -> dict:
    question = inputs["question"]
    if "환불" in question:
        return {"answer": "구매 후 7일 이내에 환불을 요청할 수 있습니다."}
    return {"answer": "고객센터에 문의해 주세요."}


results = client.evaluate(
    support_bot,
    data="support-assertion-regression",
    evaluators=[grade_against_assertions],
    experiment_prefix="support-assertion-check",
    blocking=False,
)

rows = list(results)

for row in rows:
    print(row["run"].inputs)
    print(row["run"].outputs)
    print(row["evaluation_results"]["results"])
```

CI에서는 평균 점수나 특정 assertion 실패 여부를 기준으로 바로 실패 처리하기 쉽다.

## 자주 막히는 지점

### 1. pairwise queue에서도 assertions를 쓸 수 있다고 착각한다

공식 문서 기준 assertions는 single-run annotation queue 전용이다.  
pairwise queue는 두 실험 결과를 비교하는 용도라서 이 흐름이 그대로 들어가지 않는다.

### 2. assertion이 실제 run output을 저장한다고 생각한다

assertion을 넣은 example은 "정답 문장"이 아니라 "기준 목록"을 outputs에 저장한다.  
실제 잘못된 답변 자체를 reference output으로 재사용하려는 목적이라면 assertions와 맞지 않는다.

### 3. assertion key를 너무 즉흥적으로 짓는다

`must_include_refund_window`, `must_not_invent_url`처럼 evaluator 분기와 대시보드 해석이 쉬운 이름으로 고정하는 편이 낫다.  
자유도가 높다고 해서 자연어 문장을 key로 쓰기 시작하면 이후 자동 채점이 지저분해진다.

### 4. 모든 assertion을 LLM judge로만 처리한다

URL 존재, 금지어 포함 여부, schema 준수처럼 기계적으로 판정 가능한 건 rule-based로 빼는 편이 더 싸고 안정적이다.  
LLM judge는 애매한 의미 판정에만 쓰는 편이 좋다.

### 5. queue는 운영 팀이 보고 evaluator는 따로 만든다고 분리해 버린다

assertion의 핵심 가치는 human review를 future regression test로 승격하는 데 있다.  
사람이 남긴 기준이 실제 eval에 안 들어가면 queue는 단순 triage inbox로만 남는다.

## 추천 흐름

1. production triage용 single-run queue를 만든다
2. default dataset을 연결한다
3. 리뷰어는 corrected output 대신 assertion을 남긴다
4. `reference_outputs["assertions"]` 기반 evaluator를 만든다
5. deterministic check와 LLM judge를 섞어 offline eval에 붙인다
6. 자주 깨지는 assertion key는 prompt, retriever, tool flow 개선 항목으로 다시 올린다

LangSmith assertions의 실전 포인트는 "사람 검토 메모"를 "다음 배포를 막는 평가 기준"으로 바꾸는 데 있다.  
정답 문장을 매번 새로 쓰기 어려운 팀이라면, 이 흐름이 human review와 regression eval 사이의 연결 비용을 가장 많이 줄여 준다.

## 참고 자료

- [Use assertions](https://docs.langchain.com/langsmith/assertions)
- [Use annotation queues](https://docs.langchain.com/langsmith/annotation-queues)
- [Example data format](https://docs.langchain.com/langsmith/example-data-format)
- [How to return multiple scores in one evaluator](https://docs.langchain.com/langsmith/multiple-scores)
- [How to read experiment results locally](https://docs.langchain.com/langsmith/read-local-experiment-results)
- [How to define an LLM-as-a-judge evaluator](https://docs.langchain.com/langsmith/llm-as-judge)
