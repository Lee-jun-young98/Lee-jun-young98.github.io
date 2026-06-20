---
title: "LangSmith attachments로 멀티모달 evaluation 운영하기"
description: "LangSmith dataset example에 PDF, image, audio attachment를 붙이고 evaluate()에서 attachments 인자를 받아 멀티모달 target과 evaluator를 돌리는 방법을 Python 예제로 정리한 실전 노트"
date: 2026-06-20
tags:
  - langsmith
  - evaluation
  - multimodal
  - python
aliases:
  - "/blog/langsmith-evaluate-with-attachments"
---

# LangSmith attachments로 멀티모달 evaluation 운영하기

텍스트 평가만 하다가 이미지, PDF, 오디오가 섞이기 시작하면 LangSmith dataset 설계가 바로 달라진다.

- OCR 결과를 평가하고 싶다
- 이미지 설명 caption 품질을 비교하고 싶다
- PDF extraction 결과를 reference와 함께 검증하고 싶다
- 음성 입력을 받아 답하는 agent를 dataset 기반으로 테스트하고 싶다

이때 파일을 전부 base64 문자열로 `inputs`에 밀어 넣으면 일단은 돌아가지만, 운영하기가 금방 불편해진다.  
LangSmith 공식 문서도 멀티모달 평가에서는 base64를 기본값으로 보지 않고, `attachments`를 붙인 dataset example을 권장한다.

이 글에서는 Python SDK 기준으로 아래 흐름을 정리한다.

1. dataset example에 attachment를 업로드하는 방법
2. `evaluate()` 대상 함수에서 `attachments`를 받는 규칙
3. attachment를 참조하는 custom evaluator 작성 방법
4. 업데이트 시 어떤 attachment가 유지되고 삭제되는지

## 왜 attachments가 낫나

2026-06-20 기준 LangSmith 공식 문서에서는 attachments 방식의 장점을 두 가지로 설명한다.

- 바이너리 파일 전송이 더 효율적이라 업로드/다운로드가 빠르다
- LangSmith UI에서 파일 preview가 더 잘 된다

즉, "평가가 가능하다" 수준이 아니라 "운영 가능한 dataset이 된다"는 쪽에 더 가깝다.

## 언제 특히 유용한가

아래 상황이면 attachments 기반 dataset을 먼저 고려하는 편이 좋다.

- vision model output을 정기적으로 회귀 테스트할 때
- OCR, document parsing, receipt extraction처럼 PDF나 이미지가 입력인 작업
- speech-to-text, audio Q&A처럼 오디오를 직접 다루는 실험
- 동일한 파일을 여러 evaluator에서 재사용해야 할 때

반대로 입력이 완전히 텍스트이고 파일 preview도 필요 없다면 기존 text dataset만으로 충분하다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith openai requests
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:OPENAI_API_KEY="sk-your-key"
```

attachment 업로드 예제는 LangSmith 공식 문서 기준으로 `langsmith>=0.3.13`이 필요하다.

## 1. dataset example에 attachment를 붙여 업로드한다

LangSmith 문서 기준으로 Python에서는 `create_examples(...)`와 `update_examples(...)`로 attachment를 다룬다.  
각 attachment는 `mime_type`과 `data`를 함께 넘긴다.

아래 예시는 공개 테스트 파일을 받아 example 하나를 만들고 dataset에 올리는 흐름이다.

```python
import uuid
import requests
from langsmith import Client

ls_client = Client()

pdf_url = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
wav_url = "https://openaiassets.blob.core.windows.net/$web/API/docs/audio/alloy.wav"
img_url = "https://www.w3.org/Graphics/PNG/nurbcup2si.png"

pdf_bytes = requests.get(pdf_url, timeout=30).content
wav_bytes = requests.get(wav_url, timeout=30).content
img_bytes = requests.get(img_url, timeout=30).content

dataset = ls_client.create_dataset(
    dataset_name="multimodal-attachment-demo",
    description="PDF, audio, image attachment examples for LangSmith evals",
)

example = {
    "id": uuid.uuid4(),
    "inputs": {
        "audio_question": "What is in this audio clip?",
        "image_question": "What is in this image?",
    },
    "outputs": {
        "audio_answer": "A synthetic voice says a short sentence.",
        "image_answer": "A cup with cloth over it.",
    },
    "attachments": {
        "my_pdf": {"mime_type": "application/pdf", "data": pdf_bytes},
        "my_wav": {"mime_type": "audio/wav", "data": wav_bytes},
        "my_img": {"mime_type": "image/png", "data": img_bytes},
    },
}

