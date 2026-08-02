---
title: "LangSmith upload_results=False로 평가를 로컬에서만 실행하기"
description: "LangSmith evaluate()를 결과 업로드 없이 실행해 evaluator를 빠르게 검증하고, 실패 사례와 DataFrame을 로컬에서 분석하는 방법을 정리한 실전 노트"
date: 2026-08-02
tags:
  - langsmith
  - evaluation
  - python
  - testing
aliases:
  - "/blog/langsmith-local-evaluation-no-upload"
---

# LangSmith upload_results=False로 평가를 로컬에서만 실행하기

평가 코드를 고치는 동안 매번 LangSmith에 experiment를 남기면 임시 실행이 쌓이고 결과 목록도 빠르게 지저분해진다. 반대로 SDK를 빼고 별도 테스트 코드를 만들면 실제 evaluation 경로와 다른 코드를 검증하게 된다.

Python SDK의 `evaluate(..., upload_results=False)`를 쓰면 target과 evaluator는 평소처럼 실행하되 experiment 결과, application trace, evaluator trace를 LangSmith에 기록하지 않는다. 프롬프트 후보 몇 개를 빠르게 smoke test하거나 evaluator 반환 형식을 확인할 때 특히 유용하다.

## 언제 쓰면 좋은가

- evaluator의 입력 키와 반환 형식을 로컬에서 먼저 검증할 때
- 작은 예제 집합으로 prompt 변경을 빠르게 반복할 때
- CI의 사전 검사에서 임시 experiment와 trace를 만들고 싶지 않을 때
- 민감한 테스트 입력을 원격 workspace에 올리지 않고 실행해야 할 때

공유 가능한 비교 결과나 장기 추세가 필요하다면 로컬 모드가 아니라 정상 업로드 experiment를 써야 한다.

## 사전 준비

공식 문서의 로컬 evaluation 기능은 Python SDK의 `langsmith>=0.2.0`에서 지원된다.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langsmith>=0.2.0" pandas
```

로컬에 직접 작성한 예제 목록만 사용하면 LangSmith API key가 없어도 된다. 기존 LangSmith dataset을 읽거나 public dataset을 clone하려면 `LANGSMITH_API_KEY`가 필요하다.

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
```

## 1. 가장 작은 로컬 evaluation

`data`에는 dataset 이름뿐 아니라 `inputs`와 선택적인 `outputs`를 가진 dict 목록도 전달할 수 있다. 완전히 로컬에서 확인하려면 이 방식을 쓰기 쉽다.

```python
from langsmith import evaluate


examples = [
    {
        "inputs": {"question": "대한민국의 수도는?"},
        "outputs": {"answer": "서울"},
    },
    {
        "inputs": {"question": "2 + 3은?"},
        "outputs": {"answer": "5"},
    },
]


def target(inputs: dict) -> dict:
    answers = {
        "대한민국의 수도는?": "서울",
        "2 + 3은?": "5",
    }
    return {"answer": answers[inputs["question"]]}


def exact_match(outputs: dict, reference_outputs: dict) -> bool:
    return outputs["answer"] == reference_outputs["answer"]


experiment = evaluate(
    target,
    data=examples,
    evaluators=[exact_match],
    upload_results=False,
)

for row in experiment:
    score = row["evaluation_results"]["results"][0].score
    print(row["example"].inputs, row["run"].outputs, score)
```

핵심은 `upload_results=False`다. 이 옵션을 빼면 일반 evaluation처럼 결과가 LangSmith에 기록된다.

## 2. 실패 사례를 CI quality gate로 바꾸기

반환된 experiment는 iterable이므로 각 결과를 로컬에서 검사할 수 있다. evaluator가 여러 개라면 metric key로 찾는 편이 평가 순서에 덜 민감하다.

```python
from langsmith import evaluate


def has_answer(outputs: dict) -> dict:
    answer = outputs.get("answer", "").strip()
    return {
        "key": "has_answer",
        "score": bool(answer),
        "comment": None if answer else "answer가 비어 있습니다.",
    }


experiment = evaluate(
    lambda inputs: {"answer": inputs.get("draft", "")},
    data=[
        {"inputs": {"draft": "정상 응답"}},
        {"inputs": {"draft": ""}},
    ],
    evaluators=[has_answer],
    upload_results=False,
)

rows = list(experiment)
failed = []

for row in rows:
    metrics = {
        result.key: result.score
        for result in row["evaluation_results"]["results"]
    }
    if metrics.get("has_answer") != 1:
        failed.append(row)

if failed:
    for row in failed:
        print("FAILED", row["example"].inputs, row["run"].outputs)
    raise SystemExit(1)
```

