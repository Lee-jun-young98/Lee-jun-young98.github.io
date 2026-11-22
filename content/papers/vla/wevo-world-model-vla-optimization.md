---
title: "WEVO: World Model-Enabled VLA Optimization for Whole-Body Loco-Manipulation"
date: 2026-11-22
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Qianzhong Chen, Muyuan Lin, Yuyin Sun, Mac Schwager, Cheng-Hao Kuo, Roberto Martín-Martín"
paper: "https://arxiv.org/abs/2611.25251"
code: ""
project: "https://qianzhong-chen.github.io/wevo.github.io/"
thumbnail: "/papers/assets/vla/wevo-world-model-vla-optimization/architecture.png"
---

# 한 줄 요약

WEVO는 simulation을 휴머노이드 VLA 초기화와 dynamics coverage에 쓰고, 소량의 자율 real rollout으로 맞춘 video world model 안에서 dense-reward RL을 수행해 위험한 hardware exploration 없이 실제 성공률을 높인다.

# 논문 정보

- 제목: WEVO: World Model-Enabled VLA Optimization for Whole-Body Loco-Manipulation
- 저자: Qianzhong Chen, Muyuan Lin, Yuyin Sun, Mac Schwager, Cheng-Hao Kuo, Roberto Martín-Martín
- 발표: 확인 필요 (arXiv v1, 2026-11-18)
- 링크: [arXiv](https://arxiv.org/abs/2611.25251) · [HTML](https://arxiv.org/html/2611.25251v1)
- 코드/프로젝트: 코드 공개 확인 필요 · [공식 프로젝트 페이지](https://qianzhong-chen.github.io/wevo.github.io/)
- 키워드: whole-body VLA, humanoid loco-manipulation, video world model, reinforcement learning, sim-to-real

# 핵심 아이디어

WEVO는 photorealistic simulator와 video world model에 서로 다른 역할을 준다. LEGS simulator에서 synthetic task demonstration과 manipulation/locomotion play를 만들어 base GR00T N1.7 policy와 DreamDojo world model의 폭넓은 prior를 얻는다. 이후 task당 성공 10개·실패 10개의 자율 real rollout으로 world model을 deployment domain에 맞추고, frozen world model·whole-body controller·dense progress reward 안에서 현재 policy의 rollout을 반복 생성하며 action head를 RL로 개선한다.

# VLA 관점에서 중요한 이유

휴머노이드 VLA의 real-world RL은 넘어짐과 충돌 위험이 크고, simulator RL은 남아 있는 sim-to-real gap을 exploit할 수 있다. WEVO는 world model을 단순 auxiliary predictor가 아니라 **VLA가 실제로 탐색하고 업데이트되는 학습 환경**으로 사용한다. 동일한 real rollout 데이터에서 real-robot RL 평균 48.3%보다 world-model DICE-RL이 75.0%를 기록하고, simulator RL은 오히려 10.0%로 떨어진 결과가 환경 역할의 분리를 뒷받침한다.

# Robot / Embodied Setting

Unitree G1이 egocentric ZED 2i RGB와 15-D proprioception, language instruction을 받아 20 Hz의 40-step, 18-D whole-body target chunk를 생성한다. SONIC–MuJoCo WBC는 43-D joint state를 50 Hz로 갱신한다. 실제 평가는 Pick-and-Place Bottle(PNP), Pick-Turn-Place Bottle(PTP), Bimanual Move Basket의 세 loco-manipulation task에서 policy-task당 20회 수행한다.

# Method

1. **R2S2R 초기화:** LEGS의 3DGS scene과 MuJoCo contact에서 task당 200개 synthetic episode를 만들고 GR00T N1.7을 50,000 step fine-tune한다.
2. **Play-data world model:** 400개 manipulation play와 100개 locomotion play가 접촉 실패·물체 slip·큰 ego-view 변화를 포함한다. DreamDojo 2B checkpoint를 play로 15,000 step mid-train한 뒤 task-specific synthetic 200개와 real 20개로 30,000 step 조정한다.
3. **자율 real alignment:** base policy가 task당 성공 10개와 실패 10개를 수집한다. 같은 20개 trajectory를 WEVO와 Real RL baseline이 사용해 데이터 양을 맞춘다.
4. **폐루프 WM rollout:** VLA의 target action을 WBC가 achieved 43-DoF state로 바꾸고, world model은 seed RGB와 achieved state를 받아 12개 미래 egocentric frame을 생성한다. 요청 action이 아니라 실제 도달 state에 condition한다.
5. **Dense progress reward:** SARM progress $p_t$를 EMA로 평활화하고 $r_t=\tilde p_t-\tilde p_{t-1}$를 사용한다. 0.9 이상이 5회 연속이면 성공으로 종료한다.
6. **Online policy improvement:** 15 round 동안 round당 현재 policy rollout 32개를 새로 생성해 총 480 episode를 모은다. DICE-RL은 frozen flow prior 주변의 residual과 20-member critic ensemble을 학습하며, 비교를 위해 AWR와 ReinFlow도 같은 WM interface에서 평가한다.

# 핵심 그림

![LEGS simulator의 synthetic demonstration과 play data, 자율 real rollout, world model, VLA, whole-body controller, dense reward가 폐루프를 이루는 WEVO 파이프라인](/papers/assets/vla/wevo-world-model-vla-optimization/architecture.png)

> 원문 Figure 3. 출처: [arXiv HTML Figure 3](https://arxiv.org/html/2611.25251v1#S2.F3), CC BY 4.0. 캡션: simulator data로 초기화한 VLA와 world model을 자율 real rollout으로 맞춘 뒤, VLA–WBC–video WM rollout과 dense reward로 policy를 반복 개선하는 전체 파이프라인.
>
> Figure 2의 문제 비교보다 **학습 데이터와 추론 모듈이 어떤 폐루프를 이루는지**를 직접 보여주므로 Figure 3을 골랐다. 입력 language·RGB·proprioception에서 VLA가 action target을 내고, WBC가 achieved state를 계산하며, world model이 다음 RGB를 생성한다. progress model의 dense reward는 RL update로 돌아간다. world model 학습에는 synthetic play와 real rollout이 들어가지만, policy 개선 중에는 world model을 고정하고 current-policy rollout만 반복 갱신한다.

# Experiments / Results

## 주요 실험 결과

| 실제 Unitree G1 평가 / 성공률 (%, ↑) | WEVO / DICE-RL |      비교 기준 |    차이 | 출처             |
| ------------------------------------ | -------------: | -------------: | ------: | ---------------- |
| PNP, 20 trials                       |           85.0 |       BC: 40.0 | +45.0%p | Table II         |
| PTP, 20 trials                       |           75.0 |       BC: 20.0 | +55.0%p | Table II         |
| Basket, 20 trials                    |           65.0 |       BC: 10.0 | +55.0%p | Table II         |
| 3-task 평균                          |           75.0 |       BC: 23.3 | +51.7%p | Table II         |
| 3-task 평균                          |           75.0 |  Real RL: 48.3 | +26.7%p | Table II         |
| 3-task 평균                          |           75.0 |   Sim RL: 10.0 | +65.0%p | Table II         |
| 3-task 평균, play-data ablation      |           75.0 | w/o Play: 63.3 | +11.7%p | Table II         |
| 3-task 평균, reward ablation         |           75.0 |   Sparse: 45.0 | +30.0%p | Table II / §IV-D |

모든 policy-task 값은 실제 robot 20회에서 얻었고, Table II는 method/task당 한 training run의 final checkpoint다. DICE-RL은 task별 85/75/65%로 평균 75.0%다. Real RL은 60/45/40%로 평균 48.3%, Sim RL은 30/0/0%로 평균 10.0%다. 같은 real dataset을 쓰지만 WM 안에서는 추가 hardware interaction 없이 current policy rollout 480개를 생성하므로, 개선을 real sample efficiency와 계산량 양쪽에서 해석해야 한다.

# Limitations / Discussion

task-specific world model·reward model·policy adaptation이 필요하고, Unitree G1 전용 interface라 다른 humanoid로 zero-shot transfer되지 않는다. 각 결과는 한 training run과 task당 20회 평가라 분산 추정이 제한적이다. world-model rollout 한 run은 8 H100에서 약 12시간이며 75%가 video generation에 쓰여 계산 비용이 크다. 장기 multi-view rollout의 누적 오차, 더 긴 task, policy와 world model의 joint adaptation은 남은 과제다.

# 내가 이해한 핵심

simulator와 learned world model은 서로 대체재가 아니다. simulator는 넓고 물리적으로 구조화된 초기 경험을 싸게 제공하고, 소량의 real rollout으로 맞춘 video world model은 **현재 policy가 보게 될 deployment 분포에서 안전하게 탐색하는 환경**이 된다.

# 다음에 연결해서 읽을 논문

- [DreamDojo](https://arxiv.org/search/?query=DreamDojo&searchtype=title): WEVO가 사용하는 whole-body action-conditioned video world model
- [LEGS](https://arxiv.org/abs/2606.01458): teleoperation-free R2S2R humanoid data engine
- [DICE-RL](https://arxiv.org/search/?query=DICE-RL+robot&searchtype=all): frozen flow prior 주변의 residual policy optimization
- [WMPO](https://arxiv.org/search/?query=world+model+policy+optimization+robot&searchtype=all): sparse reward 기반 video-WM policy optimization 비교
