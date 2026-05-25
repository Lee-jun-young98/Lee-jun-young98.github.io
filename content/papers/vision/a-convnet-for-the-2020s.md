---
title: "A ConvNet for the 2020s"
date: 2023-12-29
thumbnail: "/papers/assets/notion/a-convnet-for-the-2020s-9634f1932e86.png"
socialImage: "https://lee-jun-young98.github.io/papers/assets/notion/a-convnet-for-the-2020s-9634f1932e86.png"
paper_sync: true
tags:
  - "paper-review"
  - "Vision"
  - "Classification"
  - "Module"
---

---

---

[https://arxiv.org/abs/2201.03545](https://arxiv.org/abs/2201.03545)

# 1. Abstarct

---

- Visual Recognition 분야에서 ViT의 등장으로 활발한 이미지 분류 연구가 시작 됨

- ViT가 Convnet을 대체하기 시작했지만 일반적인 ViT로는 컴퓨터 비전 작업인 객체 감지에서 어려움을 겪고 있음

- 이에 ConvNet의 기본적인 구성 요소를 재도입함으로써 Transformer 계열(Swin Transformer)을 일반적인 Back bone 모델로 사용할 수 있게 만들었음

- 그러나 하이브리드 접근 방식은 Cnn의 강점보다 ViT의 본질적인 우월성에 크게 기인한다고 설명되어 있음

- 이 연구는 ConvNet을 재조명하여 어떠한 성과까지 도달하는지 보고 싶으며, 표준 ResNet을 ViT의 디자인으로 점진적으로 현대화하면서 여러 구성요소를 발견함

- 기존 ConvNet에서 위 실험을 걸쳐 나온 것을 ConvNeXt라 지칭함

- 정확성 및 확장성 측면에서 Transformer 계열 모델과 유리한 경쟁력을 보여주며 COCO 감지 및 ADE20K에서는 Swin Transformer를 앞지름

---

---

# 2. Introduction

---

- NLP에서 RNN을 대체하기 위해 나온 Transformer가 2020년에서는 비전에 도입되면서 2020년에 두 분야가 수렴함

- 큰 모델과 큰 데이터세트의 도움으로 ViT는 ResNet의 성능을 능가함

- 일반적인 ViT 모델은 비전 백본 모델로 채택되기 어렵고 입력 크기에 관해 복잡성을 가지고 있습니다. 이는 ImageNet  분류에는 수용이 가능하지만, 더 높은 해상도 입력에서는 빠르게 처리하기 어려움

- Convnet과 Transformer의 격차를 줄이기 위해 두 방식을 혼합한 “Hierarchical Transformer” 도입

- Sliding Window가 Transformer에 도입되어 Transformer가 Convnet과 유사하게 동작하도록 함

- 이 방법 중 하나인 Swin Transformer는 최첨단 성능을 보여주고 있으며, Cnn의 중요성을 보여줌

- Transformer의 발전은 Convolution을 도입할 때 성능이 향상되지만 많은 비용이 발생하며, 고급 스킬을 사용해 속도를 최적화 할 수는 있지만  정교하게 설계 해야함

- ConvNet은 많은 요구 조건 없이 잘 충족할 수 있음

- Transformer의 우수한 스케일링 때문에 ConvNet과 성능 차이가 발생하며 Multi head self attention이 핵심 구성 요소로 꼽힘

- 본 논문에서는 ConvNets과 Transformers 간의 아키텍처 차이를 조사하고 네트워크 성능 비교 시 혼란을 일으킬 수 있는 변수를 식별하고, ConvNets와 pre-ViT 및 post-ViT의 간극을 줄이고, ConvNet이 어디까지 성과를 낼 수 있는지 검증하는 목적이 있음

- 본 논문에서 제안하는 ConvNeXt는 Imagenet 분류, COCO 객체 감지 및 분할, ADE20K에서 sementic segmentation과 같은 다양한 비전작업에서 평가함

- ConvNeXt는 표준 ConvNet의 효율성을 유지하며 train, test 모두에 대해 convolution 특성을 갖추어 구현이 간단함

---

# 3. Modernizing a ConvNet: a Roadmap

---

- FLOP를 고려하여 약 4.5 × 10^9인 ResNet-50/Swin-T와 약 15.0 × 10^9인 ResNet-200 / Swin-B 범주를 비교

- 간소화를 위해 결과는 ResNet-50 / Swin-T 복잡도 모델로 제시함

- Swin Transformer의 다양한 수준의 디자인을 조사하고 따르면서도 네트워크의 간단함을 표준 ConvNet으로 유지하는 것을 목적으로 함

- 적용한 기술
  - macro design

  - ResNeXt

  - Inverted bottleneck

  - large kernel size

  - various layer-wise micro design

![](/papers/assets/notion/a-convnet-for-the-2020s-9634f1932e86.png)

- attention 기반 모듈을 도입하지 않고 표준 ConvNet(ResNet)을 hierarchical vision Transformer(Swin)으로 현대화 함

- 여러 결과들을 더 할 경우 Swin-T보다 우수한 성능을 보여주는 것을 알 수 있음

---

## 3.1 Training Techniques

---

- ResNets의 훈련 epoch를 90 → 300으로 확장

- AdamW, Mixup, Cutmix, RandAugment, Random Erasing와 같은 데이터 증강 기술 및 Stochastic Depth와 Label smoothing과 같은 정규화 기법을 사용 → 성능 76.1%에서 78.8로 향상

---

## 3.2 Macro Design

---

- Swin-Transformer는 각 stage가 다른 feature map resolution을 가지는 multi-stage design을 사용

- 2가지의 흥미로운 고려사항이 있음 Stage Compute ratio, steam cell이라 불림
  - Changing stage compute ratio
    - 무거운 res4 모델의 경우 객체 감지와 같은 down stream task에 적용할 수 있도록 설계되 어 있으며, detector head operation은 14x14 feature 평면에서 작동함

    - Swin-T는 동일한 원칙을 따르지만 약간 다른 stage compute 비율인 1:13:1을 사용

    - 큰 Swin-T는 1:19:1을 사용

    - 위의 디자인에 따라 Resnet-50 각 스테이지의 블록 수를 (3,4,6,3)에서 (3,3,9,3) 늘림

    - 정확도 78.8% → 79.4% 향상 더 최적의 디자인이 있을 수 도 있음

  - Steam cell을 patchify로 변경
    - 일반적으로 Steam cell은 네트워크의 시작에서 입력 이미지가 어떻게 처리 되는지 알아야 함

    - ConvNet과 Transformer에서 공통적으로 사용하는 steam cell은 입력 이미지를 적절한 feature map 크기로 다운 샘플링 됨

    - 표준 Resnet은 7x7 convolution 2 stride maxpooling을 사용

    - ViT는 kernel 크기를 14, 16으로 변경

    - Resnet의 steam cell을 4x4, stride 4 convolution layer를 사용해 정확도가 79.4%에서 79.5%로 변경 됨

---

## 3.3 ResNeXt-ify

---

- ResNeXt는 일반 ResNet보다 더 나은 FLOPs/accuracy 교환 비율을 가지고 있음 

- ResNeXt는 더 많은 그룹을 사용하고 너비를 확장하라는 원칙을 가지고 있음

- Swin-T와의 동일한 채널 수를 갖게 늘림(64에서 96으로), FLOPs(5.3G) 증가 및 성능이 80.5%로 향상

---

## 3.4 Inverted Bottleneck

---

![](/papers/assets/notion/a-convnet-for-the-2020s-cb5b078fa066.png)

- Transformer의 중요한 디자인 중 하나는 Inverted Bottleneck을 형성한다는 것

- MLP 블록의 숨겨진 차원은 입력 차원의 4배가 넓음

![](/papers/assets/notion/a-convnet-for-the-2020s-1d5e8e6298cb.png)

- a는 ResNeXt block이며, b에서는 Inverted Bottleneck block이고, c에서는 spatial depthwise block을 conv layer위로 올렸음

- 깊이별 Convolution layer의 FLOPs가 증가하더라도 다운샘플링된 residual block의 1x1 convolution layer에서 크게 FLOPs가 감소함 

- 성능이 80.5% → 80.6%로 조금 상승 ResNet-200 / Swin-B에서는 81.9%에서 82.6%로 상승

---

## 3.5 Large Kernel Sizes

---

- ViT의 차별화된 것 중 하나는 각 레이어가 global receptive field를 가질 수 있게 하는 self-attention이 존재

- 과거 Convnet에는 대형  커널이 사용되었지만 현대 GPU에서 효율적인 성능을 내려면 3x3 conv layer를 쌓는 것이 표준이 됨

- Swin Transformer는 self-attention block에 local window를 대입해 적어도 7x7 kernel을 사용했으며, ResNetXt의 커널인 3x3 보다 훨씬 큼. 여기서 대형 크기의 kernel을 다시 검토함

- Moving up depthwise conv layer
  - MSA(Multi-head Self-Attention) 블록은 MLP(Multi-Layer Perceptron) 레이어 앞에 배치

  - 복잡하거나 비효율적인 모듈(MSA, 대형 커널 conv)은 더 작은 채널을 갖고, 효율 적이고 밀도 높은 1x1 레이어가 중요 작업을 수행 → FLOPs를 4.1G로 감소 성능 79.9%로 감소

- Increasing the kernel size
  - 3,5,7,9,11을 포함한 여러 커널 크기에 대해 실험을 진행

  - 네트워크의 성능이 79.9%(3x3)에서 80.6%(7x7)로 증가하면서 네트워크의 FLOPs는 동일함

  - 여러 커널에 대한 실험에서 7x7에서 최대가 됨

  - ResNet-200 Model은 7x7 이후에도 이점이 없음

  - ViT로 구현한 것 중 상당수는 ConvNet으로 구현할 수 있음

---

## 3.6 Micro Design

---

- 미세한 규모의 아키텍처적 차이 조사

- 레이어 수준에서 이루어지며 특정 활성화 함수 및 정규화 레이어 선택에 중점을 둠

- Replacing ReLU with GELU
  - ReLU는 간결성과 선형성 때문에 ConvNets에서 광범위하게 사용 됨

  - 원래 Transformer 논문에서도 사용됨

  - GeLU는 ReLU의 부드러운 변형으로 생각할 수 있으며 BERT, GPT-2, ViTs에서도 사용되고 있음 

  - ConvNet에서는 ReLU를 GeLU로 대체해도 정확도 변경 x (80.6%)

- Fewer Activation Function
  - Transformer와 ResNet block의 차이 중 하나는 Transformer는 더 작은 활성화 함수를 가지고 있음

  - 각 convolution layer에서는 1x1 conv를 포함한 활성화 함수를 추가하는 것이 일반적

  - Figure4에서 나타난 것 처럼 residual 블록에서 모든 GeLU를 제거하고 1x1 레이어 사이에 하나만 남겨 Transformer 불록의 스타일을 복제

  - 성능이 80.6 → 81.3% 0.7% 향상 됨 실제 Swin-T와 비슷한 성능을 가짐

- Fewer Normalization Layer
  - Transformer block은 일반적으로 더 적은 정규화 layer를 가짐

  - 두 개의 BN을 제거해 conv 1x1 layer 앞에 하나의 BN layer만 남김

  - 정확도가 81.4%로 상승해 Swin-T의 결과를 넘어섬

  - 블록당 정규화 레이어가 하나로 Transformer보다 더 적은 정규화 레이어를 가짐

  - 실험적으로 블록의 시작 부분에 추가로 하나의 BN을 추가하는 것이 성능 향상에 없었음

  - spatial depwise block 추가 후 → BN → 1x1 conv 들어가기 전

- Substituting BN with LN
  - BN은 ConvNet에서 모델이 학습 수렴을 향상시키고 과적합을 감소시키는 핵심 구성 요소

  - BN을 대체할 것(GN, WN 등등)은 많지만 BN을 선호함

  - 간단한 Layer Normalization은 Transformer에 사용되어 다양한 응용 시나리오에서 좋은 성능을 보여줌

  - ResNet에서는 BN대신 LN을 대체하면 좋은 성능을 얻을 수 없지만 본 논문에서는 LN을 대체해 사용 후 어려움이 없다는 것을 관찰함

  - 81.4% → 81.5%의 성능이 향상 됨

- Separate downsampling layers
  - Resnet에서는 3x3 convolution과 2stride를 통해 donw sampling을 달성하고 Swin Transformer에서는 각 단계 사이에 별도의 downsampling layer가 추가 됨

  - 2x2 conv layer와 2stride를 통해 변경하였지만 훈련이 발산하게 됨

  - 공간 해상도가 변경되는 곳마다 Linear normalization을 추가할 경우 훈련이 안정화 됨

  - Downsampling layer 전, Stem 뒤, 마지막 global average pooling 뒤에 적용

  - Swin-T의 81.3%보다 높은 82.0%의 성능 향상을 얻음

---

---

# 4. Empirical Evaluations on ImageNet

---

- ConvNeXt-T/S/B/L, Swin-T/S/B/L 유사

1. **ConvNeXt-T:**
  - 채널 (C): (96, 192, 384, 768)

  - 블록 (B): (3, 3, 9, 3)

1. **ConvNeXt-S:**
  - 채널 (C): (96, 192, 384, 768)

  - 블록 (B): (3, 3, 27, 3)

1. **ConvNeXt-B:**
  - 채널 (C): (128, 256, 512, 1024)

  - 블록 (B): (3, 3, 27, 3)

1. **ConvNeXt-L:**
  - 채널 (C): (192, 384, 768, 1536)

  - 블록 (B): (3, 3, 27, 3)

1. **ConvNeXt-XL:**
  - 채널 (C): (256, 512, 1024, 2048)

  - 블록 (B): (3, 3, 27, 3)

---

## 4. 1 Setting

---

- ImageNet-1K 데이터셋 1000개의 Class와 120만 개의 훈련 이미지로 구성

- ImageNet-22K에서 사전 훈련을 진행하고, 그 후에 사전 훈련된 모델을 ImageNet-1K에서 평가

- ImageNet-1K에서 훈련
  - ConvNeXts를 300 epoch 동안 AdamW를 사용하여 훈련 학습률은 4e-3을 설정

  - 20 epoch의 linear warmup 및 cosine decaying schedule afterward 존재

  - batch size 4096, weight decay 0.05

  - Data augmentation은 Mixup, Cutmix, RandAugment, Random Erasing와 같은 일반적인 기법 사용

  - 네트워쿠를 Stochastic Depth 및 Label smoothing으로 정규화 함

  - 초기 값이  1e-6인 Layer scale 적용

  - 더 큰 모델의 과적합을 완화시키기 위해 Exponential Moving Average 사용

- ImageNet-22K에서 사전 훈련
  - ImageNet-22K에서 ConvNeXts를 90 epoch 동안 사전 훈련하며 5 epoch의 warmup을 가짐

- ImageNet-1K에서 Fine tuning
  - ImageNet-22K에서 사전 훈련된 모델을 ImageNet-1K에서 30 epoch 동안 fine tuning 됨

  - AdamW

  - learning rate 5e-5

  - cosine learning rate schedule

  - layer-wise learning rate decay

  - no warm up

  - batch size 512

  - learning rate decay 1e-8

  - 기본 사전훈련 및 fine tuning test는 224 x 224이고 ImageNet-22K 및 ImageNet-1K 사전 훈련된 모델은 384x384

  - ViTs/Swin Transformer와 비교하여 ConvNeXts는 네트워크가 완전 Convolution이라 다양한 해상도에 쉽게 조절이 가능 했음

## 4.2 Result

---

![](/papers/assets/notion/a-convnet-for-the-2020s-b9afd7bf4a6e.png)

![](/papers/assets/notion/a-convnet-for-the-2020s-7895b3f5bb1e.png)

- ConvNeXt는 정확성-연산 Trade off 및 추론 처리량 측면에서 두 강력한 ConvNet 베이스라인과 유리한 이점을 지님

- Swin Transformer에 비해 우수한 성능을 보이며 ConvNeXt-T이 경우 0.8% 이상의 차이가 남

- ConvNeXt는 Shifted window or relative position bias 없이 Swin Transformer와 비교하여 향상된 추론 처리량을 누리고 있음

- 384x384 해상도의 ConvNeXt-B의 성능은 Swin-B보다 0.6% 높은 정확성을 보여주며 추론 처리량이 12.5%보 더 높음

- 해상도가 증가할 수록 Swin-B에 대비해 FLOPs/처리량 우위가 더 커짐

---

## 4.3 Isotropic ConvNeXt vs. ViT

---

- ConvNeXt 블록이 계층적이지 않은 ViT-style 동방향 아키텍처에 적용 가능한지 검사

- 동방향 아키텍처는 Downsampling layer가 없으며 모든 깊이에서 동일한 특징 해상도(예:14x14)를 유지

- ViT-S/B/L과 ConvNeXt-S/B/L을 비교 (384/768/1024)

- 깊이는 매개변수 및 FLOP 수를 일치시키기 위해 18/18/36으로 설정

![](/papers/assets/notion/a-convnet-for-the-2020s-968fb1fcd75f.png)

- ViT와 유사한 성능을 보임

---

# 5. Empirical Evaluation on Downstream Tasks

---

![](/papers/assets/notion/a-convnet-for-the-2020s-749631c9c041.png)

- Object detection and segmentation on COCO
  - COCO 데이터셋에서 ConvNeXt 백본을 사용하여 Mask R-CNN 및 Cascade Mask R-CNN을 fine-tune 진행

  - Swin Transformer를 따라 multi-scale training, AdamW optimizer 및 3x schedule을 사용

  - Table3는 Swin Transformer, ConvNeXt 및 ResNeXt와 같은 전통적인 ConvNet 간의 object detection 및 instance segmentation 결과를 보여줌

  - ConvNeXt는 Swin Transformer와 비슷하거나 더 나은 성능을 보여줌

---

![](/papers/assets/notion/a-convnet-for-the-2020s-bba3577916ea.png)

- Semantic segmentation ADE20K
  - UperNet을 사용하여 ADE20K Semantic segmentation ConvNeXt에서 백본을 평가함

  - 배치 크기가 16인 160K iteration 동안 훈련

  - 다중 스케일 테스트로 검증 mIoU를 보고, ConvNeXt 모델은 다양한 모델 수용력에서 경쟁력 있는 성능을 달성할 수 있음

---

- Remarks on model effciency
  - 동일한 FLOPs 상에서 depthwise cnn 모델은 Dense convolution만 사용하는 ConvNet보다 느리고 더 많은 메모리를 소비하는 것으로 앎

  - ConvNeXt의 추론 처리량은 Swin Transformer의 처리량과 비교 가능하거나 초과함, ConvNeXt를 훈련하는 데는 Swin Transformer를 훈련하는 것보다 더 적은 메모리를 사용

---

---

# 6. Related Work

---

- Hybrid models
  - ViT 이전 및 이후에 모두, 합성곱과 self-attention을 결합한 하이브리드 모델이 연구됨

  - ViT 이전에는 ConvNet에 self-attention/non-local 모듈을 추가해 장거리 종속성을 캡처하는 것이 중점임

- Recent convolution-based approaches
  - local Transformer attention은 dynamic depthwise conv와 동일하다는 것을 보여줌

  - Swin Transformer의 MSA block은 dynamic or reqular depthwise convolution으로 대체되어 Swin Transformer와 유사한 성능을 보임

---

---

# 7. Conclusions

---

- 2020년대에는 Swin Transformer와 같은 계층 구조를 가진 ViT들이 ConvNet을 대체하기 시작함

- 표준 ConvNet의 단순함과 효율성을 유지하면서 ViT와 경쟁할 수 있는 ConvNet 모델을 만듦

- 사람들이 Computer Vision Task에서 convolution의 중요성을 다시 생각할 수 있는 계기를 만들고 싶음

---

**다음과 같은 정리를 염두해 두고 읽자
1. 저자가 뭘 해내고 싶어했는가?**

- 순수한 ConvNet에서 여러 요소를 더해 Swin Transformer와의 비슷한 성능을 내고 싶어함

- Swin Transformer와 동등하거나 좋은 성능을 가진 ConvneXt을 제작하여 Convolution의 우수성과 중요성을 다시 생각하게 만들어줌

**2. 이 연구의 접근에서 중요한 요소는 무엇인가?**

- Swin Transformer와의 비슷한 크기의 ResNet 모델을 제작

- Inverted Bottleneck, Large kernel size 등등 Swin Transformer와의 비슷한 구조를 형성할 수 있게 접근

**3. 당신(논문독자)은 스스로 이 논문을 이용할 수 있는가?**

- 

**4. 당신이 참고하고 싶은 다른 레퍼런스에는 어떤 것이 있는가?**

ResNeXt

[https://arxiv.org/abs/1611.05431](https://arxiv.org/abs/1611.05431)

Swin Transformer

[https://arxiv.org/abs/2103.14030](https://arxiv.org/abs/2103.14030)

ReLU

[https://www.cs.toronto.edu/~fritz/absps/reluICML.pdf](https://www.cs.toronto.edu/~fritz/absps/reluICML.pdf)

GeLU

[https://arxiv.org/pdf/1606.08415.pdf](https://arxiv.org/pdf/1606.08415.pdf)

Stochastic Depth

[https://arxiv.org/abs/1603.09382](https://arxiv.org/abs/1603.09382)

Label Smoothing

[https://arxiv.org/abs/1512.00567](https://arxiv.org/abs/1512.00567)
