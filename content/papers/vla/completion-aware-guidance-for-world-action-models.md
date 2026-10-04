---
title: "Completion Aware Guidance for World Action Models"
date: 2026-10-04
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Seungyeon Kim, Junhoo Lee, Baekseung Kim, Minkyu Kim, Nojun Kwak"
paper: "https://arxiv.org/abs/2610.01559"
code: ""
project: ""
thumbnail: "/papers/assets/vla/completion-aware-guidance-for-world-action-models/overview.svg"
---

# 한 줄 요약

Completion Aware Guidance(CAG)는 WAM이 짧은 chunk마다 그럴듯한 동작만 반복하고 완료 전이를 미루는 실패를, 현재 cross-attention이 의존하는 instruction token을 sampling 중 강화해 재학습 없이 줄인다.

# 논문 정보

- 제목: Completion Aware Guidance for World Action Models
- 저자: Seungyeon Kim, Junhoo Lee, Baekseung Kim, Minkyu Kim, Nojun Kwak
- 발표: arXiv:2610.01559v1 (2026-10-01), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.01559)
- 코드/프로젝트: 논문 메타데이터에서 공식 코드 및 프로젝트 페이지를 확인하지 못했다.
- 키워드: world-action model, task-incomplete imagination, inference-time guidance, cross-attention, video diffusion

# 핵심 아이디어

원래 video diffusion backbone은 긴 horizon에서 완료 장면을 만들 수 있어도, WAM으로 바꾸어 짧은 video-action chunk를 반복 생성하면 현재 phase의 핵심 전이를 계속 다음 chunk로 미룰 수 있다. 저자들은 영상과 행동이 서로 일관되고 국소적으로도 자연스럽지만, 물체를 놓는 것 같은 완료 전이가 빠지는 현상을 task-incomplete imagination이라 부른다.

CAG는 현재 video-action query가 instruction token에 보내는 cross-attention affinity를 여러 denoising layer에서 집계한다. 점수가 높은 token의 key/value를 $1+\alpha$만큼 키우는 sparse gate를 적용해, 모델이 이미 사용 중인 지시 성분을 더 강하게 조건화한다. 별도 completion classifier, reward model, task별 tuning, WAM 재학습은 필요하지 않으며 논문은 $\alpha=0.15$를 두 backbone에 공통 적용한다.

# VLA 관점에서 중요한 이유

WAM의 미래 영상이 그럴듯하다고 task progress가 보장되지는 않는다. 이 논문은 그 간극을 backbone의 세계 지식 부족이 아니라 “긴 video objective를 짧은 closed-loop chunk로 바꿀 때 생기는 elicitation 문제”로 분리한다. 이는 더 큰 world model이나 별도 high-level planner 없이도 inference-time conditioning만으로 실행 완료율을 높일 수 있음을 보여준다.

# Robot / Embodied Setting

- DreamZero DROID simulation: 공식 3개 scene, task당 50 rollouts, zero-shot 평가.
- RoboTwin 2.0: Fast-WAM Random setting 공개 성공률이 90% 미만인 9개 non-saturated task, task당 30 rollouts.
- Backbone: explicit future generation의 DreamZero와 implicit world modeling의 Fast-WAM.
- Intervention: inference-time cross-attention key/value scaling만 변경하며 action/video target이나 model weight는 바꾸지 않는다.

# Method

1. WAM은 observation history, proprioception, instruction으로 짧은 video-action chunk를 생성한다.
2. 선택한 denoising layer에서 video-action query와 instruction key 사이의 attention affinity를 token별로 평균한다.
3. Sparse gate가 현재 생성에서 중요도가 높은 instruction token을 선택한다.
4. 선택 token의 cross-attention key/value를 $\widehat{\gamma}_{t,j}=1+\alpha\psi(r_{t,j})$로 증폭한다.
5. 강화된 조건으로 같은 WAM sampling을 계속해 현재 phase에 필요한 완료 전이를 chunk 안으로 끌어온다.

