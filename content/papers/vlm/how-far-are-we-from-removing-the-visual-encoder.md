---
title: "How Far Are We from Removing the Visual Encoder? Scaling Laws for Encoder-Free Multimodal Pretraining"
date: 2026-09-29
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Lin Chen, Bolin Ni, Qi Yang, Lan Jiang, Kun Ding, Xiaoran Fan, Hower Yang, Ying Wang, Shiming Xiang"
paper: "https://arxiv.org/abs/2609.35457"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/how-far-are-we-from-removing-the-visual-encoder/encoder-free-scaling-overview.svg"
---

# 한 줄 요약

시각 인코더를 없앤 MLLM은 현재 측정 규모에서는 뒤처지지만 멀티모달 손실이 더 빠르게 개선되며, 약 $10^{22}$ FLOPs에서 encoder-based 모델의 학습 효율을 따라잡을 수 있다는 스케일링 법칙을 제시한다.

# 논문 정보

- 제목: How Far Are We from Removing the Visual Encoder? Scaling Laws for Encoder-Free Multimodal Pretraining
- 저자: Lin Chen, Bolin Ni, Qi Yang, Lan Jiang, Kun Ding, Xiaoran Fan, Hower Yang, Ying Wang, Shiming Xiang
- 발표: 확인 필요 (arXiv v1, 2026-09-28)
- 링크: [arXiv:2609.35457](https://arxiv.org/abs/2609.35457)
- 코드/프로젝트: 공식 공개 링크 확인 필요
- 키워드: encoder-free MLLM, multimodal pretraining, scaling law, mixture-of-experts, native visual representation

# 핵심 아이디어

일반적인 MLLM은 사전학습된 ViT가 만든 시각 표현을 LLM에 넣는다. 반면 encoder-free 모델은 원시 이미지 patch를 선형 투영해 decoder에 바로 넣으므로 구조는 단순하지만, decoder가 언어 모델링과 시각 표현 학습을 동시에 떠맡는다. 이 논문은 두 계열을 같은 데이터, 최적화, 시각 token 수, sparse MoE decoder ladder에서 비교해 다음을 보인다.

1. 텍스트 목적에서는 두 계열의 compute-optimal 배분과 loss–compute 곡선이 거의 같다.
2. 멀티모달 목적에서는 encoder-free 모델이 더 큰 decoder를 선호한다. 모델 배분 지수 $a$가 encoder-based의 0.464에서 0.570으로 증가한다.
3. 측정 구간에서는 encoder-free의 멀티모달 손실이 더 높지만, compute에 따른 감소 속도가 더 빨라 fitted law의 교차점은 $6.1\times10^{21}$ FLOPs로 추정된다.
4. encoder가 사라지면 decoder의 얕은 layer가 visual token을 더 일찍 다시 쓰고, visual token끼리의 양방향 attention과 일부 MoE expert의 시각 특화가 강화된다.

# VLM 관점에서 중요한 이유

이 연구는 “visual encoder가 꼭 필요한가?”를 작은 모델 한두 개의 정확도 비교가 아니라 **동일 조건의 스케일링 법칙**으로 바꾼다. 지금 규모의 benchmark만 보면 encoder-free가 불리하지만, 그 차이가 고정된 구조적 한계인지 scale로 상쇄되는 초기 학습 비용인지 구분한다는 점이 핵심이다.

또한 encoder-free를 단순한 부품 제거로 보지 않는다. decoder가 patch contextualization, 초기 visual feature 형성, expert specialization을 새로 담당한다는 내부 증거를 제시한다. 앞으로 native multimodal decoder를 설계할 때 언어용 causal Transformer를 그대로 확대하기보다, 시각 token의 양방향 상호작용과 초반 layer 용량을 의도적으로 설계해야 한다는 방향을 준다.

# Method

1. 총 parameter 1.1B–44B, active non-embedding parameter 71M–2.4B인 11개 sparse MoE decoder ladder를 구성한다.
2. encoder-based 모델은 고정 크기의 SigLIP 2 ViT, ConvPool adapter, projector를 사용한다. encoder-free 모델은 raw patch projection만 사용하고 같은 이미지 안의 visual token에 양방향 attention을 허용한다.
3. 두 계열에 같은 데이터 혼합, optimizer, visual-token granularity를 적용하고 여러 model/token 배분의 IsoFLOP profile을 학습한다.
4. 텍스트와 멀티모달 목적을 분리해 $M_{opt}(C)\propto C^a$, $D_{opt}(C)\propto C^b$ 및 $\mathcal{L}^*(C)=E+KC^{-\gamma}$를 fitting한다.
5. 같은 loss에 필요한 training compute와 FLOPs/token의 비율을 계산해 encoder-free의 compute·model efficiency를 비교한다.
6. visual token attention mask, layer별 표현 변화, MoE routing을 분석해 decoder가 visual encoder 기능을 어떻게 흡수하는지 조사한다.
7. 별도 fine-tuning 없이 11개 perception·document·general VQA benchmark에서 동일한 3-shot protocol로 pretrained checkpoint를 평가한다.

# 핵심 그림

![시각 인코더 유무에 따른 입력 경로와 멀티모달 손실 스케일링 교차점을 재구성한 설명도](/papers/assets/vlm/how-far-are-we-from-removing-the-visual-encoder/encoder-free-scaling-overview.svg)

_논문 Figure 1·2·4를 바탕으로 재구성._ 왼쪽은 encoder-based와 encoder-free의 시각 입력 경로를, 오른쪽은 측정 구간에서는 encoder-free 손실이 높지만 fitted curve가 약 $6.1\times10^{21}$ FLOPs에서 교차한다는 핵심 주장을 함께 보여 준다. 개별 benchmark 막대보다 구조 선택과 스케일링 결론의 관계가 논문의 기여를 더 직접적으로 설명하므로 이 구성을 골랐다. 수치와 구조의 출처: [논문 Figure 1, 2, 4 및 §3.1–3.2](https://arxiv.org/html/2609.35457).

# Experiments / Results

- 텍스트 목적의 model allocation exponent는 encoder-free 0.427, encoder-based 0.422로 거의 같았다. 멀티모달 목적에서는 각각 0.570과 0.464로 벌어져 encoder-free가 더 큰 decoder에 compute를 배분한다.
- compute-optimal 멀티모달 crossover의 점 추정치는 $6.1\times10^{21}$ FLOPs이고 conditional bootstrap 80% 구간은 $[4.2\times10^{21}, 1.0\times10^{22}]$다. 이는 실측 교차가 아니라 fitted law를 측정 범위 밖으로 외삽한 결과다.
- 같은 멀티모달 loss에서 encoder-free의 model efficiency gain은 약 0.80이다. 즉 같은 손실을 내려면 약 1.25배의 decoder FLOPs/token을 선택한다.
- visual token을 causal attention으로 제한하면 멀티모달 목적에서 평균적으로 약 1% 불리했고, compute가 커질수록 양방향 attention의 이점이 커졌다.
- 약 100B training token의 최대 33B-A2.2B checkpoint에서 encoder-free의 11개 benchmark 평균은 51.2, encoder-based는 57.7이었다. 현재 평가 규모에서는 아직 6.5점 뒤진다.

## 주요 실험 결과

논문 Table 6의 가장 큰 33B-A2.2B checkpoint를 발췌했다. 두 모델은 약 100B token, 같은 3-shot prompt와 이미지 전처리를 사용한다. 지표 방향은 모두 높을수록 좋으며, 차이는 `encoder-free − encoder-based` 점수다.

| 벤치마크 / 지표 (↑)        | Encoder-free | Encoder-based | 차이 (점) | 출처    |
| -------------------------- | -----------: | ------------: | --------: | ------- |
| CV-Bench / 정확도          |         53.8 |          56.2 |      -2.4 | Table 6 |
| DocVQA / ANLS              |         57.0 |          68.9 |     -11.9 | Table 6 |
| AI2D / 정확도              |         53.5 |          57.3 |      -3.8 | Table 6 |
| MMBench-EN / 정확도        |         57.6 |          69.1 |     -11.5 | Table 6 |
| ScienceQA-IMG / 정확도     |         62.9 |          66.1 |      -3.2 | Table 6 |
| 11개 benchmark 비가중 평균 |         51.2 |          57.7 |      -6.5 | Table 6 |

가장 큰 모델에서도 encoder-free가 대부분의 downstream 지표에서 뒤지며, 특히 문서 이해와 범용 멀티모달 평가의 격차가 크다. 따라서 loss scaling의 교차 예측을 곧바로 현재 downstream 우위로 해석하면 안 된다. 원자료: [논문 Table 6](https://arxiv.org/html/2609.35457#S12.SS3).

# Limitations / Discussion

- 핵심 crossover는 실측값이 아니라 측정 범위 밖 외삽이다. 저자도 fitted law가 유지되고, visual encoder 크기는 고정되며, irreducible loss는 데이터 분포만으로 결정된다고 가정한다.
- encoder-based 쪽 visual encoder는 decoder 규모와 무관하게 같은 크기를 쓴다. 더 큰 encoder를 함께 scaling하는 설계에는 같은 결론이 성립하지 않을 수 있다.
- 주 분석은 validation loss 기반이다. 11개 downstream benchmark가 같은 방향을 보이지만 최대 측정 모델에서도 encoder-free 평균 성능은 낮다.
- sparse MoE decoder, 특정 데이터 혼합, SigLIP 2 기반 encoder 비교에 집중하므로 dense 모델이나 다른 vision backbone으로의 일반화는 추가 검증이 필요하다.
- perception-intensive topic은 crossover가 더 늦다. 전체 멀티모달 평균의 교차점이 OCR, 세밀한 grounding, 고해상도 문서 이해의 격차가 동시에 사라짐을 뜻하지 않는다.
- 공식 venue, 코드, checkpoint 공개 링크는 arXiv 페이지에서 확인되지 않았다.

# 내가 이해한 핵심

visual encoder의 장점은 영구적인 표현력 우위라기보다, 학습 초기에 이미 유용한 시각 prior를 공급해 decoder가 visual token을 무시하는 구간을 건너뛰게 해 주는 효과에 가깝다. encoder-free 모델은 이 초기 비용을 직접 치르지만 scale이 커질수록 decoder 내부에 시각 전용 계산 경로를 만든다.

그래서 “encoder를 제거해도 된다”보다 더 정확한 결론은 “제거하려면 decoder를 더 크게 배분하고, visual token contextualization과 초기 layer 설계를 다시 해야 한다”다. 실무적으로는 학습 compute, inference budget, perception-heavy task 비중을 함께 보고 구조를 선택해야 한다.

# 다음에 연결해서 읽을 논문

- [Mono-InternVL: Pushing the Boundaries of Monolithic Multimodal Large Language Models with Endogenous Visual Pre-training](https://arxiv.org/abs/2410.08202): visual encoder와 LLM을 단일 Transformer로 합치는 monolithic 계열의 대표 설계다.
- [TUNA-2: Pixel Embeddings Beat Vision Encoders for Unified Understanding and Generation](https://arxiv.org/abs/2604.24763): pixel embedding 기반 encoder-free 통합 모델의 실제 확장 사례와 이번 스케일링 예측을 비교할 수 있다.
- [Chinchilla: Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556): IsoFLOP profile과 compute-optimal 배분 법칙의 기반이 되는 연구다.
