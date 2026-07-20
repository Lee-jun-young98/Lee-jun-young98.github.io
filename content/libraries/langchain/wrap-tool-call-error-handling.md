---
title: "LangChain wrap_tool_call로 도구 오류를 안전하게 복구하기"
description: "LangChain @wrap_tool_call middleware로 도구 예외를 ToolMessage로 바꾸고, 오류를 분류·마스킹하며 agent가 다음 행동을 선택하게 만드는 실전 패턴"
date: 2026-07-20
tags:
  - langchain
  - agent
  - middleware
  - tools
  - reliability
  - python
aliases:
  - "/blog/wrap-tool-call-error-handling"
---

# LangChain wrap_tool_call로 도구 오류를 안전하게 복구하기

LLM agent의 도구가 실패했을 때 예외를 그대로 밖으로 던지면 실행 전체가 끝난다. 반대로 예외 문자열을 그대로 모델에게 보여주면 API 키, SQL, 내부 URL 같은 정보가 프롬프트에 섞일 수 있다.

LangChain의 `@wrap_tool_call` middleware는 도구 실행 전후를 감싸는 훅이다. 여기서 예외를 잡아 안전한 `ToolMessage`로 바꾸면 agent loop를 유지하면서 모델이 입력을 고치거나, 다른 도구를 쓰거나, 사용자에게 실패를 설명하도록 만들 수 있다.

이 글에서는 다음을 다룬다.

- `@wrap_tool_call`로 tool 예외를 agent가 이해할 수 있는 실패로 바꾸기
- 재시도 가능한 오류와 입력 오류를 구분하기
- 내부 예외는 로그에 남기고 모델에는 최소 정보만 전달하기
- `ToolRetryMiddleware`와 역할을 나누는 기준

## 사전 준비

Python 3.10 이상 환경에서 패키지를 설치한다.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U langchain langgraph langchain-openai
```

PowerShell에서는 가상 환경과 API 키를 다음처럼 설정한다.

```powershell
.\.venv\Scripts\Activate.ps1
$env:OPENAI_API_KEY="sk-..."
```

예제의 모델 이름은 계정에서 사용할 수 있는 모델로 바꿔도 된다.

## 1. 가장 작은 오류 복구 middleware

공식 API에서 `handler(request)`는 실제 도구 실행을 뜻한다. 성공하면 그 결과를 그대로 반환하고, 실패하면 같은 `tool_call_id`를 가진 `ToolMessage`를 반환해야 모델의 tool call과 결과가 올바르게 연결된다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import wrap_tool_call
from langchain.messages import ToolMessage
from langchain.tools import tool


@tool
def lookup_order(order_id: str) -> str:
    """주문 상태를 조회한다."""
    if not order_id.startswith("ORD-"):
        raise ValueError("order_id must start with ORD-")
    return f"{order_id}: 배송 준비 중"


@wrap_tool_call
def friendly_tool_errors(request, handler):
    try:
        return handler(request)
    except ValueError:
        return ToolMessage(
            content=(
                "도구 입력이 올바르지 않습니다. "
                "주문 번호는 ORD-로 시작해야 합니다. 입력을 고쳐 다시 호출하세요."
            ),
            tool_call_id=request.tool_call["id"],
        )
    except Exception:
        return ToolMessage(
            content=(
                "주문 조회 도구를 지금 사용할 수 없습니다. "
                "추측하지 말고 사용자에게 잠시 후 재시도를 안내하세요."
            ),
            tool_call_id=request.tool_call["id"],
        )


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[lookup_order],
    middleware=[friendly_tool_errors],
    system_prompt="도구 결과를 근거로 답하고, 실패 메시지의 복구 지침을 따르세요.",
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "주문 123의 상태를 확인해줘"}]}
)

print(result["messages"][-1].text)
```

핵심은 실패를 성공으로 위장하는 것이 아니다. 모델이 다음 행동을 고를 수 있도록 **실패 원인과 허용된 복구 행동**을 짧고 명확하게 전달하는 것이다.

## 2. 모델용 메시지와 운영 로그를 분리하기

예외 전문을 `ToolMessage`에 넣으면 내부 정보가 모델 입력과 trace에 남을 수 있다. 운영 로그에는 원래 예외와 tool call ID를 기록하되, 모델에는 공개해도 되는 메시지만 반환한다.

