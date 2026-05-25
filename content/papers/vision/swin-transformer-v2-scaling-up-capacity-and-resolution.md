---
title: "Swin Transformer V2: Scaling Up Capacity and Resolution"
date: 2024-02-01
tags:
  - "paper-review"
  - "Vision"
  - "Classification"
notion_id: "33cb03b3-2f1a-413f-b1ae-e34ccef33763"
notion_url: "https://www.notion.so/Swin-Transformer-V2-Scaling-Up-Capacity-and-Resolution-33cb03b32f1a413fb1aee34ccef33763"
notion_synced: true
---

---

---

[https://arxiv.org/abs/2111.09883](https://arxiv.org/abs/2111.09883)

# 1. Abstarct

---

- 컴퓨터 비전 분야의 대규모 비전 모델 훈련에는 3가지 문제가 있음

- 훈련 불안정성, pre-trained 모델과 fine tuning 간의 해상도 차이, 지정된 라벨 데이터 부족이 있음

- 위의 문제를 해결하기 위해 다음과 같은 기술 적용
  1. consine attention과 결합된 residual-post-norm 방법

  1. 저해상도 이미지의 downstream task에 효과적으로 로그공간연속위치편향 방법 사용

  1. 광범위한 라벨 이미지를 줄이기 위해 자기지도 사전 훈련 방법인 SimMIM 사용

- 1536x1536 해상도의 이미지까지 훈련할 수 있으며 여러 분야에서 sota를 달성, 라벨이 지정된 데이터 소비량과 훈랸시간이 40배 더 적음

---

# 2. Swin Transformer V2

---

## Relative position bias

- B ∈ RM2×M2

![](/assets/notion/swin-transformer-v2-scaling-up-capacity-and-resolution-4e258f22f905.png)

- Q, K, V ∈ RM2×d

- d는 query, key dimension을 의미

- M2는 window 패치 수

- swin tramsformer의 상대적인 position의 축은 [-M + 1, M - 1]을 따른다

- Swin - T의 position bias를 적용했을 때(Log-Spaced CPB의 성능이 가장 우수)

![](/assets/notion/swin-transformer-v2-scaling-up-capacity-and-resolution-00a3e157e7f8.png)

## Issures in scaling up model capacity and window resolution

![](/assets/notion/swin-transformer-v2-scaling-up-capacity-and-resolution-02398878f964.png)

![](/assets/notion/swin-transformer-v2-scaling-up-capacity-and-resolution-fa75d0b69596.png)

- 모델 용량을 작은 크기에서 큰 크기로 확장할 때 문제가 발생

- Figure3에서는 훈련이 온전히 완료되지 않는 상황까지 발생함

## Scaling Up Model Capacity

- 바닐라 ViT에서 상속된 Transformer는 각 block의 시작 부분에 정규화 레이어를 사용

- 모델을 확장할 때 깊은 레이어에서 값이 상당히 증가함

- 깊은 레이어에서 커지는 진폭이 훈련의 불안정성을 유발함

![](/assets/notion/swin-transformer-v2-scaling-up-capacity-and-resolution-022c6b5ac458.png)

- SwinV2에서는 Layernormalization을 main branch 뒤에 배치함

- 기존 self-attention의 qurery, keyT의 dot product를 scaled cosine attention으로 접근하여 대체

![](/assets/notion/swin-transformer-v2-scaling-up-capacity-and-resolution-937a5e2e73c0.png)

- Bij는 픽셀 i와 j사이의 상대적인 위치 편향을 나타내며 τ는 학습 가능한 스칼라이며, 각 헤드와 레이어간에 공유되지 않으며 0.01보다 큰 값을 가짐 → 더 자연스러운 attention이 되어 강건한 값을 가짐

## Scaling Up Window Resolution

![](/assets/notion/swin-transformer-v2-scaling-up-capacity-and-resolution-36a6383a69ef.png)

- ReLU 활성화 함수를 사용하는 2개의 레이어로 이루어진 작은 네트워크로 대체

- 메타 네트워크 g는 임의의 상대적 좌표에 대한 편향값을 생성하여, 임의의 다양한 윈도우 크기를 가진 fine tuning에 자연스럽게 전송됨

## Log-spaced coordinates

![](/assets/notion/swin-transformer-v2-scaling-up-capacity-and-resolution-44bb2ce9f60e.png)

- 크기가 다른 window에 전송할 때, 상대적으로 크기가 큰 부분은 외삽 돼야 한다.

- 이 부분을 해결하기 위해 기존의 linear spaced 방법을 제외하고 log-spaced 방법을 사용을 제안함

-  linear : ∆x, ∆y  log : ∆cx, ∆cy

- 선형 공간의 좌표보다 로그 공간의 좌표가 더 작은 규모의 외삽 비율을 가짐

- 표 1을 볼 경우 log spaced continuous position bias가 large 규모의 window size로 갈 경우 좋은 성능을 보임

## Self-Supervised Pre-training

- 큰 모델은 데이터 요구량이 많음, 기존에는 JFT-3B와 같은 방대한 레이블이 달린 데이터를 활용함

- 본 연구에서는 자기지도 사전 훈련 방법인 simMIM을 활용하여 레이블이 달린 데이터에 대한 요구를 완화함

- 이미지의 요구량을 JFT-3B의 1/40에 해당하는 이미지만 사용하고 30억개의 매개변수를 통해 Swin Transformer를 만듦

## Implementation to Save GPU Memory

- Zero-Redundancy Optimizer(ZeRO)는 일반적인 병렬 구조로 구현된 optimizer이며, 모델 파라미터와 optimization 상태를 모든 GPU에 용이하게 해줌

- 30억개의 가중치를 사용할 때 adamW는 48GB의 메모리를 사용하지만 Zero optimizer를 사용할 경우 모델의 매개변수와 해당 최적화 상태가 분할되어 여러 GPU로 분산되어 메모리 소비를 크게 줄일 수 있음, Deep Speed network를 채택하고 실험에서 ZeRO stage-1 옵션을 사용함

- Transformer 안의 feature map들은 많은 GPU 메모리를 사용함, 이것은 이미지와 해상도 크기가 클 때 병목 현상을 일으킴

- Activation check pointing 기술은 memory 사용량을 줄일 수 있지만 훈련 속도는 최대 30퍼 까지 느려짐

- 1,536x1,536 해상도의 이미지와 윈도우 크기가 32x32인 경우에도, 일반적인 A100GPU(40GB 메모리)에서도 비경제적임 → self-attention에서 병목이 발생하며 이것을 완화하기 위해 배치 계산 접근 방식 대신 self-attention 계산을 순차적으로 구현함

---

# 4. Experiments

---

## 1. Tasks and Datasets

- Image Classification : ImageNet-1K 사용

- Object Detection : COCO 사용

- Semantic Segmentation : ADE20K 사용

- Video action classification : Kinetics-400 사용

## 2. Scaling Up Experiments

- Settings for Swin V2-G experiments
  - 192x192 image 해상도에서 pre-trained 해서 train 비용을 줄임

  - 2가지의 단계로 접근하였으며, 첫 번째는 Imagenet 22K에서 self-supervised 방법을 통해 20 epoch로 학습 두 번째는 image classification task에서 30 epoch로 더 학습

- ImageNet-1K image classification result
![](/assets/notion/swin-transformer-v2-scaling-up-capacity-and-resolution-6ec1a96e63e4.png)

  - ImageNet-1K V2 Swin-V2-G가 ViT-G보다 0.7% 높은 성능을 보임

  - ImageNet-1K V1에서는 CoAtNet-7과 0.71 차이가 발생 

  - 기존 SwinV1-B, SwinV1-L보다 SwinV2-B, SwinV2-L이 0.7, 0.4 높음

- CoCo Object detection results
![](/assets/notion/swin-transformer-v2-scaling-up-capacity-and-resolution-903d5bb8e916.png)

  - SwinV2-G model이 COCO object detection과 instance segmentation에서 좋은 결과를 보임

  - SwinV2-G model이 object detection에서도 좋은 효과를 보임

- ADE20K semantic segmentation results
![](/assets/notion/swin-transformer-v2-scaling-up-capacity-and-resolution-43809e90f022.png)

  - 최고 Sota model보다 1.5 높은 mIoU를 보이며, window size를 크게 할수록 추가적인 성능 향상을 얻음

- Kinetics-400 video action classification results
![](/assets/notion/swin-transformer-v2-scaling-up-capacity-and-resolution-35266d2081dd.png)

  - 기존 Top 1- accuracy보다 0.14 성능이 높음

## 3. Ablation Study

### Ablation on res-post-norm and scaled cosine attention

![](/assets/notion/swin-transformer-v2-scaling-up-capacity-and-resolution-7e145c6bffe2.png)

- res-post-norm와, scaled cosine attention은 Tiny, Small, Base에서 성능 향상이 일어났으며 ViT-B에서도 성능 향상이 일어남

- res-post-norm과 scaled cosine attention의 결합이 훈련을 안정화 시킴

### Scaling up window resolution by different approaches

![](/assets/notion/swin-transformer-v2-scaling-up-capacity-and-resolution-4880f18ebc23.png)

- window size scaling을 256x256 size의 pre-trained된 모델에서 3개의 larger size의 다운 스트림 task를 적용할 때 성능표

- 다운 스트림 태스크에 적용할 경우 log cpb를 사용하는 것이 성능이 좋게 나옴

---

# 5. Conclusion

---

- Swin-T를 30억개의 파라미터로 확장하고, 최대 1,536 x 1,536의 해상도의 이미지로 훈련할 수 있음

- 모델의 용량을 확장하기 위해 res-post-norm과 scaled cosine attention, log-spaced continuous relative position bias 접근 방식이 활용됨 → Swin V2라 일컫음

---

**다음과 같은 정리를 염두해 두고 읽자
1. 저자가 뭘 해내고 싶어했는가?
• **훈련 불안정성, pre-trained 모델과 fine tuning 간의 해상도 차이, 지정된 라벨 데이터 부족을 해결하고 싶었음**
2. 이 연구의 접근에서 중요한 요소는 무엇인가?
• 훈련 불안정성을 해결하기 위해 모델 용량을 확장시킴 → res-post-norm과 scaled cosine attention을 도입함**

**• fine tuning 간의 해상도 차이를 극복하기 위해 log-spaced continuous relative position bias를 사용하여 pre-trained된 이미지보다 더 큰 사이즈의 이미지에 적용시킬 수 있었음**

**3. 당신(논문독자)은 스스로 이 논문을 이용할 수 있는가?
• 
4. 당신이 참고하고 싶은 다른 레퍼런스에는 어떤 것이 있는가?
• Swin Transformer**

[https://arxiv.org/abs/2103.14030](https://arxiv.org/abs/2103.14030)

**• ZeRO**

[https://arxiv.org/abs/1910.02054](https://arxiv.org/abs/1910.02054)
