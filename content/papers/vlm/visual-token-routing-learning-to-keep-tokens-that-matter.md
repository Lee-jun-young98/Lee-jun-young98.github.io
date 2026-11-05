---
title: "Visual Token Routing: Learning to Keep Tokens That Matter"
date: 2026-11-05
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Pranjal Aggarwal, Sean Welleck"
paper: "https://arxiv.org/abs/2611.06854"
code: "https://github.com/Pranjal2041/vtr"
project: "https://pranjal2041.github.io/vtr"
thumbnail: "/papers/assets/vlm/visual-token-routing-learning-to-keep-tokens-that-matter/vtr-architecture.svg"
---

# 한 줄 요약

VTR은 현재·과거 화면의 같은 위치를 보는 경량 router를 VLM과 공동 학습해, Qwen3.5-2B의 OSWorld 성능을 사실상 유지하면서 이미지당 시각 토큰을 2,040개에서 807.9개로 2.5배 줄이고 inference cost와 prefill을 각각 2.4배·2.3배 절감한다.

# 논문 정보

- 제목: Visual Token Routing: Learning to Keep Tokens That Matter
- 저자: Pranjal Aggarwal, Sean Welleck (Carnegie Mellon University)
- 발표: arXiv:2611.06854v1 (2026-11-04 제출, 2026-11-05 공개 배치), 학회 venue는 **확인 필요**
- 링크: [arXiv 초록](https://arxiv.org/abs/2611.06854), [HTML](https://arxiv.org/html/2611.06854), [PDF](https://arxiv.org/pdf/2611.06854)
- 공식 자료: [프로젝트](https://pranjal2041.github.io/vtr), [코드](https://github.com/Pranjal2041/vtr), [VTR-2B 모델](https://huggingface.co/l3lab/VTR-2B)
- 키워드: visual token routing, computer-use agent, temporal redundancy, adaptive computation, multimodal agent

# 핵심 아이디어

GUI agent는 매 단계 새 screenshot을 받고, Qwen3.5는 1080p 한 장을 약 2,040 visual token으로 바꾼다. 100-step task라면 마지막 context에 visual token만 20만 개가 쌓인다. VTR은 모든 patch를 낮은 해상도로 만드는 대신 **행동 예측에 필요한 원해상도 patch만 선택**한다.

1. 같은 공간 위치의 현재 token과 과거 $K=10$개 token을 이어 붙여 작은 MLP router에 넣는다.
2. router가 각 token의 keep probability를 만들고 Bernoulli gate로 keep/drop한다. keep token은 확률로 scaling되어 discrete sampling에도 router로 gradient가 흐른다.
3. 10개 observation마다 첫 화면을 anchor로 완전히 보존해 전체 화면 기준을 주기적으로 새로 고친다.
4. full-history model과 anchor-only blind model을 학습 때만 두어, token을 버린 탓에 잃은 정보량을 행동 token별로 측정한다.
5. 정해진 keep ratio를 맞추지 않는다. full history가 주는 이득의 최대 10%만 잃도록 제약하고, Lagrange multiplier를 dual ascent로 조절해 입력별 최소 token 수를 찾는다.

# VLM 관점에서 중요한 이유

- single-image saliency가 아니라 **시간축 중복과 다음 행동의 의미적 필요성**을 동시에 학습한다. 화면이 크게 움직여도 행동과 무관한 영역은 버릴 수 있다.
- 고정 token budget·threshold 대신 성능 저하 한도를 제약한다. desktop에서는 약 40%, 30fps game에서는 약 17%를 남기는 식으로 domain마다 다른 sparsity가 나타난다.
- token을 vision encoder 뒤의 실제 sequence에서 제거하므로 LLM의 모든 layer에서 attention·KV-cache 비용을 아낀다.
- 낮은 해상도는 cursor나 spreadsheet cell 같은 작은 행동 단서를 지우지만, VTR은 선택한 patch의 해상도를 유지한다.
- GUI agent뿐 아니라 긴 video history, streaming assistant처럼 거의 같은 frame이 누적되는 VLM에 적용할 수 있는 학습 원리다.

# Method

## 1. 시공간 router와 anchor

vision encoder가 observation $o_\tau$의 위치 $j$를 token $v_{\tau,j}$로 바꾸면, router는 같은 위치의 시간 window를 입력으로 받는다.

$$
x_{\tau,j}=[v_{\tau-K,j};\ldots;v_{\tau,j}],\qquad
p_{\tau,j}=\sigma(f_\phi(x_{\tau,j})).
$$

$g_{\tau,j}\sim\mathrm{Bernoulli}(p_{\tau,j})$로 gate를 sampling하고, keep된 token은 $\tilde v_{\tau,j}=p_{\tau,j}v_{\tau,j}$로 VLM에 들어간다. 확률 scaling이 router에 gradient를 주며 원래 position은 유지된다. 매 $B=10$ observation의 첫 화면은 anchor로 모두 남기고 나머지만 routing한다. sliding variant는 최초 anchor 하나 뒤로 rolling window를 쓴다.

## 2. 성능 저하를 reference model로 분리

action token $n$에 대해 full-history, anchor-only blind, sparse VTR model의 cross-entropy를 각각 $\ell_n^{full},\ell_n^{blind},\ell_n^{sparse}$라 둔다.

$$
i_n=\ell_n^{blind}-\ell_n^{full},\qquad
d_n=\ell_n^{sparse}-\ell_n^{full}.
$$

$i_n$은 추가 screenshot이 실제로 준 도움이고, $d_n$은 routing으로 잃은 양이다. anchor만으로도 쉬운 token은 가중치를 거의 받지 않고 full history가 중요한 행동 token이 degradation loss를 주도한다. full/blind model은 학습 때만 쓰며 추론 비용에는 포함되지 않는다.

## 3. dual ascent로 adaptive token budget 학습

VTR은 keep probability 평균 $\mathcal L_{tok}$을 최소화하되, full history의 이득 중 잃는 비율 $\bar r$이 $r^\star=0.1$ 이하가 되도록 제한한다.

$$
\min \mathcal L_{tok}\quad\text{s.t.}\quad
\bar r=\frac{\sum_n d_n}{\sum_n i_n}\le r^\star,
$$

$$
\lambda\leftarrow\max\left(0,\lambda+\alpha(\bar r-r^\star)\right).
$$

저하가 한도를 넘으면 $\lambda$가 커져 더 많은 token을 남기고, 여유가 있으면 작아져 더 버린다. Qwen3.5-2B와 23.3M-parameter 3-layer MLP router를 8×H100에서 2,000 step 공동 학습한다. 초기 router는 이전 frame과 달라졌고 SAM object에 속한 patch를 keep하도록 558 step 사전 학습하지만, 최종 선택은 action loss로 다시 다듬는다.

# 핵심 그림

![연속 screenshot을 frozen vision encoder가 공간 token으로 바꾸고, 같은 위치의 11개 token을 보는 시공간 router가 anchor를 제외한 token을 선택해 Qwen3.5 VLM의 다음 행동 입력으로 보내며, 학습 때 full model과 blind model의 손실 차이 및 dual ascent로 keep 비율을 조절하는 VTR 구조](/papers/assets/vlm/visual-token-routing-learning-to-keep-tokens-that-matter/vtr-architecture.svg)

> 그림 1. 원 논문 Figure 1–3, Sections 2.1–2.3, Equations (1)–(8)을 바탕으로 재구성한 VTR 학습·추론 구조. 출처: [arXiv PDF Figure 1–3](https://arxiv.org/pdf/2611.06854#page=2), [공식 프로젝트 Method](https://pranjal2041.github.io/vtr/#method). 원본 이미지를 복제하지 않고 논문 내용을 한국어로 다시 그린 재구성이다.

이 그림을 고른 이유는 VTR의 기여가 router 하나가 아니라 **시공간 입력, 주기적 anchor, reference-model 기반 저하 측정, adaptive sparsity**가 이어지는 전체 pipeline에 있기 때문이다. 왼쪽에서 연속 screenshot은 frozen vision encoder를 지나 위치별 token이 된다. router는 현재와 과거 10개 화면의 같은 위치를 보고 keep probability를 내며, anchor는 완전히 보존되고 routed frame의 선택 token만 원래 위치를 유지한 채 VLM으로 들어가 다음 행동을 만든다.

학습 흐름은 아래쪽이다. full model은 모든 화면을, blind model은 anchor만 보며 sparse model의 손실과 비교할 기준을 만든다. $\bar r>0.1$이면 $\lambda$를 올려 더 보게 하고, 한도 안이면 token penalty가 더 작게 보도록 압박한다. 추론 때에는 점선으로 표시한 full/blind reference와 dual-ascent loop를 제거하고 vision encoder, router, VLM만 사용한다. fixed-ratio pruning과 달라진 핵심은 token 수가 아니라 **행동 예측 손실의 허용 저하**를 목표로 삼는다는 점이다.

# Experiments / Results

- 하나의 Qwen3.5-2B model을 CUA-World train trajectory와 500시간 game data에 함께 학습한다. desktop은 1920×1080, game은 640×360이고 router는 두 domain에서 공유된다.
- OSWorld는 인터넷이 필요 없는 295/369 task를 seed 3개로 평가하고 최대 100 step을 허용한다. CUA-World는 200개 professional app의 512 task, game은 36개 게임의 약 9만 action으로 평가한다.
- OSWorld에서 dense full-resolution은 2,040 token/이미지와 18.56점, VTR은 807.9 token과 18.10점이다. 2.5배 적은 token으로 −0.46점이며 paired test 95% CI [−2.88, 1.94], $p=0.71$이라 유의한 차이가 아니다.
- CUA-World에서도 1,946.2→674.3 token(2.9배 감소), 평균 16.61→16.34(−0.27점)다. paired subset 차이는 −0.52, $p=0.66$이다.
- video game click accuracy는 dense 4.74%에서 VTR 4.90%로 +0.16%p이며 token은 220→38.2개(5.8배 감소)다. 절대 click accuracy가 매우 낮다는 점은 함께 봐야 한다.
- VTR의 OSWorld 18.10점은 H.264 9.44점보다 +8.66점, pixel-diff 5.25점보다 +12.85점 높다. 같은 초기 router를 고정하면 4.91점이므로 joint training이 +13.19점을 만든다.
- cost/prefill 감소는 OSWorld 2.4×/2.3×, CUA-World 1.8×/2.2×, game 3.3×/2.9×다. token 감소율보다 작지만 실제 serving 절감으로 이어진다.

## 주요 실험 결과

원 논문 Table 2의 동일 모델·데이터 비교다. Token은 이미지당 평균 visual token, cost와 prefill은 full-resolution dense 대비 감소 배수다.

| OSWorld method   | token/image (↓) | score (↑) | cost 감소 | prefill 감소 | dense 대비 score 차이 |
| ---------------- | --------------: | --------: | --------: | -----------: | --------------------: |
| Dense, 100% area |         2,040.0 |     18.56 |      1.0× |         1.0× |                  기준 |
| Dense, 50% area  |         1,008.0 |     15.19 |      1.9× |         1.9× |                 −3.37 |
| H.264            |         1,386.5 |      9.44 |      1.3× |         1.4× |                 −9.12 |
| Pixel-diff       |           485.9 |      5.25 |      2.4× |         3.2× |                −13.31 |
| Frozen router    |           421.5 |      4.91 |      3.6× |         3.8× |                −13.65 |
| **VTR (ours)**   |       **807.9** | **18.10** |  **2.4×** |     **2.3×** |             **−0.46** |

VTR은 half-area dense보다 token을 200.1개 더 적게 쓰면서 score는 +2.91점 높다. 단순 motion rule과 달리 행동에 필요한 정적 영역도 남기고, 움직여도 무관한 영역은 버린 결과다. Table 3의 paired test는 VTR–dense score 차이 −0.46점이 통계적으로 유의하지 않음을 확인한다.

Table 4의 video-game action 결과는 domain별 adaptive sparsity를 보여 준다.

| game method      | token/frame (↓) | dense 대비 감소 | click accuracy % (↑) | dense 대비 차이 |
| ---------------- | --------------: | --------------: | -------------------: | --------------: |
| Dense, 100% area |           220.0 |            1.0× |                 4.74 |            기준 |
| H.264            |           150.3 |            1.5× |                 2.54 |         −2.20%p |
| Pixel-diff       |            67.3 |            3.3× |                 4.59 |         −0.15%p |
| Frozen router    |            51.6 |            4.3× |                 4.14 |         −0.60%p |
| **VTR (ours)**   |        **38.2** |        **5.8×** |             **4.90** |     **+0.16%p** |
| VTR sliding      |            23.2 |            9.5× |                 4.34 |         −0.40%p |

30fps game에서는 frame 간 중복이 커 desktop보다 더 공격적으로 줄인다. sliding은 token을 더 줄이지만 click accuracy가 VTR anchor 방식보다 −0.56%p 낮아, 주기적으로 완전한 화면을 다시 보는 안전장치의 가치를 보여 준다.

# Limitations / Discussion

- backbone은 Qwen3.5-2B 하나뿐이다. 더 큰 MLLM, 다른 vision encoder, native video model에서 같은 router와 제약 목표가 유지되는지 검증되지 않았다.
- OSWorld dense 18.56, VTR 18.10으로 두 방법 모두 절대 task 성능이 낮고, game click accuracy도 약 5%다. 강한 완성형 agent의 성공률을 보존했다고 일반화하기 어렵다.
- full model과 blind model을 함께 학습하므로 2,000-step 본 학습에는 추론 때보다 훨씬 많은 model compute와 memory가 필요하다. 논문은 inference 절감은 자세히 보고하지만 총 학습 비용 비교는 제한적이다.
- anchor interval $B=10$, history $K=10$, degradation target $r^\star=0.1$은 고정 설정이다. 화면 변화 속도와 failure cost가 다른 환경에서 자동 조정되는지는 확인이 필요하다.
- Bernoulli sampling 때문에 작은 cursor·상태 indicator처럼 잠깐 나타난 단서를 잘못 drop하면 이후 VLM이 복구할 수 없다. anchor가 이 위험을 10-step 범위로 제한할 뿐 제거하지는 않는다.
- CUA-World 평균 score는 Gemini 3 Flash checklist verifier에 의존한다. evaluator 편향과 task별 score scale은 OSWorld pass rate나 game accuracy와 직접 비교할 수 없다.
- 학습 data는 demonstration의 next-action prediction이다. online interaction에서 routing mistake가 상태 분포를 바꾸는 장기 누적 효과와 안전-critical GUI action은 별도 평가가 필요하다.

# 내가 이해한 핵심

VTR의 가장 좋은 설계는 “몇 %를 버릴까?”를 직접 고르지 않는 것이다. token 수 목표는 입력 난이도와 무관하지만, $\bar r$은 **full history가 실제로 주는 도움 중 얼마를 잃었는가**를 묻는다. 변화가 빠른 game은 적은 token으로도 다음 action을 맞힐 수 있어 17%만 남고, 작은 정적 UI 단서가 중요한 desktop은 약 40%를 남긴다.

full/blind reference도 중요하다. sparse model의 loss만 줄이면 원래 어려운 action 때문에 router가 불필요하게 많은 화면을 남길 수 있다. 반대로 anchor만으로 이미 예측되는 action에는 새 screenshot을 보존할 이유가 적다. 두 기준의 차이가 시각 history의 한계 효용을 근사하고, 그 신호로 router를 학습한다.

다만 이 접근은 “학습 시 비싼 teacher/reference를 써서 추론 시 싸게 만든다”는 trade-off다. 다음 단계로는 cached teacher logit이나 uncertainty proxy로 reference forward를 줄이고, routing miss가 실제 task failure로 이어지는 online rollout objective와 OCR·DOM·audio token의 공동 routing으로 확장할 수 있다.

# 다음에 연결해서 읽을 논문

- [ReVision: Scaling Computer-Use Agents via Temporal Visual Redundancy Reduction](https://arxiv.org/abs/2605.11212) — 이전 화면과 patch를 비교하지만 selector를 action model과 별도로 학습하는 가장 가까운 GUI baseline이다.
- [Dynamic-LLaVA: Efficient Multimodal Large Language Models via Dynamic Vision-language Context Sparsification](https://arxiv.org/abs/2412.00876) — single-image VLM에서 고정 keep target을 쓰는 learned token pruning과 VTR의 adaptive constraint를 비교할 수 있다.
- [VideoLLM-MoD: Efficient Video-Language Streaming with Mixture-of-Depths Vision Computation](https://arxiv.org/abs/2408.16730) — token을 제거하기보다 decoder depth별 계산을 routing하는 video 접근이다.
- [From Patching to Pruning Visual Computation in Vision-Language Models](/papers/vlm/from-patching-to-pruning-visual-computation-in-vision-language-models) — visual token pruning의 효율·정확도 trade-off를 넓은 관점에서 연결한다.
