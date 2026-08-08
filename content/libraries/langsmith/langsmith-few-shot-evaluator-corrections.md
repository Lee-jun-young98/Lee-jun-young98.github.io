---
title: "LangSmith few-shot evaluator로 사람의 평가 수정사항 반영하기"
description: "LLM-as-a-judge 점수를 사람이 교정하고, correction dataset과 few-shot example로 다음 평가의 정렬을 개선하는 실전 흐름"
date: 2026-08-08
tags:
  - langsmith
  - evaluation
  - llm-as-a-judge
  - human-feedback
  - few-shot
aliases:
  - "/blog/langsmith-few-shot-evaluator-corrections"
---

# LangSmith few-shot evaluator로 사람의 평가 수정사항 반영하기

LLM-as-a-judge는 자연어 품질처럼 코드 규칙으로 판정하기 어려운 항목에 유용하지만, rubric만 길게 쓰는 것으로 사람의 판단과 항상 일치하지는 않는다. LangSmith의 few-shot evaluator는 사람이 잘못된 평가 점수를 고치면 그 사례를 별도 dataset에 쌓고, 이후 evaluator prompt에 예시로 넣어 판단 기준을 보정한다.

핵심 흐름은 다음과 같다.

1. run-level LLM-as-a-judge evaluator에 few-shot example을 활성화한다.
2. 사람이 evaluator feedback의 점수와 설명을 교정한다.
3. LangSmith가 교정 사례를 correction dataset에 복사한다.
4. 이후 평가부터 일부 사례가 prompt에 삽입된다.

모델을 fine-tuning하는 기능은 아니다. evaluator가 실행될 때 사람의 교정 사례를 문맥으로 제공하는 few-shot prompting이다.

## 사전 준비와 현재 지원 범위

- LangSmith workspace와 API key
- trace 또는 experiment에 연결된 **LLM-as-a-judge evaluator**
- 평가 대상은 thread 전체가 아니라 **run-level**이어야 한다.
- evaluator prompt는 **Mustache 형식**이어야 한다.
- Prompt Hub prompt를 사용하는 LLM-as-a-judge evaluator에는 현재 지원되지 않는다.

SDK에서 feedback을 교정하려면 다음 패키지가 필요하다.

```bash
pip install -U langsmith
```

```powershell
$env:LANGSMITH_API_KEY = "lsv2_..."
```

## 1. evaluator prompt와 변수 매핑 설계하기

메인 evaluator prompt에는 현재 평가할 입력과 출력, 그리고 few-shot example이 들어갈 위치가 있어야 한다. 현재 prompt format 가이드가 사용하는 placeholder는 `{{few_shot_examples}}`다.

```text
당신은 고객지원 답변의 정확성을 평가한다.

다음은 사람이 확정한 평가 예시다.
{{few_shot_examples}}

현재 질문: {{question}}
현재 답변: {{response}}

사실 오류가 없고 질문을 해결하면 1, 아니면 0으로 평가한다.
```

UI의 **Improve evaluator accuracy using few-shot examples** 설정에서 예시 하나의 format도 정한다.

```text
질문: {{question}}
답변: {{response}}
사람이 확정한 점수: {{correctness}}
판정 근거: {{few_shot_explanation}}
```

few-shot example의 변수 매핑에는 메인 prompt 변수와 함께 다음 두 값이 필요하다.

- `few_shot_explanation`: 사람이 correction에 남긴 설명
- feedback key와 같은 이름의 score 변수: 위 예제에서는 `correctness`

feedback key가 `helpfulness`인데 example format에 `{{correctness}}`를 쓰면 교정 점수가 기대한 위치에 들어가지 않는다. 이름을 정확히 맞춰야 한다.

## 2. 예시 개수는 비용과 다양성 사이에서 정하기

기본 삽입 개수는 5개다. correction dataset에 더 많은 사례가 있으면 LangSmith가 실행 시 무작위로 선택한다.

- 답변과 설명이 길면 2~3개부터 시작해 token 비용과 latency를 확인한다.
- 짧은 분류 문제라면 5개 이상을 시험할 수 있다.
- 재현성이 중요한 회귀 테스트에서는 무작위 표본 때문에 점수가 흔들릴 수 있음을 기록한다.
- 서로 모순되는 correction을 그대로 두면 rubric보다 예시 충돌의 영향이 커질 수 있다.

예시 수를 늘리기 전에 dataset에서 중복, 오래된 정책, 애매한 설명을 정리하는 편이 효과적이다.

## 3. UI에서 점수와 설명 교정하기

experiment comparison view 또는 runs table에서 feedback 점수를 열고 **Make correction**을 선택한다. 원래 evaluator가 `0`을 줬지만 사람이 `1`이 맞다고 판단했다면 점수와 함께 이유를 남긴다.

