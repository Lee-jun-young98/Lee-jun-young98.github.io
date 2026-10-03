---
title: "UniWAM: Unified World-Action Model"
date: 2026-10-03
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Jiayi Chen, Wenxuan Song, Jingbo Wang, Shuai Zhou, Xicheng Gong, Zehua Fan, Ziyang Zhou, Junwu E, Haodong Yan, Fuhao Li, Qize Yu, Xu Huang, Pengwei Wang, Wen Chen, Shunbo Zhou, Haoang Li"
paper: "https://arxiv.org/abs/2610.02054"
code: "https://github.com/UniWAM/UniWAM"
project: "https://uniwam.github.io/"
thumbnail: "/papers/assets/vla/uniwam-unified-world-action-model/overview.svg"
---

# 한 줄 요약

UniWAM은 물리 언어 추론기, 비디오 기반 세계 생성기, 연속 행동 예측기를 joint attention으로 결합하고 인간·로봇·VQA 데이터를 역할별로 감독해 의미 이해와 동역학 예측을 동시에 갖춘 범용 조작 정책을 만든다.

# 논문 정보

- 제목: UniWAM: Unified World-Action Model
- 저자: Jiayi Chen 외 15명
- 발표: arXiv:2610.02054v1 (2026-10-01), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.02054) · [프로젝트](https://uniwam.github.io/) · [코드](https://github.com/UniWAM/UniWAM)
- 코드/프로젝트: 논문 메타데이터에 공식 GitHub, 체크포인트, 프로젝트 페이지가 연결되어 있다.
- 키워드: world-action model, vision-language-action, physical reasoning, video generation, human-robot co-training, flow matching

# 핵심 아이디어

기존 VLA는 사전학습 VLM의 의미 이해를 활용하지만 action-only supervision만으로 물리 동역학을 배우기 어렵고, WAM은 비디오 생성기의 시공간 prior를 활용하지만 분포 밖 의미 이해와 복합 지시 추론이 약하다. UniWAM은 Qwen3-VL 기반 physical reasoner, Wan2.2 기반 world generator, flow-matching action predictor를 Mixture-of-Transformers로 묶어 언어·미래 시각 latent·행동 chunk를 공동 모델링한다.

학습 데이터의 역할도 분리한다. VQA는 언어 능력을 유지하고, human egocentric video는 물리 언어와 시각 미래를 감독하며, 정확한 행동 레이블이 있는 robot data만 세 expert 모두를 감독한다. Post-training에서는 future-frame noise augmentation으로 정밀한 미래 픽셀에 대한 과의존을 줄이고, action history를 flow 초기값에 넣어 적은 denoising step으로 시간적 연속성을 활용한다.

# VLA 관점에서 중요한 이유

이 논문은 VLA와 WAM 중 하나를 고르는 대신 “무엇을 이해하고, 무엇을 예측하며, 무엇을 실행할지”를 별도 expert로 유지하면서 attention에서 통합한다. 특히 저수준 end-effector motion을 자연어 템플릿으로 표현해 VLM의 사전학습 분포와 행동 감독을 연결한 점은, 의미 능력을 잃지 않고 로봇 행동을 학습시키는 한 가지 구체적 해법이다.

# Robot / Embodied Setting

- 사전학습: 논문 Table 1 기준 로봇 약 4,958시간과 인간 egocentric video 약 5,072시간, 총 약 10,013시간. 본문 서술의 로봇 subtotal 약 4,363시간과 표의 4,958시간 사이에는 불일치가 있어 표 수치를 그대로 기록한다.
- 시뮬레이션: LIBERO 및 LIBERO-Plus, RoboTwin 2.0의 Clean2Clean·Clean2Random 50-task 평가.
- 실제 로봇: 6-DoF AgileX Piper 두 대와 평행 gripper, 각 wrist camera 및 third-person camera.
- 실제 task: Pick-Anything, Diverse-Interaction, Place-Relative, Drawer-Storage와 6단계 tabletop organization. 방법별 task당 200 demonstrations, 하나의 generalist policy로 공동 학습한다.

# Method

1. Physical reasoner가 현재 관찰과 지시를 받아 semantic token 및 physical-language output을 생성한다.
2. World generator가 frozen video autoencoder latent 공간에서 미래 visual flow를 예측한다.
3. Action predictor가 proprioceptive state와 action chunk를 받아 continuous action flow를 예측한다.
4. 세 expert의 query/key/value를 공통 attention 공간에 투영해 joint attention을 수행하되, expert별 projection·FFN은 유지한다.
5. Future-frame noise augmentation과 history-conditioned flow matching으로 미래 영상의 세부 오류에 덜 민감하고 빠른 행동 생성을 유도한다.

# 핵심 그림

![물리 언어 추론기, 세계 생성기, 행동 예측기가 joint attention으로 연결되고 서로 다른 데이터 감독을 받는 UniWAM 구조](/papers/assets/vla/uniwam-unified-world-action-model/overview.svg)

> 논문 Figure 3과 Sections 3–4를 바탕으로 재구성했다. 구조 그림을 고른 이유는 VLM·video model·action expert의 역할 분리와 데이터별 감독 경로가 이 논문의 핵심 기여를 가장 직접적으로 보여주기 때문이다. 출처: [논문 Figure 3 및 Section 4](https://arxiv.org/html/2610.02054v1#S4).

# Experiments / Results

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓)                             | 제안 방법 |              비교 기준 |    차이 | 출처          |
| ------------------------------------------------------------ | --------: | ---------------------: | ------: | ------------- |
| LIBERO 4-suite 평균 성공률 (%, ↑)                            |      99.2 | Xiaomi-Robotics-0 98.7 |  +0.5%p | 논문 Table 4  |
| RoboTwin 2.0 C2R 50-task 평균 성공률 (%, ↑)                  |     68.32 |    GigaBrain-0.7 67.90 | +0.42%p | 논문 Table 5  |
| LIBERO-Plus 7 perturbation 평균 성공률 (%, ↑)                |      92.6 |            Kairos 89.0 |  +3.6%p | 논문 Table 6  |
| 실제 Piper 4개 instruction-following task 평균 성공률 (%, ↑) |      67.5 |       $\pi_{0.5}$ 54.4 | +13.1%p | 논문 Figure 6 |
| 실제 Piper 4개 task 평균 instruction-following rate (%, ↑)   |      82.5 |       $\pi_{0.5}$ 60.6 | +21.9%p | 논문 Figure 6 |
| 실제 Piper 6-stage 장기 task 평균 progress (0–6, ↑)          |       5.0 |              Motus 3.2 |    +1.8 | 논문 Figure 6 |

RoboTwin C2R은 clean demonstration으로 학습하고 randomized setting에서 평가한다. UniWAM은 C2C 75.14%에서 C2R 68.32%로 6.82%p만 하락하지만, $\pi_{0.5}$는 24.70%p 하락한다. 다만 OpenWAM은 C2C가 89.4%로 더 높으므로 UniWAM의 강점은 clean setting 최고점보다 C2R robustness와 두 설정의 평균 71.73%에 있다.

# Limitations / Discussion

대규모 사전학습 데이터의 품질 관리와 약 10,000시간 규모가 성능에 미치는 영향을 architecture 효과와 완전히 분리하기 어렵다. 또한 실제 로봇 평가는 동일한 Piper 플랫폼과 task별 200 demonstrations 조건에 집중하며, 다른 embodiment로의 zero-shot transfer는 직접 검증하지 않았다. 공개 코드도 Bridge, DROID, Fractal 및 real-world inference는 현재 release 범위 밖이라고 명시한다. Table 1의 로봇 subtotal과 본문 수치가 서로 다른 점도 재현 시 확인이 필요하다.

# 내가 이해한 핵심

UniWAM의 요지는 미래 영상을 생성하는 능력 자체가 아니라, 언어가 “무엇을 해야 하는지”, 비디오 prior가 “세상이 어떻게 변하는지”, action expert가 “어떻게 움직일지”를 각자 보존한 채 매 layer에서 정보를 교환하게 만든 것이다. 성능 향상은 하나의 거대한 decoder보다 데이터와 supervision을 expert의 역할에 맞춰 배치한 데서 나온다.

# 다음에 연결해서 읽을 논문

- Motus: video와 action을 결합한 기존 Mixture-of-Transformers 계열과의 구조 차이를 보기 위해
- Fast-WAM: 미래 영상을 실제로 생성하지 않고 representation만 사용할 때의 trade-off를 비교하기 위해
- Magic-W0: 구조화된 world-action foundation model의 pretraining 및 scaling 전략과 비교하기 위해
