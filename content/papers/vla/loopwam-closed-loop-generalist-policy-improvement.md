---
title: "LoopWAM: Closed-Loop Generalist Policy Improvement from Deployment Rollouts"
date: 2026-10-14
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Wenxuan Guo et al."
paper: "https://arxiv.org/abs/2610.18873"
code: ""
project: "https://loop-wam.github.io/"
thumbnail: "/papers/assets/vla/loopwam-closed-loop-generalist-policy-improvement/overview.svg"
---

# 한 줄 요약

LoopWAM은 성공·불완전·실패 rollout을 모두 세계 예측에 쓰되 행동 모방 강도는 품질에 따라 조절해, 배포 경험으로 범용 로봇 정책을 반복 개선하는 world-action model이다.

# 논문 정보

- 제목: LoopWAM: Closed-Loop Generalist Policy Improvement from Deployment Rollouts
- 저자: Wenxuan Guo, Yingping Liang, Zhaoguo Wang, Ziyuan Li, Angyuan Ma 외
- 발표: arXiv:2610.18873v1 (2026-10-13), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.18873) · [HTML 원문](https://arxiv.org/html/2610.18873)
- 코드/프로젝트: [공식 프로젝트](https://loop-wam.github.io/) · 코드 공개 여부 미확인
- 키워드: world-action model, deployment rollout, mixed-quality data, flow matching, closed-loop improvement

# 핵심 아이디어

배포 rollout은 실패까지 포함하므로 전부 행동 정답으로 모방하면 정책이 나빠지고, 성공만 남기면 실패가 보여 준 물리적 결과를 버리게 된다. LoopWAM은 video와 action을 병렬 denoising하는 하나의 모델 안에서 이 긴장을 분리한다. 모든 품질의 궤적은 future-video loss를 제공하고, action loss는 품질 점수 $q$에 따른 $\lambda(q)$로 가중한다. 실패 action은 직접 모방하지 않지만 그 결과 영상은 계속 세계 모델을 학습시킨다.

# VLA 관점에서 중요한 이유

이 논문은 VLA의 self-improvement를 성공 trajectory 선별이나 별도 world-model evaluator 없이 단일 joint model의 학습 규칙으로 만든다. 특히 다른 정책이 만든 낮은 품질 rollout도 물리 결과 학습에 사용할 수 있어, 여러 배포 정책의 경험을 한 generalist로 환류하는 데이터 flywheel을 제시한다.

# Robot / Embodied Setting

- 실제: RoboChallenge Table30-V2의 30개 tabletop task, ALOHA·DOS-W1·ARX5·UR5 네 embodiment.
- 시뮬레이션: RoboTwin 2.0 50개 bimanual task, RoboCasa365 50개 task.
- 단일-task 실제 검증: deformable shirt folding.
- 입출력: 현재 RGB 관측, robot state, 언어, 품질 조건을 받아 64-step action chunk와 8개 future frame latent를 공동 생성.
- 데이터: expert demonstration과 LoopWAM·X-VLA·$\pi_{0.5}$ 등 여러 정책의 성공·불완전·실패 rollout.

# Method

1. Wan2.2-TI2V-5B 기반 video stream과 1024-hidden action DiT를 Mixture-of-Transformer로 결합한다.
2. expert segment는 video noise를 높여 expert future 복원과 action 생성을 학습하고, rollout segment는 action noise를 낮춰 기록된 action의 시각적 결과를 강하게 학습한다.
3. instruction 뒤에 수치 품질 점수 $q$를 붙여 behavior mode를 표현하고, 배포 시 expert score $q^\star$로 steering한다.
4. video loss는 모든 rollout에 유지하되 action loss는 $\lambda(q)$로 가중하고 실패에는 0을 준다.
5. 배포→rollout 수집·평가→누적 재학습→재배포를 반복한다.

# 핵심 그림

![전문가와 혼합 품질 rollout이 video-action 병렬 denoising, 품질 steering, 가중 action supervision을 거쳐 다시 배포되는 LoopWAM 구조](/papers/assets/vla/loopwam-closed-loop-generalist-policy-improvement/overview.svg)

> 논문 Figure 2를 바탕으로 재구성. 출처: [arXiv HTML, Figure 2](https://arxiv.org/html/2610.18873). 모듈과 학습·배포 흐름을 한국어로 단순화했다.

구조 그림을 고른 이유는 핵심이 특정 backbone보다 혼합 품질 데이터를 joint WAM에 주입하는 방식과 반복 배포 루프에 있기 때문이다. 학습에서는 expert/rollout별 noise schedule과 품질 가중 손실이 video·action stream을 함께 갱신한다. 추론에서는 $q^\star$로 video와 action을 공동 denoise하고 action marginal을 실행하며, 새 rollout이 다음 학습 라운드의 입력이 된다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)  | LoopWAM |                비교 기준 |     차이 | 출처               |
| ------------------------------- | ------: | -----------------------: | -------: | ------------------ |
| Table30-V2 전체, 3회 개선 후    |   43.33 |     expert-trained 23.67 | +19.66%p | 원문 Table 1, §4.3 |
| RoboTwin 2.0 평균               |    94.5 |      LingBot-VA 2.0 93.6 |   +0.9%p | 원문 Table 2, §1   |
| RoboCasa365 전체                |    49.5 |           ABot-M0.6 46.6 |   +2.9%p | 원문 Table 3, §1   |
| 실제 shirt folding, 2회 개선 후 |   55.56 | post-training 직후 13.20 | +42.36%p | 원문 §4.4          |

Table30-V2는 같은 LoopWAM의 배포·재학습 라운드를 비교하므로 19.66%p 상승이 closed-loop 개선을 직접 보여 준다. 반면 RoboTwin/RoboCasa 수치는 서로 다른 사전학습·데이터 조건의 공개 baseline 비교이므로 작은 격차를 절대적 우위로 과대해석하면 안 된다.

# Limitations / Discussion

- rollout 품질 점수는 사람 또는 VLM annotation이 필요하며 coarse score는 한 checkpoint의 다양한 실패 양상을 뭉갤 수 있다.
- 대형 video backbone과 joint denoising은 계산·지연 비용이 크며 논문 표의 성공률만으로 실시간성을 판단하기 어렵다.
- self-improvement가 세 라운드 이후에도 안정적으로 지속되는지, catastrophic forgetting이나 품질 오판에 얼마나 강한지는 미검증이다.
- 실패 action의 직접 loss를 0으로 해도 joint attention을 통한 간접 영향은 남는다.
- 공식 conference venue와 코드 공개 상태는 확인되지 않았다.

# 내가 이해한 핵심

실패 rollout을 버릴지 모방할지의 이분법을 깨고, 행동은 덜 믿되 관측된 물리 결과는 끝까지 학습하는 것이 핵심이다.

# 다음에 연결해서 읽을 논문

- $\pi_{0.6}$ / $\pi_{0.7}$: mixed-quality steering과 advantage·metadata conditioning의 차이를 비교할 수 있다.
- FACT: shared world/action model에서 consequence signal이 action에 전달되는 방식을 비교하기 좋다.
- FIND: 실제 배포 rollout으로 VLA를 개선하는 RL 기반 접근과 대조할 수 있다.
