---
title: "LangChain에서 MCP 서버 도구를 agent에 붙이기"
description: "langchain-mcp-adapters와 MultiServerMCPClient로 MCP 서버 도구를 LangChain agent에 연결하는 실전 패턴을 정리한 노트"
date: 2026-06-13
tags:
  - langchain
  - mcp
  - agents
  - python
aliases:
  - "/blog/langchain-mcp-server-tools"
---

# LangChain에서 MCP 서버 도구를 agent에 붙이기

LangChain v1의 `create_agent(...)`는 Python 함수뿐 아니라 MCP 서버가 노출한 도구도 그대로 붙일 수 있습니다.  
로컬 스크립트를 `stdio`로 띄우거나, 사내 HTTP MCP 서버를 붙이거나, 여러 서버를 한 agent에 한 번에 연결할 때 꽤 실용적입니다.

이번 글에서는 공식 문서 기준으로 다음 흐름만 빠르게 잡겠습니다.

- `langchain-mcp-adapters` 설치
- `MultiServerMCPClient`로 MCP 서버 여러 개 연결
- `client.get_tools()` 결과를 `create_agent(...)`에 주입
- 상태 없는 기본 동작과 stateful session이 필요한 시점 구분
- `handle_tool_errors=False`가 필요한 상황 정리

## 언제 쓰면 좋은가

다음 상황이면 MCP 연동이 LangChain agent 구조와 잘 맞습니다.

- 기존 사내 도구를 MCP 서버로 이미 노출해 둔 경우
- 파일 시스템, 데이터베이스, 외부 API 도구를 agent에 같은 방식으로 붙이고 싶은 경우
- 도구 구현은 팀별로 분리하고, agent 쪽은 LangChain에서 조합만 하고 싶은 경우
- 나중에 LangGraph나 LangSmith tracing으로 이어 갈 가능성이 큰 경우

반대로 도구가 정말 단순한 Python 함수 1~2개뿐이라면 굳이 MCP 서버를 두지 않고 `@tool` 함수로 바로 붙이는 편이 더 단순합니다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langchain-openai langchain-mcp-adapters fastmcp
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

이 글의 예제는 다음 전제를 둡니다.

- Python 3.11+
- LangChain v1 계열
- `langchain-mcp-adapters` 최신 버전
- OpenAI 호환 chat model 사용

## 1. 가장 작은 MCP 서버부터 만든다

공식 문서에서는 custom server 예제로 `FastMCP`를 사용합니다.  
먼저 `math_server.py`를 하나 만듭니다.

```python
from fastmcp import FastMCP

mcp = FastMCP("Math")


@mcp.tool()
def add(a: int, b: int) -> int:
    """두 수를 더한다."""
    return a + b


@mcp.tool()
def multiply(a: int, b: int) -> int:
    """두 수를 곱한다."""
    return a * b


if __name__ == "__main__":
    mcp.run(transport="stdio")
```

이 서버는 표준 입출력으로 동작하므로 로컬 개발 환경에서 바로 붙이기 쉽습니다.

## 2. `MultiServerMCPClient`로 도구를 읽어 agent에 연결한다

이제 LangChain 쪽에서 MCP 서버를 읽어 agent에 넣습니다.

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

    agent = create_agent(
        model="openai:gpt-4.1-mini",
        tools=tools,
        system_prompt="You are a precise calculator assistant.",
    )

    result = await agent.ainvoke(
        {
            "messages": [
                {
                    "role": "user",
                    "content": "What is (3 + 5) * 12? Show the final answer only.",
                }
            ]
        }
    )

    print(result["messages"][-1].content)


if __name__ == "__main__":
    asyncio.run(main())
```

핵심은 딱 두 줄입니다.

- `tools = await client.get_tools()`
- `agent = create_agent(..., tools=tools)`

즉, MCP 서버 도구가 LangChain의 일반 tool처럼 변환되기 때문에 agent 쪽 코드는 크게 달라지지 않습니다.

## 3. 여러 MCP 서버를 한 agent에 같이 붙일 수 있다

실전에서는 수학 서버 하나보다 여러 서버를 합쳐 쓰는 경우가 많습니다.

```python
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
                "Authorization": "Bearer dev-token"
            },
        },
    }
)
```

이 패턴의 장점은 명확합니다.

- 로컬 도구는 `stdio`
- 원격 서비스는 `http`
- agent는 둘을 같은 tool 목록처럼 사용

도구 구현과 agent 구성을 분리하기 좋기 때문에 팀 협업에도 잘 맞습니다.

## 4. 기본은 stateless다

여기서 가장 많이 놓치는 포인트가 session 동작입니다.

LangChain 공식 문서 기준으로 `MultiServerMCPClient`는 기본적으로 stateless입니다.  
즉, tool 호출마다 새 MCP `ClientSession`을 만들고 실행한 뒤 정리합니다.

이 기본값이 잘 맞는 경우:

- 각 도구 호출이 서로 독립적일 때
- 서버 쪽 세션 상태를 유지할 필요가 없을 때
- 간단한 조회형 도구가 대부분일 때

반대로 stateful session이 필요한 경우:

- MCP 서버가 로그인 상태나 임시 작업 컨텍스트를 세션에 유지할 때
- 여러 tool call이 같은 서버 상태를 공유해야 할 때
- 긴 워크플로에서 같은 연결을 재사용해야 할 때

그럴 때는 `client.session(...)`으로 명시적으로 세션을 열고 `load_mcp_tools(...)`를 써서 tool을 불러오는 편이 안전합니다.

```python
import asyncio

