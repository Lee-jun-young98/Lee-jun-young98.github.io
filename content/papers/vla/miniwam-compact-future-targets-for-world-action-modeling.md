---
title: "MiniWAM: Learning Compact Future Targets for Efficient World-Action Modeling"
date: 2026-10-11
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Jie Chen, Ruofei Bai, Yuxin Cai, Yifeng Zhang, Chengyang He, Jun Li, Wei-Yun Yau, Guillaume Sartoretti"
paper: "https://arxiv.org/abs/2610.12194"
code: ""
project: "https://j1dan.github.io/MiniWAM"
thumbnail: "/papers/assets/vla/miniwam-compact-future-targets-for-world-action-modeling/overview.svg"
---

# 한 줄 요약

MiniWAM은 미래 visual feature 전체 대신 inverse dynamics와 reconstruction으로 배운 compact PRISM target을 예측해, 0.25B 모델로 LIBERO 97.2%를 달성하고 RoboTwin horizon 32 학습을 총 8.46배 가속한다.

# 논문 정보

- 제목: MiniWAM: Learning Compact Future Targets for Efficient World-Action Modeling
- 저자: Jie Chen, Ruofei Bai, Yuxin Cai, Yifeng Zhang, Chengyang He, Jun Li, Wei-Yun Yau, Guillaume Sartoretti
- 발표: arXiv:2610.12194v1 (2026-10-08), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.12194) · [HTML 원문](https://arxiv.org/html/2610.12194)
- 코드/프로젝트: [공식 프로젝트](https://j1dan.github.io/MiniWAM), code 공개 여부 확인 필요
- 키워드: world-action model, compact predictive representation, PRISM, inverse dynamics, Mixture-of-Transformers

# 핵심 아이디어

기존 WAM은 video VAE나 vision encoder의 dense future tokens를 그대로 예측해 world branch가 action branch보다 훨씬 비싸진다. MiniWAM의 PRISM은 current–future feature transition을 작은 latent $L_t$로 압축하되, inverse-action flow loss로 제어 관련 변화를 남기고 feature reconstruction loss로 미래 상태 정보를 보존한다.

학습은 두 단계다. Stage 1에서 privileged future observation을 볼 수 있는 PRISM encoder가 compact target을 만들고, Stage 2에서는 이를 freeze한 뒤 MiniWAM이 현재 observation·language·proprioception만으로 $L_t$와 action을 함께 flow matching한다. 배포 시 PRISM encoder와 future observation은 제거된다.

# VLA 관점에서 중요한 이유

World prediction은 좋은 auxiliary objective지만 무엇을 target으로 삼느냐에 따라 계산량과 제어 성능이 크게 달라진다. MiniWAM은 spatial·temporal token 수를 함께 줄인 target이 native future feature보다 더 싸면서도 더 강할 수 있음을 보인다. 즉 WAM scaling의 축을 backbone 크기에서 target design으로 옮긴다.

# Robot / Embodied Setting

- LIBERO: 4 suites, 40 language-conditioned tasks, 총 2,000 evaluation episodes.
- LIBERO-Plus: 7 perturbation categories; 전체 10,030 tasks와 고정 2,000-task ablation subset.
- RoboTwin 2.0: Aloha-AgileX, 50 bimanual tasks, head/left-wrist/right-wrist RGB, clean/randomized 조건.
- visual backbone: frozen WAN2.1 VAE 또는 frozen DINOv3.
- policy: 0.25B Mixture-of-Transformers, language와 proprioception은 cross-attention context.

# Method

1. Frozen visual encoder가 현재 feature $x_t$와 미래 feature block $X_t^+$를 만든다.
2. Stage 1 PRISM encoder $E_\phi(x_t,X_t^+)$가 compact latent $L_t$를 만든다.
3. Inverse-dynamics flow loss는 $L_t$에 action-relevant transition을 남기고, lightweight decoder의 reconstruction loss는 미래 feature 정보를 보존한다.
4. Stage 1 이후 decoder는 버리고 $E_\phi$를 freeze해 posterior mean $L_t^\star$를 target으로 저장한다.
5. Stage 2 MiniWAM은 clean current tokens, noisy world tokens, noisy action tokens를 bidirectional하게 결합해 두 velocity field를 공동 예측한다.
6. 추론에서는 현재 관측·명령·상태만으로 world/action noise를 함께 denoise하고 action chunk를 receding horizon으로 실행한다.

# 핵심 그림

![미래 관측으로 PRISM target을 학습한 뒤 MiniWAM이 현재 관측에서 compact world token과 action을 공동 예측하는 2단계 구조](/papers/assets/vla/miniwam-compact-future-targets-for-world-action-modeling/overview.svg)

> 논문 Figure 2를 바탕으로 재구성. 출처: [arXiv HTML, Figure 2](https://arxiv.org/html/2610.12194). Stage 1의 privileged target 학습과 Stage 2/추론의 입력 차이를 분리해 표시했다.

구조 그림을 고른 이유는 미래 관측이 training target 생성에만 쓰이고 배포에서는 사라진다는 구분이 성능·효율 주장을 이해하는 핵심이기 때문이다. Stage 1의 $\mathcal L_{S1}$은 inverse-action, reconstruction, KL을 묶고, Stage 2의 $\mathcal L_{S2}$는 compact world velocity와 action velocity를 함께 맞춘다. action과 world token의 양방향 attention이 두 예측을 상호 보정한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)              | MiniWAM / PRISM |            비교 기준 |    차이 | 출처         |
| ------------------------------------------- | --------------: | -------------------: | ------: | ------------ |
| DINOv3, LIBERO-Plus-2K                      |            74.1 | native co-train 60.9 | +13.2%p | 원문 Table 1 |
| DINOv3, LIBERO                              |            97.2 | native co-train 93.2 |  +4.0%p | 원문 Table 1 |
| LIBERO-Plus 전체                            |            73.6 |        Fast-WAM 71.0 |  +2.6%p | 원문 Table 3 |
| RoboTwin 2.0                                |            46.1 |        Fast-WAM 39.9 |  +6.2%p | 원문 Table 3 |
| RoboTwin horizon 32, 총 학습 speedup (×, ↑) |           8.46× |         native 1.00× |  +7.46× | 원문 Table 2 |

Table 1은 architecture와 Stage-2 protocol을 고정하고 target만 바꾼 비교라 PRISM의 효과를 가장 잘 분리한다. 특히 distribution shift에서 +13.2%p가 나타나 compact target이 단순 압축이 아니라 control-relevant transition을 더 잘 보존한다는 해석을 지지한다. Table 3의 외부 baseline은 pretraining과 backbone 조건이 달라 보조 근거로만 봐야 한다.

# Limitations / Discussion

- 결과는 simulation benchmark에 집중되고 실제 로봇 검증은 보고되지 않았다.
- Stage 1에서 future observation과 별도 encoder/decoder 학습이 필요해 완전한 single-stage 방법은 아니다.
- 일부 SOTA 비교는 모델 규모, embodied pretraining, visual initialization이 달라 엄밀한 동조건 비교가 아니다.
- compact bottleneck이 접촉·미세 변형처럼 고주파 정보까지 보존하는지는 미확인이다.
- action/world 공동 denoising이 inference latency와 실패 상관관계에 미치는 분석은 제한적이다.
- 공식 conference venue와 code 저장소는 확인되지 않았다.

# 내가 이해한 핵심

MiniWAM은 미래를 덜 예측해서 빨라진 모델이 아니라, “행동을 설명하면서 미래도 복원할 수 있는 최소 표현”을 먼저 학습한 뒤 그것만 예측한다. 65배 적은 future tokens와 더 높은 성공률이 함께 나온 이유는 제거된 정보가 주로 control-irrelevant였기 때문이다.

# 다음에 연결해서 읽을 논문

- LeWAM: pixel decoder 없이 JEPA latent를 dynamics와 action으로 직접 shaping한다.
- PLaW-VLA: V-JEPA 2의 predictive latent를 action condition으로 사용한다.
- SkeleWAM: 미래 target을 sparse 3D skeleton으로 바꿔 계산과 기하를 함께 다룬다.
