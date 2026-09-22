---
title: "SmoLSTM: A Compact Vision-Language-Action Model with Recurrent Memory that Persists"
date: 2026-09-22
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Memory"
  - "Recurrent Policy"
venue: "확인 필요"
authors: "Jan-Gerrit Habekost, Parsa Mastouri Kashani, Connor Gäde, Matthias Kerzel, Philipp Allgeuer, Cornelius Weber, Stefan Wermter, Jae Hee Lee"
paper: "https://arxiv.org/abs/2609.22854"
code: ""
project: ""
---

# 한 줄 요약

SmoLSTM은 frozen 256M SmolVLM과 episode 전체에서 reset하지 않는 matrix-memory LSTM을 결합해, 시간에 따라 커지지 않는 recurrent state로 장기 기억이 필요한 manipulation을 수행한다.

# 논문 정보

- 제목: SmoLSTM: A Compact Vision-Language-Action Model with Recurrent Memory that Persists
- 저자: Jan-Gerrit Habekost, Parsa Mastouri Kashani, Connor Gäde, Matthias Kerzel, Philipp Allgeuer, Cornelius Weber, Stefan Wermter, Jae Hee Lee
- 발표: 확인 필요 (ICRA 2027 제출, arXiv v1 2026-09-19)
- 링크: [arXiv](https://arxiv.org/abs/2609.22854), [HTML](https://arxiv.org/html/2609.22854v1)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: recurrent memory, matrix LSTM, compact VLA, LIBERO-Mem, flow matching

# 핵심 아이디어

여러 물체가 시각적으로 같거나 이전에 넣은 basket이 다시 가려지는 과업은 현재 frame만으로 다음 행동을 정할 수 없다. 긴 observation window나 external retrieval memory는 episode 길이에 따라 비용이나 설계 복잡도가 늘어난다. SmoLSTM은 observation token과 action query를 하나의 causal recurrent stream에 넣고 hidden state를 episode 끝까지 유지한다.

Matrix-memory LSTM은 key-value outer product를 누적하는 고정 크기 상태를 사용하므로 저장 비용이 episode 길이에 대해 $O(1)$이다. Frozen VLM에서 얻은 third-person semantic feature에 wrist RGB, monocular depth, DINOv2 feature, proprioception을 결합하고 flow-matching head가 10-step action chunk를 생성한다.

# VLA 관점에서 중요한 이유

VLA의 memory 문제를 거대한 context window나 별도 memory bank 없이 policy core 자체의 state dynamics로 다룬다. 이는 긴 과업에서 latency와 memory usage를 예측 가능하게 유지하면서, action history와 observation history가 같은 recurrent state에 자연스럽게 축적되도록 한다.

또한 0.32B 전체 모델 중 0.04B만 학습해 compact deployment 가능성을 보여준다. 거대한 VLM을 계속 키우지 않고 작은 frozen perception backbone과 stateful controller를 조합하는 설계다.

# Robot / Embodied Setting

- 환경: LIBERO-Mem 10 tasks, standard LIBERO 40 tasks
- 입력: third-person RGB, wrist RGB, estimated monocular depth, DINOv2 feature, proprioception, language instruction
- 학습: LIBERO-90/Spatial/Object/Goal/Long/Mem의 140 tasks, 7,461 demonstrations
- 출력: 10-step end-effector pose delta와 gripper action chunk
- 평가: LIBERO-Mem task별 20 trials, standard LIBERO task별 50 rollouts; held-out initial states

# Method

SmolVLM 256M backbone은 freeze하고 language-conditioned $8\times8$ spatial grid와 instruction embedding을 추출한다. Wrist와 depth는 각각 ResNet-18로, DINOv2 side stream은 frozen DINOv2-S로, proprioception은 MLP로 encode한다.

총 217 observation token 뒤에 10개의 learned action query를 붙여 6-block, width 512의 mLSTM stack에 반복적으로 흘린다. 이 state는 control step 사이에서 reset되지 않는다. Action query 출력은 regression 또는 conditional flow-matching head로 decode하며, 최종 모델은 flow variant를 사용한다.

# Experiments / Results

LIBERO-Mem에서 flow 모델은 subgoal coverage 85.1%, full-task success 77.5%로 2AM의 76.29%/63.0%와 MemoryVAM의 full-task 42.5%를 넘었다. Recurrent state를 매 control step마다 지우면 coverage 10.5%, success 7.0%로 급락해 정책이 실제로 episode context를 사용함을 보였다.

Standard LIBERO 평균은 79.6%였다. 이는 비슷한 compact SmolVLA-0.24B보다 3.2%p 낮고 SmolVLA-0.45B보다 7.7%p 낮지만, LIBERO-Long에서는 각각 6.4%p 높고 1.6%p 낮았다. Wrist camera를 제거하면 LIBERO-Mem success가 77.5%에서 12.0%로 떨어졌다.

# Limitations / Discussion

Memory reset ablation은 이미 memory를 쓰도록 학습된 checkpoint를 평가한 것이므로, 별도로 학습한 memoryless policy와의 공정한 비교는 아니다. LIBERO-Mem의 repetition task는 목표 횟수에서 환경이 즉시 종료되어 정책이 정확히 세고 멈추는지를 분리해 측정하기 어렵다.

Object rotation 계열 성공률은 8%로 낮고, wrist camera 제거 시 성능이 크게 붕괴해 sensor configuration 의존성이 강하다. 실제 로봇 평가가 없으며, 여러 비교 방법은 pretraining 범위, 관찰 modality, rollout 수가 달라 leaderboard 차이를 직접적인 architecture 우위로 해석하기 어렵다.

# 내가 이해한 핵심

이 논문은 기억을 "검색할 과거 frame의 집합"으로 보지 않고, observation과 action이 계속 갱신하는 controller state로 본다. Episode가 길어져도 state 크기는 같지만, 무엇을 얼마나 오래 보존하는지는 mLSTM의 학습된 update가 결정한다.

# 다음에 연결해서 읽을 논문

- MemoryVLA: external memory bank를 사용하는 VLA
- 2AM: LIBERO-Mem의 associative memory baseline
- SmolVLA: SmoLSTM이 사용하는 compact VLM/VLA 계열
- xLSTM / matrix LSTM: recurrent matrix memory의 기반 구조
