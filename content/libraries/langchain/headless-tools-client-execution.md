---
title: LangChain headless tools로 브라우저 전용 도구를 client에서 실행하기
description: Python agent에는 schema-only tool만 등록하고 React useStream에서 실제 구현을 실행하는 LangChain headless tools 패턴 정리
date: 2026-06-28
tags:
  - langchain
  - agent
  - frontend
  - react
  - python
aliases:
  - "/blog/langchain-headless-tools-client-execution"
---

# LangChain headless tools로 브라우저 전용 도구를 client에서 실행하기

LangChain agent를 붙이다 보면 "이 도구는 서버가 아니라 사용자 브라우저에서만 실행할 수 있는데?"라는 순간이 자주 나온다.

- `navigator.geolocation`으로 현재 위치를 읽기
- `localStorage`나 IndexedDB에 개인 메모 저장하기
- clipboard, file picker, canvas 같은 브라우저 API 다루기
- 서버에 보내기 싫은 로컬 데이터만 읽어 답변에 반영하기

이럴 때 일반 `@tool` 함수처럼 서버에서 실행하려고 하면 구조가 어색해진다.  
LangChain 공식 문서에서는 이런 패턴을 `headless tools`로 설명한다.

핵심은 단순하다.

1. Python agent에는 "이름, 설명, 입력 스키마"만 있는 schema-only tool을 등록한다.
2. 실제 실행 코드는 React 같은 프런트엔드에서 `.implement(...)`로 붙인다.
3. agent가 해당 tool을 호출하면 run이 잠깐 interrupt 되고, client가 tool을 실행한 뒤 결과를 resume 한다.

즉 모델은 평범한 tool처럼 보지만, 실제 실행 위치만 브라우저로 옮기는 방식이다.

## 언제 특히 유용한가

- 사용자 위치, 로컬 설정, 임시 브라우저 메모리처럼 서버가 직접 접근할 수 없는 데이터가 필요할 때
- 민감한 데이터를 서버로 보내지 않고 agent 응답에만 반영하고 싶을 때
- "브라우저 상태를 읽는 작은 도구"를 많이 붙여 UI와 agent를 자연스럽게 연결하고 싶을 때
- 브라우저 액션을 human-in-the-loop처럼 명시적으로 보여 주고 싶을 때

반대로 서버에서 안전하게 실행 가능한 DB 조회, 사내 API 호출, 백오피스 액션은 굳이 headless tool로 만들 이유가 없다.

## 사전 준비

Python agent:

```bash
pip install -U langchain langchain-openai pydantic
```

React client:

```bash
npm install langchain @langchain/react zod
```

추가 전제:

- LangChain Python v1 계열
- React 쪽에서 `useStream`을 쓰는 LangChain frontend 패턴
- OpenAI 호환 chat model 하나

## 1. Python 쪽에서는 schema-only tool만 등록한다

공식 Python tools 문서 기준으로 `tool(...)`에 `name`, `description`, `args_schema`만 주면 LangChain은 `HeadlessTool`을 만든다.  
여기에는 서버 안에서 실행되는 함수 본문이 없다.

```python
from pydantic import BaseModel, Field

from langchain.agents import create_agent
from langchain.tools import tool


class BrowserMemoryPutArgs(BaseModel):
    key: str = Field(description="Browser-local memory key")
    value: str = Field(description="Value to store in the browser")


class BrowserMemoryGetArgs(BaseModel):
    key: str = Field(description="Browser-local memory key to read")


browser_memory_put = tool(
    name="browser_memory_put",
    description="Store a short note in the user's browser-local memory.",
    args_schema=BrowserMemoryPutArgs,
)

browser_memory_get = tool(
    name="browser_memory_get",
    description="Read a short note from the user's browser-local memory.",
    args_schema=BrowserMemoryGetArgs,
)


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[browser_memory_put, browser_memory_get],
    system_prompt=(
        "You are a personal assistant. "
        "Use browser memory tools when the user asks you to remember or recall "
        "device-local preferences."
    ),
)
```

