---
title: LangChain PIIMiddleware로 입력과 출력의 민감정보 가드레일 두기
description: LangChain PIIMiddleware로 이메일, 카드번호, API 키 같은 민감정보를 redact, mask, block 처리하는 실전 패턴 정리
date: 2026-06-05
tags:
  - langchain
  - agent
  - guardrails
  - middleware
  - python
---

# LangChain PIIMiddleware로 입력과 출력의 민감정보 가드레일 두기

LangChain agent를 실제 서비스에 붙이기 시작하면 tool calling이나 memory보다 먼저 부딪히는 문제가 있다.  
사용자 입력이나 tool 결과에 이메일, 카드번호, 내부 API 키 같은 민감정보가 그대로 섞여 들어오는 문제다.

- 모델 호출 전에 민감정보를 지워야 한다
- 로그와 trace에 그대로 남지 않게 해야 한다
- 일부 패턴은 아예 차단해야 한다
- 읽기 전용 검색 agent라도 출력 정제가 필요할 수 있다

이럴 때 LangChain의 `PIIMiddleware`를 붙이면 입력, 출력, tool 결과에 대해 공통 규칙을 걸 수 있다.  
공식 guardrails 문서 기준으로 `PIIMiddleware`는 built-in PII 타입과 custom detector를 지원하고, 처리 전략으로 `redact`, `mask`, `hash`, `block`을 제공한다.

이번 글에서는 아래만 실전 기준으로 정리한다.

- 어떤 경우에 `PIIMiddleware`가 바로 필요한지
- 입력 단계에서 이메일과 카드번호를 정제하는 최소 예제
- custom detector로 API 키를 차단하는 방법
- 출력과 tool 결과까지 검사할 때 주의할 점
- 운영에서 자주 생기는 실수

## 언제 바로 써야 하나

다음 조건 중 하나라도 있으면 초기에 붙이는 편이 낫다.

- 고객지원, 헬스케어, 금융처럼 민감정보가 자주 들어온다
- LangSmith trace나 자체 로그에 원문이 남으면 안 된다
- tool이 외부 시스템에서 개인정보를 가져올 수 있다
- 프롬프트 인젝션보다 먼저 데이터 유출 위험을 줄여야 한다

반대로 `PIIMiddleware`는 권한 승인 기능은 아니다.  
메일 발송, DB 수정처럼 행위 자체를 통제하려면 `HumanInTheLoopMiddleware` 같은 별도 레이어가 필요하다.

## 사전 준비

공식 문서 기준으로 기본 예제는 아래 패키지면 충분하다.

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

출력 스트림까지 정제하려면 공식 문서 기준 `langchain>=1.3.2`가 필요하다.

## 1. 가장 작은 예제: 입력에서 이메일과 카드번호 처리하기

공식 guardrails 문서 흐름대로 보면 `PIIMiddleware`는 agent 생성 시 여러 개를 나란히 붙이는 방식이 가장 단순하다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import PIIMiddleware


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    middleware=[
        PIIMiddleware(
            "email",
            strategy="redact",
            apply_to_input=True,
        ),
        PIIMiddleware(
            "credit_card",
            strategy="mask",
            apply_to_input=True,
        ),
    ],
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "내 이메일은 kim@example.com이고 "
                    "카드번호는 5105-1051-0510-5100이야."
                ),
            }
        ]
    }
)

print(result["messages"][-1].content)
```

이 설정이면 모델로 들어가기 전에 아래처럼 처리된다.

- 이메일은 `[REDACTED_EMAIL]` 같은 형태로 치환
- 카드번호는 마지막 일부만 남기고 mask 처리

즉 모델 품질보다 먼저 "모델에 무엇을 보내지 않을지"를 결정하는 레이어라고 보면 된다.

## 2. custom detector로 API 키를 아예 차단하기

내부 서비스에서는 built-in PII보다 API 키, 고객 식별자, 사내 토큰 같은 패턴이 더 중요할 수 있다.  
공식 문서 기준 `detector`에는 regex나 custom detector를 넣을 수 있다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import PIIMiddleware


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    middleware=[
        PIIMiddleware(
            "api_key",
            detector=r"sk-[A-Za-z0-9]{32,}",
            strategy="block",
            apply_to_input=True,
        )
    ],
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "이 키로 테스트해줘: sk-1234567890abcdefghijklmnopqrstuv",
            }
        ]
    }
)
```

`strategy="block"`이면 민감정보를 가린 뒤 계속 진행하는 것이 아니라, 감지 즉시 예외를 발생시켜 실행을 멈춘다.  
실수로 비밀키를 붙여 넣는 내부 운영 도구라면 이 전략이 가장 보수적이다.

## 3. 출력과 tool 결과도 같이 정제하기

입력만 가려도 충분한 경우가 많지만, 실제로는 tool 결과에서 다시 민감정보가 튀어나오는 경우가 많다.  
예를 들어 CRM 조회 결과나 내부 문서 검색 결과에 이메일, 계정 ID, URL이 섞여 있을 수 있다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import PIIMiddleware
from langchain.tools import tool


