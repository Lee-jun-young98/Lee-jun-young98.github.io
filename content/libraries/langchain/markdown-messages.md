---
title: "LangChain markdown messages로 스트리밍 응답을 읽기 좋은 UI로 렌더링하기"
description: "useStream과 React markdown 렌더러를 조합해 LangChain 에이전트의 스트리밍 메시지를 코드 블록, 표, 리스트까지 자연스럽게 표시하는 방법을 정리한 실전 노트"
date: 2026-06-29
tags:
  - langchain
  - frontend
  - react
  - agents
aliases:
  - "/blog/langchain-markdown-messages"
---

# LangChain markdown messages로 스트리밍 응답을 읽기 좋은 UI로 렌더링하기

LangChain 에이전트 결과를 브라우저에서 바로 보여 주면 금방 티가 나는 부분이 있다.

- 코드 블록이 줄바꿈 없이 한 덩어리로 붙는다.
- 리스트, 표, 인용문이 plain text처럼 보여 읽기 어렵다.
- 토큰이 스트리밍되는 동안 매 렌더마다 마크다운 파싱 비용이 커진다.

2026년 6월 29일 기준 LangChain 프런트엔드 문서의 `markdown messages` 패턴은 이 문제를 꽤 단순하게 푼다.

1. 백엔드는 일반 `create_agent` 그대로 둔다.
2. 프런트엔드는 `useStream`으로 메시지를 받는다.
3. assistant 메시지의 텍스트만 마크다운으로 렌더링한다.
4. 필요하면 코드 하이라이팅과 메모이제이션을 얹는다.

즉, agent 로직을 바꾸기보다 UI 계층에서 메시지 표현을 개선하는 접근이다.

## 언제 쓰면 좋은가

아래 같은 화면이면 markdown messages 패턴이 바로 효과가 난다.

- 코드 예제, SQL, 쉘 명령을 자주 반환하는 개발자용 에이전트
- 요약, 비교표, 체크리스트를 자주 주는 리서치 도우미
- 운영 가이드, 런북, 문서 초안을 작성하는 내부 업무용 에이전트
- headless tool 결과와 일반 답변을 같은 채팅 화면에 함께 보여 주는 UI

반대로 카드형 structured output이 중심인 화면이라면 모든 답을 마크다운으로 그리기보다 typed response UI와 섞어 쓰는 편이 낫다.

## 사전 준비

백엔드:

```bash
pip install -U langchain langchain-openai
```

프런트엔드:

```bash
npm install @langchain/react react-markdown remark-gfm rehype-highlight
```

## 1. 백엔드는 특별한 설정이 필요 없다

공식 문서 기준 markdown messages 패턴은 "단순한 chat agent + 프런트엔드 렌더링"에 가깝다.
즉, 백엔드에서 마크다운 전용 포맷터나 별도 stream 프로토콜을 추가할 필요가 없다.

```python
from langchain.agents import create_agent


agent = create_agent(
    model="openai:gpt-5-nano",
    system_prompt=(
        "당신은 개발자 도우미다. 코드 예제, 표, 체크리스트가 필요하면 Markdown으로 답하라."
    ),
)
```

실무에서는 system prompt에 "코드는 fenced code block으로 감싸라", "비교는 표로 정리하라" 정도만 명시해도 결과가 꽤 안정된다.

## 2. `useStream`으로 assistant 메시지를 받는다

프런트엔드에서는 `useStream`이 thread 상태와 메시지 스트림을 관리한다.
공식 예제 기준 `useStream`은 각 AI 메시지에 누적된 텍스트를 `msg.text`로 노출한다.
중요한 점은 모든 메시지를 마크다운으로 그리지 않고 assistant 텍스트 메시지에만 적용하는 것이다.

```tsx
import { useStream } from "@langchain/react"
import { AIMessage, HumanMessage } from "langchain"

export function Chat() {
  const thread = useStream({
    apiUrl: "http://localhost:2024",
    assistantId: "simple_agent",
  })

  return (
    <div>
      {thread.messages.map((msg) => {
        if (AIMessage.isInstance(msg)) {
          return <div key={msg.id}>Agent</div>
        }

        if (HumanMessage.isInstance(msg)) {
          return <div key={msg.id}>You</div>
        }

        return null
      })}
    </div>
  )
}
```

여기까지는 일반 채팅과 같다.
다음 단계에서 assistant 텍스트 부분만 마크다운 렌더러로 바꾼다.

## 3. assistant 텍스트만 마크다운으로 렌더링한다

가장 단순한 형태는 `react-markdown` 조합이다.

