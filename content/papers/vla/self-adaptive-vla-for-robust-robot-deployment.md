---
title: "Self-Adaptive VLA for Robust Robot Deployment"
date: 2026-09-27
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Test-Time Adaptation"
  - "Robot Deployment"
venue: "확인 필요"
authors: "Hongxin Zhang, Chunru Lin, Tsun-Hsuan Wang, Zhenjia Xu, Chuang Gan"
paper: "https://arxiv.org/abs/2609.30092"
code: ""
project: "https://icefoxzhx.github.io/self-adaptive-vla"
---

# 한 줄 요약

Self-Adaptive VLA는 실패한 이전 rollout의 영상·proprioception·action을 context token으로 압축해, 재보정이나 online gradient update 없이 하드웨어 편차에 반복적으로 적응한다.

# 논문 정보

- 제목: Self-Adaptive VLA for Robust Robot Deployment
- 저자: Hongxin Zhang, Chunru Lin, Tsun-Hsuan Wang, Zhenjia Xu, Chuang Gan
- 발표: 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2609.30092), [HTML](https://arxiv.org/html/2609.30092), [프로젝트](https://icefoxzhx.github.io/self-adaptive-vla)
- 코드/프로젝트: 프로젝트 페이지 공개, 코드 공개 여부 확인 필요
- 키워드: VLA, test-time adaptation, hardware shift, in-context adaptation, AdaLN

# 핵심 아이디어

현장 로봇은 마모, actuation bias, encoder offset, workstation 차이 때문에 학습 때와 다른 동역학을 보인다. 이 논문은 의도적으로 hardware shift를 주입해 base policy rollout을 수집하고, 원래 expert action을 알려진 shift만큼 사전 보상해 shift-conditioned demonstration을 자동 구성한다.

경량 Context Encoder가 이전 trial의 시각 관측, proprioception, action을 하나의 latent token으로 압축하고, 이 token이 Action DiT의 AdaLN을 조절한다. 여러 trial에서 얻은 token을 단순 합산하면 시행을 거듭하며 보정량이 누적되어 실패를 단계적으로 줄일 수 있다.

# VLA 관점에서 중요한 이유

현재 VLA는 짧은 observation window에는 강하지만, 같은 로봇에서 직전에 실패한 경험을 다음 시도에 활용하지 못하는 경우가 많다. Self-Adaptive VLA는 rollout history를 단순 memory가 아니라 하드웨어 상태를 추론하는 system-identification context로 사용한다.

추론 시 파라미터 업데이트나 추가 계산량 없이 context만 바꾸므로 다수의 현장 로봇을 유지보수하는 시나리오에 특히 의미가 있다. semantic generalization과 함께 embodiment의 미세한 calibration drift를 다루는 것이 실제 배포형 VLA의 별도 핵심 축임을 보여준다.

# Robot / Embodied Setting

- 로봇: 6-DoF Piper/Piper-X arms, 7-DoF Marvin arms, 20-DoF Wuji Hand
- 센서: ego camera 1대와 wrist camera 2대
- 과업: Transport Corn, Insert Tube, Cap Marker, Assemble Ring
- 변화: actuation bias, joint encoder offset, 새로운 workstation의 unknown hardware shift
- 평가: 과업별 unseen shift 20 episodes, episode당 최대 6 trials
- Base VLA: Qwen-3.5-0.8B VLM encoder와 8-layer 340M Action DiT

# Method

먼저 shift가 주입된 환경에서 base policy rollout을 context로 수집한다. 알려진 shift의 역변환으로 기존 expert action을 보상해 같은 demonstration을 여러 하드웨어 조건에 맞는 contextualized dataset으로 바꾼다.

Context Encoder는 DINO v3 시각 특징과 proprioception, 실행 action을 융합해 context token을 만든다. 이 token은 DiT block의 adaptive layer normalization을 통해 정책을 조절한다. Test time에는 이전 trial들의 token을 합산해 ensemble context를 만들며, base VLA와 Action DiT의 가중치는 고정한다.

# Experiments / Results

Nominal 환경에서 base 평균 성공률은 88.8%였지만 actuation bias에서는 7.5%, joint encoder offset에서는 5.0%로 급락했다. Self-Adaptive VLA는 단일 context로 각각 45.0%와 46.3%까지 복구했고, 최대 6개 trial context를 합치면 72.5%와 75.0%에 도달했다. 이는 nominal 대비 성능 회복률 80%와 84%다.

| 하드웨어 조건             |  Base | Self-Adaptive | + Ensemble | 해석                                      |
| ------------------------- | ----: | ------------: | ---------: | ----------------------------------------- |
| Actuation bias 평균       |  7.5% |         45.0% |      72.5% | 반복 context로 nominal 성능의 80% 회복    |
| Joint encoder offset 평균 |  5.0% |         46.3% |      75.0% | 반복 context로 nominal 성능의 84% 회복    |
| Nominal 평균              | 88.8% |             - |          - | 하드웨어 shift가 base VLA를 거의 무력화함 |

# Limitations / Discussion

학습 단계에서 shift 종류와 범위를 설계해 주입해야 하므로 완전히 새로운 failure mode에 대한 일반화는 보장되지 않는다. Episode마다 scene을 reset하고 최대 6번 시도한 뒤 그중 한 번 성공하면 성공으로 계산하므로, first-try reliability와 무중단 작업 능력은 별도로 봐야 한다.

Context token 합산은 단순하고 효율적이지만 서로 충돌하는 변화가 누적되거나 환경 자체가 비정상적으로 변할 때는 잘못된 보정을 강화할 수 있다. 평가 과업도 10~15초의 정밀 조작 네 개에 집중되어 장기 mobile manipulation이나 빠르게 변하는 payload에는 추가 검증이 필요하다.

# 내가 이해한 핵심

실패 trajectory는 버릴 데이터가 아니라 현재 로봇의 숨은 calibration 상태를 측정한 probe다. 정책이 이 기록을 읽고 다음 trial의 action distribution을 바꾸면, 현장 재보정 없이도 시행착오 자체가 adaptation signal이 된다.

# 다음에 연결해서 읽을 논문

- Gated Memory Policy: long-horizon context를 cross-attention으로 회수하는 비교 방법
- SmoLSTM: 지속 recurrent memory를 갖는 compact VLA
- H-VLA: 장기 과업에서 key action reasoning과 motion planning을 분리하는 계층형 VLA
- CompVLA: 하드웨어 interaction property를 action space로 확장하는 접근
