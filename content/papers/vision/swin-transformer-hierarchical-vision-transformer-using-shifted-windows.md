---
title: "Swin Transformer: Hierarchical Vision Transformer using Shifted Windows"
date: 2024-02-07
thumbnail: "/papers/assets/notion/swin-transformer-hierarchical-vision-transformer-using-shifted-windows-f489ce43a650.png"
socialImage: "https://lee-jun-young98.github.io/papers/assets/notion/swin-transformer-hierarchical-vision-transformer-using-shifted-windows-f489ce43a650.png"
tags:
  - "paper-review"
  - "Vision"
  - "Classification"
---

[Paper](https://arxiv.org/abs/2103.14030)

# 한 줄 요약

Swin Transformer는 이미지를 계층적 feature map으로 처리하면서, local window attention과 shifted window를 결합해 CNN backbone처럼 다양한 vision task에 붙일 수 있게 만든 Transformer backbone이다.

![](/papers/assets/notion/swin-transformer-hierarchical-vision-transformer-using-shifted-windows-f489ce43a650.png)

# Introduction

기존 ViT는 이미지를 일정한 patch token으로 나누고 전체 token 간 self-attention을 수행한다. 이 방식은 image classification에서는 강력하지만, object detection이나 segmentation처럼 multi-scale feature가 중요한 dense prediction task에는 바로 쓰기 어렵다.

Swin Transformer의 핵심 문제의식은 두 가지다.

- 이미지 해상도가 커질수록 global self-attention 비용이 급격히 증가한다.
- vision task에서는 CNN처럼 단계별로 해상도는 줄이고 channel은 늘리는 계층적 표현이 필요하다.

그래서 논문은 self-attention을 전체 이미지가 아니라 local window 안에서만 수행하고, layer가 깊어질수록 patch merging으로 feature map의 크기를 줄이는 구조를 제안한다. 이름의 Swin은 Shifted Window에서 온다.

# Related Work

ViT는 Transformer를 vision에 적용한 중요한 출발점이지만, 고정된 해상도의 token sequence를 다루기 때문에 dense prediction backbone으로는 추가 설계가 필요했다. 반면 CNN backbone은 FPN, U-Net 계열 구조와 잘 맞는 hierarchical feature를 제공한다.

Swin Transformer는 이 둘의 장점을 섞는다. Transformer의 attention 기반 표현력은 유지하되, 계산량과 feature pyramid 호환성은 CNN backbone에 가깝게 만든다.

# Method

![](/papers/assets/notion/swin-transformer-hierarchical-vision-transformer-using-shifted-windows-d0469d50b4ba.png)

## Patch Partition과 Patch Merging

입력 이미지는 먼저 작은 patch로 나뉜다. 각 patch는 linear embedding을 거쳐 token이 되고, 이후 stage가 넘어갈 때 patch merging layer가 인접한 patch들을 묶어 spatial resolution을 줄인다.

이 과정은 CNN의 downsampling과 비슷하다. stage가 깊어질수록 feature map은 작아지고 channel dimension은 커진다. 덕분에 classification뿐 아니라 detection, segmentation에서도 backbone feature로 쓰기 좋아진다.

## Window Multi-Head Self-Attention

일반적인 self-attention은 모든 token 쌍을 비교한다. 이미지 크기가 커질수록 비용이 커지는 이유다. Swin Transformer는 feature map을 겹치지 않는 window로 나눈 뒤, 각 window 내부에서만 self-attention을 수행한다.

![](/papers/assets/notion/swin-transformer-hierarchical-vision-transformer-using-shifted-windows-a3898e3595f0.png)

이 방식은 계산량을 이미지 크기에 대해 거의 선형적으로 유지한다. 다만 window 내부에서만 정보가 섞이면 window 사이의 연결이 약해진다.

## Shifted Window

window 사이의 단절을 줄이기 위해 Swin block은 W-MSA와 SW-MSA를 번갈아 사용한다. 첫 block에서는 일반 window partition으로 attention을 수행하고, 다음 block에서는 window 위치를 절반 정도 shift한다.

![](/papers/assets/notion/swin-transformer-hierarchical-vision-transformer-using-shifted-windows-222012629a6d.png)

shift된 window는 이전 layer에서 서로 다른 window에 있던 patch들을 한 window 안에 들어오게 만든다. 즉, 비싼 global attention 없이도 layer를 거치며 window 간 정보가 전달된다.

## Relative Position Bias

Swin Transformer는 attention 계산에 relative position bias를 더한다. 이미지에서는 token의 상대적 위치가 중요하기 때문에, 단순한 content similarity만으로 attention을 계산하는 것보다 spatial prior를 줄 수 있다.

# Experiments

논문은 Swin Transformer를 단일 classification model로만 평가하지 않고, 범용 vision backbone으로 검증한다.

- ImageNet-1K image classification
- COCO object detection 및 instance segmentation
- ADE20K semantic segmentation

이 구성이 중요한 이유는 Swin의 주장이 “classification에서만 좋은 Transformer”가 아니라 “CNN backbone을 대체할 수 있는 general-purpose backbone”이기 때문이다.

# Result

Swin Transformer는 ImageNet-1K classification에서 높은 top-1 accuracy를 기록하고, COCO detection/segmentation과 ADE20K semantic segmentation에서도 강한 성능을 보인다. 특히 hierarchical representation 덕분에 Mask R-CNN, Cascade Mask R-CNN, UPerNet 같은 기존 dense prediction framework에 자연스럽게 붙일 수 있다.

논문의 메시지는 단순하다. Vision Transformer도 local attention, shifted window, patch merging을 잘 설계하면 CNN backbone이 맡던 자리를 대체할 수 있다.

# 한계

- window size와 shift pattern은 사람이 정한 inductive bias라서 task나 resolution에 따라 최적값이 달라질 수 있다.
- global context는 한 번에 보지 않고 여러 layer를 거쳐 전달되므로, 아주 긴 범위의 의존성은 구조적으로 제한될 수 있다.
- 구현이 ViT보다 복잡하다. cyclic shift, attention mask, window partition/reverse 같은 세부 구현을 정확히 맞춰야 한다.

# Takeaway

Swin Transformer를 볼 때 가장 중요한 포인트는 “Transformer를 CNN처럼 쓰기 위한 설계”다. local window attention으로 계산량을 줄이고, shifted window로 window 간 연결을 만들며, patch merging으로 multi-scale feature를 만든다.

Vision backbone 계열 논문을 읽을 때는 Swin을 기준점으로 잡아두면 좋다. 이후 ConvNeXt, Swin V2, DINOv2, SAM 계열을 볼 때도 “이 모델은 feature hierarchy, local/global context, dense prediction 호환성을 어떻게 다루는가?”라는 질문으로 이어갈 수 있다.

# 출처

- [Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030)
- [Official Swin Transformer repository](https://github.com/microsoft/Swin-Transformer)
