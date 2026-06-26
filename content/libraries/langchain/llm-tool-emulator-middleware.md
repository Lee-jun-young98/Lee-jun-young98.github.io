---
title: LangChain LLMToolEmulator로 실제 툴 없이 에이전트 흐름 테스트하기
description: LangChain LLMToolEmulator로 실제 환불, 메일, 외부 API 호출 없이 tool calling 에이전트의 의사결정과 프롬프트 흐름을 빠르게 검증하는 방법 정리
date: 2026-06-26
tags:
  - langchain
  - agent
  - middleware
  - testing
  - python
aliases:
  - "/blog/llm-tool-emulator-middleware"
---

# LangChain LLMToolEmulator로 실제 툴 없이 에이전트 흐름 테스트하기

에이전트를 붙이다 보면 가장 먼저 막히는 구간이 "모델은 괜찮은데 실제 툴을 지금 호출해도 되나?"인 경우가 많습니다.

- 환불, 결제, 메일 발송처럼 부작용이 있는 툴은 개발 중에 바로 실행하기 부담스럽습니다.
- 아직 외부 API가 준비되지 않았는데도 에이전트의 의사결정 흐름은 먼저 보고 싶을 수 있습니다.
- 툴 호출 비용이 크거나 샌드박스가 없는 환경에서는 빠른 반복이 어렵습니다.

이때 LangChain의 `LLMToolEmulator`를 쓰면 실제 툴을 실행하는 대신, 별도 LLM이 "그 툴이 이런 응답을 돌려줬을 것 같은" 결과를 만들어 줍니다.  
2026-06-26 기준 LangChain 공식 prebuilt middleware 문서는 이 미들웨어를 테스트, 프로토타이핑, 외부 툴이 없거나 비싼 경우에 쓰라고 설명합니다.

이 글에서는 아래만 실전 기준으로 빠르게 정리합니다.

- `LLMToolEmulator`가 정확히 무엇을 바꿔 주는지
- 모든 툴을 에뮬레이션할 때와 일부 툴만 에뮬레이션할 때의 차이
- 실제 부작용 툴 없이 에이전트 흐름을 검증하는 Python 예제
- 자주 생기는 오해와 운영상 주의점

## 언제 특히 유용한가

다음 상황이면 거의 바로 써볼 가치가 있습니다.

- 환불, 메일 발송, 파일 삭제처럼 실수 비용이 큰 툴이 있다
- 사내 API, MCP 서버, DB 연결이 아직 준비되지 않았다
- 에이전트가 어떤 툴을 고르고 어떤 순서로 쓰는지 먼저 보고 싶다
- CI나 로컬 검증에서 실제 네트워크 호출 없이 프롬프트와 tool routing만 확인하고 싶다

반대로 툴 출력의 정확한 값 자체를 검증해야 한다면 이 미들웨어보다 deterministic fake나 unit test가 더 맞습니다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langchain-openai
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

아래 예시는 LangChain 공식 문서와 같은 `create_agent(...)` + middleware 패턴을 사용합니다.  
모델 이름은 문서 예시처럼 `openai:gpt-5.5`를 썼지만, 계정에서 허용된 모델 문자열로 바꿔도 됩니다.

## 1. 가장 단순한 형태: 모든 툴을 에뮬레이션하기

공식 문서 기준 기본값은 등록된 모든 툴 에뮬레이션입니다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import LLMToolEmulator
from langchain.tools import tool


@tool
def search_orders(order_id: str) -> str:
    """Look up the order status."""
    return f"Order {order_id}: delivered yesterday"


@tool
def send_refund(order_id: str, reason: str) -> str:
    """Submit a refund request."""
    return f"Refund submitted for {order_id}: {reason}"


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[search_orders, send_refund],
    middleware=[
        LLMToolEmulator(),
    ],
    system_prompt=(
        "You are a support agent. Explain what you are doing and use tools "
        "when account or refund actions are needed."
    ),
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "주문번호 A-1024 상태를 확인하고 환불 가능하면 진행해줘.",
            }
        ]
    }
)

for message in result["messages"]:
    print(type(message).__name__, getattr(message, "content", ""))
