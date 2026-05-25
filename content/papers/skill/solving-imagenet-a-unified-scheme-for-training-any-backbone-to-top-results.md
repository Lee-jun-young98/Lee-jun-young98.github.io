---
title: "Solving ImageNet: a Unified Scheme for Training any Backbone to Top Results"
date: 2023-12-21
thumbnail: "/papers/assets/notion/solving-imagenet-a-unified-scheme-for-training-any-backbone-to-top-results-893915037c47.png"
socialImage: "https://lee-jun-young98.github.io/papers/assets/notion/solving-imagenet-a-unified-scheme-for-training-any-backbone-to-top-results-893915037c47.png"
paper_sync: true
tags:
  - "paper-review"
  - "Skill"
  - "Classification"
---

[https://arxiv.org/pdf/2204.03475.pdf](https://arxiv.org/pdf/2204.03475.pdf)

# 1. Abstract

---

- ImageNet은 컴퓨터 비전 모델의 품질을 측정하기 위한 주요 데이터 세트 역할을 한다.

- 본 논문에서는 Image Net에서 Back bone을 통합하여 훈련하기 위한 통합된 방식을 제공

- USI(Unified Scheme for ImageNet)은 조정이 필요 없거나 다른 모델들 사이에서 하이퍼 파라미터 조정을 요구하지 않아 학습에 효과적이다.

- USI는 CNN, Transformers 등등 여러 아키텍처에서 테스트 되었으며, Sota 결과들을 능가

- Speed - Accuracy 파레토 곡선을 따라 가장 효율적인 백본을 식별할 수 있음

# 2. Introduction

---

## 1. 모델 파라미터 기법

- One cycle learning rate scheduling(한 사이클 learning rate scheduling)

- Stronger augmentation (Auto Augment, RandAugment)(강력한 증강 기법)

- Scaling learning rate with batch size(배치 크기를 통합 learning rate 스케일링)

- Exponential-moving average(EMA) 모델 가중치의 이동 평균

- Improved weights average(향상된 가중치 초기화)

- Cutout, Cutmix, Mixup과 같은 이미지 기반 정규화

- drop-path, drop-block과 같은 아키텍처 일반화

- Labelmoothing

- Different Train-Test resolutions

- 더 많은 훈련 기간 동안의 점진적인 이미지 크기 조정

- 더 많은 epochs

- True weight decay

- 대형 배치 크기를 위한 전용 최적화

- 한 모델에 적용한 방식이 다른 모델에 적용할 경우 성능이 낮아지는 경우가 있음

일반적으로 컴퓨터 비전 범주는 ResNet 백본, 모바일 지향, Transformer 및 MLP 네 가지 범주가 있음

![](/papers/assets/notion/solving-imagenet-a-unified-scheme-for-training-any-backbone-to-top-results-893915037c47.png)

- ResNet
  - RMSProp optimizer

  - waterfall learning rate scheduling and EMA로 구성 됨

- Transformer 와 MLP 기반
  - Inductive bias가 존재하지 않으므로 Transformer와 MLP 기반의 모델을 훈련하기가 더 어렵고 덜 안정적임

  - 이러한 모델에 관한 전용 훈련 체계는 더 긴 Epoch, 강력한 Cutmix 및 drop-path regularizations, large weight decay 와 repeated augmentations이 필요

- KD(Knowledge Drillation)은 Teacher model을 사용하여 대상 네트워크(학생 모델)을 훈련에 따라 안내함. 학생은 각 이미지에 관해 실제 레이블과 교사의 예측 모두로부터 감독을 받음, KL-divergence는 학생 모델과 교사 모델 사이의 loss를 측정함.

## 2. 성능 향상 비교

- ResNet 성능 향상 비교 논문

[https://arxiv.org/pdf/2001.06268.pdf](https://arxiv.org/pdf/2001.06268.pdf)

- 본 논문에서는 USI(Unified Scheme for ImageNet)라고 불리는 ImageNet의 경우 모델별로 하이퍼 파라미터 튜닝이나 맞춤형 트릭 없이도 어떤 백본이든 최첨단 결과로 훈련시킬 수 있음 

- USI는 효율적이며 300개의 epoch만 사용하여 좋은 결과를 얻을 수 있음

- AdamW optimizer를 사용할 경우 배치 크기 및 learning rate 조절에 좋은 성능을 보임

- 설정 가능한 배치 사이즈보다 0.8, 0.9 정도 작은 크기를 설정하는 게 좋음

![](/papers/assets/notion/solving-imagenet-a-unified-scheme-for-training-any-backbone-to-top-results-1a33196d1dec.png)

- 모델 훈련 비교

- KD supervision을 추가하면 오버헤드가 발생하고 훈련 속도가 감소함 배치 크기를 증가 시킬수록 KD의 상대적인 오버헤드가 감소하며, 큰 배치 크기를 선호하게 됨

- 모델(정확도 83.9%), KD의 추가 오버헤드로 인해 훈련속도가 감소함
