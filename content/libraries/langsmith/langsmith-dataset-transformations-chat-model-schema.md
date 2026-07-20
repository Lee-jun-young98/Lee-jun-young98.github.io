---
title: "LangSmith dataset transformations로 운영 trace를 평가셋 형식으로 정규화하기"
description: "Chat Model schema와 convert_to_openai_message, convert_to_openai_tool, remove_system_messages를 이용해 운영 LLM trace를 재현 가능한 evaluation dataset으로 저장하는 방법"
date: 2026-07-20
tags:
  - langsmith
  - evaluation
  - dataset
  - observability
  - python
aliases:
  - "/blog/langsmith-dataset-transformations-chat-model-schema"
---

# LangSmith dataset transformations로 운영 trace를 평가셋 형식으로 정규화하기

운영 trace를 그대로 dataset에 복사하면 모델과 계측 방식에 따라 메시지 위치와 tool 정의 형식이 달라질 수 있다. 이 상태에서는 같은 평가 코드를 다른 모델에 재사용하기 어렵고, system prompt까지 example에 섞여 프롬프트 실험을 방해하기도 한다.

LangSmith의 **dataset transformations**는 example이 dataset에 들어오기 전에 필드를 정규화한다. 특히 내장 **Chat Model schema**를 쓰면 LangChain `BaseChatModel` run이나 LangSmith OpenAI wrapper로 수집한 LLM run에서 메시지와 tool 정의를 찾아 OpenAI 표준 형식으로 저장할 수 있다.

이 글에서는 다음 흐름을 만든다.

1. Python에서 재현 가능한 LLM trace를 남긴다.
2. LangSmith UI에서 Chat Model schema와 transformation을 설정한다.
3. trace를 dataset에 추가한다.
4. Python SDK로 실제 저장 결과를 검증한다.

## 언제 유용한가

- production trace를 회귀 평가셋으로 반복 수집할 때
- LangChain과 provider SDK에서 온 메시지를 하나의 형식으로 맞출 때
- tool calling을 포함한 요청을 다른 모델로 재실행할 때
- 운영 system prompt를 제외하고 새 system prompt만 비교할 때

단순한 질문·정답 JSON을 직접 만드는 경우라면 transformation 없이 `create_examples()`만 써도 충분하다. 이 기능의 장점은 **서로 다른 tracing payload를 공통 dataset contract로 바꾸는 것**에 있다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U langsmith openai
```

PowerShell에서는 다음 환경 변수를 설정한다.

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_TRACING="true"
$env:LANGSMITH_PROJECT="support-agent-prod"
$env:OPENAI_API_KEY="your_openai_key"
```

## 1. 변환할 LLM trace 만들기

공식 문서에서 Chat Model schema의 자동 추출 대상으로 명시한 방식 중 하나가 LangSmith OpenAI wrapper다. 아래 코드는 tool 정의와 system message가 포함된 LLM run을 만든다.

```python
from langsmith import traceable
from langsmith.wrappers import wrap_openai
from openai import OpenAI

client = wrap_openai(OpenAI())


@traceable(name="refund-assistant")
def ask_refund_policy(question: str):
    return client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "system",
                "content": "You are the production refund assistant.",
            },
            {"role": "user", "content": question},
        ],
        tools=[
            {
                "type": "function",
                "function": {
                    "name": "search_refund_policy",
                    "description": "Search the current refund policy",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"},
                        },
                        "required": ["query"],
                    },
                },
            }
        ],
    )


ask_refund_policy("배송 전 주문을 취소할 수 있나요?")
```

실행 후 LangSmith의 **Tracing Projects → support-agent-prod**에서 `refund-assistant` trace와 그 아래 LLM run이 보이는지 확인한다.

## 2. Chat Model schema에 들어 있는 transformation 이해하기

공식 내장 schema의 input contract는 핵심적으로 다음 두 필드를 가진다.

```json
{
  "type": "object",
  "properties": {
    "messages": {
      "type": "array",
      "items": {
        "$ref": "https://api.smith.langchain.com/public/schemas/v1/message.json"
      }
    },
    "tools": {
      "type": "array",
      "items": {
        "$ref": "https://api.smith.langchain.com/public/schemas/v1/tooldef.json"
      }
    }
  },
  "required": ["messages"]
}
```

여기에 다음 transformation이 결합된다.

- `remove_extra_fields`: schema에 선언하지 않은 key를 제거한다.
- `convert_to_openai_message`: LangChain message 직렬화 등을 OpenAI message 형식으로 바꾼다.
- `convert_to_openai_tool`: tool 정의를 OpenAI tool 형식으로 바꾼다.
- `remove_system_messages`: 선택 사항이며 input message 배열에서 system message를 제거한다.

`convert_to_openai_message`가 연결된 필드가 required인데 같은 이름의 필드를 찾지 못하면, 알려진 LangSmith trace 형식에서 message를 추출하려고 시도한다. `convert_to_openai_tool`도 최상위 `inputs.tools`가 없을 때 run invocation parameter에서 tool 정의를 추출할 수 있다.

## 3. UI에서 schema와 transformation 설정하기