from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.tools import load_mcp_tools


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

    async with client.session("math") as session:
        tools = await load_mcp_tools(session)
        agent = create_agent("openai:gpt-4.1-mini", tools=tools)

        result = await agent.ainvoke(
            {"messages": [{"role": "user", "content": "Add 10 and 20"}]}
        )
        print(result["messages"][-1].content)


if __name__ == "__main__":
    asyncio.run(main())
```

## 5. MCP 도구 실패는 기본적으로 model에게 다시 전달된다

이것도 실무에서 중요합니다.

공식 문서 기준으로 `langchain-mcp-adapters>=0.3.0`에서는 MCP tool 실행이 실패해도 기본값이 예외 발생이 아니라, `status="error"`가 달린 tool message를 model에게 돌려줍니다.  
덕분에 agent가 에러를 읽고 다른 입력으로 다시 시도하는 흐름을 만들 수 있습니다.

이 기본 동작이 좋은 경우:

- agent가 자율적으로 복구를 시도해도 되는 경우
- 도구 입력을 model이 다시 수정해 볼 여지가 있는 경우

반대로 즉시 실패시키고 싶다면 `handle_tool_errors=False`를 줍니다.

```python
client = MultiServerMCPClient(
    {
        "math": {
            "transport": "stdio",
            "command": "python",
            "args": ["./math_server.py"],
        }
    },
    handle_tool_errors=False,
)
```

보통은 다음 기준으로 나누면 실수가 적습니다.

- 사용자가 고쳐 볼 수 있는 입력 문제: 기본값 유지
- 권한 문제, 과금 문제, 보안 정책 위반: 예외로 바로 실패

## 6. HTTP MCP 서버를 붙일 때 체크할 것

HTTP transport를 붙일 때는 아래를 먼저 확인하는 편이 좋습니다.

1. MCP endpoint가 실제로 `.../mcp`에서 응답하는지
2. 필요한 인증 헤더가 있는지
3. 서버가 세션 의존적인지
4. 타임아웃이나 재시도 정책을 agent 바깥에서 관리해야 하는지

특히 사내 서버는 "HTTP라서 stateless겠지"라고 넘기기 쉬운데, 실제 도구 동작은 서버 세션이나 인증 상태에 강하게 묶여 있을 수 있습니다. 이때는 `client.session(...)`과 인증 구성을 같이 검토해야 합니다.

## 자주 겪는 문제

### 1. `python` 경로 문제로 `stdio` 서버가 안 뜬다

Windows, WSL, venv 경로가 섞이면 `command: "python"`만으로는 실패할 수 있습니다.  
이럴 때는 가상환경의 절대 경로 Python을 넣는 편이 가장 확실합니다.

### 2. 상대 경로 기준이 달라서 서버 파일을 못 찾는다

`args: ["./math_server.py"]`는 현재 실행 위치에 따라 깨질 수 있습니다.  
자동화나 배포 환경이면 절대 경로를 쓰는 편이 안전합니다.

### 3. stateful 서버인데 `client.get_tools()`만 써서 상태가 계속 초기화된다

기본값은 stateless입니다.  
로그인 상태, transaction, 작업 컨텍스트를 유지해야 하는 서버라면 `client.session(...)` 기반으로 바꿔야 합니다.

### 4. tool 실패를 model이 삼켜서 디버깅이 어려워진다

도구 에러를 agent가 재시도하면서 겉으로는 조용해 보일 수 있습니다.  
개발 단계에서는 tracing을 켜고, 필요하면 `handle_tool_errors=False`로 바꿔서 예외를 노출시키는 편이 빠릅니다.

### 5. MCP가 만능 추상화라고 생각하고 너무 많은 책임을 몰아넣는다

MCP는 도구 연결 계층을 정리하는 데 강하지만, agent 정책까지 대신 설계해 주지는 않습니다.  
도구 선택 기준, 권한 분리, 실패 처리, human approval은 여전히 LangChain middleware나 상위 orchestration에서 설계해야 합니다.

## 추천 적용 순서

1. 먼저 로컬 `stdio` 서버 하나로 최소 예제를 통과시킨다.
2. `client.get_tools()`와 `create_agent(...)` 연결만 먼저 검증한다.
3. 그다음 HTTP 서버, 인증 헤더, 다중 서버 조합으로 확장한다.
4. 상태 유지가 필요해지는 시점에만 `client.session(...)`으로 올린다.
5. 운영 단계에서는 LangSmith tracing을 붙여 tool call 실패와 재시도 흐름을 같이 본다.

## 참고 자료

- [LangChain Python MCP docs](https://docs.langchain.com/oss/python/langchain/mcp)
- [LangChain agents docs](https://docs.langchain.com/oss/python/langchain/agents)
- [Model Context Protocol](https://modelcontextprotocol.io/introduction)
- [langchain-mcp-adapters](https://github.com/langchain-ai/langchain-mcp-adapters)
