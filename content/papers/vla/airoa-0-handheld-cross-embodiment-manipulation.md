---
title: "AIRoA-0: Long-Horizon, Precise, Cross-Embodiment Manipulation from Handheld Data"
date: 2026-11-04
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Yueh-Hua Wu, Kei Ota, Hanlong Li, Hayata Yuasa, Jason Wang, Kengo Ikeuchi, Kensuke Chiyoma, Makoto Sugiura, Masafumi Takahashi, Masatoshi Tateno, Naoaki Kanazawa, Nicola Scianca, Petr Khrapchenkov, Satoshi Otsubo, Takehiko Ohkawa, Takuya Okubo, Tatsuya Matsushima, Yuki Noguchi, Yuma Shin, Zixuan Zhong"
paper: "https://arxiv.org/abs/2611.03815"
project: "https://a-0.airoa.io"
thumbnail: "/papers/assets/vla/airoa-0-handheld-cross-embodiment-manipulation/overview.svg"
---

# 한 줄 요약

AIRoA-0는 로봇 시연 없이 16,151시간의 YUBI 핸드헬드 양팔 데이터만으로 pre/post-training하고, gripper 기준 action·단계 추적·streaming decoding을 결합해 미지 장소와 여러 로봇에서 긴 정밀 조작을 수행한다.

# 논문 정보

