---
title: "Modality-Autoregressive World-Action Models"
date: 2026-09-16
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "World Model"
  - "Bimanual Manipulation"
venue: "확인 필요"
authors: "Adam Hung, Bardienus P. Duisterhof, Deva Ramanan, Jeffrey Ichnowski"
paper: "https://arxiv.org/abs/2609.17524"
code: ""
project: "https://adamhung60.github.io/ModAR/"
---

# 한 줄 요약

ModAR는 미래 RGB 전체를 먼저 만들 필요 없이 point track, DINO feature, depth를 차례로 예측하고 마지막에 행동을 생성해, 적은 계산과 action 없는 사람 영상으로도 강한 world-action policy를 학습한다.

# 논문 정보

- 제목: Modality-Autoregressive World-Action Models
- 저자: Adam Hung, Bardienus P. Duisterhof, Deva Ramanan, Jeffrey Ichnowski
- 발표: 확인 필요 (arXiv v1, 2026-09-15)
- 링크: [arXiv](https://arxiv.org/abs/2609.17524)
- 코드/프로젝트: [프로젝트 페이지](https://adamhung60.github.io/ModAR/), 코드는 공개 예정
- 키워드: world-action model, autoregressive modality, flow matching, point tracks, DINO, depth, bimanual manipulation

# 핵심 아이디어

기존 world-action model은 미래 RGB와 action을 동시에 만들거나 독립적으로 예측한다. ModAR는 미래 modality 사이에도 유용한 조건부 구조가 있다고 보고, point track → DINO feature → depth → RGB → action 순으로 각 modality를 autoregressive하게 denoise한다. 앞서 생성한 motion·semantic·geometry 표현이 다음 예측과 최종 행동의 조건이 된다.

모든 modality는 shared diffusion transformer를 통과하되 modality-specific expert와 output head를 사용한다. 현재 RGB·DINO·depth, robot configuration, task embedding을 조건으로 삼고, action label이 없는 영상은 미래 관찰 예측에만 사용한다.

# VLA 관점에서 중요한 이유

이 연구는 world model의 가치가 고해상도 RGB 생성 품질 자체가 아니라 행동에 필요한 구조를 압축해 제공하는 데 있음을 보여준다. 특히 motion을 담는 track, semantics를 담는 DINO feature, geometry를 담는 depth는 도움이 됐지만 미래 RGB를 추가하는 효과는 일관되지 않았다.

따라서 VLA가 action 없는 human video를 활용할 때도 픽셀 재현보다 제어에 직접 연결되는 modality를 선택하고, 정보가 축적되는 순서까지 설계해야 한다는 근거가 된다.

# Robot / Embodied Setting

- 시뮬레이션: RoboTwin 6개 task, task당 action-labeled robot demonstration 50개
- 실제 로봇: 양팔 조작 3개 task(컵 쌓기, 수건 접기, 서랍에 넣기)
- 추가 데이터: in-domain action 없는 human demonstration 200개와 EgoDex OOD human demonstration 1,000개
- 입력: 현재 RGB, DINO feature, depth, robot configuration, task embedding
- 출력: 미래 point track·DINO·depth·RGB와 robot action

# Method

shared DiT 안에 cross-modality block과 modality별 expert/head를 두고, flow-matching 방식으로 각 미래 modality를 순차 생성한다. 학습 중에는 이전 단계 생성물에 noise를 넣어 추론 시 누적 오차에 견디게 한다. action 없는 영상은 action loss 없이 미래 modality supervision으로 사용한다.

Ablation에서는 compact하고 구조화된 표현부터 생성하는 순서가 중요했다. 반대 순서인 RGB → depth → DINO → track은 성능이 낮았고, track·DINO·depth 중 하나를 제거한 손실이 RGB 제거보다 컸다.

# Experiments / Results

RoboTwin에서 ModAR는 모든 데이터 규모에서 비교한 WAM formulation 중 가장 높은 평균 성공률을 보였다. video model로 초기화한 6B Flex-$\pi$와 같은 데이터로 비교했을 때 75% 대 72%였고, ModAR는 30.1M parameter로 약 200배 작고 training FLOPs도 약 20배 적었다.

실제 양팔 task 3개에서도 모든 task에서 비교 방법보다 높은 성공률을 기록했다. robot demonstration만 썼을 때 평균 70.0%였고, in-domain human video를 더하면 81.1%, EgoDex까지 더하면 83.3%로 상승했다.

# Limitations / Discussion

실제 실험은 3개 양팔 task와 제한된 demonstration 규모에 집중되어 있다. 긴 horizon, mobile manipulation, 다른 embodiment에서도 modality 순서와 human-video 이득이 유지되는지는 확인이 필요하다.

순차 생성은 modality 사이의 조건화를 강화하지만 병렬 예측보다 latency가 늘 수 있다. 논문은 학습 효율을 강하게 보여주지만 실제 control frequency와 edge hardware 지연은 별도 평가가 필요하다. 또한 생성된 중간 modality의 오차가 뒤 단계와 action으로 전파될 위험이 있다.

# 내가 이해한 핵심

좋은 world-action model은 영상을 예쁘게 생성하는 모델이 아니라, 행동 결정에 필요한 미래 정보를 가장 경제적인 표현과 순서로 전달하는 모델이다. ModAR는 motion, semantics, geometry를 단계적으로 쌓은 뒤 행동하게 함으로써 이 관점을 명확히 만든다.

# 다음에 연결해서 읽을 논문

- Flex-$\pi$: video-pretrained WAM과 ModAR의 계산·데이터 효율 비교
- DreamZero / Cosmos Policy: RGB 중심 unified world-action modeling과 비교
- Fast-WAM: 미래 예측과 action generation을 분리하는 대안
- EgoDex: action 없는 human video가 제공하는 manipulation prior 이해
