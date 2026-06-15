---
title: "LangGraph input_schema, output_schema, private state로 공개 입력과 내부 상태 분리하기"
description: "LangGraph에서 input_schema, output_schema, private state channel을 사용해 외부 입력/출력과 내부 워크플로 상태를 분리하고 stream 노출 함정까지 관리하는 실전 패턴 정리"
date: 2026-06-15
tags:
  - langgraph
  - workflow
  - state
  - python
aliases:
  - "/blog/langgraph-input-output-private-state-schemas"
---

# LangGraph input_schema, output_schema, private state로 공개 입력과 내부 상태 분리하기

LangGraph를 쓰다 보면 state가 금방 커진다.

- 사용자 입력은 몇 개 안 되는데 내부 판단용 키가 계속 늘어난다
- 최종 응답에는 노출하면 안 되는 중간 값이 state에 섞인다
- `invoke()` 결과는 깔끔한데 `stream()`으로 보면 private 값이 그대로 흘러나온다

이럴 때 필요한 기본 도구가 `input_schema`, `output_schema`, private state channel이다.

공식 문서 기준으로 LangGraph는:

- 그래프 바깥에서 받는 입력 스키마를 `input_schema`로 제한할 수 있고
- 그래프가 최종적으로 돌려주는 출력 스키마를 `output_schema`로 제한할 수 있고
- 노드 사이에서만 쓰는 private channel을 별도 schema로 선언할 수 있다

이 글에서는 Python Graph API 기준으로 아래만 실전적으로 정리한다.

- 공개 입력/출력과 내부 state를 왜 분리해야 하는지
- `input_schema`, `output_schema`, private state를 함께 쓰는 기본 패턴
- `invoke()`와 `stream()`에서 보이는 값이 왜 다른지
- 실무에서 자주 놓치는 함정

## 언제 유용한가

다음 상황이면 거의 바로 쓸 가치가 있다.

- 외부 API나 UI에는 최소 입력/출력만 공개하고 싶을 때
- classifier 결과, guardrail 판단, 정규화 텍스트 같은 중간 값을 내부에만 두고 싶을 때
- 같은 graph를 서비스 응답과 내부 운영 trace 용도로 함께 쓰고 싶을 때
- 스트리밍 응답은 내보내되 private channel은 제한하고 싶을 때

반대로 작은 프로토타입이고 state 키가 2~3개뿐이면 단일 schema로도 충분하다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langgraph
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langgraph
```

## 핵심 개념

공식 문서 기준으로 중요한 schema는 세 층이다.

1. `input_schema`: 그래프가 외부에서 받는 입력 shape
2. `output_schema`: `invoke()`가 외부로 돌려주는 출력 shape
3. internal/private state: 노드끼리만 주고받는 내부 channel

핵심은 이 세 가지가 "권한 경계"처럼 동작한다는 점이다.

- `input_schema`는 잘못된 외부 입력을 막는다
- `output_schema`는 최종 결과를 좁힌다
- private channel은 중간 계산을 분리한다

다만 여기서 많이 오해하는 점이 하나 있다.  
private channel은 `invoke()` 결과에서 감춰질 수 있어도, `stream_mode="values"`에서는 기본적으로 그대로 보일 수 있다.

## 가장 작은 예제

아래 예제는 고객 문의를 받아 내부 분류를 거친 뒤 최종 답변만 외부로 돌려주는 가장 단순한 패턴이다.

```python
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


class InputState(TypedDict):
    user_message: str


class OutputState(TypedDict):
    answer: str


class OverallState(InputState, OutputState):
    normalized_message: str


class PrivateState(TypedDict):
    escalation_reason: str


def normalize(state: InputState) -> OverallState:
    normalized = state["user_message"].strip().lower()
    return {"normalized_message": normalized}


def classify_policy(state: OverallState) -> PrivateState:
    message = state["normalized_message"]
    if "refund" in message or "chargeback" in message:
        return {"escalation_reason": "billing-sensitive"}
    return {"escalation_reason": "safe-for-auto-reply"}


