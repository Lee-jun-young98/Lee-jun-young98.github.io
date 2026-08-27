---
title: LangChain ToolErrorMiddleware로 도구 예외를 안전하게 복구하기
description: 도구 실행 예외를 선별해 안전한 ToolMessage로 바꾸고 retry와 조합하는 실전 가이드
date: 2026-08-27
tags:
  - langchain
  - agent
  - middleware
  - tool
  - reliability
  - python
---

# LangChain ToolErrorMiddleware로 도구 예외를 안전하게 복구하기

에이전트의 도구가 예외를 던지면 실행 전체를 중단할 수도 있고, 모델에게 실패 사실을 알려 입력을 고쳐 다시 시도하게 할 수도 있다. LangChain 1.3부터 제공되는 `ToolErrorMiddleware`는 **처리하기로 선택한 도구 실행 예외만** `status="error"`인 `ToolMessage`로 바꾼다.

핵심 원칙은 모든 예외를 문자열로 공개하는 것이 아니다. 사용자가 수정할 수 있는 업무 오류만 짧고 안전한 안내로 바꾸고, 인증 오류·프로그래밍 버그·내부 시스템 오류는 그대로 전파한다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.3" langchain-openai
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell에서는 다음처럼 활성화한다.

```powershell
.\.venv\Scripts\Activate.ps1
$env:OPENAI_API_KEY = "your-api-key"
```

## 1. 복구 가능한 예외만 모델에게 돌려주기

`on_error`는 예외와 `ToolCallRequest`를 받는다. 문자열이나 content block 목록을 반환하면 middleware가 원래 `tool_call_id`를 유지한 error `ToolMessage`를 만든다. `None`을 반환하면 예외가 다시 발생해 run이 중단된다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ToolCallRequest, ToolErrorMiddleware
from langchain.tools import tool


class UnknownOrderError(ValueError):
    pass


@tool
def get_order_status(order_id: str) -> str:
    """주문 번호로 배송 상태를 조회한다."""
    if not order_id.startswith("ORD-"):
        raise UnknownOrderError("database lookup failed for malformed id")
    return "배송 준비 중"


def safe_tool_error(exc: Exception, request: ToolCallRequest) -> str | None:
    if isinstance(exc, UnknownOrderError):
        return (
            f"{request.tool_call['name']} 호출에 실패했습니다. "
            "order_id를 ORD-로 시작하는 형식으로 고쳐 다시 시도하세요."
        )
    return None


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[get_order_status],
    middleware=[ToolErrorMiddleware(on_error=safe_tool_error)],
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "주문 123 상태를 확인해 줘"}]}
)
```

원본 예외 메시지를 그대로 반환하지 않은 점이 중요하다. DB 키, URL, stack trace 같은 내부 정보가 모델 출력이나 로그를 통해 노출될 수 있기 때문이다.

## 2. middleware 자체를 API 없이 검사하기

운영 모델에 기대지 말고, handler가 던지는 예외가 정확히 어떤 메시지로 바뀌는지 단위 테스트한다.

```python
from langchain.agents.middleware import ToolCallRequest, ToolErrorMiddleware
from langchain_core.messages import ToolMessage


middleware = ToolErrorMiddleware(on_error=safe_tool_error)
request = ToolCallRequest(
    tool_call={"name": "get_order_status", "args": {"order_id": "123"}, "id": "call-1"},
    tool=get_order_status,
    state={"messages": []},
    runtime=None,
)


def failing_handler(_request: ToolCallRequest) -> ToolMessage:
    raise UnknownOrderError("secret database detail")


message = middleware.wrap_tool_call(request, failing_handler)
assert isinstance(message, ToolMessage)
assert message.status == "error"
assert message.tool_call_id == "call-1"
assert "secret database detail" not in message.content
```

`ToolCallRequest` 생성자의 세부 타입은 버전에 따라 더 엄격해질 수 있다. 프로젝트에서는 실제 agent 호출을 fake chat model과 묶은 통합 테스트도 하나 두는 편이 안전하다.

## 3. retry가 끝난 뒤 안전한 오류로 변환하기

일시적 네트워크 오류는 먼저 재시도하고, 모두 실패했을 때만 모델이 다른 행동을 선택하게 만들 수 있다.

```python
from langchain.agents.middleware import ToolErrorMiddleware, ToolRetryMiddleware


def public_error(exc: Exception, request: ToolCallRequest) -> str | None:
    if isinstance(exc, TimeoutError):
        return f"{request.tool_call['name']} 서비스가 응답하지 않습니다. 잠시 후 다시 시도하세요."
    return None


