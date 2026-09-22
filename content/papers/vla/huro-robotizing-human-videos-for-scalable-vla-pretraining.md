---
title: "HuRo: Robotizing Human Videos for Scalable VLA Pretraining"
date: 2026-09-12
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Robot Manipulation"
  - "Human Video"
venue: "CoRL 2026"
authors: "Jinho Jeong, Se June Joo, Jaehyun Kang, Dongyun Kim, Yena Kim, Hanjung Kim, Seon Joo Kim"
paper: "https://arxiv.org/abs/2609.10706"
code: "https://github.com/3587jjh/HuRo"
project: "https://3587jjh.github.io/HuRo/"
---

# 한 줄 요약

HuRo는 서로 다른 egocentric human-video 데이터에서 사람의 팔을 지우고 로봇을 합성하며 손 움직임을 로봇 action으로 retarget해, 약 63만 episode 규모의 VLA 사전학습 데이터를 만드는 robotization pipeline이다.

# 논문 정보

- 제목: HuRo: Robotizing Human Videos for Scalable VLA Pretraining
- 저자: Jinho Jeong, Se June Joo, Jaehyun Kang, Dongyun Kim, Yena Kim, Hanjung Kim, Seon Joo Kim
- 발표: Conference on Robot Learning (CoRL) 2026
- 링크: [arXiv](https://arxiv.org/abs/2609.10706)
- 코드/프로젝트: [GitHub](https://github.com/3587jjh/HuRo), [프로젝트 페이지](https://3587jjh.github.io/HuRo/)
- 키워드: VLA pretraining, human video, robotization, motion retargeting, embodiment alignment, bimanual manipulation

# 핵심 아이디어

대규모 실제 로봇 데이터는 수집 비용이 높지만, human video는 다양한 물체·장면·조작을 이미 대규모로 담고 있다. 문제는 사람의 외형과 손 움직임이 로봇의 관찰·action space와 다르다는 embodiment gap이다. HuRo는 관찰과 행동을 따로 맞추지 않고 하나의 pipeline에서 함께 robotize한다.

입력 영상에서 카메라 geometry와 3D hand pose를 추정하고, 조작 구간을 나눠 VLM으로 language instruction을 붙인다. 손 궤적은 inverse kinematics로 대상 로봇의 joint trajectory에 retarget한다. 영상에서는 사람 팔을 segmentation과 inpainting으로 제거한 뒤, 같은 camera trajectory와 retargeted configuration으로 렌더링한 로봇을 합성한다. 결과적으로 RGB, language, robot state, action target이 정렬된 VLA episode가 만들어진다.

# VLA 관점에서 중요한 이유

HuRo는 VLA scale-up의 핵심 제약을 model architecture보다 data engine에서 찾는다. human video를 visual pretraining에만 쓰는 대신, robot-like observation과 실행 인터페이스에 맞춘 action supervision을 함께 생성해 end-to-end policy pretraining에 사용한다.

실험상 visual robotization은 특히 OOD 성능을 높이고, retargeted action까지 포함한 전체 VLA pretraining은 visual encoder만 옮기는 것보다 크게 유리했다. 이는 embodiment alignment가 “로봇이 보이는 영상”을 만드는 데서 끝나지 않고, 관찰과 행동이 같은 물리적 변환을 공유해야 한다는 근거다.

# Robot / Embodied Setting

- 주 데이터 embodiment: ALLEX bimanual dexterous robot
- 로봇 구성: 7-DoF arm 2개, 15-DoF hand 2개, 2-DoF neck, 2-DoF waist
- 데이터 원천: Ego4D, EPIC-Kitchens, EgoDex, EgoVerse, Ego10K
- 데이터 규모: 약 63만 robotized episode, 1억 4,200만 frame, 약 1,317시간
- policy: GR00T-N1.6-3B 기반 VLA, end-effector action interface, 40-step action chunk
- 실제 평가: apple pick-and-place, cup stacking, cup-noodle handover, microwave loading 등 4개 task의 ID/OOD 조건

# Method

첫 단계인 human video annotation은 camera intrinsics, hand tracking, 3D hand pose, camera trajectory를 복원한다. 조작 영상을 bounded-length chunk로 나누고 각 chunk에 language instruction을 붙여 서로 다른 원천 데이터의 annotation 수준을 맞춘다.

action conversion은 손끝 위치와 손 구조를 world frame으로 옮긴 뒤, robot base와 world 사이의 translation·yaw 및 robot joint configuration을 함께 최적화한다. sparse timestep에서 정렬을 구하고 전체 궤적에 temporal smoothness를 적용한다. retargeted state의 다음 timestep을 action target으로 사용한다.

visual conversion은 SAM2와 person-region prompt로 보이는 사람 팔을 분할하고 ProPainter로 지운다. 이어 같은 camera alignment와 robot configuration으로 Isaac Sim에서 ALLEX를 렌더링해 깨끗한 frame 위에 합성한다. 이렇게 action conversion과 visual conversion이 동일한 geometry를 공유한다.

사전학습에서는 robotized RGB와 language를 VLM backbone이 encoding하고, robot state까지 조건으로 action head가 양쪽 wrist pose와 hand joint target의 chunk를 예측한다. 이후 소량의 실제 robot demonstration으로 downstream task를 finetuning한다.

# Experiments / Results

HuRo 사전학습 규모를 키울수록 4개 실제 task의 평균 completion이 사전학습 없는 51.5%에서 전체 데이터 사용 시 80.3%로 증가했다. ID completion은 68.1%에서 88.4%, 공간·시각 변화가 있는 OOD completion은 34.9%에서 72.2%로 올랐다. 전체 규모에서는 $\pi_{0.5}$와 GR00T N1.6 reference도 넘어섰다.

visual overlay 없이 human observation과 retargeted action만 쓴 모델은 ID에서는 전체 HuRo와 비슷했지만(89.4% 대 88.4%), OOD에서는 55.7% 대 72.2%로 크게 낮았다. 전체 no-overlay 데이터가 10% HuRo보다도 OOD 성능이 낮아 robot appearance alignment의 효과를 분리해 보여준다.

visual pathway만 전이하는 것보다 visual+action 전체 VLA를 전이한 설정이 다양한 물체 pick-and-place의 ID/OOD에서 뚜렷하게 높았다. 특히 unseen handled cup에서 손가락을 handle 안으로 넣는 demonstration-consistent grasp가 나타나, retargeted action supervision이 grasp 방식까지 전달할 수 있음을 보였다.

# Limitations / Discussion

영상에 가려진 배경은 원래 관찰되지 않으므로 inpainting이 완전히 정확할 수 없고, 현재 robot overlay는 렌더링된 로봇과 실제 장면 geometry 사이의 occlusion을 명시적으로 처리하지 않는다. 이런 artifact가 정책 학습에 미치는 영향을 체계적으로 분리하지는 않았다.

HuRo는 visual·kinematic supervision을 제공하지만 force와 tactile signal은 포함하지 않는다. 따라서 접촉력이 중요한 삽입, 조립, deformable manipulation으로 그대로 확장하기 어렵다.

retargeting은 self-collision이나 물리 접촉을 모델링하지 않는다. 감사한 sample 중 non-grasp self-contact가 없던 trajectory는 55.2%뿐이었으며, 이 데이터는 실행 가능한 demonstration이라기보다 noisy pretraining supervision으로 해석해야 한다.

주요 결과는 ALLEX embodiment와 네 가지 실제 task에 집중한다. 다른 robot morphology로 pipeline을 확장할 수 있다는 부록 실험은 있지만, 여러 embodiment를 동시에 크게 학습했을 때의 scaling law와 cross-embodiment transfer는 추가 검증이 필요하다.

# 내가 이해한 핵심

HuRo의 핵심은 human video를 그대로 보여 주고 로봇 행동만 맞추는 것으로는 부족하다는 점이다. 영상 속 embodiment와 action label을 같은 3D 정렬에서 함께 바꾸면, 로봇은 “사람처럼 보이는 장면에서 로봇 행동을 흉내 내는” 대신 자신의 몸이 보이는 장면과 자신의 action space 사이의 관계를 대규모로 예습할 수 있다.

# 다음에 연결해서 읽을 논문

- Phantom: human video만으로 robot observation과 action을 만드는 task-matched 접근
- EgoScale/VITRA: human hand action을 대규모 robot supervision으로 retarget하는 접근
- H2R/Masquerade: visual robotization 또는 visual representation pretraining 중심 접근
- GR00T N1.6: HuRo가 채택한 VLA backbone과 humanoid foundation model 설계
