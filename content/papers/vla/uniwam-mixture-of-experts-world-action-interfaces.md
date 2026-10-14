---
title: "UniW(A)M: Unified Mixture-of-Experts for World and World-Action Models"
date: 2026-10-14
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요 (ICLR 2027 under review)"
authors: "Jingbo Xu et al."
paper: "https://arxiv.org/abs/2610.18697"
code: ""
project: ""
thumbnail: "/papers/assets/vla/uniwam-mixture-of-experts-world-action-interfaces/overview.svg"
---

# 한 줄 요약

UniW(A)M은 하나의 diffusion MoE에서 action-conditioned world model과 네 종류 WAM interface를 공동 학습하고, 배포 시 chunk마다 정확도·속도에 맞는 interface를 고른다.

# 논문 정보

- 제목: UniW(A)M: A Unified Mixture-of-Experts Framework for World and World-Action Models
- 저자: Jingbo Xu, Jianjie Fang, Zhuohang Li, Zihao Song 외
- 발표: arXiv:2610.18697v1 (2026-10-13), ICLR 2027 under review로 표기되며 채택 venue는 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.18697) · [HTML 원문](https://arxiv.org/html/2610.18697)
- 코드/프로젝트: 공식 공개 링크 미확인
- 키워드: world-action model, action-conditioned world model, mixture of experts, adaptive routing, diffusion transformer

# 핵심 아이디어

기존 WAM은 joint video-action 생성, video→action, action-centric 등 서로 다른 interface를 별도 모델로 학습한다. UniW(A)M은 이들을 video-action visibility mask의 차이로 표현하고 하나의 DiT MoE에서 공동 학습한다. shared expert는 공통 물리 dynamics를, VGM·VLA·WM·IDM atomic expert는 각 token의 예측 역할을 담당한다. PAIR router는 target task의 소량 chunk scenario로 backbone을 고정한 채 학습되어, 배포 중 빠른 action-only 계열과 foresight가 강한 joint 계열을 chunk 단위로 전환한다.

# VLA 관점에서 중요한 이유

이 논문은 “world를 생성할 것인가, action만 생성할 것인가”를 고정된 아키텍처 선택이 아니라 상황별 계산 정책으로 바꾼다. 접근·이동 구간에는 빠른 interface를 쓰고, 접촉·정밀 조작에는 future-video를 활용하는 interface를 쓰므로 WAM의 예측 이점과 VLA의 지연 요구를 한 모델에서 절충한다.

# Robot / Embodied Setting

- 시뮬레이션: LIBERO, RoboTwin 2.0 50-task clean-to-clean / clean-to-randomized.
- 실제: cloth folding, box folding, tabletop cleaning. task당 20회.
- OOD: 보지 못한 의류 색·크기, 다른 box type, 다른 cluttered background.
- world modeling: WorldArena의 세 실제 작업에서 action-conditioned video prediction 평가.
- trajectory window: 33 RGB frame, 96 action vector, 4 robot state, language instruction.

# Method

1. AC-WM과 Joint-WAM, IDM-WAM, Action-Centric-WAM, Action-Only-WAM을 visibility mask와 prediction target 조합으로 정의한다.
2. DiT의 attention은 공유하고 FFN은 shared·VGM·VLA·WM·IDM expert로 구성한다.
3. CATR가 video/action token group의 역할에 맞는 expert 집합 안에서 mixture weight를 학습한다.
4. 다섯 interface를 균등 sampling해 같은 trajectory로 공동 학습하며 AC-WM의 dynamics 지식도 action interface에 전달한다.
5. PAIR는 각 chunk에서 네 WAM action의 ground-truth MAE와 효율 우선 규칙으로 router target을 만들고, 배포 시 한 interface를 선택한다.

# 핵심 그림

![공유 DiT와 역할별 MoE expert가 다섯 world-action interface를 지원하고 PAIR가 배포 chunk마다 action interface를 선택하는 UniW(A)M](/papers/assets/vla/uniwam-mixture-of-experts-world-action-interfaces/overview.svg)

> 논문 Figure 1과 Figure 11을 바탕으로 재구성. 출처: [arXiv HTML, Figure 1·11](https://arxiv.org/html/2610.18697). interface, expert, 배포 router의 관계를 한 흐름으로 단순화했다.

구조 그림을 고른 이유는 visibility mask, atomic expert, PAIR라는 세 층의 결합이 방법의 핵심이기 때문이다. 학습 입력은 history video·state·language와 future video/action이며, mask가 각 interface의 조건 방향을 정하고 CATR가 token별 expert를 고른다. 추론에서는 AC-WM을 직접 action 실행에 쓰지 않고, PAIR가 빠른 action pathway와 foresight pathway 중 하나를 chunk마다 선택한다.

# Experiments / Results

## 주요 실험 결과

| 실제 평가 / 성공률 (%, ↑)         | UniW(A)M |                      비교 기준 |     차이 | 출처                 |
| --------------------------------- | -------: | -----------------------------: | -------: | -------------------- |
| 표준 3-task 평균, IDM-WAM         |     88.3 |     WorldScape Policy 2.0 76.7 |  +11.6%p | 원문 Table 2         |
| OOD 3-task 평균, PAIR             |     76.7 | 최강 standalone interface 63.3 |  +13.4%p | 원문 Table 4         |
| RoboTwin 2.0 C2R, clean-only 학습 |    66.60 |              $\pi_{0.5}$ 46.00 | +20.60%p | 원문 Figure 4        |
| Action-Only-WAM, CATR             |     80.0 |      sample-level routing 10.0 |  +70.0%p | 원문 §4.5 / appendix |

표준 실제 평가에서 네 interface 모두 strongest baseline 평균을 넘었고 IDM-WAM이 88.3%로 가장 높았다. OOD에서는 고정 interface 63.3%에서 PAIR 76.7%로 올라, 한 interface의 평균 성능보다 단계별 선택이 중요함을 보여 준다. 논문이 88.3−76.7을 약 11.7%p로 서술하지만 산술 차이는 11.6%p이므로 표에는 계산값을 적었다.

# Limitations / Discussion

- 14B video backbone 기반 MoE로 계산·메모리 비용이 크며, 빠른 interface도 절대 지연이 작다고 단정하기 어렵다.
- PAIR는 task당 2,000개 target chunk scenario를 필요로 하므로 완전 zero-shot 적응은 아니다.
- router target이 offline action MAE에 기반해 장기 task success와 완전히 일치하지 않을 수 있다.
- 실제 평가는 세 작업·task당 20회이며 여러 embodiment 전이는 검증되지 않았다.
- ICLR 2027은 under review 상태일 뿐 채택된 venue가 아니다.

# 내가 이해한 핵심

서로 다른 WAM 설계는 경쟁하는 하나의 정답이라기보다, 실행 단계에 따라 필요한 계산과 foresight가 다른 도구 모음이다. UniW(A)M은 그 도구를 shared dynamics 위에서 학습하고 router가 필요할 때 꺼내 쓰게 한다.

# 다음에 연결해서 읽을 논문

- Motus: Mixture-of-Transformer 기반 multimodal world-action 통합의 선행 흐름이다.
- WorldScape-MoE: heterogeneous action conditioning용 MoE와 expert 공유 방식을 비교할 수 있다.
- SWAP: stepwise action-policy routing과 UniW(A)M의 interface routing을 대조하기 좋다.
