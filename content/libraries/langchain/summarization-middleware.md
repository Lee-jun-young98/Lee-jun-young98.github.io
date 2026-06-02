---
title: LangChain SummarizationMiddleware로 긴 대화를 요약 메모리로 압축하기
description: LangChain SummarizationMiddleware로 긴 agent 대화의 오래된 메시지를 자동 요약하고 최근 메시지만 남겨 context 비용과 품질을 함께 관리하는 실전 가이드
date: 2026-06-02
tags:
  - langchain
  - agent
  - middleware
  - memory
  - python
---

# LangChain SummarizationMiddleware로 긴 대화를 요약 메모리로 압축하기

LangChain agent에 short-term memory를 붙이면 여러 turn을 이어서 기억할 수 있다.  
문제는 대화가 길어질수록 `messages`가 계속 불어나고, 결국 모델이 오래된 맥락에 끌리거나 비용과 지연이 커진다는 점이다.

이때 무조건 앞부분을 잘라 버리면 중요한 사실을 잃기 쉽다.

- 사용자가 초반에 알려 준 이름, 선호, 제약조건이 사라진다
- 이전 turn에서 합의한 작업 방식이 날아간다
- 최근 질문은 짧아도 전체 대화 길이 때문에 응답이 느려진다

LangChain은 이 문제를 위해 `SummarizationMiddleware`를 제공한다.  
공식 문서 기준으로 이 middleware는 오래된 메시지를 별도 모델 호출로 요약한 뒤, 그 요약을 state에 저장하고 최근 메시지만 남긴다. 즉 "이번 모델 호출에서만 잠깐 줄이는 것"이 아니라 이후 turn에도 계속 이어지는 요약 메모리를 만드는 방식이다.

이번 글에서는 아래만 실전 기준으로 정리한다.

- `SummarizationMiddleware`가 필요한 상황
- 가장 작은 동작 예제
- `trigger`, `keep`, `summary_prompt`를 어떻게 잡을지
- short-term memory, trim, context editing과 무엇이 다른지
- 운영에서 자주 생기는 실수

## 언제 쓰는가

이 middleware는 아래 같은 agent에서 특히 효과가 크다.

- 같은 사용자가 여러 질문을 이어 가는 상담형 챗봇
- 초반 요구사항을 계속 기억해야 하는 업무 보조 agent
- tool call보다 사람 대화 비중이 더 큰 assistant
- "앞에서 정한 규칙을 계속 유지해 달라"는 요청이 잦은 경우

반대로 아래 상황에서는 다른 방법이 먼저일 수 있다.

- 단발성 Q&A처럼 한두 turn으로 끝나는 요청
- 오래된 맥락보다 최신 검색 결과만 중요할 때
- tool output이 지나치게 길어서 메시지 요약보다 tool 결과 정리가 먼저 필요할 때

즉 요약 대상이 "사람과 agent의 대화 맥락"이라면 `SummarizationMiddleware`가 잘 맞고, "긴 tool output"이 문제라면 `ContextEditingMiddleware` 쪽이 더 직접적이다.

## 사전 준비

긴 대화를 이어서 요약하려면 thread 단위 state 저장이 필요하므로 checkpointer를 함께 붙이는 편이 현실적이다.

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

공식 문서의 핵심 패턴은 단순하다.

- 본문을 처리하는 메인 모델을 둔다
- 더 작은 모델로 오래된 메시지를 요약한다
- `trigger`로 언제 요약할지 정한다
- `keep`으로 최근 메시지를 얼마나 남길지 정한다

```python
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.runnables import RunnableConfig


checkpointer = InMemorySaver()

agent = create_agent(
    model="openai:gpt-5.4",
    tools=[],
    middleware=[
        SummarizationMiddleware(
            model="openai:gpt-5.4-mini",
            trigger={"tokens": 4000},
            keep={"messages": 20},
        )
    ],
    checkpointer=checkpointer,
)

config: RunnableConfig = {"configurable": {"thread_id": "demo-thread-1"}}

agent.invoke(
    {"messages": [{"role": "user", "content": "안녕, 내 이름은 민수고 제주도 여행을 준비 중이야."}]},
    config,
)

agent.invoke(
    {"messages": [{"role": "user", "content": "예산은 40만 원 정도고, 렌터카 없이 움직이고 싶어."}]},
    config,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "지금까지 조건을 반영해서 2박 3일 일정을 다시 정리해 줘."}]},
    config,
)

print(result["messages"][-1].content)
```

