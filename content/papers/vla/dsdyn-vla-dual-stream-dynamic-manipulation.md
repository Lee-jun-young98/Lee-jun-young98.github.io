---
title: "DSDyn-VLA: A Dual-Stream Dynamic Manipulation Framework with Motion Perception, Future Awareness, and Realtime Correction"
date: 2026-10-01
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Dynamic Manipulation"
venue: "확인 필요"
authors: "Wenhao Li, Xiu Su, Yu Han, Yichao Cao, Shan You, Chang Xu"
paper: "https://arxiv.org/abs/2609.39198"
code: ""
project: ""
---

# 한 줄 요약

DSDyn-VLA는 optical-flow 기반 저주파 VLA planner와 30Hz residual RL controller를 합쳐 움직이는 물체에서 perception·latency·open-loop control gap을 동시에 줄인다.

# 논문 정보

- 제목: DSDyn-VLA: A Dual-Stream Dynamic Manipulation Framework with Motion Perception, Future Awareness, and Realtime Correction
- 저자: Wenhao Li, Xiu Su, Yu Han, Yichao Cao, Shan You, Chang Xu
- 발표: 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2609.39198), [HTML](https://arxiv.org/html/2609.39198)
- 코드/프로젝트: 논문은 supplementary code와 향후 weight 공개를 명시했으나 독립 공개 URL은 확인 필요
- 키워드: dynamic manipulation, optical flow, residual RL, action chunk, real-time control

# 핵심 아이디어

동적 조작의 실패를 세 가지로 나눈다. 정적 RGB만 보는 perception gap, 추론 중 상태가 변하는 latency gap, action chunk를 open loop로 실행하는 control gap이다.

Flow-Planner는 RGB와 optical flow를 함께 읽어 미래 실행 시점의 macro action chunk를 만든다. Res-Refiner는 현재 상태를 30Hz로 읽고 각 macro action에 bounded residual을 더해 계획 사이의 교란을 수정한다.

# VLA 관점에서 중요한 이유

VLA의 action chunk는 계산 효율에는 좋지만 움직이는 target에선 관측 노후화와 open-loop 오류를 키운다. 이 논문은 큰 VLA가 semantic plan을, 작은 RL policy가 빠른 반사를 맡는 slow-fast 구조로 모델 추론 주기와 로봇 제어 주기를 분리한다.

# Robot / Embodied Setting

- Kinetix: state 기반 동적 benchmark, 지연 0~4 step과 execution horizon 변화, 설정당 2,048 trials
- DynBench: Franka Panda, conveyor picking 등 9개 동적 task, task당 100 demonstrations/100 trials
- 실로봇: 6-DOF Agilex Piper, Intel RealSense D435 2대
- 실로봇 과업: conveyor picking, dynamic dropping, dynamic stacking, mobile pouring
- backbone/control: π0.5 기반 Flow-Planner, action chunk 10, Res-Refiner 30Hz

# Method

Flow-Planner는 RAFT-Large optical flow를 방향은 hue, 속도는 saturation으로 바꾸고 RGB와 flow를 두 개의 ViT로 인코딩한다. 미래 실행 시점의 proprioceptive state를 kinematic rollout으로 추정해 action generation에 조건으로 넣는다.

2단계 학습에서 먼저 motion-aware flow-matching planner를 학습한다. 그 뒤 planner를 동결하고 offline demonstration과 online experience를 50:50으로 섞는 RLPD로 residual policy를 학습한다. 최종 action은 macro-plan과 residual correction의 합이다.

# 핵심 그림

![RGB와 optical flow를 처리하는 저주파 Flow-Planner 및 고주파 Res-Refiner가 최종 action을 합성하는 DSDyn-VLA 구조](/papers/assets/vla/dsdyn-vla-dual-stream-dynamic-manipulation/overview.svg)

_논문 Figure 3을 바탕으로 재구성._ 세 gap을 각각 어느 stream이 처리하는지 한눈에 보여 주므로 architecture figure를 선택했다. 출처: [논문 원문 Figure 3](https://arxiv.org/html/2609.39198).

# Experiments / Results

실로봇 네 과업 평균은 49.0%로 DynamicVLA 38.1%보다 10.9%p, π0.5 8.4%보다 40.6%p 높다. full model ablation 평균 48.5%에서 Res-Refiner를 빼면 25.0%, optical flow를 빼면 30.5%로 내려간다.

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓)   |      제안 방법 |             비교 기준 |    차이 | 출처    |
| ---------------------------------- | -------------: | --------------------: | ------: | ------- |
| 실로봇 4-task 평균 성공률 (%, ↑)   | DSDyn-VLA 49.0 |       DynamicVLA 38.1 | +10.9%p | Table 1 |
| Conveyor Picking 성공률 (%, ↑)     | DSDyn-VLA 44.8 |       DynamicVLA 33.2 | +11.6%p | Table 1 |
| Dynamic Stacking 성공률 (%, ↑)     | DSDyn-VLA 32.0 |       DynamicVLA 18.0 | +14.0%p | Table 1 |
| 실로봇 ablation 평균 성공률 (%, ↑) |      full 48.5 |  w/o Res-Refiner 25.0 | +23.5%p | Table 4 |
| 실로봇 ablation 평균 성공률 (%, ↑) |      full 48.5 | w/o optical flow 30.5 | +18.0%p | Table 4 |

# Limitations / Discussion

실로봇 residual RL은 과업별 30~60분의 online interaction과 사람이 부여하는 binary success reward를 사용한다. 따라서 새 과업마다 빠른 controller를 다시 적응시키는 비용과 안전 문제가 남는다.

실로봇은 한 arm과 네 task에 한정되고, 논문도 residual-policy generalization과 플랫폼 확장을 향후 과제로 둔다. Flow-Planner 총 latency는 RTX 4090에서 103ms이며, optical-flow 품질이 나빠질수록 성능이 점진적으로 하락한다.

# 내가 이해한 핵심

동적 환경에서 VLA latency는 단순한 속도 문제가 아니라 관측 좌표계와 실행 좌표계가 달라지는 제어 문제다. 미래 상태 conditioning으로 큰 오차를 미리 보상하고, 남은 오차는 고주파 residual로 닫아야 한다.

# 다음에 연결해서 읽을 논문

- RAVEL: rolling denoising과 async VLM으로 flow VLA의 관측 age를 줄이는 방법
- VLA-Feedback: feedback denoising으로 동적 교란에 반응하는 방법
- VLaRL: simulation-trained residual RL을 VLA에 결합하는 방법
