---
title: "VLA-Stem: A Lightweight Safety Mechanism for Vision-Language-Action Models via Reinforcement Learning"
date: 2026-10-28
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Bojun Zou et al."
paper: "https://arxiv.org/abs/2610.37378"
thumbnail: "/papers/assets/vla/vla-stem-lightweight-safety-mechanism/overview.svg"
---

# 한 줄 요약

Frozen VLA chunk를 motion reference로 바꾸고 작은 RL policy가 obstacle을 고려한 안전 action으로 수정하는 brainstem형 layer다.

# 논문 정보

- 제목: VLA-Stem
- 저자: Bojun Zou 외 8명
- 발표: 확인 필요 (arXiv v1, 2026-10-27)
- 링크: [arXiv](https://arxiv.org/abs/2610.37378) · [HTML](https://arxiv.org/html/2610.37378)
- 코드/프로젝트: 확인되지 않음
- 키워드: VLA safety, obstacle avoidance, PPO

# 핵심 아이디어

Chunk를 SE(3) trajectory로 바꾸고 Stem이 pose·obstacle·reference를 읽는다. 고정 waypoint 대신 forward segments와 거리를 줄여 대기·우회를 허용한다.

# VLA 관점에서 중요한 이유

VLA를 frozen brain, safety policy를 brainstem으로 분리해 avoidance fine-tuning이 manipulation을 훼손하는 문제를 줄인다.

# Robot / Embodied Setting

ManiSkill PickCube·StackCube·Object Stowing의 normal/static/dynamic 설정과 real robot stowing/stacking을 평가한다.

# Method

Trajectory reward는 forward segment의 position·rotation deviation을 벌점화한다. privileged teacher를 PPO로 학습하고 student로 distill하며 reference→static→dynamic curriculum을 쓴다.

# 핵심 그림

![VLA-Stem 구조](/papers/assets/vla/vla-stem-lightweight-safety-mechanism/overview.svg)

> 그림 2. Figure 2와 Eq. (1)–(7)을 바탕으로 재구성. 출처: [원문](https://arxiv.org/html/2610.37378#S3).
> 구조 그림은 VLA reference와 student Stem의 분리를 보여준다. 추론에는 teacher 없이 student가 action을 수정하고 VLA가 다음 interval에 replan한다.

# Experiments / Results

## 주요 실험 결과

| 지표 (%, ↑/↓)                    |  제안 |                 비교 |     차이 | 출처             |
| -------------------------------- | ----: | -------------------: | -------: | ---------------- |
| 6 constrained settings success ↑ |  52.8 | safety baseline 23.7 |  +29.1%p | Abstract/Table I |
| PickCube Static SUCC ↑           | 52.19 |        VLSA-EE 16.19 | +36.00%p | Table I          |
| Stowing Dynamic SUCC ↑           | 59.50 |   VLA-finetune 47.84 | +11.66%p | Table I          |
| StackCube Dynamic COLL ↓         |  7.84 |        VLSA-EE 22.44 | -14.60%p | Table I          |

동일 task·setting 값을 %로 환산했다.

# Limitations / Discussion

obstacle geometry를 제공받아 perception error를 포함한 safety와 formal guarantee는 검증하지 않았다.

# 내가 이해한 핵심

Correction을 timestep이 아니라 **chunk의 공간 경로 의도**에 묶는다.

# 다음에 연결해서 읽을 논문

VLA-Feedback, R2A, VLSA.
