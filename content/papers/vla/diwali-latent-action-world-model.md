---
title: "DiWALI: Diffusion Policy Learning in World Models via Latent Action Inference from Human and Robot Play"
date: 2026-11-20
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Akshay L. Chandra, Iman Nematollahi, Lingyue Zhao, Daria Kulikova, Angela P. Schoellig, Fabien Despinoy, Abhinav Valada"
paper: "https://arxiv.org/abs/2611.24836"
code: "https://github.com/robot-learning-freiburg/diwali"
project: "https://diwali.cs.uni-freiburg.de/"
thumbnail: "/papers/assets/vla/diwali-latent-action-world-model/architecture.png"
---

# 한 줄 요약

DiWALI는 행동 라벨이 없는 인간 play에서 latent action을 추론해 로봇 play와 하나의 world model을 학습하고, 이 공간의 diffusion policy를 상상 속 PPO로 개선한 뒤 소량의 로봇 데이터로 실제 명령에 접지한다.

# 논문 정보

- 제목: DiWALI: Diffusion Policy Learning in World Models via Latent Action Inference from Human and Robot Play
- 저자: Akshay L. Chandra, Iman Nematollahi, Lingyue Zhao, Daria Kulikova, Angela P. Schoellig, Fabien Despinoy, Abhinav Valada
- 발표: 확인 필요 (arXiv v1, 2026-11-18)
- 링크: [arXiv](https://arxiv.org/abs/2611.24836) · [HTML](https://arxiv.org/html/2611.24836v1)
- 코드/프로젝트: [GitHub](https://github.com/robot-learning-freiburg/diwali) · [프로젝트 페이지](https://diwali.cs.uni-freiburg.de/)
- 키워드: latent action, world model, diffusion policy, human play, imagination RL, action grounding

# 핵심 아이디어

로봇 action label이 없는 인간 영상도 연속 프레임 사이의 변화를 설명하는 latent action으로 바꾸면, 로봇 play와 같은 dynamics model을 학습하는 데 쓸 수 있다. DiWALI는 inverse dynamics model이 두 관측 사이의 16차원 latent action을 추론하고 RSSM이 이를 받아 다음 latent state를 예측한다. 실제 robot command는 frozen world model 위에서 robot play만으로 학습한 state-conditioned decoder가 담당한다.

# VLA 관점에서 중요한 이유

이 논문은 latent action을 단순 pretraining target으로 버리지 않고 **정책의 action space이자 상상 학습의 제어 입력**으로 끝까지 유지한다. 실험은 latent가 현재 로봇 상태와 결합돼야 실행 가능한 명령으로 복호화된다는 점도 보여준다. 즉 cross-embodiment 비디오를 정책으로 옮길 때 representation과 grounding을 분리해야 한다.

# Robot / Embodied Setting

시뮬레이션은 CALVIN environment D의 7-DoF Franka Panda와 11개 tabletop task를 쓴다. 6시간 teleoperation play를 절반은 robot play, 절반은 렌더링된 인간 팔의 action-free CALVIN-H로 구성한다. 정책 demonstration은 task당 인간 50개와 로봇 0·1·5개 조건을 비교한다. 실제 환경은 Franka Panda와 static/gripper camera를 사용하며, 같은 workspace에서 인간 play 2시간과 로봇 play 2시간을 수집한다. 실제 세 skill에는 task당 인간 demonstration 50개와 로봇 demonstration 5개를 쓴다.

# Method

1. **Latent-action world model:** 두 연속 관측 embedding에서 inverse model이 $u_{t-1}$을 추론하고, RSSM은 robot command 대신 이 latent action으로 state를 갱신한다.
2. **분리된 action grounding:** world model을 고정하고 robot play의 $(z_t,u_t,a_t)$로 decoder $g_\xi(z_t,u_t)$를 학습한다. 현재 state 조건이 같은 효과에 필요한 robot command의 차이를 해소한다.
3. **Action-free policy learning:** 인간 demonstration을 frozen model로 변환한 latent action에 1D U-Net diffusion policy를 behavior cloning한다.
4. **Imagination improvement:** 완료 이후 state로 reward classifier를 만들고, frozen world model 안에서 denoising step까지 MDP로 펼쳐 PPO를 적용한다. BC regularization과 연속 latent 변화 penalty가 model exploitation을 억제한다.
5. **Deployment:** 관측 → world-model state → diffusion latent action → state-conditioned decoder → 7차원 end-effector/gripper action chunk 순으로 실행한다.

# 핵심 그림

![인간과 로봇 play에서 latent-action world model을 학습하고 robot action decoder와 인간 demonstration diffusion policy를 분리 학습한 뒤 imagined PPO로 개선하는 DiWALI 구조](/papers/assets/vla/diwali-latent-action-world-model/architecture.png)

> Figure 2 원본. 출처: [arXiv HTML Figure 2](https://arxiv.org/html/2611.24836v1#S3.F2), CC BY-NC-SA 4.0. 캡션: (a) action-free 인간·로봇 play로 latent-action RSSM을 학습하고, (b) robot play로 action decoder를 별도 학습하며, (c) 인간 demonstration으로 latent diffusion policy를 학습한 뒤, (d) frozen world model 안에서 PPO로 정책을 개선하는 전체 흐름.
>
> 이 논문의 핵심 기여가 실제 장면보다 **같은 latent action space가 dynamics, policy, imagination을 어떻게 연결하는지**에 있으므로 구조도를 골랐다. 학습에서는 관측 쌍 → inverse dynamics의 $u_t$ → RSSM의 $z_{t+1}$로 흐르며 decoder와 policy는 각각 robot play와 인간 demonstration으로 분리 학습된다. 추론에서는 관측을 $z_t$로 만들고 diffusion latent action을 state-conditioned decoder가 실제 action으로 바꾼다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)                        |      DiWALI |                                    비교 기준 |    차이 | 출처            |
| ----------------------------------------------------- | ----------: | -------------------------------------------: | ------: | --------------- |
| CALVIN, 로봇 demo 0 + 인간 demo 50                    | 59.6 ± 10.1 |   Diffusion Policy, 로봇 demo 5: 35.2 ± 11.5 | +24.4%p | Table I         |
| CALVIN, 로봇 demo 0 + 인간 demo 50                    | 59.6 ± 10.1 |                 CLAM-X, 같은 demo: 8.2 ± 5.1 | +51.4%p | Table I         |
| state-conditioned decoder, 로봇 demo 5 + 인간 demo 50 | 61.6 ± 11.1 | 별도 decoder이나 state 조건 없음: 18.7 ± 9.8 | +42.9%p | Table II(a)     |
| imagination PPO, 로봇 demo 5 + 인간 demo 50           |  75.8 ± 5.9 |                   fine-tuning 전 61.6 ± 11.1 | +14.2%p | Table III       |
| 실제 로봇 3-skill 평균                                |        70.0 |                          fine-tuning 전 53.0 | +17.0%p | Figure 4 / §V-E |

첫 행은 demonstration 비용 조건이 다르므로 동일-budget 비교가 아니라, 로봇 demonstration 없이도 로봇 demo 5개 baseline을 넘었다는 data-efficiency 결과다. 같은 demonstration을 쓰는 CLAM-X 비교가 decoder 설계 효과를 더 직접적으로 보여준다. 실제 로봇 수치는 skill당 20 rollout, 세 seed 평균이며 추가 실제 상호작용 없이 imagined fine-tuning만 수행했다.

# Limitations / Discussion

인간 play는 아직 로봇과 같은 workspace와 비슷한 카메라 구성을 요구해 in-the-wild 비디오로 바로 확장되지 않는다. grounding에는 robot play가 필수이며 play의 robot 비율이 10%일 때 성공률은 36.2%, 1%일 때는 7.4%로 급락한다. frozen world model PPO는 모델 오류를 이용할 수 있고, policy가 바뀐 뒤 실제 rollout으로 world model을 갱신하지 않는다. CALVIN-H도 실제 사람 영상이 아니라 렌더링 인간 팔이므로 시뮬레이션의 embodiment gap을 과대 해석하면 안 된다.

# 내가 이해한 핵심

인간과 로봇이 같은 명령 좌표계를 공유하지 않아도 **장면에 일어난 변화**는 공유할 수 있다. 그 변화 공간에서 dynamics와 policy를 배우고, 현재 robot state를 아는 decoder만 command를 담당하면 인간 데이터의 양과 로봇 데이터의 접지 역할을 분리할 수 있다.

# 다음에 연결해서 읽을 논문

- [CLAM](https://arxiv.org/search/?query=Continuous+Latent+Action+Models&searchtype=title): decoder 결합 방식의 직접 baseline
- [LAPA](https://arxiv.org/abs/2410.11758): action-free 비디오 latent action으로 VLA를 pretrain하는 대표 방법
- [DreamerV3](https://arxiv.org/abs/2301.04104): imagined behavior learning 기반
- [DiWA](https://arxiv.org/search/?query=Diffusion+Policy+Policy+Optimization+with+World+Models&searchtype=title): robot-action world model 안의 diffusion policy 개선 비교 방법
