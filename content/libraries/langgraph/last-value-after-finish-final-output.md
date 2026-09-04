---
title: LangGraph LastValueAfterFinish로 종료 시점에 최종값만 공개하기
description: Pregel의 LastValueAfterFinish 채널로 실행 중 중간 후보값은 숨기고 run이 끝난 뒤 마지막 값만 출력하는 방법
date: 2026-09-04
tags:
  - langgraph
  - pregel
  - python
  - channels
  - workflow
aliases:
  - /blog/langgraph-last-value-after-finish-final-output
---

# LangGraph LastValueAfterFinish로 종료 시점에 최종값만 공개하기

저수준 Pregel workflow에서 여러 actor가 같은 결과를 순서대로 다듬더라도 호출자에게는 **실행이 모두 끝난 뒤 최종값 하나만** 보여 주고 싶을 때가 있습니다. `LastValueAfterFinish`는 write를 받을 때마다 마지막 값을 보관하지만, Pregel이 채널의 `finish()`를 호출하기 전에는 그 값을 읽을 수 없게 합니다.

```python
LastValueAfterFinish(str)
```

일반 `LastValue`가 다음 super-step부터 값을 공개하는 것과 달리, 이 채널은 run 종료 전까지 사용할 수 없습니다. 따라서 최종 응답, 확정된 보고서, 여러 단계에서 보정되는 계산 결과처럼 중간 후보를 후속 actor의 입력이나 `values` 스트림으로 노출하고 싶지 않을 때 적합합니다.

## 사전 준비

Python 3.10 이상과 LangGraph를 설치합니다. 아래 예제는 LLM과 API key 없이 실행할 수 있습니다.

```bash
pip install -U langgraph
```

## 실행 가능한 예제

첫 actor가 초안을 만들고 두 번째 actor가 이를 수정합니다. `draft`는 다음 actor를 깨우는 `EphemeralValue`, `answer`는 종료 시에만 공개되는 `LastValueAfterFinish`입니다.

```python
from langgraph.channels import EphemeralValue, LastValueAfterFinish
from langgraph.pregel import NodeBuilder, Pregel


first = (
    NodeBuilder()
    .subscribe_only("input")
    .do(lambda value: f"draft:{value}")
    .write_to("draft", "answer")
)

revise = (
    NodeBuilder()
    .subscribe_only("draft")
    .do(lambda value: value.replace("draft:", "final:"))
    .write_to("answer")
)

app = Pregel(
    nodes={"first": first, "revise": revise},
    channels={
        "input": EphemeralValue(str),
        "draft": EphemeralValue(str),
        "answer": LastValueAfterFinish(str),
    },
    input_channels=["input"],
    output_channels=["answer"],
)

print(app.invoke({"input": "report"}))
```

출력은 첫 actor의 `draft:report`가 아니라 마지막 write입니다.

```text
{'answer': 'final:report'}
```

`answer`에 초안이 먼저 기록되어도 `revise`는 이 채널을 구독하지 않습니다. `draft` 채널이 별도로 다음 actor를 실행시키며, 모든 actor가 끝난 다음 Pregel이 `answer.finish()`를 호출해야 최종값을 읽을 수 있습니다.

## values와 updates 스트림의 차이

종료 전 값을 숨기는 규칙은 채널의 현재 값을 읽는 `values` 스트림에도 적용됩니다.

```python
print(list(app.stream({"input": "report"}, stream_mode="values")))
```

```text
[{'draft': 'draft:report'}, {'answer': 'final:report'}]
```

반면 `updates`는 노드가 낸 update 자체를 관찰하는 디버깅 스트림입니다. 따라서 중간 write도 보입니다.

```python
print(list(app.stream({"input": "report"}, stream_mode="updates")))
```

```text
[
    {'first': {'draft': 'draft:report', 'answer': 'draft:report'}},
    {'revise': {'answer': 'final:report'}}
]
```

