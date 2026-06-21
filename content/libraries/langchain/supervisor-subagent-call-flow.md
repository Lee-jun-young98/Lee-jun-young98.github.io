---
title: LangChain supervisor가 subagent를 호출할 때 내부 로직은 어떻게 흐를까
description: LangChain supervisor 패턴에서 tool call, subagent invoke, 결과 반환, context isolation이 어떤 순서로 이어지는지 내부 호출 흐름 중심으로 정리한 글
date: 2026-05-27
tags:
  - langchain
  - agent
  - multi-agent
  - supervisor
  - python
---

# LangChain supervisor가 subagent를 호출할 때 내부 로직은 어떻게 흐를까

`supervisor + subagent` 패턴을 처음 보면 코드 자체는 단순해 보인다.

- supervisor agent를 만든다
- subagent를 만든다
- subagent를 tool처럼 감싼다
- supervisor가 필요할 때 그 tool을 호출한다

그런데 실제로 디버깅하거나 구조를 확장하려고 하면 바로 궁금해진다.

- supervisor는 정확히 어떤 시점에 subagent를 부르나?
- subagent는 supervisor의 전체 대화 기록을 다 받나?
- subagent 내부의 tool 호출 결과는 어디까지 올라오나?
- 최종 사용자 응답은 누가 만드는 건가?

이번 글은 이 질문에 집중해서, supervisor가 subagent를 호출할 때 내부 로직이 어떤 순서로 흐르는지 정리한다.

## 먼저 큰 그림

LangChain 공식 subagents 문서 기준으로 핵심은 이렇다.

- main agent, 즉 supervisor가 전체 대화 맥락을 가진다
- subagent는 tool 호출로 실행된다
- subagent는 보통 상태를 길게 유지하지 않는 stateless worker처럼 동작한다
- subagent의 최종 결과만 supervisor에게 돌아오고, supervisor가 그 결과를 바탕으로 다음 행동이나 최종 응답을 만든다

즉, 사용자는 supervisor와 대화하고, subagent는 뒤에서 특정 작업만 처리하는 구조다.

## 1. 호출 흐름을 가장 단순하게 보면

아래 예제처럼 research subagent를 tool로 감쌌다고 하자.

```python
from langchain.agents import create_agent
from langchain.tools import tool


research_agent = create_agent(
    model="openai:gpt-5.4",
    tools=[],
    system_prompt="너는 조사 담당 agent다. 핵심 사실만 bullet로 정리하라.",
)


@tool
def ask_researcher(query: str) -> str:
    """질문에 필요한 사실 조사와 정리를 수행한다."""
    result = research_agent.invoke(
        {"messages": [{"role": "user", "content": query}]}
    )
    return result["messages"][-1].content


supervisor = create_agent(
    model="openai:gpt-5.4",
    tools=[ask_researcher],
    system_prompt="필요하면 ask_researcher를 사용해 정보를 조사하라.",
)
```

이 구조에서 내부 흐름은 대략 아래 순서로 이어진다.

1. 사용자가 supervisor에게 질문한다.
2. supervisor 모델이 현재 메시지와 tool 설명을 보고, subagent가 필요하다고 판단한다.
3. supervisor는 직접 답하지 않고 `ask_researcher(...)` tool call을 생성한다.
4. Python 레벨에서 `ask_researcher()` 함수가 실행된다.
5. 그 함수 안에서 `research_agent.invoke(...)`가 다시 호출된다.
6. research subagent는 자기 prompt와 입력을 기준으로 별도의 agent loop를 돈다.
7. subagent의 최종 결과 문자열이 `ask_researcher()`의 반환값으로 나온다.
8. 이 반환값이 supervisor에게 tool result로 다시 들어간다.
9. supervisor는 그 결과를 보고 다음 tool을 부르거나 최종 답변을 만든다.

즉, "supervisor가 subagent를 부른다"는 말은 실제로는 "supervisor가 tool call을 만들고, 그 tool 함수 안에서 또 하나의 agent가 `invoke()`되는 구조"에 가깝다.

## 2. 호출 스택처럼 보면 더 이해가 쉽다

이 흐름을 호출 스택처럼 쓰면 아래와 비슷하다.

