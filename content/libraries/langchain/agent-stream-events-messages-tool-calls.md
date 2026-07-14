---
title: "LangChain agent.stream_events()로 messages와 tool_calls를 함께 스트리밍하기"
description: "LangChain agent에서 stream_events(version=\"v3\")와 stream(version=\"v2\")를 나눠 쓰며 토큰, tool call, 최종 state를 안정적으로 소비하는 실전 패턴 정리"
date: 2026-07-14
tags:
  - langchain
  - agent
  - streaming
  - python
  - tools
aliases:
  - "/blog/agent-stream-events-messages-tool-calls"
---

# LangChain agent.stream_events()로 messages와 tool_calls를 함께 스트리밍하기

LangChain agent를 UI나 CLI에 붙이면 금방 부딪히는 문제가 있다.

- 토큰은 바로 보여주고 싶다.
- tool call이 언제 시작됐고 어떤 인자를 썼는지 같이 보고 싶다.
- 최종 답변만 누적하지 말고, 실행 중간 상태도 따로 처리하고 싶다.

2026년 7월 14일 기준 LangChain 공식 문서는 새 애플리케이션이라면 `stream_mode` 분기형 API보다 `stream_events(..., version="v3")`를 먼저 권장한다. 이유는 단순하다. `messages`, `tool_calls`, `values`, `subgraphs` 같은 projection을 별도 iterator로 소비할 수 있어서 UI 코드가 덜 꼬인다.

다만 기존 코드나 간단한 콘솔 도구에서는 `agent.stream(..., stream_mode=[...], version="v2")`도 여전히 실용적이다. 이 글에서는 두 방식을 실무 기준으로 나눠 정리한다.

- 새 코드에서 `stream_events(version="v3")`를 먼저 보는 이유
- `messages`, `tool_calls`, `values`, `output`을 어떻게 읽는지
- 기존 `stream_mode=["messages", "updates"]` 패턴을 언제 유지할지
- 자주 막히는 포인트와 운영 팁

## 언제 이 패턴이 특히 유용한가

아래 같은 화면이나 워크플로라면 체감이 바로 온다.

- agent 답변 토큰과 tool 실행 로그를 한 화면에 같이 보여줘야 한다
- "도구 호출 준비 중", "도구 실행 중", "최종 답변 작성 중"을 단계별로 나눠야 한다
- CLI 데모에서 토큰 스트림과 tool output을 함께 출력하고 싶다
- 단순 최종 문자열보다 final state와 tool call 메타데이터를 함께 저장해야 한다

반대로 tool 없이 단일 모델 응답만 토큰 스트리밍하면 되는 경우라면 chat model 수준 스트리밍만으로 충분한 경우도 많다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

예시는 공식 문서 흐름에 맞춰 `openai:gpt-5.5`를 사용한다. 실제 실행 시에는 계정에서 접근 가능한 모델 문자열로 바꿔도 된다.

## 핵심 개념 먼저 정리

LangChain 공식 문서를 실무적으로 압축하면 구분은 아래 정도면 충분하다.

- `agent.stream_events(..., version="v3")`
  새 코드 권장 경로. `stream.messages`, `stream.tool_calls`, `stream.values`, `stream.output`처럼 projection별로 읽는다.
- `agent.stream(..., stream_mode="updates")`
  agent step 단위 상태 변화를 빠르게 보고 싶을 때 쓴다.
- `agent.stream(..., stream_mode=["messages", "updates"], version="v2")`
  토큰 chunk와 완료된 tool call / ToolMessage를 한 루프에서 같이 처리하고 싶을 때 쓴다.

즉, 새 제품 코드라면 `stream_events`를 기본값으로 두고, 기존 `stream_mode` 기반 처리기가 이미 잘 돌아가면 바로 갈아엎지 않아도 된다.

## 1. 새 코드 기본값: `stream_events(version="v3")`

LangChain 공식 문서 기준으로 `stream_events`는 typed projection API다.  
토큰, tool execution, state snapshot을 한 덩어리 이벤트에서 직접 분기하기보다, 필요한 projection만 골라 읽는 방식이다.

