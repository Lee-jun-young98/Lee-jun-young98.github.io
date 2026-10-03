---
title: "Divide-and-Remember: Recursive Action-Relevant Memory for Long-Horizon VLA Policies"
date: 2026-10-03
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Xuehui Yu, Eason Yu, Meiyi Wang, Haozhe Du, Stefano V. Albrecht, Harold Soh"
paper: "https://arxiv.org/abs/2610.00982"
code: "https://dnr-memory.github.io/"
project: "https://dnr-memory.github.io/"
thumbnail: "/papers/assets/vla/divide-and-remember-recursive-action-relevant-memory-for-long-horizon-vlas/overview.svg"
---

# 한 줄 요약

Divide-and-Remember는 과거 전체를 저장하는 대신 현재 관찰만으로 결정할 수 없는 행동 정보를 최대화하도록 동일한 lightweight selector를 재귀 적용해, 고정 token budget으로 장기 VLA 기억을 만든다.

# 논문 정보

- 제목: Divide-and-Remember: Recursive Action-Relevant Memory for Long-Horizon VLA Policies
- 저자: Xuehui Yu, Eason Yu, Meiyi Wang, Haozhe Du, Stefano V. Albrecht, Harold Soh
- 발표: arXiv:2610.00982v1 (2026-10-01), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.00982) · [프로젝트·코드](https://dnr-memory.github.io/)
- 코드/프로젝트: 저자는 프로젝트 페이지에서 코드, $\pi_{0.5}$ 기반 HAMLET·RB-VLA 재구현, 체크포인트와 추가 결과를 제공한다고 명시한다.
- 키워드: long-horizon VLA, memory, token selection, POMDP, conditional mutual information, robot manipulation

# 핵심 아이디어

장기 조작에서 현재 관찰만으로 다음 행동을 결정할 수 없을 때, 좋은 memory는 과거를 잘 복원하는 것이 아니라 현재 관찰에 없는 행동 관련 정보를 보존해야 한다. 논문은 이를 조건부 상호정보량 $I(a_t;m_t\mid o_t)$ 최대화로 정식화한다.

D&R은 전체 history token을 $2K$ 크기 후보로 나눠 같은 selector로 top-$K$를 고르고, 살아남은 token을 다시 합쳐 root까지 재귀적으로 선택한다. 따라서 episode가 길어져도 최종 memory는 $K$ token으로 고정되고, selector 입력 크기도 변하지 않는다. 선택기는 별도 기억 레이블이나 world-prediction loss 없이 memory를 읽는 policy의 flow-matching action loss만으로 end-to-end 학습된다.

# VLA 관점에서 중요한 이유

VLA의 장기 기억을 frame sampling, pixel change, 미래 예측 같은 hand-crafted proxy로 설계하지 않고 “다음 행동을 바꾸는 과거 정보”라는 policy-sufficient statistic으로 정의한다. 같은 $\pi_{0.5}$ backbone과 64-token budget에서 모든 memory family를 비교해, 기억의 양보다 선택 목적이 중요하다는 근거를 제공한다.

# Robot / Embodied Setting

- 시뮬레이션: RoboMME 16개 long-horizon manipulation task. Motion-Centric, Time-Sensitive, Short/Long-Horizon Video, Dynamic Scene-Change, Event-Salient의 6개 memory 특성을 다룬다.
- 학습: frozen SigLIP encoder, fine-tuned Gemma VLM·action expert·memory module, action chunk 20개 예측 후 앞 16개 실행. 80K steps, batch 64.
- 평가: task당 50 episodes, 총 800 episodes, train과 분리된 environment seeds, 최대 1,300 steps. 마지막 3개 checkpoint와 3개 seed의 평균.
- 실제 로봇: Put Bottles, Track Cube, Repick Cube, Draw Pattern의 4개 장기 task를 task당 10회 평가하며, 중간 human intervention과 perception noise를 포함한다.

# Method

1. 전체 history에서 일정 간격으로 frame을 가져오고 frame당 pooled patch token을 후보 집합으로 만든다.
2. Frozen SigLIP token에 시간·높이·너비 M-RoPE를 더한 lightweight Transformer가 중요도를 점수화한다.
3. 각 노드에서 $2K$ 후보 중 top-$K$를 선택하고, 선택 결과를 상위 노드에서 다시 병합·선택한다.
4. 모든 재귀 노드가 하나의 selector를 공유하며, straight-through relaxation으로 policy action loss의 gradient를 받는다.
5. 최종 $K$ memory token은 adaptive LayerNorm과 cross-attention을 통해 action expert에 주입된다.

# 핵심 그림

![전체 history를 2K 후보의 재귀적 top-K 선택으로 압축해 고정 크기 행동 관련 기억을 만드는 Divide-and-Remember](/papers/assets/vla/divide-and-remember-recursive-action-relevant-memory-for-long-horizon-vlas/overview.svg)

> 논문 Figures 3–4와 Section 5를 바탕으로 재구성했다. 구조 그림을 고른 이유는 동일 selector를 계층 전체에서 공유해 무제한 history를 고정 token budget으로 줄이는 재귀 과정이 성능의 핵심 메커니즘이기 때문이다. 출처: [논문 Figure 3 및 Section 5](https://arxiv.org/html/2610.00982v1#S5).

# Experiments / Results

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓)                     |    제안 방법 |                         비교 기준 |     차이 | 출처             |
| ---------------------------------------------------- | -----------: | --------------------------------: | -------: | ---------------- |
| RoboMME 16-task 평균, 64-token memory 성공률 (%, ↑)  |        38.58 |                      HAMLET 32.22 |  +6.36%p | 논문 Tables 1, 8 |
| RoboMME 16-task 평균, 64-token memory 성공률 (%, ↑)  |        38.58 |       memoryless $\pi_{0.5}$ 17.9 | +20.68%p | 논문 Table 7     |
| RoboMME 16-task 평균, 128-token memory 성공률 (%, ↑) |        49.01 |                   FrameSamp 36.54 | +12.47%p | 논문 Table 8     |
| 실제 로봇 4-task 총 성공률 (%, ↑)                    | 87.5 (35/40) |            FrameSamp 55.0 (22/40) |  +32.5%p | 논문 Table 2     |
| 실제 로봇 4-task 총 성공률 (%, ↑)                    | 87.5 (35/40) | memoryless $\pi_{0.5}$ 7.5 (3/40) |  +80.0%p | 논문 Table 2     |

64-token 조건은 모든 memory method가 같은 $\pi_{0.5}$ backbone과 동일한 memory budget을 사용한다. 실제 로봇에서는 D&R이 Put Bottles 9/10, Track Cube 9/10, Repick Cube 9/10, Draw Pattern 8/10을 기록했다. 저자 보고 기준 학습 시간도 D&R 약 20시간으로, recurrent belief를 매 step 갱신하는 RB-VLA 약 10일보다 짧다. 다만 hardware·구현 조건이 함께 제시된 wall-clock 결과이므로 일반적인 배수로 해석하면 안 된다.

# Limitations / Discussion

D&R은 과거 token을 선택할 뿐 새로운 latent로 압축하거나 정보를 재구성하지 않는다. 저자도 StopCube와 ButtonUnmask에서 latent memory보다 낮고, state-like fact에서는 동률에 그친다고 보고한다. Candidate pool이 커지면 중요한 frame-like token이 더 많은 후보에 묻힐 수 있으며, 512-token model은 80K steps에서 아직 수렴하지 않아 256-token보다 낮다. 모든 방법을 multi-task로만 학습했기 때문에 task-specific memory specialization 가능성도 남아 있다.

# 내가 이해한 핵심

장기 VLA 기억에서 중요한 질문은 “과거를 얼마나 많이 남길까”가 아니라 “이 과거 조각이 현재 관찰을 본 뒤에도 다음 행동을 바꾸는가”다. D&R은 이 질문을 action loss로 직접 학습하고, 같은 선택 규칙을 tree처럼 반복해 긴 history 문제를 계산 가능한 작은 선택 문제로 바꾼다.

# 다음에 연결해서 읽을 논문

- RoboMME: 16개 task가 요구하는 서로 다른 memory 유형과 평가 프로토콜을 이해하기 위해
- HAMLET: learned latent memory가 token selection보다 유리한 조건을 비교하기 위해
- RB-VLA: fully predictive belief와 policy-sufficient memory의 목표 차이를 보기 위해
