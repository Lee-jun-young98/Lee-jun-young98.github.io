---
title: "LangChain custom guardrails로 before_agent와 after_agent 안전 레이어 넣기"
description: "LangChain custom middleware에서 before_agent와 after_agent 훅을 사용해 요청을 조기 차단하고 최종 응답을 재검사하는 실전 guardrail 패턴 정리"
date: 2026-07-05
tags:
  - langchain
  - agent
  - middleware
  - guardrails
  - python
aliases:
  - "/blog/langchain-custom-guardrails-before-after-agent"
---

# LangChain custom guardrails로 before_agent와 after_agent 안전 레이어 넣기

`PIIMiddleware`나 `OpenAIModerationMiddleware`처럼 바로 붙일 수 있는 guardrail도 좋지만, 실제 서비스에서는 팀 정책을 그대로 코드로 강제해야 할 때가 많다.

예를 들어 이런 경우다.

- 금지 키워드가 들어온 요청은 모델 호출 전에 바로 차단하고 싶다
- 인증, 테넌트, rate limit 같은 세션 단위 검사를 agent 시작 시점에 넣고 싶다
- 최종 응답만 따로 다시 검사해서 unsafe 답변이면 치환하고 싶다

LangChain 공식 guardrails 문서와 custom middleware 문서 기준으로 이런 요구에는 `before_agent`와 `after_agent` 훅이 가장 직접적이다.

- `before_agent`: invocation당 한 번 실행된다. 요청 시작 전에 막기 좋다
- `after_agent`: 최종 응답 직전에 한 번 실행된다. 마지막 안전 검사에 맞다

이 글에서는 다음 흐름만 실전 기준으로 짚는다.

1. `before_agent`로 금지 요청을 조기 종료하기
2. `after_agent`로 최종 응답을 한 번 더 검사하기
3. built-in moderation, HITL과 역할을 어떻게 나눌지 정리하기

## 언제 이 패턴이 필요한가

다음 조건이면 custom guardrail이 built-in middleware보다 먼저 떠오르는 편이 맞다.

- 회사 정책이 단순한 PII masking보다 더 구체적이다
- 모델 호출 비용 자체를 줄이려면 초기에 차단해야 한다
- 사용자 입력과 최종 출력을 다른 규칙으로 검사해야 한다
- 차단 시점에 trace, audit, metrics용 상태를 같이 남기고 싶다

반대로 OpenAI moderation 하나로 충분한 제품이라면 먼저 `OpenAIModerationMiddleware`부터 붙이는 편이 더 빠르다.

## 사전 준비

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

## 1. `before_agent`로 요청을 시작 단계에서 차단하기

공식 guardrails 문서의 핵심은 간단하다.  
`before_agent`는 agent invocation마다 한 번만 돌기 때문에, 모델 호출 전에 끝내야 하는 규칙을 넣기 좋다.

아래 예제는 금지 키워드가 포함된 요청을 assistant 메시지로 바꿔서 즉시 종료한다.

```python
from typing import Any

from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, AgentState, hook_config
from langgraph.runtime import Runtime


class ContentFilterMiddleware(AgentMiddleware):
    def __init__(self, banned_keywords: list[str]):
        super().__init__()
        self.banned_keywords = [kw.lower() for kw in banned_keywords]

    @hook_config(can_jump_to=["end"])
    def before_agent(
        self,
        state: AgentState,
        runtime: Runtime,
    ) -> dict[str, Any] | None:
        if not state["messages"]:
            return None

        first_message = state["messages"][0]
        if first_message.type != "human":
            return None

        content = str(first_message.content).lower()
        if any(keyword in content for keyword in self.banned_keywords):
            return {
                "messages": [
                    {
                        "role": "assistant",
                        "content": "이 요청은 안전 정책상 처리할 수 없습니다. 다른 방식으로 질문해 주세요.",
                    }
                ],
                "jump_to": "end",
            }

        return None


agent = create_agent(
    model="openai:gpt-5.5-mini",
    tools=[],
    middleware=[
        ContentFilterMiddleware(
            banned_keywords=["exploit", "malware", "credential dump"]
        )
    ],
)
```

여기서 실무적으로 중요한 지점은 두 가지다.

- `@hook_config(can_jump_to=["end"])`가 있어야 조기 종료가 가능하다
- 차단 시 예외를 던지는 대신 assistant 메시지를 반환하면 UI에서 일반 응답처럼 다루기 쉽다

## 2. `after_agent`로 최종 응답만 다시 검사하기

입력은 안전해 보여도 도구 결과나 모델 추론을 거치면서 최종 응답이 문제가 될 수 있다.  
이럴 때는 `after_agent` 훅으로 마지막 `AIMessage`만 다시 확인하는 편이 단순하다.

아래 예제는 별도 안전성 평가 모델을 써서 최종 응답을 `SAFE`/`UNSAFE`로만 판정한다.