def draft_answer(state: PrivateState) -> OutputState:
    if state["escalation_reason"] == "billing-sensitive":
        return {"answer": "결제 관련 문의로 분류되어 사람 검토 큐로 전달합니다."}
    return {"answer": "기본 FAQ 응답으로 처리합니다."}


builder = StateGraph(
    OverallState,
    input_schema=InputState,
    output_schema=OutputState,
)
builder.add_node("normalize", normalize)
builder.add_node("classify_policy", classify_policy)
builder.add_node("draft_answer", draft_answer)
builder.add_edge(START, "normalize")
builder.add_edge("normalize", "classify_policy")
builder.add_edge("classify_policy", "draft_answer")
builder.add_edge("draft_answer", END)

graph = builder.compile()

result = graph.invoke({"user_message": " I want a refund for duplicate billing. "})
print(result)
```

출력은 `OutputState`만 남는다.

```python
{"answer": "결제 관련 문의로 분류되어 사람 검토 큐로 전달합니다."}
```

하지만 내부에서는 아래 값들이 실제로 사용됐다.

- `normalized_message`
- `escalation_reason` 같은 private channel

즉 "그래프 내부에서 필요한 정보량"과 "외부에 돌려줄 정보량"을 분리한 것이다.

## `input_schema`와 `output_schema`는 어디서 이득이 큰가

실전에서는 아래 두 지점에서 체감이 크다.

### 1. API 응답 shape를 안정적으로 고정할 때

내부 상태가 늘어나도 외부 응답은 `answer`, `citations`, `status` 정도만 유지하고 싶을 때가 많다.

```python
class OutputState(TypedDict):
    answer: str
    status: str
```

이렇게 두면 내부에 `retrieval_count`, `guardrail_label`, `normalized_query`가 계속 추가되어도 `invoke()` 결과는 좁게 유지된다.

### 2. 노드 입력을 필요한 만큼만 읽게 만들 때

공식 문서 예제처럼 노드 함수의 인자를 더 좁은 schema로 선언할 수 있다.

```python
class ModerationInput(TypedDict):
    normalized_message: str


def moderation_node(state: ModerationInput) -> dict:
    ...
```

이 방식은 "이 노드는 이 키만 읽는다"는 의도를 코드 레벨에서 드러내 준다.

## private state는 "내부 전달용 메모"에 가깝다

private channel은 특히 이런 값에 잘 맞는다.

- 다음 노드만 알아야 하는 classifier 결과
- raw tool output에서 뽑은 중간 판단
- 외부 응답에는 포함하면 안 되는 guardrail reason
- 내부 라우팅용 flag

예를 들어 사람 승인 여부를 결정하는 숫자 점수를 외부에 보여줄 필요가 없다면 굳이 public output에 넣지 않아도 된다.

```python
class PrivateState(TypedDict):
    risk_score: float
    approval_reason: str
```

이렇게 두면 마지막 응답은 단순하게 유지하면서 내부 흐름은 더 정교하게 만들 수 있다.

## 가장 중요한 함정: private channel은 `stream(values)`에서 보일 수 있다

이건 운영에서 정말 자주 놓친다.

공식 문서 기준으로:

- `invoke()`는 `output_schema`에 맞춰 최종 결과를 필터링한다
- 하지만 `stream_mode="values"`는 기본적으로 전체 누적 state를 흘려준다

즉 private channel이 숨겨지지 않을 수 있다.

```python
for chunk in graph.stream(
    {"user_message": "refund please"},
    stream_mode="values",
):
    print(chunk)
```

이런 식이면 중간에 private key가 그대로 나올 수 있다.

```python
{"user_message": "refund please"}
{"user_message": "refund please", "normalized_message": "refund please"}
{"user_message": "refund please", "normalized_message": "refund please", "escalation_reason": "billing-sensitive"}
{"user_message": "refund please", "normalized_message": "refund please", "escalation_reason": "billing-sensitive", "answer": "..."}
```

그래서 스트리밍을 외부 사용자에게 직접 전달할 때는 `output_keys`를 같이 거는 편이 안전하다.

```python
for chunk in graph.stream(
    {"user_message": "refund please"},
    stream_mode="values",
    output_keys=["answer"],
):
    print(chunk)
