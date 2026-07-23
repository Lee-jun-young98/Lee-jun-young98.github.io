---
title: "LangChain content_blocks로 모델별 메시지를 같은 형식으로 다루기"
description: "LangChain 표준 content_blocks로 OpenAI와 Anthropic의 text, reasoning, image 출력을 같은 코드로 읽고 저장 경계를 설계하는 실전 패턴"
date: 2026-07-24
tags:
  - langchain
  - agent
  - messages
  - multimodal
  - interoperability
  - python
aliases:
  - "/blog/standard-content-blocks-cross-provider"
---

# LangChain content_blocks로 모델별 메시지를 같은 형식으로 다루기

OpenAI, Anthropic 같은 모델 공급자는 텍스트, 추론, 이미지 블록을 서로 다른 딕셔너리 구조로 반환한다. 애플리케이션이 `message.content`의 내부 키를 직접 읽으면 모델을 바꾸는 순간 UI 렌더러, 저장 코드, 후처리 로직도 함께 고쳐야 한다.

LangChain v1의 `message.content_blocks`는 공급자별 원본 메시지를 `text`, `reasoning`, `image` 같은 표준 블록으로 보여 주는 인터페이스다. 원본 `content`를 없애는 기능이 아니라, 같은 메시지를 공급자에 덜 의존하는 형태로 읽게 해 주는 계층이다.

이 글에서는 다음을 다룬다.

- `content`와 `content_blocks`의 역할 차이
- 여러 공급자의 텍스트와 추론 블록을 같은 함수로 처리하기
- `output_version="v1"`로 표준 블록을 직렬화하는 시점
- 모델에게 보낼 내용과 애플리케이션용 `artifact`를 분리하기

## 사전 준비

Python 3.10 이상 환경에서 LangChain을 설치한다.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U langchain
```

실제 모델까지 호출하려면 사용하는 공급자 패키지를 추가한다.

```bash
pip install -U langchain-openai langchain-anthropic
```

아래의 메시지 정규화 예제는 API 키 없이 실행할 수 있다.

## 1. `content` 대신 표준 읽기 인터페이스 사용하기

`content`는 문자열일 수도 있고 공급자 고유 딕셔너리 목록일 수도 있다. 반면 `content_blocks`는 알려진 공급자 형식을 LangChain 표준 타입으로 지연 변환한다.

```python
from langchain.messages import AIMessage


anthropic_message = AIMessage(
    content=[
        {
            "type": "thinking",
            "thinking": "배송 상태를 확인해야 한다.",
            "signature": "signed-value",
        },
        {"type": "text", "text": "주문 번호를 알려 주세요."},
    ],
    response_metadata={"model_provider": "anthropic"},
)

openai_message = AIMessage(
    content=[
        {
            "type": "reasoning",
            "id": "rs_123",
            "summary": [
                {"type": "summary_text", "text": "배송 조회가 필요하다."}
            ],
        },
        {"type": "text", "text": "주문 번호를 알려 주세요."},
    ],
    response_metadata={"model_provider": "openai"},
)

for message in (anthropic_message, openai_message):
    for block in message.content_blocks:
        if block["type"] == "reasoning":
            print("reasoning:", block.get("reasoning", ""))
        elif block["type"] == "text":
            print("text:", block["text"])
```

핵심은 `thinking`, `summary`, `summary_text` 같은 공급자별 키를 애플리케이션 코드에 퍼뜨리지 않는 것이다. 새 공급자를 붙일 때도 렌더러는 표준 `type`을 기준으로 분기할 수 있다.

`response_metadata["model_provider"]`가 없는 수동 메시지에서는 LangChain이 어느 공급자 형식인지 판단하지 못할 수 있다. 실제 모델 응답에는 통합 패키지가 이 메타데이터를 채우지만, fixture를 직접 만들 때는 명시하는 편이 안전하다.

## 2. UI와 후처리는 지원하는 블록만 명시적으로 읽기

모든 블록을 문자열로 강제 변환하면 이미지 데이터나 공급자 전용 payload가 화면에 노출될 수 있다. 지원하는 타입만 처리하고 나머지는 안전하게 건너뛴다.

```python
from langchain.messages import BaseMessage