LangSmith에서 **Datasets & Experiments → New Dataset → Set up Evaluation**으로 이동한 뒤 Chat Model schema를 선택한다. 직접 schema를 편집한다면 input의 `messages`, `tools`와 output의 `message` 필드에 각각 필요한 transformation을 연결한다.

운영 system prompt를 평가 데이터에 고정하고 싶지 않다면 `inputs.messages`에 `remove_system_messages`도 추가한다. 이렇게 하면 동일한 사용자 대화를 새 system prompt 후보에 다시 실행하기 쉬워진다.

그다음 tracing project에서 앞서 만든 **LLM run**을 선택하고 **Add to Dataset**으로 추가한다. 공식 문서 기준으로 LLM run을 tracing project나 annotation queue에서 dataset에 넣을 때 Chat Model schema가 기본 적용된다.

## 4. Python SDK로 변환 결과 검증하기

변환은 example 저장 시점에 적용된다. 따라서 원본 run이 아니라 저장된 example을 다시 읽어 contract를 확인해야 한다.

```python
from langsmith import Client

client = Client()
dataset_name = "support-chat-regression"

for example in client.list_examples(dataset_name=dataset_name):
    messages = example.inputs["messages"]
    tools = example.inputs.get("tools", [])

    assert isinstance(messages, list) and messages
    assert all("role" in message for message in messages)

    # remove_system_messages를 켰다면 운영 system prompt가 없어야 한다.
    assert all(message["role"] != "system" for message in messages)

    for tool in tools:
        assert tool["type"] == "function"
        assert "name" in tool["function"]

    print(example.id, messages, tools)
```

`list_examples(dataset_name=...)`의 dataset 이름은 정확히 일치해야 한다. CI에서 이 검사를 수행하면 schema 설정이 바뀌거나 예상하지 못한 trace 형식이 유입될 때 일찍 발견할 수 있다.

## 5. 정규화된 dataset을 evaluation에 사용하기

저장된 `messages`와 `tools`는 모델 호출 입력으로 바로 전달할 수 있다.

```python
from langsmith import Client, evaluate
from openai import OpenAI

ls_client = Client()
openai_client = OpenAI()


def target(inputs: dict) -> dict:
    response = openai_client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=inputs["messages"],
        tools=inputs.get("tools") or None,
    )
    return {"message": response.choices[0].message.model_dump()}


evaluate(
    target,
    data="support-chat-regression",
    experiment_prefix="refund-prompt-v2",
)
```

정답 output이 없는 production trace 기반 dataset이라면 우선 latency, tool 선택, JSON 형식, 안전성처럼 reference-free evaluator를 붙이는 편이 자연스럽다. 정답이 필요한 correctness 평가는 사람이 reference output을 보완한 뒤 실행한다.

## 자주 생기는 실수

### root trace를 넣고 LLM run처럼 자동 추출될 것으로 기대한다

내장 Chat Model schema의 호환 대상은 LangChain `BaseChatModel` run 또는 LangSmith OpenAI wrapper의 LLM run이다. agent root나 임의의 LangGraph state를 넣는다면 데이터 구조에 맞는 schema와 transformation을 직접 정의해야 한다.

### `remove_system_messages`를 무조건 켠다

운영 prompt까지 포함한 완전한 재현이 목적이면 system message를 남겨야 한다. 반대로 새 prompt 비교가 목적이면 제거하는 편이 맞다. 재현성과 prompt 독립성 중 무엇이 필요한지 먼저 정한다.

### transformation이 기존 example도 자동 수정한다고 생각한다

transformation은 데이터가 추가될 때 적용되는 전처리 단계다. 설정 전에 저장한 example은 별도로 다시 수집하거나 마이그레이션해야 한다.

### `remove_extra_fields`로 필요한 context까지 지운다

schema 밖의 metadata나 사용자 context가 평가 target에 필요하다면 먼저 schema에 필드를 선언한다. 제거한 뒤에는 evaluation 입력에서 복구할 수 없다.

### 변환 성공 여부를 UI 미리보기만으로 판단한다

저장된 example을 `list_examples()`로 다시 읽고 required field, role, tool schema를 assert해야 실제 평가 코드와 같은 관점에서 검증할 수 있다.

## 실전 체크리스트

1. 수집 대상이 호환되는 LLM run인지 확인한다.
2. 평가 target이 요구하는 input contract를 JSON schema로 먼저 정한다.
3. Chat Model schema 또는 개별 transformation을 연결한다.
4. system message를 유지할지 제거할지 명시적으로 선택한다.
5. 소량의 trace를 넣고 SDK assert로 저장 결과를 검증한다.
6. 검증 후 run rule이나 annotation workflow로 수집 범위를 늘린다.

## 참고 자료

- [Dataset transformations](https://docs.langchain.com/langsmith/dataset-transformations)
- [Create and manage datasets in the UI](https://docs.langchain.com/langsmith/manage-datasets-in-application)
- [Create and manage datasets programmatically](https://docs.langchain.com/langsmith/manage-datasets-programmatically)
- [Example data format](https://docs.langchain.com/langsmith/example-data-format)
