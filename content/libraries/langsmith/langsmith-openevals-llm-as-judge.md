---
title: "LangSmith와 OpenEvals로 LLM-as-a-judge 평가 재사용하기"
description: "OpenEvals의 사전 정의 prompt와 evaluator factory를 LangSmith evaluate()에 연결해 correctness 실험을 반복 가능하게 운영하는 방법"
date: 2026-08-10
tags:
  - langsmith
  - evaluation
  - openevals
  - llm-as-a-judge
aliases:
  - "/blog/langsmith-openevals-llm-as-judge"
---

# LangSmith와 OpenEvals로 LLM-as-a-judge 평가 재사용하기

LLM-as-a-judge를 매번 처음부터 만들면 prompt 형식, 점수 반환값, LangSmith feedback 연결 코드를 프로젝트마다 다시 관리해야 한다. OpenEvals는 자주 쓰는 평가 prompt와 evaluator factory를 오픈소스 패키지로 제공하고, LangSmith는 그 evaluator를 `evaluate()`에 그대로 받아 실험 결과의 feedback으로 저장한다.

이 조합은 다음 상황에 특히 유용하다.

- 정답이 있는 QA 데이터셋에서 의미적 정확성을 평가할 때
- 여러 애플리케이션이 같은 평가 기준을 공유해야 할 때
- pytest에서 시작한 evaluator를 배치 experiment에도 재사용할 때
- 자체 judge prompt를 만들기 전에 검증된 출발점이 필요할 때

## 사전 준비

Python에서 `evaluate()`에 OpenEvals evaluator를 직접 전달하려면 공식 문서 기준 `langsmith>=0.3.11`이 필요하다.

```bash
pip install -U "langsmith>=0.3.11" openevals
```

환경 변수도 준비한다.

```powershell
$env:LANGSMITH_API_KEY = "lsv2_..."
$env:OPENAI_API_KEY = "sk-..."
$env:LANGSMITH_PROJECT = "openevals-study"
```

OpenEvals는 OpenAI 외 provider도 선택할 수 있다. 아래 예제의 model 문자열은 실행 환경에서 실제 사용할 judge model로 바꿔야 한다.

## 1. 데이터셋 만들기

`correctness`처럼 기준 답이 필요한 평가에서는 각 example의 `outputs`가 reference answer 역할을 한다.

```python
from langsmith import Client

client = Client()
dataset_name = "korean-support-qa"

if not client.has_dataset(dataset_name=dataset_name):
    dataset = client.create_dataset(
        dataset_name=dataset_name,
        description="고객 지원 답변 correctness 회귀 테스트",
    )
    client.create_examples(
        dataset_id=dataset.id,
        inputs=[
            {"question": "환불 요청은 결제 후 며칠 안에 해야 하나요?"},
            {"question": "배송지 변경은 언제까지 가능한가요?"},
        ],
        outputs=[
            {"answer": "결제 후 7일 이내에 환불을 요청할 수 있습니다."},
            {"answer": "상품이 출고되기 전까지 배송지를 변경할 수 있습니다."},
        ],
    )
```

운영 코드에서는 같은 이름의 데이터셋이 이미 있을 때 내용을 조용히 건너뛰기보다, 원하는 version tag나 example 수까지 확인하는 편이 안전하다. 위 조건문은 예제를 여러 번 실행할 때 중복 생성을 막기 위한 최소 장치다.

## 2. 사전 정의 correctness evaluator 만들기

`create_llm_as_judge()`에 OpenEvals의 `CORRECTNESS_PROMPT`를 전달한다. `feedback_key`는 LangSmith experiment에 나타날 feedback 열 이름이다.

```python
import os

from openevals.llm import create_llm_as_judge
from openevals.prompts import CORRECTNESS_PROMPT

correctness = create_llm_as_judge(
    prompt=CORRECTNESS_PROMPT,
    feedback_key="correctness",
    model=os.getenv("JUDGE_MODEL", "openai:o3-mini"),
)
```

평가기에는 일반적으로 다음 세 값이 전달된다.

- `inputs`: 원래 질문이나 작업 입력
- `outputs`: 평가 대상 애플리케이션의 실제 출력
- `reference_outputs`: 데이터셋에 저장된 기대 출력

모든 evaluator가 세 값을 전부 요구하는 것은 아니다. 예를 들어 exact match 계열은 입력 없이 실제 출력과 기준 출력만으로 평가할 수 있다. evaluator를 바꿀 때는 그 evaluator의 호출 계약도 함께 확인해야 한다.

## 3. LangSmith evaluate()에 바로 연결하기

target은 dataset example의 `inputs`를 받고 결과 dict를 반환한다. 실제 프로젝트에서는 이 함수 안에서 RAG chain이나 agent를 호출한다.

```python
from langsmith import Client


def support_app(inputs: dict) -> dict:
    question = inputs["question"]

    if "환불" in question:
        return {"answer": "결제일로부터 7일 안에 환불을 신청해 주세요."}

    return {"answer": "배송이 시작되기 전까지 배송지를 바꿀 수 있습니다."}


client = Client()
results = client.evaluate(
    support_app,
    data="korean-support-qa",
    evaluators=[correctness],
    experiment_prefix="support-openevals-correctness",
    max_concurrency=2,
)

print(results)
```

