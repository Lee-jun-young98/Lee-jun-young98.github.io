---
title: "LangGraph subgraph에서 Command.PARENT로 부모 그래프로 handoff하기"
description: "LangGraph subgraph를 wrapper로 호출할지 직접 node로 붙일지 구분하고, Command.PARENT로 부모 그래프의 다음 단계로 넘기는 실전 패턴 정리"
date: 2026-06-05
tags:
  - langgraph
  - agent
  - workflow
  - python
aliases:
  - "/blog/langgraph-subgraph-parent-handoff"
---

# LangGraph subgraph에서 Command.PARENT로 부모 그래프로 handoff하기

LangGraph를 조금 깊게 쓰기 시작하면 한 그래프 안에 모든 노드를 다 넣기보다, 역할별 흐름을 subgraph로 쪼개고 싶어질 때가 많다.

예를 들어 이런 경우다.

- 분류 담당 agent와 실행 담당 agent를 분리하고 싶다
- 팀별로 그래프를 따로 개발하되 부모 graph에서 조합하고 싶다
- 특정 단계만 재사용 가능한 workflow로 묶고 싶다

이때 많이 헷갈리는 지점이 두 가지다.

- subgraph를 "노드 함수 안에서 `invoke()`"해야 하는가
- 아니면 "컴파일된 subgraph를 `add_node()`로 직접 붙여도" 되는가

공식 문서 기준으로 답은 state schema가 공유되는지에 따라 갈린다.  
그리고 subgraph 안에서 부모 graph의 다른 노드로 바로 넘기고 싶다면 `Command(graph=Command.PARENT, goto=...)`를 사용한다.

이 글에서는 다음만 실전 기준으로 빠르게 정리한다.

- wrapper 호출과 직접 연결을 어떻게 구분할지
- `Command.PARENT`가 필요한 상황
- 바로 실행 가능한 Python 예제
- 실무에서 자주 틀리는 포인트

## 언제 이 패턴이 필요한가

아래 조건이 같이 나오면 subgraph + `Command.PARENT` 조합을 먼저 떠올리면 된다.

- 어떤 단계를 독립된 workflow나 agent로 재사용하고 싶다
- 그 단계 안에서 판단한 결과에 따라 부모 graph의 다른 노드로 넘기고 싶다
- 단순 함수 호출이 아니라 LangGraph 상태 추적, streaming, persistence를 그대로 유지하고 싶다

대표적인 예시는 이런 것들이다.

- triage subgraph가 요청을 분류한 뒤 `research` 또는 `answer` 단계로 handoff
- approval subgraph가 검토를 마친 뒤 부모 graph의 `publish` 단계로 복귀
- 역할별 multi-agent subgraph가 작업을 끝낸 뒤 supervisor graph의 다음 단계로 이동

## 사전 준비

Python 3.10+ 환경에서 아래 정도면 예제를 바로 실행할 수 있다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langgraph
```

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langgraph
```

## 1. 먼저 결정할 것: wrapper 호출 vs subgraph 직접 연결

공식 subgraph 문서 기준으로 선택 기준은 단순하다.

- 부모 graph와 subgraph가 state key를 공유하지 않거나, 입력/출력 변환이 필요하다
  - subgraph를 노드 함수 안에서 `invoke()`한다
- 부모 graph와 subgraph가 같은 state key를 공유한다
  - 컴파일된 subgraph를 `add_node()`에 직접 넣는다

짧게 보면 이런 차이다.

```python
from typing_extensions import TypedDict

from langgraph.graph import START, StateGraph


class ParentState(TypedDict):
    user_request: str


class ChildState(TypedDict):
    task: str


def child_step(state: ChildState):
    return {"task": state["task"].upper()}


child = StateGraph(ChildState)
child.add_node("child_step", child_step)
child.add_edge(START, "child_step")
child_graph = child.compile()


def call_child(state: ParentState):
    child_result = child_graph.invoke({"task": state["user_request"]})
    return {"user_request": child_result["task"]}
```

위 패턴은 parent와 child schema가 다를 때 적합하다.  
반대로 같은 key를 읽고 쓰는 흐름이면 wrapper보다 subgraph를 직접 node로 붙이는 쪽이 더 자연스럽다.

## 2. `Command.PARENT`로 부모 graph의 다음 노드로 넘기기

아래 예제는 triage subgraph가 요청을 읽고, 부모 graph의 `research` 또는 `answer` 노드로 직접 handoff하는 구조다.

핵심은 세 가지다.

- subgraph node가 `Command(...)`를 반환한다
- 부모 graph로 나가려면 `graph=Command.PARENT`를 지정한다
- subgraph와 parent가 공유하는 `handoff_logs`는 부모 state에 reducer를 둔다

```python
from typing import Annotated, Literal
import operator
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.types import Command


class ParentState(TypedDict):
    task: str
    handoff_logs: Annotated[list[str], operator.add]
    result: str


class TriageState(TypedDict):
    task: str
    handoff_logs: Annotated[list[str], operator.add]


def triage(state: TriageState) -> Command[Literal["research", "answer"]]:
    task = state["task"].lower()

    if "조사" in task or "비교" in task:
        return Command(
            update={"handoff_logs": ["triage -> research"]},
            goto="research",
            graph=Command.PARENT,
        )

    return Command(
        update={"handoff_logs": ["triage -> answer"]},
        goto="answer",
        graph=Command.PARENT,
    )


def research(state: ParentState):
    return {
        "result": f"리서치 단계 실행: {state['task']}",
        "handoff_logs": ["research completed"],
    }


def answer(state: ParentState):
    return {
        "result": f"즉답 단계 실행: {state['task']}",
        "handoff_logs": ["answer completed"],
    }


triage_builder = StateGraph(TriageState)
triage_builder.add_node("triage", triage)
triage_builder.add_edge(START, "triage")
triage_graph = triage_builder.compile()

parent_builder = StateGraph(ParentState)
parent_builder.add_node("triage_subgraph", triage_graph)
parent_builder.add_node("research", research)
parent_builder.add_node("answer", answer)
parent_builder.add_edge(START, "triage_subgraph")
parent_builder.add_edge("research", END)
parent_builder.add_edge("answer", END)

graph = parent_builder.compile()

result = graph.invoke(
    {
        "task": "LangGraph와 CrewAI 차이를 조사해 줘",
        "handoff_logs": [],
        "result": "",
    }
)

print(result)
```

