---
title: "SkeleWAM: Skeleton World-Action Modeling for Efficient Robotic Manipulation"
date: 2026-10-04
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Juyi Sheng, Hua Wang, Mengyuan Liu"
paper: "https://arxiv.org/abs/2610.02120"
code: ""
project: "https://skelewam-project.github.io/"
thumbnail: "/papers/assets/vla/skelewam-skeleton-world-action-modeling/overview.svg"
---

# 한 줄 요약

SkeleWAM은 RGB-D 장면을 로봇 관절·물체 중심·상호작용점으로 이루어진 희소 3D skeleton으로 바꾸고, 행동과 미래 skeleton을 공동 학습해 57.1M 파라미터로 LIBERO-Plus 85.9%를 달성한다.

# 논문 정보

- 제목: SkeleWAM: Skeleton World-Action Modeling for Efficient Robotic Manipulation
- 저자: Juyi Sheng, Hua Wang, Mengyuan Liu
- 발표: arXiv:2610.02120v1 (2026-10-01), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.02120) · [프로젝트](https://skelewam-project.github.io/)
- 코드/프로젝트: 프로젝트 페이지는 공개되어 있으나 논문 메타데이터에서 코드 저장소는 확인되지 않았다.
- 키워드: world-action model, sparse 3D skeleton, flow matching, interaction points, medoid action consensus

# 핵심 아이디어

비디오나 visual latent를 미래 상태로 예측하면 외형 정보까지 유지하느라 계산량이 커지고, 제어에 필요한 로봇–물체 기하가 암묵적으로만 표현된다. SkeleWAM은 현재 RGB-D와 proprioception에서 로봇 관절, 물체 중심, 접촉 가능 지점을 추출해 공통 robot-centric 3D 좌표계의 sparse skeleton을 만든다. 학습 때는 이 skeleton을 조건으로 action chunk와 미래 skeleton의 flow field를 동시에 예측한다.

추론 때 미래 예측 branch는 제거한다. 대신 서로 다른 Gaussian noise에서 뽑은 행동 후보 가운데 다른 후보들과 평균 거리가 가장 작은 실제 궤적, 즉 medoid를 고르는 Medoid Action Consensus(MAC)를 사용한다. 궤적 평균으로 서로 양립하기 어려운 행동을 섞지 않는다는 점이 핵심이다.

# VLA 관점에서 중요한 이유

이 논문은 WAM의 “세계”를 픽셀이나 대형 latent가 아니라 조작에 직접 필요한 기하 상태로 좁힌다. 57.1M 파라미터로 2B급 Cosmos-Policy보다 LIBERO-Plus 평균이 높다는 결과는, VLA/WAM의 규모보다 올바른 state abstraction이 중요한 구간이 있음을 보여준다. 동시에 language-conditioned action generation과 future dynamics supervision을 유지해 단순 keypoint policy와도 구분된다.

# Robot / Embodied Setting

- 시뮬레이션: LIBERO-Plus 전체 10,030개 변형, camera·robot·language·light·background·noise·layout 7종 perturbation에 zero-shot 평가.
- 관찰: RGB-D, robot proprioception, language instruction. 물체 landmark는 frozen perception network, 로봇 keypoint는 forward kinematics로 얻는다.
- 실제 로봇: ARX R5, 외부 및 손목 RealSense 카메라.
- 실제 task: drawer 열기/닫기, block 쌓기, bowl 쌓기, drawer에 block 넣기. 방법·task당 20회.

# Method

1. Frozen perception과 forward kinematics가 현재 장면을 물체 중심·상호작용점·로봇 관절의 3D skeleton으로 변환한다.
2. Language encoder가 지시를 condition token으로 만든다.
3. World expert는 현재/future skeleton token을, action expert는 noisy action token을 처리한다. 두 예측 branch는 현재 skeleton에는 attend하지만 서로 직접 attend하지 않는다.
4. Action과 future skeleton에 독립적인 flow-matching loss를 적용하고, 두 loss가 공유 world representation을 학습시킨다.
5. 추론에서는 future branch를 버리고 action 후보 3개 중 MAC medoid를 선택한 뒤 16 step을 실행하고 재관찰한다.

# 핵심 그림

![RGB-D와 로봇 상태를 희소 3D skeleton으로 변환한 뒤 행동과 미래 skeleton을 공동 학습하고 추론에서는 MAC으로 행동을 선택하는 SkeleWAM 구조](/papers/assets/vla/skelewam-skeleton-world-action-modeling/overview.svg)

> 논문 Figure 2와 Sections 3.2–3.5를 바탕으로 재구성했다. 구조 그림을 고른 이유는 dense visual future 대신 sparse interaction geometry를 쓰고, 학습 전용 future branch와 추론용 MAC을 분리하는 설계가 논문의 핵심이기 때문이다. 출처: [논문 Figure 2](https://arxiv.org/html/2610.02120#S3).

입력 RGB-D·proprioception·언어는 frozen perception/forward kinematics를 거쳐 현재 skeleton과 language condition이 된다. 학습에서는 action expert와 future-skeleton expert가 각각 flow field를 예측해 행동 및 기하 동역학 loss를 계산한다. 추론에서는 future branch를 제거하고 여러 action sample 중 medoid를 실행하므로, 세계 예측은 representation 학습을 돕되 deployment 계산 경로에는 남지 않는다.

# Experiments / Results

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓)                              | 제안 방법 |          비교 기준 |    차이 | 출처         |
| ------------------------------------------------------------- | --------: | -----------------: | ------: | ------------ |
| LIBERO-Plus 전체 평균 성공률 (%, ↑)                          |      85.9 | Cosmos-Policy 82.2 |  +3.7%p | 논문 Table 1 |
| LIBERO-Plus camera perturbation 성공률 (%, ↑)                 |      93.4 | Cosmos-Policy 75.8 | +17.6%p | 논문 Table 1 |
| 실제 ARX R5 5개 task 평균 성공률 (%, ↑)                      |      89.0 | Cosmos-Policy 87.0 |  +2.0%p | 논문 Table 2 |
| LIBERO-Plus 평균, future-skeleton supervision (%, ↑)          |      85.9 |   action-only 80.1 |  +5.8%p | 논문 Table 3 |

시뮬레이션 비교는 동일한 LIBERO-Plus perturbation 범주를 사용한 observation-based 방법끼리 해석했다. SkeleWAM은 57.1M 파라미터로 약 2B인 Cosmos-Policy를 앞서지만, layout perturbation에서는 66.6%로 $\pi_{0.5}$의 84.1%보다 낮다. 실제 로봇 표는 모든 방법이 task당 20회씩 평가된 동일 조건이다.

# Limitations / Discussion

희소 skeleton은 외형 변화에는 강하지만 novel spatial layout 일반화는 해결하지 못했다. 물체 중심과 상호작용점 추출은 frozen perception의 품질 및 RGB-D 센서에 의존하며, task-relevant landmark 정의가 새로운 물체·도구·deformable object까지 자동 확장되는지는 검증되지 않았다. 실제 평가는 단일 ARX R5 tabletop setup과 5개 task에 한정된다. MAC은 후보를 여러 번 생성하므로 단일 sample보다 계산량이 늘고, 후보 다수가 같은 잘못된 mode에 모이면 이를 교정할 수 없다.

# 내가 이해한 핵심

SkeleWAM의 강점은 세계 모델을 더 크게 만든 것이 아니라, 예측 대상을 “다음 장면의 모든 픽셀”에서 “행동에 영향을 주는 3D 관계”로 바꾼 데 있다. 미래 skeleton loss는 실행 시 필요 없는 auxiliary dynamics supervision이고, MAC은 stochastic policy의 대표 궤적을 안전하게 고르는 별도 inference 장치다.

# 다음에 연결해서 읽을 논문

- Fast-WAM: 미래 생성 branch를 학습 신호로만 쓸 때의 공통점과 visual/skeleton target 차이를 보기 위해
- Cosmos-Policy: 대형 video foundation model 기반 정책과 parameter-efficiency trade-off를 비교하기 위해
- UniWAM: dense world generation과 physical reasoning을 함께 확장한 반대편 설계를 비교하기 위해
