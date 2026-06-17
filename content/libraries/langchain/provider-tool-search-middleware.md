---
title: LangChain ProviderToolSearchMiddleware로 provider 검색형 도구 지연 로딩하기
description: LangChain ProviderToolSearchMiddleware로 많은 도구를 프롬프트에 모두 넣지 않고 provider의 server-side tool search로 필요한 도구만 지연 노출하는 실전 패턴 정리
date: 2026-06-17
tags:
  - langchain
  - agent
  - middleware
  - tool-calling
  - python
---

# LangChain ProviderToolSearchMiddleware로 provider 검색형 도구 지연 로딩하기

LangChain 에이전트에 도구가 많아질수록 두 가지 비용이 같이 커집니다.

- 매 턴마다 모든 tool schema를 모델에 넣는 프롬프트 비용
- 비슷한 도구가 많을 때 모델이 잘못 고를 확률

이 문제를 줄이는 대표적인 방법이 `LLMToolSelectorMiddleware`처럼 "앞단에서 도구를 추려서 본 모델에 적게 보여주는 방식"입니다. 그런데 최근 LangChain에는 한 단계 더 직접적인 선택지가 생겼습니다.

`ProviderToolSearchMiddleware`는 일부 도구를 아예 provider 쪽 server-side tool search 뒤로 숨겨 두고, 모델이 필요할 때만 그 도구를 검색해 불러오게 만듭니다. 즉 "도구를 미리 다 주는 것"이 아니라 "필요하면 provider가 찾아서 노출하는 것"에 가깝습니다.

2026년 6월 17일 기준 공식 문서에서는 아래 provider만 지원한다고 명시합니다.

- Anthropic: Claude Sonnet 4+, Opus 4+, Haiku 4.5+
- OpenAI: `gpt-5.5+`

다른 provider로 쓰면 `ValueError`가 발생합니다.

이 글에서는 아래를 실전 기준으로 정리합니다.

- 언제 `ProviderToolSearchMiddleware`가 잘 맞는지
- `searchable_tools`와 `extras={"defer_loading": True}` 차이
- `LLMToolSelectorMiddleware`나 규칙 기반 필터와 어떻게 역할이 다른지
- 운영에서 흔한 함정

## 언제 쓰면 좋은가

아래 상황이면 우선 검토할 만합니다.

- 도구 수가 많고 대부분의 요청에서 실제 필요한 도구는 극히 일부다
- tool schema가 길어서 프롬프트 토큰이 부담된다
- provider가 지원하는 최신 모델을 이미 쓰고 있다
- "모든 도구를 일단 모델에 보여주는 구조" 자체를 줄이고 싶다

반대로 아래면 다른 방법이 먼저입니다.

- 현재 쓰는 provider가 server-side tool search를 지원하지 않는다
- 도구 공개 범위를 사용자 권한별로 강하게 통제해야 한다
- 특정 도구를 절대 노출하면 안 되는 보안 제약이 있다

이 경우는 `wrap_model_call` 기반 도구 필터가 먼저고, `ProviderToolSearchMiddleware`는 그 다음 최적화 층으로 생각하는 편이 맞습니다.

## 사전 준비