즉 `LastValueAfterFinish`는 모든 telemetry에서 중간값을 가리는 보안 필터가 아닙니다. trace, `updates`·`debug` 스트림, node logging에는 write가 남을 수 있으므로 민감정보를 숨기는 용도로만 의존하면 안 됩니다.

## LastValue와 무엇이 다른가

| 채널                   | 값이 보이는 시점                  | 같은 step의 여러 write |
| ---------------------- | --------------------------------- | ---------------------- |
| `LastValue`            | write가 반영된 다음 super-step    | 오류                   |
| `LastValueAfterFinish` | run이 끝나 `finish()`가 호출된 뒤 | 마지막 값 사용         |

`LastValueAfterFinish.update()`는 전달된 update 묶음의 마지막 값을 택합니다. 병렬 producer가 같은 step에 write하더라도 충돌 오류를 내지 않지만, 병렬 실행 순서를 업무 우선순위로 해석해서는 안 됩니다. 어떤 결과를 선택해야 하는지가 중요하다면 각 결과를 `Topic`에 모으고 명시적인 reducer actor가 하나의 최종값을 결정하게 합니다.

## 언제 사용하면 좋은가

- 여러 단계가 초안이나 후보를 순차적으로 교체하고 마지막 결과만 반환할 때
- 중간 write가 후속 actor를 실수로 깨우지 않도록 출력 전용 채널을 둘 때
- Pregel을 직접 구성하면서 공개 결과와 내부 전달 채널을 분리할 때
- run 전체가 성공한 뒤에만 caller-facing 결과를 읽게 할 때

일반적인 `StateGraph` workflow에서는 output schema와 내부 state field를 분리하는 편이 더 읽기 쉽습니다. `LastValueAfterFinish`는 `NodeBuilder`, `Pregel`, channel lifecycle을 직접 제어하는 저수준 구성에 특히 유용합니다.

## 자주 놓치는 함정

- `answer`를 다른 actor의 입력 채널로 구독합니다. 종료 전에는 사용할 수 없으므로 actor를 깨우지 못합니다. 내부 전달에는 별도 채널을 둡니다.
- 중간 write가 `updates` 스트림이나 trace에서도 사라진다고 생각합니다. 이 채널은 최종 channel value의 가용 시점만 제어합니다.
- 병렬 write 중 “마지막”이 업무적으로 항상 결정적이라고 가정합니다. 우선순위가 필요하면 명시적으로 집계합니다.
- 중간 결과까지 `output_channels`에 함께 넣고 최종값만 반환된다고 기대합니다. 다른 출력 채널은 각자의 수명 규칙대로 공개됩니다.
- checkpoint가 붙은 장기 실행에서 저장된 내부 값과 공개 출력이 같다고 가정합니다. 사용하는 checkpointer와 stream mode로 장애·재개 경계를 직접 검증합니다.
- 고수준 StateGraph에서도 무조건 저수준 Pregel channel을 사용합니다. 단순한 공개/비공개 state 경계라면 input/output schema가 더 적절할 수 있습니다.

## 정리

`LastValueAfterFinish`는 여러 write 중 마지막 값을 저장하되 run이 끝날 때까지 읽을 수 없게 합니다. actor 사이 전달은 별도 채널로 설계하고, 이 채널은 최종 출력 전용으로 두는 것이 핵심입니다. 또한 `updates`와 trace에는 중간 write가 보일 수 있으므로 결과 공개 시점 제어와 보안상 비밀 유지는 별개의 문제로 다뤄야 합니다.

## 참고 자료

- [LangGraph Pregel과 채널 가이드](https://docs.langchain.com/oss/python/langgraph/pregel)
- [LastValueAfterFinish API reference](https://reference.langchain.com/python/langgraph/channels/last_value/LastValueAfterFinish)
- [LangGraph channels API reference](https://reference.langchain.com/python/langgraph/channels)
