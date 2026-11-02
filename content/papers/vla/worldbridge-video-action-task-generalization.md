---
title: "WorldBridge: Bridging Video and Action for Task Generalization in World Action Models"
date: 2026-11-02
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "WorldBridge Team"
paper: "https://arxiv.org/abs/2610.40748"
project: "https://worldbridge-jd.github.io/"
thumbnail: "/papers/assets/vla/worldbridge-video-action-task-generalization/overview.svg"
---

# 한 줄 요약

WorldBridge는 비디오 expert와 action expert를 joint attention으로 연결해, 새로운 태스크의 비디오만 추가해도 기존 inverse-dynamics 지식을 통해 행동으로 옮기고 소수의 action label로 그 연결을 빠르게 강화한다.

# 논문 정보

- 제목: WorldBridge: Bridging Video and Action for Task Generalization in World Action Models
- 저자: Jun Cen, Yubo Guo, Hao Li, Liangkai Li, Yaoxu Lyu, Meng Wei, Zeqi Xiao, Sizhe Yang, Yuqiang Yang, Yifan Ye, Shanghang Zhang, Duo Zheng (WorldBridge Team)
- 발표: 확인 필요 (arXiv v1, 2026-10-29)
- 링크: [arXiv](https://arxiv.org/abs/2610.40748) · [HTML](https://arxiv.org/html/2610.40748)
- 코드/프로젝트: [WorldBridge project](https://worldbridge-jd.github.io/)
- 키워드: world-action model, task generalization, video-to-action bridge, flow matching, heterogeneous robot data

# 핵심 아이디어

새 태스크를 실행하려면 “어떤 미래가 되어야 하는가”를 비디오로 일반화하는 능력과 “그 미래를 어떤 제어로 실현하는가”를 action으로 일반화하는 능력이 모두 필요하다. WorldBridge는 두 능력을 하나의 decoder에 섞지 않고 video expert와 action expert로 분리하되 joint self-attention으로 정보를 교환한다. OOD 태스크 비디오가 미래 동역학을 넓히고, 적은 paired action 예제가 video-to-action bridge, 즉 inverse dynamics를 보정한다.

# VLA 관점에서 중요한 이유

VLA의 일반화를 언어 이해만의 문제로 보지 않고 **visual future coverage와 action grounding의 병목**으로 분해했다. 특히 OOD action label 없이 OOD 비디오만 추가해 RoboTwin 2.0 OOD 성공률이 25.07%에서 55.90%로 오른 결과는, 비디오 데이터가 실행 가능한 정책 지식으로 전달될 수 있음을 정량화한다. 이후 태스크당 action 1개만 붙여도 70.70%가 되어 소량의 로봇 행동 데이터가 bridge 보정에 매우 효율적임을 보인다.

# Robot / Embodied Setting

사전학습은 heterogeneous robot trajectory와 egocentric hand-derived supervision을 공통 좌표·46차원 unified action space로 정규화한다. 평가는 RoboTwin 2.0, RoboCasa GR1 TableTop, RMBench, DOMINO Level-1, SimplerEnv-WidowX, RoboDojo를 포함한다. 실로봇은 AgiBot G2와 ARX AC-1에서 꽃 꽂기, 음료 스캔, LEGO 분리, 책 포장, 나사 분류, 컵 걸기 등 6개 태스크를 각 20회 평가한다.

# Method

1. 현재 관측은 video VAE로, 언어 명령은 T5로 인코딩해 conditioning context를 만든다.
2. video expert는 noisy future-video latent를, action expert는 noisy action chunk를 각각 modality-specific FFN과 decoder로 처리한다.
3. 두 expert는 joint self-attention으로 visual dynamics와 control 정보를 교환하고, 독립적인 flow timestep을 사용해 joint flow-matching objective로 학습한다.
4. short-term observation memory와 compressed long-term memory가 현재 상태와 긴 맥락을 제공한다. 학습 시 action forcing은 action 정보를 video branch에 제공해 video-to-action 결합을 강화한다.
5. 추론 시에는 필요한 출력 경로만 사용하고, real robot에서는 다음 action-chunk 추론과 100 Hz 실행을 비동기로 겹쳐 stale action을 버린다.

# 핵심 그림

![WorldBridge의 관측·언어 입력, 비디오와 액션 expert, joint attention, flow-matching 출력 흐름](/papers/assets/vla/worldbridge-video-action-task-generalization/overview.svg)

> 논문 Figure 3과 Section 2.1을 바탕으로 재구성한 WorldBridge 아키텍처. 출처: [논문 HTML Figure 3 및 Method](https://arxiv.org/html/2610.40748#S2). 원본 그림을 복제하지 않고 핵심 모듈과 학습·추론 흐름을 한국어로 다시 그렸다.
>
> 구조 그림을 고른 이유는 논문의 핵심 주장이 video generalization과 action generalization 사이의 **bridge가 어디서 형성되는가**에 있기 때문이다. 입력 관측·언어는 각각 VAE와 T5를 거쳐 두 expert를 조건화하고, joint attention은 modality-specific FFN을 유지하면서 정보를 교환한다. 학습에서는 future video와 action chunk를 독립 noise level에서 함께 복원하지만, 배포에서는 action expert가 실행 chunk를 내고 비동기 controller가 이를 소비한다.

# Experiments / Results

## 주요 실험 결과

| 설정 / 지표 (success rate %, ↑)                 | WorldBridge |                  비교 기준 |     차이 | 출처            |
| ----------------------------------------------- | ----------: | -------------------------: | -------: | --------------- |
| RoboTwin 2.0 OOD, ID video-action만             |       25.07 |                          — |        — | Table 2, Exp. 1 |
| RoboTwin 2.0 OOD, OOD video 추가·OOD action 0개 |       55.90 |    ID video-action만 25.07 | +30.83%p | Table 2, Exp. 2 |
| RoboTwin 2.0 OOD, OOD action 1개/task           |       70.70 |       OOD action 0개 55.90 | +14.80%p | Table 2, Exp. 3 |
| RoboTwin 2.0 Clean+Randomized 평균              |       96.23 |               Kairos 96.05 |  +0.18%p | Table 3         |
| 실로봇 6-task 평균                              |        72.5 |           $\pi_{0.5}$ 57.5 |  +15.0%p | Figure 7        |
| 실로봇 6-task 평균, joint pretraining 효과      |        72.5 | w/o joint pretraining 46.7 |  +25.8%p | Figure 7        |

Table 2의 action 개수는 OOD 태스크당 demonstration 수다. OOD 비디오 550개를 고정하면 action 20개/task에서 90.03%, 100개에서 93.17%, 550개에서 92.83%로 포화된다. 반대로 action 100개/task를 고정하고 OOD 비디오를 100개에서 550개로 늘리면 88.83%에서 93.17%(+4.34%p)로 오른다. 이는 action label을 무작정 늘리기보다 충분한 video coverage와 소량의 paired grounding을 결합하는 편이 효율적이라는 해석을 뒷받침한다.

# Limitations / Discussion

저자 보고 수치는 매우 강하지만 venue는 아직 공식 확인되지 않았고, 모델·데이터 규모가 커서 동일 조건 재현 비용이 높다. 태스크 일반화 실험의 ID/OOD 분할과 데이터 처리 파이프라인이 결과에 미치는 영향도 분리 평가가 더 필요하다. OOD 비디오가 없는 완전히 새로운 물리·embodiment로의 zero-shot action grounding, 실패 회복, 안전 제약은 직접 다루지 않는다. real-robot 평가는 2개 플랫폼, 6개 태스크, 각 20회로 제한된다.

# 내가 이해한 핵심

WorldBridge의 메시지는 “비디오를 많이 보면 행동도 저절로 된다”가 아니다. 먼저 action-labeled task에서 재사용 가능한 inverse-dynamics bridge를 만들고, 새로운 태스크 비디오가 그 bridge가 읽을 visual future를 확장하며, 극소수 paired action이 새 영역의 대응 관계를 고정한다는 것이다.

# 다음에 연결해서 읽을 논문

- [World Action Models are Zero-shot Policies](https://arxiv.org/abs/2602.15922): 비디오 생성과 action generation을 결합한 WAM 계열의 출발점
- [Native Video-Action Pretraining](https://arxiv.org/abs/2607.08639): joint video-action pretraining의 직접 비교축
- [OpenWAM](https://arxiv.org/abs/2609.07398): 체계적인 WAM pretraining recipe
- [Long-WAM](https://arxiv.org/abs/2610.10528): 긴 temporal context와 memory를 확장하는 방법
