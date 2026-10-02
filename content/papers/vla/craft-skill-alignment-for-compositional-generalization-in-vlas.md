---
title: "Same Scene, Different Task: Skill Alignment for Compositional Generalization in VLAs"
date: 2026-10-02
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Taegeun Yang, Youngju Na, Yoonki Cho, Sung-Eui Yoon"
paper: "https://arxiv.org/abs/2610.00524"
code: ""
project: "https://taegeunyang.github.io/craft/"
thumbnail: "/papers/assets/vla/craft-skill-alignment-for-compositional-generalization-in-vlas/overview.svg"
---

# 한 줄 요약

CRAFT는 같은 관측에 미시연 조합을 지시하는 counterfactual을 만들고, 재사용 가능한 skill representation을 기존 constituent-skill 시연으로 감독해 VLA의 조합 일반화를 크게 높인다.

# 논문 정보

- 제목: Same Scene, Different Task: Skill Alignment for Compositional Generalization in VLAs
- 저자: Taegeun Yang, Youngju Na, Yoonki Cho, Sung-Eui Yoon
- 발표: arXiv:2610.00524 (2026-09-30), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.00524) · [프로젝트](https://taegeunyang.github.io/craft/)
- 코드/프로젝트: 프로젝트 페이지 공개, 코드는 공개 예정으로 표기
- 키워드: compositional generalization, counterfactual supervision, skill representation, vision shortcut, VLA fine-tuning

# 핵심 아이디어

Fine-tuning 중 장면이 지시를 대신하는 shortcut을 막기 위해 demonstration observation은 고정하고 instruction만 미시연 skill 조합으로 바꾼다. 이 counterfactual에는 직접 action label이 없으므로, 현재 필요한 skill을 수행한 다른 demonstration에서 supervision을 가져온다. Skill query는 image와 text를, state query는 image만 보며, 두 representation을 분리해 같은 skill은 장면이 달라도 재사용하고 action은 현재 state에 맞게 달라지도록 만든다.

# VLA 관점에서 중요한 이유

모든 조합의 robot demonstration을 수집하지 않고도 이미 본 constituent skill을 새 순서·대상 조합으로 재결합하는 문제를 정면으로 다룬다. $\pi_0$, $\pi_{0.5}$, GR00T N1.7의 서로 다른 VLM-action interface에서 공통으로 개선되어 특정 backbone trick에 머물지 않는다.

# Robot / Embodied Setting

- 시뮬레이션 Pick-Place: 4색 cube × 4색 plate의 16조합 중 같은 색 4조합만 시연, 나머지 12조합 평가.
- Pick-Place-Press: 3개 operation의 8조합 중 2조합 시연, 6조합 평가; 시연 조합당 50개 demonstration.
- 실제 로봇: Piper 6-DoF, third-person와 wrist camera, 같은 색 4조합에 각 20개 demonstration.
- 실제 평가는 12개 미시연 조합에 조합당 5회, 4개 시연 조합에도 조합당 5회 수행한다.

# Method

1. Learnable skill query와 state query로 지시 의존 skill 표현과 관측 의존 state 표현을 분리한다.
2. 같은 skill의 표현을 바꿔 끼워도 target velocity 예측 오차가 작고 다른 skill은 구분되도록 대조 목적을 적용한다.
3. Observation을 고정하고 instruction만 바꾼 counterfactual pair를 만든다.
4. Counterfactual의 skill 표현을 해당 skill의 실제 demonstration state와 결합하고 그 demonstration의 velocity target으로 감독한다.

# 핵심 그림

![같은 장면에서 지시만 바꾼 counterfactual을 constituent-skill demonstration으로 정렬하는 CRAFT 구조](/papers/assets/vla/craft-skill-alignment-for-compositional-generalization-in-vlas/overview.svg)

> 논문 Figure 2와 프로젝트 페이지의 method diagram을 바탕으로 재구성했다. 구조 그림을 고른 이유는 action label이 없는 counterfactual을 다른 장면의 시연으로 어떻게 감독하는지가 성능 수치보다 먼저 이해되어야 하기 때문이다. 출처: [논문 Figure 2 및 Section 4](https://arxiv.org/html/2610.00524v1#S4), [공식 프로젝트](https://taegeunyang.github.io/craft/).

# Experiments / Results

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓) | 제안 방법 | 비교 기준 | 차이 | 출처 |
| --- | ---: | ---: | ---: | --- |
| 실제 Piper, 미시연 조합 성공률 (%, ↑) | 71.7 (43/60) | FT Full 15.0 (9/60) | +56.7%p | 논문 Table 3 |
| 실제 Piper, 시연 조합 성공률 (%, ↑) | 95.0 (19/20) | FT Full 95.0 (19/20) | 0.0%p | 논문 Table 3 |
| Pick-Place, $\pi_{0.5}$ 미시연 조합 성공률 (%, ↑) | 84.2 | 최강 baseline CAG-VA 66.5 | +17.7%p | 논문 Table 1 |
| Pick-Place, $\pi_0$ 미시연 조합 성공률 (%, ↑) | 64.3 | 최강 baseline Skill Composition 12.7 | +51.6%p | 논문 Table 1 |
| Pick-Place, GR00T N1.7 미시연 조합 성공률 (%, ↑) | 72.1 | 최강 baseline Skill Composition 13.1 | +59.0%p | 논문 Table 1 |

실제 로봇에서는 시연 조합의 95.0% 성공을 그대로 유지하면서 미시연 조합을 15.0%에서 71.7%로 올렸다. 이 결과는 단순히 전체 성능을 교환한 것이 아니라 조합 일반화 격차를 줄였음을 보여준다. 시뮬레이션 비교 기준은 각 모델·benchmark 안에서 가장 강한 보고 baseline만 사용했다.

# Limitations / Discussion

Operation 순서가 고정되어 있고 새 조합의 모든 constituent skill이 demonstration에 이미 있어야 한다. 완전히 새로운 skill, 지시가 바꾸는 operation 순서, 긴 horizon에서의 동적 subgoal 구성은 범위 밖이다. 실제 로봇도 색 기반 pick-place라는 제한된 조합 공간이므로 자연어 다양성과 복잡한 물리 상호작용으로의 확장은 추가 검증이 필요하다.

# 내가 이해한 핵심

CRAFT는 “새 조합의 정답 행동을 합성”하지 않는다. 대신 새 instruction이 어떤 skill을 요구하는지만 representation에 새기고, 행동의 기하학적 세부는 label이 있는 다른 state에서 학습한다. 의미와 상태를 분리해 supervision을 옮기는 것이 핵심이다.

# 다음에 연결해서 읽을 논문

- CAG-VA: vision shortcut을 inference-time guidance로 완화하는 baseline과 비교하기 위해
- Correcting WHERE, Preserving HOW: target 변경과 motion prior 보존이라는 공통 문제를 비교하기 위해
- Causeway: instruction switching에서 task accessibility를 복원하는 관점과 연결하기 위해
