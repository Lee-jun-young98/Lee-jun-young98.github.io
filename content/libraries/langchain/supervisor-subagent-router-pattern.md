---
title: LangChain supervisor는 subagent를 어떤 식으로 고를까
description: LangChain multi-agent에서 supervisor가 router처럼 어떤 subagent를 선택하고 어떤 입력으로 호출할지 결정하는 흐름을 정리한 글
date: 2026-05-27
tags:
  - langchain
  - agent
  - multi-agent
  - router
---

# LangChain supervisor는 subagent를 어떤 식으로 고를까

`supervisor + subagent` 패턴을 쓰기 시작하면 금방 이런 질문이 생긴다.

- supervisor는 여러 subagent 중에서 누구를 먼저 고를까?
- 이 선택은 rule-based routing인가, 아니면 LLM 판단인가?
- tool 이름만 보고 고르나, 설명도 같이 보나?
- 연구용 agent와 작성용 agent가 있으면 어떤 기준으로 갈라지나?

LangChain 공식 문서 기준으로 subagent 패턴에서 supervisor는 단순 함수 분기기가 아니라, ongoing conversation context를 유지하면서 적절한 subagent를 고르는 "agent-based router"에 가깝다.

이번 글에서는 아래를 중심으로 정리한다.

- supervisor가 subagent를 어떤 기준으로 선택하는지
- router와 supervisor가 어떻게 다른지
- tool-per-agent와 single-dispatch 패턴 차이
- 라우팅 품질이 흔들릴 때 어디를 손봐야 하는지

## 먼저 결론부터

LangChain의 supervisor 패턴에서 subagent 선택은 보통 아래 정보들을 같이 보고 일어난다.

- 현재 사용자 요청
- 이전 대화 맥락
- supervisor의 system prompt
- 각 subagent tool의 이름
- 각 subagent tool의 설명과 입력 스키마
- 이전 tool result

즉, "어떤 if 문으로 분기된다"기보다 "supervisor LLM이 지금 상황에서 어떤 tool, 즉 어떤 subagent를 호출할지 결정한다"에 가깝다.

## 1. router와 supervisor는 같은가

완전히 같지는 않다.

LangChain 공식 multi-agent 문서도 router와 supervisor를 구분한다.

- router: 보통 한 번의 분류로 어느 경로로 보낼지 결정
- supervisor: 전체 대화 맥락을 유지하면서 여러 turn에 걸쳐 필요한 subagent를 동적으로 호출

예를 들어:

- router: "이 질문은 billing이냐 support냐?"
- supervisor: "먼저 research subagent를 부르고, 그 결과를 바탕으로 writer subagent를 부르고, 필요하면 다시 planner를 부를까?"

즉, router는 일회성 dispatch에 가깝고, supervisor는 지속적인 orchestration에 가깝다.

## 2. supervisor는 실제로 무엇을 보고 고를까

가장 단순한 예제를 보자.

```python
from langchain.agents import create_agent
from langchain.tools import tool


@tool
def ask_researcher(query: str) -> str:
    """사실 조사, 자료 요약, 근거 수집이 필요할 때 사용한다."""
    ...


@tool
def ask_writer(notes: str) -> str:
    """이미 정리된 자료를 바탕으로 한국어 답변 초안을 작성할 때 사용한다."""
    ...


supervisor = create_agent(
    model="openai:gpt-5.4",
    tools=[ask_researcher, ask_writer],
    system_prompt=(
        "너는 supervisor agent다. "
        "사실 조사나 근거 수집이 필요하면 ask_researcher를 먼저 사용하고, "
        "최종 문장 작성이 필요하면 ask_writer를 사용하라."
    ),
)
```

여기서 supervisor는 대략 이런 식으로 판단한다.

- 질문이 사실 확인형인가?
- 이미 자료가 충분한가?
- 지금 필요한 단계가 조사인가, 작성인가?
- 이전에 받은 tool result로 다음 단계에 갈 수 있는가?

즉, subagent 선택은 현재 질문만 보고 끝나는 게 아니라, 현재 state에서 "다음 최선의 작업"을 고르는 식으로 이뤄진다.

