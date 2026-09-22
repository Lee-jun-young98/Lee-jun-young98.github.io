---
title: "IMLE-VLA: Fast Single-Step Action Generation for Vision-Language-Action Policies"
date: 2026-09-12
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Robot Manipulation"
  - "Efficient Inference"
venue: "IROS 2026"
authors: "Kian Hosseinkhani, Qinhe Peng, George Shramko, Mehran Aghabozorgi, Jianing Qian, Tristan Engst, Alireza Moazeni, Dinesh Jayaraman, Ke Li"
paper: "https://arxiv.org/abs/2609.10915"
code: ""
project: "https://kianhk6.github.io/IMLE-VLA/"
---

# 한 줄 요약

IMLE-VLA는 반복적인 diffusion/flow-matching sampling을 cIMLE 기반 단일 단계 action head로 바꿔, 멀티모달 행동 분포를 유지하면서 VLA 추론 속도와 실제 로봇의 부드러움·반응성을 함께 높인다.

# 논문 정보

- 제목: IMLE-VLA: Fast Single-Step Action Generation for Vision-Language-Action Policies
- 저자: Kian Hosseinkhani, Qinhe Peng, George Shramko, Mehran Aghabozorgi, Jianing Qian, Tristan Engst, Alireza Moazeni, Dinesh Jayaraman, Ke Li
- 발표: IEEE/RSJ International Conference on Intelligent Robots and Systems (IROS) 2026
- 링크: [arXiv](https://arxiv.org/abs/2609.10915)
- 코드/프로젝트: [프로젝트 페이지](https://kianhk6.github.io/IMLE-VLA/), 별도 코드 저장소 링크는 확인 필요
- 키워드: VLA, cIMLE, single-step generation, action chunking, inference latency, multimodal policy

# 핵심 아이디어

연속 action head를 쓰는 최신 VLA는 diffusion 또는 flow matching으로 행동을 여러 번 갱신한다. 예를 들어 $\pi_{0.5}$는 action chunk 하나를 만들 때 10번의 Euler step을 수행한다. 표현력은 좋지만 매 replan마다 순차 계산이 생겨 실제 로봇이 다음 명령을 기다리는 stop-and-go 현상을 만든다.

단순 L1/L2 회귀로 한 번에 행동을 예측하면 빠르지만, 같은 관찰에서도 여러 행동 경로가 가능한 로봇 데이터에서 평균적인 행동으로 수렴하는 mode collapse가 생긴다. IMLE-VLA는 하나의 관찰마다 여러 noise-conditioned 행동 후보를 만들고 정답에 가장 가까운 후보만 학습하는 conditional Implicit Maximum Likelihood Estimation(cIMLE)을 사용한다. 추론 때는 noise 하나와 관찰을 action head에 한 번만 통과시키므로 반복 sampling이 필요 없다.

# VLA 관점에서 중요한 이유

이 논문은 VLA의 병목이 거대한 VLM backbone뿐 아니라 action distribution을 생성하는 방식에도 있다는 점을 분리해 보여준다. backbone을 줄이거나 teacher를 증류하지 않고 action head만 교체해 속도를 높이므로, semantic generalization 능력을 보존하면서 제어 주기를 짧게 만들 수 있다.

또한 높은 inference frequency를 단순 시스템 지표가 아니라 로봇 행동 품질과 연결한다. 빠른 재계획은 stale observation으로 행동하는 시간을 줄여 동적 물체를 추적하고, 미끄러짐 같은 실패를 빨리 감지해 복구하게 한다. 즉 VLA의 latency는 배포 비용뿐 아니라 closed-loop policy 성능의 일부다.

# Robot / Embodied Setting

- 시뮬레이션: Franka Emika Panda 기반 LIBERO 40개 tabletop manipulation task와 LIBERO-plus 분포 변화
- 실제 로봇: Franka Emika Panda, 단일 단계·다단계·동적 환경을 포함한 4개 task
- 입력: 두 시점 RGB 관찰, 자연어 지시, proprioceptive state
- 출력: 고정 길이의 연속 action chunk
- 실행: receding-horizon 방식으로 chunk의 앞 $H$개 action을 실행한 뒤 재관찰·재계획
- 기준 모델: $\pi_{0.5}$의 3B VLM backbone과 action head 구성을 출발점으로 사용

# Method

VLM backbone은 동결하고, 관찰의 vision-language embedding과 Gaussian noise를 받아 전체 action chunk를 한 번에 내는 generator만 학습한다. generator는 사전 학습된 $\pi_{0.5}$ action head로 초기화한다.

학습 시 각 observation-action pair마다 $m$개의 noise를 뽑아 $m$개 행동 후보를 병렬 생성한다. 정답 chunk와 L2 거리가 가장 가까운 후보를 고른 뒤 그 후보만 정답에 맞도록 업데이트한다. 여러 후보가 서로 다른 행동 mode를 담당할 수 있어 모든 출력을 조건부 평균으로 끌어당기는 일반 회귀의 문제를 피한다. 논문에서는 $m=2$가 효율과 표현력의 균형이 좋다고 보고한다.

VLM embedding은 후보 간 공유하고 최근접 후보 선택에는 gradient를 계산하지 않으므로, 추가 학습 비용을 작게 유지한다. 추론에는 후보 선택이나 teacher model이 필요하지 않다.

# Experiments / Results

NVIDIA L40S에서 원래 JAX $\pi_{0.5}$는 15 Hz, 최적화된 PyTorch/Triton 구현은 20/25 Hz였고 IMLE-VLA는 동일한 backbone으로 55 Hz를 기록했다. 원본 대비 inference frequency는 3.67배이며, 실행 horizon을 30으로 늘린 설정에서는 action throughput이 최대 11배가 됐다.

LIBERO의 40개 task에서 $H=10$일 때 평균 성공률 98.0%를 기록해 $\pi_{0.5}$의 97.5%와 비교 방법들을 웃돌았다. 배경, 초기 robot state, language, layout을 교란하는 LIBERO-plus에서도 $\pi_{0.5}$ 수준의 강건성을 유지했다.

실제 로봇 4개 task에서는 $\pi_{0.5}$보다 모든 task에서 높은 성공 성능을 보였고, proprioceptive jerk를 2.2~3.0배 낮췄다. episode당 VLA forward-pass 시간은 3.9~6.6배 줄었다. 움직이는 plate 위 pineapple을 잡는 task에서는 짧아진 실시간 replan 주기가 오래된 관찰을 따라가는 문제를 줄였다.

# Limitations / Discussion

논문은 계산 효율을 L40S 한 종류에서 주로 측정한다. 다른 GPU, edge accelerator, batch size, quantization 환경에서도 동일한 상대 속도가 유지되는지는 별도 검증이 필요하다.

실제 실험은 한 종류의 로봇과 4개 task에 한정된다. contact-rich 양팔 조작, mobile manipulation, 더 긴 horizon에서 single-step generator가 multimodality와 안정성을 유지하는지는 아직 열려 있다.

cIMLE는 추론을 단일 단계로 만들지만 학습에서는 observation마다 여러 후보를 생성하고 최근접 후보를 고른다. 논문 설정에서는 추가 비용이 작지만, 더 큰 sample factor나 더 긴 action chunk로 확장할 때의 학습 비용과 mode coverage 관계는 추가 분석이 필요하다.

긴 execution horizon은 throughput을 높이는 동시에 open-loop 구간을 늘린다. 따라서 11배 throughput 수치를 11배 높은 closed-loop control rate로 해석하면 안 되며, 환경 변화가 빠를수록 inference frequency와 horizon 사이의 균형이 중요하다.

# 내가 이해한 핵심

IMLE-VLA의 핵심은 “빠른 VLA”를 작은 모델의 문제로만 보지 않는 것이다. action head가 멀티모달 행동을 표현하려고 반복 sampling하는 구조 자체를 바꾸면, backbone의 지식을 유지하면서도 한 번의 forward pass로 행동을 만들 수 있다. 그리고 이 계산 절약은 실제 로봇에서는 대기 시간 감소, 더 잦은 관찰 갱신, 더 부드러운 궤적으로 나타난다.

# 다음에 연결해서 읽을 논문

- $\pi_{0.5}$: IMLE-VLA가 교체하는 flow-matching action head와 기준 성능 이해
- OpenVLA-OFT: L1 regression 기반 단일 단계 action generation과의 비교
- Shallow-$\pi$: backbone/action expert 증류를 통한 VLA 가속과의 비교
- FAST: 연속 행동을 효율적인 token sequence로 바꾸는 다른 추론 가속 관점
