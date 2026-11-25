---
title: "Hi3R-VLA: Grounding Semantics and Actions in 3D"
date: 2026-11-25
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Shizhe Chen, Paul Pacaud, Cordelia Schmid"
paper: "https://arxiv.org/abs/2611.31535"
code: ""
project: "https://cshizhe.github.io/projects/hi3r_vla.html"
thumbnail: "/papers/assets/vla/hi3r-vla-grounding-semantics-actions-in-3d/architecture.svg"
---

# 한 줄 요약

Hi3R-VLA는 다중 시점 RGB 특징과 언어를 계층적 point cloud에 정렬하고, 공간 anchor를 가진 flow-matching action expert가 coarse-to-fine 3D 특징을 읽게 해 작은 모델로 정밀 조작을 수행한다.

# 논문 정보

- 제목: Hi3R-VLA: Grounding Semantics and Actions in 3D
- 저자: Shizhe Chen, Paul Pacaud, Cordelia Schmid
- 발표: 확인 필요 (arXiv v1, 2026-11-23)
- 링크: [arXiv](https://arxiv.org/abs/2611.31535) · [HTML](https://arxiv.org/html/2611.31535v1)
- 코드/프로젝트: 코드 공개 확인 필요 · [프로젝트 페이지](https://cshizhe.github.io/projects/hi3r_vla.html)
- 키워드: explicit 3D geometry, multimodal point encoder, spatial anchor, flow matching, coarse-to-fine attention

# 핵심 아이디어

보정된 RGB-D 카메라로 만든 point cloud와 각 pixel의 SigLIP2 특징을 같은 3D 위치에 놓고, 언어로 조건화한 PTv3 encoder가 여러 해상도의 task-relevant point feature를 만든다. action expert는 현재 end-effector 위치를 각 action token의 **spatial anchor**로 삼아 3D RoPE가 적용된 action-to-point attention을 수행한다. 따라서 장면을 2D token만으로 추론하거나 3D 중간값을 먼저 생성하는 대신, action 생성 자체가 metric geometry를 직접 읽는다.

# VLA 관점에서 중요한 이유

3D 정보를 단순 auxiliary loss나 별도 pose prediction으로 쓰지 않고 perception과 action attention의 공통 좌표계로 만든다. 0.25B trainable parameter와 task당 50 demonstration으로 RoboCasa24 78.8%를 기록한 결과는, 더 큰 VLM보다 **어디에 semantic feature와 action을 정렬하는가**가 데이터 효율에 중요할 수 있음을 보여준다.

# Robot / Embodied Setting

입력은 보정된 다중 시점 RGB-D, point cloud, proprioception, 자연어 instruction이다. 평가는 RoboCasa24의 24 task, RLBench 10 task, RoboTwin2의 50 task를 포함하며 서로 다른 robot embodiment와 camera setting을 다룬다. RoboCasa24 비교는 task당 50 demonstration 조건의 3D 계열과 300-demo 2D 계열이 섞여 있으므로 표에서 training-demo 조건을 함께 읽어야 한다.

# Method

1. **Frozen semantic encoders:** SigLIP2가 각 camera view의 spatial visual feature와 instruction embedding을 만든다.
2. **Multimodal PTv3:** 보정 정보로 image feature를 point에 붙이고, language-conditioned adaptive layer normalization을 적용한 hierarchical PTv3가 coarse-to-fine point feature $\{\mathcal{M}^{\ell}\}$를 출력한다.
3. **Spatially anchored actions:** proprioception과 noisy action chunk를 token화하되, action token마다 현재 end-effector의 3D 위치를 anchor로 부여한다.
4. **Geometry-aware flow matching:** action expert가 image/text token과 multi-scale point feature를 coarse-to-fine으로 cross-attend하며 noise를 action chunk로 변환한다. 3D RoPE는 action-action 및 action-point attention에서 상대 위치를 표현한다.

아래 그림은 원 논문의 Figure 2와 §3을 바탕으로 입력, 계층적 3D 융합, 공간 anchor, action 출력을 한 흐름으로 재구성했다.

# 핵심 그림

![다중 시점 RGB-D와 언어가 SigLIP2 및 계층적 PTv3를 거쳐 multi-scale 3D point feature가 되고, spatial anchor가 있는 flow-matching action expert가 action chunk를 생성하는 Hi3R-VLA 구조](/papers/assets/vla/hi3r-vla-grounding-semantics-actions-in-3d/architecture.svg)

> 논문 Figure 2와 §3.1–3.3을 바탕으로 재구성. 출처: [arXiv HTML Figure 2](https://arxiv.org/html/2611.31535v1#S1.F2). 캡션: visual-language semantics를 metric point hierarchy에 정렬하고 spatially anchored action token이 coarse-to-fine geometry를 읽는 Hi3R-VLA 파이프라인.
>
> 구조 그림을 고른 이유는 이 논문의 차별점이 특정 로봇 장면보다 **3D 표현과 action attention의 결합 위치**에 있기 때문이다. 학습 시 noisy action과 정답 action 사이의 conditional flow-matching loss가 action expert를 감독하고, 추론 시에는 동일 expert가 noise를 action chunk로 적분한다. image/text encoder는 semantic 조건을, PTv3는 metric geometry를, spatial anchor와 3D RoPE는 end-effector와 point 사이의 상대 위치를 담당한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)      |   Hi3R-VLA |                          비교 기준 |    차이 | 출처    |
| ----------------------------------- | ---------: | ---------------------------------: | ------: | ------- |
| RoboCasa24 평균, task당 50 demos    | 78.8 ± 0.8 |                 SA-WAM: 76.6 ± 0.5 |  +2.2%p | Table 2 |
| RoboCasa24 평균, task당 50 demos    | 78.8 ± 0.8 | $\pi_{0.5}$ + SeeR-VLA: 61.5 ± 1.2 | +17.3%p | Table 2 |
| RoboTwin2 50-task, clean→clean      |       90.1 |                       4D-WAM: 81.5 |  +8.6%p | Table 3 |
| RoboTwin2 50-task, clean→randomized |       50.5 |                  $\pi_{0.5}$: 46.0 |  +4.5%p | Table 3 |
| RoboTwin2 clean/randomized 평균     |       70.3 |                       4D-WAM: 61.6 |  +8.7%p | Table 3 |

RoboCasa24의 78.8%는 같은 50-demo 설정의 3D-aware baseline과 비교했다. 표의 GR00T-N1.5 등 300-demo 결과와는 조건이 달라 직접 차이를 계산하지 않았다. RoboTwin2에서는 동일 clean 학습 후 clean 또는 randomized 환경으로 평가했으며, 비교값은 각 열의 동일 설정이다.

# Limitations / Discussion

calibrated RGB-D와 point cloud가 필수라 RGB-only VLA보다 sensor·calibration 의존성이 크다. frozen SigLIP2와 PTv3라는 구성요소의 사전학습 효과가 구조적 기여와 완전히 분리되지 않으며, 실제 로봇의 장기·동적 manipulation이나 latency는 핵심 표에서 충분히 검증되지 않는다. RoboCasa24 표는 baseline마다 demonstration 수가 달라 모든 수치를 한 줄 순위로 해석하면 안 된다.

# 내가 이해한 핵심

Hi3R-VLA의 핵심은 3D를 더 많이 예측하는 것이 아니라, semantic perception과 action token을 **같은 metric 좌표계에서 attention하게 만드는 것**이다. action token의 anchor가 end-effector 위치를 명시하므로 필요한 geometry를 coarse-to-fine으로 찾기 쉬워진다.

# 다음에 연결해서 읽을 논문

- [PointACT](https://arxiv.org/search/?query=PointACT&searchtype=title): point feature를 VLM과 action expert 중 어디에 넣을지 비교
- [SA-WAM](https://arxiv.org/search/?query=SA-WAM+robot&searchtype=title): RGB·depth·action 공동 예측 기반 직접 비교
- [Spatial Forcing](https://arxiv.org/search/?query=SpatialForcing&searchtype=title): 3D foundation feature를 auxiliary supervision으로 쓰는 접근
- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): flow-matching action expert 계열의 기반
