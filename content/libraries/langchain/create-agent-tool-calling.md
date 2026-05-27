---
title: LangChain create_agent로 도구 호출 에이전트 시작하기
description: LangChain v1의 create_agent를 기준으로 Python에서 도구 호출 에이전트를 빠르게 만들고, 메모리와 structured output까지 확장하는 최소 실전 가이드
date: 2026-05-27
tags:
  - langchain
  - llm
  - agent
  - python
aliases:
  - "/blog/langchain-create-agent-tool-calling"
---

# LangChain create_agent로 도구 호출 에이전트 시작하기

LangChain을 다시 볼 때마다 헷갈리는 지점이 하나 있다.  
예전 예제에서 보던 agent executor, prompt 조합, output parser 중심 코드와 지금 공식 문서의 기본 흐름이 꽤 달라졌다는 점이다.

지금 LangChain Python 문서는 `create_agent(...)`를 기본 출발점으로 잡는다.  
처음부터 복잡한 체인을 만들기보다, "모델 + 도구 + 시스템 프롬프트"를 한 번에 묶어서 에이전트를 만든 뒤 필요할 때 메모리, 미들웨어, structured output을 붙이는 흐름이다.

이번 글에서는 이 최신 흐름을 기준으로 다음만 빠르게 정리한다.

- 최소한의 도구 호출 에이전트 만들기
- 대화 상태를 유지하도록 메모리 붙이기
- 응답을 Pydantic 스키마로 고정하기
- 실전에서 자주 막히는 포인트 정리하기

## 언제 이 방식이 좋은가

`create_agent` 방식은 아래처럼 시작하고 싶은 경우에 특히 편하다.

- 일단 동작하는 에이전트를 빨리 만들고 싶을 때
- 함수 몇 개를 도구로 열어 두고 모델이 알아서 선택하게 하고 싶을 때
- 추후에 memory, middleware, guardrails를 단계적으로 붙일 계획일 때

반대로 상태 전이, 분기 제어, 사람 승인 단계 같은 워크플로우를 매우 세밀하게 제어해야 하면 LangGraph를 바로 쓰는 편이 더 낫다. LangChain 공식 문서도 빠른 시작에는 LangChain agents, 더 정교한 제어에는 LangGraph를 권장한다.

## 사전 준비

공식 설치 문서 기준으로 LangChain은 Python 3.10+가 필요하다.  
또 `langchain` 패키지만으로는 모든 모델 제공자를 바로 쓸 수 있는 것이 아니라, 제공자별 통합 패키지를 따로 설치해야 한다.

OpenAI를 예시로 하면:

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

환경 변수도 준비한다.

```bash
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell이라면:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 가장 작은 create_agent 예제

아래 예제는 도시 이름을 받아 날씨 문장을 돌려주는 함수를 도구로 등록한 뒤, 사용자의 질문에 대해 에이전트가 필요하면 그 도구를 호출하도록 만든다.

```python
from langchain.agents import create_agent
from langchain.tools import tool


@tool
def get_weather(city: str) -> str:
    """주어진 도시의 날씨를 조회한다."""
    fake_weather = {
        "seoul": "맑음, 22C",
        "busan": "흐림, 19C",
        "jeju": "비, 18C",
    }
    return fake_weather.get(city.lower(), f"{city} 날씨 정보가 없습니다.")


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[get_weather],
    system_prompt="너는 간결한 한국어 비서다. 필요할 때만 도구를 사용하라.",
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "서울 날씨 알려주고 한 줄로 요약해줘.",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

핵심은 세 줄이다.

- `model=`: 어떤 제공자의 어떤 모델을 쓸지 지정
- `tools=`: 모델이 호출할 수 있는 함수 목록
- `system_prompt=`: 도구를 언제 어떻게 쓸지 행동 원칙 지정

LangChain v1 문서 기준으로 모델 이름은 `provider:model` 형식을 쓸 수 있다. 다만 실제로는 각 제공자 API에서 지원하는 모델명을 그대로 전달하므로, 사용 중인 계정에서 접근 가능한 모델로 바꿔야 한다.

## 2. 대화 상태를 유지하고 싶다면

한 번 질문하고 끝나는 데모는 쉽다.  
실제로는 "그럼 내일은?", "아까 말한 도시 기준으로 다시" 같은 후속 질문이 나오기 때문에 대화 상태를 붙여야 한다.

공식 문서 기준으로 `thread_id`를 사용하려면 checkpointer가 필요하다. 로컬 테스트에서는 `InMemorySaver`로 충분하다.

```python
from langchain.agents import create_agent
from langchain.tools import tool
from uuid import uuid4
from langgraph.checkpoint.memory import InMemorySaver


@tool
def get_weather(city: str) -> str:
    """주어진 도시의 날씨를 조회한다."""
    fake_weather = {
        "seoul": "맑음, 22C",
        "busan": "흐림, 19C",
    }
    return fake_weather.get(city.lower(), f"{city} 날씨 정보가 없습니다.")


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[get_weather],
    system_prompt="도시 이름이 불명확하면 먼저 확인 질문을 하라.",
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": str(uuid4())}}

first = agent.invoke(
    {"messages": [{"role": "user", "content": "부산 날씨 알려줘."}]},
    config=config,
)
print(first["messages"][-1].content)

second = agent.invoke(
    {"messages": [{"role": "user", "content": "그럼 내일은?"}]},
    config=config,
)
print(second["messages"][-1].content)
```

