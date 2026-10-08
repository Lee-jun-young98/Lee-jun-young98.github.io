---
title: "Many Ways to Succeed: Diversity-Driven RL Fine-Tuning for VLA Generalization"
date: 2026-10-08
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Haoru Li, Jinmei Liu, Zhiyong Wang, Xiaoming Li, Zhenhong Sun, Daoyi Dong, Chunlin Chen, Zhi Wang"
paper: "https://arxiv.org/abs/2610.09943"
code: ""
project: ""
thumbnail: "/papers/assets/vla/drive-diversity-driven-rl-finetuning-for-vla-generalization/overview.svg"
---

# 한 줄 요약

DRIVE는 성공한 rollout끼리의 시간 정렬된 행동 다양성만 intrinsic reward로 보상해, vanilla RL fine-tuning 대비 OOD 성공률을 π0에서 48.1%→53.4%, 실제 PiPER-X에서 64.1%→73.3%로 높인다.

# 논문 정보

- 제목: Many Ways to Succeed: Diversity-Driven RL Fine-Tuning for VLA Generalization
- 저자: Haoru Li, Jinmei Liu, Zhiyong Wang, Xiaoming Li, Zhenhong Sun, Daoyi Dong, Chunlin Chen, Zhi Wang
- 발표: arXiv:2610.09943v1 (2026-10-07), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.09943) · [HTML 원문](https://arxiv.org/html/2610.09943)
- 코드/프로젝트: 원문에서 공식 공개 링크를 확인하지 못했다.
- 키워드: VLA, reinforcement fine-tuning, exploration, behavioral diversity, OOD generalization

# 핵심 아이디어

일반적인 RL fine-tuning은 전체 rollout 분포를 좁히지만, 성공한 trajectory만 보면 오히려 여러 유효한 해법을 더 쉽게 꺼내는 현상이 나타난다. DRIVE는 이 관찰을 명시적인 reward로 만든다. 같은 task와 initial condition의 rollout을 그룹화하고, VLM feature trajectory를 Global Alignment Kernel(GAK)으로 시간 정렬해 pairwise similarity를 계산한다.

각 성공 trajectory가 그룹의 다른 성공 trajectory와 얼마나 다른지 상대적 diversity로 바꾸고, 성공 indicator를 곱해 실패 다양성에는 보상을 주지 않는다. 이 potential 차이를 environment reward에 더해 PPO/Flow-SDE 기반 VLA RFT를 수행하며, potential-based shaping이므로 원래 MDP의 optimal policy 집합을 바꾸지 않는다는 성질도 제시한다.

# VLA 관점에서 중요한 이유

VLA의 OOD 실패는 단 하나의 성공 동작을 강하게 만드는 것만으로 해결되지 않는다. 같은 목표를 달성하는 여러 접촉 순서·접근 경로·양팔 협응을 확보하면 shift가 한 전략을 막아도 다른 전략을 선택할 수 있다. DRIVE는 단순 noise 증가나 KL regularization 대신 task-valid solution space의 폭을 직접 보상하며 π0와 π0.5 두 backbone에서 효과를 확인했다.

# Robot / Embodied Setting

- VLA backbones: π0, π0.5; 동일 SFT checkpoint에서 PPO 기반 Flow-SDE RFT.
- simulation: LIBERO-Plus 4 suites, ManiSkill3, RoboTwin 2.0의 Click Bell·Press Stapler.
- split: 같은 base task의 perturbation 값을 IND와 held-out OOD로 분리.
- real robot: dual-arm AgileX PiPER-X, Click Bell과 Press Stapler.
- real evaluation: clean, distractor, tabletop background, lighting 조건에서 task-condition당 20 trials.

# Method

1. 같은 task와 initial-state 조건의 rollout을 그룹으로 묶는다.
2. 각 rollout을 decision별 VLM feature trajectory로 표현한다.
3. GAK가 서로 다른 실행 속도를 monotonic temporal path로 정렬해 trajectory similarity를 계산한다.
4. 그룹 내 pairwise similarity를 상대 diversity로 변환하고 성공 trajectory에만 potential을 부여한다.
5. 인접 상태 potential 차이로 만든 diversity reward를 environment reward에 더해 VLA를 RFT한다.

# 핵심 그림

![DRIVE의 rollout 그룹화, 시간 정렬 유사도, 성공 조건 다양성 보상 구조](/papers/assets/vla/drive-diversity-driven-rl-finetuning-for-vla-generalization/overview.svg)

> 논문 Figure 3을 논문 내용을 바탕으로 재구성. 출처: [arXiv HTML, Figure 3](https://arxiv.org/html/2610.09943). rollout feature encoding, GAK 기반 시간 정렬, 성공 조건 diversity reward가 PPO update로 이어지는 흐름을 나타낸다.

구조 그림을 고른 이유는 DRIVE가 새 backbone보다 reward construction pipeline을 제안하기 때문이다. 학습 시 같은 조건의 rollout을 비교해 성공한 해법 사이의 차이에만 bonus를 주고, 실패 다양성이나 단순 실행 속도 차이는 억제한다. 추론 시에는 별도 모듈이나 비교 연산 없이 fine-tuned VLA가 그대로 action chunk를 출력한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)             | DRIVE | Vanilla RFT |   차이 | 출처         |
| ------------------------------------------ | ----: | ----------: | -----: | ------------ |
| π0, 3 benchmark family OOD macro-average   |  53.4 |        48.1 | +5.3%p | 원문 Table 1 |
| π0.5, 3 benchmark family OOD macro-average |  73.1 |        71.1 | +2.0%p | 원문 Table 1 |
| π0, RoboTwin 2.0 OOD                       |  71.4 |        62.1 | +9.3%p | 원문 Table 1 |
| 실제 PiPER-X, 2 task OOD 평균              |  73.3 |        64.1 | +9.2%p | 원문 Table 2 |
| 실제 PiPER-X, clean 평균                   |  82.5 |        77.5 | +5.0%p | 원문 Table 2 |

π0에서는 12개 benchmark-split 중 11개, 모든 6개 OOD split에서 개선됐고, π0.5에서도 12개 중 11개와 OOD 6개 중 5개가 개선됐다. 실제 로봇 8개 task-condition 조합에서는 7개가 개선되고 1개가 동률이었다. 특히 shift 평균의 +9.2%p가 clean의 +5.0%p보다 커서 다양성 보상의 목적과 맞는다.

# Limitations / Discussion

- 그룹 내 pairwise GAK 계산이 rollout 수에 따라 커져 대규모 online RFT 비용이 높다.
- VLM feature distance가 실제 전략 차이보다 시각적 우연이나 자세 차이를 반영할 수 있다.
- 실물 평가는 두 개의 짧은 조작 과제와 sim-trained policy transfer에 한정된다.
- long-horizon task, 더 다양한 embodiment, 실제 환경에서의 online fine-tuning은 검증되지 않았다.
- success binary label이 필요한 만큼 sparse·부분 성공 과제에서는 reward 설계가 추가로 필요하다.

# 내가 이해한 핵심

DRIVE는 “exploration을 많이 하라”가 아니라 “성공 영역 안에서 서로 다른 길을 유지하라”는 방법이다. 실패를 다양하게 만드는 것은 아무 가치가 없고, 시간 늘이기 같은 피상적 차이도 제외해야 한다. 성공 조건과 temporal alignment가 함께 있어야 diversity가 일반화에 유효한 전략적 대안으로 작동한다.

# 다음에 연결해서 읽을 논문

- FIND: 실제 로봇에서 실패 영역을 능동적으로 찾고 VLA를 RL로 개선한다.
- VLaRL: simulation-trained latent-conditioned residual RL로 frozen VLA를 보강한다.
- Kintsugi-VLA: 실패 rollout의 recoverable 구간을 골라 recovery data로 재사용한다.
