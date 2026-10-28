---
title: "E0.5: From Reconstructive to Future-Predictive 3D Foundations for Robotic World-Action Modeling"
date: 2026-10-28
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "X-Era AI Lab Team"
paper: "https://arxiv.org/abs/2610.36011"
thumbnail: "/papers/assets/vla/e0-5-geometry-native-world-action-model/overview.svg"
---

# 한 줄 요약

3D foundation을 주 backbone으로 삼아 32-step 행동과 그 끝 시점의 depth·point map·camera를 공동 예측하는 geometry-native WAM이다.

# 논문 정보

- 제목: E0.5
- 저자: X-Era AI Lab Team
- 발표: 확인 필요 (arXiv v1, 2026-10-26)
- 링크: [arXiv](https://arxiv.org/abs/2610.36011) · [HTML](https://arxiv.org/html/2610.36011)
- 코드/프로젝트: 확인되지 않음
- 키워드: 3D foundation, future geometry, flow matching

# 핵심 아이디어

VGGT-Ω geometric tokens가 장면 이해·미래 3D 상태·행동 생성을 모두 지탱한다. 미래 관측은 추론 입력이 아니라 학습 supervision이다.

# VLA 관점에서 중요한 이유

미래 픽셀 대신 행동 결과 시점과 정렬된 3D 변화를 학습하고, backbone 전체를 action·geometry loss로 적응시킨다.

# Robot / Embodied Setting

RoboTwin 2.0 50 tasks, AgiBotWorld-Beta 160k+ trajectories, AgileX Piper와 Zerith H1의 세 real tasks를 평가한다.

# Method

VGGT-Ω·frozen T5와 DiT action expert를 24개 상호작용 layer로 결합한다. horizon 32, 10 denoising steps이며 chunk 끝 depth·point map·camera loss를 쓴다.

# 핵심 그림

![E0.5 구조](/papers/assets/vla/e0-5-geometry-native-world-action-model/overview.svg)

> 그림 2. Figure 2와 Eq. (1)–(4)를 바탕으로 재구성. 출처: [원문](https://arxiv.org/html/2610.36011#S3).
> 구조 그림은 3D backbone이 action과 future geometry를 함께 지탱함을 보여준다. 학습 때 future target을 쓰지만 추론에는 현재 관측만 필요하다.

# Experiments / Results

## 주요 실험 결과

| 지표 (%, ↑)                   |  제안 |          비교 |     차이 | 출처    |
| ----------------------------- | ----: | ------------: | -------: | ------- |
| RoboTwin clean SR             | 89.90 | FastWAM 77.76 | +12.14%p | Table 1 |
| RoboTwin randomized SR        | 50.09 |  FastWAM 1.92 | +48.17%p | Table 1 |
| Piper ID, no pretrain mean SR |  86.7 |     π0.5 46.7 |  +40.0%p | Table 3 |
| Piper OOD, pretrain mean SR   |  73.3 |     π0.5 63.3 |  +10.0%p | Table 3 |

동일 setting만 비교했으며 real-robot 각 셀은 10 trials다.

# Limitations / Discussion

baseline pretraining 규모가 다르고, 실제 로봇 범위가 작으며 depth pseudo-label과 calibration에 의존한다.

# 내가 이해한 핵심

미래 영상을 그리기보다 **행동 chunk 끝의 3D 관계 변화**를 backbone이 설명하게 만든다.

# 다음에 연결해서 읽을 논문

PDRVLA, FastWAM, VGA.
