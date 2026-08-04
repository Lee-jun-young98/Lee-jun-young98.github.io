---
title: "LangSmith 운영 trace로 새 agent 버전 backtest하기"
description: "실제 운영 trace를 dataset과 baseline experiment로 변환하고 같은 입력에 candidate agent를 실행해 배포 전 회귀를 비교하는 실전 노트"
date: 2026-08-04
tags:
  - langsmith
  - evaluation
  - backtesting
  - python
aliases:
  - "/blog/langsmith-production-trace-agent-backtesting"
---

# LangSmith 운영 trace로 새 agent 버전 backtest하기

프롬프트나 모델을 바꿨을 때 샘플 질문 몇 개만 다시 실행하면 실제 사용 패턴에서 생기는 회귀를 놓치기 쉽다. LangSmith의 backtesting 흐름은 운영 project의 과거 root run을 골라 **입력 dataset + 기존 출력 baseline experiment**로 고정한 뒤, 같은 입력에 새 agent를 실행해 candidate experiment와 비교한다.

핵심 흐름은 다음과 같다.

1. 운영 trace에서 대표 root run을 조회한다.
2. `convert_runs_to_test()`로 입력을 dataset example로, 기존 실행 결과를 baseline experiment로 옮긴다.
3. reference output이 없어도 동작하는 evaluator로 baseline을 채점한다.
4. 새 agent를 같은 dataset에 실행해 candidate experiment를 만든다.
5. 품질, 비용, latency의 trade-off를 비교하고 배포 기준을 판단한다.

## 언제 유용한가

- model 또는 system prompt 교체 전 실제 사용자 입력으로 회귀를 확인할 때
- tool 구성이나 agent architecture 변경이 운영 품질을 떨어뜨리지 않는지 볼 때
- 사전 제작 dataset이 실제 트래픽 분포를 충분히 반영하지 못할 때
- 장애, 낮은 feedback, 긴 latency 같은 특정 운영 사례를 재현 가능한 평가셋으로 남길 때

## 사전 준비

공식 튜토리얼은 `langsmith>=0.2.4`를 요구한다. 새 프로젝트라면 현재 버전을 설치하는 편이 안전하다.

```bash
pip install -U langsmith
```

PowerShell 환경 변수 예시:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_PROJECT="support-agent-prod"
$env:LANGSMITH_TRACING="true"
```

아래 예제에서 `baseline_agent`와 `candidate_agent`는 `{"messages": [...]}`를 입력받아 실행되는 Runnable 또는 callable이라고 가정한다. LangSmith 기능 자체는 특정 agent framework에 종속되지 않는다.

## 1. backtest할 운영 run 고르기

무작정 최근 trace 전체를 옮기기보다 root run, 기간, tag, feedback 조건을 명시한다. 먼저 적은 수로 데이터 분포와 payload를 확인한다.

```python
from datetime import datetime, timedelta, timezone

from langsmith import Client

client = Client()
project_name = "support-agent-prod"

end_time = datetime.now(timezone.utc)
start_time = end_time - timedelta(days=7)

run_filter = (
    f'and(gt(start_time, "{start_time.isoformat()}"), '
    f'lt(end_time, "{end_time.isoformat()}"), '
    'has(tags, "production"))'
)

prod_runs = list(
    client.list_runs(
        project_name=project_name,
        is_root=True,
        filter=run_filter,
        limit=100,
    )
)

if not prod_runs:
    raise RuntimeError("backtest 대상으로 선택된 운영 run이 없습니다")

print(f"selected={len(prod_runs)}")
print(prod_runs[0].inputs)
```

단순 최신 100건은 특정 시간대나 사용자의 요청에 치우칠 수 있다. 실전에서는 성공/실패, user feedback, 요청 유형, latency 구간별로 나눠 sampling하고 example metadata에 선정 이유를 남기는 것이 좋다.

## 2. 운영 run을 dataset과 baseline experiment로 변환하기

`langsmith.beta.convert_runs_to_test()`는 선택한 run의 입력을 dataset example로 저장하고, 기존 입력·출력을 experiment 결과로 기록한다.

```python
from datetime import datetime, timezone
from uuid import uuid4

from langsmith.beta import convert_runs_to_test

stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
dataset_name = f"support-agent-prod-backtest-{stamp}"
baseline_experiment_name = f"prod-baseline-{stamp}-{str(uuid4())[:6]}"

convert_runs_to_test(
    prod_runs,
    dataset_name=dataset_name,
    include_outputs=False,
    load_child_runs=True,
    test_project_name=baseline_experiment_name,
)

print(dataset_name)
print(baseline_experiment_name)
```

옵션의 의미를 정확히 구분해야 한다.

- `include_outputs=False`: 운영 출력을 정답(reference output)으로 취급하지 않는다.
- `load_child_runs=True`: baseline experiment에 tool/LLM child run까지 포함한다.
- `test_project_name`: 변환된 기존 실행 결과가 들어갈 baseline experiment 이름이다.

운영 응답이 실제 정답으로 검증된 경우가 아니라면 `include_outputs=False`가 안전하다. 기존 시스템의 답을 reference로 넣으면 새 시스템이 더 좋은 답을 내도 기존 출력과 다르다는 이유로 감점될 수 있다.

## 3. reference-free evaluator로 baseline 채점하기

reference output이 없는 운영 데이터에는 형식 준수, 안전성, 근거성, 유용성처럼 실제 출력만으로 판단 가능한 evaluator를 쓴다.

```python
def has_nonempty_answer(outputs: dict) -> dict:
    messages = outputs.get("messages", [])
    content = messages[-1].content if messages else ""
    passed = bool(str(content).strip())
    return {
        "key": "nonempty_answer",
        "score": int(passed),
        "comment": None if passed else "final answer is empty",
    }