```python
import logging

from langchain.agents.middleware import wrap_tool_call
from langchain.messages import ToolMessage


logger = logging.getLogger(__name__)


@wrap_tool_call
def sanitized_tool_errors(request, handler):
    try:
        return handler(request)
    except Exception:
        logger.exception(
            "tool execution failed",
            extra={
                "tool_name": request.tool_call["name"],
                "tool_call_id": request.tool_call["id"],
            },
        )

        return ToolMessage(
            content=(
                "도구 실행에 실패했습니다. 내부 오류 세부 정보는 공개할 수 없습니다. "
                "다른 도구가 없다면 실패 사실만 사용자에게 설명하세요."
            ),
            tool_call_id=request.tool_call["id"],
        )
```

실제 서비스에서는 로그에도 토큰, 비밀번호, 개인정보가 남지 않도록 로깅 필터를 별도로 적용해야 한다. `logger.exception()`을 썼다는 사실만으로 로그가 안전해지는 것은 아니다.

## 3. 오류 유형별로 복구 행동을 다르게 주기

도구 오류를 모두 같은 문장으로 바꾸면 모델이 재호출 여부를 판단하기 어렵다. 오류를 최소 세 종류로 나누면 운영이 단순해진다.

```python
from langchain.agents.middleware import wrap_tool_call
from langchain.messages import ToolMessage


@wrap_tool_call
def classify_tool_errors(request, handler):
    try:
        return handler(request)
    except TimeoutError:
        message = (
            "일시적인 시간 초과입니다. 같은 호출은 한 번만 다시 시도하고, "
            "또 실패하면 사용자에게 나중에 재시도하라고 안내하세요."
        )
    except ValueError as error:
        message = (
            f"입력 검증에 실패했습니다: {error}. "
            "사용자 메시지에서 올바른 값을 찾을 수 있을 때만 인자를 고쳐 다시 호출하세요."
        )
    except PermissionError:
        message = (
            "이 작업을 수행할 권한이 없습니다. 재시도하지 말고 "
            "필요한 권한을 사용자에게 설명하세요."
        )
    except Exception:
        message = "도구가 실패했습니다. 재시도하거나 결과를 추측하지 마세요."

    return ToolMessage(
        content=message,
        tool_call_id=request.tool_call["id"],
    )
```

여기서 `ValueError`의 문자열도 외부 입력만 포함한다는 보장이 있을 때만 노출해야 한다. 라이브러리나 DB 드라이버의 원문 오류라면 고정된 안내 문구로 바꾸는 편이 안전하다.

## 4. 오류 처리와 자동 재시도의 역할 나누기

`@wrap_tool_call`의 `handler`는 여러 번 호출할 수 있으므로 직접 재시도 로직을 만들 수도 있다. 하지만 지수 백오프, 최대 횟수, 재시도 대상 예외가 필요한 일반적인 경우에는 `ToolRetryMiddleware`가 더 명확하다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ToolRetryMiddleware, wrap_tool_call
from langchain.messages import ToolMessage


@wrap_tool_call
def final_tool_error_message(request, handler):
    try:
        return handler(request)
    except Exception:
        return ToolMessage(
            content=(
                "재시도 후에도 도구가 실패했습니다. 결과를 추측하지 말고 "
                "현재 조회할 수 없다고 답하세요."
            ),
            tool_call_id=request.tool_call["id"],
        )


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[lookup_order],
    middleware=[
        final_tool_error_message,
        ToolRetryMiddleware(
            tools=["lookup_order"],
            max_retries=2,
            retry_on=(TimeoutError, ConnectionError),
        ),
    ],
)
```

middleware는 목록 순서대로 바깥에서 안쪽으로 감싼다. 위 구성에서는 `ToolRetryMiddleware`가 일시 오류를 먼저 재시도하고, 재시도를 모두 소진해 예외가 전파되면 바깥의 `final_tool_error_message`가 안전한 최종 메시지로 바꾼다.

실무 역할은 다음처럼 나누면 좋다.

- `ToolRetryMiddleware`: 일시 오류의 재시도 횟수와 backoff 정책
- `@wrap_tool_call`: 오류 분류, 로깅, 마스킹, 모델이 따라야 할 최종 복구 지침
- tool 함수: 도메인 로직과 의미 있는 예외 발생

## 5. 특정 도구에만 wrapper 적용하기

`@wrap_tool_call`은 기본적으로 모든 도구 호출을 감싼다. 결제나 메일 발송처럼 별도 정책이 필요한 도구가 있다면 decorator의 `tools` 인자로 범위를 제한할 수 있다.

```python
@wrap_tool_call(tools=[lookup_order])
def order_lookup_errors(request, handler):
    try:
        return handler(request)
    except Exception:
        return ToolMessage(
            content="주문 조회에 실패했습니다. 결과를 추측하지 마세요.",
            tool_call_id=request.tool_call["id"],
        )
