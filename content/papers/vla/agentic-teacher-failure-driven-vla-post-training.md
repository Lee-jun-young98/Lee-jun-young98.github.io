---
title: "Agentic-Teacher: An Agentic Data Engine for Failure-Driven VLA Post-Training"
date: 2026-11-16
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Gongyue Teng, Yuqing Xie, Yixian Zhang, Feng Gao, Shu'ang Yu, Jiaji Rao, Sukai Wang, Guanghui Ren, Ya Zhang, Maoqing Yao, Yu Wang, Chao Yu, Xinlei Chen"
paper: "https://arxiv.org/abs/2611.17394"
code: ""
project: ""
thumbnail: "/papers/assets/vla/agentic-teacher-failure-driven-vla-post-training/overview.svg"
---

# 한 줄 요약

Agentic-Teacher는 VLA의 실패 rollout에서 원인 상태를 찾아 코딩 에이전트가 국소 복구 정책을 만들고, 그 실행을 VLA가 학습하기 좋은 교정 데이터로 정제해 다시 모델 안으로 증류하는 자동 후속학습 파이프라인이다.

# 논문 정보

- 제목: Agentic-Teacher: An Agentic Data Engine for Failure-Driven VLA Post-Training
- 저자: Gongyue Teng, Yuqing Xie, Yixian Zhang, Feng Gao, Shu'ang Yu, Jiaji Rao, Sukai Wang, Guanghui Ren, Ya Zhang, Maoqing Yao, Yu Wang, Chao Yu, Xinlei Chen
- 발표: 확인 필요 (arXiv v1, 2026-11-12; 2026-11-16 cs.RO 신규 목록)
- 링크: [arXiv](https://arxiv.org/abs/2611.17394) · [HTML](https://arxiv.org/html/2611.17394)
- 코드/프로젝트: 논문에 공개 저장소 링크가 명시되지 않음
- 키워드: failure-driven post-training, coding agent, corrective demonstration, flow matching, $\pi_0$, LIBERO, MetaWorld, RoboCasa

# 핵심 아이디어

성공 trajectory만 재학습하는 Rejected Fine-Tuning(RFT)은 현재 policy가 이미 해결하는 상태를 강화할 뿐, 실패한 learner-visited state에서 무엇을 해야 하는지는 주지 못한다. Agentic-Teacher는 실패 궤적을 성공 reference와 비교해 오류를 만든 causal frame을 복원하고, pick·transport·place 같은 failure mode로 묶는다. 코딩 에이전트는 perception·grasp·motion-planning 도구를 조합한 closed-loop repair program을 반복 검증한다. 성공한 repair는 그대로 imitation data로 쓰지 않고 action noise, 유휴 frame 제거, frozen base VLA의 flow-matching loss 필터를 거친 뒤 원래 성공 rollout과 합쳐 SFT한다.

# VLA 관점에서 중요한 이유

핵심은 코딩 에이전트를 배포 시 외부 controller로 계속 붙이는 것이 아니라, **VLA가 못하는 상태를 탐색하고 교정 데이터를 만드는 teacher**로 쓴 뒤 결과 행동을 VLA weight에 되돌린다는 점이다. 특히 base $\pi_0$가 RoboCasa 세 과제에서 성공 샘플을 하나도 만들지 못해 RFT를 적용할 수 없는 상황에서도 30.0% 성공률을 만든다. 이는 sparse reward RL이나 success-only replay가 출발하지 못하는 구간에서 program synthesis가 데이터 부트스트랩 역할을 할 수 있음을 보여준다.

# Robot / Embodied Setting

모든 실험은 simulation이다. base policy는 $\pi_0$, coding agent는 GPT-5.6 Sol(high reasoning)이며, LIBERO-10, MetaWorld-10, RoboCasa 3개 과제를 사용한다. 각 task마다 base policy rollout 50개를 수집하고 실패 trajectory를 repair 대상으로 삼는다. base와 업데이트 모델은 수집 seed와 분리된 동일 initialization에서 task당 50회 평가한다. 도구 stack에는 language-conditioned segmentation(SAM3), grasp proposal(Contact-GraspNet), inverse kinematics와 motion planning(PyRoki)이 포함된다.

# Method

1. **Rollout과 causal frame 진단:** task instruction, camera observation, action trace, 가능한 성공 reference를 비교해 최종 실패보다 앞선 실제 원인 상호작용을 찾는다. harness가 해당 simulator state를 복원하고 원 rollout과 일치하는지 확인한다.
2. **Failure-mode clustering:** causal frame, 실패 단계, 원인이 비슷한 trajectory를 묶어 reusable repair의 단위로 만든다.
3. **Agentic code-policy exploration:** coding agent가 skill library, 예제, tool 문서를 검색해 repair program을 작성한다. 대표 실패에서 먼저 실행하고 video·action trace·outcome으로 수정하며, 성공하면 더 많은 시작 상태로 검증 범위를 넓힌다.
4. **Action noise:** 검증된 program을 재실행하면서 arm action에 시간 상관 noise를 더해 상태-행동 coverage를 넓힌다. gripper command는 바꾸지 않는다.
5. **Idle-frame removal:** adjacent frame의 end-effector translation, rotation, finger position 변화가 모두 임계값 이하인 중복 구간을 제거하되 gripper transition은 보존한다.
6. **Compatibility filtering과 update:** frozen base VLA가 action chunk에 부여하는 flow-matching squared prediction error $s_{base}(\tau)$가 비정상적으로 큰 trajectory를 제외한다. 남은 VLA prefix와 corrective timestep, 기존 성공 rollout을 flow-matching objective로 학습한다. 업데이트된 VLA는 coding agent 없이 평가한다.

# 핵심 그림

![VLA 실패 rollout에서 causal frame과 failure mode를 찾고 코딩 에이전트가 closed-loop repair를 검증한 뒤 action noise, 유휴 frame 제거, flow-matching loss 필터를 거쳐 VLA를 후속학습하는 Agentic-Teacher 구조](/papers/assets/vla/agentic-teacher-failure-driven-vla-post-training/overview.svg)

> 논문 Figure 1과 §3.1–3.3을 바탕으로 재구성. 출처: [arXiv HTML Figure 1 및 Method](https://arxiv.org/html/2611.17394#S3). 캡션: VLA의 실패를 원인 상태로 역추적하고, 도구 기반 repair program의 성공 실행을 base VLA와 호환되는 교정 데이터로 바꾸는 3단계 파이프라인.
>
> 결과 그래프보다 이 구조 그림을 고른 이유는 논문의 차별점이 **failure diagnosis → executable repair → learnable supervision**의 연결에 있기 때문이다. 입력은 VLA checkpoint, task, simulator/tool interface와 rollout이다. 진단 모듈이 causal frame과 failure cluster를 만들고, coding agent가 SAM3·grasp proposal·IK/planning을 호출해 해당 상태 이후를 복구한다. 학습 단계에서는 program action을 그대로 모방하지 않고 coverage, redundancy, base-policy compatibility를 차례로 조정한다. 배포/평가에서는 coding agent가 빠지고 업데이트된 VLA만 남는다. 식 (1)의 flow-matching loss는 세 번째 정제 모듈과 연결되어 base policy가 지나치게 낯설어하는 trajectory를 거른다.

# Experiments / Results

## 주요 실험 결과

| benchmark / 성공률 (%, ↑; task당 50 trials) | Agentic-Teacher | base $\pi_0$ |  RFT | base 대비 차이 | 출처     |
| ------------------------------------------- | --------------: | -----------: | ---: | -------------: | -------- |
| LIBERO-10 평균                              |            87.8 |         79.4 | 81.4 |         +8.4%p | Figure 4 |
| MetaWorld-10 평균                           |            90.6 |         80.4 | 85.2 |        +10.2%p | Figure 4 |
| RoboCasa 3-task 평균                        |            30.0 |          0.0 |  0.0 |        +30.0%p | Figure 4 |

RoboCasa의 RFT 0.0은 별도 실패한 학습 run이 아니라 base policy의 성공 rollout이 없어 success-only dataset을 만들 수 없었다는 뜻이다. 동일한 평가 초기화에서 Agentic-Teacher는 실패 상태를 repair한 데이터로 30.0%를 얻는다.

| LIBERO 누적 data-processing ablation / 성공률 (%, ↑; step 4,000) | 성공률 | 직전 단계 대비 | 출처     |
| ---------------------------------------------------------------- | -----: | -------------: | -------- |
| raw code-policy trajectory                                       |    0.0 |              - | Figure 5 |
| + 시간 상관 action noise                                         |   81.0 |        +81.0%p | Figure 5 |
| + idle-frame removal                                             |   89.0 |         +8.0%p | Figure 5 |
| + flow-matching loss filter                                      |   95.0 |         +6.0%p | Figure 5 |

최종 필터는 trajectory 수를 120개에서 110개로 줄이면서도 89.0%에서 95.0%로 높였다. 성공 program을 많이 모으는 것만으로는 부족하고, VLA가 학습 가능한 분포로 바꾸는 과정이 핵심이라는 결과다. Table 1의 failure-mode 분석에서도 두 moka pot task의 handle misalignment는 22%에서 0%로 줄었지만, long-horizon 후반의 second-pot approach obstruction은 10%에서 8%로만 줄어 residual failure가 남았다.

# Limitations / Discussion

실험은 simulation과 세 benchmark에 한정되고 실제 로봇 검증이 없다. coding agent의 성능과 simulator state restoration, success verifier, perception/control tool 품질에 강하게 의존한다. 저자도 skill-library coverage가 제한되면 repair data의 양과 다양성이 줄고, 모든 benchmark에 같은 training configuration을 사용해 task별 최적 설정을 탐색하지 못했다고 적는다. 실제 로봇에서는 failure state를 재현해 program을 반복 시험하는 비용과 안전 문제가 커진다. 또한 Figure 5의 95.0% ablation은 특정 LIBERO 설정과 training step 4,000의 누적 비교이므로 Figure 4의 benchmark 평균과 같은 조건으로 섞어 비교하면 안 된다.

# 내가 이해한 핵심

이 논문은 agent-generated trajectory를 바로 VLA demonstration으로 간주하지 않는다. program은 정밀하지만 지나치게 매끈하고 반복적일 수 있어, 작은 VLA prediction error가 누적되면 금방 학습 분포 밖으로 나간다. 그래서 Agentic-Teacher의 진짜 기여는 repair program 자체만이 아니라 **프로그램의 성공을 VLA가 흡수할 수 있는 분포로 번역하는 adapter pipeline**에 있다.

# 다음에 연결해서 읽을 논문

- [DAgger](https://proceedings.mlr.press/v15/ross11a.html): learner-visited state에 expert supervision을 모으는 기본 문제 설정
- [Harness VLA](https://arxiv.org/abs/2605.23738): frozen VLA를 tool로 호출하는 agent orchestration과 이번 weight-distillation 접근의 차이
- [Agent as Policy](https://arxiv.org/abs/2609.13747): execution feedback으로 code policy를 반복 수정하는 agentic control
- [$\pi_0$](https://arxiv.org/abs/2410.24164): base flow-matching VLA와 action objective
