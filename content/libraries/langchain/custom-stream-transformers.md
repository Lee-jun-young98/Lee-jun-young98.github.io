---
title: LangChain custom stream transformers로 stream_events v3 확장 채널 만들기
description: LangChain middleware에 custom stream transformer를 등록해 stream_events(version="v3")에서 retrieval progress 같은 도메인별 확장 채널을 만드는 실전 패턴 정리
date: 2026-07-02
tags:
  - langchain
  - agent
  - middleware
  - streaming
  - python
---

# LangChain custom stream transformers로 stream_events v3 확장 채널 만들기

LangChain agent를 UI나 운영 콘솔에 붙이다 보면 기본 스트림만으로는 부족한 순간이 있다.

- 검색 단계만 따로 진행률로 보여주고 싶다
- tool 실행 중 나온 custom 이벤트 중 특정 종류만 별도 패널로 보내고 싶다
- 매 호출마다 `transformers=`를 붙이지 말고 agent 정의에 projection 규칙을 같이 묶고 싶다

이럴 때 LangChain의 custom middleware와 LangGraph의 `StreamTransformer`를 조합하면 `stream_events(version="v3")` 위에 도메인 전용 확장 채널을 만들 수 있다.

이번 글에서는 아래만 빠르게 정리한다.

- middleware에 transformer를 등록하는 이유
- `custom` 이벤트를 `retrieval_progress` 채널로 정리하는 최소 예제
- `stream.extensions[...]`를 읽는 방법
- 자주 막히는 포인트와 운영 팁

## 언제 유용한가

이 패턴은 "기본 스트림은 너무 저수준이고, 앱 전용 스트림은 필요하다"는 상황에 잘 맞는다.

- RAG 검색 진행 상황만 따로 UI에 띄우고 싶을 때
- approval, audit, billing 같은 운영 이벤트를 별도 채널로 분리하고 싶을 때
- 여러 호출부가 같은 projection 규칙을 공유해야 할 때
- PII redaction처럼 스트림을 소비하기 전에 가공해야 할 때

반대로 tool 진행 로그 몇 줄만 보고 싶다면 [`ToolRuntime.stream_writer`](../langchain/toolruntime-stream-writer-progress) + `stream_mode="custom"`만으로 충분한 경우가 많다.

## 사전 준비

공식 문서 기준으로 middleware 등록형 transformers는 `langchain>=1.3.2`가 필요하다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "langchain>=1.3.2" langgraph langchain-openai
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

예제는 `openai:gpt-5.5`를 사용하지만, 실제로는 계정에서 사용할 수 있는 모델 문자열로 바꿔도 된다.

## 핵심 개념 먼저 정리

공식 문서 흐름을 실무적으로 압축하면 구조는 아래 네 단계다.

1. tool이나 node가 `custom` 이벤트를 쓴다
2. `StreamTransformer`가 raw protocol event를 관찰한다
3. 원하는 이벤트만 골라 `StreamChannel`에 넣는다
4. 호출부는 `stream.extensions["..."]`에서 가공된 projection을 읽는다

여기서 중요한 점은 `create_agent(..., transformers=[...])`로 호출부마다 직접 등록할 수도 있지만, middleware의 `transformers` 속성에 넣으면 agent 정의와 스트림 규칙을 같이 버전 관리할 수 있다는 것이다.

## 1. 가장 작은 패턴: retrieval 이벤트만 별도 채널로 꺼내기

아래 예제는 tool이 `custom` 이벤트를 쓰고, transformer가 그중 `kind == "retrieval"`만 `retrieval_progress`라는 확장 채널로 모은다.

