---
title: "RoboDuo: Attempt, Check and Atomic Recovery through Code for Vision-Language-Action Models"
date: 2026-10-27
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Failure Recovery"
  - "Long-Horizon Manipulation"
venue: "확인 필요"
authors: "Jie Wang, Bo Zhang, Renzhi Lu, Jianyu Chen"
paper: "https://arxiv.org/abs/2610.34108"
code: ""
project: ""
thumbnail: "/papers/assets/vla/roboduo-attempt-check-and-atomic-recovery/overview.svg"
---

# 한 줄 요약

RoboDuo는 frozen full-task VLA가 과제를 한 번 시도한 뒤 완료 여부를 검사하고, 실패하면 코드가 남은 단계를 원자 기술로 분해해 별도의 frozen atomic VLA에 넘기는 폐루프 복구 프레임워크다.

# 논문 정보

- 제목: RoboDuo: Attempt, Check and Atomic Recovery through Code for Vision-Language-Action Models
- 저자: Jie Wang, Bo Zhang, Renzhi Lu, Jianyu Chen
- 발표: 확인 필요 (arXiv v1, 2026-10-25)
- 링크: [arXiv](https://arxiv.org/abs/2610.34108) · [HTML](https://arxiv.org/html/2610.34108)
- 코드/프로젝트: 논문 공개 시점에 확인되지 않음
- 키워드: vision-language-action, failure recovery, coding agent, atomic skill, long-horizon manipulation

# 핵심 아이디어

기존 VLA는 매 관측에서 다시 호출되더라도 현재 instruction의 완료 여부를 명시적으로 확인하지 않는다. 따라서 중간 물체를 놓친 뒤에도 빈 gripper로 다음 동작을 계속할 수 있다. RoboDuo는 이를 **시도–검사–원자 복구**의 두 층 프로그램으로 바꾼다.

첫 층에서 frozen full-task VLA가 원래 instruction 전체를 한 번 수행한다. completion judge가 실패를 판정하면 두 번째 층으로 넘어가 coding agent가 만든 원자 instruction들을 frozen atomic VLA가 차례로 수행하고, 각 단계의 효과를 최대 세 번까지 재검사한다. coding agent는 저수준 action을 직접 내지 않고 어떤 executor에 어떤 instruction을 줄지만 결정한다.

# VLA 관점에서 중요한 이유

복구를 base VLA의 action 수정이나 추가 fine-tuning으로 해결하지 않고, 서로 다른 범위의 두 VLA를 코드로 조합한다. full-task policy가 이미 만든 부분 진척을 버리지 않으면서 실패 뒤 남은 단계만 짧은 기술로 다시 실행한다는 점이 장기 과제의 cascade failure에 잘 맞는다.

또한 동일 프로그램이 X-VLA와 $\pi_{0.5}$를 감쌀 수 있어 executor와 slow reasoning layer를 분리한다. 다만 성능 상한은 atomic VLA가 이미 가진 기술과 judge의 정확도에 묶인다.

# Robot / Embodied Setting

- LIBERO Spatial, Object, Goal, Long: suite당 10 tasks × task당 50 trials
- LIBERO-PRO: 위치 교환(S)·과제 교환(T) 8조건, 각 조건 500 episodes
- full-task backbone: X-VLA 또는 $\pi_{0.5}$; 4-suite/5-suite 학습 checkpoint를 각각 평가
- atomic dataset: LIBERO 125 tasks에서 9,214 clips와 5,442 programs 구축
- real robot: bimanual AgileX Piper, 네 과일을 basket에 담는 3 layouts, 방법·layout당 10 trials

# Method

성공 demonstration $D=(\ell,o_{0:T},a_{0:T-1})$를 effect-complete 원자 구간으로 분할한다. VLM이 시간 구간과 동사를 제안하고, 규칙 기반 후처리가 grasp/place/rotate/press/pull 다섯 primitive로 정규화한다. 실제 효과가 끝난 시점으로 clip 경계를 옮겨 **atomic instruction을 끝까지 수행한 데이터**인 LIBERO-Atomic을 만든다.

같은 경계에서 full-task 시도 뒤 atomic call sequence를 배치해 LIBERO-Code를 만들고 coding agent를 학습한다. 프레임이 단계 종료시각 $e_k$ 이후인지로 binary label을 만들어 LIBERO-Judge도 학습한다. 따라서 atomic policy의 clip 종료 기준과 judge의 완료 기준이 같은 supervision에서 나온다.

# 핵심 그림

![RoboDuo가 원래 과제를 full-task VLA로 시도하고 완료 검사 실패 시 coding agent의 원자 계획과 atomic VLA로 남은 단계를 복구하는 구조](/papers/assets/vla/roboduo-attempt-check-and-atomic-recovery/overview.svg)

> 그림 1. RoboDuo의 두 층 실행과 학습 데이터 흐름. 논문 Figure 2와 Sections 3.2–3.4를 바탕으로 재구성했다. 출처: [arXiv:2610.34108, Figure 2](https://arxiv.org/html/2610.34108#S3).

구조 그림을 고른 이유는 기여가 새 action backbone이 아니라 두 frozen executor 사이의 제어권 전환과 공통 segmentation supervision에 있기 때문이다. 입력은 instruction과 현재 관측이며, coding agent가 먼저 full-task 호출과 완료 검사를 포함한 프로그램을 작성한다.

추론에서는 $\pi_{\mathrm{full}}$이 전체 과제를 한 번 시도하고 judge $J$가 성공이면 종료한다. 실패면 남은 원자 instruction을 $\pi_{\mathrm{atomic}}$이 실행하며 각 효과를 $J$가 확인한다. 학습에서는 같은 demonstration 경계가 atomic clips, 프로그램, judge labels를 동시에 만들지만, 배포 시 두 VLA는 모두 고정된다.

# Experiments / Results

## 주요 실험 결과

같은 backbone·checkpoint의 단독 실행과 RoboDuo wrapper를 비교했다. 성공률 차이는 표의 값을 직접 빼 %p로 계산했다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓)                     |     제안 방법 |                   비교 기준 |     차이 | 출처    |
| ---------------------------------------------------- | ------------: | --------------------------: | -------: | ------- |
| LIBERO Long, 4-suite X-VLA SR (%, ↑)                 |         91.60 |                 X-VLA 87.40 |  +4.20%p | Table 2 |
| LIBERO Long, 4-suite $\pi_{0.5}$ SR (%, ↑)           |         96.20 |           $\pi_{0.5}$ 93.60 |  +2.60%p | Table 2 |
| LIBERO-PRO 8조건 평균, 4-suite $\pi_{0.5}$ SR (%, ↑) |         39.33 |           $\pi_{0.5}$ 32.05 |  +7.28%p | Table 3 |
| LIBERO-PRO Object-T, 4-suite $\pi_{0.5}$ SR (%, ↑)   |         55.80 |           $\pi_{0.5}$ 25.20 | +30.60%p | Table 3 |
| AgileX Piper, 3 layouts pooled success (%, ↑)        | 53.33 (16/30) | full-task VLA 36.67 (11/30) | +16.66%p | Table 5 |

표준 LIBERO에서는 base가 이미 강해 평균 이득이 작지만 실패 연쇄가 긴 Long에서 개선이 집중된다. LIBERO-PRO에서는 부분 진척을 재사용할 여지가 큰 Object-T가 크게 오르는 반면, base가 거의 전혀 못 푸는 조건은 atomic 복구도 살리지 못한다. 실제 로봇 결과는 layout당 10회라 통계적 결론보다 가능성 증거로 읽어야 한다.

# Limitations / Discussion

completion judge가 틀리면 성공한 과제를 불필요하게 다시 건드리거나 실패를 놓친다. coding agent가 만든 원자 instruction이 atomic VLA의 훈련 분포를 벗어날 수도 있다. 논문의 LIBERO pipeline은 다섯 primitive와 알려진 object vocabulary에 의존한다.

복구가 새로운 능력을 생성하지는 않는다. LIBERO-PRO에서 X-VLA base가 0%인 여러 조건은 RoboDuo도 거의 0%다. 실제 로봇 실험은 단일 과제군·30회뿐이며, 반복 복구의 시간 비용과 collision/safety 지표도 별도로 보고되지 않는다.

# 내가 이해한 핵심

RoboDuo의 핵심은 처음부터 모든 행동을 느린 planner가 통제하는 것이 아니라, **강한 full-task prior를 먼저 쓰고 실패가 관측된 뒤에만 실행 단위를 작게 바꾸는 것**이다. 부분적으로 맞은 rollout을 상태 초기화 없이 이어받을 수 있을 때 이 구조의 이득이 가장 크다.

# 다음에 연결해서 읽을 논문

- Backtrack: frozen VLA 실패 뒤 최근 arm 경로를 역재생하는 더 작은 intervention과 비교할 수 있다.
- Kintsugi-VLA: 실패 rollout을 recovery data로 재구성하는 학습 시점 접근이다.
- VLA-Feedback: slow planner와 빠른 feedback module을 결합하는 다른 dual-system 설계다.
