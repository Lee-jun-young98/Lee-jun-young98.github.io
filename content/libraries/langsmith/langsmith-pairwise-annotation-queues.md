---
title: "LangSmith pairwise annotation queue로 사람 A/B 리뷰 붙이기"
description: "LangSmith comparative experiment와 pairwise annotation queue를 연결해 두 실험 출력을 사람 기준으로 빠르게 비교하는 실전 노트"
date: 2026-07-14
tags:
  - langsmith
  - evaluation
  - human-feedback
  - python
aliases:
  - "/blog/langsmith-pairwise-annotation-queues"
---

# LangSmith pairwise annotation queue로 사람 A/B 리뷰 붙이기

LLM 품질 비교에서는 절대 점수보다 상대 비교가 더 쉬운 경우가 많다.

- 두 버전 중 어느 답이 더 자연스러운지는 바로 보이는데 5점 척도는 애매하다
- prompt, model, retrieval 변경이 실제로 나아졌는지 사람 눈으로 빨리 확인하고 싶다
- pairwise judge 결과를 사람 리뷰로 다시 검증하고 싶다

이럴 때 LangSmith의 `pairwise annotation queue`가 잘 맞는다. 공식 문서 기준으로 pairwise queue는 두 experiment의 run을 나란히 보여 주고, reviewer가 Run A, Run B, 또는 동률을 선택하게 만든다.

이번 글에서는 아래 흐름을 정리한다.

1. 비교 가능한 두 experiment를 준비하기
2. pairwise evaluation과 pairwise annotation queue를 역할 분리하기
3. 사람이 빠르게 판단할 수 있는 rubric 설계하기
4. pairing, reviewer 설정, dataset 해석에서 자주 나는 실수 피하기

## 언제 pairwise queue를 써야 하나

다음 상황이면 보통 single-run 점수보다 pairwise가 낫다.

- 요약, 톤, helpfulness처럼 상대 비교가 쉬운 품질 차원
- baseline과 candidate를 릴리스 직전에 비교하는 회귀 점검
- RAG 변경 전후를 사람이 직접 A/B 검토하는 경우

반대로 아래면 다른 도구가 더 잘 맞는다.

- production 불만 trace를 개별 triage해야 할 때
- 정답 레퍼런스가 있어서 exact match, F1, code evaluator로 충분할 때
- 정책 위반 여부처럼 pass/fail이 핵심일 때

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U langsmith
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_PROJECT="qa-regression"
```

```python
from langsmith import Client

client = Client()
```

## 1. 먼저 같은 dataset 기준의 두 experiment를 만든다

공식 문서 기준으로 pairwise annotation queue는 정확히 두 experiment를 선택한 뒤 생성한다. 즉 운영 trace를 바로 pairwise queue로 보내는 구조가 아니라, 같은 dataset 위에서 만든 두 experiment가 먼저 있어야 한다.

```python
from langsmith import evaluate


def baseline_app(inputs: dict) -> dict:
    question = inputs["question"]
    return {"answer": f"baseline answer for: {question}"}


def candidate_app(inputs: dict) -> dict:
    question = inputs["question"]
    return {"answer": f"candidate answer for: {question}"}


baseline_results = evaluate(
    baseline_app,
    data="support-qa-dataset",
    experiment_prefix="support-baseline",
)

candidate_results = evaluate(
    candidate_app,
    data="support-qa-dataset",
    experiment_prefix="support-candidate",
)

print(baseline_results.experiment_name)
print(candidate_results.experiment_name)
```

여기서 중요한 점은 두 experiment가 같은 example 집합을 써야 한다는 것이다. 입력이 다르면 reviewer가 답변 차이가 아니라 질문 차이를 보게 된다.

## 2. pairwise evaluator와 pairwise queue는 다르다

LangSmith에는 비슷해 보여도 역할이 다른 두 레이어가 있다.

- pairwise evaluation: evaluator나 judge가 두 실험을 비교
- pairwise annotation queue: 사람이 두 실험 출력을 UI에서 비교

실무에서는 pairwise evaluation으로 1차 신호를 만들고, 중요한 샘플만 사람 큐로 넘기는 구성이 효율적이다.

```python
from langsmith import evaluate


def prefer_more_helpful(outputs_a: dict, outputs_b: dict) -> dict:
    answer_a = outputs_a["answer"]
    answer_b = outputs_b["answer"]

    if len(answer_a) == len(answer_b):
        preferred = "tie"
    elif len(answer_a) > len(answer_b):
        preferred = "a"
    else:
        preferred = "b"

    return {
        "key": "helpfulness_pairwise",
        "scores": {"preferred": preferred},
    }


comparative = evaluate(
    target=["support-baseline", "support-candidate"],
    evaluators=[prefer_more_helpful],
    experiment_prefix="support-baseline-vs-candidate",
)

