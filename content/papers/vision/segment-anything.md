---
title: "Segment-anything"
date: 2023-12-21
thumbnail: "/assets/notion/segment-anything-af6709116fa4.png"
socialImage: "/assets/notion/segment-anything-af6709116fa4.png"
paper_sync: true
tags:
  - "paper-review"
  - "Vision"
  - "Segmentation"
---

---

---

# SAM 모델 논문

---

SAM

[https://arxiv.org/abs/2304.02643](https://arxiv.org/abs/2304.02643)

[https://github.com/facebookresearch/segment-anything](https://github.com/facebookresearch/segment-anything)

Foundation Model

[https://arxiv.org/abs/2108.07258](https://arxiv.org/abs/2108.07258)

ViT(Transfer)

[https://arxiv.org/abs/2010.11929](https://arxiv.org/abs/2010.11929)

Zeroshot(Text-to-generation)

[https://arxiv.org/abs/2102.12092](https://arxiv.org/abs/2102.12092)

Aditya Ramesh, Mikhail Pavlov, Gabriel Goh, Scott Gray, Chelsea
Voss, Alec Radford, Mark Chen, and Ilya Sutskever. Zero-shot textto-image generation. ICML, 2021.

[https://arxiv.org/abs/2111.06377](https://arxiv.org/abs/2111.06377)

---

---

# 1. 목적

---

![](/assets/notion/segment-anything-af6709116fa4.png)

- 10억개 이상의 마스크 데이터셋을 통해 SA-1B 데이터 엔진을 구축

- segmentation task에 prompt 기능

- SAM에 강력한 annotation 기능

- zero-shot transfer 기능

- 위의 기능을 지원하는 foundation model을 구축하는 것이 목적
  - foundation model → 비지도 학습을 통해 훈련된 AI 신경망(label이 지정되지 않은 광범위한 데이터 집합에 관해 훈련된 모델로, 광범위한 다운스트림 작업에 적용할 수 있음) 

---

---

# 2. 요약

---

- 이 모델은 빠르고 신속하게 디자인 되도록 설계되어 있다. 그래서 새로운 이미지나 분야에 zero-shot을 통해 전이될 수 있다.

- 수많은 작업에 관한 능력을 평가하고 그 결과를 찾아낼 때 zero-shot의 성능이 좋았다.

- 종종 이전에 사용된 지도학습의 결과보다 좋았으며, 경쟁력이 있다.

- 10억장의 마스크와 1100만장의 이미지를 사용하여 학습하였다.

---

---

# 3. Introduction

---

- web-scale dataset에 의해 훈련된 LLM 모델은 zero-shot, few-shot 좋은 성능을 보임

- LLM 모델은 훈련 중에 본 것 이외에 작업 및 데이터 분포를 일반화 할 수 있다.

- 이것이 가능하게 한 구성 요소 3가지
  1. task
    - 거대한 양의 데이터를 학습시킨 데이터 엔진 

  1. Model
    - 모델은 유연한 프롬프트를 지원하며 대화형 사용을 인식하기 위해 실시간으로 마스크를 계산해야 하며, 모호성을 인식해야 함

    - 이미지 인코더가 이미지 임베딩을 계산

    - 프롬프트 인코더는 프롬프트를 임베드한 다음 두 정보를 분할 마스크를 예측하는 경량 마스크 디코더에 결합

    - point, 상자 및 마스크 프롬프트에 중점을 두고 있음

    - 모호성을 인식하기 위해 단일 프롬프트에 대해 여러 마스크를 예측하도록 설계

---

---

# 4. Segment Anything Task

---

![](/assets/notion/segment-anything-9985b6069b22.png)

- Task
  - 프롬프트가 주어질 경우 반환하는 마스크가 유효한 분할 마스크인지 확인해야 함

  - 프롬프트가 모호한 경우 여러 개체를 참조할 수 있으며, 일관된 응답을 출력하기 어려워 언어 모델에 기대야 함

  - 출력 결과값에서는 적어도 하나의 합리적인 마스크가 필요함

- Pre-training
  - 모호한 프롬프트의 경우에도 유효한 마스크를 예측하기 위해 데이터 엔진에서 사전에 학습된 훈련된 모델이 효과적인지 확인해야 함

- Zero-shot transfer
  - Pre-trained를 통해 inference시에 모든 프롬프트에 적절하게 응답할 수 있는 능력을 모델에 부여하므로 적절한 프롬프트 엔지니어링을 통해 다운스트림 작업을 해결할 수 있음. → ex) 고양이에 detect box가 있는 경우 모델에 관한 프롬프트를 제공하여 segmentation 기법도 사용할 수 있음

- Releated task
  - interactive segmentation(대화형 분할)

  - edge detection(가장 자리 감지)

  - super pixelization : 고해상도 이미지를 작은 구획으로 분할하여 이미지의 세부 사항을 강조

  - object proposal generation : 이미지나 비디오에서 주요한 객체 또는 물체의 위치를 추천하는 과정

  - foreground segmentation(전경 분할) : 배경이 아닌 물체만 탐지

  - semantic segmentation(의미론적 분할) : 입력된 모든 픽셀에 label을 부여

  - instance segmentation(인스턴스 분할) : 찾은 객체에 번호를 부여

  - panoptic segmentation(모든 것 분할) : 모든 이미지에 label과 번호를 부여

# 5. 구성

---

![](/assets/notion/segment-anything-ed1a39161446.png)

1. Image encoder
  - 고해상도 입력을 처리하기 위해 ViT로 pre-trained된 모델(MAE 기준)을 사용

  - 이미지 인코더는 이미지당 한 번씩 사용

1. prompt encoder
  - sparse(points, boxes, text) 혹은 dense(masks)로 입력을 받음(mask는 Convolution 연산)

  - CLIP의 인코더를 사용하여 각 프롬프트 유형에 학습된 임베딩과 자유 형식 텍스트로 합산된 위치 인코딩으로 점과 상자를 나타냄

3. Mask Decoder

  - Transformer의 decoder 블록을 수정하여 사용

  - 수정된 디코더 블록은 cross-attention과 self-attention 두 가지 방법을 사용해 임베딩 벡터를 업데이트 

  - 두 개의 블록을 실행한 후 이미지 임베딩을 업샘플링하고 MLP는 출력 토큰을 동적 선형 분류기에 매핑하여 각 이미지 위치의 foreground 확률을 계산

  - 이미지 임베딩과 프롬프트 임베딩에 효과적인 성능을 보임

1. Resolving ambiguity
  - 하나의 출력으로 모호한 프롬프트가 제공되면 모델은 여러 개의 유효한 마스크의 평균을 계산

  - 이 문제를 해결하기 위해 단일 프롬프트에 관해 여러 출력 마스크를 예측하도록 모델 수정 → 일반적으로 3개

  - 훈련 중에는 마스크의 최소 손실만 역전파를 수행

  - 마스크 순위를 매기기 위해 모델은 각 마스크에 관한 신뢰도 점수를 예측함

1. Losses and training
  - focal loss와 dice loss 두 가지를 사용해 합친 Compute loss 사용

---

---

- 피부 유형이 밝은 사람들이 과대하게 나타나는 것을 확인

# 6. Zero-Shot Transfer Experiments(5개의 하위 Task)

---

## SAM

- Edge detection 수행

- 모든 것을 분할함(segment everything)

- 감지된 객체 분할(segment detected objects)

- 개념 증명으로 분할

- ViT-H encoder 사용

---

## Zero-shot Single Point Valid Mask Evaluation Task

![](/assets/notion/segment-anything-008ed6f19263.png)

- result : 현재 좋은 모델인 RITM 모델보다 훨씬 더 높게 지속적으로 평가를 하는 것을 관찰 함

- 이러한 결과는 SAM이 단일 지점에서 유효한 마스크를 분할하는 방법을 학습한 것을 확인 

---

## Zero-shot Edge Detection

![](/assets/notion/segment-anything-8241ddf18661.png)

- result : SAM은 edge를 학습하지 않아도 빠르게 edge detection을 수행할 수 있음 

---

## Zero-shot Object Proposals

![](/assets/notion/segment-anything-c5d093c54c8a.png)

- result : medium, large object, rare, common object에 관해 SAM이 ViTDet-H보다 높은 성능을 보인다. SAM은 작은 개체와 빈번한 객체에 관해 ViT보다 성능이 낮다. VitDet-H는 학습을 해서 추론을 했으므로 학습하지 않은 SAM 데이터의 지표가 좋은 것으로 볼 수 있다.

---

## Zero-shot Instance segmentation

![](/assets/notion/segment-anything-6f6a9cc6c774.png)

- result : SAM은 ViTDet보다 뒤떨어져 있지만 실제 시각화 했을 경우 ViTDet보다 마스크의 경계가 더 명확하고 좋은 품질을 가지고 있다는 것을 관찰함. 

---

## Zero-shot Text-to-mask

![](/assets/notion/segment-anything-b9f8b394cf7d.png)

- result : “wheel”과 “beaver tooth grille”과 같은 문구를 기반으로 객체를 분할할 수 있음

- SAM이 올바른 객체를 분할하지 못하는 경우 point를 통해 예측을 수정할 수 있음

---

---

# 정리

---

**1. 저자가 뭘 해내고 싶어했는가? **

  - **학습되지 않은 요소를 prompt 입력 시 모두 detect 할 수 있게 하는 것**

**2. 이 연구의 접근에서 중요한 요소는 무엇인가? **

  - **대량의 pre-trained된 모델을 이용하여 우리가 학습하지 않은 도메인의 지식을 다운스트림을 이용해 찾는 것. Zero-shot learning과 ViT 기반의 이미지 인코더. prompt encoder 와 Decoder는 웹 이미지 상에서 50ms의 속도를 보여줄 만큼 가볍고 빠르다.**

**3. 당신(논문독자)은 스스로 이 논문을 이용할 수 있는가?**

**4. 당신이 참고하고 싶은 다른 레퍼런스에는 어떤 것이 있는가?**

  - Foundation Model

  - Zero shot learning

  - ViT
