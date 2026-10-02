---
title: "DriftOPD: Sequence-Level Reverse-KL Distillation for One-Step VLA Policies"
date: 2026-10-02
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Youngjun Jun, Kyumin Choi, Youngmin Kim, Seonghyun Jin, Sunwoo Park, Jangho Park, Jong Chul Ye"
paper: "https://arxiv.org/abs/2610.00317"
code: ""
project: "https://yj-jun.github.io/DriftOPD/"
thumbnail: "/papers/assets/vla/driftopd-sequence-level-reverse-kl-distillation-for-one-step-vla-policies/overview.svg"
---

# 한 줄 요약

DriftOPD는 연속 VLA의 시퀀스 수준 reverse-KL을 로컬 drifting과 오프라인 demonstration critic으로 분해해, 별도 teacher·온라인 rollout 없이 다단계 action expert를 한 단계 정책으로 증류한다.

# 논문 정보

- 제목: DriftOPD: Sequence-Level Reverse-KL Distillation for One-Step VLA Policies
- 저자: Youngjun Jun, Kyumin Choi, Youngmin Kim, Seonghyun Jin, Sunwoo Park, Jangho Park, Jong Chul Ye
- 발표: arXiv:2610.00317 (2026-09-29), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.00317) · [프로젝트](https://yj-jun.github.io/DriftOPD/)
- 코드/프로젝트: 프로젝트 페이지 공개, 코드 공개 링크는 확인하지 못함
- 키워드: one-step VLA, on-policy distillation, reverse KL, flow matching, offline critic

# 핵심 아이디어

Action chunk 연쇄의 reverse-KL gradient를 현재 chunk의 분포 불일치와 현재 행동이 미래 성공에 미치는 항으로 나눈다. 전자는 demonstration 한 개와 학생 sample들로 만든 KDE drifting field로, 후자는 demonstration만으로 학습한 고정 Q-function의 action gradient로 근사한다. 생성된 학생 action을 직접 학습점으로 쓰되 환경 rollout은 요구하지 않는다.

# VLA 관점에서 중요한 이유

기존 one-step 증류는 각 chunk의 생성 분포를 맞추는 데 집중해 최종 task success와의 연결이 약했다. DriftOPD는 VLA의 짧은 action chunk를 시퀀스 정책으로 보고 장기 성과 신호를 증류 목적에 넣는다. 서로 다른 VLA 구조와 fine-tuning 방식에 적용되고 real robot의 bimanual task에서도 검증된다는 점이 중요하다.

# Robot / Embodied Setting

- 시뮬레이션: RoboCasa365, RoboTwin 2.0, LIBERO, LIBERO-Plus.
- Backbone: $\pi_{0.5}$, GR00T N1.5/N1.6, ABot-M0 등 flow-matching 및 direct-clean-action 계열.
- 실제 로봇: I2RT YAM 양팔 플랫폼, 상단·좌/우 wrist RGB 카메라, 4개 단팔 pick-and-place와 2개 양팔 handover task.
- 실제 데이터는 12개 task, 638 teleoperation episode(366,373 frame)이며 평가는 task당 동일한 15개 scene을 방법별로 재사용한다.

# Method

1. 학생이 현재 context에서 action chunk sample을 생성한다.
2. Demonstration action과 학생 sample들 사이의 score 차이로 single-positive drifting field를 구성해 로컬 reverse-KL을 줄인다.
3. Demonstration으로 학습하고 고정한 critic $Q_\phi(s,a)$의 action gradient가 현재 chunk의 미래 task progress를 안내한다.
4. 두 loss를 함께 최적화해 multi-step sampling을 one-step generation으로 바꾼다.

# 핵심 그림

![Demonstration에서 로컬 drifting과 offline critic을 구성해 one-step VLA를 학습하는 DriftOPD 흐름](/papers/assets/vla/driftopd-sequence-level-reverse-kl-distillation-for-one-step-vla-policies/overview.svg)

> 논문 Figure 2의 비교 구조와 Section 4의 학습 흐름을 바탕으로 재구성했다. 구조 그림을 고른 이유는 이 논문의 핵심이 reverse-KL의 두 항을 rollout-free 학습 신호로 치환하는 방식에 있기 때문이다. 출처: [논문 Figure 2 및 Section 4](https://arxiv.org/html/2610.00317v1#S4).

# Experiments / Results

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓) | 제안 방법 | 비교 기준 | 차이 | 출처 |
| --- | ---: | ---: | ---: | --- |
| YAM 단팔 4-task 평균, 성공률 (%, ↑) | 58.3 | Drift 55.0 | +3.3%p | 논문 Table 3 |
| YAM 양팔 2-handover 평균, 성공률 (%, ↑) | 76.7 | Drift 46.7 | +30.0%p | 논문 Table 3 |
| YAM 양팔 평균, multi-step teacher 대비 (%, ↑) | 76.7 | 4-step teacher 80.0 | -3.3%p | 논문 Table 3 |
| RoboTwin 2.0 short, $\pi_{0.5}$-LoRA 성공률 (%, ↑) | 67.78 | 10-step teacher 60.74 | +7.04%p | 논문 Table 2 |
| 정책 생성 속도 | 2.60× 빠름 | 10-step teacher 1.00× | +1.60× | 논문 Section 5.1 |

실제 양팔 handover에서 기존 one-step Drift보다 30.0%p 높고 4-step teacher와는 3.3%p 차이다. 반면 단팔 Challenging task는 DriftOPD도 13.3%에 머물러 one-step화가 어려운 장면을 모두 해결하지는 못한다. 서로 다른 조건의 시뮬레이션 값은 같은 행에서 섞지 않았다.

# Limitations / Discussion

미래 항은 demonstration 분포로 학습한 critic의 근사치이므로 coverage 밖 action의 gradient 품질이 낮다. 논문도 one-step teacher가 이미 multi-step 성능을 따라잡는 LIBERO 계열에서는 critic 추가 이득이 작다고 인정한다. 실제 평가는 고정 laboratory task와 15개 scene/task에 한정되고, 더 넓은 distribution shift에서 장기 안정성과 안전성을 확인해야 한다.

# 내가 이해한 핵심

이 논문의 핵심은 “sampling step을 줄이는 증류”를 “성공까지 이어지는 action-chunk 연쇄를 증류하는 문제”로 다시 정의한 것이다. 다만 rollout-free라는 장점은 critic이 demonstration coverage에 묶인다는 한계와 정확히 맞바뀐다.

# 다음에 연결해서 읽을 논문

- MeanFlow Distillation: chunk-level one-step distillation과 목적 차이를 비교하기 위해
- VGAS: rollout 없이 action-value critic을 학습하는 기반을 이해하기 위해
- RAVEL: 증류가 아닌 asynchronous inference로 flow VLA latency를 줄이는 접근과 비교하기 위해
