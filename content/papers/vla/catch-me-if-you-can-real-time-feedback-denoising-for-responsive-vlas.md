---
title: "Catch Me If You Can: Real-Time Feedback Denoising for Responsive VLAs"
date: 2026-09-21
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Diffusion Policy"
  - "Closed-Loop Control"
venue: "CoRL 2026"
authors: "Yiheng Ji, Xingru Zhou, Luis Sentis, Mingyo Seo"
paper: "https://arxiv.org/abs/2609.21022"
code: ""
project: "https://vla-feedback.github.io/"
---

# 한 줄 요약

VLA-Feedback은 diffusion VLA가 만든 action chunk의 마지막 denoising 단계만 실행 시점의 최신 영상으로 다시 계산해, 느린 전체 모델을 재호출하지 않고도 움직이는 물체에 고주파로 반응한다.

# 논문 정보

- 제목: Catch Me If You Can: Real-Time Feedback Denoising for Responsive VLAs
- 저자: Yiheng Ji, Xingru Zhou, Luis Sentis, Mingyo Seo
- 발표: CoRL 2026 (arXiv v1, 2026-09-17)
- 링크: [arXiv](https://arxiv.org/abs/2609.21022), [HTML](https://arxiv.org/html/2609.21022v1)
- 코드/프로젝트: [프로젝트 페이지](https://vla-feedback.github.io/), 코드 공개 여부 확인 필요
- 키워드: VLA, diffusion policy, action chunking, visual feedback, dynamic manipulation

# 핵심 아이디어

기존 action-chunking VLA는 한 번 생성한 여러 행동을 open-loop로 실행하므로, 실행 중 물체가 움직이면 계획이 낡는다. VLA-Feedback은 GR00T 기반 VLM-DiT planner가 마지막 단계 직전의 action chunk와 action feature를 만들게 하고, 작은 feedback module이 매 제어 주기 최신 영상을 받아 해당 시점 행동의 마지막 denoising velocity만 갱신한다.

따라서 느린 planner는 chunk당 한 번, feedback module은 행동마다 한 번 실행된다. 최종 action에 사후 residual을 더하는 대신 생성 과정 내부의 denoising 방향을 수정하므로 planner가 학습한 action prior를 유지하는 것이 핵심이다.

# VLA 관점에서 중요한 이유

VLA의 계산량을 줄이기 위한 action chunking은 지연 시간을 낮추지만 폐루프 반응성을 희생한다. 이 논문은 전체 VLA 재추론 없이 생성 모델의 중간 상태를 빠른 feedback interface로 재사용해, 표현력과 반응성 사이의 절충을 완화한다.

특히 정적 benchmark 성능만으로는 드러나지 않는 stale action 문제를 움직이는 목표물로 분리해 평가했다. VLA 배포에서 inference throughput과 실제 reaction latency를 구분해야 한다는 점도 분명히 보여준다.

# Robot / Embodied Setting

- 기반 정책: NVIDIA GR00T VLM-DiT diffusion planner
- 시뮬레이션: LIBERO-Goal/Object 정적 과업, Robosuite 동적 과업과 미관측 동적 변형
- 실제 로봇: Franka Emika Panda
- 실제 과업: 정지한 빵 집기, 굴러가는 캔 잡기, 움직이는 컵에 레모네이드 넣기
- 데이터/평가: 실제 과업별 50 demonstrations와 20 rollouts, feedback/control 10 Hz, 16-action chunk

# Method

Planner는 action chunk의 마지막 denoising 직전 궤적을 생성하고 action-side feature를 캐시한다. 실행 시 feedback module은 경량 visual encoder로 최신 hand-view를 처리한 뒤, cached action feature와 cross-attention으로 융합한다. 학습 가능한 visual residual scale로 원래 action embedding에서 벗어나는 정도를 제한하고 최종 denoising velocity를 예측한다.

학습은 두 단계다. 먼저 표준 flow-matching loss로 planner를 학습한 뒤 이를 고정하고, ground-truth action에 대한 회귀로 feedback component만 학습한다. 실험의 호출 비율은 planner:feedback:action = 1:16:16이다.

# Experiments / Results

정적 LIBERO에서는 GR00T와 거의 같은 성능을 유지했다(Goal 92% 대 92%, Object 95.5% 대 97.5%). 반면 세 동적 시뮬레이션 과업 평균은 GR00T 27.5%에서 85.0%로 상승했고, 실제 로봇 세 과업 평균은 51%에서 73%로 올랐다.

Feedback inference 자체는 약 1.95 ms였고 예상 reaction latency는 $2\text{ ms}+\frac{1}{2}\Delta t$로 비교군 중 가장 짧았다. 다만 실제 hardware의 end-to-end feedback path는 카메라 노출·전송을 포함해 71.01 ms였다. 시각 입력 제거, feedback 빈도 감소, final action residual 방식은 특히 동적 과업 성능을 크게 낮췄다.

# Limitations / Discussion

Feedback은 좋은 초기 chunk 주변의 국소 수정이므로 planner가 처음부터 잘못된 해를 내거나 접촉 직전 목표가 급격히 움직이면 한 번의 denoising으로 복구하기 어렵다. 가림, 관측 잡음, actuator delay도 작은 correction을 훼손할 수 있다.

실제 평가는 하나의 Panda와 세 과업, 과업별 20회에 한정된다. Feedback module의 계산은 2 ms 수준이지만 실제 latency는 센싱 경로가 지배하므로, 다른 카메라·로봇 stack에서도 같은 반응성이 유지되는지 확인이 필요하다.

# 내가 이해한 핵심

완성된 action을 고치는 것이 아니라 diffusion이 행동을 완성하는 마지막 순간에 최신 관측을 끼워 넣는다. 그래서 느린 의미 계획을 유지하면서도 chunk 내부를 폐루프로 바꾼다.

# 다음에 연결해서 읽을 논문

- GR00T N1: 기반 VLM-DiT VLA와 action generation 구조
- Real-Time Execution of Action Chunking Flow Policies: 비동기 action chunk 실행
- Fast-in-Slow VLA: slow reasoning과 fast control을 분리하는 dual-system 설계
- GeoAAC: denoising trajectory를 이용한 adaptive action chunking