```python
import time
from typing import Any

from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware
from langchain.tools import ToolRuntime, tool
from langgraph.stream._types import ProtocolEvent, StreamTransformer
from langgraph.stream.stream_channel import StreamChannel


class RetrievalProgressTransformer(StreamTransformer):
    required_stream_modes = ("custom",)

    def __init__(self, scope: tuple[str, ...] = ()) -> None:
        super().__init__(scope)
        self._channel: StreamChannel[dict[str, Any]] = StreamChannel()
        self._scope_list = list(scope)

    def init(self) -> dict[str, Any]:
        return {"retrieval_progress": self._channel}

    def process(self, event: ProtocolEvent) -> bool:
        if event["method"] != "custom":
            return True

        params = event["params"]
        if params["namespace"] != self._scope_list:
            return True

        data = params["data"]
        if isinstance(data, dict) and data.get("kind") == "retrieval":
            self._channel.push(data)
        return True


class RetrievalProgressMiddleware(AgentMiddleware):
    transformers = (RetrievalProgressTransformer,)


@tool
def search_docs(query: str, runtime: ToolRuntime) -> str:
    """Search docs and emit retrieval progress updates."""
    writer = runtime.stream_writer

    writer(
        {
            "kind": "retrieval",
            "stage": "search_started",
            "query": query,
        }
    )
    time.sleep(1)

    writer(
        {
            "kind": "retrieval",
            "stage": "documents_ranked",
            "matched_documents": 4,
        }
    )
    time.sleep(1)

    writer(
        {
            "kind": "retrieval",
            "stage": "context_ready",
            "selected_documents": 2,
        }
    )
    return "LangChain custom middleware docs, event streaming docs"


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[search_docs],
    middleware=[RetrievalProgressMiddleware()],
    system_prompt="Use search_docs when the user asks about LangChain middleware.",
)

stream = agent.stream_events(
    {
        "messages": [
            {"role": "user", "content": "LangChain middleware 흐름을 설명해줘."}
        ]
    },
    version="v3",
)

for event in stream.extensions["retrieval_progress"]:
    print("RETRIEVAL:", event)

final_state = stream.output
print(final_state["messages"][-1].text())
```

이 예제의 핵심은 세 가지다.

- tool은 그냥 `runtime.stream_writer`로 구조화된 `custom` 이벤트를 쓴다
- transformer는 raw event 전체를 보되 필요한 것만 projection으로 만든다
- 호출부는 low-level protocol을 직접 파싱하지 않고 `stream.extensions["retrieval_progress"]`만 읽는다

## 2. 왜 `transformers=`보다 middleware 등록이 편한가

호출부에서 직접 transformer를 넣는 방식도 가능하다.

```python
stream = agent.stream_events(
    input_data,
    version="v3",
    transformers=[RetrievalProgressTransformer],
)
```

하지만 실무에서는 middleware 등록 쪽이 더 안정적일 때가 많다.

- 같은 agent를 호출하는 API 서버, CLI, 배치 작업이 projection 규칙을 공유한다
- 스트림 처리 규칙이 agent 정책의 일부로 남는다
- 다른 middleware와 함께 ordering을 더 예측 가능하게 관리할 수 있다

공식 문서 기준으로 등록 순서는 아래처럼 합쳐진다.

1. built-in `ToolCallTransformer`
2. middleware에 등록한 transformers
3. `create_agent(..., transformers=...)`로 호출부가 직접 넘긴 transformers

즉, 애플리케이션 공통 규칙은 middleware에 두고, 화면별 임시 projection만 호출부에서 추가하는 식이 관리하기 쉽다.

## 3. 어떤 payload를 흘리는 게 좋은가

문자열 한 줄보다 작은 구조체를 정해 두는 편이 낫다.

```python
{
    "kind": "retrieval",
    "stage": "documents_ranked",
    "matched_documents": 4,
    "latency_ms": 183,
}
```

이렇게 해 두면 프론트엔드에서 아래를 쉽게 할 수 있다.

- 단계별 아이콘과 상태 배지 분리
- 진행률 계산
- 특정 `kind`만 필터링
- LangSmith trace와 별개로 사용자용 상태 UI 렌더링

개인적으로는 최소한 아래 필드는 고정하는 편이 좋다.

- `kind`: 이벤트 도메인
- `stage`: 현재 단계 이름
- `message` 또는 도메인별 핵심 수치
- 필요하면 `latency_ms`, `count`, `source` 같은 운영용 메타데이터

