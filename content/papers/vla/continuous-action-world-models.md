---
title: "CoAWM: Continuous-Action World Models"
date: 2026-10-31
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Liangyu Li, Qingwen Liu"
paper: "https://arxiv.org/abs/2610.40401"
thumbnail: "/papers/assets/vla/continuous-action-world-models/overview.svg"
---

# 한 줄 요약

CoAWM은 서로 다른 embodiment와 sampling rate의 action을 물리 시간에 질의 가능한 latent function으로 통합하고, world-model 관측 조건으로 그 함수를 예측해 한 정책을 10–60 Hz에서 실행한다.

# 논문 정보

- 제목: Continuous-Action World Models: Learning Cross-Embodiment Spatiotemporal Dynamics Priors
- 저자: Liangyu Li, Qingwen Liu
- 발표: 확인 필요 (arXiv v1, 2026-10-29)
- 링크: [arXiv](https://arxiv.org/abs/2610.40401) · [HTML](https://arxiv.org/html/2610.40401)
- 코드/프로젝트: 공개 링크 확인되지 않음
- 키워드: world-action model, continuous action function, cross-embodiment, cross-frequency execution, bimanual manipulation

# 핵심 아이디어

action sequence의 index를 기본 단위로 보지 않고, 물리 시간 $\tau$를 입력받아 command $a(\tau)$를 반환하는 함수로 표현한다. Stage A는 서로 다른 로봇·주파수의 timestamped trajectory를 같은 fixed-size latent function space로 압축하고 재구성 및 multi-rate consistency를 학습한다. Stage B는 LaWAM의 VLM feature, predicted future visual token, proprioception에서 그 latent function을 예측한다.

# VLA 관점에서 중요한 이유

VLA의 action space 차이는 joint 수뿐 아니라 control clock 차이이기도 하다. CoAWM은 “무슨 움직임인가”를 latent function에, “언제 command를 읽을 것인가”를 query time에 분리한다. 따라서 heterogeneous robot data를 shared dynamics prior로 쓸 수 있고, 동일한 관측-conditioned prediction을 재학습 없이 다른 실행 주파수로 샘플링할 수 있다.

# Robot / Embodied Setting

주 실험은 bimanual end-effector position·orientation·gripper command를 다룬다. Stage B backbone은 head camera와 두 wrist camera, language instruction, robot proprioception을 받는 LaWAM이다. 기본 실행은 30 Hz이며 1.2초 action segment/replanning period를 유지한 채 10, 15, 20, 30, 50, 60 Hz를 비교한다. 논문은 cross-embodiment pretraining interface를 제안하지만 현재 공개된 평가는 작은 규모의 preliminary validation이다.

# Method

1. trajectory를 $(\tau_i,a_i,m_i)$ 집합으로 표현한다. mask $m_i$는 embodiment마다 유효한 action component를 나타낸다.
2. Stage A의 MoT encoder가 position·orientation·gripper stream을 처리해 latent $Z$를 만들고, decoder가 $D_\psi(Z,\tau,c)$로 임의 시간의 action을 복원한다.
3. 같은 motion을 두 sampling rate로 관측해 source/grid reconstruction과 $0.1\,\mathrm{MSE}(Z^{(1)},Z^{(2)})$를 함께 최적화한다.
4. Stage B head는 VLM feature, predicted future visual token, proprioception을 cross-attention memory로 사용하고 current visual token을 residual로 더해 $\hat Z$를 예측한다. function encoder/decoder와 world-prediction branch는 고정한다.
5. 추론 시 원하는 frequency $f$에 대해 $\tau_k=(k+1)/f$를 질의해 action sequence를 만들며, 현재 pose를 anchor로 사용한다.

# 핵심 그림

![CoAWM의 다중 embodiment와 주파수 action-function 사전학습, world-model 조건 latent 예측, 시간 질의 실행 구조](/papers/assets/vla/continuous-action-world-models/overview.svg)

> 논문 Figure 1과 Equations (1), (8–10), (15)를 바탕으로 재구성한 CoAWM 구조. 출처: [논문 HTML Figure 1 및 Method](https://arxiv.org/html/2610.40401#S3). 학습 Stage A/B와 inference clock을 구분하기 위해 직접 재구성했다.
>
> 구조 그림을 고른 이유는 핵심 기여가 **action function 사전학습과 world-model 연결을 분리한 2단계 설계**이기 때문이다. Stage A는 주파수가 다른 trajectory를 같은 $Z$로 맞추고 decoder가 물리 시간에서 action을 복원한다. Stage B는 관측·언어·예측 future·proprioception에서 $\hat Z$만 예측한다. 추론에서는 expert trajectory와 encoder가 사라지고, 같은 $\hat Z$를 다른 query grid로 읽어 원하는 control rate의 command를 얻는다.

# Experiments / Results

## 주요 실험 결과

| 설정 / 지표 (↓가 좋음)        |  CoAWM |    비교 기준 |   차이 | 출처     |
| ----------------------------- | -----: | -----------: | -----: | -------- |
| 첫 1초 position jerk RMS      |  95.46 | LaWAM 150.87 | -36.7% | Figure 4 |
| 첫 1초 rotation jerk RMS      | 341.73 | LaWAM 746.06 | -54.2% | Figure 4 |
| translation velocity RMS      |  0.332 |  LaWAM 0.338 |  -1.8% | Figure 4 |
| 추정 positive mechanical work | 392.13 | LaWAM 506.66 | -22.6% | Figure 6 |

Figure 4는 16개 task, 같은 initial condition 800쌍의 첫 1초 actual end-effector motion을 task-equal weighting으로 비교한다. 속도 RMS는 거의 유지하면서 jerk가 줄었다. Figure 6의 work 비교는 16개 preset 중 두 방법이 모두 성공한 13개 scene에만 해당하며, 12개에서 CoAWM이 낮았다. 별도 50-task 평가에서 150회 중 성공은 10/15/20/30/50/60 Hz 순서로 116/121/117/119/116/110회(77.3/80.7/78.0/79.3/77.3/73.3%)였다.

# Limitations / Discussion

논문 스스로 후속 버전에서 scale-up과 full fine-tuning을 예고한 초기 검증이다. cross-embodiment prior가 핵심 주장인데 공개 결과는 embodiment별 transfer 이득이나 더 큰 heterogeneous dataset scaling curve를 제시하지 않는다. 첫 1초 jerk는 좋아졌지만 더 긴 window에서는 큰 jerk tail이 남고, 60 Hz 성공률은 30 Hz보다 6.0%p 낮다. energy 결과도 두 방법 모두 성공한 13개 scene에 조건부여되어 전체 task 효율로 일반화하기 어렵다.

# 내가 이해한 핵심

CoAWM의 중요한 구분은 trajectory와 sampling grid가 같은 것이 아니라는 점이다. motion을 continuous function으로 먼저 학습하면 robot data의 clock 차이를 augmentation처럼 흡수할 수 있고, world model은 수십 개 command 대신 **실행 시간과 분리된 하나의 motion object**를 예측하게 된다.

# 다음에 연결해서 읽을 논문

- [LaWAM](https://arxiv.org/abs/2605.10963): CoAWM이 관측-conditioned backbone으로 사용하는 latent world-action model
- [CAT](https://arxiv.org/abs/2606.03914): continuous action token으로 control rate 차이를 다루는 선행 접근
- [Chronos Policy](https://arxiv.org/abs/2609.16668): discrete step 대신 physical time을 모델링하는 robot policy
- [Open X-Embodiment](https://arxiv.org/abs/2310.08864): heterogeneous embodiment 데이터 통합의 기반
