---
title: "CoRAct: Consequence-Grounded Reasoning-to-Action Alignment for VLA Models"
date: 2026-10-31
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Yixue Zhang et al."
paper: "https://arxiv.org/abs/2610.39543"
project: "https://onlyxingxingzyx.github.io/CoRAct/"
thumbnail: "/papers/assets/vla/coract-consequence-grounded-reasoning-action-alignment/overview.svg"
---

# 한 줄 요약

CoRAct는 embodied CoT의 이동 의도와 waypoint 결과를 검증 가능한 보상으로 바꾸고, frozen VLA의 action-flow 초기 noise 분포만 최적화해 말한 추론이 실제 행동과 결과로 이어지게 한다.

# 논문 정보

- 제목: From Reasoning to Action: Consequence-Grounded Alignment for Vision-Language-Action Models
- 저자: Yixue Zhang, Wenke Xia, Kun Wu, Wenbo Yu, Pei Ren, Junnan Nie, Di Hu, Zhengping Che, Chang Liu
- 발표: 확인 필요 (arXiv v1, 2026-10-29)
- 링크: [arXiv](https://arxiv.org/abs/2610.39543) · [HTML](https://arxiv.org/html/2610.39543)
- 코드/프로젝트: [CoRAct project](https://onlyxingxingzyx.github.io/CoRAct/)
- 키워드: VLA, embodied chain-of-thought, consequence prediction, reasoning-action alignment, flow matching

# 핵심 아이디어

ECoT를 action decoder의 조건으로만 쓰면 추론 문장은 그럴듯해도 행동이 따르지 않을 수 있다. CoRAct는 ECoT를 이동량·회전·gripper 명령과 이미지 위 future waypoint로 구조화하고, 후보 action이 이 의도를 따르는지와 action-conditioned future image가 waypoint를 실현하는지를 각각 보상으로 측정한다. 그런 다음 backbone을 고정한 채 512차원 conditional noise policy만 group-relative objective로 학습한다.

# VLA 관점에서 중요한 이유

이 논문은 “reasoning을 생성했다”와 “reasoning대로 움직였다”를 분리한다. 특히 future prediction을 단순한 보조 표현이 아니라 실행 결과를 검증하는 인터페이스로 쓰고, 여러 후보를 평가하는 비용을 학습 시 noise 분포에 증류해 배포 시에는 한 번의 action sample만 필요하게 만든다.

# Robot / Embodied Setting

시뮬레이션은 VLABench 10개 task(각 50회)와 RoboCasa 17개 task(각 30회)의 ID/OOD 설정이다. 정책은 JanusFlow-1.3B 기반 Mixture-of-Transformers이며 8-step, 7D Cartesian action chunk를 10회 flow integration으로 생성한다. 실로봇은 tabletop organization, image-guided word assembly, language-guided fruit selection을 각각 30회 평가하고, joint-space movement와 top-camera flange waypoint로 ECoT 표현을 바꾼다.

# Method

1. VLM expert가 RGB·robot state·language에서 movement와 waypoint를 포함한 구조화 ECoT를 autoregressive하게 만든다.
2. action expert는 ECoT 조건에서 action chunk를 flow matching으로 생성하고, image expert는 action-conditioned future latent를 예측한다.
3. 후보 8개마다 movement endpoint 오차로 $R^{MOV}$를, future image에서 Grounding DINO가 찾은 waypoint 오차로 $R^{vis}=\exp(-d_u/\tau_u)$를 계산한다.
4. 같은 context의 후보 평균을 critic-free baseline으로 삼아 conditional initial-noise policy를 clipped group-relative objective로 최적화한다. MoT backbone, future predictor, waypoint localizer는 고정한다.
5. 추론에서는 학습된 noise policy에서 초기값 하나를 뽑아 frozen action expert가 한 action chunk를 생성한다.

# 핵심 그림

![CoRAct의 ECoT 생성, action과 future 예측, 검증 보상 기반 noise-policy 정렬, 단일 샘플 추론 흐름](/papers/assets/vla/coract-consequence-grounded-reasoning-action-alignment/overview.svg)

> 논문 Figure 2와 Equations (5–7)을 바탕으로 재구성한 CoRAct 구조. 출처: [논문 HTML Figure 2 및 Method](https://arxiv.org/html/2610.39543#S3). 원본 이미지를 복제하지 않고 학습·추론 경로를 한국어로 다시 그렸다.
>
> 구조 그림을 고른 이유는 핵심이 로봇 장면보다 **reasoning–action–consequence 세 경로와 noise-space 정렬의 연결**에 있기 때문이다. Stage 1에서는 ECoT가 action expert를 조건화하고 action은 future image 예측을 조건화한다. Stage 2에서는 movement 오차와 predicted waypoint 오차가 후보별 reward가 되어 noise policy만 갱신한다. 추론에는 후보 8개 검증이 사라지고, 조건부 noise 한 개가 10-step denoising을 거쳐 action chunk가 된다.

# Experiments / Results

## 주요 실험 결과

| 설정 / 지표 (task success %, ↑)     | CoRAct |                비교 기준 |    차이 | 출처    |
| ----------------------------------- | -----: | -----------------------: | ------: | ------- |
| VLABench T1 ID                      |   51.8 |         $\pi_{0.5}$ 40.6 | +11.2%p | Table I |
| VLABench T4 semantic generalization |   36.2 |         $\pi_{0.5}$ 16.1 | +20.1%p | Table I |
| RoboCasa OOD scene                  |   60.0 | $\mathrm{LaST}_{0}$ 55.5 |  +4.5%p | Table I |
| 실로봇 tabletop organization        |   56.6 | $\mathrm{LaST}_{0}$ 40.0 | +16.6%p | Table V |
| 실로봇 image-guided word assembly   |   46.6 | $\mathrm{LaST}_{0}$ 33.3 | +13.3%p | Table V |

Table I의 VLABench는 task당 50회, RoboCasa는 task당 30회 평가다. Table III에서 movement·waypoint alignment를 모두 쓰면 position error가 0.401→0.171 cm, waypoint error가 5.998→0.542 px로 줄고 gripper agreement는 69.789%→91.800%(+22.011%p)로 오른다. 이는 성공률 증가와 함께 논문이 주장하는 reasoning–execution 정합 자체가 개선됐음을 보여준다.

# Limitations / Discussion

보상은 rule-based movement와 2D waypoint처럼 직접 검증 가능한 ECoT 필드에 한정되며 장기 subgoal·semantic plan 정합은 다루지 않는다. backbone 학습 데이터의 validation split에서 noise policy를 post-train하므로 완전히 새로운 failure-state 회복을 배우지 못한다. 실제로 논문도 expert trajectory만 사용한 탓에 잘못된 ECoT에서 self-correction이 약하다고 밝히고 외부 agent 보정을 별도로 붙인다. 실로봇은 세 task, task당 30회이며 foundation-scale pretraining에서의 효과는 미검증이다.

# 내가 이해한 핵심

CoRAct의 핵심은 CoT를 더 길게 만드는 것이 아니라, **CoT의 일부를 측정 가능한 계약으로 바꾸는 것**이다. action과 예상 결과가 그 계약을 지키는 후보가 나오도록 flow의 시작점 분포를 학습해, 검증 비용을 inference가 아니라 offline post-training에 지불한다.

# 다음에 연결해서 읽을 논문

- [CoT-VLA](https://arxiv.org/abs/2503.22020): future visual subgoal을 사용하는 embodied reasoning VLA
- [CoVer-VLA](https://arxiv.org/abs/2605.13639): contrastive reasoning-action correspondence baseline
- [LaST0](https://arxiv.org/abs/2605.12312): latent spatio-temporal reasoning으로 action을 조건화하는 접근
- [Noise Space Learning for VLA Adaptation](https://arxiv.org/abs/2608.07399): frozen flow policy의 noise 분포를 학습하는 연결점
