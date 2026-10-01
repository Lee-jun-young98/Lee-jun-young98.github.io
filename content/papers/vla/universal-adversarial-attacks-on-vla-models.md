---
title: "Exploiting Vulnerabilities: Universal Adversarial Attacks on Vision-Language-Action Models in Robotics"
date: 2026-10-01
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "ICRA 2026"
authors: "Songhua Yang, Ziyu Liu, Yuanwei Liu, Xuetao Li, Xuanye Fei, He Huang, Zheng Wang, Miao Li"
paper: "https://arxiv.org/abs/2609.39178"
code: ""
project: ""
thumbnail: "/papers/assets/vla/universal-adversarial-attacks-on-vla-models/overview.svg"
---

# 한 줄 요약

작은 textured sphere 하나가 $\pi_0$와 RDT의 다중 시점 입력을 교란해 평균 성공률을 31.2–39.9%p 낮출 수 있음을 시뮬레이션과 실제 ALOHA에서 보인다.

# 논문 정보

- 제목: Exploiting Vulnerabilities: Universal Adversarial Attacks on Vision-Language-Action Models in Robotics
- 저자: Songhua Yang, Ziyu Liu, Yuanwei Liu, Xuetao Li, Xuanye Fei, He Huang, Zheng Wang, Miao Li
- 발표: ICRA 2026; arXiv:2609.39178 (2026-09-30)
- 링크: [arXiv](https://arxiv.org/abs/2609.39178)
- 코드/프로젝트: 확인하지 못함
- 키워드: VLA security, universal adversarial object, RoboTwin, ALOHA, black-box attack

# 핵심 아이디어

128×128 adversarial texture를 반지름 3 cm 구에 입혀 작업 공간에 두고, task failure, trajectory deviation, action shaking을 동시에 키우는 multi-level objective를 SPSA로 최적화한다. 회전·크기·밝기 augmentation으로 시점과 조명 변화에 견디게 하며, 하나의 물체가 여러 task와 $\pi_0$/RDT에 통하는 universal attack이 되도록 모델-태스크 쌍을 번갈아 학습한다.

# VLA 관점에서 중요한 이유

VLA의 시각 backbone과 action generator를 분리해 평가하는 대신, 최종 task success와 궤적 자체가 물리적 시각 교란에 얼마나 민감한지 측정한다. Diffusion/flow 기반 iterative generation도 자연스러운 3D 물체 형태의 공격에 본질적 방어가 되지 않으며, wrist camera가 특히 큰 공격면이라는 결과는 실제 배치 시 sensor-level 방어가 필요함을 보여준다.

# Robot / Embodied Setting

- RoboTwin의 ALOHA dual-arm, 팔당 7-DoF, overhead 1대와 wrist 2대의 고정 카메라를 사용한다.
- 기본 조작부터 조립·양팔 협응까지 13개 task, Easy/Hard 장면, 모델-태스크당 10개 seed를 평가한다.
- 대상 VLA는 flow-matching $\pi_0$와 diffusion transformer RDT-1B다.
- 실제 ALOHA에서는 5개 task와 3D-printed sphere로 sim-to-real 공격 전이를 검증한다.

# Method

공격 loss는 clean 대비 end-effector trajectory deviation, task success 저하, action 변화량 증가, texture regularization을 결합한다. 비미분 VLA와 환경에도 적용하도록 SPSA가 iteration당 양·음 두 번의 rollout로 gradient를 추정한다. 구 표면 texture에는 회전, scale, cyclic shift, contrast, brightness 변환을 주고 여러 모델·task를 교대로 갱신한다.

# 핵심 그림

![다중 카메라에 보이는 adversarial sphere가 VLA action과 robot trajectory를 교란하는 공격 파이프라인](/papers/assets/vla/universal-adversarial-attacks-on-vla-models/overview.svg)

> 논문의 Figure 1과 Algorithm 1을 바탕으로 재구성했다. 구조 그림을 고른 이유는 작은 3D 물체, 다중 시점 관측, multi-level black-box 최적화가 어떻게 하나의 물리 공격으로 이어지는지 가장 직접적으로 설명하기 때문이다. 출처: [논문 Method 및 Algorithm 1](https://arxiv.org/html/2609.39178#S3).

# Experiments / Results

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓)                  | 공격 전 | 공격 후 |    차이 | 출처          |
| ------------------------------------------------- | ------: | ------: | ------: | ------------- |
| RoboTwin RDT Easy 13-task 평균, 성공률 (%, ↑)     |    57.1 |    25.7 | -31.4%p | 논문 Table I  |
| RoboTwin RDT Hard 13-task 평균, 성공률 (%, ↑)     |    33.5 |     2.1 | -31.4%p | 논문 Table I  |
| RoboTwin $\pi_0$ Easy 13-task 평균, 성공률 (%, ↑) |    75.1 |    36.4 | -38.7%p | 논문 Table I  |
| RoboTwin $\pi_0$ Hard 13-task 평균, 성공률 (%, ↑) |    35.4 |     1.9 | -33.5%p | 논문 Table I  |
| 실제 ALOHA RDT 5-task 평균, 성공률 (%, ↑)         |    43.2 |    17.6 | -25.6%p | 논문 Table IV |
| 실제 ALOHA $\pi_0$ 5-task 평균, 성공률 (%, ↑)     |    60.2 |    28.4 | -31.8%p | 논문 Table IV |

원문 Table I의 표기된 $\Delta$SR 평균은 각각 32.3, 31.2, 39.9, 33.8%p인데, 표의 반올림된 clean/attack 평균을 직접 빼면 위 표처럼 31.4, 31.4, 38.7, 33.5%p가 된다. 따라서 원 논문의 task별 차이 평균과 집계 평균의 차이를 혼동하지 않아야 한다. 실제 ALOHA에서는 공격 효과의 81.4%(RDT), 82.2%($\pi_0$)가 시뮬레이션 대비 유지됐다.

# Limitations / Discussion

공격 patch 하나를 모델-태스크 쌍마다 500 iteration, A100 80GB에서 약 일주일 최적화해 비용이 높다. 공격 구가 카메라에 보여야 하며, 선택한 13개 RoboTwin task와 두 모델이 모든 VLA를 대표하지 않는다. 방어 baseline이나 탐지율·오탐률은 제시하지 않아 보안 위협의 존재는 보여도 대응 효과까지 검증하지는 않는다.

# 내가 이해한 핵심

성능 benchmark가 높은 VLA도 물체처럼 자연스럽게 장면에 들어온 공통 교란에 쉽게 무너질 수 있다. 특히 task success만 보면 놓치는 궤적 왜곡을 함께 최적화·측정한 점이 좋고, wrist view 의존성이 실제 공격면으로 드러난다.

# 다음에 연결해서 읽을 논문

- SafeVLA-Bench: 성공과 안전 위반을 분리해 측정하는 평가 관점
- RDT-1B: diffusion action generator의 구조와 시각 conditioning을 이해하기 위해
- $\pi_0$: flow-matching VLA가 관측을 action chunk로 바꾸는 경로를 이해하기 위해
