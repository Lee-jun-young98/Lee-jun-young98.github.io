---
title: LangChain tool content와 artifact를 분리하고 return_direct로 루프 끝내기
description: content_and_artifact로 모델용 요약과 애플리케이션용 원본을 나누고 return_direct의 종료 동작을 안전하게 사용하는 방법
date: 2026-08-20
tags:
  - langchain
  - agent
  - tool
  - python
---

# LangChain tool content와 artifact를 분리하고 return_direct로 루프 끝내기

검색 결과나 데이터베이스 row 전체를 tool 결과로 그대로 넣으면 모델의 context가 빠르게 커진다. 반대로 짧게 요약해서 반환하면 UI가 출처, 식별자, 원본 metadata를 활용하기 어렵다.

LangChain tool은 `response_format="content_and_artifact"`로 두 소비자를 분리할 수 있다. `content`는 다음 모델 호출이 읽는 `ToolMessage` 본문이고, `artifact`는 애플리케이션이 후처리할 원본 데이터다. 여기에 `return_direct=True`를 쓰면 tool 실행 뒤 모델을 다시 호출하지 않고 agent loop를 종료할 수 있다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.3" langchain-openai
```

PowerShell에서는 `.venv\Scripts\Activate.ps1`로 활성화한다. 실제 agent 예제에는 `OPENAI_API_KEY`가 필요하지만, tool 출력 계약 자체는 모델 없이 테스트할 수 있다.

## 1. content와 artifact를 함께 반환하기

`content_and_artifact` tool은 반드시 `(content, artifact)` 2-tuple을 반환해야 한다.

```python
from langchain.tools import tool


@tool(response_format="content_and_artifact")
def search_orders(customer_id: str):
    """고객의 최근 주문을 조회한다."""
    rows = [
        {"order_id": "o-101", "status": "shipped", "total": 39000},
        {"order_id": "o-102", "status": "paid", "total": 12000},
    ]
    content = "최근 주문 2건: o-101은 배송 중, o-102는 결제 완료"
    artifact = {"customer_id": customer_id, "orders": rows}
    return content, artifact
```

좋은 `content`는 모델이 다음 행동을 결정하는 데 필요한 정보만 담는다. `artifact`에는 UI 링크, row ID, score, provenance처럼 모델이 읽을 필요는 없지만 프로그램이 보존해야 할 구조화 데이터를 둔다.

## 2. ToolMessage 계약을 모델 없이 검증하기

tool을 단순 dict로 invoke하면 함수 반환 tuple이 그대로 보일 수 있다. `artifact`가 붙은 `ToolMessage`까지 검증하려면 실제 tool call 형태와 `id`를 전달한다.

```python
message = search_orders.invoke(
    {
        "name": "search_orders",
        "args": {"customer_id": "c-7"},
        "id": "call-1",
        "type": "tool_call",
    }
)

assert message.content.startswith("최근 주문 2건")
assert message.artifact["orders"][0]["order_id"] == "o-101"
assert message.tool_call_id == "call-1"
```

이 테스트는 API key 없이 실행된다. tuple 길이를 잘못 반환하거나 artifact 구조를 바꾼 회귀를 CI에서 빠르게 잡는 데 유용하다.

## 3. agent 결과에서 artifact 꺼내기

agent가 tool을 호출하면 최종 state의 `messages`에서 해당 `ToolMessage`를 찾는다.

```python
from langchain.agents import create_agent
from langchain_core.messages import ToolMessage

agent = create_agent(
    model="openai:gpt-5-mini",
    tools=[search_orders],
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "고객 c-7의 주문을 확인해 줘"}]}
)

artifacts = [
    message.artifact
    for message in result["messages"]
    if isinstance(message, ToolMessage) and message.artifact is not None
]
```

artifact는 최종 답변 문자열에 자동으로 합쳐지는 별도 API 필드가 아니다. 메시지 history에서 수집하거나 `wrap_tool_call` middleware에서 저장소·관측 시스템으로 projection해야 한다.

또한 artifact가 모델에 보내지지 않는다는 사실은 비밀 저장을 뜻하지 않는다. state, checkpoint, trace 직렬화 과정에는 남을 수 있으므로 credential이나 불필요한 개인정보를 넣지 않는다.

## 4. return_direct로 모델 재호출 생략하기

다운로드 준비, 고정된 정책 문구, 이미 완성된 조회 결과처럼 모델이 다시 표현할 필요가 없는 tool은 `return_direct=True`로 만들 수 있다.

```python
from langchain.tools import tool


