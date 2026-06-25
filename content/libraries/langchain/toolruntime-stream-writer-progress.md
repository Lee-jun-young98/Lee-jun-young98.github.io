---
title: LangChain ToolRuntime.stream_writer로 도구 진행 상황 스트리밍하기
description: LangChain v1 agent에서 ToolRuntime.stream_writer와 stream_mode="custom"을 이용해 긴 도구 실행의 중간 진행 상황을 사용자에게 보여주는 실전 패턴 정리
date: 2026-06-25
tags:
  - langchain
  - agent
  - streaming
  - tools
  - python
aliases:
  - "/blog/toolruntime-stream-writer-progress"
---

# LangChain ToolRuntime.stream_writer로 도구 진행 상황 스트리밍하기

LangChain agent를 UI나 CLI에 붙이다 보면 모델 최종 답변보다 먼저 보여줘야 하는 정보가 생긴다.

- 검색 도구가 지금 어떤 단계까지 왔는지
- 외부 API를 재시도 중인지
- 긴 배치 작업이 끝나기까지 얼마나 남았는지

이럴 때 `ToolRuntime.stream_writer`가 유용하다. 공식 문서 기준으로 `ToolRuntime`는 tool 안에서 `state`, `context`, `store`뿐 아니라 custom stream으로 흘릴 중간 업데이트도 함께 다루는 진입점이다.

이 글에서는 아래만 빠르게 정리한다.

- `ToolRuntime.stream_writer`가 언제 필요한지
- `stream_mode="custom"`과 `stream_mode=["updates", "custom"]`의 차이
- 긴 도구 실행에 진행 로그를 붙이는 최소 예제
- 자주 막히는 포인트와 운영 팁

## 언제 유용한가

아래 같은 상황이면 거의 바로 효과가 난다.

- RAG 검색, 크롤링, 파일 처리처럼 tool 실행이 1초 이상 걸린다
- 사용자에게 "멈춘 것이 아니라 일하는 중"이라는 신호를 보여줘야 한다
- 최종 응답과 별개로 중간 진행 로그를 UI 이벤트로 분리하고 싶다
- LangSmith trace 말고도 사용자-facing progress 이벤트가 필요하다

반대로 도구가 매우 짧고 항상 수십 ms 안에 끝난다면 굳이 복잡도를 늘릴 필요는 없다.

## 사전 준비

예시는 LangChain v1 agent와 OpenAI provider를 기준으로 한다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langchain-openai
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

모델 이름은 공식 문서 예제 흐름에 맞춰 `openai:gpt-5.5`를 사용했지만, 실제 실행 시에는 계정에서 사용할 수 있는 모델 문자열로 바꿔도 된다.

## 핵심 개념 먼저 정리

LangChain 공식 문서를 기준으로 보면 streaming 관련 축은 세 가지다.

- `runtime.stream_writer`: tool 내부에서 custom 업데이트를 밀어 넣는 함수
- `stream_mode="custom"`: tool이 보낸 진행 이벤트만 받고 싶을 때
- `stream_mode=["updates", "custom"]` + `version="v2"`: 모델 업데이트와 custom 진행 이벤트를 한 스트림에서 함께 받고 싶을 때

실무에서는 보통 이렇게 나눠 생각하면 편하다.

- 사용자 진행 표시줄이나 로그 패널: `custom`
- agent 내부 상태 변화까지 같이 보고 싶을 때: `updates + custom`
- 디버깅이 아니라 제품 UI라면 `version="v2"`로 형식을 고정하는 편이 다루기 쉽다

## 1. 가장 작은 패턴: tool에서 진행 로그 두 줄 보내기

먼저 가장 작은 예제부터 보는 편이 좋다.

