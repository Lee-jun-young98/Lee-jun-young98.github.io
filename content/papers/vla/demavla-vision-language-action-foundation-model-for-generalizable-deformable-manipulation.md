---
title: "DeMaVLA: A Vision-Language-Action Foundation Model for Generalizable Deformable Manipulation"
date: 2026-09-04
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Deformable Manipulation"
venue: "arXiv 2026"
authors: "Taiyi Su, Jian Zhu, Tianjian Wang, Youzhang He, Zitai Huang, Jianjun Zhang, Chong Ma, Hanyang Wang, Tianjiao Zhang, Munan Yin, Weihao Ding, Yi Xu"
paper: "https://arxiv.org/abs/2605.31286"
code: ""
project: ""
---

# 한 줄 요약

DeMaVLA는 옷처럼 형태가 계속 바뀌는 deformable object를 하나의 VLA 정책으로 접고 조작하기 위해, VLM backbone과 flow-matching action expert를 결합하고 대규모 양팔 로봇 데이터와 human-gated DAgger를 함께 사용한 논문이다.

# 논문 정보

- 제목: DeMaVLA: A Vision-Language-Action Foundation Model for Generalizable Deformable Manipulation
- 저자: Taiyi Su, Jian Zhu, Tianjian Wang, Youzhang He, Zitai Huang, Jianjun Zhang, Chong Ma, Hanyang Wang, Tianjiao Zhang, Munan Yin, Weihao Ding, Yi Xu
- 발표: arXiv 2026, cs.RO, venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2605.31286)
- 코드/프로젝트: 확인 필요
- 키워드: VLA, deformable manipulation, bimanual robot, flow matching, human-gated DAgger

# 핵심 아이디어

이 논문이 보는 문제는 일반 물체 조작보다 더 까다로운 deformable manipulation이다. 셔츠, 바지, 수건처럼 접히고 구겨지는 물체는 초기 상태와 중간 상태가 다양해서, 카테고리마다 별도 정책을 두면 실제 가정 환경으로 확장하기 어렵다.

DeMaVLA는 하나의 체크포인트로 여러 종류의 의류 접기 태스크를 처리하려고 한다. 이를 위해 Qwen3-VL 계열의 VLM backbone 위에 action expert를 붙이고, continuous action generation은 flow matching으로 구성한다. action expert는 backbone과 구조적 정렬을 유지하되 일부 transformer layer를 pruning해서 반복 forward가 필요한 flow 기반 액션 생성 비용을 줄인다.

# VLA 관점에서 중요한 이유

VLA 연구에서 중요한 질문은 "VLM의 의미 이해를 어떻게 실제 action으로 안정적으로 연결할 것인가"이다. DeMaVLA는 이 질문을 단순 pick-and-place가 아니라 long-horizon bimanual folding으로 가져간다. 즉, 언어 지시와 시각 관찰이 action chunk로 이어지는지만 보는 것이 아니라, 물체 상태가 계속 바뀌는 상황에서 공유 가능한 조작 prior를 배울 수 있는지 본다.

또 하나의 포인트는 scaling이다. 논문은 약 5,000시간 규모의 real-world dual-arm demonstration으로 pre-training을 하고, 이후 실제 로봇 rollout 실패 지점에서 사람이 개입하는 human-gated DAgger로 post-training 데이터를 보강한다. VLA가 실험실 benchmark를 넘어가려면 대규모 데이터와 실패 기반 보정 루프가 같이 필요하다는 메시지가 강하다.

# Robot / Embodied Setting

주요 대상은 household folding이다. 로봇은 셔츠, 바지, 수건, 스커트처럼 모양과 재질, 초기 상태가 다른 의류를 양팔로 조작해야 한다. 이 설정은 단일 팔 조작보다 action space가 크고, 중간 상태가 시각적으로 모호하며, 한 번의 실수가 뒤 단계 전체에 영향을 주기 쉽다.

