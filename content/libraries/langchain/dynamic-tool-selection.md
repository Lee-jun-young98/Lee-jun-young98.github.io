---
title: LangChain 동적 도구 선택으로 프롬프트를 줄이고 권한을 나누기
description: LangChain `wrap_model_call`로 런타임마다 필요한 도구만 노출해 에이전트 정확도와 권한 제어를 함께 개선하는 실전 패턴 정리
date: 2026-06-10
tags:
  - langchain
  - agent
  - tools
  - middleware
  - python
---

# LangChain 동적 도구 선택으로 프롬프트를 줄이고 권한을 나누기
LangChain 에이전트에 도구를 많이 붙이기 시작하면 금방 두 가지 문제가 생깁니다.

- 모델이 매 턴마다 너무 많은 도구 설명을 함께 읽어야 해서 프롬프트가 길어집니다.
- 현재 사용자나 현재 단계에서는 쓸 필요가 없는 도구까지 항상 노출되어 잘못된 호출이 늘어납니다.

공식 문서 기준으로 LangChain v1 에이전트는 `middleware`의 `wrap_model_call` 훅에서 현재 호출에 쓸 도구 목록을 바꿀 수 있습니다.  
핵심은 `create_agent(..., tools=all_tools)`로 후보 도구를 미리 등록해 두고, 실제 모델 호출 직전에 `request.override(tools=...)`로 그 턴에 필요한 일부만 노출하는 방식입니다.

이 글에서는 아래를 실무 기준으로 빠르게 정리합니다.

- 동적 도구 선택이 왜 필요한지
- `wrap_model_call`로 사용자 권한에 따라 도구를 줄이는 방법
- 대화 단계에 따라 도구 구성을 바꾸는 방법
- 자주 하는 실수와 운영 팁

## 언제 특히 유용한가
동적 도구 선택은 "도구를 많이 만들수록 더 좋아진다"가 아니라 "지금 필요한 도구만 보여 주는 편이 더 낫다"는 상황에서 빛납니다.

- 로그인 상태에 따라 결제, 계정, 관리자 도구를 나눠야 할 때
- 무료 사용자와 유료 사용자에게 다른 도구 집합을 노출해야 할 때
- 초반 탐색 단계와 후반 실행 단계에서 필요한 도구가 다를 때
- 내부 운영 도구를 일반 사용자 대화에서는 숨기고 싶을 때
- 너무 많은 도구 때문에 모델이 엉뚱한 도구를 집는 문제가 있을 때

## 사전 준비
예시는 공식 문서의 `create_agent`, `middleware`, `tools` 패턴을 따릅니다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langchain-openai
```

OpenAI 예시:

```bash
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 가장 기본 패턴: 모든 후보 도구를 등록하고 일부만 노출하기
공식 문서의 핵심 제약은 단순합니다.

- 후보 도구는 `create_agent(..., tools=all_tools)`에 미리 등록해야 합니다.
- 매 호출마다 `wrap_model_call`에서 관련 도구만 골라 `request.override(tools=...)`로 넘깁니다.

아래 예시는 사용자 역할에 따라 환불 도구를 숨기는 가장 기본적인 형태입니다.

```python
from dataclasses import dataclass
from collections.abc import Callable

from langchain.agents import create_agent
from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call
from langchain.tools import tool


@dataclass
class UserContext:
    user_id: str
    is_premium: bool
    can_refund: bool


@tool
def search_docs(question: str) -> str:
    """제품 문서에서 사용법을 찾습니다."""
    return f"docs result for: {question}"


@tool
def check_subscription() -> str:
    """현재 구독 상태를 확인합니다."""
    return "premium plan active"


@tool
def issue_refund(order_id: str) -> str:
    """주문을 환불합니다. 운영 권한이 있어야 합니다."""
    return f"refund requested for {order_id}"


all_tools = [search_docs, check_subscription, issue_refund]


@wrap_model_call
def select_tools_by_role(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    context = request.runtime.context

    selected_tools = [search_docs]

    if context.is_premium:
        selected_tools.append(check_subscription)

    if context.can_refund:
        selected_tools.append(issue_refund)

    return handler(request.override(tools=selected_tools))


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=all_tools,
    middleware=[select_tools_by_role],
    context_schema=UserContext,
)


result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "내 구독 상태를 확인하고 환불도 가능한지 봐줘.",
            }
        ]
    },
    context=UserContext(
        user_id="user-123",
        is_premium=True,
        can_refund=False,
    ),
)

print(result["messages"][-1].content)
```

이 패턴의 포인트는 세 가지입니다.

- 모델은 현재 턴에 선택된 도구만 볼 수 있습니다.
- 숨겨진 도구는 툴 설명 토큰도 함께 줄어듭니다.
- 권한, 요금제, 조직, 실험 플래그에 따라 도구 노출을 쉽게 바꿀 수 있습니다.

## 2. 대화 단계에 따라 도구를 바꾸기
동적 도구 선택은 권한 제어뿐 아니라 "현재 단계에 맞는 최소 도구 세트"를 만드는 데도 좋습니다.

예를 들어 초반에는 검색만 허용하고, 사용자가 실행 의사를 명확히 밝힌 뒤에만 변경 도구를 노출할 수 있습니다.

