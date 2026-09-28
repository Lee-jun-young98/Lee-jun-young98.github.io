---
title: "VLaRL: Augmenting Vision-Language-Action Models with Simulation-Trained Latent-Conditioned Residual RL"
date: 2026-09-28
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Residual Reinforcement Learning"
  - "Sim-to-Real"
venue: "확인 필요"
authors: "Namiko Saito, Kinam Kim, Heecheol Kim, Katsushi Ikeuchi, Yasuyuki Matsushita"
paper: "https://arxiv.org/abs/2609.30868"
code: ""
project: ""
---

# 한 줄 요약

VLaRL은 frozen VLA의 vision-language latent를 sim-to-real 인터페이스로 정렬하고, 시뮬레이션에서 학습한 residual RL을 실로봇 접촉 조작에 추가한다.

# 논문 정보

- 제목: VLaRL: Augmenting Vision-Language-Action Models with Simulation-Trained Latent-Conditioned Residual RL
- 저자: Namiko Saito, Kinam Kim, Heecheol Kim, Katsushi Ikeuchi, Yasuyuki Matsushita
- 발표: 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2609.30868), [HTML](https://arxiv.org/html/2609.30868)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: VLA, residual RL, latent alignment, sim-to-real, contact-rich manipulation

# 핵심 아이디어

VLA는 과업의 의미와 대략적 동작은 잘 생성하지만 접촉 위치·정렬·지속 힘이 중요한 마지막 구간에서 실패할 수 있다. VLaRL은 base VLA를 고정하고, VLA action·proprioception·force·VLM latent를 입력으로 받는 작은 residual policy만 시뮬레이션에서 학습한다.

실제 영상과 시뮬레이션 영상 사이의 latent 차이는 대응하는 sim-real trajectory로 학습한 lightweight mapper가 줄인다. 학습 때는 mapped simulation latent를 쓰고, 배포 때는 실제 VLA latent를 직접 사용하므로 online adaptation은 필요 없다.

# VLA 관점에서 중요한 이유

VLA 내부 표현을 semantic feature일 뿐 아니라 sim-to-real control interface로 활용한다. 명시적 object pose estimator 없이도 언어 지시와 장면 정보를 보존하면서, pretrained VLA의 범용 행동과 RL의 정밀 보정을 역할 분담할 수 있다.

실로봇 RL 없이 접촉-rich correction을 얻는다는 점은 안전과 데이터 비용이 큰 현장 배포에 직접 연결된다.

# Robot / Embodied Setting

- 로봇: Franka Research 3
- 시뮬레이터: MuJoCo digital twin
- 과업: button pressing, block pushing, cup stacking, drawer closing
- VLA backbone: Flower, GR00T N1.7
- 데이터: 과업당 실로봇 teleoperation 32 demonstrations
- 평가: 실로봇 조건당 40 trials, unseen shape/color object 포함

# 핵심 그림

![VLaRL에서 고정된 VLA 행동을 시뮬레이션 학습 residual policy로 국소 보정하는 개념](https://arxiv.org/html/2609.30868v1/concept_VLaRL_3.png)

_원문 Figure 1._ 실세계 온라인 RL 없이 시뮬레이션에서 학습한 residual 보정을 실로봇에 옮기는 핵심 구조다. [그림·실험표 출처: 논문 원문](https://arxiv.org/html/2609.30868).

# Method

먼저 실제 demonstration으로 VLA를 fine-tune하고 고정한다. 같은 trajectory의 sim-real latent 쌍을 이용해 simulation latent를 real latent 분포로 옮기는 mapper를 학습한다.

Residual actor는 mapped latent, base action, proprioception, Cartesian force에서 제한된 correction을 출력한다. Critic만 privileged simulation state를 추가로 받는 asymmetric actor-critic 구조이며, demonstration에서 계산한 residual target도 학습 안정화에 사용한다.

# Experiments / Results

VLaRL은 4개 과업과 2개 backbone의 모든 8개 조합에서 실로봇 성공률을 높였다. Flower button pressing은 67.5%에서 100%, block pushing은 22.5%에서 50%, GR00T cup stacking은 17.5%에서 45%로 올랐다.

| 로봇 / 벤치마크 / 태스크 | 제안 방법 |  비교 기준 |    차이 | 해석                         |
| ------------------------ | --------: | ---------: | ------: | ---------------------------- |
| Flower button pressing   |    100.0% | Base 67.5% | +32.5%p | 정밀 접촉 보정 효과          |
| Flower block pushing     |     50.0% | Base 22.5% | +27.5%p | 지속 접촉의 local correction |
| GR00T cup stacking       |     45.0% | Base 17.5% | +27.5%p | 공간 정렬 실패 완화          |
| Unseen block shapes      |     57.5% | Base 40.0% | +17.5%p | 새 물체에서도 보정 유지      |

# Limitations / Discussion

Mapper 학습에 과업별 digital twin과 대략 대응하는 sim-real trajectory가 필요하다. 시각 latent 차이는 줄이지만 friction, compliance, contact dynamics 차이를 직접 해결하지는 않는다.

Mapper는 backbone별로, residual policy는 현재 과업 범주별로 따로 학습한다. Unseen-object 평가도 제한된 shape/color 변화라 open-world generalization을 의미하지 않는다.

# 내가 이해한 핵심

VLA latent는 언어와 장면을 압축한 공통 좌표계가 될 수 있다. 그 좌표계를 simulation과 reality 사이에서 맞추면, RL은 의미를 다시 배우지 않고 물리적 오차만 보정할 수 있다.

# 다음에 연결해서 읽을 논문

- BEE: 사람 개입의 불확실성을 이용한 frozen VLA residual RL
- Object-Centric Residual RL: object pose를 sim-to-real 인터페이스로 사용하는 비교 접근
- RL Token: VLA 내부 token을 사용하는 online real-robot RL
- CompVLA: contact-rich manipulation에서 compliance를 직접 출력하는 VLA