```bash
pip install -U langchain "langchain[openai]"
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

Anthropic을 쓸 경우:

```powershell
$env:ANTHROPIC_API_KEY="sk-ant-..."
```

## 1. 가장 작은 형태의 예제

공식 문서 기준으로 `searchable_tools`에 넣은 도구들은 provider의 tool search 뒤로 지연 로딩됩니다. 모델은 처음부터 그 도구 schema를 전부 받지 않고, 필요할 때 provider가 검색 결과로 surfaced 한 도구만 보게 됩니다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ProviderToolSearchMiddleware
from langchain.tools import tool


@tool
def search_docs(query: str) -> str:
    """Search internal product docs."""
    return f"docs results for: {query}"


@tool
def lookup_order(order_id: str) -> str:
    """Look up order shipping and payment state."""
    return f"order={order_id}, status=shipped"


@tool
def cancel_order(order_id: str) -> str:
    """Cancel an order that has not shipped yet."""
    return f"order={order_id}, cancelled=False"


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[search_docs, lookup_order, cancel_order],
    middleware=[
        ProviderToolSearchMiddleware(
            searchable_tools=["lookup_order", "cancel_order"],
        )
    ],
)


result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "주문 ORD-1042 배송 상태를 확인해줘.",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

이 구성의 핵심은 다음입니다.

- `search_docs`는 평소처럼 바로 보이는 일반 도구
- `lookup_order`, `cancel_order`는 provider 검색 뒤로 지연된 도구
- 모델은 필요한 순간에만 deferred tool을 발견해 사용

도구가 많을수록 이런 차이가 커집니다.

## 2. 도구를 만들 때부터 지연 로딩으로 표시할 수도 있다

공식 문서 기준으로 어떤 도구는 middleware에서 이름으로 지정하지 않아도, 생성 시점에 `extras={"defer_loading": True}`를 넣어 스스로 deferred tool로 표시할 수 있습니다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ProviderToolSearchMiddleware
from langchain.tools import tool


@tool(extras={"defer_loading": True})
def send_email(to: str, subject: str) -> str:
    """Send a support follow-up email."""
    return f"email queued to {to}"


agent = create_agent(
    model="anthropic:claude-sonnet-4-8",
    tools=[send_email],
    middleware=[ProviderToolSearchMiddleware()],
)
```

이 패턴은 아래처럼 쓰면 편합니다.

- "항상 지연 로딩이어야 하는 도구"를 도구 정의 자체에 표시
- 런타임 구성에서 `searchable_tools` 목록을 줄여 설정 단순화

즉, 정책을 "에이전트 설정"이 아니라 "도구 정의" 쪽으로 당길 수 있습니다.

## 3. `searchable_tools`와 `defer_loading`은 역할이 비슷하지만 적용 지점이 다르다

실무에서는 둘 중 하나만 알아도 되지만, 차이는 분명히 구분하는 편이 좋습니다.

### `searchable_tools=[...]`

- 에이전트 구성 시점에 어떤 도구를 deferred tool로 둘지 결정
- 같은 도구라도 에이전트마다 다르게 운영 가능
- 실험이나 A/B 테스트에 유리

### `@tool(extras={"defer_loading": True})`

- 도구 정의 자체에 deferred 속성을 고정
- 여러 에이전트에서 같은 정책을 재사용하기 쉽다
- 특정 도구를 항상 검색형으로 노출하고 싶을 때 편하다

팀 단위로 관리할 때는 "공통 도구는 정의 단계에서 표시, 에이전트별 차이는 `searchable_tools`로 조정" 정도가 무난합니다.

## 4. `LLMToolSelectorMiddleware`와는 무엇이 다른가

이 둘은 겉보기에는 비슷하지만, 실제 제어 지점이 다릅니다.

### `LLMToolSelectorMiddleware`

- LangChain 쪽에서 작은 선택 모델이 미리 관련 도구를 추린다
- 여전히 LangChain 애플리케이션이 도구 후보를 관리한다
- provider가 server-side tool search를 지원하지 않아도 쓸 수 있다

### `ProviderToolSearchMiddleware`

- provider가 검색형 도구 노출을 담당한다
- 도구 일부를 처음부터 프롬프트에 싣지 않는다
- 지원 provider와 모델이 필요하다

정리하면:

- provider 독립성, 이식성이 중요하면 `LLMToolSelectorMiddleware`
- supported provider에서 프롬프트 비대화를 더 직접 줄이고 싶으면 `ProviderToolSearchMiddleware`

둘을 같이 쓰는 것도 가능하지만, 먼저 권한/정책 필터를 정리한 뒤 어떤 층에서 도구를 줄일지 결정하는 편이 설계가 깔끔합니다.

## 5. 권한 필터와 함께 쓰는 구조가 안전하다

지연 로딩은 성능 최적화이지 권한 제어가 아닙니다. 예를 들어 viewer에게는 환불/취소 도구를 애초에 숨겨야 한다면 먼저 규칙 기반 필터를 둬야 합니다.

