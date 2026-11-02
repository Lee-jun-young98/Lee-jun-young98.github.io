---
title: "Latent Reasoning in Continuous Space for Unified Multimodal Models"
date: 2026-11-02
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "NeurIPS 2026"
authors: "Byungwoo Jeon, Yoonwoo Jeong, Hyunseok Lee, Minsu Cho, Jinwoo Shin"
paper: "https://arxiv.org/abs/2610.42149"
code: "https://github.com/RootYJeon/LARC"
project: "https://rootyjeon.github.io/larc-umm/"
thumbnail: "/papers/assets/vlm/latent-reasoning-in-continuous-space-for-unified-multimodal-models/larc-architecture.svg"
---

# 한 줄 요약

LARC는 통합 멀티모달 모델의 추론을 이산 텍스트 토큰에서 연속 hidden state로 옮기고 정보 이득 보상으로 다듬어, BAGEL 대비 GenEval을 0.81에서 0.88로 높이면서 이미지 생성에도 명확한 test-time scaling을 만든다.

# 논문 정보

- 제목: Latent Reasoning in Continuous Space for Unified Multimodal Models
- 저자: Byungwoo Jeon, Yoonwoo Jeong, Hyunseok Lee, Minsu Cho, Jinwoo Shin
- 발표: NeurIPS 2026, arXiv:2610.42149v1 (2026-10-30 제출, 2026-11-02 공개 배치)
- 링크: [arXiv 초록](https://arxiv.org/abs/2610.42149), [HTML](https://arxiv.org/html/2610.42149), [PDF](https://arxiv.org/pdf/2610.42149)
- 코드/프로젝트: [공식 저장소](https://github.com/rootyJeon/LARC), [공식 프로젝트 페이지](https://rootyjeon.github.io/larc-umm/) — 저장소는 공개됐지만 2026-11-02 확인 시 inference·training·evaluation code는 TODO 상태
- 라이선스: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- 키워드: unified multimodal model, latent reasoning, image generation, test-time scaling, curriculum SFT, GRPO

# 핵심 아이디어

기존 reasoning-augmented UMM은 텍스트 CoT로 생각하지만 image head는 연속 표현을 조건으로 이미지를 만든다. 저자들은 긴 텍스트 추론이 spatial detail을 고정 vocabulary로 압축하면서 생성 모듈에 유용한 정보가 사라지는 것을 **discrete–continuous modality mismatch**로 본다.

LARC는 짧은 텍스트 구간과 연속 latent step을 번갈아 생성한다. 모델이 `<latent>` token을 내면 마지막 Transformer hidden state를 다음 위치의 input embedding으로 되먹임하고, 전체 trajectory를 image module의 cross-attention condition으로 사용한다. 학습은 두 단계다.

1. curriculum SFT가 token-level reasoning step을 앞에서부터 latent step으로 점차 치환한다.
2. self-evolving RL은 latent trace가 target image의 예측을 얼마나 개선하는지 frozen Stage-1 model의 flow-matching loss 차이로 측정하고, latent collapse를 막는 diversity reward와 함께 GRPO로 최적화한다.

# VLM 관점에서 중요한 이유

- 시각 추론을 언어로 모두 직렬화해야 한다는 가정을 버린다. 텍스트는 rollout의 확률성을, continuous hidden state는 dense spatial information을 담당한다.
- 이해와 생성을 한 backbone에서 처리하는 UMM에서 reasoning representation과 generation representation을 같은 연속 공간으로 맞춘다.
- 동일 BAGEL backbone과 1M training scale에서 token CoT, latent SFT, latent SFT+RL을 비교해 공간 선택과 학습 단계의 효과를 분리한다.
- latent step 수를 1에서 10으로 늘릴 때 생성·편집·시각 추론 성능이 단조 증가한다. 단순 best-of-N보다 적은 추가 비용으로 inference compute를 품질로 바꾸는 경로를 보인다.
- 외부 reward model이나 사람이 쓴 latent target 없이 frozen image head 자체의 conditional prediction improvement를 보상으로 사용한다.

# Method

입력 context $\mathbf{c}$는 text prompt와 선택적인 source image다. language mode에서는 token embedding $e(x_{t+1})$을 다음 입력으로 쓰지만, `<latent>` 이후에는 마지막 layer hidden state $h_t$를 그대로 다음 입력 embedding으로 붙인다.

$$
E_{t+1}=\begin{cases}[E_t;h_t] & \text{latent mode},\\ [E_t;e(x_{t+1})] & \text{language mode}.\end{cases}
$$

따라서 trajectory는 $\tau=(s_1,l_1,\ldots,s_N,l_N)$처럼 text span과 latent state가 interleave된다. `<eos>`가 나오면 image module이 전체 $h(\tau)$를 cross-attention으로 읽어 target image를 생성한다.

Stage 1은 FLUX-Reason, WEAVE, ScaleEdit에서 모은 1M interleaved CoT sample을 사용한다. 처음에는 text-only trajectory를 학습하고 phase $k$마다 앞쪽 latent step을 하나씩 활성화한다. text next-token loss와 target image의 flow-matching loss를 함께 최적화하며 latent 자체에는 별도 정답을 주지 않는다.

Stage 2의 information-gain reward는 trace가 있을 때와 없을 때 frozen reference model $\pi_{\mathrm{ref}}$의 target-image 예측이 얼마나 달라지는지 측정한다.

$$
r_{\mathrm{IG}}\approx \mathcal{L}^{\pi_{\mathrm{ref}}}_{\mathrm{flow}}(\mathbf{x},\mathbf{c})-\mathcal{L}^{\pi_{\mathrm{ref}}}_{\mathrm{flow}}(\mathbf{x},\mathbf{c},h(\tau)).
$$

두 loss는 같은 noise와 timestep을 사용해 variance를 줄인다. 서로 다른 latent step의 cosine distance 평균인 $r_{\mathrm{div}}$를 더해 모든 step이 같은 vector로 붕괴하는 것을 막고, $R=r_{\mathrm{IG}}+\lambda_{\mathrm{div}}r_{\mathrm{div}}$를 group-relative advantage로 바꿔 GRPO를 수행한다.

# 핵심 그림

![텍스트와 선택적 이미지를 받아 짧은 텍스트 구간과 hidden-state latent step을 교차 생성하고, curriculum SFT와 information-gain GRPO를 거쳐 image head가 결과 이미지를 만드는 LARC 아키텍처](/papers/assets/vlm/latent-reasoning-in-continuous-space-for-unified-multimodal-models/larc-architecture.svg)

> 그림 2. 논문 Figure 2, Sections 2.1–2.4와 식 (1)–(4)를 바탕으로 재구성한 LARC 학습·추론 파이프라인. 출처: [arXiv HTML Figure 2 및 Method](https://arxiv.org/html/2610.42149#S2). 원 논문은 CC BY 4.0이며, 본 그림은 핵심 흐름을 한국어로 다시 그린 재구성이다.

이 그림을 고른 이유는 LARC의 핵심이 새로운 image head보다 **Transformer hidden state를 다음 입력으로 되먹이는 interleaved trajectory와 두 단계 학습**에 있기 때문이다. 입력 prompt와 선택적 source image는 UMM backbone으로 들어가고, language token이 rollout 다양성을 유지하는 사이 `<latent>`가 연속 hidden state feedback을 연다. 종료 뒤 image head는 전체 trajectory를 조건으로 결과 이미지를 만든다.

학습 흐름은 추론 흐름과 구분된다. Stage 1은 text step을 latent step으로 점진 치환해 안정적인 초기 policy $\pi_{\mathrm{ref}}$를 만든다. Stage 2는 같은 target image에 대해 trace 포함/제외 flow loss의 차이를 정보 이득으로 계산하고 latent diversity를 더해 GRPO로 policy를 갱신한다. 기존 token CoT와 달라진 핵심은 reasoning state를 decode했다가 다시 embed하지 않고 continuous representation으로 직접 전달한다는 점이다.

# Experiments / Results

- 기반 모델은 BAGEL이며 SFT와 RL 모두 1M CoT 규모를 유지한다. T2I는 GenEval·DPG-Bench·OneIG-Bench, 편집은 CompBench, 이해는 MME·MMB·MMMU·MIRA로 평가한다.
- GenEval overall은 BAGEL 0.81, Uni-CoT 0.83, LARC 0.88이다. BAGEL 대비 +7%p, token-reasoning Uni-CoT 대비 +5%p다.
- DPG-Bench overall은 BAGEL 85.07에서 LARC 90.04로 +4.97점, OneIG-Bench는 0.764에서 0.866으로 +10.2%p 오른다.
- CompBench에서 BAGEL 대비 LC-T는 20.434→22.509(+2.075), PSNR은 24.370→25.710(+1.340), LPIPS는 0.069→0.049(-0.020)다. 서로 다른 단위이므로 한 행의 성공률 차이처럼 합치지 않는다.
- visual reasoning MIRA는 BAGEL 7.5, Uni-CoT 10.6, LARC 11.7이다. Stage 1만 사용하면 9.7이고 Stage 2를 더하면 11.7이므로 RL 기여는 +2.0점이다.
- A100 1장, batch size 1에서 latent step을 1→10으로 늘릴 때 46.8→48.0초(+1.2초)다. BAGEL best-of-N은 N=1→10에서 46.5→469.0초다.

## 주요 실험 결과

Table 1–3의 overall score를 그대로 옮겼다. GenEval·OneIG-Bench는 0–1 score이므로 차이를 %p로 환산했고, DPG-Bench는 원 논문 scale의 점수 차이로 표기했다.

| 벤치마크 / 지표 (↑) |  LARC | BAGEL |    차이 | 출처    |
| ------------------- | ----: | ----: | ------: | ------- |
| GenEval overall     |  0.88 |  0.81 |  +7.0%p | Table 1 |
| DPG-Bench overall   | 90.04 | 85.07 | +4.97점 | Table 2 |
| OneIG-Bench overall | 0.866 | 0.764 | +10.2%p | Table 3 |

세 benchmark 모두 같은 BAGEL 기반 비교에서 개선된다. 특히 OneIG-Bench의 +10.2%p는 긴 prompt와 compositional instruction에 continuous latent reasoning이 도움이 된다는 근거다. 다만 benchmark마다 scale과 evaluator가 다르므로 수치 크기를 benchmark 사이에서 직접 비교하면 안 된다.

Table 8은 backbone과 data scale을 유지한 채 학습 단계를 비교한다.

| 설정                    | GenEval (↑) | OneIG-Bench (↑) | CompBench LC-T (↑) | MIRA (↑) | 출처    |
| ----------------------- | ----------: | --------------: | -----------------: | -------: | ------- |
| BAGEL baseline          |        0.81 |            0.76 |              20.43 |      7.5 | Table 8 |
| Stage 1: curriculum SFT |        0.83 |            0.81 |              21.46 |      9.7 | Table 8 |
| Stage 1 + Stage 2 RL    |        0.88 |            0.87 |              22.51 |     11.7 | Table 8 |

Stage 2는 Stage 1 대비 GenEval +5%p, OneIG-Bench +6%p, LC-T +1.05점, MIRA +2.0점을 더한다. 별도 Table 12에서 diversity weight를 0으로 두면 latent cosine similarity가 0.97로 붕괴하고 MIRA가 11.7에서 9.8로 떨어져, RL gain이 단순 optimization step 증가만은 아님을 뒷받침한다.

# Limitations / Discussion

- 현재 방법은 continuous flow-matching image head를 가진 UMM에서만 검증됐다. discrete image tokenizer나 다른 generation head에 그대로 적용되는지는 확인되지 않았다.
- 기반 모델이 BAGEL 하나이고 training data도 FLUX-Reason·WEAVE·ScaleEdit의 1M sample로 고정돼 model family와 data domain에 대한 일반화 근거가 제한적이다.
- 주요 생성 benchmark는 MLLM-as-a-Judge를 포함한다. 실제 사용자 선호, 미세한 artifact, safety를 완전히 대변하지 않는다.
- latent reasoning은 사람이 읽을 수 있는 CoT가 아니다. 더 좋은 image를 만들더라도 각 latent step의 의미와 잘못된 생성의 원인을 직접 감사하기 어렵다.
- test-time scaling overhead는 best-of-N보다 작지만 base BAGEL보다는 크고, 10-step 이후의 scaling law나 더 긴 trajectory의 안정성은 제시되지 않았다.
- 정보 이득은 frozen reference model의 flow loss로 근사된다. 이 내부 보상이 semantic correctness나 human preference와 어긋날 가능성이 있다.
- 공식 저장소는 열려 있으나 2026-11-02 현재 README만 있고 inference·training·evaluation code 공개가 TODO라서 결과를 즉시 재현할 수 없다.
- 생성 능력이 강해질수록 deceptive image, misinformation, bias amplification 위험도 커진다. 논문은 provenance, human oversight, staged deployment를 권고하지만 별도 safety experiment는 없다.

# 내가 이해한 핵심

LARC의 중요한 전환은 “생성 전에 자연어로 더 오래 생각하자”가 아니라 **생성기가 소비할 수 있는 좌표계에서 생각하자**는 것이다. token CoT는 해석 가능하지만 vocabulary bottleneck을 거치며 위치·색·관계 같은 dense constraint를 손실할 수 있다. hidden state feedback은 이를 보존하면서도 중간 text span을 남겨 policy sampling과 RL credit assignment가 작동하게 한다.

정보 이득 보상도 이 관점과 맞물린다. 외부 judge가 완성 이미지만 평가하는 대신, frozen image head가 특정 reasoning trace를 받았을 때 target image의 flow loss가 실제로 줄었는지를 묻는다. 즉 latent trace의 품질을 “그럴듯한 설명인가”가 아니라 “생성 분포를 올바른 target 쪽으로 이동시켰는가”로 정의한다. 앞으로는 adaptive latent budget, interpretable probe, discrete generator로의 확장이 이 접근의 범용성을 가를 것이다.

# 다음에 연결해서 읽을 논문

- [Coconut: Training Large Language Models to Reason in a Continuous Latent Space](https://arxiv.org/abs/2412.06769) — 마지막 hidden state를 다음 입력으로 되먹이는 latent reasoning의 직접적인 기반이다.
- [BAGEL: Emerging Properties in Unified Multimodal Pretraining](https://arxiv.org/abs/2505.14683) — LARC가 image understanding·generation backbone으로 사용하는 base UMM이다.
- [Uni-CoT: Towards Unified Chain-of-Thought Reasoning Across Text and Vision](https://arxiv.org/abs/2502.10790) — discrete token reasoning과 continuous latent reasoning의 비교 기준이다.
- [Joint Latent Reasoning and Observation for Agentic Video Understanding](/papers/vlm/joint-latent-reasoning-and-observation-for-agentic-video-understanding) — video agent가 latent reasoning과 latent observation을 교차시키는 관련 방향이다.
