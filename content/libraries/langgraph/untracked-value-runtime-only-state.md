---
title: LangGraph UntrackedValue로 실행 전용 state를 checkpoint에서 제외하기
description: UntrackedValue 채널로 client와 session 같은 실행 전용 값을 노드 사이에 전달하되 checkpoint에는 저장하지 않는 방법과 재개 경계
date: 2026-08-31
tags:
  - langgraph
  - pregel
  - python
  - channels
  - persistence
aliases:
  - /blog/langgraph-untracked-value-runtime-only-state
---

# LangGraph UntrackedValue로 실행 전용 state를 checkpoint에서 제외하기

그래프 안에서 만든 API client, DB session, lock처럼 **현재 프로세스에서만 유효한 객체**를 다음 노드에 넘기고 싶을 때가 있습니다. 이런 값을 일반 state field에 넣으면 checkpointer가 직렬화를 시도하거나, 의도하지 않은 객체가 checkpoint에 남을 수 있습니다.

`UntrackedValue`는 마지막 값을 일반 채널처럼 읽게 하면서도 checkpoint에는 저장하지 않는 채널입니다.

```python
from typing import Annotated, TypedDict

from langgraph.channels import UntrackedValue


class BillingClient:
    pass


class State(TypedDict, total=False):
    client: Annotated[BillingClient, UntrackedValue(BillingClient)]
    result: str
```

## 사전 준비

Python 3.10 이상과 LangGraph를 설치합니다. 아래 예제는 LLM이나 API key 없이 실행할 수 있습니다.

```bash
pip install -U langgraph
```

## 실행 가능한 예제

첫 노드에서 직렬화할 수 없는 client를 만들고, 두 번째 노드에서 사용합니다. 실행 결과에는 client가 보이지만 checkpoint snapshot에는 `result`만 남는지 확인합니다.

```python
from typing import Annotated, TypedDict

from langgraph.channels import UntrackedValue
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph


class BillingClient:
    def __init__(self, service: str) -> None:
        self.service = service

    def charge(self, order_id: str) -> str:
        return f"{self.service}:{order_id}:charged"


class State(TypedDict, total=False):
    client: Annotated[BillingClient, UntrackedValue(BillingClient)]
    order_id: str
    result: str


def setup_client(state: State) -> dict:
    return {"client": BillingClient("billing")}


def charge_order(state: State) -> dict:
    return {"result": state["client"].charge(state["order_id"])}


builder = StateGraph(State)
builder.add_node("setup_client", setup_client)
builder.add_node("charge_order", charge_order)
builder.add_edge(START, "setup_client")
builder.add_edge("setup_client", "charge_order")
builder.add_edge("charge_order", END)

graph = builder.compile(checkpointer=InMemorySaver())
config = {"configurable": {"thread_id": "order-42"}}

output = graph.invoke({"order_id": "A-42"}, config)
snapshot = graph.get_state(config)

print(output["result"])
print(snapshot.values)

assert output["result"] == "billing:A-42:charged"
assert "client" not in snapshot.values
assert snapshot.values["order_id"] == "A-42"
assert snapshot.values["result"] == "billing:A-42:charged"
```

예상 출력은 다음과 같습니다.

```text
billing:A-42:charged
{'order_id': 'A-42', 'result': 'billing:A-42:charged'}
```

`client`는 같은 실행 안의 다음 super-step에서 읽을 수 있지만, channel의 `checkpoint()`는 저장할 값이 없음을 반환하므로 snapshot에서 빠집니다.

## 입력으로 직접 넣기보다 노드에서 만들기

직렬화할 수 없는 객체를 `graph.invoke({"client": client}, config)`처럼 최초 입력에 직접 넣으면 입력 기록을 저장하는 과정에서 serializer가 그 객체를 먼저 만날 수 있습니다. 실행 전용 객체는 예제처럼 setup 노드에서 만들거나, 요청별 dependency injection이 목적이라면 `context_schema`와 `Runtime`을 사용하는 편이 안전합니다.

- graph state의 node-to-node 전달이 필요하고 checkpoint에서만 빼고 싶으면 `UntrackedValue`
- 요청 전체에서 읽기만 하는 DB pool, 인증 정보, tenant 설정이면 runtime context
- 실행 간 복원이 필요한 값이면 일반 state와 직렬화 가능한 식별자