@tool
def lookup_customer(name: str) -> str:
    """고객 정보를 조회한다."""
    return "name=Kim, email=kim@example.com, card=5105-1051-0510-5100"


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[lookup_customer],
    middleware=[
        PIIMiddleware(
            "email",
            strategy="redact",
            apply_to_input=True,
            apply_to_output=True,
            apply_to_tool_results=True,
        ),
        PIIMiddleware(
            "credit_card",
            strategy="mask",
            apply_to_tool_results=True,
            apply_to_output=True,
        ),
    ],
)
```

여기서 포인트는 세 가지다.

- `apply_to_input=True`: 사용자 입력 검사
- `apply_to_tool_results=True`: tool이 반환한 메시지 검사
- `apply_to_output=True`: 모델 최종 출력과 스트리밍 출력까지 검사

공식 문서 기준 `apply_to_output=True`는 streamed wire output까지 redaction하며, 이 동작은 `langchain>=1.3.2`에서 지원된다.

## 4. 어떤 전략을 골라야 하나

공식 문서에 나온 전략은 네 가지다.

- `redact`: 완전히 치환하기. 로그, trace, 일반 텍스트에서 가장 무난하다.
- `mask`: 일부만 남기기. 카드번호나 전화번호처럼 마지막 일부 확인이 필요할 때 유용하다.
- `hash`: 원문은 숨기되 같은 값인지 비교는 가능하게 만들 때 쓴다.
- `block`: 감지 즉시 실패시킨다. 내부 키, 주민번호급 정보, 절대 유출되면 안 되는 값에 적합하다.

보통 시작점은 아래 조합이 현실적이다.

- 사용자 입력 이메일, URL: `redact`
- 카드번호, 계좌 비슷한 값: `mask`
- 내부 시크릿, API 키: `block`

## 5. 운영에서 자주 생기는 실수

### 5-1. 입력만 검사하고 tool 결과는 그대로 둔다

실제 유출은 종종 사용자 입력보다 조회 결과에서 발생한다.  
검색, CRM, 티켓 시스템, 벡터 검색 결과를 쓰는 agent라면 `apply_to_tool_results`를 먼저 검토해야 한다.

### 5-2. `block`을 너무 넓게 걸어 정상 워크플로까지 깨뜨린다

예를 들어 URL 전체를 모두 `block`하면 문서 링크를 다루는 agent가 사실상 쓸모없어질 수 있다.  
무조건 차단보다 "무엇을 가려도 되는지, 무엇은 흐름 자체를 멈춰야 하는지"를 나눠야 한다.

### 5-3. 정제 뒤 의미 손실을 고려하지 않는다

카드번호나 이메일을 모두 `redact`하면 모델이 후속 작업을 수행하기 어려울 수 있다.  
사용자 확인용 마지막 네 자리가 필요하면 `mask`가 더 맞다.

### 5-4. 출력 스트림 보호 버전 조건을 놓친다

공식 문서 기준 `apply_to_output=True`의 스트림 변환은 `langchain>=1.3.2`가 필요하다.  
로컬에서는 되는데 배포 환경에서만 안 되면 패키지 버전부터 확인하는 편이 빠르다.

### 5-5. PII 가드레일을 권한 통제로 오해한다

민감정보를 지우는 것과 위험 행위를 승인하는 것은 별개다.  
예를 들어 "고객 이메일을 가린다"와 "고객에게 메일을 보내기 전에 승인받는다"는 서로 다른 요구사항이다.

## 실전 조합 예시

개인적으로는 아래 조합이 가장 실용적이다.

1. `PIIMiddleware`로 입력과 tool 결과를 정제한다.
2. `HumanInTheLoopMiddleware`로 발송, 수정, 결제 같은 쓰기 동작을 승인받는다.
3. `ToolRetryMiddleware`는 외부 API 조회처럼 일시 실패가 있는 읽기 도구에만 제한적으로 붙인다.

이렇게 나누면 데이터 보호, 행위 통제, 복구 전략이 서로 섞이지 않는다.

## 마무리

`PIIMiddleware`는 agent를 더 똑똑하게 만드는 기능이 아니라,  
"모델과 로그에 무엇을 남길지"를 먼저 통제하는 안전 레이어에 가깝다.

- built-in PII 타입으로 빠르게 시작할 수 있고
- regex나 custom detector로 사내 패턴도 막을 수 있고
- 입력, 출력, tool 결과를 각각 다른 강도로 보호할 수 있다

실무에서는 대개 prompt 품질보다 먼저 데이터 경계를 정해야 한다.  
민감정보가 오갈 가능성이 있는 agent라면 `PIIMiddleware`는 초반부터 붙여 둘 가치가 충분하다.

## 참고 자료

- [LangChain Guardrails](https://docs.langchain.com/oss/python/langchain/guardrails)
- [LangChain Prebuilt Middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [LangChain Middleware Overview](https://docs.langchain.com/oss/python/langchain/middleware)
- [LangChain Deep Agents: Going to production](https://docs.langchain.com/oss/python/deepagents/going-to-production)