```python
from langchain.agents import create_agent
from langchain_core.utils.uuid import uuid7
from langgraph.checkpoint.memory import InMemorySaver


def get_weather(city: str) -> str:
    """Get weather for a city."""
    return f"It's always sunny in {city}!"


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[get_weather],
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": str(uuid7())}}

stream = agent.stream_events(
    {
        "messages": [
            {"role": "user", "content": "서울과 부산 중 어디가 더 따뜻한지 먼저 날씨를 확인해줘."}
        ]
    },
    config=config,
    version="v3",
)

for kind, item in stream.interleave("messages", "tool_calls"):
    if kind == "messages":
        for token in item.text:
            print(token, end="", flush=True)
    elif kind == "tool_calls":
        print(f"\n[tool] {item.tool_name}({item.input})")
        for delta in item.output_deltas:
            print(delta, end="", flush=True)
        print(f"\n[result] {item.output}")

final_state = stream.output
print("\n--- final ---")
print(final_state["messages"][-1].text())
```

이 예제에서 기억할 점은 세 가지다.

1. `thread_id`는 대화 연속성과 체크포인트 저장을 위한 값이지 스트리밍 전용 옵션이 아니다.
2. `stream.interleave("messages", "tool_calls")`는 동기 코드에서 projection 여러 개를 한 루프로 소비할 때 유용하다.
3. 최종 응답은 토큰을 직접 이어 붙이기보다 `stream.output`의 마지막 메시지로 다시 확인하는 편이 안전하다.

## 2. `stream.values`로 중간 state를 따로 볼 수 있다

토큰과 tool call만으로 충분하지 않은 경우도 많다. 예를 들어 agent 상태 스냅샷을 단계별로 기록하거나, 중간 상태를 디버깅 화면에 노출하고 싶을 수 있다.

```python
from langchain.agents import create_agent


def lookup_policy(topic: str) -> str:
    """Fetch policy snippets."""
    return f"{topic} 정책 요약"


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[lookup_policy],
)

stream = agent.stream_events(
    {
        "messages": [
            {"role": "user", "content": "환불 정책을 확인하고 핵심만 요약해줘."}
        ]
    },
    version="v3",
)

for snapshot in stream.values:
    last_message = snapshot["messages"][-1]
    print(type(last_message).__name__, last_message.text())

final_state = stream.output
print(final_state["messages"][-1].text())
```

공식 event streaming 문서 기준으로 `stream.values`는 state snapshot, `stream.output`은 최종 agent state다.  
즉, "실행 중간 상태"와 "마지막 결과"를 분리해서 다루는 편이 자연스럽다.

## 3. 기존 코드에서는 `stream_mode=["messages", "updates"]`도 아직 충분히 쓸 만하다

이미 `agent.stream(...)` 기반 UI가 있다면, 꼭 바로 `stream_events`로 옮길 필요는 없다.  
특히 한 루프 안에서 message chunk와 완료된 tool message를 같이 처리하는 코드는 `version="v2"` 형식으로 계속 운용하기 쉽다.

```python
from langchain.agents import create_agent
from langchain.messages import AIMessage, AIMessageChunk, AnyMessage, ToolMessage


def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"It's always sunny in {city}!"


agent = create_agent("openai:gpt-5.5", tools=[get_weather])


def render_completed_message(message: AnyMessage) -> None:
    if isinstance(message, AIMessage) and message.tool_calls:
        print("tool_calls:", message.tool_calls)
    if isinstance(message, ToolMessage):
        print("tool_result:", message.content_blocks)


for chunk in agent.stream(
    {
        "messages": [
            {"role": "user", "content": "보스턴 날씨 먼저 확인하고 알려줘."}
        ]
    },
    stream_mode=["messages", "updates"],
    version="v2",
):
    if chunk["type"] == "messages":
        token, metadata = chunk["data"]
        if isinstance(token, AIMessageChunk):
            if token.text:
                print(token.text, end="|")
            if token.tool_call_chunks:
                print(token.tool_call_chunks)
    elif chunk["type"] == "updates":
        for source, update in chunk["data"].items():
            if source in ("model", "tools"):
                render_completed_message(update["messages"][-1])
```

이 패턴의 장점은 "partial tool-call JSON"과 "완료된 parsed tool call"을 둘 다 잡을 수 있다는 점이다.  
즉, 스트리밍 UI가 이미 `chunk["type"]` 분기 구조에 맞춰져 있다면 운영 코드를 안정적으로 유지하기 좋다.

## 4. 언제 `stream_events`로 옮기고, 언제 그대로 둘까

개인적으로는 아래 기준이면 충분하다.

- 새 UI, 새 API 서버, 새 CLI: `stream_events(version="v3")`
- 기존 `stream_mode` 소비 코드를 많이 갖고 있음: 당장 유지
- projection별 소비자가 분리됨: `stream_events`
- 한 루프 안에서 단순 `if chunk["type"]`만 있으면 됨: `stream(..., version="v2")`

