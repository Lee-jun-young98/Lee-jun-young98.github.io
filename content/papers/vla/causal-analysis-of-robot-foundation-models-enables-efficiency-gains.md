---
title: "Causal Analysis of Robot Foundation Models Enables Efficiency Gains"
date: 2026-10-17
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Mechanistic Interpretability"
  - "Efficient Inference"
venue: "확인 필요"
authors: "Aiden Swann, Mathilde Papillon, Mozes Jacobs, Siddharth Boppana, Tal Haklay, Eric Bigelow, Andrew Lee, Conor Watts, Thomas Icard, Mac Schwager, Owen Lewis, Jack Merullo, Ekdeep Singh Lubana, Atticus Geiger, Thomas Fel, Matthew Kowal"
paper: "https://arxiv.org/abs/2610.20750"
code: "https://github.com/goodfire-ai/robotics_causal_analysis"
project: ""
thumbnail: "/papers/assets/vla/causal-analysis-of-robot-foundation-models-enables-efficiency-gains/overview.svg"
---

# 한 줄 요약

세 VLA의 activation patching으로 VLM이 action expert에 행동 관련 정보를 넘기는 1–3개 층의 좁은 인터페이스를 찾고, MolmoBot 연결을 36개에서 3개로 줄여 평균 성공률을 거의 유지하면서 action chunk당 연산량을 33% 절감한 연구다.

# 논문 정보

