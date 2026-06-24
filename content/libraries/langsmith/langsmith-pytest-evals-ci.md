---
title: "LangSmith pytest로 LLM eval과 회귀 테스트를 CI에 붙이기"
description: "LangSmith pytest 통합으로 테스트 케이스를 dataset과 experiment로 기록하고 캐시, parametrization, CI 회귀 테스트까지 연결하는 실전 노트"
date: 2026-06-24
tags:
  - langsmith
  - evaluation
  - pytest
  - python
  - testing
aliases:
  - "/blog/langsmith-pytest-evals-ci"
---

# LangSmith pytest로 LLM eval과 회귀 테스트를 CI에 붙이기

LangSmith를 쓰다 보면 `evaluate()` 기반 오프라인 평가만으로는 부족한 순간이 온다.

- "이 케이스는 무조건 통과해야 한다" 같은 binary assertion이 필요하다
- pytest 기반 CI에 LangSmith 기록을 같이 남기고 싶다
- 예제마다 입력 구조나 검사 로직이 달라서 하나의 evaluator로 묶기 어렵다
- LLM 호출 비용 때문에 캐시를 켜고 회귀 테스트를 반복하고 싶다

이럴 때 LangSmith의 pytest 통합이 꽤 실용적이다.  
기존 pytest 테스트를 거의 유지한 채, 각 테스트 케이스를 dataset example과 experiment row로 기록할 수 있다.

이 글에서는 공식 문서 기준으로 아래만 실무적으로 정리한다.

- `@pytest.mark.langsmith`로 테스트를 LangSmith에 기록하는 기본 흐름
- `log_inputs`, `log_outputs`, `log_reference_outputs`, `log_feedback` 사용법
- `output_keys`, `parametrize`, async 테스트 같은 pytest 패턴 연결
- `LANGSMITH_TEST_SUITE`, `LANGSMITH_TEST_CACHE`, `cached_hosts`로 CI 비용 줄이기
- 자주 헷갈리는 overwrite, suite grouping, 캐시 함정

## 언제 pytest 통합이 더 좋은가

공식 문서 기준으로 pytest 통합은 아래 같은 상황에서 특히 맞다.

- 테스트마다 서로 다른 평가 로직이 필요하다
- pass/fail assertion을 LangSmith와 로컬 CI에 동시에 반영하고 싶다
- 이미 pytest 테스트 체인이 있고 여기에 평가 추적만 얹고 싶다
- LLM app 회귀 테스트를 familiar한 테스트 러너에서 유지하고 싶다

반대로 입력 형식과 evaluator가 거의 동일한 큰 배치 평가라면 `evaluate()` 또는 `aevaluate()` 쪽이 더 단순할 수 있다.

## 사전 준비

공식 문서 기준 최소 버전은 `langsmith>=0.3.4`다.  
캐시와 rich output까지 쓰려면 extra 포함 설치가 낫다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "langsmith[pytest]" pytest
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_TEST_SUITE="support-agent-regression"
```

기본 실행:

```bash
pytest tests/
```

LangSmith에 보기 좋은 suite 이름을 묶고 싶으면:

```bash
LANGSMITH_TEST_SUITE="support-agent-regression" pytest tests/
```

## 1. 가장 작은 형태의 LangSmith pytest 테스트

핵심은 `@pytest.mark.langsmith`를 붙이는 것이다.  
그러면 테스트 결과가 LangSmith에 기록되고, 기본 `pass` feedback도 자동으로 남는다.

```python
import pytest
from langsmith import testing as t


def normalize_answer(question: str) -> str:
    mapping = {
        "capital of france": "Paris",
        "capital of korea": "Seoul",
    }
    return mapping[question]


@pytest.mark.langsmith
def test_capital_of_france() -> None:
    question = "capital of france"
    expected = "Paris"

    t.log_inputs({"question": question})
    t.log_reference_outputs({"answer": expected})

    answer = normalize_answer(question)
    t.log_outputs({"answer": answer})

    assert answer == expected
```

이렇게 실행하면 LangSmith는 다음을 기록한다.

- 해당 테스트 케이스용 dataset example
- 이번 실행용 experiment row
- 입력과 reference output, 실제 output
- 테스트 통과 여부를 담은 `pass` feedback key

즉 "pytest 테스트"와 "LangSmith 평가 기록"이 같은 실행에서 같이 생긴다.

## 2. 추가 feedback을 남기면 pass/fail 외 지표도 같이 쌓인다

테스트 통과 여부만으로 부족하면 `log_feedback(...)`를 같이 쓴다.

```python
import pytest
from langsmith import testing as t


