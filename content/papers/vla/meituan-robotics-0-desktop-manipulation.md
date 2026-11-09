---
title: "Meituan-Robotics-0: A Vision-Language-Action Foundation Model for Desktop Manipulation"
date: 2026-11-09
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Meituan Robotics Team"
paper: "https://arxiv.org/abs/2611.08577"
code: "https://github.com/Meituan-Robotics/Meituan-Robotics-0"
project: "https://meituan-robotics.github.io/Meituan-Robotics-0/"
thumbnail: "/papers/assets/vla/meituan-robotics-0-desktop-manipulation/mr0-overview-figure1.png"
---

# 한 줄 요약

Meituan-Robotics-0(MR0)은 1.47억 vision-language sample과 12개 embodiment의 15,060시간 로봇 데이터를 3단계로 학습하고, Rollback 기반 사후학습과 event memory를 결합해 정밀한 양팔 조작부터 중단된 장기 작업의 재개까지 하나의 desktop manipulation stack으로 묶는다.

# 논문 정보

- 제목: Meituan-Robotics-0: A Vision-Language-Action Foundation Model for Desktop Manipulation
- 저자: Meituan Robotics Team
- 발표: 확인 필요 (arXiv v1, 2026-11-05; 2026-11-09 신규 목록)
- 링크: [arXiv](https://arxiv.org/abs/2611.08577) · [HTML](https://arxiv.org/html/2611.08577)
- 코드/프로젝트: [공식 프로젝트](https://meituan-robotics.github.io/Meituan-Robotics-0/) · [GitHub](https://github.com/Meituan-Robotics/Meituan-Robotics-0) · [모델](https://huggingface.co/MeituanRobotics/models) · [RoboDesk 데이터](https://huggingface.co/datasets/MeituanRobotics/RoboDesk)
- 키워드: VLA foundation model, cross-embodiment, flow matching, human intervention, event memory, desktop manipulation

# 핵심 아이디어

MR0의 핵심은 큰 policy 하나만 확장하는 대신 **데이터 정렬 → progressive VLA training → 실제 실패 상태 사후학습 → event-driven agent**를 하나의 시스템으로 설계한 것이다. 로봇별 관측·좌표·action 표현을 통일하고, discrete FAST action token으로 multimodal prior를 먼저 얻은 뒤 continuous flow-matching head로 정밀 제어를 학습한다. 실제 배포에서는 인간이 과거 anchor로 되돌아가 실패한 policy segment를 correction으로 교체하는 Rollback을 사용한다. 이 positive/negative pair를 CFG-DAgger가 직접 학습하므로 별도의 value model이나 advantage label이 필요 없다.

# VLA 관점에서 중요한 이유

이 논문은 범용 VLA의 성능 병목이 backbone 규모만이 아니라 **서로 다른 embodiment의 좌표 정합, discrete-to-continuous action transfer, policy-induced failure data, inference latency, 장기 기억**에 동시에 있음을 보여준다. 특히 low-level VLA는 현재 관측에 반응하는 빠른 controller로 유지하고, task state가 바뀔 때만 event memory와 planner를 호출한다. 이는 VLA를 모든 추론을 담당하는 단일 모델로 보기보다, 지연과 기억의 시간 규모가 다른 모듈을 연결하는 embodied system의 중심으로 보는 설계다.

# Robot / Embodied Setting

학습 corpus는 147M vision-language sample과 12개 embodiment의 15,060시간 로봇 trajectory로 구성된다. RoboTwin 2.0에서는 50개 양팔 task를 clean/randomized split 각각 task당 100 episode, 총 5,000 episode로 평가한다. RoboDojo는 42개 양팔 task의 generalization, precision, long-horizon, memory, open-vocabulary 능력을 측정한다. 실제 평가는 letter-block placement, garment folding, Ethernet insertion의 세 task이며, 비교마다 같은 초기 조건에서 policy당 task별 30회 autonomous trial을 수행하고 success rate(SR)와 task progress score(PS)를 보고한다.

# Method

1. **데이터 정렬:** VQA consistency/noise filter, 시간·영상 filter, kinematic consistency 검사, task hierarchy annotation을 수행한다. 서로 다른 로봇 action을 공통 spatial-control frame의 absolute end-effector pose, rotation 6D representation, gripper 값으로 canonicalize한다.
2. **Stage 1 — discrete pre-training:** Qwen3.5-4B backbone이 VLM data와 FAST로 압축한 action token을 같은 autoregressive vocabulary에서 공동 학습한다. action loss와 VQA loss의 가중치는 각각 1.0과 0.1이다.
3. **Stage 2 — continuous mid-training:** discrete head를 MMDiT+JiT continuous action head로 교체한다. multi-view image·language·proprioception에서 얻은 condition token과 noisy action chunk가 joint attention으로 상호작용하고, flow matching으로 unified multi-embodiment action을 복원한다.
4. **Stage 3 — real-world optimization:** demonstration SFT 뒤 HG-DAgger, RECAP 또는 CFG-DAgger를 적용한다. Rollback은 과거 anchor 이후의 실패 segment와 인간 correction을 짝지어 positive/negative supervision을 만든다.
5. **배포:** 30 Hz control loop와 목표 3 Hz policy loop를 분리하고, 계산 중 낡은 action을 버린 뒤 기존 buffer와 새 chunk의 겹치는 구간을 선형 blend한다. 상위 agent는 Monitor가 observation window를 caption으로 만들고, Memory Manager가 event와 keyframe을 저장하며, progress·failure·feasibility가 바뀔 때만 Planner를 다시 호출한다.

# 핵심 그림

![대규모 VLM·로봇 데이터, 3단계 VLA 학습, MR0 policy, event-driven agent와 실제 로봇 배포를 연결한 전체 구조](/papers/assets/vla/meituan-robotics-0-desktop-manipulation/mr0-overview-figure1.png)

> 논문 Figure 1 원본. 출처: [arXiv HTML Figure 1](https://arxiv.org/html/2611.08577#S1.F1), CC BY 4.0. 캡션: 147M vision-language data와 12개 embodiment의 로봇 데이터를 정렬해 3단계로 MR0를 학습하고, event-driven agent 및 실제 desktop manipulation deployment로 연결하는 전체 파이프라인.
>
> 이 그림을 고른 이유는 action head만 보여주는 Figure 5보다 MR0의 기여인 **data foundation, progressive training, low-level policy, agent memory, deployment**의 연결을 한 번에 설명하기 때문이다. 입력은 multi-view image·언어 지시·proprioception이고, Qwen3.5-4B backbone 뒤 Stage 1에서는 discrete FAST token, Stage 2 이후에는 MMDiT+JiT가 continuous action chunk를 출력한다. Stage 3의 Rollback/CFG-DAgger는 실제 실패 분포를 보강한다. 추론 때 policy는 로봇을 계속 제어하고 Monitor·Memory가 event를 누적하며, Planner는 task 상태가 변할 때만 skill queue를 갱신한다. 즉 학습 흐름은 `정렬된 이종 데이터 → discrete prior → continuous control → correction post-training`, 추론 흐름은 `관측·지시 → VLA action chunk → 비동기 실행`과 `관측 변화 → event memory → 조건부 replanning`으로 분리된다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (↑)                                                          |           MR0 |             비교 기준 |   차이 | 출처              |
| ----------------------------------------------------------------------------- | ------------: | --------------------: | -----: | ----------------- |
| RoboTwin 2.0, 50 task Clean+Randomized 평균 성공률 (%)                        |          93.6 | GalaxeaVLA(G0.5) 93.3 | +0.3%p | Table 4           |
| RoboTwin 2.0, ABot-M0와 공통 clean-action/velocity-loss 비교, 평균 성공률 (%) |          93.6 |          ABot-M0 85.6 | +8.0%p | Table 4, §5.1     |
| 실제 Ethernet insertion, 전체 Rollback data, SR (%)                           | CFG-DAgger 70 |              RECAP 60 |  +10%p | Figure 11, §5.2.2 |
| 실제 Ethernet insertion, 전체 Rollback data, PS (%)                           | CFG-DAgger 90 |              RECAP 67 |  +23%p | Figure 11, §5.2.2 |

RoboTwin 수치는 50개 task에서 split별 5,000 episode를 평가한 동일 protocol이다. MR0는 clean 93.2%, randomized 93.9%, overall 93.6%로 표에 실린 방법 중 최고 overall을 기록했다. GalaxeaVLA와의 차이는 0.3%p로 작지만, 논문이 action parameterization을 맞춰 해석한 ABot-M0 대비 차이는 8.0%p다. 실제 Ethernet 비교는 같은 mid-training checkpoint, demonstration, Rollback episode를 사용하며 각 collection round에서 세 방법이 50 episode씩 공동 pool에 추가한다. 따라서 마지막 두 행의 +10%p SR와 +23%p PS는 조건이 맞는 직접 비교다.

# Limitations / Discussion

공식 top-conference 채택은 확인되지 않았다. 15,060시간 corpus 중 7,530시간은 licensed real-robot data라서 데이터 내용과 완전한 재현성이 공개 corpus만큼 투명하지 않다. RoboTwin에서는 최고 성능이지만 RoboDojo VLA track 평균 SR은 14.63%로 5위이며, open-vocabulary SR은 3.38%에 그친다. event-agent 결과는 cross-task retrieval과 task resumption 두 사례의 정성 평가라서 장기 신뢰성을 수치로 입증하지는 못한다. 또한 Qwen3.5-4B policy와 35B-A3B agent pool, 256-GPU pre-training은 재현 비용이 크고, stationary-base desktop setting 밖의 mobile manipulation이나 안전 제약은 다루지 않는다.

# 내가 이해한 핵심

MR0의 가장 중요한 메시지는 “더 큰 VLA”보다 **서로 다른 시간 규모를 정렬하는 일**이다. 데이터 단계에서는 embodiment 좌표를, 학습 단계에서는 discrete semantic prior와 continuous control을, 사후학습에서는 실패 segment와 correction을, 실행 단계에서는 policy latency와 control clock을, agent 단계에서는 순간 관측과 장기 task state를 정렬한다. 각각의 정렬이 따로 좋아 보이지만, 실제 배포 성능은 이 다섯 층이 끊기지 않을 때 나온다는 시스템 논문이다.

# 다음에 연결해서 읽을 논문

- [π0.5](https://arxiv.org/abs/2504.16054): MR0가 실제 로봇에서 같은 데이터와 post-training protocol로 비교한 범용 VLA
- [FAST](https://arxiv.org/abs/2501.09747): Stage 1의 action tokenization과 discrete pre-training을 이해하기 위한 선행 연구
- [RECAP](https://arxiv.org/abs/2503.06639): Rollback data를 advantage-conditioned policy로 학습하는 주요 비교 방법
- [Human-Gated DAgger](https://arxiv.org/abs/1810.02890): 인간 intervention으로 policy-induced error state를 수집하는 기본 관점