특히 `stream_events`는 아래 상황에서 확실히 편하다.

- 토큰 스트림 소비자와 tool call 소비자가 다르다
- sub-agent / subgraph까지 확장할 계획이 있다
- custom transformer로 `stream.extensions[...]`를 붙일 가능성이 있다

## 5. async 소비가 필요하면 `astream_events`로 병렬 projection을 읽는다

공식 문서 기준으로 async 환경에서는 `astream_events`와 `asyncio.gather(...)` 조합을 권장한다.

```python
import asyncio

from langchain.agents import create_agent


def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"It's always sunny in {city}!"


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[get_weather],
)


async def main() -> None:
    stream = await agent.astream_events(
        {
            "messages": [
                {"role": "user", "content": "샌프란시스코 날씨 알려줘."}
            ]
        },
        version="v3",
    )

    async def consume_messages() -> None:
        async for message in stream.messages:
            print(await message.text)

    async def consume_tool_calls() -> None:
        async for call in stream.tool_calls:
            print(call.tool_name, call.input)

    await asyncio.gather(consume_messages(), consume_tool_calls())


asyncio.run(main())
```

웹소켓 서버나 async FastAPI 핸들러에서는 이 방식이 projection을 명시적으로 분리하기 좋아서 유지보수성이 높다.

## 자주 막히는 포인트

### 1. `stream_events`와 `stream`을 같은 데이터 구조라고 가정한다

둘은 소비 방식이 다르다.

- `stream_events(version="v3")`: projection 객체 중심
- `stream(..., version="v2")`: `{"type", "data", "ns"}` 또는 `(mode, chunk)` 중심

중간에 섞어 쓰면 프런트엔드나 CLI 파서가 빠르게 지저분해진다.

### 2. 토큰을 직접 이어 붙였으니 최종 결과도 완성됐다고 생각한다

tool call, 재시도, sub-agent, 후처리 middleware가 섞이면 마지막 사용자 응답은 누적 토큰 문자열만으로 보장되지 않을 수 있다.  
최종 저장값은 `stream.output["messages"][-1]` 또는 v2의 최종 반환 state로 다시 확인하는 편이 안전하다.

### 3. `thread_id` 없이 멀티턴 스트리밍을 붙이고 memory가 이어질 거라고 기대한다

공식 문서 기준으로 follow-up turn continuity는 `thread_id`와 checkpointer가 있어야 한다.  
스트리밍을 켰다고 대화 기억이 자동으로 생기지는 않는다.

### 4. `messages`만 보면 tool execution 결과도 다 알 수 있다고 생각한다

`messages`는 모델 메시지 projection에 가깝고, 실제 tool 실행 lifecycle은 `tool_calls` projection이나 `updates` 쪽이 더 직접적이다.  
도구 입력, 출력 delta, 최종 output을 안정적으로 다루려면 `tool_calls`를 같이 보는 편이 좋다.

### 5. 새 코드인데도 무조건 `stream_mode` 분기로 시작한다

지금 시점 문서 기준 기본 추천은 `event streaming`이다.  
처음부터 `stream_events(version="v3")`로 잡아 두면 이후 `values`, `subgraphs`, `extensions`로 확장하기가 쉽다.

## 추천 운영 흐름

1. 새 제품 코드는 `stream_events(version="v3")`를 기본값으로 잡는다.
2. 동기 코드는 `stream.interleave(...)`, 비동기 코드는 `astream_events + asyncio.gather(...)`로 projection을 나눠 소비한다.
3. 최종 저장은 `stream.output` 기준으로 한다.
4. 기존 `stream_mode` 기반 화면은 `version="v2"`를 명시하고 점진적으로 마이그레이션한다.
5. tool 진행률이 더 필요해지면 다음 단계에서 `ToolRuntime.stream_writer`나 custom transformer를 붙인다.

즉, 기본 스트리밍 소비는 `stream_events`, tool 진행률 확장은 `stream_writer`, 도메인 전용 projection은 transformer로 나누면 구조가 깔끔하다.

## 참고 자료

- [LangChain Streaming](https://docs.langchain.com/oss/python/langchain/streaming)
- [LangChain Event streaming](https://docs.langchain.com/oss/python/langchain/event-streaming)
- [LangChain Runtime](https://docs.langchain.com/oss/python/langchain/runtime)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