def project_message(message: BaseMessage) -> dict:
    projected = {
        "text": [],
        "reasoning": [],
        "images": [],
        "unsupported_types": [],
    }

    for block in message.content_blocks:
        block_type = block["type"]

        if block_type == "text":
            projected["text"].append(block["text"])
        elif block_type == "reasoning":
            projected["reasoning"].append(block.get("reasoning", ""))
        elif block_type == "image":
            projected["images"].append(
                {
                    "url": block.get("url"),
                    "mime_type": block.get("mime_type"),
                }
            )
        else:
            projected["unsupported_types"].append(block_type)

    return projected
```

실제 제품에서는 `reasoning`을 사용자에게 그대로 노출해도 되는지 별도 정책을 둬야 한다. 표준화되었다는 사실이 공개 가능하다는 뜻은 아니다. 이미지의 `base64`도 로그나 분석 이벤트에 그대로 넣지 말고 크기 제한과 저장 정책을 적용한다.

## 3. 입력부터 표준 content block으로 만들기

멀티모달 입력도 공급자별 형식 대신 표준 블록으로 작성할 수 있다. URL 이미지라면 다음처럼 `HumanMessage`를 만든다.

```python
from langchain.messages import HumanMessage


message = HumanMessage(
    content_blocks=[
        {"type": "text", "text": "이 영수증의 총액을 알려 줘."},
        {"type": "image", "url": "https://example.com/receipt.png"},
    ]
)

print(message.content_blocks)
```

base64 데이터를 넣을 때는 `mime_type`도 함께 지정해야 한다.

```python
image_message = HumanMessage(
    content_blocks=[
        {"type": "text", "text": "이미지를 한 문장으로 설명해 줘."},
        {
            "type": "image",
            "base64": "iVBORw0KGgoAAA...",
            "mime_type": "image/png",
        },
    ]
)
```

모든 모델이 모든 파일 형식을 지원하지는 않는다. LangChain의 표준 입력 모양과 실제 공급자 모델의 capability는 별개이므로 이미지, PDF, 오디오 지원 여부와 크기 제한은 공급자 문서에서 다시 확인해야 한다.

## 4. `output_version="v1"`은 저장 형태가 필요할 때 선택하기

기본적으로 `content_blocks`는 메시지를 읽을 때 표준화하는 property이고 원래 `content`의 공급자 형식은 유지된다. LangChain 밖의 서비스나 데이터베이스도 표준 블록을 직접 읽어야 한다면 모델의 `output_version="v1"`을 사용할 수 있다.

```python
from langchain.chat_models import init_chat_model


model = init_chat_model(
    "openai:gpt-5.4-mini",
    output_version="v1",
)

response = model.invoke("세 문장으로 에이전트 메모리를 설명해 줘.")

print(response.content)
print(response.content_blocks)
```

같은 설정은 `LC_OUTPUT_VERSION=v1` 환경 변수로도 적용할 수 있다.

```powershell
$env:LC_OUTPUT_VERSION="v1"
```

전역 환경 변수는 한 프로세스의 모든 모델에 영향을 줄 수 있다. 점진적으로 도입할 때는 모델 인스턴스에 `output_version="v1"`을 명시하고, 저장 consumer가 새 블록 구조를 처리하는지 확인한 뒤 범위를 넓히는 편이 안전하다.

이미 저장한 과거 메시지가 자동으로 migration되지는 않는다. 기존 raw payload와 v1 표준 payload가 섞일 수 있으므로 저장 레코드에 자체 schema version을 두고 읽기 경로를 호환시키는 것이 좋다.

## 5. 모델용 `content`와 앱용 `artifact` 분리하기

검색 도구 결과에는 모델이 읽을 짧은 본문과 UI가 쓸 문서 ID, 점수, 페이지 번호가 함께 있다. 이 메타데이터를 전부 모델 컨텍스트에 넣지 말고 `ToolMessage.artifact`에 둔다.

```python
from langchain.messages import ToolMessage


