---
title: "What Transfers from Text to Vision? Capability Scaling Laws and Transfer Dynamics for VLMs"
date: 2026-11-08
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "EMNLP 2026"
authors: "Qiang Wang, Ziran Li, Zhengyu Chen, Shanglin Lei, Borun Chen, Jingang Wang, Xunliang Cai"
paper: "https://aclanthology.org/2026.emnlp-main.2350/"
code: "https://github.com/wangq-dev/CDMScaling"
project: ""
thumbnail: "/papers/assets/vlm/what-transfers-from-text-to-vision-capability-scaling-laws/cdm-scaling-pipeline.svg"
---

# 한 줄 요약

LLM의 파라미터 수 대신 200여 개 텍스트 벤치마크에서 추출한 잠재 능력 점수와 멀티모달 학습량을 결합하면, 서로 다른 모델 계열을 가로질러 VLM 성능 궤적과 72B 규모의 미관측 backbone 성능까지 예측할 수 있다.

# 논문 정보

- 제목: What Transfers from Text to Vision? Capability Scaling Laws and Transfer Dynamics for VLMs
- 저자: Qiang Wang, Ziran Li, Zhengyu Chen, Shanglin Lei, Borun Chen, Jingang Wang, Xunliang Cai
- 발표: EMNLP 2026 Main Conference, pp. 53357–53383
- 링크: [ACL Anthology](https://aclanthology.org/2026.emnlp-main.2350/), [공식 PDF](https://aclanthology.org/2026.emnlp-main.2350.pdf), [DOI](https://doi.org/10.18653/2026.emnlp-main.2350)
- 코드/프로젝트: [CDMScaling 공식 저장소](https://github.com/wangq-dev/CDMScaling)
- 키워드: VLM scaling law, LLM backbone selection, multimodal transfer, capability score, PCA, data scaling

# 핵심 아이디어

기존 scaling law가 파라미터 수와 학습 token 수로 loss를 예측하는 것과 달리, 현대 LLM backbone은 같은 크기여도 사전학습 데이터와 recipe가 크게 달라 파라미터 수만으로 비교하기 어렵다. 저자들은 34개 LLM, 7개 모델 계열에서 200개가 넘는 텍스트 benchmark score를 모아 PCA로 저차원 능력 표현을 만들고, 그 표현을 다시 하나의 scalar capability score $S$로 투영한다.

그다음 $S$와 멀티모달 학습량 $D_{mm}$을 결합해 평균 멀티모달 정확도 $P$를 예측한다. 핵심은 backbone의 초기 전이 효율을 나타내는 transfer term과, 데이터를 더 넣었을 때 얼마나 빨리 흡수하는지를 나타내는 absorption term을 분리한 것이다. 강한 backbone일수록 항상 데이터 효율도 높은 것이 아니므로, $(B_0-B_mS)\ln D_{mm}$ 상호작용으로 능력과 데이터 scaling의 결합을 명시한다.

# VLM 관점에서 중요한 이유

VLM 개발에서 vision encoder나 projector만큼 중요한 결정은 어떤 LLM을 backbone으로 쓸지다. 이 논문은 “큰 LLM이 더 좋다”는 경험칙을 넘어, 이미 공개된 텍스트 평가 결과와 예정된 멀티모달 데이터 예산으로 성능을 사전에 추정하는 틀을 제공한다. 34개 backbone에서 150개가 넘는 VLM을 동일 recipe로 학습해 모델 계열, 크기, base/instruction 차이를 통제했다는 점도 드문 실증 자산이다.

또한 텍스트 능력이 멀티모달 성능으로 균일하게 옮겨가지 않는다는 결과가 중요하다. 일부 텍스트 benchmark는 VLM 성능과 음의 상관을 보이고, instruction-tuned backbone은 높은 초기 전이에도 불구하고 추가 멀티모달 데이터를 흡수하는 비율이 낮을 수 있다. 따라서 leaderboard 평균이나 파라미터 수 하나로 backbone을 고르는 방식의 위험을 정량화한다.

# Method

## 1. 텍스트 능력을 관측 가능한 잠재 점수로 압축

텍스트 benchmark–모델 행렬 $X\in\mathbb{R}^{T\times M}$을 평균 중심화한 뒤 PCA를 적용한다. 논문의 fitting 설정에서는 상위 3개 주성분이 분산의 95% 이상을 설명한다. 모델 $m$의 저차원 표현 $\mathbf{S}_m$을 단위 벡터 $w$로 투영해 scalar score를 만든다.

$$
S_m=w^\top\mathbf{S}_m,\qquad \lVert w\rVert=1
$$

이 값은 숨겨진 사전학습 token 수를 알아야 하는 compute proxy와 달리 공개 benchmark에서 직접 계산할 수 있고, 서로 다른 모델 계열의 능력 차이를 같은 축에서 비교한다.

## 2. 능력 기반 loss와 성능 scaling law

loss 쪽에서는 파라미터 수 $N$을 capability score $S$로 바꿔 다음 형태를 사용한다.

$$
L=Ae^{-\alpha S}+\frac{B}{D_{mm}^{\beta}}+E
$$

최종 성능 예측기는 transfer와 absorption을 분리한다.

$$
\hat P=A\hat S+(B_0-B_m\hat S)\ln D_{mm}+P_0
$$

$A\hat S$는 텍스트 능력이 멀티모달 성능으로 바로 전달되는 정도, $B_0-B_m\hat S$는 추가 멀티모달 데이터의 흡수율이다. $B_m\hat S$를 빼는 항은 강한 모델에서 관측된 diminishing absorption을 반영하며, Table 1의 72B 외삽 ablation이 이 항의 필요성을 확인한다.

## 3. 통제된 VLM sweep과 외삽 검증

저자들은 Qwen, Falcon, Llama, Gemma, DeepSeek, Mistral 등 7개 계열의 34개 LLM을 backbone으로 150개가 넘는 VLM checkpoint를 같은 recipe로 학습한다. 평가는 General VQA, STEM Puzzle, Document Understanding, Alignment 범주의 35개 멀티모달 benchmark 평균이며 모두 zero-shot이다. 학습 범위의 여러 크기와 계열에 fitting한 뒤, Qwen2.5-72B와 leave-one-family-out 설정을 holdout으로 두어 크기 및 계열 외삽을 검사한다.

# 핵심 그림

![텍스트 벤치마크 행렬에서 PCA 능력 점수를 추출하고 멀티모달 학습량과 결합해 VLM 성능 궤적과 backbone 선택을 예측하는 파이프라인](/papers/assets/vlm/what-transfers-from-text-to-vision-capability-scaling-laws/cdm-scaling-pipeline.svg)

_논문 Figure 1, Figure 4와 Eq. 4–7을 바탕으로 재구성._ 출처: [공식 PDF](https://aclanthology.org/2026.emnlp-main.2350.pdf), 특히 Figure 1(능력 기반 loss fitting), Figure 4(학습·holdout 성능 예측), Table 1(흡수율 항 ablation). 원본 그림을 복사하지 않고 논문의 입력–모듈–출력 관계를 직접 도식화했다. 이 연구의 중심은 개별 모델 architecture가 아니라 **성능 예측 파이프라인**이므로, 결과 plot 하나보다 능력 추출과 데이터 scaling이 만나는 전체 구조를 선택했다.

그림의 왼쪽 입력은 모델별 텍스트 benchmark score와 예정된 멀티모달 학습 token 수다. 가운데에서 PCA가 중복된 benchmark 축을 95% 이상 설명하는 저차원 표현으로 줄이고, 학습된 단위 투영으로 $S$를 만든다. transfer 항 $AS$는 backbone의 출발점을, absorption 항 $(B_0-B_mS)\ln D_{mm}$은 데이터 증가에 따른 기울기를 결정한다. 출력은 VLM의 전체 학습 궤적, 미관측 72B backbone 예측, 계열별 backbone·데이터 예산 선택이다. 실제 VLM 추론 구조를 바꾸는 방법이 아니라, 학습 전에 backbone과 예산을 고르는 meta-model이라는 점이 기존 architecture 논문과 다르다.

# Experiments / Results

- 전체 sweep은 34개 LLM backbone, 7개 모델 계열, 150개 이상의 VLM과 25,000 H800 GPU-days를 포함한다.
- 텍스트 입력은 200개가 넘는 benchmark, 멀티모달 목표는 35개 zero-shot benchmark의 평균 정확도다.
- Figure 1에서 capability-driven loss law는 Falcon3와 Llama-3.2를 하나의 모델로 맞추면서 MAE를 0.0383에서 0.0087로 낮춘다.
- 성능 law의 전체 fitting MAE는 1.287%이며, Figure 4의 holdout MAE는 1.225%다.
- 약 12.5B 멀티모달 token 조건의 Qwen2.5-72B 예측 절대 오차는 Base 1.92%, Instruct 0.70%로 보고된다(Figure 3).

## 주요 실험 결과

아래 표는 공식 PDF Table 1을 그대로 옮긴 것이다. 지표는 관측 정확도와 예측 정확도의 **MAE(%, 낮을수록 좋음)**이며, 같은 열 안에서 동일한 holdout 설정을 비교했다. `개선`은 기본식 대비 capability-modulated absorption 식의 MAE 감소폭으로, 성공률 차이가 아니라 예측오차의 절대 퍼센트포인트(%p)다.

| 예측식 | $\leq$8B in-distribution MAE ↓ | 72B-Base MAE ↓ | 72B-Instruct MAE ↓ | Base 개선 | Instruct 개선 | 출처 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| $B_0\ln D_{mm}$ | 1.266% | 2.374% | 0.476% | — | — | Table 1 |
| $(B_0-B_mS)\ln D_{mm}$ | **1.259%** | **2.055%** | **0.394%** | **0.319%p** | **0.082%p** | Table 1 |

학습 분포 안에서는 두 식의 차이가 0.007%p로 작지만, 능력 점수 $S>0.6$인 72B holdout에서는 상호작용 항이 Base 오차를 2.374%에서 2.055%로, Instruct 오차를 0.476%에서 0.394%로 줄인다. 즉 작은 모델에서 거의 같은 식이라도 대규모 backbone 외삽에서는 “강한 backbone일수록 추가 데이터의 흡수 기울기가 달라진다”는 항이 중요하다. 수치와 조건은 [공식 PDF Table 1](https://aclanthology.org/2026.emnlp-main.2350.pdf)에서 직접 대조했다.

추가로 Figure 4의 통합 시각화에서는 train MAE 1.287%, holdout MAE 1.225%를 보고한다. 서로 다른 계열의 checkpoint와 Qwen2.5-72B 두 variant가 같은 예측식과 95% 신뢰구간으로 설명된다는 점이 논문의 핵심 주장에 더 직접적인 근거다.

# Limitations / Discussion

- 35개 멀티모달 benchmark의 단순 평균은 과제별 난도와 중요도를 동일하게 취급한다. 실제 제품에서 OCR, VQA, hallucination 중 무엇이 중요한지에 따라 같은 backbone 순위가 유지된다는 보장은 없다.
- capability score는 관측된 텍스트 benchmark 집합과 PCA에 의존한다. benchmark contamination이나 특정 계열의 benchmark 최적화가 있으면 $S$ 자체가 편향될 수 있으며, 논문이 발견한 음의 transfer coefficient가 이 위험을 보여준다.
- 34개 backbone과 7개 계열은 큰 sweep이지만 architecture·tokenizer·vision encoder·training recipe의 전체 공간을 덮지는 않는다. 완전히 새로운 계열이나 다른 multimodal recipe에 그대로 적용하려면 소규모 calibration이 필요하다.
- 72B 검증은 Qwen2.5 Base/Instruct 두 점에 강하게 의존한다. “72B 규모 전반”으로 일반화하려면 다른 계열의 대형 holdout이 더 필요하다.
- scaling law는 상관 구조를 압축한 예측기이지 인과 모델이 아니다. 특정 텍스트 능력을 올리면 해당 VLM 능력이 같은 비율로 오른다고 해석하면 안 된다.
- 대규모 controlled sweep 자체가 25,000 H800 GPU-days를 사용했다. 일단 fitting된 law는 저렴하지만 새 recipe로 법칙을 다시 세우는 비용은 여전히 크다.

# 내가 이해한 핵심

VLM backbone 선택은 파라미터 수 하나가 아니라 두 질문의 결합이다. 첫째, 현재 LLM 능력 중 얼마나 많은 부분이 시각 과제로 바로 넘어오는가? 둘째, 멀티모달 데이터를 더 주었을 때 얼마나 빠르게 새 정보를 흡수하는가? 논문은 이를 각각 transfer와 absorption으로 분리한다. 그래서 instruction-tuned model이 처음에는 좋아 보여도 data scaling 후에는 base model이 역전할 수 있다.

가장 실용적인 결과는 정확한 단일 숫자보다 상대적 의사결정이다. 제한된 예산에서 여러 LLM 후보를 모두 VLM으로 끝까지 학습하는 대신, 공개 텍스트 score와 소수의 calibration run으로 성능 궤적을 예측하고 유망한 backbone만 확장할 수 있다. 특히 8B 이하에서 fit한 상호작용이 72B holdout 오차를 줄였다는 점은 early-stage sweep의 가치가 큰 모델 선택으로 이어질 수 있음을 보여준다.

다만 $S$는 “일반 지능 점수”가 아니다. 어떤 텍스트 benchmark는 오히려 multimodal transfer에 해로울 수 있고, 과제별 transfer coefficient도 다르다. 따라서 앞으로는 하나의 평균 정확도 law보다 document understanding, spatial reasoning, grounding처럼 제품 목적별 $S$와 absorption curve를 따로 학습하는 방향이 더 유용해 보인다.

# 다음에 연결해서 읽을 논문

- [Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361): 파라미터·데이터·compute 기반 고전 scaling law와 이 논문의 capability substitution을 비교할 기준이다.
- [Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556): Chinchilla식 data–model scaling과 멀티모달 absorption term의 차이를 이해하는 배경이다.
- [How Far Are We from Removing the Visual Encoder? Scaling Laws for Encoder-Free Multimodal Pretraining](/papers/vlm/how-far-are-we-from-removing-the-visual-encoder): 이 저장소의 관련 리뷰로, VLM 구성 요소와 데이터 규모를 직접 scaling하는 다른 관점을 제공한다.
- [Cambrian-1: A Fully Open, Vision-Centric Exploration of Multimodal LLMs](https://arxiv.org/abs/2406.16860): vision-centric benchmark와 controlled multimodal recipe 설계의 비교점이다.
