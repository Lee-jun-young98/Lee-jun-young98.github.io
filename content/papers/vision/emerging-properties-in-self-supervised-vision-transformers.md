---
title: "Emerging Properties in Self-Supervised Vision Transformers"
date: 2024-12-18
thumbnail: "/assets/notion/emerging-properties-in-self-supervised-vision-transformers-1608d6e1cee5.png"
socialImage: "/assets/notion/emerging-properties-in-self-supervised-vision-transformers-1608d6e1cee5.png"
paper_sync: true
tags:
  - "paper-review"
  - "Vision"
  - "Self-supervised-Learning"
author: "Mathilde Caron, Hugo Touvron, Ishan Misra, Hervé Jégou, Julien Mairal, Piotr Bojanowski, Armand Joulin"
journal: "ICCV 2021.04.29"
---

---

---

[https://arxiv.org/abs/2104.14294](https://arxiv.org/abs/2104.14294)

[https://github.com/facebookresearch/dino](https://github.com/facebookresearch/dino)

**1. 저자가 뭘 해내고 싶어했는가?**

- Self-supervised model을 개발하고 싶어하며, momentum encoder를 이용하여 모델이 스스로 학습하기를 원했음

- ViT 기반 모델과 Convnet 기반 모델을 비교하여 이 논문에서 제안한 “DINO”라는 기법이 ViT와 사용했을 경우 Convnet 기반 모델보다 우수한 성능을 보였다는 것을 입증함

**2. 이 연구의 접근에서 중요한 요소는 무엇인가?**

- Transformer 아키텍처가 자연어 분야에서 성공한 것은 self-supervised pretraining의 활용이였다고 주장하고 Bert의 close procedure나 GPT의 language modeling을 예로 들며 self-supervised를 강조함

- knowdlge distillation 기법과 비슷하게 프로토 타입을 구상했으며 teacher network를 student network의 EMA 모델을 기반으로 구성하여 momentum encoder를 구상함

- 모델의 출력값이 하나로 수렴하거나 모델 차원이 균열되는 것을 막기 위해 centering 기법과 sharpening 기법을 적용하여 방지함

**3. 당신(논문독자)은 스스로 이 논문을 이용할 수 있는가?**

- 

**4. 당신이 참고하고 싶은 다른 레퍼런스에는 어떤 것이 있는가?**

- 

# Abstract

---

- 자기지도학습이 Convolutional networks와 비교하여 Vision Transformer(ViT)에 눈에 띄는 새로운 속성을 제공하는지 질문함

- 자기 지도 방식을 적용하는 것이 특히 효과적인 것 외에도 다른 특징을 관찰함

- 첫번째로 Self-supervised ViT features는 이미지에서 의미론적 분할에 관한 명시적인 정보를 포함하고 있으며, 이 특징은 supervised ViT나 convnext에서는 보이지 않음

- 두번째로, 이 feature는 knn 분류기에 적합하며 small ViT와 함께 ImageNet top-1에서 78.3%를 달성함

- 우리의 연구는 또한 momentum encoder, multi-crop training, small patch ViT를 사용한 것을 강조함

- 우리는 우리가 연구한 간단한 self-supervised method를 구현함 → DINO라 칭함

- self-distillation with no labels → DINO

- DINO와 ViT로 선형평가 Imagenet top-1에서 80.1를 달성함(ViT-Base)

---

---

# 1. Introduction

---

- ViT는 convnet에 비해 많은 컴퓨터 파워, 학습 데이터를 요구하며, 그들의 features는 unique한 특성이 없었음

- 기존의 많은 self-supervised 방법은 convnets과 함께 이미지에서 잠재력을 보여주고 있음

- 일반적으로 유사한 구조를 가지지만 solution 붕괴를 피하거나 성능 향상을 위해 다른 구성요소를 가지고 있음

![](/assets/notion/emerging-properties-in-self-supervised-vision-transformers-1608d6e1cee5.png)

- Self-supervised ViT features는 명백한 장면의 layout과 object boundaries를 가지고 있음

- Self-supervised ViT features는 KNN과 함께 Fine tuning 없이 data augmentaiton 도 없이 linear classifier로 Imagenet에서 top-1 accuracy 78.3%를 달성함

- DINO는 Resnet50 architecture하고도 잘 작동 됨

- ViTs와 Dino는 제한된 컴퓨팅과 메모리 용량에서도 잘 작동됨

---

---

# 2. Related work

---

## Self-supervised Learning

## Self -traning and knowledge distillation

---

---

# 3. Approach

---

## 3.1. SSL with Knowledge Distillation

---

![](/assets/notion/emerging-properties-in-self-supervised-vision-transformers-1608d6e1cee5.png)

![](/assets/notion/emerging-properties-in-self-supervised-vision-transformers-1608d6e1cee5.png)

- student network와 teacher network에서 나온 s1, s2, t1, y2를 temperatrue scaling이 들어간 softmax 함수에 넣어 loss 함수인 H를 최소화 시키게 학습을 함

### Teacher Network

- knowledge distillation과 달리 teacher network를 사전에 정의하지 않음

- 과거의 student network를 활용

- EMA를 사용한 Momentum Encoder가 적합했으며, 다음과 같은 룰을 따름
![](/assets/notion/emerging-properties-in-self-supervised-vision-transformers-ceca7c40b2d1.png)

- 람다는 cosine schedule 0.996부터 1을 따름

- Polyak-Ruppert AVeraging과 유사하게 모델 앙상블 효과를 제공함

### Network architecture

- **Backbone (f)**:
  - ViT (Vision Transformer) 또는 ResNet을 사용.

  - Downstream task에서는 Backbone의 출력 피처를 사용

- **Projection head (h)**:
  - g=h∘fg = h \circ fg=h∘f 구조.

  - 3층 MLP (Multi-Layer Perceptron)로 구성되며
    - 히든 차원: 2048

    - L2 정규화와 가중치 정규화된 완전 연결층으로 구성

    - 출력 차원 (K)은 SwAV [9] 디자인과 유사

### Avoiding collapse

- 모든 출력이 하나의 값으로 수렴하거나, 모든 차원이 균일하게 분포되는 문제

- 센터링(Centering)
  - 특정 차원이 출력에서 지배적이 되는 것을 방지

  - 다만, 모델이 균일한 분포로 붕괴되는 경향을 유발

- 샤프닝(Sharpening)
  - 출력 분포를 날카롭게 만들어 균일 분포로 붕괴되는 것을 방지

- 센터링 + 샤프닝을 통해 모델 붕괴를 방지함

- Momentum Teacher와 함께 사용될 때 안정적으로 작동됨

![](/assets/notion/emerging-properties-in-self-supervised-vision-transformers-1608d6e1cee5.png)

![](/assets/notion/emerging-properties-in-self-supervised-vision-transformers-1608d6e1cee5.png)

- 다른 Batch size에서도 잘 작동됨

---

## 3.2. Implementation and evaluation protocols

---

## Vision Transformer

---

![](/assets/notion/emerging-properties-in-self-supervised-vision-transformers-1608d6e1cee5.png)

- Dino에서는 DeiT를 참고하여 ViT를 구현하였으며, CLS 토근은 시퀀스의 정보를 집계하며, DINO에서는 이를 projection head와 연결해 사용함

## Implementation details

---

### **데이터셋 및 사전 학습**

- **ImageNet 데이터셋** [49]에서 **레이블 없이** 사전 학습 진행

- **모델 예시**: ViT-S/16

### **학습 설정**

- **Optimizer**: AdamW

- **배치 크기**: 1024, 16 GPU에 분산

- **Learning Rate (lr)**:
  - 처음 10 epoch 동안 **선형적으로 증가**(warm-up)

  - Base Learning Rate는 다음 공식을 사용해 결정:

![](/assets/notion/emerging-properties-in-self-supervised-vision-transformers-1608d6e1cee5.png)

  - 이후, **Cosine Decay**를 통해 lr 감소

- **Weight Decay**:
  - 0.04에서 0.4로 **Cosine 스케줄**에 따라 증가.

### **온도 파라미터 (τ\tauτ)**

- **Student (τs\tau_sτs)**: 0.1로 고정.

- **Teacher (τt\tau_tτt)**: 처음 30 epoch 동안 0.04에서 0.07로 **선형 증가**(warm-up)

### **데이터 증강**

- **BYOL의 증강 기법**을 따름:
  - **Color Jittering**

  - **Gaussian Blur**

  - **Solarization**

- **Multi-Crop**:
  - 여러 크기의 패치를 생성해 학습에 사용

  - **Bicubic Interpolation**을 사용해 위치 임베딩을 다양한 스케일에 적응.

## Evaluation protocols

---

- Self-supervised learning에서 사용하는 표준 평가방법
  - Linear Evaluation
    - Frozon features를 사용하여 linear classifier만 학습해서 사용

    - 학습 시 랜덤 crop 및 vertical flip augmentaiton을 사용

    - test시에는 central crop을 사용하여 정확도를 보고함

  - Finetuning
    - 사전 학습된 모델의 가중치를 초기화값으로 사용하여 downsteram 작업에서 모델을 미세 조정

- 평가의 민감성
  - Hyperparameter 민감성
    - Linear Evaluation과 finetuning은 모두 하이퍼파라미터(learning rate)에 따라 성능 차이가 큼

    - 이러한 민감성은 정확도 평가의 일관성을 떨어뜨림

- Weighted Nearest Neighbor(k-NN) 평가
  - 사전 학습된 모델의 특징(feature)을 고정하고, 다운스트림 데이터의 특징을 계산하여 저장

  - 이미지의 특징을 저장된 데이터의 k개의 가장 가까운 특징과 비교
    - → k개의 이웃이 투표(vote)를 통해 레이블을 결정함

  - 장점
    - Hyperparameter 조정 불필요
      - 추가적인 튜닝 없이 평가 가능

    - 데이터 증강 불필요

    - 다운스트림 데이터 세트에 대해 한 번만 패스하면 결과 도출

  - k=20 nn이 대부분의 실험에서 안정적으로 가장 좋은 성능을 보임

---

---

# 4. Main Results

---

## 4.1. Comparing with SSL frameworks on ImageNet

---

### Comparing with the same architecture

![](/assets/notion/emerging-properties-in-self-supervised-vision-transformers-1608d6e1cee5.png)

- Resnet-50과 ViT-S를 비교함

- Dino와 ViT를 같이 사용할 경우 k-nn accuracy 7.9% 증가함

### Comparing across architectures

- ViT의 크기를 키우면 성능이 향상되지만, 패치 크기를 줄이는 것이 큰 영향을 미침

- 패치 크기 감소는 파라미터 수를 추가하지 않으면서도 성능 향상을 가져옴

- 패치 크기 감소로 인해 실행 시간은 단축되지만, 메모리 사용량은 증가함

- ViT-B 8x8 패치로 DINO를 학습한 결과
  - Linear Classification에서 80.1% 정확도 달성

  - k-nn classifier에서는 77.4% 달성

  - 파라미터 수는 10배 적고, 실행 시간은 1.4배 더 빠름

---

## 4.2. Properties of ViT trained with SSL

---

- Nearest neighbor retrieval에 좋은 잠재력을 보여주었으며, 우리는 이 실험을 landmark retrieval과 copy detection task에 더욱 통합한다

### 4.2.1. Nearest neighbor retrieval with DINO ViT

- Image Retrieval
  - Oxford와 Paris image retrieval datasets 사용

  - split 강도에 따라 Medium(M)과 Hard(H)로 나눔

![](/assets/notion/emerging-properties-in-self-supervised-vision-transformers-1608d6e1cee5.png)

  - GLDv2(Google Landmarks v2)를 학습한 DINO가 가장 우수한 성능을 보여줬음

  - Imagenet label로 학습한 성능보다 DINO가 no annotation으로 학습한 것이 우수함

- Copy detection
  - “strong” subset의 INRIA Copydays dataset 사용

![](/assets/notion/emerging-properties-in-self-supervised-vision-transformers-1608d6e1cee5.png)

  - Task는 blur, insertions, print, scan 등등 왜곡된 이미지를 인식하는 것

  - distractor 이미지로 YFCC100M 데이터 세트에서 10k개의 이미지를 무작위로 샘플링하여 사용

  - ViT에서 학습한 특징을 코사인 유사도를 사용하여 복제 탐지에 적용

  - 복제탐지에서 좋은 성능을 보임

---

# 6. Conclusion

---

- self-supervised pre-trained 된 표준 ViT 모델은 잠재력을 보여줌

- 미래에 응용할 수 있는 2가지 특성이 드러남
  - k-nn classification의 feature들은 이미지 검색 작업에서 잠재력을 가짐

  - features 안 scene layout에 관한 정보의 존재들도 weakly supervised 이미지 분할에 이득이 될 수 있음

---

---