```

이 예제에서 핵심은 `search_orders`, `send_refund` 함수 본문이 실제로 실행되지 않을 수 있다는 점입니다.  
대신 에뮬레이터가 툴 설명, 인자, 대화 맥락을 보고 그럴듯한 `ToolMessage`를 생성해 에이전트 루프를 이어 갑니다.

즉 개발 초반에는 아래를 빨리 볼 수 있습니다.

- 모델이 어떤 툴을 고르는지
- 툴 입력 인자를 대충이 아니라 그럴듯하게 채우는지
- 툴 결과를 받은 뒤 최종 답변을 어떻게 마무리하는지

## 2. 일부 툴만 에뮬레이션하고 나머지는 실제로 실행하기

실전에서는 이 패턴이 더 자주 필요합니다.  
"조회 툴은 진짜로 써도 되지만, 부작용 툴만 막고 싶다"는 경우입니다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import LLMToolEmulator
from langchain.tools import tool


@tool
def get_refund_policy() -> str:
    """Return the refund policy text."""
    return "배송 완료 후 7일 이내이며 미사용 상태면 환불 요청 가능"


@tool
def create_refund_ticket(order_id: str, reason: str) -> str:
    """Create a refund ticket in the back office."""
    raise RuntimeError("This should not run in local development")


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[get_refund_policy, create_refund_ticket],
    middleware=[
        LLMToolEmulator(tools=["create_refund_ticket"]),
    ],
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "환불 규정을 확인하고 주문 A-1024 환불 접수까지 진행해줘.",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

여기서는 `get_refund_policy`는 실제로 실행되고, `create_refund_ticket`만 LLM이 대신 흉내 냅니다.  
이 패턴이 좋은 이유는 아래와 같습니다.

- 읽기 전용 툴은 실제 출력으로 검증할 수 있다
- 쓰기/삭제/결제 계열 툴만 안전하게 막을 수 있다
- 에이전트의 전체 멀티스텝 흐름은 거의 그대로 볼 수 있다

## 3. 에뮬레이터 전용 모델을 따로 두기

공식 문서 기준 `model=` 파라미터를 주지 않으면 에이전트의 메인 모델을 그대로 사용합니다.  
하지만 테스트 비용을 줄이려면 에뮬레이션 쪽만 더 저렴한 모델로 분리하는 편이 실용적입니다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import LLMToolEmulator

agent = create_agent(
    model="openai:gpt-5.5",
    tools=[...],
    middleware=[
        LLMToolEmulator(
            tools=["send_email", "create_refund_ticket"],
            model="openai:gpt-5.4-mini",
        )
    ],
)
```

이렇게 두면 메인 에이전트의 추론 품질은 유지하면서, 개발 중에 자주 도는 툴 에뮬레이션 비용은 낮출 수 있습니다.

## 4. 이 미들웨어로 검증하기 좋은 것과 아닌 것

`LLMToolEmulator`는 에이전트 경로 테스트에는 강하지만 정확한 툴 로직 테스트까지 대신하지는 않습니다.

좋은 용도:

- 툴 선택 경로 확인
- 프롬프트와 tool description 품질 점검
- 위험 툴 없이 데모, 로컬 개발, 초기 CI 구성
- 아직 없는 API를 가정한 프로토타이핑

맞지 않는 용도:

- 환불 금액 계산이 정확한지 검증
- SQL 결과 스키마가 정확한지 검증
- 외부 시스템 권한, 인증, 타임아웃 문제 재현
- 툴 출력값에 대해 exact match 테스트 작성

LangChain 테스트 문서도 unit test, integration test, eval을 구분해서 보라고 안내합니다.  
이 미들웨어는 그중 실제 툴 없이 agent integration 흐름을 가볍게 보는 단계에 가깝다고 보면 됩니다.

## 자주 하는 실수

### 1. 에뮬레이션 결과를 실제 시스템 보장처럼 받아들이는 경우

에뮬레이터가 만드는 응답은 어디까지나 그럴듯한 응답입니다.  
따라서 환불 성공, 메일 발송 성공 같은 메시지가 나와도 실제 백오피스 연동이 검증된 것은 아닙니다.

### 2. tool description이 빈약한데 에뮬레이터 품질이 낮다고 생각하는 경우

에뮬레이터도 결국 툴 설명과 인자를 보고 답을 만듭니다.  
툴 docstring이 모호하면 실제 실행 대신 흉내 낼 때도 결과가 흔들립니다.

### 3. 모든 테스트를 에뮬레이터로만 끝내는 경우

로컬 반복에는 좋지만, 배포 전에는 실제 툴을 붙인 integration test가 별도로 있어야 합니다.  
특히 인증, rate limit, 스키마 mismatch는 에뮬레이션으로 잡히지 않습니다.

### 4. 어떤 툴이 에뮬레이션 중인지 구분하지 않는 경우

로그나 테스트 출력에서 real tool과 emulated tool을 구분해 두는 편이 좋습니다.  
나중에 실패 원인이 프롬프트인지, 실제 연동인지 분리하기 쉬워집니다.

## 운영 팁

- 부작용 툴만 선택적으로 에뮬레이션하는 mixed mode부터 시작하는 편이 가장 실용적입니다.
- LangSmith를 함께 쓰면 모델이 어떤 툴을 고르고 어떤 인자를 만들었는지 trace로 보기 좋습니다.
- CI에서는 `pytest -m "not integration"` 같은 빠른 테스트 레인에 에뮬레이터 기반 시나리오를 두고, 실제 툴 검증은 별도 integration 레인으로 분리하는 편이 낫습니다.

## 마무리

`LLMToolEmulator`는 실제 툴이 아직 준비되지 않았거나 지금 호출하면 위험한데, 에이전트 루프는 먼저 보고 싶을 때 매우 효율적입니다.

정리하면 흐름은 단순합니다.

1. `create_agent(...)`에 실제 툴 목록을 등록합니다.
2. `LLMToolEmulator()`로 전부 또는 일부 툴을 에뮬레이션합니다.
3. 로컬과 CI에서는 빠르게 흐름을 검증하고, 실제 연동 검증은 integration test로 분리합니다.

에이전트 개발 초반에 가장 비싼 것은 보통 실수로 진짜 툴을 건드리는 것과 외부 의존성 때문에 반복이 느려지는 것입니다.  
그 둘을 동시에 줄이는 용도로 이 미들웨어가 꽤 실전적입니다.

## 참고 자료

- [LangChain Prebuilt middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain Test overview](https://docs.langchain.com/oss/python/langchain/test)
- [LangChain Integration testing](https://docs.langchain.com/oss/python/langchain/test/integration-testing)
