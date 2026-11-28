---
title: "SplatWAM: Real-Time 3D World-Action Modeling with Gaussian Tokens"
date: 2026-11-28
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Frank Tsu-Fang Lu et al."
paper: "https://arxiv.org/abs/2611.33467"
code: ""
project: ""
thumbnail: "/papers/assets/vla/splatwam-real-time-3d-world-action-model/architecture.png"
---

# 한 줄 요약

SplatWAM은 unposed multi-view RGB를 고정 수의 3D Gaussian token으로 바꾸고, 같은 명시적 3D state 위에서 미래 dynamics와 flow-matching robot policy를 함께 학습해 실시간 novel-view imagination과 control을 연결한다.

# 논문 정보

- 제목: SplatWAM: Splatting World Action Models for Real-Time 3D Imagination
- 저자: Frank Tsu-Fang Lu, Karthik Sundar Senthilkumar, Christopher Thirgood, Oscar Mendez, Simon Hadfield
- 발표: 확인 필요 (arXiv v1, 2026-11-24)
- 링크: [arXiv](https://arxiv.org/abs/2611.33467) · [HTML](https://arxiv.org/html/2611.33467)
- 코드/프로젝트: 저자는 코드·checkpoint 공개 예정이라고 명시했으나 현재 링크 확인 필요
- 키워드: world action model, 3D Gaussian splatting, explicit dynamics, flow matching, novel-view rendering

# 핵심 아이디어

pixel/video world model은 viewpoint마다 다시 생성해야 하고 latent world model은 3D state를 직접 드러내지 않는다. SplatWAM은 scene을 위치·회전·크기·opacity·색으로 구성된 2,048개 Gaussian primitive로 표현한다. tokenizer $\mathcal{T}$가 unposed RGB view를 이 state로 lift하고, dynamics model $\mathcal{D}$가 action-conditioned future Gaussian state를 autoregressive하게 예측한다. policy $\mathcal{P}$는 같은 Gaussian token과 goal token을 읽어 action chunk를 flow matching으로 생성한다.

# VLA 관점에서 중요한 이유

미래 영상과 action을 함께 다루는 WAM에서 visual prediction과 control이 동일한 **renderable 3D state**를 공유한다. 약 1B 모델이 robot pretraining 없이 LIBERO 평균 92.3%를 기록해 7B WorldVLA 79.1%를 앞서고, OGBench에서는 LPWM보다 12%p 높은 52%를 달성한다. 즉 더 큰 VLM 대신 geometry-aware state interface와 world-model backbone 재사용이 policy 성능을 높일 수 있음을 보여준다.

# Robot / Embodied Setting

OGBench Scene·Cube play data와 다섯 개 goal-conditioned visual control task, LIBERO Spatial·Object·Goal·Long language-conditioned manipulation을 사용한다. tokenizer는 Spatial/Object/Goal/90에서 pretrain하고 Long을 representation OOD로 보류한다. 두 개 context view만 사용하며 novel-view 평가는 별도 camera에서 수행한다. policy 비교는 세 seed 평균이고 world-model 속도는 RTX 5090 batch 1에서 측정한다.

# Method

1. **SplatWAM-$\mathcal{T}$:** VGGT patch token과 2,048개 learned query를 작은 transformer에 넣어 고정 budget Gaussian primitive를 생성한다. novel-view RGB, depth, normal, shape regularization으로 학습한다.
2. **SplatWAM-$\mathcal{D}$:** Gaussian state history와 action을 causal transformer에 넣고 diffusion forcing 및 shortcut forcing으로 다음 state를 예측한다. 3D positional embedding, held-out-view rendering loss, log-Euclidean covariance가 geometry와 rollout 안정성을 보강한다.
3. **SplatWAM-$\mathcal{P}$:** agent token이 world token·goal state 또는 frozen CLIP language token을 읽고 flow-matching head가 $k$-step action chunk를 만든다.
4. **Joint training:** 먼저 $\mathcal{T}$, 다음 $\mathcal{D}$를 학습한 뒤 $\mathcal{D}$와 $\mathcal{P}$를 $\mathcal{L}_{\pi}+\mathcal{L}_{\mathrm{SF}}$로 공동 최적화한다. policy pass에는 null action token을 사용해 과거 action 복사를 막는다.
5. **Inference:** 관측 RGB를 Gaussian state로 tokenize한 뒤 $\mathcal{D}$는 action-conditioned future 3D state를 생성·rasterize하고, $\mathcal{P}$는 현재 state history와 goal에서 action chunk를 출력한다.

아래 Figure 2는 tokenizer, world dynamics, rasterizer, policy head와 세 단계 학습 loss를 한 흐름으로 보여주므로 구조 그림으로 선택했다.

# 핵심 그림

![여러 RGB 관측을 Gaussian state로 변환하고 action-conditioned 미래 3D state와 robot action chunk를 함께 학습하는 SplatWAM 구조](/papers/assets/vla/splatwam-real-time-3d-world-action-model/architecture.png)

> 원 논문 Figure 2 원본(CC BY 4.0). 출처: [arXiv HTML Figure 2](https://arxiv.org/html/2611.33467#S2.F2). 캡션: SplatWAM-$\mathcal{T}$가 unposed view를 Gaussian state로 lift하고, $\mathcal{D}$가 action-conditioned future state를 예측하며, $\mathcal{P}$가 같은 world token과 goal에서 action chunk를 생성한다.
>
> 입력은 여러 context RGB view와 action history, goal image 또는 language instruction이다. $\mathcal{T}$는 고정 수 3D Gaussian token을 만들고, $\mathcal{D}$는 이를 action-conditioned dynamics state로 전개한다. rasterizer는 어떤 viewpoint에서도 예측 state를 영상으로 바꾸며, agent token 기반 $\mathcal{P}$는 Gaussian history를 읽어 action chunk를 출력한다. 학습은 `tokenizer → dynamics → dynamics+policy 공동학습` 순서이고, 추론에서는 별도 Gaussian decoder 없이 같은 explicit state가 prediction·rendering·control에 직접 쓰인다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)           | SplatWAM |         비교 기준 |    차이 | 출처    |
| ---------------------------------------- | -------: | ----------------: | ------: | ------- |
| OGBench Scene 5-task overall             |       52 |          LPWM: 40 | +12.0%p | Table 4 |
| OGBench model-free Gaussian-token 평균   |     63.4 | pixel input: 49.3 | +14.1%p | Table 3 |
| LIBERO model-free Gaussian-token 평균    |     65.3 | pixel input: 63.0 |  +2.3%p | Table 3 |
| LIBERO 전체 평균, robot pretraining 없음 |     92.3 |    WorldVLA: 79.1 | +13.2%p | Table 4 |
| LIBERO 전체 평균, robot pretraining 없음 |     92.3 | OpenVLA-OFT: 91.9 |  +0.4%p | Table 4 |
| LIBERO-Object                            |     99.0 |    WorldVLA: 89.0 | +10.0%p | Table 4 |

Table 3은 같은 model-free policy에서 입력 표현을 비교한 세 seed 평균이다. Gaussian token은 OGBench의 모든 suite에서 pixel보다 높지만 LIBERO에서는 Spatial과 Long은 개선되고 Object와 Goal은 낮아져 평균 이득이 +2.3%p에 그친다. Table 4의 WorldVLA 비교는 둘 다 robot pretraining이 없지만 모델 크기와 구조가 다르므로 순수한 geometry ablation은 아니다. 별도 dynamics 평가는 약 80 FPS로 video world model보다 12배 빠르고 novel-view PSNR이 최대 2.0 dB 높다고 보고한다.

# Limitations / Discussion

고정된 Gaussian query index가 물리적 point correspondence를 보장하지 않으며 긴 rollout은 최근 $T-1$ state만 유지하는 Markov 근사를 쓴다. 평가는 simulation 중심이고 실제 로봇 결과가 없다. tokenizer가 여러 view와 geometry distillation을 요구하며 공개 코드·checkpoint는 아직 확인되지 않았다. LIBERO의 Gaussian input이 모든 suite에서 pixel input을 이기지는 않으므로 explicit 3D가 항상 더 좋은 control representation이라고 단정할 수 없다.

# 내가 이해한 핵심

SplatWAM의 핵심은 세계를 “예쁘게 생성할 영상”이 아니라 “바로 render하고 policy가 바로 읽을 수 있는 3D state”로 정의한 데 있다. prediction과 control이 같은 Gaussian token을 공유하므로 geometry supervision이 policy 표현까지 이어지고 novel view를 위한 별도 video sampling이나 Gaussian decoder가 필요 없다.

# 다음에 연결해서 읽을 논문

- [WorldVLA](https://arxiv.org/abs/2506.21539): video prediction과 VLA를 autoregressive token space에서 통합한 비교군
- [LPWM](https://arxiv.org/abs/2502.01591): latent particle dynamics를 goal-conditioned control에 사용하는 비교군
- [OpenVLA-OFT](https://arxiv.org/abs/2502.19645): LIBERO의 강한 flow-matching VLA baseline
- [PointWorld](https://arxiv.org/abs/2512.08377): in-the-wild manipulation을 위한 3D point dynamics 접근