## 4. `stream.extensions`는 언제 읽나

`stream_events(version="v3")`는 raw protocol event를 직접 순회할 수도 있고, typed projection만 따로 읽을 수도 있다.

이 기능을 붙인 뒤 호출부는 보통 아래 둘 중 하나로 나뉜다.

- 사용자 UI: `stream.extensions["retrieval_progress"]`만 읽는다
- 디버깅/운영 도구: `stream.messages`, `stream.tool_calls`, `stream.extensions[...]`를 함께 읽는다

즉, custom transformer의 목적은 "새로운 이벤트를 생성"하는 것보다 "기존 스트림을 앱이 소비하기 좋은 형태로 다시 투영"하는 데 가깝다.

## 자주 막히는 포인트

### 1. `stream()`이 아니라 `stream_events(version="v3")`를 써야 한다

middleware transformer 등록은 event streaming v3 위에서 동작한다.  
`invoke()`만 쓰거나 예전 streaming 패턴만 유지하면 `stream.extensions`를 쓸 수 없다.

### 2. `required_stream_modes`를 빼먹으면 기대한 이벤트가 안 들어올 수 있다

공식 소스 기준으로 transformer는 필요한 stream mode의 합집합만 graph에 요청한다.  
예제처럼 `custom` 이벤트를 읽을 transformer라면 `required_stream_modes = ("custom",)`를 선언하는 편이 안전하다.

### 3. `StreamChannel`은 단일 subscriber 기준이다

공식 소스 기준으로 `StreamChannel`은 한 번만 subscribe할 수 있다.  
같은 projection을 두 군데에서 동시에 읽고 싶다면 `tee()` 또는 `atee()` 같은 fan-out 전략을 미리 생각해야 한다.

### 4. `langgraph.stream._types`는 저수준 경로다

`StreamTransformer` 타입은 LangGraph 쪽 저수준 모듈에 있다.  
실전에서는 이 import를 앱 내부 어댑터로 한 번 감싸 두고 버전을 pinning하는 편이 안전하다.

### 5. scope를 무시하면 서브그래프 이벤트까지 섞일 수 있다

공식 문서와 소스 기준으로 factory는 `scope`를 받아 각 mux마다 새 transformer를 만든다.  
예제처럼 `params["namespace"] != self._scope_list` 검사를 두지 않으면 root run과 subgraph run 이벤트가 한 채널에 섞일 수 있다.

## 운영 팁

- 우선 `custom` 이벤트를 구조화하는 것부터 시작한다
- projection 이름은 UI 용도에 맞게 작게 유지한다
- 공통 projection은 middleware에 등록하고, 화면 전용 projection만 호출부에서 추가한다
- PII나 내부 식별자가 섞일 수 있으면 projection 단계에서 바로 정리한다
- 내부 모듈 import를 쓰는 만큼 `langchain`과 `langgraph` 버전을 함께 고정한다

이 패턴은 특히 "agent는 하나인데, 소비자 UI는 여러 개"인 상황에서 효과가 크다.

## 마무리

custom stream transformer는 LangChain agent의 스트림을 앱 전용 채널로 재구성하는 가장 직접적인 방법이다.

- tool은 `stream_writer`로 원재료 이벤트를 남기고
- middleware transformer는 필요한 것만 projection으로 정리하고
- UI는 `stream.extensions[...]`만 읽는다

이렇게 나누면 agent 로직, 스트림 가공, 프론트엔드 소비 계층이 깔끔하게 분리된다.

## 참고 자료

- [LangChain Custom Middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
- [LangChain Event Streaming](https://docs.langchain.com/oss/python/langchain/event-streaming)
- [LangChain create_agent Reference](https://reference.langchain.com/python/langchain/agents/factory/create_agent)
- [LangGraph StreamTransformer Reference](https://reference.langchain.com/python/langgraph/stream/_types/StreamTransformer)
- [LangGraph StreamTransformer Source](https://github.com/langchain-ai/langgraph/blob/main/libs/langgraph/langgraph/stream/_types.py)
