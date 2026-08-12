---
title: "LangSmith Playground tool registry로 도구 스키마 재사용하기"
description: "LangSmith Playground에서 custom·built-in tool을 workspace registry로 관리하고, prompt별 활성화와 Python 실행 구현의 schema drift를 줄이는 실전 노트"
date: 2026-08-12
tags:
  - langsmith
  - promptops
  - tools
  - python
aliases:
  - "/blog/langsmith-playground-tool-registry"
---

# LangSmith Playground tool registry로 도구 스키마 재사용하기

여러 prompt가 같은 `search_orders`, `lookup_policy` 같은 tool을 쓰기 시작하면 각 prompt에 JSON Schema를 복사하는 방식은 금방 어긋난다. LangSmith Playground의 **tool registry**는 custom tool과 provider built-in tool 설정을 workspace 범위에 저장하고, prompt마다 필요한 tool만 활성화하도록 돕는다.

다만 registry는 실제 Python 함수를 실행하는 서버가 아니다. Playground에서 custom tool을 호출하면 모델이 tool name과 arguments를 만든다. 운영 애플리케이션은 동일한 계약을 가진 함수를 별도로 구현하고 실행해야 한다.

## 언제 유용한가

- 여러 prompt가 같은 tool schema를 공유한다.
- prompt 변경 전에 모델이 올바른 tool과 arguments를 고르는지 빠르게 확인하고 싶다.
- OpenAI web search나 Anthropic web search처럼 provider built-in tool을 Playground에서 비교하고 싶다.
- tool schema와 실제 Python handler 사이의 drift를 줄이고 싶다.

prompt 하나에서 한 번만 쓰는 단순 실험이라면 registry 운영 규칙까지 만들 필요는 없다.

## 사전 준비

- LangSmith workspace와 Playground 접근 권한
- 테스트할 model provider의 API key를 LangSmith workspace secret에 등록
- 운영 코드 예제를 실행하려면 Python 3.10 이상과 `pydantic`

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U pydantic
```

PowerShell에서는 `.venv\Scripts\Activate.ps1`로 활성화한다.

## 1. 먼저 tool 계약을 작게 정의한다

Playground에서 **+ Tool → Custom tool**을 선택하고 name, description, arguments를 입력한다. 예를 들어 주문 상태 조회 tool은 다음처럼 만든다.

```json
{
  "name": "get_order_status",
  "description": "주문 번호로 배송 상태를 조회한다. 주문 취소에는 사용하지 않는다.",
  "parameters": {
    "type": "object",
    "properties": {
      "order_id": {
        "type": "string",
        "description": "ORD-로 시작하는 주문 번호",
        "pattern": "^ORD-[0-9]{6}$"
      }
    },
    "required": ["order_id"],
    "additionalProperties": false
  }
}
```

설명에는 “무엇을 하는가”뿐 아니라 “언제 쓰지 않는가”도 적는 편이 routing 오류를 줄이는 데 유리하다. arguments는 실제 handler가 받는 필드만 허용한다.

## 2. registry tool과 Python handler가 같은 계약을 쓰게 한다

다음 코드는 Playground가 만든 tool call arguments를 검증하고 실행할 수 있는 최소 예제다. 외부 주문 API 대신 메모리 데이터를 사용하므로 그대로 실행할 수 있다.

```python
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class GetOrderStatusArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: str = Field(pattern=r"^ORD-[0-9]{6}$")


ORDERS: dict[str, Literal["preparing", "shipped", "delivered"]] = {
    "ORD-123456": "shipped",
}


def get_order_status(args: GetOrderStatusArgs) -> dict[str, str]:
    return {
        "order_id": args.order_id,
        "status": ORDERS.get(args.order_id, "not_found"),
    }


def dispatch_tool_call(name: str, arguments: dict) -> dict[str, str]:
    if name != "get_order_status":
        raise ValueError(f"unsupported tool: {name}")
    return get_order_status(GetOrderStatusArgs.model_validate(arguments))


