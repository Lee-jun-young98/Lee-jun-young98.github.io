---
title: "When Plans Change, Remember: Replanning-Guided Visual Memory for Vision-Language-Action Models"
date: 2026-10-19
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Visual Memory"
venue: "확인 필요"
authors: "Victoria Smelova, Daniil Kazachkov, Georgiy Kazantsev, Iuliia Tsvetkova, Egor Cherepanov, Nikita Kachaev, Artem Latyshev, Aleksandr I. Panov, Alexey K. Kovalev"
paper: "https://arxiv.org/abs/2610.22556"
code: ""
project: "https://vika787.github.io/RePlanMem/"
thumbnail: "/papers/assets/vla/replanmem-vla-replanning-guided-visual-memory/overview.svg"
---

# 한 줄 요약

연속 action chunk가 같은 미래 구간을 얼마나 다르게 다시 예측하는지를 VLA 내부의 사건 신호로 사용해, 나중에 필요할 시각 단서를 제한된 메모리에 선택적으로 기록하는 방법이다.

# 논문 정보

- 제목: When Plans Change, Remember: Replanning-Guided Visual Memory for Vision-Language-Action Models
- 저자: Victoria Smelova 외 8명
- 발표: 확인 필요 (arXiv v1, 2026-10-15)
- 링크: [arXiv](https://arxiv.org/abs/2610.22556), [프로젝트](https://vika787.github.io/RePlanMem/)
- 라이선스: CC BY 4.0
- 키워드: VLA, visual memory, action chunking, replanning, keyframe selection, long-horizon manipulation

# 핵심 아이디어

receding-horizon VLA는 길이 $K$의 action chunk를 예측하고 그중 $H<K$개만 실행한 뒤 다시 계획한다. 그러면 이전 chunk의 뒤쪽과 새 chunk의 앞쪽은 같은 미래 시점을 예측한다. RePlanMem-VLA는 이 두 겹치는 구간의 불일치를 “새 관측이 정책의 의도를 크게 바꾼 사건”으로 해석한다.

불일치 신호와 시각 feature 변화를 task별 causal statistics로 표준화하고 Mahalanobis surprise percentile로 바꾼다. 임계값을 넘으면 직전 관측 창과 기존 FIFO memory를 clustering해 새로운 시각 상태만 기록한다. 로봇 자체의 움직임 때문에 같은 장면이 달라 보이는 문제는 robot mask를 similarity 계산에만 적용해 줄인다.

# VLA 관점에서 중요한 이유

메모리 기반 VLA의 핵심 병목은 무엇을 저장할지 결정하는 별도 selector다. 이 논문은 VLM judge, privileged simulator state, 수동 keyframe annotation 대신 정책이 정상 실행 중 이미 만든 action prediction을 재사용한다. 즉 행동 계획의 변화가 메모리 쓰기 신호가 된다.

이 아이디어는 action chunking을 단순한 latency 최적화가 아니라 내부 불확실성·사건 감지 인터페이스로 확장한다. OpenVLA-OFT와 $\pi_{0.5}$ 양쪽에서 높은 keyframe detection 성능을 보여 backbone과 autoregressive/flow-matching 차이를 넘어서는 가능성도 확인한다.

# Robot / Embodied Setting

- benchmark: MIKASA-Robo-VLA의 memory-intensive manipulation
- pretrained policy: OpenVLA-OFT, $\pi_{0.5}$
- detector 평가: 19개 task, chunk 길이 $K=8$, RH1($H=1$)과 EXEC4($H=4$)
- memory 평가: RememberColor3-VLA-v0, OpenVLA-OFT 및 $\pi_{0.5}$
- real-world 확인: delayed-color-cue robot trajectory의 offline replay
- 관측: top-view와 wrist RGB, proprioception, language instruction

# Method

이전 최종 chunk와 현재 pre-write chunk에서 동일한 미래를 가리키는 구간을 맞춘다.

$$
U_q=C_{q-1}^{\mathrm{final}}[H:K],\qquad
V_q=C_q^{-}[0:K-H].
$$

aligned L2, translation·rotation·gripper disagreement, temporal change, EMA deviation, VLM visual feature 변화 등 10개 신호를 현재 값·차분·causal baseline 편차로 확장해 30차원 detector input을 만든다. task별 누적 통계로 표준화한 뒤 regularized Mahalanobis surprise $S_q$와 percentile $p_q=F_k(S_q)$를 계산한다.

사건이 감지되면 직전 3개 관측과 memory를 complete-link clustering한다. memory에 없는 cluster의 가장 최근 frame만 FIFO에 추가하고, 실제 write가 일어난 경우에만 갱신된 memory로 두 번째 policy forward pass를 수행한다. detector 계산은 stop-gradient이며, 학습에서는 최종 action chunk에 원래의 supervised action loss만 적용한다.

# 핵심 그림

![연속 VLA 계획의 겹치는 구간을 비교해 surprise를 계산하고, 새 시각 상태만 FIFO memory에 기록한 뒤 행동을 다시 예측하는 RePlanMem-VLA 파이프라인](/papers/assets/vla/replanmem-vla-replanning-guided-visual-memory/overview.svg)

> 그림 1. RePlanMem-VLA의 online memory-write 흐름. 논문 Figure 4와 Algorithm 1을 바탕으로 직접 재구성했다. 출처: [arXiv:2610.22556](https://arxiv.org/html/2610.22556).

구조 그림을 고른 이유는 이 연구의 새로움이 detector 하나보다 **겹치는 계획 비교 → task-calibrated surprise → 중복 제거 → 조건부 재추론**의 연결에 있기 때문이다. 현재 관측·instruction·기존 memory가 첫 action chunk를 만들고, 이전 chunk와 겹치는 미래 구간의 차이가 event score가 된다.

threshold를 넘은 경우에도 현재 frame을 곧바로 쓰지 않는다. 직전 causal window에서 기존 memory와 시각적으로 다른 상태를 골라 FIFO에 넣는다. robot mask는 비교 단계에서만 쓰며 원본 RGB가 저장된다. write가 없으면 첫 chunk를 실행하고, write가 있으면 memory를 반영한 두 번째 chunk를 실행한다.

# Experiments / Results

## 주요 실험 결과

아래 keyframe detector 값은 논문 Table 2, memory-write 값은 Section 4.3.2–4.3.3에서 대조했다. AUC와 write 횟수는 서로 다른 지표이므로 같은 조건 안에서만 비교했다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓)               |        제안 방법 |                        비교 기준 |          차이 | 출처         |
| ---------------------------------------------- | ---------------: | -------------------------------: | ------------: | ------------ |
| OpenVLA-OFT, EXEC4, PR-AUC (↑)                 |    XGBoost 0.996 |                RH1 XGBoost 0.932 |        +0.064 | Table 2      |
| OpenVLA-OFT, EXEC4, ROC-AUC (↑)                |    XGBoost 0.997 |                RH1 XGBoost 0.982 |        +0.015 | Table 2      |
| $\pi_{0.5}$, EXEC4, PR-AUC (↑)                 |       LSTM 0.983 |                   RH1 LSTM 0.933 |        +0.050 | Table 2      |
| RememberColor, cue 기록·유지율 (%, ↑)          |   clustering 100 | direct write, 80th percentile 85 |         +15%p | §4.3.1–4.3.2 |
| OpenVLA-OFT 50 episodes, memory write (회, ↓)  | robot-masked 169 |                     unmasked 336 | -167 (-49.7%) | §4.3.3       |
| OpenVLA-OFT 50 episodes, FIFO eviction (회, ↓) |  robot-masked 19 |                     unmasked 186 | -167 (-89.8%) | §4.3.3       |

19개 task에서 detector의 ROC-AUC는 0.981–0.997, PR-AUC는 0.924–0.996 범위였고 모든 설정에서 event recall@1이 1.0이었다. RememberColor 50회에서는 clustering으로 단서를 100% 기록·유지했다. robot masking은 이 성공률을 유지하면서 write를 336회에서 169회로, eviction을 186회에서 19회로 줄였다.

다만 이는 최종 task success 비교가 아니라 keyframe detection과 memory retention 평가다. real-robot 결과도 policy를 실제 폐루프로 실행한 성공률이 아니라 recorded trajectory의 offline replay라는 점을 구분해야 한다.

# Limitations / Discussion

큰 plan revision이 반드시 의미 있는 사건인 것은 아니다. 정책 오류나 stochastic prediction도 disagreement를 만들 수 있다. 실험 task는 phase boundary가 비교적 명확해서, 매우 짧거나 점진적인 변화에서는 신호가 약해질 수 있다.

memory retention의 정량 결과는 RememberColor 중심이며, 실제 robot 검증은 offline replay다. event detector 학습에는 simulator phase-transition label이 쓰였고, detector 종류별 일반화·calibration 비용도 더 검증해야 한다. 실제 write 시 두 번째 forward pass가 필요해 사건이 잦으면 latency가 증가한다.

# 내가 이해한 핵심

VLA가 계획을 고쳤다는 사실 자체가 새 관측의 정보 가치를 드러낸다. 과거 frame을 모두 저장하거나 별도 VLM에게 중요도를 묻는 대신, 이미 계산된 행동 계획의 변화량을 이용하면 메모리와 제어가 같은 표현 공간에서 연결된다.

# 다음에 연결해서 읽을 논문

- Divide-and-Remember: recursive action-relevant memory와 keyframe admission 기준을 비교할 수 있다.
- Dual-Stream Memory for Vision-Language-Action Policies: 장기·단기 memory stream의 표현 방식과 연결된다.
- Real-Time Execution of Action Chunking Flow Policies: 겹치는 action chunk를 실행 일관성에 사용하는 접근과 대비된다.
- MIKASA-Robo-VLA: 이 논문의 memory-intensive task와 reference event 정의를 제공한다.
