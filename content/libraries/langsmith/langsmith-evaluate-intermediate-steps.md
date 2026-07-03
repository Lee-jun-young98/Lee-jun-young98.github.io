---
title: "LangSmith evaluate()에서 중간 단계까지 평가하기: run/rootRun 실전 패턴"
description: "LangSmith evaluate() evaluator에서 run/rootRun을 순회해 retrieval과 tool step까지 함께 채점하는 실전 노트"
date: 2026-07-03
tags:
  - langsmith
  - evaluation
  - python
  - rag
aliases:
  - "/blog/langsmith-evaluate-intermediate-steps"
---

# LangSmith evaluate()에서 중간 단계까지 평가하기: run/rootRun 실전 패턴

LangSmith `evaluate()`를 붙이면 보통 최종 응답만 채점하는 데서 멈춘다. 그런데 실제 운영에서는 중간 단계가 먼저 깨지는 경우가 많다.

- retriever가 엉뚱한 문서를 가져온다
- tool 호출은 했지만 순서가 이상하다
- answer는 그럴듯한데 근거 문서를 제대로 쓰지 않았다
- 프롬프트를 바꿨더니 generation보다 query rewriting이 먼저 흔들린다

이럴 때는 evaluator가 `outputs`만 보는 것으로는 부족하다. LangSmith 공식 문서 기준으로는 evaluator에서 `run` 또는 `rootRun` 객체를 순회해 trace 안의 child run까지 읽어 평가할 수 있다.

## 언제 쓰면 좋은가

아래 같은 파이프라인이면 중간 단계 평가가 특히 유용하다.

- RAG에서 retrieval 품질과 answer grounding을 분리해서 보고 싶을 때
- agent/tool calling에서 "정답은 맞는데 과정이 불안정한" 상태를 잡고 싶을 때
- 기존 실험 trace에 evaluator만 추가해서 원인 분석을 하고 싶을 때
- 최종 점수 하나보다 "어느 단계가 깨졌는지"를 CI나 회귀 테스트에서 확인하고 싶을 때

## 사전 준비

공식 문서 기준 예제는 `langsmith>=0.3.13`를 사용한다.

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

## 핵심 아이디어

`evaluate()`의 row-level evaluator는 `inputs`, `outputs`, `reference_outputs`만 받는다고 생각하기 쉽다. 하지만 trace가 남아 있다면 `run` 또는 `rootRun`도 받을 수 있고, 여기서 child run을 따라가며 중간 단계를 직접 검사할 수 있다.

실무적으로는 아래처럼 생각하면 된다.

- target function: 무엇을 실행할지 정의
- trace: 그 실행 과정 전체를 기록
- evaluator: 최종 출력뿐 아니라 trace 내부 단계까지 읽어 점수화

즉, "실험은 한 번 돌리고 평가 기준은 여러 층으로 나눈다"가 핵심이다.

## 1. trace가 남는 target function을 만든다

중간 단계를 평가하려면 그 단계가 trace에 남아 있어야 한다. 그래서 helper 함수에도 `@traceable`을 붙여두는 편이 좋다.

```python
from langsmith import traceable, wrappers
from openai import OpenAI

oai_client = wrappers.wrap_openai(OpenAI())


@traceable
def rewrite_query(question: str) -> str:
    response = oai_client.chat.completions.create(
        model="gpt-5.4-mini",
        temperature=0,
        messages=[
            {"role": "system", "content": "사용자 질문을 검색용 짧은 질의로 바꿔라."},
            {"role": "user", "content": question},
        ],
    )
    return response.choices[0].message.content


@traceable(run_type="retriever")
def retrieve_docs(query: str) -> list[dict]:
    fake_docs = [
        {
            "page_content": "환불은 구매일로부터 7일 이내에 가능하다.",
            "metadata": {"source": "refund-policy"},
        },
        {
            "page_content": "배송 지연 보상은 고객센터 확인 후 처리한다.",
            "metadata": {"source": "shipping-policy"},
        },
    ]
    return fake_docs


@traceable
def answer_question(question: str, docs: list[dict]) -> str:
    context = "\n\n".join(doc["page_content"] for doc in docs)
    response = oai_client.chat.completions.create(
        model="gpt-5.4-mini",
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": f"다음 문서만 근거로 답해라.\n\n{context}",
            },
            {"role": "user", "content": question},
        ],
    )
    return response.choices[0].message.content


@traceable
def rag_pipeline(question: str) -> str:
    query = rewrite_query(question)
    docs = retrieve_docs(query)
    return answer_question(question, docs)


def rag_target(inputs: dict) -> dict:
    return {"answer": rag_pipeline(inputs["question"])}
```