```python
from dataclasses import dataclass
from typing import Callable

from langchain.agents import create_agent
from langchain.agents.middleware import (
    ModelRequest,
    ModelResponse,
    ProviderToolSearchMiddleware,
    wrap_model_call,
)


@dataclass
class Context:
    user_role: str


@wrap_model_call
def restrict_tools_by_role(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    role = request.runtime.context.user_role if request.runtime else "viewer"

    if role == "viewer":
        blocked = {"cancel_order"}
        tools = [tool for tool in request.tools if tool.name not in blocked]
        request = request.override(tools=tools)

    return handler(request)


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[search_docs, lookup_order, cancel_order],
    middleware=[
        restrict_tools_by_role,
        ProviderToolSearchMiddleware(searchable_tools=["lookup_order"]),
    ],
    context_schema=Context,
)
```

순서는 보통 이렇게 가져갑니다.

1. 규칙 기반 필터로 금지 도구 제거
2. 남은 일부 도구만 provider search 뒤로 지연

## 6. 운영에서 자주 겪는 함정

### 1. 지원하지 않는 provider로 붙이면 바로 실패한다

공식 문서 기준으로 미지원 provider는 `ValueError`를 냅니다. 이 middleware는 provider capability에 강하게 묶여 있으므로 멀티-provider 앱이면 fallback 경로를 먼저 설계해야 합니다.

### 2. 모든 도구를 무조건 deferred로 돌리면 오히려 불편해질 수 있다

항상 자주 쓰는 공통 도구까지 전부 지연시키면 오히려 첫 선택이 느려지거나, 모델이 매번 검색을 거치는 구조가 됩니다. 읽기 전용 기본 검색처럼 거의 항상 필요한 도구는 일반 노출로 남기는 편이 좋습니다.

### 3. 보안 정책을 provider search에 맡기면 안 된다

deferred tool은 "나중에 보이게 하는 것"이지 "절대 못 보게 하는 것"이 아닙니다. 민감한 도구는 앞단 필터에서 차단해야 합니다.

### 4. 도구 설명이 모호하면 검색 품질도 같이 떨어진다

provider search 역시 도구 이름과 설명 품질에 영향을 받습니다. 다음처럼 겹치는 설명은 좋지 않습니다.

- `lookup_data`
- `search_record`
- `query_info`

도구 이름과 docstring은 가능한 한 도메인과 목적이 바로 드러나게 쓰는 편이 좋습니다.

### 5. 지원 모델 버전이 바뀌면 배포 환경 차이로 엇갈릴 수 있다

로컬 개발, 스테이징, 운영에서 모델 이름이 다르면 어떤 환경에서는 middleware가 되고 어떤 환경에서는 실패할 수 있습니다. 모델 선택 로직과 provider capability 체크를 한곳에 모아 두는 편이 안전합니다.

## 추천 적용 순서

실무에서는 보통 아래 순서가 무난합니다.

1. 도구 이름과 docstring부터 정리한다
2. 권한 기반 도구 필터가 필요한지 먼저 결정한다
3. 자주 쓰는 공통 도구와 드물게 쓰는 특수 도구를 나눈다
4. 특수 도구만 `searchable_tools` 또는 `defer_loading`으로 지연시킨다
5. LangSmith trace로 어떤 요청에서 어떤 deferred tool이 surfaced 되는지 확인한다

## 마무리

`ProviderToolSearchMiddleware`는 "도구가 많을 때 앞단에서 추릴까?"를 넘어서 "아예 처음부터 도구를 다 주지 말자"는 접근입니다.

- provider가 지원하면 프롬프트 비대화를 직접 줄일 수 있다
- deferred tool과 일반 tool을 섞어 설계할 수 있다
- 권한 제어와는 별개 층으로 다루는 것이 안전하다

도구가 많은 운영형 agent를 LangChain 위에서 다루고 있고, OpenAI `gpt-5.5+` 또는 최신 Anthropic 계열을 이미 쓰는 환경이라면 충분히 시도할 가치가 있습니다.

## 참고 자료

- [LangChain built-in middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [LangChain middleware overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)
- [LangChain tools](https://docs.langchain.com/oss/python/langchain/tools)
