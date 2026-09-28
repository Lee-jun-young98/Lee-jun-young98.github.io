---
title: "FRAM: Trajectory-Guided Visual Feature Selection for Compact Language-Conditioned Robot Manipulation"
date: 2026-09-28
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Compact Policy"
  - "Trajectory Prediction"
venue: "확인 필요"
authors: "Hiroshi Ito, Hyogo Hiruma, Yoshiki Kanai, Takahiro Yoshida, Akira Kanazawa, Hiroki Yamada"
paper: "https://arxiv.org/abs/2609.30965"
code: ""
project: ""
---

# 한 줄 요약

FRAM은 예측한 미래 end-effector trajectory를 이미지에서 볼 위치를 지정하는 spatial pointer로 사용해, 138.7M 규모로도 강한 VLA 조작 성능을 낸다.

# 논문 정보

- 제목: FRAM: Trajectory-Guided Visual Feature Selection for Compact Language-Conditioned Robot Manipulation
- 저자: Hiroshi Ito, Hyogo Hiruma, Yoshiki Kanai, Takahiro Yoshida, Akira Kanazawa, Hiroki Yamada
- 발표: 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2609.30965), [HTML](https://arxiv.org/html/2609.30965)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: compact VLA, future trajectory, spatial pointer, flow matching, wrist camera

# 핵심 아이디어

큰 VLA는 global visual token에서 행동에 필요한 위치와 상태를 암묵적으로 찾아야 한다. FRAM은 먼저 미래 end-effector trajectory를 예측하고, 각 3D point를 이미지 좌표로 투영해 그 주변 local visual feature를 샘플링한다.

이로써 action expert가 reference position(Where), 그 위치의 visual state(What), 향후 motion(Future)을 구조화된 입력으로 받는다. Trajectory label은 demonstration과 camera geometry에서 자동 생성해 별도 수작업 annotation이 필요 없다.

# VLA 관점에서 중요한 이유

모델 크기 대신 action-relevant visual selection으로 효율을 얻는다. 이는 작은 VLA가 단순히 backbone을 축소하는 것보다 로봇의 미래 운동을 attention prior로 쓰는 편이 효과적일 수 있음을 보여준다.

Trajectory가 예측과 시각 정보 선택을 연결하므로, action representation과 perception을 하나의 bottleneck에서 함께 설계한 사례다.

# Robot / Embodied Setting

- 시뮬레이션: LIBERO 4 suites, LIBERO-Plus zero-shot
- 실로봇: dual-arm UR5e, wrist camera만 사용한 cup stacking
- 모델 크기: 138.7M parameters, frozen language encoder 포함
- action: future trajectory와 local image feature를 조건으로 한 flow-matching expert
- 변화 평가: object layout, camera viewpoint, robot initial pose

# 핵심 그림

![FRAM의 미래 말단효과기 궤적 예측과 궤적 주변 시각 특징 선택](https://arxiv.org/html/2609.30965v1/figs/model_overview.png)

_원문 Figure 1._ 예측한 미래 궤적에 맞춰 국소 시각 특징을 골라 flow-matching action 생성에 전달한다. [그림·실험표 출처: 논문 원문](https://arxiv.org/html/2609.30965).

# Method

Language와 image encoder가 기본 context를 만든다. Future trajectory predictor가 demonstration 기반 end-effector 궤적을 출력하고, camera calibration으로 궤적 point를 image plane에 투영한다.

투영 위치에서 local visual feature를 추출해 trajectory token과 결합하고, flow-matching action expert가 action chunk를 생성한다. Trajectory나 local feature를 제거한 ablation으로 두 요소의 기여를 분리한다.

# Experiments / Results

FRAM은 LIBERO Spatial 92.2%, Object 96.2%, Goal 93.8%, Long 86.4%로 평균 92.2%를 기록했다. 3.3B pi_0의 94.2%에 근접하고, 450M SmolVLA보다 4.9%p 높다. 추가 학습 없이 LIBERO-Plus 평균 67.3%도 달성했다.

| 로봇 / 벤치마크 / 태스크 | 제안 방법 |          비교 기준 |   차이 | 해석                         |
| ------------------------ | --------: | -----------------: | -----: | ---------------------------- |
| LIBERO 4-suite 평균      |     92.2% | SmolVLA 450M 87.3% | +4.9%p | 더 작은 모델로 더 높은 성능  |
| LIBERO 4-suite 평균      |     92.2% |    pi_0 3.3B 94.2% | -2.0%p | 약 24배 큰 모델에 근접       |
| LIBERO-Plus zero-shot    |     67.3% |     추가 학습 없음 |      - | 환경 변화에 일정 수준 강건성 |

# Limitations / Discussion

LIBERO-Long은 86.4%로 다른 suite보다 낮아 multi-step 장기 과업의 누적 오차가 남는다. 정확한 camera geometry를 사용한 trajectory projection이 핵심이므로 calibration error나 severe occlusion에 대한 민감도도 확인해야 한다.

실로봇 평가는 dual-arm cup stacking에 집중되어 있고, mobile manipulation이나 contact-rich task에서의 범용성은 검증되지 않았다. 큰 VLA보다 약간 낮은 표준 성능과 효율 사이의 trade-off도 배포 요구에 맞춰 판단해야 한다.

# 내가 이해한 핵심

작은 정책이 모든 픽셀을 이해하려고 하기보다, 앞으로 손이 지나갈 곳을 먼저 예측하고 그 주변만 자세히 보는 것이 효과적이다. 미래 운동이 perception의 query가 된다.

# 다음에 연결해서 읽을 논문

- SmoLSTM: recurrent memory를 가진 compact VLA
- Direction-Scale Decomposition: action representation 자체를 재설계한 접근
- RT-Trajectory: trajectory sketch를 통한 로봇 task generalization
- Fast Plans, Faithful Actions: waypoint plan과 executor를 정렬하는 계층형 VLA
