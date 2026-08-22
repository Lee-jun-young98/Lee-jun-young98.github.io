---
title: LangGraph Topic 채널로 여러 actor의 값을 모으기
description: Pregel의 Topic 채널로 한 super-step의 여러 write를 모으고 accumulate 옵션으로 실행 전체 누적 여부를 제어하는 방법
date: 2026-08-22
tags:
  - langgraph
  - pregel
  - python
  - channels
  - pubsub
aliases:
  - /blog/langgraph-topic-channel-pubsub-accumulation
---

# LangGraph Topic 채널로 여러 actor의 값을 모으기

저수준 Pregel API로 workflow를 만들 때 여러 actor가 같은 채널에 값을 쓸 수 있습니다. 기본 `LastValue` 채널은 step마다 write를 하나만 받지만, `Topic`은 같은 step의 여러 write를 **목록으로 모으는 PubSub 채널**입니다.

```python
Topic(str, accumulate=False)  # 현재 step의 값만 유지
Topic(str, accumulate=True)   # 실행 중 기록된 값을 계속 누적
```

`accumulate` 선택이 핵심입니다. `False`이면 새 super-step이 진행될 때 이전 값이 비워지고, `True`이면 실행 전체의 이벤트 기록처럼 계속 쌓입니다.

## 사전 준비

Python 3.10 이상과 LangGraph를 설치합니다. 아래 예제는 LLM이나 API key 없이 실행할 수 있습니다.

```bash
pip install -U langgraph
```

## 실행 가능한 예제

첫 actor가 문서를 정규화해 다음 actor로 넘기면서 이벤트를 기록하고, 두 번째 actor도 완료 이벤트를 같은 `events` 채널에 쓰는 예제입니다.

```python
from langgraph.channels import EphemeralValue, Topic
from langgraph.pregel import NodeBuilder, Pregel


def build_workflow(*, accumulate: bool):
    normalize = (
        NodeBuilder()
        .subscribe_only("input")
        .do(lambda value: f"normalized:{value}")
        .write_to("next", "events")
    )

    index = (
        NodeBuilder()
        .subscribe_only("next")
        .do(lambda value: f"indexed:{value}")
        .write_to("events")
    )

    return Pregel(
        nodes={"normalize": normalize, "index": index},
        channels={
            "input": EphemeralValue(str),
            "next": EphemeralValue(str),
            "events": Topic(str, accumulate=accumulate),
        },
        input_channels=["input"],
        output_channels=["events"],
    )


latest_step = build_workflow(accumulate=False)
full_history = build_workflow(accumulate=True)

print(latest_step.invoke({"input": "doc-7"}))
print(full_history.invoke({"input": "doc-7"}))
```

출력은 다음과 같습니다.

```text
{'events': ['indexed:normalized:doc-7']}
{'events': ['normalized:doc-7', 'indexed:normalized:doc-7']}
```

첫 번째 write와 두 번째 write는 서로 다른 super-step에서 발생합니다. 그래서 `accumulate=False`인 결과에는 마지막 step의 값만 남고, `True`인 결과에는 두 step의 값이 모두 남습니다.

## 같은 step의 여러 write는 모두 모인다

`accumulate=False`는 “write 하나만 저장한다”는 뜻이 아닙니다. 같은 super-step에서 여러 actor가 `events`에 쓴 값은 모두 한 목록으로 합쳐집니다. 차이는 **다음 step으로 넘어갈 때 이전 목록을 유지하는지**입니다.

이 특성은 fan-out 작업의 결과를 한 번에 소비하는 데 유용합니다. 다만 병렬 task의 완료 순서를 목록의 업무 순서로 간주해서는 안 됩니다. 순서가 중요하면 각 값에 안정적인 ID나 정렬 key를 넣고 소비자가 명시적으로 정렬합니다.

## 어떤 채널을 고를까

- 한 step에서 여러 생산자의 값을 모두 받아야 하면 `Topic`을 사용합니다.
- 값이 실행 전체에서 계속 누적되어야 하면 `Topic(..., accumulate=True)`를 사용합니다.
- 매 step 하나의 최신 값만 필요하면 기본 `LastValue`가 더 단순합니다.
- 현재 값과 update를 연산자로 합쳐 running total을 만들려면 `BinaryOperatorAggregate`가 맞습니다.
- StateGraph에서 list field를 합치는 일반적인 경우라면 `Annotated[..., reducer]`가 더 읽기 쉽습니다. `Topic`은 actor와 channel을 직접 구성하는 Pregel API에서 특히 유용합니다.

## 체크포인트와 메모리 경계

`Topic` 값은 graph channel state이므로 checkpointer를 붙이면 checkpoint 대상이 됩니다. `accumulate=True`를 이벤트 로그처럼 사용하면 thread가 길어질수록 checkpoint payload도 커질 수 있습니다.

감사 로그처럼 장기간 보관해야 하는 데이터라면 channel에 무한히 누적하기보다 외부 저장소로 내보내고, graph에는 cursor나 요약만 남기는 편이 안전합니다. 반대로 한 step의 batch만 전달하려면 기본값인 `accumulate=False`가 메모리와 checkpoint 크기를 제한하는 데 유리합니다.

## 자주 놓치는 함정

- `accumulate=False`를 단일 값 채널로 오해합니다. 같은 step의 여러 write는 여전히 list로 모입니다.
- `accumulate=True`로 사용자 입력이나 tool payload를 끝없이 쌓습니다. 장기 thread에서는 checkpoint 크기와 민감정보 보존 범위를 함께 검토합니다.
- 병렬 write의 목록 순서에 의존합니다. producer ID와 정렬 key를 값에 포함합니다.
- `Topic(str)`에 list를 쓰면 list 원소가 개별 update로 펼쳐진다는 점을 놓칩니다. list 자체를 한 항목으로 저장해야 한다면 값 타입과 payload 구조를 별도 객체로 설계합니다.
- StateGraph의 일반적인 state reducer 문제까지 모두 `Topic`으로 해결하려 합니다. 높은 수준의 StateGraph에서는 field reducer가 의도를 더 분명하게 드러냅니다.
- channel을 출력에 넣지 않고 최종 결과에서 보일 것으로 기대합니다. 필요한 채널 이름을 `output_channels`에 명시합니다.

## 정리

`Topic`은 Pregel actor들이 같은 채널에 쓴 여러 값을 list로 모읍니다. `accumulate=False`는 현재 super-step의 batch만 전달하고, `True`는 실행 전체의 write를 누적합니다. 병렬 결과 전달에는 기본 모드를, 짧고 제한된 실행의 이벤트 이력에는 누적 모드를 사용하되, 순서와 checkpoint 증가를 명시적으로 관리하는 것이 핵심입니다.

## 참고 자료

- [LangGraph Pregel과 채널 가이드](https://docs.langchain.com/oss/python/langgraph/pregel)
- [Topic API reference](https://reference.langchain.com/python/langgraph/channels/Topic)
- [LangGraph channels API reference](https://reference.langchain.com/python/langgraph/channels)
