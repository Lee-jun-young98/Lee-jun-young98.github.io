---
title: "LangSmith offline evaluation 빠르게 시작하기: dataset, evaluate(), aevaluate()"
description: "LangSmith에서 작은 회귀 평가셋을 만들고 evaluate(), aevaluate(), upload_results=False, num_repetitions까지 실무 기준으로 정리한 한국어 학습 노트"
date: 2026-06-21
tags:
  - langsmith
  - evaluation
  - python
  - observability
aliases:
  - "/blog/langsmith-offline-evaluation-quickstart"
---

# LangSmith offline evaluation 빠르게 시작하기: dataset, evaluate(), aevaluate()

LangSmith를 tracing 용도로만 쓰다가, 프롬프트나 에이전트 변경이 들어갈 때마다 "이전보다 정말 나아졌는가?"를 확인하는 단계가 빠지는 경우가 많습니다.

이때 가장 먼저 붙이기 좋은 기능이 offline evaluation입니다. 작은 데이터셋을 만들고 `evaluate()`로 회귀 테스트를 돌리면, 감에 의존하던 변경을 실험 단위로 비교할 수 있습니다.

이 글에서는 다음 흐름만 빠르게 잡습니다.

- 작은 dataset 만들기
- target function과 evaluator 정의하기
- `evaluate()`로 실험 기록 남기기
- `upload_results=False`로 로컬 스모크 테스트 돌리기
- `aevaluate()`와 `num_repetitions`를 언제 쓰는지 구분하기

## 언제 유용한가

특히 아래 상황에서 바로 효율이 납니다.

- 프롬프트를 자주 바꾸는데 품질 회귀를 눈으로만 확인하고 있을 때
- agent나 workflow 변경 뒤에 "대충 괜찮아 보인다" 수준으로 배포하고 있을 때
- production trace에서 실패 케이스를 모았지만 다시 검증하는 루프가 없을 때
- CI에서 최소 품질 기준을 걸고 싶은데 아직 평가 코드가 없을 때

## 사전 준비

공식 문서 기준 2026-06-21 현재 Python 예제의 핵심 API는 `langsmith>=0.3.13`을 전제로 설명되는 경우가 많습니다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langsmith
```

LangSmith에 실험을 업로드하려면 최소한 아래 환경 변수가 필요합니다.

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_TRACING="true"
```

실제 LLM 호출까지 예제에 넣을 경우에는 모델 제공자 키도 추가합니다.

## 1. 가장 작은 평가셋 만들기

처음부터 큰 golden dataset을 만들 필요는 없습니다.  
실무에서는 실패 유형이 갈리는 예제 5~20개만 있어도 첫 회귀 테스트 세트를 만들 수 있습니다.

아래 예제는 고객 문의 우선순위를 `high` / `normal`로 분류하는 아주 작은 평가셋입니다.

```python
from langsmith import Client

client = Client()

examples = [
    {
        "inputs": {"message": "결제가 두 번 청구됐어요. 환불이 필요합니다."},
        "outputs": {"priority": "high"},
    },
    {
        "inputs": {"message": "기능 소개 문서를 어디서 볼 수 있나요?"},
        "outputs": {"priority": "normal"},
    },
    {
        "inputs": {"message": "서비스가 계속 500 에러를 내고 있어요."},
        "outputs": {"priority": "high"},
    },
    {
        "inputs": {"message": "비밀번호 변경 방법 알려주세요."},
        "outputs": {"priority": "normal"},
    },
]

dataset = client.create_dataset(dataset_name="support-priority-baseline")
client.create_examples(dataset_id=dataset.id, examples=examples)

print(dataset.id, dataset.name)
```

핵심은 단순합니다.

- `inputs`: 앱에 넣을 입력
- `outputs`: 정답 또는 기대 결과
- dataset 이름은 실험 단위로 재사용 가능한 기준선이 되도록 명확하게 짓기

이미 dataset이 있으면 `data="support-priority-baseline"`처럼 이름으로 바로 넘겨도 됩니다.

## 2. target function은 "평가하고 싶은 인터페이스"만 감싸면 된다

`evaluate()`는 dataset example의 `inputs`를 받아 결과 dict를 반환하는 함수를 기대합니다.  
여기서 중요한 점은 앱 전체를 다 감쌀 필요가 없다는 것입니다.

- 프롬프트 하나만 바꾸는 중이면 그 호출만 target으로 두기
- retrieval 품질을 보려면 retriever 단계만 target으로 두기
- end-to-end UX를 보려면 전체 agent 함수를 target으로 두기