ls_client.create_examples(dataset_id=dataset.id, examples=[example])
print(dataset.id)
```

여기서 `inputs`에는 질문 같은 구조화 텍스트만 넣고, 실제 파일은 `attachments`로 분리하는 점이 중요하다.

### 로컬 파일 경로를 직접 넘길 수도 있다

공식 문서 기준으로 attachment `data`에는 바이트 대신 로컬 경로를 넘길 수도 있다.  
이 경우 `dangerously_allow_filesystem=True`를 명시해야 한다.

```python
from pathlib import Path
from langsmith import Client

ls_client = Client()

example = {
    "inputs": {"question": "Describe the attached image."},
    "outputs": {"answer": "placeholder"},
    "attachments": {
        "receipt_img": {
            "mime_type": "image/png",
            "data": str(Path("sample-data/receipt.png").resolve()),
        }
    },
}

ls_client.create_examples(
    dataset_name="multimodal-attachment-demo",
    examples=[example],
    dangerously_allow_filesystem=True,
)
```

이 옵션은 편하지만, CI나 서버 환경에서는 경로 의존성이 커질 수 있으니 바이트 업로드가 더 안전한 경우가 많다.

## 2. target 함수는 `inputs`, `attachments` 두 인자를 받는다

LangSmith 공식 문서 기준으로 attachment를 소비하는 Python target 함수는 positional argument 두 개를 받아야 한다.

- 첫 번째 인자 이름: `inputs`
- 두 번째 인자 이름: `attachments`

`attachments`는 attachment 이름을 key로 가지는 dict이며, 각 값은 아래 구조를 가진다.

```python
{
    "presigned_url": str,
    "mime_type": str,
    "reader": BinaryIO,
}
```

즉, 이미지처럼 URL로 바로 넘길 수 있는 파일은 `presigned_url`을 쓰고, 오디오처럼 직접 바이트를 읽어야 할 때는 `reader`를 쓰면 된다.

### 이미지와 오디오를 함께 처리하는 target 예제

```python
import base64
from openai import OpenAI
from langsmith import evaluate
from langsmith.wrappers import wrap_openai

oai = wrap_openai(OpenAI())


def multimodal_qa(inputs, attachments):
    audio_reader = attachments["my_wav"]["reader"]
    audio_b64 = base64.b64encode(audio_reader.read()).decode("utf-8")

    audio_resp = oai.chat.completions.create(
        model="gpt-4o-audio-preview",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": inputs["audio_question"]},
                    {
                        "type": "input_audio",
                        "input_audio": {"data": audio_b64, "format": "wav"},
                    },
                ],
            }
        ],
    )

    image_url = attachments["my_img"]["presigned_url"]
    image_resp = oai.chat.completions.create(
        model="gpt-5.4-mini",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": inputs["image_question"]},
                    {"type": "image_url", "image_url": {"url": image_url}},
                ],
            }
        ],
    )

    return {
        "audio_answer": audio_resp.choices[0].message.content,
        "image_answer": image_resp.choices[0].message.content,
    }


results = evaluate(
    multimodal_qa,
    data="multimodal-attachment-demo",
)

print(results.experiment_name)
```

이 패턴이 실무에서 좋은 이유는 file transport와 model prompt 구성을 분리할 수 있기 때문이다.

- LangSmith는 dataset/version/history를 맡는다
- target 함수는 attachment를 실제 모델 입력으로 변환하는 데만 집중한다

## 3. attachment를 쓰는 custom evaluator도 함께 붙일 수 있다

멀티모달 evaluation의 핵심은 target만 멀티모달인 것이 아니라 evaluator도 attachment를 볼 수 있다는 점이다.

예를 들어 image caption이 실제 이미지와 맞는지 LLM judge로 다시 검증할 수 있다.

```python
from pydantic import BaseModel


class ImageJudge(BaseModel):
    description_is_valid: bool


def valid_image_description(outputs: dict, attachments: dict) -> bool:
    image_url = attachments["my_img"]["presigned_url"]
    instructions = (
        "Review the image and decide whether the description matches it."
    )

    response = oai.beta.chat.completions.parse(
        model="gpt-5.5",
        messages=[
            {"role": "system", "content": instructions},
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_url}},
                    {"type": "text", "text": outputs["image_answer"]},
                ],
            },
        ],
        response_format=ImageJudge,
    )
    return response.choices[0].message.parsed.description_is_valid


