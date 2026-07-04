---
title: "LangChain server-side tool use로 web_search를 provider 쪽에서 실행하기"
description: "LangChain에서 provider 내장 도구를 bind_tools로 붙여 server-side web_search를 실행하고, content_blocks와 client-side tool calling 차이를 확인하는 실전 노트"
date: 2026-07-04
tags:
  - langchain
  - python
  - tools
  - openai
aliases:
  - "/blog/langchain-server-side-tool-use"
---

# LangChain server-side tool use로 web_search를 provider 쪽에서 실행하기

LangChain에서 tool calling을 생각하면 보통 Python 함수에 `@tool`을 붙이고, 모델이 tool call을 만들면 우리 서버가 그 함수를 실행한 뒤 `ToolMessage`를 다시 넘기는 흐름을 먼저 떠올린다.

그런데 최신 LangChain 문서에는 다른 축이 하나 더 있다.  
일부 provider는 `web_search`, code interpreter 같은 내장 도구를 provider 서버 안에서 직접 실행한다. LangChain에서는 이 패턴을 server-side tool use로 다룬다.

이 방식이 useful한 이유는 단순하다.

- 직접 검색 API 래퍼를 만들지 않아도 된다
- 검색 실행과 결과 요약이 한 번의 모델 호출 안에서 끝난다
- 응답 안에 tool invocation/result와 citation block이 함께 들어올 수 있다

반대로 회사 내부 DB, 결제, 파일 수정처럼 우리 시스템의 결정론적 로직을 건드려야 하는 작업은 여전히 client-side tool이 더 맞다.

## 언제 쓰면 좋은가

다음 조건이면 server-side tool use를 먼저 검토할 만하다.

- 빠르게 웹 검색형 assistant를 붙이고 싶다
- provider가 지원하는 기본 도구만으로 충분하다
- 우리 앱 서버에서 별도 검색 함수나 브라우저 자동화를 직접 관리하고 싶지 않다
- 검색 결과 citation이나 reasoning block을 그대로 받고 싶다

반대로 아래 조건이면 일반 tool calling이 더 낫다.

- 반드시 사내 API나 데이터베이스를 호출해야 한다
- tool 실행 결과를 우리 코드에서 검증하거나 수정해야 한다
- tool 호출 전후에 human approval, 정책 검사, 감사 로깅을 강하게 넣어야 한다

## 사전 준비

LangChain 공식 설치 문서 기준으로 provider 연동 패키지는 별도다.  
OpenAI 예시라면 아래처럼 준비한다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langchain-openai
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langchain langchain-openai
$env:OPENAI_API_KEY="sk-..."
```

## 1. 가장 작은 예제: `bind_tools([{"type": "web_search"}])`

LangChain 공식 모델 문서 기준으로 server-side tool use는 chat model에 provider 내장 tool spec을 바인딩해서 시작한다.

```python
from langchain.chat_models import init_chat_model

model = init_chat_model("gpt-5.4-mini")

web_search = {"type": "web_search"}
model_with_tools = model.bind_tools([web_search])

response = model_with_tools.invoke("오늘 나온 긍정적인 뉴스 한 가지를 요약해줘.")

for block in response.content_blocks:
    print(block)
```

여기서 핵심은 세 가지다.

- `@tool` 함수가 없다
- 검색 실행은 provider 서버에서 이뤄진다
- 결과 확인은 `response.content_blocks`가 기준이다

## 2. 응답은 `ToolMessage`가 아니라 content block 묶음으로 온다

client-side tool calling과 가장 다른 점이 여기다.

- client-side: 모델이 tool call 생성 -> 우리 코드가 함수 실행 -> `ToolMessage`를 다시 모델에 전달
- server-side: provider가 tool 실행까지 내부에서 처리 -> 최종 응답에 tool call/result block이 함께 포함

실제로 공식 문서 예시에는 아래 같은 block들이 포함된다.

- `server_tool_call`
- `server_tool_result`
- `text`
- 경우에 따라 citation annotation

디버깅할 때는 텍스트만 바로 꺼내기보다 block 전체를 먼저 보는 편이 좋다.

```python
for block in response.content_blocks:
    block_type = block.get("type")
    print(f"{block_type=}")
    print(block)
    print("-" * 40)
