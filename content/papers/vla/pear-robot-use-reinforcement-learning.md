---
title: "Training Reasoning Models in Simulation to Natively Use Real Robots"
date: 2026-11-16
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Jiaming Tang, Zhuoyang Zhang, Junxian Guo, Fangzhou Zhao, Yilong Zhao, Zekai Li, Xingyang Li, Yuyang Zhao, Song Bian, Zhijian Liu, Song Han"
paper: "https://arxiv.org/abs/2611.18562"
code: "https://github.com/mit-han-lab/pear"
project: ""
thumbnail: "/papers/assets/vla/pear-robot-use-reinforcement-learning/overview.svg"
---

# 한 줄 요약

PEAR는 27B reasoning model이 카메라·로봇 상태를 보고 생각한 뒤 다음 end-effector pose를 직접 내도록 시뮬레이션의 성공/실패 보상만으로 학습해, 시연 없이도 새 지시·새 로봇·실세계로 전이되는 robot-use agent를 만든다.

# 논문 정보

- 제목: Training Reasoning Models in Simulation to Natively Use Real Robots
- 저자: Jiaming Tang, Zhuoyang Zhang, Junxian Guo, Fangzhou Zhao, Yilong Zhao, Zekai Li, Xingyang Li, Yuyang Zhao, Song Bian, Zhijian Liu, Song Han
- 발표: 확인 필요 (arXiv v1, 2026-11-13; 2026-11-16 cs.RO 신규 목록)
- 링크: [arXiv](https://arxiv.org/abs/2611.18562) · [HTML](https://arxiv.org/html/2611.18562)
- 코드/프로젝트: [mit-han-lab/pear](https://github.com/mit-han-lab/pear)
- 키워드: robot-use agent, robot-use reinforcement learning, agentic robotics, reasoning model, sim-to-real, GRPO, LIBERO, RoboDojo

# 핵심 아이디어

전통적 VLA가 demonstration의 관측-행동 대응을 모방한다면, 이 논문의 robot-use agent(RUA)는 범용 reasoning model 자체를 multi-turn policy로 쓴다. 매 round마다 instruction, 이전 round 전체, camera view와 arm state를 문맥으로 받고 chain-of-thought와 다음 end-effector pose의 JSON delta를 생성한다. 외부 perception, grasp/motion planner, skill library는 없고 inverse kinematics와 저수준 controller만 모델 밖에 둔다. PEAR는 같은 task·초기 상태에서 여러 episode를 생성하고 simulator의 binary success를 group-normalized advantage로 바꾸어 reasoning token과 action token 모두를 강화한다.

# VLA 관점에서 중요한 이유

이 연구는 VLA의 핵심 병목을 action head나 diffusion/flow-matching 설계보다 **post-training 방식**에서 찾는다. LIBERO demonstration으로 SFT된 $\pi_{0.5}$는 원래 task에서 96.9%로 우세하지만, 같은 scene에 다른 task를 지시하면 0.75%로 무너진다. 반면 RURL 모델은 74.4%에서 57.4%로 내려가지만 새 지시를 계속 따른다. 즉 범용 VLM의 언어·공간 reasoning을 보존한 채 행동만 RL로 습득하면, memorized scene-action association보다 instruction-conditioned policy에 가까운 일반화가 가능하다는 증거다.

# Robot / Embodied Setting

base model은 Qwen3.8-27B reasoning model이다. 첫 단계는 single-arm Franka의 LIBERO 네 suite, 두 번째는 dual-arm ARX의 RoboDojo 두 task에서 시뮬레이션 RURL을 수행한다. unseen evaluation은 LIBERO-Plus/Pro, RoboLab-120, RoboDojo의 나머지 task와 실제 dual-arm YAM을 포함한다. 실로봇에서는 학습 데이터나 weight update 없이 prompt에 robot frame, camera, named arm part만 기술하고 동일한 pose-level protocol을 사용한다. 실제 평가는 general pickup 20회와 align blocks 10회, 총 30 trials이다.

# Method

1. **공통 robot-use interface:** observation $o_t$는 camera frame과 arm state, response $y_t$는 reasoning과 centimeter/radian 단위의 end-effector pose delta다. inverse kinematics와 controller가 pose를 joint target으로 실행하며, 이전 round는 256k context에 누적된다.
2. **Sparse verifiable reward:** episode $\tau=(o_1,y_1,\ldots,o_T,y_T)$가 simulator success에 도달하면 $R(\tau)=1$, 아니면 0이다. demonstration과 dense reward는 쓰지 않는다.
3. **Group-relative update:** 같은 task·초기 상태를 공유하는 $G$개 episode의 성공률로 $\hat A_i=(R_i-\mathrm{mean}(R))/(\mathrm{std}(R)+\epsilon)$를 계산한다. reasoning과 action을 포함한 모든 생성 token이 episode advantage를 받는다.
4. **비동기 PEAR 학습:** rollout policy가 현재 policy보다 한두 version 늦는 fully asynchronous 구조이므로 score-centering correction을 쓰며 PPO clipping과 truncated importance sampling은 쓰지 않는다. all-success/all-failure group은 advantage가 0이므로 교체한다.
5. **Curriculum:** 거의 모든 rollout이 실패하면 binary reward가 학습 신호를 주지 못하므로 base model이 가끔 성공하는 LIBERO Spatial/Object/Goal부터 시작한다. 이후 LIBERO-Long, 마지막으로 RoboDojo의 general_pickup과 align_blocks를 추가한다.
6. **학습과 추론의 차이:** 학습 때만 simulator가 episode success를 판정하고 PEAR가 policy weight를 갱신한다. 배포 때는 reward와 PEAR가 사라지고, model → pose → IK/controller → 새 observation의 closed loop만 남는다.

# 핵심 그림

![시뮬레이션에서 camera와 arm state를 받은 reasoning model이 생각과 end-effector pose를 생성하고, IK controller 실행과 binary success를 거쳐 PEAR의 group-relative RL로 학습된 뒤 같은 인터페이스로 실제 로봇에 전이되는 구조](/papers/assets/vla/pear-robot-use-reinforcement-learning/overview.svg)

> 논문 Figure 1–2와 §3.1–3.3을 바탕으로 재구성. 출처: [arXiv HTML Figure 1–2 및 Method](https://arxiv.org/html/2611.18562#S3). 캡션: 공통 pose-level robot-use loop, 시뮬레이션 전용 RURL 학습 경로, 실로봇 zero-shot 배포 경로를 한 그림에 분리했다.
>
> 결과 그래프보다 이 구조 그림을 고른 이유는 논문의 차별점이 별도 VLA action head가 아니라 **reasoning model이 행동을 직접 쓰는 공통 인터페이스**와 **binary task reward가 reasoning/action 전 token을 학습시키는 연결**에 있기 때문이다. 입력은 instruction, 누적 interaction history, camera와 arm state다. 모델은 reasoning과 pose delta를 출력하고 IK/controller가 물리 행동으로 바꾼다. 학습에서는 식 (1)의 group-normalized advantage와 식 (2)의 score-centering update가 이 loop 전체를 강화한다. 추론에서는 simulator reward와 PEAR update를 제거하므로, 새 embodiment에는 prompt와 robot-side IK/controller만 맞추면 된다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 성공률 (%, ↑)                             | PEAR RURL 모델 |              비교 기준 |     차이 | 출처           |
| ----------------------------------------------------- | -------------: | ---------------------: | -------: | -------------- |
| LIBERO 2,000 episodes, xhigh                          |           74.4 |   base Qwen3.8-27B 1.6 |  +72.8%p | Table 2        |
| LIBERO-Pro Task perturbation, 각 모델 LIBERO 학습     |           57.4 |       $\pi_{0.5}$ 0.75 | +56.65%p | Table 3        |
| LIBERO-Pro Position perturbation, 각 모델 LIBERO 학습 |           57.5 |       $\pi_{0.5}$ 20.8 |  +36.7%p | Table 3        |
| RoboLab-120 전체, 120 tasks × 10 episodes             |           37.3 | $\pi_{0.5}$-DROID 28.0 |   +9.3%p | Table 5        |
| 실제 YAM, unseen robot, 30 trials                     |   60.0 (18/30) |  base model 0.0 (0/30) |  +60.0%p | Figure 7, §4.4 |

LIBERO 원분포에서는 demonstration을 모든 task에 대해 본 $\pi_{0.5}$가 96.9%로 PEAR의 74.4%보다 22.5%p 높다. 따라서 이 결과는 RURL이 in-distribution imitation 성능을 이겼다는 뜻이 아니다. 대신 수행해야 할 motion이 바뀌는 LIBERO-Pro task/position 조건에서 격차가 뒤집힌다. 반대로 instruction 표현만 바꾸는 semantic 조건은 $\pi_{0.5}$ 95.8%, PEAR 73.3%이고 object restyle은 96.0% 대 60.2%라서, 모든 OOD 축에서 우세한 것도 아니다.

RoboLab-120 비교는 동일 benchmark의 leaderboard 수치지만 학습 데이터가 다르다. PEAR는 LIBERO+RoboDojo simulation RL, 비교 policy들은 DROID real-robot checkpoint이므로 표는 zero-shot benchmark 성능 비교이지 데이터 효율의 통제 실험은 아니다. 실제 로봇 60%도 두 task 30회에 한정된다.

# Limitations / Discussion

학습은 두 simulator와 RoboDojo 두 task까지만 확장됐고 27B 단일 base model만 쓴다. full RoboDojo에서는 540 episode 중 370개(68.5%)가 256k context 소진으로 실패해 long-horizon 한계가 크다. xhigh 추론은 round당 평균 3.23k thinking tokens와 약 4.3초(GB300, 747 token/s)가 필요하며, 일부 chain-of-thought는 32k token에 달해 한 동작이 30초 이상 걸린다. low effort는 0.86k token/round로 빨라지지만 LIBERO 성공률이 74.4%에서 21.9%로 떨어진다. 또한 action chunk가 아니라 pose 하나씩 출력해 controller 품질과 step budget에 민감하고, 어려운 task는 embodiment를 상세히 설명한 prompt에 크게 의존한다. 실제 로봇 평가는 30 trials뿐이며 안전성, 접촉 힘, 동적 환경은 충분히 검증되지 않았다.

# 내가 이해한 핵심

이 논문의 메시지는 "VLM이 곧바로 VLA를 대체한다"가 아니다. 정확히는 **robot action을 computer-use처럼 정의할 수 있으면, reasoning model의 범용성에 verifiable robot reward를 연결하는 post-training 경로가 열린다**는 것이다. pose-level abstraction이 embodiment 차이를 IK/controller 아래로 숨겨 sim-to-real을 돕는 동시에, 느린 multi-round 실행과 controller 의존성을 만든다. 따라서 향후 핵심 경쟁은 reasoning의 일반성과 action chunk·실시간성의 결합에 있을 가능성이 크다.

# 다음에 연결해서 읽을 논문

- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): demonstration SFT 기반 VLA와 instruction generalization 차이를 이해하기 위한 직접 비교군
- [LIBERO-PRO](https://arxiv.org/abs/2510.03827): scene memorization과 실제 instruction following을 분리하는 perturbation benchmark
- [RoboDojo](https://arxiv.org/abs/2607.04434): LLM/VLM agent와 generalist robot policy를 함께 평가하는 sim-and-real benchmark
- [SFT Memorizes, RL Generalizes](https://proceedings.mlr.press/v267/chu25y.html): 본 논문의 post-training 가설을 뒷받침하는 일반 RL/SFT 비교
- [Agentic-Teacher](/papers/vla/agentic-teacher-failure-driven-vla-post-training): coding agent로 교정 demonstration을 만들고 VLA에 증류하는 대조적 후속학습 접근
