---
title: "SAM 2: Segment Anything in Images and Videos"
date: 2024-11-26
thumbnail: "/papers/assets/notion/sam-2-segment-anything-in-images-and-videos-2348d6e1cee5.png"
socialImage: "https://lee-jun-young98.github.io/papers/assets/notion/sam-2-segment-anything-in-images-and-videos-2348d6e1cee5.png"
tags:
  - "paper-review"
  - "Vision"
  - "Segmentation"
author: "Nikhila Ravi, Valentin Gabeur, Yuan-Ting Hu, Ronghang Hu, Chaitanya Ryali, Tengyu Ma, Haitham Khedr, Roman Rädle, Chloe Rolland, Laura Gustafson, Eric Mintun, Junting Pan, Kalyan Vasudev Alwala, Nicolas Carion, Chao-Yuan Wu, Ross Girshick, Piotr Dollár, Christoph Feichtenhofer"
journal: "Meta FAIR 2024.07.29"
---

[Paper](https://arxiv.org/abs/2408.00714) / [Meta Research Page](https://ai.meta.com/research/publications/sam-2-segment-anything-in-images-and-videos/)

# 한 줄 요약

SAM 2는 이미지에서만 동작하던 promptable segmentation을 비디오까지 확장한 foundation model이며, streaming memory를 사용해 사용자의 prompt를 시간축 전체의 object mask로 전파한다.

![](/papers/assets/notion/sam-2-segment-anything-in-images-and-videos-2348d6e1cee5.png)

# Introduction

SAM은 점, 박스, 마스크 같은 prompt를 받아 이미지 안의 객체를 분할하는 강력한 모델이었다. 하지만 현실의 많은 응용은 단일 이미지가 아니라 비디오다. 영상 편집, AR/VR, robotics, autonomous driving에서는 같은 객체가 시간에 따라 움직이고, 가려지고, 다시 나타난다.

SAM 2의 목표는 이미지와 비디오를 하나의 promptable visual segmentation 문제로 묶는 것이다. 사용자가 특정 frame에서 positive/negative click이나 box를 주면, 모델은 그 객체의 mask를 현재 frame뿐 아니라 이후 frame들로 전파해야 한다.

# Related Work

SAM은 image segmentation foundation model의 대표적인 사례다. 하지만 비디오 object segmentation은 시간적 일관성, memory 관리, object re-identification 문제가 추가된다.

기존 video segmentation 방법들은 특정 dataset이나 task setting에 맞춰 학습되는 경우가 많았다. SAM 2는 SAM의 promptable interface를 유지하면서 비디오까지 처리하기 위해 memory 기반 architecture와 대규모 video mask dataset을 함께 제안한다.

# Method

## Promptable Visual Segmentation

SAM 2는 사용자 prompt를 입력으로 받아 mask를 예측한다. prompt는 point, box, mask가 될 수 있고, 사용자는 결과가 틀렸을 때 추가 click으로 수정할 수 있다.

이미지에서는 한 장의 입력에 대해 mask를 만들면 된다. 비디오에서는 특정 frame에서 정의된 객체를 다른 frame들에서도 계속 추적하고 분할해야 한다.

## Streaming Memory

SAM 2의 핵심은 streaming memory다. 모델은 현재 frame을 처리할 때 과거 frame에서 얻은 object 정보와 mask 정보를 memory로 참조한다. 이를 통해 객체가 움직이거나 모양이 조금 바뀌어도 같은 객체로 이어서 segmentation할 수 있다.

이 구조는 비디오를 한 번에 모두 넣는 방식이 아니라 frame이 들어오는 순서대로 처리하는 streaming setting에 맞춰져 있다. 그래서 실제 interactive video annotation이나 편집 workflow에 더 가깝다.

## Data Engine과 SA-V

SAM 2는 모델만 제안한 것이 아니라 video segmentation data engine도 함께 제안한다. 논문은 SAM 2를 이용해 사람이 빠르게 mask를 수정하고, 그 결과를 다시 dataset으로 확장하는 과정을 구성한다.

그 결과로 SA-V라는 대규모 video segmentation dataset을 구축한다. Notion 메모 기준으로도 50.9K videos와 35.5M masks 규모가 핵심 포인트다. 이 dataset이 SAM 2의 generalization을 뒷받침한다.

# Experiments

논문은 두 방향으로 평가한다.

- Image segmentation: 기존 SAM과 비교해 이미지 promptable segmentation 성능과 속도를 평가한다.
- Video segmentation: 사용자가 몇 번의 interaction을 해야 원하는 mask 품질에 도달하는지, 기존 video object segmentation 방법보다 얼마나 효율적인지 평가한다.

즉, 단순 mIoU만 보는 것이 아니라 interactive model로서의 품질도 본다. SAM 2의 사용 장면이 “사람이 prompt를 주고 모델이 이어서 처리하는 workflow”이기 때문이다.

# Result

SAM 2는 image segmentation에서도 SAM보다 빠르고 정확한 결과를 보이며, video segmentation에서는 더 적은 사용자 interaction으로 높은 품질의 mask를 얻는 방향을 보여준다. 특히 이미지와 비디오를 분리된 모델로 다루지 않고 하나의 architecture에서 처리한다는 점이 중요하다.

실용적으로 보면 SAM 2는 annotation tool, video editing, medical/robotics 영상 분석 같은 곳에서 “클릭 몇 번으로 객체 mask를 시간축 전체에 퍼뜨리는 모델”에 가깝다.

# 한계

- 긴 비디오에서 memory가 충분히 좋은 frame을 유지하지 못하면 identity drift가 생길 수 있다.
- 심한 occlusion, 빠른 motion, 비슷한 객체가 많은 장면에서는 추가 prompt가 필요할 수 있다.
- promptable model이므로 최종 품질은 사용자 interaction 품질에도 영향을 받는다.
- dataset과 benchmark가 커졌지만, domain-specific video에서는 여전히 adaptation이 필요할 수 있다.

# Takeaway

SAM 2를 읽을 때 핵심은 “segmentation을 이미지 단위 예측에서 interactive video workflow로 확장했다”는 점이다. SAM이 segmentation의 interface를 바꿨다면, SAM 2는 그 interface를 시간축으로 확장했다.

앞으로 Agent나 multimodal system과 연결해서 보면 더 흥미롭다. 예를 들어 video agent가 장면을 이해하고, 특정 객체를 추적하고, 편집/로봇 행동으로 이어가려면 SAM 2 같은 promptable video segmentation module이 강력한 perception primitive가 될 수 있다.

# 출처

- [SAM 2: Segment Anything in Images and Videos](https://arxiv.org/abs/2408.00714)
- [Meta AI Research: SAM 2](https://ai.meta.com/research/publications/sam-2-segment-anything-in-images-and-videos/)