따라서 이 논문에서 deformable folding은 VLA의 좋은 stress test다. 물체 인식, language grounding, 장기 계획, bimanual coordination, 실패 복구가 한꺼번에 필요하기 때문이다.

# Method

모델은 크게 VLM backbone과 action expert로 나뉜다. VLM backbone은 이미지와 언어 지시에서 task context를 만들고, action expert는 이를 바탕으로 로봇의 continuous action chunk를 생성한다. action generation에는 flow matching을 사용해 multimodal action distribution을 다루면서도 부드러운 행동을 만들도록 한다.

효율화를 위해 action expert는 LLM 구조를 그대로 크게 복제하지 않는다. 논문은 layer-wise alignment를 유지하면서 every other transformer layer를 제거하는 식의 skip-layer pruning을 사용한다. 이렇게 하면 VLM과 action expert 사이의 구조적 호환성은 유지하면서 학습과 추론 비용을 낮출 수 있다.

학습은 두 단계로 이해할 수 있다. 먼저 대규모 양팔 demonstration에서 일반 조작 prior를 pre-training한다. 그 다음 mixed folding data와 real-robot failure correction을 모아 post-training한다. 특히 human-gated DAgger는 정책이 실패하는 상태 분포에서 사람이 필요한 순간만 개입해 correction trajectory를 수집한다는 점이 핵심이다.

# Experiments / Results

평가는 RoboTwin simulation benchmark와 real-world household folding benchmark에서 진행된다. 논문은 DeMaVLA가 시뮬레이션 평균 성능에서 기존 VLA baseline보다 강한 결과를 보이고, 실제 folding benchmark에서도 단일 태스크 fine-tuning이 아니라 multi-category folding을 하나의 정책으로 수행할 수 있음을 강조한다.

pre-training scaling 분석도 인상적이다. 논문은 real-world pre-training data를 500시간, 2,500시간, 5,000시간으로 늘려 비교하고, 5,000시간 설정에서 shirt-folding 성공률과 완료 시간이 크게 좋아졌다고 보고한다. 이는 deformable manipulation에서 모델 구조만큼 데이터 규모가 중요하다는 근거로 읽힌다.

# Limitations / Discussion

첫째, venue는 arXiv 기준으로 확인했으며 top conference acceptance는 아직 확인 필요하다. 자동화에서는 이후 proceedings나 OpenReview 상태 변화가 생기면 갱신 대상으로 잡아야 한다.

둘째, 논문은 folding 중심이라 VLA 일반성의 범위가 household deformable manipulation에 가깝다. rigid object manipulation, mobile manipulation, humanoid whole-body control까지 바로 일반화된다고 보기는 어렵다.

셋째, 대규모 real-world dual-arm demonstration과 human correction loop가 강점인 동시에 비용이다. 실제로 재현하려면 데이터 수집 인프라와 사람 개입 프로토콜이 필요하다.

# 내가 이해한 핵심

DeMaVLA의 핵심은 "VLA를 잘 만들려면 VLM backbone을 붙이는 것만으로는 부족하고, action expert의 구조적 정렬, flow 기반 continuous control, real-world data scaling, 실패 기반 correction이 같이 맞아야 한다"는 점이다.

특히 deformable object folding은 perception이 틀리면 action이 바로 무너지는 영역이라, VLA가 의미 이해를 행동으로 바꾸는 과정의 약점을 잘 드러낸다. 그래서 이 논문은 VLA 모델의 실전성을 볼 때 단순 benchmark score보다 데이터 루프와 action representation을 같이 봐야 한다는 체크리스트로 유용하다.

# 다음에 연결해서 읽을 논문

- RT-2: Vision-Language-Action Models Transfer Web Knowledge to Robotic Control
- OpenVLA: An Open-Source Vision-Language-Action Model
- pi0: A Vision-Language-Action Flow Model for General Robot Control
- FAST: Efficient Action Tokenization for Vision-Language-Action Models
- RoboTwin 2.0: A Scalable Data Generator and Benchmark for Bimanual Manipulation
