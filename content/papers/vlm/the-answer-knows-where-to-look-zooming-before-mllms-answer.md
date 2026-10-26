---
title: "The Answer Knows Where to Look: Zooming before MLLMs Answer under Visual-Token Budgets"
date: 2026-10-26
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Zhensheng Hu, Guanglong Xu, Guanqiang Hu"
paper: "https://arxiv.org/abs/2610.32664"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/the-answer-knows-where-to-look-zooming-before-mllms-answer/lookzoom-architecture.svg"
---

# 한 줄 요약

LookZoom은 정답 생성 중에 드러나는 MLLM의 시각 근거 위치를 전용 `<look>` 토큰으로 사후 증류하고, 입력별로 확대 방식을 골라 작은 시각 토큰 예산에서도 문서·차트의 미세 텍스트를 읽게 한다.

# 논문 정보

- 제목: The Answer Knows Where to Look: Zooming before MLLMs Answer under Visual-Token Budgets
- 저자: Zhensheng Hu, Guanglong Xu, Guanqiang Hu
- 발표: arXiv:2610.32664v1 (2026-10-23), venue 확인 필요
- 링크: [arXiv 초록](https://arxiv.org/abs/2610.32664), [arXiv HTML](https://arxiv.org/html/2610.32664v1)
- 코드/프로젝트: 공식 공개 링크 확인 필요
- 키워드: MLLM, document VQA, visual-token budget, adaptive zoom, attention distillation, visual grounding

# 핵심 아이디어

토큰 수가 작은 저해상도 입력에서는 답이 있는 위치를 확대해야 하지만, 확대 위치는 답을 생성하기 전에 정해야 한다. 저자들의 관찰은 역설적이다. 정답 토큰의 중간층 attention은 근거를 잘 찾지만, 답변 전 시작 위치의 attention은 모델별로 다른 상위층에서야 늦고 넓게 근거를 가리킨다. 공유 attention을 직접 지도하면 포인팅은 날카로워져도 읽기 정확도가 떨어진다.

LookZoom은 이 충돌을 별도 경로로 푼다. 마지막 프롬프트 위치에 전용 `<look>` 토큰을 붙이고, 올바른 rollout의 answer-time attention을 날카롭게 만든 분포로 증류한다. 이 토큰의 attention은 **어디를 볼지**를, hidden state와 정보 격차 등의 특징을 받는 action head는 **어떻게 볼지**를 결정한다. 답변 단계에서는 `<look>` 토큰을 완전히 제거해 포인팅 학습이 reader를 바꾸지 않게 한다.

# VLM 관점에서 중요한 이유

- 고해상도 문서 이해를 무조건 더 많은 visual token으로 해결하지 않고, 제한된 토큰을 근거가 있는 영역에 재배분한다.
- 모델 내부에 이미 존재하지만 답변 뒤에야 읽을 수 있던 grounding 신호를 답변 전 단일 prefill로 옮긴다.
- box annotation, 외부 detector, 사전 답변 생성 없이 모델 자신의 올바른 답변을 teacher로 사용한다.
- `none`까지 포함한 view 선택으로 확대가 불필요한 입력은 두 번째 view 비용을 아낀다. 이는 문서 VQA뿐 아니라 다중 이미지·비디오처럼 이미지당 예산이 작은 설정에도 연결될 수 있다.

# Method

1. 원본 이미지 $I$를 이미지당 예산 $B$에 맞춘 저해상도 view $v$로 인코딩한다. 실험의 $B\in\{98,196,392\}$는 각각 최대 $B\times32^2$ 픽셀에 해당한다.
2. $[v,q,\texttt{<look>}]$를 한 번 prefill한다. `<look>` 위치에만 작동하는 position-specific LoRA를 두고, 중간층 attention을 평균·정규화·Gaussian smoothing해 pointer $g_{\text{look}}$를 만든다.
3. 학습 때 올바른 rollout($r(y_i)\ge0.5$)을 최대 2개 teacher-force하고 answer token의 attention을 모은다. 평균 attention을 제곱해 sharpen한 $\hat g$에 대해 $\mathrm{KL}(\hat g\|g_{\text{look}})$를 최소화한다.
4. action head는 `none`, 두 crop, 두 square window, 두 adaptive window, foveated warp의 8개 action 중 하나를 고른다. 별도 6,000개 학습 이미지에서 모든 view의 실제 점수 $s_a$를 계산하고, 평균 대비 이득을 최대화하는 full-information objective로 학습한다.
5. reader는 4,500개 질문과 view별 rollout으로 200-step GRPO 학습을 한다. 추론에서는 pointer/action용 prefill → 원본에서 선택 view 생성·재인코딩 → 저해상도 view와 선택 view로 답변의 두 단계만 수행하며, 사전 텍스트 생성은 없다.

# 핵심 그림

![저해상도 문서와 질문이 전용 look 토큰의 위치 포인터와 view 선택기를 거쳐 확대 view를 만들고, look 토큰을 제거한 reader가 답하는 LookZoom 구조](/papers/assets/vlm/the-answer-knows-where-to-look-zooming-before-mllms-answer/lookzoom-architecture.svg)

> 그림 1. 논문 Figure 4와 식 (1)–(3)을 바탕으로 재구성한 LookZoom 학습·추론 파이프라인. 출처: [arXiv HTML Figure 4](https://arxiv.org/html/2610.32664v1#S4.F4), CC BY 4.0. 원본 그림을 그대로 복사하지 않고 한국어 설명도로 재구성했다.

전체 방법론 그림을 고른 이유는 이 논문의 성능 향상이 단순 crop이 아니라 **정답 attention의 사후 증류 → pointer와 action의 분리 → `<look>`을 제거한 reader**라는 구조적 분리에서 나오기 때문이다. 입력은 저해상도 image tokens와 질문이며, `<look>` attention은 위치 분포 $g_{\text{look}}$를 만들고 hidden state 기반 action head가 확대 형태를 선택한다. 선택된 영역은 원본 해상도 이미지에서 변환한 뒤 같은 visual-token 예산으로 다시 인코딩된다.

학습에서는 올바른 답변의 중간층 attention을 sharpen한 $\hat g$가 위치 교사이고, 모든 후보 view의 counterfactual 점수가 action 교사다. reader는 여러 view에 대응하도록 GRPO로 적응한다. 추론에서는 정답 rollout과 counterfactual 실행이 사라지고, `<look>` 토큰도 답변 pass에 들어가지 않는다. 따라서 포인팅을 위한 LoRA와 $\mathcal L_{\text{look}}$의 gradient가 reader의 답 분포를 직접 바꾸지 않는 점이 공유 attention 지도와의 핵심 차이다.

# Experiments / Results

- backbone은 Qwen3-VL-Instruct 2B/4B/8B이며, V-CoT-Doc·DocVQA·InfographicVQA·ChartQA·TextVQA를 사용했다. 공개 benchmark는 seed 0의 고정 500문항 subset이고 TextVQA는 학습에 쓰지 않았다.
- 98 tokens/view에서 LookZoom은 각 scale의 strongest baseline 평균을 9.1%p(2B), 5.3%p(4B), 4.8%p(8B) 앞섰다.
- 4B·196-token 설정에서 LookZoom은 76.0%로 single view 65.4%보다 10.6%p, strongest baseline 72.0%보다 4.0%p 높았다.
- 98-token adaptive window에서 `<look>` pointer는 같은 중간층의 pre-answer pointer보다 9.9%p 높았다. 즉 peak 위치뿐 아니라 근거에 attention 질량을 집중한 정도가 확대 배율을 결정한다.
- 4B·196-token 실행 시간은 0.35초/샘플로 AttWarp 0.58초, Ground-then-crop 1.26초보다 짧았다. 다만 동일 저자 구현·하드웨어의 Table 2 측정이라는 범위에서 해석해야 한다.

## 주요 실험 결과

Table 1의 같은 backbone·같은 view 예산·같은 5개 benchmark 평균만 비교했다. 모든 값은 공식 지표를 백분율로 환산한 정확도이며, 차이는 절대 %p이다.

| 설정 (5개 benchmark 평균, %, ↑) | LookZoom |   가장 강한 비교 기준 |   차이 | 출처    |
| ------------------------------- | -------: | --------------------: | -----: | ------- |
| Qwen3-VL-2B, 98 tokens/view     |     60.1 | Ground-then-crop 51.0 | +9.1%p | Table 1 |
| Qwen3-VL-4B, 98 tokens/view     |     63.6 | Ground-then-crop 58.3 | +5.3%p | Table 1 |
| Qwen3-VL-8B, 98 tokens/view     |     67.4 |         GapSight 62.6 | +4.8%p | Table 1 |
| Qwen3-VL-4B, 196 tokens/view    |     76.0 | Ground-then-crop 72.0 | +4.0%p | Table 1 |
| Qwen3-VL-4B, 392 tokens/view    |     81.6 |          AttWarp 81.8 | -0.2%p | Table 1 |

작은 예산일수록 이득이 크고 392 tokens에서는 가장 강한 baseline과 사실상 비슷하다는 결과는 저자들의 정보 격차 가설과 일치한다. 원본 대비 예산 픽셀 비율 $\rho$가 18보다 큰 구간에서는 확대가 10.3–15.1%p 이득이지만, $\rho<1.6$에서는 문맥 손실 때문에 1.3–3.6%p 손해였다. 즉 이 논문의 주장은 “항상 확대”가 아니라 “정보 격차와 pointer 집중도에 맞춰 확대 여부·형태를 고른다”이다.

# Limitations / Discussion

- `<look>` 토큰은 backbone별로 학습해야 한다. training-free pointer의 층 보정 대신 자기 답변을 이용한 추가 학습을 요구한다.
- 이득은 98/196-token처럼 정보 격차가 큰 구간에 집중된다. 392 tokens에서는 strongest baseline보다 0.2%p 낮고, 784 tokens에서는 방법 간 차이가 작다.
- 실험은 text-rich 단일 이미지에 집중한다. 여러 근거 영역을 동시에 확대하거나 비디오 프레임을 선택하는 능력은 검증되지 않았다.
- 저해상도 view의 그럴듯한 distractor를 고르거나, adaptive window 경계에서 단어를 자르거나, dense table의 인접 행을 잘못 읽는 실패가 남는다.
- 공개 benchmark는 주로 500문항 subset을 사용한다. 부록에 4B full-set 반복이 있더라도 세 규모 전체의 full-set 결과와 다른 MLLM 계열 일반화는 추가 검증이 필요하다.
- GapSight는 공개 코드가 없어 저자 재구현을 비교했다. 따라서 해당 baseline과의 차이는 공식 구현 비교로 볼 수 없다.

# 내가 이해한 핵심

가장 중요한 발견은 “MLLM이 어디를 볼지 모른다”가 아니라 “그 지식이 필요한 시점과 읽을 수 있는 시점이 어긋난다”는 것이다. 답 토큰은 이미 중간층에서 근거를 찾지만, 확대는 답 전에 결정해야 한다. LookZoom은 미래의 올바른 답이 남기는 attention을 별도 토큰에 압축해 이 시간차를 메운다. 그리고 포인팅과 읽기를 같은 attention에 강요하지 않음으로써, localization을 날카롭게 만들수록 독해가 나빠지는 충돌을 피한다.

# 다음에 연결해서 읽을 논문

- [ViCrop: Scalable and Efficient Cropping for Visual Question Answering](https://arxiv.org/abs/2502.05707) — answer-start attention으로 crop을 고르는 training-free 기준선.
- [Through the Magnifying Glass: Adaptive Perception Magnification for Hallucination-Free VLM Decoding](https://arxiv.org/search/?query=Through+the+Magnifying+Glass+Adaptive+Perception+Magnification&searchtype=title) — answer-time attention을 foveated warp에 쓰는 선행 방법.
- [Visual CoT: Advancing Multi-Modal Language Models with a Comprehensive Dataset and Benchmark for Chain-of-Thought Reasoning](https://arxiv.org/abs/2403.16999) — V-CoT-Doc와 evidence box의 출발점.
- [Look Where It Counts: A Free, Label-Free Visual Evidence Signal for Fine-Grained Vision-Language Reasoning](/papers/vlm/look-where-it-counts-label-free-visual-evidence-for-fine-grained-vision-language-reasoning) — 시각 근거 신호를 라벨 없이 얻는 다른 관점.