- 제목: Causal Analysis of Robot Foundation Models Enables Efficiency Gains
- 저자: Aiden Swann 외 15명
- 발표: 확인 필요 (arXiv v1, 2026-10-14)
- 링크: [arXiv](https://arxiv.org/abs/2610.20750), [공식 코드](https://github.com/goodfire-ai/robotics_causal_analysis)
- 라이선스: CC BY 4.0
- 키워드: VLA, robot foundation model, activation patching, action expert, mechanistic interpretability, inference efficiency

# 핵심 아이디어

대부분의 최신 VLA는 VLM backbone의 각 층이 별도 diffusion/flow-matching action expert에 정보를 전달하도록 촘촘히 연결한다. 이 논문은 모든 연결이 실제 행동에 같은 정도로 필요한지 묻는다. 서로 다른 물체를 지시하거나 물체 위치를 바꾼 counterfactual episode 쌍에서 내부 activation을 donor에서 recipient로 복사하고, 예측 궤적이 반대 조건의 reference 궤적으로 얼마나 이동하는지 측정한다.

분석 대상은 $\pi_{0.5}$, MolmoAct2, MolmoBot이다. 세 모델 모두 행동을 바꾸는 인과적 영향은 backbone의 중후반 1–3개 층에 집중됐다. 저자들은 이를 **action-conditioning interface**라고 부른다. 초기 image token은 시각적 배치를, 초기 target noun token은 어떤 물체인지에 대한 의미를, 후기 text/readout token은 선택한 물체의 공간 위치를 주로 운반한다.

이 발견을 구조 변경으로 연결한다. MolmoBot에서는 36개 layer-wise cross-attention 중 원인적으로 중요한 23–25층만 남기고, 이후 VLM 층도 조기 종료한다. 결과적으로 cross-attention 모듈의 92%를 제거하면서 세 시뮬레이션 benchmark의 oracle 평균은 46.9%에서 46.7%로 0.2%p만 감소한다.

# VLA 관점에서 중요한 이유

VLA 효율화는 보통 parameter 크기, token 수, layer similarity 같은 간접 지표로 pruning 대상을 고른다. 이 논문은 실제 action을 바꾸는 내부 경로를 intervention으로 먼저 찾고, 그 경로만 남긴다. 즉 “어디를 줄여도 되는가”를 표현 유사도가 아니라 closed-loop behavior에 대한 인과 효과로 정한다.

또한 VLM이 action expert에 원시적인 vision/language feature를 모든 깊이에서 계속 공급하는 것이 아니라, target의 기하 위치처럼 행동에 바로 필요한 변수로 가공한 뒤 좁은 구간에서 넘긴다는 가설을 세 모델에서 지지한다. 향후 VLA를 처음부터 sparse interface로 설계하거나, task별로 필요한 readout만 동적으로 선택하는 근거가 된다.

# Robot / Embodied Setting

- 분석 모델: $\pi_{0.5}$, MolmoAct2, MolmoBot
- counterfactual 분석: household object 쌍 13종, 156개 이상 pair, 전체 775,000회 이상 activation patching
- 시뮬레이션: MolmoSpaces의 Pick, Pick & Place, Pick-and-Place Next-To; 모델당 task별 1,000 episode, 총 3,000 episode
- 실제 로봇: $\pi_{0.5}$ dense/sparse 정책을 fruit in basket, noun in bin, marker in mug, stack bowls 계열 task에서 각각 100 trial
- 행동 표현: 연속 action sequence; forward kinematics로 end-effector trajectory를 복원해 intervention 효과를 평가

# Method

입력 $x=(I,u,s)$는 image observation, instruction, proprioceptive state로 구성되고, VLM의 각 층에서 얻은 conditioning $C_j(x)$가 action expert block $j$에 전달된다. 원본 입력 $x^o$를 실행하되 선택한 interface activation만 counterfactual 입력 $x^{cf}$의 값으로 교체해, 어느 연결이 행동을 바꾸는지 측정한다.

정규화 궤적 이동량은 다음과 같다.

$$
E=\frac{\langle \tau_{patch}-\tau_o,\tau_{ref}-\tau_o\rangle}{\|\tau_{ref}-\tau_o\|_2^2}.
$$

$E=0$이면 patch가 reference 방향으로 행동을 바꾸지 않았고, $E=1$이면 reference 궤적까지 완전히 옮겼다는 뜻이다. single connection과 인접 3-layer window를 sweep한 결과 MolmoBot은 24층, $\pi_{0.5}$는 14–16층 주변, MolmoAct2도 중후반의 좁은 구간에서 peak가 나타났다.

그 다음 해당 연결만 남긴 정책을 새로 학습하거나 기존 checkpoint에서 50K step adaptation한다. MolmoBot에서는 마지막으로 읽는 층 이후 VLM 계산을 중단하고, 사용하지 않는 cross-attention module을 제거한다. $\pi_{0.5}$에서는 action expert가 읽는 prefix key/value를 14–16층으로 제한한다.

# 핵심 그림

![서로 바뀐 물체 장면에서 activation patching으로 시각·의미·기하 정보를 추적하고, 인과적으로 중요한 중후반 VLM 층만 action expert에 연결하는 흐름](/papers/assets/vla/causal-analysis-of-robot-foundation-models-enables-efficiency-gains/overview.svg)

> 그림 1. counterfactual activation patching으로 action-conditioning interface를 찾고 이를 sparse VLA로 바꾸는 전체 흐름. 논문 Figure 1–2와 Section 2–3을 바탕으로 직접 재구성했다. 출처: [arXiv:2610.20750](https://arxiv.org/html/2610.20750).

구조 그림을 고른 이유는 이 논문의 기여가 새 action generator 자체보다 **분석 → 인과적 interface 발견 → 구조 pruning**의 연결에 있기 때문이다. 입력 단계에서는 object identity와 위치를 바꾼 donor/recipient episode를 만든다. 초기 image token에는 시각 배치, 초기 noun token에는 target 의미, 후기 text/readout token에는 target 위치가 형성된다. action expert 연결을 한 층 또는 3개 층씩 patch해 $E$를 계산하면 행동 영향이 중후반의 좁은 band에 집중된다.

학습·분석 단계에서는 모든 36개 연결이 있는 원 모델로 intervention을 수행한다. 배포 단계에서는 MolmoBot의 23–25층처럼 확인된 연결만 남기고 이후 backbone 계산을 조기 종료한다. 기존 방식이 모든 층의 VLM feature를 action expert에 전달하는 반면, 제안 구조는 행동에 필요한 기하 변수가 완성되는 지점만 읽는다.

# Experiments / Results

## 주요 실험 결과

아래 값은 논문 Table 1, 2, 4, 5에서 직접 대조했다. MolmoBot의 평균은 Pick success, Pick & Place oracle, Next-To oracle의 평균이며, 각 task는 동일한 1,000 episode로 평가했다. 연산량은 action chunk당 TFLOPs이고, H100 latency는 batch size 1, throughput과 memory는 batch size 64 조건이다.

| 모델 / 설정                        |                  핵심 지표 (↑/↓) | 제안 sparse interface | dense 기준 |   차이 | 출처    |
| ---------------------------------- | -------------------------------: | --------------------: | ---------: | -----: | ------- |
| MolmoBot, layers 23–25 vs all 36   | 3-task oracle 평균 성공률 (%, ↑) |                  46.7 |       46.9 | -0.2%p | Table 1 |
| MolmoBot, layers 23–25 vs all 36   |         연산량 (TFLOPs/chunk, ↓) |                  7.96 |      11.93 | -33.3% | Table 4 |
| MolmoBot, layers 23–25 vs all 36   |       H100 latency (ms/chunk, ↓) |               209 ± 2 |    311 ± 3 | -32.8% | Table 5 |
| MolmoBot, layers 23–25 vs all 36   |    H100 throughput (chunks/s, ↑) |                  30.9 |       21.5 | +43.7% | Table 5 |
| $\pi_{0.5}$, layers 14–16 vs dense |   실제 로봇 성공 (100 trials, ↑) |                    67 |         64 |   +3%p | Table 2 |
| $\pi_{0.5}$, layers 14–16 vs dense |  성공 trial 중앙 실행시간 (s, ↓) |                  26.5 |       34.9 | -24.1% | Table 2 |

핵심 비교는 성공률을 희생하지 않고 MolmoBot의 계산을 줄였다는 점이다. 23–25층만 남긴 모델은 평균 성공률이 0.2%p 낮지만 95% binomial confidence interval이 두 설정 모두 ±1.7%p여서 관측 차이는 그 범위보다 훨씬 작다. 동시에 action chunk당 3.97 TFLOPs와 102 ms를 줄이고 처리량은 9.4 chunks/s 높였다.

층 수만 줄이면 되는 것은 아니다. 같은 50K adaptation budget에서 인과 peak 바깥의 12층만 남기면 Pick 성공률은 25.7%, Pick & Place oracle은 20.9%였지만, peak인 24층은 각각 54.7%와 54.0%였다. 따라서 절감 효과는 임의의 single-layer bottleneck이 아니라 intervention으로 찾은 위치에 의존한다.

# Limitations / Discussion

세 모델 모두 object-directed manipulation 구조를 공유하며, counterfactual은 주로 두 물체 중 target 선택과 위치 이동을 분리하도록 설계됐다. grasp type, force, 속도, 장기 계획 같은 다른 행동 변수에도 같은 좁은 interface가 존재하는지는 확인되지 않았다.

MolmoBot의 큰 FLOPs 절감은 36개 cross-attention을 매 denoising step마다 수행하고 context key/value를 cache하지 않는 구현 특성의 영향도 받는다. $\pi_{0.5}$에서는 같은 아이디어의 이론 연산량 감소가 5%에 그쳐, architecture별 이득은 크게 다르다.

실제 로봇 평가는 $\pi_{0.5}$의 dense/sparse 정책 각각 100 trial인 예비 규모다. sparse 정책의 성공 수가 더 높았지만 통계적으로 우월하다고 단정하기보다 성능 보존의 근거로 읽는 편이 안전하다. 또한 어떤 층을 남길지 찾기 위한 대규모 intervention 비용 자체는 배포 비용 분석에 포함되지 않는다.

# 내가 이해한 핵심

VLA에서 VLM과 action expert 사이의 모든 연결은 동일한 정보 통로가 아니다. VLM 내부에서 “어느 물체인가”와 “그 물체가 어디 있는가”가 순차적으로 구성되고, action expert는 기하 변수가 거의 완성된 좁은 깊이 구간을 주로 읽는다. 이 handover 지점을 행동 개입으로 찾으면, 설명 가능성 분석이 곧바로 실제 inference 구조의 절감으로 이어질 수 있다.

# 다음에 연결해서 읽을 논문

- A Phenomenology of Neural Geometry in Vision-Language-Action Models: VLA 내부 변수의 기하 구조를 더 세밀하게 분석한다.
- Multi-Dimensional Featurizers Yield Fine-Grained Steering and Data Shaping in Robot Foundation Models: 내부 feature를 steering과 training-data attribution에 연결한다.
- Decoupled Early Exits for Task-Dependent Compute Allocation in Flow-Matching VLAs: action expert 내부의 task별 조기 종료를 다룬다.
- $\pi_{0.5}$ 및 MolmoBot 원 논문: sparse interface가 의존하는 backbone–action expert 결합 구조를 비교할 수 있다.
