---
title: LangChain private state로 agent 입출력 스키마 경계 나누기
description: PrivateStateAttr, OmitFromInput, OmitFromOutput으로 middleware 내부 상태와 공개 API 계약을 분리하는 방법
date: 2026-08-18
tags:
  - langchain
  - agent
  - middleware
  - state
  - python
---

# LangChain private state로 agent 입출력 스키마 경계 나누기

Agent state에는 대화 메시지만 들어가는 것이 아니다. 재시도 횟수, 내부 라우팅 결과, 감사용 식별자처럼 실행 중에만 필요한 값도 쌓인다. 이 필드가 그대로 agent의 입력과 최종 출력에 노출되면 호출자가 내부 상태를 덮어쓰거나 응답에서 불필요한 운영 정보를 보게 된다.

LangChain은 `Annotated` metadata인 `OmitFromInput`, `OmitFromOutput`, `PrivateStateAttr`로 **내부 state channel**과 **공개 입출력 schema**를 분리한다. 값은 graph state에 존재할 수 있지만 어느 경계에서 보일지는 따로 정할 수 있다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.3" langchain-openai
```

PowerShell에서는 가상 환경 활성화 명령이 `.venv\Scripts\Activate.ps1`이다. 실제 모델 예제를 실행하려면 `OPENAI_API_KEY`도 설정한다.

## 1. 세 annotation의 차이

세 상수는 모두 `OmitFromSchema`의 미리 설정된 instance다.

| annotation | 호출 입력에서 제외 | 최종 출력에서 제외 | 적합한 값 |
|---|---:|---:|---|
| `OmitFromInput` | O | X | agent가 계산해 caller에게 돌려줄 결과 |
| `OmitFromOutput` | X | O | caller가 주입하지만 응답에는 필요 없는 값 |
| `PrivateStateAttr` | O | O | middleware 전용 counter, handle, 임시 metadata |

```python
from typing import Annotated
from typing_extensions import NotRequired

from langchain.agents import AgentState
from langchain.agents.middleware.types import (
    OmitFromInput,
    OmitFromOutput,
    PrivateStateAttr,
)


class SupportState(AgentState):
    risk_score: Annotated[NotRequired[float], OmitFromInput]
    request_policy: Annotated[NotRequired[str], OmitFromOutput]
    internal_attempts: Annotated[NotRequired[int], PrivateStateAttr]
```

`PrivateStateAttr`은 `OmitFromSchema(input=True, output=True)`와 같다. 이름에 `private`가 있어도 암호화나 access control을 제공하는 것은 아니다. graph의 내부 state와 checkpoint에는 값이 남을 수 있다.

## 2. middleware가 private field를 소유하게 만들기

특정 middleware만 쓰는 필드는 middleware의 `state_schema`에 붙이는 편이 좋다. 아래 예제는 모델 호출 직전에 내부 횟수를 갱신한다.

```python
from typing import Annotated, Any
from typing_extensions import NotRequired

from langchain.agents import AgentState, create_agent
from langchain.agents.middleware import AgentMiddleware
from langchain.agents.middleware.types import PrivateStateAttr


class AuditState(AgentState):
    model_attempts: Annotated[NotRequired[int], PrivateStateAttr]


class AuditMiddleware(AgentMiddleware[AuditState]):
    state_schema = AuditState

    def before_model(self, state: AuditState, runtime) -> dict[str, Any]:
        return {"model_attempts": state.get("model_attempts", 0) + 1}


agent = create_agent(
    model="openai:gpt-5-mini",
    tools=[],
    middleware=[AuditMiddleware()],
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "한 문장으로 인사해 줘."}]}
)

print(result.keys())
# messages는 보이지만 model_attempts는 공개 output schema에서 제외된다.
```

이 방식은 field 정의, field를 갱신하는 hook, 관련 tool을 한 middleware에 묶는다. 여러 middleware가 같은 field 이름을 우연히 공유하는 일을 줄이고 각 확장의 책임도 분명해진다.

## 3. compile된 graph schema로 경계를 테스트하기

annotation은 문서용 표시가 아니라 실제 graph 입출력 schema를 바꾼다. 모델 API를 호출하지 않고도 schema를 검증할 수 있다.

```python
input_fields = agent.get_input_schema().model_fields
output_fields = agent.get_output_schema().model_fields