- 제목: AIRoA-0: Long-Horizon, Precise, Cross-Embodiment Manipulation from Handheld Data
- 저자: Yueh-Hua Wu, Kei Ota 외 19명
- 발표: 확인 필요 (arXiv v1, 2026-11-02)
- 링크: [arXiv](https://arxiv.org/abs/2611.03815) · [HTML](https://arxiv.org/html/2611.03815)
- 코드/프로젝트: [공식 프로젝트](https://a-0.airoa.io) (dataset·weights·post-training recipe 공개 예고)
- 키워드: handheld demonstration, cross-embodiment, bimanual manipulation, long horizon, flow matching, streaming decoding

# 핵심 아이디어

사람과 로봇이 공유할 수 없는 base/joint/world 좌표를 버리고, 같은 YUBI gripper와 wrist camera를 데이터 수집과 실행 양쪽에 쓴다. action을 관측 시점 gripper pose에 대한 anchored target으로 정의해 사람의 손과 여러 robot arm을 같은 좌표로 묶는다. 여기에 visual evidence budget, task/subtask 이중 언어, stage prediction, 짧은 proprioceptive memory, non-uniform streaming decoder를 하나의 시스템으로 구성한다.

# VLA 관점에서 중요한 이유

대규모 로봇 trajectory가 아니라 **로봇이 전혀 등장하지 않는 수집 가능한 데이터**로 foundation policy를 학습할 수 있음을 강하게 보인다. 같은 task demonstration으로 post-training한 네 VLA 중 최강 baseline 평균 27% 대비 A-0가 78%(+51%p)를 기록했고, robot별 재학습 없이 Franka·TX-G2·OpenArm·UR에 같은 weights를 사용했다. 데이터 인터페이스, 모델, 장기 과제 상태 추적, 실시간 실행을 함께 설계한 점이 단순한 backbone 개선보다 중요하다.

# Robot / Embodied Setting

pre-training corpus는 YUBI 두 개로 수집한 16,151시간, 10.65M subtask segment, 1.74B timestep이며 두 wrist RGB, gripper pose/opening, task와 subtask instruction을 포함한다. 평가는 훈련 데이터를 수집하지 않은 장소의 bimanual Franka에서 10개 장기 task를 task당 15회 수행하고, TX-G2 humanoid·OpenArm·dual UR에도 동일 weights를 이식한다. 로봇 데이터, teleoperation, RL, on-robot correction은 쓰지 않는다.

# Method

1. $\pi_{0.5}$의 SigLIP–Gemma 2B–300M flow action expert를 초기화하고, 두 wrist image·instruction·proprioception에서 20 Hz action chunk를 예측한다.
2. 각 action은 $a_k=T_i^{-1}T_{i+k}$인 gripper-relative anchored target이다. robot base나 joint에 의존하지 않아 handheld와 서로 다른 arm이 같은 action space를 공유한다.
3. pre-training에서는 visual budget gate가 action loss로 task-relevant image token을 선택하고, task/subtask instruction을 번갈아 조건으로 쓰며 현재 subtask text 예측을 보조 손실로 학습한다.
4. post-training에서는 stage head가 긴 task의 현재 단계를 분류하고 그 stage를 text로 action expert에 전달한다. 최근 10개 proprioceptive state는 네 memory token으로 압축한다.
5. 추론 harness는 stage probability를 EMA로 평활화하고, 두 noise slot $(0.1,1)$의 non-uniform streaming decoding으로 새 관측에 반응하면서 chunk 경계를 연속적으로 만든다.

# 핵심 그림

![AIRoA-0의 핸드헬드 데이터에서 여러 로봇 실행까지 이어지는 전체 아키텍처](/papers/assets/vla/airoa-0-handheld-cross-embodiment-manipulation/overview.svg)

> 논문 Figure 6–7과 Sections 3–6을 바탕으로 재구성한 AIRoA-0 전체 파이프라인. 출처: [논문 HTML Figure 6–7 및 Method](https://arxiv.org/html/2611.03815#S3). 원본을 복제하지 않고 입력·학습 모듈·추론 흐름을 한국어로 다시 그렸다.
>
> 이 구조 그림을 고른 이유는 성능의 원인이 단일 neural block이 아니라 데이터 인터페이스부터 execution harness까지 이어진 결합 설계이기 때문이다. 학습에서는 YUBI wrist view와 anchored action을 visual budget·이중 언어·subtask loss로 pre-train하고, task별 post-training에서 stage head와 memory를 붙인다. 추론에서는 task instruction과 두 wrist view가 stage-conditioned action expert를 거쳐 anchored chunk가 되고, stage EMA와 streaming decoder가 이를 여러 robot arm의 연속 제어로 바꾼다.

# Experiments / Results

## 주요 실험 결과

| 설정 / 지표 (success rate %, ↑)       | A-0 |      비교 기준 |  차이 | 출처    |
| ------------------------------------- | --: | -------------: | ----: | ------- |
| Franka 10-task 평균, task당 15 trials |  78 | $\pi_{0.5}$ 27 | +51%p | Table 1 |
| Colour sorting                        |  97 | $\pi_{0.5}$ 45 | +52%p | Table 1 |
| Robot vacuum 장기 task                |  73 |        XR-1 14 | +59%p | Table 1 |
| Fuel bracket                          |  93 |  GR00T N1.7 47 | +46%p | Table 1 |
| Towel folding                         |  73 | $\pi_{0.5}$ 22 | +51%p | Table 1 |

비교 모델은 $\pi_{0.5}$, Xiaomi-Robotics-1, GR00T N1.7, MolmoAct2이며 같은 task demonstration으로 post-training됐다. baseline은 task별로 action horizon·frequency·update 수를 탐색한 최적값이고 A-0는 10개 task에 하나의 recipe를 사용한다. A-0는 모든 task에서 1위지만 earbuds는 30%로 절대 성능이 낮다. streaming inference는 H200에서 query당 약 60 ms이며 action expert를 표준 10회 대신 steady-state 두 번 평가한다.

# Limitations / Discussion

공식 top-conference venue는 확인되지 않았다. A-0의 cross-embodiment 범위는 동일한 YUBI gripper와 wrist-camera geometry를 장착한 robot으로 제한되므로, arbitrary end effector나 camera layout으로의 전이는 검증되지 않았다. 16,151시간 수집과 8×H200 pre-training 자원은 크며 baseline과 동일한 data scale의 pre-training 비교는 아니다. task당 15 trials와 partial credit를 쓴 평가, 일부 낮은 절대 성공률(earbuds 30%)도 장기 과제 신뢰성을 판단할 때 고려해야 한다. 명시적 failure/recovery data가 없고 안전성 평가도 보고되지 않았다.

# 내가 이해한 핵심

AIRoA-0의 진짜 scaling trick은 사람 동작을 robot action으로 번역하는 더 복잡한 model이 아니라, **수집 도구를 그대로 robot end effector로 만들어 domain gap을 인터페이스에서 제거한 것**이다. anchored action이 embodiment 차이를 줄이고, stage·memory·streaming이 긴 task에서 남는 시간적 모호성과 실행 지연을 처리한다.

# 다음에 연결해서 읽을 논문

- [Universal Manipulation Interface](https://arxiv.org/abs/2402.10329): handheld gripper demonstration의 출발점
- [YUBI](https://arxiv.org/abs/2606.10244): A-0가 공유하는 수집·실행 hardware interface
- [See Less, Specify More](https://arxiv.org/abs/2605.16755): visual evidence budget와 세분화된 language conditioning
- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): A-0가 확장한 VLA backbone
