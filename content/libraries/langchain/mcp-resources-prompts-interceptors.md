---
title: "LangChain MCP resource, prompt, interceptor로 서버 문맥 연결하기"
description: "LangChain MCP에서 get_resources(), get_prompt(), structured content artifact, interceptor를 활용해 서버 문맥을 agent에 연결하는 실전 노트"
date: 2026-06-15
tags:
  - langchain
  - mcp
  - agents
  - python
aliases:
  - "/blog/langchain-mcp-resources-prompts-interceptors"
---

# LangChain MCP resource, prompt, interceptor로 서버 문맥 연결하기

MCP를 LangChain agent에 한 번 붙이고 나면 다음 단계에서 금방 막힌다.

- 도구 호출 말고도 정책 문서나 템플릿 프롬프트를 서버에서 같이 가져오고 싶다.
- 사용자별 권한, 테넌트, API 키를 MCP tool 호출에 안전하게 주입하고 싶다.
- MCP tool이 반환한 구조화 데이터를 모델 대화와 별도로 다루고 싶다.

2026-06-15 기준 LangChain 공식 MCP 문서는 단순한 `client.get_tools()`를 넘어 `resource`, `prompt`, `structuredContent`, `tool_interceptor`까지 같이 설명한다. 이 글은 이미 "MCP 도구 연결"은 한 번 해봤다는 전제에서, 그 다음에 실무에서 바로 쓰게 되는 문맥 연결 기능만 정리한다.

이 글에서는 다음 흐름만 실전 기준으로 빠르게 정리한다.

- `get_resources()`로 문서/파일/레코드를 읽어 agent 문맥으로 쓰는 방법
- `get_prompt()`로 서버가 관리하는 prompt template를 불러오는 방법
- MCP tool의 `structuredContent`를 `ToolMessage.artifact`로 꺼내는 방법
- interceptor로 사용자별 runtime context를 주입하는 방법

## 언제 쓰면 좋은가

MCP 연동은 아래 상황에서 특히 실용적이다.

- 사내 정책 문서나 운영 핸드북을 agent가 직접 읽게 하고 싶을 때
- 코드 리뷰, 분석, 고객 응답 같은 템플릿 prompt를 서버에서 버전 관리하고 싶을 때
- 도구 호출 인자에 사용자 ID, 권한, 조직 정보를 자동 주입해야 할 때
- tool 결과의 JSON payload를 후처리나 UI 렌더링에 재사용하고 싶을 때

반대로 단순한 tool 호출만 있으면 먼저 `mcp-server-tools` 같은 기본 패턴만으로 충분하다. resource/prompt/interceptor는 "서버 쪽 문맥까지 함께 운영하고 싶다"는 요구가 생겼을 때 가치가 커진다.

## 사전 준비

공식 문서 기준 최소 설치는 아래 정도면 된다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langchain-mcp-adapters "langchain[openai]"
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langchain langchain-mcp-adapters "langchain[openai]"
$env:OPENAI_API_KEY="sk-..."
```

로컬 테스트용 MCP 서버가 있다면 더 좋지만, 이 글의 예제 자체는 "서버가 이미 resource/prompt/tool을 제공한다"는 전제만 있으면 된다.

## 1. resource는 "실행"보다 "읽기"가 필요할 때 쓴다

MCP resource는 파일, 데이터 레코드, 원격 응답 같은 읽기 전용 컨텍스트를 LangChain 쪽으로 가져오는 용도다. LangChain 문서에서는 `client.get_resources()`가 MCP resource를 `Blob`으로 변환해 준다고 설명한다.

운영 핸드북이나 정책 파일을 가져와 프롬프트에 주입하는 최소 예제는 아래처럼 쓸 수 있다.

```python
import asyncio

from langchain_mcp_adapters.client import MultiServerMCPClient


async def main():
    client = MultiServerMCPClient(
        {
            "docs": {
                "transport": "http",
                "url": "http://localhost:8001/mcp",
            },
        }
    )

    blobs = await client.get_resources(
        "docs",
        uris=["file:///srv/handbook/oncall.md"],
    )

    for blob in blobs:
        print(blob.metadata["uri"])
        print(blob.mimetype)
        print(blob.as_string())