```python
from typing import Any

from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, AgentState, hook_config
from langchain.chat_models import init_chat_model
from langchain.messages import AIMessage
from langgraph.runtime import Runtime


class SafetyReviewMiddleware(AgentMiddleware):
    def __init__(self):
        super().__init__()
        self.reviewer = init_chat_model("openai:gpt-5.5-mini")

    @hook_config(can_jump_to=["end"])
    def after_agent(
        self,
        state: AgentState,
        runtime: Runtime,
    ) -> dict[str, Any] | None:
        if not state["messages"]:
            return None

        last_message = state["messages"][-1]
        if not isinstance(last_message, AIMessage):
            return None

        review = self.reviewer.invoke(
            [
                {
                    "role": "user",
                    "content": (
                        "다음 답변이 안전하고 적절하면 SAFE, 아니면 UNSAFE만 답하세요.\n\n"
                        f"답변: {last_message.text()}"
                    ),
                }
            ]
        )

        if "UNSAFE" in review.text():
            last_message.content = (
                "이 답변은 안전 정책에 맞지 않아 그대로 제공할 수 없습니다. "
                "질문 범위를 좁혀 다시 요청해 주세요."
            )

        return None


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[],
    middleware=[SafetyReviewMiddleware()],
)
```

이 패턴은 다음 상황에서 특히 실용적이다.

- 고객 응답 초안, 내부 문서 요약처럼 최종 문장 품질이 중요할 때
- 여러 tool을 거친 뒤 마지막 응답만 별도로 통제하고 싶을 때
- moderation 결과를 바로 block하지 않고 서비스 문구로 치환하고 싶을 때

## 3. 두 레이어를 같이 붙이면 역할이 분리된다

`before_agent`와 `after_agent`를 함께 쓰면 "초기 차단"과 "최종 치환"을 분리할 수 있다.

```python
agent = create_agent(
    model="openai:gpt-5.5",
    tools=[],
    middleware=[
        ContentFilterMiddleware(
            banned_keywords=["credential dump", "steal session cookie"]
        ),
        SafetyReviewMiddleware(),
    ],
)
```

권장 역할 분리는 보통 아래처럼 잡으면 된다.

- `before_agent`: 인증, 테넌트, 금지 요청, rate limit, coarse policy
- `before_model`/`after_model`: 메시지 단위 변환, context trimming, tool 결과 조정
- `after_agent`: 최종 응답 안전성, 문체, 컴플라이언스 최종 확인

## 자주 막히는 점

### 1. `before_agent`에서 모든 메시지를 검사하려고 한다

`before_agent`는 invocation 시작 시점 훅이다.  
대화가 길어졌을 때 매 모델 호출마다 검사하고 싶다면 `before_model`이 더 맞다.

### 2. `jump_to="end"` 없이 조기 종료를 기대한다

문서 예제처럼 `hook_config(can_jump_to=["end"])`를 선언하지 않으면 종료 점프로 이어지지 않는다.

### 3. `after_agent`에서 tool 결과 검사를 대신하려 한다

`after_agent`는 최종 응답만 다루기 쉽다.  
도구 결과가 모델 컨텍스트로 들어가기 전에 막아야 하면 built-in moderation이나 `after_model`, `wrap_tool_call` 쪽이 더 적절하다.

### 4. guardrail과 approval을 같은 문제로 본다

콘텐츠 안전성과 실행 권한은 별개다.  
메일 발송, DB 수정처럼 행위 승인이 필요하면 `HumanInTheLoopMiddleware`를 따로 둬야 한다.

### 5. 안전성 평가용 모델 호출 비용을 무시한다

`after_agent`에 별도 모델을 두면 final response마다 호출이 하나 더 생긴다.  
트래픽이 높으면 모든 요청에 붙이지 말고 특정 route, 특정 tool 사용 후 응답에만 적용하는 편이 낫다.

## 어떤 조합으로 시작하면 좋은가

개인적으로는 아래 순서가 무난하다.

1. 금지 요청 차단: `before_agent`
2. 기본 안전성 레이어: `OpenAIModerationMiddleware` 또는 `PIIMiddleware`
3. 민감 행위 승인: `HumanInTheLoopMiddleware`
4. 최종 문장 재검사: `after_agent`

이렇게 나누면 각 레이어가 무엇을 막는지 명확해지고, 장애가 나도 어느 단계가 원인인지 빠르게 보인다.

## 한 줄 정리

LangChain custom guardrail의 핵심은 "모델 호출 전에 막을 것은 `before_agent`에서, 최종 답변으로 나가기 전에 다시 볼 것은 `after_agent`에서 처리한다"로 이해하면 된다.  
정책이 제품별로 달라지는 순간 built-in middleware만으로는 부족해지고, 이 두 훅이 가장 먼저 실무에 들어온다.

## 참고 자료

- [LangChain Guardrails](https://docs.langchain.com/oss/python/langchain/guardrails)
- [LangChain Custom Middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
- [LangChain Middleware Overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
