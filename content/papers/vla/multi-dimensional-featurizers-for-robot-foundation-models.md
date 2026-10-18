---
title: "Multi-Dimensional Featurizers Yield Fine-Grained Steering and Data Shaping in Robot Foundation Models"
date: 2026-10-18
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Mechanistic Interpretability"
  - "Data Attribution"
venue: "확인 필요"
authors: "Aiden Swann, Mozes Jacobs, Mathilde Papillon, Siddharth Boppana, David Chanin, Dron Hazra, Usha Bhalla, Curt Tigges, Mac Schwager, Owen Lewis, Jack Merullo, Ekdeep Singh Lubana, Atticus Geiger, Thomas Fel, Matthew Kowal"
paper: "https://arxiv.org/abs/2610.20767"
code: "https://github.com/goodfire-ai/robotics_multi_dimensional"
project: ""
thumbnail: "/papers/assets/vla/multi-dimensional-featurizers-for-robot-foundation-models/overview.svg"
---

# 한 줄 요약

VLA activation을 한 방향씩 쪼개는 SAE 대신 저차원 부분공간 단위로 묶는 block-sparse featurizer를 학습해 의미·시각·기하 feature로 실제 로봇 목표를 바꾸고, 실패 복구 feature가 찾은 학습 token 1.38%만 마스킹해 복구 행동을 선택적으로 약화시킨 연구다.

# 논문 정보

