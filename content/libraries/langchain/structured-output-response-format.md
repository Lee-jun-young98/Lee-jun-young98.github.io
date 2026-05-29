---
title: LangChain structured output으로 에이전트 응답 스키마 고정하기
description: LangChain create_agent의 response_format, ProviderStrategy, ToolStrategy를 사용해 에이전트 출력을 안정적인 구조체로 받는 실전 가이드
date: 2026-05-29
tags:
  - langchain
  - agent
  - structured-output
  - python
---

# LangChain structured output으로 에이전트 응답 스키마 고정하기

LangChain 에이전트를 붙여서 기능을 만들다 보면, 첫 번째 문제는 "응답이 그럴듯하냐"보다 "응답을 코드가 안정적으로 읽을 수 있느냐"로 바뀐다.

채팅 UI에서는 자연어 답변만으로도 충분할 수 있다.  
하지만 API 응답, DB 저장, 후속 자동화 파이프라인으로 이어지면 자유 형식 텍스트는 금방 다루기 어려워진다.

LangChain v1에서는 이 문제를 `create_agent(..., response_format=...)`으로 푼다.  
Pydantic 모델이나 TypedDict 같은 스키마를 넘기면, 에이전트가 그 형식에 맞는 결과를 만들고 최종 상태의 `structured_response` 키로 돌려준다.

이번 글에서는 아래만 실전 기준으로 짧게 정리한다.

- `response_format`이 정확히 무엇을 해주는가
- `ProviderStrategy`와 `ToolStrategy`를 언제 나눠 써야 하는가
- 바로 실행 가능한 Python 예제
- 실제 서비스에서 자주 막히는 함정

## 왜 필요한가

예를 들어 여행 추천 에이전트를 만든다고 하자.  
사람에게 보여줄 때는 "부산이 좋습니다" 같은 문장으로 충분하지만, 백엔드에서는 아래처럼 다루고 싶을 때가 많다.

- 추천 도시
- 한 줄 요약
- 예산 수준
- 추천 신뢰도

자연어를 정규식이나 문자열 파싱으로 억지로 분해하면 금방 깨진다.  
structured output을 쓰면 모델 응답을 애초에 스키마로 제한해서 후처리를 단순하게 만들 수 있다.

## 사전 준비

LangChain 공식 설치 문서 기준으로 `langchain`은 Python 3.10+가 필요하다.  
모델 제공자 패키지는 별도로 설치해야 한다.

OpenAI 예시로 시작하면:

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langchain-openai
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

macOS / Linux:

```bash
export OPENAI_API_KEY="your-api-key"
```

## 1. 가장 단순한 방식: 스키마 타입만 넘기기

공식 문서 기준으로 `response_format`에 Pydantic 모델 타입을 직접 넘길 수 있다.  
이 경우 LangChain이 모델 capability를 보고 가능한 경우 provider-native structured output을 고르고, 아니면 tool-calling 방식으로 처리한다.

```python
from pydantic import BaseModel, Field
from langchain.agents import create_agent


class TravelPlan(BaseModel):
    city: str = Field(description="추천 도시")
    summary: str = Field(description="추천 이유를 한 문장으로 요약")
    budget_level: str = Field(description="low, medium, high 중 하나")
    confidence: float = Field(description="0과 1 사이의 추천 신뢰도")


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    response_format=TravelPlan,
    system_prompt=(
        "사용자 요청에 맞춰 여행지를 추천하되, "
        "confidence는 0과 1 사이 숫자로만 반환하라."
    ),
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "초여름에 1박 2일로 가볍게 다녀올 국내 도시 추천해줘.",
            }
        ]
    }
)

travel_plan = result["structured_response"]
print(travel_plan)
print(type(travel_plan))
```

핵심은 두 가지다.

- 최종 자연어 메시지와 별개로 `result["structured_response"]`를 읽으면 된다
- Pydantic 스키마를 썼다면 검증된 객체로 받는다

## 2. ProviderStrategy를 명시적으로 쓰는 경우

모델 제공자가 native structured output을 지원하면 `ProviderStrategy`를 직접 써서 의도를 분명하게 적을 수 있다.  
공식 문서 기준으로 이 방식은 provider가 스키마를 강하게 검증하므로 가장 신뢰성이 높다.

```python
from pydantic import BaseModel, Field
from langchain.agents import create_agent
from langchain.agents.structured_output import ProviderStrategy


class ContactCard(BaseModel):
    name: str = Field(description="이름")
    email: str = Field(description="이메일 주소")
    team: str = Field(description="소속 팀")


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    response_format=ProviderStrategy(schema=ContactCard, strict=True),
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "홍길동, gildong@example.com, AI Platform Team 정보를 추출해줘.",
            }
        ]
    }
)

print(result["structured_response"])
```

실무에서 이 방식이 좋은 경우는 아래와 같다.

- OpenAI 같은 provider-native structured output 지원 모델을 쓰고 있음
- 응답 스키마가 중요해서 느슨한 파싱보다 강한 검증이 필요함
- API 응답 계약이 자주 깨지면 안 됨

주의할 점도 있다.  
공식 structured output 문서 기준으로 `strict` 파라미터는 `langchain>=1.2`가 필요하다.

## 3. ToolStrategy를 명시적으로 쓰는 경우

