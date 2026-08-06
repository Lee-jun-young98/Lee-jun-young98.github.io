---
title: "LangChain runtime tool registration으로 실행 중 발견한 도구 연결하기"
description: "MCP, 데이터베이스, 외부 registry에서 실행 중 발견한 도구를 wrap_model_call과 wrap_tool_call로 노출하고 실행하는 실전 패턴"
date: 2026-08-06
tags:
  - langchain
  - agent
  - middleware
  - tools
  - python
---

# LangChain runtime tool registration으로 실행 중 발견한 도구 연결하기

일반적인 LangChain agent는 `create_agent(..., tools=[...])`를 호출할 때 사용할 도구를 모두 알고 있다. 하지만 tenant별 MCP 서버, 플러그인 registry, 데이터베이스에 저장된 사용자 함수처럼 **실행 시점에야 도구가 결정되는** 경우도 있다.

이때 `request.override(tools=...)`로 모델에게 도구 정의만 보여주면 충분하지 않다. agent의 tool node는 처음 등록되지 않은 도구의 실행 구현을 모르기 때문이다. runtime tool registration은 다음 두 경로를 함께 연결한다.

1. `wrap_model_call`: 이번 model call에 동적 도구의 schema를 노출한다.
2. `wrap_tool_call`: 모델이 그 도구를 선택했을 때 실제 `BaseTool` 구현으로 교체한다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.0" langchain-openai
export OPENAI_API_KEY="your-api-key"
```

PowerShell에서는 마지막 줄 대신 다음처럼 설정한다.

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 두 hook으로 동적 도구 연결하기

아래 예제는 실제 registry 대신 Python dictionary를 사용한다. 중요한 점은 `calculate_tip`이 `create_agent`의 `tools` 목록에는 없다는 것이다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, ModelRequest
from langchain.tools import tool
from langchain.tools.tool_node import ToolCallRequest


@tool
def get_weather(city: str) -> str:
    """Return a short weather summary for a city."""
    return f"{city}: sunny"


@tool
def calculate_tip(bill_amount: float, tip_percentage: float = 20.0) -> str:
    """Calculate a restaurant tip and total bill."""
    tip = bill_amount * tip_percentage / 100
    return f"tip={tip:.2f}, total={bill_amount + tip:.2f}"


RUNTIME_TOOLS = {calculate_tip.name: calculate_tip}


class RuntimeToolMiddleware(AgentMiddleware):
    def wrap_model_call(self, request: ModelRequest, handler):
        tools = [*request.tools, *RUNTIME_TOOLS.values()]
        return handler(request.override(tools=tools))

    def wrap_tool_call(self, request: ToolCallRequest, handler):
        name = request.tool_call["name"]
        if tool_impl := RUNTIME_TOOLS.get(name):
            return handler(request.override(tool=tool_impl))
        return handler(request)


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[get_weather],
    middleware=[RuntimeToolMiddleware()],
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "85달러의 팁 20%를 계산해 줘"}]}
)
print(result["messages"][-1].content)
```

`request.override(...)`는 원본 request를 직접 수정하지 않고 새 request를 만든다. model hook에서는 `tools`를, tool hook에서는 `tool`을 교체한다는 차이를 기억하면 된다.

## 2. 요청별 registry와 권한을 함께 적용하기

운영 환경에서는 모든 사용자에게 registry 전체를 노출하면 안 된다. runtime context에서 tenant와 권한을 읽고, 허용된 도구만 두 hook에서 동일하게 선택해야 한다.

```python
from dataclasses import dataclass

from langchain.agents.middleware import AgentMiddleware, ModelRequest
from langchain.tools.tool_node import ToolCallRequest


@dataclass(frozen=True)
class RequestContext:
    tenant_id: str
    allowed_tools: frozenset[str]


TENANT_REGISTRY = {
    "restaurant-a": {calculate_tip.name: calculate_tip},
}


def tools_for(context: RequestContext):
    tenant_tools = TENANT_REGISTRY.get(context.tenant_id, {})
    return {
        name: tool
        for name, tool in tenant_tools.items()
        if name in context.allowed_tools
    }


class TenantToolMiddleware(AgentMiddleware):
    def wrap_model_call(self, request: ModelRequest, handler):
        dynamic = tools_for(request.runtime.context)
        return handler(
            request.override(tools=[*request.tools, *dynamic.values()])
        )

    def wrap_tool_call(self, request: ToolCallRequest, handler):
        dynamic = tools_for(request.runtime.context)
        tool_impl = dynamic.get(request.tool_call["name"])
        if tool_impl is not None:
            return handler(request.override(tool=tool_impl))
        return handler(request)
```

agent 생성과 호출에도 context schema를 연결한다.

