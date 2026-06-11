---
title: "LangGraph stream()으로 updates, messages, custom 이벤트 흘려보내기"
description: 'LangGraph stream()/astream()의 version="v2" 출력 형식과 updates, values, messages, custom, tasks, debug 스트림 모드를 실전 예제로 정리'
date: 2026-06-10
tags:
  - langgraph
  - agent
  - workflow
  - python
aliases:
  - "/blog/langgraph-stream-mode-updates-messages-custom"
---

# LangGraph stream()으로 updates, messages, custom 이벤트 흘려보내기

LangGraph로 agent나 workflow를 붙이다 보면 최종 결과만 받는 `invoke()`로는 부족한 순간이 금방 온다.

- UI에 진행 상황을 바로 보여 주고 싶다
- 어떤 node가 어떤 state를 바꿨는지 보고 싶다
- LLM 토큰을 실시간으로 흘려 보내고 싶다
- checkpoint나 task 이벤트를 디버깅에 쓰고 싶다

이럴 때 쓰는 기본 도구가 `graph.stream()`과 `graph.astream()`이다.

공식 streaming 문서 기준으로 현재 LangGraph는 `updates`, `values`, `messages`, `custom`, `checkpoints`, `tasks`, `debug` 같은 stream mode를 지원한다. 또 새 애플리케이션에는 LangGraph v1.2에서 도입된 event streaming을 먼저 권장하지만, stream-mode API도 여전히 특정 런타임 이벤트를 직접 받고 싶을 때 유용한 하위 레벨 인터페이스로 남아 있다.

이 글에서는 실무에서 바로 써먹기 쉬운 기준만 정리한다.

- `version="v2"`를 왜 먼저 붙여야 하는지
- `updates`와 `values`를 어떻게 구분할지
- `custom`으로 진행률 이벤트를 직접 흘리는 방법
- `messages`로 LLM 토큰을 받는 방법
- `tasks` / `checkpoints` / `debug`를 언제 볼지
- 자주 생기는 함정

## 언제 이 패턴이 좋은가

아래 조건 중 둘 이상이면 거의 바로 고려해도 된다.

- SSE, WebSocket, CLI progress처럼 중간 상태를 사용자에게 보여 줘야 한다
- node별 state 변화와 실제 결과를 분리해서 보고 싶다
- LLM 토큰 스트리밍과 그래프 상태 스트리밍을 같은 실행 안에서 묶고 싶다
- interrupt, checkpoint, retry 같은 런타임 이벤트를 디버깅해야 한다

반대로 최종 결과 dict만 있으면 충분한 일회성 배치라면 `invoke()`가 더 단순하다.

## 사전 준비

`updates`, `values`, `custom` 예제는 `langgraph`만 있으면 된다.

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

`messages` 예제까지 직접 돌려 보려면 LLM integration이 추가로 필요하다.

```bash
pip install -U langchain langchain-openai
```

그리고 provider API key도 준비해 둔다.

## 1. 가장 작은 `updates` + `custom` 예제

실무에서 가장 먼저 붙는 조합은 보통 `updates`와 `custom`이다.

- `updates`: 각 node가 반환한 state 변경분
- `custom`: node 내부에서 임의로 흘리는 진행 이벤트

공식 문서 기준으로 `custom` 이벤트는 `get_stream_writer()`로 보낸다.

```python
from typing_extensions import TypedDict

from langgraph.config import get_stream_writer
from langgraph.graph import END, START, StateGraph


class DraftState(TypedDict):
    topic: str
    outline: list[str]
    draft: str


def plan_outline(state: DraftState):
    writer = get_stream_writer()
    writer({"stage": "plan", "message": "개요를 만들고 있습니다."})

    outline = [
        f"{state['topic']} 개요",
        f"{state['topic']} 예제",
        f"{state['topic']} 주의점",
    ]
    return {"outline": outline}


def write_draft(state: DraftState):
    writer = get_stream_writer()
    writer({"stage": "write", "progress": 60})

    draft = "\n".join(f"- {item}" for item in state["outline"])
    return {"draft": draft}


graph = (
    StateGraph(DraftState)
    .add_node("plan_outline", plan_outline)
    .add_node("write_draft", write_draft)
    .add_edge(START, "plan_outline")
    .add_edge("plan_outline", "write_draft")
    .add_edge("write_draft", END)
    .compile()
)

for part in graph.stream(
    {
        "topic": "LangGraph streaming",
        "outline": [],
        "draft": "",
    },
    stream_mode=["updates", "custom"],
    version="v2",
):
    if part["type"] == "custom":
        print("CUSTOM:", part["data"])
    elif part["type"] == "updates":
        print("UPDATES:", part["data"])
```

