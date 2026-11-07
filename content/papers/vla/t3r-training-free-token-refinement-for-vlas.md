---
title: "T3R: Training-Free Two-Stage Token Refinement Towards Efficient and Robust VLA Models"
date: 2026-11-08
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Mohammed Hassan, Zhenyang Chen, Zheng Wang, Zhixin Zhu, Tianlong Chen, Yingyan (Celine) Lin, Chaojian Li"
paper: "https://arxiv.org/abs/2611.08413"
code: ""
project: ""
thumbnail: "/papers/assets/vla/t3r-training-free-token-refinement-for-vlas/overview.svg"
---

# 한 줄 요약

T3R은 학습 없이 segmentation 기반 visual-token pruning과 saliency 기반 attention biasing을 이어 붙여, multi-camera VLA의 계산량과 배경 교란을 동시에 줄인다.

# 논문 정보

- 제목: T3R: Training-Free Two-Stage Token Refinement Towards Efficient and Robust VLA Models
- 저자: Mohammed Hassan, Zhenyang Chen, Zheng Wang, Zhixin Zhu, Tianlong Chen, Yingyan (Celine) Lin, Chaojian Li
- 발표: 확인 필요 (arXiv v1, 2026-11-05)
- 링크: [arXiv](https://arxiv.org/abs/2611.08413) · [HTML](https://arxiv.org/html/2611.08413)
- 코드/프로젝트: 논문 공개 시점에 공식 링크 확인되지 않음
- 키워드: training-free VLA, visual-token pruning, segmentation, attention bias, multi-camera manipulation

# 핵심 아이디어

VLA의 visual token에는 두 종류의 낭비가 있다. 배경처럼 애초에 action과 무관한 token이 많고, 남은 token에서도 action query의 attention이 중요한 물체·명령어로 충분히 모이지 않는다. T3R은 첫 단계에서 instruction과 image patch의 유사도로 target을 찾고 segmentation mask를 만들어 불필요한 patch를 제거한다. 두 번째 단계에서는 instruction의 Integrated Gradients saliency를 이용해 중요한 text token과 보존된 visual token에 additive attention bias를 준다.

# VLA 관점에서 중요한 이유

별도 fine-tuning 없이 기존 VLA의 inference graph에 삽입할 수 있고, pruning을 단순 가속이 아니라 OOD robustness 수단으로도 해석한다. OpenVLA-OFT의 LIBERO-Spatial에서 scene-camera token 85%를 제거하면서 97% 대비 96% 성공률을 유지했고, object-placement shift에서는 최대 +7%p 높았다. 특히 camera 수만큼 visual token이 늘어나는 multi-view policy에서 계산 절감과 distractor 제거를 같은 메커니즘으로 얻는다는 점이 중요하다.

# Robot / Embodied Setting

평가는 OpenVLA-OFT/LIBERO-Spatial, CogACT/SIMPLER의 Google Robot·WidowX/Bridge, 그리고 3-camera VLA의 RoboTwin에서 수행한다. LIBERO OOD 평가는 물체 위치를 0–5 cm 범위 21개 noise level로 움직이고 task당 10 episode를 실행한다. RoboTwin은 camera당 256개 token을 64–160개로 제한하며 multi-camera 상황의 budget–success trade-off를 비교한다.

# Method

1. instruction의 명사·공간어 등 POS-weighted text feature와 SigLIP patch feature의 cosine similarity로 target 후보 patch를 고른다.
2. 상위 patch 위치와 DINOv2 feature를 EfficientTAM의 prompt로 넣어 object mask를 만들고 patch-level keep/drop mask로 변환한다. 제거 뒤에도 원래 RoPE position을 유지한다.
3. instruction token별 Integrated Gradients로 action prediction에 대한 saliency를 계산한다.
4. decoder 중간 layer의 action-token query가 salient text token과 보존된 visual token을 더 보도록 additive attention bias를 주고 action chunk를 생성한다.
5. robot이 chunk를 실행한 뒤 새 관측에서 같은 두 단계를 반복한다. backbone weight는 바꾸지 않는다.

# 핵심 그림

![T3R의 segmentation 기반 pruning과 saliency 기반 attention biasing 두 단계 구조](/papers/assets/vla/t3r-training-free-token-refinement-for-vlas/overview.svg)

> 논문 Figure 1과 Section 3을 바탕으로 재구성한 T3R 파이프라인. 출처: [논문 HTML Figure 1](https://arxiv.org/html/2611.08413#S3.F1). 원본 그림을 복제하지 않고 입력, 두 refinement 단계, action 출력과 closed loop를 한국어로 정리했다.
>
> 구조 그림을 고른 이유는 성능 향상이 단일 pruning rule이 아니라 **후보 집합을 정리하는 단계**와 **남은 evidence의 attention을 재배분하는 단계**의 결합에서 나오기 때문이다. 관측·명령 → SigLIP/DINOv2/EfficientTAM mask → interested visual tokens → Integrated Gradients attention bias → action chunk 순서이며, 두 외부 연산은 inference 때 매 control step 실행되고 VLA 본체는 재학습하지 않는다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (↑)                                          |  T3R |         비교 기준 |        차이 | 출처     |
| ------------------------------------------------------------- | ---: | ----------------: | ----------: | -------- |
| LIBERO-Spatial success rate (%) · scene-camera token 85% 제거 | 96.0 |     unpruned 97.0 |      -1.0%p | Table 1  |
| LIBERO-Spatial inference latency (ms/call, ↓)                 | 92.5 |    unpruned 107.5 |    -15.0 ms | Table 1  |
| RoboTwin SR (%) · 3 cameras · 64 token/camera                 | 13.3 |       TeamVLA 3.3 |     +10.0%p | Table 2  |
| RoboTwin SR (%) · 3 cameras · 160 token/camera                | 38.3 |          ADP 25.0 |     +13.3%p | Table 2  |
| LIBERO-Spatial OOD · 4 cm placement shift, 성공률 차이        |    — | unpruned baseline | 최대 +7.0%p | Figure 4 |

Table 1의 latency는 같은 LIBERO-Spatial/OpenVLA-OFT 설정에서 비교하며 T3R의 pruning·bias 적용 비용을 포함한 VLA call 기준이다. 85% pruning에서 FastV 14%, ADP 66%와 달리 T3R은 96% 성공률을 유지한다. 다만 single-camera SIMPLER에서는 T3R이 Google Robot 67.7%, WidowX 10.4%로 baseline 73.2%, 10.4%를 넘지 못해 이득이 multi-camera 조건에 집중된다.

# Limitations / Discussion

공식 top-conference 채택은 확인되지 않았다. EfficientTAM, DINOv2, SigLIP, Integrated Gradients라는 보조 연산이 필요하며 논문은 mask·bias 적용에 call당 7.8 ms가 든다고 보고한다. 명령에서 target object를 잘못 찾거나 segmentation이 실패하면 중요한 patch를 제거할 수 있다. OOD 평가는 주로 물체 위치 교란이고, 조명·occlusion·새로운 물체·언어 변화까지 같은 robustness가 유지되는지는 별도 검증이 필요하다. single-camera SIMPLER 결과는 training-free pruning이 항상 accuracy를 보존하지는 않음을 보여준다.

# 내가 이해한 핵심

T3R은 “attention이 작으니 token을 자른다”에서 끝나지 않는다. 먼저 외부 segmentation으로 action 후보 공간을 좁히고, 그 뒤 action query가 명령의 핵심 단어와 남은 시각 증거를 다시 보게 한다. 즉 pruning이 recall을 책임지고 biasing이 precision을 보완하는 두 단계 inference adapter다.

# 다음에 연결해서 읽을 논문

- [TeamVLA](https://arxiv.org/abs/2503.04745): visual-token merge 기반 training-free VLA 가속 비교군
- [FastV](https://arxiv.org/abs/2403.06764): attention 기반 visual-token pruning의 대표 기준
- [OpenVLA-OFT](https://arxiv.org/abs/2502.19645): 주요 LIBERO backbone과 action decoding 설정
- [EfficientTAM](https://arxiv.org/abs/2411.18933): T3R mask를 만드는 segmentation 모듈
