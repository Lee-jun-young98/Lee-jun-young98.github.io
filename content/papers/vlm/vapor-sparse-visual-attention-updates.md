---
title: "VAPOR: Improving Multimodal Reasoning with Sparse Visual Updates"
date: 2026-11-27
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Mingyu Su, Wei Wu, Erle Zhu, Chengxing Xie, Deyao Hong, Hongning Wang"
paper: "https://arxiv.org/abs/2611.33751"
code: "https://github.com/Su-my/VAPOR"
project: "https://github.com/Su-my/VAPOR"
thumbnail: "/papers/assets/vlm/vapor-sparse-visual-attention-updates/vapor-architecture.svg"
---

# 한 줄 요약

VAPOR는 디코딩 중 text attention은 매 토큰 갱신하되 visual attention output만 head별로 재사용하고 필요할 때 갱신해, 두 8B MLLM의 이미지·비디오 추론 평균 정확도를 dense attention보다 0.43-0.85%p 높이면서 디코딩을 1.11-1.21배 빠르게 만든다.

# 논문 정보

- 제목: VAPOR: Improving Multimodal Reasoning with Sparse Visual Updates
- 저자: Mingyu Su, Wei Wu, Erle Zhu, Chengxing Xie, Deyao Hong, Hongning Wang (Tsinghua University, Ant Group)
- 발표: arXiv:2611.33751v1, 2026-11-25 공개; 학회 게재 여부는 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2611.33751), [공식 PDF](https://arxiv.org/pdf/2611.33751), [공식 HTML](https://arxiv.org/html/2611.33751)
- 코드/프로젝트: [저자 공식 GitHub 저장소](https://github.com/Su-my/VAPOR) (Apache-2.0)
- 키워드: multimodal reasoning, efficient MLLM inference, visual attention reuse, visual grounding, image reasoning, video reasoning

# 핵심 아이디어

긴 reasoning을 생성하는 MLLM은 새 text token마다 과거 visual token 전체에 attention을 다시 계산한다. 하지만 인접한 reasoning token은 서로 다른 문법 역할을 하면서도 같은 시각 근거를 보는 경우가 많다. VAPOR는 이 반복 계산을 줄이되 visual token을 영구 삭제하지 않는 **시간축 attention reuse**를 제안한다.

핵심은 attention output을 visual conditional output과 textual conditional output으로 분해하는 것이다. text 쪽은 매 step 정확히 다시 계산하고, visual 쪽은 마지막 exact attention 결과를 cache한다. 각 attention head는 low-rank proxy로 현재 visual demand를 추정해 cached output을 쓰는 `Persist`와 전체 visual KV를 다시 읽는 `Refresh`를 독립적으로 선택한다.

단순 reuse가 오래 지속되면 새 근거를 놓칠 수 있다. 그래서 prompt prefill에서 visual-attention 분포의 일관성으로 기본 threshold를 정하고, cache age가 늘수록 threshold를 낮춰 refresh 가능성을 높이며 최대 age에서는 강제로 갱신한다. full visual KV cache는 항상 남아 있어 refresh가 필요할 때 모든 visual token에 다시 접근한다.

# VLM 관점에서 중요한 이유

기존 효율화는 visual token을 미리 prune·merge하거나 layer 사이 attention을 공유하는 경우가 많다. 이 방식은 계산량을 줄이지만 뒤늦게 필요한 작은 시각 근거를 이미 버렸을 수 있다. VAPOR는 token 집합 자체를 줄이지 않고 **언제 같은 시각 읽기 결과를 다시 쓸지**를 결정하므로, 입력 압축과 직교적인 최적화가 될 수 있다.

더 흥미로운 결과는 dense attention보다 정확도도 소폭 높아졌다는 점이다. 저자 분석에서 긴 reasoning 동안 dense attention은 관련 evidence region에서 벗어날 수 있지만, cached visual output은 이미 찾은 근거를 몇 step 동안 유지한다. 즉 attention recomputation은 항상 정보 갱신만 하는 것이 아니라 linguistic context 변화에 따른 visual grounding drift도 만들 수 있다는 가설을 제시한다.

# Method

## 1. Visual/text attention output 분해

시점 $t$의 visual key 집합을 $\mathcal V$, text를 포함한 nonvisual key 집합을 $\mathcal T_t$라 하자. exact visual attention mass $M_{E,t}$와 각 집합 안에서 정규화한 conditional output $\bar v_t$, $\bar u_t$를 쓰면 full attention output은 정확히 다음처럼 나뉜다.

$$
o_t=M_{E,t}\bar v_t+(1-M_{E,t})\bar u_t
$$

visual value는 디코딩 중 고정되므로 $\bar v_t$를 마지막 refresh 시점의 $\bar v_a$로 cache할 수 있다. 반면 $\bar u_t$는 새 text token이 늘어나므로 항상 exact하게 갱신한다. 논문의 dense trajectory 분석에서는 $M_{E,t}\ge0.5$인 head-step 쌍이 0.34-2.58%에 불과했고, head마다 발생 시점도 달라 head-wise reuse의 근거가 된다.

## 2. Low-rank visual-mass proxy

prefill 뒤 visual key matrix $K_V$를 rank-$r$ truncated SVD로 한 번 근사한다.

$$
K_V\approx U_r\Sigma_rV_r^\mathsf T,\qquad
\hat z_{V,t}=\frac{U_r\Sigma_r(V_r^\mathsf Tq_t)}{\sqrt{d_h}}
$$

text logits는 exact하게 계산하고, approximate visual logits와 결합해 proxy mass $M_{P,t}$를 만든다. visual value aggregation 없이 visual demand만 추정하므로, exact visual query-key와 attention-value 연산보다 싸다. 기본 설정은 $r=16$이다.

## 3. Head-wise Persist/Refresh와 age control

첫 decoding step은 모든 head가 Refresh해 exact $\bar v_a$를 cache한다. 이후 visual mass가 작으면 Persist로 들어가 다음 출력을 사용한다.

$$
\hat o_t=M_{P,t}\bar v_a+(1-M_{P,t})\bar u_t
$$

Persist 중 $M_{P,t}$가 age-adjusted threshold $\tau_{h,t}$ 이상이면 그 token에서 즉시 exact attention을 계산한다. threshold는 prefill token들 사이 visual attention distribution의 Bhattacharyya overlap으로 정한 $\theta_M$에서 시작하고, cache age가 늘수록 cosine schedule로 낮아진다. 최대 age $D$에서는 강제 Refresh한다.

# 핵심 그림

![VAPOR가 prefill에서 threshold와 low-rank visual key를 준비하고, 디코딩 중 각 attention head가 visual mass와 cache age에 따라 Persist 또는 Refresh를 선택하는 구조](/papers/assets/vlm/vapor-sparse-visual-attention-updates/vapor-architecture.svg)

_논문 내용을 바탕으로 재구성._ 출처: [공식 HTML](https://arxiv.org/html/2611.33751)의 Figure 2와 Eqs. 3-10, [공식 PDF](https://arxiv.org/pdf/2611.33751). 원본 도판을 복사하지 않고 prefill 준비, head별 상태 전이, output 결합을 한국어 SVG로 다시 그렸다. 이 논문의 기여가 benchmark별 정성 예시보다 **visual output만 시간축으로 reuse하면서 text와 full visual KV를 보존하는 attention 경로**에 있으므로 전체 architecture figure를 골랐다.

왼쪽 prefill 단계는 prompt token들의 conditional visual-attention 일관성으로 입력별 기본 threshold $\theta_M$를 정하고, visual key를 rank-16 factor로 압축해 proxy 계산을 준비한다. 가운데 디코딩에서는 각 head가 독립적으로 작동한다. Persist는 text output $\bar u_t$와 proxy mass $M_{P,t}$는 새로 계산하면서 visual output $\bar v_a$만 재사용한다. proxy mass가 age-adjusted threshold를 넘거나 cache가 최대 age에 도달하면 Refresh가 full visual KV 전체에 exact attention을 수행하고 anchor를 갱신한다. 기존 token pruning과 달리 visual token을 삭제하지 않으며, 기존 cross-layer reuse와 달리 decoding step 사이에서 visual conditional output만 선택적으로 고정하는 것이 핵심 차이다.

# Experiments / Results

- 모델: Qwen3-VL-8B-Instruct, InternVL3.5-8B. BF16, batch size 1, greedy decoding, 최대 8,192 generated token.
- 이미지 추론 8종: MathVista, MathVerse, DynaMath, WeMath, AI2D, LogicVista, MMBench, MMMU-Pro.
- 비디오 추론 4종: MVBench, Video-MME, MMVU, Video-MMMU. 모든 방법에 동일한 64개 uniform frame을 주고 audio·subtitle은 쓰지 않는다.
- 비교군: Dense, FastV, VisionPulse, SparseVILA, TransPrune, VisionZip, QCache.
- 지연시간: A100 80GB에서 첫 model forward 이후부터 generation과 method-specific GPU 연산 완료까지 측정한다. model loading, warm-up, CPU preprocessing, scoring은 제외한다.
- 메모리: 별도 LogicVista 88개 입력·512 token 실험에서 overall peak allocated memory는 Dense 16.618 GiB, VAPOR 16.637 GiB로 19.3 MiB(0.11%) 증가했다.

## 주요 실험 결과

아래 표는 [공식 PDF/HTML Table 1](https://arxiv.org/html/2611.33751)과 [저자 공식 저장소의 결과표](https://github.com/Su-my/VAPOR#results)를 직접 대조한 modality별 unweighted mean이다. 정확도는 %, latency는 초/샘플이며, 속도 향상은 같은 모델의 Dense latency를 VAPOR latency로 나눈 값이다. 정확도 차이는 절대 **%p**다.

| 모델 / 평가 묶음 | Dense 정확도 (%) | VAPOR 정확도 (%) | 정확도 차이 | Dense → VAPOR decode latency (s) | 속도 향상 | 출처 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Qwen3-VL-8B / 이미지 8종 | 67.63 | **68.48** | **+0.85%p** | 87.1 → **75.7** | **1.15×** | Table 1 |
| Qwen3-VL-8B / 비디오 4종 | 62.77 | **63.58** | **+0.81%p** | 37.1 → **32.6** | **1.14×** | Table 1 |
| InternVL3.5-8B / 이미지 8종 | 63.59 | **64.08** | **+0.49%p** | 26.8 → **22.2** | **1.21×** | Table 1 |
| InternVL3.5-8B / 비디오 4종 | 63.17 | **63.60** | **+0.43%p** | 7.2 → **6.5** | **1.11×** | Table 1 |

가장 강한 acceleration baseline과도 조건을 맞춰 비교할 수 있다. Qwen 이미지에서는 QCache 68.13%보다 **+0.35%p** 높고 latency는 86.1초에서 75.7초로 짧다. Qwen 비디오는 QCache 62.96%보다 **+0.62%p**, InternVL 이미지는 VisionPulse 61.93%보다 **+2.15%p**, InternVL 비디오는 VisionPulse 63.06%보다 **+0.54%p** 높다. 마지막 비교의 latency는 두 방법 모두 6.5초다.

Figure 5의 graph-reading 사례에서 VAPOR는 네 reasoning 위치에 걸쳐 evidence region에 visual attention 13.2%를 유지하고 정답을 냈지만 Dense는 근거에서 벗어나 오답을 냈다. 다만 이는 정성 사례이며, accuracy 향상의 일반적 인과를 증명한 결과로 확대 해석하면 안 된다.

# Limitations / Discussion

- 평가 모델은 Qwen3-VL-8B와 InternVL3.5-8B 두 계열·동일한 8B 규모에 한정된다. 더 큰 모델, 다른 attention 구조, sampling decoding에서 같은 trade-off가 유지되는지는 확인되지 않았다.
- token pruning이 아니므로 full visual KV cache는 그대로 유지한다. visual context memory 자체를 줄이지 않으며, low-rank factor와 per-head cached output 때문에 LogicVista 실험의 decoding peak가 평균 40.7 MiB(0.24%) 늘었다.
- Table 1의 시간은 prefill을 제외한 decode latency다. 별도 고정 길이 실험에서 mean prefill은 Dense 0.122초, VAPOR 0.267초였으므로 짧은 출력에서는 end-to-end 이득이 작아질 수 있다.
- latency는 A100, batch size 1, BF16, custom Triton/PyTorch 환경에 종속된다. throughput 중심 batching이나 다른 GPU에서는 head-wise routing overhead 대비 절감 폭이 달라질 수 있다.
- 기본 threshold mapping, rank 16, 최대 cache age 512는 validation ablation에 의존한다. Appendix Table 7에서 proxy rank가 커질수록 mass MAE와 decision agreement는 개선되지만 정확도는 단조롭게 오르지 않아, proxy fidelity만으로 task 성능을 예측할 수 없다.
- 논문에는 별도 limitations section이 없다. 위 항목은 실험 범위와 Appendix E-G의 측정 조건에서 확인되는 적용 한계다. venue는 arXiv 외에 확인되지 않았다.

# 내가 이해한 핵심

VAPOR의 핵심은 visual attention을 “계속 볼 것인가 말 것인가”가 아니라 **같은 근거를 유지할 것인가 새 근거를 찾을 것인가**로 바꾼 데 있다. Persist에서도 visual contribution을 0으로 만들지 않고 proxy mass로 가중하며, text 쪽은 계속 갱신한다. 그래서 reasoning 문맥은 자라면서도 이미 확보한 시각 근거가 갑자기 흔들리는 것을 막을 수 있다.

이 구조가 정확도까지 높인다는 결과는 효율화와 grounding 안정화가 반드시 trade-off가 아니라는 점을 보여준다. 매 step exact recomputation은 더 많은 정보를 읽는 것처럼 보이지만, query가 linguistic context에 끌리면 오히려 evidence routing이 불안정해질 수 있다. cache는 여기서 단순 속도 장치가 아니라 short-term visual memory처럼 작동한다.

다만 “training-free”는 “engineering-free”가 아니다. model attention implementation을 수정하고 low-rank factor 준비, head별 상태, custom kernel을 관리해야 한다. 실제 배포에서는 긴 chain-of-thought나 long-video처럼 decode가 충분히 길고 visual KV가 큰 요청에서 이득이 크며, 짧은 VQA나 높은 batch throughput 서비스에서는 end-to-end profiling이 먼저 필요하다.

# 다음에 연결해서 읽을 논문

- [VisionPulse: Efficient Multimodal Reasoning via Vision-Aware Token Selection](https://arxiv.org/search/?query=VisionPulse+vision-aware+token+selection&searchtype=all): decoding-time visual selection과 VAPOR의 output reuse를 비교하는 주요 baseline이다.
- [QCache: Query-Aware Caching for Efficient Vision-Language Model Inference](https://arxiv.org/search/?query=QCache+vision+language+inference&searchtype=all): Qwen 계열에서 가장 강한 평균 정확도를 보인 acceleration baseline과 cache 단위를 비교할 수 있다.
- [Visual Token Routing: Learning to Keep Tokens That Matter](/papers/vlm/visual-token-routing-learning-to-keep-tokens-that-matter): spatial token selection과 temporal visual-output persistence가 결합 가능한지 생각해 보기 좋다.
- [C²-Routing: Complementary Cropping and Compression for Efficient Vision-Language Inference](/papers/vlm/c2-routing-complementary-cropping-compression): 입력 단계 crop/compression과 attention 단계 reuse가 서로 다른 비용 축을 다룬다는 점을 비교할 수 있다.