@tool(return_direct=True, response_format="content_and_artifact")
def export_report(report_id: str):
    """완성된 보고서의 다운로드 정보를 반환한다."""
    url = f"https://files.example.com/reports/{report_id}.pdf"
    content = f"보고서 {report_id}의 다운로드가 준비되었습니다."
    artifact = {"report_id": report_id, "download_url": url}
    return content, artifact
```

`return_direct=True`는 tool 값을 Python 함수의 raw 반환값으로 바꾼다는 뜻이 아니다. agent state에는 여전히 `ToolMessage`가 추가되고, 차이는 tool 실행 후 model node로 돌아가지 않고 종료한다는 점이다. 따라서 호출자는 평소처럼 `result["messages"]`에서 content와 artifact를 읽는다.

모델이 한 번에 여러 tool call을 만들 수 있는 환경에서는 direct-return tool과 side-effect tool을 같은 응답에 병렬 호출하지 않도록 설계한다. 종료 도구는 이름과 설명을 명확히 하고, 필요하면 model 설정이나 middleware로 병렬 tool call을 제한한다.

## 언제 무엇을 쓸까

| 상황 | 권장 설정 |
|---|---|
| 모델이 tool 결과를 읽고 답을 작성해야 함 | 기본 `response_format="content"` |
| 모델에는 요약, UI에는 원본 record가 필요함 | `content_and_artifact` |
| tool 결과 자체가 사용자에게 보여 줄 완성본임 | `return_direct=True` |
| 완성본과 구조화 metadata가 모두 필요함 | 두 옵션을 함께 사용 |

## 자주 막히는 지점

### 1. tuple 대신 dict 하나를 반환한다

`response_format="content_and_artifact"`이면 정확히 2-tuple이어야 한다. 첫 값은 `ToolMessage.content`로 쓸 문자열이나 content block, 둘째 값은 artifact다.

### 2. artifact가 다음 모델 호출의 context를 줄여 준다고 무조건 생각한다

모델에는 content만 전달되므로 원본을 content에 중복하지 않을 때 context 절감 효과가 난다. 긴 JSON을 content와 artifact 양쪽에 모두 넣으면 목적을 잃는다.

### 3. artifact를 보안 경계로 사용한다

artifact는 모델용 본문과 앱용 payload를 구분할 뿐 암호화나 접근 제어가 아니다. checkpoint와 tracing 정책을 함께 검토한다.

### 4. return_direct가 모델의 첫 호출도 없앤다고 생각한다

agent는 어떤 tool을 호출할지 결정하기 위해 먼저 모델을 호출한다. 생략되는 것은 tool 실행 **뒤의** 후속 모델 호출이다.

### 5. 직접 tool invoke와 agent invoke 결과를 같은 형태로 가정한다

일반 args dict로 직접 호출한 결과와 tool-call envelope로 호출한 `ToolMessage`, agent의 최종 state는 층위가 다르다. 테스트 목적에 맞는 형태를 명시한다.

## 운영 체크리스트

- content에는 모델의 다음 판단에 필요한 최소 정보만 둔다.
- artifact에는 안정적인 ID, provenance, UI metadata를 구조화해 둔다.
- tool-call envelope를 사용한 단위 테스트로 `ToolMessage.artifact`를 확인한다.
- artifact가 checkpoint와 trace에 저장되는지 검토한다.
- `return_direct` tool은 후속 모델 설명이 정말 불필요할 때만 사용한다.
- direct-return tool과 병렬 tool call의 상호작용을 통합 테스트한다.

## 마무리

tool 출력은 모델과 애플리케이션이 함께 소비하는 계약이다. `content_and_artifact`를 사용하면 모델 context에는 간결한 근거를 남기면서 UI와 후처리에는 원본 구조를 전달할 수 있다. 결과 자체가 완성된 응답이라면 `return_direct`로 불필요한 모델 재호출도 줄일 수 있다.

핵심은 두 옵션의 역할을 섞지 않는 것이다. `artifact`는 데이터 전달 경계이고, `return_direct`는 agent control-flow 설정이다.

## 참고 자료

- [LangChain tools guide](https://docs.langchain.com/oss/python/langchain/tools)
- [LangChain `tool` API reference](https://reference.langchain.com/python/langchain-core/tools/convert/tool)
- [LangChain `BaseTool` API reference](https://reference.langchain.com/python/langchain-core/tools/base/BaseTool)
- [LangChain agents guide](https://docs.langchain.com/oss/python/langchain/agents)
