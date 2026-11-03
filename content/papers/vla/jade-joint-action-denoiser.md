---
title: "JADE: Vision-Language Models Are Joint Denoisers in Robotic Action Generation"
date: 2026-11-03
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Xicheng Gong, Wenxuan Song, Chengze Liu, Qiwei Li, Qize Yu, Jiaolong Yang, Haoang Li, Yadong Mu"
paper: "https://arxiv.org/abs/2611.01215"
thumbnail: "/papers/assets/vla/jade-joint-action-denoiser/overview.svg"
---

# 한 줄 요약

JADE는 noisy action을 compact latent로 VLM에 다시 넣어 매 flow-denoising 단계마다 의미적 guidance를 갱신하고, 적은 sampling step에서도 강한 VLA action 생성을 가능하게 한다.

# 논문 정보

- 제목: Vision-Language Models Are Joint Denoisers in Robotic Action Generation
- 저자: Xicheng Gong, Wenxuan Song, Chengze Liu, Qiwei Li, Qize Yu, Jiaolong Yang, Haoang Li, Yadong Mu
- 발표: 확인 필요 (arXiv v1, 2026-10-31)
- 링크: [arXiv](https://arxiv.org/abs/2611.01215) · [HTML](https://arxiv.org/html/2611.01215)
- 코드/프로젝트: 공개 여부 확인 필요
- 키워드: joint action denoising, flow matching, action tokenizer, adaptive sampling, bimanual manipulation

# 핵심 아이디어

기존 flow VLA는 VLM이 만든 vision-language feature를 고정 condition으로 두고 action expert만 noisy action을 반복 정제한다. JADE는 매 step의 noisy action chunk를 frozen Ordered Action Tokenizer(OAT)의 8개 compact register로 만들고 VLM에 observation prefix와 함께 통과시킨다. 이 action-dependent VLM feature가 각 action-expert layer를 gated cross-attention으로 안내하므로, VLM의 guidance도 현재 action 후보에 맞춰 계속 변한다.

# VLA 관점에서 중요한 이유

VLM과 action expert의 결합을 “한 번 이해하고 여러 번 denoise”에서 **둘이 함께 action을 denoise**하는 구조로 바꾼다. RoboTwin Random에서 $\pi_{0.5}$ 대비 46.0%→54.4%(+8.4%p), RoboDojo 평균 성공률에서 6.91%→12.67%(+5.76%p)를 보이며 OOD·정밀·장기 task에서 동적 의미 guidance의 효과를 드러낸다. 2-step JADE가 10-step base보다 높은 성능을 내는 결과는 semantic conditioning과 sampling efficiency를 함께 설계할 수 있음을 보여준다.

# Robot / Embodied Setting

$\pi_{0.5}$를 기반으로 세 RGB view, 언어 명령, robot state에서 50-step bimanual action chunk를 예측하고 첫 25 action을 실행한다. RoboTwin 2.0은 50개 task의 Clean/Random 조건에서 task·조건당 100회 평가한다. RoboDojo는 3,500 demonstrations로 학습하고 Generalization, Precision, Long-Horizon, Memory, Open의 42개 task·6,300 trials를 category-weighted score와 success rate로 평가한다. 추가로 네 개 실로봇 양팔 task를 평가한다.

# Method

1. 관측·언어 prefix는 VLM key/value cache $\mathcal C(o_t)$로 한 번 계산한다. action expert는 Gaussian noise에서 시작한 50-step chunk $A_\tau$를 conditional flow matching으로 정제한다.
2. 각 denoising step에서 frozen OAT encoder가 현재 noisy physical action을 8개의 4차원 ordered latent $Z_\tau$로 압축한다.
3. adapter가 latent와 flow time을 VLM-width register로 바꾸고, register는 cached observation prefix에 attention해 action-state-dependent feature $R_\tau^{(\ell)}$를 만든다.
4. 각 action-expert layer는 gated cross-attention으로 같은 depth의 VLM register를 읽어 velocity prediction을 보정한다.
5. 학습 때 최종 VLM register가 clean OAT latent $Z_0$를 복원하도록 Smooth-L1 alignment loss를 더한다. 추론 때는 alignment head를 버리고 joint denoising만 수행한다.
6. correction magnitude에 따른 adaptive step-size(Balanced)는 별도 model evaluation 없이 step 수를 조절한다.

# 핵심 그림

![JADE의 noisy action OAT latent, VLM register, action expert 공동 denoising 구조](/papers/assets/vla/jade-joint-action-denoiser/overview.svg)

> 논문 Figure 2와 Equations (1)–(4)를 바탕으로 재구성한 JADE 아키텍처. 출처: [논문 HTML Figure 2 및 Method](https://arxiv.org/html/2611.01215#S3). 원본 그림을 복제하지 않고 joint denoising의 데이터 흐름을 한국어로 다시 그렸다.
>
> 구조 그림을 고른 이유는 기존 $\pi_{0.5}$식 static conditioning과 JADE의 차이가 **noisy action이 VLM으로 되먹임되는 순환 경로**에 있기 때문이다. 관측 prefix는 cache하지만, OAT register와 VLM feature는 매 denoising step 갱신된다. 이 feature가 layer별 gated cross-attention으로 action expert를 안내한다. 학습에서는 clean latent alignment가 VLM에 직접 action 신호를 주고, 추론에서는 noise→action 적분과 adaptive step schedule만 남는다.

# Experiments / Results

## 주요 실험 결과

| 설정 / 지표 (success rate %, ↑) |  JADE |                비교 기준 |    차이 | 출처     |
| ------------------------------- | ----: | -----------------------: | ------: | -------- |
| RoboTwin 2.0 Clean, 50 tasks    |  79.3 |         $\pi_{0.5}$ 68.5 | +10.8%p | Table 1  |
| RoboTwin 2.0 Random, 50 tasks   |  54.4 |         $\pi_{0.5}$ 46.0 |  +8.4%p | Table 1  |
| RoboTwin 2.0 Clean/Random 평균  |  66.9 |         $\pi_{0.5}$ 57.3 |  +9.6%p | Table 1  |
| RoboDojo 5-category 평균 SR     | 12.67 |         $\pi_{0.5}$ 6.91 | +5.76%p | Table 2  |
| RoboTwin, JADE 2-step           |  66.0 | $\pi_{0.5}$ 10-step 57.3 |  +8.7%p | Figure 4 |
| RoboDojo, JADE 2-step           |  9.67 | $\pi_{0.5}$ 10-step 6.91 | +2.76%p | Figure 4 |

동일 checkpoint에서 10-step JADE는 RoboTwin 66.9%, RoboDojo 12.67%이고, 평균 약 5 NFE의 Balanced는 각각 65.2%, 12.48%로 성능을 대부분 유지한다. model-side latency는 $\pi_{0.5}$ 10-step 74 ms, JADE 10-step 203 ms, Balanced 132 ms, 2-step 78 ms다. 즉 2-step JADE는 base와 거의 같은 latency에서 더 높은 성공률을 내지만, 최고 성능의 10-step 구성은 여전히 2.7배가량 느리다. action latent conditioning+alignment는 RoboTwin 평균 66.9%로 query conditioning+alignment의 59.0%보다 7.9%p 높다(Table 3a).

# Limitations / Discussion

공식 venue와 코드 공개는 확인이 필요하다. joint denoising은 step마다 VLM register를 다시 계산하므로 최대 성능 설정의 latency와 학습 update 시간(+23.3%)이 증가한다. prefix cache와 compact register가 비용을 줄이지만, 더 큰 VLM·더 긴 action horizon에서의 scaling은 검증이 필요하다. RoboDojo 절대 성공률 12.67%는 어려운 open-world task가 여전히 대부분 실패함을 뜻한다. OAT를 별도로 pretrain해야 하며, real-world 평가는 네 개 양팔 task로 제한된다.

# 내가 이해한 핵심

JADE의 핵심은 VLM을 더 큰 condition encoder로 쓰는 것이 아니라, 현재 action 가설을 읽고 수정 의견을 내는 반복 참여자로 바꾸는 것이다. action expert가 좌표 공간에서 velocity를 고치고 VLM은 compact latent 공간에서 의미·task 일관성을 고치므로, 한 번의 denoising step이 더 비싸지만 더 많은 정보를 담는다.

# 다음에 연결해서 읽을 논문

- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): JADE가 확장한 flow-matching VLA
- [Ordered Action Tokenization](https://arxiv.org/abs/2602.05475): noisy action을 VLM-compatible register로 바꾸는 기반 표현
- [Spatial Forcing](https://arxiv.org/abs/2605.16755): VLM feature를 action generation에 더 강하게 연결하는 비교축
- [4D-WAM](https://arxiv.org/abs/2606.00456): RoboTwin에서 비교한 world-action foundation model
