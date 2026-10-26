---
title: "Coupling Execution Horizon and Sampling Depth in Flow-Matching VLA Policies"
date: 2026-10-26
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Flow Matching"
  - "Inference Efficiency"
venue: "확인 필요"
authors: "Jiabing Yang et al."
paper: "https://arxiv.org/abs/2610.32102"
code: ""
project: "https://jiabingyang01.github.io/Horizon-Depth-VLA/"
thumbnail: "/papers/assets/vla/horizon-depth-coupling-in-flow-matching-vla-policies/overview.svg"
---

# 한 줄 요약

이 논문은 flow-VLA의 solver step 수와 open-loop 실행 길이를 함께 조절해야 하며, 긴 horizon에서는 얕은 sampling이 action 분산을 줄여 더 빠르면서도 오히려 안정적일 수 있음을 보인다.

# 논문 정보

- 제목: Coupling Execution Horizon and Sampling Depth in Flow-Matching VLA Policies
- 저자: Jiabing Yang et al.
- 발표: 확인 필요 (arXiv v1, 2026-10-23)
- 링크: [arXiv](https://arxiv.org/abs/2610.32102) · [HTML](https://arxiv.org/html/2610.32102)
- 프로젝트: [Horizon-Depth-VLA](https://jiabingyang01.github.io/Horizon-Depth-VLA/)
- 키워드: flow matching, sampling depth, execution horizon, action chunking, latency

# 핵심 아이디어

배포 시 두 knob가 있다. sampling depth $N$은 Gaussian noise에서 action chunk까지 velocity field를 몇 번 적분할지 정하고, execution horizon $s$는 그 chunk 중 몇 step을 open loop로 실행한 뒤 다시 관측할지 정한다.

기존에는 $N$과 $s$를 독립적으로 튜닝하지만, 얕은 Euler integration은 action cloud를 centroid 주변으로 수축시킨다. 짧은 $s$에서는 매번 feedback을 받으므로 넓은 sampling diversity가 유리할 수 있지만, 긴 $s$에서는 lateral dispersion이 drift로 누적되어 낮은 $N$의 수축 효과가 regularizer가 된다.

# VLA 관점에서 중요한 이유

few-step sampling을 단순한 정확도–속도 절충으로 보지 않고 control loop의 stochasticity 조절기로 재해석한다. 따라서 policy 재학습이나 distillation 없이도 frozen $\pi_0$, $\pi_0.5$, GR00T의 latency와 success를 함께 개선할 운영점을 찾을 수 있다.

같은 sampler도 replanning 주기에 따라 성능 효과의 부호가 바뀐다는 사실은 VLA benchmark의 inference setting을 모델 성능과 분리해 보고하면 안 된다는 뜻이다.

# Robot / Embodied Setting

- LIBERO: $\pi_0$, $\pi_0.5$, GR00T-N1.7의 horizon–depth factorial evaluation
- RoboTwin 2.0: $\pi_0$, $\pi_0.5$ bimanual tasks
- real robot: Franka manipulation
- sampling: linear probability flow, forward Euler, $N$ function evaluations
- execution: chunk의 앞 $s$ actions를 open loop로 commit한 뒤 재계획

# Method

관측 $o_t$에 조건화한 flow model이 $x^{(0)}\sim\mathcal N(0,I)$에서 시작해 $N$번 Euler update로 action chunk $\hat a_t$를 만든다. 로봇은 앞 $s$ step을 실행하고 $t+s$에서 다시 관측한다.

저자들은 coarse integration의 covariance contraction을 operational variance gain $g(N)=\sqrt{\rho(N)}$으로 나타낸다. $N\ge2$에서 $N$이 작을수록 sample cloud radius가 줄지만 centroid는 거의 보존된다. 따라서 $s$가 길 때 lateral error 누적을 억제하고, $s$가 짧을 때는 useful diversity까지 없앨 수 있다.

# 핵심 그림

![관측에서 flow sampler가 N번 적분해 action chunk를 만들고 s개 action을 실행한 뒤 재계획하며, 짧은 horizon에서는 깊은 sampling, 긴 horizon에서는 얕은 sampling이 유리한 결합 구조](/papers/assets/vla/horizon-depth-coupling-in-flow-matching-vla-policies/overview.svg)

> 그림 2. Flow-VLA의 computational–execution co-design과 sign reversal. 논문 Figure 1–2와 Section III-C를 바탕으로 재구성했다. 출처: [arXiv:2610.32102, Figure 2](https://arxiv.org/html/2610.32102#S3).

구조 그림을 고른 이유는 architecture 자체보다 sampler와 robot execution loop 사이의 결합이 기여이기 때문이다. 입력 관측은 frozen VLA를 조건화하고, $N$번 solver evaluation이 action cloud를 만든 뒤 앞 $s$ step만 물리적으로 실행된다.

짧은 $s$에서는 자주 재관측하므로 깊은 sampling의 diversity를 feedback이 활용한다. 긴 $s$에서는 같은 sample의 lateral dispersion이 오래 누적되므로 $N=2$의 contraction이 low-pass filter처럼 작동한다. 학습 흐름은 바뀌지 않고 추론 설정만 바뀐다.

# Experiments / Results

## 주요 실험 결과

Table I의 동일 model·suite에서 long-horizon deep/shallow 조건을 비교했다. latency speedup은 논문 표 값을 그대로 기록했다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓) | 제안 설정 | 비교 기준 | 차이 | 출처 |
| --- | ---: | ---: | ---: | --- |
| $\pi_0$ LIBERO-Long SR (%, ↑), $s=20$ | $N=2$: 90.5 | $N=10$: 86.9 | +3.6%p | Table I |
| $\pi_0$ LIBERO 평균 SR (%, ↑), $s=20$ | $N=2$: 95.5 | $N=10$: 92.9 | +2.6%p | Table I |
| $\pi_0$ amortized latency (ms/action, ↓), $s=20$ | $N=2$: 2.6 | $N=10$: 3.6 | -1.0 ms, 1.38× | Table I |
| $\pi_0.5$ LIBERO 평균 SR (%, ↑), $s=10$ | $N=2$: 98.0 | $N=10$: 97.6 | +0.4%p | Table I |
| GR00T LIBERO-Object SR (%, ↑), $s=8$ | $N=2$: 99.1 | $N=4$: 98.9 | +0.2%p | Table I |
| RoboTwin $\pi_0$ 전체 SR (%, ↑) | $(s,N)=(25,2)$: 45.7 | $(10,10)$: 37.0 | +8.7%p | Section IV-B |

중요한 대조는 sign reversal이다. $\pi_0$ LIBERO-Long에서 짧은 $s=5$일 때 $N=2$는 78.5%, $N=10$은 81.2%로 -2.7%p지만, 긴 $s=20$에서는 +3.6%p로 부호가 뒤집힌다. 조건이 다른 값은 한 행에서 직접 baseline처럼 섞지 않았다.

# Limitations / Discussion

효과는 frozen checkpoint의 action cloud geometry와 predictive horizon에 의존한다. $N=1$은 구조적 contraction이 아니라 field approximation error를 만들어 같은 법칙을 따르지 않으며, ceiling task에서는 interaction contrast가 작거나 불명확하다.

얕은 sampling이 항상 안전한 것은 아니다. 빠른 replanning, multimodal obstacle avoidance, 긴 예측 horizon 밖 실행에서는 diversity 손실이나 open-loop error가 커질 수 있다. 실제 배포는 sensor latency, action rate, safety controller까지 포함해 $s,N$을 함께 검증해야 한다.

# 내가 이해한 핵심

solver step은 단지 계산량이 아니다. 매 replanning 때 새로 뽑는 action distribution의 폭을 조절한다. 그래서 **얼마나 오래 눈을 감고 실행할지**와 **얼마나 넓은 행동 표본을 만들지**를 한 쌍으로 맞춰야 한다.

# 다음에 연결해서 읽을 논문

- RAVEL: rolling/asynchronous inference로 perception–action latency를 줄이는 다른 operational design이다.
- Decoupled Early Exits: task-dependent compute allocation을 학습하는 접근과 training-free knob를 비교할 수 있다.
- GeoAAC: action chunk 실행 길이를 geometry로 조절하는 방법과 sampling-depth coupling을 연결해 볼 수 있다.