예상 출력 예시는 아래와 비슷하다.

```python
{
    "task": "LangGraph와 CrewAI 차이를 조사해 줘",
    "handoff_logs": ["triage -> research", "research completed"],
    "result": "리서치 단계 실행: LangGraph와 CrewAI 차이를 조사해 줘",
}
```

이 예제에서 중요한 점은 `triage_subgraph`에서 부모 graph의 `research`로 바로 이동한다는 것이다.  
즉 subgraph를 "하나의 큰 노드"처럼 쓰되, 내부 판단 결과는 부모 graph의 제어 흐름으로 다시 올릴 수 있다.

## 3. persistence와 디버깅에서 알아둘 점

subgraph를 직접 node로 붙이면 기본적으로 부모 graph의 checkpointer를 상속한다.  
즉 parent compile 시 checkpointer를 붙이면 subgraph도 같은 thread 문맥 안에서 함께 상태를 저장한다.

또한 공식 문서 기준으로 subgraph 상태 확인은 `get_state(config, subgraphs=True)`로 볼 수 있다.

```python
from langgraph.checkpoint.memory import InMemorySaver

checkpointer = InMemorySaver()
graph = parent_builder.compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": "demo-thread"}}
graph.invoke(
    {
        "task": "LangGraph 공식 문서 핵심만 정리해 줘",
        "handoff_logs": [],
        "result": "",
    },
    config,
)

snapshot = graph.get_state(config, subgraphs=True)
print(snapshot.tasks[0].state)
```

사람 승인처럼 `interrupt()`가 subgraph 안에 들어가도 같은 원리로 parent의 checkpointer를 활용할 수 있다.

## 4. 실무에서 자주 하는 실수

### 4-1. `Command`와 static edge를 같이 써서 의도치 않게 두 경로가 모두 실행된다

공식 Graph API 문서 기준으로 어떤 노드가 `Command(goto=...)`를 반환해도, 그 노드에 걸어 둔 static edge는 그대로 실행된다.

즉 아래처럼 섞으면 안 된다.

```python
parent_builder.add_edge("triage_subgraph", "research")
```

이미 subgraph 내부에서 `Command.PARENT`로 다음 노드를 고를 거라면, `triage_subgraph`에서 나가는 parent static edge는 두지 않는 편이 안전하다.

### 4-2. shared key를 업데이트하면서 reducer를 빼먹는다

공식 문서에서 `Command.PARENT` 예제를 설명할 때도, subgraph와 parent가 공유하는 key를 parent 쪽으로 업데이트하면 reducer를 정의하라고 명시한다.

위 예제에서 `handoff_logs`를 그냥 `list[str]`로 두면 병합 방식이 애매해진다.  
로그, 메시지 목록, 누적 결과처럼 "합쳐야 하는 값"은 `Annotated[..., operator.add]` 같은 reducer를 먼저 설계하는 편이 낫다.

### 4-3. schema가 다른데도 subgraph를 직접 `add_node()`로 붙이려 한다

parent state와 child state가 다르면 wrapper 노드 안에서 `subgraph.invoke(...)`로 입력/출력을 변환하는 편이 맞다.  
억지로 shared schema처럼 맞추기 시작하면 parent state가 subgraph 내부 구현 세부사항에 오염된다.

### 4-4. subgraph 내부 상태를 parent가 전부 자동으로 볼 거라고 기대한다

parent와 child가 key를 공유하지 않는 wrapper 패턴에서는 child 내부 key가 parent state로 자동 노출되지 않는다.  
필요한 값만 wrapper가 골라서 parent state로 다시 매핑해야 한다.

## 5. 언제 이 구조가 특히 잘 맞는가

이 패턴은 아래 같은 구조에서 특히 깔끔하다.

- supervisor graph 아래에 specialist subgraph를 붙이는 multi-agent 구성
- triage, approval, planning 단계를 재사용 가능한 subgraph로 빼는 workflow
- 팀별로 각 subgraph를 독립 개발하고 parent graph가 handoff만 담당하는 구조

반대로 단일 단계 분기만 있으면 굳이 subgraph까지 만들 필요는 없다.  
그 경우에는 기존 글에서 다룬 `Command` 또는 `add_conditional_edges(...)`가 더 단순하다.

## 마무리

LangGraph의 subgraph는 단순한 코드 분할 도구가 아니라, 상태 추적과 실행 흐름을 유지한 채 workflow를 계층화하는 방법이다.

- state schema가 다르면 wrapper + `invoke()`
- state schema를 공유하면 compiled subgraph를 `add_node()`
- subgraph에서 부모 graph의 다음 단계로 넘기려면 `Command.PARENT`

이 세 가지만 정확히 구분해도 multi-agent나 큰 workflow를 훨씬 덜 꼬이게 설계할 수 있다.

## 참고 자료

- [LangGraph Subgraphs](https://docs.langchain.com/oss/python/langgraph/use-subgraphs)
- [LangGraph Graph API Overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph Use the Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api)
- [LangGraph `Command.PARENT` Reference](https://reference.langchain.com/python/langgraph/types/Command/PARENT)