아래는 외부 모델 없이도 바로 실행되는 최소 예제입니다.

```python
def classify_priority(inputs: dict) -> dict:
    text = inputs["message"]
    urgent_keywords = ["환불", "결제", "500", "장애", "오류"]
    priority = "high" if any(keyword in text for keyword in urgent_keywords) else "normal"
    return {"priority": priority}
```

LangSmith 공식 문서 기준 `evaluate()`는 target function을 자동으로 trace합니다.  
target 내부에서 `traceable` 함수나 traced LLM client를 호출하면 그것들도 child run으로 같이 남습니다.

## 3. evaluator는 처음엔 하나만 두는 편이 낫다

처음부터 지표를 많이 만들면 유지 비용이 먼저 커집니다.  
대개는 아래 둘 중 하나로 시작하면 충분합니다.

- exact match 같은 규칙 기반 정답 비교
- pass/fail 형태의 단순 품질 게이트

```python
def priority_is_correct(
    inputs: dict,
    outputs: dict,
    reference_outputs: dict,
) -> bool:
    return outputs["priority"] == reference_outputs["priority"]
```

## 4. `evaluate()`로 실험 남기기

이제 target과 evaluator를 dataset에 연결하면 됩니다.

```python
from langsmith import Client

client = Client()

experiment = client.evaluate(
    classify_priority,
    data="support-priority-baseline",
    evaluators=[priority_is_correct],
    experiment_prefix="support-priority-rules",
    metadata={
        "owner": "support-ai",
        "variant": "rules-v1",
    },
)

for row in experiment:
    print(
        row["example"].inputs,
        row["run"].outputs,
        row["evaluation_results"]["results"],
    )
```

실무에서 `metadata`를 꼭 넣는 이유는 나중에 실험 비교가 쉬워지기 때문입니다.

- 어떤 브랜치/프롬프트/모델 버전인지 추적 가능
- UI에서 실험을 필터링하기 쉬움
- 배포 전후 결과를 비교할 때 기준이 명확해짐

## 5. 먼저 로컬 스모크 테스트를 돌리고 싶으면 `upload_results=False`

항상 실험을 서버에 남길 필요는 없습니다.  
프롬프트를 몇 번 빠르게 다듬는 단계라면 업로드 없이 검증만 해도 충분합니다.

```python
from langsmith import Client

client = Client()

experiment = client.evaluate(
    classify_priority,
    data="support-priority-baseline",
    evaluators=[priority_is_correct],
    experiment_prefix="support-priority-local-smoke",
    upload_results=False,
)

results = list(experiment)
failed = [
    row
    for row in results
    if not row["evaluation_results"]["results"][0].score
]

print(f"failed={len(failed)}")
for row in failed:
    print(row["example"].inputs, row["run"].outputs)
```

공식 문서 기준 `upload_results=False`를 쓰면 애플리케이션 trace와 evaluator trace도 LangSmith에 기록되지 않습니다.  
즉, 완전히 로컬 검증 모드라고 생각하면 됩니다.

## 6. 실험 수가 커지면 Python에서는 `aevaluate()`를 우선 고려한다

2026-06-21 기준 공식 문서는 Python의 큰 평가 작업에서 `aevaluate()` 사용을 권장합니다.  
인터페이스는 `evaluate()`와 거의 같고, target function만 async면 됩니다.

```python
from langsmith import aevaluate, wrappers
from openai import AsyncOpenAI

oai_client = wrappers.wrap_openai(AsyncOpenAI())

async def classify_priority_llm(inputs: dict) -> dict:
    message = inputs["message"]
    result = await oai_client.chat.completions.create(
        model="gpt-5.4-mini",
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": (
                    "Classify the support message priority as either "
                    "'high' or 'normal'. Return only the label."
                ),
            },
            {"role": "user", "content": message},
        ],
    )
    return {"priority": result.choices[0].message.content.strip()}


results = await aevaluate(
    classify_priority_llm,
    data="support-priority-baseline",
    evaluators=[priority_is_correct],
    experiment_prefix="support-priority-llm",
    max_concurrency=5,
)
```

여기서 실무 포인트는 두 가지입니다.

- Python 대량 평가에서는 `aevaluate()` + `max_concurrency`를 먼저 본다
- JS/TS는 `evaluate()` 자체가 이미 async라 Python처럼 별도 `aevaluate()`를 찾지 않는다

## 7. 출력 변동이 큰 agent라면 `num_repetitions`를 붙인다