assert "model_attempts" not in input_fields
assert "model_attempts" not in output_fields
assert "messages" in input_fields
assert "messages" in output_fields
```

CI에서 이 검사를 두면 내부 field를 추가하거나 annotation을 바꾸면서 API 계약에 값이 새어 나가는 회귀를 빠르게 찾을 수 있다. 배포 전에 실제 `invoke()` 결과도 함께 검사하면 더 안전하다.

## 4. 입력 전용과 출력 전용 field를 구분하기

모든 비공개 값이 양쪽에서 숨겨져야 하는 것은 아니다. 예를 들어 caller가 선택한 정책은 입력으로 받아야 하지만 응답에는 반복할 필요가 없다. 반대로 middleware가 계산한 분류 결과는 caller 입력을 막고 최종 출력에만 보여 줄 수 있다.

```python
from typing import Annotated
from typing_extensions import NotRequired

from langchain.agents import AgentState
from langchain.agents.middleware.types import OmitFromInput, OmitFromOutput


class ClassificationState(AgentState):
    policy_version: Annotated[NotRequired[str], OmitFromOutput]
    classification: Annotated[NotRequired[str], OmitFromInput]
```

이 구분은 권한 검증을 대신하지 않는다. `policy_version`처럼 caller가 보내는 값은 신뢰 가능한 runtime context나 서버 측 인증 정보와 대조해야 한다. `OmitFromOutput`은 단지 출력 schema에서 제외할 뿐 입력의 진위를 보장하지 않는다.

## 자주 막히는 지점

### 1. field 이름 앞에 underscore만 붙인다

`_attempts`라는 이름만으로는 schema에서 자동 제외되지 않는다. 반드시 `Annotated[..., PrivateStateAttr]`처럼 metadata를 붙인다.

### 2. `Annotated`와 `NotRequired`의 위치를 혼동한다

LangChain 자체 middleware는 `NotRequired[Annotated[int, PrivateStateAttr]]`와 `Annotated[NotRequired[int], PrivateStateAttr]` 패턴을 모두 사용한다. 핵심은 최종 type metadata에 `OmitFromSchema` instance가 보존되는 것이다. 프로젝트에서는 한 스타일을 정하고 `get_input_schema()` 테스트로 확인한다.

### 3. private field를 비밀 저장소로 생각한다

공개 output에서 빠져도 checkpointer, trace, debug snapshot, hook에는 남을 수 있다. API key와 장기 credential은 state에 저장하지 말고 secret manager나 요청 범위 credential provider에서 가져온다.

### 4. `state_schema`만 정의하면 값이 자동 생성된다고 생각한다

schema는 channel과 경계를 정의할 뿐 값을 채우지 않는다. `before_agent`, `before_model`, tool의 `Command(update=...)` 같은 명시적 update가 필요하다.

### 5. 공개 결과가 필요해졌는데 계속 `PrivateStateAttr`을 쓴다

UI나 API consumer가 읽어야 하는 계산 결과라면 `OmitFromInput`으로 바꾸거나 별도의 공개 field로 projection한다. 내부 원본과 공개 요약을 분리하면 계약 변경이 더 명확하다.

## 운영 체크리스트

- middleware 전용 counter와 resource handle에는 `PrivateStateAttr`을 붙인다.
- caller 입력값과 계산 결과를 `OmitFromOutput`, `OmitFromInput`으로 구분한다.
- `get_input_schema()`와 `get_output_schema()`를 CI에서 snapshot 또는 assertion으로 검사한다.
- state에 credential 원문을 넣지 않는다.
- checkpoint와 trace에도 민감정보가 남지 않는지 별도로 확인한다.
- 여러 middleware의 field 이름과 reducer 충돌을 검토한다.

## 마무리

LangChain agent의 state는 내부 실행 메모리이면서 동시에 호출 API의 입출력 계약이 될 수 있다. `PrivateStateAttr`, `OmitFromInput`, `OmitFromOutput`을 사용하면 두 역할을 한 schema 안에서 명시적으로 분리할 수 있다.

가장 실용적인 기준은 간단하다. caller가 보내면 안 되는 값은 input에서, caller가 받을 필요 없는 값은 output에서 제외한다. 양쪽 모두 해당하지 않는 middleware 내부 값은 private state로 둔다.

## 참고 자료

- [LangChain OmitFromSchema API reference](https://reference.langchain.com/python/langchain/agents/middleware/types/OmitFromSchema)
- [LangChain middleware types reference](https://reference.langchain.com/python/langchain/agents/middleware/types)
- [LangChain agents: custom state](https://docs.langchain.com/oss/python/langchain/agents#memory)
- [LangChain custom middleware](https://docs.langchain.com/oss/python/langchain/middleware/custom)