```python
from collections.abc import Callable

from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call


EXECUTION_KEYWORDS = ("변경", "수정", "취소", "환불", "실행", "적용")


@wrap_model_call
def select_tools_by_stage(
    request: ModelRequest,
    handler: Callable[[ModelRequest], ModelResponse],
) -> ModelResponse:
    latest_user_text = ""
    for message in reversed(request.state["messages"]):
        if getattr(message, "type", "") == "human":
            latest_user_text = str(message.content)
            break

    selected_tools = [search_docs, check_subscription]

    if any(keyword in latest_user_text for keyword in EXECUTION_KEYWORDS):
        selected_tools.append(issue_refund)

    return handler(request.override(tools=selected_tools))
```

이 방식은 특히 다음에 유용합니다.

- 처음부터 쓰기 권한 도구를 모두 열어 두고 싶지 않을 때
- 정보 조회와 실제 실행 단계를 분리하고 싶을 때
- 모델이 너무 빨리 파괴적 도구를 고르는 문제를 줄이고 싶을 때

## 3. 왜 정확도가 좋아지는가
공식 도구 문서도 "도구가 너무 많으면 모델이 과부하되고 오류가 늘 수 있다"고 설명합니다.  
실무에서는 아래 이유로 품질 차이가 자주 납니다.

- 도구 설명 수가 줄어 모델이 선택지를 덜 헷갈립니다.
- 비슷한 역할의 도구가 많을 때 오선택이 줄어듭니다.
- 현재 문맥과 무관한 관리자 도구가 빠져 잘못된 행동 가능성이 줄어듭니다.
- 모델 호출마다 필요한 도구 설명만 들어가 토큰 비용도 낮아집니다.

즉 동적 도구 선택은 "보안"만의 문제가 아니라 정확도와 비용 최적화 문제이기도 합니다.

## 4. 실무에서 추천하는 선택 기준
처음부터 복잡한 라우터를 만들기보다 아래처럼 단순한 기준부터 시작하는 편이 안전합니다.

- 사용자 역할: 일반 사용자, 운영자, 관리자
- 플랜: 무료, 팀, 엔터프라이즈
- 조직 기능 플래그: 베타 기능 허용 여부
- 대화 단계: 조회 단계인지 실행 단계인지
- 채널: Slack, 웹앱, 내부 운영 콘솔

선택 로직이 너무 복잡해지면 오히려 디버깅이 어려워집니다.  
처음에는 `if/else` 수준으로 시작하고, 실제 오선택 로그가 쌓인 뒤 정교화하는 편이 낫습니다.

## 자주 하는 실수
### 1. 선택할 도구만 등록하고 나머지는 `create_agent`에서 빼는 경우
공식 문서 기준으로 동적 도구 선택은 "미리 등록한 도구 중 일부를 고르는 방식"입니다.  
런타임에 전혀 새로운 도구를 끼워 넣는 패턴으로 이해하면 구현이 꼬이기 쉽습니다.

### 2. 숨긴 도구를 보안 경계로만 믿는 경우
도구를 모델에 노출하지 않는 것은 중요하지만, 그 자체가 완전한 권한 검사는 아닙니다.  
환불, 삭제, 외부 전송처럼 민감한 도구는 도구 함수 안에서도 현재 사용자 권한을 다시 확인하는 편이 안전합니다.

### 3. 너무 자주 도구 집합을 바꿔 일관성을 깨는 경우
같은 종류의 요청인데 턴마다 기준이 흔들리면 모델이 예측하기 어려워집니다.  
선택 로직은 가능하면 결정적이고 설명 가능해야 합니다.

### 4. 비슷한 도구를 너무 많이 남겨 두는 경우
동적 선택을 도입했더라도 최종 노출 집합 안에 거의 같은 도구가 여러 개 있으면 여전히 혼란이 남습니다.  
선택 이후의 도구 세트도 작고 선명하게 유지하는 편이 좋습니다.

### 5. 실패 원인을 추적하지 않는 경우
선택 로직이 잘못됐는지, 모델이 잘못 골랐는지, 도구 실행이 실패했는지를 분리해 봐야 합니다.  
`wrap_tool_call` 로깅이나 LangSmith 추적과 함께 보면 디버깅이 훨씬 쉬워집니다.

## 운영 팁
- 동적 도구 선택과 `ToolCallLimitMiddleware`를 함께 쓰면 과도한 도구 루프를 막기 좋습니다.
- 파괴적 도구는 동적 선택과 `HumanInTheLoopMiddleware`를 같이 두는 편이 안전합니다.
- 사용자별 프리퍼런스가 있다면 `long-term memory`와 연결해 기본 도구 집합을 개인화할 수 있습니다.
- 숨겨진 도구 수, 실제 노출 도구 수, 도구 선택 실패율을 같이 기록하면 개선 방향이 빨리 보입니다.

## 마무리
LangChain의 동적 도구 선택은 "도구를 많이 붙인 뒤 모델이 알아서 잘 고르길 기대하는 방식"에서 벗어나게 해 줍니다.

핵심은 단순합니다.

1. 후보 도구는 미리 등록합니다.
2. 매 모델 호출 직전에 현재 상황에 맞는 일부만 노출합니다.
3. 권한 제어, 토큰 절감, 오선택 감소를 함께 노립니다.

도구 수가 늘수록 에이전트 품질이 흔들린다면, 새 모델을 바꾸기 전에 먼저 "지금 이 턴에 정말 필요한 도구만 보여 주고 있는가"부터 점검하는 편이 효과적입니다.

## 참고 자료

- [LangChain Tools](https://docs.langchain.com/oss/python/langchain/tools)
- [LangChain Custom middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
- [LangChain Middleware overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)
- [LangChain create_agent Reference](https://reference.langchain.com/python/langchain/agents/#langchain.agents.create_agent)
