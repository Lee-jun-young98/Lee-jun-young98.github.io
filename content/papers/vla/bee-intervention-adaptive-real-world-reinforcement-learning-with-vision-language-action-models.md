---
title: "BEE: Intervention-Adaptive Real-World Reinforcement Learning with Vision-Language-Action Models"
date: 2026-09-27
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Reinforcement Learning"
  - "Human-in-the-Loop"
venue: "확인 필요"
authors: "Weihui Zhao, Xiaohan Yan, Zunian Wan, Xuan Du, Zhaozhan Chi, Jianbo Mao, Ruipu Wu, Rushuai Yang, Houlin Li, Shukai Yang, Jing Wu, Yuxiang Yan, Yongcheng Liu, Chuankang Li, Guanghui Ren, Wei Shan, Maoqing Yao"
paper: "https://arxiv.org/abs/2609.27450"
code: ""
project: ""
---

# 한 줄 요약

BEE는 사람의 개입을 그대로 모방하지 않고 액션 차원별 교정 일관성을 추정해 RL 제약의 강도로 바꾸며, frozen VLA의 장기 과업 능력을 유지한 채 정밀 조작을 개선한다.

# 논문 정보

- 제목: BEE: Intervention-Adaptive Real-World Reinforcement Learning with Vision-Language-Action Models
- 저자: Weihui Zhao 외 16명
- 발표: 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2609.27450), [HTML](https://arxiv.org/html/2609.27450)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: VLA, real-world reinforcement learning, human intervention, residual policy, uncertainty-aware constraint

# 핵심 아이디어

사람의 교정은 모든 액션 축에서 같은 신뢰도를 갖지 않는다. 예를 들어 삽입 작업에서 위치 축의 교정은 반복적으로 일관될 수 있지만 회전이나 gripper 축은 상황에 따라 달라질 수 있다. BEE는 이 차이를 무시하고 개입 액션 전체를 동일하게 모방하는 대신, VLA 제안과 사람 액션 사이의 residual 분포를 Correction Model로 학습한다.

예측된 평균은 정책이 따라야 할 교정 중심이 되고, 차원별 분산은 제약의 폭이 된다. 일관된 축에서는 residual policy를 사람 교정 가까이에 묶고, 불확실한 축에서는 RL이 더 높은 return을 찾도록 자유를 준다.

# VLA 관점에서 중요한 이유

VLA를 전면 미세조정하지 않고 frozen proposal과 내부 latent를 재사용하면서, 실제 배포 현장에서 필요한 소량의 사람 개입을 효율적으로 정책 개선에 연결한다. 특히 의미·장기 계획은 pretrained VLA가 담당하고, 성공을 좌우하는 millimeter-level 마지막 구간은 residual RL이 보정하는 역할 분담이 실용적이다.

또한 intervention을 정답 action이 아니라 정책 최적화의 안전한 feasible region에 관한 증거로 해석한다. 이는 사람의 교정이 불완전하거나 다봉적일 수 있는 실제 로봇 학습에서 단순 behavior cloning보다 적합한 관점이다.

# Robot / Embodied Setting

- 실로봇 과업: Phone Charging, Snack Hanging, Cloth Aligning
- 시뮬레이션: LIBERO-PRO Bowl Placing
- 과업 길이: 실로봇 기준 약 30~60초, 30 Hz에서 900~1,800 control steps
- 정책: frozen VLA와 latent extractor, chunk-level residual actor-critic
- 비교: Base Policy, RLT, DSRL; 동일 online robot-data budget
- 평가 지표: 성공률과 사람 개입률

# 핵심 그림

![BEE의 VLA 제안, 사람 교정 모델, 차원별 제약을 결합한 학습 구조](https://arxiv.org/html/2609.27450v1/Teaser_v38.png)

_원문 Figure 1._ 사람의 교정을 그대로 모방하는 대신, 교정의 차원별 불확실성으로 RL 제약 강도를 조절한다. [그림·실험표 출처: 논문 원문](https://arxiv.org/html/2609.27450).

# Method

Frozen VLA는 action proposal과 내부 feature latent를 출력한다. Residual Policy는 이 proposal에 더할 action chunk residual을 예측하며, critic은 chunk 단위 return을 학습한다. 사람 개입이 발생하면 원래 VLA proposal을 버리지 않고 사람 액션과 함께 저장해 correction residual을 구성한다.

Correction Model은 상태와 VLA proposal을 조건으로 차원별 Gaussian residual 분포를 예측한다. 평균 residual을 더한 액션을 제약 중심으로 삼고, 역분산으로 가중한 Mahalanobis 거리를 정책 제약으로 사용한다. 상태별 Lagrange multiplier가 return 최대화, VLA anchor, 사람 교정 제약의 균형을 primal-dual 방식으로 조절한다.

# Experiments / Results

네 과업 평균 성공률은 BEE 91.2%, RLT 57.5%, DSRL 42.1%, Base Policy 38.8%였다. BEE는 Phone Charging 100%, Snack Hanging 85%, Cloth Aligning 90%, Bowl Placing 90%를 기록했다. 실로봇 평균 사람 개입률도 RLT보다 낮았다.

| 로봇 / 벤치마크 / 태스크 | BEE 성공률 | 강한 비교 기준 |    차이 | 해석                                          |
| ------------------------ | ---------: | -------------: | ------: | --------------------------------------------- |
| 4개 과업 평균            |      91.2% |      RLT 57.5% | +33.7%p | 같은 online-data budget에서 큰 향상           |
| Snack Hanging            |      85.0% |      RLT 21.7% | +63.3%p | 변형 물체와 정밀 걸기에서 개입 적응 효과가 큼 |
| LIBERO-PRO Bowl Placing  |      90.0% |      RLT 76.7% | +13.3%p | 시뮬레이션에서도 개선 유지                    |

# Limitations / Discussion

사람 개입이 여전히 필요하고, Correction Model의 분산이 실제 신뢰도를 잘 반영하려면 충분하고 대표적인 intervention이 필요하다. 평가는 세 실로봇 과업과 하나의 시뮬레이션 과업에 한정되며, 다른 embodiment나 장기간 계속 학습에서의 안정성은 확인되지 않았다.

비교는 동일 online-data budget에 맞췄지만 초기 VLA 품질, 사람이 개입하는 기준, 조작자의 숙련도에 따라 결과가 달라질 수 있다. 차원별 대각 Gaussian은 action 간 상관관계나 여러 개의 타당한 교정 모드를 충분히 표현하지 못할 수 있다.

# 내가 이해한 핵심

사람의 교정은 복사해야 할 답안이 아니라 "어느 방향은 확실히 틀렸고 어느 방향은 여러 해답이 가능하다"는 구조화된 피드백이다. BEE의 핵심은 이 신뢰도 구조를 VLA 위의 RL 탐색 공간에 직접 반영한 것이다.

# 다음에 연결해서 읽을 논문

- RLT: frozen VLA proposal 위에서 chunk-level RL을 수행하는 기반 인터페이스
- DSRL: VLA의 latent noise space를 탐색하는 online RL 접근
- HIL-SERL / SiLRI: 사람 개입과 불확실성 제약을 활용하는 실로봇 RL
- HIL-UMI: VLA post-training용 human-in-the-loop 데이터 수집
