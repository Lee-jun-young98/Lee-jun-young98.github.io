---
title: "R2-VLA: Risk-Controlled Test-Time Adaptation for Vision-Language-Action Models"
date: 2026-11-21
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Zixuan Liu, Hashem Haghbayan, Zizhan Zheng, Siavash Khajavi"
paper: "https://arxiv.org/abs/2611.26438"
code: ""
project: ""
thumbnail: "/papers/assets/vla/r2-vla-risk-controlled-test-time-adaptation/architecture.svg"
---

# 한 줄 요약

R2-VLA는 retrieval demonstration을 VLA가 제대로 활용할 수 있는지를 learned uncertainty로 판단하고, task-level 실패 위험을 만족하도록 Act/Ask threshold를 보정해 최소한의 전문가 개입으로 테스트타임 적응한다.

# 논문 정보

- 제목: Risk-Controlled Test-Time Adaptation for Vision-Language-Action Models
- 저자: Zixuan Liu, Hashem Haghbayan, Zizhan Zheng, Siavash Khajavi
- 발표: 확인 필요 (arXiv v1, 2026-11-19)
- 링크: [arXiv](https://arxiv.org/abs/2611.26438) · [HTML](https://arxiv.org/html/2611.26438v1)
- 코드/프로젝트: 공개 확인 필요
- 키워드: retrieval-augmented VLA, test-time adaptation, conformal risk control, uncertainty, expert assistance, LIBERO

# 핵심 아이디어

시각적으로 비슷한 demonstration을 잘 검색해도 VLA가 그 context를 올바른 action으로 바꾸지 못할 수 있다. R2-VLA는 VLA 내부 representation에서 expert action과의 discrepancy를 예측하는 uncertainty head를 학습한다. held-out rollout으로 threshold 후보별 task failure와 ASK rate를 계산해, 사용자가 정한 실패 위험 $\epsilon$ 이하인 후보 가운데 전문가 호출이 가장 적은 threshold를 고른다.

# VLA 관점에서 중요한 이유

배포 중 적응을 weight update가 아니라 **retrieval memory + 선택적 human fallback + 통계적 calibration** 문제로 재구성한다. 세 backbone 모두에서 평균 성공률을 9.2–11.2%p 높였고, 같은 ASK budget의 random help보다 $\pi_0$-FAST 평균이 6.5%p 높다. 즉 “얼마나 자주 사람을 부를지”보다 “VLA가 어떤 retrieval context에서 실패할지”를 찾는 것이 중요하다.

# Robot / Embodied Setting

LIBERO Spatial, Object, Goal, Long 네 suite의 unseen manipulation task를 MiniVLA, $\pi_0$-FAST, OpenVLA 세 backbone으로 평가한다. 입력은 top·side·wrist RGB, proprioception, language instruction이며 policy weight는 test time에 고정된다. retrieval buffer에서 현재 관측과 관련된 expert demonstration을 context로 제공하고, ASK 시 expert action을 실행한다. calibration과 evaluation은 task instance 단위 rollout으로 분리한다.

# Method

1. **Retrieval-augmented policy:** 현재 입력 $x_t$와 검색 context $\mathcal{M}_t$에서 VLA가 action $\hat a_t$를 낸다.
2. **Uncertainty predictor:** lightweight head $U_\psi(\mathcal{M}_t,x_t)$가 scalar $\hat u_t$를 출력한다. 학습 target은 VLA action과 expert action의 discrepancy다.
3. **Act/Ask gate:** $\hat u_t\le\lambda$이면 VLA action을 실행하고, 크면 expert action $a_t^E$를 요청한다. 작은 threshold일수록 보수적이다.
4. **Risk-controlled calibration:** held-out task rollout에서 각 $\lambda\in\Lambda$의 failure risk 상한과 ASK rate를 평가하고, $R(\lambda)\le\epsilon$을 만족하는 후보 중 empirical ASK가 최소인 threshold를 선택한다.
5. **Continual adaptation:** ASK로 얻은 correction을 retrieval memory에 추가한다. memory가 바뀌면 uncertainty 분포도 바뀌므로 매 round threshold를 다시 calibrate하며 policy parameter는 갱신하지 않는다.

# 핵심 그림

![현재 관측과 언어 명령이 retrieval memory와 VLA를 거쳐 action과 uncertainty를 만들고, risk-calibrated threshold가 Act 또는 Ask를 선택하며 expert correction을 memory에 되돌리는 R2-VLA 구조](/papers/assets/vla/r2-vla-risk-controlled-test-time-adaptation/architecture.svg)

> 논문 §3.1–3.4, Equation (1), Algorithms 1–2를 바탕으로 재구성. 출처: [arXiv HTML §3](https://arxiv.org/html/2611.26438v1#S3). 캡션: retrieval context를 쓰는 frozen VLA와 uncertainty head, task-level risk calibration, Act/Ask 실행, expert correction의 continual memory update 흐름.
>
> 원 논문에는 전체 architecture overview가 없어 qualitative Figure 1 대신 검증 가능한 method 요소만 재구성했다. 입력 $x_t$는 memory 검색과 frozen VLA로 들어가 action·uncertainty를 만든다. calibration 단계는 held-out **전체 rollout**을 threshold별로 다시 실행해 $R(\lambda)\le\epsilon$을 만족하면서 ASK rate가 가장 낮은 $\hat\lambda$를 고른다. 추론에서는 이 threshold로 VLA action 또는 expert action을 선택하고, adaptation round가 끝나면 correction을 memory에 넣고 재보정한다.

# Experiments / Results

## 주요 실험 결과

| backbone / LIBERO 평가 (평균 성공률 %, ↑)  | R2-VLA |               RICL |    차이 |        평균 ASK | 출처    |
| ------------------------------------------ | -----: | -----------------: | ------: | --------------: | ------- |
| MiniVLA, 4-suite 평균                      |   62.8 |               51.8 | +11.0%p |           20.8% | Table 1 |
| $\pi_0$-FAST, 4-suite 평균                 |   72.0 |               62.8 |  +9.2%p |           49.0% | Table 1 |
| OpenVLA, 4-suite 평균                      |   68.6 |               57.4 | +11.2%p |           33.3% | Table 1 |
| $\pi_0$-FAST, same ASK budget              |   72.0 |    Random ASK 65.5 |  +6.5%p |           49.0% | Table 2 |
| $\pi_0$-FAST, learned vs. DINO risk signal |   72.0 | DINO Distance 68.1 |  +3.9%p | 49.0% vs. 59.6% | Table 2 |

Table 1은 각 backbone의 RICL과 같은 네 suite 평균을 비교한다. 목표 성공률은 대체로 RICL보다 최소 5%p 높게 정했고 12개 backbone-suite 조합 중 11개에서 달성했다. 예외는 $\pi_0$-FAST/Object로 80.0% 목표에 78.9%였다. Table 2의 Random ASK는 suite별 ASK frequency를 R2-VLA와 맞췄으므로 선택적 uncertainty의 효과를 분리한다. 다만 ASK는 expert action oracle을 가정하며, 평균 20.8–49.0%는 완전 자율 시스템으로 보기 어려운 개입량이다.

# Limitations / Discussion

실험은 시뮬레이션 LIBERO와 네 suite에 한정되고 실제 사람의 지연·오류·비용을 모델링하지 않는다. risk guarantee는 calibration distribution과 statistical bound에 대한 것이며 개별 episode 성공을 보장하지 않는다. threshold마다 closed-loop rollout을 평가해야 해 calibration 비용이 크고, memory update 뒤에는 재보정이 필요하다. uncertainty head 학습에도 expert action이 필요하며 high ASK regime에서는 성공률 향상이 autonomy 감소와 맞바뀐다.

# 내가 이해한 핵심

retrieval relevance와 action reliability는 다른 문제다. VLA 배포에서 중요한 것은 비슷한 예시를 찾았다는 사실이 아니라, **그 예시를 본 현재 policy가 안전하게 행동할 수 있는지**를 task-level 결과에 맞춰 보정하는 것이다.

# 다음에 연결해서 읽을 논문

- [RICL](https://arxiv.org/search/?query=Retrieval-Augmented+In-Context+Learning+for+Vision-Language-Action+Models&searchtype=title): 직접 기반이 되는 retrieval adaptation 방법
- [Conformal Risk Control](https://openreview.net/forum?id=33XGfHLtZg): task-level threshold 보정의 통계적 기반
- [VLA-Tug](https://arxiv.org/search/?query=VLA-Tug&searchtype=title): latent probe로 VLA failure를 분류하는 비교 관점
- [VeriVLA](https://arxiv.org/search/?query=VeriVLA&searchtype=title): latent world model 기반 test-time verification 비교
