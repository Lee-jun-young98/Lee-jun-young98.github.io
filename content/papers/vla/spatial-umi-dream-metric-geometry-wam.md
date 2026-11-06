---
title: "Spatial-UMI-Dream: Scaling World Action Models with Metric Geometry for UMI Manipulation"
date: 2026-11-06
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Weiduo Yuan, Ze Yuan, Sihan Liu, Jionghao Wang, Liang Heng, Zhenyu Zhao, Yue Wang"
paper: "https://arxiv.org/abs/2611.07229"
code: ""
project: "https://weiduoyuan.com/spatial-umi-dream/"
thumbnail: "/papers/assets/vla/spatial-umi-dream-metric-geometry-wam/overview.svg"
---

# 한 줄 요약

Spatial-UMI-Dream은 양손 UMI의 fisheye RGB에 stereo 기반 metric depth를 정렬해 하나의 RGB-D video canvas로 만들고, 605시간 데이터에서 future world와 action을 함께 학습하여 로봇·조명 변화에도 강한 5B World Action Model을 만든다.

# 논문 정보

- 제목: Spatial-UMI-Dream: Scaling World Action Models with Metric Geometry for UMI Manipulation
- 저자: Weiduo Yuan, Ze Yuan, Sihan Liu, Jionghao Wang, Liang Heng, Zhenyu Zhao, Yue Wang
- 발표: 확인 필요 (arXiv v1, 2026-11-04)
- 링크: [arXiv](https://arxiv.org/abs/2611.07229) · [HTML](https://arxiv.org/html/2611.07229)
- 코드/프로젝트: [공식 프로젝트 페이지](https://weiduoyuan.com/spatial-umi-dream/) · 코드 공개 링크는 확인 필요
- 키워드: World Action Model, UMI, RGB-D, metric geometry, cross-embodiment, bimanual manipulation

# 핵심 아이디어

UMI의 손목 fisheye 영상에서는 카메라와 물체가 함께 움직여 RGB만으로 실제 거리와 양손 관계를 알아내기 어렵다. 이 논문은 calibrated stereo에서 얻은 metric depth를 원 fisheye 좌표에 다시 맞춘 뒤 RGB와 같은 video VAE로 인코딩한다. 양손의 RGB와 depth를 $2\times2$ canvas로 묶어 별도 3D encoder 없이 pretrained video backbone을 유지하며, future RGB-D와 action chunk를 같은 transformer에서 공동 denoising한다.

# VLA 관점에서 중요한 이유

VLA가 언어·영상에서 action만 예측하는 대신, WAM은 action이 만들 미래 관측까지 함께 모델링한다. Spatial-UMI-Dream은 여기에 **metric depth를 world state의 일부로 명시**해 moving wrist camera의 scale ambiguity를 줄였다. RoboTwin-UMI에서 Aloha clean 79.10%, ARX X5+조명 변화 72.15%를 기록해 동일 조건의 $\pi_{0.5}$보다 각각 +4.65%p, +10.30%p 높았고, 실환경 6개 task 평균도 60.8%에서 85.0%로 +24.2%p 개선했다.

# Robot / Embodied Setting

pre-training은 605시간 RGB-D UMI corpus와 24×NVIDIA RTX PRO 6000을 사용해 두 stage를 각각 30k step 학습한다. simulation은 RoboTwin을 바탕으로 Aloha-AgileX와 ARX-X5에 공통 UMI gripper와 fisheye wrist camera를 장착한 20-task RoboTwin-UMI이며, clean·random lighting·cross-embodiment를 분리 평가한다. 실환경은 Dexmate Vega1 mobile robot에서 Pick-and-Place, Bimanual Handover, Scan-and-Place, Pack-and-Close, Handover-and-Pour, Table Wiping을 task당 20회 수행한다. 모든 정책은 동일 demonstration으로 fine-tune하고 20D relative bimanual action, chunk size 24를 쓴다.

# Method

1. UMI gripper의 middle/right camera를 rectify하고 stereo disparity를 metric $Z$-depth로 바꾼 뒤, depth를 원 middle-camera fisheye 좌표로 역매핑한다.
2. 고정 거리 범위로 depth를 normalize하고 Turbo colormap의 3-channel 영상으로 바꿔 pretrained RGB video VAE를 그대로 재사용한다.
3. 왼손·오른손의 RGB와 depth를 $C_t=[[I_t^0,\Phi(D_t^0)],[I_t^1,\Phi(D_t^1)]]$인 320×320 canvas로 구성한다.
4. stage 1에서는 Wan2.2-TI2V-5B를 visual history와 language에 조건화해 미래 RGB-D canvas만 flow matching으로 예측한다.
5. stage 2에서는 state/action encoder와 decoder를 켜고 block-causal transformer에서 RGB-D latent block $Z_i$와 action chunk $A_i$를 공동 denoising한다. 학습 목적은 $\mathcal{L}_{world}+\lambda_a\mathcal{L}_{action}$이다.
6. 추론에서는 현재 RGB-D history, 언어, robot state에서 future world와 실행 action을 함께 생성하며, robot-infeasible UMI trajectory filtering과 gripper delay compensation을 적용한다.

# 핵심 그림

![Spatial-UMI-Dream의 fisheye RGB-D 구성과 2단계 World Action Model 학습 구조](/papers/assets/vla/spatial-umi-dream-metric-geometry-wam/overview.svg)

> 논문 Figure 2–3, Equations (1)–(5), Sections III-A–III-C를 바탕으로 재구성한 전체 아키텍처. 출처: [논문 HTML Method](https://arxiv.org/html/2611.07229#S3). 원본 figure를 복제하지 않고 입력, metric-depth 정렬, dual-gripper canvas, 두 학습 stage와 추론 출력을 한국어로 도식화했다.
>
> 구조 그림을 선택한 이유는 성능 향상의 핵심이 단순히 depth를 추가하는 데 있지 않고, fisheye 좌표에 맞춘 metric RGB-D를 기존 video tokenizer로 보내 world-only adaptation 뒤 world-action joint learning을 수행하는 연결 방식에 있기 때문이다. stage 1은 action branch 없이 UMI의 움직이는 시점과 geometry를 학습하고, stage 2는 같은 latent block 안에서 video와 action token을 양방향으로 결합한다. 추론 출력은 future RGB-D와 24-step bimanual action chunk이며, explicit geometry가 접근 거리와 양손 정렬을 보조한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (success rate %, ↑)           | Spatial-UMI-Dream |         비교 기준 |     차이 | 출처                  |
| ---------------------------------------------- | ----------------: | ----------------: | -------: | --------------------- |
| RoboTwin-UMI Aloha clean, 20-task 평균         |             79.10 | $\pi_{0.5}$ 74.45 |  +4.65%p | Figure 5(a), Table II |
| RoboTwin-UMI Aloha random light, 20-task 평균  |             73.35 | $\pi_{0.5}$ 66.15 |  +7.20%p | Table II              |
| RoboTwin-UMI ARX X5 random light, 20-task 평균 |             72.15 | $\pi_{0.5}$ 61.85 | +10.30%p | Table II              |
| 실로봇 6-task 평균 SR, task당 20회             |              85.0 |  $\pi_{0.5}$ 60.8 |  +24.2%p | Table I               |
| 실로봇 Bimanual Handover SR                    |              80.0 |  $\pi_{0.5}$ 45.0 |  +35.0%p | Table I               |
| Aloha clean, RGB-D 대 matched RGB-only         |             79.10 |   UMI-Dream 73.35 |  +5.75%p | Figure 6 ablation     |

비교 수치는 동일 downstream demonstrations와 평가 조건에서 대조했다. 특히 ARX X5+random lighting은 embodiment와 environment가 동시에 바뀌는데도 72.15%를 유지한다. depth ablation은 RGB-only가 같은 $2\times2$ layout과 token 수를 갖도록 RGB를 복제해, +5.75%p가 단순 token 증가보다 metric geometry에서 온다는 해석을 강화한다. world-only adaptation은 Aloha clean을 39.50%→61.25%로, joint world-action pretraining은 다시 79.10%로 올렸다.

# Limitations / Discussion

공식 top-conference 채택과 공개 code는 확인되지 않았다. calibrated stereo와 depth reconstruction이 필요하므로 single-camera UMI나 calibration이 흔들리는 환경에 곧바로 적용하기 어렵고, depth를 colormap 영상으로 넣는 방식은 metric 구조를 간접적으로 학습한다. 5B backbone과 24 GPUs의 두 단계 pre-training 비용이 크며, 실환경은 한 robot family의 6개 bimanual task·task당 20회로 제한된다. joint future prediction이 장기 계획 또는 안전 보장을 직접 제공하는지도 별도 검증이 필요하다.

# 내가 이해한 핵심

UMI에서 RGB 변화만 보면 “손이 움직였는지, 물체가 움직였는지, 얼마나 멀리 있는지”가 얽힌다. 이 연구는 depth를 별도 센서 branch로 처리하지 않고 video world의 한 채널처럼 만들어 pretrained 생성 모델에 먹인다. 그래서 world prediction이 단순 appearance forecasting을 넘어 실제 접근 거리와 양손의 공간 관계를 action에 연결한다.

# 다음에 연결해서 읽을 논문

- [Universal Manipulation Interface](https://arxiv.org/abs/2402.10329): robot-independent handheld demonstration 수집 원형
- [Fast-WAM](https://arxiv.org/abs/2505.14302): Spatial-UMI-Dream이 비교한 효율적 World Action Model
- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): strongest VLA baseline과 open-world VLA 설계
- [FoundationStereo](https://arxiv.org/abs/2501.09898): metric depth 복원에 사용한 stereo foundation model 계열