중요한 점은 두 가지다.

- Python 쪽에는 `.implement(...)`가 없다.
- 이 tool이 호출되면 서버가 직접 실행하지 않고 interrupt/resume 흐름으로 넘어간다.

즉 "서버 tool"이 아니라 "서버에 등록된 client-executed tool schema"라고 이해하는 편이 정확하다.

## 2. 프런트엔드에서는 같은 정의를 공유하고 실제 구현을 붙인다

공식 JS frontend 문서는 tool 정의와 구현을 분리하라고 권장한다.  
이름과 입력 스키마는 서버와 client가 맞아야 하지만, 브라우저 API를 쓰는 코드는 client-only 모듈에 있어야 한다.

예를 들어 React 쪽에 아래처럼 구현할 수 있다.

```ts
import * as z from "zod";
import { tool } from "langchain";

export const browserMemoryPutDefinition = tool({
  name: "browser_memory_put",
  description: "Store a short note in the user's browser-local memory.",
  schema: z.object({
    key: z.string(),
    value: z.string(),
  }),
});

export const browserMemoryGetDefinition = tool({
  name: "browser_memory_get",
  description: "Read a short note from the user's browser-local memory.",
  schema: z.object({
    key: z.string(),
  }),
});

export const browserMemoryPut = browserMemoryPutDefinition.implement(
  async ({ key, value }) => {
    localStorage.setItem(`agent-memory:${key}`, value);
    return { ok: true, key };
  },
);

export const browserMemoryGet = browserMemoryGetDefinition.implement(
  async ({ key }) => {
    const value = localStorage.getItem(`agent-memory:${key}`);
    return value === null ? { found: false, key } : { found: true, key, value };
  },
);
```

실무에서는 `localStorage`보다 IndexedDB가 더 낫다.

- 구조화 데이터 저장이 쉽다
- 검색, 만료, 목록 조회 같은 기능으로 확장하기 쉽다
- 브라우저 탭을 닫아도 비교적 안정적으로 남는다

## 3. `useStream`에 구현을 넘기면 client가 자동으로 실행한다

LangChain JS frontend 문서 기준으로 `useStream({ tools: [...] })`에 구현된 tool들을 넘기면, agent가 해당 tool call을 만들었을 때 client가 실행하고 run resume까지 이어 준다.

```tsx
import { useStream } from "@langchain/react";

import { browserMemoryGet, browserMemoryPut } from "./impl";

const AGENT_URL = "http://localhost:2024";

export function Chat() {
  const stream = useStream({
    apiUrl: AGENT_URL,
    assistantId: "personal_assistant",
    tools: [browserMemoryPut, browserMemoryGet],
    onTool(event) {
      if (event.type === "start") {
        console.log("tool start", event.toolCall.name, event.toolCall.args);
      }
      if (event.type === "success") {
        console.log("tool success", event.toolCall.name, event.result);
      }
      if (event.type === "error") {
        console.error("tool error", event.toolCall.name, event.error);
      }
    },
  });

  return (
    <div>
      {stream.messages.map((message) => (
        <div key={message.id}>{message.text}</div>
      ))}
    </div>
  );
}
```

이 패턴의 장점은 agent 입장에서 특별한 분기 없이 tool calling 루프를 그대로 유지한다는 점이다.  
프런트엔드만 "이 tool은 브라우저에서 실행해야 한다"는 사실을 알고 있으면 된다.

## 4. 가장 실용적인 예제: 위치 읽고 저장한 뒤 다음 답변에 재사용하기

headless tool은 단발성 geolocation 읽기에서 특히 직관적이다.

```python
from pydantic import BaseModel
from langchain.tools import tool


class GeolocationArgs(BaseModel):
    save: bool = True


geolocation_get = tool(
    name="geolocation_get",
    description="Read the user's current browser geolocation.",
    args_schema=GeolocationArgs,
)
```

