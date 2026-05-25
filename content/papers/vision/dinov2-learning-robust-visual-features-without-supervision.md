---
title: "DINOv2 Learning Robust Visual Features without Supervision"
date: 2024-12-19
thumbnail: "/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1618d6e1cee5.png"
socialImage: "/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1618d6e1cee5.png"
paper_sync: true
tags:
  - "paper-review"
  - "Vision"
  - "Self-supervised-Learning"
author: "Maxime Oquab, Timothée Darcet, Théo Moutakanni, Huy Vo, Marc Szafraniec, Vasil Khalidov, Pierre Fernandez, Daniel Haziza, Francisco Massa, Alaaeldin El-Nouby, Mahmoud Assran, Nicolas Ballas, Wojciech Galuba, Russell Howes, Po-Yao Huang, Shang-Wen Li, Ishan Misra, Michael Rabbat, Vasu Sharma, Gabriel Synnaeve, Hu Xu, Hervé Jegou, Julien Mairal, Patrick Labatut, Armand Joulin, Piotr Bojanowski"
journal: "Meta AI Research Inria 2023. 04. 14"
---

---

---

[https://arxiv.org/abs/2304.07193](https://arxiv.org/abs/2304.07193)

[https://github.com/facebookresearch/dinov2](https://github.com/facebookresearch/dinov2)

[/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.pdf](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.pdf)

**다음과 같은 정리를 염두해 두고 읽자
1. 저자가 뭘 해내고 싶어했는가?**

- 기존 연구인 Dino는 Vision Transformer와 같이 사용할 경우 Self-supervised 분야에서 유의미한 visual features를 뽑아낼 수 있는 것이 증명이 됨

- 저자는 Dino를 이용하여 데이터 세트와 모델 효율적인 측면에서 성능을 이끌어 내고 싶었으며 LVD-142M이라는 데이터 세트를 통해 DINO의 성능 향상을 이끌어냄

**2. 이 연구의 접근에서 중요한 요소는 무엇인가?**

## 1) Self-supervised Leanrning 부분

---

- Self-supervised learning의 성능 향상을 위해 다양한 소스로부터 충분히 깨끗한 데이터로 학습하면 좋은 Visual feature을 얻을 수 있음 → 데이터 세트를 자동으로 구축하는 파이프라인을 제안하며 선별된 데이터를 검색하여 유사한 데이터를 사용해 깨끗한 데이터 세트를 만듦

- Sinkhorn-Knopp centering을 사용해 DINO에서의 centering을 진행함

- 작은 이미지 크기로 학습을 진행하면 작은 객체가 사라질 수 있으므로 224 x 224로 학습을 진행하다 마지막에는 518x518 크기로 학습하여 계산 소요 시간을 줄임

- KoLeo Regularizer 특징들이 배치 내에서 균일하게 분포되도록 함 → 그 후 L2 regularizer를 진행

## 2) 구현 부분

---

- Flash attention을 구현하여 사용함

---

- DINO에서는 긴 시퀀스(224)와 작은 시퀀스(98)을 동시에 처리하기 위해 두 시퀀스를 더한 후 길이 패딩을 만들어줌 그 후 transformer encoder에 넣어 처리함

-  attention 행렬에서 block-diagonal mask를 적용하여 서로 다른 시퀀스 간의 attention이 이루어지지 않도록 함

- 모델의 일부 레이어를 무작위로 건너뛰어 계산 비용과 메모리 사용량을 줄임

- 건너 뛸 때 결과를 마스킹하는 것 대신 드롭된 residuals를 계산에서 아예 건너뛰어 메모리와 계산을 절감함

- drop rate에 비례하여 메모리와 계산 효율성을 절감함

- 배치 차원에서 B 샘플을 랜덤하게 섞고, (1-d) * B 샘플만 계산에 사용

---

- FSDP는 모델 복제본을 여러 GPU에 분할하여 메모리 사용을 줄이는 방식이며, 16GB의 메모리를 여러 GPU에 분할하여 GPU 하나에 의존하지 않고, 전체 GPU 메모리 합계로 모델 크기를 처리함

- gradient를 broadcast하거나 reduce할 때 backbone(주요 모델)에서는 float16으로 사용하며 (MLP head의 gradient는 float32로 축소하여 훈련 불안정을 방지함)

- float32의 DDP 방식에 비해 대략 50%의 통신 비용을 줄임

- PyTorch-FSDP의 혼합 정밀도 방식이 DDP와 auto cast 방식에 비해 대부분 우수하다는 결론을 도출함

---

- 위의 특징들을 사용하여 iBOT에 비해 2배의 처리속도를 사용하며, 1/3의 메모리 사용량을 가짐

**3. 당신(논문독자)은 스스로 이 논문을 이용할 수 있는가?**

- 

**4. 당신이 참고하고 싶은 다른 레퍼런스에는 어떤 것이 있는가?**

- Jinghao Zhou, Chen Wei, Huiyu Wang, Wei Shen, Cihang Xie, Alan Yuille, and Tao Kong. ibot: Image bert pre-training with online tokenizer. In ICLR, 2022a.

# Abstarct

---

- 많은 양의 데이터로 학습한 foundation 모델들은 이미지 분포와 작업 전반에 걸쳐 미세 조정 없이 작동하는 범용 시각적 특징을 생성함으로써 모든 시스템에서 이미지 사용을 크게 간소화할 수 있음

- 기존 사전학습 방법, 특히 자기주도 방법이 다양한 소스로부터 충분히 깨끗한 데이터로 학습하면 이러한 특징을 생성할 수 있을 것 처럼 보여줌

- 우리는 전용 및 다양한 데이터세트에서 선별된 이미지 데이터세트를 구축하는 자동화된 파이프라인을 제안함

- ViT 모델을 학습시키고 Open-CLIP을 상회하는 성능을 보여줌

---

---

# 1. Introduction

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1618d6e1cee5.png)

- 이 연구에서, 우리는 정제된 많은 양의 데이터로 사전 학습할 경우 범용 시각적(general-purpose) feature를 학습하는 것이 self-supervised learning에서 잠재력을 갖는지 살펴봄

- 우리는 기존에 식별한 image와 patch 레벨에서 학습한 자기지도 접근을 탐색했으며, 더 큰 데이터 세트 관점에서 그들의 디자인을 선택하는 것을 고려함

- 대부분의 기술기여는 model과 데이터 크기를 확장할 때 식별할 수 있는 self-supervised learning이 안정과 가속하는 쪽으로 만듦

- 사전학습한 데이터에 관하여, 우리는 방대한 양의 비정제 이미지로부터 데이터셋과 필터를 재조정하여 자동화된 파이프라인을 구축함

- 야생에서 이미지를 다루는 것이 주요한 어려움은 컨셉을 재조정하는 것과 몇 가지 지배적인 컨셉을 피하는 것임 

- 이 연구에서, 단순한 클러스터링 접근이 이 문제를 해결하는데 잘 작동됨

- 우리는 작지만 다양한 코퍼스 142M 장의 데이터를 우리의 접근을 검증하기 위해 모았음

- 마지막으로, Dinov2라 불리는 다양한 사전학습된 비전 모델을 제공함

- Dinov2의 성능을 여러 컴퓨터 비전 태스크에서 검증함

- 우리는 자기지도 학습만으로도 공개에서 최고로 가능한 weakly-supervised models과 경쟁할 수 있는 전이가능한 고정된 features가 좋은 후보자가 될 수 있다고 결론지음

---

# 2. Related Work

---

pass

---

---

# 3. Data Processing

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1628d6e1cee5.png)

