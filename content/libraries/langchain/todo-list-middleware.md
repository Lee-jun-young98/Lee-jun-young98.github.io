---
title: LangChain TodoListMiddleware로 복잡한 작업 계획 추적하기
description: LangChain TodoListMiddleware로 복잡한 멀티스텝 작업에 `write_todos` 계획 도구를 붙이고 진행 상태를 추적하는 실전 패턴 정리
date: 2026-06-12
tags:
  - langchain
  - agent
  - middleware
  - planning
  - python
---

# LangChain TodoListMiddleware로 복잡한 작업 계획 추적하기

LangChain agent가 한 번에 끝나는 간단한 질의만 처리한다면 별도 계획 도구가 없어도 괜찮다. 하지만 파일 읽기, 코드 수정, 테스트 실행, 결과 요약처럼 여러 단계를 거치는 작업에서는 "지금 무엇을 했고 다음엔 무엇을 해야 하는지"가 금방 흐려진다.

이럴 때 LangChain의 `TodoListMiddleware`를 붙이면 agent에 `write_todos` 도구와 계획용 시스템 프롬프트가 자동으로 추가된다. 공식 문서 기준으로 이 미들웨어는 복잡한 멀티스텝 작업과 장시간 실행 작업에서 진행 가시성을 높이는 용도로 소개된다.

이번 글에서는 아래를 중심으로 정리한다.

- `TodoListMiddleware`가 언제 유용한지
- `write_todos` 도구가 어떻게 붙는지
- 기본 사용 예제와 커스텀 프롬프트 예제
- 다른 middleware와 함께 쓸 때의 실전 팁
- 자주 하는 실수

## 언제 쓰면 좋은가

`TodoListMiddleware`는 "도구를 많이 쓰는 agent"에만 필요한 것이 아니라 "여러 단계를 잊지 않고 끝까지 밀어야 하는 agent"에 특히 잘 맞는다.

- 리포지토리 분석 후 수정 포인트를 순서대로 처리해야 할 때
- 검색, DB 조회, 문서 작성, 검증처럼 단계별 산출물이 이어질 때
- 사용자에게 현재 진행률을 설명해야 할 때
- 한 번의 답변보다 작업 완료 자체가 중요한 coding / ops 성격 agent일 때

반대로 아래처럼 단순한 경우에는 굳이 붙이지 않아도 된다.

- 한 번의 질의응답으로 끝나는 assistant
- tool 호출이 0~1번 정도인 짧은 workflow
- 계획보다 빠른 응답이 더 중요한 UI

핵심은 "생각을 길게 하게 만드는 기능"이 아니라 "해야 할 일을 구조화해 빠뜨리지 않게 만드는 기능"으로 보는 것이다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

macOS / Linux:

```bash
export OPENAI_API_KEY="your-api-key"
```

## 1. 가장 단순한 시작: `write_todos` 도구 자동 주입

공식 문서 기준으로 `TodoListMiddleware()`를 `create_agent(...)`의 `middleware`에 넣으면 agent는 자동으로 `write_todos` 도구를 사용할 수 있게 된다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import TodoListMiddleware
from langchain.tools import tool


@tool
def read_spec(topic: str) -> str:
    """주제에 대한 간단한 명세를 읽어온다고 가정한 예제 도구."""
    return f"{topic} 관련 요구사항 3개를 찾았습니다."


@tool
def run_checks(target: str) -> str:
    """작업 후 검증을 수행한다고 가정한 예제 도구."""
    return f"{target} 검증을 완료했습니다."


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[read_spec, run_checks],
    middleware=[TodoListMiddleware()],
    system_prompt=(
        "복잡한 작업이면 먼저 해야 할 일을 정리하고, "
        "완료한 항목과 남은 항목을 구분해서 진행하라."
    ),
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "새 기능 요구사항을 확인하고 핵심 체크리스트를 정리한 뒤 "
                    "마지막에 검증 단계까지 포함해 요약해줘."
                ),
            }
        ]
    }
)