- 제목: Multi-Dimensional Featurizers Yield Fine-Grained Steering and Data Shaping in Robot Foundation Models
- 저자: Aiden Swann 외 14명
- 발표: 확인 필요 (arXiv v1, 2026-10-14)
- 링크: [arXiv](https://arxiv.org/abs/2610.20767), [공식 코드](https://github.com/goodfire-ai/robotics_multi_dimensional)
- 라이선스: CC BY 4.0
- 키워드: VLA, block-sparse featurizer, sparse autoencoder, feature steering, data attribution, failure recovery

# 핵심 아이디어

기존 sparse autoencoder(SAE)는 하나의 개념을 한 decoder 방향과 스칼라 계수로 표현한다. 그러나 로봇의 end-effector 위치, 관절 상태, 물체의 이미지상 위치처럼 연속적이고 서로 얽힌 변수는 곡선이나 면에 가까운 저차원 manifold를 만든다. 이때 SAE는 하나의 개념을 여러 feature로 잘게 타일링하므로, 해석과 intervention에 다시 조합 과정이 필요하다.

논문은 feature 하나를 $b$차원 block으로 정의하는 block-sparse featurizer(BSF)를 사용한다. 각 block은 하나의 부분공간을 담당하고, group TopK가 norm이 큰 $k$개 block 전체를 선택한다. 따라서 한 block 안의 좌표가 물체 위치나 로봇 상태의 연속 변화를 담을 수 있다. 저자들은 MolmoAct2, $\pi_{0.5}$, MolmoBot activation에서 시각, 언어, proprioception, episode phase, control variable에 대응하는 block을 찾는다.

발견한 feature가 단지 상관관계인지 확인하기 위해 의미 token, image token, action-readout token의 block code를 반대 조건으로 바꾼다. 이 intervention은 입력 문장과 이미지를 그대로 둔 채 어느 물체를 고르고 어디로 reach할지를 바꾼다. 마지막으로 $\pi_{0.5}$의 실패 복구 feature F1515를 전체 DROID에서 검색해 관련 구간의 loss만 마스킹하고, 복구 행동만 선택적으로 느려지는지 검증한다.

# VLA 관점에서 중요한 이유

VLA interpretability가 “내부에서 무엇을 읽을 수 있는가”를 넘어 “작은 feature 집합으로 행동을 얼마나 정밀하게 바꿀 수 있는가”까지 간다. 특히 BSF는 semantic target, visual location, geometric action readout처럼 VLA 파이프라인의 서로 다른 단계에 개입할 수 있는 공통 인터페이스를 제공한다.

더 중요한 연결은 inference-time steering과 training-data curation을 같은 feature로 잇는 점이다. 실패 복구를 나타내는 내부 feature로 학습 구간을 찾고, 그 구간의 supervision만 제거했을 때 정상 pick-and-place 성능은 유지하면서 복구 시점이 크게 늦어진다. 이는 VLA의 특정 행동이 어떤 데이터에서 왔는지를 추적하고, 원치 않는 행동을 데이터 수준에서 수정할 가능성을 보여준다.

# Robot / Embodied Setting

- 분석 모델: MolmoAct2, $\pi_{0.5}$, MolmoBot
- feature 학습 corpus: 45,344 episode에서 추출한 image·text·state token activation 약 5,200만 개
- open-loop steering: MolmoAct2, 52개 held-out scene–instruction 비교, 조건당 6개 noise seed
- closed-loop steering: 실제 로봇 pick-and-place, 3개 물체 쌍을 양방향으로 각각 10회, 총 60 trial
- data attribution: DROID 74,604 episode에서 $\pi_{0.5}$ layer 9의 실패 복구 feature를 검색
- behavior shaping: 정상 pick-and-place 20 trial과 gripper를 강제로 닫은 perturbation 평가

# Method

activation $\mathbf{x}\in\mathbb{R}^d$를 $G$개 block의 code $\mathbf{z}$로 바꾸고, 각 block $g$의 decoder $\mathbf{D}_g$로 복원한다.

$$
\hat{\mathbf{x}}=\sum_{g=1}^{G}\mathbf{z}_g(\mathbf{x})\mathbf{D}_g,
\qquad
\mathbf{z}(\mathbf{x})=\Pi_k(\mathbf{x}\mathbf{W}+\mathbf{b}_{enc}).
$$

$\Pi_k$는 $\ell_2$ norm이 큰 $k$개 block만 남긴다. $b=1$이면 TopK SAE와 같고, $b>1$이면 feature 하나가 최대 $b$차원 부분공간을 갖는다. Vanilla BSF는 activation 재구성 오차를 최소화하고, Fisher BSF는 action-token log-likelihood gradient로 만든 empirical Fisher를 이용해 정책 출력에 중요한 방향의 재구성 오차에 더 큰 가중치를 둔다.

행동 steering에서는 반대 object 조건 사이 activation patching이 만든 trajectory 이동을 목표로 삼고, 그 효과의 75% 이상을 복원하는 작은 feature 집합을 greedy search로 찾는다. data attribution에서는 layer 9의 3차원 F1515 block이 연속 두 frame 이상 강하게 켜지는 구간을 failure-recovery window로 정하고, 해당 window와 겹치는 16-step action chunk의 flow-matching loss만 0으로 만든다.

# 핵심 그림

![VLA token activation을 block-sparse feature로 분해해 행동 steering과 실패 복구 데이터 attribution으로 연결하는 전체 파이프라인](/papers/assets/vla/multi-dimensional-featurizers-for-robot-foundation-models/overview.svg)

> 그림 1. VLA activation에서 다차원 feature를 찾고, inference-time steering과 training-data shaping에 사용하는 흐름. 논문 Figure 2–4와 Section 2–4를 바탕으로 직접 재구성했다. 출처: [arXiv:2610.20767](https://arxiv.org/html/2610.20767).

구조 그림을 고른 이유는 이 논문의 핵심이 특정 feature 시각화 하나보다 **activation 수집 → BSF 분해 → 인과 검증 → 데이터 수정**의 연결에 있기 때문이다. 입력의 image·instruction·state token은 VLA backbone의 여러 층에서 activation을 만든다. SAE가 한 feature를 한 방향으로 제한하는 반면 BSF는 한 block 안에 연속적인 의미·위치·상태 변화를 보존한다.

추론 단계에서는 선택한 block code만 반대 조건으로 바꿔 target object와 reach 방향을 전환한다. 학습 단계에서는 failure-recovery block의 norm으로 DROID 구간을 골라 action loss를 마스킹한다. 즉 같은 표현 단위가 “이 feature가 행동을 일으키는가”와 “그 행동을 가르친 데이터는 무엇인가”라는 두 질문을 연결한다.

# Experiments / Results

## 주요 실험 결과

아래 값은 논문 Table 1과 Table 2에서 직접 대조했다. closed-loop target redirection은 물체 쌍당 20회, 총 60 trial이고, behavior shaping 성공률은 perturbation이 없는 20회 평가다. 서로 다른 평가 설정의 값은 같은 행에서 비교하지 않았다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓)                          |     제안 방법 |        비교 기준 |    차이 | 출처    |
| --------------------------------------------------------- | ------------: | ---------------: | ------: | ------- |
| closed-loop target redirection, 선택 성공률 (%, ↑)        |     BSF 100.0 |         SAE 88.3 | +11.7%p | Table 1 |
| closed-loop target redirection, grasp 성공률 (%, ↑)       |      BSF 96.7 |         SAE 83.3 | +13.4%p | Table 1 |
| closed-loop target redirection, task 완료율 (%, ↑)        |      BSF 93.3 |         SAE 75.0 | +18.3%p | Table 1 |
| closed-loop target redirection, 방향당 feature 수 (개, ↓) |       BSF 2.3 |          SAE 2.5 |    -0.2 | Table 1 |
| behavior shaping, 재개방 시간 (s, ↑)                      | Concept 12.93 |  Unmodified 3.13 | +9.80 s | Table 2 |
| 정상 pick-and-place 성공률 (%, ↑)                         |   Concept 100 |    Unmodified 90 |   +10%p | Table 2 |
| 정상 성공 trial 완료시간 (s, ↓)                           | Concept 11.79 | Unmodified 12.13 | -0.34 s | Table 2 |

핵심 비교는 BSF semantic feature가 SAE보다 적은 feature로 실제 로봇의 목표를 더 안정적으로 바꿨다는 점이다. 총 60회에서 redirected object 선택은 100%, 최종 basket 배치는 93.3%로, SAE보다 각각 11.7%p와 18.3%p 높다. 물체 쌍별로도 BSF task 성공률은 apple/banana 90%, bowl/cable 100%, mouse/towel 90%였다.

data attribution에서는 F1515가 전체 DROID의 4,866/74,604 episode(6.5%)에서 recovery window를 찾았고, 실제 학습에서 마스킹된 action token은 1.38%였다. 이 작은 변경은 perturbation 후 gripper 재개방 시간을 3.13초에서 12.93초로 늦췄지만, perturbation 없는 task 성공률은 90%에서 100%로 유지됐다. 다만 이는 복구 능력을 높인 것이 아니라 의도적으로 약화해 feature–data–behavior의 인과 연결을 확인한 실험이다.

# Limitations / Discussion

BSF가 모든 지표에서 SAE보다 우월한 것은 아니다. open-loop visual steering에서는 BSF가 더 적은 block을 쓰지만 held-out recovery는 SAE가 더 높았고, geometric steering은 두 방법 모두 feature 하나로 강한 효과를 냈다. block 구조와 대규모 unpooled corpus의 효과도 완전히 분리하기 어렵다.

closed-loop 검증은 semantic target redirection에 집중한다. visual·geometric intervention을 실제 긴 rollout에서 안정적으로 쓰려면 움직이는 image region과 변하는 robot state를 매 step 추적해야 한다. feature가 어떻게 생기고 정책 계산에 어떤 순서로 참여하는지도 아직 완전히 설명하지 못한다.

behavior shaping은 한 pick-and-place task, 같은 seed와 data order를 사용한 fine-tuning run에 기반한다. 성공률 20 trial, perturbation 평가는 제한된 횟수라 일반화와 통계적 안정성은 더 큰 반복 실험이 필요하다. 또한 recovery를 제거하는 사례는 제어 가능성을 보여주는 진단 실험이지, 그대로 배포해야 할 개선법은 아니다.

# 내가 이해한 핵심

로봇 행동에 필요한 내부 변수는 독립적인 단어 사전보다 작은 좌표계에 가깝다. “사과”라는 의미와 “왼쪽의 사과”라는 위치, end-effector의 연속 상태는 한 축만으로 충분히 표현되지 않는다. BSF는 이 좌표계를 하나의 feature 단위로 보존하기 때문에, 해석 결과를 실제 행동 intervention과 데이터 선택으로 연결하기가 쉬워진다.

# 다음에 연결해서 읽을 논문

- Causal Analysis of Robot Foundation Models Enables Efficiency Gains: 어떤 VLA 층과 token이 action expert에 인과적으로 중요한지 분석한다.
- A Phenomenology of Neural Geometry in Vision-Language-Action Models: VLA 내부 변수의 곡선·부분공간 구조를 더 직접적으로 분류한다.
- Sparse Autoencoders Reveal Interpretable and Steerable Features in VLA Models: 이 논문의 SAE 비교 기준과 초기 VLA feature steering 결과를 제공한다.
- CUPID: influence function으로 robot demonstration을 선별하는 데이터 curation 접근과 비교할 수 있다.