## 3. 라우팅은 어디에서 일어나나

코드 관점에서 보면 라우팅은 supervisor의 tool selection 단계에서 일어난다.

흐름은 보통 이렇다.

1. 사용자 메시지가 supervisor로 들어온다.
2. supervisor는 자기 prompt + tool 목록 + 대화 맥락을 본다.
3. "지금은 어느 tool을 써야 하는가?"를 모델이 판단한다.
4. 선택된 tool이 실제로는 subagent wrapper 함수라면, 그 안에서 하위 agent가 실행된다.

즉, router가 별도 컴포넌트로 항상 존재하는 것이 아니라, supervisor가 tool calling 단계에서 router 역할을 수행하는 구조다.

## 4. tool 이름과 설명이 왜 그렇게 중요한가

공식 subagents 문서에서도 subagent spec, 즉 이름과 설명을 중요한 prompting lever로 본다.

이유는 간단하다.  
supervisor는 subagent를 "실행 가능한 선택지"로만 보지 않고, tool metadata를 읽고 "이 agent가 언제 적절한가"를 추론한다.

예를 들어 아래 두 설명을 비교해보자.

좋지 않은 예:

```python
@tool
def worker1(query: str) -> str:
    """작업을 수행한다."""
    ...
```

조금 더 나은 예:

```python
@tool
def ask_researcher(query: str) -> str:
    """근거 수집, 사실 조사, 문서 요약이 필요할 때 사용한다."""
    ...
```

두 번째가 훨씬 라우팅이 안정적이다.  
supervisor가 "언제 이 subagent를 써야 하는지"를 문장으로 이해할 수 있기 때문이다.

## 5. tool-per-agent 패턴

가장 기본적인 라우팅 방식은 subagent마다 tool 하나를 두는 방식이다.

```python
tools = [ask_researcher, ask_writer, ask_reviewer]
```

이 패턴의 특징은 명확하다.

- supervisor가 선택할 수 있는 도구 목록이 명시적이다
- tool 이름과 설명만 잘 적어도 라우팅이 꽤 안정적이다
- tracing과 디버깅이 쉽다

단점은 subagent 수가 늘수록 tool 목록이 길어진다는 점이다.

## 6. single-dispatch tool 패턴

LangChain 공식 subagents 문서에는 단일 `task(...)` tool로 여러 subagent를 호출하는 패턴도 나온다.

예를 들면:

```python
from langchain.tools import tool


SUBAGENTS = {
    "research": research_agent,
    "writer": writer_agent,
    "reviewer": reviewer_agent,
}


@tool
def task(agent_name: str, description: str) -> str:
    """지정한 subagent에게 작업을 위임한다."""
    agent = SUBAGENTS[agent_name]
    result = agent.invoke(
        {"messages": [{"role": "user", "content": description}]}
    )
    return result["messages"][-1].content
```

이 경우 supervisor는 tool을 고르는 대신:

- `task`라는 하나의 tool을 고르고
- `agent_name="research"` 같은 식으로 내부 대상 agent를 고른다

즉, routing이 두 단계로 바뀐다.

1. `task` tool을 쓸지 말지 결정
2. 그 안에서 어느 subagent 이름을 넣을지 결정

이 패턴은 agent 수가 많아질 때 확장성이 좋지만, 반대로 description 설계를 더 신경 써야 한다.

## 7. query-only routing과 context-rich routing

subagent를 어떤 입력으로 호출하느냐도 routing 품질에 영향을 준다.

### query-only

```python
result = research_agent.invoke(
    {"messages": [{"role": "user", "content": query}]}
)
```

장점:

- context isolation이 강하다
- subagent가 덜 오염된다
- token 사용량이 예측 가능하다

단점:

- 이전 대화 맥락이 필요할 때 성능이 떨어질 수 있다

### context-rich

```python
subagent_input = [
    *runtime.state["messages"][-4:],
    {"role": "user", "content": query},
]
```

장점:

- 이전 대화 맥락을 반영하기 쉽다

단점:

- 라우팅은 쉬워질 수 있지만 context bloat가 다시 생길 수 있다