agent, tool calling, 검색 기반 응답처럼 비결정성이 큰 흐름은 한 번만 돌리면 운이 섞입니다.  
이럴 때 `num_repetitions`를 붙이면 example별 반복 실행 결과를 평균으로 볼 수 있습니다.

```python
from langsmith import evaluate

experiment = evaluate(
    classify_priority,
    data="support-priority-baseline",
    evaluators=[priority_is_correct],
    experiment_prefix="support-priority-repeat",
    num_repetitions=3,
)
```

이 옵션은 특히 아래 상황에서 유용합니다.

- 모델 temperature를 완전히 0으로 두지 않았을 때
- agent 경로가 매번 조금씩 달라질 수 있을 때
- 한 번의 실패를 회귀로 볼지, 분산으로 볼지 애매할 때

## 8. 바로 써먹기 좋은 운영 패턴

제가 추천하는 첫 도입 순서는 아래입니다.

1. production에서 자주 틀리는 예제 10개만 dataset으로 만든다
2. 현재 프롬프트/체인을 baseline 실험으로 한 번 기록한다
3. 변경본을 같은 dataset으로 다시 돌린다
4. exact match 또는 pass/fail evaluator 하나만 둔다
5. 통과 기준이 생기면 CI에서 `upload_results=False` 또는 업로드 실험으로 연결한다

이 흐름만 있어도 "좋아 보인다"가 아니라 "baseline 대비 몇 개가 좋아졌고 몇 개가 깨졌는지"로 대화가 바뀝니다.

## 자주 틀리는 점

### 1. target function 출력 형식과 evaluator 기대 형식이 다르다

예를 들어 target이 `{"label": ...}`을 반환하는데 evaluator는 `outputs["priority"]`를 읽으면 바로 깨집니다.  
평가 코드에서 제일 흔한 실패는 모델 품질 문제가 아니라 dict key 불일치입니다.

### 2. dataset을 크게 만들기 전에 실패 유형 분류가 안 되어 있다

예제를 많이 넣는 것보다, 어떤 실패를 잡으려는 dataset인지 먼저 정하는 편이 낫습니다.

- 환불/결제 긴급도 분류용
- 검색 정확도 회귀용
- 금칙어/안전성 점검용

이렇게 역할이 분명해야 evaluator도 단순해집니다.

### 3. 실험을 너무 일찍 end-to-end로만 본다

전체 agent 평가만 걸어두면 왜 실패했는지 역추적이 어려워집니다.  
처음에는 프롬프트, 분류기, retrieval 같은 작은 단위 평가를 먼저 붙이는 편이 유지보수에 유리합니다.

### 4. 로컬 반복 실험인데 결과를 계속 업로드해서 실험 목록이 지저분해진다

짧은 탐색 단계에서는 `upload_results=False`를 적극적으로 쓰는 편이 낫습니다.  
반대로 팀 공유가 필요한 기준 실험은 업로드를 남겨서 비교 가능하게 두는 편이 좋습니다.

### 5. 비결정적인 워크플로를 1회 결과만 보고 판단한다

agent 계열은 `num_repetitions` 없이 한 번만 돌리면 우연한 성공/실패가 섞이기 쉽습니다.

## 마무리

LangSmith offline evaluation의 핵심은 거창한 평가 체계를 한 번에 만드는 것이 아닙니다.  
작은 dataset 하나와 evaluator 하나만 있어도 프롬프트 변경, 에이전트 수정, 모델 교체를 실험으로 관리할 수 있습니다.

처음에는 아래 세 가지만 붙이면 충분합니다.

- 작은 dataset
- 일관된 target function
- 단순한 pass/fail evaluator

그 다음에야 `aevaluate()`, `num_repetitions`, 더 복잡한 evaluator, CI 연동으로 넓혀가는 편이 실무에서 덜 무겁습니다.

## 참고 자료

- [Evaluation quickstart](https://docs.langchain.com/langsmith/evaluation-quickstart)
- [How to evaluate an LLM application](https://docs.langchain.com/langsmith/evaluate-llm-application)
- [How to run an evaluation asynchronously](https://docs.langchain.com/langsmith/evaluation-async)
- [How to run an evaluation locally (Python only)](https://docs.langchain.com/langsmith/local)
- [How to evaluate with repetitions](https://docs.langchain.com/langsmith/repetition)
- [How to define a target function to evaluate](https://docs.langchain.com/langsmith/define-target-function)
- [How to define a code evaluator](https://docs.langchain.com/langsmith/code-evaluator-sdk)
