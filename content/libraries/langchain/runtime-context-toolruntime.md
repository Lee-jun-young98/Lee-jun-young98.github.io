---
title: LangChain runtime context와 ToolRuntime으로 사용자별 설정 주입하기
description: LangChain create_agent에서 context_schema와 ToolRuntime을 사용해 사용자 정보, 권한, 설정을 안전하게 주입하는 실전 입문 가이드
date: 2026-05-30
tags:
  - langchain
  - agent
  - runtime
  - python
---

# LangChain runtime context와 ToolRuntime으로 사용자별 설정 주입하기

LangChain agent를 조금만 실전에 가깝게 만들기 시작하면 금방 이런 값들이 필요해진다.

- 현재 사용자 ID
- 요금제나 권한 레벨
- 팀별 기본 언어 설정
- DB 연결이나 내부 서비스 클라이언트

이 값을 전부 prompt에 넣거나 전역 변수로 들고 가기 시작하면 구조가 금방 지저분해진다.  
LangChain v1 기준으로는 이런 런타임 의존성을 `context_schema`와 `ToolRuntime`으로 주입하는 방식이 기본에 가깝다.

이번 글에서는 아래만 실전 기준으로 짧게 정리한다.

- `context_schema`는 언제 쓰는지
- tool 안에서 `ToolRuntime`으로 context를 읽는 방법
- middleware에서 runtime을 읽어 동적으로 프롬프트를 바꾸는 방법
- state, context, store를 헷갈릴 때 자주 생기는 문제

## 왜 이 방식이 실무에서 중요한가

runtime context는 "이번 실행에만 필요한 설정"을 agent에 붙이는 방법이다.  
예를 들어 사용자 이름, 권한, 현재 조직, feature flag 같은 값은 모델이 직접 생성할 대상이 아니라 애플리케이션이 알고 있는 사실이다.

이 값을 runtime으로 주입하면:

- tool 함수가 전역 상태에 덜 의존한다
- 테스트에서 가짜 context를 넣어 재현하기 쉽다
- 민감한 값을 tool schema에 노출하지 않을 수 있다
- 사용자별 동작 차이를 prompt 대신 애플리케이션 레이어에서 제어하기 쉽다

공식 문서 기준으로 `create_agent(...)`는 LangGraph runtime 위에서 동작하고, `ToolRuntime`은 tool 안에서 state, context, store, stream writer, execution info까지 한 번에 접근하는 통합 진입점이다.

## 사전 준비

기본 agent 예제만 돌릴 때는 아래 정도면 충분하다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

OpenAI를 예시로 쓰면:

```bash
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

`runtime.execution_info`나 `runtime.server_info`까지 쓰려면 공식 문서 기준으로 `langgraph>=1.1.5` 또는 `deepagents>=0.5.0`이 필요하다.

## 1. 가장 작은 runtime context 예제

아래 예제는 사용자 등급과 선호 언어를 context로 주입하고, tool이 그 값을 읽어 응답 정책을 바꾸는 흐름이다.

```python
from dataclasses import dataclass

from langchain.agents import create_agent
from langchain.tools import tool, ToolRuntime


@dataclass
class UserContext:
    user_id: str
    tier: str
    locale: str


@tool
def recommend_reply_style(runtime: ToolRuntime[UserContext]) -> str:
    """현재 사용자에게 맞는 응답 스타일 가이드를 반환한다."""
    ctx = runtime.context

    if ctx.tier == "pro":
        detail_level = "구체적이고 상세하게 설명"
    else:
        detail_level = "짧고 핵심만 설명"

    if ctx.locale == "ko-KR":
        language = "한국어"
    else:
        language = "영어"

    return f"{language}로 답하고, {detail_level}."


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[recommend_reply_style],
    context_schema=UserContext,
    system_prompt=(
        "필요할 때만 도구를 호출하고, 도구가 준 정책을 최우선으로 따른다."
    ),
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "새 팀원에게 LangChain agent 구조를 어떻게 설명하면 좋을지 알려줘.",
            }
        ]
    },
    context=UserContext(
        user_id="user-123",
        tier="pro",
        locale="ko-KR",
    ),
)

