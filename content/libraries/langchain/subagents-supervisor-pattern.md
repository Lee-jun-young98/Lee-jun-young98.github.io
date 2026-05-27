---
title: LangChain subagents로 역할 분리된 에이전트 만들기
description: LangChain multi-agent 패턴에서 supervisor가 subagent를 tool처럼 호출하도록 구성하는 실전 입문 가이드
date: 2026-05-27
tags:
  - langchain
  - agent
  - multi-agent
  - python
---

# LangChain subagents로 역할 분리된 에이전트 만들기

단일 agent는 빠르게 만들기 좋다.  
하지만 조금만 기능이 늘어나도 이런 문제가 생긴다.

- 검색도 하고 글도 써야 한다
- 일정 관련 질문과 코드 관련 질문을 한 agent가 다 받는다
- system prompt가 길어질수록 역할 경계가 흐려진다

이럴 때 자주 쓰는 패턴이 supervisor + subagents 구조다.  
상위 agent 하나가 사용자 입력을 받고, 특정 작업이 필요하면 하위 agent를 tool처럼 호출하는 방식이다.

LangChain 공식 multi-agent 문서도 이 패턴을 핵심 출발점으로 설명한다.  
특히 처음에는 복잡한 handoff보다 "subagent를 tool로 감싸는 방식"이 구현과 디버깅이 더 쉽다.

이번 글에서는 아래를 빠르게 정리한다.

- subagent 패턴이 단일 agent보다 나은 경우
- supervisor가 하위 agent를 호출하는 최소 예제
- 어떤 기준으로 역할을 나눌지
- 자주 생기는 실수

## 언제 subagent가 필요한가

아래 경우에는 한 agent에 모든 책임을 몰아넣기보다 역할을 나누는 편이 낫다.

- 검색과 요약, 글쓰기처럼 작업 성격이 다른 경우
- 도구 집합이 역할별로 뚜렷하게 다른 경우
- 프롬프트가 길어져 한 agent가 일관성을 잃는 경우
- 평가 기준이 역할마다 다른 경우

예를 들어 "문서 조사 agent"와 "최종 답변 작성 agent"를 나누면, 어느 단계에서 품질이 흔들리는지 보기 훨씬 쉬워진다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

OpenAI 사용 예시:

```bash
export OPENAI_API_KEY="your-api-key"
```

## 1. supervisor가 subagent를 호출하는 최소 예제

아래 예제에서는 두 개의 하위 agent를 만든다.

- `research_agent`: 먼저 필요한 사실을 정리
- `writer_agent`: 받은 자료를 바탕으로 답변 문장 작성

그리고 최상위 supervisor agent가 두 하위 agent를 tool처럼 호출한다.

