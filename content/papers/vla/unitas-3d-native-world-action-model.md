---
title: "UNITAS: A 3D-Native World Action Model for Embodied Manipulation"
date: 2026-10-11
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요 (arXiv에 under review로만 표기)"
authors: "Ruixiang Wang, Yongyi Su, Wenlve Zhou, Bo Yue, Hengyan Liu, Dekun Lu, Yuxin Tian, Yihan Fang, Zerui Wu, Xing Hu, Jietao Chen, Yong Guo, Ziyan He, Junbin Yuan, Guiliang Liu, Xiaofen Xing, Kui Jia"
paper: "https://arxiv.org/abs/2610.12099"
code: "https://github.com/DexForce/UNITAS"
project: ""
thumbnail: "/papers/assets/vla/unitas-3d-native-world-action-model/overview.svg"
---

# 한 줄 요약

UNITAS는 관측·로봇/손 motion·scene 변화 모두를 동일한 metric 3D frame의 point flow로 표현해, 1.7B 모델로 LIBERO 99.8%, RoboTwin Clean/Randomized 92.94%/93.04%, 실제 로봇 평균 85%를 달성한다.

# 논문 정보

- 제목: UNITAS: A 3D-Native World Action Model for Embodied Manipulation
- 저자: Ruixiang Wang, Yongyi Su, Wenlve Zhou, Bo Yue, Hengyan Liu, Dekun Lu, Yuxin Tian, Yihan Fang, Zerui Wu, Xing Hu, Jietao Chen, Yong Guo, Ziyan He, Junbin Yuan, Guiliang Liu, Xiaofen Xing, Kui Jia
- 발표: arXiv:2610.12099v1 (2026-10-08), under review이며 venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.12099) · [HTML 원문](https://arxiv.org/html/2610.12099)
- 코드/프로젝트: [공식 코드](https://github.com/DexForce/UNITAS)
- 키워드: 3D-native WAM, point flow, scene flow, cross-embodiment, physical-time tokenizer

# 핵심 아이디어

영상 기반 WAM은 pixel distance가 실제 물리 거리와 다르고 viewpoint에 종속된다. UNITAS는 visual token을 world-coordinate 3D position에 grounding하고, robot gripper·human hand motion은 action flow, 환경 변화는 scene flow로 표현한다. 서로 다른 frame rate와 horizon은 초 단위 physical-time tokenizer가 point trajectory 하나를 token 하나로 압축해 정렬한다.

모델은 point-dynamics expert와 end-effector action expert가 layer-coupled된 Mixture-of-Transformers다. Policy mode는 executable action chunk만 생성하고, simulator mode는 외부 또는 생성된 action flow에 조건화해 scene flow를 예측한다. 같은 표현으로 정책과 action-conditioned world model을 모두 수행한다.

# VLA 관점에서 중요한 이유

UNITAS는 cross-embodiment VLA의 공통 인터페이스를 image/video token이 아니라 metric 3D motion으로 둔다. embodiment마다 joint space는 다르지만 gripper·hand와 scene point의 이동은 같은 물리 공간에서 비교할 수 있다. world model이 “무슨 영상이 보일까”가 아니라 “어떤 점이 실제로 어디로 움직일까”를 예측해 camera/initial-state shift에 더 직접적으로 대응한다.

# Robot / Embodied Setting

- simulation: LIBERO 40 tasks, LIBERO-Plus 10,030 episodes, RoboTwin 2.0 50 bimanual tasks, VLABench 5 tracks.
- pretraining data: heterogeneous robot, human-hand, RGB/RGB-D trajectories; 데이터별 좌표계를 prediction window의 고정 frame으로 정렬.
- real robot: Organize Books와 Pack the Ball, method/task당 20 trials.
- representation: gripper당 URDF 기반 20 points, human hand는 21 MANO keypoints, scene query points.
- 모델: 1.7B parameters; policy-only inference에서는 future action-flow/scene-flow token을 생략.

# Method

1. Multi-view RGB 또는 RGB-D와 camera calibration을 world-aligned visual tokens로 바꾼다. Depth가 없으면 learned 3D router가 위치 embedding을 보완한다.
2. Robot gripper/human hand trajectory를 action flow $\mathbf A$, 환경 point trajectory를 scene flow $\mathbf S$로 표현한다.
3. Physical-time tokenizer가 frame index 대신 elapsed seconds를 사용하고 trajectory 전체를 point당 token 하나로 압축한다.
4. Point-dynamics expert가 action/scene flow를, action expert가 executable end-effector chunk $\mathbf u$를 flow matching으로 생성한다.
5. Joint distribution은 $p(\mathbf A|\mathcal C)p(\mathbf u|\mathcal C,q_0)p(\mathbf S|\mathbf A,\mathcal C)$로 분해한다.
6. Policy mode는 $\mathbf u$만 계산하고, simulator mode는 generated 또는 external $\mathbf A$에 조건화해 scene response를 낸다.

# 핵심 그림

![다중 시점 관측과 로봇·손·장면의 point flow를 공통 3D 좌표계에서 두 expert가 처리하는 UNITAS 구조](/papers/assets/vla/unitas-3d-native-world-action-model/overview.svg)

> 논문 Figure 1–2를 바탕으로 재구성. 출처: [arXiv HTML, Figure 1–2](https://arxiv.org/html/2610.12099). 공통 metric frame, physical-time token, policy/simulator mode의 분기를 강조했다.

구조 그림을 고른 이유는 image-based WAM과 다른 3D-native interface와 두 inference mode를 한 번에 보여주기 위해서다. 입력 RGB(/D), calibration, language, proprioception은 world-aligned tokens와 flow anchors가 되고, coupled experts는 executable command와 scene response를 분리해 생성한다. 학습에서는 action·scene flow loss가 함께 3D dynamics를 shaping하지만, 빠른 policy 추론에서는 point-flow 생성 branch를 생략할 수 있다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑) | UNITAS |        비교 기준 |    차이 | 출처         |
| ------------------------------ | -----: | ---------------: | ------: | ------------ |
| RoboTwin 2.0 Clean             |  92.94 |       X-WAM 89.8 | +3.14%p | 원문 Table 1 |
| RoboTwin 2.0 Randomized        |  93.04 |       X-WAM 90.7 | +2.34%p | 원문 Table 1 |
| LIBERO-Plus overall            |   89.1 | $\pi_{0.5}$ 85.7 |  +3.4%p | 원문 Table 1 |
| VLABench success rate          |   56.2 | $\pi_{0.5}$ 48.1 |  +8.1%p | 원문 Table 1 |
| 실제 Organize Books, 20 trials |     90 |   $\pi_{0.5}$ 75 |   +15%p | 원문 Table 2 |
| 실제 Pack the Ball, 20 trials  |     80 |      Fast-WAM 60 |   +20%p | 원문 Table 2 |

RoboTwin 비교는 같은 Clean/Randomized 열의 공개 수치만 대조했다. 실제 로봇은 동일 task당 20회 조건에서 가장 강한 baseline을 골랐으며 평균은 UNITAS 85%, $\pi_{0.5}$ 65%, Fast-WAM 62.5%다. World-model 자체도 PointWorld 대비 Moving ADE를 0.656 cm에서 0.427 cm로 0.229 cm(34.9%) 줄였지만, 성공률과 단위가 달라 별도 해석한다.

# Limitations / Discussion

- camera calibration과 world-frame 정렬에 의존하며, calibration drift가 큰 환경의 강건성은 충분히 검증되지 않았다.
- simulator mode의 scene prediction에는 현재 depth 또는 외부 3D query geometry가 필요하다.
- 1.7B는 비교 WAM보다 작지만 edge robot에는 여전히 큰 모델이다.
- 실제 평가는 두 tasks, 각 20회로 다양성과 통계적 범위가 제한적이다.
- scene flow는 point correspondence가 유효한 구간에만 loss를 적용하므로 severe occlusion·topology change는 어렵다.
- 논문은 under review로만 표기되어 공식 venue는 확인되지 않았다.

# 내가 이해한 핵심

UNITAS의 통일성은 network가 하나라는 뜻보다 coordinate system이 하나라는 뜻이다. 관측 token, agent motion, environment motion을 동일한 meter 단위 frame과 second 단위 time에 놓으니 서로 다른 embodiment와 dataset도 같은 dynamics interface로 합칠 수 있다.

# 다음에 연결해서 읽을 논문

- ACG-WAM: action-conditioned geometric latent로 world evolution을 예측한다.
- SkeleWAM: sparse 3D skeleton을 future target으로 사용한다.
- MiniWAM: dense future target을 compact transition representation으로 치환한다.
