---
title: "XPACE: Joint World and Action Modeling from Heterogeneous Experience"
date: 2026-09-16
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "World Model"
  - "Humanoid"
venue: "확인 필요"
authors: "Jiacheng Wei, Jerry Bai, Xiaoyu Yue, Zidong Wang, Xiaoyang Guo, Cheng Chen, Fanqi Pu, Fan Wu, Zhixu Yue, Yizhuo Li, Feng Qiu, Bo Liu, Yuying Ge, Hui Zhou, Chenyi Chen, Yixiao Ge"
paper: "https://arxiv.org/abs/2609.17372"
code: ""
project: ""
---

# 한 줄 요약

XPACE는 하나의 video backbone으로 action과 미래 영상을 함께 예측하고, 자체 simulator가 실패 주변의 recovery trajectory를 합성하게 해 heterogeneous human/robot experience를 humanoid policy 개선으로 연결한다.

# 논문 정보

- 제목: XPACE: Joint World and Action Modeling from Heterogeneous Experience
- 저자: Jiacheng Wei 외 15명
- 발표: 확인 필요 (arXiv v1, 2026-09-15)
- 링크: [arXiv](https://arxiv.org/abs/2609.17372)
- 코드/프로젝트: 확인 필요
- 키워드: world-action model, world simulator, heterogeneous experience, recovery data, humanoid robot

# 핵심 아이디어

XPACE는 동일한 backbone을 두 가지 모드로 사용한다. policy 모드에서는 미래 video와 실행 가능한 robot action을 함께 예측하고, simulator 모드에서는 주어진 action이 만들 시각적 결과를 예측한다. action label 없는 video는 visual dynamics를, action label이 있는 human/robot demonstration은 video와 action의 연결을 가르친다.

coarse-to-fine curriculum은 초기에 폭넓은 경험을 유지하고 후반으로 갈수록 robot control 비중을 높인다. 이후 simulator를 자신의 생성 context에 적응시키고 expert trajectory 주변의 deviation-recovery trajectory를 합성한다. 품질 필터를 통과한 recovery example로 policy를 다시 fine-tune한다.

# VLA 관점에서 중요한 이유

VLA의 데이터 부족 문제를 단순히 더 많은 robot demonstration을 모으는 문제로 보지 않는다. video prediction을 공통 인터페이스로 삼으면 action 없는 video, human demonstration, robot demonstration을 같은 모델 안에서 연결할 수 있다.

또한 world model을 rollout 예측에만 쓰지 않고 policy가 취약한 상태를 만들고 회복 supervision을 공급하는 data engine으로 사용한다. 이는 VLA와 simulator를 따로 두는 방식보다 policy self-improvement에 직접적이다.

# Robot / Embodied Setting

- 플랫폼: XPENG IRON humanoid robot
- 데이터: action 없는 video, action-labeled human demonstration, robot demonstration
- policy 출력: executable robot action과 future video
- simulator 출력: prescribed action 이후의 visual consequence
- 평가 초점: robot demonstration에 없던 human-observed skill transfer, disturbance robustness, recovery

# Method

shared video backbone 위에서 world-action policy와 action-conditioned simulator를 공동 학습한다. heterogeneous data의 label 가용성에 따라 video prediction과 action prediction objective를 선택적으로 적용한다.

두 번째 단계에서는 simulator가 expert demonstration 주변의 이탈 상태와 복귀 과정을 생성한다. 생성된 trajectory를 필터링한 뒤 recovery dataset으로 사용해, 실제 실패 수집 비용 없이 policy가 off-trajectory state에서 돌아오는 능력을 강화한다.

# Experiments / Results

IRON humanoid의 실제 task에서 heterogeneous training은 robot-only training보다 robustness를 높였고, robot demonstration에 포함되지 않았지만 human video에서 관찰한 skill의 전이를 가능하게 했다. 자체 simulator가 생성한 recovery data를 추가하면 실제 task completion이 더 향상됐다.

현재 arXiv 초록만으로는 task별 성공률, 데이터 규모, baseline별 수치를 완전히 확인하기 어려우므로 정량 표는 원문 기반 추가 확인이 필요하다.

# Limitations / Discussion

공개 초록 기준으로는 simulator가 만든 recovery trajectory의 물리적 타당성을 보장하는 방법과 filtering 비용이 충분히 드러나지 않는다. 생성 context에 적응하는 과정이 model bias를 확대할 가능성도 있다.

실험이 특정 humanoid 플랫폼에 집중되어 있어 다른 robot morphology와 contact-rich manipulation으로의 일반화는 미확인이다. 코드·데이터 공개 상태와 venue 역시 확인이 필요하다.

# 내가 이해한 핵심

XPACE의 핵심은 world model을 “미래를 보는 보조 head”에서 “새로운 실패·회복 경험을 만드는 학습 파트너”로 확장한 것이다. video가 서로 다른 embodiment의 경험을 이어 주고, simulator가 그 경험을 policy 개선용 데이터로 되돌린다.

# 다음에 연결해서 읽을 논문

- ModAR: 미래 modality를 순차 생성하는 더 작은 world-action model
- HuRo: human video를 robot-compatible pretraining data로 변환하는 접근
- DreamZero / Cosmos Policy: video generation 기반 robot policy
- DAgger 계열 연구: off-policy state와 recovery supervision의 고전적 관점
