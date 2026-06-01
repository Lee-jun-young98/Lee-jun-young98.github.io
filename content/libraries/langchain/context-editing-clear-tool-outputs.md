---
title: LangChain ContextEditingMiddleware로 오래된 tool output 정리하기
description: LangChain의 ContextEditingMiddleware와 ClearToolUsesEdit로 긴 agent 대화에서 오래된 tool output을 정리해 비용과 컨텍스트 오염을 줄이는 실전 가이드
date: 2026-06-01
tags:
  - langchain
  - agent
  - middleware
  - context
  - python
---

# LangChain ContextEditingMiddleware로 오래된 tool output 정리하기

LangChain agent를 실전에 붙이면 생각보다 빨리 context가 더러워진다.

- 검색 도구가 긴 본문을 계속 반환한다
- DB 조회나 문서 검색 결과가 여러 turn 동안 누적된다
- 모델은 지금 필요한 질문보다 오래된 tool output에 더 끌리기 시작한다

이 문제는 short-term memory를 붙였다고 자동으로 해결되지 않는다.  
대화 기록은 유지해야 하지만, 모든 tool output을 끝까지 그대로 들고 가는 것은 대개 비효율적이다.

LangChain은 이런 상황을 위해 `ContextEditingMiddleware`를 제공한다.  
공식 문서 기준으로 이 middleware는 token 한도를 넘기기 시작할 때 오래된 tool output을 비우고, 최근 결과만 남기도록 conversation context를 편집한다.

이번 글에서는 아래만 실전 기준으로 정리한다.

- `ContextEditingMiddleware`가 필요한 상황
- `ClearToolUsesEdit`를 붙이는 최소 예제
- `keep`, `trigger`, `exclude_tools`를 어떻게 잡을지
- short-term memory, summarization과 어떻게 다르게 쓸지

## 언제 필요한가

아래 같은 agent는 context editing 효과가 크다.

- 검색, RAG, 문서 QA처럼 tool output이 긴 경우
- 웹 검색, DB 조회, 코드 검색을 여러 번 반복하는 경우
- 한 thread 안에서 많은 tool call이 쌓이는 운영형 챗봇
- 최신 tool result만 중요하고 오래된 결과는 다시 조회해도 되는 경우

반대로 tool output이 짧고, 이전 결과를 그대로 계속 참조해야 하는 워크플로우라면 너무 공격적으로 지우지 않는 편이 낫다.

## 사전 준비

`ContextEditingMiddleware`는 LangChain prebuilt middleware에 포함되어 있다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

OpenAI 예시:

```bash
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 가장 작은 예제

공식 문서의 핵심은 아주 단순하다.  
`ContextEditingMiddleware` 안에 `ClearToolUsesEdit`를 넣고, token 수가 일정 기준을 넘기면 오래된 tool result를 비운다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ContextEditingMiddleware, ClearToolUsesEdit
from langchain.tools import tool


@tool
def search_docs(query: str) -> str:
    """긴 문서 검색 결과를 반환한다."""
    return (
        f"[{query}] 검색 결과 본문 ... "
        "아주 긴 문단이 여러 개 이어진다고 가정하자. " * 40
    )


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[search_docs],
    middleware=[
        ContextEditingMiddleware(
            edits=[
                ClearToolUsesEdit(
                    trigger=2000,
                    keep=3,
                )
            ]
        )
    ],
    system_prompt="필요한 경우에만 검색하고, 최신 검색 결과를 우선 사용하라.",
)
```

이 설정의 의미는 다음과 같다.

- `trigger=2000`: 대화 전체 token 수가 이 기준을 넘으면 정리 시작
- `keep=3`: 가장 최근 3개의 tool result는 무조건 유지

즉, 오래된 검색 결과는 지우고 최근 결과만 남겨 모델이 최신 맥락에 집중하게 만든다.

## 2. 조금 더 실전적인 설정

실무에서는 모든 tool output을 똑같이 다루지 않는 편이 낫다.  
예를 들어 검색 결과는 지워도 되지만, 승인 로그나 결제 확인 결과는 남겨야 할 수 있다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ContextEditingMiddleware, ClearToolUsesEdit
from langchain.tools import tool


@tool
def search_docs(query: str) -> str:
    """제품 문서를 검색한다."""
    return f"{query} 검색 결과 " + ("긴 본문 " * 80)


