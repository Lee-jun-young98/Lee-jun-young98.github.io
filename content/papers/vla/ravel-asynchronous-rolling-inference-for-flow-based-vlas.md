---
title: "RAVEL: Asynchronous Rolling Inference for Flow-Based Vision-Language-Action Models"
date: 2026-09-29
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Flow Matching"
  - "Real-Time Control"
venue: "확인 필요"
authors: "Yuhan Chen, Ke Yu, Pengfei Liu, Shuxun Wang, Yi Yang, Linchao Zhu"
paper: "https://arxiv.org/abs/2609.34170"
code: ""
project: ""
---

# 한 줄 요약

RAVEL은 미래 action buffer를 한 step씩 계속 denoise하고 VLM encoding을 별도 worker로 분리해, flow-based VLA의 첫 행동 지연을 약 2.6~2.9배 줄이면서 동적 조작 반응성을 높인다.

# 논문 정보

- 제목: RAVEL: Asynchronous Rolling Inference for Flow-Based Vision-Language-Action Models
- 저자: Yuhan Chen, Ke Yu, Pengfei Liu, Shuxun Wang, Yi Yang, Linchao Zhu
- 발표: 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2609.34170), [HTML](https://arxiv.org/html/2609.34170)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: flow-based VLA, asynchronous inference, rolling denoising, latency, dynamic manipulation

# 핵심 아이디어

일반적인 flow VLA는 새 관측마다 VLM encoding과 여러 단계 denoising을 순차 실행한 뒤에야 첫 행동을 낸다. RAVEL은 미래 행동들을 noise level이 다른 rolling buffer에 유지하고 매 control step 한 번만 denoise한 뒤 가장 가까운 행동을 즉시 실행한다.

느린 VLM context는 비동기로 갱신하고 action expert는 마지막으로 도착한 context로 계속 돈다. Temporal-offset conditioning은 그 context가 몇 step 오래됐는지 알려 주며, Fast Observation Pathway(FOP)는 최신 영상·proprioception의 가벼운 feature를 action expert에 직접 공급한다.

# VLA 관점에서 중요한 이유

정적 benchmark에서는 inference 시간이 환경 시간에 반영되지 않아 느린 VLA도 높은 성공률을 얻을 수 있다. RAVEL은 latency를 실제 제어 변수로 다뤄, 움직이는 물체나 탁구공처럼 관측이 빠르게 낡는 상황에서 모델 성능과 시스템 실행 성능의 차이를 보여 준다.

# Robot / Embodied Setting

- 정적 시뮬레이션: π0.5/LIBERO, X-VLA/RoboTwin 2.0
- 동적 시뮬레이션: Dynamic Object Manipulation, 9개 평가 차원, 총 1,800 episodes
- 실로봇: xArm7 table-tennis return 및 tennis-ball grasping, 방법별 과업당 20 trials
- 측정 hardware: first-action latency는 RTX 4090, 실로봇 inference는 RTX 5090
- 비교: DynamicVLA, CI & LAAS, VLASH, FASTER, Sync, Naive Async, RTC

# Method

길이 `K`의 buffer에서 먼 미래 행동은 noise가 많고 가까운 행동은 더 많이 정제된 상태로 유지된다. 각 제어 주기에는 buffer 전체를 한 번 갱신하고 첫 행동을 release한 뒤 끝에 새 noise action을 추가한다.

VLM worker와 action worker를 분리해 encoding 완료를 기다리지 않으며, context age를 offset token으로 알려 실행 시점에 맞는 horizon을 예측한다. FOP는 최신 관측을 가볍게 반영해 느린 semantic context와 빠른 visuomotor feedback을 결합한다.

# 핵심 그림

![동기식 VLA와 달리 VLM context 갱신, rolling denoising, 행동 실행을 겹쳐 수행하는 RAVEL 파이프라인](/papers/assets/vla/ravel-asynchronous-rolling-inference-for-flow-based-vlas/overview.svg)

_논문 Figure 1과 Figure 2를 바탕으로 재구성._ 핵심 기여가 모델 크기보다 세 연산 경로의 시간 중첩에 있으므로 timing 구조를 선택했다. 출처: [논문 원문](https://arxiv.org/html/2609.34170).

# Experiments / Results

RTX 4090에서 first-action latency는 X-VLA가 142.58ms에서 54.97ms로, π0.5가 272.86ms에서 93.45ms로 줄었다. DOM에서는 RAVEL+FOP가 46.94%로 가장 높은 평균 성공률을 기록했고, 실로봇 탁구 return은 90%로 FASTER와 VLASH보다 65%p 높았다.

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓)   | 제안 방법 |             비교 기준 |             차이 | 출처    |
| ---------------------------------- | --------: | --------------------: | ---------------: | ------- |
| X-VLA first-action latency (ms, ↓) |     54.97 | full denoising 142.58 |  -87.61ms, 2.59× | Table 1 |
| π0.5 first-action latency (ms, ↓)  |     93.45 | full denoising 272.86 | -179.41ms, 2.92× | Table 1 |
| DOM 평균 성공률 (%, ↑)             |     46.94 |       CI & LAAS 35.50 |         +11.44%p | Table 2 |
| 실로봇 table-tennis return (%, ↑)  |        90 |             FASTER 25 |            +65%p | Table 3 |
| Table-tennis 관측 age P50 (ms, ↓)  |    121.76 |         FASTER 149.63 |         -27.87ms | Table 3 |

# Limitations / Discussion

RAVEL은 단순한 inference wrapper가 아니라 streaming-aligned training과 temporal-offset conditioning이 필요하다. Pretrained checkpoint에 rolling inference만 바로 적용하면 성능이 크게 떨어진다는 ablation이 이를 보여 준다.

DOM 결과는 로컬 2×RTX 4090 구성에 민감하며 논문도 원 DynamicVLA 보고치와 latency 차이를 명시한다. 실로봇 실험은 과업당 20회라 성공률의 불확실성이 크고, FOP 추가 연산과 비동기 worker scheduling은 다른 hardware에서 다시 측정해야 한다.

# 내가 이해한 핵심

Action chunk를 빨리 만드는 것만으로는 충분하지 않다. 의미 context는 느리게 갱신하되 최신 시각 변화는 빠른 경로로 넣고, 각 행동이 실제 실행될 미래 시점을 명시해야 동적 환경에서 낮은 latency가 성공률로 이어진다.

# 다음에 연결해서 읽을 논문

- Decoupled Early Exits: task별로 flow-matching 계산량을 조절하는 방법
- Fast Plans, Faithful Actions: planner 병렬화로 계층형 VLA 지연을 줄이는 접근
- VLA-Feedback: 빠른 feedback denoising으로 동적 교란에 대응하는 방법
- GeoAAC: denoising trajectory의 기하를 이용해 action chunk 길이를 적응시키는 방법
