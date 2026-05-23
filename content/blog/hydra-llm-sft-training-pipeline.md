---
title: Hydra로 LLM SFT 실험 설정을 정리해보며 배운 것
description: LLM SFT 코드를 보면서 Hydra 설정, 모델별 전처리, trainer 구조를 어떻게 나누면 실험을 다시 보기 쉬운지 정리한 공부 노트
date: 2026-05-23
tags:
  - llm
  - sft
  - hydra
  - mlops
---

# Hydra로 LLM SFT 실험 설정을 정리해보며 배운 것

LLM SFT 코드를 정리하다 보니 “학습 코드”보다 더 자주 바뀌는 건 설정이라는 생각이 들었다.  
모델 이름, 데이터 경로, LoRA 사용 여부, 4bit 옵션, learning rate, output directory, prompt template 같은 값들이 실험마다 계속 달라진다.

처음에는 이런 값을 실행 스크립트 안에서 바로 바꾸거나, 모델별 스크립트를 따로 두면 충분하다고 생각했다. 그런데 실험이 늘어나면 어떤 설정으로 학습했는지 추적하기 어렵고, 모델별 전처리 차이가 trainer 코드 안에 섞이기 시작한다.

그래서 이번에는 Hydra 기반 설정 구조와 모델별 trainer 구조를 공부하면서, “나중에 다시 실험을 재현하려면 어떤 정보가 남아 있어야 할까?”를 기준으로 정리해봤다.

## 처음 헷갈린 점

LLM SFT에서 헷갈렸던 부분은 같은 QA 데이터라도 모델마다 입력 형식이 다르다는 점이었다.

- 어떤 모델은 단일 `text` 필드를 그대로 학습 입력으로 받는다.
- 어떤 모델은 `messages` 형태의 대화 포맷을 기대한다.
- 어떤 모델은 prompt template을 별도로 조합해야 한다.
- LoRA, quantization, tokenizer 설정도 모델 계열에 따라 조금씩 다르다.

즉 데이터는 같아 보여도 “학습 가능한 입력”으로 바뀌는 과정은 모델마다 다르다. 이 차이를 trainer 내부에 모두 넣으면 처음에는 편하지만, 모델이 늘어날수록 코드가 금방 복잡해진다.

## Hydra를 쓰는 이유

Hydra를 쓰면 기본 설정 파일을 두고, 실행할 때 필요한 값만 override할 수 있다.

```bash
python main_train.py \
  --config-path configs \
  --config-name hyperclovax_config_lora \
  training.output_dir=my_run \
  data.csv_path=/absolute/path/to/train.csv
```

이 방식에서 좋았던 점은 실험 단위가 비교적 선명해진다는 것이다.

- 이번 실험에서 어떤 모델을 썼는지
- 어떤 데이터 경로를 넣었는지
- learning rate와 batch size는 무엇이었는지
- LoRA를 켰는지
- 결과물이 어디에 저장됐는지

이런 값들이 코드 안에 흩어지지 않고 설정으로 남는다. 실험 결과만 저장하는 게 아니라, 그 결과가 나온 조건까지 같이 저장해야 나중에 비교할 수 있다는 점을 다시 느꼈다.

## 내가 이해한 구조

대략적인 역할은 이렇게 나누는 쪽이 읽기 쉬웠다.

- `main_train.py`: 학습을 시작하는 진입점
- `configs/`: 모델, 데이터, 학습 설정
- `trainer/`: 모델별 학습 흐름
- `preprocessing/`: 모델별 입력 포맷 변환
- `metrics/`: ROUGE 같은 평가 로직
- `utils/`: seed, logging, storage 업로드 같은 공통 기능

여기서 핵심은 trainer가 모든 일을 직접 하지 않게 만드는 것이다. trainer는 학습 흐름을 관리하고, 전처리는 processor가 맡는 식으로 나누면 모델별 차이를 조금 더 견딜 수 있다.

예를 들어 trainer 쪽에서는 다음 단계들이 공통 인터페이스처럼 보일 수 있다.

- `prepare_dataset`
- `setup_tokenizer`
- `setup_model`
- `get_training_arguments`
- `create_trainer`
- `post_training_hook`

새 모델을 추가할 때 기존 trainer를 크게 건드리지 않고, 새 trainer와 processor를 추가하는 방식이 더 안정적이라고 느꼈다.

## 결과물을 같이 남기는 이유

학습이 끝난 뒤에는 모델이나 LoRA adapter만 저장하면 부족하다. 나중에 결과를 해석하려면 다음 정보가 같이 있어야 한다.

- 모델 또는 LoRA adapter
- tokenizer
- `trainer_state.json`
- 평가 결과 JSON
- 실행에 사용한 config

특히 config를 같이 남기는 것이 중요하다. 같은 모델이라도 데이터, epoch, batch size, learning rate가 다르면 결과가 달라지기 때문이다. 결과 파일만 보면 “잘 됐다/안 됐다”는 알 수 있지만, 왜 그런지는 다시 추적하기 어렵다.

## 배운 점

이번 정리를 하면서 LLM 학습 파이프라인은 모델 학습 코드만의 문제가 아니라는 생각이 들었다. 반복 가능한 실험을 만들려면 설정, 전처리, 평가, 결과 저장이 같이 설계되어야 한다.

Hydra는 실험 조건을 분리해서 남기는 데 유용했고, trainer/processor 분리는 모델별 차이를 코드 안에서 덜 섞이게 해줬다. 아직 완성된 구조라기보다는, “실험이 많아질 때 어디가 먼저 복잡해지는지”를 배운 단계에 가깝다.

## 다음에 확인할 것

- 공개 가능한 작은 QA 샘플 데이터셋으로 최소 실행 예제를 만들기
- config validation을 추가해서 누락된 설정을 빨리 발견하기
- 결과 JSON 예시를 정리해서 실험 간 비교가 쉬운 형태로 만들기
- MLflow나 W&B 같은 실험 추적 도구와 연결해보기
