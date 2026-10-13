---
title: "Noise Space Learning for VLA Adaptation"
date: 2026-10-13
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Junjie Lu, Chuheng Zhang, Yucen Wang, Yuhua Jiang, Xinyao Qin, Min Xu, Li Zhao"
paper: "https://arxiv.org/abs/2610.13943"
code: ""
project: ""
thumbnail: "/papers/assets/vla/noise-space-learning-for-vla-adaptation/overview.svg"
---

# 한 줄 요약

Noise Space Learning(NSL)은 flow-matching VLA를 고치지 않고 관측 조건부 초기 noise 분포만 PPO·SAC·AWR로 학습해, 낮은 update 비용으로 행동 분포와 성공률을 바꾼다.

# 논문 정보

- 제목: Noise Space Learning for VLA Adaptation
- 저자: Junjie Lu, Chuheng Zhang, Yucen Wang, Yuhua Jiang, Xinyao Qin, Min Xu, Li Zhao
- 발표: arXiv:2610.13943v1 (2026-10-09), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.13943) · [HTML 원문](https://arxiv.org/html/2610.13943)
- 코드/프로젝트: 공식 공개 확인되지 않음
- 키워드: noise space learning, flow matching, VLA adaptation, reinforcement learning, frozen policy

# 핵심 아이디어

flow-matching 정책은 같은 관측에서도 초기 Gaussian noise에 따라 다른 action chunk를 만든다. NSL은 표준 prior $\rho(z)$ 대신 context $s$에 따른 작은 noise actor $\pi_\theta^z(z\mid s)$를 학습하고, 고정된 generator $G_\phi$에 $a=G_\phi(s,z)$를 생성하게 한다. 즉 VLA weight나 출력 action에 residual을 더하지 않고, pretrained generator가 이미 표현할 수 있는 행동 가운데 성공 가능성이 높은 부분을 noise 단계에서 재가중한다.

# VLA 관점에서 중요한 이유

대형 VLA의 online fine-tuning은 역전파 비용, catastrophic forgetting, 제한된 robot interaction 때문에 어렵다. NSL은 VLA를 frozen 상태로 두고 작고 명시적인 stochastic interface만 학습한다. 또한 PPO·SAC·AWR를 같은 noise-space 문제에 연결해, 데이터와 compute가 적을 때는 AWR, 충분할 때는 SAC라는 실용적 선택지를 제시한다.

# Robot / Embodied Setting

- simulation: LIBERO-10의 500 task-reset pair/epoch, SmolVLA와 $\pi_{0.5}$; RoboTwin 8개 task의 Easy/Hard.
- real robot: cup stacking, toy fishing, sequential insertion, bead placement 4개 task, method/task당 40회.
- 실제 정책: task별로 SFT한 $\pi_{0.5}$, primary·wrist RGB와 7차원 proprioception 입력, 50-step chunk 중 10 step 실행.
- 비교: generator adaptation(Action-AWR), residual adaptation(RLT), human-guided DAgger와 UniSteer.

# Method

1. frozen VLA $G_\phi$가 관측·상태·지시 $s$와 noise $z$를 action chunk $a$로 바꾼다.
2. diagonal Gaussian noise actor가 $\pi_\theta^z(z\mid s)$를 출력하며 표준 Gaussian prior와 같게 초기화된다.
3. rollout에서 $(s,z,a,R)$를 모은 뒤 PPO는 clipped objective, SAC는 twin noise-space critic, AWR는 성공 sample의 advantage-weighted likelihood로 actor를 갱신한다.
4. task balancing, success/failure balancing과 SAC noise limit가 편향·critic extrapolation을 완화한다.
5. human correction은 frozen generator의 fixed-point inversion으로 대응 noise를 찾아 동일 actor 학습에 합친다.

# 핵심 그림

![관측·언어·상태가 noise actor를 조건화하고 선택된 noise가 frozen VLA action generator를 거쳐 행동이 되며 보상이 noise actor만 갱신하는 NSL 구조](/papers/assets/vla/noise-space-learning-for-vla-adaptation/overview.svg)

> 논문 Figure 1과 §3.1을 바탕으로 재구성. 출처: [arXiv HTML, Figure 1·Methods](https://arxiv.org/html/2610.13943). 학습되는 경로와 고정 경로를 분리해 표시했다.

구조 그림을 고른 이유는 NSL의 차별점이 무엇을 학습하느냐보다 어디를 학습하느냐에 있기 때문이다. context는 noise actor와 frozen VLA 양쪽에 들어가고, actor가 고른 $z$는 generator를 통해 action chunk로 pushforward된다. 환경 보상은 PPO/SAC/AWR update로 noise actor에만 돌아가며 VLA weight에는 역전파되지 않는다. residual method가 출력 행동을 교정하는 것과 달리 NSL은 pretrained generator 내부의 행동 manifold를 noise로 탐색한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)         |     제안 방법 |       비교 기준 |     차이 | 출처         |
| -------------------------------------- | ------------: | --------------: | -------: | ------------ |
| LIBERO 2-setting 평균, best ≤60 epochs |  NSL-SAC 83.5 | Action-AWR 79.4 |   +4.1%p | 원문 Table 1 |
| $\pi_{0.5}$-One, best ≤60 epochs       |  NSL-SAC 71.2 |       base 40.4 |  +30.8%p | 원문 Table 1 |
| RoboTwin Easy, epoch 30                | NSL-SAC 84.25 |       SFT 31.50 | +52.75%p | 원문 Table 7 |
| RoboTwin Hard, epoch 30                | NSL-SAC 77.25 |       SFT 32.75 | +44.50%p | 원문 Table 7 |
| 실제 4-task 평균, autonomous           |  NSL-AWR 71.3 |    initial 37.5 |  +33.8%p | 원문 Table 3 |
| 실제 4-task 평균, human-guided         |  NSL-AWR 83.8 |   UniSteer 73.8 |  +10.0%p | 원문 Table 3 |

실제 autonomous NSL-AWR는 평균 1.53분의 model-update time으로 Action-AWR 52.4분, RLT 23.2분보다 짧으면서 각각 58.8%, 70.0% 대비 71.3%를 기록했다. 다만 simulation의 NSL-SAC는 baseline보다 update 배수가 크고, noise limit 제거 시 SmolVLA-Full이 93.4%에서 32.0%로 급락해 안정 장치가 핵심이다.

# Limitations / Discussion

- frozen generator가 만들 수 없는 행동은 noise 재가중만으로 생성할 수 없다.
- 성능은 noise actor parameterization과 pretrained generator의 noise-action coverage에 강하게 묶인다.
- SAC는 실제 bead-placement 초기 실험에서 의도하지 않은 table contact가 있었고, critic extrapolation과 큰 noise 제안이 안전 위험을 만든다.
- optimizer별 rollout·update budget이 달라 최고 성공률만으로 compute-equivalent 우열을 단정하기 어렵다.
- 새 task·embodiment 일반화, 기존 skill retention, 복잡한 contact에서의 안정성은 미검증이다.
- 공식 conference venue, 코드, 프로젝트 페이지는 확인되지 않았다.

# 내가 이해한 핵심

생성 정책의 noise는 제거해야 할 무작위성이 아니라 pretrained 행동 repertoire를 선택하는 control knob다. NSL은 그 knob를 작은 정책으로 학습해 큰 VLA를 건드리지 않고 online adaptation한다.

# 다음에 연결해서 읽을 논문

- Cue the Flow: flow trajectory의 내부 상태를 조향하는 방식과 초기 noise만 바꾸는 NSL을 비교하기 좋다.
- RLT: frozen policy 출력에 residual action을 더하는 대표 비교군이다.
- UniSteer: human demonstration을 noise로 역변환해 VLA를 steering하는 연결점이다.