print(comparative.experiment_name)
```

이 코드는 queue를 직접 만들지는 않지만, 어떤 샘플이 엇갈리는지 먼저 좁히는 데 유용하다.

## 3. pairwise annotation queue는 UI에서 생성한다

현재 공식 문서 기준으로 pairwise queue는 Datasets & Experiments 페이지에서 정확히 두 experiment를 선택한 뒤 `Annotate -> Add to Pairwise Annotation Queue`로 만든다. LangSmith가 두 experiment의 run을 시간 순서대로 짝지어 queue를 채운다.

실전 절차는 단순하다.

1. baseline과 candidate experiment를 같은 dataset에 실행한다
2. UI에서 두 experiment만 선택한다
3. 새 pairwise queue를 만들거나 기존 queue에 추가한다
4. reviewer 수, reservation, rubric을 설정한다

문서 기준으로 pairwise queue는 default dataset을 쓰지 않는다. single-run queue처럼 운영 trace를 dataset으로 승격하는 용도와는 결이 다르다.

## 4. rubric은 절대 점수보다 비교 질문으로 설계한다

pairwise queue에서는 annotator가 "몇 점인가"보다 "무엇이 더 나은가"를 빠르게 답할 수 있어야 한다.

좋은 rubric 예시는 이렇다.

- `correctness`: 어느 답이 질문 의도를 더 정확히 해결하는가
- `helpfulness`: 어느 답이 다음 행동으로 이어지기 쉬운가
- `conciseness`: 어느 답이 덜 장황하면서 핵심을 유지하는가
- `tone`: 어느 답이 사용자에게 더 자연스럽고 신뢰감 있는가

반대로 아래는 좋지 않다.

- `quality`: 너무 넓어서 사람마다 기준이 달라진다
- `factuality_and_style_and_policy`: 한 항목에 기준을 너무 많이 섞는다

## 5. reviewer 설정이 throughput을 결정한다

공식 문서와 changelog 기준으로 pairwise queue도 reviewer 수, reservation, reviewer access 정책이 중요하다.

실무 기준으로는 대체로 이렇게 시작하면 무난하다.

- 빠른 승부 확인: reviewer 1명
- 모델 승격 판단: reviewer 2명 이상
- disagreement 재검토: 소수 샘플만 추가 확인

리뷰어를 많이 붙일수록 신뢰도는 올라가지만 queue 소진 속도는 크게 느려진다. pairwise는 보통 넓게 빠르게 훑는 용도라서, 처음부터 reviewer 수를 크게 잡는 것보다 disagreement가 많은 구간만 재검토하는 편이 현실적이다.

## 추천 운영 패턴

### 패턴 A. prompt 개편 전후 비교

- 같은 dataset으로 baseline/candidate experiment 실행
- pairwise evaluator로 1차 비교
- 애매한 사례만 pairwise queue에서 사람 리뷰

### 패턴 B. RAG retrieval 변경 검증

- retrieval 전략 A/B를 같은 질문 집합에 실행
- rubric을 `correctness`, `citation_quality`, `conciseness`로 분리
- pairwise 결과를 승격 결정 근거로 사용

### 패턴 C. release gate

- 새 모델 릴리스 전 기존 production chain과 comparative experiment 생성
- reviewer 2명으로 소량 표본만 pairwise review
- 동률 또는 패배 비율이 높으면 릴리스 보류

## 자주 막히는 지점

### 1. 같은 dataset 위 실험이 아니면 비교가 흐려진다

pairwise queue는 같은 입력에 대한 두 답변 비교가 핵심이다.

### 2. production triage 용도로 쓰면 안 맞는다

공식 문서 기준으로 pairwise queue는 두 experiment 비교용이다. 운영 불만 trace 검토는 single-run queue가 더 적합하다.

### 3. rubric을 너무 넓게 잡으면 annotator agreement가 떨어진다

왜 이겼는지 남지 않을 정도로 넓거나, 반대로 한 항목에 기준이 너무 많아도 품질이 떨어진다.

### 4. reviewer 수를 처음부터 크게 잡으면 병목이 생긴다

pairwise는 샘플 수가 빠르게 늘어나기 때문에 초기에는 1 reviewer로 넓게 보고 필요한 구간만 재검토하는 편이 낫다.

### 5. pairwise evaluator와 사람 리뷰 결과는 다를 수 있다

정상이다. 이 차이를 judge prompt나 rubric 개선 재료로 쓰는 편이 더 생산적이다.

## 마무리

LangSmith pairwise annotation queue는 "절대 점수"보다 "둘 중 무엇이 더 낫나"가 쉬운 문제에 강하다. 핵심은 세 가지다.

- 먼저 같은 dataset 기준의 두 experiment를 준비하기
- 기계 pairwise 평가와 사람 pairwise 리뷰를 역할 분리하기
- rubric을 점수표가 아니라 비교 질문으로 설계하기

이 구조를 잡아두면 prompt, model, retrieval 변경이 실제로 좋아졌는지 사람 기준으로 빠르게 검증할 수 있다.

## 참고 자료

- [Use annotation queues](https://docs.langchain.com/langsmith/annotation-queues)
- [How to run a pairwise evaluation](https://docs.langchain.com/langsmith/evaluate-pairwise)
- [Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)
- [Create Annotation Queue API](https://docs.langchain.com/langsmith/smith-api/annotation-queues/create-annotation-queue)
- [How to use the REST API](https://docs.langchain.com/langsmith/run-evals-api-only)
