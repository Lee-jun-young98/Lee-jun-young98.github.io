---
title: "GeoAAC: Geometry-Based Adaptive Action Chunking from Denoising Trajectories in VLA Policies"
date: 2026-09-18
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Flow Matching"
  - "Action Chunking"
venue: "확인 필요"
authors: "Xin Chen, Sen Chen, Yujuan Ding, Jian Liu, Guoqing Wang, Wei Ye, Heng Tao Shen, Yi Bin"
paper: "https://arxiv.org/abs/2609.20776"
code: ""
project: ""
---

# 한 줄 요약

GeoAAC는 flow-based VLA의 한 번의 denoising 과정에서 얻는 궤적 기하를 신뢰도 신호로 사용해, 정밀 조작에서는 짧게 재계획하고 연속 동작에서는 길게 실행하는 action horizon을 학습 없이 선택한다.

# 논문 정보

- 제목: GeoAAC: Geometry-Based Adaptive Action Chunking from Denoising Trajectories in VLA Policies
- 저자: Xin Chen, Sen Chen, Yujuan Ding, Jian Liu, Guoqing Wang, Wei Ye, Heng Tao Shen, Yi Bin
- 발표: 확인 필요 (ICRA 2027 투고, arXiv v1, 2026-09-17)
- 링크: [arXiv](https://arxiv.org/abs/2609.20776), [HTML](https://arxiv.org/html/2609.20776v1)
- 코드/프로젝트: 공개 여부 확인 필요
- 키워드: adaptive action chunking, flow matching, denoising trajectory, uncertainty, closed-loop control

# 핵심 아이디어

VLA의 action chunk를 몇 step까지 실행한 뒤 다시 관찰할지는 연속성과 폐루프 반응성 사이의 선택이다. 고정 horizon은 탐색·정렬·파지·운반처럼 요구가 다른 단계 모두에 같은 open-loop 길이를 강제한다.

GeoAAC는 여러 행동을 반복 샘플링해 분산을 재는 대신, 단 한 번의 Flow Matching 생성 과정에서 action prefix별 denoising trajectory의 기하 변화량을 계산한다. 이 변화가 커지는 지점을 예측 신뢰도가 떨어지는 경계로 보고 horizon-wise geometric profile을 구성해 실행 길이를 동적으로 결정한다.

# VLA 관점에서 중요한 이유

최근 flow-based VLA의 성능은 action 생성 품질뿐 아니라 생성된 chunk를 실제로 얼마나 실행하느냐에 크게 좌우된다. GeoAAC는 모델 재학습이나 별도 horizon predictor 없이 policy 내부 생성 궤적을 제어 신뢰도로 재사용한다.

이는 VLA 추론을 단순히 action을 출력하는 과정이 아니라, 언제 다시 보고 판단해야 하는지까지 제공하는 과정으로 본다. 특히 multimodal action에서 샘플 간 차이를 곧바로 불확실성으로 해석할 때 생기는 문제를 피한다.

# Robot / Embodied Setting

- 기반 정책: GR00T N1.5, $\pi_{0.5}$
- 시뮬레이션: LIBERO 4 suites, LIBERO-Pro 위치 변화, RoboCasa365 18개 과업
- 실제 로봇: 세 개 manipulation task
- 비교: 여러 fixed horizon, multi-sampling uncertainty(MS), self-attention 기반 적응형 방법(SA)
- 설정: 추가 학습 없이 한 번의 flow generation에서 horizon 선택

# Method

Flow Matching denoising의 중간 상태를 연결한 trajectory를 action prefix마다 관찰하고, prefix 간 기하 변화가 예측 불확실성과 양의 상관을 보인다는 점을 이용한다. 각 horizon 위치의 상대적 변화와 누적 분포를 계산해 어느 prefix까지 안정적으로 실행할지 정한다.

짧은 horizon은 자주 관찰해 정렬·배치 같은 정밀 단계의 오차를 줄이고, 긴 horizon은 운반·밀기·회전 같은 연속 동작의 부드러움과 추론 효율을 보존한다. 별도 모델, 추가 supervision, 복수 action sampling이 필요 없다는 것이 실용적 장점이다.

# Experiments / Results

GR00T N1.5의 LIBERO 평균 성공률은 GeoAAC 95.5%로, 최선의 고정 horizon 94.7%, MS 94.6%, SA 93.8%보다 높았다. $\pi_{0.5}$에서도 평균 98.0%로 고정 horizon 97.1%를 넘었고, LIBERO-Long은 93.2%에서 96.4%로 향상됐다.

분포 이동이 있는 LIBERO-Pro 평균은 고정 30.9%, SA 33.8%, MS 35.2%, GeoAAC 36.2%였다. RoboCasa365 18개 과업 평균은 GeoAAC 75.1%로 가장 좋은 고정 horizon 66.4%와 MS 71.1%를 앞섰다. 실제 로봇 세 과업 평균 성공률은 fixed-50의 53.3%에서 74.4%로 증가했다.

선택된 horizon도 의미 있는 패턴을 보였다. Align과 Place/release는 각각 평균 7.94, 7.77로 짧았고, Transport·Push/pull·Turn은 9.56, 9.19, 10.52로 길었다.

# Limitations / Discussion

방법은 Flow Matching의 denoising trajectory에 의존하므로 autoregressive token VLA나 diffusion 이외의 정책에 바로 적용할 수 없다. 내부 기하 변화와 실제 실패 위험의 상관은 경험적이며, 접촉·안전 제약을 직접 모델링하지 않는다.

일부 RoboCasa 개별 과업에서는 fixed horizon이나 MS/SA가 더 높았다. 따라서 평균 성능 향상이 모든 과업에서 우월함을 뜻하지 않는다. 실제 로봇 평가는 세 과업에 한정되며, horizon 변경이 latency·제어 주기·안전성에 미치는 시스템 수준 분석도 더 필요하다.

# 내가 이해한 핵심

행동 생성 과정에는 최종 action 외에도 그 action을 얼마나 믿고 오래 실행할지에 대한 단서가 남아 있다. GeoAAC는 denoising 경로의 흔들림을 읽어 open-loop와 closed-loop 사이를 매 순간 조절한다.

# 다음에 연결해서 읽을 논문

- GR00T N1.5: GeoAAC가 평가한 범용 humanoid VLA
- $\pi_{0.5}$: flow-based action expert와 open-world generalization
- Adaptive Action Chunking 관련 MS·self-attention 방법: uncertainty proxy 비교
- Diffusion Policy / ACT: 고정 action chunk가 제어에 미치는 영향
