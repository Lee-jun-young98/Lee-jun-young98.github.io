---
title: "PREM: Prediction-Regulated Memory for Robot Manipulation"
date: 2026-11-03
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Xiao Huang, Ya Zhang, Weidi Xie"
paper: "https://arxiv.org/abs/2611.00634"
project: "https://1106280506hx.github.io/PREM/"
thumbnail: "/papers/assets/vla/prem-prediction-regulated-memory-for-robot-manipulation/overview.svg"
---

# 한 줄 요약

PREM은 action-conditioned future prediction을 학습 신호와 실행 중 피드백으로 함께 써서, 예측이 크게 빗나간 공간 위치만 시각 메모리에 강하게 반영하는 recurrent VLA다.

# 논문 정보

- 제목: PREM: Prediction-Regulated Memory for Robot Manipulation
- 저자: Xiao Huang, Ya Zhang, Weidi Xie
- 발표: 확인 필요 (arXiv v1, 2026-10-31)
- 링크: [arXiv](https://arxiv.org/abs/2611.00634) · [HTML](https://arxiv.org/html/2611.00634)
- 코드/프로젝트: [PREM project](https://1106280506hx.github.io/PREM/)
- 키워드: recurrent visual memory, future prediction, partial observability, dynamic manipulation, memory-dependent manipulation

# 핵심 아이디어

고정 크기 visual state를 단순히 매 시점 덮어쓰지 않는다. 직전 decision에서 예측한 다음 시각 feature와 실제 feature를 patch별로 비교하고, 공간 중앙값과 MAD로 정규화한 discrepancy를 update gate로 바꾼다. 예상과 크게 다른 gripper·object 영역은 새 관측을 강하게 받아들이고, 이미 잘 예측된 영역은 과거 state를 보존한다. 같은 future predictor는 학습 때 visual state가 동역학 정보를 담도록 감독한다.

# VLA 관점에서 중요한 이유

VLA의 partial observability를 더 긴 frame window로만 해결하지 않고, **정책 자체의 예측 실패가 어디에서 발생했는지**를 메모리 쓰기 신호로 사용한다. 이 구조는 현재 장면만으로 구분할 수 없는 RMBench M(1)에서 $\pi_{0.5}$의 14.4%를 83.8%로 끌어올렸고, 움직이는 물체를 다루는 DOMINO에서도 9.63%에서 20.74%로 개선했다. world prediction을 별도의 계획 출력이 아니라 policy memory의 학습·갱신 규칙으로 연결한 점이 핵심이다.

# Robot / Embodied Setting

기반 정책은 $\pi_{0.5}$이며 camera image, 언어 명령, proprioception을 받아 action chunk를 생성한다. 평가는 일반 조작 LIBERO 4개 suite, 위치 교란 LIBERO-Pro, 35개 동적 조작 task의 DOMINO, 과거 관측이 필요한 RMBench M(1) 5개 task family에서 수행한다. LIBERO는 1,693 demonstrations, DOMINO는 task당 최소 50개를 포함한 1,750 episodes, RMBench는 task당 50 demonstrations로 fine-tuning한다.

# Method

1. 시점 $t$의 관측 $O_t$를 spatial feature $X_t$로 만들고, 직전 시점에 cache한 예측 $\hat X_t$와 patch별 cosine+Smooth-L1 discrepancy를 계산한다.
2. discrepancy를 공간 median/MAD로 정규화한 $\xi_{t,i}$를 sigmoid gate $\beta_{t,i}$로 변환한다. recurrent visual memory(RVM)가 제안한 candidate $\widetilde M_t$를 $M_t=M_{t-1}+\beta_t\odot(\widetilde M_t-M_{t-1})$로 반영한다.
3. 갱신된 $M_t$를 temporal context로 base VLA에 넣어 action chunk를 생성한다.
4. action expert의 latent action representation과 $M_{t-1},X_t$를 query-based Transformer predictor에 넣어 다음 replanning 관측의 feature $\hat X_{t+1}$를 예측한다.
5. 학습에서는 action loss와 future-feature prediction loss를 함께 최적화한다. 추론에서는 $\hat X_{t+1}$를 cache했다가 실제 다음 관측과 비교해 다시 memory gate를 만든다.

# 핵심 그림

![PREM의 예측-검증-메모리 갱신-action 생성 순환 구조](/papers/assets/vla/prem-prediction-regulated-memory-for-robot-manipulation/overview.svg)

> 논문 Figure 2와 Equations (3)–(9)를 바탕으로 재구성한 PREM 아키텍처. 출처: [논문 HTML Figure 2 및 Method](https://arxiv.org/html/2611.00634#S2). 원본 그림을 복제하지 않고 핵심 모듈과 순환 흐름을 한국어로 다시 그렸다.
>
> 구조 그림을 고른 이유는 PREM의 기여가 future predictor 하나를 **학습 감독과 실행 중 spatial update gate**라는 두 역할로 재사용하는 연결 방식에 있기 때문이다. 입력 관측은 visual feature로 변환되고, cached prediction과의 차이가 RVM 갱신량을 조절한다. 갱신된 memory는 action 생성에 들어가며, 그 action latent가 다시 다음 feature prediction을 조건화한다. 학습에서는 $X_{t+1}$가 predictor와 memory에 gradient를 주고, 추론에서는 cache된 $\hat X_{t+1}$가 다음 decision의 검증 기준이 된다.

# Experiments / Results

## 주요 실험 결과

| 설정 / 지표 (success rate %, ↑)     |  PREM |        비교 기준 |     차이 | 출처    |
| ----------------------------------- | ----: | ---------------: | -------: | ------- |
| DOMINO 35-task 평균, 3,500 episodes | 20.74 | $\pi_{0.5}$ 9.63 | +11.11%p | Table 2 |
| DOMINO 35-task 평균                 | 20.74 |       PUMA 17.20 |  +3.54%p | Table 2 |
| RMBench M(1) 5-task 평균            |  83.8 | $\pi_{0.5}$ 14.4 |  +69.4%p | Table 3 |
| RMBench M(1) 5-task 평균            |  83.8 |     MaP-WAM 75.6 |   +8.2%p | Table 3 |
| LIBERO 4-suite 평균                 |  98.7 | $\pi_{0.5}$ 96.9 |   +1.8%p | Table 1 |
| LIBERO-10                           |  97.2 | $\pi_{0.5}$ 92.4 |   +4.8%p | Table 1 |

Table 5의 동일 DOMINO 설정에서 RVM만 추가하면 9.63%→15.43%(+5.80%p), future prediction 감독까지 넣으면 18.31%(+2.88%p), prediction-regulated update까지 넣으면 20.74%(+2.43%p)가 된다. 따라서 성능 향상이 recurrent state 하나에서만 나오지 않고 predictor의 두 역할이 각각 기여한다. 대신 H800 1장·batch 1 기준 평균 latency는 43.8 ms에서 51.5 ms로 7.7 ms 증가한다(Table 4).

# Limitations / Discussion

공식 학회 채택과 공개 코드 가용성은 아직 확인이 필요하다. 실험은 benchmark simulator 중심이며 실제 로봇의 장기 누적 오차나 camera shift에서 cache된 예측이 틀릴 때의 안정성은 직접 검증하지 않는다. spatial median/MAD는 상대적 discrepancy만 보므로 화면 전체가 동시에 급변하는 경우에는 절대적인 surprise를 축소할 수 있다. DOMINO의 절대 성공률 20.74%도 동적 조작이 여전히 어렵다는 점을 보여준다. 전체 fine-tuning에 8×H800을 사용해 재현 비용도 높다.

# 내가 이해한 핵심

PREM에서 future prediction은 미래 영상을 잘 그리기 위한 부가 과제가 아니다. “내 메모리가 이 위치를 얼마나 잘 설명했는가”를 측정하는 자기검증 신호이며, 이 신호가 다음 memory write의 공간적 우선순위를 정한다. 즉 prediction error를 실패 지표가 아니라 recurrent state의 쓰기 주소로 바꾼 방법이다.

# 다음에 연결해서 읽을 논문

- [MemoryVLA](https://arxiv.org/abs/2508.19236): recurrent visual memory를 VLA에 넣는 직접 비교축
- [ChainVLA](https://arxiv.org/abs/2609.01150): 긴 task history를 구조적으로 유지하는 memory VLA
- [MaP-WAM](https://arxiv.org/abs/2608.16445): world-action prediction과 memory-dependent manipulation의 비교축
- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): PREM이 확장한 base VLA
