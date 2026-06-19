---
title: "LangChain OpenAIModerationMiddleware로 입력, 출력, tool 결과 안전성 검사하기"
description: "LangChain OpenAIModerationMiddleware로 사용자 입력, 모델 출력, tool 결과를 OpenAI moderation endpoint로 검사하고 end/error/replace 정책을 구성하는 실전 학습 노트"
date: 2026-06-19
tags:
  - langchain
  - agent
  - middleware
  - guardrails
  - openai
  - python
aliases:
  - "/blog/langchain-openai-moderation-middleware"
---

# LangChain OpenAIModerationMiddleware로 입력, 출력, tool 결과 안전성 검사하기

LangChain agent를 서비스에 붙이면 prompt 품질보다 먼저 맞닥뜨리는 문제가 있다.  
사용자 입력이 위험할 수 있고, tool이 가져온 결과가 그대로 모델 문맥에 들어갈 수도 있고, 최종 출력이 운영 정책을 넘을 수도 있다.

이럴 때 `OpenAIModerationMiddleware`를 붙이면 OpenAI moderation endpoint를 이용해 세 지점을 같은 방식으로 검사할 수 있다.

- 사용자 입력을 모델 호출 전에 막기
- 모델 출력을 사용자에게 보내기 전에 막기
- tool 결과를 다음 모델 호출 전에 막기

2026년 6월 19일 기준 LangChain 공식 OpenAI middleware 문서에는 `check_input`, `check_output`, `check_tool_results`, `exit_behavior`, `violation_message` 같은 옵션이 정리되어 있다.

이 글에서는 아래만 실무 기준으로 짧게 정리한다.

- 어떤 상황에서 바로 붙일 가치가 큰지
- `end`, `error`, `replace`를 언제 고를지
- tool 결과까지 검사해야 하는 이유
- 운영에서 자주 나는 실수

## 언제 바로 붙일 만한가

다음 중 하나라도 해당하면 초기에 붙여둘 가치가 있다.

- 고객 응대형 챗봇처럼 안전성 정책이 중요한 경우
- 검색, CRM, 사내 문서 tool이 민감하거나 공격적인 텍스트를 다시 가져올 수 있는 경우
- 모델 출력 자체도 대외 노출되므로 후단 필터가 필요한 경우
- 자체 guardrail을 만들기 전, 검증된 기본 moderation 레이어가 먼저 필요한 경우

반대로 이 미들웨어는 권한 승인 도구가 아니다.  
파일 삭제, 결제, 메일 발송 같은 위험 행동 승인에는 `HumanInTheLoopMiddleware` 같은 별도 제어가 필요하다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langchain-openai
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 가장 작은 예제

공식 문서 기준 기본 moderation 모델은 `omni-moderation-latest`이고, 기본값은 `check_input=True`, `check_output=True`, `check_tool_results=False`, `exit_behavior="end"`다.

```python
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langchain_openai.middleware import OpenAIModerationMiddleware


agent = create_agent(
    model=ChatOpenAI(model="gpt-5.5"),
    tools=[],
    middleware=[
        OpenAIModerationMiddleware(
            model="omni-moderation-latest",
            check_input=True,
            check_output=True,
            exit_behavior="end",
        )
    ],
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "사내 정책에 맞는 고객 응대 문구를 만들어줘.",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

이 설정이면 흐름은 단순하다.

1. 사용자 입력 검사
2. 안전하면 모델 호출
3. 모델 출력 검사
4. 안전하면 최종 응답 반환

위반이 감지되면 기본적으로 에이전트 실행을 끝내고 위반 메시지를 반환한다.

## 2. `exit_behavior`는 운영 방식에 맞춰 고른다

공식 문서 기준 옵션은 세 가지다.

- `"end"`: 위반 메시지를 남기고 실행 종료
- `"error"`: `OpenAIModerationError` 예외 발생
- `"replace"`: 문제가 된 내용을 위반 메시지로 바꾸고 계속 진행

### `end`

사용자-facing 서비스에서 가장 무난하다.

- 추가 예외 처리 없이 응답을 끝낼 수 있다
- 위험 입력을 모델이나 다음 tool 단계로 넘기지 않는다
- 운영 로그상 "차단됐지만 실패는 아님"으로 다루기 쉽다

### `error`

백엔드가 위반 상황을 별도로 집계하거나 UI에서 자체 처리해야 할 때 맞다.

```python
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langchain_openai.middleware import OpenAIModerationMiddleware


agent = create_agent(
    model=ChatOpenAI(model="gpt-5.5"),
    tools=[],
    middleware=[
        OpenAIModerationMiddleware(
            check_input=True,
            check_output=True,
            exit_behavior="error",
        )
    ],
)
```

API 서버에서 `OpenAIModerationError`를 잡아 4xx 응답이나 자체 정책 안내 화면으로 바꾸는 식이다.

### `replace`

입력 전체를 막기보다는 일부 내용을 치환해 흐름을 유지하고 싶을 때 쓴다.

```python
from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langchain_openai.middleware import OpenAIModerationMiddleware