print(result["messages"][-1].content)
```

핵심은 세 가지다.

- `context_schema=`로 이번 실행에서 받을 context 모양을 정의한다
- `invoke(..., context=...)`에서 실제 값을 넣는다
- tool은 `runtime.context`로 그 값을 읽는다

이때 `runtime` 파라미터는 tool schema에 드러나지 않는다.  
즉 모델은 `recommend_reply_style()`에 숨겨진 런타임 값이 있다는 사실을 직접 보지 않고, 애플리케이션이 안전하게 주입한다.

## 2. `ToolRuntime`으로 대화 state까지 함께 읽기

실무에서는 "현재 사용자 설정"만으로는 부족하고, "직전 대화에서 무슨 얘기를 했는지"도 같이 봐야 하는 경우가 많다.  
이때는 `runtime.context`와 `runtime.state`를 같이 읽으면 된다.

```python
from dataclasses import dataclass

from langchain.agents import create_agent
from langchain.messages import HumanMessage
from langchain.tools import tool, ToolRuntime


@dataclass
class UserContext:
    user_name: str
    locale: str


@tool
def summarize_request(runtime: ToolRuntime[UserContext]) -> str:
    """현재 사용자와 마지막 요청을 요약한다."""
    last_user_message = ""
    for message in reversed(runtime.state["messages"]):
        if isinstance(message, HumanMessage):
            last_user_message = message.content
            break

    return (
        f"user_name={runtime.context.user_name}, "
        f"locale={runtime.context.locale}, "
        f"last_request={last_user_message}"
    )


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[summarize_request],
    context_schema=UserContext,
)
```

구분을 짧게 정리하면:

- `runtime.state`: 현재 대화 안에서 변하는 값, 즉 short-term memory
- `runtime.context`: 호출 시점에 외부에서 넣어준 고정 설정
- `runtime.store`: 대화가 끝나도 남길 long-term memory

처음 설계할 때 이 셋을 분리해 두면 나중에 memory 구조를 바꿀 때 덜 아프다.

## 3. middleware에서 runtime context로 프롬프트를 동적으로 바꾸기

tool뿐 아니라 middleware에서도 runtime을 읽을 수 있다.  
예를 들어 사용자의 조직 정책에 따라 system prompt를 동적으로 바꾸고 싶다면 `dynamic_prompt`가 실용적이다.

```python
from dataclasses import dataclass

from langchain.agents import create_agent
from langchain.agents.middleware import dynamic_prompt, ModelRequest


@dataclass
class UserContext:
    user_name: str
    team: str


@dynamic_prompt
def runtime_system_prompt(request: ModelRequest) -> str:
    ctx = request.runtime.context
    return (
        f"너는 {ctx.team} 팀을 지원하는 assistant다. "
        f"사용자를 {ctx.user_name}님이라고 부르고, 불확실하면 추측하지 말고 먼저 확인 질문을 한다."
    )


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    middleware=[runtime_system_prompt],
    context_schema=UserContext,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "내 할 일 정리해줘."}]},
    context=UserContext(user_name="Junyoung", team="research"),
)
```

이 방식이 좋은 이유는 사용자 이름이나 팀 정책을 prompt 문자열 하드코딩으로 섞지 않아도 된다는 점이다.  
테스트할 때도 context만 바꿔 여러 경우를 재현할 수 있다.

## 4. 실행 정보가 필요할 때

운영 단계에서는 "누가 어떤 thread에서 이 tool을 호출했는지"를 로그에 남기고 싶을 때가 많다.  
공식 문서 기준으로 `runtime.execution_info`를 통해 thread ID, run ID, attempt number에 접근할 수 있다.

```python
from langchain.tools import tool, ToolRuntime


@tool
def audit_log_tool(runtime: ToolRuntime) -> str:
    """현재 실행 정보를 기록한다."""
    info = runtime.execution_info
    print(
        f"thread_id={info.thread_id}, "
        f"run_id={info.run_id}, "
        f"attempt={info.attempt}"
    )
    return "logged"
