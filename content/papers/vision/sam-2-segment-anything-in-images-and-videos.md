---
title: "SAM 2: Segment Anything in Images and Videos"
date: 2024-11-26
tags:
  - "paper-review"
  - "Vision"
  - "Segmentation"
author: "Nikhila Ravi∗,†, Valentin Gabeur∗, Yuan-Ting Hu∗, Ronghang Hu∗, Chaitanya Ryali∗, Tengyu Ma∗,
Haitham Khedr∗, Roman Rädle∗, Chloe Rolland, Laura Gustafson, Eric Mintun, Junting Pan, Kalyan
Vasudev Alwala, Nicolas Carion, Chao-YuanWu, Ross Girshick, Piotr Dollár†, Christoph Feichtenhofer∗,†"
journal: "Meta FAIR 2024.07.29"
notion_id: "14a8d6e1-cee5-80c7-b91e-ce8d0921ea93"
notion_url: "https://www.notion.so/SAM-2-Segment-Anything-in-Images-and-Videos-14a8d6e1cee580c7b91ece8d0921ea93"
notion_synced: true
---

---

---

[https://ai.meta.com/research/publications/sam-2-segment-anything-in-images-and-videos/](https://ai.meta.com/research/publications/sam-2-segment-anything-in-images-and-videos/)

# 0. Abstract

---

- 이미지와 비디오 안에서 promptable visual segmentation(PVS) 쪽으로 방향을 잡음

- 간단한 transformer 아키텍처와 실시간 비디오 처리를 위해 streaming memory를 활용함

- 기존 방법보다 3배 적은 상호작용으로 더 높은 정확도 달성

- Segmentation에서는 SAM보다 정확하며, 6배 빠름

---

---

# 1. Introduction

---

- AR/VR, robotics, autonomous vehicles, video editing에서 이미지 수준의 segmentation을 넘어 시간적 위치 파악이 필요함

- 현재 Segment Anything은 이미지에서는 Segmentation을 잘하지만 비디오에서는 부족한 측면을 보임

- SAM2
  - 메모리 장착 → 오브젝트 이전 상호 작용 저장

  - Data Engine은 현재 존재하는 접근 방법과 비교하여 8.4배 빠름

  - 35.5M 마스크와 50.9K 비디오를 포함, 존재하는 Video Segmentation Set보다 53배 많음

  - 기존 방식보다 3배 적은 상호작용으로 더 나은 세분화 정확도를 생성할 수 있음

- SAM2는 Image Segmentation benchmarks에서 SAM보다 6배 더 빠름

---

---

# 2. Related Work

---

pass

---

---

# 3. Task: promptable visual segmentation

---

> [!note]
> 사용자 상호작용을 하는 SAM2
> ![](/assets/notion/sam-2-segment-anything-in-images-and-videos-2348d6e1cee5.png)
> 
>   - 파란색은 positive prompt, 빨간색은 negative prompt
> 
>   - SAM2가 오브젝트를 잃어버릴 경우 추가적인 prompt를 진행(빨간색 화살표)
> 
>   - Step2에서는 single click을 통해 object를 다시 복구하고 propagate를 진행

- SAM2는 positive/negative clicks, boxes, masks를 입력으로 받고 오브젝트 정의, 분할, 재정의하기 위해서 모델 추론을 함

- 초기 프롬프트를 받고 모델은 전체 비디오에 걸쳐 마스크를 전파해야 함