- 우리는 방대한 비선별 데이터 중에서 몇몇의 선별된 데이터세트와 유사한 이미지를 검색해 선별된 LVD-142M 데이터세트를 조립함

- 우리는 데이터 파이프 라인의 주요 구성요소를 아래에서 설명하며, 이것은 선별된/비선별된 데이터 소스를 포함하며, 이미지 중복제거와 검색 시스템이 포함됨

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1628d6e1cee5.png)

## Deduplication

---

- 우리는 Pizzi 등(2022)의 복제 탐지 파이프라인을 비선별 데이터에 적용하여 유사 중복 이미지를 제거함

- 이는 이미지 간의 중복성을 줄이고 다양성을 증가시킴

- 또한, 이 연구에서 사용된 모든 벤치마크의 테스트 또는 검증 세트에 포함된 이미지와 유사한 중복 이미지도 제거함

---

## Self-supervised image retrieval

---

- 첫번째로, Imagenet-22k에서 학습한 self-supervised ViT-H/16을 이용한 image embedding으로 계산함, 그리고 이미지 사이에서 코사인 유사도를 사용하여 거리를 측정함

- 그 다음, 비선별된 데이터에 k-means clustering을 진행함

- 검색을 위한 쿼리 데이터세트가 주어지고 그 데이터세트가 충분히 크면 각 쿼리 이미지에 대해 4 nearest neighbors를 진행