# 핵심 그림

![짧은 WAM chunk가 완료 전이를 미루는 현상과 cross-attention 기반 CAG가 관련 instruction token을 강화해 완료 전이를 유도하는 흐름](/papers/assets/vla/completion-aware-guidance-for-world-action-models/overview.svg)

> 논문 Figure 1, Figure 2(a), Equation 4–8을 바탕으로 재구성했다. 구조 그림을 고른 이유는 failure definition과 token-level sampling intervention의 연결이 이 방법의 전부이며, 별도 학습 module이 없다는 점을 명확히 보여주기 때문이다. 출처: [논문 Method와 Figure 2](https://arxiv.org/html/2610.01559#S3).

왼쪽은 긴 video horizon에서는 나타나던 release/placement 같은 완료 전이가 짧은 WAM chunk에서는 반복적으로 미뤄지는 현상이다. 오른쪽 CAG는 현재 query가 집중한 instruction token을 관찰해 해당 key/value만 강화하고, 같은 generator가 다음 video-action chunk에서 phase-completing transition을 선택하도록 편향한다. 학습 흐름은 없고 추론 경로에만 개입한다.

# Experiments / Results

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓)                           | 제안 방법 |           비교 기준 |    차이 | 출처             |
| ---------------------------------------------------------- | --------: | ------------------: | ------: | ---------------- |
| RoboTwin 2.0 9-task 평균 성공률 (%, ↑)                     |      70.0 |     Fast-WAM 64.4   |  +5.6%p | 논문 Table 1     |
| DreamZero 3-task zero-shot 평균 성공률 (%, ↑)              |      75.0 |     DreamZero 69.0  |  +6.0%p | 논문 Figure 2(b) |
| DreamZero 실패 중 task-incomplete imagination 비율 (%, ↓) |      40.0 |     DreamZero 79.0  | -39.0%p | 논문 Figure 2(c) |
| RoboTwin Stack Bowls Three 성공률 (%, ↑)                   |      87.0 |     Fast-WAM 67.0   | +20.0%p | 논문 Table 1     |

RoboTwin 평균은 의도적으로 90% 미만인 9개 non-saturated task만 고른 subset 결과이며 전체 50-task 평균으로 일반화하면 안 된다. CAG는 9개 중 7개에서 향상하지만 Open Microwave(33%→30%)와 Place Can Basket(63%→53%)에서는 하락한다. DreamZero는 세 task 모두 향상했다.

# Limitations / Discussion

CAG는 sampling-time intervention에 한정되며 저자도 training objective로의 확장을 향후 과제로 남긴다. Attention affinity가 실제 causal importance를 완전히 나타낸다는 보장은 없고, 이미 잘못된 instruction component에 집중한 경우 이를 더 강화할 수 있다. RoboTwin 결과는 어려운 9-task subset이라 전체 benchmark 대표성이 제한되며 두 task에서는 성능이 감소했다. 실제 로봇, 장기 multi-stage task, 다른 WAM/VLA backbone에서의 검증도 없다.

# 내가 이해한 핵심

이 논문의 핵심은 WAM이 “완료를 모르는 것”과 “완료를 지금 생성하지 않는 것”을 구분한 데 있다. CAG는 후자에 대한 작은 decoding intervention이며, 영상–행동 일관성만으로는 측정되지 않는 task progress를 instruction attention을 통해 끌어낸다.

# 다음에 연결해서 읽을 논문

- DreamZero: explicit future-video generation을 사용하는 기준 WAM과 zero-shot protocol을 이해하기 위해
- Fast-WAM: 미래를 decode하지 않는 WAM에서도 CAG가 동작하는 이유를 비교하기 위해
- Divide-and-Remember: 장기 task에서 progress를 memory 구조로 다루는 접근과 inference guidance를 비교하기 위해
