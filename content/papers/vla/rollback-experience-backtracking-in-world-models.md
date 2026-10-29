---
title: "Rollback: Experience Backtracking in World Models for Policy Improvement"
date: 2026-10-29
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Jiayi Luo et al."
paper: "https://arxiv.org/abs/2610.36068"
project: "https://rollback-wm.github.io/"
thumbnail: "/papers/assets/vla/rollback-experience-backtracking-in-world-models/overview.svg"
---

# 한 줄 요약

실제 로봇 경험의 중간 시점으로 세계모델을 되감아 대안 action chunk를 비교하고, 그 상대 성과로 $\pi_{0.5}$ 정책과 세계모델을 함께 개선하는 방법이다.

# 논문 정보

- 제목: Rollback: Experience Backtracking in World Models for Policy Improvement
- 저자: Jiayi Luo, Yang Zhang, Liliang Chen, Nan Wang, Chen Gao 외 11명
- 발표: 확인 필요 (arXiv v1, 2026-10-26)
- 링크: [arXiv](https://arxiv.org/abs/2610.36068) · [HTML](https://arxiv.org/html/2610.36068)
- 코드/프로젝트: [공식 프로젝트 페이지](https://rollback-wm.github.io/) · 코드는 확인되지 않음
- 키워드: world model, VLA post-training, experience backtracking, tree search, real-world robot learning

# 핵심 아이디어

물리 환경은 실패 직전의 동일 상태로 정확히 돌아갈 수 없지만, action-conditioned 세계모델은 저장한 temporal context $m_t$를 복구할 수 있다. Rollback은 이 차이를 이용해 실제 성공·실패 trajectory의 중간 decision point에서 여러 action chunk를 분기한다. MCTS가 성공과 실패가 갈리는 지점에 상상 예산을 집중하고, 같은 부모를 공유하는 sibling subtree의 결과를 비교해 별도 value network 없이 상대적 action-quality label을 만든다.

# VLA 관점에서 중요한 이유

기반 정책이 flow-matching VLA인 $\pi_{0.5}$이고, 관측은 다중 RGB·proprioception·언어 지시, 출력은 action chunk다. 핵심은 VLA를 실제 로봇에서 무작정 rollout하지 않고, 실제 경험에 고정된 세계모델 분기에서 **어느 chunk가 결과를 바꿨는지** 학습한다는 점이다. forward rollout만 쓰는 세계모델 RL보다 credit assignment가 촘촘하며, 배포 시에는 tree search 없이 개선된 정책만 실행한다.

# Robot / Embodied Setting

AGIBOT Genie-02 양팔 로봇으로 Block Extraction, Ball Tossing, Tabletop Curling을 평가한다. 정책은 head camera 1대와 wrist camera 2대, proprioception을 입력받고 양팔 7 joint와 gripper를 합친 16차원 action을 30 Hz로 제어한다. 위치별로 15회, Block Extraction은 25회 실행하며 Tabletop Curling은 9개, 나머지는 6개 초기 위치를 사용한다.

# Method

1. 실제 demonstration과 로봇 rollout에서 seed trajectory를 뽑고, GE-Sim 2.0 세계모델의 저장 context로 중간 시점을 복구한다.
2. 최고 quality bin으로 조건화한 $\pi_{0.5}$가 action chunk 후보를 만들고, MCTS·progressive widening이 결과가 갈리는 branch를 우선 확장한다.
3. sibling subtree의 성공률 $\hat q(v,\mathbf{a}_i)$를 같은 부모의 최댓값으로 정규화해 5개 상대 quality bin으로 바꾼다. 같은 bin만 가진 group은 preference 신호가 없으므로 버린다.
4. tree label, demonstration, 실제 trajectory를 섞어 advantage-conditioned flow-matching objective로 정책을 갱신한다.
5. 실제 trajectory는 세계모델에도 들어가며 LoRA SFT 뒤 DMD를 적용한다. 검색, 정책 학습, 세계모델 적응, 실제 로봇 실행은 versioned snapshot을 교환하며 비동기로 진행된다.

# 핵심 그림

![실제 경험에서 세계모델 context를 복원해 대안 action chunk를 탐색하고 정책과 세계모델을 함께 갱신하는 Rollback 구조](/papers/assets/vla/rollback-experience-backtracking-in-world-models/overview.svg)

> 그림 2와 Figure 4, Algorithm 1을 바탕으로 재구성한 Rollback 학습 파이프라인. 출처: [논문 HTML의 Figure 2와 Section 4–5](https://arxiv.org/html/2610.36068#S4). 원 논문은 CC BY 4.0이지만, 한글 설명과 학습·배포 경로를 한 화면에서 읽을 수 있도록 직접 재구성했다.
>
> 구조 그림을 고른 이유는 이 논문의 차별점이 개별 로봇 장면보다 **복구된 동일 context에서의 분기 비교와 비동기 co-evolution**에 있기 때문이다. 학습 입력은 실제 trajectory와 language-conditioned 관측이고, 중심 모듈은 context cache를 가진 GE-Sim 2.0, MCTS, subtree value aggregation, advantage-conditioned $\pi_{0.5}$다. 출력은 tree-derived quality label과 개선된 action policy이며, 실제 rollout은 다시 세계모델을 물리적으로 grounding한다. 추론 시에는 검색과 세계모델이 빠지고, 최고 quality bin으로 조건화한 정책만 로봇에서 action chunk를 생성한다.

# Experiments / Results

## 주요 실험 결과

| 실로봇 태스크 / 지표 (성공률 %, ↑) | Rollback | 가장 강한 동일 조건 baseline |     차이 | 출처    |
| ---------------------------------- | -------: | ---------------------------: | -------: | ------- |
| Block Extraction                   |    69.33 |        RISE w/ GE-Sim2 58.67 | +10.66%p | Table 1 |
| Ball Tossing                       |    40.00 |        RISE w/ GE-Sim2 28.89 | +11.11%p | Table 1 |
| Tabletop Curling                   |    64.44 |        RISE w/ GE-Sim2 52.59 | +11.85%p | Table 1 |
| 세 태스크 평균                     |    57.93 |        RISE w/ GE-Sim2 46.72 | +11.21%p | Table 1 |

RISE 비교는 같은 GE-Sim 2.0 세계모델과 정책 초기화를 사용한 저자 재현값이라, backtracking search와 tree-structured supervision의 효과를 비교하는 데 적합하다. 논문 본문은 Block Extraction 차이를 반올림해 +10.67%p로 보고하지만 표의 표시값끼리 계산하면 $69.33-58.67=10.66$%p다. Ball Tossing은 8시간 동안 RECAP 초기값 25.56%에서 40.00%로, Tabletop Curling은 51.11%에서 64.44%로 올라 각각 6시간과 4시간에 평균 human player 성능을 넘었다.

Block Extraction ablation에서도 full model의 성공률 69.33%는 frozen world model 64.67%보다 +4.66%p, direct reward supervision 59.33%보다 +10.00%p 높다. 이는 실제 trajectory로 세계모델을 계속 보정하는 과정과 sibling subtree를 집계한 상대 label이 둘 다 필요함을 보여준다(Table 2).

# Limitations / Discussion

task-specific reward model과 긴 contact-rich horizon에서의 세계모델 정확도에 의존한다. 실제로 Block Extraction open-loop RGB L1 error는 rollout 첫 1/4의 6.79에서 마지막 1/4의 11.79로 커진다. 실험은 태스크마다 별도 정책, 물리 로봇 1대, 검색용 H200 40대와 정책 학습용 H200 8대 구성이라 계산 자원과 multi-task·multi-robot 확장성이 아직 검증되지 않았다. 저자도 outcome detector 공동 학습과 여러 로봇이 하나의 search cluster를 공유하는 확장을 후속 과제로 둔다.

# 내가 이해한 핵심

이 논문의 핵심은 세계모델을 긴 미래를 한 번 예측하는 비디오 생성기로 쓰는 것이 아니라, **실제 로봇이 이미 도달한 상태를 복원해 한 번의 결정을 반사실적으로 비교하는 도구**로 바꾼 데 있다. 같은 prefix를 공유하는 sibling만 비교하면 영상 품질의 절대 정확도보다 행동 간 상대 결과가 중요해지고, sparse episode reward를 action-chunk 수준 supervision으로 바꿀 수 있다.

# 다음에 연결해서 읽을 논문

- [RISE](https://arxiv.org/abs/2602.11075): 같은 계열의 world-model policy improvement와 learned progress value 비교
- [RECAP](https://arxiv.org/abs/2503.02608): Rollback이 채택한 advantage-conditioned policy training의 기반
- [World-Gymnast](https://arxiv.org/abs/2604.07371): 실제 경험으로 세계모델을 반복 보정하는 접근
- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): 기반 flow-matching VLA와 open-world generalization
