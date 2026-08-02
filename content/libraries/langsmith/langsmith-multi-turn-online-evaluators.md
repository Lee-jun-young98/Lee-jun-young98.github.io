---
title: "LangSmith multi-turn online evaluator로 전체 대화 품질 평가하기"
description: "thread_id와 messages 스키마를 맞추고 idle time 뒤 전체 대화를 LLM-as-a-judge로 평가하는 운영 패턴"
date: 2026-08-02
tags:
  - langsmith
  - evaluation
  - observability
  - multi-turn
  - python
aliases:
  - "/blog/langsmith-multi-turn-online-evaluators"
---

# LangSmith multi-turn online evaluator로 전체 대화 품질 평가하기

챗봇의 한 턴만 보면 답변이 자연스러워도, 전체 대화에서는 사용자의 문제가 끝내 해결되지 않았거나 같은 질문을 반복했을 수 있다. LangSmith의 multi-turn online evaluator는 각 trace를 따로 채점하지 않고, 같은 `thread_id`로 묶인 대화가 idle 상태가 된 뒤 전체 thread를 한 번 평가한다.

이 기능은 다음 질문에 특히 잘 맞는다.

- 사용자의 최초 의도가 마지막에 해결되었는가?
- 불필요한 재질문이나 같은 tool 호출이 반복되었는가?
- 상담원이 대화 중 약속한 조건을 최종 답변에서도 지켰는가?
- 개별 응답은 괜찮지만 전체 trajectory가 비효율적이지 않은가?

## 사전 준비

```bash
pip install -U "langsmith>=0.4.43" openai
```

PowerShell에서는 다음 환경 변수를 준비한다.

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_TRACING="true"
$env:LANGSMITH_PROJECT="support-agent-prod"
$env:OPENAI_API_KEY="sk-your-key"
```

`uuid7()` helper는 LangSmith Python SDK 0.4.43 이상에서 제공된다. evaluator를 만들려면 LangSmith project에 thread가 실제로 쌓여 있어야 하고, evaluator model provider도 workspace에서 설정해야 한다.

## 평가가 실행되는 흐름

multi-turn evaluator의 수명 주기는 다음과 같다.

1. 각 대화 턴을 별도 trace로 보내되 같은 `thread_id`를 metadata에 기록한다.
2. 마지막 trace 이후 project에 설정한 idle time이 지나기를 기다린다.
3. LangSmith가 각 trace의 최상위 `inputs.messages`와 `outputs.messages`를 모은다.
4. 겹치는 대화 history를 중복 제거해 OpenAI chat 형식의 `all_messages`를 만든다.
5. LLM-as-a-judge가 전체 thread를 한 번 평가하고 thread-level feedback을 남긴다.

따라서 per-run latency나 JSON schema처럼 한 호출만 보면 되는 지표에는 run-level online evaluator를 쓰는 편이 맞다. multi-turn evaluator는 semantic intent, outcome, trajectory처럼 대화 전체가 필요한 기준에 사용한다.

## 1. `thread_id`와 `messages` 형식을 맞춘다

아래 예제는 한 번 호출할 때 한 턴만 입력·출력하고, 같은 ID로 두 trace를 연결한다. 각 최상위 입력과 출력에 `messages` list가 있으므로 LangSmith가 thread history를 조립할 수 있다.

```python
from openai import OpenAI
from langsmith import traceable, uuid7
from langsmith.wrappers import wrap_openai

client = wrap_openai(OpenAI())
thread_id = str(uuid7())


@traceable(name="support_turn")
def answer_turn(messages: list[dict[str, str]]) -> dict:
    response = client.chat.completions.create(
        model="gpt-5-mini",
        messages=messages,
    )
    assistant = {
        "role": "assistant",
        "content": response.choices[0].message.content,
    }
    return {"messages": [assistant]}


def run_turn(user_text: str) -> dict:
    return answer_turn(
        [{"role": "user", "content": user_text}],
        langsmith_extra={"metadata": {"thread_id": thread_id}},
    )