```ts
export const geolocationGet = geolocationGetDefinition.implement(async ({ save = true }) => {
  const position = await new Promise<GeolocationPosition>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject),
  );

  const result = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };

  if (save) {
    localStorage.setItem("agent-memory:user_location", JSON.stringify(result));
  }

  return result;
});
```

이제 agent는 아래 같은 흐름을 만들 수 있다.

1. 사용자가 "내 주변 러닝 코스 추천해 줘"라고 요청한다.
2. agent가 `geolocation_get` tool call을 만든다.
3. 브라우저가 위치 권한을 받고 좌표를 읽는다.
4. 결과를 agent run에 되돌린다.
5. agent가 좌표를 바탕으로 최종 답변을 만든다.

서버는 위치 권한을 직접 다루지 않아도 되고, 좌표를 영구 저장할지 말지도 client에서 통제할 수 있다.

## 흔한 함정

### 1. 서버와 client tool 이름이 조금이라도 다르면 안 된다

`browser_memory_put`과 `browserMemoryPut`처럼 이름 체계가 어긋나면 client가 해당 호출을 매칭하지 못한다.  
정의 파일을 공유하거나, 최소한 이름과 스키마를 한 곳에서 생성하는 편이 안전하다.

### 2. JSON 직렬화 안 되는 객체를 결과로 반환하면 깨진다

공식 문서도 브라우저 object 자체를 반환하지 말라고 안내한다.

- DOM node
- `FileSystemHandle`
- `ClipboardItem`
- class instance

대신 문자열, 숫자, 불리언, 배열, dict 같은 JSON-serializable 형태로 바꿔서 반환해야 한다.

### 3. 너무 큰 범용 브라우저 도구 하나로 몰아넣지 않는 편이 낫다

예를 들어 `run_browser_code(code: str)` 같은 도구는 편해 보여도 실제로는 위험하고 모델 품질도 불안정해진다.  
공식 문서가 권장하듯이 작은 typed tool 여러 개로 나누는 편이 낫다.

### 4. 민감한 client action에는 승인 단계를 같이 두는 편이 낫다

위치 읽기, 클립보드 쓰기, 파일 수정 같은 동작은 자동 실행보다 확인 UI가 더 안전하다.  
이럴 때는 headless tool에 `Human-in-the-Loop` 패턴을 같이 붙이는 편이 좋다.

## 운영 팁

- `stream.toolCalls`나 `onTool` 이벤트로 pending/success/error 상태를 UI에 보여 주면 디버깅이 쉬워진다.
- "사용자 기기에서만 실행"이라는 정책이 있다면 headless tool을 우선 검토할 가치가 크다.
- 로컬 메모리류는 저장 만료 시간과 삭제 경로를 함께 설계해야 나중에 UX가 덜 꼬인다.
- Python server 예제와 React client 예제를 따로 테스트해 두면 이름 불일치 문제를 빨리 찾을 수 있다.

## 마무리

headless tools는 "agent가 tool을 쓴다"는 추상화는 유지하면서, 실제 실행 위치만 브라우저로 옮기는 패턴이다.

정리하면:

1. Python agent에는 schema-only tool만 등록한다.
2. React client에서는 같은 tool 정의에 `.implement(...)`를 붙인다.
3. `useStream({ tools: [...] })`가 tool call 실행과 resume를 이어 준다.

브라우저 전용 API, 로컬 메모리, privacy-sensitive 데이터처럼 서버에서 다루기 어색한 요구가 들어오면, LangChain headless tools는 꽤 실용적인 기본 해법이다.

## 참고 자료

- [LangChain Python Tools](https://docs.langchain.com/oss/python/langchain/tools)
- [LangChain JavaScript Headless tools](https://docs.langchain.com/oss/javascript/langchain/frontend/headless-tools)
- [LangChain JavaScript Tools](https://docs.langchain.com/oss/javascript/langchain/tools)
- [LangChain Frontend overview](https://docs.langchain.com/oss/javascript/langchain/frontend/overview)