```

도구별 오류 정책이 크게 다르면 하나의 거대한 `if request.tool_call["name"]` 블록보다 wrapper를 역할별로 나누는 편이 테스트하기 쉽다.

## 테스트할 항목

LLM 응답 문장만 확인하지 말고 middleware 반환값과 실행 횟수를 먼저 단위 테스트한다.

- 성공 시 원래 `ToolMessage` 또는 `Command`가 변경 없이 반환되는가
- 실패 시 `tool_call_id`가 원래 호출 ID와 같은가
- 입력 오류, 일시 오류, 권한 오류의 안내와 재시도 정책이 다른가
- 예외 원문에 넣은 가짜 API 키나 내부 URL이 `ToolMessage`에 노출되지 않는가
- 쓰기성 도구가 예상치 않게 중복 실행되지 않는가
- 여러 middleware를 쓸 때 목록 순서가 의도한 감싸기 순서와 같은가

## 자주 막히는 포인트

### `tool_call_id`를 빼먹는다

모델이 요청한 tool call과 결과 메시지를 연결하지 못한다. 오류 응답도 반드시 `request.tool_call["id"]`를 사용해야 한다.

### 모든 예외를 “다시 시도하세요”로 바꾼다

권한 오류나 잘못된 입력은 같은 인자로 다시 호출해도 해결되지 않는다. 무한 agent loop와 비용 증가를 막으려면 재시도 가능 여부를 메시지에 명확히 넣고 호출 상한도 함께 둔다.

### 예외 문자열을 그대로 모델에게 노출한다

스택 트레이스, SQL, 파일 경로, 인증 정보가 모델 입력이나 observability trace로 흘러갈 수 있다. 내부 로그와 모델용 메시지를 분리한다.

### `ToolRetryMiddleware`와 직접 재시도를 겹친다

wrapper에서 두 번, prebuilt middleware에서 두 번 재시도하면 실제 호출 횟수가 예상보다 커진다. 자동 재시도 정책은 한 계층에만 둔다.

### `Command` 반환 가능성을 잊는다

공식 타입상 handler는 `ToolMessage`뿐 아니라 state 업데이트가 포함된 `Command`도 반환할 수 있다. 성공 경로에서는 결과를 새 `ToolMessage`로 다시 만들지 말고 `return handler(request)`로 그대로 통과시킨다.

## 정리

`@wrap_tool_call`은 tool 실패를 숨기는 장치가 아니라 agent가 실패 뒤에도 안전하게 판단하도록 만드는 경계다.

1. 성공 결과는 그대로 통과시킨다.
2. 원래 예외는 보호된 운영 로그에 남긴다.
3. 모델에는 민감정보를 제거한 오류 종류와 허용된 다음 행동만 전달한다.
4. 일반적인 자동 재시도는 `ToolRetryMiddleware`에 맡긴다.
5. `tool_call_id`, middleware 순서, 중복 실행을 테스트한다.

이 구조를 잡아 두면 외부 API 장애가 곧바로 agent 전체 실패나 정보 노출로 이어지는 일을 크게 줄일 수 있다.

## 참고 자료

- [LangChain Agents: Tool error handling](https://docs.langchain.com/oss/python/langchain/agents#tool-error-handling)
- [LangChain Middleware overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)
- [LangChain `wrap_tool_call` API reference](https://reference.langchain.com/python/langchain/agents/middleware/types/wrap_tool_call)
- [LangChain `AgentMiddleware.wrap_tool_call` API reference](https://reference.langchain.com/python/langchain/agents/middleware/types/AgentMiddleware/wrap_tool_call)