```

또는 전체 누적 state 대신 "이번 step에서 실제로 갱신된 값만" 보고 싶으면 `stream_mode="updates"`를 쓰는 편이 낫다.

## 실전 패턴: public API와 내부 운영 상태를 같이 가져가기

아래 구조가 운영에서 가장 무난하다.

```python
class InputState(TypedDict):
    messages: list[str]


class OutputState(TypedDict):
    final_answer: str


class OverallState(InputState, OutputState):
    retrieved_docs: list[str]
    query_rewrite: str
    selected_route: str


class PrivateState(TypedDict):
    guardrail_label: str
    escalation_ticket_id: str
```

역할을 나누면 보통 이렇게 된다.

- `InputState`: 외부 요청 계약
- `OutputState`: 제품 응답 계약
- `OverallState`: 여러 노드가 재사용하는 공용 작업 메모리
- `PrivateState`: 일부 노드끼리만 주고받는 내부 메모

이렇게 분리해 두면 나중에:

- UI 응답
- 내부 디버깅
- LangSmith trace 분석
- 노드별 테스트

를 서로 덜 엮고 관리할 수 있다.

## 자주 하는 실수

### 1. `output_schema`를 두면 스트림도 자동으로 가려질 거라고 생각한다

그렇지 않다.  
공식 문서 기준으로 `values` 스트림은 전체 state channel을 기본값으로 흘릴 수 있다.

외부 스트리밍이면 아래 둘 중 하나를 반드시 생각해야 한다.

- `output_keys=[...]`
- `stream_mode="updates"`

## 2. private channel을 "보안 기능"처럼 오해한다

private state는 그래프 구조를 정리하는 도구지, 강력한 비밀 보관 장치가 아니다.  
stream 설정이나 로깅 방식에 따라 보일 수 있으므로 민감정보는 별도 redaction이나 logging policy가 필요하다.

## 3. 모든 중간 값을 private state로만 밀어 넣는다

여러 노드가 반복해서 읽는 핵심 작업 상태라면 `OverallState` 쪽이 더 자연스럽다.  
private state는 "일부 단계 사이의 좁은 전달"에 더 잘 맞는다.

## 4. 노드 입력 타입을 너무 넓게 둔다

모든 노드 인자를 무조건 `OverallState`로 두면 어떤 키를 실제로 읽는지 코드에서 잘 안 보인다.  
읽는 키가 적다면 더 좁은 schema를 함수 인자로 선언하는 편이 유지보수에 좋다.

## 5. public output 계약이 계속 흔들린다

state 하나만 쓰기 시작하면 내부 키가 그대로 API 응답 shape까지 끌려 나오기 쉽다.  
외부 계약이 있는 graph라면 초기에 `output_schema`부터 고정하는 편이 낫다.

## 추천 기준

개인적으로는 아래 기준이면 대부분 충분하다.

1. 외부 요청 계약이 명확하면 `input_schema`를 둔다
2. 최종 응답 계약이 명확하면 `output_schema`를 둔다
3. 여러 노드가 함께 쓰는 작업 메모리는 `OverallState`
4. 일부 노드끼리만 쓰는 중간 판단은 private state
5. 외부 스트리밍이면 `values` 노출 범위를 먼저 확인한다

## 마무리

LangGraph에서 schema 분리는 단순한 타입 정리 이상의 의미가 있다.

- 무엇을 입력으로 받는지
- 무엇을 내부에서만 쓰는지
- 무엇을 최종적으로 밖에 내보내는지

이 세 경계를 먼저 나누면 그래프가 커져도 state가 덜 오염된다.

특히 `output_schema`와 private state를 도입해 놓고도 `stream(values)` 기본 동작을 놓치면 운영에서 의도치 않은 정보 노출이 생길 수 있다.  
그래서 이 주제는 문법보다 "경계 설계" 관점으로 이해하는 편이 실전적이다.

## 참고 자료

- [LangGraph Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [Use the graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [Thinking in LangGraph](https://docs.langchain.com/oss/python/langgraph/thinking-in-langgraph)
