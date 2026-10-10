---
title: "PLaW-VLA: Predictive Latent World Modeling for Vision-Language-Action Policies"
date: 2026-10-10
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "CoRL 2026 (arXiv 저자 표기; 공식 프로그램 확인 필요)"
authors: "Yu Liu, Hetian Guo, Tianlv Huang, Ziyi Cai, Wudi Chen, Hantang Wang, Qiutong Liu, Yingzhi Peng, Wei Han, Peijun Tang, Jianan Wang, Zipei Fan, Zhiyuan Zha, Xuan Song"
paper: "https://arxiv.org/abs/2610.12285"
code: "https://github.com/rainyrobo/PLaW-VLA"
project: "https://rainyrobo.github.io/PLaW-VLA/"
thumbnail: "/papers/assets/vla/plaw-vla-predictive-latent-world-modeling/overview.svg"
---

# 한 줄 요약

PLaW-VLA는 저수준 영상을 생성하는 대신 frozen V-JEPA 2 공간에서 미래 상태를 예측해 action expert에 직접 조건으로 주며, RoboTwin Hard Horizon III 성공률을 π0.5의 67.4%에서 79.2%로 높인다.

# 논문 정보

- 제목: PLaW-VLA: Predictive Latent World Modeling for Vision-Language-Action Policies
- 저자: Yu Liu, Hetian Guo, Tianlv Huang, Ziyi Cai, Wudi Chen, Hantang Wang, Qiutong Liu, Yingzhi Peng, Wei Han, Peijun Tang, Jianan Wang, Zipei Fan, Zhiyuan Zha, Xuan Song
- 발표: arXiv:2610.12285v1 (2026-10-08), CoRL 2026은 arXiv 저자 표기이며 공식 프로그램 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.12285) · [HTML 원문](https://arxiv.org/html/2610.12285)
- 코드/프로젝트: [공식 프로젝트](https://rainyrobo.github.io/PLaW-VLA/) · [저자 링크 코드 저장소](https://github.com/rainyrobo/PLaW-VLA)
- 키워드: predictive latent world model, V-JEPA 2, Mixture-of-Transformers, future conditioning, long-horizon manipulation

# 핵심 아이디어

영상 생성형 world-action model은 미래를 풍부하게 표현하지만 texture와 background처럼 action에 불필요한 픽셀까지 복원해야 한다. PLaW-VLA는 미래 예측의 target을 frozen V-JEPA 2의 prediction-oriented latent로 바꾼다. 관측 history에서 가까운 미래와 먼 미래의 latent를 병렬로 예측하고, 이 token을 action expert가 직접 attention하도록 만든다.

전체 모델은 VLM expert → latent world-model expert → action expert의 세 전문가를 causal하게 연결한 Mixture-of-Transformers다. 즉 미래 예측을 보조 loss로만 쓰는 것이 아니라, 실제 action distribution의 조건 변수로 사용한다.

# VLA 관점에서 중요한 이유

이 논문은 world model의 가치가 “얼마나 사실적인 미래 영상을 생성하는가”보다 “어떤 표현 공간의 미래가 제어에 도움이 되는가”에 달려 있음을 실험한다. prediction-oriented latent가 reconstruction-oriented Cosmos VAE보다 zero-shot LIBERO-Plus에서 1.77%p 높고, 생성형 WAM인 Motus 대비 비슷한 LIBERO 성능에서 약 1/19 latency를 보고한다. VLA와 world model을 결합할 때 제어 관련 정보만 예측하는 경량 경로를 보여준다는 점이 중요하다.

# Robot / Embodied Setting

- simulation: LIBERO 40 tasks, LIBERO-Plus 7 perturbation categories, RoboTwin 2.0 50 tasks.
- RoboTwin data: clean 2,500 demonstrations(50/task), randomized 25,000 demonstrations(500/task).
- real robot: dual-arm wheeled humanoid, Fold Towel, Pack Toy, Play Basketball, Organize Stationery.
- real data: task당 400 demonstrations, 10 spatial configurations×3 trials.
- zero-shot real variants: unseen towel material/color, 기존 pen holder를 geometry가 다른 paper cup으로 교체.

# Method

1. PaliGemma VLM expert가 현재 multi-view observation과 language instruction을 task semantics $\phi_t$로 grounding한다.
2. frozen V-JEPA 2 encoder $E$가 관측 history를 latent trajectory $z_{t-H_o:t}$로 바꾼다.
3. $K$개의 learnable future query가 history와 $\phi_t$를 attend해 미래 latent $\hat z_{t+1:t+K}$를 병렬 예측한다.
4. action expert는 semantics, 과거 latent, 예측 미래 latent를 함께 조건으로 continuous action chunk를 생성한다.
5. structured causal attention은 VLM → world model → action의 정보 흐름을 보존한다.
6. Stage I은 action-free human/robot video로 latent dynamics를 학습하고, Stage II는 action-labeled robot trajectory로 prediction과 action을 공동 학습하며, Stage III은 target task/embodiment에 적응한다.

# 핵심 그림

![PLaW-VLA의 VLM, latent world model, action expert와 3단계 학습 구조](/papers/assets/vla/plaw-vla-predictive-latent-world-modeling/overview.svg)

> 논문 Figure 2와 공식 프로젝트의 Framework를 논문 내용을 바탕으로 재구성. 출처: [arXiv HTML, Figure 2](https://arxiv.org/html/2610.12285) · [공식 프로젝트](https://rainyrobo.github.io/PLaW-VLA/). 관측·언어가 semantic grounding과 V-JEPA 2 history를 거쳐 미래 latent와 action으로 이어지는 causal flow를 나타낸다.

구조 그림을 고른 이유는 픽셀 생성 없이 미래 latent가 action expert로 직접 들어가는 경로가 핵심 주장이라서다. 입력은 multi-view observation history, instruction, proprioception이고, VLM은 의미를 grounding하며, frozen encoder와 LWM은 task-relevant 미래를 예측하고, action expert가 이를 continuous control로 변환한다. 학습은 video-only → robot trajectory → target adaptation 순서지만 추론에서는 세 expert가 하나의 causal MoT로 동작한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)         | PLaW-VLA |        비교 기준 |    차이 | 출처         |
| -------------------------------------- | -------: | ---------------: | ------: | ------------ |
| RoboTwin Hard Horizon III              |     79.2 |        π0.5 67.4 | +11.8%p | 원문 Table 3 |
| RoboTwin Hard 평균                     |     83.2 |        π0.5 76.8 |  +6.4%p | 원문 Table 3 |
| LIBERO-Long                            |     94.6 |        π0.5 92.4 |  +2.2%p | 원문 Table 1 |
| LIBERO-Plus zero-shot weighted average |     72.7 | OpenVLA-OFT 69.6 |  +3.1%p | 원문 Table 2 |
| LIBERO-Plus prediction space ablation  |    72.70 | Cosmos VAE 70.93 | +1.77%p | 원문 Table 4 |

가장 큰 이득은 randomized long-horizon인 RoboTwin Hard Horizon III에 집중된다. 이는 현재 관측만으로 즉시 반응하는 policy보다 task progress를 예측하는 context가 multi-stage execution에서 유리하다는 해석과 맞는다. 다만 LIBERO 평균은 96.9%에서 97.4%로 +0.5%p여서 이미 포화된 benchmark에서는 차이가 작다. real robot은 모든 seen/zero-shot task에서 baseline보다 높은 normalized progress를 보였지만, 원문 Figure 4의 task-progress 지표는 success rate와 동일하지 않아 같은 표에서 직접 비교하지 않았다.

# Limitations / Discussion

- 실행 오차가 미래 예측을 망가뜨리고 잘못된 미래가 다음 action을 악화시키는 closed-loop coupling이 있다.
- uncertainty estimation, adaptive horizon, 실패 recovery가 없으므로 예측 오류를 감지하거나 차단하지 못한다.
- video-to-robot 3단계 scaling law와 더 큰 heterogeneous corpus에서의 효율은 아직 충분히 분석되지 않았다.
- V-JEPA 2 encoder와 0.9B 추가 parameters, 약 70 ms latency가 필요해 edge deployment 비용은 남는다.
- real robot 평가는 한 종류의 dual-arm wheeled humanoid와 네 task에 집중되어 embodiment 일반성은 미확인이다.
- CoRL 2026 채택은 arXiv와 저자 프로젝트에서 확인했지만 공식 conference program 페이지는 이번 조사에서 찾지 못했다.

# 내가 이해한 핵심

PLaW-VLA는 world model을 “미래 영상 생성기”가 아니라 “action이 참고할 미래 상태 메모리”로 재정의한다. 무엇을 예측할지와 그 예측이 action에 실제로 연결되는지를 동시에 설계해야 한다. 미래 latent를 가렸을 때 LIBERO가 97.40%에서 93.05%로 떨어지는 결과는 action expert가 이 경로를 실제로 사용한다는 강한 증거다.

# 다음에 연결해서 읽을 논문

- Juno: predictive latent를 VLA에 넣을 때 정보 병목과 안정성을 다룬다.
- ACG-WAM: action-conditioned geometric latent를 예측하는 world-action model이다.
- Magic-W0: structured world-action foundation model로 future reasoning과 action을 통합한다.
