---
title: "LangChain MCP adapters로 여러 MCP 도구 서버 연결하기"
description: "langchain-mcp-adapters와 MultiServerMCPClient로 로컬 stdio 서버와 원격 HTTP MCP 서버를 LangChain agent에 붙이는 방법을 실전 예제로 정리한 노트"
date: 2026-07-09
tags:
  - langchain
  - mcp
  - agents
  - python
aliases:
  - "/blog/langchain-mcp-adapters-multi-server-tools"
---

# LangChain MCP adapters로 여러 MCP 도구 서버 연결하기

LangChain 에이전트에 도구를 붙일 때, 사내 API나 브라우저 자동화, 파일 시스템 작업을 모두 직접 LangChain tool로 감싸기 시작하면 금방 관리 비용이 커진다.

이럴 때 `langchain-mcp-adapters`를 쓰면 MCP(Model Context Protocol) 서버가 노출하는 도구를 LangChain agent에 바로 연결할 수 있다. 이미 MCP 서버로 분리된 도구 생태계를 재사용할 수 있고, 같은 패턴으로 로컬 `stdio` 서버와 원격 HTTP 서버를 함께 붙일 수 있다는 점이 실무에서 특히 유용하다.

이 글에서는 다음을 기준으로 정리한다.

- `MultiServerMCPClient`로 여러 MCP 서버를 한 에이전트에 연결하는 기본 흐름
- 기본 stateless 세션과 stateful 세션을 언제 구분해야 하는지
- 실패한 MCP tool call을 에이전트 재시도 흐름에 태우는 방법
- 최소 예제로 바로 실행해 볼 수 있는 FastMCP 서버와 LangChain agent 코드

## 언제 쓰면 좋은가

다음 상황이면 MCP adapter를 우선 검토할 만하다.

- 이미 MCP 서버로 제공되는 내부 도구나 오픈소스 툴을 LangChain agent에 재사용하고 싶다
- 한 에이전트가 로컬 계산 도구와 원격 운영 API를 같이 써야 한다
- LangChain tool wrapper를 서비스마다 다시 작성하기보다 프로토콜 단위로 연결하고 싶다
- 도구 구현은 서버 쪽에서 바꾸고, agent 쪽은 연결 정보만 관리하고 싶다

반대로 도구 수가 1~2개뿐이고 모두 Python 함수로 간단히 끝난다면 굳이 MCP 계층을 추가하지 않아도 된다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "langchain>=1.0" langchain-openai langchain-mcp-adapters fastmcp
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

모델은 예시로 OpenAI provider string을 사용하지만, `create_agent(...)`가 받는 다른 LangChain 지원 모델로 바꿔도 된다.

## 1. 가장 작은 구성: 로컬 stdio MCP 서버 하나 붙이기

먼저 계산 도구를 제공하는 가장 작은 MCP 서버를 만든다.

```python
from fastmcp import FastMCP

mcp = FastMCP("Math")


@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b


@mcp.tool()
def multiply(a: int, b: int) -> int:
    """Multiply two numbers."""
    return a * b


if __name__ == "__main__":
    mcp.run(transport="stdio")
```

파일명을 `math_server.py`라고 두면, LangChain 쪽에서는 다음처럼 붙일 수 있다.

```python
import asyncio

from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient


async def main() -> None:
    client = MultiServerMCPClient(
        {
            "math": {
                "transport": "stdio",
                "command": "python",
                "args": ["./math_server.py"],
            }
        }
    )

    tools = await client.get_tools()
    agent = create_agent("openai:gpt-4.1-mini", tools)

    result = await agent.ainvoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "27과 15를 더한 다음 3을 곱해 줘.",
                }
            ]
        }
    )

    print(result["messages"][-1].content)


if __name__ == "__main__":
    asyncio.run(main())
```

핵심은 `client.get_tools()`가 MCP 서버의 도구를 LangChain tool 목록으로 변환해 준다는 점이다. 이후 흐름은 일반 `create_agent(...)`와 같다.

