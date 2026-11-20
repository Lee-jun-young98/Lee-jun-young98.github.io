---
title: "PGX: Physically Grounded Execution for Long-Horizon Humanoid Loco-Manipulation"
date: 2026-11-20
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Kai Lu, Chenyang Ma, Ioannis Havoutis"
paper: "https://arxiv.org/abs/2611.26596"
code: ""
project: "https://kl-research.github.io/pgx/"
thumbnail: "/papers/assets/vla/pgx-physically-grounded-humanoid-execution/architecture.svg"
---

# 한 줄 요약

PGX는 장기 휴머노이드 loco-manipulation에서 VLA가 약한 “언제·어디서”를 predicate state machine과 world-frame 제어에 맡기고, VLA는 각 조작 skill의 “어떻게”에 집중시켜 성공률을 크게 높인다.

# 논문 정보

- 제목: PGX: Physically Grounded Execution for Long-Horizon Humanoid Loco-Manipulation
- 저자: Kai Lu, Chenyang Ma, Ioannis Havoutis
- 발표: 확인 필요 (arXiv v1, 2026-11-19)
- 링크: [arXiv](https://arxiv.org/abs/2611.26596) · [HTML](https://arxiv.org/html/2611.26596v1)
- 코드/프로젝트: 코드 공개 확인 필요 · [프로젝트 페이지](https://kl-research.github.io/pgx/)
- 키워드: humanoid loco-manipulation, VLA execution, predicate state machine, world-coordinate locking, Unitree G1

# 핵심 아이디어

긴 과업을 하나의 VLA가 걷기, 대기, 조작, 정밀 접촉까지 모두 출력하게 하면 task progress 혼동, demonstration imbalance, 움직이는 pelvis frame의 누적 오차가 겹친다. PGX는 과업을 물리적 predicate로 경계 지은 stage graph로 만들고 navigation과 waiting은 executor가, manipulation은 VLA가 맡게 한다. object-relative stance, base station keeping, world-anchored contact target으로 조작 시작 상태와 접촉 좌표도 안정화한다.

# VLA 관점에서 중요한 이유

같은 GR00T 가중치로 coffee success가 nominal 35%에서 80%, random initialization 20%에서 80%로 올라가므로, 실패의 큰 부분이 skill capacity 부족이 아니라 **실행 순서, 시작 상태, 좌표계 관리**에 있음을 보여준다. generalist VLA를 실제 시스템에 배치할 때 planner가 prompt만 바꾸는 것으로 부족하며, 물리 event와 control ownership을 함께 설계해야 한다는 증거다.

# Robot / Embodied Setting

시뮬레이션은 Isaac Lab Arena의 Unitree G1 humanoid와 Dex-3 hands를 사용한다. box transport, mug placement, coffee fetching의 세 task에서 nominal pose와 위치 ±0.30 m·yaw ±30° random initialization을 평가한다. backbone은 $\pi_{0.5}$와 GR00T N1.6이다. 실제 로봇은 Unitree G1, Dex-3 left hand, head/wrist camera와 Vicon을 사용하고 44개 Quest demonstration으로 학습한다. 실제 coffee task는 mug grasp → machine area place → wait → re-grasp → delivery의 구조를 가진다.

# Method

1. **Stage graph:** 각 stage $s_k=(\ell_k,c_k,g_k,\tau_k,\rho_k)$는 instruction, executor, completion guard, time budget, recovery policy를 가진다. coffee task에는 approach, grasp, transport, place, press, re-grasp, transport, deliver가 있다.
2. **Physical predicates:** grasped, placed, triggered, at-stance, dropped가 demonstration segmentation, online transition, evaluation progress에 공통으로 쓰인다. guard 실패 시 retry 또는 reverse edge를 탄다.
3. **Skill execution:** flat model과 predicate 경계로 manipulation만 자른 stage model을 모두 지원한다. walking과 waiting은 학습·실행에서 VLA 밖으로 뺀다.
4. **World-coordinate locking:** object pose 기준 stance를 매 시도 갱신하고, workstation에서는 하나의 world-frame base reference를 유지한다. 정밀 접촉 목표는 $T^B_{E,d}(t)=(T^W_B(t))^{-1}T^W_{E,d}(t)$로 매 주기 base frame에 다시 표현한다.
5. **Action ownership:** PGX는 network parameter를 바꾸지 않고 stage와 physical state에 따라 VLA action channel을 선택·제약·대체한 뒤 whole-body controller에 보낸다.

# 핵심 그림

![물리 상태가 predicate stage machine을 통과해 navigation, waiting 또는 VLA manipulation을 선택하고 world-coordinate locking이 whole-body command를 안정화하는 PGX 구조](/papers/assets/vla/pgx-physically-grounded-humanoid-execution/architecture.svg)

> 논문 Figure 2와 §III를 바탕으로 재구성. 출처: [arXiv HTML Figure 2](https://arxiv.org/html/2611.26596v1#S2.F2). 캡션: executor state의 물리 predicate가 stage와 recovery를 결정하고, 조작 stage에서만 VLA action chunk를 사용하며, world-coordinate locking이 base drift와 접촉 목표를 world frame에 고정하는 흐름.
>
> 실제 G1 장면보다 성공률 향상의 원인이 **VLA 교체가 아니라 실행 ownership 분리**임을 직접 보여주기 위해 구조도를 골랐다. 입력은 policy observation과 추가 executor state로 갈라지고, stage machine이 walking/waiting/manipulation executor를 선택한다. VLA는 executor가 복구한 시작 상태에서 조작 action만 내며 WCL이 base channel과 contact target을 안정화한다. 결과는 predicate로 되돌아가 다음 stage 또는 retry를 결정한다. stage model 학습 때는 같은 predicate로 demonstration을 offline 분할하지만, flat model은 가중치 변경 없이 실행 구조만 적용할 수 있다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)                                |  PGX |           Flat VLA |    차이 | 출처     |
| ------------------------------------------------------------- | ---: | -----------------: | ------: | -------- |
| Coffee, $\pi_{0.5}$, nominal C0                               |   60 |                  0 |   +60%p | Table I  |
| Coffee, GR00T, random init C1                                 |   80 |                 20 |   +60%p | Table I  |
| 3 simulation tasks·2 init·2 backbone 전체 평균                | 80.0 |               26.0 | +54.0%p | Table II |
| Mug placement, $\pi_{0.5}$, random init C1                    |   90 |                  0 |   +90%p | Table II |
| Coffee press, $\pi_{0.5}$, C0: PGX + world-anchored primitive |   98 | PGX의 VLA press 70 |   +28%p | Table I  |

Table II의 모든 cell은 task별 같은 time budget과 success criterion을 사용하고 cell당 최소 20 episode를 평가한다. GR00T coffee 비교는 policy weights가 동일해 executor 효과를 직접 분리한다. $\pi_{0.5}$는 stage model을 사용하므로 구조와 segmentation 효과가 함께 들어가지만, same-weight ablation에서도 executor가 큰 이득을 낸다. WCL을 끄면 coffee success가 $\pi_{0.5}$에서 C0/C1 60/55% → 32/50%, GR00T에서 80/80% → 65/75%로 떨어진다. 지속적 base disturbance에서는 stage별 최대 drift p90이 54 cm에서 9 cm로 감소한다.

# Limitations / Discussion

PGX는 더 높은 성공률과 맞바꿔 stage transition 시간이 길어진다. predicate와 threshold, stage graph는 task별 설계가 필요하고 pose/state estimation 품질에 의존한다. 실제 G1 실험은 44 demonstration의 한 coffee workflow이며 stage별 조건부 completion만 제시해 end-to-end 일반화를 충분히 판단하기 어렵다. button primitive처럼 정밀 contact를 geometric controller가 대신하면 시스템 성공은 높지만 VLA 자체의 contact skill이 좋아진 것은 아니다.

# 내가 이해한 핵심

장기 과업에서 VLA를 더 학습시키기 전에 policy가 실패한 것인지, 아니면 **잘못된 stage에서 잘못된 좌표계로 호출된 것인지**를 분리해야 한다. PGX는 progress와 정밀 좌표를 물리 상태로 외부화해 VLA가 이미 가진 local manipulation 능력을 꺼내 쓴다.

# 다음에 연결해서 읽을 논문

- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): PGX가 사용하는 generalist VLA backbone
- [GR00T N1](https://arxiv.org/abs/2503.14734): humanoid manipulation backbone과 cross-embodiment pretraining
- [HOMIE](https://arxiv.org/search/?query=HOMIE+Humanoid+Loco-Manipulation&searchtype=title): 시뮬레이션 whole-body tracking controller
- [RoboACE](https://arxiv.org/abs/2611.13034): frozen VLA를 agentic execution과 recovery로 보강하는 비교 관점
