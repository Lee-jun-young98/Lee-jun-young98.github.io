---
title: "Failing Forward: Adaptive Failure-Informed Learning for Vision-Language-Action Models"
date: 2026-10-15
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "NeurIPS 2026"
authors: "Meng Zheng et al."
paper: "https://arxiv.org/abs/2605.08434"
code: ""
project: ""
thumbnail: "/papers/assets/vla/failing-forward-adaptive-failure-informed-learning-for-vlas/overview.svg"
---

# 한 줄 요약

AFIL은 성공 행동과 실패 행동을 두 action generator로 따로 학습하고, 매 denoising step에서 둘의 불일치를 이용해 실패 분포에서 멀어지도록 VLA의 행동 샘플을 적응적으로 유도한다.

# 논문 정보

- 제목: Failing Forward: Adaptive Failure-Informed Learning for Vision-Language-Action Models
- 저자: Meng Zheng, Samhita Marri, Anwesa Choudhuri, Benjamin Planche, Zhongpai Gao, Van Nguyen Nguyen, Terrence Chen, Girish Chowdhary, Ziyan Wu
- 발표: NeurIPS 2026, arXiv:2605.08434v3 (2026-10-13 교체본)
- 링크: [arXiv](https://arxiv.org/abs/2605.08434) · [HTML 원문](https://arxiv.org/html/2605.08434)
- 코드/프로젝트: 공식 공개 링크 확인되지 않음
- 키워드: failure-informed learning, VLA, dual action generator, negative guidance, diffusion policy, flow matching

# 핵심 아이디어

성공 demonstration만 모방한 VLA는 rollout 중 작은 오차로 학습 분포를 벗어났을 때 무엇을 피해야 하는지 모른다. AFIL은 사전학습 VLA의 온라인 rollout에서 raw failure를 모으고, motion planner가 복구한 failure-correction trajectory도 만든다. 공유 VLM 위에 성공·실패 전용 action generator를 두어 두 분포를 분리해 학습한 뒤, 추론 때 실패 generator의 방향을 negative guidance로 빼서 행동을 성공 분포 쪽으로 민다.

# VLA 관점에서 중요한 이유

실패 데이터를 단순히 positive recovery demonstration으로 바꾸는 데서 끝나지 않고, 실패 자체를 명시적인 repulsive distribution으로 사용한다. 특히 고정 guidance scale 대신 성공·실패 예측의 cosine disagreement에 따라 step별 강도를 조절하므로, 장기 작업에서 위험한 방향이 뚜렷한 순간에 더 강하게 개입하고 두 분포가 비슷할 때는 과도한 교정을 줄인다.

# Robot / Embodied Setting

- backbone: diffusion/flow 기반 VLA, 주 실험은 $\pi_{0.5}$ 위의 DAG-VLA.
- 시뮬레이션: ManiSkill의 short/long-horizon manipulation, LIBERO 4개 suite, unseen object·texture·clutter OOD 설정.
- 실제 로봇: Trossen ViperX 300S 6-DoF arm의 노란 cube 집기.
- 데이터: 성공 trajectory, rollout raw failure, motion planner로 고친 failure-correction trajectory.
- 실제 검증은 5개 초기 배치에서 각 10회, 총 50 trial의 proof-of-concept다.

# Method

1. 성공 전용 $\mathcal{G}_{succ}$와 실패 전용 $\mathcal{G}_{fail}$ action generator가 하나의 vision-language backbone을 공유한다.
2. $\mathcal{G}_{succ}$는 원래 성공 demonstration과 failure-correction trajectory를, $\mathcal{G}_{fail}$은 raw failure trajectory를 학습한다.
3. 추론의 각 diffusion/flow step에서 두 generator의 noise 또는 velocity 예측을 동시에 구한다.
4. 실패 예측을 음의 방향으로 사용해 성공 예측을 보정한다. guidance 강도는 두 예측의 cosine disagreement에서 계산되어 rollout 상태와 denoising step에 따라 달라진다.
5. 학습 objective 자체는 기존 diffusion/flow matching을 유지하므로 여러 생성형 VLA에 적용할 수 있다.

# 핵심 그림

![공유 vision-language backbone에서 성공과 실패 action generator를 분리 학습하고 적응형 negative guidance로 행동을 생성하는 AFIL 구조](/papers/assets/vla/failing-forward-adaptive-failure-informed-learning-for-vlas/overview.svg)

> 논문 Figure 1과 Figure 2를 바탕으로 재구성. 출처: [arXiv HTML, Figure 1–2](https://arxiv.org/html/2605.08434). 데이터 수집, 이중 generator 학습, 추론 guidance를 한국어로 정리했다.

이 그림을 고른 이유는 AFIL의 핵심이 데이터 종류별 학습 경로와 추론 시 repulsive guidance의 연결에 있기 때문이다. 학습에서는 성공/교정 궤적과 raw failure가 공유 backbone 뒤의 서로 다른 generator를 감독한다. 추론에서는 두 generator가 같은 noisy action을 평가하고, cosine disagreement 기반 scale로 실패 방향을 빼 최종 action chunk를 만든다. 즉 failure correction은 성공 분포를 넓히고, raw failure는 피해야 할 분포를 만든다는 역할 차이가 있다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)                           | DAG-VLA + AFIL |                     비교 기준 |    차이 | 출처               |
| -------------------------------------------------------- | -------------: | ----------------------------: | ------: | ------------------ |
| ManiSkill, peg upright, 50 configs × 3 runs              |           90.7 |             success-only 70.7 | +20.0%p | 원문 Table 1       |
| ManiSkill, can→plate + banana→plate, 50 configs × 3 runs |           71.3 |             success-only 39.3 | +32.0%p | 원문 Table 1       |
| LIBERO 4-suite 평균, 3 seeds × 500 rollouts              |           98.4 |              $\pi_{0.5}$ 96.9 |  +1.5%p | 원문 Table 4       |
| OOD fruit sorting, 25 configs × 3 runs                   |           64.0 | success-only $\pi_{0.5}$ 10.7 | +53.3%p | 원문 Table 5       |
| 실제 ViperX cube pick, 50 trials                         |           92.0 |   같은 DAG-VLA, AFIL off 50.0 | +42.0%p | 원문 Table 6, §4.4 |

ManiSkill 장기 can/banana 작업은 같은 50 configuration과 반복 수에서 success-only 대비 32.0%p 상승했고, AFIL을 끈 같은 DAG-VLA(56.0%)와 비교해도 15.3%p 높다. 실제 로봇 결과는 같은 학습 모델에서 guidance만 켜고 끈 통제 비교라는 장점이 있지만 단일 작업 50회이므로 일반적인 실제 로봇 성능으로 확대 해석하면 안 된다.

# Limitations / Discussion

- raw failure를 얻으려면 사전학습 정책을 실제 또는 시뮬레이션에서 rollout해야 하며, 실패 라벨 품질에 의존한다.
- 실제 검증은 ViperX의 단일 cube-pick 작업뿐이라 다양한 접촉·장기 작업으로의 전이는 미확인이다.
- 이중 generator는 $\pi_{0.5}$ 대비 약 12.76%의 parameter 증가를 만들고, A100에서 action-horizon step당 2.88 ms가 3.89 ms로 늘어난다.
- adaptive scale은 실패 분포가 충분히 학습됐다는 가정에 기대므로 새로운 실패 유형에서는 잘못된 repulsion이 생길 수 있다.
- 시뮬레이션의 큰 OOD 향상은 failure-correction data와 AFIL이 함께 들어간 결과가 많아 각각의 기여를 구분해 읽어야 한다.

# 내가 이해한 핵심

실패를 성공 데이터로 고쳐 쓰는 것만으로는 부족하고, 실패 행동 분포를 별도로 보존해야 생성 과정의 매 step에서 “이 방향은 피하라”는 신호로 사용할 수 있다.

# 다음에 연결해서 읽을 논문

- Kintsugi-VLA: 실패 rollout을 recovery data로 바꾸는 방식과 raw failure를 음의 분포로 유지하는 AFIL을 비교할 수 있다.
- FIND: 실제 배포에서 VLA가 스스로 실패를 찾고 개선하는 agentic RL 접근이다.
- FAVOR: future prediction을 이용한 검증·회복과 action-distribution negative guidance의 차이를 살펴보기 좋다.
