---
title: "Find Something You Can't Do: Agentic Real-World Reinforcement Learning for Self-Improving VLA Models"
date: 2026-09-29
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Reinforcement Learning"
  - "Self-Improvement"
venue: "확인 필요"
authors: "Yuan Fang, Zechu Li, Haolei Tong, Puze Liu, Georgia Chalvatzaki"
paper: "https://arxiv.org/abs/2609.32069"
code: ""
project: "https://fangyzzz.github.io/FIND.github.io/"
---

# 한 줄 요약

FIND는 현재 장면에서 가능한 과업 중 정책이 가장 못하는 것을 골라 연습하고, VLM 자기평가와 gated residual RL로 frozen VLA를 실제 로봇에서 지속 개선한다.

# 논문 정보

- 제목: Find Something You Can't Do: Agentic Real-World Reinforcement Learning for Self-Improving VLA Models
- 저자: Yuan Fang, Zechu Li, Haolei Tong, Puze Liu, Georgia Chalvatzaki
- 발표: 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2609.32069), [HTML](https://arxiv.org/html/2609.32069)
- 코드/프로젝트: [공식 프로젝트 페이지](https://fangyzzz.github.io/FIND.github.io/)
- 키워드: VLA, autonomous practice, real-world RL, residual policy, self-evaluation

# 핵심 아이디어

보통 real-world RL은 매 rollout 뒤 장면 reset과 성공 label에 사람이 필요하다. FIND는 한 과업의 종료 장면을 다음 과업의 시작 상태로 그대로 사용하고, vision-language agent가 현재 가능한 과업을 판별한 뒤 최근 성공률이 낮은 과업을 우선 선택한다. 실행 전후 이미지를 비교한 VLM의 binary 평가가 reward와 다음 curriculum을 동시에 갱신한다.

행동은 frozen π0.5의 base action에 bounded residual을 더해 만든다. 10-head critic ensemble이 residual action의 예상 이득을 평가하고, 충분한 이득이 없으면 base action으로 되돌리는 gate가 학습 초반의 위험한 보정을 억제한다.

# VLA 관점에서 중요한 이유

VLA 배포 이후의 실패를 다시 사람 demonstration으로 바꾸지 않고, 로봇이 스스로 연습 과제를 고르고 보상까지 생성해 online improvement loop를 닫는다. 데이터 수집량뿐 아니라 **어떤 실패를 다음에 연습할지**를 policy weakness와 현재 장면 feasibility로 결정한다는 점이 핵심이다.

# Robot / Embodied Setting

- 로봇: 7-DoF Franka Emika Panda, parallel-jaw gripper
- 센서: third-person 및 wrist ZED X Mini RGB, 224×224
- 과업: cube 넣기/빼기, 쌓기/내리기, drawer 열기/닫기, mug 걸기/빼기 등 4개의 reversible pair
- Base policy: 실제 demonstration으로 fine-tune한 frozen π0.5
- Online learner: language-conditioned residual actor와 10-head REDQ-style critic ensemble

# Method

FIND의 agentic loop는 현재 이미지에서 실행 가능한 task를 고르고, 최근 성공률이 낮을수록 sampling probability를 높인다. 실행 전후 이미지를 VLM이 비교해 성공 여부를 판단하고 replay buffer와 curriculum을 함께 갱신한다.

Residual actor는 base action에 작은 보정을 제안하며 critic gate는 `Q(base + residual) - Q(base)`가 threshold를 넘을 때만 이를 실행한다. Rollout collection과 RL update는 비동기로 수행하되 learner lag를 2,000 environment step 이내로 제한한다.

# 핵심 그림

![현재 장면에서 약한 과업을 선택하고 VLM 성공 평가와 gated residual RL로 다시 정책을 개선하는 FIND 순환 구조](/papers/assets/vla/find-agentic-real-world-reinforcement-learning-for-self-improving-vla-models/overview.svg)

_논문 Figure 1을 바탕으로 재구성._ FIND의 기여는 단일 network보다 **장면 이해 → 약점 중심 연습 → 자기평가 → 보수적 residual update**의 폐루프이므로 구조 그림을 선택했다. 출처: [논문 원문](https://arxiv.org/html/2609.32069).

# Experiments / Results

5개 independent run의 사람 평가에서 8개 과업 평균 성공률이 55.0%에서 71.9%로 올랐다. 대표 6시간 run은 456 episode 중 426회를 사람 개입 없이 진행했으며, 30회만 수동 scene recovery가 필요했다.

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓)     | 제안 방법 |                비교 기준 |      차이 | 출처        |
| ------------------------------------ | --------: | -----------------------: | --------: | ----------- |
| 8개 실로봇 과업 평균 성공률 (%, ↑)   |      71.9 | fine-tuned base VLA 55.0 |   +16.9%p | Figure 3(a) |
| 대표 run 무개입 episode 비율 (%, ↑)  |     93.42 |      전체 456회 중 426회 | 해당 없음 | Table II    |
| 대표 run 수동 recovery 비율 (%, ↓)   |      6.58 |        30 / 456 episodes | 해당 없음 | Table II    |
| VLM task-selection 정확도 (%, ↑)     |        96 |               100 scenes | 해당 없음 | Table III   |
| VLM success-evaluation 정확도 (%, ↑) |       100 |          100 image pairs | 해당 없음 | Table III   |

# Limitations / Discussion

과업은 미리 정의되어 있고 base VLA가 대체로 시도할 수 있는 범위에 한정된다. 종료 상태가 다른 유용한 과업의 시작 상태가 되는 reversible pair 설계 덕분에 reset 부담이 낮아졌으므로, 비가역적이거나 workspace를 소모하는 과업에는 그대로 적용하기 어렵다.

30회의 수동 recovery 중 21회가 불리한 물체 자세 때문이었다. 즉 agent가 reward와 curriculum을 자동화해도 base policy의 recovery-state coverage가 부족하면 사람이 여전히 장면을 복원해야 한다.

# 내가 이해한 핵심

실로봇 self-improvement의 병목은 RL update 자체보다 다음에 무엇을 시도할지와 성공을 누가 판정할지다. FIND는 VLM을 이 두 지점에 배치하고, critic gate로 학습 중 정책 악화를 제한했다.

# 다음에 연결해서 읽을 논문

- BEE: 사람 개입을 안전한 residual RL 신호로 쓰는 real-world VLA 학습
- VLaRL: 시뮬레이션에서 residual policy를 학습해 VLA를 보강하는 접근
- Kintsugi-VLA: 실패 rollout에서 recovery 가능 상태를 선택하는 데이터 엔진
- Self-Adaptive VLA: 최근 deployment rollout을 context로 이용하는 test-time adaptation