tool_message = ToolMessage(
    content="환불은 상품 수령 후 7일 이내에 신청할 수 있습니다.",
    tool_call_id="call_search_123",
    name="search_policy",
    artifact={
        "document_id": "policy-2026-04",
        "page": 12,
        "score": 0.93,
    },
)

print(tool_message.text)
print(tool_message.artifact["page"])
```

`artifact`는 모델에게 보내지 않는 애플리케이션용 데이터다. 다만 state, trace, checkpoint에 저장될 수 있으므로 비밀번호나 접근 토큰을 넣어도 된다는 뜻은 아니다.

## 테스트할 항목

- 사용하는 각 공급자의 실제 응답이 필요한 표준 블록으로 변환되는가
- `text`, `reasoning`, `image`, 알 수 없는 타입을 렌더러가 안전하게 처리하는가
- reasoning과 base64 데이터가 로그나 사용자 UI에 의도치 않게 노출되지 않는가
- `output_version="v1"` 적용 전후의 저장 payload를 기존 consumer가 모두 읽는가
- URL, base64, file ID 입력을 대상 모델이 실제로 지원하는가
- `ToolMessage.content`에는 모델이 필요한 최소 정보만, `artifact`에는 앱 메타데이터만 들어가는가

## 자주 막히는 포인트

### `content_blocks`가 `content`를 대체한다고 생각한다

`content_blocks`는 표준화된 읽기 인터페이스다. 기본 설정에서는 공급자 원본 `content`가 그대로 남을 수 있다. 직렬화 형태까지 표준화하려면 `output_version="v1"`을 별도로 선택한다.

### raw `content`의 키를 계속 직접 파싱한다

OpenAI의 `summary`, Anthropic의 `thinking` 같은 키를 여러 계층에서 직접 읽으면 공급자 교체 비용이 커진다. 공급자 고유 기능이 꼭 필요한 경계를 제외하고는 `content_blocks`를 기준으로 처리한다.

### 알려지지 않은 블록을 무조건 화면에 출력한다

`non_standard`나 새 블록 타입에는 예상하지 못한 payload가 포함될 수 있다. allowlist 방식으로 지원 타입만 렌더링하고 나머지는 타입 이름만 계측한다.

### 표준 입력이면 모든 모델에서 작동한다고 가정한다

표준 블록은 입력 모양을 통일하지만 모델 capability를 추가하지 않는다. 지원하지 않는 PDF나 오디오를 보내면 공급자 API에서 실패할 수 있다.

### `artifact`에 비밀 값을 넣는다

모델 컨텍스트에서 빠진다는 것과 안전하게 폐기된다는 것은 다르다. trace와 checkpoint 보존 범위를 고려해 민감정보는 별도 secret store에서 관리한다.

## 정리

`content_blocks`를 경계로 삼으면 에이전트의 메시지 처리 코드를 모델 공급자에서 분리할 수 있다.

1. 실행 중 읽기와 UI 투영은 `message.content_blocks`를 사용한다.
2. 지원 블록 타입을 명시하고 reasoning, binary 데이터의 노출 정책을 둔다.
3. 저장·서비스 간 전송도 표준 블록이 필요할 때 `output_version="v1"`을 도입한다.
4. 모델에게 필요한 내용은 `content`, 애플리케이션 메타데이터는 `artifact`로 나눈다.
5. 표준 형식과 모델별 multimodal capability를 별도로 테스트한다.

이 구조를 먼저 잡아 두면 모델 교체나 멀티모달 확장 때 메시지 파싱 코드를 서비스 전체에서 다시 쓰는 일을 줄일 수 있다.

## 참고 자료

- [LangChain Messages](https://docs.langchain.com/oss/python/langchain/messages)
- [LangChain Models: multimodal and streaming messages](https://docs.langchain.com/oss/python/langchain/models)
- [LangChain v1 migration guide: standard content](https://docs.langchain.com/oss/python/migrate/langchain-v1#standard-content)
- [LangChain `ContentBlock` API reference](https://reference.langchain.com/python/langchain-core/messages/content/ContentBlock)

