---
title: "Z-sight: Unifying Vision-Language-Action and Latent World Modeling"
date: 2026-11-21
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Junjie Ye, Yiqi Zhao, Muchen Xu, Celina Shiyu Wang, Hao Dong, Ruohai Ge, Rong Xue, Benjamin J. Kolligs, Aditya Dutt, Sasanka Nagavalli, Nassim A. Samad, Gaurav S. Sukhatme, Jyotirmoy V. Deshmukh, Yue Wang, Yuliang Guo"
paper: "https://arxiv.org/abs/2611.24940"
code: ""
project: "https://junjieye.com/Z-sight/"
thumbnail: "/papers/assets/vla/z-sight-native-latent-world-action-model/architecture.png"
---

# 한 줄 요약

Z-sight는 VLM이 현재를 보는 native visual token 공간에서 미래와 action을 함께 denoise해, 무거운 video generator 없이도 latent world model의 예측을 실시간 로봇 제어에 직접 연결한다.

# 논문 정보

- 제목: Z-sight: Unifying Vision-Language-Action and Latent World Modeling
- 저자: Junjie Ye, Yiqi Zhao, Muchen Xu, Celina Shiyu Wang, Hao Dong, Ruohai Ge, Rong Xue, Benjamin J. Kolligs, Aditya Dutt, Sasanka Nagavalli, Nassim A. Samad, Gaurav S. Sukhatme, Jyotirmoy V. Deshmukh, Yue Wang, Yuliang Guo
- 발표: 확인 필요 (arXiv v1, 2026-11-18)
- 링크: [arXiv](https://arxiv.org/abs/2611.24940) · [HTML](https://arxiv.org/html/2611.24940v1)
- 코드/프로젝트: 코드 공개 확인 필요 · [프로젝트 페이지](https://junjieye.com/Z-sight/)
- 키워드: latent world model, native visual tokens, flow matching, mixture-of-transformers, humanoid loco-manipulation

# 핵심 아이디어

pixel video를 생성하거나 별도 frozen encoder의 feature를 맞추지 않고, VLM 자체 vision encoder가 만드는 spatial token을 미래 target으로 삼는다. EMA teacher가 미래 관측의 target token을 만들고 foresight expert가 이를 flow matching으로 복원하며, action expert는 생성 중인 미래 token에 직접 attention해 continuous action chunk를 함께 denoise한다. representation이 학습 중 바뀌어도 teacher가 같이 움직이므로 perception과 prediction이 같은 좌표계에 남는다.

# VLA 관점에서 중요한 이유

기존 VLA의 action supervision은 물리 변화에 대한 신호가 희소하고, WAM은 미래 영상 생성 비용이 크다. Z-sight는 **VLM의 native spatial token을 online foresight interface로 재사용**해 두 문제를 잇는다. RoboTwin C2R에서 frozen DINO target 26.6%보다 40.1%, foresight attention을 끈 조건 1.8%보다 40.1%라는 결과는 미래 예측이 단순 auxiliary regularizer가 아니라 실제 action 생성에 사용됨을 보여준다.

# Robot / Embodied Setting

pretraining은 egocentric human video와 cross-embodiment robot trajectory를 섞고, target embodiment에 post-training한다. 평가는 single-arm LIBERO, bimanual RoboTwin 2.0, Unitree G1 whole-body SIMPLE, 실제 Unitree G1 여섯 task를 포함한다. RoboTwin은 task당 clean demonstration 50개로 하나의 RGB policy를 학습해 clean(C2C)·randomized(C2R) 각 task 100 episode를 평가한다. 실제 G1은 task당 10회, 총 60 trial이다.

# Method

1. **Native target space:** vision encoder $E_\phi$가 현재·미래 관측을 $P\times D$ spatial token으로 바꾼다. 미래 target은 같은 encoder의 EMA copy로 만들며 pixel decoder는 없다.
2. **세 stream MoT:** VLM stream은 observation history·proprioception·instruction을 처리하고, foresight와 action expert는 독립 parameter를 가지면서 layer별 cross-attention으로 정보를 교환한다.
3. **공동 flow matching:** foresight expert는 noisy future token에서 $\mathcal{L}_{view}$를, action expert는 noisy action chunk에서 $\mathcal{L}_{flow}$를 최적화한다. action expert는 매 denoising step에서 형성 중인 미래 feature를 읽는다.
4. **3단계 학습:** human video로 VLM을 pretrain하고, human+robot data에서 세 stream을 mid-train한 뒤 target embodiment demonstration으로 post-train한다. VLM의 discrete FAST objective도 유지한다.
5. **추론:** 미래 관측 없이 현재 context와 두 noise stream만 넣고 미래 token과 action을 같은 schedule에서 10 step 공동 denoise한다. 완성된 영상은 복원하지 않고 action chunk만 로봇에 실행한다.

# 핵심 그림

![인간 비디오 pretraining, 혼합 robot-human mid-training, target embodiment post-training을 거쳐 VLM·foresight expert·action expert가 미래 spatial token과 action을 공동 denoise하는 Z-sight 구조](/papers/assets/vla/z-sight-native-latent-world-action-model/architecture.png)

> Figure 2 원본. 출처: [arXiv HTML Figure 2](https://arxiv.org/html/2611.24940v1#S3.F2), CC BY 4.0. 캡션: 세 단계 학습 recipe와 VLM, EMA target encoder, foresight expert, action expert 사이의 token·attention·loss 흐름.
>
> 실제 G1 장면보다 **미래를 어느 공간에서 어떻게 action과 결합하는가**가 핵심 기여라서 architecture figure를 골랐다. 입력 observation history·state·instruction은 VLM token이 되고, EMA teacher가 만든 미래 spatial target은 foresight expert의 $\mathcal{L}_{view}$를 감독한다. action expert는 같은 denoising 시간축의 미래 token을 읽으며 $\mathcal{L}_{flow}$로 action을 생성한다. 학습 때만 실제 미래 관측이 target으로 들어가고, 추론 때는 foresight와 action noise를 공동 갱신한다는 차이가 중요하다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)         | Z-sight | 비교 기준                          |     차이 | 출처               |
| -------------------------------------- | ------: | ---------------------------------- | -------: | ------------------ |
| SIMPLE 12-task 평균                    |    81.9 | GR00T N1.7: 72.3                   |   +9.6%p | Figure 5 / Table 9 |
| 실제 Unitree G1 6-task 평균, 60 trials |    73.3 | Fast-WAM: 53.3                     |  +20.0%p | Figure 7 / §4.2    |
| RoboTwin 2.0 C2R                       |    39.0 | Spatial Forcing: 26.74             | +12.26%p | Table 2            |
| RoboTwin 2.0 C2R, native EMA target    |    40.1 | frozen DINOv2-B target: 26.6       |  +13.5%p | Table 4            |
| SIMPLE Hard, joint 10-step denoising   |    73.1 | sequential 20-step denoising: 64.2 |   +8.9%p | Table 7            |
| RTX 4090 action chunk latency (ms, ↓)  |   109.5 | Fast-WAM: 155.9                    | -46.4 ms | Table 8            |

SIMPLE은 동일 benchmark protocol에서 12 teleoperation task와 난이도 L0–L2를 세 pass로 평가한다. 실제 G1 평균은 task당 10회라 표본이 작지만 동일 6-task 조건에서 baseline을 다시 평가했다. RoboTwin Table 2의 39.0은 공식 main comparison, ablation Table 4의 40.1은 별도 checkpoint/control이라 서로 같은 행에서 직접 빼지 않았다. LIBERO 평균은 97.7%로 Motus와 같고, RoboTwin C2R에서는 $\pi_{0.5}$의 46.0%보다 낮아 모든 benchmark에서 우세한 것은 아니다.

# Limitations / Discussion

실제 로봇은 Unitree G1 한 embodiment, 여섯 task, 60 trial에 한정된다. EMA target이 collapse를 피하고 물리적으로 유용한 feature를 보장하는 이론은 없으며, future token을 사람이 해석 가능한 영상으로 복원하지 않아 예측 오류 진단이 어렵다. GR00T N1.7은 60 ms로 더 빠르고 RoboTwin C2R에서는 $\pi_{0.5}$가 더 높다. human video와 robot data의 양·구성 효과도 architecture 이득과 완전히 분리되지 않는다.

# 내가 이해한 핵심

world model의 가치가 반드시 픽셀 생성에 있는 것은 아니다. action expert가 읽을 수 있고 현재 perception과 계속 정렬되는 **공통 미래 좌표계**만 있으면, latent prediction 자체가 online control signal이 될 수 있다.

# 다음에 연결해서 읽을 논문

- [Fast-WAM](https://arxiv.org/search/?query=Fast-WAM&searchtype=title): test-time 미래 생성 없이 video co-training을 쓰는 직접 비교
- [VLA-JEPA](https://arxiv.org/search/?query=VLA-JEPA&searchtype=title): frozen latent target 기반 predictive VLA 비교
- [Motus](https://arxiv.org/search/?query=Motus+robot+world+action+model&searchtype=title): VLM·video·action expert를 결합한 pixel-space 계열
- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): continuous action expert와 FAST supervision의 기반