def is_short_enough(text: str, limit: int = 80) -> bool:
    return len(text) <= limit


@pytest.mark.langsmith
def test_summary_length() -> None:
    article = "LangSmith pytest integration can track tests as experiments."
    t.log_inputs({"article": article})

    summary = "LangSmith pytest can log test runs into experiments."
    t.log_outputs({"summary": summary})

    t.log_feedback(key="length_ok", score=is_short_enough(summary))
    assert is_short_enough(summary)
```

이 패턴이 좋은 이유는 CI에서 실패를 바로 보고, LangSmith에서는 어떤 보조 지표가 같이 나빠졌는지 한 번에 볼 수 있기 때문이다.

## 3. fixture나 파라미터를 dataset example로 바로 쓸 수 있다

공식 문서 기준으로 테스트 함수 인자는 기본적으로 example input으로 기록된다.  
그리고 특정 인자를 reference output으로 간주하려면 `output_keys=[...]`를 지정한다.

```python
import pytest
from langsmith import testing as t


@pytest.mark.langsmith(output_keys=["expected_sql"])
@pytest.mark.parametrize(
    "user_query, expected_sql",
    [
        ("all users", "SELECT * FROM users"),
        ("all orders", "SELECT * FROM orders"),
    ],
)
def test_sql_generation(user_query: str, expected_sql: str) -> None:
    generated_sql = {
        "all users": "SELECT * FROM users",
        "all orders": "SELECT * FROM orders",
    }[user_query]

    t.log_outputs({"sql": generated_sql})
    assert generated_sql == expected_sql
```

이 경우 LangSmith에는 대략 이렇게 남는다.

- inputs: `{"user_query": "..."}`
- reference outputs: `{"expected_sql": "..."}`
- outputs: `{"sql": "..."}`

예제마다 값이 다른 regression case를 많이 돌릴 때 특히 편하다.

## 4. 여러 테스트 파일을 어떻게 suite로 묶을지 먼저 정한다

공식 문서 기준 기본 동작은 "한 파일 = 한 test suite dataset"이다.  
즉 `tests/test_sql.py`, `tests/test_rag.py`가 있으면 기본적으로 dataset도 둘로 나뉜다.

한 실행 전체를 같은 suite로 묶고 싶다면 환경 변수로 고정하는 편이 가장 단순하다.

```bash
LANGSMITH_TEST_SUITE="release-gate-2026-06-24" pytest tests/
```

케이스별로 더 세밀하게 나누려면 marker에 직접 suite 이름을 줄 수 있다.

```python
import pytest


@pytest.mark.langsmith(test_suite_name="rag-release-gate")
def test_retrieval_answer() -> None:
    assert True
```

실무에서는 보통 아래 둘 중 하나가 무난하다.

1. 파일 단위 suite를 유지해 기능별 dataset을 분리한다
2. 배포 전 전체 회귀 실행은 `LANGSMITH_TEST_SUITE` 하나로 묶는다

## 5. CI 비용은 캐시부터 잡는다

문서에서 가장 실무적인 팁 중 하나가 캐시다.  
LLM 호출이 섞인 테스트를 매 커밋마다 돌리면 금방 비싸진다.

캐시를 켜려면 extra 설치 후 `LANGSMITH_TEST_CACHE`를 지정한다.

```bash
pip install -U "langsmith[pytest]"
LANGSMITH_TEST_CACHE=tests/cassettes pytest tests/
```

문서 기준 `langsmith>=0.4.10`에서는 특정 호스트만 선택 캐시할 수도 있다.

```python
import pytest


@pytest.mark.langsmith(cached_hosts=["api.openai.com", "https://api.anthropic.com"])
def test_llm_guardrail() -> None:
    assert True
```

이 패턴은 아래 상황에서 특히 좋다.

- OpenAI 호출만 캐시하고 내부 API 호출은 실시간으로 두고 싶다
- CI에서는 cassette를 재사용하고 로컬에서는 새 응답을 받아 보고 싶다
- flaky한 외부 모델 호출 때문에 회귀 테스트가 흔들리는 것을 줄이고 싶다

## 6. async 테스트와 병렬 실행도 pytest 방식 그대로 간다

공식 문서 기준 `@pytest.mark.langsmith`는 sync/async 테스트 모두에서 동작한다.  
또 `pytest-xdist`로 병렬화도 가능하다.

```bash
pip install -U pytest-asyncio pytest-xdist
pytest -n auto tests/
```

예를 들어 async 앱 테스트는 평소처럼 작성하면 된다.

```python
import pytest
from langsmith import testing as t


