---
title: "MAWAM: A Multi-Agent World-Action Model for Coordinated Manipulation"
date: 2026-11-22
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Xianzhe Fan, Chi-Pin Huang, Fu-En Yang, Jing Wang, Yecheng Wu, Yu-Cheng Chou, Johan Bjorck, Linxi Fan, Jan Kautz, Yu-Chiang Frank Wang, Zhiding Yu, Hengshuang Zhao, Zhiqi Li"
paper: "https://arxiv.org/abs/2611.25105"
code: ""
project: "https://research-staging.nvidia.com/labs/lpr/mawam"
thumbnail: "/papers/assets/vla/mawam-multi-agent-world-action-model/architecture.svg"
---

# 한 줄 요약

MAWAM은 여러 로봇의 private view 미래와 action chunk를 하나의 생성 과정에서 공동 denoise해, 각 로봇의 제어 인터페이스를 유지하면서도 팀 전체의 물리적 결과를 예측하고 조율한다.

# 논문 정보

- 제목: MAWAM: A Multi-Agent World-Action Model for Coordinated Manipulation
- 저자: Xianzhe Fan, Chi-Pin Huang, Fu-En Yang, Jing Wang, Yecheng Wu, Yu-Cheng Chou, Johan Bjorck, Linxi Fan, Jan Kautz, Yu-Chiang Frank Wang, Zhiding Yu, Hengshuang Zhao, Zhiqi Li
- 발표: 확인 필요 (arXiv v1, 2026-11-18)
- 링크: [arXiv](https://arxiv.org/abs/2611.25105) · [HTML](https://arxiv.org/html/2611.25105v1)
- 코드/프로젝트: 코드 공개 확인 필요 · [공식 프로젝트 페이지](https://research-staging.nvidia.com/labs/lpr/mawam)
- 키워드: multi-agent world-action model, coordinated manipulation, cross-agent attention, flow matching, multi-robot control

# 핵심 아이디어

기존 multi-agent policy는 각 로봇의 action을 독립적으로 내거나 중앙집중식 action vector로 합치기 쉽다. MAWAM은 대신 각 로봇의 카메라·state·role·action을 분리된 stream으로 보존하면서, 하나의 Transformer가 모든 로봇의 noisy future-view token과 action token에 dense cross-agent attention을 수행한다. 결과적으로 한 번의 joint sample 안에 **누가 무엇을 할지**와 **그 행동으로 팀 전체가 무엇을 보게 될지**가 함께 들어간다.

# VLA 관점에서 중요한 이유

single-robot WAM의 핵심 가정은 미래가 내 action에 의해 바뀐다는 것이다. 협업에서는 다른 로봇의 action도 내 관측과 성공 가능성을 바꾸므로, action–future 결합을 팀 수준의 joint distribution으로 확장해야 한다. MAWAM은 action-to-video bias, agent identity, task role을 분리해 이 문제를 다룬다. 실제 두 로봇 평균 성공률 67.8%와 cross-agent attention 제거 시 52.2%라는 차이는 공동 미래 예측이 단순한 영상 보조 loss가 아니라 coordination 신호임을 보여준다.

# Robot / Embodied Setting

실제 환경에서는 Galaxea R1 Pro 두 대가 각자 head-left camera 1개와 wrist camera 2개, 총 6개 private view만으로 laundry-bag collection, bath-towel folding, umbrella handover를 수행한다. shared global camera는 사용하지 않으며 task당 30회 평가한다. 시뮬레이션 RoboFactory에서는 Panda arm 2–4대가 8개 협업 task를 수행하고, task당 synchronized demonstration 150개로 학습해 100 episode를 평가한다.

# Method

1. **Per-robot stream:** 로봇 $i$의 private-view latent, state, noisy action을 $\mathcal{X}_i$로 묶고, role embedding과 view embedding을 더한다.
2. **Identity와 role 분리:** regular-simplex 좌표를 RoPE의 agent axis에 넣어 view의 소유자를 대칭적으로 표시한다. role embedding은 giver/receiver처럼 수행 기능을 표시하므로 같은 역할과 같은 로봇을 혼동하지 않는다.
3. **Joint denoising:** shared Transformer가 모든 agent stream을 양방향으로 attend한다. 각 로봇의 action summary를 해당 future-view token에 더하는 action-to-video bias가 제어와 시각적 결과를 직접 연결한다.
4. **World-action objective:** modality별 head가 $\mathcal{L}_{WA}=\lambda_v\mathcal{L}_{FM}(\mathbf O)+\lambda_u\mathcal{L}_{FM}(\mathbf U)$로 private-view 미래와 action chunk를 함께 학습한다. shared global view가 있다면 읽기 전용 context이고 예측 target에서는 제외한다.
5. **Warm-up과 team training:** single-robot backbone을 각 로봇의 카메라·controller에 먼저 적응시킨 뒤, synchronized team demonstration에서 cross-agent attention, randomized identities, roles를 켠다.
6. **Closed-loop 추론:** 모든 로봇의 24-step action chunk와 8개 미래 frame을 한 번에 생성하고 처음 8 step을 동기 실행한 뒤 새 관측으로 다시 계획한다.

# 핵심 그림

![각 로봇의 private view, state, role, noisy action과 future token이 shared Transformer에서 cross-agent attention으로 결합되고 로봇별 미래와 action chunk로 분리되는 MAWAM 구조](/papers/assets/vla/mawam-multi-agent-world-action-model/architecture.svg)

> 논문 Figure 2와 §3.1–3.4를 바탕으로 재구성. 출처: [arXiv HTML Figure 2](https://arxiv.org/html/2611.25105v1#S3.F2). 캡션: per-robot stream, agent identity/role, cross-agent attention, 공동 flow-matching loss, synchronized receding-horizon execution의 흐름.
>
> 로봇 사진보다 **분리된 제어 인터페이스와 공동 생성 과정이 어떻게 공존하는지**가 핵심 기여라서 architecture pipeline을 골랐다. 입력은 로봇별 private views·state·role이며 학습 때 noisy future와 noisy action이 추가된다. shared Transformer는 agent 경계를 넘는 attention으로 팀의 공동 결과를 예측하지만, weight-shared decoder는 action을 다시 각 controller에 귀속한다. 학습에서는 실제 synchronized future/action이 두 flow-matching loss를 감독하고, 추론에서는 둘 다 noise에서 생성한 뒤 action의 앞 8 step만 실행한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)                         | MAWAM |                비교 기준 |    차이 | 출처           |
| ------------------------------------------------------ | ----: | -----------------------: | ------: | -------------- |
| 실제 두 Galaxea R1 Pro, 3-task 평균, task당 30회       |  67.8 |             MA-VLA: 48.9 | +18.9%p | Table 1        |
| 실제 laundry-bag collection                            |  53.3 |             MA-VLA: 30.0 | +23.3%p | Table 1        |
| RoboFactory 8-task 평균, task당 100 episode            |  90.3 |             MA-VLA: 83.4 |  +6.9%p | Table 2        |
| 실제 3-task 평균, cross-agent attention ablation       |  67.8 | independent agents: 52.2 | +15.6%p | Table 1        |
| Long Pipeline Delivery, cross-agent attention ablation |  95.0 | independent agents: 39.0 | +56.0%p | Table 3 / §4.3 |
| Place Food, future-video supervision ablation          |  78.0 |   supervision 제거: 47.0 | +31.0%p | Table 3 / §4.3 |

실제 비교군은 같은 demonstration, robot, private-camera 설정을 사용한다. RoboFactory 평균에서는 MAWAM이 8개 task 중 일부에서 MA-VLA와 비슷하거나 Long Pipeline Delivery에서 97.0% 대 95.0%로 약간 낮지만, Place Food와 Take Photo에서 각각 +19.0%p, +15.0%p 개선되어 전체 평균을 높인다. 실제 task는 각 30회라 표준오차가 크고, 시뮬레이션 수치와 같은 행에서 직접 비교하지 않았다.

# Limitations / Discussion

평가는 고정된 구성의 최대 4-agent team에 한정되고, 서로 다른 embodiment·sensor를 가진 동적 팀 구성이나 human–robot 협업은 다루지 않는다. 공동 sample 시간은 2-arm 1.40초에서 4-arm 1.85초로 늘며 실시간성이 더 큰 팀에서 어떻게 확장되는지 불명확하다. agent permutation equivariance도 view-position embedding 때문에 근사적이다. 실제 평가는 세 task와 task당 30회이며, deformable manipulation의 다양성을 충분히 대표한다고 보기 어렵다.

# 내가 이해한 핵심

multi-robot coordination은 action vector를 합치는 문제가 아니라, 각 로봇이 만드는 **공동 물리적 미래를 하나의 확률변수로 학습하면서도 실행 책임은 분리하는 문제**다. MAWAM의 agent identity와 role 분리는 이 두 요구를 연결하는 실용적인 인터페이스다.

# 다음에 연결해서 읽을 논문

- [GR00T N1](https://arxiv.org/abs/2503.14734): MAWAM이 확장하는 single-agent foundation backbone 계열
- [Motus](https://arxiv.org/search/?query=Motus+world+action+model&searchtype=title): joint video-action prediction의 single-agent 비교
- [Fast-WAM](https://arxiv.org/search/?query=Fast-WAM&searchtype=title): 미래 supervision을 action-only deployment로 연결하는 접근
- [MA-VLA](https://arxiv.org/search/?query=multi-agent+vision-language-action&searchtype=all): 동일 demonstration 조건의 multi-agent VLA 비교 기준