- 만약 데이터세트가 작다면, 각 쿼리 이미지에 해당하는 클러스터에서 m개의 이미지를 샘플링함

- 시각적인 검토에서는 N이 4보다 훨씬 클 때 좋은 검색 품질을 보였지만, 이는 더 많은 충돌을 가짐

---

---

# 4. Discriminative Self-supervised Pre-training

---

- 우리는 센터링된 SwAV와 함께 DINO와 iBOT losses의 조합으로 볼 수 있는 차별화된 self-supervised method와 함께 우리의 features를 학습함

- 우리는 feature를 분산시키기 위한 정규화항을 추가하고, 빠른 고해상도 학습 단계를 추가함

---

## Image-level objective

---

- Student network와 Teacher network에서 추출된 특징들 간의 cross entropy를 사용

- 두 특징은 ViT의 클래스 토큰에서 오며, 같은 이미지에서 다른 crop들을 통해 얻어진 특징임
→ 이미지의 서로 다른 부분에서 추출된 특징이 사용됨

- student class token을 student dino head를 통해 전달하며, 이 head는 MLP 모델로 점수 벡터를 출력함 → “**prototype scores**”라 부르며 각 클래스에 대한 점수나 확률 분포를 나타냄

- 이후 softmax 함수를 적용하여  ps라는 점수 분포를 얻음

- 마찬가지로, Teacher DINO head를 Teahcer class token에 적용하여 “**teacher prototype scores**”을 얻음

- 이후, softmax와 moving average와 함께 centering을 적용하여 pt를 얻음

- 그 다음에는 다음과 같은 loss term을 구함

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1628d6e1cee5.png)

- student network의 parameter는 학습하고, teacher head는 과거 반복의 EMA을 사용하여 구축함

---

## Patch-level objective

---

- student network에서 주어진 입력 패치 중 일부를 무작위로 마스크함, teacher network에서는 마스크 적용 x

- student iBOT head를 student의 mask된 토큰에 적용, iBOT head를 입력을 받아서 feature을 추출하고 이 특징을 기반으로 손실을 계산함

- 마찬가지로, teacher iBOT head를 teacher network에서 마스크되지 않은 패치 토큰에 적용, 이 패치들은 student network에서 마스크된 토큰과 일치하는 위치의 패치들임

- 그 후, softmax와 centering 단계를 위에서 설명한 대로 적용하여 iBOT Loss term을 얻음

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1628d6e1cee5.png)

- i는 마스크된 토큰에 해당하는 패치의 인덱스

- student network의 parameter를 학습하고, teacher network는 EMA를 사용하여 업데이트

---

## Untying head weights both objectives

---

- DINO와 iBOT loss는 학습 가능한 MLP projection head를 사용하며, 이 헤드는 출력 토큰에 적용됨

- ablation study에 따르면 DINO와 iBOT 헤드 간 파라미터를 공유하면 성능이 향상된다고 하지만, 대규모 학습에서는 그 반대의 결과가 관찰되어, 두 개의 별도의 헤드를 사용함

---

## Sinkhorn-Knopp centering

---

- Sinkhorn-Knopp 중심화 기법을 사용하며, DINO와 iBOT의 teacher network의 softmax centering 단계를 Sinkhorn-Knopp(SK) 배치 정규화로 교체할 것을 권장함 이는 SwAV에 쓰는 기법임

- Sinkhorn-Knopp 알고리즘의 단계를 3번 반복하여 실행함

- student network에서는 softmax 정규화를 적용

---

