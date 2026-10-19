---
title: "Embodiment-Classifier Guidance: Transferring Frozen VLAs Across Robot Dynamics without Demonstrations"
date: 2026-10-19
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Embodiment Transfer"
venue: "확인 필요"
authors: "Devin Han, Hershraj Niranjani"
paper: "https://arxiv.org/abs/2610.22576"
code: ""
project: ""
thumbnail: "/papers/assets/vla/embodiment-classifier-guidance-for-frozen-vlas/overview.svg"
---

# 한 줄 요약

성공 rollout의 action chunk만으로 source·target robot dynamics를 구분하는 작은 classifier를 학습하고, 그 gradient로 frozen $\pi_0$의 매 denoising step을 조정해 새 embodiment로 옮기는 방법이다.

# 논문 정보

- 제목: Embodiment-Classifier Guidance: Transferring Frozen VLAs Across Robot Dynamics without Demonstrations
- 저자: Devin Han, Hershraj Niranjani
- 발표: 확인 필요 (arXiv v1, 2026-10-15)
- 링크: [arXiv](https://arxiv.org/abs/2610.22576)
- 라이선스: CC BY 4.0
- 키워드: VLA, flow matching, classifier guidance, embodiment transfer, frozen policy

# 핵심 아이디어

$\pi_0$가 source body에서 성공한 action chunk와 target body에서 성공한 chunk를 모아, noisy chunk의 출처를 판별하는 0.8M-parameter transformer를 학습한다. classifier는 image, instruction, task label을 보지 않지만 action chunk에 내재한 end-effector pose와 운동 패턴을 이용한다.

추론 때 frozen $\pi_0$의 velocity field에 classifier log-density-ratio gradient를 더한다. task-level 계획은 원래 VLA가 유지하고, guidance는 target body에서 성공할 가능성이 높은 chunk 모양으로 sampling trajectory를 조금씩 민다. target transfer task의 demonstration이나 $\pi_0$ weight update는 필요하지 않는다.

# VLA 관점에서 중요한 이유

cross-embodiment transfer는 보통 target robot demonstration과 fine-tuning을 요구한다. 이 방법은 calibration task에서 얻은 성공/실패 결과만으로 action generator의 sampling을 바꾼다. frozen foundation policy를 보존하면서 low-level dynamics 차이를 inference-time correction으로 흡수하려는 접근이다.

동시에 “embodiment gap이 action distribution의 density-ratio gradient로 보정 가능한가”라는 명확한 가설과 실패 조건을 제시한다. controller stiffness·delay에는 잘 작동하지만 locked joint처럼 원래 계획이 물리적으로 불가능한 경우에는 오히려 해롭다는 결과가 특히 중요하다.

# Robot / Embodied Setting

- policy: public frozen $\pi_0$ LIBERO checkpoint, 3B parameters
- benchmark: LIBERO Object·Spatial·Goal·LIBERO-10 simulation
- source: stock Panda arm과 표준 OSC controller
- target: stiffness·command delay 변화, KUKA/Kinova/Sawyer weak wrist, UR5e speed cap, slow gripper, worn/locked-joint Panda
- action: 50×7 chunk, 10 Euler denoising steps, 매 chunk에서 앞 5 action 실행
- evaluation: 조건당 transfer task 4개, 총 200 episodes; calibration task와 transfer task 분리

# Method

source body $A$와 target body $B$의 성공 chunk 집합을 각각 $D_A,D_B$로 둔다. noise-conditioned classifier $\ell_\phi(x_t,t)$는 두 분포의 log density ratio $\log q_t^B/q_t^A$를 근사한다. 이 gradient로 원래 flow velocity $v$를 다음처럼 수정한다.

$$
\delta v=-w\frac{t}{\max(1-t,0.05)}\nabla_x\ell_\phi(x,t),\qquad
\hat v=v+\delta v\min\left(1,\frac{0.2\lVert v\rVert}{\lVert\delta v\rVert}\right).
$$

scale $w\in\{1,2,4\}$는 calibration task에서 고르고, 한 번의 nudge는 원래 velocity norm의 20%로 제한한다. classifier는 4-layer, width-128 transformer이며 50-step chunk의 7개 실제 action dimension에 대해 모든 10개 flow step에서 gradient를 제공한다. target 성공 data가 부족하면 guided rollout의 성공 chunk를 다시 넣어 classifier를 재학습할 수 있다.

# 핵심 그림

![source와 target body의 성공 action chunk로 embodiment classifier를 학습하고, frozen pi0의 각 flow denoising step에 gradient guidance를 더하는 파이프라인](/papers/assets/vla/embodiment-classifier-guidance-for-frozen-vlas/overview.svg)

> 그림 1. Embodiment-classifier guidance의 학습·추론 흐름. 논문 Figure 1과 Equation 2–3을 바탕으로 직접 재구성했다. 출처: [arXiv:2610.22576](https://arxiv.org/html/2610.22576).

구조 그림을 고른 이유는 target-body data가 policy fine-tuning으로 들어가지 않고 **별도 density-ratio classifier → sampling gradient**로만 연결된다는 점이 핵심이기 때문이다. 학습 단계에서는 calibration task의 성공 chunk를 body label로 분류한다.

추론 단계에서는 observation·instruction을 받은 frozen $\pi_0$가 task 계획을 만들고, classifier는 noisy action chunk만 보고 target-success 방향을 제시한다. cap이 각 보정을 원래 step의 20% 이하로 묶는다. 최종 chunk 중 5 action만 실행하고 다시 관측해 반복한다.

# Experiments / Results

## 주요 실험 결과

아래 값은 논문 Section 4와 Table 3–4에서 직접 대조했다. 성공률 차이는 동일한 suite·body·episode 설정에서 %p로 계산했다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓)                      |      제안 방법 |              비교 기준 |    차이 | 출처    |
| ----------------------------------------------------- | -------------: | ---------------------: | ------: | ------- |
| 4 controller, 12 suite–body pair pooled 성공률 (%, ↑) |    guided 80.0 |          unguided 72.0 |  +8.0%p | §4.1    |
| LIBERO-Object, Ctrl(0.5, 0.3s), 200 episodes (%, ↑)   |    guided 93.0 |          unguided 73.0 | +20.0%p | Table 3 |
| LIBERO-Object, Kinova 10% wrist, 200 episodes (%, ↑)  |    guided 85.0 |          unguided 70.0 | +15.0%p | Table 3 |
| KUKA 25% wrist, 3-seed mean (%, ↑)                    |    guided 52.5 |          unguided 42.0 | +10.5%p | Table 3 |
| KUKA + guided self-collection, 3-seed mean (%, ↑)     | retrained 70.7 | original unguided 42.0 | +28.7%p | Table 3 |
| Panda locked wrist, 200 episodes (%, ↑)               |    guided 36.0 |          unguided 68.5 | -32.5%p | Table 3 |

controller-change 12쌍을 합치면 2,400 episodes에서 성공이 1,718회에서 1,931회로 늘어 실패가 상대적으로 31% 감소했다. 12쌍 중 11쌍이 개선됐고 Holm correction 후 5쌍이 유의했다. Ctrl(0.5, 0.3s)의 LIBERO-Object는 73%에서 93%로 20%p 상승했다.

반면 hardware fault 결과는 혼합됐다. Kinova weak wrist는 +15%p지만 Sawyer는 -16%p, locked wrist는 -32.5%p였다. KUKA에서 guided self-collection으로 부족한 성공 사례를 보충하면 52.5%에서 70.7%로 올랐으나, 해당 절차는 특정 transfer failure를 보고 설계돼 완전히 독립적인 검증은 아니다.

# Limitations / Discussion

모든 결과가 simulation, 하나의 $\pi_0$ checkpoint, 하나의 benchmark에 한정된다. target body의 success-labeled rollout이 suite마다 필요하고, 어떤 body에서 guidance를 켤지 사전에 판별하는 pre-registered rule은 실패했다.

classifier가 end-effector pose를 간접적으로 보므로 “어디로 가는가”와 “어떻게 움직이는가”를 분리하지 못한다. scale과 cap 때문에 실제 sampler가 알려진 target distribution을 정확히 따르는 것도 아니다. 10개 denoising step마다 classifier gradient를 계산하는 latency overhead는 측정하지 않았다.

특히 불가능한 관절 운동이나 timing-only fault에서는 gradient가 잘못된 방향을 강화할 수 있다. simple known-fault controller가 더 나은 경우도 있어, 이 방법은 범용 embodiment adapter라기보다 feasible plan-shape mismatch에 대한 보정으로 보는 편이 정확하다.

# 내가 이해한 핵심

foundation policy가 “무엇을 해야 하는지”는 알고 있지만 새 몸이 그 계획을 그대로 실행하지 못할 때, 성공 action의 분포 차이가 작고 매끄럽다면 classifier gradient로 sampling만 비틀어 해결할 수 있다. 그러나 몸이 계획 자체를 실행할 수 없으면 guidance는 feasibility를 만들어내지 못한다.

# 다음에 연결해서 읽을 논문

- $\pi_0$: 이 논문이 수정하지 않고 guidance하는 원래 flow-matching VLA다.
- Mirage: appearance-level cross-embodiment transfer와 action-dynamics correction의 차이를 비교할 수 있다.
- Cue the Flow: frozen flow policy를 inference-time gradient로 steering하는 또 다른 접근이다.
- Health-Conditioned VLA: malfunction 상태를 policy input과 학습에 직접 반영하는 방식과 대비된다.
