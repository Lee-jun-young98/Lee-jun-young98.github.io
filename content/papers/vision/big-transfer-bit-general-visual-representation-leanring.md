---
title: "Big Transfer(BiT): General Visual Representation Leanring"
date: 2023-12-21
thumbnail: "/papers/assets/notion/big-transfer-bit-general-visual-representation-leanring-9d1ecb834ea1.png"
socialImage: "https://lee-jun-young98.github.io/papers/assets/notion/big-transfer-bit-general-visual-representation-leanring-9d1ecb834ea1.png"
paper_sync: true
tags:
  - "paper-review"
  - "Vision"
  - "Classification"
---

---

---

[https://arxiv.org/abs/1912.11370](https://arxiv.org/abs/1912.11370)

[https://github.com/google-research/big_transfer](https://github.com/google-research/big_transfer)

# 1. Abstract

---

- 사전에 훈련된 표현의 전이는 심층 신경망을 훈련할 때 sample 효율성을 향상시키고 하이퍼 파라미터 조정을 쉽게 만들 수 있다.

- 신중히 선택한 구성 요소를 결합하고 간단한 휴리스틱을 사용하여 20개 이상의 데이터세트에서 강력한 성능을 달성했다. BiT는 다양한 데이터 범위에서도 잘 수행되며 ILSVRC-2012 Top-1 정확도 : 87.5, CIFAR-10 99.4%, 19개의 작업에 관한 VTAB(Visual Task Adaption Benchmark)에서 76.3%를 달성했다.

- 작은 데이터셋에서는 클래스 당 10개의 예제를 가진 ILSVRC-2012에서 76.8%, CIFAR-10에서 97.0%를 달성했다.

---

---

# 2. Introduction

---

- 딥러닝은 많은 양의 데이터와 계산이 필요하다.

- 전이 학습은 특정 데이터와 계산을 사전 훈련으로 대체한다.

- 크고 일반적인 데이터세트에서 한번 훈련된 다음 이후의 작업에 대해 초기화하며 더 적은 데이터 포인트와 더 적은 계산으로 위의 문제를 해결할 수 있다.

- 한 번 훈련된 모델을 이용하여 Down stream task에 적은 비용으로 이용할 수 있게 만들었다. ImageNet-21k에서 훈련된 성능 좋은 BiT-M 모델을 공개할 예정이다.

---

---

# 3. Big Transfer

---

- Upstream Pre training
  - ILSVRC-2012, BiT-S, ImageNet-21k로 BiT 모델을 사전학습함

  - Batch normalization은 전이학습에 악영향을 미쳐 그룹 정규화(Group Normalization, GN)와 가중치 표준화(Weight Standardization, WS)을 사용

  - GN과 WS가 결합될 때 ImageNet 및 COCO에서 소배치 훈련의 성능을 향상시킬 수 있음

- Transfer to Downstream Tasks
  - 모든 새로운 작업과 데이터셋 크기에 관해 비용이 많이 드는 하이퍼 파라미터 작업을 피하며, 하나의 하이퍼 파라미터만을 시도

  - 고유한 이미지 해상도와 데이터 포인트 수에 단순한 함수로서 작업에 가장 맞는 중요한 하이퍼 파라미터를 선택하는 휴리스틱 규칙인 “BiT-HyperRule”을 사용

  - 훈련 스케줄 길이, 해상도, 그리고 MixUp 정규화의 사용 여부가 중요하다고 판단

  - Fine-tuning 중에는 표준 데이터 전처리를 사용
    - 정사각형으로 resize

    - 더 작은 랜덤한 사각형으로 자름

    - 훈련 시 이미지를 무작위로 뒤집음(수평)

    - Test에는 고정된 크기의 이미지로 resize함

    - 어떤 작업에서는 수평 뒤집기나 자르기가 레이블이 의미하는 것을 파괴하여 작업을 불가능하게 함

    - 상황에 따라 flip이나 crop을 생략

  - Mixup의 경우 큰 데이터 세트에서는 유용하지 않지만 중간 정도의 데이터 세트에서는 유용함

  - 가중치 감소를 0으로 설정하며, 적절한 스케줄 길이 설정 및 데이터셋에 관해 더 오래 훈련하는 것이 충분한 정규화를 제공함

---

---

# 3. Experiments

---

- BiT-S, BiT-M, BiT-L의 모델을 개발하고 크거나 작은 데이터에서 매우 강력한 성능을 보여줌

## Hyper parameter Details

- Upstream Pre-Training
  - 일반적인 ResNet-v2 아키텍처를 사용하고 모든 BN을 GN으로 대체하고 합성곱 레이어에서 Weight Standardization을 사용

  - Resnet152 x 4 상태로 훈련함

  - Momentum을 가진 SGD를 사용 초기 학습률은 0.9, momentum은 0.9

  - 이미지 전처리 단계에서는 크롭 기술과 224 x 224 이미지 크기 조정 사용

  - BiT-S 및 BiT-M은 각각 90회에 대해 훈련하고, 학습률은 30, 60 및 80회에 대해 10으로 나눔

  - BiT-L의 경우 40회 동안 훈련하고, 학습률은 10, 23, 30 및 37회 후에 감소함

  - 5000개의 최적화 단계에서 linear leanring rate warm-up을 사용하고 학습률을 배치 크기 /256을 함

- Downstream Fine-Tuning
  - 작업에 대해 적응 비용을 낮추고자 어떤 하이퍼파라미터 sweeps도 수행하지 않았으며, 세밀 조정을 위한 BiT-HyperRule을 제시

  - 데이터 세트에 따라 하이퍼파라미터가 고정되어 있으며 schedule, resolution, Mixup 사용 여부는 작업의 이미지 해상도 및 훈련 세트 크기에 따라 달라짐

  - 모든 작업에 대해 초기 학습률이 0.003, 모멘텀이 0.9이며 배치 크기가 512인 SGD 사용

  - 입력 이미지가 96 x 96 픽셀보다 작으면 160x160으로 저장하고 128 x 128 픽셀의 무작위 크롭을 적용, 더 큰 이미지는 448 x 448로 크기를 조정하고 384 x 384 크기의 무작위 크롭을 적

  - 중간 및 대규모 작업(중간 : 라벨 500,000개 미만) 알파가 0.1인 Mix up 사용

## Standard Computer Vision Benchmarks

![](/papers/assets/notion/big-transfer-bit-general-visual-representation-leanring-9d1ecb834ea1.png)

- 왼쪽 사진은 무작위 하위 샘플 5개의 훈련 후의 결과

- 오른쪽 사진은 반지도 학습의 결과

## ObjectNet: Recognition on a “Real-World” Test Set

![](/papers/assets/notion/big-transfer-bit-general-visual-representation-leanring-f9d2f6f812d4.png)

- BiT를 새로운 테스트 전용 ObjectNet 데이터세트에서 평가함

- 313개의 물체 클래스가 있으며 113개는 ILSVRC2012와 중첩

- 더 큰 아키텍처와 더 많은 데이터에서의 사전 훈련이 더 높은 정확도로 이루어진다는 것을 보여주며, 아키텍처와 데이터를 확장하는 것이 25%이상의 정확도 차이를 보여줌

- BiT의 object detection에서는 backbone 모델로 retainnet을 사용

---

---

# 4. Analysis

---

- 모델 용량과 상위 데이터 셋 크기 간의 상호 작용을 조사하여 하위 성능에 미치는 영향을 평가

- BiT 모델 : ResNet-50x1, ResNet-50x3, ResNet-101x1, ResNet-101x3, ResNet-152x4

- 데이터 셋 : ILSVRC-2012, ImageNet-21k, JFT-300M

![](/papers/assets/notion/big-transfer-bit-general-visual-representation-leanring-d8f87c42b003.png)

- 낮은 데이터 환경에서의 BiT 모델 성능 x축은 아키텍처, R은 Resnet의 약자

![](/papers/assets/notion/big-transfer-bit-general-visual-representation-leanring-34d5827a1210.png)

![](/papers/assets/notion/big-transfer-bit-general-visual-representation-leanring-f9bf7953bda1.png)

- 맨 오른쪽 사진에서 낮은 가중치 감쇠로 초기 수렴이 빠를 경우, 최적이 아닌 값을 선택할 수 있음

- 더 높은 가중치 감쇠는 더 느리게 수렴하지만 더 나은 최종 모델을 얻을 수 있음

## Large Batches, Group Normalization, Weight Standardization

![](/papers/assets/notion/big-transfer-bit-general-visual-representation-leanring-eef1e907db95.png)

- Batch normalization은 각 하드웨어 가속기에 있는 이미지 수가 너무 적을 때 성능이 저하됨

- 대안적인 전략으로 모든 가속기에 걸쳐 BN 통계를 누적하는 것
  - 두 가지 단점이 발생
    - 큰 배치에서 BN 통계를 계산하는 것이 일반화에 해가 됨

    - 전역 BN을 사용하면 가속기 간에 많은 집계가 필요하며 상당한 지연을 야기함

- BN에 대한 대안으로 WS와 GN을 사용함

- WS와 GN을 사용할 경우 BN보다 높은 성능을 보임

---

---

# 5. Tuning hyperparameters for transfer

---

- 800개의 훈련 이미지를 사용하여  BiT-L을 40번 세밀 조정하여 무작위로 추출된 하이퍼 파라미터를 사용

- 200개의 이미지로 구성된 검증 세트를 사용하여 각 데이터 세트에 대한 최상의 모델을 선택

- 20번 실험 이후에 포화되고 추가 튜닝은 검증 분할에서 과적합을 초래하는 것으로 나타남

- 선택된 BiT-L 모델을 모든 훈련 및 검증 분할의 연합을 사용하여 재훈련한 후, HyperRule을 사용하여 얻은 76.29%의 점수보다 2.43 높은 78.72%를 얻게 됨

- 초기 학습률은 범위 [10^(-1), 10^(-4)]에서 로그-균등하게 샘플링됨

- 총 업데이트 횟수는 {500, 1000, 2000, 4000, 8000, 16000} 중에서 샘플링됨

- 마지막에서 두 번째 레이어의 드롭아웃 비율은 범위 [0.0, 0.7]에서 균등하게 샘플링됨

- 초기 가중치 값에 대한 가중치 감소는 범위 [10^(-1), 10^(-6)]에서 로그-균등하게 샘플링됨

- MixUp α 매개변수는 {None, 0.05, 0.1, 0.2, 0.4} 중에서 샘플링됨

- 입력 이미지 해상도는 {64, 128, 192, 256, 320, 384} 중에서 샘플링됨

## Object detection experiments

- RetinaNet모델을 사용 

- 5번의 훈련을 반복하고 median performence를 말함

- 30 epoch 동안 256 배치 크기로 훈련하며, 화률적 경사 하강법, 0.08 initial learning rate, 0.9 momentum, 10-4 weight decay를 사용, 16번째 및 22번째 epoch에서 10배로 감소시킴

- 입력 해상도는 1024 x 1024

- random horizontal image flip 사용

---

---

# 정리를 염두해 두고 읽자 

---

1**. 저자가 뭘 해내고 싶어했는가? **

  - 사전에 훈련된 표현의 전이는 심층 신경망을 훈련할 때 sample 효율성을 향상시키고 하이퍼 파라미터 조정을 쉽게 만들 수 있음

  - 입력되는 아키텍처와 데이터 크기에 따라 성능을 확인한 다음 전이 학습을 이용해 Down Stream task에 적용할 경우 어떠한 성능을 보이는 지에 관한 고찰

  - 중간, 큰 데이터셋에서는 augmentation 방법 중 mix up이 큰 효과를 보임

**2. 이 연구의 접근에서 중요한 요소는 무엇인가?  **

  - 큰 아키텍처와 큰 데이터를 이용하여 좋은 성능을 이끌어 낼 수 있음, BN대신 GN과 WS를 사용하여 다중 학습에서의 문제점을 해결하고 성능향상을 이끌어냄

  - 낮은 데이터와 낮은 아키텍처도 전이학습을 이용하여 좋은 성능을 보일 수 있음

**3. 당신(논문독자)은 스스로 이 논문을 이용할 수 있는가?**

**4. 당신이 참고하고 싶은 다른 레퍼런스에는 어떤 것이 있는가?**

- Mixup Augmentation : [Zhang, H., Cisse, M., Dauphin, Y.N., Lopez-Paz, D.: mixup: Beyond empirical risk minimization. In: ICLR (2017)](https://arxiv.org/abs/1710.09412)

- Train Test resolution discrepancy : [**Fixing the train-test resolution discrepancy**](https://arxiv.org/abs/1906.06423)
