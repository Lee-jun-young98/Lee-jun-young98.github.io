---
title: "CompVLA: A Variable Compliance Vision-Language-Action Model for Contact-rich Manipulation"
date: 2026-09-22
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Contact-Rich Manipulation"
  - "Compliance Control"
venue: "CoRL 2026"
authors: "Jongmin Kim, Junsu Ha, Che-Sang Park, Minchang Song, Hyeokju Jeong, Himchan Hwang, Jianlong Fu, Frank C. Park"
paper: "https://arxiv.org/abs/2609.23614"
code: ""
project: ""
---

# 한 줄 요약

CompVLA는 VLA의 pose action에 시간에 따라 변하는 stiffness와 virtual displacement를 함께 예측하게 해, 접촉 방향으로는 유연하게 순응하면서 필요한 힘은 능동적으로 가하는 contact-rich manipulation 정책이다.

# 논문 정보

- 제목: CompVLA: A Variable Compliance Vision-Language-Action Model for Contact-rich Manipulation
- 저자: Jongmin Kim, Junsu Ha, Che-Sang Park, Minchang Song, Hyeokju Jeong, Himchan Hwang, Jianlong Fu, Frank C. Park
- 발표: CoRL 2026
- 링크: [arXiv](https://arxiv.org/abs/2609.23614), [HTML](https://arxiv.org/html/2609.23614v1)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: variable compliance, impedance control, contact-rich manipulation, force modulation, VLA

# 핵심 아이디어

기존 VLA는 주로 목표 관절각이나 end-effector pose를 출력하고, 실제 접촉을 처리하는 controller는 외부 고정 요소로 남긴다. CompVLA는 $\pi_0$ 기반 Action Expert 옆에 Compliance Expert를 추가해 reference TCP trajectory와 함께 축별 stiffness $k_t$와 virtual displacement $d_t$를 예측한다.

$k_t$는 접촉 방향에는 낮은 stiffness, 직교 방향에는 높은 stiffness를 주어 directional compliance를 만들고, $d_t$는 equilibrium pose를 접촉면 쪽으로 이동시켜 원하는 힘을 만든다. 이 출력은 고주파 geometric impedance controller에서 실행되어 저주파 VLA 계획과 물리적 접촉 제어를 연결한다.

# VLA 관점에서 중요한 이유

VLA의 action space를 단순한 운동학적 궤적에서 물리적 interaction property까지 확장한다. 접촉 센서를 입력으로 더하는 수준이 아니라 정책이 환경에 얼마나 단단하게 또는 부드럽게 반응할지를 출력하므로, semantic task instruction이 실제 force interaction으로 이어지는 인터페이스를 제안한다.

특히 polishing, insertion, wiping처럼 같은 경로라도 접촉 방향과 힘을 계속 바꿔야 하는 과업에서는 pose 정확도만으로 성공을 설명하기 어렵다. CompVLA는 controller-aware action representation이 generalist VLA의 다음 확장 축이 될 수 있음을 보여준다.

# Robot / Embodied Setting

- 로봇: 7-DoF Franka Research 3 leader-follower 시스템
- 센서: front, side, wrist Intel RealSense D435i 3대; 데이터 수집 시 ATI Axia force/torque sensor
- 과업: Erase Whiteboard, Pivot, Cup Dispense, Pick and Place
- 데이터: 과업별 100 demonstrations
- 평가: 과업별 20 episodes, 3회 반복; 환경 초기화 무작위화
- 실행: task-space geometric impedance control, UMI fingertip gripper

# Method

시연 중 측정한 force/torque 방향을 compliance frame의 주축으로 삼고, 해당 축에는 낮은 stiffness를, 나머지 두 축에는 높은 stiffness를 부여한다. Force magnitude와 낮은 stiffness의 비로 virtual displacement 크기를 정해 시연에서 $k_t$와 $d_t$ supervision을 구성한다.

Action Expert가 6D TCP twist와 gripper command를 먼저 생성하고 이를 적분한 reference trajectory를 Compliance Expert의 조건으로 넣는다. Compliance Expert는 6D diagonal stiffness와 6D virtual displacement chunk를 예측한다. Controller는 virtual target pose와 task-space stiffness matrix를 만들어 joint torque로 실행한다. 평가 시에는 force/torque sensor 값을 정책 입력으로 사용하지 않는다.

# Experiments / Results

세 contact-rich 과업 평균 성공률은 CompVLA 67.1%로, 가장 강한 비교군 ForceVLA 54.4%보다 12.7%p 높았다. Erase는 92.9%, Pivot은 73.3%로 각각 최고였지만 Cup Dispense는 35.0%로 ForceVLA의 50.0%보다 낮았다. 일반 Pick and Place에서는 76.7%로 $\pi_0$의 80.0%와 비슷했다.

Erase ablation에서 완전한 CompVLA는 96%, virtual displacement 제거는 7%, Compliance Expert 전체 제거는 15.3%였다. Pivot에서는 variable stiffness 70%, fixed stiffness 40%로 나타나 stiffness와 virtual target이 모두 필요함을 확인했다.

# Limitations / Discussion

Compliance Expert는 reference motion이 접촉 영역에 도달한 뒤의 interaction을 조절하므로, 작은 버튼처럼 목표 영역이 좁을 때 큰 trajectory error를 보상하지 못한다. 실제로 Cup Dispense가 다른 과업보다 약했다.

학습 label은 접촉 후 force/torque 측정에 의존해 pre-contact 구간을 표현하기 어렵고, 현재 표현은 하나의 지배적인 compliance 방향에 초점을 둔다. 여러 방향의 순응성이나 회전-병진 coupling이 중요한 과업에는 richer stiffness representation이 필요하다. 실제 평가는 하나의 FR3 플랫폼과 네 과업에 한정된다.

# 내가 이해한 핵심

접촉 과업에서는 "어디로 움직일지"만 action이 아니다. "그 방향으로 얼마나 버티거나 양보할지"와 "얼마나 눌러야 할지"도 정책이 결정해야 한다. CompVLA는 이 두 값을 VLA 출력에 넣어 action representation과 low-level controller 사이의 경계를 다시 그린다.

# 다음에 연결해서 읽을 논문

- ForceVLA / ForceVLA2: force-aware VLA와 hybrid force-position action
- TA-VLA: torque supervision을 활용한 contact-rich VLA
- Adaptive Compliance Policy: 시연에서 compliance profile을 추정하는 방법
- ForeTac-VLA / Agile-WAM: tactile feedback을 활용하는 contact-rich policy와 world-action model
