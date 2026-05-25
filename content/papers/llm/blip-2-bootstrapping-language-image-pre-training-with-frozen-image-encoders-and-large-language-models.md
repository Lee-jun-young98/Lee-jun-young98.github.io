---
title: "BLIP-2: Bootstrapping Language-Image Pre-training
with Frozen Image Encoders and Large Language Models"
date: 2025-06-10
tags:
  - "paper-review"
  - "MultiModal"
  - "LLM"
  - "Vision-Language"
  - "LLM"
author: "Junnan Li Dongxu Li Silvio Savarese Steven Hoi"
journal: "In PMLR 2023"
notion_id: "20e8d6e1-cee5-80e3-b8ea-c908ee9687c8"
notion_url: "https://www.notion.so/BLIP-2-Bootstrapping-Language-Image-Pre-training-with-Frozen-Image-Encoders-and-Large-Language-Mode-20e8d6e1cee580e3b8eac908ee9687c8"
notion_synced: true
---

---

---

[https://arxiv.org/pdf/2301.12597v3](https://arxiv.org/pdf/2301.12597v3)

![](/assets/notion/blip-2-bootstrapping-language-image-pre-training-with-frozen-image-encoders-and-large-language-models-20e8d6e1cee5.png)

# 0. Abstract

---

- BLIP-2는 Vision-language 모델의 증가하는 학습 비용을 효율적으로 만들기 위해 제안함

- BLIP-2는 경량화한 Querying Transformer를 통해 Vision-Languague를 연결하여 두 단계로 학습함
  - 첫번째 단계: Frozen한 image encoder로부터  vision-language 표현 학습을 bootstraps 함

  - 두번째 단계: Frozen한 language model로부터 vision-to-language 생성 학습을 bootstraps 함

- BLIP2는 상당히 적은 trainable parameters를 가지고 있음

- zero-shot VQAv2에서는 Flamingo80B보다 54배 적은 파라미터를 가지고 있으며 8.7% 더 우수한 성능을 보임

---

---

# 1. Introduction

---

- pass

---

---

# 2. Related Work

---

## 2.1. End-to-end Vision-Language Pre-training

---

- Dual-encoder architecture

- Fusion-encoder architecture

- Encoder-decoder architecture

- unified transformer architecture

## 2.2. Modular Vision-Language Pre-training

---

- 기존에 사전 학습된 모델들을 그대로 활용하면서, 학습 중에는 이 모델들을 frozen 시키는 방식을 사용

- Flamingo는 새로운 cross-attention layers를 LLM에 도입해 visual features를 주입시킴

- BLIP-2는 기존 방법과 달리, 고정된 이미지 인코더와 고정된 LLM을 동시에 효과적이고 효율적으로 활용하여, 더 낮은 계산 비용으로 다양한 비전-언어 작업에서 더 우수한 성능을 달성

---

---

# 3. Method

---

- vision-language 사전학습 방법으로 BLIP-2를 제안함

- 두 모달리티의 차이를 줄이기 위해 Q-former와 두 단계 학습을 제안
  - 1단계: vision-language 표현 학습 stage는 frozen한 image encoder

  - 2단계: vision-to-language 생성 학습 단계는 frozen한 LLM

## 3. 1 Model Architecture

---

![](/assets/notion/blip-2-bootstrapping-language-image-pre-training-with-frozen-image-encoders-and-large-language-models-20e8d6e1cee5.png)

- Image Encoder는 입력 해상도와 무관하게 고정된 수의 image feature를 출력함

- Q-Former는 두 개의 transformer 서브 모듈로 구성되어 있으며 각각의 submodule들은 같은 self-attention layer를 공유함
  1. image transformer: 시각 피처 추출을 위한 frozen image encoder와 상호 작용

  1. text transformer: encoder와 decoder 기능을 둘 다 할 수 있음

- 동작 순서
  1. 학습 가능한 쿼리 임베딩 세트를 만들어 image transformer encoder에 넣음

  1. 쿼리는 각각 self-attention layer를 통해 상호 작용

  1. image features는 cross-attention layer를 통해 모두 다른 transformer block에 삽입

  1. 쿼리는 추가적으로 text와 같은 self-attention layers에 상호 작용함

  1. 사전 훈련 작업에 따라 query - text 상호 작용을 위해 다른 self-attention masks를 적용

- Q-Former는 BERT(base) pretrained와 함께 초기화

- cross-attention layers는 랜덤으로 초기화

- 총 32개의 쿼리를 사용 dimension은 768

## 3.2. Bootstrap Vision-Language Representation Learning from a Frozen Image Encoder

---

- Image-Text Contrastive Learning
  - 이미지 표현(Z)과 텍스트 표현(t)의 mutual information을 극대화
    - 이미지 쪽: Q-Former의 query output(Z)

    - 텍스트 쪽: Text encoder의 [CLS] 토큰 출력(t)

    - Z의 각 query output과 t 사이의 유사도를 계산 → 가장 높은 유사도 사용

- Image-grounded Text Generation(ITG)
  - Q-Former는 이미지에서 정보 추출 → text decoder에 전달

  - 직접 Image encoder와 text token이 상호작용 하지 않기 때문에, 정보 전달은 query를 통해 수행됨

- Image-Text Matching
  - 이미지 - 텍스트 쌍의 정밀한 정합성을 합성

  - 주어진 쌍이 매치되는지 아닌지를 이진 분류로 예측
