---
title: "Co-VLA: Consensus-based Federated Training for Vision-Language-Action Models"
date: 2026-09-18
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Federated Learning"
  - "Parameter-Efficient Fine-Tuning"
venue: "확인 필요"
authors: "Haolong Li, Guner Dilsad Er, Michael Muehlebach, Joerg Stueckler"
paper: "https://arxiv.org/abs/2609.19923"
code: ""
project: ""
---

# 한 줄 요약

Co-VLA는 서로 다른 로봇·과업·기관에 분산된 원본 데이터를 공유하지 않고도 ADMM 기반 consensus optimization으로 범용 VLA를 공동 학습해 중앙집중 학습에 가까운 성능을 낸다.

# 논문 정보

- 제목: Co-VLA: Consensus-based Federated Training for Vision-Language-Action Models
- 저자: Haolong Li, Guner Dilsad Er, Michael Muehlebach, Joerg Stueckler
- 발표: 확인 필요 (arXiv v1, 2026-09-17)
- 링크: [arXiv](https://arxiv.org/abs/2609.19923), [HTML](https://arxiv.org/html/2609.19923v1)
- 코드/프로젝트: 공개 여부 확인 필요
- 키워드: federated VLA, consensus optimization, ADMM, LoRA, sparse rank adaptation, heterogeneous robot data

# 핵심 아이디어

로봇 데이터는 서로 다른 기관, embodiment, 장면과 과업에 자연스럽게 흩어져 있어 한곳에 모으기 어렵다. Co-VLA는 각 client가 로컬 데이터로 학습하되 중앙의 global model과 합의하도록 Alternating Direction Method of Multipliers(ADMM) 목적을 구성한다.

같은 consensus 관점으로 full-model training과 parameter-efficient fine-tuning을 모두 지원한다. LoRA에서는 저랭크 factor 자체에 합의를 걸고, SoRA를 결합하면 client별로 불필요한 rank를 줄여 sparse rank-adaptive adapter도 학습할 수 있다.

# VLA 관점에서 중요한 이유

VLA scaling의 핵심 자원인 robot trajectory는 웹 데이터처럼 쉽게 중앙집중화하기 어렵다. Co-VLA는 원본 데이터 이동 없이 여러 데이터 소유자가 하나의 정책을 학습하는 경로를 보여주며, 데이터 소유권·전송 비용·기관 간 협업이라는 실제 배포 문제를 모델 학습 알고리즘에 포함한다.

또한 비독립·비동일분포(non-i.i.d.) client와 서로 다른 데이터 규모를 다루고, SmolVLA와 X-VLA 및 full training과 LoRA에 걸쳐 하나의 방법을 사용한다는 점에서 특정 VLA에 종속된 시스템보다 범용적이다.

# Robot / Embodied Setting

- 모델: SmolVLA, X-VLA
- 시뮬레이션: LIBERO-Spatial, Object, Goal, Long
- 연합 설정: LIBERO 과업을 10개 client에 분산
- 실제 데이터: Open X-Embodiment의 Berkeley Bridge(WidowX), FMB(Franka), Jaco Play(Jaco 2), Fractal(Google Robot), 총 402,753 training transitions
- 실제 closed-loop 과업: stack, pick-and-place, sort, fold

# Method

각 client는 로컬 VLA loss를 최소화하면서 자신의 parameter가 global consensus variable과 일치하도록 augmented Lagrangian penalty를 받는다. 중앙 server는 client update를 모아 global variable과 dual variable을 갱신한다. 단순 평균보다 client drift를 명시적으로 제어해 이질적인 데이터 분포를 다룬다.

LoRA fine-tuning에서는 완성된 weight update를 평균내기보다 low-rank factor에 직접 consensus를 적용한다. SoRA 변형은 학습 가능한 gate로 rank를 pruning해 client 간 공통 adapter를 더 작은 parameter budget으로 만든다.
# 핵심 그림

![서로 다른 로봇 클라이언트가 로컬 VLA를 학습하고 ADMM의 primal, dual, consensus 갱신을 거쳐 공통 VLA를 만드는 Co-VLA 구조](/papers/assets/vla/co-vla-consensus-based-federated-training-for-vision-language-action-models/overview.svg)

> 그림 1. Co-VLA의 동기식 federated VLA 학습 흐름. 원 논문 [Figure 1, Algorithm 1, 식 (1)–(4)](https://arxiv.org/html/2609.19923v1)을 바탕으로 재구성했다. 원본 Figure 1은 전체 연합 학습 구성을 가장 직접적으로 보여 주므로 구조 그림을 선택했고, 재구성본에는 논문의 핵심 차별점인 dual-variable 누적과 LoRA/SoRA consensus까지 함께 표시했다.

입력은 각 기관·로봇이 보유한 서로 다른 로컬 궤적 $\mathcal{D}_i$이고, 각 client는 현재 global parameter $\mathbf{z}^k$를 받은 뒤 로컬 action-supervision loss와 $\frac{\rho}{2}\lVert\mathbf{x}_i-\mathbf{z}^k+\mathbf{u}_i\rVert_2^2$를 함께 최소화한다. 여기서 dual variable $\mathbf{u}_i$는 이전 round부터 누적된 local-global 불일치를 기억하고, $\rho$는 합의 강도를 조절한다.

학습 때 server는 over-relaxed local parameter $\widehat{\mathbf{x}}_i^{k+1}$와 dual variable을 모아 $\mathbf{z}^{k+1}=\frac{1}{N}\sum_i(\widehat{\mathbf{x}}_i^{k+1}+\mathbf{u}_i^k)$로 공통 모델을 갱신한 뒤 다시 모든 client에 방송한다. Full-model이면 $\mathbf{x}$가 전체 VLA parameter이고, LoRA이면 $\{\mathbf{A},\mathbf{B}\}$, SoRA이면 gate $\mathbf{g}$까지 consensus 대상이다. SoRA의 server 단계에는 soft threshold가 추가돼 0이 된 rank component를 제거한다.

추론 때는 이 연합 학습 loop나 server가 필요하지 않다. 합의된 global VLA 하나가 관측·언어 지시를 받아 action chunk를 출력한다. FedAvg가 독립적으로 drift한 parameter를 단순 평균하는 것과 달리, Co-VLA는 학습 중 local model이 global variable에 가까워지도록 primal penalty와 dual correction을 명시적으로 둔다는 점이 핵심이다.

# Experiments / Results

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓) | Co-VLA | 비교 기준 | 차이 | 출처 |
| --- | ---: | ---: | ---: | --- |
| X-VLA LoRA, LIBERO-Object 성공률 (900 communication rounds, %, ↑) | 97.0 | FlexLoRA 62.0 | +35.0%p | Table IV |
| X-VLA LoRA, LIBERO-Long 성공률 (900 communication rounds, %, ↑) | 78.0 | 중앙집중 학습 74.0 | +4.0%p | Table IV |
| SO-101 실제 Stack 성공률 (40 trials, %, ↑) | 97.5 | DiLoCo 67.5 | +30.0%p | Table VII |
| 혼합 실제 데이터 open-loop 상대 action error (중앙집중 대비 평균, %, ↓) | +1.3 | FedAvg +4.3 | -3.0%p | Table VI |

첫 행의 FlexLoRA는 Co-VLA와 같은 900 communication-round budget이다. 논문은 FlexLoRA를 2,500 rounds까지 늘려도 Object 성공률이 70.0%에 그쳤다고 보고하므로, 이 차이는 단순히 더 긴 통신·학습에서 나온 결과가 아니다. 실제 SO-101 실험도 모든 방법을 과업당 40회, 물체 위치를 demonstration보다 약 1–2 cm 이동한 같은 조건에서 비교했다.

SmolVLA를 처음부터 학습한 LIBERO 성공률에서 Co-VLA는 Spatial/Object/Goal/Long 각각 0.80/0.91/0.92/0.71을 기록해 중앙집중 학습 0.81/0.95/0.94/0.70에 가까웠다. FedAvg는 0.76/0.89/0.91/0.63이었다.

X-VLA LoRA에서는 Co-VLA가 0.88/0.97/0.93/0.78로 중앙집중 학습 0.87/0.98/0.93/0.74와 대등했다. FlexLoRA를 같은 communication budget으로 학습한 결과 0.64/0.62/0.55/0.54였고, 2,500 round까지 늘려도 0.74/0.70/0.64/0.54에 그쳤다.

서로 다른 네 실제 로봇 데이터의 open-loop action error는 중앙집중 학습 대비 평균 +1.3%로, DiLoCo +2.0%, FedAvg +4.3%보다 격차가 작았다. 논문은 실제 closed-loop에서도 어려운 stacking 과업에서 federated baseline보다 높은 성공률을 보고한다.

# Limitations / Discussion

원본 데이터를 공유하지 않는다고 해서 formal privacy가 자동으로 보장되는 것은 아니다. gradient나 parameter update에서 정보가 새어 나올 가능성, secure aggregation, differential privacy는 별도 문제다.

중앙집중 baseline보다 client별 최적화 step과 전체 처리 sample이 많고 수백~수천 communication round가 필요하다. client가 느리거나 불안정한 실제 네트워크, 비동기 참여, 훨씬 큰 VLA에서의 통신 비용은 충분히 검증되지 않았다. 실제 로봇 평가는 제한된 과업이며, action space 차이를 공통 표현으로 정렬하는 전처리에도 의존한다.

# 내가 이해한 핵심

VLA의 다음 scaling 축은 더 큰 단일 데이터셋만이 아니라, 서로 데이터를 내놓기 어려운 로봇 집단이 얼마나 안정적으로 하나의 정책에 합의하느냐이다. Co-VLA는 이 문제를 단순 parameter averaging이 아닌 최적화 제약으로 다룬다.

# 다음에 연결해서 읽을 논문

- FedAvg / DiLoCo: 일반 federated optimization과 outer-loop 업데이트
- FLoRA / FlexLoRA: 연합 환경의 low-rank adapter 집계
- SmolVLA / X-VLA: Co-VLA가 검증한 기반 정책 구조
- Open X-Embodiment: 기관·로봇별 이질성이 큰 분산 데이터의 출처