@tool
def get_account_status(user_id: str) -> str:
    """현재 계정 상태를 조회한다."""
    return f"user_id={user_id} status=active plan=enterprise"


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[search_docs, get_account_status],
    middleware=[
        ContextEditingMiddleware(
            edits=[
                ClearToolUsesEdit(
                    trigger=2500,
                    keep=2,
                    clear_tool_inputs=False,
                    exclude_tools=["get_account_status"],
                    placeholder="[older tool output cleared]",
                )
            ],
            token_count_method="approximate",
        )
    ],
)
```

여기서 봐야 할 값은 네 가지다.

- `keep=2`: 최근 tool result 두 개는 유지
- `exclude_tools=["get_account_status"]`: 계정 상태 조회 결과는 지우지 않기
- `clear_tool_inputs=False`: 원래 tool call 인자는 남기기
- `placeholder=...`: 지워진 자리에 어떤 문구를 넣을지 지정

이렇게 하면 검색 결과처럼 긴 출력은 정리하되, 중요한 상태 조회 결과는 남길 수 있다.

## 3. `clear_tool_inputs`는 언제 켜나

공식 문서 기준으로 `clear_tool_inputs=True`를 주면, 오래된 tool output뿐 아니라 그 tool call 인자도 빈 객체로 치환된다.

이 옵션은 아래 상황에서 유용하다.

- tool 인자 자체가 매우 길다
- 검색 query나 필터 JSON이 커서 토큰을 많이 잡아먹는다
- 오래된 tool 사용 흔적 자체를 더 강하게 정리하고 싶다

반대로 디버깅이나 감사 관점에서 "무슨 인자로 호출했는지"가 중요하면 `False`로 두는 편이 낫다.

## 4. short-term memory, summarization과 뭐가 다른가

세 기능이 비슷해 보여도 역할이 다르다.

### short-term memory

- 같은 `thread_id` 안의 대화와 tool result를 이어서 기억하게 한다
- "기억을 유지하는 것"이 목적이다

### summarization

- 오래된 대화를 요약문으로 압축한다
- 앞부분 사실관계를 가능한 한 텍스트로 보존하려는 전략이다

### context editing

- 오래된 tool output을 과감히 비우거나 치운다
- "다시 가져와도 되는 긴 결과"를 줄여 현재 context를 가볍게 만드는 전략이다

실전에서는 보통 세 가지를 같이 쓴다.

1. short-term memory로 thread를 이어간다.
2. context editing으로 오래된 tool result를 비운다.
3. 정말 오래된 대화는 summarization으로 압축한다.

즉, context editing은 memory의 대체재가 아니라, memory를 운영 가능하게 만드는 정리 레이어에 가깝다.

## 5. 어떤 tool부터 정리할까

보통 아래 순서가 안전하다.

### 먼저 정리해도 되는 것

- 웹 검색 결과 원문
- 긴 문서 chunk 본문
- 재조회 가능한 DB result
- 중간 계산 로그

### 보수적으로 남겨야 하는 것

- 승인/거절 기록
- 결제, 주문, 계정 상태 같은 핵심 사실
- 후속 turn에서 직접 참조되는 tool 결과
- 사람이 봐야 하는 최종 산출물

핵심은 "토큰이 큰가"보다 "다시 가져와도 되는가"를 먼저 따지는 것이다.

## 6. 자주 막히는 포인트

### 6-1. `keep`를 너무 작게 잡는다

최근 tool result까지 같이 날려버리면 agent가 바로 직전 검색 결과도 잊어버린다.  
처음에는 2~3개 정도를 남기고 실제 trace를 보며 줄이는 편이 안전하다.

### 6-2. 중요한 상태 조회 결과까지 같이 지운다

모든 tool이 같은 성격은 아니다.  
중요한 tool은 `exclude_tools`로 분리하지 않으면, agent가 핵심 사실을 잃고 다시 불필요한 조회를 반복할 수 있다.

### 6-3. context editing만으로 모든 장기 맥락 문제를 해결하려 한다

이 middleware는 오래된 tool output을 비우는 용도다.  
사용자 선호, 장기 세션 정보, 앞부분 합의사항은 long-term memory, state, summarization 같은 다른 계층으로 다뤄야 한다.

### 6-4. trigger를 감으로만 잡는다

너무 높게 잡으면 이미 context가 무거워진 뒤에야 정리가 시작되고, 너무 낮게 잡으면 필요한 결과까지 자주 비워진다.  
초기에는 보수적으로 낮게 두고 LangSmith trace나 로그를 보면서 조정하는 편이 낫다.

## 7. 언제 특히 유용한가

개인적으로 아래 패턴에서 가장 실용적이다.

- RAG agent가 여러 문서를 검색하고 일부만 계속 참조하는 경우
- 검색 결과가 길지만 최신 1~3개만 중요할 때
- tool 호출 수가 많아 모델이 계속 옛날 검색 결과에 끌리는 경우
- 비용보다도 "현재 질문에 집중하지 못하는 문제"가 먼저 보일 때

이럴 때 context editing은 프롬프트를 다시 쓰는 것보다 더 직접적으로 효과가 난다.

## 마무리

LangChain의 `ContextEditingMiddleware`는 "대화를 잊게 만드는 기능"이라기보다 "오래된 tool output을 덜어내서 현재 질문에 집중하게 만드는 기능"에 가깝다.

- `trigger`로 언제 정리할지 정하고
- `keep`으로 최근 결과를 보호하고
- `exclude_tools`로 중요한 결과를 예외 처리하면
- 긴 agent 대화에서도 비용과 집중도를 같이 관리하기 쉬워진다

tool output이 긴 agent라면, memory나 summarization보다 먼저 붙여볼 만한 정리 장치다.

## 참고 자료

- [LangChain Prebuilt Middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain Custom Middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
