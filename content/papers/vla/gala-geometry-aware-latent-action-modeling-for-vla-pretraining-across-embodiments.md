---
title: "GALA: Geometry-Aware Latent Action Modeling for Vision-Language-Action Model Pretraining across Embodiments"
date: 2026-09-21
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Latent Action Model"
  - "Cross-Embodiment"
venue: "확인 필요"
authors: "Yichen Liu, Puzhen Yuan, Xiang Zhu, Yanjiang Guo, Jianyu Chen"
paper: "https://arxiv.org/abs/2609.21948"
code: ""
project: "https://puzhenyuan.github.io/GALA-website/"
---

# 한 줄 요약

GALA는 사람 손과 서로 다른 로봇 end-effector의 3D point-cloud 변화를 공통 latent action으로 학습해, action label이 없는 사람 영상까지 dexterous VLA pretraining에 활용한다.

# 논문 정보

- 제목: GALA: Geometry-Aware Latent Action Modeling for Vision-Language-Action Model Pretraining across Embodiments
- 저자: Yichen Liu, Puzhen Yuan, Xiang Zhu, Yanjiang Guo, Jianyu Chen
- 발표: 확인 필요 (arXiv v1, 2026-09-18)
- 링크: [arXiv](https://arxiv.org/abs/2609.21948), [HTML](https://arxiv.org/html/2609.21948v1)
- 코드/프로젝트: [프로젝트 페이지](https://puzhenyuan.github.io/GALA-website/), 논문은 코드 공개를 명시하나 저장소 링크 확인 필요
- 키워드: latent action model, geometry-aware pretraining, cross-embodiment, dexterous manipulation, human video

# 핵심 아이디어

RGB frame 차이로 학습한 latent action은 장면 수준 움직임은 포착하지만 작은 finger articulation과 접촉 변화를 놓치기 쉽다. GALA는 이미지 기반 visual latent action과 함께, 시작·종료 시점 end-effector의 3D point cloud 전이를 discrete geometric latent action으로 양자화한다.

서로 다른 손 형태의 point correspondence나 공통 joint 정의는 요구하지 않는다. Unified End-effector Motion Representation(UEMR)은 모든 embodiment를 wrist/root 중심의 공통 축으로 정규화하고 왼손·오른손을 공유 codebook에 표현해, 세밀한 움직임과 cross-embodiment semantic alignment를 함께 추구한다.

# VLA 관점에서 중요한 이유

Multi-embodiment VLA는 각 로봇의 action space가 달라 데이터를 그대로 합치기 어렵다. GALA는 executable action 자체가 아니라 end-effector geometry의 변화를 공통 언어로 삼아 사람 손, dexterous hand, parallel gripper 사이를 연결한다.

이 방식은 action label이 없는 egocentric human video도 pretraining 신호로 바꾸면서, 실제 실행 단계에서는 embodiment별 action head를 유지한다. 즉 공통 표현을 강제하되 로봇 고유 제어 공간은 버리지 않는다.

# Robot / Embodied Setting

- Embodiments: human hand, Fourier hand, ROBOTERA XHand, Robotiq gripper
- 데이터: EgoDex, HOI4D, DROID, RoboCasa-GR1, 자체 XHand·human-hand 데이터
- 시뮬레이션: dual multi-finger hand를 가진 GR-1 humanoid의 RoboCasa 24개 과업
- 실제 로봇: 12-DoF XHand
- 실제 과업: Pick and Place, Push Box, Press Button, Flip Cup; 과업별 50 trials

# Method

Human hand는 WiLoR로 MANO mesh와 keypoint를 추정하고, robot hand는 URDF/MJCF와 forward kinematics로 surface point를 얻는다. 각 손을 1,024개 point의 wrist-centered cloud로 만들며 topology correspondence는 사용하지 않는다.

DINOv2·SigLIP image feature와 Point Transformer V3 geometric feature를 language condition과 shared spatiotemporal Transformer에서 융합한다. Visual latent와 geometric latent는 각각 VQ codebook으로 이산화된다. VLA co-training에서는 이 latent prediction을 보조 supervision으로 사용하면서 shared DiT와 embodiment-specific action heads가 실제 action을 생성한다.

# Experiments / Results

GR-1 데이터만 사용한 통제 실험에서 GALA는 RoboCasa 성공률 55.7%로 UniVLA 48.0%, native kinematics 51.8%, OPFA 53.5%를 앞섰다. Multi-embodiment co-training에서는 RoboCasa-GR1 평균 68.3%를 기록했다.

실제 XHand 네 과업 평균은 GALA 75.5%, HARP-VLA 71.5%, $\pi_{0.5}$ 68.0%, OpenVLA-OFT 55.0%, UniVLA 38.0%였다. UEMR를 제거하면 68.5%로 7.0%p 하락해 공통 geometry representation의 기여를 보였다.

# Limitations / Discussion

Human point cloud는 WiLoR/MANO 추정 품질에, robot point cloud는 정확한 URDF/MJCF와 joint state에 의존한다. 가림이 심하거나 도구가 손 형상을 확장하는 상황에서는 end-effector geometry가 실제 접촉 의미를 충분히 나타내지 못할 수 있다.

논문은 별도의 limitations section을 두지 않았고 평가는 네 종류 embodiment, RoboCasa 한 benchmark, 하나의 실제 XHand로 제한된다. Point-cloud 추출과 별도 encoder·codebook이 데이터 전처리 및 학습 복잡도를 늘리며, 더 큰 embodiment 차이에서 codebook이 계속 공유 의미를 유지하는지는 추가 검증이 필요하다.

# 내가 이해한 핵심

관절 번호나 action dimension을 맞추는 대신, 손끝 주변의 3D 형상이 어떻게 변했는지를 공통 action proxy로 삼는다. RGB가 알려주는 장면 변화와 geometry가 알려주는 손가락 변화를 결합해 사람 영상의 dexterity를 로봇 VLA로 옮긴다.

# 다음에 연결해서 읽을 논문

- UniVLA / LAPA: image-based latent action을 이용한 VLA pretraining
- HARP-VLA: human-action representation pretraining
- METIS: sparse hand motion representation
- HuRo: human video를 robot action supervision으로 변환하는 접근