client 자체 대신 `client_id`, DSN 별칭, tenant ID를 저장하고 재개 시 외부 registry에서 client를 다시 얻는 패턴도 실용적입니다.

## interrupt와 실패 재개를 넘을 수 없다

`UntrackedValue`는 checkpoint에서 복원되지 않습니다. 값을 만든 뒤 `interrupt()`로 멈추거나 프로세스가 종료되고 다음 호출에서 같은 thread를 재개하면, 이후 노드는 그 field가 없다고 가정해야 합니다.

따라서 실행 전용 값에 의존하는 작업 앞에는 값을 다시 만드는 노드를 두거나, 재개 후에도 필요한 최소 식별자는 별도 일반 field에 저장합니다. 특히 동적 `Send` task, 실패 재시도, human-in-the-loop 경계와 함께 쓸 때 원래 task 입력이 동일하게 복원된다고 기대하면 안 됩니다.

## guard로 같은 step의 충돌을 잡는다

기본값 `guard=True`에서는 같은 super-step에 둘 이상의 노드가 한 `UntrackedValue` field에 쓰면 `InvalidUpdateError`가 발생합니다.

```python
client: Annotated[BillingClient, UntrackedValue(BillingClient, guard=True)]
```

`guard=False`는 여러 write 중 임의 순서의 마지막 값을 보관하므로 업무 규칙에 사용하기 어렵습니다. producer가 여러 개라면 하나의 setup 노드로 소유권을 모으거나, 여러 값을 모두 보존하는 `Topic` 또는 명시적 reducer를 선택합니다.

## 보안 기능으로 오해하지 않기

checkpoint 제외는 암호화나 비밀 마스킹이 아닙니다. 같은 실행의 최종 반환값, `values` stream, debug event, callback, LangSmith trace에는 값이 노출될 수 있습니다. 예제의 `output`에도 `client`가 포함됩니다.

민감한 값은 애초에 state에 넣지 않고 runtime context나 외부 secret manager에서 필요한 순간에만 읽는 편이 낫습니다. checkpoint 자체의 기밀성이 필요하면 `EncryptedSerializer` 같은 별도 저장 암호화를 적용합니다.

## 자주 놓치는 함정

- `UntrackedValue`가 반환값과 trace에서도 자동으로 숨겨진다고 생각합니다. 제외 범위는 checkpoint입니다.
- interrupt나 재시작 뒤에도 값이 남아 있다고 가정합니다. 재개 가능한 식별자를 따로 저장해야 합니다.
- 비직렬화 객체를 최초 graph input으로 직접 넣습니다. setup 노드 또는 runtime context를 사용합니다.
- `guard=False`로 병렬 producer 충돌을 덮습니다. 어느 값이 선택될지에 의존하지 않습니다.
- 영속 데이터까지 untracked로 표시합니다. replay와 time travel에 필요한 값은 일반 checkpointed field로 둡니다.
- 실행 간 공유가 필요한 client registry를 graph state로 운영합니다. 프로세스 수준 DI container나 Store와 역할을 분리합니다.

## 정리

`UntrackedValue`는 현재 실행에서만 필요한 객체를 노드 사이에 전달하되 checkpoint 직렬화와 저장에서 제외합니다. 비직렬화 client나 짧은 수명의 session을 다룰 때 유용하지만, interrupt·실패·프로세스 재시작 경계를 넘지 못합니다. 재개가 필요한 workflow에서는 직렬화 가능한 식별자를 저장하고 실행 전용 객체를 다시 구성하는 경계를 함께 설계해야 합니다.

## 참고 자료

- [UntrackedValue API reference](https://reference.langchain.com/python/langgraph/channels/untracked_value/UntrackedValue)
- [LangGraph channels API reference](https://reference.langchain.com/python/langgraph/channels)
- [LangGraph Pregel과 채널 가이드](https://docs.langchain.com/oss/python/langgraph/pregel)
- [LangGraph persistence 가이드](https://docs.langchain.com/oss/python/langgraph/persistence)
