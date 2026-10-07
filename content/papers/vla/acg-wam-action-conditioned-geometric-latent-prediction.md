---
title: "ACG-WAM: World-Action Modeling via Action-Conditioned Geometric Latent Prediction"
date: 2026-10-07
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Jiangtao Liu, Zishang Xiang, Yage He, Lingguo Cui, Baihai Zhang, Runqi Chai, Senchun Chai"
paper: "https://arxiv.org/abs/2610.06965"
code: "https://github.com/RoboOpus/ACG-WAM"
project: "https://RoboOpus.github.io/ACG-WAM"
thumbnail: "/papers/assets/vla/acg-wam-action-conditioned-geometric-latent-prediction/overview.svg"
---

# 한 줄 요약

ACG-WAM은 현재 영상과 행동 prefix에서 미래 장면의 VGGT 기하 특징을 예측하는 보조 목적을 WAM 학습에 추가해, RoboTwin 2.0 평균 성공률 93.07%와 실제 양팔 로봇 성공률 85.00%를 달성한다.

# 논문 정보

- 제목: ACG-WAM: World-Action Modeling via Action-Conditioned Geometric Latent Prediction
- 저자: Jiangtao Liu, Zishang Xiang, Yage He, Lingguo Cui, Baihai Zhang, Runqi Chai, Senchun Chai
- 발표: arXiv:2610.06965v1 (2026-10-03), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.06965) · [HTML 원문](https://arxiv.org/html/2610.06965)
- 코드/프로젝트: [GitHub](https://github.com/RoboOpus/ACG-WAM) · [프로젝트 페이지](https://RoboOpus.github.io/ACG-WAM)
- 키워드: world-action model, geometric supervision, VGGT, JEPA, bimanual manipulation, RoboTwin 2.0

# 핵심 아이디어

WAM의 video/action loss만으로는 “이 action sequence가 물체의 어떤 공간 관계를 만들었는가”를 명시적으로 학습시키지 못한다. ACG-WAM은 frozen VGGT가 현재·미래 영상을 함께 인코딩해 만든 미래 slot을 geometric target으로 삼고, 현재 visual feature와 그 사이의 action prefix, horizon에서 이 target을 예측한다.

보조 손실은 temporal mixing 이전의 shared patch embedding까지 gradient를 보내므로 future leakage 없이 현재 관찰 표현을 기하적으로 정렬한다. VGGT teacher, adapter, predictor는 학습 때만 사용하고 추론에서는 제거해 Motus backbone의 입력·행동 생성 경로와 계산량을 유지한다.

# VLA 관점에서 중요한 이유

video prediction이 픽셀 변화에 집중하면 grasp, containment, support 같은 조작에 중요한 3D 관계가 약하게 표현될 수 있다. ACG-WAM은 행동 조건부 미래 endpoint를 기하 latent로 예측하게 해 world modeling과 control 사이의 접점을 선명하게 만든다. 또한 privileged geometry를 deployment input으로 요구하지 않아 RGB-only WAM의 실용성을 유지한다.

# Robot / Embodied Setting

- 기반 모델: Motus WAM, Wan2.2-TI2V-5B와 Qwen3-VL-2B-Instruct.
- simulation: RoboTwin 2.0의 50개 양팔 조작 과제, clean/randomized 각 task 100 episode.
- 실제 로봇: TRON2 + WUJI hands, head camera 1대와 wrist camera 2대. 과제당 100 demonstration, 정책당 과제별 20 trial.
- 행동: 16개 joint-position action chunk, video/action 생성에 10-step UniPC.

# Method

1. head·left wrist·right wrist의 현재/미래 image pair를 frozen VGGT에 넣어 각 view의 future slot을 얻는다.
2. slot을 channel centering·adaptive pooling한 뒤 3개 view를 이어 96×768 geometric target $J_{t,k}$를 만든다.
3. student는 현재 frame만 별도 VAE와 shared patch embedding으로 인코딩해 $Z_t$를 만든다.
4. adapter와 predictor가 $Z_t$, 현재부터 미래 endpoint까지의 action prefix $A_{t,k}$, horizon $k$에서 $J_{t,k}$를 예측한다.
5. base video/action flow-matching loss에 geometric cosine·variance·covariance loss를 더한다. 추론 시 auxiliary branch 전체를 제거한다.

# 핵심 그림

![ACG-WAM의 행동 조건부 기하 latent 예측 학습 구조](/papers/assets/vla/acg-wam-action-conditioned-geometric-latent-prediction/overview.svg)

> 원문 Figure 2와 Figure 3을 논문 내용을 바탕으로 재구성. 출처: [arXiv HTML, Figure 2–3](https://arxiv.org/html/2610.06965). 현재 관찰과 행동 prefix를 쓰는 student branch, 현재·미래 pair에서 target을 만드는 frozen VGGT teacher, shared patch embedding으로 전달되는 보조 손실과 추론 시 제거되는 모듈을 구분했다.

구조 그림을 고른 이유는 이 논문의 핵심 차이가 “미래 영상을 예측한다”가 아니라 어떤 시점의 어떤 특징에 기하 supervision을 거는지에 있기 때문이다. 학습 시 teacher는 미래 영상을 보지만 student visual input은 현재 frame만 보며, action prefix와 horizon이 가능한 여러 미래 중 목표 endpoint를 지정한다. 추론에서는 teacher와 predictor가 사라지고 기하적으로 정렬된 shared embedding만 Motus의 video/action 생성에 남는다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (단위, ↑)                      | ACG-WAM |     비교 기준 |     차이 | 출처            |
| ----------------------------------------------- | ------: | ------------: | -------: | --------------- |
| RoboTwin 2.0 clean 성공률 (%, 50 task×100회)    |   93.46 | 88.66 (Motus) |  +4.80%p | 원문 Table I(a) |
| RoboTwin 2.0 randomized 성공률 (%)              |   92.68 | 87.02 (Motus) |  +5.66%p | 원문 Table I(a) |
| 실제 TRON2 3과제 평균 성공률 (%, 60 trial)      |   85.00 | 75.00 (Motus) | +10.00%p | 원문 Table II   |
| 실제 TRON2 평균 partial completion score (%, ↑) |   91.67 | 82.50 (Motus) |  +9.17%p | 원문 Table II   |

RoboTwin randomized에서는 Motus 대비 50개 과제 중 37승·5무·8패이고, Hanging Mug와 Handover Mic의 향상은 각각 최대 +38%p, +35%p다. 실제 로봇에서도 같은 demonstration·preprocessing·action protocol 아래 완전 성공과 부분 진행이 모두 개선되어, 보조 기하 목표가 simulation 점수만 올린 것은 아님을 보인다.

# Limitations / Discussion

- frozen VGGT target을 offline cache해야 하므로 학습 전 계산·저장 비용이 추가된다.
- 실제 평가는 같은 TRON2/WUJI 플랫폼의 세 과제, 정책당 60 trial에 제한된다.
- geometric teacher의 bias와 현재/미래 image pair 품질이 supervision 상한을 정한다.
- base backbone이 크고 RoboTwin 전체 학습에 4 GPU, 40k update를 사용해 가벼운 방법은 아니다.
- auxiliary module은 추론에서 제거되지만 학습 시간 overhead와 target cache 크기의 정량 비교는 본문에서 제한적이다.

# 내가 이해한 핵심

ACG-WAM은 “행동이 만든 미래”를 픽셀로만 복원하지 않고, 현재 장면과 공동 인코딩된 미래의 기하 endpoint로 압축한다. action prefix가 원인을, VGGT future slot이 결과를, horizon이 시간 범위를 제공한다. 그 연결을 temporal attention 이전 표현에 학습시키는 것이 future leakage를 막으면서 제어에 쓸 공간 정보를 남기는 핵심이다.

# 다음에 연결해서 읽을 논문

- Motus: ACG-WAM의 base world-action backbone.
- MECo-WAM: frozen VGGT를 이용한 action-aware relational distillation과 비교할 수 있다.
- WAM4D: future depth와 spatial register를 학습하는 기하 world-action modeling 접근.
