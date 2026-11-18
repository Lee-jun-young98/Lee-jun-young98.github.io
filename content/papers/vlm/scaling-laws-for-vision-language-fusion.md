---
title: "Scaling Laws for Vision-Language Fusion"
date: 2026-11-18
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Seng Pei Liew, Teppei Suzuki, Seiya Tokui"
paper: "https://arxiv.org/abs/2611.22351"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/scaling-laws-for-vision-language-fusion/fusion-scaling-law-pipeline.svg"
---

# 한 줄 요약

VLM 사전학습의 early/late fusion을 **기본 학습 진전 + 모달리티 경쟁에 따른 분포 이동**으로 분해한 통합 scaling law를 제시하고, 모델이 커질수록 late fusion의 vision-loss 이점은 줄지만 text 손실은 남아 early fusion이 더 유리해짐을 보인다.

# 논문 정보

- 제목: Scaling Laws for Vision-Language Fusion
- 저자: Seng Pei Liew, Teppei Suzuki, Seiya Tokui (Noetra Corp.)
- 발표: arXiv:2611.22351v1, 2026-11-17 제출; 학회 게재 여부는 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2611.22351), [공식 PDF](https://arxiv.org/pdf/2611.22351), [공식 HTML](https://arxiv.org/html/2611.22351)
- 코드/프로젝트: 논문과 arXiv 메타데이터에서 공식 링크를 확인하지 못함
- 라이선스: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- 키워드: vision-language pretraining, early fusion, late fusion, scaling law, data mixture, continued pretraining

# 핵심 아이디어

같은 text·caption token 예산을 주더라도 두 극단의 학습 순서는 다르다. **early fusion**은 처음부터 text와 image-caption을 희소하게 섞고, **late fusion**은 text-only PT를 마친 뒤 높은 multimodal 비율로 짧게 CPT한다. 저자는 이 차이를 단순 token 수가 아니라 다음 두 항으로 나눈다.

1. **Base trajectory**: 각 모달리티의 token이 평가 대상 loss를 얼마나 학습시키는지 exchange rate $w_m$으로 환산한 유효 데이터 양이다.
2. **Mixture shift**: CPT의 multimodal 비율 $R$이 text와 vision을 서로 밀어내는 경쟁 효과다. 이 이동은 CPT step에 따라 커지다 포화되고, model size에 따라 크기가 달라진다.

interleaved image-text에서는 $w_{\mathrm{int}}\approx1.34$여서 text token과 거의 대체 가능하지만, caption에서는 $w_{\mathrm{cap}}\approx0.013$이다. 즉 text-only PT는 caption loss 진전에 거의 도움이 되지 않는다. 반면 late fusion의 높은 $R$은 caption loss를 낮추는 대신 text loss를 올린다. 핵심은 모델 크기 $N$이 커질 때 caption 쪽 shift amplitude는 $N^{-0.5}$로 줄지만 text penalty는 거의 줄지 않는다는 것이다.

# VLM 관점에서 중요한 이유

VLM 학습 레시피에서 “LLM을 먼저 충분히 학습하고 vision을 나중에 붙일지”, “처음부터 multimodal mixture로 학습할지”는 막대한 계산비가 걸린 결정이다. 이 논문은 두 선택을 별도 경험 법칙으로 비교하지 않고 **fusion timing, mixture ratio, token budget, model size**를 한 식 안에서 연결한다.

또한 낮은 caption validation loss가 곧 더 좋은 VQA를 뜻하지 않는다는 결과가 중요하다. late fusion은 caption loss를 일관되게 낮췄지만 MME·GQA·DocVQA는 같은 순서로 좋아지지 않았다. vision-language task는 두 모달리티가 함께 필요하므로 한쪽 loss를 낮추면서 language capability를 훼손하는 레시피는 downstream 이득으로 이어지지 않을 수 있다.

# Method

## 1. 실험 축과 모델

저자는 Gemma-3-style language backbone(189M–3.5B)에 SigLIP2 vision encoder를 붙인다. FineWeb-Edu는 text-only PT, OBELICS·OmniCorpus는 interleaved image-text, ReLAION은 image-caption 데이터로 사용한다. 제어 변수는 text-only PT token $D_{\mathrm{pt}}$, multimodal CPT token $D_{\mathrm{cpt}}$, CPT 안의 multimodal fraction $R$, model size $N$이며, 관측값은 text·interleaved·caption의 cross-entropy validation loss다.

## 2. 모달리티별 유효 학습량

native token은 1만큼, 다른 모달리티 token은 exchange rate $w_m$만큼 학습을 진전시킨다고 둔다. 예를 들어 caption/interleaved 평가축의 유효 데이터 양은 다음과 같다.

$$
\mathcal D_{\mathrm{base,cap/int}}
=w_{\mathrm{cap/int}}D_{\mathrm{pt}}
+\left[R+w_{\mathrm{cap/int}}(1-R)\right]D_{\mathrm{cpt}}.
$$

text 평가축에서는 text token의 계수가 1이고 multimodal token에 $w_{\mathrm{txt}}$가 붙는다. base loss는 $L_0+A\mathcal D_{\mathrm{base}}^{-\alpha}$의 power law로 표현한다.

## 3. 모달리티 경쟁과 통합 law

mixture ratio가 만드는 shift amplitude는

$$
\rho_m(R)=\frac{k_mR}{k_mR+(1-R)}
$$

로 두고, CPT step에 따른 축적·포화는

$$
\Phi(D_{\mathrm{cpt}})=1-\left(1+(kR+1-R)\frac{D_{\mathrm{cpt}}}{\tau}\right)^{-\beta}
$$

로 모델링한다. 최종 통합식은

$$
L=L_0+A\mathcal D_{\mathrm{base}}^{-\alpha}
+\sigma B_0\rho(R)\Phi(D_{\mathrm{cpt}})
$$

이다. $\sigma$는 caption/interleaved에서 $-1$, text에서 $+1$이므로 높은 multimodal 비율이 vision loss는 낮추고 text loss는 높이는 방향을 표현한다. model size까지 포함하면 shift 항에 $N^{-\gamma}$, 일반적인 capacity 항에 $CN^{-\eta}$를 추가한다. fitted exponent는 $\gamma_{\mathrm{cap}}=0.5$, $\gamma_{\mathrm{txt}}\approx0$이다.

## 4. 고정 예산에서 fusion timing 최적화

text와 caption의 총 token 예산을 고정하면 base trajectory는 fusion timing과 무관한 상수가 된다. 따라서 early/late의 차이는 shift 항만으로 결정된다. caption loss만 최소화하면 $R=1$인 가장 늦은 fusion이, text loss만 최소화하면 처음부터 두 모달리티를 섞는 early fusion이 해가 된다. 그러나 late fusion의 caption 이점은 scale과 함께 작아지고 downstream vision score로도 일관되게 이어지지 않아, 저자는 큰 모델에서는 early fusion을 권한다.

# 핵심 그림

![같은 text와 caption token 예산에서 early fusion과 late fusion의 학습 경로를 비교하고, 유효 학습량과 mixture shift를 통합 scaling law로 계산한 뒤 model size에 따른 text와 vision 손실 trade-off를 예측하는 구조도](/papers/assets/vlm/scaling-laws-for-vision-language-fusion/fusion-scaling-law-pipeline.svg)

_논문 Figure 1과 Equations 2–8을 바탕으로 재구성._ 출처: [공식 HTML Figure 1](https://arxiv.org/html/2611.22351#S1.F1), [공식 PDF](https://arxiv.org/pdf/2611.22351). 이 논문의 기여는 새 neural block보다 **학습 스케줄에서 loss 예측까지 이어지는 방법론 파이프라인**이므로, 개별 loss curve 대신 early/late 입력이 통합 law의 두 항을 거쳐 결론으로 가는 구조를 골랐다.

왼쪽 위의 late fusion은 text-only PT 뒤에 높은 $R$의 짧은 multimodal CPT를 배치하고, 아래의 early fusion은 step 0부터 낮은 $R$로 text와 caption을 섞는다. 두 흐름은 같은 총 token budget을 쓰며, 첫 번째 계산 모듈은 $w_m$으로 모달리티별 유효 token을 세어 base trajectory를 만든다. 두 번째 모듈은 $R$과 CPT 길이로 경쟁적 distribution shift를 계산한다.

오른쪽의 통합 law는 두 항에 model-size 보정을 더해 modality별 validation loss를 예측한다. 학습 시에는 여러 fusion point·mixture·scale의 run으로 계수를 fitting하고, 추론 시에는 원하는 budget과 schedule을 넣어 loss trade-off를 예측한다. 기존의 단일-modality CPT law와 달라진 핵심은 **cross-modal exchange rate와 부호가 반대인 mixture shift**를 명시적으로 넣은 점이다.

# Experiments / Results

- backbone: Gemma-3-style LLM 189M–3.5B + SigLIP2 vision encoder
- 주요 fusion timing 비교: 300M·1B, 총 56B tokens 고정, S0(early)–S5(late)
- 데이터: FineWeb-Edu(text), OBELICS·OmniCorpus(interleaved), ReLAION(caption)
- fitting: log loss에 Huber loss($\delta=10^{-3}$), L-BFGS-B, 수백 개 random initialization
- downstream: base VLM이 instruction following 없이 평가되도록 질문-후보를 declarative statement로 rewrite하고 byte-normalized log-likelihood로 순위를 매김

## 주요 실험 결과

아래 표는 [공식 논문 Table 3](https://arxiv.org/html/2611.22351#S6.T3)의 같은 scale·56B-token 조건에서 S0와 S5를 비교한다. loss·perplexity는 낮을수록, accuracy는 높을수록 좋다. accuracy 차이는 절대 **%p**, loss 차이는 nats로 계산했다.

| Scale / 지표 | S0 Early ($R=0.45$) | S5 Late ($R=1.00$) | Late − Early | 해석 |
| --- | ---: | ---: | ---: | --- |
| 300M caption loss (nats, ↓) | 1.1488 | **0.9902** | **−0.1586** | late가 vision-side loss 우세 |
| 300M text loss (nats, ↓) | **3.4095** | 6.3135 | **+2.9040** | text capability 크게 붕괴 |
| 300M MME accuracy (%, ↑) | 67.01 | **67.70** | **+0.69%p** | caption-loss 이득만큼 개선되지 않음 |
| 300M GQA accuracy (%, ↑) | **41.03** | 38.69 | **−2.34%p** | 오히려 early가 우세 |
| 1B caption loss (nats, ↓) | 0.9659 | **0.8705** | **−0.0954** | late 이점이 300M보다 작음 |
| 1B text loss (nats, ↓) | **3.0258** | 5.8537 | **+2.8279** | scale이 커져도 penalty 유지 |
| 1B MME accuracy (%, ↑) | **70.64** | 68.39 | **−2.25%p** | early가 downstream 우세 |
| 1B GQA accuracy (%, ↑) | 41.34 | **42.09** | **+0.75%p** | 일관된 late 우세는 아님 |

가장 중요한 수치는 scale에 따른 gap 변화다. early 대비 late의 caption-loss 이점은 300M의 0.1586 nats에서 1B의 0.0954 nats로 **39.8% 감소**한다. 반면 text-loss penalty는 2.9040에서 2.8279 nats로 **2.6%만 감소**한다. 이는 fitted $\gamma_{\mathrm{cap}}=0.5$, $\gamma_{\mathrm{txt}}\approx0$와 맞는다.

downstream 결과는 “caption loss가 낮으면 vision task도 좋아진다”는 단순 해석을 지지하지 않는다. late fusion은 두 scale 모두 caption loss가 가장 낮지만 MME·GQA의 방향은 scale과 benchmark에 따라 섞인다. 논문 전체 결과에서 caption loss와 MME의 Spearman correlation은 300M에서 −0.20, 1B에서 +0.20으로 일관되지 않다.

law 자체의 held-out 정확도도 확인할 필요가 있다. Table 1에서 held-out RMSE는 interleaved loss 0.0031, 해당 text loss 0.0015, caption loss 0.0084, 해당 text loss 0.0036 nats다. fitting 영역 밖 fusion point·더 긴 CPT와 $D_{\mathrm{pt}}=0$인 early fusion에도 낮은 residual을 보였지만, 이는 동일한 model/data family 안의 검증이다.

# Limitations / Discussion

- fitted 계수는 데이터, tokenizer, architecture에 종속적이다. 저자도 이 값을 보편 상수보다 각 조직이 자체 run에 맞춰 fitting할 **framework**로 해석해야 한다고 명시한다.
- 최대 모델은 3.5B이고 주 fusion timing downstream 표는 300M·1B다. frontier-scale VLM까지 $N^{-0.5}$ 추세가 유지되는지는 외삽이다.
- vision encoder는 SigLIP2로 고정하고 Gemma-3-style backbone을 사용한다. encoder-free native multimodal model이나 다른 tokenization에서는 exchange rate가 달라질 수 있다.
- $R=1$에서는 text capability가 붕괴해 text-loss law의 fitting domain을 $R\le0.82$로 제한했다. 따라서 극단 late-fusion 지점은 law가 정확히 설명하지 못하는 경계 조건이다.
- MME·GQA를 base model에 맞게 rewrite한 평가는 instruction-format confound를 줄이지만, 원래 benchmark의 generation protocol과 완전히 같은 과제는 아니다.
- 낮은 caption loss와 downstream vision 성능의 불일치를 보여 주지만, 왜 특정 benchmark가 fusion timing에 반응하는지까지 mechanistic하게 설명하지는 않는다.
- 공식 code와 project page는 arXiv 메타데이터와 본문에서 확인하지 못했다.

# 내가 이해한 핵심

이 논문의 요지는 “early냐 late냐”가 단순 학습 순서 문제가 아니라 **모달리티가 서로에게 제공하는 유효 token 가치와, 한쪽 비율이 높아질 때 생기는 경쟁적 이동**의 합이라는 것이다. interleaved 문서는 text와 구조가 비슷해 교환 가능하지만, 짧은 caption은 text-only 학습으로 대체하기 어렵다.

late fusion은 caption token을 한 시기에 몰아 vision loss를 빠르게 낮춘다. 하지만 그 이득은 model scale과 함께 사라지는 반면 높은 $R$이 만든 language penalty는 남는다. 더구나 VQA는 vision만이 아니라 language도 필요하므로 caption loss 하나를 최적화한 레시피가 실제 점수를 보장하지 않는다.

실무적으로는 대규모 run 전에 작은 scale 여러 개에서 $D_{\mathrm{pt}}$, $D_{\mathrm{cpt}}$, $R$을 sweep하고, validation loss뿐 아니라 base-model downstream 평가까지 함께 fitting해야 한다. 특히 “vision loss 최저”를 목표로 삼기보다 text 손상과 downstream 무상관을 포함한 Pareto trade-off로 fusion timing을 고르는 것이 안전하다.

# 다음에 연결해서 읽을 논문

- [What Transfers from Text to Vision? Capability Scaling Laws and Transfer Dynamics for VLMs](/papers/vlm/what-transfers-from-text-to-vision-capability-scaling-laws): text capability에서 vision capability로의 transfer를 예측하는 또 다른 scaling-law 관점과 비교할 수 있다.
- [Scaling Laws for Native Multimodal Models](https://arxiv.org/abs/2504.07951): pretrained vision encoder를 쓰는 이 논문과 encoder-free native multimodal scaling의 차이를 볼 수 있다.
- [MM1: Methods, Analysis & Insights from Multimodal LLM Pre-training](https://arxiv.org/abs/2403.09611): image-caption·interleaved·text-only mixture의 실제 대규모 recipe와 연결된다.
- [How Far Are We from Removing the Visual Encoder?](/papers/vlm/how-far-are-we-from-removing-the-visual-encoder): fusion timing뿐 아니라 visual encoder 자체를 제거했을 때 scale trade-off가 어떻게 바뀌는지 함께 읽기 좋다.
