---
title: "ESI: An Embodied Self-Improvement Flywheel for LLM–VLA Agents"
date: 2026-11-16
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Yundi Cai, Zihan Wang, Chenxi Han, Yi Cheng, Houde Liu, Zilei Wang"
paper: "https://arxiv.org/abs/2611.18176"
code: ""
project: ""
thumbnail: "/papers/assets/vla/esi-embodied-self-improvement-llm-vla-agents/overview.svg"
---

# 한 줄 요약

ESI는 고정 LLM 교사와 VLA 학생의 상호작용 기록에서 prompt, 공유 skill interface, VLA policy를 함께 갱신해 reasoning–action handoff 자체를 반복적으로 개선하는 embodied self-improvement flywheel이다.

# 논문 정보

- 제목: ESI: An Embodied Self-Improvement Flywheel for LLM–VLA Agents
- 저자: Yundi Cai, Zihan Wang, Chenxi Han, Yi Cheng, Houde Liu, Zilei Wang
- 발표: 확인 필요 (technical report; arXiv v1, 2026-11-13; 2026-11-16 cs.RO 신규 목록)
- 링크: [arXiv](https://arxiv.org/abs/2611.18176) · [HTML](https://arxiv.org/html/2611.18176)
- 코드/프로젝트: arXiv가 제시한 GitHub 링크는 확인 시점에 공개 페이지를 반환하지 않음
- 키워드: embodied self-improvement, LLM–VLA agent, subtask conditioning, intervention-to-policy distillation, RoboDojo, flow matching

# 핵심 아이디어

LLM과 VLA를 단순 연결하면 LLM이 의도한 local subtask와 VLA 행동이 어긋나거나, LLM이 복구한 상태에서 VLA가 다시 이전 오류를 되풀이할 수 있다. ESI는 agent를 $A_r=(T;P_r,S_r,\theta_r)$로 본다. LLM weight $T$는 고정하지만, 의사결정 guidance $P_r$, subtask를 표현하는 skill catalog $S_r$, VLA parameter $\theta_r$를 같은 experience buffer $B_r$로 갱신한다. teacher가 선택한 local intent는 semantic supervision이 되고, teacher correction과 이어지는 student continuation은 action-level supervision이 된다.

# VLA 관점에서 중요한 이유

VLA post-training을 단일 policy의 imitation 문제로 좁히지 않고 **reasoning model과 action model 사이의 interface를 학습 대상으로 포함**한다. online control에서 사용한 “Left arm: Grasp red block” 같은 subtask 언어가 그대로 offline VLA condition이 되며, episode 전체가 실패해도 국소적으로 유효한 grasp·transport·recovery 구간을 남긴다. 따라서 LLM의 물체 선택과 교정 능력을 영구적인 VLA 행동 capability로 옮기면서, 다음 round에는 teacher가 직접 움직여야 하는 비율을 낮추는 방향으로 학습한다.

# Robot / Embodied Setting

RoboDojo simulation의 10개 selected manipulation task에서 20개 scheduled case씩 총 200 case를 평가한다. task에는 pack objects, sweep blocks, largest number, sort nesting dolls, classify objects, fill pen holder, organize table, imitate sorting, stack by language, classify by language가 포함된다. 구현은 고정 GPT-6 reasoning teacher와 $\pi_{0.5}$ 계열 VLA를 결합한다. teacher는 camera image, robot state, recent feedback, VLA proposal의 forward-kinematics trajectory를 보고 action prefix를 accept·edit하거나 직접 end-effector recovery action을 낸다.

# Method

1. **Shared subtask language:** episode instruction에 operation, acting arm, object, target/relation/orientation을 담은 local instruction을 붙여 teacher intent를 VLA에 전달한다. 같은 표현을 online 요청과 offline training condition에 사용한다.
2. **Plan–propose–review–execute:** teacher가 local subtask를 선택하고 VLA가 action chunk를 제안한다. teacher는 관찰과 예상 trajectory를 검토해 일부를 실행하거나 수정한다. correction 뒤에는 같은 goal을 유지한 채 student가 이어서 수행한다.
3. **Shared experience record:** observation, instruction, proposed/executed action, control source, teacher reasoning, feedback, outcome을 함께 저장한다.
4. **Prompt evolution:** 반복 난점과 recovery rule을 evidence와 연결해 guidance를 수정한다. independent reviewer가 근거와 기존 유효 행동 보존 여부를 확인하며 LLM weight는 고정한다.
5. **Skill evolution:** 반복되는 free-form custom operation을 안정적인 named skill과 argument schema로 승격한다. custom option은 새 행동 탐색을 위해 남긴다.
6. **Intervention-to-policy distillation:** LLM annotator가 local outcome과 instruction–action consistency를 평가한다. 유효한 student action, teacher correction, 이후 progress가 뒷받침하는 preparatory action을 연속 window로 묶는다. teacher↔student switch가 window를 끊지 않으며 masked flow-matching objective와 replay로 VLA를 갱신한다.
7. **Joint redeployment:** $P_{r+1},S_{r+1},\theta_{r+1}$을 함께 다음 round에 배포한다. 새 guidance와 skill이 수집할 operation 분포를 바꾸고, 향상된 policy는 teacher intervention이 필요한 구간을 다시 바꾼다.

# 핵심 그림

![고정 LLM 교사, 공유 skill catalog, VLA 학생이 한 episode에서 plan-propose-review-execute를 수행하고 기록된 경험으로 prompt, skill, VLA를 각각 갱신해 다음 round에 함께 재배포하는 ESI 구조](/papers/assets/vla/esi-embodied-self-improvement-llm-vla-agents/overview.svg)

> 논문 Figure 2와 §3–5를 바탕으로 재구성. 출처: [arXiv HTML Figure 2 및 System-Level Post-Training](https://arxiv.org/html/2611.18176#S3). 캡션: 한 interaction record에서 decision guidance, shared skill language, action policy를 함께 갱신하고 다음 round의 agent로 재배포하는 ESI flywheel.
>
> 이 그림을 고른 이유는 ESI가 단순한 teacher intervention 방식이 아니라 세 adaptation target이 다음 interaction을 통해 다시 결합되는 구조이기 때문이다. 입력은 task, image/robot state, interaction history이며 고정 LLM은 local intent를 선택한다. skill catalog가 이를 일관된 language condition으로 만들고 VLA가 action chunk를 제안한다. 실행 기록은 prompt review, custom-to-skill consolidation, masked flow-matching policy update의 공통 근거가 된다. 학습 시에만 세 update path가 작동하고, 다음 round의 추론에서는 갱신된 prompt·skill·VLA가 다시 plan–review–execute loop를 돈다. VLA loss는 teacher와 student의 연속 유효 구간에 temporal mask를 적용해 correction과 continuation의 연결을 보존한다.

# Experiments / Results

## 주요 실험 결과

| RoboDojo 10-task task mean (↑; 200 cases) |    ESI | matched task-only baseline |     차이 | 출처    |
| ----------------------------------------- | -----: | -------------------------: | -------: | ------- |
| 성공률 (%)                                |  49.41 |                      29.68 | +19.74%p | Table 2 |
| Score                                     |  62.03 |                      45.67 |   +16.36 | Table 2 |
| teacher intervention / episode (↓)        |  15.92 |                      27.08 |  -41.20% | Table 2 |
| teacher-executed steps / episode (↓)      | 100.28 |                     187.97 |  -46.65% | Table 2 |
| teacher step share (%) (↓)                |  11.12 |                      19.26 |  -8.13%p | Table 2 |

같은 200 case에서 ESI는 baseline 실패를 성공으로 바꾼 경우 55개, 반대로 성공을 실패로 바꾼 경우 18개로 총 성공 case가 59개에서 96개로 늘었다. 41개 공통 성공 case만 비교해도 teacher-executed step은 79.41에서 29.76으로 62.53% 줄었다.

| 10-task task mean / 비교 기준 (↑) |   ESI | strongest published reference |     차이 | 출처    |
| --------------------------------- | ----: | ----------------------------: | -------: | ------- |
| Score                             | 62.03 |         WorldScape-R2SI 48.51 |   +13.52 | Table 1 |
| 성공률 (%)                        | 49.41 |       HexaShell-Preview 38.60 | +10.81%p | Table 1 |
| 성공률 (%)                        | 49.41 |       GO-3 Nano Preview 36.60 | +12.81%p | Table 1 |

Table 1의 외부 reference는 각 published leaderboard system의 보고값이고, causal 비교는 동일 구현·동일 case의 Table 2 matched baseline이 더 적절하다. task별로도 모두 좋아진 것은 아니다. matched baseline 대비 imitate sorting은 11.76%에서 94.12%(+82.36%p)로 크게 올랐지만 fill pen holder는 35%에서 5%(-30%p)로 하락했다. Table 3의 component rollback에서는 100 matched case 기준 ESI 52% SR에 비해 prompt rollback 41%, initial VLA rollback 29%, free-form skill serialization 50%로 나타나 policy update의 영향이 가장 컸고 skill의 정확한 직렬화 효과는 상대적으로 작았다.

# Limitations / Discussion

평가는 RoboDojo simulation과 선택된 10개 task에 한정되며 실제 로봇 검증이 없다. LLM teacher가 online으로 image와 trajectory를 검토하고 correction을 실행하므로 계산 비용과 latency, 잘못된 교정의 안전성 분석이 필요하다. reference leaderboard와의 비교는 동일한 model·budget을 통제한 head-to-head가 아니며, 가장 강한 근거는 matched baseline 비교다. task별 결과의 분산이 크고 fill pen holder에서는 성능이 크게 악화되었다. skill rollback이 free-form instruction과 거의 비슷한 성공률을 보인 점은 canonical serialization 자체보다 local-intent content가 중요할 가능성을 남긴다. 논문은 technical report이며 top conference 채택 여부는 확인되지 않았다.

# 내가 이해한 핵심

ESI의 학습 단위는 개별 action model이 아니라 **교사가 의도를 표현하고, 학생이 제안하고, 교사가 고치고, 학생이 이어받는 전체 handoff**다. 좋은 correction만 학습하고 그 뒤 continuation을 끊으면 VLA는 복구된 상태에서 무엇을 해야 할지 배우지 못한다. 반대로 연속 window로 묶으면 LLM의 순간적 개입을 다음 round의 VLA autonomy로 바꿀 수 있다.

# 다음에 연결해서 읽을 논문

- [RoboDojo](https://robodojo-benchmark.com/): ESI가 사용한 task, Score, leaderboard protocol
- [$\pi_{0.5}$](https://proceedings.mlr.press/v305/black25a.html): ESI action student의 기반이 되는 open-world VLA
- [Agentic-Teacher](https://arxiv.org/abs/2611.17394): code-policy repair를 VLA weight로 증류하는 같은 날의 failure-driven 접근
- [FastHarness](https://arxiv.org/abs/2610.16914): frozen VLA에 대한 review scheduling과 ESI의 trainable-policy 접근 비교
