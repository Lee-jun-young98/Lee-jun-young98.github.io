---
title: "Splat2Act: From Captured Scenes to Personalized VLA Manipulation"
date: 2026-10-13
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Xiaomeng Ye, Krishna Jaganathan, Gyubeum Lim, Gunjan Chhablani, Muhammad Zubair Irshad, Zsolt Kira"
paper: "https://arxiv.org/abs/2610.13945"
code: ""
project: "https://splat2act.github.io/"
thumbnail: "/papers/assets/vla/splat2act-personalized-vla-manipulation/overview.svg"
---

# 한 줄 요약

Splat2Act는 휴대전화로 촬영한 건물 규모 공간과 사용자 물체 사진을 3D Gaussian Splatting 디지털 트윈으로 바꾸고, 시뮬레이션 oracle이 만든 데이터만으로 $\pi_{0.5}$를 현장에 개인화한다.

# 논문 정보

- 제목: Splat2Act: From Captured Scenes to Personalized VLA Manipulation
- 저자: Xiaomeng Ye, Krishna Jaganathan, Gyubeum Lim, Gunjan Chhablani, Muhammad Zubair Irshad, Zsolt Kira
- 발표: arXiv:2610.13945v1 (2026-10-09), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.13945) · [HTML 원문](https://arxiv.org/html/2610.13945)
- 코드/프로젝트: [공식 프로젝트](https://splat2act.github.io/) · 코드와 데이터는 공개 예정으로 표기됨
- 키워드: VLA personalization, real-to-sim-to-real, 3D Gaussian Splatting, synthetic demonstrations, mobile manipulation

# 핵심 아이디어

범용 VLA를 새 집이나 사무실에 배포할 때 필요한 것은 인터넷 규모 사전학습보다 그 공간의 시각·기하와 사용자의 물체에 맞는 경험이다. Splat2Act는 20–30분짜리 RGB-D 휴대전화 스캔으로 3DGS 외관과 collision mesh를 만들고, 상향 표면을 receptacle로 찾아 로봇 reachability를 검사한다. privileged oracle은 가능한 grasp와 이동을 반복 시도해 성공 궤적만 수집한다. 이후 Stage 1에서 공용 물체로 Stretch embodiment와 pickup을 익히고, Stage 2에서 대상 장면의 사용자 물체로 개인화한다.

# VLA 관점에서 중요한 이유

이 논문은 VLA의 현장 적응을 사람의 teleoperation 문제가 아니라 deployment-conditioned data generation 문제로 바꾼다. 특정 장면의 외관, 지지면, 로봇 접근 가능성, 사용자 물체를 함께 시뮬레이션에 넣기 때문에 일반 domain randomization보다 배포 분포를 직접 겨냥한다. 101개 건물 규모 장면을 처리했다는 점도 tabletop 단위 real-to-sim을 넘어서는 중요한 확장이다.

# Robot / Embodied Setting

- 로봇: Hello Robot Stretch 3 mobile manipulator.
- 관측/행동: head·wrist RGB, 4차원 proprioception, 언어 지시를 입력받아 10-step, 10차원 action chunk를 20 Hz로 실행.
- 장면: 캠퍼스 실내 101곳, navigable area 중앙값 104.87 m², 자동 발견 receptacle 852개.
- 데이터: broad campaign 68,021개 성공 pickup trajectory, 273.46 control hours. Stage 1은 1,024개, Stage 2는 Office 504개 또는 Conference 500개 trajectory를 사용.
- 실제 평가: Office의 12개 task cell에 대해 정책당 36회, Stretch 3에서 수행.

# Method

1. iPhone RGB-D 시퀀스를 DN-Splatter로 3DGS화하고 SuGaR mesh를 추출해 외관과 collision geometry를 분리한다.
2. 사용자 물체 사진 한 장과 크기에서 SAM3D asset을 만들고, broad adaptation에는 호환되는 Objaverse asset 556개를 쓴다.
3. mesh의 높이·면적·법선으로 지지면을 찾고 HDBSCAN으로 묶은 뒤, navmesh와 0.70 m reach radius로 가능한 배치를 거른다.
4. privileged geometric oracle이 antipodal grasp 후보, base·wrist configuration, pregrasp–lift sequence를 계획하고 실패 시 다른 후보로 재시도한다.
5. $\pi_{0.5}$를 Stage 1 broad adaptation 후 Stage 2 scene/object personalization으로 flow-matching SFT한다. SigLIP image encoder는 고정하고 PaliGemma와 action expert를 조정한다.

# 핵심 그림

![휴대전화 장면·물체 캡처가 3DGS 디지털 트윈, receptacle 탐색, oracle demonstration, 2단계 VLA 개인화를 거쳐 실제 Stretch 3 실행으로 이어지는 Splat2Act 파이프라인](/papers/assets/vla/splat2act-personalized-vla-manipulation/overview.svg)

> 논문 Figure 2를 바탕으로 재구성. 출처: [arXiv HTML, Figure 2](https://arxiv.org/html/2610.13945). 한국어 설명과 모듈 경계를 위해 단순화했다.

구조 그림을 고른 이유는 핵심 기여가 새로운 action head보다 장면 캡처부터 실제 배포까지 이어지는 데이터 파이프라인에 있기 때문이다. 입력은 장면 RGB-D와 물체 사진·크기이고, 중간 모듈은 3DGS/mesh 재구성, receptacle·reachability 검사, oracle rollout이다. 출력은 Stage 1에서 embodiment를 익히고 Stage 2에서 현장 물체와 지지면에 맞춘 $\pi_{0.5}$다. 학습에는 oracle과 flow-matching loss가 필요하지만 추론에는 실제 RGB·proprioception·언어와 VLA만 남는다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)        |               제안 방법 |                   비교 기준 |    차이 | 출처                |
| ------------------------------------- | ----------------------: | --------------------------: | ------: | ------------------- |
| Office 개인화, Stage 2 시작점         | Office1k → Stage 2 62.5 |         base → Stage 2 45.0 | +17.5%p | 원문 Figure 3, §V-C |
| Conference 개인화, Stage 2 시작점     |  Multi1k → Stage 2 51.4 |         base → Stage 2 42.9 |  +8.5%p | 원문 Figure 3, §V-C |
| Office 12-task subset, 실제 Stretch 3 |                    63.9 | 동일 task의 simulation 66.7 |  -2.8%p | 원문 Figure 4       |
| Office hard split                     | Office1k → Stage 2 52.6 |         base → Stage 2 31.6 | +21.0%p | 원문 Table 4        |

같은 장면에서 broad adaptation을 한 뒤 개인화한 조건이 Office에서 가장 좋았다. 반면 Multi1k는 Conference로의 전이에 유리했다. 실제 63.9%와 simulation 66.7%의 근접성은 이 설정에서 디지털 트윈 평가가 유용하다는 신호지만, 12개 task·36회라는 작은 표본이므로 일반적인 sim-to-real 예측성으로 확대하면 안 된다.

# Limitations / Discussion

- 새 물체마다 사진과 실제 크기가 필요하고, 새 공간마다 20–30분의 RGB-D 스캔과 오프라인 reconstruction이 필요하다.
- 학습 task는 receptacle-local pickup에 한정되며 placement, articulated object, long-horizon mobile manipulation은 검증하지 않았다.
- 실제 평가는 한 Office 장면의 Stretch 3와 12개 task subset뿐이다.
- 68K trajectory도 storage 제약으로 후보 공간을 크게 subsample한 결과라, 생성 규모와 학습 효율 사이 최적점은 남아 있다.
- base $\pi_{0.5}$의 0%는 Stretch embodiment/action space 미노출 영향도 커서 범용 VLA의 보편적 현장 성능으로 읽으면 안 된다.
- 공식 conference venue와 코드·데이터 실제 공개는 확인되지 않았다.

# 내가 이해한 핵심

개인화 VLA의 병목은 현장에서 사람이 반복 시연하는 비용이다. Splat2Act는 한 번의 캡처로 장면에 맞는 데이터 공장을 만들고, 그 공장에서 embodiment 적응과 사용자 물체 적응을 분리해 해결한다.

# 다음에 연결해서 읽을 논문

- DREAM: instruction-conditioned real-to-sim demonstration 생성과 자동화 범위를 비교하기 좋다.
- EmbodiedSplat: deployment scene의 3DGS를 navigation policy 개인화에 쓰는 선행 흐름이다.
- $\pi_{0.5}$: Splat2Act가 어떤 pretrained prior와 flow-matching action expert를 개인화하는지 이해하는 기반이다.
