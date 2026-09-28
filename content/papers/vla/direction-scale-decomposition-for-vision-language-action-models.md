---
title: "Direction-Scale Decomposition in Action Representation: Rethinking What to Tokenize for Vision-Language-Action Models"
date: 2026-09-27
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Action Tokenization"
  - "Action Representation"
venue: "확인 필요"
authors: "Yufei Duan, Hang Yin, Alberta Longhini, Chao Tang, Danica Kragic"
paper: "https://arxiv.org/abs/2609.28865"
code: ""
project: "https://vla-dsd.github.io/"
---

# 한 줄 요약

DSD는 로봇의 translation·rotation increment를 방향과 크기로 분리한 뒤 토큰화해, 실행 속도와 데이터셋별 normalization에 흔들리지 않는 공유 기하 구조를 VLA action token에 드러낸다.

# 논문 정보

- 제목: Direction-Scale Decomposition in Action Representation: Rethinking What to Tokenize for Vision-Language-Action Models
- 저자: Yufei Duan, Hang Yin, Alberta Longhini, Chao Tang, Danica Kragic
- 발표: 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2609.28865), [HTML](https://arxiv.org/html/2609.28865), [프로젝트](https://vla-dsd.github.io/)
- 코드/프로젝트: 프로젝트 페이지 공개, 코드 공개 여부 확인 필요
- 키워드: VLA, action representation, discrete tokenization, heterogeneous co-training, normalization

# 핵심 아이디어

기존 discrete VLA는 pose increment의 각 좌표를 데이터셋 통계로 정규화하고 binning한다. 그러면 같은 경로도 실행 속도가 다르면 다른 token sequence가 되고, 같은 물리 action도 데이터셋별 통계에 따라 다른 token으로 바뀐다. Train과 rollout 통계가 다르면 축별 역정규화가 motion direction 자체를 왜곡할 수도 있다.

Direction-Scale Decomposition은 translation을 unit direction과 magnitude로, rotation을 axis와 angle로 분해한다. Direction과 axis는 데이터셋에 독립적인 고정 범위를 쓰고 magnitude와 angle만 별도 scale channel에 둔다. 따라서 속도 차이는 scale 쪽에 격리되고 경로의 기하학은 direction token에 보존된다.

# VLA 관점에서 중요한 이유

많은 연구가 tokenizer 압축률이나 action head 구조를 바꾸지만, tokenizer에 들어가기 전 raw representation은 당연한 것으로 취급한다. DSD는 cross-embodiment·cross-dataset scaling에서 손실되는 공통 구조가 모델 용량보다 action 좌표계 문제일 수 있음을 보여준다.

Uniform binning과 BEAST 모두에 붙일 수 있는 analytic representation이어서 특정 backbone이나 learned codebook에 종속되지 않는다. 데이터 혼합 규모가 커질수록 action semantics를 일관되게 유지하는 간단한 인터페이스가 중요해진다는 점도 시사한다.

# Robot / Embodied Setting

- 시뮬레이션: LIBERO, SimplerEnv
- 통제 실험: 5개 속도로 수집한 light-marker path tracking
- 실로봇: robotics pretraining 없는 학습과 pretrained checkpoint fine-tuning 모두 평가
- 모델: Florence-2-Base 0.23B, 20-step parallel action chunk
- tokenizer: 256-bin BIN, B-spline 기반 BEAST와 각각 결합
- 설정: single-dataset와 heterogeneous mixed-dataset training

# Method

Translation increment는 크기와 3D unit direction으로, rotation increment는 회전각과 unit axis로 바꾼다. Directional component에는 고정된 dataset-independent bound를 적용하고 scale component는 별도로 정규화한다. 예측 후에는 방향에 magnitude를 곱하고 axis-angle을 회전 표현으로 복원해 원래 action을 얻는다.

움직임 크기가 0에 가까우면 방향이 잡음에 매우 민감해지므로, scale이 임계값보다 작을 때 direction-token loss를 최소 0.1까지 낮춘다. DSD는 이 표현 변환만 제공하며 BIN이나 BEAST 같은 기존 tokenizer는 그대로 사용할 수 있다.

# Experiments / Results

LIBERO에서 DSD는 BIN과 BEAST 모두의 평균 성공률을 높였다. Heterogeneous co-training SimplerEnv에서는 DSD-BIN이 BIN보다 전체 성공률 10.3%p 높았다. 속도가 다른 demonstration의 path tracking에서도 경로 충실도가 개선됐고, 실로봇에서는 robotics pretraining 유무와 관계없이 이득을 보였다.

| 로봇 / 벤치마크 / 태스크 |            DSD 결과 |           비교 기준 |      차이 | 해석                                     |
| ------------------------ | ------------------: | ------------------: | --------: | ---------------------------------------- |
| SimplerEnv mixed-dataset |             DSD-BIN |                 BIN |   +10.3%p | 데이터셋 혼합 시 normalization 충돌 완화 |
| LIBERO                   | DSD-BIN / DSD-BEAST |    원래 BIN / BEAST | 모두 향상 | tokenizer 종류와 독립적으로 유효         |
| 실로봇                   |        DSD variants | raw action variants |      향상 | 사전학습 유무 모두에서 전이 가능성 확인  |

# Limitations / Discussion

DSD는 discrete-token VLA에 초점을 맞추며 flow matching이나 diffusion action head에서 같은 효과가 나는지는 직접 검증하지 않았다. Direction과 scale을 분리하면 token 수와 예측 요소가 늘 수 있고, 매우 작은 움직임에서는 방향 label이 본질적으로 불안정해 loss masking 같은 별도 처리가 필요하다.

단순 unit direction은 접촉 제약, 관절 한계, force/torque처럼 pose increment 바깥의 action semantics를 표현하지 않는다. 실로봇 평가 범위와 절대 수치도 다양한 embodiment에서의 대규모 재현으로 이어져야 한다.

# 내가 이해한 핵심

서로 다른 속도로 같은 선을 그린 두 trajectory는 로봇에게 같은 "방향 의미"를 가져야 한다. 그런데 좌표별 normalization은 이 의미를 토큰에서 분해해 버릴 수 있다. DSD는 방향을 공통 어휘로, 속도와 회전량을 별도 수식어로 만드는 표현이다.

# 다음에 연결해서 읽을 논문

- OpenVLA / RT-2: coordinate-wise uniform action binning의 대표 사례
- BEAST / FAST: action chunk의 구조를 활용하는 tokenization
- ActionCodec / VQ-BeT: learned action codebook 접근
- Co-VLA / GALA: heterogeneous robot data에서 공유 표현을 학습하는 방법
