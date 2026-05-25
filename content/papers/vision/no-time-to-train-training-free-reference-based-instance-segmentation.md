---
title: "No time to train! Training-Free Reference-Based Instance Segmentation"
tags:
  - "paper-review"
  - "Vision"
  - "Segmentation"
author: "Miguel Espinosa, Chenhongyi Yang, Linus Ericsson, Steven McDonagh, Elliot J. Crowley"
journal: "arXiv 2025"
paper: "https://arxiv.org/abs/2507.02798"
---

# 한 줄 요약

이 논문은 새로운 class나 domain에 대해 추가 학습 없이, 소수의 reference image만으로 target image의 instance mask를 생성하는 training-free reference-based instance segmentation 방법을 제안한다.

# Introduction

Instance segmentation은 일반적으로 많은 annotation과 학습 비용을 요구한다. SAM 계열 모델은 promptable segmentation으로 이 부담을 줄였지만, 여전히 point, box, mask 같은 visual prompt를 사람이 주거나 task별 prompt generation rule을 만들어야 한다.

이 논문은 질문을 바꾼다. "새로운 객체를 segment하기 위해 꼭 학습해야 하는가?" 저자들은 reference image 몇 장만 있다면 foundation model의 semantic prior와 correspondence를 활용해 target image에서 같은 객체를 찾을 수 있다고 본다.

# Related Work

관련 흐름은 세 가지다.

- Few-shot object detection/segmentation: 적은 예시로 새로운 class를 찾는 연구
- Segment Anything 계열: high-quality mask proposal을 생성하는 promptable segmentation
- Self-supervised visual representation: DINOv2처럼 semantic correspondence에 강한 feature를 제공하는 모델

이 논문은 이들을 결합하되, 새로운 dataset에 대해 fine-tuning하지 않는다는 점이 핵심이다.

# Method

방법은 multi-stage pipeline으로 구성된다.

## 1. Memory Bank Construction

먼저 reference image에서 object에 해당하는 feature를 모아 memory bank를 만든다. 이 memory bank는 target image에서 같은 의미의 region을 찾는 기준점이 된다.

## 2. Representation Aggregation

단일 reference만 사용하면 viewpoint, scale, occlusion 변화에 약할 수 있다. 따라서 여러 reference의 representation을 집계해 더 안정적인 object prototype을 만든다.

## 3. Semantic-aware Feature Matching

Target image에서는 foundation model feature를 사용해 reference와 대응되는 region을 찾는다. 이때 SAM/SAM2가 만들어내는 mask proposal과 DINOv2의 semantic feature를 결합해, 학습 없이 instance-level mask를 선택한다.

# Experiments

논문은 COCO FSOD, PASCAL VOC Few-Shot, Cross-Domain FSOD benchmark에서 평가한다. 핵심 비교 대상은 기존 few-shot segmentation/detection 방법과 training-free baseline이다.

arXiv abstract 기준으로 논문은 COCO FSOD에서 36.8 nAP, PASCAL VOC Few-Shot에서 71.2 nAP50, Cross-Domain FSOD에서 22.4 nAP를 보고한다.

# Result

결과는 reference image 기반 correspondence가 instance segmentation prompt를 자동화하는 데 유효하다는 점을 보여준다.

특히 이 방법은 새로운 class가 계속 추가되는 환경에서 유용하다. 매번 모델을 다시 학습하지 않고, reference set만 준비하면 segmentation을 수행할 수 있기 때문이다.

# 한계

Training-free 방식은 빠르고 유연하지만, reference quality에 민감하다. Reference가 target과 너무 다르거나, class 간 visual similarity가 높으면 matching이 흔들릴 수 있다. 또한 SAM proposal과 DINOv2 feature의 품질에 의존하기 때문에 foundation model이 약한 도메인에서는 성능 저하가 생길 수 있다.

# Takeaway

이 논문은 segmentation 문제를 "새로 학습하기"가 아니라 "reference와 target 사이의 semantic correspondence 찾기"로 바꾼다. 실제 프로젝트에서는 custom class가 자주 바뀌거나 annotation cost가 높은 상황에서 먼저 시도해볼 만한 접근이다.

# 출처

- [arXiv: No time to train! Training-Free Reference-Based Instance Segmentation](https://arxiv.org/abs/2507.02798)
- [Official GitHub: miquel-espinosa/no-time-to-train](https://github.com/miquel-espinosa/no-time-to-train)
