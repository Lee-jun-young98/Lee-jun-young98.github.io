---
title: "The Alignment Illusion in Multimodal Large Language Models"
date: 2026-09-27
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "NeurIPS 2026"
authors: "Hong-Han Wang, Yuntao Wang, Hu Ding"
paper: "https://arxiv.org/abs/2609.30210"
code: ""
project: ""
---

# 한 줄 요약

MLLM의 높은 시각-텍스트 정렬 점수는 실제 이미지 이해가 아니라 공유 MLP가 만든 기하학적 착시일 수 있으며, 상위 두 principal-angle cosine의 차이인 PA gap이 이를 더 잘 진단한다.

# 논문 정보

- 제목: The Alignment Illusion in Multimodal Large Language Models
- 저자: Hong-Han Wang, Yuntao Wang, Hu Ding
- 발표: NeurIPS 2026
- 링크: [arXiv:2609.30210](https://arxiv.org/abs/2609.30210)
- 코드/프로젝트: 확인 필요
- 키워드: multimodal large language model, cross-modal alignment, mechanistic interpretability, representation similarity, principal angle, visual corruption

# 핵심 아이디어

MLLM 내부에서 visual token과 text token의 표현 유사도가 layer 깊이에 따라 높아지는 현상은 흔히 두 modality가 의미 수준에서 통합된 증거로 해석된다. 하지만 두 token stream은 같은 Transformer block과 MLP weight를 통과하므로, 내용이 무관해도 같은 저차원 방향으로 끌려갈 수 있다.

논문은 projector 출력의 visual token을 같은 norm을 가진 Gaussian noise로 바꾸는 개입을 한다. 이미지 정보가 사라져 정확도는 크게 떨어지지만 CKA, SVCCA, MIR, leading principal-angle cosine 같은 표준 정렬 점수는 원본과 noise를 안정적으로 구분하지 못한다. 저자들은 이를 **alignment illusion**이라 부른다.

원인을 추적하면 shared LLM pathway, 특히 anisotropic한 MLP down-projection `W_out`의 지배적 출력 방향이 두 modality를 공통 방향으로 모은다. 이 효과가 거의 1차원이라는 관찰에서 상위 두 principal-angle cosine의 차이 `PA gap = σ₁ - σ₂`를 제안한다. gap이 크면 하나의 weight-induced 방향으로 붕괴한 상태이고, gap이 작으면 여러 방향의 시각 구조가 남아 있다고 해석한다.

# VLM 관점에서 중요한 이유

VLM 해석 연구에서 내부 정렬 곡선을 곧바로 “모델이 이미지를 사용한다”는 증거로 읽으면 잘못된 설계 결론으로 이어질 수 있다. 이 논문은 정렬 점수 자체보다 **그 점수를 만든 기하 구조와 인과적 개입 결과**를 함께 봐야 한다는 강한 sanity check를 제공한다.

또한 무관한 이미지도 projector에 잘 인코딩되고 답변 경로로 전파되어 text-only보다 성능을 더 낮춘다는 결과는, VLM이 시각 입력을 받는 것과 질문에 맞게 사용하는 것이 별개의 문제임을 보여 준다. 모델 비교나 학습 진단에서도 내부 similarity와 task accuracy를 동일한 종류의 증거로 취급해서는 안 된다.

# 핵심 그림

![시각 토큰을 훼손해도 정렬 점수는 높게 남을 수 있는 alignment illusion](https://arxiv.org/html/2609.30210v1/main.png)

_원문 Figure 1._ 내부 정렬 점수와 실제 시각 정보 사용은 다를 수 있다는 논문의 문제 설정이다. [그림 출처: 논문 원문](https://arxiv.org/html/2609.30210).

# Method

1. LLaVA-OV, LLaVA-OV-1.5, Qwen2-VL, Qwen2.5-VL, InternVL3 계열 13개 모델의 layer별 visual/text hidden state를 수집한다.
2. 각 modality 표현에 PCA를 적용해 상위 30개 basis를 얻고, 두 subspace 사이 principal-angle cosine spectrum과 CKA·SVCCA·MIR을 계산한다.
3. 원본 projector 출력(Orig)을 per-token norm이 같은 Gaussian noise(Noise)로 교체해 시각 내용만 제거하고, 정렬 점수와 MMBench 정확도를 비교한다.
4. attention 또는 MLP를 우회하고 `W_out`의 singular spectrum 및 principal-angle basis와의 overlap을 분석해 정렬 증가가 MLP down-projection에서 생김을 추적한다.
5. `PA gap = σ₁ - σ₂`를 정의하고, Orig와 Noise를 0.1 간격으로 섞는 graded corruption에서 정확도와의 상관을 측정한다.
6. 무관한 자연 이미지(Irr), visual-token 순서만 섞은 입력(Shuf), visual token을 제거한 입력(Text)을 추가해 시각 구조와 질문 관련성을 분리한다.
7. linear probe와 principal-angle subspace 안팎의 matched perturbation으로 무관한 이미지 정보가 실제 답변 경로를 통해 전달되는지 확인한다.

# Experiments / Results

- 0.5B~72B 규모의 5개 모델 계열, 총 13개 MLLM을 MMBench 1,000문항에서 평가했다.
- visual token을 noise로 교체하면 모든 모델의 정확도가 38~50%p 하락했지만, `σ₁`·CKA·SVCCA의 원본-vs-noise 분리 점수 중앙값은 음수였고 MIR은 거의 0이었다. 표준 scalar 정렬 지표가 시각 정보의 존재를 안정적으로 반영하지 못했다.
- MLP를 우회했을 때의 `σ₁` 변화는 attention을 우회했을 때보다 중앙값 기준 3.5배 컸다. 학습되지 않은 random weight에서는 같은 현상이 재현되지 않아, 학습된 MLP의 anisotropy가 핵심 원인임을 뒷받침한다.
- graded corruption에서 PA gap과 정확도의 절대 Pearson 상관은 평균 0.894, 중앙값 0.917, 최솟값 0.655였다. 13개 중 12개 모델에서 0.80을 넘었고 방향도 전 모델에서 일관됐다.
- Orig, Irr, Noise의 layer-mean PA gap 중앙값은 각각 0.130, 0.213, 0.324였으며, 13개 중 12개 모델에서 이 순서를 유지했다.
- 정확도는 Orig 85.4%, Irr 36.1%, Noise 39.0%로 기하학적 순서와 달랐다. 무관한 자연 이미지는 text-only보다 중앙값 5.0%p 낮아, 모델이 이를 무시하지 않고 오히려 방해받았다.
- projector token linear probe는 무관 이미지 category를 74.4~78.5% 정확도로 복원했다(우연 수준 5%). principal-angle subspace 내부 perturbation은 외부 perturbation보다 전 모델에서 1.1~5.5%p 더 큰 정확도 하락을 일으켰다.

## 주요 실험표

논문 Table 1 중 핵심 지표를 옮겼다. 13개 모델의 graded visual degradation에서 각 정렬 지표와 정확도의 절대 Pearson 상관계수다. 값이 클수록 정확도 변화를 더 잘 추적한다.

| 지표                           | 평균 \|r\| | 중앙값 \|r\| | \|r\| > 0.80인 모델 | 상관 방향 일치 |
| ------------------------------ | ---------: | -----------: | ------------------: | -------------: |
| 첫 principal-angle cosine (σ₁) |      0.730 |        0.765 |                5/13 |           4/13 |
| CKA                            |      0.752 |        0.765 |                6/13 |           4/13 |
| SVCCA                          |      0.736 |        0.788 |                6/13 |           3/13 |
| **PA gap (σ₁ − σ₂)**           |  **0.894** |    **0.917** |           **12/13** |      **13/13** |

표의 원자료와 측정 조건: [논문 Table 1](https://arxiv.org/html/2609.30210).

# Limitations / Discussion

- 분석 대상은 vision encoder와 LLM을 projector로 연결하는 구조다. cross-attention이나 다른 fusion architecture에서 같은 메커니즘이 유지되는지는 확인하지 않았다.
- 행동 평가는 MMBench의 객관식 1,000문항에 집중한다. 자유 생성, 복수 이미지, video-language, document understanding, multimodal agent로 일반화할지는 추가 검증이 필요하다.
- 개입 지점이 projector 출력이므로 vision encoder 내부에서 생기는 정렬·붕괴 현상은 다루지 않는다.
- PA gap도 질문 관련성을 직접 판별하는 지표는 아니다. 무관한 자연 이미지가 noise보다 더 좋은 기하 구조를 보이면서도 정확도는 더 낮을 수 있으므로, 반드시 controlled task evidence와 함께 사용해야 한다.
- arXiv 페이지에는 NeurIPS 2026 채택이 명시되어 있지만 공개 코드나 공식 프로젝트 페이지는 확인되지 않았다.

# 내가 이해한 핵심

핵심은 “두 표현이 비슷하다”와 “두 modality의 내용이 결합됐다” 사이에는 큰 논리적 간극이 있다는 것이다. 동일한 weight를 통과한 두 stream은 그 weight가 선호하는 방향으로 함께 눌릴 수 있고, scalar similarity는 이 구조적 공통성과 의미적 상호작용을 구분하지 못한다.

PA gap은 이 착시를 완화하는 유용한 도구지만, 정답 관련성을 보증하는 완성형 metric은 아니다. 실무적으로는 정렬 분석을 할 때 원본 입력만 비교하지 말고 noise, irrelevant image, text-only 같은 counterfactual을 포함하고, 내부 기하와 행동 성능을 별도의 축으로 보고해야 한다.

# 다음에 연결해서 읽을 논문

- [Towards Interpreting Visual Information Processing in Vision-Language Models](https://openreview.net/forum?id=x2i4E4K9Fn): layer별 시각 정보 처리와 내부 정렬 해석의 출발점을 제공한다.
- [Vision-Language Models Create Cross-Modal Task Representations](https://openreview.net/forum?id=fxxy5R7Hn9): cross-modal task representation이 형성된다는 주장과 이 논문의 controlled-intervention 비판을 비교할 수 있다.
- [Reliability of CKA as a Similarity Measure in Deep Learning](https://openreview.net/forum?id=8HRvyxc606): CKA 기반 표현 비교가 어떤 조건에서 오해를 낳을 수 있는지 더 일반적인 관점에서 다룬다.