포인트는 `rag_target()`이 dataset input/output 인터페이스를 맞추고, 내부 helper들이 trace를 풍부하게 남긴다는 점이다.

## 2. 작은 평가용 dataset을 만든다

```python
from langsmith import Client

client = Client()

dataset_name = "support-rag-intermediate-eval"

if not client.has_dataset(dataset_name=dataset_name):
    dataset = client.create_dataset(
        dataset_name=dataset_name,
        description="RAG retrieval/generation 중간 단계 평가용 최소 데이터셋",
    )
    client.create_examples(
        dataset_id=dataset.id,
        examples=[
            {
                "inputs": {"question": "환불 가능 기간은 언제까지인가요?"},
                "outputs": {"answer": "구매일로부터 7일 이내에 환불을 요청할 수 있습니다."},
                "metadata": {"topic": "refund"},
            },
            {
                "inputs": {"question": "배송 지연 보상은 어떻게 처리되나요?"},
                "outputs": {"answer": "고객센터가 보상 가능 여부를 확인해 처리합니다."},
                "metadata": {"topic": "shipping"},
            },
        ],
    )
```

중간 단계 평가는 evaluator가 복잡해지기 쉬우므로 dataset은 더 작게 유지하는 편이 낫다. 처음에는 실패 케이스를 설명할 수 있는 예제 5~20개면 충분하다.

## 3. `run`을 직접 읽는 evaluator를 만든다

공식 문서의 핵심은 evaluator가 `run`/`rootRun`을 순회해 child run을 읽는 패턴이다.

```python
from langsmith.schemas import Run


def find_child_run(parent: Run, name: str) -> Run:
    return next(child for child in parent.child_runs or [] if child.name == name)


def retrieval_has_expected_source(root_run: Run, example) -> bool:
    pipeline_run = find_child_run(root_run, "rag_pipeline")
    retrieve_run = find_child_run(pipeline_run, "retrieve_docs")

    sources = {
        doc["metadata"]["source"]
        for doc in retrieve_run.outputs["output"]
    }
    expected_source = {
        "refund": "refund-policy",
        "shipping": "shipping-policy",
    }[example.metadata["topic"]]
    return expected_source in sources
```

여기서 중요한 점은 evaluator가 최종 `outputs["answer"]`를 안 보고도 점수를 낼 수 있다는 것이다. 즉 retrieval 품질을 generation과 분리해서 볼 수 있다.

## 4. 최종 답변 evaluator와 같이 돌린다

중간 단계 평가를 붙인다고 최종 응답 평가를 버릴 필요는 없다. 보통은 둘을 같이 돌려야 원인 분리가 쉬워진다.

```python
def exact_match(outputs: dict, reference_outputs: dict) -> bool:
    return outputs["answer"].strip() == reference_outputs["answer"].strip()
```

```python
results = client.evaluate(
    rag_target,
    data=dataset_name,
    evaluators=[retrieval_has_expected_source, exact_match],
    experiment_prefix="support-rag-intermediate",
    metadata={
        "model": "gpt-5.4-mini",
        "pipeline": "support-rag-v1",
    },
)
```

이 조합이면 아래 같은 해석이 가능해진다.

- retrieval 점수는 낮고 exact_match도 낮다: 문서 검색부터 깨진다
- retrieval 점수는 높고 exact_match만 낮다: generation/prompt 쪽 문제일 가능성이 크다
- 둘 다 높다: 최소한 기본 RAG 루프는 안정적이다