```text
user -> supervisor.invoke(...)
  -> supervisor LLM decides tool call: ask_researcher(query)
    -> Python tool function ask_researcher(...)
      -> research_agent.invoke(...)
        -> research agent LLM runs its own loop
      -> return final subagent output
  -> supervisor receives tool result
  -> supervisor writes final answer
```

중요한 포인트는 supervisor와 subagent가 같은 loop 안에 섞여 있는 것이 아니라, subagent가 tool 함수 안에서 한 번 더 중첩 호출된다는 점이다.

그래서 tracing을 보면 supervisor 실행 아래에 subagent 실행이 매달린 형태로 보이는 경우가 많다.

## 3. supervisor는 왜 tool call을 먼저 만들까

supervisor는 subagent를 직접 "agent끼리 대화"하는 식으로 호출하지 않는다.  
공식 패턴에서는 subagent가 tool로 노출되어 있기 때문이다.

즉, supervisor 입장에서 subagent는 아래와 거의 같다.

- `search_docs(...)`
- `query_database(...)`
- `ask_researcher(...)`

차이는 일반 도구는 바로 값을 계산해서 반환하고, subagent tool은 내부에서 또 하나의 agent loop를 수행한 뒤 결과를 반환한다는 점이다.

이 구조의 장점은 분명하다.

- supervisor는 "어떤 worker를 언제 부를지"만 결정하면 된다
- subagent 내부 구현은 바깥에서 감춰진다
- 하위 agent를 교체해도 supervisor 인터페이스는 그대로 둘 수 있다

## 4. subagent는 어떤 입력을 받는가

이 부분이 실무에서 가장 중요하다.  
subagent는 자동으로 supervisor의 전체 대화 기록을 전부 받는 것이 아니다. 무엇을 넣을지는 tool 함수 안에서 직접 정한다.

가장 단순한 형태는 query만 넘기는 것이다.

```python
@tool
def ask_researcher(query: str) -> str:
    result = research_agent.invoke(
        {"messages": [{"role": "user", "content": query}]}
    )
    return result["messages"][-1].content
```

이 경우 subagent는 오직 `query`만 본다.  
그래서 context isolation이 강하다. supervisor 쪽 긴 대화 기록이 그대로 흘러들어가지 않는다.

반대로 더 많은 맥락이 필요하면 tool runtime이나 state를 읽어 직접 조합할 수 있다.

```python
from langchain.tools import tool, ToolRuntime
from langchain.agents import AgentState


@tool
def ask_researcher(query: str, runtime: ToolRuntime[None, AgentState]) -> str:
    history = runtime.state["messages"]
    subagent_messages = [
        {"role": "system", "content": "대화 맥락을 반영하되 핵심 사실만 정리하라."},
        *history[-4:],
        {"role": "user", "content": query},
    ]
    result = research_agent.invoke({"messages": subagent_messages})
    return result["messages"][-1].content
```

즉, 어떤 컨텍스트를 넘길지는 자동이 아니라 설계 사항이다.

## 5. subagent 내부에서는 또 무엇이 일어나나

subagent도 agent이기 때문에 내부에서 다시 아래 일을 할 수 있다.

- 자기 tool 선택
- 여러 단계 reasoning
- 외부 API 호출
- structured output 생성
- human-in-the-loop interrupt

예를 들어 research subagent 안에 `web_search`와 `fetch_docs`가 들어 있다면 흐름은 더 길어진다.

```text
supervisor
  -> ask_researcher(...)
    -> research_agent.invoke(...)
      -> research subagent calls web_search(...)
      -> research subagent calls fetch_docs(...)
      -> research subagent writes summary
    -> return summary to supervisor
  -> supervisor uses returned summary
```

여기서 supervisor는 보통 research subagent 내부의 중간 추론까지 다 볼 필요가 없다.  
공식 예제들도 대체로 "subagent 최종 결과만 supervisor에 반환"하는 쪽을 기본으로 잡는다.

## 6. 최종 사용자 답변은 누가 만드는가

대부분의 경우 최종 사용자 답변은 supervisor가 만든다.

이유는 간단하다.

- supervisor가 전체 대화 맥락을 갖고 있고
- 여러 subagent 결과를 합칠 수 있고
- 어떤 부분을 사용자에게 보여줄지 최종 책임을 가지기 때문이다

