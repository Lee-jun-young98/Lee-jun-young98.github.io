---
title: "HIL-UMI: Bringing Human-in-the-Loop Post-Training of Vision-Language-Action Models to Universal Manipulation Interface"
date: 2026-09-18
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Human-in-the-Loop"
  - "Robot Learning"
venue: "확인 필요"
authors: "Zimu Han, Yiming Zeng, Jiyao Zhang, Zihao Zhao, Yuanfei Wang, Yixiang Jin, Shiqi Li, Shuangben Chen, Wei Huang, Ruodai Li, Hui Shen, Hao Dong"
paper: "https://arxiv.org/abs/2609.20659"
code: ""
project: "https://hil-umi.github.io/"
---

# 한 줄 요약

HIL-UMI는 실제 로봇을 움직이지 않고 휴대형 UMI 시연 중 현재 VLA의 예측과 사람 행동이 크게 어긋나는 구간만 수집하고, 과업 진척도를 반영한 학습으로 정책의 약점을 반복 보완한다.

# 논문 정보

- 제목: HIL-UMI: Bringing Human-in-the-Loop Post-Training of Vision-Language-Action Models to Universal Manipulation Interface
- 저자: Zimu Han, Yiming Zeng, Jiyao Zhang, Zihao Zhao, Yuanfei Wang, Yixiang Jin, Shiqi Li, Shuangben Chen, Wei Huang, Ruodai Li, Hui Shen, Hao Dong
- 발표: 확인 필요 (arXiv v1, 2026-09-17)
- 링크: [arXiv](https://arxiv.org/abs/2609.20659), [HTML](https://arxiv.org/html/2609.20659v1)
- 코드/프로젝트: [프로젝트 페이지](https://hil-umi.github.io/), 코드 공개 여부 확인 필요
- 키워드: VLA post-training, human-in-the-loop, UMI, OOD detection, advantage-conditioned behavioral cloning

# 핵심 아이디어

일반적인 supervised fine-tuning은 전문가가 방문한 정상 상태에 치우쳐 있고, 모든 시연 프레임을 같은 가치로 취급한다. HIL-UMI는 휴대형 Universal Manipulation Interface로 사람이 과업을 수행하는 동안 현재 정책도 같은 관찰에서 행동 청크를 추론하게 해, 정책이 실제로 약한 상태를 능동적으로 찾는다.

정책 데이터 수집에서는 10개의 stochastic action sample과 사람 행동 사이의 Energy Score를 계산해 분포 밖 상태를 검출한다. 별도의 advantage 데이터 수집에서는 온라인 진척도 추정치가 낮은 구간을 찾아 advantage estimator를 보강한다. 이후 기존 데이터와 새 데이터를 균형 있게 섞고, 진척도가 높은 행동을 구분하는 advantage-conditioned behavioral cloning(ACBC)으로 정책을 갱신한다.

# VLA 관점에서 중요한 이유

범용 VLA를 현장에 배치할 때 병목은 모델 규모만이 아니라, 특정 로봇·카메라·작업공간에서 실패하는 상태를 얼마나 싸고 안전하게 수집하느냐이다. HIL-UMI는 실제 로봇 rollout과 개입 없이도 현재 정책의 blind spot에 맞춘 데이터를 모으는 방법을 제시한다.

또한 데이터의 양보다 정책 불일치와 과업 진척도를 함께 사용해 어떤 구간을 모으고 어떻게 가중할지를 설계한다. 이는 VLA post-training을 정적 imitation learning에서 정책 조건부 데이터 엔진으로 확장한다.

# Robot / Embodied Setting

- 로봇: 단일 Franka Panda arm
- 수집 장치: AgiBot OmniPicker gripper, Meta Quest 3 tracking, wrist RealSense D405, third-person RealSense D455
- 기반 정책: open-source $\pi_{0.5}$
- 실제 과업: Fold Towel, Clean Up Table, Stack Cube, Stamp
- 평가: 과업별 10회, $30\,\mathrm{cm}\times60\,\mathrm{cm}$ 범위에서 물체 초기 위치 변화, Task Progress Score(TPS) 사용

# Method

정책 OOD detector는 사람의 action chunk와 정책의 stochastic action distribution 사이 거리를 position, SO(3) orientation, gripper 항으로 계산한다. Energy Score가 임계값을 넘으면 해당 상태부터 현재 subtask 종료까지 시연을 저장한다. 이 방식은 명시적 likelihood가 필요 없어 flow-based VLA에도 적용할 수 있다.

Advantage estimator는 두 관찰 사이의 상대적 과업 진척도를 회귀한다. 낮은 온라인 advantage가 검출된 구간으로 estimator를 반복 갱신하고, base data 중 상위 30% 진척 샘플과 새로 수집한 정책 보완 샘플에 positive condition을 붙여 ACBC를 수행한다. 매 라운드에서 새 데이터와 누적 데이터를 1:1로 섞어 최근 약점과 기존 능력 사이 균형을 잡는다.

# Experiments / Results

네 개 실제 과업에서 같은 라운드별 데이터 예산으로 비교했을 때, SFT는 개선 폭이 작거나 정체한 반면 HIL-UMI는 post-training 라운드가 진행될수록 일관되게 TPS가 향상됐다. Stack Cube의 선택 임계값 설정에서는 TPS가 base 84에서 3라운드 뒤 100으로 증가했다.

Advantage 모듈을 제거하면 성능이 크게 낮아져, 단순히 OOD 데이터를 추가하는 것뿐 아니라 과업 진척도를 구분해 학습하는 것이 중요함을 보였다. Clean Up Table에서는 HG-DAgger보다 높은 성능을 보이면서 데이터 수집이 5.63배 빨랐다. 온라인 detector 지연은 정책 OOD 112ms, advantage OOD 93ms였다.

# Limitations / Discussion

실험은 하나의 Franka arm과 네 개 과업, 과업별 10회 평가에 한정된다. 사람의 UMI 궤적과 실제 로봇의 동역학 차이가 큰 embodiment나 접촉이 복잡한 과업에서도 robot-free discrepancy가 정책 실패를 정확히 대변하는지는 추가 검증이 필요하다.

Energy Score 임계값과 advantage 임계값은 수집 효율에 영향을 주며, moderate threshold가 가장 좋았다. 정책별 10회 stochastic inference와 별도 advantage model도 실시간 계산 비용을 요구한다. 실제 로봇을 완전히 배제한 평가는 아니며, 최종 정책 성능 확인에는 여전히 로봇 rollout이 필요하다.

# 내가 이해한 핵심

이 논문의 핵심은 사람이 더 많은 시연을 하는 것이 아니라, 현재 정책이 사람의 해법을 설명하지 못하는 순간만 골라 가르치는 것이다. UMI를 정책 진단 센서처럼 사용해 실제 로봇 개입의 비용을 줄이고, 진척도 조건으로 좋은 행동을 구분한다.

# 다음에 연결해서 읽을 논문

- UMI / FastUMI / HiFi-UMI: robot-free demonstration 수집 장치와 데이터 품질
- HG-DAgger: 실제 로봇에서의 human-gated corrective data collection
- RECAP: on-policy experience와 advantage-conditioned policy improvement
- $\pi_{0.5}$: HIL-UMI가 후학습하는 기반 VLA