## 5. `blocking=False`로 실행 중 결과를 바로 확인할 수 있다

공식 문서 기준 `evaluate()`는 `ExperimentResults`를 반환하고, `blocking=False`를 주면 결과를 스트리밍처럼 받아볼 수 있다.

```python
streamed = client.evaluate(
    rag_target,
    data=dataset_name,
    evaluators=[retrieval_has_expected_source, exact_match],
    experiment_prefix="support-rag-intermediate-stream",
    blocking=False,
)

rows = []
for row in streamed:
    rows.append(row)

for row in rows:
    print(row["run"].inputs)
    print(row["evaluation_results"]["results"])
```

이 패턴은 evaluator가 의도대로 child run을 읽는지 디버깅하거나, 긴 평가 작업 도중 실패 사례를 먼저 보고 싶을 때 유용하다.

## 6. 기존 experiment에 evaluator만 다시 붙여도 된다

이미 실험이 있고 trace도 남아 있다면 애플리케이션을 다시 실행하지 않고 evaluator만 추가할 수 있다.

```python
from langsmith import evaluate

evaluate(
    "support-rag-baseline:abc123",
    evaluators=[retrieval_has_expected_source],
)
```

새 evaluator를 만든 뒤 "예전 실험에서 retrieval가 실제로 얼마나 흔들렸는지" 다시 보고 싶을 때 유용하다.

## 자주 막히는 지점

### 1. helper 함수에 trace가 안 남아서 child run을 찾을 수 없다

중간 단계 평가의 전제는 trace 구조가 충분히 세분화돼 있다는 점이다. 내부 함수가 trace에 안 남으면 evaluator에서 찾을 수 없다.

### 2. `run` 이름에 강하게 의존했는데 함수명이나 span 이름이 바뀌었다

`find_child_run(..., "retrieve_docs")` 같은 코드는 이름 변경에 취약하다. 리팩터링이 잦다면 run name 규칙을 먼저 고정하는 편이 낫다.

### 3. evaluator에서 child run 출력 스키마를 너무 낙관적으로 가정한다

예를 들어 `retrieve_run.outputs["output"]`가 항상 list라고 가정하면, retriever 구현을 바꾸는 순간 평가가 깨질 수 있다. 운영 evaluator라면 `None` 처리와 타입 방어를 넣는 편이 안전하다.

### 4. 최종 응답 평가와 섞어서 해석한다

중간 단계 평가는 "원인 분리"가 목적이다. retrieval evaluator, tool ordering evaluator, final answer evaluator를 분리해야 점수 해석이 쉬워진다.

### 5. 로컬 target 함수는 바뀌었는데 예전 experiment를 재평가하려 한다

기존 experiment 재평가는 캐시된 trace를 기반으로 하므로, 현재 코드가 아니라 당시 기록된 run 구조를 본다. 따라서 "현재 코드 검증"과 "과거 trace 재채점"은 서로 다른 작업으로 이해해야 한다.

## 추천 운영 패턴

1. final answer evaluator 1개만 먼저 붙인다
2. 실패가 많아지면 retrieval/tool step용 evaluator를 1개 더 만든다
3. 새 evaluator는 기존 experiment에 먼저 재적용해 패턴을 본다
4. 유의미하면 baseline 실험부터 CI 품질 게이트까지 확장한다

LangSmith 중간 단계 평가는 "정답/오답"만 보는 평가에서 한 단계 더 나아가, 왜 오답이 났는지를 trace 구조로 설명하게 해준다.

## 참고 자료

- [How to evaluate an application's intermediate steps](https://docs.langchain.com/langsmith/evaluate-on-intermediate-steps)
- [How to define a target function to evaluate](https://docs.langchain.com/langsmith/define-target-function)
- [How to add evaluators to an existing experiment (Python only)](https://docs.langchain.com/langsmith/evaluate-existing-experiment)
- [How to read experiment results locally](https://docs.langchain.com/langsmith/read-local-experiment-results)
- [Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)