핵심은 `version="v2"`다. 공식 문서 기준으로 v2에서는 모든 chunk가 항상 아래 같은 형태로 들어온다.

```python
{
    "type": "...",
    "ns": (),
    "data": ...
}
```

그래서 mode를 여러 개 같이 흘려도 `part["type"]`만 보면 분기할 수 있다.

## 2. `updates`와 `values`는 목적이 다르다

둘 다 state 스트리밍이지만 쓰임새는 꽤 다르다.

- `updates`: node가 바꾼 key만 본다
- `values`: 매 step 뒤의 전체 state snapshot을 본다

보통은 아래 기준으로 나누면 된다.

- UI 진행 로그, 변경 diff, node별 관찰: `updates`
- 현재 전체 state를 그대로 렌더링하거나 저장: `values`

예를 들어 위 예제를 `values`로 돌리면 개요가 들어간 뒤 상태, 초안까지 완성된 뒤 상태를 단계별로 그대로 받을 수 있다.

```python
for part in graph.stream(
    {
        "topic": "LangGraph streaming",
        "outline": [],
        "draft": "",
    },
    stream_mode="values",
    version="v2",
):
    if part["type"] == "values":
        print(part["data"])
```

`updates`를 보고 왜 전체 state가 안 오지라고 생각하는 경우가 많은데, 그건 의도된 동작이다.

## 3. `messages`는 그래프 토큰 스트림이다

공식 streaming 문서 기준으로 `messages` 모드는 graph 안 어디서든 일어난 LLM 호출의 토큰을 `(message_chunk, metadata)` 형태로 내보낸다. node 안에서 `.stream()`이 아니라 `.invoke()`를 써도 message events는 계속 나올 수 있다.

아래 예제는 `init_chat_model`로 모델을 초기화하고, graph 수준에서 `messages`를 구독하는 패턴이다.

```python
from dataclasses import dataclass

from langchain.chat_models import init_chat_model
from langgraph.graph import START, StateGraph


@dataclass
class JokeState:
    topic: str
    joke: str = ""


model = init_chat_model(model="gpt-5.4-mini")


def call_model(state: JokeState):
    response = model.invoke(
        [{"role": "user", "content": f"{state.topic}에 대한 짧은 농담 하나만 써 줘."}]
    )
    return {"joke": response.content}


graph = (
    StateGraph(JokeState)
    .add_node("call_model", call_model)
    .add_edge(START, "call_model")
    .compile()
)

for part in graph.stream(
    {"topic": "아이스크림"},
    stream_mode="messages",
    version="v2",
):
    if part["type"] == "messages":
        message_chunk, metadata = part["data"]
        if message_chunk.content:
            print(message_chunk.content, end="", flush=True)
```

이 패턴이 좋은 이유는 토큰 스트림을 LLM 호출 코드가 아니라 그래프 실행 단위에서 한 번에 수집할 수 있다는 점이다. UI 입장에서는 node가 어디인지, 어떤 invocation인지 `metadata`를 보고 구분하면 된다.

LLM integration이 아니라 임의의 외부 스트리밍 API를 쓰는 경우에는 공식 문서가 권장하듯 `custom` 모드로 감싸는 편이 낫다.

## 4. `tasks`, `checkpoints`, `debug`는 관찰용 런타임 채널이다

이 세 가지는 사용자 화면에 바로 뿌리는 이벤트보다 실행을 이해하고 디버깅하는 이벤트에 가깝다.

- `checkpoints`: checkpoint 이벤트. `get_state()`와 비슷한 형태
- `tasks`: task 시작/종료, 결과, 에러
- `debug`: 가장 많은 정보. `checkpoints`와 `tasks`를 더 큰 묶음으로 본다고 생각하면 쉽다

공식 문서 기준으로 `checkpoints`와 `tasks`는 checkpointer가 필요하다.

```python
from langgraph.checkpoint.memory import MemorySaver


graph = (
    StateGraph(DraftState)
    .add_node("plan_outline", plan_outline)
    .add_node("write_draft", write_draft)
    .add_edge(START, "plan_outline")
    .add_edge("plan_outline", "write_draft")
    .add_edge("write_draft", END)
    .compile(checkpointer=MemorySaver())
)

config = {"configurable": {"thread_id": "stream-demo-1"}}

for part in graph.stream(
    {
        "topic": "LangGraph streaming",
        "outline": [],
        "draft": "",
    },
    config=config,
    stream_mode=["tasks", "checkpoints"],
    version="v2",
):
    print(part["type"], part["data"])
```

