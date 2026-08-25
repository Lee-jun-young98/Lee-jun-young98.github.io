---
title: LangGraph EphemeralValue로 한 step짜리 신호 전달하기
description: Pregel의 EphemeralValue 채널로 바로 다음 super-step에만 값이 보이는 일회성 트리거와 중간 신호를 설계하는 방법
date: 2026-08-25
tags:
  - langgraph
  - pregel
  - python
  - channels
  - workflow
aliases:
  - /blog/langgraph-ephemeral-value-step-signals
---

# LangGraph EphemeralValue로 한 step짜리 신호 전달하기

저수준 Pregel API에서는 actor 사이의 중간 신호를 checkpoint나 최종 결과에 계속 남길 필요가 없는 경우가 있습니다. `EphemeralValue`는 **직전 super-step에서 받은 값을 현재 step에만 제공하고, 새 write가 없으면 다음 update 단계에서 비우는 채널**입니다.

```python
EphemeralValue(str)  # 기본값 guard=True
```

입력, 노드 실행 트리거, 짧은 중간 payload처럼 “다음 actor를 깨우고 나면 사라져도 되는 값”에 잘 맞습니다. 반대로 업무 상태나 실행 이력을 보존하는 채널로 쓰면 안 됩니다.

## 사전 준비

Python 3.10 이상과 LangGraph를 설치합니다. 아래 예제는 LLM과 API key 없이 실행할 수 있습니다.

```bash
pip install -U langgraph
```

## 실행 가능한 예제

`prepare` actor가 입력을 정규화해 `job` 채널에 쓰고, `process` actor가 바로 다음 step에서 그 값을 소비해 지속할 결과만 `result`에 쓰는 예제입니다.

```python
from langgraph.channels import EphemeralValue, LastValue
from langgraph.pregel import NodeBuilder, Pregel


prepare = (
    NodeBuilder()
    .subscribe_only("input")
    .do(lambda value: value.strip().lower())
    .write_to("job")
)

process = (
    NodeBuilder()
    .subscribe_only("job")
    .do(lambda value: f"indexed:{value}")
    .write_to("result")
)

app = Pregel(
    nodes={"prepare": prepare, "process": process},
    channels={
        "input": EphemeralValue(str),
        "job": EphemeralValue(str),
        "result": LastValue(str),
    },
    input_channels=["input"],
    output_channels=["job", "result"],
)

print(app.invoke({"input": "  DOC-7  "}))
```

출력에는 지속 채널인 `result`만 남습니다.

```text
{'result': 'indexed:doc-7'}
```

실행 흐름은 다음과 같습니다.

1. 입력이 `input`에 기록되고 `prepare`가 실행됩니다.
2. `prepare`가 `job`에 쓴 값은 다음 super-step의 `process`에서 보입니다.
3. `process`가 실행되는 동안 `job`에 새 write가 없으므로 그 step의 update 단계에서 `job`이 비워집니다.
4. `result`는 `LastValue`라서 최종 출력에 유지됩니다.

Pregel은 한 step에서 actor 실행이 끝날 때까지 그 step의 write를 다른 actor에게 보이지 않습니다. 따라서 `EphemeralValue`도 함수 호출 중 즉시 전달되는 변수가 아니라 **super-step 경계를 한 번 건너는 채널**입니다.

## guard가 막아 주는 병렬 덮어쓰기

기본 `guard=True`인 `EphemeralValue`는 같은 step에서 update를 두 개 이상 받으면 `InvalidUpdateError`를 냅니다.

```python
signal = EphemeralValue(str)  # guard=True
```

이는 병렬 actor 둘이 같은 단일 값 채널을 우연히 덮어쓰는 설계 오류를 빨리 드러냅니다. 여러 producer의 값을 모두 보존해야 한다면 `guard=False`로 오류만 숨기지 말고 `Topic` 같은 다중 값 채널을 사용합니다.

```python
from langgraph.channels import Topic

events = Topic(str, accumulate=False)
```

`EphemeralValue(str, guard=False)`도 가능하지만, 같은 step의 여러 update 중 하나만 남고 update 순서는 안정적인 업무 순서가 아닙니다. 어떤 값이 선택되어도 상관없는 특별한 경우가 아니면 피하는 편이 안전합니다.

## 언제 사용하면 좋은가

- 한 actor가 다음 actor를 깨우는 일회성 트리거
- 정규화된 입력처럼 한 단계만 건너면 되는 중간 payload
- cycle에서 다음 반복을 예약하되 이전 반복의 값을 남기지 않는 신호
- Pregel actor와 channel을 직접 구성할 때의 입력 채널

사용자 승인, 주문 상태, 누적 메시지, 감사 로그처럼 재개·조회·복구 때 다시 필요할 값은 `LastValue`, `Topic`, `BinaryOperatorAggregate` 또는 StateGraph reducer에 둡니다.

## checkpoint에서의 의미

`EphemeralValue`도 현재 사용할 수 있는 값은 channel checkpoint에 포함될 수 있습니다. 그러나 “영구 저장하지 않는다”는 보안 기능이 아니라, **write가 없는 다음 step에서 자동으로 비워지는 수명 규칙**입니다.

민감한 payload가 절대 checkpoint에 기록되면 안 된다면 `EphemeralValue`만 믿지 말고 serializer, 암호화, state 경계와 외부 secret 저장소를 함께 설계해야 합니다. 장애가 step 경계에서 발생했을 때 정확히 어떤 값이 checkpoint에 남는지도 사용하는 checkpointer로 검증합니다.

## 자주 놓치는 함정

- `EphemeralValue`를 함수 내부 지역 변수처럼 즉시 전달된다고 생각합니다. write는 다음 super-step에서 보입니다.
- 최종 출력이나 다음 invocation에서도 값이 남을 것으로 기대합니다. 지속해야 하는 결과는 별도의 persistent channel에 씁니다.
- `guard=False`로 병렬 write 충돌을 해결합니다. 모든 값이 중요하면 `Topic`이나 reducer가 맞습니다.
- “ephemeral”이라는 이름만 보고 민감정보가 checkpoint에 전혀 기록되지 않는다고 가정합니다. 채널의 step 수명과 저장 보안은 별개입니다.
- 일반적인 StateGraph workflow에서도 저수준 channel을 직접 구성합니다. 단순한 업무 state라면 `StateGraph` field와 reducer가 더 읽기 쉽습니다.
- `output_channels`에 transient 채널만 지정하고 실행 종료 시 빈 결과를 받습니다. 호출자에게 돌려줄 값은 `LastValue` 같은 지속 채널에 기록합니다.

## 정리

`EphemeralValue`는 직전 super-step의 값을 현재 step에 전달한 뒤, 새 write가 없으면 자동으로 비웁니다. 일회성 트리거와 짧은 중간 payload에는 적합하지만, 복구나 다음 호출에 필요한 업무 상태에는 적합하지 않습니다. 기본 `guard=True`를 유지해 병렬 덮어쓰기를 조기에 발견하고, 여러 write가 필요하면 `Topic`이나 reducer로 의도를 명시하는 것이 핵심입니다.

## 참고 자료

- [LangGraph Pregel과 채널 가이드](https://docs.langchain.com/oss/python/langgraph/pregel)
- [EphemeralValue API reference](https://reference.langchain.com/python/langgraph/channels/ephemeral_value)
- [LangGraph channels API reference](https://reference.langchain.com/python/langgraph/channels)