print(result["messages"][-1].content)
```

중요한 점은 `write_todos`를 직접 tool로 만들 필요가 없다는 것이다.  
`TodoListMiddleware`가 계획과 추적을 위한 도구 설명과 시스템 지침을 함께 넣어준다.

즉 흐름은 보통 이렇게 간다.

1. 모델이 작업을 여러 단계로 나눈다.
2. 필요하면 `write_todos`로 할 일 목록을 만든다.
3. 다른 tool을 호출하며 작업을 진행한다.
4. 완료/진행 중/미완료 상태를 갱신한다.
5. 마지막 답변에서 남은 작업이나 완료 결과를 함께 정리한다.

## 2. 어떤 작업에서 체감 차이가 큰가

간단한 질의보다 여러 tool이 연결된 작업에서 효과가 더 잘 보인다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import TodoListMiddleware
from langchain.tools import tool


@tool
def search_docs(query: str) -> str:
    """문서를 검색한다."""
    return f"search result for: {query}"


@tool
def draft_summary(notes: str) -> str:
    """초안 문단을 만든다."""
    return f"drafted summary: {notes}"


@tool
def verify_links(topic: str) -> str:
    """링크 점검을 수행한다."""
    return f"{topic} 링크를 확인했습니다."


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[search_docs, draft_summary, verify_links],
    middleware=[TodoListMiddleware()],
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "LangChain middleware 문서를 찾아 핵심 개념을 정리하고, "
                    "짧은 요약 초안을 만든 뒤 참고 링크 점검까지 해줘."
                ),
            }
        ]
    }
)
```

이런 작업에서는 model이 중간에 목적을 잊기 쉽다.  
특히 검색 결과를 몇 번 본 뒤 초안 작성과 검증 단계를 빼먹는 경우가 있는데, todo 목록이 있으면 남은 단계가 더 잘 유지된다.

## 3. `system_prompt`와 `tool_description` 커스터마이즈

공식 문서 기준으로 `TodoListMiddleware`는 `system_prompt`와 `tool_description`을 커스터마이즈할 수 있다.  
이 두 옵션은 "언제 todo를 써야 하는지"와 "무엇을 기록해야 하는지"를 더 분명하게 만들 때 유용하다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import TodoListMiddleware


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    middleware=[
        TodoListMiddleware(
            system_prompt=(
                "작업이 3단계 이상이거나 파일 수정과 검증이 포함되면 "
                "반드시 todo 목록을 먼저 만들고, 각 단계가 끝날 때마다 "
                "진행 상태를 갱신하라."
            ),
            tool_description=(
                "작업 계획을 생성하거나 갱신한다. 각 항목은 짧고 실행 가능해야 하며, "
                "완료/진행 중/대기 상태를 구분해 기록한다."
            ),
        )
    ],
)
```

실무에서는 기본 prompt도 충분한 편이지만, 아래처럼 팀 규칙이 분명하면 커스텀 값이 도움이 된다.

- 파일 수정 전 반드시 검증 단계를 todo에 넣기
- 외부 API 호출 전 승인 단계를 todo에 넣기
- 최종 답변 전에 미완료 항목을 다시 확인하기

## 4. 다른 middleware와 함께 쓰는 패턴

`TodoListMiddleware`는 혼자보다 다른 운영성 middleware와 함께 둘 때 더 실전적이다.

### `ToolCallLimitMiddleware`와 조합

todo 목록이 있다고 해서 tool 남용이 자동으로 줄어드는 것은 아니다.  
복잡한 작업을 세분화하다 보면 오히려 tool 호출 수가 늘 수도 있어서, 계획 추적과 비용 제한은 별도 문제로 다뤄야 한다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import (
    TodoListMiddleware,
    ToolCallLimitMiddleware,
)


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    middleware=[
        TodoListMiddleware(),
        ToolCallLimitMiddleware(run_limit=6, thread_limit=12),
    ],
)
```