print(dispatch_tool_call("get_order_status", {"order_id": "ORD-123456"}))
```

실행 결과는 다음과 같다.

```text
{'order_id': 'ORD-123456', 'status': 'shipped'}
```

핵심은 모델이 보낸 arguments를 곧바로 외부 API에 넘기지 않고 동일한 제약으로 다시 검증하는 것이다. registry는 prompt 실험의 계약이고, Pydantic model은 실행 경계의 계약이다.

## 3. prompt마다 필요한 tool만 활성화한다

registry에 저장된 tool은 모든 prompt에서 자동 실행되는 것이 아니다. **+ Tool → Available Tools**에서 prompt별로 enable/disable할 수 있다.

추천 운영 방식은 다음과 같다.

1. registry에는 재사용 가능한 작은 capability 단위로 저장한다.
2. 각 prompt에는 실제로 필요한 tool만 활성화한다.
3. read와 write tool을 분리한다.
4. 결제·취소처럼 부작용이 있는 tool에는 확인 단계를 둔다.

tool을 많이 노출하면 token 비용뿐 아니라 모델이 비슷한 tool 사이에서 잘못 고를 가능성도 커진다.

## 4. shared tool 수정은 새 버전처럼 다룬다

공식 문서 기준으로 shared tool을 수정할 때 registry의 기존 항목을 갱신하거나 새 tool로 저장할 수 있다. arguments 이름을 바꾸거나 required field를 추가하는 변경은 기존 prompt와 handler를 깨뜨릴 수 있으므로 새 이름으로 저장하는 편이 안전하다.

예를 들어 다음처럼 명시적으로 버전을 나눈다.

```text
get_order_status_v1(order_id)
get_order_status_v2(order_id, locale)
```

새 prompt에서 v2를 검증한 뒤 v1을 쓰는 prompt를 검색해 순차 전환한다. in-place 수정은 description 보완처럼 호환되는 변경에 제한한다.

## 5. built-in tool과 custom tool을 구분한다

Playground는 provider가 실행하는 built-in tool과 애플리케이션이 실행해야 하는 custom tool을 모두 registry에 저장할 수 있다.

- built-in tool: provider가 web search, image generation, MCP 같은 실행을 담당한다.
- custom tool: Playground에서는 모델의 tool call JSON을 확인하고, 운영에서는 애플리케이션 handler가 실행한다.

보이는 built-in tool 목록은 선택한 provider와 model의 지원 범위에 따라 달라진다. OpenAI용 built-in tool 설정이 Anthropic model로 그대로 이식된다고 가정하면 안 된다.

## 6. dataset으로 tool 선택 회귀를 확인한다

단건 prompt가 성공해도 충분하지 않다. Playground의 **Test over dataset**으로 다음 사례를 함께 넣는다.

| 입력 역할 | 기대 결과 |
| --- | --- |
| 정상 주문 번호 조회 | `get_order_status` 호출 |
| 주문 취소 요청 | 조회 tool을 호출하지 않음 |
| 잘못된 주문 번호 | 형식 확인을 먼저 요청 |
| 일반 배송 정책 질문 | 정책 답변 또는 별도 policy tool 사용 |

dataset input key와 prompt variable 이름이 같아야 하며, Playground는 최대 15개 input variable을 지원한다. 실험 전에 prompt commit을 남기면 어떤 prompt 버전과 tool 설정으로 결과를 냈는지 추적하기 쉽다.

## 흔한 함정

### registry가 실제 함수를 배포한다고 생각한다

custom tool registry는 schema와 설정을 재사용하는 기능이다. Python handler, 인증, timeout, retry, idempotency는 애플리케이션에서 구현해야 한다.

### shared tool을 바로 수정해 모든 prompt를 깨뜨린다

required field 추가나 field rename은 breaking change다. 새 registry 항목으로 저장하고 prompt별로 이동한다.

### Playground 결과만 보고 운영 실행을 신뢰한다

올바른 tool call 생성과 안전한 tool 실행은 별개다. 운영 경계에서 arguments를 재검증하고 사용자 권한도 다시 확인한다.

### provider별 tool choice를 같은 값으로 가정한다

Tool Choice Setting의 지원 옵션과 의미는 provider/model마다 다를 수 있다. 실제 배포 모델의 공식 문서와 응답을 확인한다.

### 모든 tool을 항상 enable한다

최소 권한 원칙을 tool 노출에도 적용한다. prompt 역할에 필요한 tool만 켜고, write capability는 별도 승인 흐름과 결합한다.

## 정리

LangSmith tool registry의 가장 실용적인 역할은 tool을 “한 번 정의해 여러 prompt에서 선택적으로 재사용”하는 것이다. registry schema와 Python validation model을 같은 계약으로 유지하고, breaking change는 새 버전으로 분리하며, dataset evaluation으로 tool 선택 회귀를 확인하면 Playground 실험을 운영 코드로 옮길 때 생기는 간극을 줄일 수 있다.

## 참고 자료

- [Use tools in a prompt](https://docs.langchain.com/langsmith/use-tools)
- [Run an evaluation from the Playground](https://docs.langchain.com/langsmith/run-evaluation-from-playground)
- [Create a prompt](https://docs.langchain.com/langsmith/create-a-prompt)
- [Prompt template formats](https://docs.langchain.com/langsmith/prompt-template-format)