```python
agent = create_agent(
    model="openai:gpt-5.5",
    tools=[get_weather],
    middleware=[TenantToolMiddleware()],
    context_schema=RequestContext,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "100달러 팁 18% 계산"}]},
    context=RequestContext(
        tenant_id="restaurant-a",
        allowed_tools=frozenset({"calculate_tip"}),
    ),
)
```

권한 검사는 model hook에만 두지 않는다. 과거 message나 조작된 state에 이미 tool call이 들어 있을 수 있으므로 실제 실행 직전인 `wrap_tool_call`에서도 다시 검사해야 한다.

## 3. registry snapshot을 한 run 동안 고정하기

외부 registry가 두 hook 사이에서 바뀌면 모델이 본 schema와 실제 구현이 달라질 수 있다. 다음 원칙이 안전하다.

- registry 결과를 `(tenant_id, registry_version)` 기준으로 캐시한다.
- 한 agent run에서는 같은 immutable snapshot을 사용한다.
- tool 이름이 같아도 schema나 구현 버전이 다르면 명시적인 version 정책을 둔다.
- registry 장애 시 마지막 snapshot을 쓸지, 동적 도구를 모두 닫을지 결정한다.

간단한 snapshot helper는 다음과 같이 만들 수 있다.

```python
from dataclasses import dataclass
from langchain_core.tools import BaseTool


@dataclass(frozen=True)
class ToolSnapshot:
    version: str
    tools: dict[str, BaseTool]


def load_snapshot(tenant_id: str) -> ToolSnapshot:
    # 실제 구현에서는 MCP/DB/registry를 조회하고 timeout과 cache를 적용한다.
    tools = TENANT_REGISTRY.get(tenant_id, {})
    return ToolSnapshot(version="2026-08-06", tools=dict(tools))
```

실제 서비스에서는 `load_snapshot()`을 두 hook에서 각각 호출하기보다 invocation context나 별도 run-scoped cache를 통해 같은 snapshot을 공유하는 편이 좋다.

## 4. middleware만 단위 테스트하기

LLM을 호출하지 않아도 핵심 계약을 검사할 수 있다. 최소한 다음 항목을 테스트한다.

```python
def test_registry_names_are_unique():
    static_names = {get_weather.name}
    dynamic_names = set(RUNTIME_TOOLS)
    assert static_names.isdisjoint(dynamic_names)


def test_runtime_tool_executes_without_model():
    result = RUNTIME_TOOLS["calculate_tip"].invoke(
        {"bill_amount": 85, "tip_percentage": 20}
    )
    assert result == "tip=17.00, total=102.00"


def test_unauthorized_tool_is_not_loaded():
    context = RequestContext("restaurant-a", frozenset())
    assert tools_for(context) == {}
```

통합 테스트에서는 fake chat model이 `calculate_tip` tool call을 반환하도록 구성해, model hook에서 보인 도구가 tool hook에서 같은 구현으로 실행되는지 확인한다.

## 자주 하는 실수

### `wrap_model_call`만 구현한다

모델은 도구를 선택할 수 있지만 tool node는 실행 구현을 찾지 못한다. runtime에 추가한 도구는 반드시 `wrap_tool_call`에서 `request.override(tool=...)`로 연결한다.

### 기존 `request.tools`를 덮어쓴다

`request.override(tools=list(dynamic.values()))`만 사용하면 정적 도구가 사라진다. 둘 다 필요하면 `[*request.tools, *dynamic.values()]`처럼 합친다.

### 같은 이름의 도구를 중복 등록한다

정적 도구와 동적 도구의 이름이 충돌하면 모델이 본 schema와 실행 구현이 어긋날 수 있다. registry를 합치기 전에 중복 이름을 거부하거나 우선순위를 명시한다.

### model 노출만 권한 검사로 믿는다

도구를 모델에게 숨기는 것은 UX와 정확도 최적화이지 완전한 실행 권한 경계가 아니다. `wrap_tool_call`에서 tenant와 permission을 다시 검증한다.

### 매 model turn마다 느린 registry를 조회한다

agent loop는 model을 여러 번 호출할 수 있다. timeout, cache, versioned snapshot 없이 외부 registry를 매번 조회하면 지연과 비결정성이 커진다.

## 실전 체크리스트

1. 동적 도구를 model hook과 tool hook 양쪽에 연결했는가?
2. 정적·동적 도구 이름 충돌을 검사하는가?
3. 실제 실행 직전에 권한을 다시 검증하는가?
4. 한 run에서 같은 registry version과 schema를 사용하는가?
5. registry timeout, 장애, stale cache 정책이 있는가?
6. LLM 없이 도구 구현과 권한 필터를 단위 테스트했는가?

## 참고 자료

- [LangChain Tools - Dynamic tool selection](https://docs.langchain.com/oss/python/langchain/tools#dynamic-tool-selection)
- [LangChain Custom middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
- [LangChain Model Context Protocol](https://docs.langchain.com/oss/python/langchain/mcp)