baseline_results = client.evaluate(
    baseline_experiment_name,
    evaluators=[has_nonempty_answer],
)

print(baseline_results.to_pandas()[["feedback.nonempty_answer"]].mean())
```

실제 agent라면 deterministic code evaluator와 LLM-as-judge를 함께 둔다. 예를 들어 JSON schema, 금지어, 최대 길이는 코드로 검사하고, 답변의 유용성이나 검색 결과에 대한 groundedness는 reference-free judge로 평가한다.

## 4. 같은 dataset에 candidate agent 실행하기

새 버전은 변환된 dataset을 그대로 입력으로 사용한다. 그래야 baseline과 candidate가 같은 사례를 처리한다.

```python
candidate_results = client.evaluate(
    candidate_agent,
    data=dataset_name,
    evaluators=[has_nonempty_answer],
    experiment_prefix="candidate-new-prompt",
    max_concurrency=4,
)

candidate_df = candidate_results.to_pandas()
print(candidate_df[["feedback.nonempty_answer"]].mean())
```

비용이 큰 agent는 `max_concurrency`를 공급자 rate limit에 맞춘다. tool이 외부 상태를 변경한다면 backtest 전용 mock, read-only credential, sandbox를 사용해야 한다. 과거 입력을 재실행하는 과정도 실제 API 호출이기 때문이다.

## 5. 배포 판정을 단일 평균으로 끝내지 않기

후보 모델의 평균 품질이 높아도 특정 요청 유형에서 크게 퇴보할 수 있다. 다음 항목을 함께 비교한다.

- evaluator별 평균과 실패 건수
- 입력 유형 또는 dataset split별 성능
- p95 latency와 token/cost 변화
- tool 호출 성공률과 불필요한 호출 증가
- baseline만 통과하고 candidate는 실패한 사례

권장 배포 기준은 “평균 점수가 더 높다”가 아니라 다음처럼 회귀 조건을 명시하는 것이다.

```python
baseline_pass_rate = 0.94
candidate_pass_rate = 0.96
baseline_p95_ms = 3200
candidate_p95_ms = 3500

quality_ok = candidate_pass_rate >= baseline_pass_rate
latency_ok = candidate_p95_ms <= baseline_p95_ms * 1.15

if not (quality_ok and latency_ok):
    raise SystemExit("candidate가 backtest 배포 기준을 통과하지 못했습니다")
```

## 자주 틀리는 점

### 운영 출력을 무조건 reference output으로 복사한다

운영 출력은 baseline이지 정답이 아니다. 사람 검증 또는 신뢰할 수 있는 ground truth가 없다면 `include_outputs=False`로 두고 reference-free evaluator를 사용한다.

### child run을 빼고 agent 품질을 판단한다

최종 답만 보면 tool을 쓰지 않았거나 잘못된 근거를 쓴 문제를 놓칠 수 있다. trajectory나 groundedness를 평가하려면 `load_child_runs=True`로 전체 trace를 보존한다.

### `convert_runs_to_test`가 beta API라는 점을 잊는다

현재 공식 튜토리얼의 함수 경로는 `langsmith.beta`다. beta API는 변경 가능성이 있으므로 SDK 버전을 고정하고 업그레이드 시 공식 문서와 signature를 다시 확인한다.

### 운영 trace 선택 편향을 무시한다

최근 성공 사례만 모으면 backtest가 지나치게 낙관적이다. 낮은 feedback, error, 긴 latency, 핵심 사용자 흐름을 의도적으로 포함하고 dataset version/tag로 평가 대상을 고정한다.

### stateful tool을 그대로 재실행한다

메일 전송, 결제, 데이터 수정 tool은 backtest에서 실제 부작용을 만들 수 있다. candidate agent에는 sandbox 또는 read-only/mock tool을 주입한다.

## 실전 운영 체크리스트

1. trace query 조건과 기간을 코드 및 metadata로 남긴다.
2. 운영 출력이 정답으로 검증되지 않았다면 `include_outputs=False`를 쓴다.
3. baseline과 candidate에 같은 evaluator 세트를 적용한다.
4. dataset version/tag와 experiment 이름에 날짜·변경사항을 기록한다.
5. 평균뿐 아니라 regression example, latency, cost, tool trajectory를 비교한다.
6. 배포 기준을 수치로 선언하고 CI 또는 release checklist에 연결한다.

## 참고 자료

- [Run backtests on a new version of an agent](https://docs.langchain.com/langsmith/run-backtests-new-agent)
- [Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)
- [Query traces using the SDK](https://docs.langchain.com/langsmith/export-traces)
- [Trace query syntax](https://docs.langchain.com/langsmith/trace-query-syntax)
- [Manage datasets programmatically](https://docs.langchain.com/langsmith/manage-datasets-programmatically)
