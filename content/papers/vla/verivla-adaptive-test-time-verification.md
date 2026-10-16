---
title: "VeriVLA: Adaptive Test-Time Verification for Flow-Based VLAs with Latent World Models"
date: 2026-10-16
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Xueli Sun et al."
paper: "https://arxiv.org/abs/2610.21985"
code: ""
project: ""
thumbnail: "/papers/assets/vla/verivla-adaptive-test-time-verification/overview.svg"
---

# 한 줄 요약

VeriVLA는 flow VLA의 두 초기 action sample이 불안정한 순간만 감지하고, 그때만 latent world model로 여러 후보의 미래 task progress를 예측해 가장 나은 chunk를 실행한다.

# 논문 정보

- 제목: VeriVLA: Adaptive Test-Time Verification for Flow-Based VLAs with Latent World Models
- 저자: Xueli Sun, Yuxiang Lu, Yantong Liu, Xianzhe Fan, Xi Chen, Zhe Liu, Hengshuang Zhao
- 발표: arXiv:2610.21985v1 (2026-10-15), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.21985) · [HTML 원문](https://arxiv.org/html/2610.21985)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: test-time verification, flow-based VLA, latent world model, adaptive sampling, task progress

# 핵심 아이디어

flow-matching VLA는 같은 관측에서도 noise seed에 따라 다른 action chunk를 만든다. VeriVLA는 이를 억제하지 않고 후보 집합으로 활용한다. 두 sample의 chunk 내부 시간 변화와 sample 간 분산을 결합한 training-free trigger가 위험한 의사결정만 찾는다. trigger가 켜지면 $K=10$ 후보를 만들고, JEPA 기반 latent world model이 각 action-conditioned 미래 latent와 task progress 변화 $\Delta p$를 함께 예측해 가장 큰 후보를 선택한다.

# VLA 관점에서 중요한 이유

VLA를 매 step 여러 번 실행해 검증하면 성능은 오르지만 계산량 때문에 실제 제어가 어렵다. 반대로 VLM verifier는 세계 dynamics를 명시적으로 모델링하지 않고, pixel world model은 이미지 생성 비용과 fidelity 병목이 있다. VeriVLA는 불확실한 구간에만 계산을 집중하고 픽셀이 아닌 latent에서 행동 결과를 평가해, frozen VLA를 재학습하지 않고 폐루프 성능을 높이는 test-time scaling 설계를 보여준다.

# Robot / Embodied Setting

- 실제 로봇: AgileX PiperX, 전방 RealSense D455 1대와 손목 D435 2대.
- 실제 태스크: single-arm pen insertion, dual-arm pipetting, dual-arm apple placement.
- 데이터: 태스크당 policy fine-tuning 50 demonstration + verifier 학습용 policy rollout 50 episode.
- 시뮬레이션: RoboTwin 2.0 Clean/Clean2Random, LIBERO 40개 태스크.
- 기반 정책: 실제 환경과 LIBERO의 $\pi_{0.5}$, RoboTwin의 Hy-VLA, LIBERO의 StarVLA-GR00T 추가 평가.
- 배포: 정책과 verifier를 단일 RTX 4090에서 실행, 실제 태스크당 50 trial.

# Method

1. frozen flow VLA가 서로 다른 seed로 두 action chunk를 만든다.
2. Two-Axis Trigger가 chunk 내부 temporal variation과 두 sample 사이 cross-sample variance를 계산한다.
3. 안정적인 상태면 첫 chunk를 바로 실행한다. 임계값을 넘으면 후보를 총 $K=10$개로 늘린다.
4. JEPA verifier가 현재 observation, state, 언어 query와 각 action chunk를 받아 action-conditioned 미래 visual latent와 scalar $\Delta\hat p$를 autoregressive하게 예측한다.
5. $\Delta\hat p$가 가장 큰 chunk를 실행한다. KV cache 재사용, 후보 병렬 생성, latent encoding overlap과 compile로 추가 지연을 줄인다.

# 핵심 그림

![두 초기 action chunk의 불확실성으로 검증을 켜고 latent world model이 열 개 후보의 미래 진척도를 비교하는 VeriVLA 구조](/papers/assets/vla/verivla-adaptive-test-time-verification/overview.svg)

> 논문 Figure 3을 바탕으로 재구성. 출처: [arXiv HTML, Figure 3](https://arxiv.org/html/2610.21985). trigger의 빠른 경로와 latent verifier가 작동하는 선택 경로를 한국어로 분리했다.

이 구조 그림을 고른 이유는 VeriVLA의 효율이 verifier 자체뿐 아니라 “언제 검증하는가”라는 분기에서 나오기 때문이다. 입력 관측·언어·state로 두 후보를 만들고, 두 축의 action variance가 낮으면 추가 계산 없이 실행한다. 높으면 latent world model이 각 후보의 미래 latent와 $\Delta p=p_{t+H}-p_t$를 예측한다. 가장 큰 진척도를 고르는 이 과정은 정책 parameter를 바꾸지 않는 추론 전용 경로다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (단위, ↑/↓)              | VeriVLA |             비교 기준 |      차이 | 출처                |
| ----------------------------------------- | ------: | --------------------: | --------: | ------------------- |
| 실제 3태스크 평균 completion score (%, ↑) |    65.5 |      $\pi_{0.5}$ 50.8 |   +14.7%p | 원문 Table 1        |
| RoboTwin Clean 평균 성공률 (%, ↑)         |    73.6 |           Hy-VLA 66.4 |    +7.2%p | 원문 Table 2        |
| RoboTwin Clean2Random 평균 성공률 (%, ↑)  |    69.6 |           Hy-VLA 62.8 |    +6.8%p | 원문 Table 2        |
| 실제 trigger 1회당 추가 검증 지연 (ms, ↓) |     326 | 최적화 전 수치 미확인 | 비교 불가 | 원문 Figure 5, §4.1 |

실제 completion score는 같은 $\pi_{0.5}$와 같은 세 태스크·50 trial 설정이다. 단순 VLM verifier인 RoboMonkey는 56.0%, pixel world model verifier인 GPC-RANK는 52.8%였다. latent world modeling을 제거하고 progress만 예측하면 65.5%에서 55.2%로 10.3%p 하락해, 시각 encoder만이 아니라 action-conditioned dynamics가 선택에 기여함을 보여준다.

# Limitations / Discussion

- verifier는 후보를 순위화할 뿐 기반 정책이 만들지 못한 행동을 생성하거나 교정할 수 없다.
- 서로 다른 noise seed가 만드는 후보 다양성이 제한적이면 test-time sampling의 이득도 포화된다.
- frozen visual encoder는 미세한 접촉, 물체 구성 변화, 완료 신호를 놓칠 수 있다.
- trigger된 결정마다 326 ms가 추가되어 높은 제어 주기나 매우 동적인 태스크에는 여전히 부담이다.
- 실제 검증은 세 태스크와 하나의 robot embodiment에 집중하며 task progress label을 위한 rollout annotation이 필요하다.

# 내가 이해한 핵심

flow VLA의 stochasticity는 제거해야 할 노이즈이기도 하지만, 위험한 순간에만 여러 번 뽑아 미래 진척도로 고르면 계산 예산을 집중하는 선택지 공간이 된다.

# 다음에 연결해서 읽을 논문

- RoboMonkey: VLM verifier 기반 repeated sampling과 latent dynamics verifier의 차이를 확인할 수 있다.
- FAVOR: 미래 anchor를 이용한 검증과 online recovery를 함께 다루는 방식과 비교하기 좋다.
- PLaW-VLA: predictive latent world model을 행동 생성 내부에 넣는 접근과 외부 verifier로 쓰는 접근을 대비할 수 있다.
