---
title: "TANGO: Humanoid Navigation in Cluttered Environments with a Whole-Body Vision-Language-Action Model"
date: 2026-09-12
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Humanoid"
  - "Vision-Language Navigation"
venue: "arXiv 2026 (venue 확인 필요)"
authors: "Anqi Li, Yuxin Chen, Zhaobo Li, Zhuo Cao, Junli Ren, Masayoshi Tomizuka, Dhruv Shah"
paper: "https://arxiv.org/abs/2609.09158"
code: ""
project: "https://tango-vla.github.io/tango-vla.github.io"
---

# 한 줄 요약

TANGO는 자연어 지시와 두 시점의 RGB 관찰로부터 휴머노이드의 29-DoF 전신 액션을 직접 생성해, 좁은 통로·낮은 장애물·머리 위 장애물이 섞인 실내를 전신으로 통과하게 만드는 VLA 기반 내비게이션 시스템이다.

# 논문 정보

- 제목: TANGO: Humanoid Navigation in Cluttered Environments with a Whole-Body Vision-Language-Action Model
- 저자: Anqi Li, Yuxin Chen, Zhaobo Li, Zhuo Cao, Junli Ren, Masayoshi Tomizuka, Dhruv Shah
- 발표: arXiv 2026, cs.RO / cs.AI, venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2609.09158)
- 코드/프로젝트: [프로젝트 페이지](https://tango-vla.github.io/tango-vla.github.io), 공개 예정으로 명시됐으나 현재 코드 저장소는 확인 필요
- 키워드: VLA, humanoid navigation, whole-body control, vision-language navigation, flow matching, sim-to-real

# 핵심 아이디어

기존 vision-language navigation은 대개 2D waypoint나 이산 이동 명령을 예측한다. 그러나 휴머노이드는 경로의 중심선만 맞는다고 통과할 수 있는 것이 아니다. 좁은 틈에서는 옆걸음을 하고, 바닥 장애물은 넘으며, 머리 위 장애물 아래에서는 상체를 낮춰야 한다. TANGO는 이 간극을 줄이기 위해 내비게이션 의사결정과 전신 자세 생성을 하나의 VLA 문제로 묶는다.

학습 데이터는 Plan–Edit–Track(PET) 파이프라인으로 전부 시뮬레이션에서 만든다. 먼저 A\* 기반 경로와 보행 모션을 만들고, 장애물 종류에 맞춰 팔 회피·발 디딤·상체 굽힘을 편집한 뒤, 저수준 tracker로 실제 실행 가능성과 충돌 여부를 검사한다. 검증을 통과한 64,633개 궤적이 전신 action supervision으로 사용된다.

# VLA 관점에서 중요한 이유

TANGO의 중요한 변화는 VLA의 action space를 팔과 gripper 중심의 조작에서 전신 이동으로 확장했다는 점이다. 언어 지시는 목적지만 정하는 것이 아니라 “옆으로 통과하라”, “장애물을 넘어가라” 같은 통과 방식까지 조건으로 제공하며, 정책은 장면 의미와 3D 신체 제약을 함께 반영해야 한다.

또한 VLM이 고수준 명령을 내리고 별도 이동기가 실행하는 전형적인 계층형 구성 대신, VLA가 실행 가능한 전신 reference motion을 직접 예측한다. 이 설계는 의미 이해와 신체적 가능성 사이의 인터페이스를 학습 대상으로 만든다는 점에서 휴머노이드 foundation model의 중요한 방향을 보여준다.

# Robot / Embodied Setting

- 플랫폼: Unitree G1 휴머노이드
- 입력: 자연어 지시, 전방·하방 RGB 카메라의 시간적 관찰, 현재 관절 proprioception
- 출력: 29개 관절 목표와 base pose를 포함하는 전신 action chunk
- 환경: 일반 실내와 좁은 통로, 바닥 장애물, 머리 위 장애물이 추가된 cluttered indoor scenes
- 실행: 서버의 저주파 VLA 추론과 온보드 SONIC tracker의 고주파 제어를 결합
- 학습/전이: 시뮬레이션 데이터만 학습하고 실제 G1에는 추가 real-world 학습 없이 zero-shot 배포

# Method

TANGO는 세 층으로 구성된다. System-2는 Qwen2.5-VL-7B를 InternVLA-N1 가중치로 초기화한 vision-language backbone이다. 과거 프레임은 Budget-Aware Token Sampling으로 선택하고, 최근 관찰에는 더 높은 공간 해상도를 배정해 긴 경로의 문맥과 현재 장애물을 함께 본다.

System-1은 latent context와 proprioception을 조건으로 미래 전신 action chunk를 생성하는 flow-matching 기반 multimodal diffusion transformer다. 학습 시 이미 실행이 확정된 action prefix를 무작위로 주고 나머지를 복원하도록 해, 실제 streaming action chunk 실행과 학습 조건의 차이를 줄인다.

System-0은 사전 학습된 SONIC motion tracker다. VLA가 낸 전신 reference를 물리적으로 안정적인 고주파 관절 명령으로 추적한다. 데이터 측면에서는 578개 원본 장면을 장애물로 확장하고 PET로 경로 계획, 모션 편집, 동역학 검증을 거쳐 총 64,633개 궤적을 만들었다.

# Experiments / Results

VLNVerse의 seen/unseen split에서 TANGO는 비교 대상 중 가장 높은 성공률과 가장 낮은 보고 navigation error를 달성했다. 다만 다른 VLN baseline은 teleportation 조건으로 평가되고 TANGO만 저수준 물리 제어를 포함하므로, 절대 수치 비교에는 평가 조건 차이를 함께 봐야 한다.

장애물로 확장한 unseen 환경에서는 성공률 43.75%, SPL 31.83, collision rate 9.90%를 기록했다. 가장 강한 비교 설정인 fine-tuned InternVLA-N1 + HumanoidPF는 성공률 41.88%, SPL 29.49, collision rate 15.81%였다. TANGO는 RGB만 사용한 반면 해당 HumanoidPF 실행기는 LiDAR 입력도 사용했다.

실제 G1 실험은 약 10m 단거리, 약 30m 장거리, 전신 장애물 통과 설정에서 각각 방법당 15회 시행했다. 논문은 baseline보다 높은 성공률과 적은 평균 충돌을 보고하며, 좁은 통로 옆걸음·몸 숙이기·장애물 넘기에서 시뮬레이션만으로 학습한 정책의 zero-shot 전이를 보였다.

# Limitations / Discussion

첫째, 현재 확인되는 공개 상태는 arXiv v1이며 top conference 채택 여부는 확인 필요하다. 프로젝트 페이지는 데이터·모델·배포 시스템 공개 계획을 밝히지만, 실제 재현에 필요한 코드와 체크포인트의 가용성은 계속 확인해야 한다.

둘째, 시뮬레이션 benchmark에서 비교 모델과 실행 조건이 완전히 같지 않다. TANGO는 물리적 tracker를 포함하지만 일부 baseline은 teleportation으로 평가되므로, 표의 순위를 곧바로 정책 자체의 우열로 읽기 어렵다.

셋째, 실제 실험은 세 설정에서 각 15회로 규모가 작고, cluttered 조건의 언어 지시가 필요한 통과 행동을 명시한다. 보지 못한 장애물 조합을 스스로 추론하거나 실패 후 복구하는 능력은 추가 검증이 필요하다.

넷째, VLA 추론은 외부 RTX PRO 6000 서버에 의존한다. 온보드 완결형 시스템이나 네트워크 지연·단절이 있는 환경에서의 안정성은 별도 과제로 남는다.

# 내가 이해한 핵심

TANGO의 핵심은 휴머노이드 내비게이션에서 “어디로 갈 것인가”와 “그 몸으로 어떻게 통과할 것인가”를 분리하면 안 된다는 주장이다. 2D 경로는 전신 충돌 가능성을 표현하지 못하므로, VLA가 신체 자세까지 포함한 action chunk를 내고 저수준 tracker가 이를 안정적으로 실행하게 한다.

동시에 이 논문은 전신 VLA의 병목이 모델만이 아니라 데이터 생성에 있음을 보여준다. PET는 값비싼 모션 캡처 대신 계획·편집·동역학 검증을 연결해 실행 가능한 supervision을 대규모로 합성한다. 즉, action space를 확장하려면 그 공간에서 물리적으로 유효한 데이터를 만드는 파이프라인도 함께 설계해야 한다.

# 다음에 연결해서 읽을 논문

- InternVLA-N1: An Open Dual-System Vision-Language-Action Model for Navigating In the Real World
- SONIC: Supersizing Motion Tracking for Natural Humanoid Whole-Body Control
- HumanoidPF: Learning 3D Humanoid Locomotion with Potential Fields
- WholeBodyVLA: Towards Unified Latent VLA for Whole-Body Loco-Manipulation Control
- pi0: A Vision-Language-Action Flow Model for General Robot Control
