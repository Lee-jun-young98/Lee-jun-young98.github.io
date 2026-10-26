---
title: "Backtrack: Lightweight Recovery for Frozen VLAs"
date: 2026-10-26
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Failure Recovery"
  - "Robot Policy"
venue: "확인 필요"
authors: "Thomas Landeg, Thierry Tambe"
paper: "https://arxiv.org/abs/2610.32941"
code: ""
project: ""
thumbnail: "/papers/assets/vla/backtrack-lightweight-recovery-for-frozen-vlas/overview.svg"
---

# 한 줄 요약

Backtrack은 frozen VLA의 내부 feature로 실패 확률을 예측하고 위험할 때 최근 arm motion을 역재생해 재시도 지점으로 돌아가며, recovery demonstration이나 policy 재학습 없이 실패율을 낮춘다.

# 논문 정보

- 제목: If at First You Don't Succeed, Backtrack: Lightweight Recovery for Frozen VLAs
- 저자: Thomas Landeg, Thierry Tambe
- 발표: 확인 필요 (arXiv v1, 2026-10-23)
- 링크: [arXiv](https://arxiv.org/abs/2610.32941) · [HTML](https://arxiv.org/html/2610.32941)
- 키워드: failure detection, recovery, frozen VLA, internal representation, motion replay

# 핵심 아이디어

VLA가 실패 상태를 만든 뒤에도 그대로 진행하면 training distribution에서 더 멀어진다. Backtrack은 frozen policy의 기존 VLM feature를 읽는 작은 failure prediction head(FPH)를 학습한다. $p(\text{failure})$가 threshold를 넘으면 policy action을 잠시 막고, 정상 실행 중 buffer에 저장한 achieved arm motion을 역순으로 재생한다.

복귀 후에는 별도 recovery policy가 아니라 같은 frozen VLA가 새 관측에서 다시 행동한다. head 학습 label은 autonomous rollout의 episode-level 성공/실패뿐이다.

# VLA 관점에서 중요한 이유

실패 감지만으로는 outcome이 바뀌지 않는다. Backtrack은 내부 representation 기반 detector를 **물리적으로 실행 가능한 최소 intervention**과 연결한다. flow-matching VLA와 autoregressive action-token VLA 모두에 붙일 수 있다는 점도 중요하다.

복구 데이터 수집이나 base policy fine-tuning 없이 배포 wrapper 수준에서 실패 상태 일부를 되돌린다. 다만 scene 변화가 아니라 arm configuration만 되돌릴 수 있다는 범위를 분명히 한다.

# Robot / Embodied Setting

- LIBERO: Spatial, Object, Goal, Long 각 10 tasks; 5 seeds, task당 50 episodes
- policies: SmolVLA, $\pi_0.5$ (flow matching), $\pi_0$-FAST (autoregressive)
- MetaWorld: 50 tasks, SmolVLA; 다른 simulator와 embodiment에서 추가 평가
- control/treatment에 같은 step budget 적용; retreat step도 budget에 포함
- LIBERO-Long의 최대 1,040 steps 등 LeRobot wrapper 기본 제한의 2배 사용

# Method

FPH는 추가 backbone forward 없이 이미 계산된 feature를 읽는다. 기본 설정은 VLM prefix의 post representation이며, feature를 MAP layer와 FFN에 통과시켜 실패 확률을 낸다. head overhead는 SmolVLA 0.88%, $\pi_0$-FAST 0.50%, $\pi_0.5$ 0.48%다.

정상 실행 때 achieved end-effector motion을 buffer에 쌓는다. trigger가 켜지면 최근 경로를 역순으로 따라가고, backtracking 중 motion은 buffer에 추가하지 않는다. threshold, 최소·최대 retreat 길이, cooldown으로 반복 intervention을 제어한다.

# 핵심 그림

![Frozen VLA의 내부 feature가 실패 예측 head로 들어가고 threshold에 따라 정상 action 실행 또는 motion buffer 역재생으로 분기되는 Backtrack 제어 루프](/papers/assets/vla/backtrack-lightweight-recovery-for-frozen-vlas/overview.svg)

> 그림 1. Backtrack의 detection–retreat–retry loop. 논문 Figure 1과 Sections 3.1–3.2를 바탕으로 재구성했다. 출처: [arXiv:2610.32941, Figure 1](https://arxiv.org/html/2610.32941#S3).

구조 그림을 고른 이유는 새로운 policy architecture보다 frozen policy 바깥의 제어 loop가 핵심이기 때문이다. image·instruction·state에서 VLA가 action과 internal feature를 동시에 만들고, FPH가 feature에서 failure probability를 계산한다.

확률이 threshold 아래면 action을 실행하고 achieved motion을 buffer에 넣는다. threshold 위면 policy proposal을 억제하고 buffer를 역재생한다. 복귀가 끝나면 같은 VLA가 새 관측을 받아 다시 시도하며 base weight는 학습·추론 모두 고정된다.

# Experiments / Results

## 주요 실험 결과

Table 3의 control과 uplift를 이용해 treatment success를 계산했다. uplift는 같은 seed에서의 성공률 차이이므로 %p로 기록했다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓) | 제안 방법 | 비교 기준 | 차이 | 출처 |
| --- | ---: | ---: | ---: | --- |
| LIBERO-Long SmolVLA SR (%, ↑) | 68.40 | control 61.00 | +7.40%p | Table 3, 95% CI [4.52, 10.28] |
| LIBERO-Long $\pi_0$-FAST SR (%, ↑) | 92.40 | control 85.32 | +7.08%p | Table 3, 95% CI [5.91, 8.25] |
| LIBERO-Long $\pi_0.5$ SR (%, ↑) | 96.32 | control 94.72 | +1.60%p | Table 3, 95% CI [0.06, 3.14] |
| LIBERO 전체 SmolVLA SR (%, ↑) | 86.66 | control 83.26 | +3.40%p | Table 3 |
| MetaWorld SmolVLA SR (%, ↑) | 77.52 | control 72.32 | +5.20%p | Section 5.4 |

$\pi_0$-FAST의 LIBERO-Long 실패율은 14.68%에서 7.60%로 줄어 상대 실패 감소 48.2%다. 반면 이미 99%에 가까운 short suite에서는 false trigger 하나가 recovery 이득을 상쇄할 수 있어 Object에서 SmolVLA -0.20%p, $\pi_0$-FAST -0.20%p 같은 작은 악화도 나타난다(Table 4).

# Limitations / Discussion

실험은 simulation뿐이며 실제 robot의 tracking error, collision, cable/force constraint에서 역재생이 안전하다는 보장은 없다. arm path를 되돌려도 떨어뜨린 물체나 열린 drawer처럼 scene state는 복원되지 않는다.

평가는 retreat 가능한 tabletop task 중심이다. irreversible contact, deformable object, mobile base에서는 단순 역재생이 위험하거나 불가능할 수 있다. 각 policy의 controller configuration을 LIBERO-Long에서 선택했기 때문에 다른 suite의 최적점도 아니다.

# 내가 이해한 핵심

Backtrack의 가치는 정교한 복구 계획보다 **실패가 확실할 때 distribution shift를 더 키우지 않고 마지막으로 알던 경로를 되짚는 것**에 있다. base policy가 이미 잘하는 상태로 돌아갈 확률만 높여도 긴 task에서 의미 있는 성공률을 회수할 수 있다.

# 다음에 연결해서 읽을 논문

- SAFE: 내부 feature로 VLA 실패를 감지하지만 recovery까지 실행하지 않는 직접 선행선이다.
- Kintsugi-VLA: 실패 rollout을 학습 데이터로 바꾸는 접근과 inference-time 복귀를 비교할 수 있다.
- RePlanMem-VLA: 실패 신호 뒤 memory와 replanning을 쓰는 장기 VLA 접근이다.