이 설정에서 중요한 점은 두 가지다.

- 요약은 `openai:gpt-5.4-mini`가 맡고, 본 응답은 메인 모델이 맡는다
- 요약 결과는 같은 `thread_id`의 state에 반영되므로 다음 turn도 그 요약을 이어서 본다

즉 단순 trim과 달리 "앞부분을 버리는 것"이 아니라 "앞부분을 압축해서 남기는 것"에 가깝다.

## 2. `trigger`와 `keep`은 어떻게 잡나

문서 기준으로 `trigger`는 요약 시작 조건이고, `keep`은 요약 후 남겨 둘 최근 문맥 양이다.

### `trigger`

`trigger`는 단일 조건이나 조건 배열로 줄 수 있다. 각 조건에는 아래 중 하나 이상을 넣는다.

- `tokens`: 절대 토큰 수 기준
- `messages`: 메시지 개수 기준
- `fraction`: 모델 context size 대비 비율

실무에서는 보통 `tokens`부터 시작하는 편이 안전하다.

```python
SummarizationMiddleware(
    model="openai:gpt-5.4-mini",
    trigger={"tokens": 5000},
    keep={"messages": 16},
)
```

`fraction`은 편해 보이지만, 공식 문서 기준 `langchain>=1.1`에서 모델 profile 정보가 있어야 안정적으로 동작한다. 프로필 정보가 확실하지 않다면 `tokens`나 `messages`로 시작하는 편이 덜 헷갈린다.

### `keep`

`keep`은 요약 뒤에도 원문으로 유지할 최근 컨텍스트 양이다.

- `{"messages": 20}`: 최근 메시지 20개 유지
- `{"tokens": 1500}`: 최근 1500토큰 정도 유지
- `{"fraction": 0.2}`: 모델 최대 입력의 20% 수준 유지

처음에는 최근 메시지를 넉넉하게 남기는 편이 좋다. 너무 공격적으로 줄이면 바로 직전 합의나 tool call 짝이 끊기면서 품질이 흔들릴 수 있다.

## 3. 조금 더 실전적인 설정

운영에서는 기본 프롬프트로도 충분할 때가 많지만, 요약이 어떤 사실을 꼭 남겨야 하는지 명시하면 안정성이 올라간다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langgraph.checkpoint.memory import InMemorySaver


