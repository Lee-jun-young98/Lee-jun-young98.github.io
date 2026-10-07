---
title: "ProactiveVLA: Augmenting Embodied Memory through Proactive Environment Exploration"
date: 2026-10-07
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Shizuo Tian, Haodong Luo, Yutong Li, Yuebing Song, Yunxin Liu, Yuanchun Li"
paper: "https://arxiv.org/abs/2610.06999"
code: ""
project: ""
thumbnail: "/papers/assets/vla/proactivevla-proactive-environment-exploration/overview.svg"
---

# 한 줄 요약

ProactiveVLA는 주어진 과제를 끝낸 뒤 남은 상호작용 예산으로 affordance·상태 변화·조합 과제를 스스로 탐색하고 검증된 규칙을 기억해, LIBERO-Pro 평균 성공률을 Harness VLA의 72.1%에서 76.4%로 높인다.

# 논문 정보

- 제목: ProactiveVLA: Augmenting Embodied Memory through Proactive Environment Exploration
- 저자: Shizuo Tian, Haodong Luo, Yutong Li, Yuebing Song, Yunxin Liu, Yuanchun Li
- 발표: arXiv:2610.06999v1 (2026-10-04), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.06999) · [HTML 원문](https://arxiv.org/html/2610.06999)
- 코드/프로젝트: 원문에서 공식 공개 링크를 확인하지 못했다.
- 키워드: agentic VLA, proactive exploration, embodied memory, rapid adaptation, LIBERO-Pro, RoboCasa365

# 핵심 아이디어

한정된 적응 예산을 같은 목표의 반복 연습에만 쓰면 환경의 다른 물체·상태·상호작용에 대한 지식이 비어 있다. ProactiveVLA는 초기 과제 수행 후 남은 turn을 세 단계 탐색에 쓴다: 개별 물체 affordance, 의미 있는 상태 변화, 이미 검증한 상호작용의 조합이다. 각 시도는 독립 visual checker가 성공·실패·불확실로 판정한다.

전체 action evidence를 lossless archive로 보존하고, 경험을 원자화한 뒤 scene 내부 induction과 scene 간 synthesis를 수행한다. 별도 critic이 후보 규칙을 실제 action record와 visual assessment에 대조해 승인한 것만 frozen global memory로 만든다. 평가 때는 이 memory와 frozen VLA를 함께 사용한다.

# VLA 관점에서 중요한 이유

VLA 성능은 controller 자체뿐 아니라 고수준 agent가 어떤 지시로 언제 호출하는지에 크게 좌우된다. ProactiveVLA는 파라미터를 바꾸지 않고 deployment environment에서 “무엇을 먼저 경험할지”를 최적화한다. 특히 task-level instruction보다 contact target·방향·종료 조건을 명시한 action-level instruction을 더 많이 사용하게 된다는 분석은 embodied memory가 VLA 호출 품질을 바꾸는 경로를 보여 준다.

# Robot / Embodied Setting

- controller: Harness VLA stack의 frozen VLA와 move/gripper 등 analytic primitive, Codex high-level agent.
- LIBERO-Pro: Spatial/Object/Goal/LIBERO-10의 task redirection(T)과 position swap(S), 8개 setting×10 task×10 rollout.
- RoboCasa365 Composite-Seen: 16개 장기 kitchen task, 과제당 5 rollout, rollout당 30 agent turn.
- adaptation: 과제별 reference instance 하나와 고정 interaction budget; evaluation 동안 global memory와 VLA 모두 고정.

# Method

1. reference scene에서 주어진 목표를 먼저 시도하고 전체 실행 기록을 남긴다.
2. 남은 예산으로 Level 1 affordance, Level 2 state change, Level 3 verified interaction composition 목표를 제안·실행한다.
3. 독립 visual checker가 명시적 before/after evidence만으로 결과를 검증하며 실패와 recovery도 보존한다.
4. lossless archive → experience atomization → within-scene induction → cross-scene synthesis로 후보 규칙을 만든다.
5. 독립 evidence review를 통과한 규칙만 global memory에 넣고, 평가 시 현재 관찰·지시와 함께 agent context에 주입한다.

# 핵심 그림

![ProactiveVLA의 능동 탐색과 검증된 전역 기억 생성 구조](/papers/assets/vla/proactivevla-proactive-environment-exploration/overview.svg)

> 원문 Figure 1을 논문 내용을 바탕으로 재구성. 출처: [arXiv HTML, Figure 1](https://arxiv.org/html/2610.06999). 초기 과제와 세 단계 능동 탐색, 독립 시각 검증, 증거 기반 memory consolidation, frozen global memory를 이용한 평가 실행을 연결한다.

구조 그림을 고른 이유는 ProactiveVLA의 기여가 low-level VLA architecture보다 adaptation–memory–deployment 전체 파이프라인에 있기 때문이다. 적응 단계에서는 남은 예산이 탐색 목표로 전환되고 성공뿐 아니라 실패·불확실·복구 evidence도 저장된다. 추론 단계에서는 승인된 규칙만 고수준 planner에 주입되고 frozen VLA는 구체화된 action-level 지시를 받아 제어한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (단위, ↑)                                 | ProactiveVLA |      Harness VLA |    차이 | 출처             |
| ---------------------------------------------------------- | -----------: | ---------------: | ------: | ---------------- |
| LIBERO-Pro 8 setting 평균 성공률 (%)                       |         76.4 |             72.1 |  +4.3%p | 원문 Table 1     |
| LIBERO-Pro Goal-T 성공률 (%)                               |         88.0 |             75.0 | +13.0%p | 원문 Table 1     |
| RoboCasa365 Composite-Seen 평균 성공률 (%, 16 task×5회)    |         41.3 |             30.0 | +11.3%p | 원문 Table 2     |
| Goal-T, 평가 중 VLA 호출 ≤1회로 완료 (%)                   |           48 |               19 |   +29%p | 원문 Figure 2(a) |
| LIBERO-Pro Goal-S 성공률, three-level exploration 효과 (%) |         71.0 | 42.0 (구조 제거) | +29.0%p | 원문 Table 3     |

LIBERO-Pro 8개 setting 중 7개에서 Harness VLA보다 높았고, position swap 4종도 모두 개선됐다. ablation에서는 초기 과제 guidance 제거가 -3%p, memory management 제거가 -4%p인 반면 세 단계 탐색 구조 제거는 -29%p여서 단순히 더 많이 상호작용하는 것보다 무엇을 탐색하는지가 더 중요했다.

# Limitations / Discussion

- 모든 실험이 simulation이며 real-world perception·dynamics·safety 아래 memory transfer는 검증되지 않았다.
- 현재 구현은 하나의 agentic VLA stack과 Codex planner에 묶여 있어 다른 planner/controller 조합의 일반성은 미확인이다.
- RoboCasa365 비교는 baseline별 rollout 수가 서로 다르고 ProactiveVLA/Harness VLA는 과제당 5회라 분산이 클 수 있다.
- 능동 탐색은 실제 로봇에서 위험하거나 비가역적인 상태 변화를 만들 수 있어 reset·안전 제약이 별도로 필요하다.
- VLM visual checker와 evidence critic의 오판이 global memory에 잘못된 규칙을 넣을 수 있다.

# 내가 이해한 핵심

ProactiveVLA는 적응을 “주어진 문제를 더 연습하는 단계”에서 “앞으로 쓸 환경 지식을 수집하는 단계”로 바꾼다. 중요한 것은 memory 양이 아니라 반증 가능한 작은 interaction을 설계하고, evidence가 있는 규칙만 승격하는 과정이다. 이 기억은 frozen VLA를 더 강하게 만들기보다 고수준 agent가 VLA에게 더 정확하고 작은 일을 맡기게 한다.

# 다음에 연결해서 읽을 논문

- Harness VLA: 동일 execution stack에서 target-task refinement를 수행하는 직접 비교 기준.
- FIND: 실제 로봇에서 agent가 실패 영역을 찾고 RL로 VLA를 개선하는 self-improvement 접근.
- Divide-and-Remember: 장기 실행 중 action-relevant memory를 재귀적으로 압축하는 VLA memory 접근.
