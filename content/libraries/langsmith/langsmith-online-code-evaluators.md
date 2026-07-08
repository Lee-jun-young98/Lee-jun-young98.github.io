---
title: "LangSmith online code evaluator로 운영 trace 품질 가드레일 걸기"
description: "LangSmith online code evaluator를 이용해 운영 trace에 구조 검증, 정책 체크, 샘플링 기반 품질 모니터링을 붙이는 방법을 Python 예제와 함께 정리한 실전 노트"
date: 2026-07-08
tags:
  - langsmith
  - evaluation
  - observability
  - python
aliases:
  - "/blog/langsmith-online-code-evaluators"
---

# LangSmith online code evaluator로 운영 trace 품질 가드레일 걸기

오프라인 eval은 배포 전에 좋지만, 운영에서는 "실제 유저 입력에서 응답 구조가 깨졌는지", "tool 호출 뒤 필수 필드가 빠졌는지", "특정 플랜 고객의 응답만 따로 감시할지" 같은 문제를 계속 봐야 한다.  
이럴 때 LangSmith의 online code evaluator를 쓰면 production trace에 규칙 기반 품질 체크를 바로 붙일 수 있다.

이 글은 다음 흐름에 집중한다.

- 어떤 상황에서 online code evaluator가 적합한지
- `perform_eval(run)` 함수를 로컬에서 먼저 검증하는 방법
- Python SDK로 evaluator 자산을 생성하는 방법
- Tracing project에 evaluator를 붙일 때 filter, sampling, backfill을 어떻게 고를지
- 운영에서 자주 놓치는 extended retention, webhook 순서, feedback key 설계 함정

## 언제 쓰면 좋은가

online code evaluator는 사람이 직접 보는 review queue나 LLM judge보다 다음 조건에서 특히 유리하다.

- 규칙이 비교적 명확하다
- 빠르게 돌려야 한다
- 비용을 낮게 유지해야 한다
- reference answer 없이도 판정할 수 있다

예를 들면 이런 체크에 잘 맞는다.

- JSON 응답에 필수 필드가 모두 있는지
- tool 결과를 최종 답변에 반영했는지
- 응답 길이가 너무 짧거나 비어 있지 않은지
- 특정 metadata를 가진 트래픽만 별도 기준으로 감시할지

반대로 "이 답변이 정말 도움이 되는가"처럼 판단이 애매한 문제는 online LLM-as-a-judge가 더 잘 맞는다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_PROJECT="support-agent-prod"
```

Python SDK에서 evaluator 생성 API를 쓰려면 현재 문서 기준 `langsmith>=0.9.8`이 필요하다.

또한 online code evaluator 본문 코드 자체는 LangSmith 안에서 inline으로 실행된다. 현재 문서 기준으로:

- 표준 라이브러리는 사용할 수 있다
- 추가 공개 패키지는 `numpy`, `pandas`, `jsonschema`, `scipy`, `scikit-learn` 정도만 허용된다
- evaluator 안에서는 인터넷에 접근할 수 없다

## 핵심 개념

LangSmith 문서 기준 online code evaluator는 tracing project의 live run에 붙는 evaluator다.  
평가 함수는 inline code로 작성하며, `perform_eval(run)` 형태로 단일 run을 받아 feedback dictionary를 반환한다.

가장 중요한 점은 세 가지다.

1. online evaluator는 dataset example이 아니라 운영 run을 평가한다
2. evaluator가 trace 안의 어떤 run에라도 실행되면 그 trace는 extended data retention으로 승격될 수 있다
3. 어떤 run에 evaluator를 적용할지는 project 쪽 filter와 sampling이 결정한다

즉 "평가 코드"와 "언제 평가할지"를 분리해서 생각해야 운영이 덜 꼬인다.

## 1. 로컬에서 `perform_eval(run)`부터 먼저 검증한다

공식 문서도 code evaluator는 먼저 로컬 테스트를 권장한다.  
UI 안에서 바로 코드를 쓰기 시작하면 filter 문제인지 evaluator 코드 문제인지 구분하기 어렵다.

아래는 "최종 답변이 JSON 직렬화 가능하고, `answer`와 `citations` 필드를 모두 포함하는가"를 보는 단순 예제다.

```python
import json


