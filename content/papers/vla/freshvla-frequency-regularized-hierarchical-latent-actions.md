---
title: "FreshVLA: Frequency-Regularized Hierarchical Latent Actions"
date: 2026-11-27
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Jiaming Liang et al."
paper: "https://arxiv.org/abs/2611.33635"
code: ""
project: "https://freshvla.github.io/"
thumbnail: "/papers/assets/vla/freshvla-frequency-regularized-hierarchical-latent-actions/architecture.svg"
---

# 한 줄 요약

FreshVLA는 action-free video의 변화 중 조작에 필요한 고주파 영역을 강조하고, 느린 task progress와 빠른 execution dynamics를 연속 latent action으로 분리해 robot action과 공동 flow matching한다.

# 논문 정보

- 제목: FreshVLA: Frequency-Regularized Time Scale Hierarchical Latent Actions for Vision-Language-Action Models
- 저자: Jiaming Liang, Yifeng Zhan, Rongyi He, Mu Li, Jiaqi Fan, Zhiyuan Zhang, Qiwei Liang, Zhengjie Zhang, Boyang Cai, Ningyuan Zhang, Xingjian Jing, Qiang Nie
- 발표: 확인 필요 (arXiv v1, 2026-11-25)
- 링크: [arXiv](https://arxiv.org/abs/2611.33635) · [HTML](https://arxiv.org/html/2611.33635)
- 코드/프로젝트: 코드 공개 확인 필요 · [프로젝트 페이지](https://freshvla.github.io/)
- 키워드: latent action, action-free video, temporal hierarchy, frequency regularization, joint flow matching

# 핵심 아이디어

일반적인 latent action model은 다음 frame 복원에 유리한 배경·scene identity까지 transition code에 넣을 수 있다. FreshVLA는 FFT 기반 high-pass response를 prior로 사용해 DINOv3 feature를 동적 영역에 맞추고, 36-frame window의 변화를 **substage-scale task progress**와 **frame-scale execution dynamics**로 나눈다. DCT regularization은 두 branch가 각각 저주파와 고주파 motion을 맡도록 유도한다. 이후 frozen latent encoder가 만든 target과 실제 7-D robot action을 하나의 DiT action expert가 공동 denoising한다.

# VLA 관점에서 중요한 이유

action-free human/robot video에서 얻는 latent action을 단순한 discrete token이 아니라 시간 규모가 다른 연속 control prior로 만든다. 2B backbone으로 LIBERO 평균 98.2%, LIBERO-Long 98.0%, 실제 로봇 평균 84.2%를 기록한 결과는 VLA의 장기 조작 성능이 backbone 크기뿐 아니라 **latent interface의 시간 구조**에 좌우될 수 있음을 보여준다.

# Robot / Embodied Setting

latent pretraining corpus는 real·simulation 환경의 227,894 trajectory이고, downstream policy는 Qwen3.5-2B와 DiT action expert로 7-D action chunk를 생성한다. 평가는 LIBERO 네 suite, CALVIN 연속 subtask, zero-shot LIBERO-PLUS perturbation, 그리고 RealSense D435를 장착한 6-DoF Flexiv arm의 네 language-conditioned tabletop task에서 수행한다. 실제 실험은 task당 30 trajectory를 같은 설정으로 수집했다.

# Method

1. **Dynamics-sensitive transition:** DINOv3 feature와 DynaAdapter가 FFT high-pass prior 및 PAWKL guidance로 배경보다 실제 변화 영역을 강조한다.
2. **Hierarchical continuous latent action:** cross-timescale sampling이 긴 substage transition과 짧은 execution transition을 만들고, latent encoder가 두 흐름을 결합한다.
3. **Frequency specialization:** DCT loss가 substage branch에는 저주파 task progress, execution branch에는 고주파 local correction을 배정한다.
4. **Joint latent-action flow matching:** frozen target generator의 latent action과 ground-truth robot action에 독립 Gaussian noise를 넣고, 공유 action expert가 두 velocity field를 함께 학습한다.
5. **Inference:** 미래 frame이나 target generator 없이 latent/action noise를 공동 denoising하며, 실제로는 robot action chunk만 실행한다.

아래 그림은 원 논문 Figure 2, §3.2–3.3, 식 (10)–(12)를 바탕으로 pretraining과 policy 학습·추론의 차이를 한 흐름으로 재구성했다.

# 핵심 그림

![action-free video에서 동적 visual transition을 추출하고 시간 계층 latent action을 학습한 뒤 robot action과 공동 flow matching하는 FreshVLA 구조](/papers/assets/vla/freshvla-frequency-regularized-hierarchical-latent-actions/architecture.svg)

> 논문 Figure 2와 §3.2–3.3을 바탕으로 재구성. 출처: [arXiv HTML Figure 2](https://arxiv.org/html/2611.33635#S3.F2). 캡션: high-pass prior로 동적 영역을 찾고, DCT로 substage/execution branch를 분업시킨 뒤 latent와 robot action을 공동 denoising하는 FreshVLA 파이프라인.
>
> 구조 그림을 고른 이유는 성능의 핵심이 결과 장면보다 **Stage I의 시간 계층 latent target이 Stage II의 action expert로 전달되는 방식**에 있기 때문이다. 학습 시 frozen generator가 미래 observation window에서 latent target을 만들지만, 추론 시에는 현재 observation·instruction·robot state와 noise만 사용한다. 공동 flow-matching loss는 latent velocity와 action velocity의 MSE 합이며, latent stream은 control prior로 남고 action stream만 로봇에 출력된다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)                  | FreshVLA |         비교 기준 |    차이 | 출처    |
| ----------------------------------------------- | -------: | ----------------: | ------: | ------- |
| LIBERO 평균, 동일 Table 1 protocol              |     98.2 |  GR00T-N1.6: 97.0 |  +1.2%p | Table 1 |
| LIBERO-Long                                     |     98.0 |  GR00T-N1.6: 94.4 |  +3.6%p | Table 1 |
| CALVIN 평균 완료 subtask 수 (↑)                 |     4.52 | $\pi_{0.5}$: 4.26 |   +0.26 | Table 1 |
| LIBERO-PLUS zero-shot macro 평균                |     80.4 |  GR00T N1.7: 77.3 |  +3.1%p | Table 2 |
| 실제 Flexiv 4-task 평균, task당 30 trajectories |     84.2 | $\pi_{0.5}$: 76.7 |  +7.5%p | Table 3 |
| 실제 Collect Toys 성공률                        |     73.3 | $\pi_{0.5}$: 63.3 | +10.0%p | Table 3 |

Table 1의 모델 크기는 FreshVLA 2B, GR00T-N1.6 3B로 동일하지 않으므로 결과를 순수한 구조 ablation으로 해석하지 않았다. 구조 자체는 같은 2B 설정의 `w/o LA`와 비교할 때 LIBERO 평균 96.0→98.2%(+2.2%p), CALVIN 길이 4.26→4.52로 개선된다. PAWKL ablation은 LIBERO-PLUS 평균을 74.8→80.4%(+5.6%p)로 높였지만 layout 항목은 82.4→76.3%로 낮아졌다(Table 5).

# Limitations / Discussion

fixed third-person video만 latent pretraining에 사용하며 wrist-camera ego-motion은 아직 다루지 못한다. high-pass prior가 goal location처럼 정적인 단서를 약화할 수 있고, 실제 실험은 단일 Flexiv setup의 네 task와 task당 30 trajectory에 제한된다. 여러 baseline의 backbone·pretraining data가 달라 Table 1의 절대 성능 차이를 latent 설계만의 효과로 볼 수 없다.

# 내가 이해한 핵심

FreshVLA의 핵심은 latent action의 용량을 키우는 것이 아니라 **변화가 일어나는 위치와 변화의 시간 규모를 먼저 정리하는 것**이다. 장기 progress와 순간 correction을 다른 branch가 맡게 한 뒤 action과 함께 denoising하므로, video pretraining 정보가 실제 control에 더 직접적으로 연결된다.

# 다음에 연결해서 읽을 논문

- [LAPA](https://arxiv.org/abs/2410.11758): discrete latent action을 이용한 VLA pretraining의 대표 기준
- [UniVLA](https://arxiv.org/abs/2505.06111): task-centric latent action과 cross-embodiment transfer 비교
- [FAST](https://arxiv.org/abs/2501.09747): action chunk 자체를 주파수 공간에서 압축하는 접근
- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): flow-matching action expert 기반 실제 로봇 비교군