async def async_agent(question: str) -> str:
    return f"answer:{question}"


@pytest.mark.asyncio
@pytest.mark.langsmith
async def test_async_agent() -> None:
    question = "ping"
    t.log_inputs({"question": question})
    answer = await async_agent(question)
    t.log_outputs({"answer": answer})
    assert answer == "answer:ping"
```

## 7. rich output을 켜면 테스트 업로드 상태를 터미널에서 보기 쉽다

pytest 실행 중 LangSmith 업로드 상태를 조금 더 보기 좋게 보고 싶다면 문서 기준 `--langsmith-output` 플래그를 쓴다.

```bash
pytest --langsmith-output tests/
```

예전 버전의 `--output=langsmith`는 `langsmith<=0.3.3` 시절 플래그라 지금 문서 기준으로는 `--langsmith-output`을 쓰는 편이 맞다.

## 8. 실전 예시: LLM regression gate 테스트 파일

아래는 CI에 바로 넣기 쉬운 형태다.

```python
import pytest
from langsmith import testing as t


def answer_customer_question(question: str) -> str:
    table = {
        "refund window": "Refunds are allowed within 30 days.",
        "exchange policy": "Exchanges are allowed within 14 days.",
    }
    return table[question]


@pytest.mark.langsmith(output_keys=["expected_answer"])
@pytest.mark.parametrize(
    "question, expected_answer",
    [
        ("refund window", "Refunds are allowed within 30 days."),
        ("exchange policy", "Exchanges are allowed within 14 days."),
    ],
)
def test_support_policy_answers(question: str, expected_answer: str) -> None:
    answer = answer_customer_question(question)
    t.log_outputs({"answer": answer})
    t.log_feedback(key="contains_policy_number", score=any(ch.isdigit() for ch in answer))
    assert answer == expected_answer
```

이 정도만 있어도 얻는 것이 분명하다.

- pytest는 로컬과 CI에서 바로 실패를 알려 준다
- LangSmith는 어떤 case가 언제 깨졌는지 experiment로 남긴다
- 보조 feedback도 함께 저장돼 회귀 원인을 추적하기 쉽다

## 자주 막히는 점

### 1. `log_inputs`, `log_outputs`, `log_reference_outputs`를 두 번 호출하면 덮어쓴다

공식 문서 기준 이 값들은 append가 아니라 overwrite다.  
테스트 안에서 여러 번 호출하면 마지막 값만 남는다고 보고 짜는 편이 안전하다.

### 2. test 함수 인자가 전부 input으로 기록된다는 점을 잊는다

fixture나 parametrized value가 자동으로 example input이 된다.  
reference output으로 취급할 값은 `output_keys=[...]`로 명시하는 편이 깔끔하다.

### 3. suite 경계를 정하지 않으면 dataset이 파일별로 쪼개진다

이게 나쁜 것은 아니지만, release gate처럼 한 번에 비교하려는 실행에서는 의도와 다를 수 있다.  
그럴 때 `LANGSMITH_TEST_SUITE`로 묶는다.

### 4. 캐시를 켰는데도 비용이 줄지 않는다고 느낀다

보통은 extra 설치를 빼먹었거나, cache path를 CI에서 유지하지 않았거나, 캐시 대상 호스트가 맞지 않는 경우가 많다.

### 5. 모든 evaluation을 pytest로 옮기려 한다

pytest 통합은 강력하지만, 대규모 균일 배치 평가는 `evaluate()`가 더 단순하다.  
pytest는 "회귀 게이트"나 "assertion이 중요한 케이스" 쪽에 쓰는 편이 균형이 좋다.

## 추천 운영 패턴

개인적으로는 아래 순서를 추천한다.

1. `evaluate()`로 넓은 오프라인 평가를 유지한다
2. 꼭 깨지면 안 되는 케이스만 pytest suite로 뽑는다
3. `LANGSMITH_TEST_SUITE`로 배포 단위 회귀 실행을 묶는다
4. `LANGSMITH_TEST_CACHE`와 `cached_hosts`로 CI 비용을 줄인다
5. LangSmith experiment에서 pass/fail과 보조 feedback을 같이 본다

이렇게 나누면 LangSmith가 단순 평가 대시보드를 넘어서, 개발 루프와 CI 게이트까지 연결되는 테스트 허브가 된다.

## 참고 자료

- [How to run evaluations with pytest](https://docs.langchain.com/langsmith/pytest)
- [Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)
- [How to evaluate an LLM application](https://docs.langchain.com/langsmith/evaluate-llm-application)
- [Run evals with openevals package](https://docs.langchain.com/langsmith/openevals)