run_turn("배송이 늦는데 주문 상태를 확인해 주세요.")
run_turn("오늘 받을 수 있는지도 알려 주세요.")
print(thread_id)
```

실제 서비스에서는 브라우저 session이나 conversation row마다 ID를 하나 저장하고 재사용한다. UUID v7은 생성 시각을 포함해 시간순 정렬이 쉬우므로 공식 문서가 권장한다.

> [!important]
> `messages`는 trace의 **최상위** inputs와 outputs에 있어야 한다. `payload.chat.messages`처럼 더 깊은 곳에 넣거나 문자열 하나만 반환하면 evaluator input이 비어 보일 수 있다.

각 trace가 최신 한 턴만 담아도 LangSmith가 이어 붙인다. 매번 전체 history를 보내는 앱도 지원하며, 이 경우 겹치는 앞부분을 중복 제거한다. 두 방식을 한 project에서 불규칙하게 섞기보다 trace contract를 하나로 고정하는 편이 디버깅하기 쉽다.

## 2. UI에서 thread evaluator를 만든다

1. **Tracing → project → Evaluators → + Evaluator**로 이동한다.
2. **LLM-as-a-Judge Evaluator**를 고르고 Source를 **Threads**로 설정한다.
3. filter 또는 sampling rate를 지정한다.
4. thread가 끝났다고 판단할 idle time을 설정한다.
5. judge model과 prompt, feedback key를 정하고 저장한다.

idle time은 project의 모든 thread-level evaluator에 공통으로 적용된다. 개발 중에는 짧게 설정해 결과를 확인하고, 운영에서는 실제 사용자가 다음 메시지를 보내는 간격보다 충분히 길게 잡는다. 너무 짧으면 살아 있는 대화를 중간에 평가하고, 너무 길면 feedback과 알림이 늦어진다.

## 3. judge prompt의 대화 범위를 의도적으로 고른다

UI에서 `all_messages`에 넣을 범위를 세 가지 중 선택할 수 있다.

- **All messages**: system, user, assistant, tool call을 포함한 전체 trajectory 평가
- **Human and AI pairs**: tool 내부 구현은 빼고 사용자 경험과 대화 품질 평가
- **First human and last AI**: 최초 의도가 최종 답변에서 해결되었는지 저비용으로 평가

예를 들어 outcome evaluator에는 다음처럼 좁은 rubric이 유용하다.

```text
전체 대화를 읽고 사용자의 최초 요청이 최종적으로 해결되었는지 평가하라.

- 1: 필요한 조치나 답변이 완료되었다.
- 0: 해결되지 않았거나 사용자가 다시 문의해야 한다.

추측하지 말고 대화에 드러난 결과만 사용하라.
```

feedback key는 run-level 점수와 구분해 `thread_outcome_resolved`처럼 짓는다. 같은 `correctness` key를 두 수준에서 함께 쓰면 dashboard에서 어느 평가가 만든 값인지 모호해진다.

## 4. 비용과 retention을 함께 설계한다

긴 thread는 judge token 비용이 커진다. 처음부터 모든 대화를 평가하기보다 5~10% sampling이나 특정 plan, locale, error 조건으로 시작하고 false positive를 확인한 뒤 넓히는 편이 안전하다.

multi-turn online evaluator는 기본적으로 관련 trace의 retention을 연장할 수 있다. 현재 UI에서는 evaluator 설정에서 이 동작을 opt out해 project의 retention tier를 유지할 수 있다. 다만 다른 automation이 명시적으로 retention을 연장하거나 project 자체가 extended tier라면 그대로 유지된다. 평가 sampling과 retention 설정을 별개 비용 항목으로 검토해야 한다.

## 현재 한도

공식 문서 기준으로 다음 제한이 있다. 이 값은 바뀔 수 있으므로 운영 적용 전 문서를 다시 확인한다.

- thread가 idle이 될 때 최근 7일 이내 run만 평가 대상이다.
- 5분 동안 idle로 판정된 thread가 500개를 넘으면 초과분은 자동 sampling된다.
- workspace당 multi-turn online evaluator는 최대 10개다.

대량 backfill 도구로 생각하면 안 된다. 새 evaluator는 저장 이후 생성된 새 thread가 idle time을 지난 뒤 테스트하는 것이 기본 흐름이다.

## 자주 하는 실수

### thread ID를 턴마다 새로 만든다

사용자 메시지마다 `uuid7()`을 호출하면 모든 trace가 한 턴짜리 thread가 된다. conversation 시작 시 한 번 만들고 저장한 ID를 끝까지 재사용한다.

### child run에는 thread metadata가 없다

thread 묶음 자체는 root run으로 보일 수 있지만, child run에 ID가 빠지면 thread filter, token 사용량, 비용 집계에서 누락될 수 있다. nested `@traceable` 함수와 child span에도 metadata가 전파되는지 확인한다.

### evaluator가 저장 즉시 과거 thread를 채점한다고 기대한다

새로 저장한 evaluator는 idle time이 지난 새 thread로 검증한다. 결과가 없으면 **Evaluator Logs**에서 마지막 실행 시각을, **Evaluator traces**에서 judge에 전달된 input을 확인한다.

### 너무 긴 history를 무조건 전부 judge에 보낸다

도구 trajectory가 평가 기준에 필요 없다면 Human and AI pairs 또는 First human and last AI를 사용한다. 긴 context model을 선택하는 것만으로 비용과 잡음이 해결되지는 않는다.

## 운영 체크리스트

- 모든 턴이 같은 `thread_id`를 사용하는가?
- root inputs와 outputs에 지원되는 `messages` list가 있는가?
- idle time이 실제 대화 간격에 맞는가?
- thread-level feedback key가 run-level key와 구분되는가?
- sampling, judge context 범위, retention opt-out을 함께 검토했는가?
- Logs와 Evaluator traces에서 실제 조립된 입력을 확인했는가?

## 참고 자료

- [Set up multi-turn online evaluators](https://docs.langchain.com/langsmith/online-evaluations-multi-turn)
- [Configure threads](https://docs.langchain.com/langsmith/threads)
- [Query threads using the SDK](https://docs.langchain.com/langsmith/query-threads)
- [Manage evaluator trace retention](https://docs.langchain.com/langsmith/evaluators#manage-evaluator-trace-retention)
