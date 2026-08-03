---
title: "LangChain middleware jump_to로 에이전트 루프 제어하기"
description: "before_model과 after_model에서 jump_to를 사용해 모델 호출을 조기 종료하고 tools, model, end 경로를 안전하게 제어하는 실전 패턴"
date: 2026-08-03
tags:
  - langchain
  - agent
  - middleware
  - routing
  - python
---

# LangChain middleware `jump_to`로 에이전트 루프 제어하기

LangChain의 `create_agent`는 보통 **model → tools → model** 루프를 반복한다. 하지만 메시지 한도를 넘었거나, 모델 출력이 정책에 걸렸거나, 도구 실행을 건너뛰고 다시 모델로 보내야 하는 경우에는 기본 흐름을 바꿔야 한다.

이때 node-style middleware hook이 반환하는 state update에 `jump_to`를 넣으면 된다.

- `"end"`: 실행을 끝내고 `after_agent` 단계로 이동
- `"tools"`: 도구 실행 단계로 이동
- `"model"`: 모델 호출 단계로 돌아감

핵심은 jump 목적지를 코드에서 반환하는 것만으로는 부족하다는 점이다. 데코레이터의 `can_jump_to` 또는 클래스 middleware의 `@hook_config(can_jump_to=...)`로 가능한 목적지를 미리 선언해야 agent graph에 조건부 edge가 생긴다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.0" langchain-openai
export OPENAI_API_KEY="your-api-key"
```

PowerShell에서는 마지막 줄을 다음처럼 설정한다.

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. `before_model`에서 불필요한 모델 호출 막기

가장 실용적인 패턴은 실행 전에 결정할 수 있는 조건을 `before_model`에서 검사하는 것이다. 아래 예제는 누적 메시지가 한도를 넘으면 모델을 호출하지 않고 안내 메시지를 추가한 뒤 종료한다.

```python
from typing import Any

from langchain.agents import create_agent
from langchain.agents.middleware import AgentState, before_model
from langchain.messages import AIMessage
from langgraph.runtime import Runtime


@before_model(can_jump_to=["end"])
def stop_long_conversation(
    state: AgentState,
    runtime: Runtime,
) -> dict[str, Any] | None:
    if len(state["messages"]) < 20:
        return None

    return {
        "messages": [
            AIMessage(
                content="대화가 너무 길어 이번 실행을 종료합니다. 새 대화를 시작해 주세요."
            )
        ],
        "jump_to": "end",
    }


agent = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[],
    middleware=[stop_long_conversation],
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "현재 상태를 요약해 줘"}]}
)
print(result["messages"][-1].content)
```

`messages`에는 reducer가 적용되므로 위의 `AIMessage`는 기존 대화를 덮어쓰지 않고 뒤에 추가된다. 대화 전체를 교체하려는 목적이라면 `jump_to`와 별개로 `RemoveMessage` 같은 명시적 메시지 삭제 전략이 필요하다.

## 2. `after_model`에서 모델 출력을 검사하고 종료하기

모델 응답을 본 뒤에만 판단할 수 있는 정책은 `after_model`에 둔다. 모델이 내부 차단 표식을 반환했다고 가정하면, 사용자에게 그대로 노출하지 않고 안전한 응답을 추가한 뒤 도구 실행 전에 끝낼 수 있다.

```python
from typing import Any

from langchain.agents.middleware import AgentState, after_model
from langchain.messages import AIMessage
from langgraph.runtime import Runtime


@after_model(can_jump_to=["end"])
def replace_blocked_response(
    state: AgentState,
    runtime: Runtime,
) -> dict[str, Any] | None:
    last_message = state["messages"][-1]
    text = last_message.text if hasattr(last_message, "text") else str(last_message.content)

    if "[POLICY_BLOCKED]" not in text:
        return None

    return {
        "messages": [AIMessage(content="해당 요청에는 답변할 수 없습니다.")],
        "jump_to": "end",
    }
```

실제 운영에서는 단순 문자열보다 별도 분류기, 구조화 출력, metadata 같은 안정적인 신호를 쓰는 편이 낫다. 또한 기존 모델 메시지가 state에 남으므로 최종 응답만 보는 UI인지, 전체 message history를 노출하는 UI인지 확인해야 한다.

## 3. 클래스 middleware에서는 `@hook_config`를 사용하기

설정값과 상태를 가진 재사용 가능한 middleware는 클래스로 만들기 좋다. 클래스 메서드에는 `@before_model(...)`을 붙이지 않고 `@hook_config`로 jump 목적지를 선언한다.

```python
from typing import Any

from langchain.agents.middleware import AgentMiddleware, AgentState, hook_config
from langchain.messages import AIMessage
from langgraph.runtime import Runtime


