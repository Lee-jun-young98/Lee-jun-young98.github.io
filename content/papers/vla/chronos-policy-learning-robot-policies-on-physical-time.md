---
title: "Chronos Policy: Learning Robot Policies on Physical Time"
date: 2026-10-13
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Changhao Wang, Jaden Clark, Shuran Song"
paper: "https://arxiv.org/abs/2610.13929"
code: ""
project: "https://changhaowang.github.io/chronospolicy/"
thumbnail: "/papers/assets/vla/chronos-policy-learning-robot-policies-on-physical-time/overview.svg"
---

# 한 줄 요약

Chronos Policy는 센서와 행동 token에 실제 capture·execution 시각을 붙이고 time-aware RoPE로 경과 시간을 attention에 넣어, 비동기·다중 rate 관측과 inference 지연에 강한 diffusion robot policy를 학습한다.

# 논문 정보

- 제목: Chronos Policy: Learning Robot Policies on Physical Time
- 저자: Changhao Wang, Jaden Clark, Shuran Song
- 발표: arXiv:2610.13929v1 (2026-10-09), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.13929) · [HTML 원문](https://arxiv.org/html/2610.13929)
- 코드/프로젝트: [공식 프로젝트](https://changhaowang.github.io/chronospolicy/) · 코드는 공개 예정으로 표기됨
- 키워드: physical time, asynchronous sensing, time-aware RoPE, diffusion policy, temporal randomization

# 핵심 아이디어

기존 robot policy는 token 순서가 곧 시간이라고 가정한다. 하지만 RGB, proprioception, force/torque는 rate와 delay가 다르고 inference latency도 action 실행 시점을 밀어낸다. Chronos Policy는 각 observation의 capture time과 각 action의 요청 execution time을 정책 입력의 별도 좌표로 둔다. time-aware RoPE는 query와 key 회전을 물리 시각으로 계산해 attention이 token index가 아니라 $t_j-t_i$에 의존하게 한다.

# VLA 관점에서 중요한 이유

VLA가 더 많은 modality와 느린 backbone을 쓸수록 timestamp mismatch는 커진다. Chronos의 인터페이스는 이미지·촉각·proprioception·action을 한 sequence에 넣되 공통 grid로 억지 resampling하지 않는다. 대형 VLA에도 언어·시각 content embedding과 독립적인 시간 좌표를 붙이면, 모델 크기를 바꾸지 않고 sensing·execution timing을 명시할 수 있다는 설계 원칙을 제공한다.

# Robot / Embodied Setting

- simulation: Conveyor dynamic task, Pivoting multisensory task, DexMimicGen 6개 quasi-static task.
- real robot: Dynamic Cup, Peg Insertion, Pivoting. 각 task는 두 RGB와 20 Hz pose/gripper history를 쓰고 contact task는 약 90 Hz force/torque history를 추가.
- 실제 데이터: Dynamic Cup 252/13, Peg Insertion 220/11, Pivoting 322/17 train/validation demonstrations.
- timing shift: observation rate·delivery delay, 0–200 ms inference delay, 두 변화를 합친 combined 조건.

# Method

1. 요청 시각 $t$를 기준으로 모든 timestamp를 $\tilde t_i=t_i-t$로 표현한다.
2. image patch는 frame capture time, proprioception·force token은 measurement time, action token은 $t+d_t+j\Delta t_a$의 실행 시각을 받는다.
3. time-aware RoPE가 $q_i,k_j$를 해당 시각으로 회전시켜 attention 내적이 경과 시간 $t_j-t_i$에 직접 의존하게 한다.
4. 학습 때 modality별 observation rate와 delivery delay, action chunk start delay $d_t$를 randomize하되 원래 timestamp를 유지한다.
5. diffusion transformer는 noisy action chunk를 observation과 요청 action time에 조건화해 clean action으로 복원한다.

# 핵심 그림

![서로 다른 시각에 측정된 RGB·proprioception·force token과 미래 실행 시각의 action token이 time-aware RoPE를 거쳐 diffusion transformer에서 행동 chunk로 복원되는 Chronos Policy 구조](/papers/assets/vla/chronos-policy-learning-robot-policies-on-physical-time/overview.svg)

> 논문 Figure 2를 바탕으로 재구성. 출처: [arXiv HTML, Figure 2](https://arxiv.org/html/2610.13929)와 [공식 프로젝트의 architecture 설명](https://changhaowang.github.io/chronospolicy/). 물리 시각과 학습 randomization 흐름을 강조했다.

구조 그림을 고른 이유는 Chronos의 기여가 diffusion backbone보다 token에 시간 좌표를 연결하는 방식에 있기 때문이다. 입력은 각기 다른 시각의 RGB·pose·force와 noisy future action token이고, time-aware RoPE가 값 embedding을 바꾸지 않은 채 query-key 관계에 실제 시간 간격을 넣는다. 출력은 지정한 실행 시각의 action chunk다. 학습 시 timing randomization으로 여러 schedule을 만들고, 추론 시에는 측정 timestamp와 추정 inference delay로 미래 실행 시각을 지정한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 또는 score %, ↑) |    제안 방법 |             비교 기준 |    차이 | 출처         |
| ----------------------------------------- | -----------: | --------------------: | ------: | ------------ |
| simulation Conveyor, combined timing      | Chronos 32.7 |  Diffusion Policy 0.0 | +32.7%p | 원문 Table 3 |
| simulation Pivoting, combined timing      | Chronos 38.4 | Diffusion Policy 19.6 | +18.8%p | 원문 Table 3 |
| DexMimicGen 6-task, 5개 perturbation 평균 | Chronos 73.4 | Diffusion Policy 59.7 | +13.7%p | 원문 §4.4    |
| 실제 Dynamic Cup, combined                | Chronos 55.0 |               DP 30.0 | +25.0%p | 원문 Table 7 |
| 실제 Peg Insertion, combined              | Chronos 65.0 |               DP 45.0 | +20.0%p | 원문 Table 8 |

simulation Conveyor에서 AddTime은 nominal 85.8%로 Chronos 82.0%보다 높지만 wide sensing과 combined에서는 24.0%/7.8%에 그쳐 Chronos의 45.6%/32.7%보다 낮다. 같은 timestamp를 주어도 content embedding에 더하는 것보다 elapsed time을 attention 관계로 표현하는 편이 shift에 강하다는 근거다. 실제 score는 full=1, partial=0.5로 계산하므로 순수 성공률과 구분해야 한다.

# Limitations / Discussion

- timestamp 품질과 clock synchronization이 전제이며, 실제 clock drift나 잘못된 latency estimate에 대한 민감도는 충분히 다루지 않았다.
- 실제 평가는 task당 10–20회 수준이라 차이의 통계적 불확실성이 크다.
- 모든 task에서 우세하지는 않는다. 예를 들어 실제·simulation의 일부 nominal 조건과 DexMimicGen Threading/Transport에서는 baseline이 비슷하거나 더 높다.
- 시간-aware policy라도 network inference가 deadline을 넘기거나 actuator command가 유실되는 시스템 문제 자체를 해결하지는 않는다.
- 현재 실험은 diffusion imitation policy 중심이며, 언어가 포함된 대형 VLA에 직접 적용한 결과는 없다.
- 공식 conference venue와 코드 공개는 확인되지 않았다.

# 내가 이해한 핵심

robot sequence의 순서는 시간의 대용물이 아니다. Chronos는 관측이 언제 만들어졌고 행동이 언제 실행될지를 정책의 명시적 좌표로 만들어, 동일한 token 순서가 서로 다른 물리 상황을 뜻하는 모호성을 없앤다.

# 다음에 연결해서 읽을 논문

- Real-Time Chunking: inference delay에 맞춰 action chunk를 보정하는 baseline으로 sensing timestamp까지 다루는 Chronos와 대비된다.
- Reactive Diffusion Policy: 느린 vision과 빠른 tactile stream을 분리하는 방식과 단일 asynchronous transformer를 비교할 수 있다.
- TempoBridge: 언어로 실행 tempo를 바꾸는 문제와 sensor/action physical time을 표현하는 문제를 연결해서 볼 수 있다.