def perform_eval(run):
    outputs = run.get("outputs") or {}

    try:
        json.loads(json.dumps(outputs))
    except Exception:
        return {"response_schema_ok": 0}

    if "answer" not in outputs:
        return {"response_schema_ok": 0}

    if "citations" not in outputs:
        return {"response_schema_ok": 0}

    if not isinstance(outputs["citations"], list):
        return {"response_schema_ok": 0}

    return {"response_schema_ok": 1}


if __name__ == "__main__":
    sample_run = {
        "outputs": {
            "answer": "환불은 주문 후 7일 이내에 가능합니다.",
            "citations": ["refund-policy.md"],
        }
    }
    print(perform_eval(sample_run))
```

이 패턴의 장점은 evaluator를 LangSmith에 넣기 전에 로컬 단위 테스트로 빠르게 다듬을 수 있다는 점이다.

## 2. child run까지 보고 싶다면 현재 run shape를 먼저 단순하게 가정하지 않는다

운영에서 자주 하는 실수는 evaluator가 항상 root run의 `outputs`만 본다고 가정하는 것이다.  
하지만 online evaluator는 filter에 매칭된 run에 붙는다. 특정 tool run만 평가할 수도 있고, root run만 평가할 수도 있다.

그래서 코드 안에서 최소한 다음 분기를 두는 편이 안전하다.

```python
def perform_eval(run):
    run_type = run.get("run_type")
    outputs = run.get("outputs") or {}

    if run_type == "tool":
        documents = outputs.get("documents") or []
        return {"retrieval_nonempty": int(len(documents) > 0)}

    if run_type == "chain":
        answer = outputs.get("answer", "")
        return {"answer_nonempty": int(bool(str(answer).strip()))}

    return {"skipped_by_type": 1}
```

핵심은 evaluator 코드를 복잡하게 만드는 것보다, project filter로 대상 run을 최대한 좁히는 것이다.

## 3. Python SDK로 재사용 가능한 evaluator 자산을 만든다

online code evaluator는 UI에서 바로 만들 수도 있지만, 반복해서 쓰는 규칙이면 SDK로 만들어 두는 편이 낫다.  
그러면 여러 project에 같은 evaluator를 재사용하고, 코드 변경도 추적하기 쉬워진다.

```python
import asyncio
from textwrap import dedent

from langsmith import Client


async def main():
    client = Client()

    code = dedent(
        """
        def perform_eval(run):
            outputs = run.get("outputs") or {}
            answer = outputs.get("answer", "")
            citations = outputs.get("citations") or []

            is_ok = bool(str(answer).strip()) and isinstance(citations, list) and len(citations) > 0
            return {"answer_with_citations": int(is_ok)}
        """
    ).strip()

    created = await client.evaluators.create(
        name="Answer with citations",
        type="code",
        code_evaluator={
            "code": code,
            "language": "python",
        },
    )

    print(created.evaluator.id)
    print(created.evaluator.name)