이 조합은 "무엇을 해야 하는지 잊지 않기"와 "얼마나 많이 호출할 수 있는지 제한하기"를 분리해서 다룬다.

### `HumanInTheLoopMiddleware`와 조합

결제, 배포, 메일 발송처럼 승인 단계가 있는 agent라면 todo 목록에 승인 단계를 남기고 실제 실행 직전에 human approval을 거는 구성이 자연스럽다.

즉 todo는 작업 계획을 보여주고, human-in-the-loop는 위험 작업의 실행을 멈추는 역할이다.

## 5. 자주 하는 실수

### 5-1. 단순한 agent에도 무조건 붙인다

todo 기능은 공짜가 아니다.  
짧은 질의응답 agent에 붙이면 계획을 세우느라 토큰과 응답 시간이 늘고, 사용자 입장에서는 오히려 장황해질 수 있다.

### 5-2. todo를 영구 메모리처럼 기대한다

`TodoListMiddleware`는 현재 작업의 계획과 진행 추적에 가깝다.  
사용자 선호나 다음 세션까지 이어질 정보를 저장하려면 `store` 기반 long-term memory가 더 맞다.

### 5-3. 완료 기준을 너무 모호하게 둔다

"문서 조사", "수정", "검증"처럼 큰 덩어리만 적으면 실제로는 절반만 끝났는데도 완료로 표시하기 쉽다.  
todo 항목은 짧되 검증 가능하게 쪼개는 편이 낫다.

예를 들면 아래가 더 좋다.

- 나쁨: "문서 조사"
- 좋음: "공식 문서에서 설정 옵션 2개 확인"

### 5-4. tool 설명이 약해서 계획이 흐려진다

모델은 tool 이름과 설명을 보고 어떤 순서로 쓸지 판단한다.  
`read_file`, `run_checks`, `deploy_site` 같은 도구 설명이 모호하면 todo 항목도 추상적으로 흐르기 쉽다.

### 5-5. 최종 답변에서 미완료 항목을 숨긴다

todo 목록을 썼는데도 마지막 답변에서 미완료 항목을 감추면 운영상 더 위험해진다.  
특히 coding agent에서는 "무엇을 완료했고 무엇을 못 했는지"를 그대로 드러내는 편이 낫다.

## 어떤 경우에 먼저 도입할까

개인적으로는 아래 순서가 무난하다.

1. `create_agent` + 핵심 tools로 기본 동작을 먼저 만든다.
2. 작업 누락이 잦아지면 `TodoListMiddleware`를 붙인다.
3. 호출 비용이 늘면 `ToolCallLimitMiddleware`나 selector 계열 middleware를 더한다.
4. 위험 작업이 있으면 `HumanInTheLoopMiddleware`를 붙인다.

즉 todo middleware는 agent를 더 똑똑하게 만든다기보다, 복잡한 작업을 더 일관되게 끝내도록 만드는 운영 도구에 가깝다.

## 마무리

`TodoListMiddleware`는 LangChain agent에 계획 도구를 자동으로 붙여서 멀티스텝 작업의 누락을 줄이는 간단한 방법이다.

- `write_todos` 도구와 계획 지침이 자동으로 추가된다
- 복잡한 coding / research / ops 작업에서 특히 체감이 크다
- 비용 제한, 승인, 장기 메모리와는 다른 문제를 푼다

짧은 assistant에는 과할 수 있지만, 파일 수정과 검증처럼 여러 단계를 끝까지 밀어야 하는 agent라면 비교적 작은 설정으로 얻는 운영 이점이 크다.

## 참고 자료

- [LangChain Prebuilt Middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [LangChain TodoListMiddleware Reference](https://reference.langchain.com/python/langchain/agents/middleware/todo/TodoListMiddleware)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain Custom Middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