```

검색어가 어떻게 생성됐는지, provider가 도구를 실제로 썼는지, citation이 붙었는지를 이 단계에서 확인할 수 있다.

## 3. 앱 바깥으로 넘길 때는 `content_blocks`를 같이 저장하는 편이 낫다

server-side tool use의 장점은 응답 텍스트만이 아니라 실행 흔적도 같이 남는다는 점이다.  
특히 검색형 assistant라면 아래 정보가 나중에 꽤 중요하다.

- 어떤 검색 도구가 호출됐는지
- 어떤 query가 만들어졌는지
- citation이 붙었는지
- provider가 준 tool result status가 성공인지

예를 들어 API 응답 로그를 남길 때 텍스트만 저장하지 말고 block도 같이 보관하는 식이 실용적이다.

```python
payload = {
    "text": response.text(),
    "content_blocks": response.content_blocks,
}

print(payload)
```

## 4. 언제 `create_agent`보다 이 패턴이 더 단순한가

검색 하나만 필요할 때는 agent loop 자체가 과한 경우가 있다.  
그럴 때는 `create_agent(..., tools=[...])`까지 가지 않고 model-level server-side tool use가 더 단순하다.

다음 같은 경우가 대표적이다.

- "최신 뉴스 찾아서 짧게 요약" 같은 단일 turn 검색 assistant
- 사내 앱에서 검색 결과 citation만 빠르게 붙이고 싶을 때
- 별도 tool schema 설계보다 provider 내장 검색을 먼저 검증하고 싶을 때

반대로 여러 tool을 섞어 계획을 세우고, 상태를 유지하고, middleware를 붙여야 한다면 LangChain agent가 다시 유리해진다.

## 자주 막히는 점

### 1. 모든 모델이 server-side tool use를 지원한다고 생각한다

공식 문서 기준으로 "일부 provider"만 지원한다.  
실제로 어떤 도구가 가능한지는 provider integration 페이지를 따로 확인해야 한다.

### 2. `@tool` 함수와 같은 방식으로 동작한다고 생각한다

server-side tool use에는 우리가 실행하는 Python 함수가 없다.  
따라서 tool 내부 로깅, 사내 권한 검사, 결과 후처리를 함수 안에서 하던 패턴을 그대로 옮길 수 없다.

### 3. 결과가 항상 평문 문자열이라고 가정한다

server-side tool call 흔적은 `content_blocks`에 들어갈 수 있다.  
UI, 저장소, 디버깅 코드가 문자열만 기대하면 중요한 정보를 놓치기 쉽다.

### 4. 사내 시스템 연동에도 그대로 쓰려 한다

이 패턴은 provider가 가진 내장 도구를 쓰는 방식이다.  
주문 조회, 사내 검색, 결제 승인 같은 것은 일반 LangChain tool이나 MCP tool로 붙여야 한다.

### 5. 최신성 요구를 우리 코드가 제어한다고 착각한다

검색은 provider가 수행하므로 검색 범위, 도구 정책, citation 표현은 provider 동작에 영향을 받는다.  
정확한 운영 제어가 필요하면 client-side search stack이 더 적합할 수 있다.

## 한 줄 정리

LangChain의 server-side tool use는 "tool을 우리가 실행하는 구조"가 아니라 "provider가 내장 도구를 실행하고 그 흔적을 content block으로 돌려주는 구조"다.  
웹 검색형 assistant를 가장 작게 붙일 때는 꽤 강력하지만, 내부 시스템 제어가 필요하면 여전히 client-side tool calling이 기본 선택지다.

## 참고 자료

- [LangChain Models](https://docs.langchain.com/oss/python/langchain/models)
- [LangChain Tools](https://docs.langchain.com/oss/python/langchain/tools)
- [LangChain Messages](https://docs.langchain.com/oss/python/langchain/messages)
- [LangChain Install Guide](https://docs.langchain.com/oss/python/langchain/install)
