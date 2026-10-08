---
title: "TempoBridge: Language-Guided Tempo Control for Vision-Language-Action Policies"
date: 2026-10-08
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Yeonseo Lee, Hyosup Shin, Guebin Hwang, Sungho Jo"
paper: "https://arxiv.org/abs/2610.09451"
code: ""
project: "https://lysees.github.io/tempobridge-page/"
thumbnail: "/papers/assets/vla/tempobridge-language-guided-tempo-control/overview.svg"
---

# 한 줄 요약

TempoBridge는 frozen π0.5 내부의 언어·시각 표현에서 속도 지시와 task phase를 읽어 action translation을 조절하며, tempo-conditioned robot data나 VLA fine-tuning 없이 LIBERO tempo 성공률을 52.6%에서 89.7%로 높인다.

# 논문 정보

- 제목: TempoBridge: Language-Guided Tempo Control for Vision-Language-Action Policies
- 저자: Yeonseo Lee, Hyosup Shin, Guebin Hwang, Sungho Jo
- 발표: arXiv:2610.09451v1 (2026-10-07), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.09451) · [HTML 원문](https://arxiv.org/html/2610.09451)
- 코드/프로젝트: [공식 프로젝트 페이지](https://lysees.github.io/tempobridge-page/) · 원문에서 코드 저장소 공개는 확인하지 못했다.
- 키워드: VLA, language-conditioned control, tempo, frozen policy, phase routing

# 핵심 아이디어

기존 VLA는 무엇을 할지는 언어로 받지만 “빨리 집고 천천히 놓아라”처럼 어떻게 실행할지는 잘 제어하지 못한다. TempoBridge는 frozen π0.5의 PaliGemma residual representation에서 FAST/SLOW prototype과 cosine similarity threshold로 instruction의 tempo sequence를 한 번 읽어 cache한다.

두 사건이 있는 지시라면 causal phase router가 매 replan마다 재사용한 visual feature와 robot-state history를 GRU로 처리해 단 한 번의 Event 1→2 전환을 결정한다. 선택된 tempo에 따라 translation action을 1.3/1.0/0.7 배로 조절하고 rotation과 gripper command는 유지한다.

# VLA 관점에서 중요한 이유

TempoBridge는 VLA 내부에 이미 남아 있는 manner semantics를 물리적인 실행 제어 인터페이스로 꺼낸다. tempo별 demonstration을 새로 모으거나 base policy를 재학습하지 않고, 텍스트 prototype과 소량의 기존 phase annotation만으로 instruction의 수식어를 action magnitude에 연결한다. 이는 frozen VLA를 사용자 선호에 맞게 제어하는 경량 adapter의 한 형태다.

# Robot / Embodied Setting

- base policy: frozen π0.5, PaliGemma VLM backbone과 action expert.
- simulation: LIBERO Spatial/Object/Goal/Long 각 10개, 총 40 tasks.
- canonical evaluation: 80 instructions×10 rollouts, 총 method당 800 rollouts.
- router data: evaluation과 분리된 LIBERO-90 20 tasks의 40 demonstrations, transition interval annotation.
- real robot: 물리 manipulation에서 language-conditioned tempo modulation을 정성·정량 검증.

# Method

1. instruction을 frozen PaliGemma에 language-only로 한 번 통과시켜 12번째 block residual token을 얻는다.
2. FAST/SLOW prototype과 threshold로 token을 분류하고 [Normal], [Fast], [Slow], [Fast, Slow], [Slow, Fast] sequence로 압축한다.
3. 두 tempo가 있으면 policy forward의 visual token mean과 8D robot state 및 변화량을 GRU router에 넣는다.
4. 누적 transition probability가 0.5를 넘으면 Event 2로 단방향 전환한다.
5. active tempo의 gain 1.3/1.0/0.7로 action chunk의 Cartesian translation만 scale하고 closed-loop replan한다.

# 핵심 그림

![TempoBridge의 tempo readout, causal phase router, action modulation 구조](/papers/assets/vla/tempobridge-language-guided-tempo-control/overview.svg)

> 논문 Figure 2를 논문 내용을 바탕으로 재구성. 출처: [arXiv HTML, Figure 2](https://arxiv.org/html/2610.09451). 언어 prototype에서 tempo sequence를 읽고 시각·상태 기반 router가 현재 event를 골라 nominal action을 조절하는 흐름을 나타낸다.

구조 그림을 고른 이유는 language semantics가 실제 action 속도로 변환되는 세 모듈의 연결이 핵심이기 때문이다. prototype readout은 instruction당 한 번 실행되고, router는 매 replan마다 진행 상태를 추적하며, modulator는 translation만 바꾼다. base VLA가 nominal action을 계속 만들고 TempoBridge가 실행 방식만 바꾼다는 분리가 기존 tempo-conditioned policy retraining과 다르다.

# Experiments / Results

## 주요 실험 결과

| LIBERO 평가 / 지표 (%, ↑)                  | TempoBridge | frozen π0.5 |    차이 | 출처           |
| ------------------------------------------ | ----------: | ----------: | ------: | -------------- |
| canonical tempo, Tempo Success Rate        |        89.7 |        52.6 | +37.1%p | 원문 Table I   |
| canonical tempo, Task & Tempo Success Rate |        82.0 |        48.8 | +33.2%p | 원문 Table I   |
| canonical tempo, Task Success Rate         |        92.9 |        93.6 |  -0.7%p | 원문 Table I   |
| tempo cue 없음, Task Success Rate          |        94.3 |        95.0 |  -0.7%p | 원문 Table II  |
| unseen tempo 표현, Tempo Success Rate      |        80.1 |        53.5 | +26.6%p | 원문 Table III |

canonical 조건에서 task 성공률은 사실상 유지하면서 tempo 준수율이 크게 올랐다. unseen 표현에서도 tempo 성공률이 +26.6%p 높아 단순히 `quickly/slowly` token을 암기한 결과만은 아니다. 다만 Tempo Success Rate는 task-successful하고 반대 tempo와 짝지어 비교 가능한 rollout에 조건부로 계산된다.

# Limitations / Discussion

- tempo class가 Fast/Normal/Slow 세 단계이고, 두 event와 단일 forward transition만 가정한다.
- 1.3/0.7 gain은 heuristic이며 안전·접촉력·동역학 한계를 직접 모델링하지 않는다.
- translation만 scale하므로 rotation, gripper timing, force profile의 manner control은 다루지 않는다.
- router에 수작업 검토한 transition interval annotation이 필요하다.
- 실제 로봇 평가 규모가 simulation 40-task 평가보다 작고 다양한 embodiment 일반성은 미확인이다.

# 내가 이해한 핵심

TempoBridge는 VLA를 새로 가르치기보다, VLA가 이미 알고 있는 “빠르게/천천히”의 의미를 언제 어떤 물리 변수에 적용할지 연결한다. 의미 읽기, phase 추적, action 변환을 분리했기 때문에 각 부분을 적은 supervision으로 교체할 수 있다. 반대로 복잡한 manner는 단순 scale만으로 충분하지 않다는 경계도 분명하다.

# 다음에 연결해서 읽을 논문

- Cue the Flow: frozen flow-matching policy를 추론 중 언어·목표 조건으로 steering한다.
- ReGuide: 기존 VLA의 HOW를 유지하면서 referential WHERE만 교정한다.
- RAVEL: flow-based VLA의 action generation을 비동기 rolling inference로 가속한다.
