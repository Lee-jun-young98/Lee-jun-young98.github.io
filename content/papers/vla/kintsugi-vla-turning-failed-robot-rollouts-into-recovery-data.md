---
title: "Kintsugi-VLA: Turning Failed Robot Rollouts into Recovery Data through Interventional Recoverability"
date: 2026-09-28
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Recovery Learning"
  - "Simulation Data"
venue: "확인 필요"
authors: "Ivan Snegirev, Elizaveta Semenyakina, Dmitrii Maliukov, Miguel Altamirano Cabrera, Dzmitry Tsetserukou"
paper: "https://arxiv.org/abs/2609.31048"
code: ""
project: ""
---

# 한 줄 요약

Kintsugi-VLA는 실패한 simulator rollout의 각 상태에서 expert continuation을 분기해 회복 가능성을 측정하고, 가장 정보가 큰 상태만 recovery demonstration으로 바꾼다.

# 논문 정보

- 제목: Kintsugi-VLA: Turning Failed Robot Rollouts into Recovery Data through Interventional Recoverability
- 저자: Ivan Snegirev, Elizaveta Semenyakina, Dmitrii Maliukov, Miguel Altamirano Cabrera, Dzmitry Tsetserukou
- 발표: 확인 필요 (논문 주석에는 ICRA 2027 지원으로 기재되어 있으나 채택 아님)
- 링크: [arXiv](https://arxiv.org/abs/2609.31048), [HTML](https://arxiv.org/html/2609.31048)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: VLA, recovery learning, failed rollout, interventional recoverability, simulation branching

# 핵심 아이디어

기존 simulation data engine은 성공 trajectory만 남기고 실패 rollout을 버린다. Kintsugi-VLA는 simulator snapshot을 복원한 뒤 privileged expert를 여러 번 이어 실행해, 해당 상태에서 원래 과업을 끝낼 확률을 추정한다.

회복 가능성이 threshold 아래로 계속 머무르는 terminal frontier를 찾고, 난이도와 데이터 budget을 통제하면서 그 주변의 informative state를 recovery 시작점으로 선택한다. 선택된 상태에서 성공한 expert continuation을 SmolVLA용 추가 학습 데이터로 만든다.

# VLA 관점에서 중요한 이유

실패 데이터는 단순 negative example이 아니라, 정책이 아직 돌아올 수 있는 경계와 이미 늦은 상태를 구분하는 자료다. Simulator의 restore-and-branch 능력을 이용하면 사람 annotation 없이 recovery curriculum을 만들 수 있다.

같은 frame budget에서도 uniform sampling보다 나은 결과를 보여, VLA data engine에서 데이터 양뿐 아니라 실패 상태 선택 기준이 중요함을 드러낸다.

# Robot / Embodied Setting

- 환경: 시뮬레이션 Franka manipulation
- 정책: SmolVLA recovery variants
- 데이터: 실패 rollout snapshot과 privileged expert continuation
- shifted 평가: clutter seed, friction, object mass, target scale 변화
- Protocol G pool: 3,016 states, calibration continuation 45,240회
- 비교: nominal-only, random, uniform-window, targeted recovery

# Method

각 snapshot state에서 동일 expert를 여러 번 실행하고 Wilson interval을 사용해 recovery probability를 적응적으로 추정한다. 시간에 따라 단조롭게 감소한다고 가정하지 않고, 마지막으로 낮은 recoverability가 지속되는 frontier를 찾는다.

Targeted variant는 이 추정치로 난이도 bin과 유용한 시작 상태를 구성한다. Difficulty-matched와 frame-budget-matched protocol을 함께 사용해 단순히 쉬운 상태나 더 많은 frame을 선택한 효과를 분리한다.

# Experiments / Results

Targeted recovery(V3)는 difficulty matching에서 34.6%, frame matching에서 38.4%를 기록해 uniform-window(V2)보다 각각 5.8%p, 6.7%p 높았다. Disturbed end-to-end 성공률은 63.4%로 nominal-only보다 7.7%p 높았지만 clean 성공률은 76.8%에서 74.7%로 2.1%p 낮아졌다.

| 로봇 / 벤치마크 / 태스크    | 제안 방법 |          비교 기준 |   차이 | 해석                                 |
| --------------------------- | --------: | -----------------: | -----: | ------------------------------------ |
| Difficulty-matched recovery |     34.6% |      Uniform 28.8% | +5.8%p | 같은 난이도에서 state selection 효과 |
| Frame-matched recovery      |     38.4% |      Uniform 31.7% | +6.7%p | 같은 데이터 budget에서도 개선        |
| Disturbed end-to-end        |     63.4% | Nominal-only 55.7% | +7.7%p | 실패 복구 데이터가 분포 이탈에 도움  |
| Clean task                  |     74.7% | Nominal-only 76.8% | -2.1%p | recovery와 nominal 성능의 trade-off  |

# Limitations / Discussion

Recoverability는 상태의 객관적 속성이 아니라 선택한 privileged expert, continuation budget, snapshot protocol에 의존한다. 서로 다른 expert 사이의 ranking 상관도도 낮을 수 있으며 cross-expert robustness는 아직 검증되지 않았다.

정책 variant 간 aggregate 결과에 seed별 분산과 통계적 유의성이 보고되지 않아 clean-task non-inferiority를 주장할 수 없다. 현재는 시뮬레이션 단일 Franka 설정이며 실로봇 복구로의 전이는 별도 과제다.

# 내가 이해한 핵심

실패 trajectory의 모든 frame이 같은 가치가 있는 것은 아니다. 아직 돌아올 수 있지만 nominal policy가 흔히 놓치는 경계 상태를 찾아야 제한된 데이터로 recovery 능력을 가장 많이 늘릴 수 있다.

# 다음에 연결해서 읽을 논문

- HIL-UMI: 실제 정책 실패 구간을 human-in-the-loop 데이터로 보강
- Self-Adaptive VLA: 이전 실패 rollout을 context로 사용하는 접근
- Causeway: 학습 없이 VLA를 task-accessible state로 복귀시키는 방법
- BEE: 사람 개입을 residual RL 제약으로 바꾸는 real-world 학습