```python
import time

from langchain.agents import create_agent
from langchain.tools import ToolRuntime, tool


@tool
def fetch_release_notes(product: str, runtime: ToolRuntime) -> str:
    """Fetch release notes for a product and report progress updates."""
    writer = runtime.stream_writer

    writer(f"[1/3] {product} 릴리스 노트 검색 시작")
    time.sleep(1)

    writer(f"[2/3] {product} 최근 변경사항 정리 중")
    time.sleep(1)

    writer(f"[3/3] {product} 요약 완료")
    return f"{product} 릴리스 노트 요약: 성능 개선 2건, 버그 수정 3건"


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[fetch_release_notes],
    system_prompt="Use the tool when the user asks for product updates.",
)

for chunk in agent.stream(
    {
        "messages": [
            {"role": "user", "content": "Quartz 최근 변경사항을 요약해줘."}
        ]
    },
    stream_mode="custom",
    version="v2",
):
    if chunk["type"] == "custom":
        print(chunk["data"])
```

이 패턴의 장점은 단순하다.

- 모델 응답이 끝날 때까지 기다리지 않아도 된다
- tool 내부 진행 상황을 UI 로그로 바로 뿌릴 수 있다
- final answer와 progress 이벤트를 분리해서 다룰 수 있다

## 2. `updates`와 같이 받으면 모델 단계와 도구 단계를 함께 볼 수 있다

제품 UI나 터미널 데모에서는 보통 tool 진행 로그만으로 충분하다.  
하지만 디버깅이나 운영 화면에서는 "모델이 tool을 호출한 시점"과 "tool이 실제로 무엇을 했는지"를 같이 보는 편이 좋다.

```python
import time

from langchain.agents import create_agent
from langchain.tools import ToolRuntime, tool


@tool
def build_weekly_report(team: str, runtime: ToolRuntime) -> str:
    """Build a weekly report and emit progress updates."""
    writer = runtime.stream_writer

    steps = [
        f"{team} 팀 지표 수집",
        f"{team} 팀 이슈 분류",
        f"{team} 팀 요약 문장 생성",
    ]

    for index, step in enumerate(steps, start=1):
        writer({"step": index, "message": step})
        time.sleep(1)

    return f"{team} 주간 보고서 초안이 준비되었습니다."


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[build_weekly_report],
)

for chunk in agent.stream(
    {
        "messages": [
            {"role": "user", "content": "플랫폼 팀 주간 보고서 초안을 만들어줘."}
        ]
    },
    stream_mode=["updates", "custom"],
    version="v2",
):
    if chunk["type"] == "custom":
        print("CUSTOM:", chunk["data"])
    elif chunk["type"] == "updates":
        print("UPDATES:", chunk["data"].keys())
```

여기서 중요한 점은 `custom` payload가 문자열일 필요가 없다는 것이다.  
간단한 dict 형태로 보내 두면 프론트엔드에서 진행률, 단계명, 상태 배지를 분리해서 그리기 쉽다.

## 3. `context`와 같이 쓰면 사용자별 진행 메시지도 다르게 만들 수 있다

`ToolRuntime`의 장점은 streaming이 독립 기능이 아니라는 점이다. 같은 `runtime`에서 `context`도 함께 읽을 수 있다.

```python
import time
from dataclasses import dataclass

from langchain.agents import create_agent
from langchain.tools import ToolRuntime, tool


@dataclass
class RequestContext:
    user_name: str
    locale: str


@tool
def sync_workspace(runtime: ToolRuntime[RequestContext]) -> str:
    """Sync the current user's workspace and emit progress updates."""
    writer = runtime.stream_writer
    user = runtime.context.user_name

    writer(f"{user} 작업공간 동기화 시작")
    time.sleep(1)
    writer(f"{user} 문서 인덱스 업데이트 중")
    time.sleep(1)
    writer(f"{user} 동기화 완료")

    return f"{user} 작업공간 동기화가 끝났습니다."


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[sync_workspace],
    context_schema=RequestContext,
)

for chunk in agent.stream(
    {
        "messages": [
            {"role": "user", "content": "내 작업공간 동기화 상태를 보여줘."}
        ]
    },
    context=RequestContext(user_name="Junyoung", locale="ko-KR"),
    stream_mode="custom",
    version="v2",
):
    print(chunk["data"])
```