```

LangGraph Server 위에서 돌리는 경우에는 `runtime.server_info`로 assistant ID나 인증된 사용자 정보까지 읽을 수 있다.  
로컬 개발에서는 `server_info`가 `None`일 수 있다는 점을 전제로 코드를 짜는 편이 안전하다.

## 5. 자주 헷갈리는 포인트

### 5-1. context는 "모델이 알아서 채우는 값"이 아니다

`context`는 사용자 메시지에서 추출되는 값이 아니라, 애플리케이션이 `invoke(..., context=...)`에 직접 넣는 값이다.  
예를 들어 권한, 내부 고객 ID, feature flag 같은 값은 모델이 추론하게 두지 말고 바깥에서 넘겨야 한다.

### 5-2. context와 state를 섞으면 디버깅이 어려워진다

사용자 이름처럼 요청마다 외부에서 확정되는 값은 context에 두고,  
"이 대화에서 몇 번 승인 요청이 있었는가" 같은 값은 state에 두는 편이 낫다.

### 5-3. 민감한 값은 prompt에 넣기 전에 한 번 더 생각해야 한다

`runtime.context`에 비밀값이 있다고 해도, tool이나 middleware가 그 값을 모델 메시지에 넣어 버리면 결국 노출된다.  
context 주입 자체가 자동 보안 장치는 아니다. "모델이 꼭 알아야 하는 값만 메시지로 올린다"는 원칙이 필요하다.

### 5-4. `ToolRuntime`은 tool schema에 보이지 않는다

이건 장점이지만 동시에 헷갈리는 지점이기도 하다.  
모델은 `runtime` 인자를 직접 채우지 않는다. 그래서 tool 설명에는 모델이 알아야 하는 입력 인자만 남겨 두고, 런타임 의존성은 `ToolRuntime`으로 숨기는 구성이 깔끔하다.

### 5-5. store와 stream writer는 실행 환경 제약이 있다

공식 문서 기준으로 `runtime.store`는 장기 메모리 백엔드가 붙어 있을 때 의미가 있고,  
`runtime.stream_writer`는 LangGraph 실행 컨텍스트 안에서 tool이 호출될 때 사용해야 한다.  
즉 로컬의 단순 함수 테스트와 실제 서버 실행에서 동작 차이가 생길 수 있다.

## 언제 특히 유용한가

개인적으로는 아래 상황에서 runtime context 패턴의 체감 가치가 크다.

- 멀티테넌트 SaaS처럼 사용자별 정책이 다른 agent
- 같은 agent 코드를 재사용하지만 팀별 프롬프트 정책이 다른 경우
- tool이 DB, 검색 클라이언트, 내부 API 설정 같은 의존성을 받아야 하는 경우
- 로그, 감사 추적, 권한 체크를 middleware나 tool 레벨에서 넣고 싶은 경우

반대로 단발성 데모나 노트북 실험이면 처음부터 context 구조를 과하게 일반화할 필요는 없다.  
하지만 "이 agent를 서비스 코드로 옮길 계획이 있나?"라는 질문에 답이 yes라면, 초기에 이 패턴을 잡아 두는 편이 결국 덜 복잡해진다.

## 마무리

LangChain의 `context_schema`와 `ToolRuntime`은 단순 편의 기능이 아니라, agent 코드를 애플리케이션 코드와 연결하는 핵심 접점에 가깝다.

- context로 사용자별 설정과 의존성을 주입하고
- tool은 `runtime.context`, `runtime.state`, `runtime.store`를 구분해서 읽고
- middleware는 runtime 기반으로 프롬프트와 정책을 동적으로 바꾼다

처음에는 조금 추상적으로 느껴질 수 있지만, 실제로 사용자 ID, 권한, 팀 정책, 장기 메모리까지 붙이기 시작하면 이 구조가 왜 필요한지 금방 체감된다.

## 참고 자료

- [LangChain Runtime](https://docs.langchain.com/oss/python/langchain/runtime)
- [LangChain Tools](https://docs.langchain.com/oss/python/langchain/tools)
- [LangChain Context Engineering in Agents](https://docs.langchain.com/oss/python/langchain/context-engineering)