## KoLeo Regularizer

---

- Kozachenko-Leonenko differential entropy estimator에서 유래한 정규화 기법

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1628d6e1cee5.png)

- 특징들이 배치 내에서 균일하게 분포되도록하여, 모델이 특징들의 다양성을 잘 포착할 수 있게 함

- 이 정규화 전에 l2 regularizer를 먼저 진행

---

## Adapting the resolution

---

- 이미지 해상도 증가는 픽셀 수준의 다운스트림 작업(segmentation, detection)에서 매우 중요하며함 → 작은 객체들은 낮은 해상도에서 사라질 수 있기 때문

- 고해상도로 학습하는 것은 시간과 메모리 측면에서 매우 많이 소모되며 이를 해결하기 위해 훈련 마지막 부분만 518 x 518로 증가 시킴

- UniViT훈련과 FlexiViT 훈련과 유사함

---

# 5. Efficient implementation

---

- iBOT 구현과 비교하여, Dinov2 코드는 동일한 하드웨어 환경에서 약 2배 빠르게 실행 되며, 메모리 사용량은 1/3로 감소함

## Fast and memory-efficient attention

---

- Flash attention의 자체 구현을 통해 self-attention layer의 메모리 사용량과 속도를 개선함

- 원본보다 동등하거나 더 나은 성능을 보임

- GPU 하드웨어의 특성에 따라, 헤드당 임베딩 차원이 64의 배수일 때 가장 효율적이며, 전체 임베딩 차원이 256의 배수일 때 행렬 연산이 더 효율적이라고 설명됨

- ViT/G 아키텍처로 바꾸고 연산 효율성을 극대화 하기 위해 1536의 임베딩 차원과 24개의 헤드(64dim/head)를 사용

---

## Sequence packing

---

- DINO에서는 큰 크롭(해상도 224)와 작은 크롭(해상도 98)을 동시에 처리해야 하는데, 이 두 그룹은 패치로 분할되면 토큰 시퀀스의 길이가 다르므로 시퀀스 패킹 기법을 사용

- 두 시퀀스를 하나의  긴 시퀀스로 연결하여, 하나의 긴 시퀀스로 변환한 뒤 이를 transformer 블록을 통해 처리함

- 이렇게 처리하여 자체 attention 행렬에서 block-diagonal mask를 적용하여 서로 다른 시퀀스 간의 attention이 이루어지지 않도록 함

---

## Efficient stochastic depth

---

- 모델의 일부 레이어를 무작위로 건너뛰어 계산 비용과 메모리 사용량을 줄임

- 건너 뛸 때 결과를 마스킹하는 것 대신 드롭된 residuals를 계산에서 아예 건너뛰어 메모리와 계산을 절감함

- drop rate에 비례하여 메모리와 계산 효율성을 절감함

- 배치 차원에서 B 샘플을 랜덤하게 섞고, (1-d) * B 샘플만 계산에 사용

---

# Fully-Sharded Data Parallel(FSDP)

---

- AdamW optimizer를 사용하여 minimize 하려면, 모델 복제본 4개(student, teacher, optimizer first moments, optimizer second moments)가 필요 float32개의 정밀도로 저장

- 10억개의 parameter를 가진 ViT-g 모델의 경우, 16GB의 메모리가 필요함

- FSDP는 모델 복제본을 여러 GPU에 분할하여 메모리 사용을 줄이는 방식이며, 16GB의 메모리를 여러 GPU에 분할하여 GPU 하나에 의존하지 않고, 전체 GPU 메모리 합계로 모델 크기를 처리함

- gradient를 broadcast하거나 reduce할 때 backbone(주요 모델)에서는 float16으로 사용하며 (MLP head의 gradient는 float32로 축소하여 훈련 불안정을 방지함)

- float32의 DDP 방식에 비해 대략 50%의 통신 비용을 줄임

- PyTorch-FSDP의 혼합 정밀도 방식이 DDP와 auto cast 방식에 비해 대부분 우수하다는 결론을 도출함

---

---

# 6. Ablation Studies

---

- 우리는 우리의 파이프라인이 다른 구성요소를 실적으로 평가하기 위한 일련의 ablations를 소개함