```text
수정 점수: 1
설명: 답변이 환불 가능 기간과 예외 조건을 모두 정확히 안내했다.
```

설명은 부가 메모가 아니다. `few_shot_explanation`으로 evaluator prompt에 들어가므로, "판정이 이상함"보다 어떤 기준 때문에 점수가 바뀌었는지 적어야 한다.

교정 내용이 correction dataset에 나타나기까지 1~2분 정도 걸릴 수 있다. 즉시 보이지 않는다고 같은 correction을 반복해서 만들지 않는다.

## 4. Python SDK로 correction 남기기

대량 audit이나 내부 검토 도구에서는 `update_feedback()`으로 같은 correction을 저장할 수 있다.

```python
import os

from langsmith import Client


def correct_feedback(feedback_id: str, score: int) -> None:
    if score not in (0, 1):
        raise ValueError("correctness score must be 0 or 1")

    client = Client(api_key=os.environ["LANGSMITH_API_KEY"])
    client.update_feedback(
        feedback_id,
        correction={"score": score},
    )


if __name__ == "__main__":
    correct_feedback("00000000-0000-0000-0000-000000000000", 1)
```

공식 SDK 예제에서 UI에 점수 correction으로 표시되려면 `correction` dict에 숫자형 `score`가 필요하다. 실제 실행 시에는 placeholder UUID를 검토 대상 feedback ID로 바꾼다.

설명이 few-shot 품질에 중요하므로, 자동화하기 전 현재 설치한 SDK의 `update_feedback` signature와 workspace UI에서 설명 저장 방식도 확인한다. API가 받는 일반 comment와 few-shot용 correction explanation을 같은 필드라고 추정해 임의로 넣지 않는 것이 안전하다.

## 5. correction dataset을 운영 자산으로 관리하기

자동 생성된 dataset은 다음 경로에서 찾는다.

- online evaluator: run rule의 **Edit Rule**
- offline evaluator: evaluator의 **Edit Evaluator**

dataset example에는 평가에 매핑된 inputs, outputs, offline 평가라면 reference, 교정 점수와 설명이 들어간다. 자동 생성됐더라도 일반 평가 데이터처럼 주기적으로 검수한다.

실전에서는 다음 상태를 metadata나 별도 운영 문서로 관리하면 좋다.

- 적용 중인 rubric 버전
- correction을 승인한 reviewer와 날짜
- 정책 변경으로 더 이상 유효하지 않은 예시
- 특정 언어, 고객군, 실패 유형에 편중됐는지 여부

## 흔한 실수

### thread-level evaluator에 설정하려고 한다

현재 few-shot correction 기능은 run-level evaluator만 지원한다. 전체 대화 품질은 thread evaluator로 유지하되, 한 턴의 정확성처럼 분리 가능한 기준을 run-level evaluator로 두는 방법을 검토한다.

### f-string prompt 또는 Prompt Hub prompt를 그대로 쓴다

이 기능은 Mustache evaluator prompt가 필요하고 Prompt Hub 기반 evaluator에는 지원되지 않는다. UI에서 prompt format을 바꾼 뒤 preview로 실제 렌더링을 확인한다.

### score 변수 이름이 feedback key와 다르다

`correctness` feedback을 만들었다면 few-shot format도 `{{correctness}}`를 사용한다. 대소문자와 철자까지 일치시킨다.

### 설명 없이 점수만 고친다

숫자만으로는 경계 사례의 판단 근거를 가르치기 어렵다. 짧더라도 rubric의 어떤 조건이 적용됐는지 남긴다.

### correction을 곧바로 모델 학습으로 오해한다

교정 사례는 prompt에 삽입된다. dataset이 커져도 설정한 개수만 사용하며, 초과분은 무작위로 선택된다. token 비용과 평가 분산을 함께 관찰해야 한다.

## 운영 체크리스트

- [ ] evaluator가 run-level LLM-as-a-judge인가
- [ ] prompt format이 Mustache인가
- [ ] `{{few_shot_examples}}` 위치를 preview로 확인했는가
- [ ] example format의 score 변수가 feedback key와 같은가
- [ ] correction 설명이 실제 판정 기준을 담고 있는가
- [ ] correction dataset의 중복·충돌·정책 만료를 정기 검수하는가
- [ ] few-shot 적용 전후를 고정 dataset에서 비교했는가
- [ ] token 사용량, latency, 점수 분산을 함께 측정했는가

## 참고 자료

- [How to improve your evaluator with few-shot examples](https://docs.langchain.com/langsmith/create-few-shot-evaluators)
- [How to audit evaluator scores](https://docs.langchain.com/langsmith/audit-evaluator-scores)
- [Prompt template format guide](https://docs.langchain.com/langsmith/prompt-template-format)
- [How to define an LLM-as-a-judge evaluator](https://docs.langchain.com/langsmith/llm-as-judge)
