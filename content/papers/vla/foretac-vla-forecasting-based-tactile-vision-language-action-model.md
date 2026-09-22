---
title: "ForeTac-VLA: A Forecasting-Based Tactile-Vision-Language-Action Model for Contact-Rich Robotic Manipulation"
date: 2026-09-21
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Tactile Sensing"
  - "Contact-Rich Manipulation"
venue: "확인 필요"
authors: "Zhengyu Tao, Xin Li, Xin Wang"
paper: "https://arxiv.org/abs/2609.20980"
code: ""
project: "https://foretac-vla.github.io/"
---

# 한 줄 요약

ForeTac-VLA는 과거 촉각 흐름과 vision-language feature를 양방향으로 융합하고 미래 접촉 상태까지 예측해, 보이지 않는 접촉 변화를 action generation에 선제적으로 반영한다.

# 논문 정보

- 제목: ForeTac-VLA: A Forecasting-Based Tactile-Vision-Language-Action Model for Contact-Rich Robotic Manipulation
- 저자: Zhengyu Tao, Xin Li, Xin Wang
- 발표: 확인 필요 (arXiv v1, 2026-09-17)
- 링크: [arXiv](https://arxiv.org/abs/2609.20980), [HTML](https://arxiv.org/html/2609.20980v1)
- 코드/프로젝트: [프로젝트 페이지](https://foretac-vla.github.io/), 코드 공개 여부 확인 필요
- 키워드: tactile VLA, tactile forecasting, multimodal fusion, contact-rich manipulation, $\pi_{0.5}$

# 핵심 아이디어

시각만으로는 삽입 정렬, 미끄러짐, 깨지기 쉬운 물체의 압력처럼 접촉 내부 상태를 알기 어렵다. ForeTac-VLA는 최근 촉각 시계열을 temporal representation으로 만들고, vision-language representation과 bidirectional cross-attention으로 서로 갱신한다.

Transformer forecaster는 약 83, 167, 250, 333 ms 뒤의 multi-step tactile state를 예측한다. 관측 촉각과 예측 촉각을 함께 VLA backbone에 조건으로 주며, 학습 초기에 부정확한 예측이 정책을 망치지 않도록 ground-truth tactile에서 prediction으로 점진적으로 전환한다.

# VLA 관점에서 중요한 이유

현재의 많은 VLA가 semantic generalization에는 강하지만 접촉 이후에는 사실상 시각 기반 reactive policy에 머문다. 이 연구는 tactile을 보조 입력으로 붙이는 수준을 넘어, 미래 물리 상호작용을 예측하는 anticipatory state로 사용한다.

이는 VLA의 world modeling이 RGB의 미래 장면뿐 아니라 힘과 접촉의 미래까지 포함해야 한다는 방향을 보여준다. 저조도와 시각 clutter에서 상대적으로 작은 성능 저하는 tactile grounding이 visual distribution shift를 보완할 수 있음을 시사한다.

# Robot / Embodied Setting

- 로봇: UR7e arm, Robotiq 2F-85 parallel gripper
- 촉각: 양쪽 finger의 TSF-85 pressure-sensitive tactile sensor
- 시각: 고정형·wrist형 Intel RealSense D455f 두 대
- 기반 모델: pretrained $\pi_{0.5}$ checkpoint
- 실제 과업: Peg Insertion, Chip Handling, Cap Unscrewing, Board Wiping
- 데이터: 과업별 70개, 총 280 teleoperated demonstrations를 60 Hz로 수집

# Method

모델은 촉각 history encoder, vision-language encoder, bidirectional cross-attention, multi-step tactile forecaster, VLA action backbone으로 구성된다. 첫 방향의 attention은 촉각이 시각·언어 문맥을 읽게 하고, 반대 방향은 vision-language representation을 접촉 정보로 보정한다.

Forecaster는 융합된 representation에서 여러 미래 horizon의 촉각 배열을 예측한다. 이 예측과 관측 tactile representation이 action generation을 직접 조건화한다. Curriculum은 초기에는 ground-truth future tactile 비중을 높이고 학습이 진행되며 forecast 사용량을 늘린다.

# Experiments / Results

과업별 20회, 모델별 80회의 실제 로봇 평가에서 평균 성공률은 ForeTac-VLA 95.0%, fine-tuned VLA 58.75%, FiLM-Fusion TacVLA 71.25%, Concat-and-Gating TacVLA 72.50%, ACT 13.75%였다. 네 과업 개별 결과도 각각 20/20, 19/20, 19/20, 18/20이었다.

Ablation에서 tactile 단순 concat은 58.75%를 68.75%로, single-direction cross-attention은 80.0%로 높였다. 미래 촉각 예측 추가는 81.25%, bidirectional fusion까지 적용하면 95.0%였다. 저조도 평균은 80.0%, 시각 clutter 평균은 81.25%로 fine-tuned VLA의 40.0%, 27.5%보다 높았다.

# Limitations / Discussion

단일 tactile sensor 구성과 단일 robot embodiment만 평가했다. 미래 촉각을 고정된 시간 간격으로 예측하므로 상호작용 속도가 달라지는 과업을 유연하게 표현하지 못할 수 있다.

네 과업 모두 비교적 짧은 horizon이며 더 다양한 물체·장기 과업에서의 일반화는 확인되지 않았다. 또한 예측 자체의 단독 기여는 80.0%에서 81.25%로 작고, 가장 큰 향상은 bidirectional fusion에서 나왔으므로 성능을 단순히 forecasting 효과로만 해석하면 안 된다.

# 내가 이해한 핵심

촉각을 현재 접촉의 센서값으로만 쓰지 않고, 곧 일어날 미끄러짐·압력 변화를 미리 표현하는 작은 물리 예측기로 바꾼다. 다만 현재 결과에서는 예측보다 tactile과 vision-language가 양방향으로 정보를 주고받는 설계가 더 큰 효과를 냈다.

# 다음에 연결해서 읽을 논문

- TacVLA: contact-aware tactile fusion baseline
- AT-VLA: adaptive tactile injection과 feedback reaction
- OmniVTLA: semantic-aligned tactile sensing
- TORL-VLA: tactile-guided online reinforcement learning
