---
title: "REACT: Rolling Denoising and Dual Decoupling for Reactive Robot Control with VLA Models"
date: 2026-10-10
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "CoRL 2026 Spotlight (arXiv 저자 표기; 공식 프로그램 확인 필요)"
authors: "Houlong Xiong, Zhenqi Qiu, Zechen Wang, Suohang Zhang, Yiyu Ren, Wanting Xu, Hongfei Niu, Chengyang He, Ge Sun, Ran Cheng, Qian Zhu"
paper: "https://arxiv.org/abs/2610.12007"
code: ""
project: "https://react-vla.github.io/"
thumbnail: "/papers/assets/vla/react-rolling-denoising-for-reactive-vla-control/overview.svg"
---

# 한 줄 요약

REACT는 flow-based VLA의 긴 action horizon을 버리지 않고 블록별 denoising 상태를 다음 관측까지 굴려 보내며, π0.5의 real-world 평균 성공률을 58.7%에서 64.8%로 높이고 짧은 chunk 재계획보다 훨씬 매끄러운 제어를 만든다.

# 논문 정보

- 제목: REACT: Rolling Denoising and Dual Decoupling for Reactive Robot Control with VLA Models
- 저자: Houlong Xiong, Zhenqi Qiu, Zechen Wang, Suohang Zhang, Yiyu Ren, Wanting Xu, Hongfei Niu, Chengyang He, Ge Sun, Ran Cheng, Qian Zhu
- 발표: arXiv:2610.12007v1 (2026-10-08), CoRL 2026 Spotlight는 arXiv 저자 표기이며 공식 프로그램 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.12007) · [HTML 원문](https://arxiv.org/html/2610.12007)
- 코드/프로젝트: [공식 프로젝트 페이지](https://react-vla.github.io/) · 원문에서 코드 저장소 공개는 확인하지 못했다.
- 키워드: flow matching, rolling denoising, reactive control, action chunking, asynchronous inference

# 핵심 아이디어

긴 action chunk는 동작의 일관성과 부드러움을 주지만 새 관측을 늦게 반영하고, 짧은 chunk를 매번 새로 생성하면 반응성은 좋아져도 action mode가 경계에서 흔들린다. REACT는 이를 chunk 길이 선택 문제가 아니라 **denoising 상태를 유지하는 receding-horizon 문제**로 바꾼다.

길이 $H=KS$의 action buffer를 $S$개 action씩 $K$개 블록으로 나누고, 앞 블록은 거의 clean, 뒤 블록은 noise에 가까운 staircase flow time을 갖게 한다. 매 iteration마다 최신 관측으로 전체 buffer를 Euler 한 단계 갱신하고, clean해진 맨 앞 블록만 실행하며, 나머지를 앞으로 shift하고 끝에는 새 Gaussian noise를 붙인다.

# VLA 관점에서 중요한 이유

REACT의 핵심은 더 작은 VLA나 더 빠른 sampler가 아니라, 이미 계산 중인 미래 action을 다음 관측에서 폐기하지 않는 제어 인터페이스다. 한 블록이 실행되기 전 여러 최신 관측으로 반복 정제되므로 장기 action mode와 폐루프 반응성을 동시에 얻는다. 또한 input throughput과 output throughput을 분리해 VLA 실시간성을 단순한 단일 forward latency보다 더 적절한 시스템 지표로 제안한다.

# Robot / Embodied Setting

- backbone: flow-based VLA π0.5; 모든 비교가 같은 backbone을 사용한다.
- simulation: RoboTwin 2.0의 7 tasks, Clean/Randomized, task-condition마다 100 rollouts, task당 50 expert demonstrations.
- real robot: ARX X5와 Franka Research 3, 6 platform-task pairs, task당 30 trials.
- 일반 manipulation: 크기별 bowl stacking, bottle cap unscrewing, cable/keyring hanging.
- specialized dynamic control: Pour Rice와 Reaction Game을 포함해 반응 지연과 동적 제어를 별도 평가한다.

# Method

1. action horizon을 $K$개 블록으로 나누고 위치별 flow time을 $\tau_j=(\lfloor j/S\rfloor+1)/K$로 둔다.
2. 최신 관측으로 VLM embedding을 만들고 DiT가 전체 rolling buffer의 velocity field를 한 번 예측한다.
3. $\widetilde{x}=x-v/K$로 모든 블록을 한 단계 denoise한다.
4. 가장 clean한 앞 블록을 실행하고, 미래 블록을 shift한 뒤 tail에 새 noise를 추가한다.
5. Dual Decoupling은 sensing, VLM encoding, DiT denoising, action execution을 분리하고 latest-ready embedding cache를 사용한다.
6. Staircase training은 추론 때 쓰는 $\{1/K,\dots,1\}$의 모든 noise level을 한 샘플에서 함께 감독해 train–inference schedule을 맞춘다.

# 핵심 그림

![REACT의 rolling action buffer, dual-decoupled inference, staircase training 흐름](/papers/assets/vla/react-rolling-denoising-for-reactive-vla-control/overview.svg)

> 논문 Figure 1과 Method 3.1–3.3을 바탕으로 재구성. 출처: [arXiv HTML, Figure 1](https://arxiv.org/html/2610.12007). 최신 관측으로 전체 horizon을 한 단계 정제하고, 앞 블록을 실행하며, tail에 noise를 보충하는 순환을 나타낸다.

구조 그림을 고른 이유는 성공률보다도 “같은 미래 action 블록이 여러 관측을 거치며 clean해진다”는 상태 이동이 논문의 새로움이기 때문이다. 입력은 카메라·언어·robot state, 주요 모듈은 비동기 VLM worker와 DiT rolling buffer, 출력은 연속 실행되는 clean action block이다. 학습에서는 고정 staircase timestep을 한 번에 감독하고, 추론에서는 그 staircase를 shift하는 점이 표준 flow matching과 다르다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (단위, ↑/↓)            | REACT | π0.5 H50E50 |    차이 | 출처           |
| --------------------------------------- | ----: | ----------: | ------: | -------------- |
| RoboTwin Clean 평균 성공률 (%, ↑)       | 44.86 |       37.43 | +7.43%p | 원문 Table 1   |
| RoboTwin Randomized 평균 성공률 (%, ↑)  | 19.86 |       11.43 | +8.43%p | 원문 Table 1   |
| 실제 로봇 6 task 평균 성공률 (%, ↑)     |  64.8 |        58.7 |  +6.1%p | 원문 Table 2   |
| 실제 ARX X5 Cable Hanging 성공률 (%, ↑) |    80 |          56 |   +24%p | 원문 Table 2   |
| 3k 학습 step 평균 성공률 (%, ↑)         |  52.7 |        25.0 | +27.7%p | 원문 Figure 5b |

완전한 REACT는 Dual Decoupling 때문에 rolling-only 변형의 최고 성공률(실제 로봇 65.7%)보다 0.9%p 낮지만, input/output throughput을 크게 높이는 실용적 타협이다. 또한 짧게 재계획하는 H50E10의 simulation jerk 1463.7보다 REACT 계열 rolling denoising의 1064.7이 낮아, 반응성을 위해 trajectory coherence를 전부 희생하지 않는다는 근거가 된다. jerk 값은 성공 episode만으로 계산되므로 실패가 많은 방법과의 직접 비교에는 주의가 필요하다.

# Limitations / Discussion

- π0.5 한 backbone에서만 검증되어 GR00T N1, X-VLA 같은 다른 dual-system VLA로의 일반화는 아직 주장할 수 없다.
- 각 policy가 고정 $(K,S)$ schedule로 학습되며, 배포 중 schedule을 zero-shot으로 바꾸는 실험이 없다.
- Dual Decoupling은 embedding staleness를 만든다. 보고된 $S=10$, worker 2개 설정에서 평균 age는 233 ms, 최대 416 ms다.
- 전체 horizon을 계속 DiT에 넣으므로 rolling schedule이 latency 자체를 제거하는 것은 아니며, worker memory와 병렬 자원이 필요하다.
- 일부 일반 task에서는 REACT w/o DD가 full REACT보다 성공률이 높아 throughput과 conditioning freshness 사이의 잔여 trade-off가 있다.

# 내가 이해한 핵심

REACT는 “얼마나 자주 새 action chunk를 뽑을까” 대신 “아직 실행하지 않은 action을 어떻게 계속 고쳐 쓸까”를 묻는다. 미래 계획을 버리지 않고 uncertainty가 큰 tail로 밀어 둔 채 최신 관측마다 조금씩 확정하면, 긴 계획의 일관성과 짧은 피드백 주기를 동시에 얻을 수 있다. 이 아이디어는 모델 architecture보다 policy runtime의 상태 관리가 VLA 성능을 좌우할 수 있음을 보여준다.

# 다음에 연결해서 읽을 논문

- RAVEL: flow-based VLA의 비동기 rolling inference와 첫 action latency를 다룬다.
- Catch Me If You Can / VLA-Feedback: action denoising 중 실시간 feedback으로 trajectory를 교정한다.
- GeoAAC: denoising trajectory의 geometry로 action chunk 길이를 적응적으로 고른다.