class MessageBudgetMiddleware(AgentMiddleware):
    def __init__(self, max_messages: int = 20) -> None:
        super().__init__()
        self.max_messages = max_messages

    @hook_config(can_jump_to=["end"])
    def before_model(
        self,
        state: AgentState,
        runtime: Runtime,
    ) -> dict[str, Any] | None:
        if len(state["messages"]) < self.max_messages:
            return None

        return {
            "messages": [AIMessage(content="메시지 예산을 초과했습니다.")],
            "jump_to": "end",
        }
```

적용할 때는 `middleware=[MessageBudgetMiddleware(max_messages=12)]`처럼 인스턴스를 넘긴다. 한 middleware에서 여러 목적지를 반환할 수 있다면 가능한 값을 모두 선언한다.

```python
@hook_config(can_jump_to=["tools", "model", "end"])
def after_model(self, state: AgentState, runtime: Runtime):
    ...
```

## 4. `tools`와 `model` jump는 언제 쓰나

`end`는 조기 종료라서 비교적 단순하지만 나머지 두 목적지는 루프를 만들 수 있어 더 조심해야 한다.

- `tools`: middleware가 state에 유효한 tool call을 준비했거나, 이미 생성된 tool call을 즉시 실행해야 할 때 사용
- `model`: state를 보정한 뒤 도구 실행 없이 모델이 다시 판단하게 할 때 사용

예를 들어 `after_model`에서 잘못된 tool argument를 감지해 안내 메시지를 넣고 `model`로 돌려보낼 수 있다. 이때 재시도 횟수를 state에 기록하지 않으면 같은 응답을 무한히 반복할 수 있다.

```python
from typing import Any
from typing_extensions import NotRequired

from langchain.agents.middleware import AgentState, after_model
from langchain.messages import HumanMessage
from langgraph.runtime import Runtime


class RepairState(AgentState):
    repair_count: NotRequired[int]


@after_model(state_schema=RepairState, can_jump_to=["model", "end"])
def retry_invalid_tool_call(
    state: RepairState,
    runtime: Runtime,
) -> dict[str, Any] | None:
    last_message = state["messages"][-1]
    invalid = any("city" not in call.get("args", {}) for call in last_message.tool_calls)
    if not invalid:
        return None

    count = state.get("repair_count", 0)
    if count >= 1:
        return {"jump_to": "end"}

    return {
        "repair_count": count + 1,
        "messages": [HumanMessage(content="도구 인자에 city를 포함해 다시 시도하세요.")],
        "jump_to": "model",
    }
```

이 코드는 제어 흐름을 보여 주기 위한 최소 예제다. 운영에서는 사용자가 보낸 `HumanMessage`와 내부 보정 지시를 구분하기 위해 별도 state 필드나 system-level instruction을 사용하는 편이 안전하다.

## 흔한 실수

### `can_jump_to`를 선언하지 않는다

`{"jump_to": "end"}`만 반환해서는 graph compile 시 필요한 조건부 edge가 만들어지지 않는다. decorator hook에는 `can_jump_to`, class hook에는 `@hook_config`를 명시한다.

### `jump_to="end"`가 모든 후처리를 건너뛴다고 생각한다

`end`는 첫 `after_agent` hook 쪽으로 이동한다. 감사 로그나 최종 정리 middleware가 `after_agent`에 있다면 여전히 실행될 수 있다는 전제로 설계한다.

### `model`로 되돌리면서 종료 조건을 두지 않는다

같은 state와 같은 prompt가 반복되면 에이전트가 끝나지 않는다. retry counter, message budget, model call limit 중 하나 이상을 둔다.

### `after_model`에서 추가한 메시지가 원래 응답을 지운다고 생각한다

기본 `messages` reducer는 메시지를 누적한다. 민감한 원본을 state에서도 제거해야 한다면 메시지 삭제를 명시적으로 처리한다.

### wrap-style hook과 같은 방식으로 state를 반환한다

`before_model`과 `after_model` 같은 node-style hook은 dict를 직접 반환한다. 반면 `wrap_model_call`에서 state update가 필요하면 `ExtendedModelResponse`와 `Command`를 사용한다. 두 방식의 반환 계약을 섞지 않는다.

## 실전 체크리스트

1. 모델 호출 전에 판단 가능하면 `before_model`, 응답을 봐야 하면 `after_model`을 선택한다.
2. 반환 가능한 jump 목적지를 `can_jump_to` 또는 `@hook_config`에 모두 선언한다.
3. `model` 재진입에는 반드시 명시적인 횟수 제한을 둔다.
4. `messages`가 append되는지, 삭제가 필요한지 UI와 저장 정책까지 확인한다.
5. 정상 경로, 조기 종료, 재시도 상한 초과를 각각 테스트한다.

## 참고 자료

- [LangChain custom middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
- [LangChain middleware overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)
- [LangChain `hook_config` API reference](https://reference.langchain.com/python/langchain/agents/middleware/types/hook_config)
- [LangChain `AgentMiddleware` API reference](https://reference.langchain.com/python/langchain/agents/middleware/types/AgentMiddleware)
