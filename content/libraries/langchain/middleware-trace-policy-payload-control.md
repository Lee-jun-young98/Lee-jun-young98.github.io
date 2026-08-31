---
title: LangChain TracePolicy로 middleware hook trace payload 줄이기
description: middleware span은 유지하면서 큰 state와 message payload만 생략하거나 요약하는 실전 가이드
date: 2026-08-31
tags:
  - langchain
  - agent
  - middleware
  - tracing
  - observability
  - python
---

# LangChain TracePolicy로 middleware hook trace payload 줄이기

custom middleware가 많아지면 `before_model`, `wrap_model_call`, `wrap_tool_call` 같은 hook도 각각 trace span을 만든다. 기본 설정에서는 이 span에 agent state와 메시지가 반복 기록되어 trace가 커지고 읽기 어려워질 수 있다.

LangChain 1.3.16의 `TracePolicy`는 **hook 실행과 span의 시간 정보는 유지하되, 그 span이 기록하는 input·output만 변환**한다. 실행 중인 state나 모델에 전달되는 메시지는 바꾸지 않는다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.3.16" langchain-openai
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell에서는 다음처럼 설정한다.

```powershell
.\.venv\Scripts\Activate.ps1
$env:OPENAI_API_KEY = "your-api-key"
```

LangSmith로 실제 trace를 확인하려면 `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`도 설정한다.

## 1. 특정 middleware의 payload만 비우기

`AgentMiddleware.trace_policy`에 정책을 지정하면 그 middleware의 node-style hook과 wrap-style hook span에 적용된다.

```python
from langchain.agents.middleware import AgentMiddleware, TracePolicy, omit_payload


class AuditTimingMiddleware(AgentMiddleware):
    trace_policy = TracePolicy(
        process_inputs=omit_payload,
        process_outputs=omit_payload,
    )

    def before_model(self, state, runtime):
        print(f"model call before: {len(state['messages'])} messages")
        return None
```

`omit_payload`는 기록할 값을 빈 dict로 바꾼다. hook은 원래 `state`를 그대로 받고, 반환값도 그대로 agent state에 적용된다. 따라서 payload를 줄이기 위해 middleware 로직에서 메시지를 지우면 안 된다.

## 2. 전체 기본값을 애플리케이션 시작 시 설정하기

middleware가 많은 서비스에서는 process-wide 기본 정책을 한 번 설정할 수 있다.

```python
from langchain.agents.middleware import (
    TracePolicy,
    configure_trace_policy,
    omit_payload,
)


configure_trace_policy(
    TracePolicy(
        process_inputs=omit_payload,
        process_outputs=omit_payload,
    )
)
```

이 기본값은 `create_agent()`를 호출한 뒤 설정해도 실제 hook 실행 시점에 해석된다. 다만 여러 테스트나 애플리케이션이 같은 Python process를 공유하면 설정이 서로 영향을 줄 수 있으므로 startup에서 한 번만 설정하고, 테스트 teardown에서는 `configure_trace_policy(None)`으로 초기화한다.

개별 middleware에 `trace_policy`가 있으면 process-wide 정책을 **필드 단위로 합치지 않고 통째로 대체**한다.

```python
class KeepOutputMiddleware(AgentMiddleware):
    trace_policy = TracePolicy(process_inputs=omit_payload)

    def after_model(self, state, runtime):
        return None
```

위 middleware는 전역 `process_outputs=omit_payload`를 상속하지 않는다. 입력만 비우고 출력은 기본 방식으로 기록한다.

## 3. 전부 버리지 말고 운영 지표만 남기기

processor는 node의 raw input 또는 output을 받아 trace에 기록할 새 값을 반환한다. 원본을 제자리에서 수정하지 말고 별도 요약 dict를 만든다.

```python
from typing import Any

from langchain.agents.middleware import AgentMiddleware, TracePolicy


def summarize_hook_input(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {"input_type": type(value).__name__}

    messages = value.get("messages", [])
    return {
        "message_count": len(messages),
        "state_keys": sorted(value.keys()),
    }


class CompactTraceMiddleware(AgentMiddleware):
    trace_policy = TracePolicy(process_inputs=summarize_hook_input)

    def before_model(self, state, runtime):
        return None
```

