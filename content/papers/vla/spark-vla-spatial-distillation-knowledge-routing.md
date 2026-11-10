---
title: "SPARK-VLA: Spatial Representation Distillation and Knowledge Routing for Vision-Language-Action Models"
date: 2026-11-10
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "NeurIPS 2026"
authors: "Jungin Park, Chaoran Zhu, Changjae Oh, Kwanghoon Sohn"
paper: "https://arxiv.org/abs/2611.10443"
code: "https://github.com/park-jungin/spark-vla"
project: ""
thumbnail: "/papers/assets/vla/spark-vla-spatial-distillation-knowledge-routing/overview.svg"
---

# 한 줄 요약

SPARK-VLA는 기존 2D 시각 경로를 보존한 채 3D expert의 attention response를 병렬 LoRA 경로에 증류하고, action-loss gradient로 학습한 router가 지시와 행동에 필요한 2D·3D token만 고르게 해 0.5B LLM·53M trainable parameter로 강한 공간 조작 성능을 낸다.

# 논문 정보

- 제목: Spatial Representation Distillation and Knowledge Routing for Vision-Language-Action Models
- 저자: Jungin Park, Chaoran Zhu, Changjae Oh, Kwanghoon Sohn
- 발표: NeurIPS 2026 camera-ready (arXiv v1, 2026-11-07; 2026-11-10 신규 목록)
- 링크: [arXiv](https://arxiv.org/abs/2611.10443) · [HTML](https://arxiv.org/html/2611.10443)
- 코드/프로젝트: [공식 GitHub](https://github.com/park-jungin/spark-vla) (Apache-2.0)
- 키워드: spatial VLA, representation distillation, knowledge routing, token selection, 3D expert, parameter-efficient adaptation

# 핵심 아이디어

공간 지식을 VLA에 넣는 기존 방식은 추론 때 depth/point cloud를 요구하거나, 하나의 visual encoder를 3D 지식에 맞추면서 사전학습된 시각-언어 의미 표현을 훼손할 수 있다. SPARK-VLA는 이를 **preserve–specialize–route**로 나눈다. frozen DINOv2 경로는 generic 2D 의미를 보존하고, 병렬 LoRA 경로는 frozen VGGT의 key/value와 공유 query로 만든 attention response를 따라 하며 공간 표현을 학습한다. 이후 knowledge router가 language-conditioned token gate를 만들고, action loss를 줄이는 token을 pseudo-label로 삼아 generic·spatial token 중 필요한 것만 LLM과 action head로 보낸다.

# VLA 관점에서 중요한 이유

이 논문은 “3D 입력을 더 넣는 것”과 “시각 backbone을 통째로 공간화하는 것” 사이에 세 번째 선택지를 제시한다. 3D teacher는 학습 때만 쓰고 추론에서는 RGB·언어·proprioception만 사용하므로 deployment interface를 바꾸지 않는다. 또한 router의 정답을 사람의 token annotation이 아니라 downstream action loss의 gradient에서 얻어, 어떤 공간 정보가 실제 제어에 유용한지를 행동 목표로 정렬한다. 결과적으로 공간 지식, 사전학습 의미 지식, 계산 예산을 서로 분리해 관리할 수 있다.

# Robot / Embodied Setting

시뮬레이션은 LIBERO의 네 suite(각 10개 language-conditioned task, task당 50 demonstration), 학습 없이 일곱 종류 시각 교란을 적용하는 LIBERO-Plus, 34개 task와 1,000개 언어 지시를 가진 장기 조작 benchmark CALVIN을 사용한다. 실제 평가는 wrist·side camera가 달린 7-DoF Franka Panda에서 cube placement, laptop closing, doll placement, button touching, microwave opening, fork removal의 여섯 task를 수행한다. clean 및 cluttered kitchen 두 환경에 총 150개 demonstration을 수집하고, 각 task를 10 episode 평가한다.

# Method

1. **Generic 경로 보존:** RGB 관측은 frozen DINOv2를 지나 generic visual token $Z_v$가 된다.
2. **Spatial 경로 전문화:** 같은 RGB를 공유 backbone의 LoRA-adapted 경로에 넣어 $Z_p$를 만든다. 학습 때 frozen VGGT의 key/value로 계산한 attention response와 spatial 경로의 response 사이 L1 loss를 최소화한다.
3. **Action-driven routing:** text embedding과 두 경로 token을 cross-attention으로 결합하고 Linear–GeLU–Linear router가 gate probability를 낸다. action loss에 대한 gate gradient가 음수이면 그 token을 더 통과시킬수록 손실이 줄어든다는 뜻이므로, $s_n=\mathrm{ReLU}(-\partial \mathcal{L}_{act}/\partial p_n)$을 momentum 누적해 top-k pseudo-label을 만든다.
4. **Token fusion과 action prediction:** 같은 위치의 generic/spatial token이 모두 선택되면 이어 붙이고, 하나만 선택되면 zero padding 뒤 projection한다. 선택되지 않은 위치는 버린다. 최종 목적함수는 action L1 loss, attention distillation loss, router focal classification·budget·entropy regularization의 합이다.
5. **두 단계 학습과 단순한 추론:** warm-up에서는 action head와 spatial branch를 먼저 안정화하고, 이후 gradient pseudo-label로 router를 공동 학습한다. 추론 때는 VGGT를 제거하고 두 visual 경로, router, 0.5B LLM과 action head만 사용한다.

# 핵심 그림

![RGB와 언어 입력이 보존된 2D 경로와 3D 지식이 증류된 공간 경로로 나뉜 뒤 action-driven router와 LLM을 거쳐 행동을 출력하는 SPARK-VLA 구조](/papers/assets/vla/spark-vla-spatial-distillation-knowledge-routing/overview.svg)

> 논문 Figure 2와 §3.1–3.4를 바탕으로 재구성. 출처: [arXiv HTML Figure 2](https://arxiv.org/html/2611.10443#S3.F2). 캡션: 학습 전용 3D teacher가 spatial LoRA 경로에 attention response를 증류하고, knowledge router가 generic·spatial token을 지시 및 action gradient에 따라 선별하는 SPARK-VLA 파이프라인.
>
> 성능 plot보다 이 구조 그림을 고른 이유는 논문의 핵심인 **보존된 의미 경로, 3D-specialized 경로, gradient-supervised routing, 추론 시 teacher 제거**의 관계를 한 번에 보여주기 때문이다. 입력 RGB는 frozen generic 경로와 LoRA spatial 경로를 동시에 통과하며, 언어 지시는 router의 cross-attention 조건이 된다. 학습 때만 VGGT의 attention response와 action-loss gradient가 각각 spatial branch와 router를 감독한다. 추론 때는 점선 교사 경로를 제거하고 `RGB·지시 → 두 종류의 token → top-k routing·위치별 fusion → LLM·action head → action chunk`만 남는다. 즉 3D 지식을 얻는 학습 비용과 RGB-only 배포 비용을 분리한 구조다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (↑)                       | SPARK-VLA |          비교 기준 |                 차이 | 출처           |
| ------------------------------------------ | --------: | -----------------: | -------------------: | -------------- |
| LIBERO 4-suite 평균 성공률 (%)             |      98.5 |   VLA-Adapter 98.5 |                0.0%p | Table 1        |
| LIBERO trainable parameter (작을수록 좋음) |       53M |   VLA-Adapter 598M | -545M, 약 11.3× 적음 | Table 1, §4.2  |
| LIBERO-Plus 7종 교란 평균 성공률 (%)       |      78.6 |   VLA-Adapter 59.0 |              +19.6%p | Table 2, §4.2  |
| 실제 Franka 6 task 평균 성공률 (%)         |      52.0 | $\pi_0$-DROID 45.0 |               +7.0%p | Figure 4, §5.2 |

LIBERO 비교는 동일한 네 suite 평균이며, SPARK-VLA는 VLA-Adapter와 같은 98.5%를 내면서 trainable parameter를 598M에서 53M으로 줄인다. LIBERO-Plus는 LIBERO로 학습한 모델을 추가 학습 없이 camera, robot, language, light, background, noise, layout 교란에 평가한 결과다. 실제 로봇 수치는 같은 여섯 task를 task당 10회 평가한 평균으로, SPARK-VLA는 특히 cluttered kitchen의 공간 추론 task를 포함한 네 task에서 $\pi_0$-DROID를 앞선다.

# Limitations / Discussion

3D sensor를 추론 때 쓰지 않지만 학습에는 frozen VGGT와 그에 맞는 attention layer 대응이 필요하고, teacher 품질과 데이터의 시각적 다양성에 성능이 의존한다. router pseudo-label은 action model이 충분히 학습되기 전에는 noisy할 수 있어 warm-up과 momentum이라는 경험적 안정화 장치가 필요하다. 실제 평가는 단일 Franka embodiment, 6개 task, task당 10회에 그쳐 다양한 로봇과 동적 환경에 대한 일반화는 아직 확인되지 않았다. LIBERO-Plus 전체 평균도 더 큰 VLANeXt의 80.1%보다 1.5%p 낮으므로, 이 논문의 강점은 절대 최고점보다는 작은 backbone과 적은 trainable parameter에서의 효율에 있다.

# 내가 이해한 핵심

SPARK-VLA의 핵심은 3D를 새로운 입력 modality가 아니라 **학습 때 빌려 쓰는 inductive bias**로 취급한 것이다. generic encoder를 보존해 “무엇인지”를 잃지 않고, 별도 경로에 “어디에 어떻게 놓였는지”를 학습하며, 최종 행동에 도움이 되는 정보만 router가 고른다. 공간 이해와 의미 이해가 한 representation 안에서 경쟁하게 하지 않고, 두 표현을 끝까지 유지한 뒤 행동 손실이 선택권을 갖게 한 점이 가장 설득력 있다.

# 다음에 연결해서 읽을 논문

- [SpatialVLA](https://arxiv.org/abs/2501.15830): explicit 3D spatial token을 사용하는 대표 비교 방법
- [VGGT](https://arxiv.org/abs/2503.11651): 학습 전용 3D teacher가 제공하는 geometry representation
- [OpenVLA-OFT](https://arxiv.org/abs/2502.19645): SPARK-VLA의 simulation policy 기반과 continuous action regression 설정
- [Evo-1](https://arxiv.org/abs/2603.04549): 사전학습 의미 지식을 보존하면서 VLA를 효율적으로 적응시키는 비교 축
