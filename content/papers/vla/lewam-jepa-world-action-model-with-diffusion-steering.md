---
title: "LeWAM: A JEPA World Action Model with Diffusion-Steering-Based MPC"
date: 2026-10-11
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Shashank Hegde, Alexander Popov, Elie Aljalbout, Nikolai Smolyanskiy"
paper: "https://arxiv.org/abs/2610.12407"
code: ""
project: ""
thumbnail: "/papers/assets/vla/lewam-jepa-world-action-model-with-diffusion-steering/overview.svg"
---

# 한 줄 요약

LeWAM은 픽셀 복원 없이 JEPA latent에서 forward·backward·inverse dynamics와 policy를 한 transformer로 학습하고, action이 아니라 flow-policy의 noise를 MPC로 탐색해 Can 성공률을 23.0%에서 78.8%로 회복한다.

# 논문 정보

- 제목: LeWAM: A JEPA World Action Model with Diffusion-Steering-Based MPC
- 저자: Shashank Hegde, Alexander Popov, Elie Aljalbout, Nikolai Smolyanskiy
- 발표: arXiv:2610.12407v1 (2026-10-08), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.12407) · [HTML 원문](https://arxiv.org/html/2610.12407)
- 코드/프로젝트: 원문에 공개 링크 미기재
- 키워드: world-action model, JEPA, rectified flow, model predictive control, diffusion steering

# 핵심 아이디어

재구성 기반 WAM은 제어와 무관한 배경·texture도 latent에 보존한다. LeWAM은 ViT-tiny encoder의 384차원 latent를 SIGReg로 붕괴 없이 학습하고, pixel decoder 없이 하나의 bidirectional transformer가 입력 mask에 따라 네 역할을 수행하게 한다. Forward/Backward는 latent dynamics를, Inverse/Policy는 rectified-flow action을 학습하므로 표현 자체가 동역학과 행동에 함께 맞춰진다.

추론의 두 번째 아이디어는 diffusion steering이다. 일반 action-space MPC가 world-model 오류를 이용하는 비현실적 action으로 빠지는 문제를 피하려고, planner가 action $a$ 대신 policy sampler의 초기 noise $\epsilon$을 최적화한다. 매 후보는 $a=g(\epsilon;z)$를 거쳐 policy가 학습한 action manifold 안에 남는다.

# VLA 관점에서 중요한 이유

LeWAM은 WAM에 거대한 video generator가 필수라는 전제를 약화한다. 중요한 것은 픽셀 충실도가 아니라 action과 state 변화에 정렬된 latent이며, 이 latent가 policy와 planner 모두에 쓰일 수 있음을 보여준다. 특히 generative policy의 noise space를 planning interface로 사용하면 별도 value model 없이도 test-time 계산으로 행동을 개선할 수 있다.

# Robot / Embodied Setting

- simulation: PushT와 robomimic Lift, Can, Square, ToolHang, Transport.
- 데이터: human demonstration에 task-irrelevant visual distractor를 추가.
- 모델: 41M LeWAM, 224×224 입력, 5-step action chunk, 8-step Euler flow integration.
- 평가: closed loop는 모델당 5 training seeds × 50 evaluation seeds, task당 250 rollouts.
- planning: horizon 5, iteration당 64 candidates × 3 iterations; demonstration에서 검색한 goal latent 사용.

# Method

1. 각 frame을 shared ViT-tiny/14가 하나의 384차원 latent로 압축하고 SIGReg가 분포 붕괴를 막는다.
2. 8-layer bidirectional transformer가 frame latent 3개와 action token 3개를 받는다.
3. Forward/Backward mode는 masked 과거·미래 latent를 MSE로 복원하고, Inverse/Policy mode는 rectified-flow velocity $\epsilon-a$를 예측한다.
4. 추론 시 policy는 $a=g(\epsilon;\mathbf z_t)$로 action chunk를 생성한다.
5. Diffusion steering은 $\epsilon_{1:H}$를 탐색하고, forward model rollout의 마지막 latent와 goal latent 사이 거리 $\|\hat z_H-z_g\|_2$를 최소화한다.
6. 후보 noise를 반지름 $\sqrt A$의 typical-set sphere로 projection해 저온·mode-seeking collapse를 막는다.

# 핵심 그림

![영상이 JEPA latent로 압축되고 네 학습 모드와 noise-space MPC를 거쳐 action이 생성되는 LeWAM 구조](/papers/assets/vla/lewam-jepa-world-action-model-with-diffusion-steering/overview.svg)

> 논문 Figure 1–2와 Section 4를 바탕으로 재구성. 출처: [arXiv HTML, Figure 1–2](https://arxiv.org/html/2610.12407). 학습의 네 masking mode와 추론의 diffusion-steering loop를 한 흐름으로 합쳤다.

구조 그림을 고른 이유는 decoder-free latent 학습과 noise-space planning이 논문의 두 핵심 기여이기 때문이다. 입력 frame은 encoder를 거쳐 단일 latent가 되고, 같은 transformer가 mask에 따라 dynamics 또는 action을 예측한다. 학습에서는 네 loss가 encoder까지 함께 shaping하지만, 추론에서는 policy noise 후보를 action으로 decode하고 forward rollout의 goal distance로 반복 선택한다. $a=g(\epsilon;z)$가 planner를 policy support 안에 묶는 연결고리다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)       | 제안 방법 |            비교 기준 |    차이 | 출처         |
| ------------------------------------ | --------: | -------------------: | ------: | ------------ |
| Can, DS-CEM, $\sqrt A$ projection    |      78.8 | projection 없음 23.0 | +55.8%p | 원문 Table 4 |
| Square, DS-CEM, $\sqrt A$ projection |      87.2 | projection 없음 75.0 | +12.2%p | 원문 Table 4 |
| Lift, DS-CEM, $\sqrt A$ projection   |      97.6 | projection 없음 93.0 |  +4.6%p | 원문 Table 4 |
| Lift, four-mode LeWAM policy         |      94.0 |   backward 제거 88.0 |  +6.0%p | 원문 Table 3 |

동일한 LeWAM과 DS-CEM 예산에서 projection만 바꾼 Table 4가 가장 직접적인 비교다. Can에서 +55.8%p라는 큰 차이는 noise norm이 학습 시 Gaussian의 typical set을 벗어나면 flow head가 사실상 낮은 temperature로 동작한다는 설명을 뒷받침한다. 원문 Figure 5의 전체 평균값은 텍스트 표로 제공되지 않아 임의로 판독하지 않았으며, 저자 결론인 action-space MPC의 3–8% 붕괴만 정성 결과로 남긴다.

# Limitations / Discussion

- 실제 로봇이 아니라 소규모 simulation benchmark와 human demonstration에서만 검증됐다.
- goal latent를 demonstration에서 검색해야 하므로 open-ended language goal이나 unseen goal에는 바로 적용하기 어렵다.
- sampling MPC는 느리고 horizon이 길어질수록 forward-model 오차가 누적된다.
- Can에서는 DS-CEM이 raw policy 82.8%보다 78.8%로 낮아 planning이 항상 이득은 아니다.
- single-vector latent는 fine-grained spatial detail이 필요한 장면에서 병목이 될 수 있다.
- 공식 conference venue와 code 공개는 확인되지 않았다.

# 내가 이해한 핵심

이 논문의 요지는 “좋은 world model이면 action을 직접 최적화해도 된다”가 아니라 그 반대에 가깝다. imperfect dynamics는 planner가 쉽게 악용하므로, search variable을 policy가 학습한 noise로 바꾸고 typical set까지 지켜야 한다. representation과 planning constraint를 함께 설계한 점이 핵심이다.

# 다음에 연결해서 읽을 논문

- MiniWAM: 미래 예측 target을 compact control-relevant representation으로 바꾼다.
- PLaW-VLA: frozen predictive latent를 action expert의 조건으로 직접 사용한다.
- Juno: predictive latent가 policy를 압도하지 않도록 information bottleneck을 설계한다.
