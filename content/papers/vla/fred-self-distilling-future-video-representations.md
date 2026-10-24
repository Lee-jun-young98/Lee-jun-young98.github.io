---
title: "FRED: Self-Distilling Future Video Representations for World Action Models"
date: 2026-10-24
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "World Action Model"
  - "Self-Distillation"
venue: "확인 필요"
authors: "Huiwon Jang, Suhyeok Jang, Hyeonmo Kang, Seungku Kim, Jinwoo Shin, Sihyun Yu"
paper: "https://arxiv.org/abs/2610.30320"
code: "https://github.com/suhyeok-jang/FRED"
project: "https://huiwon-jang.github.io/FRED/"
thumbnail: "/papers/assets/vla/fred-self-distilling-future-video-representations/overview.svg"
---

# 한 줄 요약

FRED는 한 번의 video-diffusion forward pass가 만든 미래 표현을 실제 미래 프레임의 EMA-teacher 표현에 self-distillation해, 빠른 WAM의 action decoder가 더 예측적인 특징을 쓰게 한다.

# 논문 정보

- 제목: Self-Distilling Future Video Representations for World Action Models
- 저자: Huiwon Jang 외 5명
- 발표: 확인 필요 (arXiv v1, 2026-10-21; cs.RO 신규 목록 2026-10-23)
- 링크: [arXiv](https://arxiv.org/abs/2610.30320)
- 코드/프로젝트: [GitHub](https://github.com/suhyeok-jang/FRED), [프로젝트 페이지](https://huiwon-jang.github.io/FRED/)
- 라이선스: arXiv perpetual non-exclusive license
- 키워드: world action model, video diffusion, future representation, self-distillation, human-to-robot transfer

# 핵심 아이디어

최근 WAM은 거대한 video diffusion model(VDM)을 여러 번 denoise하지 않고, 순수 noise에서 한 번 forward한 중간 hidden state로 별도 action diffusion decoder를 조건화한다. 빠르지만 이 hidden state가 실제 미래 동역학을 충분히 담지 못하면 action 품질도 제한된다.

FRED는 online VDM이 noise에서 만든 표현을, EMA momentum teacher가 noisy ground-truth future frames에서 뽑은 표현에 맞춘다. 여기에 짧은 관측 history를 조건으로 넣어 최근 로봇 운동의 시간 문맥도 제공한다.

# VLA 관점에서 중요한 이유

픽셀 생성 품질이 아니라 **action decoder가 소비하는 내부 미래 표현**을 직접 학습 대상으로 삼는다. 외부 visual encoder의 고정 표현에 맞추는 AGRA와 달리 같은 VDM의 관측된 미래 표현을 teacher target으로 사용해 WAM 자체의 예측 구조를 강화한다.

action label이 없는 human video도 video objective에 넣을 수 있어 robot demonstration에 없던 기술의 human-to-robot transfer를 실험한다.

# Robot / Embodied Setting

- DROID로 학습한 뒤 새 real-world Franka Research 3 환경에서 task-specific fine-tuning 없이 평가
- DROID 평가: easy, long-horizon Clear Table, OOD Reveal/Stamp, fine-grained object grounding
- OpenArm humanoid: 7-DoF arm 2개, 6-DoF hands, 2-DoF neck, ZED 2i stereo egocentric views
- human-video co-training: robot action label 없이 같은 환경의 human manipulation video 추가
- backbone: Wan2.2-TI2V-5B와 Wan2.1-14B; 별도 16-layer DiT action decoder

# Method

student encoder는 noise $\epsilon$과 관측 history·instruction에서 미래 표현 $h$를 만들고, EMA teacher는 noisy future observation $o_{t+1}^{\tau}$에서 target $h^{\tau}$를 만든다.

$$
h=f_\theta(\epsilon\mid o_{t-H:t},c),\qquad h^\tau=f_{\theta^-}(o_{t+1}^{\tau}\mid o_{t-H:t},c).
$$

두 표현은 projection head와 temperature-softmax를 거친 뒤 patch-wise KL loss로 정렬된다. video backbone은 video flow-matching과 self-distillation로만 갱신하고 action loss의 gradient는 막는다. teacher는 EMA로 갱신된다. 추론에서는 student VDM 한 번의 forward로 $h$를 얻고 action decoder가 Euler ODE sampling으로 action chunk를 생성한다.

# 핵심 그림

![관측 이력과 명령, noise를 받는 student VDM과 실제 미래 관측을 받는 EMA teacher, self-distillation, action decoder로 이어지는 FRED 구조](/papers/assets/vla/fred-self-distilling-future-video-representations/overview.svg)

> 그림 1. FRED의 학습 및 추론 흐름. 논문 Figure 2와 Section 3을 바탕으로 직접 재구성했다. 출처: [arXiv:2610.30320 Figure 2](https://arxiv.org/html/2610.30320#S3).

구조 그림을 고른 이유는 FRED의 차별점이 teacher가 정답 action이 아니라 **관측된 미래의 내부 표현**을 제공하는 데 있기 때문이다. 학습 시 student와 EMA teacher가 같은 중간 layer에서 만나고, 추론 시 teacher와 future frame은 제거된다.

입력 history는 현재 장면뿐 아니라 최근 운동 방향을 제공한다. student representation은 $\mathcal{L}_{SD}$와 video flow loss로 개선되며, action decoder는 proprioception과 이 표현을 받아 action을 낸다. 기존 one-step WAM 대비 추론 경로는 거의 유지하면서 표현 학습만 강화한다.

# Experiments / Results

## 주요 실험 결과

아래 값은 논문 Table 1–2, 7에서 같은 backbone·평가 설정끼리 대조했다. 성공률 차이는 %p로 계산했다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓)                                   | 제안 방법 |           비교 기준 |     차이 | 출처               |
| ------------------------------------------------------------------ | --------: | ------------------: | -------: | ------------------ |
| DROID 14B long-horizon task progress (%, ↑)                        |      81.7 |      DreamZero 61.7 |  +20.0%p | Table 1            |
| DROID 14B OOD 성공률 (%, ↑)                                        |      52.1 |      DreamZero 10.4 |  +41.7%p | Table 1            |
| OpenArm human-only skill transfer 성공률, human co-training (%, ↑) |      50.0 |        DiT4DiT 19.4 |  +30.6%p | Table 2(b)         |
| OpenArm instruction following, human co-training (%, ↑)            |      97.2 |        DiT4DiT 55.6 |  +41.6%p | Table 2(b)         |
| 5B real FR3 inference latency (s, ↓)                               |     0.136 | DreamZero 14B 3.255 | -3.119 s | Table 7, A100 80GB |

14B FRED는 5-frame 입력을 쓰면서 0.406 s로, 같은 5-frame DreamZero의 3.255 s보다 약 8.0배 빠르다. 다만 모델 크기가 다른 $\pi_{0.5}$·GR00T와의 latency 비교는 직접적인 알고리즘 비교로 해석하지 않았다.

# Limitations / Discussion

future representation objective 자체는 language grounding을 추가로 감독하지 않는다. 실제로 human-video co-training이 없으면 새 human-skill 지시의 instruction-following이 0%였고, co-training 후에도 task success는 50%로 완전하지 않다.

human과 robot embodiment 사이 대응도 명시적으로 학습하지 않는다. 또한 기반 VDM이 주로 human video로 pretrain되어 robot domain 적응 비용이 크며, 14B 규모 이득이 보여주듯 계산량 의존성도 남는다.

# 내가 이해한 핵심

빠른 WAM에서 VDM은 완성 영상을 만드는 생성기라기보다 action을 위한 “미래 특징 생성기”다. 그렇다면 한 번의 forward를 더 늘리는 대신, 그 한 번이 실제 미래를 닮은 특징을 내도록 학습하는 편이 제어에 직접적이다.

# 다음에 연결해서 읽을 논문

- DiT4DiT: FRED가 representation regularization을 추가하는 직접 base WAM이다.
- AGRA: frozen visual encoder 정렬과 EMA future-representation distillation을 비교할 수 있다.
- DreamZero: iterative video generation과 one-step representation policy의 속도·일반화 trade-off를 볼 수 있다.
