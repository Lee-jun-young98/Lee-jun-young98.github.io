---
title: "SWAP: Stepwise Action Policy Routing for Vision-Language-Action Models"
date: 2026-10-07
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Mousumi Das, Aditeya Prajapati, Abrar Anwar, Jesse Thomason"
paper: "https://arxiv.org/abs/2610.06926"
code: ""
project: ""
thumbnail: "/papers/assets/vla/swap-stepwise-action-policy-routing/overview.svg"
---

# 한 줄 요약

SWAP은 여러 고정 VLA 중 하나를 에피소드 시작 때 고르는 대신 action chunk마다 offline-RL critic으로 다시 선택해, 실제 DROID 과제 평균 성공률을 최강 단일 정책의 63.3%에서 96.7%로 높인다.

# 논문 정보

- 제목: SWAP: Stepwise Action Policy Routing for Vision-Language-Action Models
- 저자: Mousumi Das, Aditeya Prajapati, Abrar Anwar, Jesse Thomason
- 발표: arXiv:2610.06926v1 (2026-10-03), ICRA 2027 under review 표기만 있어 venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.06926) · [HTML 원문](https://arxiv.org/html/2610.06926)
- 코드/프로젝트: 원문에서 공개 링크를 확인하지 못했다.
- 키워드: VLA routing, offline reinforcement learning, IQL, policy composition, DROID, LIBERO

# 핵심 아이디어

서로 다른 VLA는 같은 상태에서도 자유 공간 이동, 정밀 grasp, recovery처럼 잘하는 구간이 다르다. SWAP은 정책 ID를 고수준 discrete action으로 보고, 현재 이미지와 지시에서 각 후보 정책의 장기 가치를 예측하는 routing critic을 학습한다. 실제 저수준 행동은 선택된 VLA가 만들며, 한 chunk를 실행한 뒤 critic이 다시 모든 후보를 평가한다.

학습 데이터는 후보 정책들의 성공·실패 rollout을 chunk transition `(observation, policy ID, reward, next observation, done)`으로 바꾼 것이다. frozen Qwen2.5-VL-3B embedding과 정책 ID embedding을 합쳐 double-Q와 value network를 IQL로 학습하므로 후보 VLA 자체는 재학습하지 않는다.

# VLA 관점에서 중요한 이유

VLA scaling은 보통 한 모델을 더 크게 만드는 방향이지만, SWAP은 이미 존재하는 정책들의 상보적 실패 모드를 실행 중 조합한다. 이는 VLA 생태계가 커질수록 “최고 단일 모델”보다 “상태별 최적 모델을 고르는 메타 정책”이 새로운 성능 축이 될 수 있음을 보인다. 동일 observation/action interface를 공유하면 black-box VLA도 expert로 추가할 수 있다는 점도 실용적이다.

# Robot / Embodied Setting

- 실제 로봇: DROID 구성의 7-DoF Franka Panda, 외부·손목 RGB 카메라.
- 실제 후보 정책: $\pi_0$, $\pi_{0.5}$, $\pi_0$-FAST. 과제별 정책당 성공 10회·실패 10회, 총 180 trajectory로 router를 학습하고 과제당 10회 평가.
- simulation: LIBERO-Spatial과 LIBERO-Plus Spatial, $\pi_0$, OpenVLA, OpenVLA-OFT 계열을 후보로 사용.
- routing cadence: 저수준 매 step이 아니라 VLA action chunk 경계에서만 정책을 교체한다.

# Method

1. 각 후보 VLA의 성공·실패 실행 로그를 고정 길이 chunk transition으로 변환한다.
2. frozen Qwen2.5-VL-3B가 현재 관찰과 지시를 2,048차원 특징으로 만든다.
3. 후보 정책 ID embedding을 붙인 double-Q critic과 value network를 IQL로 학습한다.
4. 추론 시 모든 후보 $k$에 대해 $\min(Q_1(o_t,k),Q_2(o_t,k))$를 계산하고 argmax 정책을 선택한다.
5. 선택 정책이 $c$개 행동을 실행한 뒤 새 관찰에서 다시 routing한다.

# 핵심 그림

![SWAP의 offline critic 학습과 온라인 VLA 라우팅 구조](/papers/assets/vla/swap-stepwise-action-policy-routing/overview.svg)

> 원문 Figure 2를 논문 내용을 바탕으로 재구성. 출처: [arXiv HTML, Figure 2](https://arxiv.org/html/2610.06926). 후보 VLA rollout에서 routing transition을 만들고, frozen VLM과 IQL critic을 학습한 뒤 chunk마다 최고 Q-value의 정책을 선택하는 흐름을 보여 준다.

구조 그림을 고른 이유는 성능 향상이 개별 VLA의 내부 변경이 아니라 “정책 ID를 action으로 삼는 상위 MDP”에서 나오기 때문이다. 학습 시에는 여러 정책의 과거 rollout과 sparse terminal reward만 사용하고, 추론 시에는 현재 관찰·언어 embedding에 후보 ID를 번갈아 결합해 보수적 double-Q 값을 비교한다. 선택된 정책만 실제 robot action을 출력하므로 router와 controller의 역할이 분리된다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (단위, ↑/↓)                         | SWAP |      최강 단일 정책 |        차이 | 출처              |
| ---------------------------------------------------- | ---: | ------------------: | ----------: | ----------------- |
| DROID 3과제 평균 성공률 (%, ↑; 과제당 10회)          | 96.7 | 63.3 ($\pi_0$-FAST) |     +33.4%p | 원문 Table I      |
| DROID 성공 trajectory 평균 step (↓)                  |  193 |  269 ($\pi_0$-FAST) | -76, -28.3% | 원문 Table I      |
| OOD distractor 2과제 평균 성공률 (%, ↑; 과제당 10회) |   85 |    35 ($\pi_{0.5}$) |       +50%p | 원문 Table IV     |
| LIBERO-Plus, 지배적 $\pi_{0.5}$ 포함 (%, ↑)          | 89.0 |  92.0 ($\pi_{0.5}$) |      -3.0%p | 원문 Table III(b) |

실제 로봇에서는 random routing도 66.7%로 단일 정책보다 조금 높지만 SWAP은 다시 +30.0%p를 얻어, 단순 교체가 아니라 상태에 맞는 선택이 핵심임을 보인다. 다만 LIBERO-Plus에서 92%의 명확한 지배 정책이 있을 때 SWAP은 89%로 뒤진다. router는 상보성이 있을 때 특히 유리하며 언제나 최강 단일 정책을 능가하는 것은 아니다.

# Limitations / Discussion

- 후보 정책별 성공·실패 rollout이 필요해 새로운 과제와 정책 라이브러리마다 offline data 수집 비용이 든다.
- DROID 실제 평가는 과제당 10회로 작고, 96.7%는 총 30회 중 29회 성공에 해당해 더 큰 반복 검증이 필요하다.
- 서로 다른 action space나 observation convention을 쓰는 VLA는 그대로 교체할 수 없다.
- routing critic이 관측하지 못한 상태에서 잘못된 정책을 고르면 후보 정책의 행동이 이후 상태 분포를 더 바꿀 수 있다.
- 지배적 정책이 있는 LIBERO-Plus ablation에서는 router가 그 정책보다 3.0%p 낮았다.

# 내가 이해한 핵심

SWAP은 mixture-of-experts의 gate를 모델 내부 token에 두지 않고, 이미 완성된 로봇 정책들 위에 둔다. 핵심 단위는 저수준 action이 아니라 “다음 chunk를 어느 정책에 맡길 것인가”이며, sparse 성공 신호로도 장기 결과를 반영하는 Q-function을 학습한다. 강한 정책 하나를 찾는 문제를 실행 중 역할 분담 문제로 바꾼 셈이다.

# 다음에 연결해서 읽을 논문

- $\pi_{0.5}$: 실제 실험의 주요 후보 정책이자 지배 정책 ablation의 기준.
- OpenVLA-OFT: LIBERO routing 후보군에 포함된 최적화된 open VLA.
- VLA-Feedback: 단일 frozen VLA의 action chunk를 실행 중 피드백으로 수정하는 접근과 비교할 수 있다.
