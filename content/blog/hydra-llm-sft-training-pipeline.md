---
title: Hydra로 LLM SFT 학습 파이프라인 만들기
description: 모델별로 달라지는 LLM SFT 설정, 전처리, 평가, 산출물 관리를 Hydra와 trainer 구조로 정리한 경험
date: 2026-05-23
tags:
  - llm
  - sft
  - hydra
  - mlops
---

# Hydra로 LLM SFT 학습 파이프라인 만들기

LLM SFT 학습 코드를 운영하다 보면 모델마다 설정이 계속 달라진다. 어떤 모델은 대화형 `messages` 포맷을 요구하고, 어떤 모델은 단일 `text` 포맷이 편하다. LoRA 사용 여부, 4bit 옵션, learning rate, output directory, prompt template, 데이터 경로도 실험마다 바뀐다.

처음에는 이런 값을 코드 안에서 직접 바꾸거나 실행 스크립트마다 관리할 수 있다. 하지만 실험이 늘어나면 어떤 설정으로 학습했는지 추적하기 어렵고, 모델별 전처리 차이가 코드 곳곳에 흩어지며, 학습 결과와 설정 파일을 함께 보관하기도 어려워진다.

이 문제를 줄이기 위해 Hydra 기반 설정 구조와 모델별 trainer 구조를 사용했다.

## 목표

이 프로젝트의 목표는 QA CSV 데이터를 기반으로 LLM SFT 학습을 수행하고, 전처리, 학습, 평가, 결과 업로드까지 하나의 흐름으로 실행하는 것이다.

핵심 구성은 다음과 같다.

- `main_train.py`: 학습 엔트리포인트
- `configs/`: 모델, 학습, 데이터 설정
- `trainer/`: 모델별 trainer 구현
- `preprocessing/`: 모델별 전처리 및 프롬프트 조립
- `metrics/`: ROUGE 기반 평가
- `utils/`: seed, logging, S3/MinIO 유틸

지원 trainer는 `gpt`, `gemma3`, `hyperclovax`처럼 모델 계열별로 나누었다.

## Hydra로 설정 분리하기

Hydra를 사용하면 설정 파일을 기준으로 실행하면서 CLI override로 필요한 값만 바꿀 수 있다.

```bash
python main_train.py \
  --config-path configs \
  --config-name hyperclovax_config_lora \
  training.output_dir=my_run \
  data.csv_path=/absolute/path/to/train.csv
```

자주 바뀌는 값은 다음이다.

- `trainer_type`
- `model.name`
- `data.csv_path`
- `training.output_dir`
- `training.num_epochs`
- `training.batch_size`
- `training.learning_rate`
- `model.use_lora`
- `lora.*`

이렇게 분리하면 실험별 설정을 명확히 남길 수 있고, 같은 코드로 여러 모델을 반복 실험하기 쉬워진다.

## 모델별 전처리 분리하기

LLM SFT에서 은근히 까다로운 부분은 데이터 포맷이다. 같은 QA 데이터라도 모델별로 학습 입력 형식이 다를 수 있다.

예를 들어 GPT 계열은 `text` 학습 포맷을 사용할 수 있고, Gemma3 계열은 대화형 `messages` 포맷이 자연스러울 수 있다. HyperCLOVAX 계열은 대화형 `messages` 포맷과 프로젝트별 prompt module이 필요할 수도 있다.

그래서 `preprocessing/`에 모델별 processor를 두고, trainer에서 필요한 processor를 호출하는 구조가 적합했다. 전처리 책임을 분리하면 trainer는 학습 흐름에 집중할 수 있고, processor는 입력 포맷을 만드는 데 집중할 수 있다.

## Trainer 확장 구조

새로운 모델을 추가할 때는 trainer class를 추가하고 공통 interface를 구현한다.

구현해야 할 흐름은 다음과 같다.

- `prepare_dataset`
- `setup_tokenizer`
- `setup_model`
- `get_training_arguments`
- `create_trainer`
- `post_training_hook`

이 방식의 장점은 새로운 모델을 추가해도 기존 trainer의 동작을 크게 건드리지 않아도 된다는 점이다. 모델별 차이를 trainer와 processor 단위로 격리할 수 있기 때문에 실험 코드가 커져도 구조를 유지하기 쉽다.

## 평가와 산출물 관리

학습 이후에는 ROUGE 기반 평가를 수행하고, 결과물을 S3/MinIO 같은 object storage로 업로드한다.

학습 완료 시 보관해야 하는 산출물은 다음이다.

- 모델 또는 LoRA adapter
- tokenizer
- `trainer_state.json`
- `result.json`
- `train_config.yaml`

중요한 점은 모델 결과만 저장하는 것이 아니라, 어떤 설정으로 학습했는지 함께 저장하는 것이다. 그래야 나중에 성능 차이를 해석할 수 있고, 같은 실험을 재현할 수 있다.

## 배운 점

LLM 학습 파이프라인은 모델 학습 코드만 잘 짜는 것으로 끝나지 않는다. 반복 가능한 실험을 위해서는 설정, 데이터 포맷, 평가, 결과 저장까지 하나의 구조로 묶여야 한다.

Hydra와 trainer abstraction을 사용하면서 얻은 장점은 분명했다.

- 실험 설정을 추적하기 쉬워진다.
- 모델별 차이를 trainer/processor 단위로 분리할 수 있다.
- 새로운 모델을 추가하기 쉬워진다.
- 학습 산출물과 설정을 함께 관리할 수 있다.

## 다음에 개선할 점

앞으로는 공개 가능한 sample QA dataset을 추가하고, trainer별 최소 실행 예제를 정리하고 싶다. 또한 결과 JSON 예시, config validation, MLflow 또는 W&B 연동까지 붙이면 실험 관리 측면에서 더 안정적인 파이프라인이 될 수 있다.

공개 저장소에서는 내부 모델 경로, S3/MinIO endpoint, credential, 비공개 데이터 예시는 반드시 제거해야 한다. 기술 블로그로 정리할 때도 구현 구조와 배운 점 중심으로 쓰는 편이 안전하다.
