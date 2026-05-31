---
title: LangChain middleware로 동적 모델 선택과 도구 노출 제어하기
description: LangChain의 wrap_model_call middleware로 대화 복잡도와 사용자 권한에 따라 모델과 도구를 동적으로 바꾸는 실전 가이드
date: 2026-05-31
tags:
  - langchain
  - agent
  - middleware
  - python
---

# LangChain middleware로 동적 모델 선택과 도구 노출 제어하기

LangChain agent를 실서비스에 붙이기 시작하면 금방 이런 요구가 나온다.

- 짧은 질의에는 저렴한 모델을 쓰고 싶다
- 긴 대화나 복잡한 작업에서만 더 강한 모델로 올리고 싶다
- 관리자만 삭제 도구를 보게 하고 일반 사용자는 조회 도구만 쓰게 하고 싶다
- 같은 agent 코드로도 사용자 권한과 기능 플래그에 따라 다른 행동을 하게 만들고 싶다

LangChain v1 기준으로 이런 제어는 `wrap_model_call` middleware가 가장 실용적이다.  
공식 문서도 `create_agent(...)` 위에 middleware를 얹어 모델, 프롬프트, 도구 선택을 런타임에 바꾸는 패턴을 기본 흐름으로 설명한다.

이번 글에서는 아래만 실무 기준으로 짧게 정리한다.

- `wrap_model_call`이 정확히 어디에 개입하는지
- 대화 길이에 따라 모델을 바꾸는 최소 예제
- 사용자 권한에 따라 노출 도구를 줄이는 예제
- 자주 생기는 함정과 운영 팁

## 왜 이 패턴이 실무에서 중요한가

초기 데모에서는 `model="openai:gpt-5.4"`처럼 하나로 고정해도 잘 돌아간다.  
하지만 운영으로 가면 비용, 응답 시간, 권한 제어 문제가 바로 생긴다.

예를 들면:

- FAQ 수준 질문은 `mini`급 모델이면 충분하다
- tool call이 여러 번 이어지는 긴 작업은 더 큰 컨텍스트와 추론이 필요하다
- viewer에게는 `read_*` 도구만 보여야 하고 editor는 수정 도구까지 써야 한다

이걸 프롬프트만으로 억지 제어하면 모델이 실수할 여지가 남는다.  
반면 middleware에서 아예 모델과 도구 목록 자체를 바꾸면 애플리케이션 레이어에서 더 강하게 통제할 수 있다.

## 사전 준비

공식 설치 문서 기준으로 Python 3.10+와 LangChain, provider 패키지가 필요하다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

macOS / Linux:

```bash
export OPENAI_API_KEY="your-api-key"
```

## `wrap_model_call`은 어디에 개입하나

`wrap_model_call`은 이름 그대로 "모델 호출 직전" 요청을 가로챈다.  
이 시점에는 현재 메시지, 시스템 프롬프트, 사용 가능한 도구, runtime context를 모두 볼 수 있다.

즉 middleware 안에서 아래를 바꿀 수 있다.

- 어떤 모델을 쓸지
- 어떤 도구를 모델에 노출할지
- 시스템 프롬프트를 어떻게 덧붙일지

공식 custom middleware 문서 예제도 `request.override(...)`로 모델과 도구를 바꾸는 방식을 사용한다.

## 1. 대화 복잡도에 따라 모델을 바꾸는 최소 예제

가장 흔한 패턴은 "짧은 대화는 저렴한 모델, 긴 대화는 강한 모델"이다.

```python
from collections.abc import Callable

from langchain.agents import create_agent
from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call
from langchain.chat_models import init_chat_model
from langchain.tools import tool


cheap_model = init_chat_model("openai:gpt-5.4-mini")
strong_model = init_chat_model("openai:gpt-5.4")


@tool
def search_docs(query: str) -> str:
    """제품 문서에서 설정 방법이나 API 사용법을 찾는다."""
    return f"docs result for: {query}"


@wrap_model_call
def route_model(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    message_count = len(request.state["messages"])

    if message_count > 10:
        selected_model = strong_model
    else:
        selected_model = cheap_model

    return handler(request.override(model=selected_model))


agent = create_agent(
    model=cheap_model,
    tools=[search_docs],
    middleware=[route_model],
    system_prompt="필요할 때만 도구를 호출하고, 모르면 추측하지 말고 먼저 확인 질문을 한다.",
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "LangChain middleware에서 model routing을 어떻게 구현해?",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

핵심은 세 가지다.

- 모델 인스턴스는 middleware 밖에서 한 번만 초기화한다
- middleware는 현재 상태를 보고 `request.override(model=...)`만 한다
- `create_agent`의 기본 `model=`은 fallback에 가까운 기본값으로 둔다

## 2. 권한에 따라 도구 노출을 줄이는 예제

모델을 바꾸는 것만큼 실용적인 패턴이 "도구 노출 축소"다.  
공식 문서도 런타임에 관련 도구만 남기면 프롬프트 길이를 줄이고 정확도를 높이며 권한 제어에도 유리하다고 설명한다.

```python
from collections.abc import Callable
from dataclasses import dataclass

from langchain.agents import create_agent
from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call
from langchain.tools import tool


@dataclass
class UserContext:
    user_role: str


@tool
def read_dashboard() -> str:
    """현재 대시보드 상태를 조회한다."""
    return "dashboard status"


@tool
def update_dashboard(message: str) -> str:
    """대시보드 공지 문구를 수정한다."""
    return f"updated: {message}"


@tool
def delete_dashboard() -> str:
    """대시보드 항목을 삭제한다."""
    return "deleted"


