---
title: "BAM : Bottleneck Attention Module"
date: 2023-12-21
thumbnail: "/assets/notion/bam-bottleneck-attention-module-eb682a2bc0e6.png"
socialImage: "/assets/notion/bam-bottleneck-attention-module-eb682a2bc0e6.png"
paper_sync: true
tags:
  - "paper-review"
  - "Vision"
  - "Module"
---

[https://arxiv.org/abs/1807.06514](https://arxiv.org/abs/1807.06514)

# 1. Abstract

---

- 강력한 표현 학습을 위해 딥러닝 신경망이 발전

- 간단하고 효과적인 Bottleneck Attention Module을 제안

- channel과 spatial 사이에 두 개의 별도의 separate pathways를 두어 attention map을 추론함

- 우리의 모듈은 계층적 attention을 구성하며, 모델과 함께 end-to-end 방식으로 구성됨

---

---

# 2. Introduction

---

- 좋은 성능을 이끌기 위해서는 강력한 기본 아키텍처를 설계하는 것

- 이전의 성능 향상에는 많은 레이어를 쌓는 것이 있음

- 그 외에도 Wide ResNet 더 많은 채널, 더 많은 컨볼루션을 사용하면 단순히 네트워크를 깊게 만드는 것 보다 좋은 성능을 보임

- PyramidNet처럼 깊은 레이어에 채널 증가, ResNeXt, Xception과 같은 그룹화된 합성곱을 사용하는 최근의 접근 방식은 백본 아키텍처로 최첨단 성능을 보여줌

- 이전의 접근 방식을 떠나 기존 CNN 아키텍처와 쉽게 통합할 수 있도록 만들었으며, attention module을 이용하여 효과적으로 향상시키는 방법을 명시적으로 조사함

- 3D 특징 맵이 주어지면 BAM은 중요한 요소를 강조하는 3d attention map을 생성함

- 3D attetion map을 추론하는 프로세스를 두 개의 스트림으로 분해하여, 계산 및 매개 변수 오버헤드(계산하는 시간)를 크게 감소시킴

![](/assets/notion/bam-bottleneck-attention-module-eb682a2bc0e6.png)

- 모델을 가볍게 설계하여 매개 변수 및 오버헤드를 무시해도 될 정도

- BAM은 각 병목 부분에 배치되며 계층적인 attention map을 가짐

- BAM은 초기 단계에서 배경 텍스처 특징과 같은 저수준 특징을 제거

- 그런 다음 고수준 의미론적인 대상에 중점을 차례차례로 두게 됨

---

---

# 3. 관련 연구

---

## 1. Cross Modal Attention

---

- Multi Modal setting에서 널리 사용되는 기술로 특정 modality가 다른 modality에 의존하여 처리되어야 하는 경우에 유용함

- VQA(시각적 질문 응답) 작업이 잘 알려진 예이다.

- 이미지와 자연어 질문이 주어지면, 작업은 숫자 세기, 대상의 위치 또는 특성 추론과 같은 답을 예측

- 텍스트와 이미지 attention map을 생성하여 양방향 추론을 하는 방법이 있음

---

## 2. Self-Attention

---

- Feature extraction과 attention generation을 종합적으로 학습하는 end to end 방식의 시도들이 있었음

- Residual Attention Networks를 제안하여 중간 특징에 대한 3D attention map을 생성하기 위한 hourglass 모듈을 사용

- 생성된 attention map 덕 분에 label에 대해 robust함을 가지고 있지만, 3D 맵 생성 및 프로세스로 인한 계산 및 매개 변수 부담이 큼

- 채널 간 관계를 활용하기 위해 Squeeze-and-Excitation 모듈 제안

---

## 3. Adaptive modules

---

- 입력에 따라 동적으로 출력을 조절하는 적응형 모듈 사용

- Dynamic Filter Network → 유연성을 위해 입력 기능을 기반으로 컨볼루션 특징을 생성하는 것을 제안

- Spatial Transformer Network는 입력 특징을 사용하여 affine transformations의 초 매개변수를 적응적으로 생성하여 최종적으로 대상 영역의 특징 맵이 잘 정렬되도록 함

- Deformable Convolutional Network는 입력 특징에서 동적으로 생성된 pooling offset을 사용하여 변경 가능한 convolution을 사용하여 관련된 특징만 convolution에 사용

- 위의 접근 방식과 유사학 BAM도 attention mechanism을 통해 동적으로 억제하거나 강조하는 독립적인 적응형 모델임

---

# 3. Bottleneck Attention Module

---

![](/assets/notion/bam-bottleneck-attention-module-b8d58542a2c7.png)

---

## Channel attention barnch

---

- 특징 맵 F에서 전역 평균 풀링을 수행하고 채널 벡터(Fc)를 생성

- 각 채널에서 전역 정보를 인코딩

- 채널 벡터(Fc)에서 채널 간 주의를 추정하기 위해 한 개의 은닉층을 가진 다층 퍼셉트론(MLP)를 사용

- 매개 변수의 부담을 줄이기 위해 은닉층 활성화 크기는 RC/rx1x1로 설정 됨 이후에는 Batch Normalization을 추가하여 공간 분기 출력과의 스케일을 조절함

![](/assets/notion/bam-bottleneck-attention-module-1096d8b20eba.png)

## Spatial attention branch

---

- ResNet이 제안한 “병목 구조”를 채택하여 매개변수와 계산 부담을 모두 절약함

- 구체적으로는 1x1 convolution을 사용해 차원을 축소를 통해 채널 차원을 효과적으로 통합하고 압축함

- 축소 후에는 3x3의 확장된 Convolution 두 개가 적용되어 맥락 정보를 효과적으로 활용

- 마지막으로 특징은 1x1 convolution을 사용해 새로운 R1xHxW spatial attention map으로 축소 됨

- scale 조절을 위해 공간 분기 끝에 Batch Normalization layer가 적용 

![](/assets/notion/bam-bottleneck-attention-module-3b1322055342.png)

- f는 Convolution 연산을 나타내고, BN은 배치 정규화 연산을 나타냄, 각 위의 첨자는 Convolution 크기 필터를 나타내며 채널 축소를 위한 두 개의 1x1 Convolution이 존재 중간 3x3 Convolution은 더 큰 receptive field를 집계하기 위해 적용됨

## Combine two attention branches

---

- 두 주의 분기에서 채널 주의 Mc(F)와 공간 주의 Ms(F)를 획득 한 후, 이들을 결합해 최종 3D의 맵 M(F)를 생성

- 서로 다른 형태의 attention map을 R x C x H x W로 확장함

- 효율적인 gradient의 흐름을 위해 원소별 합을 선택 함 → 추후 실험에서도 원소별 합이 최상의 성능을 나타냄

- 합산 이후 최종 3d attention map에서는 0 ~ 1까지의 범위를 얻기 위해 시그모이드 함수를 사용해 입력 특징 맵 F와 원소별 곱셈되어 원래의 입력 특징 맵과 더해져 특징 맵 F0을 얻

---

# 4. Experiments

---

![](/assets/notion/bam-bottleneck-attention-module-2e2df3922fcd.png)

- (a) : Dilation value가 4, Reduction ratio가 16일 때 가장 낮은 에러율을 보였음(d=4, r=16)

- (b) : 채널 특징맵과 공간 특징맵을 결합할 때 MAX, PROD, SUM 중 SUM이 가장 낮은 error율을 보임

- (c) : BAM이 단순히 병목에 추가하여 깊이를 늘린 것에서 오는 획기적인 개선이 아니라 BAM을 추가하는 것이 더 적은 오버헤드와 단순히 추가 레이어를 붙히는 것보다 좋은 성능을 보임

---

![](/assets/notion/bam-bottleneck-attention-module-0c35b898bffd.png)

- PreResNet을 제외하고 대부분의 경우에서 BAM을 추가하는 것이 더 좋은 정확도를 제공하면서 훨씬 적은 오버헤드를 유발

---

## Classification Results on CIFAR-100, ImageNet-1K

![](/assets/notion/bam-bottleneck-attention-module-78c00b2483b3.png)

- BAM을 더 하는 것은 오버헤드 감소 및 더 좋은 정확도 성능을 보임

- Squeeze and Excitation과 비교할 경우 더 적은 매개 변수로 SE보다 우수한 성능을 보임 하지만 SE보다 훨씬 많은 GFLOPS(초당 GPU 부동 소수점 연산)이 필요함

![](/assets/notion/bam-bottleneck-attention-module-327fa652c785.png)

# 정리를 염두해 두고 읽자 

---

1**. 저자가 뭘 해내고 싶어했는가? **

- Attention 모듈이 이미지 인식 성능 향상에 뛰어난 효과를 보이며, 기존 연구에서는 Convolution을 깊게 쌓거나, 변형된 Convolution을 사용하는 등의 시도를 보임.

- 저자는 Attention 병목 부분에서 이미지 성능 향상을 시도 했으며 채널 게이트와 공간 게이트를 이용하여 성능 향상을 시도하려고 했음

**2. 이 연구의 접근에서 중요한 요소는 무엇인가? **

- 각각의 convolution 연산 스테이지 사이에 BAM(Bottleneck Attention Module)을 추가하여 3D attention map을 생성해 이미지 성능 향상에 도움을 줌

- input tensor를 Channel Gate와 Spatial Gate 두 가지로 나누어 두 Gate에서 나온 값들을 합해 새로운 3D feature map을 생성
  - Channel Gate : Global avg pool을 사용하여 새로운 feature map의 채널 정보를 담당
    - reduction 요소를 추가해 계산에 용이하게 사용

    - 마지막에 Batch Normalizaiton을 추가하여 공간 분기 출력 스케일을 조정함

  - Spatial Gate : 1x1 convolution을 추가하여 파라미터 수를 줄이고 3x3 convolution 필터를 두 가지를 추가해 더 큰 receptive field를 가질 수 있도록 제작

**3. 당신(논문독자)은 스스로 이 논문을 이용할 수 있는가?**

**4. 당신이 참고하고 싶은 다른 레퍼런스에는 어떤 것이 있는가?**

- Squeeze-and-Excitation Networks

[https://arxiv.org/abs/1709.01507](https://arxiv.org/abs/1709.01507)

- Residual Attention Network for Image Classification

[https://arxiv.org/abs/1704.06904](https://arxiv.org/abs/1704.06904)
