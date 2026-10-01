---
title: "Correcting WHERE, Preserving HOW: Compositional Generalization for Vision-Language-Action Models via Referential Guidance"
date: 2026-10-01
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Compositional Generalization"
venue: "확인 필요"
authors: "Yanyan Zhang, Disheng Liu, Xinpeng Li, Chaoda Song, Mohsen Hariri, Debargha Ganguly, Wang Yang, Kai Ye, Bryce Grant, Vipin Chaudhary, Yu Yin"
paper: "https://arxiv.org/abs/2609.38616"
code: ""
project: ""
---

# 한 줄 요약

ReGuide는 VLA가 새 조합에서 틀린 대상에 접근하는 `WHERE` 오류만 시맨틱·기하학적 rebinding으로 고치고, 이미 배운 국소 조작 `HOW`는 동결 정책에 다시 넘겨 조합 일반화를 회복한다.

# 논문 정보

- 제목: Correcting WHERE, Preserving HOW: Compositional Generalization for Vision-Language-Action Models via Referential Guidance
- 저자: Yanyan Zhang 외 10명
- 발표: 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2609.38616), [HTML](https://arxiv.org/html/2609.38616)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: VLA, compositional generalization, referential guidance, test-time guidance, grounding

# 핵심 아이디어

새로운 객체·목적지·장면 조합에서 VLA가 실패해도 조작 기술 자체가 사라진 것은 아닐 수 있다. 저자들은 성공을 올바른 대상에 도달하는 `binding`과 도달한 뒤 작업을 끝내는 `competence`로 분해하고, 후자는 보존된다는 관찰을 이용한다.

ReGuide는 동결 VLA의 action chunk가 향하는 referent를 감시한다. 지시 대상과 다르면 grounding 결과와 학습 demonstration의 접근 자세 통계를 이용해 end-effector를 올바른 pre-contact configuration으로 운반하고, 그 지점에서 실제 관측으로 동결 정책을 다시 호출한다.

# VLA 관점에서 중요한 이유

조합 일반화 실패를 더 많은 재학습이나 별도 action scorer 문제로만 보지 않고, 전역 grounding과 국소 skill의 실패를 분리한다. 이미 가진 조작 능력을 유지한 채 `어디서 시작할지`만 test time에 복구하는 backbone-agnostic wrapper라는 점이 핵심이다.

# Robot / Embodied Setting

- 시뮬레이션: LIBERO, 단일 요인 변경 16개 composition cell과 원래 task 10개, cell당 50 paired trials
- backbone: OpenVLA-OFT, π0, π0.5, X-VLA, GR00T N1.7 중 3개에 ReGuide 적용
- 실로봇: UFACTORY xArm6, base/wrist RGB-D, pick-and-place 및 pushing
- 실로봇 학습/평가: scripted demonstrations 250개, 15 cells, 방법당 150 paired trials
- grounding: 시뮬레이션 주 비교는 oracle pose, 실로봇은 open-vocabulary detector와 depth 사용

# Method

Semantic rebinding은 action chunk의 예상 endpoint와 각 후보 물체의 bounding box·접근 반경을 비교해 정책이 어느 referent에 commit하는지 판별한다. 지시 대상과 다르거나 학습 demonstration만큼 접근 진전이 없으면 guidance를 켠다.

Geometric rebinding은 demonstration에서 물체 canonical frame 기준 grasp/release pose, 접근 step bound, 자세 허용오차를 추정한다. 이를 새 referent pose에 옮겨 bounded transport를 수행하고 pre-contact set에 진입하면 pending chunk를 버린 뒤 동결 VLA에 제어를 반환한다.

# 핵심 그림

![ReGuide가 잘못된 referent commitment를 감지하고 demonstration 기반 접근 자세로 이동한 뒤 동결 VLA에 제어를 반환하는 흐름](/papers/assets/vla/correcting-where-preserving-how-referential-guidance-for-vlas/overview.svg)

_논문 Figure 2를 바탕으로 재구성._ 기여의 중심이 새 정책을 만드는 것이 아니라 semantic mismatch 감지와 geometric hand-back의 연결에 있으므로 전체 제어 흐름을 골랐다. 출처: [논문 원문 Figure 2](https://arxiv.org/html/2609.38616).

# Experiments / Results

LIBERO composition 평균에서 bare π0.5는 39.0%였지만 ReGuide(π0.5)는 94.5%를 기록했다. 원래 task 성공률은 94.0%에서 94.2%로 유지되어, 개선이 기존 능력의 희생으로 얻어진 것이 아님을 보여 준다.

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓)           |          제안 방법 |      비교 기준 |    차이 | 출처    |
| ------------------------------------------ | -----------------: | -------------: | ------: | ------- |
| LIBERO composition 평균 성공률 (%, ↑)      | ReGuide(π0.5) 94.5 | bare π0.5 39.0 | +55.5%p | Table 1 |
| LIBERO target-object 재조합 성공률 (%, ↑)  | ReGuide(π0.5) 93.0 | bare π0.5 25.0 | +68.0%p | Table 1 |
| xArm6 recombined+unseen 평균 성공률 (%, ↑) |       ReGuide 90.0 | bare π0.5 15.0 | +75.0%p | Table 2 |
| xArm6 전체 성공률 (%, ↑)                   |       ReGuide 90.7 | bare π0.5 38.7 | +52.0%p | Table 2 |

# Limitations / Discussion

Hand-back 이후 국소 skill이 약하면 ReGuide도 실패한다. 외부 grounding module과 object pose가 필요하며, 주 시뮬레이션 비교는 oracle grounding을 사용한다. 또한 demonstration에 end-effector/object pose가 있어야 통계를 만들 수 있다.

평가는 pick-and-place와 push, 단일 요인 변경에 한정된다. articulated/deformable manipulation, 여러 요인의 동시 변화, 관계적·모호한 지시는 다루지 않았고 실로봇은 arm 1종과 backbone 1종뿐이다.

# 내가 이해한 핵심

VLA 일반화 오류를 곧바로 `skill을 못 배웠다`고 해석하면 재학습 비용이 커진다. 먼저 정책이 올바른 상호작용 위치에 도달했을 때 skill이 살아 있는지 확인하고, 살아 있다면 최소한의 기하 보정만 제공하는 편이 더 직접적이다.

# 다음에 연결해서 읽을 논문

- Causeway: instruction switching 때 기존 policy가 새 task-accessible 상태로 돌아가게 하는 접근
- GT-VLA: target-conditioned trace로 OOD 조작을 유도하는 방법
- H-VLA: key action reasoning과 motion planning을 한 action space에서 결합하는 방법