실행이 끝나면 LangSmith experiment의 각 row에 `correctness` feedback이 기록된다. 같은 evaluator 객체를 다른 target에 넣으면 feedback key와 judge 기준을 유지한 채 후보 버전을 비교할 수 있다.

## 4. pytest와 배치 experiment에서 같은 기준 쓰기

OpenEvals evaluator는 LangSmith pytest integration에서도 직접 호출할 수 있다.

```python
import pytest
from langsmith import testing as t


@pytest.mark.langsmith
def test_refund_answer_correctness() -> None:
    inputs = {"question": "환불 요청은 언제까지 가능한가요?"}
    outputs = {"answer": "결제 후 7일 이내에 요청할 수 있습니다."}
    reference_outputs = {
        "answer": "결제 후 7일 이내에 환불을 요청할 수 있습니다."
    }

    t.log_inputs(inputs)
    t.log_outputs(outputs)
    t.log_reference_outputs(reference_outputs)

    correctness(
        inputs=inputs,
        outputs=outputs,
        reference_outputs=reference_outputs,
    )
```

이렇게 하면 작은 회귀 테스트와 전체 dataset experiment가 같은 evaluator factory를 공유한다. 다만 LLM judge 호출은 네트워크, 비용, 모델 변동성을 포함하므로 일반 unit test와 분리된 marker나 별도 CI job으로 실행하는 편이 좋다.

## 커스텀 변수가 필요한 prompt

LLM-as-a-judge prompt에 `policy` 같은 추가 변수가 있다면 evaluator 호출 시 keyword argument로 넘길 수 있다. OpenEvals가 해당 값을 prompt에 포맷한다.

```python
result = correctness(
    inputs={"question": "환불할 수 있나요?"},
    outputs={"answer": "언제든 환불됩니다."},
    reference_outputs={"answer": "결제 후 7일 이내 가능합니다."},
    policy="환불 가능 기간을 과장하지 말고 명시된 기간만 인정한다.",
)

print(result)
```

단, 사전 정의 prompt에 존재하지 않는 변수를 넘긴다고 자동으로 기준이 추가되는 것은 아니다. 추가 변수를 사용하려면 그 변수를 참조하는 custom prompt를 먼저 정의해야 한다.

## 흔한 실수

### target 출력과 reference schema가 다르다

target이 `{"answer": ...}`를 반환하는데 dataset output이 `{"expected": ...}`라면 judge가 비교 대상을 안정적으로 찾지 못할 수 있다. dataset과 target의 최상위 key를 맞추고, 실험 전에 한 example을 직접 호출해 형태를 확인한다.

### feedback_key를 실험마다 바꾼다

`correctness-v2`, `correctness_new`처럼 이름을 계속 바꾸면 dashboard와 비교 query가 분산된다. 평가 의미가 같다면 key를 유지하고, rubric 자체가 달라졌다면 experiment metadata나 evaluator 버전도 함께 기록한다.

### judge model 버전을 고정하지 않는다

provider alias가 새 모델로 이동하면 같은 데이터셋에서도 점수가 달라질 수 있다. 중요한 회귀 gate에서는 가능한 한 구체적인 model ID를 사용하고, experiment metadata에 judge model과 prompt 버전을 남긴다.

### LLM 점수를 절대적인 정답으로 본다

사전 정의 prompt는 좋은 시작점이지 도메인 정답지가 아니다. 사람 검토 표본으로 false positive와 false negative를 확인하고, 업무 규칙이 강한 영역은 code evaluator나 별도 custom rubric을 함께 사용한다.

### 동시성을 너무 높인다

target 호출과 judge 호출이 함께 발생하므로 `max_concurrency`를 크게 잡으면 두 provider의 rate limit을 동시에 맞을 수 있다. 작은 값으로 시작해 실패율, latency, token 비용을 본 뒤 늘린다.

## 운영 체크리스트

- [ ] `langsmith>=0.3.11`과 `openevals`를 설치했는가
- [ ] target output과 dataset reference output의 schema가 일치하는가
- [ ] `feedback_key`가 dashboard와 회귀 gate에서 사용할 안정적인 이름인가
- [ ] judge model과 prompt 버전을 experiment metadata로 남겼는가
- [ ] 사람 검토 표본으로 evaluator의 오판 경향을 확인했는가
- [ ] LLM judge 테스트를 일반 unit test와 분리했는가
- [ ] 동시성, rate limit, judge 비용을 함께 관찰하는가

## 참고 자료

- [Run evals with OpenEvals](https://docs.langchain.com/langsmith/openevals)
- [Evaluate an LLM application](https://docs.langchain.com/langsmith/evaluate-llm-application)
- [OpenEvals repository](https://github.com/langchain-ai/openevals)
- [LangSmith pytest evaluation](https://docs.langchain.com/langsmith/pytest)