모델이 native structured output을 지원하지 않더라도 tool calling을 지원하면 `ToolStrategy`로 같은 패턴을 유지할 수 있다.

```python
from typing import Literal
from pydantic import BaseModel, Field
from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy


class MeetingAction(BaseModel):
    task: str = Field(description="해야 할 일")
    assignee: str = Field(description="담당자")
    priority: Literal["low", "medium", "high"] = Field(description="우선순위")


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    response_format=ToolStrategy(
        schema=MeetingAction,
        tool_message_content="회의 액션 아이템을 구조화해서 저장했습니다.",
    ),
    system_prompt="회의 기록에서 실행 가능한 액션 아이템 하나만 뽑아라.",
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "다음 주 수요일 전까지 민지가 배포 체크리스트를 갱신해야 해.",
            }
        ]
    }
)

print(result["structured_response"])
```

이 방식의 장점은 provider capability에 덜 묶인다는 점이다.  
대신 공식 문서도 설명하듯, tool-calling 경로에서는 모델이 잘못된 형식이나 복수 구조화 응답을 낼 수 있어서 재시도 처리와 오류 전략을 이해하는 편이 좋다.

## 4. validation error를 다루는 최소 패턴

Pydantic 제약을 걸면 잘못된 값이 들어왔을 때 LangChain이 재시도할 수 있다.  
기본 동작은 `handle_errors=True`이고, 필요하면 직접 바꿀 수 있다.

```python
from pydantic import BaseModel, Field
from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy


class ProductReview(BaseModel):
    rating: int = Field(ge=1, le=5, description="1에서 5 사이 평점")
    summary: str = Field(description="리뷰 요약")


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    response_format=ToolStrategy(
        schema=ProductReview,
        handle_errors="rating은 1에서 5 사이 정수여야 합니다. 형식을 다시 맞춰주세요.",
    ),
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "이 제품은 10점 만점에 10점이고 배송은 빨랐어.",
            }
        ]
    }
)

print(result["structured_response"])
```

이 패턴은 특히 아래 상황에서 유용하다.

- 사용자 입력이 거칠고 비정형적임
- 내부 정책상 특정 enum, 숫자 범위를 반드시 지켜야 함
- 실패 시 그냥 예외를 던지기보다 한 번 더 복구를 시도하고 싶음

## 언제 어떤 방식을 고르면 좋은가

### `response_format=MySchema`

가장 무난한 시작점이다.

- 새 프로젝트에서 먼저 간단히 붙여 보고 싶을 때
- provider-native 지원 여부를 LangChain 자동 선택에 맡기고 싶을 때
- 코드 복잡도를 낮추고 싶을 때

### `ProviderStrategy(MySchema)`

의도를 더 분명히 쓰고 싶을 때 좋다.

- structured output 신뢰도가 매우 중요할 때
- provider-native enforcement를 기대할 때
- strict 옵션을 명시하고 싶을 때

### `ToolStrategy(MySchema)`

fallback 제어가 필요할 때 좋다.

- native structured output이 없는 모델도 함께 지원해야 할 때
- `tool_message_content`, `handle_errors`를 세밀하게 조정하고 싶을 때
- 여러 모델 공급자를 넓게 가져가야 할 때

## 자주 막히는 함정

### 1. 최종 메시지만 읽고 `structured_response`를 안 읽는 경우

LangChain은 구조화 결과를 별도 키에 넣어준다.  
후처리 코드는 보통 `result["messages"][-1].content`가 아니라 `result["structured_response"]`를 기준으로 짜야 한다.

### 2. field description을 너무 대충 쓰는 경우

모델은 스키마 이름뿐 아니라 각 필드 설명에도 크게 영향을 받는다.  
`summary: str`만 두기보다 "추천 이유를 한 문장으로 요약"처럼 써 주는 편이 안정적이다.

### 3. tool과 structured output을 같이 쓰면서 모델 capability를 확인하지 않는 경우

공식 문서 기준으로 tools가 있는 경우에는 모델이 "tool use + structured output 동시 지원"을 해야 한다.  
이 조합이 약한 모델이면 스키마 준수율이 급격히 흔들릴 수 있다.

### 4. 예전 LangChain 예제를 그대로 가져오는 경우

오래된 블로그 글에는 output parser를 직접 붙이거나 `AgentExecutor` 중심으로 설명하는 예제가 아직 많다.  
새 프로젝트라면 LangChain v1의 `create_agent(..., response_format=...)` 흐름에서 시작하는 편이 훨씬 단순하다.

## 마무리

LangChain에서 structured output은 "예쁘게 JSON 비슷하게 받는 기능"이 아니라, 에이전트 결과를 실제 서비스 코드와 연결하는 가장 실용적인 안전장치에 가깝다.

- 빠르게 시작할 때는 `response_format=MySchema`
- provider-native 강제력이 중요하면 `ProviderStrategy`
- 모델 호환성과 오류 제어가 더 중요하면 `ToolStrategy`

에이전트를 붙인 뒤 문자열 파싱 코드가 늘어나기 시작했다면, 그 시점이 structured output으로 넘어갈 가장 좋은 타이밍이다.

## 참고 자료

- [LangChain Structured output](https://docs.langchain.com/oss/python/langchain/structured-output)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain Models](https://docs.langchain.com/oss/python/langchain/models)
- [LangChain Install](https://docs.langchain.com/oss/python/langchain/install)