asyncio.run(main())
```

이렇게 만든 evaluator는 workspace 자산으로 저장되고, 이후 Tracing project의 Evaluators 탭에서 붙여서 online monitoring에 사용할 수 있다.

## 4. project에 붙일 때는 filter를 먼저 설계한다

운영에서 중요한 건 evaluator 코드보다 filter다.  
문서 기준으로 online evaluator filter는 tracing project에서 쓰는 filter와 같은 방식으로 동작한다.

실무에서는 보통 아래처럼 시작하면 안정적이다.

### 운영 플랜 고객만 평가

```text
and(eq(metadata_key, "plan_type"), eq(metadata_value, "enterprise"))
```

위처럼 단순히 쓰는 대신 실제 UI에서는 metadata 값까지 맞춰서 enterprise 트래픽만 고르는 식으로 설정한다.

### 특정 tool을 포함한 trace만 평가

```text
and(eq(name, "retrieve_documents"), eq(run_type, "tool"))
```

### 사용자가 나쁜 feedback을 남긴 경우만 재평가

```text
and(eq(feedback_key, "user_score"), lt(feedback_score, 0.5))
```

실제로는 evaluator 생성 패널에서 최근 run을 같이 보면서 filter를 잡는 편이 훨씬 빠르다.  
문서도 runs table에서 적용한 filter가 evaluator 설정에 그대로 반영된다고 안내한다.

## 5. sampling으로 비용과 retention 폭증을 막는다

online evaluator는 production run에 실시간으로 붙으므로, 초기에 100% 적용부터 시작하면 금방 과해질 수 있다.

이럴 때는 보통 아래 순서가 무난하다.

1. 새 evaluator는 5%에서 10% 샘플링으로 시작
2. false positive가 적은지 확인
3. 진짜 중요한 evaluator만 100%로 확대

특히 LangSmith 문서 기준으로 online evaluator가 trace 안의 어떤 run에라도 실행되면 그 trace가 extended retention으로 승격될 수 있다.  
즉 샘플링은 계산 비용뿐 아니라 저장 비용과 조사 범위까지 같이 조절하는 스위치다.

## 6. webhook automation과 같이 쓸 때는 rule 순서를 믿지 않는다

이 부분이 운영에서 제일 많이 헷갈린다.

LangSmith 문서 기준으로 automation rule들은 서로 독립적인 polling schedule로 실행된다.  
그래서 webhook rule이 evaluator score보다 먼저 실행될 수도 있다.

예를 들어 webhook payload 안에 evaluator score가 꼭 들어가야 한다면 "순서상 나중에 돌겠지"라고 가정하면 안 된다.  
대신 webhook rule 자체에 feedback 존재 조건을 둬서 의존성을 명시하는 편이 안전하다.

예시:

```text
has(feedback_key, "answer_usefulness")
```

즉 evaluator가 먼저 score를 남긴 뒤에만 webhook이 실행되도록 filter를 거는 방식이다.

## 7. feedback key는 좁고 안정적으로 잡는다

feedback key 이름을 대충 만들면 dashboard와 분석이 금방 지저분해진다.

예를 들어 아래처럼 역할을 분리해 두는 편이 낫다.

- `answer_with_citations`
- `response_schema_ok`
- `retrieval_nonempty`
- `tool_args_valid`

너무 넓은 `quality`, `correctness`, `good_output` 같은 이름은 나중에 human review 점수, LLM judge 점수, code evaluator 점수가 한곳에 뒤섞이기 쉽다.

## 자주 하는 실수

### 1. evaluator 코드보다 filter가 먼저라는 점을 잊는다

코드에서 모든 run type을 처리하려고 무리하게 분기하지 말고, evaluator를 어느 run에 적용할지부터 좁혀야 한다.

### 2. online evaluator를 offline eval처럼 생각한다

online evaluator는 reference output이 없는 운영 trace를 대상으로 한다.  
정답 비교형 평가보다 구조 검증, 정책 체크, 이상 징후 탐지에 더 적합하다.

### 3. retention 비용 영향을 놓친다

online evaluator가 돌면 관련 trace가 extended retention으로 올라갈 수 있다.  
초기에는 좁은 filter와 낮은 sampling으로 시작하는 편이 안전하다.

### 4. webhook과 evaluator의 실행 순서를 암묵적으로 기대한다

독립 rule끼리는 실행 순서가 보장되지 않는다.  
후속 rule에서 evaluator 결과가 필요하면 feedback filter로 의존성을 강제해야 한다.

### 5. 로컬 테스트 없이 UI에서만 evaluator 코드를 만진다

이렇게 하면 run payload shape 문제와 evaluator 로직 문제를 섞어서 보게 된다.  
`perform_eval(run)`을 순수 함수처럼 먼저 테스트하는 편이 훨씬 빠르다.

## 추천 운영 패턴

개인적으로는 아래 흐름이 가장 무난하다.

1. 로컬 Python 함수로 `perform_eval(run)` 검증
2. SDK로 evaluator 생성해서 workspace 자산화
3. project UI에서 좁은 filter와 5~10% sampling으로 부착
4. dashboard에서 feedback 추이를 확인
5. 낮은 점수 trace를 annotation queue나 dataset으로 다시 보내 offline eval 케이스로 승격

이렇게 하면 online evaluator가 production monitor 역할을 하고, offline eval이 회귀 테스트 역할을 맡는 구조가 된다.

## 참고 자료

- [Set up online code evaluators](https://docs.langchain.com/langsmith/online-evaluations-code)
- [Set up LLM-as-a-judge online evaluators](https://docs.langchain.com/langsmith/online-evaluations-llm-as-judge)
- [Manage evaluators with the SDK](https://docs.langchain.com/langsmith/manage-evaluators-sdk)
- [Set up automation rules](https://docs.langchain.com/langsmith/rules)
- [Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)
