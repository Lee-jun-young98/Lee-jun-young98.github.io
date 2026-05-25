---
title: "Swin Transformer: Hierarchical Vision Transformer using Shifted Windows"
date: 2024-02-07
paper_sync: true
tags:
  - "paper-review"
  - "Vision"
  - "Classification"
---

---

---

[https://arxiv.org/abs/2103.14030](https://arxiv.org/abs/2103.14030)

# 1. Abstract

---

- 계층적인 Transformer인 Shifted windows를 사용한 Swin Transformer를 제안

- Shifted Window skill은 cross-window connection은 허용하면서 self attention computation의 중복되지 않는 local window로 제한해 효율성을 높힘

- hierarchical architecture는 유연한 모델 구조를 가지고 image size의 선형 계산을 할 수 있음

---

---

# 2. Introduction

---

![](/assets/notion/swin-transformer-hierarchical-vision-transformer-using-shifted-windows-f489ce43a650.png)

- Swin Transformer는 작은 size의 patch부터 구성되며 Transformer의 layer가 깊어질수록 merging 함

- hierarchical feature map을 사용함으로써, FPN 또는 U-Net과 같은 밀도 예측을 위한 고급 기술을 편리하게 사용함

![](/assets/notion/swin-transformer-hierarchical-vision-transformer-using-shifted-windows-222012629a6d.png)

- Swin Transformer의 핵심 설계 요소 중 하나는 연속적인 self-attention에서의 창 분할 이동이다

- Shifited Windows 이전 레이어와의 연결다리가 됨 → 모델 성능을 강화 시킴

- 창 내의 query patch들은 같은 key를 참조함 → 하드웨어적 접근을 용이하게 함

---

---

# 3. Method

---

![](/assets/notion/swin-transformer-hierarchical-vision-transformer-using-shifted-windows-d0469d50b4ba.png)

## Overall architecture

- 각각의 4x4 patch들에 rgb value를 곱해 4 x 4 x 3 = 48의 feature dimension을 갖게 됨

- hierarchical representation을 위해, 네트워크가 깊어짐에 따라 토큰의 수를 줄이기 위해 patch merging layer를 사용 → 2x2 이웃한 패치 그룹의 기능을 연결하고, 토큰의 수가 2x2 = 4의 배수로 줄어들고 출력 차원을 2C로 설정됨

- 위의 과정을 반복함으로써 해상도의 2배씩 down sampling 후 출력 차원을 늘림 

- Swin Transformer block
  - layer normalization 후에 Multi-head self attention 적용

  - 따라오는 2번째 layer는 layer normalization 후에 MLP 적용(GELU 사용)

## Shifited Window based Self-attention

- Self-attention in non-overlapped windows

![](/assets/notion/swin-transformer-hierarchical-vision-transformer-using-shifted-windows-a3898e3595f0.png)

- Window Multi head Self attention과 Multi head Self attention의 수식 차이

- MxM의 patch로 나눔(M은 거의 7로 고정)

![](/assets/notion/swin-transformer-hierarchical-vision-transformer-using-shifted-windows-5d10ac34c25d.png)

![](/assets/notion/swin-transformer-hierarchical-vision-transformer-using-shifted-windows-5e6ef20f2a47.png)