```tsx
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import { useStream } from "@langchain/react"
import { AIMessage, HumanMessage } from "langchain"

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
      {content}
    </ReactMarkdown>
  )
}

export function ChatMessages() {
  const stream = useStream({
    apiUrl: "http://localhost:2024",
    assistantId: "simple_agent",
  })

  return (
    <div>
      {stream.messages.map((msg) => {
        if (HumanMessage.isInstance(msg)) {
          return <p key={msg.id}>{msg.text}</p>
        }

        if (AIMessage.isInstance(msg)) {
          return <AssistantMarkdown key={msg.id} content={msg.text} />
        }

        return null
      })}
    </div>
  )
}
```

이 패턴이면 아래가 바로 개선된다.

- fenced code block 렌더링
- GFM 표와 체크박스
- heading, blockquote, ordered list
- 스트리밍 중 점진적으로 자라는 assistant 답변 표시

## 4. 스트리밍 중 성능이 흔들리면 마크다운 렌더를 메모이제이션한다

스트리밍 응답은 토큰이 올 때마다 다시 렌더링되므로 긴 답변에서 `react-markdown` 비용이 눈에 띌 수 있다.
특히 코드 블록이 길거나 메시지 수가 많은 화면에서는 memoization이 실전에서 꽤 중요하다.

```tsx
import { memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const MemoizedMarkdown = memo(function MemoizedMarkdown({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
})
```

보통은 아래 순서로 최적화하면 충분하다.

1. assistant 메시지에만 마크다운 적용
2. message row를 `memo`로 분리
3. 코드 블록 하이라이팅은 정말 필요한 화면에만 사용
4. 매우 긴 응답은 서버에서 표·리스트 구조를 더 안정적으로 유도

## 5. headless tools, structured output과 어떻게 섞나

markdown messages는 "텍스트 답변을 보기 좋게 렌더링"하는 패턴이다.
그래서 아래처럼 역할을 나눠 두면 UI가 덜 꼬인다.

- 일반 설명, 코드 예제, 요약: markdown messages
- 승인 카드, 파일 카드, 위치 카드: tool-call 전용 UI
- 표준화된 JSON 응답: structured output 전용 컴포넌트

즉, 모든 결과를 마크다운 하나로 처리하려고 하지 않는 편이 유지보수에 유리하다.

## 자주 막히는 지점

### 1. 사용자 메시지까지 전부 마크다운으로 렌더링한다

보통은 assistant 메시지만 마크다운으로 처리하면 충분하다.
사용자 입력까지 동일한 파이프라인에 태우면 불필요한 렌더 비용과 스타일 차이가 생긴다.

### 2. `message.content` 구조를 문자열 하나라고 가정한다

공식 프런트엔드 패턴은 누적된 텍스트를 `msg.text`로 바로 주지만, tool call이나 다른 UI 상태와 섞기 시작하면 메시지 타입 구분이 중요해진다.
최소한 `AIMessage.isInstance(msg)`와 `HumanMessage.isInstance(msg)` 정도는 분기해 두는 편이 안전하다.

### 3. 코드 하이라이팅을 기본값처럼 켠다

`rehype-highlight`나 유사 플러그인은 보기에는 좋지만 스트리밍 중에는 비용이 있다.
운영 화면에서 느리면 하이라이팅을 끄고 plain fenced block만 유지하는 편이 낫다.

### 4. 마크다운이 항상 구조적으로 잘 나온다고 기대한다

UI만 바꿔도 개선은 크지만, 표와 리스트 품질은 결국 모델 출력 습관에도 영향을 받는다.
system prompt에 "코드는 fenced block", "비교는 표", "단계는 numbered list" 정도를 명시하면 흔들림이 줄어든다.

## 실무 체크리스트

1. 백엔드는 일반 `create_agent` 그대로 시작한다.
2. 프런트엔드에서 `useStream`으로 thread 상태를 받는다.
3. assistant 텍스트 content만 추출해 마크다운 렌더러에 넣는다.
4. 코드 하이라이팅은 필요할 때만 추가한다.
5. 긴 스트리밍 응답이 많으면 memoization을 붙인다.
6. tool 카드나 structured output은 마크다운과 별도 레이어로 유지한다.

## 참고 자료

- [Markdown messages](https://docs.langchain.com/oss/javascript/langchain/frontend/markdown-messages)
- [Frontend overview](https://docs.langchain.com/oss/javascript/langchain/frontend/overview)
- [Integration overview](https://docs.langchain.com/oss/javascript/langchain/frontend/integrations/overview)
- [Headless tools](https://docs.langchain.com/oss/javascript/langchain/frontend/headless-tools)