## 2. 실무형 구성: 여러 MCP 서버를 한 에이전트에 묶기

`MultiServerMCPClient`는 이름별 연결 설정 딕셔너리를 받기 때문에, 로컬 도구와 원격 도구를 한 번에 합칠 수 있다.

```python
import asyncio

from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient


async def main() -> None:
    client = MultiServerMCPClient(
        {
            "math": {
                "transport": "stdio",
                "command": "python",
                "args": ["./math_server.py"],
            },
            "weather": {
                "transport": "http",
                "url": "http://localhost:8000/mcp",
                "headers": {
                    "Authorization": "Bearer demo-token",
                },
            },
        }
    )

    tools = await client.get_tools()
    agent = create_agent("openai:gpt-4.1-mini", tools)

    response = await agent.ainvoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "서울 날씨를 확인하고, 비가 오면 12와 8을 더한 값을 같이 알려 줘.",
                }
            ]
        }
    )

    print(response["messages"][-1].content)


if __name__ == "__main__":
    asyncio.run(main())
```

실무에서는 이 구성이 다음 장점이 있다.

- 팀별 도구 서버를 독립 배포할 수 있다
- agent 애플리케이션은 연결 정보만 바꿔 새 도구를 붙일 수 있다
- LangSmith tracing을 켜 두면 에이전트 추론과 MCP tool call이 한 흐름으로 보인다

## 3. stateless 기본값을 먼저 이해해야 한다

공식 문서 기준으로 `MultiServerMCPClient`는 기본적으로 stateless다. 즉 tool call마다 새 MCP 세션을 열고 실행한 뒤 정리한다.

이 기본값이 잘 맞는 경우:

- 도구가 순수 함수처럼 동작한다
- 각 호출이 독립적이다
- 연결 재사용보다 단순성이 더 중요하다

주의할 점:

- `stdio` 서버여도 agent가 매 호출마다 새 세션을 만들 수 있다
- 서버가 세션 내부 상태를 유지하는 구조라면 예상과 다르게 동작할 수 있다
- 인증 토큰 갱신, 캐시, 핸드셰이크 비용이 크면 성능이 아쉬울 수 있다

## 4. 상태를 유지해야 하면 `client.session()`으로 stateful 세션을 연다

서버가 여러 호출 사이의 문맥을 기억해야 하거나, 긴 연결을 유지해야 하면 명시적으로 세션을 여는 편이 안전하다.

```python
import asyncio

from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.tools import load_mcp_tools


async def main() -> None:
    client = MultiServerMCPClient(
        {
            "stateful_server": {
                "transport": "http",
                "url": "http://localhost:8000/mcp",
            }
        }
    )

    async with client.session("stateful_server") as session:
        tools = await load_mcp_tools(session)
        agent = create_agent("openai:gpt-4.1-mini", tools)

        result = await agent.ainvoke(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": "이번 세션의 작업 목록을 만들고, 바로 다음 우선순위를 알려 줘.",
                    }
                ]
            }
        )

        print(result["messages"][-1].content)


if __name__ == "__main__":
    asyncio.run(main())
```

판단 기준은 단순하다.

- 호출 간 상태가 필요 없으면 `client.get_tools()`
- 호출 간 상태가 필요하면 `client.session(...)` 후 `load_mcp_tools(session)`

## 5. 실패한 MCP 도구 호출을 에이전트에 다시 맡길지 정한다

현재 문서 기준으로 MCP tool 실행이 실패했을 때, 기본 동작은 실패를 tool message의 `status="error"`로 모델에게 돌려주는 방식이다. 이 방식이면 모델이 에러 메시지를 읽고 다른 인자를 넣어 다시 시도할 수 있다.

```python
client = MultiServerMCPClient(
    {
        "weather": {
            "transport": "http",
            "url": "http://localhost:8000/mcp",
        }
    }
)
```

