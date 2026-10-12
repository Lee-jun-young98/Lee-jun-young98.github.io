---
title: "Forward Dynamics Models: Action-to-Future Learning for Robot Policies"
date: 2026-10-12
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Zipei Ma, Junzhe Jiang, Jiahui Zhang, Juntong Zhang, Chun Gu, Bozhou Zhang, Jiankang Deng, Xiatian Zhu, Li Zhang"
paper: "https://arxiv.org/abs/2610.13117"
code: ""
project: "https://logosroboticsgroup.github.io/FDM/"
thumbnail: "/papers/assets/vla/forward-dynamics-models-action-to-future-learning/overview.svg"
---

# 한 줄 요약

Forward Dynamics Models(FDM)은 미래가 행동을 조건화하게 하지 않고 행동 feature가 미래 예측을 조건화하게 뒤집어, 미래 supervision의 이점은 학습에 남기면서 추론 시 미래 생성과 오류 전파를 제거한다.

# 논문 정보

- 제목: Forward Dynamics Models
- 저자: Zipei Ma, Junzhe Jiang, Jiahui Zhang, Juntong Zhang, Chun Gu, Bozhou Zhang, Jiankang Deng, Xiatian Zhu, Li Zhang
- 발표: arXiv:2610.13117v1 (2026-10-09), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.13117) · [HTML 원문](https://arxiv.org/html/2610.13117)
- 코드/프로젝트: [공식 프로젝트](https://logosroboticsgroup.github.io/FDM/) · 코드 공개는 확인되지 않음
- 키워드: forward dynamics, future supervision, flow matching, world-action model, action-only inference

# 핵심 아이디어

일반 VLA는 $p(A\mid C)$만 학습해 행동 이후의 상태를 supervision으로 쓰지 못한다. 반대로 future-conditioned WAM은 $p(V\mid C)p(A\mid C,V)$로 미래 영상을 먼저 또는 함께 생성하므로, 생성 오류와 계산 비용이 행동 경로에 들어온다. FDM은 이를 $p(A\mid C)p(V\mid C,A)$로 바꾼다. 미래 branch가 action expert의 hidden state $H_a$를 읽고, 미래 loss가 $H_a$를 통해 action expert까지 역전파되지만 action branch는 미래 token을 읽지 않는다.

# VLA 관점에서 중요한 이유

FDM은 world prediction을 추론 입력이 아니라 representation-shaping objective로 사용한다. 따라서 미래 상태의 물리적 정보를 action feature에 학습시키면서도 배포 시에는 보통 VLA처럼 현재 관측과 지시만으로 action chunk를 생성한다. 이 방향성은 VLA와 WAM의 장점을 결합할 때 무엇을 생성하느냐보다 어떤 정보가 어느 방향으로 흐르느냐가 중요함을 보여준다.

# Robot / Embodied Setting

- simulation: LIBERO 4 suites와 RoboTwin 2.0의 50개 양팔 task.
- real robot: dual-arm ARX-X5, Drawer·Box·Shuttlecock·Cup·Block 5개 task, method/task당 20회.
- 입력: third-person D435 1대, wrist D405 2대, language instruction, robot state.
- 데이터: 실제 task당 150 demonstrations 중 147개 학습, 3개 validation; 30 Hz, 20차원 bimanual action.
- backbone: $\pi_{0.5}$ 기반 VLM형과 Wan2.2-5B 기반 VGM형을 각각 구현.

# Method

1. Context expert가 현재 영상과 instruction을 encoding하고 action expert가 noisy action chunk를 flow matching으로 denoise한다.
2. Generation expert는 context와 action hidden state $H_a$를 읽어 미래 image latent(VLM형) 또는 future-video latent(VGM형)를 예측한다.
3. 총 loss는 $\mathcal L_{total}=\lambda_a\mathcal L_{act}+\lambda_v\mathcal L_{world}$이며, 미래 loss gradient가 generation expert가 읽은 $H_a$를 통해 action expert를 학습시킨다.
4. 비대칭 attention mask는 context→action→future 방향만 허용한다. Action token은 future token을 읽지 않는다.
5. 추론에서는 generation token과 미래 VAE 처리를 생략하고 context/action expert만으로 행동을 생성한다.

# 핵심 그림

![현재 관측과 언어가 context와 action expert를 거쳐 행동을 만들고, 학습 때만 action feature가 future generation을 조건화하는 FDM 구조](/papers/assets/vla/forward-dynamics-models-action-to-future-learning/overview.svg)

> 논문 Figure 1과 Figure 3을 바탕으로 재구성. 출처: [arXiv HTML, Figure 1·3](https://arxiv.org/html/2610.13117). 실선은 forward 정보 흐름, 점선은 미래 loss의 역전파, 회색 branch는 학습 전용임을 나타낸다.

구조 그림을 고른 이유는 FDM의 기여가 모듈 자체보다 action-to-future라는 방향성에 있기 때문이다. 입력 $C=(O_t,L)$은 context expert를 거쳐 action expert의 $H_a$와 action chunk를 만든다. 학습에서는 generation expert가 $(C,H_a)$로 미래 $V$를 예측하고 그 loss가 $H_a$를 shaping하지만, 추론에서는 이 branch 전체가 제거된다. 기존 future-conditioned WAM과 달리 미래 예측 오차가 행동의 forward path로 들어오지 않는다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)    |  FDM |        비교 기준 |   차이 | 출처          |
| --------------------------------- | ---: | ---------------: | -----: | ------------- |
| LIBERO 평균, VLM 계열             | 99.4 | $\pi_{0.5}$ 96.9 | +2.5%p | 원문 Table 2  |
| 실제 5-task 평균, VLM형           |   96 |   $\pi_{0.5}$ 83 |  +13%p | 원문 Figure 5 |
| 실제 5-task 평균, VGM형           |   83 | FastWAM-Joint 78 |   +5%p | 원문 Figure 5 |
| 실제 VLM형, full vs stop-gradient |   96 |               89 |   +7%p | 원문 Table 4  |
| 실제 VGM형, full vs stop-gradient |   83 |               78 |   +5%p | 원문 Table 4  |

Table 4는 같은 backbone·seed·평가 설정에서 future loss가 action feature로 역전파되는지만 바꾼 가장 직접적인 비교다. 추론 효율도 VGM형 기준 253.45 ms/chunk로 FastWAM-Joint 446.55 ms보다 43.24% 짧다(Table 5). RoboTwin에서는 VLM형이 $\pi_{0.5}$보다 높지만 VGM형 89.23%는 LingBot-VA 92.20%보다 낮아, 모든 backbone에서 절대 SOTA라는 해석은 피해야 한다.

# Limitations / Discussion

- VLM형은 $\pi_{0.5}$ 대비 학습 step time이 42.14% 늘어 future supervision의 비용이 크다.
- 실제 평가는 한 플랫폼의 5개 task, task당 20회라 hardware·환경 일반화 범위가 제한적이다.
- VGM형은 RoboTwin 평균에서 pretrained LingBot-VA보다 낮으며, policy pretraining 유무도 함께 고려해야 한다.
- future branch를 배포 시 생략할 수 있지만 학습에는 future image/video와 정렬된 action trajectory가 필요하다.
- 원문은 동일 training seed를 사용한 matched 비교를 보고하지만 독립 training seed 분산은 제시하지 않는다.
- 공식 conference venue와 code 공개는 확인되지 않았다.

# 내가 이해한 핵심

미래를 잘 생성해야 좋은 행동이 나오는 것이 아니라, 행동 feature가 미래를 설명하도록 학습되면 된다. FDM은 world model을 배포 구성요소가 아니라 행동 representation에 물리적 결과를 새기는 teacher로 쓴다.

# 다음에 연결해서 읽을 논문

- Beyond Actions / AFCE: 미래 결과를 action feature의 보조 loss가 아니라 정책의 직접 예측 target으로 만든다.
- Juno: predictive latent가 action generation을 압도하지 않도록 bottleneck을 둔다.
- FastWAM: future-action joint generation과 FDM의 비대칭 conditioning을 비교하기 좋다.