if __name__ == "__main__":
    asyncio.run(main())
```

이 패턴은 아래 상황에서 특히 잘 맞는다.

- 에이전트가 참고해야 할 운영 문서가 서버 쪽에 있을 때
- 파일이나 레코드를 도구 실행 없이 읽어 와야 할 때
- "툴 호출 결과"가 아니라 "원본 근거"를 프롬프트에 붙이고 싶을 때

## 2. prompt는 앱 코드보다 서버에서 버전 관리하기 좋다

공식 문서 기준 `client.get_prompt()`는 MCP 서버가 노출한 prompt template를 LangChain message 목록으로 바꿔 준다. 이 방식은 시스템 프롬프트를 코드 배포와 분리하고 싶을 때 특히 좋다.

```python
import asyncio

from langchain.chat_models import init_chat_model
from langchain_mcp_adapters.client import MultiServerMCPClient


async def main():
    client = MultiServerMCPClient(
        {
            "prompts": {
                "transport": "http",
                "url": "http://localhost:8002/mcp",
            }
        }
    )

    messages = await client.get_prompt(
        "prompts",
        "code_review",
        arguments={"language": "python", "focus": "security"},
    )

    model = init_chat_model("openai:gpt-5.5")
    response = await model.ainvoke(messages)
    print(response.text())


if __name__ == "__main__":
    asyncio.run(main())
```

이 패턴의 장점은 명확하다.

- prompt 변경을 앱 릴리스와 분리할 수 있다.
- 여러 서비스가 같은 prompt template를 재사용하기 쉽다.
- prompt 인자를 서버가 통제하므로 운영 일관성이 좋아진다.

## 3. tool의 `structuredContent`는 artifact로 받는다

LangChain 문서에서 MCP의 꽤 유용한 부분은 `structuredContent`다. MCP tool이 사람이 읽을 텍스트 외에 기계가 읽을 구조화 payload를 반환하면, adapter가 이를 `ToolMessage.artifact["structured_content"]`에 담아 준다.

```python
import asyncio

from langchain.agents import create_agent
from langchain.messages import ToolMessage
from langchain_mcp_adapters.client import MultiServerMCPClient

async def main():
    client = MultiServerMCPClient(
        {
            "analytics": {
                "transport": "http",
                "url": "http://localhost:8003/mcp",
            }
        }
    )

    tools = await client.get_tools()
    agent = create_agent("openai:gpt-5.5", tools=tools)

    result = await agent.ainvoke(
        {"messages": [{"role": "user", "content": "지난주 매출을 요약해줘"}]}
    )

    for message in result["messages"]:
        if isinstance(message, ToolMessage) and message.artifact:
            structured = message.artifact["structured_content"]
            print(structured)


if __name__ == "__main__":
    asyncio.run(main())
```

이 구조는 아래 상황에서 유용하다.

- UI에 표 형태 결과를 렌더링하고 싶을 때
- 모델에게는 짧은 텍스트만 보이고, 애플리케이션은 원본 JSON을 유지하고 싶을 때
- tool 결과를 후처리 파이프라인으로 넘기고 싶을 때

## 4. interceptor는 MCP 서버와 LangChain runtime 사이를 잇는다

공식 문서에서 가장 실무적인 부분은 interceptor다. MCP 서버는 별도 프로세스라 LangChain runtime context, state, store를 직접 모른다. interceptor는 이 간극을 메워 사용자 정보나 정책을 tool 호출에 주입하게 해 준다.

예를 들어 사용자 ID를 도구 호출 인자로 자동 주입하려면 아래처럼 구성할 수 있다.

```python
from dataclasses import dataclass

from langchain.agents import create_agent
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.interceptors import MCPToolCallRequest


@dataclass
class Context:
    user_id: str


async def inject_user_id(request: MCPToolCallRequest, handler):
    runtime = request.runtime
    modified_request = request.override(
        args={**request.args, "user_id": runtime.context.user_id}
    )
    return await handler(modified_request)


client = MultiServerMCPClient(
    {
        "orders": {
            "transport": "http",
            "url": "https://mcp.example.com/mcp",
        }
    },
    tool_interceptors=[inject_user_id],
)

