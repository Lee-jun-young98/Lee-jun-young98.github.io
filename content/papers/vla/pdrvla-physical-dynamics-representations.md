---
title: "PDRVLA: A Vision-Language-Action Model with Physical Dynamics Representations"
date: 2026-10-28
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Hanqing Wang et al."
paper: "https://arxiv.org/abs/2610.37381"
thumbnail: "/papers/assets/vla/pdrvla-physical-dynamics-representations/overview.svg"
---

# 한 줄 요약

VLM 중간층의 50개 physical tokens를 미래 RGB·depth·flow 예측으로 학습하고, 추론에서는 video model 없이 action expert에 공급한다.

# 논문 정보

- 제목: PDRVLA
- 저자: Hanqing Wang 외 14명
- 발표: 확인 필요 (arXiv v1, 2026-10-27)
- 링크: [arXiv](https://arxiv.org/abs/2610.37381) · [HTML](https://arxiv.org/html/2610.37381)
- 코드/프로젝트: 확인되지 않음
- 키워드: physical dynamics, future feature, cross-embodiment

# 핵심 아이디어

Qwen3.5-4B 8번째 층에 50 queries를 붙인다. frozen LingBot-Video teacher는 pretraining에만 쓰고 joint training·추론에서는 제거한다.

# VLA 관점에서 중요한 이유

online video generation 대신 57.3M-parameter(4B의 1.4%) dynamics representation만 남긴다.

# Robot / Embodied Setting

EgoDex 변환 0.90M trajectories/2,646 hours, 58D action, LIBERO 2,000 episodes, LIBERO-Plus 10,030 cases, RoboTwin 50 tasks, SimplerEnv 4 tasks.

# Method

중간층은 physical module에, final feature는 action expert에 간다. future RGB·depth·flow direct loss와 video-teacher loss 뒤 action+VL+direct loss로 공동 학습한다.

# 핵심 그림

![PDRVLA 구조](/papers/assets/vla/pdrvla-physical-dynamics-representations/overview.svg)

> 그림 3–4. Figures 3–4와 Eq. (5)–(11)을 바탕으로 재구성. 출처: [원문](https://arxiv.org/html/2610.37381#S3).
> 구조 그림은 중간층 dynamics token과 final semantics의 결합을 보여준다. 추론에는 teacher 없이 8-step action을 생성한다.

# Experiments / Results

## 주요 실험 결과

| 지표 (%, ↑)      | 제안 |                 비교 |   차이 | 출처      |
| ---------------- | ---: | -------------------: | -----: | --------- |
| LIBERO 평균 SR   | 99.3 | Qwen-RobotManip 99.1 | +0.2%p | Table 5/6 |
| LIBERO-Plus SR   | 89.9 |  InternVLA-A1.5 84.8 | +5.1%p | Table 5/7 |
| RoboTwin 평균 SR | 93.6 |  InternVLA-A1.5 93.2 | +0.4%p | Table 5/8 |
| SimplerEnv SR    | 81.5 |  InternVLA-A1.5 80.8 | +0.7%p | Table 5   |

baseline recipe는 완전히 통제되지 않았다.

# Limitations / Discussion

합성·annotation 효과와 module 기여를 분리하기 어렵고 실제 로봇 closed-loop 결과가 없다.

# 내가 이해한 핵심

**미래 예측을 잘해야 얻을 수 있는 token만 정책에 남긴다.**

# 다음에 연결해서 읽을 논문

E0.5, FastWAM, InternVLA-A1.5.