이 패턴은 테스트 프로세스의 exit code만 실패시키며 LangSmith에는 흔적을 남기지 않는다. 팀이 검토해야 하는 baseline 결과라면 `upload_results=True`인 별도 job을 두는 편이 낫다.

## 3. DataFrame으로 빠르게 비교하기

`pandas`를 설치했다면 반환 객체의 `to_pandas()`로 입력, 출력, reference, feedback 열을 바로 펼칠 수 있다.

```python
df = experiment.to_pandas()

columns = [
    "inputs.draft",
    "outputs.answer",
    "feedback.has_answer",
]
print(df[columns].to_string(index=False))

pass_rate = df["feedback.has_answer"].fillna(0).mean()
print(f"pass_rate={pass_rate:.1%}")
```

열 이름은 실제 input/output key와 evaluator key에 따라 달라진다. 처음에는 `print(df.columns.tolist())`로 확인한 뒤 필요한 열을 선택한다.

## 4. 기존 LangSmith dataset을 쓰되 결과만 업로드하지 않기

로컬 evaluation은 데이터까지 반드시 로컬이어야 한다는 뜻은 아니다. workspace dataset을 읽어 실행하되 새 experiment와 trace만 저장하지 않을 수도 있다.

```python
from langsmith import Client, evaluate

client = Client()

examples = client.list_examples(
    dataset_name="support-agent-regression",
    splits=["smoke"],
    limit=20,
)

experiment = evaluate(
    target,
    data=examples,
    evaluators=[exact_match],
    upload_results=False,
    max_concurrency=2,
)

print(experiment.to_pandas()["feedback.exact_match"].mean())
```

이 경우 dataset 조회는 네트워크를 사용한다. 즉, `upload_results=False`는 읽기까지 차단하는 offline mode가 아니라 evaluation 산출물의 업로드를 끄는 옵션이다.

## 자주 틀리는 부분

### `LANGSMITH_TRACING=false`만 설정하면 같은 효과라고 생각한다

tracing 환경 변수는 일반 애플리케이션 tracing 설정이다. evaluation 결과 전체를 로컬에만 두려는 의도는 `upload_results=False`로 명시해야 분명하다.

### 로컬 실행이면 결과가 자동으로 파일에 저장된다고 생각한다

업로드하지 않은 결과는 반환 객체 안에만 있다. 이후 분석이 필요하면 같은 프로세스에서 list/DataFrame으로 소비하거나 직접 JSON/CSV로 저장해야 한다.

### iterator를 한 번 소비한 뒤 다시 순회한다

여러 번 검사해야 한다면 초기에 `rows = list(experiment)`로 구체화한다. DataFrame만 필요하면 `to_pandas()`를 바로 사용한다.

### LLM evaluator도 네트워크를 쓰지 않는다고 생각한다

`upload_results=False`는 LangSmith 기록을 막을 뿐이다. target이나 evaluator가 OpenAI, Anthropic 같은 외부 모델을 호출하면 해당 네트워크 요청과 비용은 그대로 발생한다.

### 공유해야 할 회귀 결과까지 로컬 모드로만 돌린다

로컬 모드는 빠른 검증에 적합하지만 experiment 비교, 팀 리뷰, 장기 추세 분석에는 기록이 필요하다. 보통 pull request의 빠른 smoke test는 로컬로, main의 정식 regression run은 업로드하도록 나누면 운영하기 쉽다.

## 추천 운영 흐름

1. 개발 중에는 5~20개 smoke example과 `upload_results=False`로 target/evaluator 계약을 확인한다.
2. 실패 row를 출력하고 기준 미달이면 CI를 종료한다.
3. main merge 전후에는 고정된 dataset version으로 정식 experiment를 업로드한다.
4. 공유 experiment에서 비교와 분석을 마친 뒤 다음 smoke set에 실패 사례를 반영한다.

이렇게 나누면 임시 experiment 노이즈는 줄이면서도 LangSmith의 비교·추적 기능은 필요한 시점에 유지할 수 있다.

## 참고 자료

- [How to run an evaluation locally (Python only)](https://docs.langchain.com/langsmith/local)
- [Run an evaluation using the SDK](https://docs.langchain.com/langsmith/evaluation-quickstart)
- [How to define a code evaluator](https://docs.langchain.com/langsmith/code-evaluator-sdk)