이 패턴은 multi-tenant 제품에서 특히 편하다.

- 같은 tool이라도 사용자 이름, 권한, 지역 설정에 맞춰 진행 메시지를 바꿀 수 있다
- tool 함수 밖의 전역 상태에 의존하지 않아 테스트가 쉬워진다

## 4. `stream_writer`와 `get_stream_writer()` 중 무엇을 쓸까

Streaming 문서에는 `langgraph.config.get_stream_writer()` 예제도 나오지만, LangChain v1 agent 문맥에서는 `ToolRuntime.stream_writer`가 더 일관적이다.

- `ToolRuntime` 하나로 `state`, `context`, `store`, `tool_call_id`, `stream_writer`를 같이 다룰 수 있다
- 오래된 injected 패턴보다 v1 현재 문서 방향과 더 맞다
- tool 시그니처만 봐도 "이 도구가 runtime 정보를 읽는다"는 의도가 드러난다

즉, 이미 LangChain agent의 tool을 작성하고 있다면 `runtime: ToolRuntime` 기반으로 통일하는 편이 유지보수성이 좋다.

## 자주 막히는 포인트

### 1. `invoke()`만 쓰면 custom progress는 보이지 않는다

`stream_writer`를 넣어도 소비 쪽에서 `agent.stream(...)`을 쓰지 않으면 사용자에게 중간 진행 이벤트를 보여줄 수 없다.  
진행 로그를 UI에 쓰려면 호출부도 streaming 전제로 바꿔야 한다.

### 2. LangGraph 실행 문맥 밖에서 tool만 단독 호출하면 깨질 수 있다

Streaming 문서 기준으로 custom writer는 LangGraph 실행 문맥 안에서 써야 한다.  
즉, tool 함수를 단독 유닛 테스트처럼 직접 호출하면 `runtime.stream_writer`가 기대한 방식으로 동작하지 않을 수 있다.

이럴 때는 보통 둘 중 하나로 푼다.

1. pure function 로직과 LangChain tool wrapper를 분리한다
2. agent integration test에서 `agent.stream(...)`으로 검증한다

### 3. 진행 이벤트를 너무 자주 보내면 UI와 로그가 시끄러워진다

토큰 단위처럼 지나치게 세밀한 이벤트를 보내기보다, "검색 시작", "문서 10개 수집", "요약 완료" 같은 의미 있는 단계만 내보내는 편이 낫다.

### 4. 최종 답변과 progress payload 형식을 섞지 않는 편이 좋다

custom 이벤트는 화면용 상태 업데이트로 쓰고, 최종 사용자 설명은 마지막 AI 메시지에서 정리하는 편이 깔끔하다.  
한 채널에 모든 정보를 몰아 넣으면 프론트엔드 파싱이 금방 지저분해진다.

## 운영 팁

개인적으로는 아래 정도로 시작하는 편이 무난하다.

1. 문자열 progress부터 시작한다
2. UI 요구가 생기면 `{"step": 2, "label": "...", "percent": 66}` 형태로 바꾼다
3. 운영 화면에서는 `stream_mode=["updates", "custom"]`로 모델/tool 흐름을 함께 본다
4. LangSmith trace와 별개로 사용자-facing progress 이벤트를 유지한다

이렇게 두면 tracing은 운영 분석용으로, `stream_writer`는 사용자 경험용으로 역할이 깔끔하게 분리된다.

## 참고 자료

- [LangChain Runtime docs](https://docs.langchain.com/oss/python/langchain/runtime)
- [LangChain Tools docs](https://docs.langchain.com/oss/python/langchain/tools)
- [LangChain Streaming docs](https://docs.langchain.com/oss/python/langchain/streaming)