tools = await client.get_tools()
agent = create_agent("openai:gpt-5.5", tools, context_schema=Context)
```

이 방식은 다음 상황에서 특히 좋다.

- 사용자 권한/테넌트 정보를 모든 도구에 일관되게 전달해야 할 때
- 모델이 민감한 인자를 직접 생성하지 못하게 막고 싶을 때
- 장기 메모리 store 값을 읽어 툴 호출을 개인화하고 싶을 때

## 5. resource와 prompt도 stateful session으로 묶을 수 있다

공식 문서에서는 stateful 서버라면 `client.session("server_name")`을 열고 그 세션에서 tool/resource/prompt를 로드하는 방식을 권장한다. 예를 들어 로그인 상태나 캐시가 세션에 묶인 서버라면 이 패턴이 맞다.

```python
import asyncio

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.prompts import load_mcp_prompt
from langchain_mcp_adapters.resources import load_mcp_resources


async def main():
    client = MultiServerMCPClient(
        {
            "workspace": {
                "transport": "stdio",
                "command": "python",
                "args": ["./workspace_server.py"],
            }
        }
    )

    async with client.session("workspace") as session:
        handbook = await load_mcp_resources(
            session,
            uris=["file:///srv/project/handbook.md"],
        )
        review_prompt = await load_mcp_prompt(
            session,
            "code_review",
            arguments={"language": "python"},
        )

        print(handbook[0].as_string())
        print(review_prompt[0].content)


if __name__ == "__main__":
    asyncio.run(main())
```

기본 `MultiServerMCPClient`는 stateless이므로, 연속 호출 간 문맥 공유가 필요하면 이처럼 명시적으로 세션을 잡아 주는 편이 안전하다.

## 자주 틀리는 점

### 1. resource를 tool 대체재로만 생각하기 쉽다

resource는 "실행"보다 "근거 읽기"에 가깝다. 읽어온 텍스트를 모델 문맥에 넣거나 후처리하는 용도라는 점을 먼저 구분하는 편이 좋다.

### 2. prompt를 서버에서 가져오면 바로 agent system prompt처럼 동작한다고 생각하기 쉽다

`get_prompt()`는 message 목록을 돌려준다. 그 메시지를 어떤 모델 호출이나 에이전트 흐름에 넣을지는 애플리케이션이 정해야 한다.

### 3. structured content를 모델 대화 본문에서 찾으려 하면 놓친다

구조화 payload는 `ToolMessage.artifact` 쪽에 담긴다. UI나 후처리 파이프라인이 필요하면 이 값을 별도로 꺼내야 한다.

### 4. interceptor에서 사용자 비밀값을 모델 프롬프트에 노출시키면 안 된다

interceptor의 장점은 민감한 값을 모델이 아니라 도구 호출 경계에서 주입할 수 있다는 점이다. 모델 메시지 본문에 다시 넣어 버리면 장점이 사라진다.

### 5. stateful 요구가 없는데 모든 MCP 연결을 세션 기반으로 만들면 운영이 복잡해진다

문맥 공유가 필요할 때만 `client.session()`으로 올리고, 그렇지 않으면 stateless 기본값을 유지하는 편이 단순하다.

## 추천 적용 순서

1. 먼저 기존 MCP tool 연동을 안정화한다.
2. 그다음 운영 문서나 정책 파일을 `get_resources()`로 읽어 본다.
3. 반복되는 시스템 프롬프트를 `get_prompt()`로 옮긴다.
4. 사용자별 권한/ID 주입이 필요해지면 interceptor를 붙인다.
5. 마지막으로 structured content를 UI나 후처리에 연결한다.

이 순서가 운영 복잡도를 가장 덜 올린다.

## 참고 자료

- [LangChain Python MCP 문서](https://docs.langchain.com/oss/python/langchain/mcp)
- [LangChain Quickstart](https://docs.langchain.com/oss/python/langchain/quickstart)
- [LangChain Overview](https://docs.langchain.com/oss/python/langchain/overview)
- [Model Context Protocol 공식 사이트](https://modelcontextprotocol.io/introduction)
