---
title: "Fast Plans, Faithful Actions: Closing the Planning-Execution Gap in Hierarchical Vision-Language-Action Models"
date: 2026-09-28
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Hierarchical Policy"
  - "Efficient Inference"
venue: "확인 필요"
authors: "Chuanliang Xie, Boyu Ma, Gen Li, Yizhou Liu, Houwang Chen, Xinyu Zhou, Jianfei Yang"
paper: "https://arxiv.org/abs/2609.30833"
code: ""
project: ""
---

# 한 줄 요약

계층형 VLA의 waypoint planner를 block-autoregressive 방식으로 가속하고, goal을 action expert의 모든 층에 명시적으로 주입해 계획이 실제 행동에 영향을 주도록 만든다.

# 논문 정보

- 제목: Fast Plans, Faithful Actions: Closing the Planning-Execution Gap in Hierarchical Vision-Language-Action Models
- 저자: Chuanliang Xie, Boyu Ma, Gen Li, Yizhou Liu, Houwang Chen, Xinyu Zhou, Jianfei Yang
- 발표: 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2609.30833), [HTML](https://arxiv.org/html/2609.30833)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: hierarchical VLA, waypoint planning, block-autoregressive decoding, flow matching, goal conditioning

# 핵심 아이디어

기존 waypoint 계층형 VLA는 하나의 계획을 token 단위로 생성해 직렬 추론이 길고, low-level executor가 이미지와 언어만으로 행동을 예측하면서 waypoint를 사실상 무시할 수 있다. 논문은 waypoint 하나를 한 번에 생성하는 Block-AR과, 정규화된 목표 변위를 action expert 각 층에 주입하는 Normalized Goal Modulation(NGM)을 결합한다.

Phase gate와 condition noise/dropout은 goal 주입이 단순 변위 적분 shortcut으로 퇴화하는 것을 막는다. 저자들은 waypoint endpoint를 지우는 개입 실험으로 계획이 실제 행동에 미치는 영향을 직접 측정한다.

# VLA 관점에서 중요한 이유

계층형 구조가 해석 가능한 중간 계획을 출력해도 executor가 이를 사용하지 않으면 계획은 장식에 불과하다. 이 연구는 계획 생성 속도와 plan adherence를 별도 요구사항으로 정의하고, 둘을 측정 가능한 인터페이스 문제로 다룬다.

또한 action token 수가 아니라 의미 단위인 waypoint 수에 직렬 비용을 맞춰, 자유도가 높은 로봇에서도 계층형 추론을 실시간 제어에 가깝게 만든다.

# Robot / Embodied Setting

- 시뮬레이션: LIBERO Spatial, Object, Goal, Long
- 실로봇: Rokae AR5-5 양팔 로봇, 세 가지 bimanual manipulation task
- 입력: 외부/손목 카메라, 언어 지시, proprioceptive state
- planner: PaliGemma 기반 Gemma-2B
- executor: 300M flow-matching action expert
- 제어: 최대 7개 waypoint, action horizon 32

# 핵심 그림

![계층형 VLA의 waypoint planner와 action executor 사이의 연결](https://arxiv.org/html/2609.30833v1/fig1_teaser.png)

_원문 Figure 1._ planner가 위치·그리퍼·지속시간 waypoint를 만들고 executor가 이를 실제 동작으로 바꾸는 인터페이스를 보여 준다. [그림·실험표 출처: 논문 원문](https://arxiv.org/html/2609.30833).

# Method

Demonstration에서 AWE로 gripper transition과 최대 horizon 제약을 만족하는 waypoint를 추출한다. 각 waypoint는 목표 configuration, gripper 상태, 실행 duration으로 구성된다.

Block-AR은 waypoint 내부 attention은 양방향, waypoint 사이는 causal하게 두어 한 번의 backbone pass에서 한 waypoint의 모든 값을 예측한다. NGM은 현재 상태와 목표의 정규화된 차이를 AdaRMS 조건에 잔차로 주입하고, diffusion time에 따른 phase gate와 noisy/null condition 학습으로 shortcut을 억제한다.

# Experiments / Results

LIBERO에서 최대 직렬 backbone pass는 57회에서 8회로 줄었다. 실로봇 planner latency는 1,094 ms에서 125 ms로 8.7배 감소했고, 로봇이 실제 움직인 시간 비율은 29%에서 66%로 증가했다. Block-AR+NGM은 네 LIBERO suite 평균 98.45%를 기록했다.

| 로봇 / 벤치마크 / 태스크 | 제안 방법 |         비교 기준 |       차이 | 해석                                   |
| ------------------------ | --------: | ----------------: | ---------: | -------------------------------------- |
| LIBERO 4-suite 평균      |    98.45% |   Block-AR 95.85% |    +2.60%p | NGM이 계획 활용도를 높임               |
| LIBERO-Long              |     96.2% |    Block-AR 91.0% |     +5.2%p | 장기 과업에서 plan adherence 효과가 큼 |
| Rokae planner latency    |    125 ms | Token-AR 1,094 ms | 8.7배 감소 | 직렬 token decoding 병목 완화          |

# Limitations / Discussion

실험의 계층형 baseline은 저자들이 pi_0.5를 바탕으로 만든 통제용 구조이며 원래 pi_0.5 자체는 아니다. 따라서 다른 planner-executor 조합에서도 같은 underuse가 발생하는지는 추가 검증이 필요하다.

Waypoint가 horizon-compatible하다는 사실은 충돌 회피나 동역학적 실행 가능성을 보장하지 않는다. 실로봇 세 과업에서 성공률은 방법 간 비슷해, 속도 개선 외의 실제 성공률 이득은 더 다양한 환경에서 확인해야 한다.

# 내가 이해한 핵심

계층형 VLA에서 중간 계획의 품질만 보는 것은 부족하다. 계획이 제때 나오고, executor가 계획을 인과적으로 사용한다는 두 조건을 함께 검증해야 진짜 계층 구조다.

# 다음에 연결해서 읽을 논문

- pi_0.5: 본 연구가 계층형 baseline을 구성할 때 사용한 VLA 기반
- FAST: action token 직렬 생성 비용을 줄이는 주파수 기반 압축
- Decoupled Early Exits: flow-matching VLA의 task-dependent compute allocation
- H-VLA: key-action reasoning과 motion planning을 결합한 계층형 VLA
