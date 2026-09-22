---
title: "H-VLA: Hierarchical Vision-Language-Action Model with Key-Action Reasoning and Motion Planning in a Unified Action Space"
date: 2026-09-22
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Hierarchical Policy"
  - "Cross-Embodiment"
venue: "확인 필요"
authors: "Xiongfeng Peng, Lu Xu, Yandong Wang, Jiaqian Yu, Zirui Zheng, Yamin Mao, Weiming Li, Inseop Chung, Hyun-woong Cho, Jaewook Yoo, Dongwook Lee, Daehyun Ji, Chao Zhang"
paper: "https://arxiv.org/abs/2609.22895"
code: ""
project: ""
---

# 한 줄 요약

H-VLA는 카메라 좌표계의 6-DoF key-action을 semantic subgoal로 먼저 예측하고 이를 조건으로 dense motion을 생성해, 서로 다른 로봇·카메라·장면 사이의 manipulation transfer를 강화한다.

# 논문 정보

- 제목: H-VLA: Hierarchical Vision-Language-Action Model with Key-Action Reasoning and Motion Planning in a Unified Action Space
- 저자: Xiongfeng Peng, Lu Xu, Yandong Wang, Jiaqian Yu, Zirui Zheng, Yamin Mao, Weiming Li, Inseop Chung, Hyun-woong Cho, Jaewook Yoo, Dongwook Lee, Daehyun Ji, Chao Zhang
- 발표: 확인 필요 (arXiv v1, 2026-09-19)
- 링크: [arXiv](https://arxiv.org/abs/2609.22895), [HTML](https://arxiv.org/html/2609.22895v1)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: hierarchical VLA, key-action reasoning, motion planning, camera-centric action, cross-embodiment

# 핵심 아이디어

Language와 image에서 바로 dense action chunk를 생성하면 VLM의 semantic reasoning과 low-level control이 한 표현에 얽힌다. H-VLA는 manipulation의 다음 의미 있는 상태를 camera-frame end-effector pose와 gripper state인 key-action으로 먼저 생성하고, 별도 Motion Planning Model이 현재 state에서 그 key-action으로 가는 16-step delta action을 만든다.

State, key-action, action을 third-person camera 좌표계로 통일해 robot base frame과 camera viewpoint 차이를 줄인다. Single-arm과 dual-arm 데이터를 공통 14D interface에 넣고, key-action loss를 강조한 pretraining 뒤 dense motion 비중을 높이는 fine-tuning을 수행한다.

# VLA 관점에서 중요한 이유

Intermediate reasoning을 언어나 image waypoint가 아니라 실제 robot control과 같은 3D end-effector 공간에 둔다. 이 key-action은 사람이 해석할 수 있는 subgoal이면서 downstream planner가 직접 사용할 수 있어 semantic reasoning과 executable motion 사이의 병목 역할을 한다.

Camera-centric representation은 서로 다른 embodiment의 base frame 차이를 줄여 heterogeneous robot data를 합치는 수단이다. 즉 계층 분해와 action normalization을 함께 설계해 cross-embodiment transfer 문제를 다룬다.

# Robot / Embodied Setting

- Pretraining: 약 183K trajectories; RoboCOIN Cobot Magic, DROID, FractalData, BridgeDataV2
- 시뮬레이션: SimplerEnv의 Google Robot 및 WidowX tasks
- 실제 로봇: Agilex dual-arm
- 실제 과업: PickBottles, HandOver, LiftPot
- 분포 변화: in-distribution, OOD object position, OOD scene/object
- 입력: third-person RGB, optional left/right wrist RGB, language, end-effector state

# Method

DINOv2와 SigLIP visual token, LLaMA-2 language backbone에서 cognition feature를 얻는다. Diffusion Transformer 기반 Key-Action Model이 absolute 6-DoF pose와 gripper state를 예측하고, Motion Planning Model이 현재 state, key-action, wrist feature를 조건으로 16-step camera-centric delta action을 생성한다.

Stage 1에서는 key-action loss 가중치를 action loss보다 크게 두어 heterogeneous data에서 transferable subgoal reasoning을 학습한다. Stage 2에서는 두 loss를 같은 비중으로 최적화해 downstream motion을 정교화한다. Single-arm data는 dual-arm 14D interface에 복제해 mixed embodiment training에 사용한다.

# Experiments / Results

SimplerEnv 평균 성공률은 Google Robot visual matching 91%, variant aggregation 84%, WidowX visual matching 81%였다. 전체 설계에서 mixed pretraining/two-stage training을 제거하면 각각 85%, 81%, 74%로 떨어졌고, camera-centric space까지 제거하면 68%, 59%, 68%로 하락했다.

Agilex 실제 로봇 평균은 ID 93%, OOD position 83%, OOD scene/object 66%였다. 가장 강한 비교군 대비 각각 10%p, 47%p, 16%p 높았다. 다만 OOD scene/object의 LiftPot에서는 $\pi_0$와 $\pi_{0.5}$가 H-VLA보다 높았다. RTX 4090 end-to-end latency는 16-step chunk당 103ms이며 모델 크기는 7.7B이다.

# Limitations / Discussion

Key-action label을 gripper transition과 trajectory end에서 자동 추출하므로 중간 contact event를 놓칠 수 있다. Non-prehensile, deformable, dynamic manipulation에는 task-specific supervision이 추가로 필요하다.

Camera-centric representation은 camera-robot extrinsic calibration에 의존하지만 오차 민감도를 체계적으로 평가하지 않았다. VLM의 주된 reasoning은 2D인데 key-action은 3D target이어서 두 공간의 grounding gap이 남는다. 7.7B 규모와 두 단계 diffusion inference는 compact deployment에 부담이며, force와 fine-grained contact dynamics는 다루지 않는다.

# 내가 이해한 핵심

이 논문은 VLA가 바로 모든 미세 동작을 결정하게 하지 않고, 먼저 "다음에 손이 있어야 할 의미 있는 3D 상태"를 고르게 한다. 이 중간 상태를 모든 로봇에 공통인 camera frame으로 표현해 semantic transfer와 motion specialization을 분리한다.

# 다음에 연결해서 읽을 논문

- RT-H: language action hierarchy를 사용하는 VLA
- CoT-VLA / MolmoAct: visual or spatial intermediate reasoning
- OC-VLA: camera-centric action representation
- Fast-in-Slow / RoboDual: reasoning과 execution을 분리한 dual-system VLA