## 6.1 Improved Training Recipe

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- linear 지표는 knn 지표의 하한선을 나타내는 것으로 사용

- LayerScale, Stochastic Depth는 linear probe에서 성능하락을 일으킴
→ training time에서 nan loss value를 피할 수 있는 이점이 있음

- 성능 하락에도 layer scale과 stochastic depth를 사용하여 다음에 성능 향상을 일으킴

---

## 6.2 Pretraining Data Source

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- iBOT에서 사용된 INET-22k 데이터 세트와 LVD-142M 데이터 세트를 비교함

- 같은 iterations을 사용했고 마지막 학습에 high-resolution adaption을 적용하지 않음

- LVD-142M 데이터세트는 INet-1k에서 성능을 유지하면서 다른 데이터 세트에서 성능 향상을 이끎

## 6.3 Model Size and Data

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- 모델 크기가 커질 수록 LVD-142M에서 학습하는 것이 유리함

## 6.4 Loss Components

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- KoLEO loss는 다른 평가지표에 부정적인 영향을 끼치지 않고 Oxford-M에서 8퍼 상승

- MIM에는 ADE-20K에서 3퍼 상승

## 6.5 Impact of Knowledge Distillation

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- 소형 모델이 대형 모델에서 distill을 사용할 경우 성능 향상이 좋음

## 6.6 Impact of Resolution

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- 사전학습에서 해상도 변경이 영향을 미치는 것을 보기 위해 진행

- 처음에 224 x 224로 학습하다가 마지막 10k 반복동안 416x416으로 전환해서 학습할 경우 계산량을 줄이면서 거의 동일한 성능을 달성할 수 있음

---

---

# 7. Results

---

## 7. 1 ImageNet Classification

---

### How far are we from weakly-supervised models?

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- weakly supervised 모델인 OpenCLIP ViT-G/14, EVA-CLIP ViT-g/14보다 DINOv2 ViT-g/14 모델이 성능이 좋음

---

### Can we finetune the encoders?

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- DINOv2는 linear와 finetuning setting에서 둘 다 강력한 특징을 이끎

- 우리의 접근의 주요점은 finetuning은 optional하다는 것

### Robustness analysis

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- Imagenet 1k에서 선형 분류 헤드를 사용해 학습된 모델을 도메인 일반화 벤치파크에서 평가함

- iBOT 모델과 비교 했을 때 A에서 29.6%, B에서 22.1%, Sketch에서 23.0% 향상을 보임

- Weakly supervised model보다 A와 C에서 앞서고 있으며 R과 Sketch 분야에서는 뒤처짐

---

## 7.2 Additional Image and Video classification Benchmarks

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- iNat에서 OpenCLIP보다 우수한 성능을 보였고, 특히 비디오 classification 데이터 세트에서 Self-supervised 학습 방법으로 뛰어난 성능을 기록함

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

---

## 7.3 Instance Recognition

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

---

## 7.4 Dense Recognition Tasks

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- Linear: 낮은 해상도의 logit map을 생성한 후 이것을 upsampling하여 전체 해상도 (512x512)로 변환하여 segmentation map을 얻음 → 고해상도 segmentation을 쉽게 생성할 수 없음

- +ms: linear 버전에 추가, 마지막 4개의 layer에 patch token에 집중했으며, 이미지 해상도를 640보다 크게 사용, multi scale test-time augmentations을 예측 확률 향상을 위해 사용

- MAE(Upernet decoder)를 사용한 모델과 성능이 비슷했으며, Pascal VOC의 sota 모델과 거의 맞먹는 성능을 보임

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- Fronzen 된 Transformer의 마지막 layer에서 feature를 추출하고, 각 patch token에 CLS 토큰을 결합

- 그 다음, Token을 4배 non-linear upsampling하여 해상도를 증가시킴

- 이후, 256개의 균일하게 분포된 깊이 예측 범위에 대해 분류 손실을 사용하여 간단한 선형 레이어를 학습함

- ViT-S/B에서는 {3, 6, 9, 12} 레이어, ViT-L에서는 {5, 12, 18, 24} 레이어, ViT-G에서는 {10, 20, 30, 40} 레이어에서 토큰을 결합함