메시지 본문 대신 개수와 state key만 남기면 hook 호출 빈도와 context 증가 추세는 관측하면서 중복 payload를 줄일 수 있다. processor가 예외를 내면 tracing 자체가 실행을 방해할 수 있으므로 예상하지 못한 타입에도 안전한 함수를 쓴다.

## 4. API 없이 정책 함수를 단위 테스트하기

`TracePolicy`는 단순한 processor 묶음이므로, 모델이나 LangSmith 연결 없이 기록될 결과를 검사할 수 있다.

```python
policy = TracePolicy(process_inputs=summarize_hook_input)

original = {
    "messages": [
        {"role": "user", "content": "주문 ORD-123을 조회해 줘"},
        {"role": "assistant", "content": "조회하겠습니다"},
    ],
    "tenant_id": "tenant-a",
}

recorded = policy.process_inputs(original)

assert recorded == {
    "message_count": 2,
    "state_keys": ["messages", "tenant_id"],
}
assert original["messages"][0]["content"] == "주문 ORD-123을 조회해 줘"
```

마지막 assertion은 processor가 실행 입력을 mutate하지 않았는지 확인한다. 실제 integration test에서는 LangSmith test project나 callback collector로 hook span의 input/output도 확인한다.

## 적용 범위를 정확히 이해하기

`TracePolicy`는 해당 middleware hook의 **자기 span**만 바꾼다. root graph run과 hook 안에서 발생한 child model/tool run에는 자동으로 전파되지 않는다. 예를 들어 hook 입력을 `omit_payload`로 비워도 안쪽 model call span에는 메시지가 계속 기록될 수 있다.

따라서 목적별로 도구를 구분한다.

- trace 중복과 payload 크기를 줄이려면 middleware `TracePolicy`를 쓴다.
- 모든 child run을 포함해 입력·출력의 비밀정보를 제거하려면 LangSmith client의 `hide_inputs`, `hide_outputs`, `anonymizer` 같은 별도 보안 설정을 쓴다.
- 모델에 전달되는 context 자체를 줄이려면 `SummarizationMiddleware`나 `ContextEditingMiddleware`를 쓴다.

## 흔한 실수

### 비밀정보 redaction 기능으로 간주한다

processor가 다루는 것은 한 hook span뿐이다. 같은 메시지가 root, model, tool span에 남을 수 있으므로 보안 경계로 사용하지 않는다.

### 입력 dict를 직접 수정한다

`value.pop("messages")`처럼 제자리에서 수정하면 trace 전용 변환이 실제 실행 state에 영향을 줄 위험이 있다. 항상 새 dict를 반환한다.

### 전역 정책과 개별 정책이 merge된다고 가정한다

개별 정책이 존재하면 전역 정책 전체를 대체한다. 한쪽 processor만 지정한 개별 정책은 다른 쪽을 기본 기록으로 되돌릴 수 있다.

### 모든 span을 없애 버린다

payload가 크다는 이유로 tracing 자체를 끄면 hook 지연과 오류 위치도 잃는다. 우선 `omit_payload`로 span과 timing을 남긴다.

### 지원 버전을 고정하지 않는다

`AgentMiddleware.trace_policy`와 `configure_trace_policy`를 사용하는 예제는 `langchain>=1.3.16`을 요구한다. 배포 lockfile과 실행 환경 버전을 함께 확인한다.

## 운영 체크리스트

- middleware별로 payload 생략, 요약, 전체 기록 중 하나를 명시한다.
- processor는 빠르고 결정적이며 예외에 안전하게 작성한다.
- raw 값을 mutate하지 않는 단위 테스트를 둔다.
- process-wide 설정은 startup에서 한 번 적용하고 테스트 간 초기화한다.
- root와 child run에 남는 데이터는 LangSmith 보안 설정으로 별도 통제한다.
- 변경 전후 trace 저장량, hook latency, 디버깅 가능성을 함께 비교한다.

## 참고 자료

- [LangChain API Reference: middleware](https://reference.langchain.com/python/langchain/agents/middleware)
- [LangChain API Reference: AgentMiddleware](https://reference.langchain.com/python/langchain/agents/middleware/types/AgentMiddleware)
- [LangGraph API Reference: TracePolicy](https://reference.langchain.com/python/langgraph/types/TracePolicy)
- [LangChain 공식 문서: Custom middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)