즉, subagent는 "작업 결과물"을 만들고, supervisor는 "사용자 응답"을 만든다고 보면 된다.

예를 들어:

- research subagent: 조사 bullet 반환
- writer subagent: 초안 반환
- supervisor: 사용자 톤과 맥락에 맞춰 최종 답변 정리

물론 구조에 따라 subagent 결과를 거의 그대로 전달할 수도 있지만, 일반적으로는 supervisor가 마지막 정리 단계를 맡는 편이 낫다.

## 7. 왜 context isolation이 중요할까

LangChain 공식 문서에서도 subagents의 큰 이유로 context isolation을 강조한다.

이 패턴이 유용한 이유는 단순히 agent 수를 늘리는 데 있지 않다.  
복잡한 작업을 별도 context window에서 처리하고, supervisor의 주 대화 기록을 불필요하게 부풀리지 않는 데 있다.

예를 들어 subagent가 아래를 수행한다고 하자.

- 웹 검색 결과 20개 읽기
- 문서 chunk 30개 요약
- 내부 툴 5번 호출

이 모든 중간 결과를 supervisor의 메인 대화 히스토리에 직접 쌓으면 context가 금방 커진다.  
subagent로 격리하면 supervisor는 "정리된 결과"만 받게 할 수 있다.

## 8. 디버깅할 때 어디를 봐야 하나

이 패턴이 꼬일 때는 보통 세 군데 중 하나가 문제다.

### 8-1. supervisor가 subagent를 아예 안 부른다

원인 후보:

- tool 이름과 설명이 약하다
- system prompt에서 언제 부를지 기준이 모호하다
- 단일 supervisor가 그냥 직접 답해도 된다고 판단한다

### 8-2. subagent를 불렀는데 결과가 별로다

원인 후보:

- subagent에 들어가는 입력이 너무 빈약하다
- subagent system prompt가 역할을 좁게 못 잡았다
- 중간 도구 품질이 낮다

### 8-3. 결과는 괜찮은데 최종 답이 이상하다

원인 후보:

- supervisor가 subagent 결과를 잘못 해석한다
- 여러 subagent 결과를 합치는 규칙이 없다
- 반환 형식이 너무 자유 텍스트라 supervisor가 흔들린다

그래서 디버깅은 "supervisor 라우팅 문제인지", "subagent 실행 문제인지", "결과 합성 문제인지"를 분리해서 보는 편이 좋다.

## 9. 안정적으로 만들려면

실무에서는 아래 정도만 해도 많이 안정된다.

- subagent tool 이름과 설명을 분명하게 쓰기
- subagent 입력을 query-only로 시작하고, 꼭 필요할 때만 context를 늘리기
- subagent 출력은 bullet, JSON, schema 등으로 짧게 고정하기
- supervisor가 언제 어떤 subagent를 써야 하는지 prompt에 명시하기

예를 들어 research 결과를 구조화하면 supervisor가 후속 판단을 더 안정적으로 한다.

```python
from pydantic import BaseModel


class ResearchResult(BaseModel):
    key_points: list[str]
    risks: list[str]
```

subagent가 이런 형태로 돌려주면 supervisor가 다음 단계로 연결하기 쉬워진다.

## 마무리

supervisor가 subagent를 호출하는 내부 로직은 생각보다 단순하다.

- supervisor가 tool call을 만든다
- tool 함수 안에서 subagent `invoke()`가 실행된다
- subagent의 최종 결과가 tool result로 supervisor에 돌아온다
- supervisor가 그 결과를 바탕으로 다음 행동이나 최종 응답을 만든다

즉, multi-agent라고 해서 무조건 복잡한 마법이 일어나는 것은 아니다.  
핵심은 "중첩된 agent 호출을 tool 인터페이스로 감싼 구조"라고 이해하면 대부분의 디버깅 포인트가 선명해진다.

## 참고 자료

- [LangChain Subagents](https://docs.langchain.com/oss/python/langchain/multi-agent/subagents)
- [LangChain Multi-agent](https://docs.langchain.com/oss/python/langchain/multi-agent)
- [Build a personal assistant with subagents](https://docs.langchain.com/oss/python/langchain/supervisor)