여기서 중요한 점은 `thread_id`가 "대화 단위"라는 것이다.  
사용자별 세션을 구분해야 한다면 이 값을 직접 관리해야 한다.

## 3. 응답 형식을 고정하고 싶다면 structured output

에이전트 결과를 그대로 화면에만 뿌릴 때는 자유 텍스트로도 충분하다.  
하지만 API 응답, DB 저장, 후처리 파이프라인으로 넘길 계획이라면 스키마를 먼저 고정하는 편이 낫다.

LangChain agent는 `response_format=`에 Pydantic 모델을 넘겨 structured output을 받을 수 있다.

```python
from pydantic import BaseModel, Field
from langchain.agents import create_agent
from langchain.tools import tool


class TravelAnswer(BaseModel):
    city: str = Field(description="추천 도시")
    summary: str = Field(description="추천 이유 한 문장")
    confidence: float = Field(description="0과 1 사이 확신도")


@tool
def get_travel_hint(season: str) -> str:
    """계절별 여행 힌트를 반환한다."""
    hints = {
        "spring": "벚꽃과 산책을 좋아하면 경주, 서울이 무난하다.",
        "summer": "더위를 피하려면 강릉보다 고지대나 실내 일정을 섞는 편이 좋다.",
    }
    return hints.get(season.lower(), "일정과 예산 정보를 더 받아야 한다.")


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[get_travel_hint],
    response_format=TravelAnswer,
    system_prompt="반드시 한국어로 답하고 confidence는 0과 1 사이 숫자로 반환하라.",
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "봄에 1박 2일로 갈 만한 도시를 추천해줘.",
            }
        ]
    }
)

print(result["structured_response"])
```

이 방식의 장점은 두 가지다.

- 응답이 스키마 검증을 통과해야 하므로 후처리가 단순해진다
- 프론트엔드나 API 레이어에서 파싱 예외를 줄이기 쉽다

## 4. 실전에서 자주 막히는 포인트

### 4-1. 도구 설명이 부실하면 엉뚱하게 호출한다

모델은 함수 이름보다 docstring과 인자 설명의 영향을 크게 받는다.  
도구가 무엇을 하고, 언제 호출해야 하고, 어떤 입력을 기대하는지 짧고 명확하게 적는 편이 좋다.

좋지 않은 예:

```python
def search(x: str) -> str:
    return "..."
```

조금 더 나은 예:

```python
@tool
def search_docs(query: str) -> str:
    """제품 공식 문서에서 설정 방법이나 API 사용법을 찾는다."""
    return "..."
```

### 4-2. 모델이 도구 호출을 잘 못하는 것이 아니라 모델 선택이 안 맞을 수 있다

모든 모델이 도구 호출이나 structured output을 같은 수준으로 잘 처리하지는 않는다.  
에이전트 품질이 이상하면 프롬프트보다 먼저 "지금 쓰는 모델이 tool calling에 충분히 강한가"를 확인하는 편이 빠르다.

### 4-3. `thread_id`만 넣고 memory가 된다고 생각하면 안 된다

`thread_id`는 식별자일 뿐이다.  
checkpointer 없이 `thread_id`만 넣으면 대화 히스토리가 유지되지 않는다.

### 4-4. 최신 문서와 예전 블로그 예제가 다를 수 있다

이 부분이 꽤 중요하다.  
LangChain은 변화가 빠르기 때문에 오래된 글을 따라가면 `AgentExecutor`, 예전 output parser, 구 버전 체인 API가 섞여 나올 수 있다. 새 프로젝트라면 공식 v1 문서의 `create_agent` 흐름에서 시작하는 편이 안전하다.

## 5. 언제 LangGraph로 넘어가면 되나

`create_agent`로 시작해서 아래 요구가 생기면 LangGraph를 본격적으로 검토하면 된다.

- 승인 단계를 강제로 넣고 싶을 때
- 특정 분기에서 반드시 정해진 도구만 호출하게 만들고 싶을 때
- 장기 실행 작업, 재시도, 상태 저장을 세밀하게 통제하고 싶을 때
- 멀티 에이전트 흐름을 명시적으로 설계하고 싶을 때

즉, 처음부터 모든 것을 그래프로 설계할 필요는 없고, 지금 문제를 해결하는 최소 에이전트가 먼저다.

## 마무리

지금 LangChain 입문에서 가장 실용적인 출발점은 `create_agent`다.

- 빠르게 도구 호출 에이전트를 만들 수 있고
- 필요하면 `checkpointer`로 대화 상태를 붙일 수 있고
- `response_format`으로 구조화된 결과까지 받을 수 있다

개인적으로는 처음부터 거대한 아키텍처를 짜기보다, 도구 1~2개짜리 작은 에이전트를 먼저 만들고 그 다음에 memory, middleware, LangGraph로 확장하는 순서를 추천한다. 그래야 어느 지점에서 복잡도가 올라가는지 눈에 잘 보인다.

## 참고 자료

- LangChain Quickstart: https://docs.langchain.com/oss/python/langchain/quickstart
- LangChain Agents: https://docs.langchain.com/oss/python/langchain/agents
- LangChain Install Guide: https://docs.langchain.com/oss/python/langchain/install
- LangChain Models: https://docs.langchain.com/oss/python/langchain-models
