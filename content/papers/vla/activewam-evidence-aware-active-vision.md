---
title: "ActiveWAM: Evidence-Aware Active Vision for World-Action Models"
date: 2026-10-04
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Renjun Wu, Luzhou Ge, Xuesong Li"
paper: "https://arxiv.org/abs/2610.01698"
code: ""
project: "https://icr-lab.github.io/ActiveWAM"
thumbnail: "/papers/assets/vla/activewam-evidence-aware-active-vision/overview.svg"
---

# 한 줄 요약

ActiveWAM은 카메라 pan/tilt와 양팔 행동을 하나의 world-action generator에서 함께 생성하고, task-guided history inversion으로 “기존 단서를 유지할지 새 시점을 얻을지”를 학습해 RoboTwin-AV compound shift 성공률을 33.3%에서 53.3%로 높인다.

# 논문 정보

- 제목: ActiveWAM: Evidence-Aware Active Vision for World-Action Models
- 저자: Renjun Wu, Luzhou Ge, Xuesong Li
- 발표: arXiv:2610.01698v1 (2026-10-01), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.01698) · [프로젝트](https://icr-lab.github.io/ActiveWAM)
- 코드/프로젝트: 공식 프로젝트 페이지는 확인했으나 arXiv 메타데이터에서 코드 저장소는 확인되지 않았다.
- 키워드: active vision, world-action model, camera control, evidence retention, history inversion, bimanual manipulation

# 핵심 아이디어

능동 카메라는 가림을 해소할 수 있지만, finite history window에서는 새 시점을 얻는 순간 이전의 task-critical cue가 밀려날 수 있다. ActiveWAM은 이를 retain–acquire 문제로 정의하고 head pan/tilt와 bimanual action을 같은 WAM이 생성하게 한다.

학습 때는 frozen video prior의 inversion을 이용해 원래 history에서 task-bearing source evidence와 실제 시간 변화를 보존한 변형 history를 만든다. Raw/변형 조건은 동일한 미래와 행동 target을 공유하고, pair-consistency loss가 두 조건의 action velocity를 맞춘다. 배포 때는 inversion, 후보 ranking, information-gain 계산 없이 raw history 한 번으로 head–arm action을 생성한다.

# VLA 관점에서 중요한 이유

대부분의 VLA는 카메라를 고정된 센서로 취급하지만, embodied agent에게 관찰 위치는 행동의 일부다. ActiveWAM은 “어디를 볼지”와 “어떻게 조작할지”를 joint action space로 올리고, future-video prediction을 test-time planner가 아니라 co-training signal로 쓴다. 따라서 능동 지각을 별도 heuristic controller에 맡기지 않고 language-conditioned policy 내부에서 학습하는 사례다.

# Robot / Embodied Setting

- TAVIS: Head/Hands task, GR1T2·Reachy2 embodiment, ID·spatial OOD·initial-pose OOD. 조건별 task·seed당 96 episodes, 3 seeds.
- RoboTwin-AV: RoboTwin 2.0의 50 task에 실행 가능한 pan/tilt를 추가. task당 성공 trajectory 100개 학습, condition·seed당 test 100 episodes, 3 seeds.
- 실제 로봇: AirbotPlay fixed-base dual arm, IQR 2-DoF pan/tilt head, fixed-focal RealSense D455.
- 실제 task: cucumber slicing, egg frying, mixture stir-fry의 2-stage 구성. 방법·task당 20회, 총 60회.

# Method

1. 최근 RGB frame과 각 frame의 camera pose/age를 view-aware history로 인코딩한다.
2. 학습 전용 source-constrained inversion이 task evidence와 visible dynamics를 보존한 transformed history를 만든다.
3. Raw history와 transformed history를 같은 original future/action target에 연결하고 flow-matching 및 pair-consistency loss로 공동 학습한다.
4. Unified WAM의 action branch가 arm action과 pan/tilt/stay/reacquisition을 함께 생성하고, future-video branch는 보조 학습 신호를 제공한다.
5. 추론에서는 raw history만 입력하고 짧은 action prefix를 실행한 뒤 실제 새 RGB 관찰로 context를 갱신한다.

# 핵심 그림

![원본과 task-guided inversion history가 같은 미래와 head-arm action target을 감독하고 배포에서는 raw history만 사용하는 ActiveWAM 구조](/papers/assets/vla/activewam-evidence-aware-active-vision/overview.svg)

> 논문 Figure 2와 Sections 3.3–3.4를 바탕으로 재구성했다. 이 그림을 고른 이유는 학습 시 evidence-preserving paired path와 추론 시 단일 raw path의 차이, 그리고 head와 arm을 한 action branch에서 생성하는 핵심을 동시에 보여주기 때문이다. 출처: [논문 Figure 2](https://arxiv.org/html/2610.01698#S3).

학습 입력은 raw view-aware history와 이를 변환한 evidence-preserving history의 쌍이다. 두 경로는 동일한 future video/action target을 사용하며 pair consistency로 행동 예측을 정렬한다. 배포에서는 변환 경로와 video decoding을 제거하고, raw history에서 head–arm chunk를 생성해 일부만 실행한 뒤 새 관찰을 다시 넣는다. 기존 active-vision pipeline과 달리 gaze heuristic과 manipulation policy가 분리되지 않는다.

# Experiments / Results

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓)                  | 제안 방법 |               비교 기준 |    차이 | 출처         |
| ------------------------------------------------- | --------: | ----------------------: | ------: | ------------ |
| RoboTwin-AV 50-task compound shift 성공률 (%, ↑)  |      53.3 |       $\pi_{0.5}$ 34.0 | +19.3%p | 논문 Table 2 |
| RoboTwin-AV 50-task compound shift 성공률 (%, ↑)  |      53.3 |         Fast-WAM 33.3   | +20.0%p | 논문 Table 2 |
| TAVIS Head/GR1T2 spatial OOD 성공률 (%, ↑)        |      47.0 | strongest baseline 30.0 | +17.0%p | 논문 Table 1 |
| 실제 3개 physical kitchen task 전체 완료율 (%, ↑) |      50.0 |         Fast-WAM 23.3   | +26.7%p | 논문 Table 8 |
| 실제 3개 task 전체 완료율, inversion 효과 (%, ↑)  |      50.0 |  w/o inversion 36.7     | +13.3%p | 논문 Table 8 |

RoboTwin-AV 수치는 50 task, 3 seeds, task·seed·condition당 100 episodes의 동일 sensor/action interface 비교다. 실제 로봇 전체 완료율은 각 task 20회, 방법당 60회에서 ActiveWAM 30/60, Fast-WAM 14/60이다. Stage switching은 미리 정해져 있고 두 stage 사이 human action은 평가에 포함되지 않는다.

# Limitations / Discussion

실제 시스템은 fixed focal length, 짧은 history, prescribed stage switching을 사용한다. 카메라 field of view 밖 target이 실패 30건 중 5건을 차지해 pan/tilt만으로 관찰 가능성을 보장하지 못한다. RoboTwin-AV demonstration collector는 학습 데이터 생성 때 instance mask와 depth라는 privileged input을 사용하며, 실제 성능 향상 중 benchmark/collector 설계의 기여와 architecture 기여를 완전히 분리하기 어렵다. Future video는 학습 신호로 유효하지만 실제 추론에서 decode하지 않으므로 “예측을 이용한 온라인 계획”으로 해석하면 안 된다.

# 내가 이해한 핵심

ActiveWAM의 문제 설정은 단순히 카메라를 움직이는 것이 아니라, 제한된 기억 안에서 이미 본 증거를 보존하는 동시에 다음 증거를 획득하는 것이다. History inversion은 이 trade-off를 학습 데이터에서 노출하고, unified action head는 시선과 손의 결과를 같은 생성 과정에서 맞춘다.

# 다음에 연결해서 읽을 논문

- TAVIS: active gaze benchmark의 task와 OOD protocol을 이해하기 위해
- Fast-WAM: future-video prediction을 co-training signal로만 쓰는 기반 설계를 비교하기 위해
- AV-ALOHA: 능동·고정·wrist camera를 분리해 비교하는 bimanual active-vision 기준선을 보기 위해
