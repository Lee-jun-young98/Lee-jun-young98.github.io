---
title: "SLA: Scaling Spatial-Language-Action Model via Continual Pre-training"
date: 2026-11-06
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Fuhao Li, Wenxuan Song, Qizhou Huang, Ziyang Zhou, Jingbo Wang, Junwu E, Pengwei Wang, Yan Wang, Shunbo Zhou, Haoang Li"
paper: "https://arxiv.org/abs/2611.08373"
code: "https://github.com/SLA-team/SLA"
project: "https://sla-team.github.io/"
thumbnail: "/papers/assets/vla/sla-spatial-language-action-continual-pretraining/overview.svg"
---

# 한 줄 요약

SLA는 $\pi_{0.5}$의 여러 중간 visual layer를 frozen 3D teacher의 pixel-level 표현에 adaptive하게 정렬하며 1.7M robot episodes로 continual pre-training해, 추론 구조나 depth 입력을 늘리지 않고 공간 일반화를 강화한다.

# 논문 정보

- 제목: SLA: Scaling Spatial-Language-Action Model via Continual Pre-training
- 저자: Fuhao Li, Wenxuan Song, Qizhou Huang, Ziyang Zhou, Jingbo Wang, Junwu E, Pengwei Wang, Yan Wang, Shunbo Zhou, Haoang Li
- 발표: 확인 필요 (arXiv v1, 2026-11-05)
- 링크: [arXiv](https://arxiv.org/abs/2611.08373) · [HTML](https://arxiv.org/html/2611.08373)
- 코드/프로젝트: [GitHub](https://github.com/SLA-team/SLA) · [공식 프로젝트](https://sla-team.github.io/)
- 키워드: Spatial-Language-Action, continual pre-training, 3D representation alignment, adaptive layer selection, state dropout

# 핵심 아이디어

기존 VLA는 2D image-text pre-training의 visual representation에 의존하고, 3D supervision은 소량 downstream post-training에서만 붙는 경우가 많다. SLA는 이를 foundation 단계의 capability로 옮긴다. $\pi_{0.5}$ visual token의 여러 layer를 projection·gate로 합치고, RGB와 가능한 depth/camera calibration을 함께 받는 frozen OmniVGGT의 spatial feature에 cosine alignment한다. action loss와 동시에 학습하되 auxiliary 3D branch는 배포 때 버린다.

# VLA 관점에서 중요한 이유

명시적 point cloud나 depth를 inference input으로 요구하지 않으면서, 14,330시간·1.7139M episodes의 heterogeneous robot data에서 3D inductive bias를 VLA 내부 표현에 증류한다. RoboTwin Clean2Random은 $\pi_{0.5}$ 46.0%에서 72.3%로 +26.3%p, 8개 실환경 조건 평균은 59.8%에서 83.8%로 +24.0%p 올랐다. 즉 3D-aware VLA를 특정 task adapter가 아니라 재사용 가능한 pre-trained policy로 확장하려는 시도다.

# Robot / Embodied Setting

continual pre-training corpus는 InternData-A1, AgiBotWorld-Beta, RoboCasa365-Pretrain, RoboCOIN, DROID, MolmoAct의 총 1.7139M episodes·1,504 tasks·14,330시간이다. two-finger gripper manipulation만 남기고 mobile-base·dexterous-hand data를 제외하며 EEF pose를 공통 robot-centered frame으로 통일한다. 48×H100에서 36k step, 약 110시간 continual pre-training한다. 평가는 LIBERO-Plus 10,030 rollouts, RoboTwin 50 tasks×100 trials×2 settings, RoboCasa-Panda 24 tasks×50 trials×3 seeds, RoboDojo-Real의 세 embodiment, 그리고 8개 physical deployment condition에서 수행한다.

# Method

1. multi-view RGB와 사용 가능한 depth·intrinsic·extrinsic을 frozen OmniVGGT에 넣어 pixel-level spatial target $y_i$를 만든다. annotation이 없으면 placeholder와 stochastic fusion으로 RGB-only sample도 활용한다.
2. $\pi_{0.5}$ PaliGemma backbone의 18개 attention layer에서 visual token을 꺼내 공통 LN+2-layer MLP로 투영한다.
3. 각 token·channel·layer마다 feature-dependent sigmoid gate $g_i^{(\ell)}$를 계산하고, 투영 feature를 adaptive하게 합쳐 $z_i=\sum_\ell g_i^{(\ell)}\odot MLP(LN(x_i^{(\ell)}))$를 만든다.
4. $z_i$와 같은 image location의 $y_i$ 사이 cosine alignment loss를 action flow-matching loss에 더해 $\mathcal{L}=\mathcal{L}_{action}+\alpha\mathcal{L}_{align}$로 학습한다.
5. sample의 25%에서 state-token segment를 통째로 drop해 demonstrated trajectory shortcut보다 visual geometry에 의존하도록 한다.
6. inference에서는 OmniVGGT, projector, adaptive gate를 모두 제거한다. 원래 $\pi_{0.5}$ 구조가 RGB·language·state에서 continuous action chunk를 생성하므로 추가 depth 입력이나 계산 비용이 없다.

# 핵심 그림

![SLA의 frozen 3D teacher와 adaptive multi-layer spatial alignment 학습 구조](/papers/assets/vla/sla-spatial-language-action-continual-pretraining/overview.svg)

> 논문 Figure 1, Sections 3.2.1–3.2.4, Equations (4)–(7)을 바탕으로 재구성한 SLA 아키텍처. 출처: [논문 HTML Method](https://arxiv.org/html/2611.08373#S3.SS2). 원본 그림을 복제하지 않고 heterogeneous input, frozen teacher, layer gate, 두 손실과 inference 제거 경로를 한국어로 정리했다.
>
> 구조 그림을 고른 이유는 SLA의 차별점이 3D sensor를 policy input에 추가하는 것이 아니라, **학습 중에만** frozen spatial teacher와 multi-layer gate를 붙여 기존 VLA visual token을 바꾸는 데 있기 때문이다. 학습 흐름은 RGB(+가용 geometry) → OmniVGGT target과 $\pi_{0.5}$ 18-layer token → adaptive fusion → alignment/action joint objective이다. 추론에서는 auxiliary branch가 사라지고 원래 action expert만 남으므로, 3D supervision이 내부 표현으로 흡수됐는지를 downstream robustness로 평가한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (success rate %, ↑)                            |  SLA |              비교 기준 |    차이 | 출처     |
| --------------------------------------------------------------- | ---: | ---------------------: | ------: | -------- |
| LIBERO-Plus weighted average, 7 perturbations                   | 87.4 |       $\pi_{0.5}$ 84.4 |  +3.0%p | Table 2  |
| RoboTwin Clean2Random, 50 tasks                                 | 72.3 |       $\pi_{0.5}$ 46.0 | +26.3%p | Table 3  |
| RoboTwin Clean2Random, strongest listed ME-Dex-1.0              | 72.3 |                   68.1 |  +4.2%p | Table 3  |
| RoboTwin Clean2Random, adaptive 18-layer vs best fixed layer 12 | 72.3 |                   67.3 |  +5.0%p | Table 7  |
| RoboDojo-Real 3-embodiment 평균 SR                              | 33.9 | InternW0-$\Delta$ 31.7 |  +2.2%p | Table 5  |
| 실환경 8-condition object-level 평균 SR                         | 83.8 |       $\pi_{0.5}$ 59.8 | +24.0%p | Table 11 |
| RoboTwin 평균, state dropout 25% vs 0%                          | 79.2 |                   38.1 | +41.1%p | Table 8  |

LIBERO-Plus는 standard LIBERO로 fine-tune한 뒤 camera·robot·language·light·background·noise·layout perturbation에서 평가하며, 평균은 episode 수로 가중한다. RoboTwin은 clean demonstration을 task당 50개만 쓰고 random domain에서 100회씩 평가한다. adaptive layer selection은 단일 layer 선택을 피하면서 best fixed layer보다 +5.0%p 높았다. 다만 state dropout의 +41.1%p는 같은 continually pretrained checkpoint의 ablation이지, 전체 baseline과의 독립 비교는 아니다.

# Limitations / Discussion

공식 top-conference venue는 확인되지 않았다. 48×H100·110시간의 continual pre-training과 frozen OmniVGGT teacher는 학습 비용이 매우 크고, source dataset의 task/embodiment imbalance를 aggressive downsampling으로 조정한다. geometry annotation의 품질과 teacher bias가 student VLA로 전달될 수 있으며, 모든 downstream gain을 spatial alignment만으로 분리하기 어렵다. RoboDojo-Real에서는 long-horizon memory module을 별도로 inference에 유지하므로 base SLA 효과와 memory 효과가 섞인다. 25% state dropout의 큰 ablation gap은 shortcut sensitivity를 보여주지만 다른 corpus나 backbone에서 같은 최적값이 유지된다는 보장은 없다.

# 내가 이해한 핵심

SLA는 로봇에게 추론 때 depth를 보여주는 방법이 아니라, 학습 때 “이 visual token은 3D teacher가 보는 같은 위치의 geometry와 닮아야 한다”고 가르치는 방법이다. 어느 VLA layer가 공간 정보를 잘 담는지 미리 고르지 않고 token별 gate가 결정하며, state shortcut을 일부 끊어 실제 영상에서 geometry를 읽도록 강제한다.

# 다음에 연결해서 읽을 논문

- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): SLA가 초기화·배포 구조로 유지하는 VLA foundation
- [Spatial Forcing](https://arxiv.org/abs/2507.20529): continual pre-training 이전의 post-training-only spatial alignment
- [VGGT](https://arxiv.org/abs/2503.11651): external spatial teacher의 기반이 되는 3D foundation model
- [PointVLA](https://arxiv.org/abs/2503.07511): explicit point-cloud input을 사용하는 대비되는 3D VLA 접근