이 기본값은 agent 자율 복구를 원할 때 유리하다. 반대로 도구 실패를 즉시 Python 예외로 다루고 싶다면 `handle_tool_errors=False`를 둔다.

```python
client = MultiServerMCPClient(
    {
        "weather": {
            "transport": "http",
            "url": "http://localhost:8000/mcp",
        }
    },
    handle_tool_errors=False,
)
```

실무에서는 보통 다음처럼 나눈다.

- 사용자 질의형 agent: 기본값 유지, 모델이 스스로 복구하게 둔다
- 배치 작업이나 운영 자동화: 예외를 올려서 애플리케이션 레벨 재시도와 경보를 건다

공식 문서 기준으로 failed tool message 반환 동작은 `langchain-mcp-adapters>=0.3.0`에서 지원된다. 더 낮은 버전에서는 `ToolException` 형태로 만날 수 있으니 환경을 맞춰 두는 편이 안전하다.

## 6. 인증과 헤더는 연결 설정에서 같이 관리한다

HTTP MCP 서버는 연결 설정에 `headers`를 둘 수 있고, 더 복잡한 인증이 필요하면 `httpx.Auth` 구현체를 `auth`로 넘길 수 있다.

```python
client = MultiServerMCPClient(
    {
        "internal_api": {
            "transport": "http",
            "url": "https://mcp.example.com/mcp",
            "headers": {
                "X-Trace-Source": "support-agent",
            },
            "auth": auth,
        }
    }
)
```

운영에서는 헤더와 인증을 tool 함수 내부에서 우회하기보다, MCP 연결 레이어에서 통제하는 편이 감사와 교체가 쉽다.

## 자주 하는 실수

### 1. `stdio`면 자동으로 세션이 유지된다고 생각한다

문서 기준으로 subprocess 자체는 살아 있을 수 있어도, `MultiServerMCPClient`를 기본 방식으로 쓰면 tool call마다 새 MCP 세션을 만들 수 있다. 상태 저장형 서버라면 꼭 stateful 세션 예제를 기준으로 점검해야 한다.

### 2. Python 함수 하나 감싸듯 모든 운영 에러를 모델에게 맡긴다

기본 에러 전달 방식은 대화형 agent에는 좋지만, 배치성 작업에서는 실패가 조용히 숨겨질 수 있다. 자동화 작업이면 `handle_tool_errors=False`와 애플리케이션 로그를 함께 두는 편이 낫다.

### 3. 원격 MCP 서버 인증을 프롬프트나 tool 인자에 억지로 넣는다

토큰이나 내부 헤더는 연결 설정에서 처리해야 한다. 모델 입력에 노출시키면 보안과 재현성 모두 나빠진다.

### 4. MCP를 도입했는데 LangSmith 추적은 빼먹는다

도구 서버가 여러 개로 나뉘면 호출 경로가 금방 복잡해진다. agent reasoning, tool 선택, 실패 지점을 한 화면에서 보려면 tracing을 함께 켜 두는 편이 운영 난이도를 크게 낮춘다.

## 추천 적용 순서

1. 가장 작은 `stdio` 서버 하나로 `client.get_tools()` 흐름부터 검증한다.
2. 그다음 원격 HTTP 서버를 추가해 다중 서버 구성을 만든다.
3. 상태 저장형 서버가 필요해지는 시점에만 `client.session(...)`으로 올린다.
4. 마지막으로 `handle_tool_errors` 정책과 LangSmith tracing을 운영 기준에 맞춰 고정한다.

## 참고 자료

- [LangChain Python MCP guide](https://docs.langchain.com/oss/python/langchain/mcp)
- [LangChain Agents overview](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain changelog](https://docs.langchain.com/oss/python/releases/changelog)
- [Model Context Protocol specification](https://modelcontextprotocol.io/)
- [FastMCP](https://gofastmcp.com/)