SUMMARY_PROMPT = """
다음 대화 기록을 미래 turn에서 다시 사용할 수 있는 작업 메모로 요약하라.

- 사용자의 고정 선호
- 이미 결정된 제약조건
- 아직 끝나지 않은 작업
- 이후 답변에서 계속 유지해야 할 사실

대화 기록:
{messages}
"""


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[],
    middleware=[
        SummarizationMiddleware(
            model="openai:gpt-5.4-mini",
            trigger=[
                {"tokens": 5000},
                {"messages": 40},
            ],
            keep={"messages": 12},
            summary_prompt=SUMMARY_PROMPT,
            trim_tokens_to_summarize=3000,
        )
    ],
    checkpointer=InMemorySaver(),
)
```

여기서 볼 포인트는 네 가지다.

- `trigger=[...]`: 토큰이 많아지거나 메시지 수가 많아질 때 둘 중 하나만 만족해도 요약
- `summary_prompt=`: 반드시 남겨야 할 정보를 요약 모델에 명시
- `trim_tokens_to_summarize=`: 요약 모델에 넘길 입력 길이를 제한
- `keep={"messages": 12}`: 아주 최근 대화는 원문 그대로 유지

`summary_prompt`를 커스터마이즈할 때는 공식 문서 설명대로 `{messages}` placeholder를 반드시 포함해야 한다.

## 4. short-term memory, trim, context editing과 무엇이 다른가

세 기능은 같이 쓰일 수 있지만 역할이 다르다.

### short-term memory

- 같은 `thread_id`의 대화 state를 유지한다
- "기억을 이어 가는 기반"이다
- checkpointer가 핵심이다

### trim messages

- 오래된 메시지를 잘라 낸다
- 가장 단순하고 싸다
- 하지만 잘린 정보는 그대로 사라진다

### summarization

- 오래된 메시지를 요약문으로 압축해 state에 반영한다
- 정보 손실을 줄이면서 context를 줄이는 전략이다
- 별도 모델 호출이 추가되므로 비용과 지연이 생긴다

### context editing

- 주로 오래된 tool output을 정리한다
- "대화 요약"보다는 "쓸모없는 도구 결과 청소"에 가깝다

실무에서는 보통 이렇게 조합한다.

1. `checkpointer`로 short-term memory를 유지한다.
2. 대화가 길어지면 `SummarizationMiddleware`로 오래된 대화를 압축한다.
3. 검색 결과나 문서 chunk처럼 긴 tool output은 `ContextEditingMiddleware`로 별도 정리한다.

## 5. 운영에서 자주 생기는 실수

### 5-1. 요약이 일회성이라고 착각한다

공식 short-term memory 문서가 강조하듯, summarization은 state를 영구적으로 갱신하는 쪽에 가깝다.  
즉 이번 호출에서만 줄이고 끝나는 transient 처리라고 생각하면 안 된다.

같은 `thread_id`로 다음 turn을 호출하면 원문 전체가 아니라 "요약 + 최근 메시지" 조합이 이어진다.

### 5-2. `keep`을 너무 작게 잡는다

요약이 있다고 해서 최근 원문까지 거의 안 남기면 품질이 급격히 흔들릴 수 있다.

- 바로 직전 요구사항 재확인
- 방금 생성한 tool call과 대응 결과
- 마지막 몇 turn의 말투나 작업 흐름

이런 정보는 요약보다 원문이 더 강하다. 처음에는 `messages: 10~20` 정도로 보수적으로 두고 trace를 보며 줄이는 편이 낫다.

### 5-3. 요약 모델 비용을 무시한다

요약은 공짜가 아니다. 대화가 길수록 별도 모델 호출이 추가된다.

- 메인 모델보다 작은 모델을 요약 전용으로 둔다
- `trigger`를 너무 낮게 잡지 않는다
- `trim_tokens_to_summarize`로 요약 입력을 제한한다

이 세 가지를 같이 봐야 한다.

### 5-4. `thread_id` 없이 요약 메모리가 이어질 거라고 생각한다

요약 결과도 short-term memory state의 일부다.  
따라서 같은 thread를 식별할 `thread_id`가 안정적으로 유지되지 않으면 요약 히스토리도 이어지지 않는다.

### 5-5. tool-heavy agent에 대화 요약만 붙여 놓고 끝낸다

문제의 대부분이 긴 검색 결과나 문서 chunk라면 summarization만으로는 부족하다.  
그 경우에는 대화 요약보다 `ContextEditingMiddleware`가 먼저 효과를 낼 수 있다.

## 6. 언제 특히 유용한가

개인적으로 아래 패턴에서 실무성이 높다.

- 사용자의 제약조건이 turn을 넘어 누적되는 여행/쇼핑/상담 assistant
- 초반에 수집한 요구사항을 후반 계획 생성에 계속 반영해야 하는 planning agent
- 긴 세션이 잦지만 모든 원문을 통째로 다시 넣기에는 비용이 큰 B2B copilots

반대로 검색, RAG, 코드 탐색처럼 tool output이 비용의 대부분을 차지하는 agent라면 대화 요약보다 context editing이나 retrieval 설계가 더 우선일 수 있다.

## 마무리

`SummarizationMiddleware`는 "대화를 조금 덜 넣는 기법"이라기보다, 긴 대화를 미래 turn에서도 다시 쓸 수 있는 작업 메모로 압축하는 방법에 가깝다.

- short-term memory 위에서 동작하고
- 오래된 대화를 요약문으로 치환하며
- 최근 메시지는 `keep`으로 원문 보존하고
- 비용과 품질 사이를 `trigger`와 요약 모델로 조절한다

긴 대화형 agent를 만들고 있는데 trim만으로는 맥락이 자꾸 끊긴다면, 다음으로 붙여 볼 실전 기능이 바로 이 middleware다.

## 참고 자료

- [LangChain Prebuilt Middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [LangChain Short-term Memory](https://docs.langchain.com/oss/python/langchain/short-term-memory)
- [LangChain Context Engineering](https://docs.langchain.com/oss/python/langchain/context-engineering)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
