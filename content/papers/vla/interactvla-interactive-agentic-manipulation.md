---
title: "InteractVLA: Turning VLAs into Interactive Tools for Agentic Robotic Manipulation"
date: 2026-11-18
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Chen Zhao, Zipeng Ye, Shifeng Bao, Yihan Lin, Haitao Shen, Yining Luo, Yuchen Xie, Jing Zhang"
paper: "https://arxiv.org/abs/2611.22584"
code: ""
project: "https://lingwupro.github.io/InteractVLA/"
thumbnail: "/papers/assets/vla/interactvla-interactive-agentic-manipulation/architecture.png"
---

# 한 줄 요약

InteractVLA는 frozen flow-based VLA에 agent가 지정한 end-effector pose를 미분 가능한 guidance로 주입하고, 생성된 action chunk를 다시 agent에게 기하학적 피드백으로 돌려주는 양방향 인터페이스로 VLA를 조향·점검 가능한 로봇 도구로 바꾼다.

# 논문 정보

- 제목: InteractVLA: Turning VLAs into Interactive Tools for Agentic Robotic Manipulation
- 저자: Chen Zhao, Zipeng Ye, Shifeng Bao, Yihan Lin, Haitao Shen, Yining Luo, Yuchen Xie, Jing Zhang
- 발표: 확인 필요 (arXiv v1, 2026-11-17)
- 링크: [arXiv](https://arxiv.org/abs/2611.22584) · [HTML](https://arxiv.org/html/2611.22584v1)
- 코드/프로젝트: [프로젝트 페이지](https://lingwupro.github.io/InteractVLA/)
- 키워드: agentic manipulation, test-time guidance, flow matching, geometric control, recursive self-improvement, action reprojection

# 핵심 아이디어

language-only agent–VLA 결합은 agent가 “무엇을” 할지는 말할 수 있어도 VLA가 “어디로 어떻게” 움직일지는 직접 고치기 어렵다. InteractVLA는 agent가 목표 위치·회전·gripper 상태 $G_k=(p^*,R^*,w^*)$를 명시하게 하고, flow denoising 중 command-to-pose mapping을 통해 이 목표의 gradient를 action expert 입력에 적용한다. 반대 방향으로는 VLA의 action chunk, executed prefix, 남은 trajectory와 camera reprojection을 agent에게 노출해 target 재지정 또는 국소 motion edit를 선택하게 한다.

# VLA 관점에서 중요한 이유

이 논문은 VLA를 다시 학습하거나 agent가 매 step low-level action을 직접 생성하지 않고도 pretrained motor prior를 공간적으로 조향한다. 특히 target pose를 단순 고정 time step에 강제하면 approach·contact·grasp 순서가 무너지므로, 도착 시점을 latent index로 두는 soft-time alignment가 중요하다. 결과적으로 high-level reasoning과 low-level control 사이의 인터페이스를 자연어 호출에서 **기하학적 목표 입력 + 실행 trajectory 출력**으로 확장한다.

# Robot / Embodied Setting

시뮬레이션은 MR-0 VLA backbone으로 LIBERO-Plus, RoboDojo, RoboCasa365를 평가한다. online tool-use와 recursive self-improvement(RSI)를 구분하고, RSI에서는 연습 환경과 실제 평가 scene을 분리한다. 실제 로봇은 Dexmal bimanual platform에서 Tabletop Tidying, Upright Bottle, Water Pouring, Move Cube 네 task를 수행한다. task마다 50 demonstrations로 같은 MR-0 backbone을 학습하고, 각 방법을 task별 30 trials로 비교한다.

# Method

1. **Agent target:** vision-language agent가 현재 관측과 task를 보고 end-effector position, orientation, gripper state를 포함한 sparse target $G_k$를 낸다.
2. **Test-time geometric guidance:** flow policy의 one-step clean estimate $m_t=x_t+(1-t)v_\theta(x_t,t;c_k)$를 differentiable command pose로 바꾸고, target error의 gradient를 denoising update에 적용한다. correction demand가 큰 incompatible target은 confidence $C_t<e^{-1}$에서 일찍 거절한다.
3. **Soft-time alignment:** target 도착 step을 고정하지 않고 $q_h(t)=\operatorname{softmax}_h(-\beta_t E_h)$로 action horizon의 후보 step에 soft assignment한다. denoising이 진행될수록 가장 잘 맞는 arrival step에 weight가 모이며 나머지 approach trajectory는 보존된다.
4. **Action-informed refinement:** 생성 action, executed prefix, camera reprojection과 observation history를 agent가 검사한다. target 자체가 틀리면 $G_k$를 다시 지정해 VLA를 재호출하고, trajectory 구조가 맞으면 approach offset·lift height·release timing만 국소 수정한다.
5. **RSI:** 여러 practice rollout에서 발견한 target specification과 recovery 전략을 축적해 held-out evaluation에 재사용한다. VLA weight는 frozen이며, 개선은 interface와 agent strategy에서 일어난다.

# 핵심 그림

![agent가 end-effector target을 지정하면 flow VLA가 soft-time guidance로 action chunk를 만들고, reprojection된 trajectory를 agent가 검사해 target 수정 또는 local refinement로 되돌리는 InteractVLA 양방향 구조](/papers/assets/vla/interactvla-interactive-agentic-manipulation/architecture.png)

> Figure 3 원본. 출처: [arXiv HTML Figure 3](https://arxiv.org/html/2611.22584v1#S2.F3), CC BY 4.0. 캡션: denoising 중 target similarity가 action horizon의 guidance weight를 정하고, 생성 motion을 camera frame에 재투영해 agent가 다음 target이나 local correction을 선택하는 양방향 geometric interface.
>
> 이 그림을 고른 이유는 real-robot montage보다 논문의 핵심 인터페이스를 직접 보여주기 때문이다. 입력은 observation·language와 agent가 지정한 pose target이고, frozen flow VLA 내부에서는 식 (1)–(6)의 pose error gradient와 soft-time assignment가 action chunk를 조향한다. 출력 action은 실행에만 쓰이지 않고 calibrated reprojection과 함께 agent로 돌아간다. 기존 language-only agent–VLA가 실패 후 같은 skill을 재호출하는 것과 달리, InteractVLA는 agent→VLA target guidance와 VLA→agent motion feedback을 모두 제공한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (%, ↑)                      | InteractVLA |          비교 기준 |     차이 | 출처    |
| -------------------------------------------- | ----------: | -----------------: | -------: | ------- |
| LIBERO-Plus online tool use, overall success |        98.3 |    Sol + MR-0 93.1 |   +5.2%p | Table 1 |
| RoboDojo online tool use, overall success    |        26.0 |     Sol + VLA 18.0 |   +8.0%p | Table 2 |
| LIBERO-Plus RSI, overall success             |        99.4 |        RV-ICL 95.8 |   +3.6%p | Table 3 |
| RoboDojo RSI, overall success                |       48.62 |  PhysicalRSI 31.38 | +17.24%p | Table 4 |
| RoboCasa365 RSI, overall success             |        89.4 | HexaShell 1.5 85.6 |   +3.8%p | Table 5 |
| 실제 Dexmal Water Pouring, task score        |        79.2 |   Agent + VLA 38.5 |  +40.7점 | Table 6 |

실제 Move Cube에서 Agent + InteractVLA는 score 97.6, 실행 시간 67.5초를 기록해 Agent + VLA의 86.7, 165.2초보다 score는 10.9점 높고 시간은 97.7초 짧다. 다만 Table 6의 “score”는 binary success rate가 아니므로 %p로 표시하지 않았다. soft-time alignment ablation에서는 fixed-final-step 대비 LIBERO-Plus 96.8→99.4(+2.6%p), RoboDojo 39.1→48.6(+9.5%p), RoboCasa365 83.0→89.4(+6.4%p)로 세 benchmark 모두 개선된다.

# Limitations / Discussion

기하 guidance는 policy action에서 end-effector pose로 가는 미분 가능한 mapping과 calibrated camera reprojection을 요구한다. force·tactile target이나 deformable object state처럼 pose만으로 표현하기 어려운 목표에는 직접 적용하기 어렵다. RSI 비교는 planner model, rollout budget, baseline protocol이 완전히 같지 않은 항목을 포함하므로 모든 SOTA 차이를 interface 하나의 효과로 볼 수 없다. 실제 평가는 단일 Dexmal platform, 네 task, task당 30 trials이며 API 지연과 calibration drift가 다른 배치에서도 유지되는지는 미확인이다. 공식 top conference 게재도 확인되지 않았다.

# 내가 이해한 핵심

InteractVLA의 가장 중요한 통찰은 agent가 VLA를 대체할 필요가 없다는 점이다. pretrained VLA가 이미 가진 smooth approach와 grasp timing을 유지하면서, agent는 몇 개의 geometric degree of freedom만 지정하고 결과 trajectory를 읽는다. 즉 VLA를 “문장을 넣으면 행동이 나오는 black box”가 아니라 **목표 pose로 조향하고 motion proposal을 검사할 수 있는 differentiable tool**로 재정의한다.

# 다음에 연결해서 읽을 논문

- [MR-0](https://arxiv.org/abs/2611.08577): InteractVLA가 사용하는 pretrained VLA backbone
- [ActionGround](https://arxiv.org/abs/2609.33256): frozen VLA의 training-free runtime action refinement
- [RoboACE](https://arxiv.org/abs/2611.13034): agent–VLA adversarial co-evolution과 self-improvement
- [A³-VLA](https://arxiv.org/abs/2611.06447): perception-guided attention alignment을 통한 spatial robustness
