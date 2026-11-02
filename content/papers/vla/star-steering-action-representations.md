---
title: "STAR: Steering Action Representations with Proprioception for VLA Inference"
date: 2026-11-02
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Guangyu Zhao et al."
paper: "https://arxiv.org/abs/2610.41009"
code: "https://github.com/PKU-VaLuE-Lab/STAR"
thumbnail: "/papers/assets/vla/star-steering-action-representations/overview.svg"
---

# 한 줄 요약

STAR는 VLA 후기층에서 희미해지는 object-aware residual 방향을 EMA로 이어 주고 로봇 proprioception으로 혼합 강도를 조절해, 가중치 수정이나 추가 forward pass 없이 frozen 정책의 성공률을 높인다.

# 논문 정보

- 제목: STAR: Steering Action Representations with Proprioception for VLA Inference
- 저자: Guangyu Zhao, Yongchang Zhang, Haoxuan Ru, Kaichen He, Haoran Wen, Kun Zhan, Zeyu Zhang, Yin Li, Yiwu Zhong
- 발표: 확인 필요 (arXiv v1, 2026-10-29)
- 링크: [arXiv](https://arxiv.org/abs/2610.41009) · [HTML](https://arxiv.org/html/2610.41009)
- 코드/프로젝트: [GitHub](https://github.com/PKU-VaLuE-Lab/STAR)
- 키워드: training-free VLA inference, visual grounding, residual steering, proprioception, EMA

# 핵심 아이디어

저자들은 목표 물체를 가린 입력과 원본 입력의 action hidden-state 차이를 층별로 측정한다. object awareness는 초·중반층에서 커지지만 action decoder에 가까운 후기층에서 다시 줄어든다. STAR는 마지막 1/3 Transformer layer에서 이전 층 residual update의 EMA를 현재 update와 섞어 초·중반층의 object-aware 방향을 보존한다. 고정 mixing은 접촉·회전 같은 급격한 전환에서 원래 정책을 과도하게 바꿀 수 있으므로, 최근 proprioceptive trajectory의 방향 일관성·이동 크기·jerk·회전 변화를 사용해 step별 $\beta_t$를 정한다.

# VLA 관점에서 중요한 이유

VLA의 visual grounding 실패를 attention map이나 입력 token pruning이 아니라 **action hidden state의 깊이별 정보 손실**로 본다. 모델 재학습 없이 residual stream만 조정하며, attention을 얻기 위한 추가 forward pass가 필요한 DTP와 달리 single-pass다. 또한 시각 grounding 보정 강도를 로봇의 실제 움직임 상태로 조절해 perception-side intervention과 control dynamics를 직접 연결한다.

# Robot / Embodied Setting

평가는 frozen OpenVLA-7B, GR00T-N1.5, $\pi_{0.5}$에 STAR를 붙여 수행한다. SimplerEnv는 Google Robot의 drawer, Coke can, move-near, generic pick 등 6개 태스크를 사용한다. LIBERO-PRO는 LIBERO-10의 language, object, spatial swap, task, environment perturbation 5개 split이며, $\pi_{0.5}$는 split당 500 episode, 총 2,500 episode를 평가한다. 모든 모델 가중치는 고정된다.

# Method

1. RGB $I_t$, proprioceptive state $s_t$, 언어 $x$에서 frozen VLA가 action chunk를 만든다.
2. 전체 $n$개 Transformer 중 앞 2/3은 원래대로 두어 language-conditioned visual evidence를 형성한다.
3. 마지막 1/3에서 층별 residual update $\Delta h^k$의 EMA momentum을 계산하고, 현재 update와 혼합해 object-aware 방향을 후기층으로 전달한다.
4. 최근 proprioception에서 direction consistency와 translation scale을 progress evidence로, jerk와 rotation change를 transition evidence로 계산한다.
5. transition이 클수록 보수적인 step-level coefficient $\beta_t$를 사용하고, 최종 hidden state를 기존 action decoder에 그대로 넣는다. 학습, token pruning, 두 번째 forward pass는 없다.

# 핵심 그림

![STAR가 proprioception으로 EMA 계수를 정하고 VLA 후기층 residual update를 혼합하는 추론 흐름](/papers/assets/vla/star-steering-action-representations/overview.svg)

> 논문 Figure 2와 Equations (2–9)를 바탕으로 재구성한 STAR 추론 구조. 출처: [논문 HTML Figure 2 및 Method](https://arxiv.org/html/2610.41009#S3). 원본 이미지를 복제하지 않고 입력, 계수 계산, 후기층 개입, action 출력 관계를 한국어로 다시 그렸다.
>
> 구조 그림을 고른 이유는 STAR의 핵심이 새 backbone이 아니라 **어느 층의 어떤 residual을 얼마만큼 바꾸는가**이기 때문이다. 앞 2/3 layer는 시각·언어 evidence를 원래대로 쌓고, 마지막 1/3 layer만 EMA momentum을 받는다. proprioception branch는 steady progress일 때 더 강한 mixing, 접촉·회전·jerk가 큰 transition일 때 더 보수적인 mixing을 선택한다. 학습 경로는 없고 추론 때만 이 single-pass intervention이 작동한다.

# Experiments / Results

## 주요 실험 결과

| backbone / benchmark / 지표 (success rate %, ↑) | STAR |                 Native |    차이 | 출처    |
| ----------------------------------------------- | ---: | ---------------------: | ------: | ------- |
| GR00T-N1.5 / SimplerEnv 평균                    | 46.3 |                   41.0 |  +5.3%p | Table 1 |
| OpenVLA / SimplerEnv 평균                       | 36.0 |                   30.3 |  +5.7%p | Table 1 |
| GR00T-N1.5 / LIBERO-PRO 평균                    | 43.2 |                   40.3 |  +2.9%p | Table 2 |
| $\pi_{0.5}$ / LIBERO-PRO 평균                   | 50.1 |                   48.2 |  +1.9%p | Table 2 |
| $\pi_{0.5}$ / LIBERO-PRO task split             | 18.8 |                    6.8 | +12.0%p | Table 2 |
| OpenVLA / SimplerEnv, proprioception ablation   | 36.0 | no proprioception 27.8 |  +8.2%p | Table 3 |

GR00T-N1.5 SimplerEnv에서는 6개 태스크 모두 native보다 올랐고, object split은 40.4%→48.0%(+7.6%p)다. 다만 $\pi_{0.5}$ LIBERO-PRO에서는 평균이 올라도 language 92.8%→92.6%, swap 9.2%→7.2%, environment 65.8%→65.0%처럼 일부 split은 하락한다. 따라서 STAR를 보편적 monotonic improvement로 해석하면 안 된다.

# Limitations / Discussion

후기층 object-awareness 지표는 목표 물체를 마스킹한 hidden-state 거리라는 heuristic이며 실제 causal grounding을 완전히 증명하지 않는다. $\rho=2/3$과 $\beta$ 범위는 backbone·태스크별 추가 조정이 필요할 수 있고, 일부 LIBERO-PRO split에서는 성능이 떨어진다. 접촉력이나 tactile observation 없이 proprioceptive 변화만 transition proxy로 쓰므로 미세 접촉을 놓칠 수 있다. 안전성·latency·실로봇 장기 안정성에 대한 정량 평가는 제한적이다.

# 내가 이해한 핵심

STAR는 “VLA가 물체를 못 봤다”기보다 “중간층에서는 봤지만 action 출력까지 그 evidence를 보존하지 못했다”는 진단에서 출발한다. 이미 생긴 좋은 update 방향을 후기층으로 약하게 관성 전달하되, 로봇이 급격히 움직이는 순간에는 개입을 줄이는 것이 핵심이다.

# 다음에 연결해서 읽을 논문

- [DTP](https://arxiv.org/abs/2603.06003): task-relevant token을 골라 distraction을 줄이는 training-free 비교 방법
- [ReconVLA](https://arxiv.org/abs/2503.10675): reconstructive supervision으로 visual grounding을 학습하는 접근
- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): STAR가 flow-based action expert에 적용한 핵심 backbone
- [OpenVLA](https://arxiv.org/abs/2406.09246): autoregressive VLA에서의 적용 기반
