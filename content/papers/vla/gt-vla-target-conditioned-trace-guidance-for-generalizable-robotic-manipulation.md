---
title: "GT-VLA: Target-Conditioned Trace Guidance for Generalizable Robotic Manipulation"
date: 2026-09-29
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Visual Guidance"
  - "Robot Manipulation"
venue: "확인 필요"
authors: "Ninghan Zhong, Jing-Chen Peng, Sriram Vishwanath"
paper: "https://arxiv.org/abs/2609.31904"
code: ""
project: "https://ivaniz.github.io/gt-vla/"
---

# 한 줄 요약

GT-VLA는 범용 VLM이 지정한 의미적 목표점을 2D end-effector trace로 바꿔, 저수준 VLA가 새로운 물체와 긴 과업에서도 고수준 의도를 실제 행동으로 따르게 한다.

# 논문 정보

- 제목: GT-VLA: Target-Conditioned Trace Guidance for Generalizable Robotic Manipulation
- 저자: Ninghan Zhong, Jing-Chen Peng, Sriram Vishwanath
- 발표: 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2609.31904), [HTML](https://arxiv.org/html/2609.31904)
- 코드/프로젝트: [공식 프로젝트 페이지](https://ivaniz.github.io/gt-vla/)
- 키워드: VLA, visual trace, semantic target, mixture-of-experts, OOD generalization

# 핵심 아이디어

범용 VLM이 긴 지시를 PICK·PLACE 같은 skill sequence로 나누고 각 skill의 target point를 이미지 좌표로 지정한다. GT-VLA의 trace expert는 현재 end-effector 위치와 이 목표점을 조건으로 2D 경로를 생성하며, action expert는 그 경로가 overlay된 관측에서 실제 6-DoF 행동과 gripper 명령을 낸다.

PICK과 PLACE처럼 비슷한 화면 경로가 다른 제어를 요구하는 모호성을 줄이기 위해 skill별 trace/action expert를 둔 deterministic MoE를 사용한다. Scene drop, trace drop, 저주파 trace perturbation으로 정책이 trace를 무시하거나 잘못된 trace를 맹목적으로 따르는 양쪽 실패를 함께 완화한다.

# VLA 관점에서 중요한 이유

고수준 VLM을 붙이는 것만으로는 저수준 정책이 지시를 따르지 않을 수 있다. GT-VLA는 의미 목표를 제어 가능한 중간 표현인 시각 trace로 변환해, semantic planning과 motor execution 사이의 정보 병목을 명시적으로 설계한다.

특히 학습하지 않은 LIBERO suite와 실제 장기 조작에서 개선되어, VLA generalization이 backbone 지식뿐 아니라 guidance를 행동까지 전달하는 interface에 달렸음을 보여 준다.

# Robot / Embodied Setting

- 시뮬레이션: LIBERO-10/90으로 학습하고 LIBERO-Goal, Spatial, Object에서 OOD 평가
- 실로봇: side-view·wrist camera를 장착한 YAM arm
- 실제 과업: 2~6개의 PICK/PLACE skill로 구성된 조합 및 OOD 과업
- 학습 데이터: 실제 환경 299개 complete episode, simulation은 100k iteration
- Backbone: Gemma 2B 계열 shared VLM, skill별 300M action expert, 약 60M trace expert

# Method

1. 범용 VLM이 instruction을 skill plan으로 분해한다.
2. 각 skill 시작 시 의미 목표점 `g`를 이미지 좌표로 예측한다.
3. Flow-matching trace expert가 현재 end-effector projection에서 목표점으로 이어지는 고정 길이 2D trace를 생성한다.
4. Trace를 관측 영상에 overlay하고, 해당 skill의 action expert가 action chunk를 만든다.
5. Progress head가 threshold를 넘으면 다음 skill로 전환한다.

현재 high-level skill plan은 open-loop이며, 실행 중 재계획은 후속 과제로 남겨 두었다.

# 핵심 그림

![범용 VLM의 skill 계획과 목표점이 trace expert와 action expert를 거쳐 로봇 행동으로 전달되는 GT-VLA 파이프라인](/papers/assets/vla/gt-vla-target-conditioned-trace-guidance-for-generalizable-robotic-manipulation/overview.svg)

_논문 Figure 1과 Figure 2를 바탕으로 재구성._ 이 논문의 차별점은 성능 막대보다 **의미 목표 → 2D trace → 행동**의 연결 구조에 있으므로 구조 그림을 선택했다. 출처: [논문 원문](https://arxiv.org/html/2609.31904).

# Experiments / Results

논문 Table I의 동일한 OOD protocol(각 suite 10 tasks × task당 50 trials)에서 GT-VLA 평균 성공률은 43.8%로 가장 높았다. 특히 LIBERO-Object에서 vanilla π0.5보다 40.2%p 높아 semantic target과 trace guidance가 novel object generalization에 크게 기여했다.

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓)         | 제안 방법 |      비교 기준 |    차이 | 출처     |
| ---------------------------------------- | --------: | -------------: | ------: | -------- |
| LIBERO OOD 평균 성공률 (%, ↑)            |      43.8 | AtomicVLA 33.9 |  +9.9%p | Table I  |
| LIBERO OOD 평균 성공률 (%, ↑)            |      43.8 |      SEAL 27.3 | +16.5%p | Table I  |
| LIBERO-Object 성공률 (%, ↑)              |      41.8 |       π0.5 1.6 | +40.2%p | Table I  |
| Trace 없는 G-VLA 대비 평균 성공률 (%, ↑) |      43.8 |     G-VLA 30.9 | +12.9%p | Table II |

# Limitations / Discussion

성능은 외부 VLM의 skill decomposition과 target localization 정확도에 의존하며, target이 틀리면 trace 전체가 잘못된 목표를 향한다. 고수준 계획은 open-loop이고 skill library가 고정되어 있어 예상치 못한 실패에서 자율 재계획하는 능력은 검증되지 않았다.

실제 평가는 한 로봇 플랫폼과 제한된 tabletop object로 수행됐고, 매 skill마다 외부 VLM을 질의하는 지연·비용도 실시간 제어에서 고려해야 한다. Trace는 2D 표현이므로 깊이, 가림, 접촉 기하를 완전히 담지 못한다.

# 내가 이해한 핵심

외부 VLM의 답을 prompt에 더 넣는 것만으로 행동이 바뀌지는 않는다. 정책이 실제로 따를 수 있는 공간적 interface로 고수준 의도를 변환해야 하며, GT-VLA에서 그 interface가 2D trace다.

# 다음에 연결해서 읽을 논문

- TraceVLA: 과거 end-effector trace로 시공간 인식을 보강하는 접근
- RT-Trajectory: 사람이 제공한 trajectory sketch를 제어 입력으로 사용하는 방법
- LoHo-Manip: VLM manager와 trace-conditioned executor를 결합한 계층형 조작
- H-VLA: key action reasoning과 motion planning을 통합한 계층형 VLA