즉, supervisor가 subagent를 잘 고르는 것과 subagent가 잘 수행하는 것은 연결돼 있지만 같은 문제는 아니다.

## 8. supervisor는 언제 여러 subagent를 연속 호출하나

supervisor는 단순히 "하나 고르고 끝"일 수도 있지만, multi-hop orchestration도 가능하다.

예를 들어:

1. `ask_researcher` 호출
2. 결과를 보고 `ask_writer` 호출
3. 필요하면 `ask_reviewer` 호출
4. 최종 답변 작성

이 흐름에서 routing은 turn마다 반복된다.  
즉, supervisor는 매 단계에서 현재 state를 다시 보고 다음 subagent를 정한다.

그래서 supervisor는 static router보다는 "계속 판단하는 router"라고 이해하는 편이 더 정확하다.

## 9. 라우팅이 흔들리는 대표 원인

### 9-1. 역할 경계가 겹친다

예를 들어:

- researcher: 자료 조사와 요약
- writer: 자료 정리와 요약

이렇게 겹치면 supervisor도 헷갈린다.

### 9-2. system prompt가 너무 추상적이다

`"적절한 agent를 골라라"` 정도로 끝나면 선택 기준이 흐려진다.  
언제 어떤 subagent를 먼저 쓰는지 더 구체적으로 적는 편이 좋다.

### 9-3. tool description이 약하다

LLM router 품질은 tool metadata에 많이 의존한다.  
도구 설명이 모호하면 routing drift가 생기기 쉽다.

### 9-4. 중간 결과 형식이 불안정하다

researcher가 반환한 결과가 너무 길거나 뒤죽박죽이면 supervisor가 다음 단계 판단을 잘 못할 수 있다.

## 10. 라우팅을 더 안정적으로 만들려면

실무적으로는 아래 순서가 가장 무난하다.

- subagent 역할을 겹치지 않게 자르기
- tool 이름을 action-oriented하게 짓기
- description에 "언제 써야 하는지"를 명시하기
- supervisor prompt에 우선순위 규칙 넣기
- 중간 출력은 schema나 bullet로 짧게 고정하기

예:

```python
system_prompt = """
너는 supervisor agent다.
1. 사실 확인이나 근거 수집이 필요하면 ask_researcher를 먼저 사용한다.
2. 자료가 정리된 뒤 최종 한국어 답변 작성에는 ask_writer를 사용한다.
3. 이미 충분한 자료가 있으면 불필요한 subagent 호출을 줄인다.
"""
```

이 정도만 해도 router 품질이 꽤 좋아진다.

## 11. 언제 별도 router를 두는 편이 나은가

항상 supervisor 하나가 라우팅까지 다 맡아야 하는 것은 아니다.

아래 경우에는 별도 router layer를 두는 것도 생각해볼 수 있다.

- domain 분기가 아주 명확할 때
- 비용 절감을 위해 초반 분류를 가볍게 하고 싶을 때
- billing, support, coding처럼 범주가 아주 뚜렷할 때

예를 들어:

- 1차 router: billing vs support vs coding 분류
- 2차 supervisor: 해당 도메인 안에서 subagent orchestration

즉, "router 또는 supervisor"가 아니라 "가벼운 router + 도메인 supervisor" 조합도 가능하다.

## 마무리

LangChain에서 supervisor는 subagent를 보통 아래 방식으로 고른다.

- tool 이름과 설명을 읽고
- 현재 사용자 요청과 대화 맥락을 보고
- 지금 필요한 다음 작업이 무엇인지 판단한 뒤
- 해당 subagent wrapper tool을 호출한다

즉, router는 별도 switch 문이 아니라, supervisor의 tool selection 과정 안에 녹아 있는 경우가 많다.

이 패턴을 안정적으로 만들고 싶다면 "더 많은 agent"보다 "더 선명한 역할 경계와 tool description"이 먼저다.

## 참고 자료

- [LangChain Multi-agent](https://docs.langchain.com/oss/python/langchain/multi-agent)
- [LangChain Router](https://docs.langchain.com/oss/python/langchain/multi-agent/router)
- [LangChain Subagents](https://docs.langchain.com/oss/python/langchain/multi-agent/subagents)