보통 권장되는 흐름은 이렇다.

- 사용자 진행률 표시: `custom`
- node별 변경 추적: `updates`
- 전체 상태 디버깅: `values`
- 실제 토큰 스트리밍: `messages`
- 런타임 내부 추적: `tasks`, `checkpoints`, 필요하면 `debug`

## 5. `stream()`과 `astream()`은 같은 개념이다

동기 코드면 `stream()`, 비동기 서버면 `astream()`으로 이해하면 거의 맞다.

```python
async for part in graph.astream(
    {
        "topic": "LangGraph streaming",
        "outline": [],
        "draft": "",
    },
    stream_mode=["updates", "custom"],
    version="v2",
):
    print(part["type"], part["data"])
```

FastAPI, Starlette, SSE 핸들러처럼 async 기반 서버라면 보통 `astream()`이 더 자연스럽다.

## 6. 자주 하는 실수

### 6-1. `version="v2"`를 빼먹는다

공식 문서 기준으로 v1은 mode 개수와 subgraph 여부에 따라 출력 형태가 달라진다. 여러 stream mode를 같이 쓸 계획이면 지금은 거의 항상 `version="v2"`를 먼저 붙이는 편이 낫다.

### 6-2. `updates`를 전체 state라고 착각한다

`updates`는 변경분이고, `values`가 전체 snapshot이다. 둘을 섞어 쓰지 않으면 UI에서 필드가 사라진 것처럼 보일 수 있다.

### 6-3. `messages`를 붙였는데 아무 토큰도 안 나온다

`messages`는 실제 LLM invocation에서만 의미가 있다. 순수 Python node만 있는 graph라면 당연히 `messages`는 비어 있다. 이 경우에는 `custom`이 맞다.

### 6-4. `tasks` / `checkpoints`를 보려는데 checkpointer가 없다

공식 문서 기준으로 이 모드들은 checkpointer가 필요하다. 또 persistence를 thread 단위로 다루려면 `configurable.thread_id`도 같이 주는 편이 안전하다.

### 6-5. `get_stream_writer()`를 일반 함수처럼 아무 데서나 쓴다

`get_stream_writer()`는 graph 실행 컨텍스트 안에서 쓰는 도구다. 진행 이벤트를 보내려면 node 내부에서 호출하는 방식으로 유지하는 편이 가장 단순하다.

### 6-6. 사용자용 스트림과 디버그 스트림을 구분하지 않는다

`debug`는 정보가 많아서 바로 사용자 UI에 싣기엔 과하다. 대부분의 제품 화면은 `custom` + `messages` + 필요 최소한의 `updates`만 내보내고, 나머지는 내부 관찰 채널로 분리하는 편이 낫다.

## 7. 실무에서 바로 가져갈 기준

처음 붙일 때는 아래 규칙만 기억해도 충분하다.

1. 여러 모드를 섞을 거면 `version="v2"`부터 붙인다.
2. 사용자 진행률은 `custom`, state diff는 `updates`, 전체 snapshot은 `values`로 나눈다.
3. 토큰 스트림은 `messages`, 비표준 외부 API 스트림은 `custom`으로 보낸다.
4. checkpoint/task 단위 추적이 필요하면 checkpointer와 `thread_id`를 같이 설계한다.
5. 프론트엔드로 바로 보낼 이벤트와 내부 디버깅 이벤트를 분리한다.

## 마무리

LangGraph streaming의 핵심은 실행 중 무슨 일이 일어나는지를 원하는 해상도로 나눠 받는 데 있다.

- 변경분만 보면 `updates`
- 전체 상태를 보면 `values`
- 임의 진행 이벤트는 `custom`
- LLM 토큰은 `messages`
- 내부 런타임 추적은 `tasks` / `checkpoints` / `debug`

새 프로젝트라면 공식 문서가 권장하는 event streaming도 함께 보는 편이 좋다. 그래도 지금 당장 graph 실행 결과를 UI나 로그, 디버깅 채널에 빠르게 붙이려면 `stream_mode` 기반 API가 가장 짧은 시작점이다.

## 참고 자료

- [LangGraph Streaming](https://docs.langchain.com/oss/python/langgraph/streaming)
- [LangGraph Graph API Overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph Runtime / Pregel](https://docs.langchain.com/oss/python/langgraph/pregel)
- [LangGraph `stream` Reference](https://reference.langchain.com/python/langgraph/pregel/#stream)
- [LangGraph `get_stream_writer` Reference](https://reference.langchain.com/python/langgraph/config/#get_stream_writer)
