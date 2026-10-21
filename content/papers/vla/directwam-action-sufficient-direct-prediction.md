---
title: "De-Diffusing WAMs: Action-Sufficient Direct Prediction for Robot Control"
date: 2026-10-21
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "World Model"
  - "Distillation"
venue: "확인 필요"
authors: "Shaoyi Zheng, Zhongtao Jiang, Yue Peng, Wenbo Lu, Shunchi Zhang, Xi Wang, Shengji Wan"
paper: "https://arxiv.org/abs/2610.28122"
code: ""
project: ""
thumbnail: "/papers/assets/vla/directwam-action-sufficient-direct-prediction/overview.svg"
---

# 한 줄 요약

미래 영상의 픽셀·latent 충실도 대신 그 미래가 올바른 행동을 유도하는지를 직접 학습 신호로 사용해 diffusion WAM을 deterministic 1-step future-to-action policy로 바꾼다.

# 논문 정보

- 제목: De-Diffusing WAMs: Action-Sufficient Direct Prediction for Robot Control
- 저자: Shaoyi Zheng 외 6명
- 발표: 확인 필요 (arXiv v1, 2026-10-20; cs.RO 신규 목록 2026-10-21)
- 링크: [arXiv](https://arxiv.org/abs/2610.28122)
- 라이선스: CC BY 4.0
- 키워드: cascade WAM, one-step prediction, action-sufficient distillation, latency, robot control

# 핵심 아이디어

저자들은 cascade WAM에서 video noise를 바꿔도 downstream action 다양성이 크게 줄어든다는 점을 측정한다. RoboTwin에서는 video variance 기여가 6.6%인데 action 쪽에서는 0.030%로 축소된다. 따라서 제어에 필요하지 않은 stochastic video detail까지 반복 denoising할 이유가 약하다고 본다.

DirectWAM은 먼저 demonstrated future를 조건으로 1-step action model을 학습하고 고정한다. 다음으로 student future predictor가 만든 latent를 이 action model에 통과시킨 뒤 demonstration action error를 future predictor까지 역전파한다. 선택적 future reconstruction loss는 latent가 완전히 불투명한 control code로 붕괴하지 않도록 anchor 역할을 한다.

# VLA 관점에서 중요한 이유

WAM의 미래 예측을 최종 산출물이 아니라 action을 위한 중간 표현으로 보면, “좋은 미래”의 기준도 시각적 유사도에서 action sufficiency로 바뀐다. 이 논문은 explicit future interface를 유지하면서도 iterative diffusion inference는 제거할 수 있음을 보인다.

이는 WAM 가속을 단순 step truncation이나 generative trajectory 모사로 보지 않고, downstream control consequence를 보존하는 model conversion으로 정의한다. 미래가 사람이 볼 수 있는 설명성을 유지하면서도 28배 빨라졌다는 점도 중요하다.

# Robot / Embodied Setting

- base cascade: LingBot-VA video expert → inverse/action dynamics expert
- simulation: RoboTwin 2.0 전체 50 tasks, task당 50 episodes; LIBERO 4 suites, task당 100 episodes
- real robot: Galaxea A1 arm, gripper, external RealSense D435 + wrist RealSense D405
- real tasks: Grasp Banana, Pouring Water, Place Teapot
- real training/evaluation: task당 50 demonstrations, 방법별 task당 20 trials
- comparison: iterative LingBot-VA teacher, naive step reduction, Flash-WAM

# Method

1단계에서는 ground-truth future representation을 조건으로 single-evaluation action model $G_\psi$를 학습한다. 2단계에서는 이를 고정하고 future predictor $F_\theta$가 스스로 만든 미래를 action model에 넣는다.

$$
\mathcal L_{\mathrm{ASD}}=
\mathbb E_{\mathcal D}\left[
\ell_{\mathrm{act}}\left(G_\psi(F_\theta(h_t),h_t),a^*_{t:t+K-1}\right)
\right].
$$

이 loss는 student future의 adequacy를 latent distance가 아니라 그로부터 복원된 action chunk의 오차로 평가한다. 선택적 reconstruction term을 더하면 action-sensitive 방향은 자유롭게 바꾸면서도 전반적 장면 구조는 보존한다. 배포 때는 future와 action stream이 각각 한 번만 평가되는 deterministic cascade다.

# 핵심 그림

![현재 관측에서 1-step 미래 latent를 예측하고 고정된 1-step action model을 통해 행동 오차를 미래 예측기까지 역전파하는 DirectWAM 학습 구조](/papers/assets/vla/directwam-action-sufficient-direct-prediction/overview.svg)

> 그림 1. DirectWAM의 2단계 action-sufficient distillation과 1-step 배포 흐름. 논문 Figure 1, Equation 2, Section 3.3을 바탕으로 직접 재구성했다. 출처: [arXiv:2610.28122](https://arxiv.org/html/2610.28122).

구조 그림을 고른 이유는 iterative teacher를 단순히 한 step으로 자르는 것과, action consequence를 통해 새로운 direct mapping을 학습하는 차이를 가장 분명히 보여주기 때문이다. 입력은 현재 관측·instruction·robot state이고 중간 출력은 decodable future latent다.

학습 1단계는 ground-truth future로 action decoder를 먼저 1-step화한다. 2단계는 student future를 decoder에 통과시켜 action loss를 future predictor로 전달한다. 추론에서는 두 module을 한 번씩 실행해 action chunk를 내며, optional reconstruction loss만 학습 시각적 anchor로 작동한다.

# Experiments / Results

## 주요 실험 결과

아래 값은 논문 Table 2–3과 Figure 4에서 직접 대조했다. 같은 benchmark·step budget 안의 성공률 차이는 %p로 계산했다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓) | 제안 방법 | 비교 기준 | 차이 | 출처 |
| --- | ---: | ---: | ---: | --- |
| RoboTwin 2.0 평균 성공률 (%, ↑) | 85.4 | Flash-WAM 78.2 | +7.2%p | Table 2, 1/1 step |
| RoboTwin Randomized 성공률 (%, ↑) | 83.7 | Flash-WAM 74.2 | +9.5%p | Table 2, 1/1 step |
| LIBERO 평균 성공률 (%, ↑) | 97.1 | naive 1/1 86.4 | +10.7%p | Table 2 |
| model-side latency speedup (×, ↑) | 28.0× | LingBot-VA 1.0× | +27.0× | Figure 4, teacher 5,042 ms |
| real Pouring Water 성공률 (%, ↑) | 55 (11/20) | Flash-WAM 10 (2/20) | +45%p | Table 3 |
| real Place Teapot 성공률 (%, ↑) | 60 (12/20) | Flash-WAM 40 (8/20) | +20%p | Table 3 |

DirectWAM은 full iterative teacher의 RoboTwin 평균 90.7%보다는 5.3%p 낮지만 28배 빠르다. real task에서는 teacher와 동률이거나 Pouring Water에서 10%p 높았고, 동일 1-step 구조의 Flash-WAM보다 실패가 많은 두 task에서 뚜렷하게 강했다.

# Limitations / Discussion

action sufficiency는 고정한 downstream action model $G_\psi$에 상대적이다. decoder나 action space가 바뀌면 무엇을 보존해야 하는지도 달라질 수 있다. LIBERO의 Flash-WAM 수치는 checkpoint 부재로 원 논문 인용값이며 strict matched reproduction이 아니다.

real-world 평가는 한 arm과 세 task, 각 20회뿐이다. 1-step 미래가 visually decodable하다는 증거는 제공되지만, rare failure나 장기 horizon에서 사람이 해석할 수 있는 counterfactual quality까지 보장하지는 않는다.

# 내가 이해한 핵심

핵심은 “미래 영상을 더 정확히 만들면 행동도 좋아진다”는 proxy를 버리고, 미래 표현을 실제 action decoder가 필요로 하는 정보의 운반체로 직접 최적화하는 것이다. WAM의 설명 가능한 중간 미래는 남기되 그 미래를 만드는 계산 방식은 deterministic하게 바꾼다.

# 다음에 연결해서 읽을 논문

- Flash-WAM: generative process distillation과 action-sufficient distillation의 직접 비교 대상이다.
- Fast-WAM: 명시적 test-time future prediction을 제거하는 다른 효율화 방향이다.
- Causal Analysis of Robot Foundation Models Enables Efficiency Gains: control 성능에 실제로 필요한 계산을 intervention으로 찾는 관점이 맞닿는다.