- DPT 디코더를 동결된 모델 위에 적용하고, 회귀로 설정하여 학습, 특징 차원에 맞춰 헤드 크기를 조정함

- Frozen된 Transformer backbone과 DPT 디코더를 결합한 모델이 기존의 최신 모델을 능가하는 성능을 보임

---

## 7.5 Qualitative Results

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- DINOv2 backbone을 사용한 linear segmentation model은 Open CLIP backbone 모델에 비해 훨씬 더 나은 결과를 보여줌

- Open CLIP-G에서는 여러 artifacts와 disconnected components를 포함함

- 깊이 추정 정성적 결과는 DINOv2와 OpenCLIP 간의 정량적 성능 차이를 명확히 보여주며, 두 모델 모두 깊이와 같은 복잡한 정보를 선형적으로 분리할 수 있지만, DINOv2의 특징은 OpenCLIP보다 훨씬 더 매끄러운 깊이 추정 결과를 제공함

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- 동물 사진이나 그림과 같은 out-of-distribution examples에 대해 DINOv2의 선형 분류기가 생성한 깊이와 segmentation 예측 결과가 매우 우수함

- 훈련되지 않은 새로운 도메인에서도 높은 수준의 성능을 유지할 수 있음을 보여줌

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- Patch features에 PCA를 적용하고, 첫 번째 주성분의 값을 기준으로 임계값을 설정함

- 이 과정에서 양수 값만 유지하며 주요 객체(전경)과 배경을 분리함

- 전경 패치만 남긴 후, 동일한 카테고리를 묘사하는 세 이미지에서 PCA를 다시 수행

- 세가지 주성분을 다른 색으로 표현

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- 이전 실험에서 사용된 PCA 기반 방법으로 이미지의 전경 객체를 탐지

- 두 이미지에서 추출한 패치 특징 간의 Euclidean Distance를 계산

- 매칭 알고리즘을 적용해 두 이미지 간의 assignment problem을 해결함

- 이로 인해, 각 패치가 가장 유사한 패치와 매칭됨

- 너무 많은 매칭이 생성되는 것을 방지하기 위해, Non-Maximum Suppression을 적용하여 중요한 매칭만 남김

---

---

# 8. Fairness and Bias Analysis

---

모델 공정성 확인을 위해 두 가지를 수행

- Geographical Fairness

- Potential Harmful Label Associations

---

## 8.1 Geographical Fairness

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- 모델이 Europe 중심적이고 고소득 가구에 유리한 성능을 보임

- 이전 모델들에 비해 공정성이 개선되었지만 여전히 지역 및 소득 간 편향이 크게 남아있음

---

## 8.2. Gender, Skintones and Age

---

![](/assets/notion/dinov2-learning-robust-visual-features-without-supervision-1668d6e1cee5.png)

- SEER 모델 대비 성별, 피부색, 연령에 더 균등한 분류 성능을 보임

- 하지만 배경에 감옥의 쇠창살처럼 보이는 요소가 있을 경우 두 가지 사례에서 예외가 발생했음

- Possibly-Human 클래스를 자주 예측하는 경향을 보이며, Beard 클래스의 존재로 인해 남성 이미지를 Possibly-Human으로 분류하는 경우가 많음

---

# 9. Estimating the Environmental Impact of Training our Models

---

- Visual Feature만 훈련하는 경우, self-supervised learning 모델인 Dinov2가 OpenCLIP ViT-G에 비해 에너지 소비가 10배 적고 탄소 배출이 더 적음

- Text-guided 모델을 사용할 경우 더 높은 탄소 배출을 감소하더라도 여전히 의미가 있을 수 있음

---

---

# 10. Future work and Discussion

---

- DINOv2라는 새로운 시리즈의 이미지 인코더를 제시 → supervision label 없이 정재된 데이터로 pretrained 함

- 첫번째 SSL에 대한 작업으로, 다양한 벤치마크에서 weakly supervised 학습 대안들과 성능 격차를 줄이고, 파인튜닝 없이도 visual features를 얻을 수 있게 됨

- 더 큰 모델과 data scale에서 attribute들이 많이 나타날 것으로 기대하며, 이렇게 계속 확장할 계획임

---

---