results = evaluate(
    multimodal_qa,
    data="multimodal-attachment-demo",
    evaluators=[valid_image_description],
)
```

문서 기준으로 attachment를 쓰는 evaluator는 해당 입력 modality를 처리할 수 있으면서 structured output도 지원하는 모델을 써야 한다.  
특히 audio attachment evaluator는 현재 Gemini만 지원된다고 명시돼 있으니 이 점은 꼭 확인해야 한다.

## 4. attachment update는 retain/rename를 명시하지 않으면 삭제로 본다

기존 example을 업데이트할 때 가장 많이 실수하는 부분이다.  
LangSmith 공식 문서 기준으로 기존 attachment는 아래 규칙을 따른다.

- 새 attachment는 `attachments`에 넣는다
- 유지할 기존 파일은 `attachments_operations.retain`에 넣는다
- 이름만 바꿀 파일은 `attachments_operations.rename`에 넣는다
- 위 둘에 없는 기존 attachment는 삭제된다

```python
example_update = {
    "id": example["id"],
    "inputs": example["inputs"],
    "outputs": example["outputs"],
    "attachments": {
        "notes.txt": ("text/plain", b"updated metadata"),
    },
    "attachments_operations": {
        "retain": ["my_pdf", "my_img"],
        "rename": {
            "my_wav": "product_audio.wav",
        },
    },
}

ls_client.update_examples(dataset_id=dataset.id, updates=[example_update])
```

이 규칙을 모르면 "텍스트 필드만 수정했는데 파일이 왜 사라졌지?" 같은 문제가 생긴다.

## 운영 팁

### 1. attachment 이름을 stable key처럼 다룬다

`my_img`, `invoice_pdf`, `call_audio`처럼 evaluator가 참조할 이름은 자주 바꾸지 않는 편이 낫다.  
attachment 이름이 사실상 evaluator variable contract 역할을 하기 때문이다.

### 2. 질문 텍스트와 파일 자체를 분리한다

`inputs`에는 질문, locale, task type 같은 구조화 텍스트를 두고, attachment에는 파일을 둔다.  
이렇게 해야 필터링과 split 운영이 쉬워진다.

### 3. attachment 없는 fallback 예제를 같이 준비한다

멀티모달 모델 사용량이 비싸거나 rate limit이 빡빡할 수 있다.  
텍스트-only fallback evaluator를 하나 더 두면 triage 속도가 좋아진다.

### 4. dataset version을 같이 본다

attachment update도 dataset version을 바꾼다.  
파일 교체가 있었던 실험과 이전 실험을 섞어 비교하면 원인 분석이 어려워진다.

## 자주 틀리는 점

### 1. target 함수 시그니처를 `inputs` 하나만 받게 만든다

attachments를 쓰려면 Python target 함수가 `inputs`, `attachments` 두 positional argument를 받아야 한다.  
그렇지 않으면 파일이 자동 주입되지 않는다.

### 2. 오디오도 이미지처럼 `presigned_url`만 넘기면 끝난다고 생각한다

문서 예제 기준으로 오디오는 `reader`에서 바이트를 읽어 base64로 바꿔 모델 입력에 넣는 흐름을 쓴다.  
모델별 input schema 차이를 직접 처리해야 한다.

### 3. update 시 retain 없이 덮어쓴다

기존 attachment 중 유지할 것이 있으면 `retain`을 꼭 명시해야 한다.  
아무 말 없이 update하면 기존 파일이 삭제될 수 있다.

### 4. audio evaluator에 아무 vision model이나 붙인다

2026-06-20 기준 공식 문서에서는 audio attachment evaluator는 structured output까지 가능한 Gemini를 요구한다고 적혀 있다.  
image/PDF와 audio는 제약이 다르다.

### 5. base64를 dataset 영구 포맷으로 삼는다

trace log에서는 base64가 필요할 수 있어도, 장기적으로 재사용할 evaluation dataset은 attachments 쪽이 더 관리하기 쉽다.

## 추천 운영 흐름

개인적으로는 아래 흐름이 가장 무난하다.

1. 멀티모달 입력 파일을 attachments로 붙인 dataset example을 만든다
2. `inputs`에는 질문과 메타데이터만 남긴다
3. target 함수에서 `attachments`를 modality별로 모델 입력으로 변환한다
4. image/PDF는 LLM judge evaluator를 붙이고, audio는 지원 모델 제약을 먼저 확인한다
5. 파일 수정이 생기면 dataset version 단위로 실험을 다시 구분한다

이 정도만 지켜도 LangSmith가 단순 trace 저장소가 아니라 멀티모달 regression test 베이스로 꽤 쓸 만해진다.

## 참고 자료

- [Run an evaluation with multimodal content](https://docs.langchain.com/langsmith/evaluate-with-attachments)
- [How to define a code evaluator](https://docs.langchain.com/langsmith/code-evaluator-sdk)
- [Manage datasets](https://docs.langchain.com/langsmith/manage-datasets)
