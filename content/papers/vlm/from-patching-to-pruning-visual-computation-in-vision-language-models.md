---
title: "From Patching to Pruning Visual Computation in Vision-Language Models"
date: 2026-10-05
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Rahul Chowdhury, Timothy A. Rupprecht, Xuan Shen, Shaoyi Huang, Pu Zhao, Yanzhi Wang"
paper: "https://arxiv.org/abs/2610.03389"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/from-patching-to-pruning-visual-computation-in-vision-language-models/p2p-architecture.svg"
---

# 한 줄 요약

Patch-to-Prune(P2P)는 VLM의 시각 토큰을 지우지 않고, 검증셋에서 안전하다고 판정한 초기·후기 디코더 층의 시각 토큰 projection을 평균 activation으로 대체해 정확도와 시퀀스 구조를 대체로 보존하면서 연산을 줄인다.

# 논문 정보

- 제목: From Patching to Pruning Visual Computation in Vision-Language Models
- 저자: Rahul Chowdhury, Timothy A. Rupprecht, Xuan Shen, Shaoyi Huang, Pu Zhao, Yanzhi Wang
- 발표: arXiv:2610.03389v1 (2026-10-02 제출), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.03389), [HTML 논문](https://arxiv.org/html/2610.03389), [PDF](https://arxiv.org/pdf/2610.03389)
- 코드/프로젝트: 2026-10-05 기준 arXiv와 논문 본문에서 공식 공개 링크를 확인하지 못함
- 키워드: vision-language model, efficient inference, activation patching, mechanistic interpretability, computation pruning, visual token

# 핵심 아이디어

기존 FastV·PyramidDrop 계열은 중요도가 낮다고 본 시각 토큰을 시퀀스에서 제거한다. P2P는 다른 축을 공략한다. **어떤 토큰을 없앨지**가 아니라 **같은 시각 토큰에 대해 어느 깊이의 projection 연산이 실제로 필요한지**를 찾는다.

작은 통계 split에서 각 디코더 층·projection 모듈·모달리티별 평균 activation을 만든다. 별도의 검증 split에서는 앞에서 뒤로, 뒤에서 앞으로 누적 activation patching을 수행한다. 정확도가 허용 오차 $\tau$ 안에 남는 초기 prefix와 후기 suffix를 합쳐 safe layer 집합을 고정한다. 테스트 때 safe layer의 시각 토큰에는 $Q/K/V/O$와 gated-MLP projection을 실제 계산하지 않고 캐시된 평균 벡터를 넣는다.

따라서 시각 토큰의 개수·순서·position·attention mask·residual 경로는 그대로 남는다. 논문의 해석은 초기와 후기 층에는 token-specific 시각 계산의 중복이 많고, 과제에 필요한 시각 통합은 중간 층에 집중된다는 것이다.

# VLM 관점에서 중요한 이유

P2P는 activation patching을 사후 해석 도구에서 실제 추론 그래프로 옮긴다. 모델 내부에서 시각 정보가 **어디서** 쓰이는지 측정한 결과를 그대로 연산 우회 정책으로 바꾼다는 점이 핵심이다. 이는 효율화와 mechanistic analysis가 같은 실험에서 연결될 수 있음을 보여 준다.

또한 token pruning과 직교적이다. 중간의 민감한 층에서는 기존 방식으로 중요한 토큰만 남기고, 초기·후기 safe layer에서는 남은 시각 토큰의 projection 자체를 우회하는 조합을 생각할 수 있다. 다만 허용 오차는 검증 split에서 정해지므로, 다른 분포나 과제에서도 같은 safe layer가 안전하다고 가정하면 안 된다.

# Method

1. **통계 activation 수집:** benchmark별 100개 샘플로 각 layer $\ell$, projection $m$, stream $s$의 example-balanced 평균 $\mu_{\ell,m,s}$를 계산한다. 긴 이미지가 평균을 지배하지 않도록 샘플마다 먼저 token 평균을 낸다.
2. **양방향 누적 sweep:** 별도의 100개 검증 샘플에서 입력 쪽부터 누적 patch하는 forward sweep과 출력 쪽부터 누적 patch하는 backward sweep을 수행한다. image-only, text-only, dual stream을 비교해 중복이 주로 시각 경로에 있음을 확인한다.
3. **safe layer 선택:** $\mathrm{Acc}_d(L) \ge (1-\tau)\mathrm{Acc}_0$를 만족하는 최대 prefix와 suffix의 합집합 $\mathcal{S}^{*}_{\tau}$를 고른다. 기본값은 $\tau=3\%$다.
4. **연산 우회 추론:** safe layer에서 시각 토큰의 attention·MLP projection matmul을 건너뛰고 $\mu^v_{\ell,m}$를 출력으로 채운다. 텍스트 토큰과 safe set 밖의 모든 토큰은 원래 계산을 수행한다.
5. **선택적 P2P-aware LoRA:** 성능 회복이 필요하면 safe layer에 rank-1 LoRA를 넣되 학습 중에도 같은 patch graph를 사용한다. loss는 정답 assistant token의 causal language modeling loss만 계산한다.

# 핵심 그림

![통계 split에서 평균 activation을 만들고 검증 split의 양방향 sweep으로 초기·후기 safe layer를 정한 뒤, 테스트에서 해당 층의 시각 projection 연산만 우회하는 Patch-to-Prune 구조 재구성도](/papers/assets/vlm/from-patching-to-pruning-visual-computation-in-vision-language-models/p2p-architecture.svg)

_논문 내용을 바탕으로 재구성._ 입력 → 통계 prototype 생성 → 양방향 safe-layer 선택 → computation-bypassed inference의 전체 구조가 이 방법의 핵심이므로 architecture/overview 그림을 골랐다. 출처: [논문 Figure 1, Sections 3–4, Equations (1)–(2)](https://arxiv.org/html/2610.03389). 원문은 CC BY-SA 4.0이며, 한글 설명과 학습·추론 경계를 명확히 하기 위해 직접 재구성했다.

그림의 파란 경로는 한 번 수행하는 설정 단계다. 통계 split의 시각 activation 평균을 층별 캐시에 저장하고, 검증 정확도가 $\tau$ 이내로 유지되는 prefix·suffix만 safe set으로 확정한다. 초록 경로는 실제 추론이다. 중간의 민감한 층과 모든 텍스트 토큰은 원 계산을 유지하지만, safe layer의 시각 토큰은 projection matmul 대신 캐시 벡터를 받는다. 학습이 필수는 아니며, 선택적 LoRA를 쓸 때만 동일한 patched graph에서 정답 token loss로 보정한다.

# Experiments / Results

- 모델은 Qwen2.5-VL-3B/7B-Instruct와 LLaVA-v1.6-Vicuna-7B/13B-HF다.
- 논문은 WhatsUp-VLM의 두 하위 과제(COCOQA, VGQA), POPE, ScienceQA-IMG, GQA, TextVQA, CV-Bench, AI2D를 보고한다. 즉 7개 benchmark suite, 표에서는 8개 task column이다.
- proxy 통계 100개, safe-layer 검증 100개, 최종 test는 서로 겹치지 않는다. 비교 방법도 동일 모델·prompt·precision·test example·metric을 사용한다.
- 기본 $\tau=3\%$에서 네 모델·보고 과제 평균으로 dense accuracy의 약 94%를 유지하면서 FLOPs 55%, latency 22%를 줄였다고 보고한다.
- 낮은 FLOPs가 항상 낮은 지연시간은 아니다. patching 고정비 때문에 $\tau=5\%$가 $3\%$보다 FLOPs는 낮아도 느려지는 경우가 있다.

## 주요 실험 결과

아래 값은 논문 Table 1의 동일 test/prompt/precision 조건에서 8개 task column을 평균한 저자 보고치다. 정확도 차이는 P2P에서 Vanilla를 뺀 절대 %p이며, FLOPs·latency는 논문이 계산한 상대 감소율이다.

| 모델 / 지표 (단위, ↑/↓)              | Vanilla | P2P ($\tau=3\%$) |   차이 | 출처    |
| ------------------------------------ | ------: | ---------------: | -----: | ------- |
| LLaVA-7B 평균 정확도 (%, ↑)          |    64.1 |             60.1 | -4.0%p | Table 1 |
| LLaVA-7B 평균 FLOPs (TFLOPs, ↓)      |    30.8 |             12.6 | -59.1% | Table 1 |
| LLaVA-7B 평균 latency (s/sample, ↓)  |   0.351 |            0.297 | -15.4% | Table 1 |
| LLaVA-13B 평균 정확도 (%, ↑)         |    69.3 |             65.7 | -3.6%p | Table 1 |
| LLaVA-13B 평균 FLOPs (TFLOPs, ↓)     |    59.2 |             22.4 | -62.2% | Table 1 |
| LLaVA-13B 평균 latency (s/sample, ↓) |   0.619 |            0.462 | -25.4% | Table 1 |

기본 설정은 두 LLaVA 크기에서 FLOPs를 약 60% 줄이지만 평균 정확도는 3.6–4.0%p 낮다. 따라서 P2P가 token-pruning baseline을 전 지표에서 지배하는 것은 아니다. 저자도 같은 조건에서 P2P의 평균 정확도가 FastV·PyramidDrop보다 낮다고 명시한다. 반면 LLaVA-7B에서 FastV와 PyramidDrop은 FLOPs를 줄이고도 평균 latency가 각각 0.377s, 0.369s로 Vanilla 0.351s보다 느렸고, P2P는 0.297s였다.

Table 2의 보정 실험에서는 $\tau=3\%$ P2P-aware LoRA가 ScienceQA 62.4→62.9%(+0.5%p), TextVQA 52.4→58.9%(+6.5%p), CV-Bench 50.6→62.8%(+12.2%p)로 frozen P2P의 손실을 회복한다. 이 비교는 inference graph를 동일하게 유지한 채 100개 통계 split으로만 학습한다. 수치와 설정은 [논문 Table 1–2 및 Section 5](https://arxiv.org/html/2610.03389)에서 직접 대조했다.

# Limitations / Discussion

- safe layer는 benchmark별 100개 검증 샘플과 정확도 tolerance에 의존한다. 논문도 full test의 하락이 지정한 tolerance를 넘는 과제가 있음을 인정한다.
- 실험은 네 개 모델이지만 Qwen2.5-VL과 LLaVA 두 계열뿐이다. 더 최신 proprietary VLM, video VLM, document-specialist 모델로의 일반화는 검증되지 않았다.
- 평균 prototype은 입력별 시각 세부를 지운다. TextVQA·CV-Bench처럼 세밀한 OCR·공간 정보가 필요한 과제가 aggressive pressing에 더 민감하다.
- FLOPs 절감과 wall-clock 개선은 일치하지 않는다. 실제 이득은 kernel 구현, batch, token 길이, 하드웨어와 patching 오버헤드에 좌우된다.
- 본문은 7개 benchmark라고 쓰지만 Table 1은 WhatsUp의 두 하위 과제를 따로 세어 8개 열을 평균한다. 종합 평균을 인용할 때 평가 단위를 구분해야 한다.
- 공식 코드가 확인되지 않아 재현성, safe-layer 탐색 비용, 커스텀 kernel의 실제 구현 세부를 독립적으로 검증하기 어렵다.
- 선택적 LoRA는 training-free라는 주된 장점을 일부 포기한다. 성능을 회복한 결과와 순수 frozen P2P 결과를 섞어 해석하면 안 된다.

# 내가 이해한 핵심

이 논문의 가장 중요한 관찰은 “시각 토큰이 끝까지 남아 있어야 한다”와 “모든 층에서 그 토큰의 projection을 다시 계산해야 한다”가 같은 명제가 아니라는 것이다. 중간 층에서 task-relevant integration을 마치면 후기 층은 residual과 텍스트 표현에 이미 옮겨진 정보를 주로 사용할 수 있다. P2P는 이 가설을 activation intervention으로 검사하고, 통과한 구간만 실제 계산에서 뺀다.

설득력 있는 부분은 시퀀스 구조를 보존한 채 latency까지 낮췄다는 점이고, 조심할 부분은 검증 tolerance가 test 보장을 뜻하지 않는다는 점이다. 이 방법은 범용 고정 pruning mask라기보다 모델·과제·운영점별로 calibration해야 하는 depth routing 정책에 가깝다.

# 다음에 연결해서 읽을 논문

- [An Image is Worth 1/2 Tokens After Layer 2: Plug-and-Play Inference Acceleration for Large Vision-Language Models (FastV)](https://arxiv.org/abs/2403.06764): 시퀀스 축 token pruning과 P2P의 depth 축 computation pruning을 비교할 수 있다.
- [PyramidDrop: Accelerating Your Large Vision-Language Models via Pyramid Visual Redundancy Reduction](https://arxiv.org/abs/2410.17247): 층이 깊어질수록 토큰을 단계적으로 제거하는 기준선이다.
- [How to Use and Interpret Activation Patching](https://arxiv.org/abs/2404.15255): P2P의 causal localization 도구가 가진 해석상의 함정을 이해하는 데 도움이 된다.
- [LLaVA-PruMerge: Adaptive Token Reduction for Efficient Large Multimodal Models](https://arxiv.org/abs/2403.15388): 토큰 제거 대신 병합으로 정보를 보존하는 또 다른 효율화 축이다.