@wrap_model_call
def filter_tools_by_role(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    role = request.runtime.context.user_role

    if role == "admin":
        allowed_tools = request.tools
    elif role == "editor":
        allowed_tools = [tool for tool in request.tools if tool.name != "delete_dashboard"]
    else:
        allowed_tools = [tool for tool in request.tools if tool.name.startswith("read_")]

    return handler(request.override(tools=allowed_tools))


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[read_dashboard, update_dashboard, delete_dashboard],
    middleware=[filter_tools_by_role],
    context_schema=UserContext,
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "대시보드 문구를 오늘 점검 예정으로 바꿔줘.",
            }
        ]
    },
    context=UserContext(user_role="viewer"),
)

print(result["messages"][-1].content)
```

이 예제에서 `viewer`는 수정 도구를 아예 보지 못한다.  
즉 "수정하지 마"라고 프롬프트로 부탁하는 수준이 아니라, 애초에 모델의 선택지에서 빠진다.

## 3. 모델 라우팅과 도구 필터링을 같이 쓰는 패턴

실무에서는 둘을 따로 두기보다 함께 쓸 때가 많다.

- 짧은 질의 + viewer: 저렴한 모델 + 읽기 전용 도구
- 긴 질의 + admin: 강한 모델 + 전체 도구

이때는 middleware를 두 개로 나누는 편이 유지보수에 좋다.

```python
agent = create_agent(
    model=cheap_model,
    tools=[read_dashboard, update_dashboard, delete_dashboard],
    middleware=[route_model, filter_tools_by_role],
    context_schema=UserContext,
)
```

역할을 분리해 두면 나중에 어느 정책이 비용에 영향을 주는지, 어느 정책이 권한 제어를 담당하는지 추적하기 쉽다.

## 4. 자주 막히는 포인트

### 4-1. middleware 안에서 모델을 매번 새로 초기화한다

아래처럼 쓰면 매 호출마다 불필요한 초기화 비용이 생긴다.

```python
@wrap_model_call
def bad_router(request, handler):
    model = init_chat_model("openai:gpt-5.4")
    return handler(request.override(model=model))
```

모델 인스턴스는 보통 middleware 바깥에서 한 번 만들어 두는 편이 낫다.

### 4-2. 권한 제어를 프롬프트에만 맡긴다

"viewer는 삭제하면 안 된다"를 시스템 프롬프트에만 적어 두면, 모델이 여전히 삭제 도구를 보게 된다.  
실수 가능성을 줄이려면 middleware에서 허용 도구 목록 자체를 줄이는 편이 안전하다.

### 4-3. `context`와 `thread_id` 역할을 섞는다

공식 agents 문서 기준으로:

- `thread_id`는 대화 히스토리와 checkpoint를 구분한다
- `context`는 이번 실행에만 필요한 사용자 정보와 기능 플래그를 전달한다

권한이나 사용자 역할은 보통 `context`에 넣는 편이 맞다.

### 4-4. structured output과 동적 모델 선택을 함께 쓰면서 모델 바인딩을 섞는다

공식 agents 문서는 동적 모델 선택과 structured output을 함께 쓸 때 middleware에 넘기는 모델을 미리 `bind_tools(...)`한 상태로 두지 말라고 안내한다.  
즉 모델 라우팅이 필요하면 "도구 바인딩된 모델 인스턴스"보다 일반 모델 인스턴스를 넘기고, agent가 현재 요청 기준으로 묶게 두는 편이 안전하다.

### 4-5. 장애 대응과 비용 최적화를 한 미들웨어에 다 욱여넣는다

모델 라우팅은 "언제 어떤 모델을 쓸지"에 집중하고,  
장애 시 대체 모델 전환은 `ModelFallbackMiddleware` 같은 별도 middleware로 분리하는 편이 깔끔하다.

## 언제 특히 유용한가

개인적으로는 아래 상황에서 효과가 바로 난다.

- 같은 agent를 무료/유료 사용자에게 다르게 제공해야 할 때
- 관리자, 편집자, 조회자처럼 권한 등급이 나뉠 때
- 비용 때문에 기본 모델을 작게 두고 일부 작업만 상위 모델로 보내고 싶을 때
- 도구 수가 많아져 모델이 자주 엉뚱한 도구를 고르기 시작할 때

반대로 단발성 데모나 단일 도구 실험 단계라면 처음부터 너무 많은 라우팅 규칙을 넣을 필요는 없다.  
처음에는 "긴 대화면 상위 모델" 같은 단순 규칙 하나로 시작해도 충분하다.

## 마무리

LangChain의 `wrap_model_call` middleware는 단순한 꾸미기 기능이 아니라, agent를 애플리케이션 정책과 연결하는 핵심 제어 지점에 가깝다.

- 대화 복잡도에 따라 모델을 바꿀 수 있고
- 사용자 권한에 따라 도구 노출을 줄일 수 있고
- 비용, 응답 속도, 안전성 사이 균형을 애플리케이션 레이어에서 잡을 수 있다

LangChain agent가 "잘 돌아가긴 하는데 비용이 불안정하고 권한 제어가 약하다"는 단계에 왔다면, 다음으로 붙일 만한 기능 중 하나가 이 패턴이다.

## 참고 자료

- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain Middleware Overview](https://docs.langchain.com/oss/python/langchain/middleware)
- [LangChain Custom Middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
- [LangChain Context Engineering in Agents](https://docs.langchain.com/oss/python/langchain/context-engineering)
- [LangChain Prebuilt Middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