middleware = [
    ToolErrorMiddleware(on_error=public_error),
    ToolRetryMiddleware(
        max_retries=2,
        retry_on=(TimeoutError,),
        on_failure="error",
        initial_delay=0.5,
        jitter=True,
    ),
]
```

첫 middleware가 바깥쪽을 감싸는 onion 구조다. 안쪽 `ToolRetryMiddleware`가 `on_failure="error"`로 최종 예외를 다시 던져야 바깥 `ToolErrorMiddleware`가 이를 받아 안전한 메시지로 바꾼다. retry의 `on_failure="continue"`가 먼저 `ToolMessage`를 만들면 바깥쪽에는 예외가 도달하지 않는다.

## 4. 도구별·비동기별 처리 범위 제한하기

`tools=[...]`에는 도구 객체나 이름을 넣어 처리 범위를 좁힐 수 있다. 결제처럼 실패 시 즉시 중단해야 하는 도구와 검색처럼 모델이 대안을 선택해도 되는 도구를 같은 정책으로 묶지 않는다.

```python
async def async_error(exc: Exception, request: ToolCallRequest) -> str | None:
    if isinstance(exc, TimeoutError):
        return "검색 서비스 timeout입니다. 더 좁은 검색어로 다시 시도하세요."
    return None


search_errors = ToolErrorMiddleware(
    aon_error=async_error,
    tools=["search_catalog"],
)
```

`aon_error`만 제공한 middleware는 async agent 경로에서만 쓴다. sync `invoke()` 경로에서는 async handler를 await할 수 없어 오류가 난다. 두 경로를 모두 지원하려면 `on_error`도 함께 제공한다.

## `@wrap_tool_call`과 언제 구분할까

- 예외를 선별해 error `ToolMessage`로 바꾸는 표준 동작만 필요하면 `ToolErrorMiddleware`를 쓴다.
- request 인자를 바꾸거나 handler를 여러 번 호출하고, `Command`를 반환하는 등 실행 자체를 제어하려면 `@wrap_tool_call`을 쓴다.
- 재시도는 직접 구현하기보다 `ToolRetryMiddleware`와 역할을 나눈다.

이렇게 분리하면 오류 공개 정책, retry 정책, 도구 실행 정책을 각각 테스트하고 middleware 순서로 조합할 수 있다.

## 흔한 실수

### 모든 `Exception`을 공개한다

예상하지 못한 버그까지 모델에게 넘기면 장애가 정상 대화처럼 숨겨지고 내부 정보가 샐 수 있다. 명시적인 업무 예외 allowlist만 처리한다.

### 인자 검증 오류도 `on_error`에 온다고 가정한다

도구 함수가 실행되기 전 argument binding과 schema validation에서 난 오류는 `ToolNode`가 앞단에서 error `ToolMessage`로 처리하므로 `ToolErrorMiddleware.on_error`에 도달하지 않는다. 입력 스키마와 모델 피드백은 별도로 테스트한다.

### interrupt까지 잡으려고 한다

LangGraph의 interrupt나 parent command 같은 제어 흐름 신호는 `on_error`로 전달되지 않고 그대로 전파된다. 사람 승인 재개 로직과 도구 예외 복구를 섞지 않는다.

### error 메시지를 성공 결과처럼 쓴다

모델이 다음 행동을 고칠 수 있도록 실패한 도구 이름과 수정 가능한 입력 조건을 알려 주되, 실제 조회 결과처럼 보이는 문구는 피한다. UI에서도 `ToolMessage.status`를 확인해 성공과 오류를 구분한다.

## 운영 체크리스트

- 공개 가능한 업무 예외 클래스를 allowlist로 관리한다.
- 원본 예외 메시지 대신 사용자가 취할 수 있는 다음 행동을 반환한다.
- retry 대상과 즉시 실패 대상을 분리하고 middleware 순서를 테스트한다.
- sync·async 실행 경로별 handler 제공 여부를 확인한다.
- 도구별 `tools` 범위를 좁혀 결제·권한 도구의 실패를 숨기지 않는다.
- error `ToolMessage` 수와 최종 run 실패 수를 별도 지표로 관측한다.

## 참고 자료

- [LangChain API Reference: ToolErrorMiddleware](https://reference.langchain.com/python/langchain/agents/middleware/tool_error/ToolErrorMiddleware)
- [LangChain 공식 문서: Prebuilt middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [LangChain API Reference: ToolRetryMiddleware](https://reference.langchain.com/python/langchain/agents/middleware/tool_retry/ToolRetryMiddleware)
- [LangChain API Reference: wrap_tool_call](https://reference.langchain.com/python/langchain/agents/middleware/types/wrap_tool_call)