```python
from langchain.agents import create_agent
from langchain.tools import tool


research_agent = create_agent(
    model="openai:gpt-5.4",
    tools=[],
    system_prompt="너는 조사 담당 agent다. 질문의 핵심 사실을 짧은 bullet로 정리하라.",
)


writer_agent = create_agent(
    model="openai:gpt-5.4",
    tools=[],
    system_prompt="너는 작성 담당 agent다. 받은 조사 내용을 바탕으로 자연스러운 한국어 답변을 작성하라.",
)


@tool
def ask_researcher(question: str) -> str:
    """질문에 필요한 핵심 사실과 조사 포인트를 정리한다."""
    result = research_agent.invoke(
        {"messages": [{"role": "user", "content": question}]}
    )
    return result["messages"][-1].content


@tool
def ask_writer(notes: str) -> str:
    """조사 내용을 바탕으로 최종 한국어 답변 초안을 만든다."""
    result = writer_agent.invoke(
        {"messages": [{"role": "user", "content": notes}]}
    )
    return result["messages"][-1].content


supervisor = create_agent(
    model="openai:gpt-5.4",
    tools=[ask_researcher, ask_writer],
    system_prompt=(
        "너는 supervisor agent다. "
        "정보가 부족하면 ask_researcher를 먼저 사용하고, "
        "최종 응답을 만들 때 ask_writer를 사용하라."
    ),
)

result = supervisor.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "LangChain과 LangGraph 차이를 5문장 이내로 설명해줘.",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

이 예제의 장점은 명확하다.

- supervisor는 라우팅에 집중한다
- subagent는 각자 한 가지 역할만 가진다
- 나중에 각 agent를 독립적으로 교체하거나 평가하기 쉽다

## 2. 역할을 나눌 때 기준

subagent를 나눌 때는 "모델을 여러 개 쓰고 싶다"보다 "책임을 어디서 자를지"가 더 중요하다.

좋은 분리 예:

- research / writing
- planning / execution
- retrieval / synthesis
- customer support / billing support

좋지 않은 분리 예:

- 역할 경계가 거의 같은 agent 여러 개 만들기
- 차이는 거의 없는데 프롬프트만 조금 다른 agent 남발하기

핵심은 각 agent가 실패했을 때 무엇을 고치면 되는지 바로 보이게 만드는 것이다.

## 3. 언제 handoff보다 subagent가 쉬운가

multi-agent에는 handoff 패턴도 있지만, 처음에는 subagent를 tool로 감싸는 방식이 더 단순하다.

- 호출 흐름이 supervisor 기준으로 한눈에 보인다
- 권한과 도구를 중앙에서 관리하기 쉽다
- 로그를 볼 때 어느 agent가 어떤 결과를 만들었는지 추적하기 편하다

즉, 사용자가 여러 agent와 직접 대화할 필요가 없는 백엔드 워크플로우라면 이 구조가 출발점으로 좋다.

## 4. 자주 막히는 포인트

### 4-1. 단일 agent보다 무조건 성능이 좋아지는 것은 아니다

agent 수를 늘리면 호출 횟수, 비용, 지연 시간이 함께 늘어난다.  
작업이 단순한데도 무조건 쪼개면 오히려 품질이 흔들릴 수 있다.

### 4-2. 하위 agent 출력 형식을 고정하지 않으면 연결이 약해진다

research agent가 자유 텍스트를 너무 길게 뱉으면 writer agent가 핵심을 놓칠 수 있다.  
중간 결과는 bullet, JSON, schema 등으로 더 짧고 구조화하는 편이 낫다.

### 4-3. supervisor 프롬프트가 모호하면 라우팅이 흔들린다

어떤 상황에서 어떤 subagent를 써야 하는지 기준이 흐리면, supervisor가 한 agent만 계속 호출하거나 불필요한 순환 호출을 만들 수 있다.

### 4-4. 도구 설명이 라우팅 품질을 크게 좌우한다

`ask_researcher`, `ask_writer` 같은 tool 이름도 중요하지만, docstring과 설명이 더 중요하다.  
언제 이 도구를 써야 하는지 짧고 강하게 적는 편이 좋다.

## 5. 나중에 RAG로 확장하려면

이 구조는 RAG와도 잘 맞는다.

- retrieval agent: 검색, chunk selection, citation 정리
- synthesis agent: 검색 결과를 바탕으로 답변 생성
- critic agent: 누락된 근거나 hallucination 검사

즉, 지금은 단순한 subagent 예제로 시작하더라도, 나중에 RAG workflow로 커지기 쉬운 구조다.

## 마무리

subagent 패턴은 "여러 agent를 쓰는 것" 자체보다 "책임을 분리해서 디버깅 가능하게 만드는 것"에 더 큰 의미가 있다.

- supervisor는 라우팅에 집중하고
- subagent는 각자 한 역할에 집중하고
- 중간 산출물을 기준으로 품질을 분리해서 볼 수 있다

단일 agent가 점점 무거워진다면, 다음 단계로 가장 먼저 시도해볼 만한 패턴이다.

## 참고 자료

- LangChain Multi-agent: https://docs.langchain.com/oss/python/langchain/multi-agent
- LangChain Agents: https://docs.langchain.com/oss/python/langchain/agents