agent = create_agent(
    model=ChatOpenAI(model="gpt-5.5"),
    tools=[],
    middleware=[
        OpenAIModerationMiddleware(
            check_input=True,
            exit_behavior="replace",
            violation_message="[안전 정책에 따라 일부 내용이 제거되었습니다]",
        )
    ],
)
```

다만 치환 뒤에도 모델이 유의미한 작업을 계속할 수 있는지 확인해야 한다.  
핵심 요구사항까지 지워버리면 겉으로만 정상인 응답이 나오기 쉽다.

## 3. `check_tool_results=True`가 실무에서 중요한 이유

입력만 검사하면 충분하다고 생각하기 쉽지만, 실제로는 tool이 가져온 텍스트가 다시 위험해지는 경우가 많다.

- 웹 검색 결과에 공격적 문구가 섞임
- 고객 메모나 CRM 히스토리에 부적절한 표현이 포함됨
- 사내 문서 검색 결과에 정책상 노출하면 안 되는 문장이 들어 있음

이 경우 `check_tool_results=True`를 켜야 다음 모델 호출 전에 막을 수 있다.

```python
from langchain.agents import create_agent
from langchain.tools import tool
from langchain_openai import ChatOpenAI
from langchain_openai.middleware import OpenAIModerationMiddleware


@tool
def search_ticket_history(ticket_id: str) -> str:
    """고객 티켓 히스토리를 조회한다."""
    return "ticket summary for T-100"


agent = create_agent(
    model=ChatOpenAI(model="gpt-5.5"),
    tools=[search_ticket_history],
    middleware=[
        OpenAIModerationMiddleware(
            check_input=True,
            check_output=True,
            check_tool_results=True,
            exit_behavior="end",
        )
    ],
)
```

즉 moderation 대상을 "사용자 입력" 하나로 보지 말고 "모델 문맥에 들어오는 모든 텍스트"로 봐야 한다.

## 4. 위반 메시지는 기본값 그대로 두지 말고 서비스 문맥에 맞춘다

공식 문서 기준 `violation_message`에는 아래 템플릿 변수를 넣을 수 있다.

- `{categories}`
- `{category_scores}`
- `{original_content}`

예를 들면 다음처럼 운영용 문구를 따로 둘 수 있다.

```python
from langchain_openai.middleware import OpenAIModerationMiddleware


moderation = OpenAIModerationMiddleware(
    check_input=True,
    check_output=True,
    exit_behavior="end",
    violation_message=(
        "요청이 안전 정책에 따라 중단되었습니다. "
        "감지된 범주: {categories}"
    ),
)
```

사용자-facing 제품이면 `{original_content}`를 그대로 노출하는 것은 보수적으로 봐야 한다.  
차단된 원문을 다시 응답에 넣으면 정책 메시지의 목적이 흐려질 수 있다.

## 5. 운영에서 자주 하는 실수

### 1. 입력만 검사하고 tool 결과는 그대로 통과시킨다

RAG, 검색, CRM 조회가 들어간 agent면 실제 위험 텍스트는 외부 데이터에서 다시 들어올 수 있다.

### 2. `replace`를 켰는데 치환 후 의미 보존을 확인하지 않는다

문장 일부를 지운 뒤에도 모델이 올바르게 작업하는지 직접 테스트해야 한다.

### 3. moderation 차단과 권한 승인을 같은 문제로 본다

콘텐츠 안전성 검사와 위험 행동 승인 단계는 다르다.  
메일 발송이나 DB 수정은 moderation을 통과해도 별도 승인이 필요할 수 있다.

### 4. 위반 상황을 관측하지 않는다

`exit_behavior="end"`는 앱 입장에서는 정상 응답처럼 보일 수 있다.  
LangSmith trace나 애플리케이션 로그에서 차단 빈도와 카테고리를 따로 봐야 정책을 조정할 수 있다.

## 추천 조합

개인적으로는 아래 시작점이 무난하다.

1. 고객 응대형 agent: `check_input=True`, `check_output=True`, `exit_behavior="end"`
2. 검색/RAG agent: 여기에 `check_tool_results=True` 추가
3. 백엔드 API: `exit_behavior="error"`로 전환해 애플리케이션이 직접 처리
4. 민감 업종: OpenAI moderation + LangChain `PIIMiddleware` + human approval를 분리해서 함께 사용

`OpenAIModerationMiddleware`는 "정책을 만족하는지"를 보고, `PIIMiddleware`는 "민감 정보가 오가는지"를 보고, `HumanInTheLoopMiddleware`는 "이 행동을 실행해도 되는지"를 본다. 세 개를 섞지 말고 역할을 나눠 두는 편이 유지보수에 낫다.

## 참고 자료

- [LangChain OpenAI middleware integration](https://docs.langchain.com/oss/python/integrations/middleware/openai)
- [LangChain Guardrails](https://docs.langchain.com/oss/python/langchain/guardrails)
- [LangChain Middleware Overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)
- [OpenAI moderation guide](https://platform.openai.com/docs/guides/moderation)
