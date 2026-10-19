---
title: "Stuck on Shuffle: On Attribute-Object Binding in Vision-Language Models"
date: 2026-10-19
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Netanel Y. Tamir, Michael Green, Issar Tzachor, Or Shimshi, Dvir Samuel, Or Patashnik, Rami Ben-Ari"
paper: "https://arxiv.org/abs/2610.22602"
code: ""
project: "https://stuck-on-shuffle.github.io/"
thumbnail: "/papers/assets/vlm/stuck-on-shuffle-attribute-object-binding-in-vision-language-models/saber-text-only-binding-pipeline.svg"
---

# 한 줄 요약

Stuck on Shuffle은 속성과 객체의 목록은 같고 연결만 바꾼 SABER로 VLM 임베딩의 결합 실패를 드러내고, 이미지 한 장 없이 합성 텍스트 hard negative만 학습해 Qwen3-VL-Embedding-8B의 4-way 평균 정확도를 52.5%에서 84.2%로 +31.7%p 높인다.

# 논문 정보

- 제목: Stuck on Shuffle: On Attribute-Object Binding in Vision-Language Models
- 저자: Netanel Y. Tamir, Michael Green, Issar Tzachor, Or Shimshi, Dvir Samuel, Or Patashnik, Rami Ben-Ari (OriginAI, NVIDIA, Tel Aviv University)
- 발표: arXiv:2610.22602v1, 2026-10-15 제출. 공식 학회 채택 정보는 확인되지 않아 venue는 **확인 필요**로 두었다.
- 링크: [arXiv](https://arxiv.org/abs/2610.22602), [HTML 논문](https://arxiv.org/html/2610.22602), [PDF](https://arxiv.org/pdf/2610.22602), [프로젝트 페이지](https://stuck-on-shuffle.github.io/)
- 코드/프로젝트: 프로젝트 페이지는 논문에 명시되어 있다. 이번 확인 시 공식 코드 저장소 URL은 독립적으로 확인하지 못했다.
- 라이선스: CC BY-NC-SA 4.0
- 키워드: vision-language embedding, attribute-object binding, compositionality, multimodal retrieval, text-only finetuning, SABER

# 핵심 아이디어

많은 VLM 임베더는 “금색 대포, 타이다이 잠수함, 빛나는 기린”과 같은 장면에서 객체와 속성이 각각 존재한다는 사실은 포착하지만, **어느 속성이 어느 객체에 붙는지**를 하나의 전역 임베딩에 정확히 보존하지 못한다. 단어 집합이 같은 오답이 들어오면 bag-of-words 유사도만으로는 구분하기 어렵다.

논문은 이 문제를 두 단계로 다룬다.

1. **SABER 평가**: 232개 일상 객체와 50개 시각 속성으로 2~10개 결합을 만들고, 같은 객체·속성 집합에서 연결만 재배치한 4-way hard negative를 구성한다. 텍스트→텍스트, 텍스트→이미지, 이미지→텍스트, 이미지→이미지 네 방향을 모두 평가한다.
2. **텍스트 전용 결합 학습**: Gemma 4 31B-IT가 만든 10만 개 예제에서 positive와 속성/객체 permutation negative를 만들고, Qwen3-VL-Embedding의 공유 backbone을 triplet loss로 LoRA 미세조정한다. 시각 입력은 학습에 쓰지 않지만 공유 파라미터 갱신이 이미지 표현에도 전이된다. 마지막에 LiNeS로 층별 update를 줄여 일반 임베딩 능력의 망각을 완화한다.

# VLM 관점에서 중요한 이유

이 연구는 VLM 성능을 “무엇이 있는가”와 “무엇이 무엇에 연결되는가”로 분리한다. 전자는 개념 검출에 가깝고, 후자는 조합적 구조를 임베딩 하나에 보존하는 문제다. 동일한 명사·형용사를 가진 positive와 negative를 비교하므로 어휘 overlap으로 맞히는 shortcut이 거의 없다.

더 중요한 결과는 **텍스트에서 배운 구조가 이미지 쪽으로 이동했다**는 점이다. 8B 모델은 텍스트만 학습했는데도 SABER의 텍스트→이미지에서 +34.1%p, 이미지→텍스트에서 +37.8%p, 이미지→이미지에서 +9.4%p를 얻는다. modality-specific dual encoder보다 입력부 뒤의 파라미터를 공유하는 MLLM 기반 embedder가 구조적 supervision을 모달리티 사이에 전달할 수 있다는 실증이다.

동시에 LiNeS ablation은 결합 정확도만 극대화하면 일반 retrieval 능력을 잃을 수 있음을 보여준다. 결합 능력과 범용성은 같은 축이 아니며, VLM post-training에서는 특정 구성 능력을 강화하면서 원래 representation geometry를 얼마나 보존하는지도 함께 봐야 한다.

# Method

## 1. SABER: 결합만 바꾸는 통제 평가

각 query는 2~10개의 attribute-object pair를 포함한다. 네 candidate 중 하나만 query의 연결을 유지하고, 나머지는 속성이나 객체를 permutation한다. 세 개 이상의 객체에서는 네 candidate의 binding assignment가 모두 달라야 한다. 2-object 설정은 가능한 일대일 permutation이 둘뿐이므로 한 negative에서 객체 또는 속성 하나를 새 항목으로 대체한다.

텍스트는 짧은 conjunction template로 만들고, 대응 이미지는 GPT-Image-2로 1024×1024 CLEVR-style 장면에 생성한다. 속성이 다른 객체로 번지지 않도록 prompt를 제약하고, 위치 shortcut을 줄이기 위해 0.5 확률로 수평 반전한다. 저자들은 모든 이미지를 수동 검수했다.

객체 수별로 200개 MCQ를 두어 총 1,800 query, 7,200 candidate, 9,000 image-caption pair를 만든다. 절반은 2개에서 10개 객체로 확장되는 nested chain이다. 평가는 네 후보 중 정답을 고르는 accuracy와 전체 7,200개 gallery에서 찾는 mAP 두 가지다.

## 2. 텍스트-only hard-negative 데이터

Gemma 4 31B-IT가 10만 개 구조화 예제를 생성한다. 각 예제는 짧은 query, 문맥화한 positive, 속성 permutation negative, 객체 permutation negative를 가지므로 논문 본문 표현으로는 20만 개 triplet이 된다. positive와 negative는 같은 단어를 사용하고 binding만 다르다.

데이터는 단순 pair swap뿐 아니라 3-object cycle/swap, 한 객체에 두 속성을 묶는 bundle, 서술어로 속성을 떨어뜨리는 predicative, 대명사·`respectively`로 뒤늦게 결합을 정하는 deferred 유형까지 7개 construction을 포함한다. 장면, 문체, 길이, binding distance, distractor, 어휘 빈도를 통제해 국소 bigram 암기를 줄인다.

## 3. 공유 임베더 학습과 LiNeS

텍스트 query $t_q$, positive $t_+$, binding-conflicting negative $t_-$에 대해 cosine similarity $D$와 margin $\gamma$를 쓰는 triplet loss를 최소화한다.

$$
\mathcal{L}_{\text{text}}=
\left[D(f_\theta(t_q),f_\theta(t_-))-D(f_\theta(t_q),f_\theta(t_+))+\gamma\right]_+.
$$

Qwen3-VL-Embedding-2B/8B에 LoRA로 이 loss를 적용한다. 이미지 encoder와 텍스트 encoder가 완전히 분리된 CLIP과 달리 MLLM 기반 임베더는 대부분의 backbone을 공유하므로, text-side update가 image representation에도 영향을 준다는 가설이다. 마지막의 LiNeS는 층별 파라미터 update를 rescale해 pretrained capability의 망각을 줄인다.

# 핵심 그림

![SABER가 동일 객체와 속성의 결합만 섞어 네 모달리티 방향을 평가하고, 합성 텍스트 hard negative로 공유 Qwen3-VL 임베더를 학습한 뒤 LiNeS를 적용하는 전체 파이프라인](/papers/assets/vlm/stuck-on-shuffle-attribute-object-binding-in-vision-language-models/saber-text-only-binding-pipeline.svg)

_논문 Figure 1과 Sections 3–4를 바탕으로 재구성._ 출처: [Figure 1과 전체 개요](https://arxiv.org/html/2610.22602#S1.F1), [SABER](https://arxiv.org/html/2610.22602#S3), [text-only finetuning](https://arxiv.org/html/2610.22602#S4). 원문은 CC BY-NC-SA 4.0이며, 평가와 학습의 대응 관계를 한국어로 한 화면에 설명하기 위해 원본을 복사하지 않고 직접 재구성했다. 핵심 기여가 개별 정성 예시보다 **통제 benchmark와 text-only transfer가 연결되는 구조**에 있으므로 전체 방법론 그림을 골랐다.

그림의 위쪽은 평가 흐름이다. 동일한 객체·속성 집합에서 연결만 유지하거나 섞어 4-way candidate를 만들고, 각 query/candidate를 이미지와 텍스트로 모두 표현해 T→T, T→I, I→T, I→I를 측정한다. 아래쪽은 학습 흐름이다. 합성 text query와 positive/negative를 공유 Qwen3-VL embedder에 넣어 triplet margin을 학습하고, LoRA update에 LiNeS를 적용한다. 추론 때는 추가 reranker나 binding module 없이 같은 단일 임베딩과 cosine similarity를 쓴다는 점이 기존 architecture를 바꾸는 방법과 다르다.

# Experiments / Results

- SABER 4-way MCQ에서 finetuned 8B는 평균 84.2%로 base 52.5%보다 +31.7%p 높다. T→T +45.6%p, T→I +34.1%p, I→T +37.8%p, I→I +9.4%p다.
- 7,200-candidate independent retrieval 평균 mAP도 71.9%에서 91.1%로 +19.2%p 오른다. nested retrieval은 38.3%에서 54.1%로 +15.8%p 향상되지만, 더 큰 장면이 query를 포함하는지 판단하는 containment는 여전히 어렵다.
- 기존 9개 attribute-binding benchmark의 12개 설정에서도 8B가 base보다 평균 +15.4점 높고 모든 설정에서 평가 baseline 중 최고다. 대표적으로 ColorSwap T→I는 45.9%→79.8%(+33.9%p), CLEVR I→T는 60.6%→86.2%(+25.6%p)다.
- 범용 MMEB-v3 182개 task 평균은 54.7→55.2(+0.5점)로 유지된다. 다만 Image -1.2, Video -0.9, Text -0.6인 대신 VisDoc +1.1, Agent +3.2이므로 모든 영역이 보존된 것은 아니다.
- LiNeS를 빼면 SABER 평균은 93.5%로 최종 84.2%보다 +9.3%p 높지만, MMEB-v3는 55.2에서 47.8로 -7.4점 내려간다. 최종 모델은 결합 성능 일부를 양보해 범용성을 복구한 절충점이다.

## 주요 실험 결과

아래 표는 논문 Table 2에서 **동일한 Qwen3-VL-Embedding-8B backbone**의 학습 전후를 비교한다. MCQ는 accuracy(%), retrieval은 mAP(%)이며 모두 2~10개 객체 평균이다. `차이`는 finetuned model에서 base를 뺀 절대 차이(%p)다.

| 평가 설정 (단위, ↑)                      | Qwen3-VL-Embedding-8B |  Ours-8B |        차이 |
| ---------------------------------------- | --------------------: | -------: | ----------: |
| SABER MCQ T→T accuracy (%)               |                  53.7 | **99.3** | **+45.6%p** |
| SABER MCQ T→I accuracy (%)               |                  34.9 | **69.0** | **+34.1%p** |
| SABER MCQ I→T accuracy (%)               |                  36.3 | **74.1** | **+37.8%p** |
| SABER MCQ I→I accuracy (%)               |                  84.9 | **94.3** |  **+9.4%p** |
| SABER MCQ 4방향 평균 accuracy (%)        |                  52.5 | **84.2** | **+31.7%p** |
| Independent retrieval 4방향 평균 mAP (%) |                  71.9 | **91.1** | **+19.2%p** |
| Nested retrieval 4방향 평균 mAP (%)      |                  38.3 | **54.1** | **+15.8%p** |

이미지 supervision 없이 cross-modal 방향에서 +34.1~37.8%p가 난 것이 가장 강한 결과다. 반면 image→image base가 이미 84.9%라 상승폭은 +9.4%p로 작다. 네 방향 평균 +31.7%p를 이미지 성능 자체의 동일 폭 향상으로 해석하면 안 된다. 수치와 조건은 [Table 2와 Section 5.1](https://arxiv.org/html/2610.22602#S5.SS1)에서 직접 대조했다.

범용성 trade-off는 논문 Table 4와 Table 12를 함께 봐야 한다.

| 8B 설정                     | SABER MCQ 평균 accuracy (%, ↑) | MMEB-v3 전체 점수 (↑) | 해석                                  |
| --------------------------- | -----------------------------: | --------------------: | ------------------------------------- |
| Pretrained base             |                           52.5 |                  54.7 | 결합 약함, 범용성 기준점              |
| Text-only FT, LiNeS 없음    |                       **93.5** |                  47.8 | 결합 최대, 범용성 -6.9점              |
| Text-only FT + LiNeS (최종) |                           84.2 |              **55.2** | base 대비 결합 +31.7%p, 범용성 +0.5점 |

LiNeS 없는 SABER 평균 93.5%는 Table 12의 네 방향(100.0, 87.3, 87.8, 99.0)을 평균한 값이다. 이 비교는 [Table 4](https://arxiv.org/html/2610.22602#S5.T4)와 [Table 12](https://arxiv.org/html/2610.22602#A3.SS2.T12)에서 확인했다.

# Limitations / Discussion

- venue는 확인 필요다. arXiv metadata와 본문에서 CVPR/ICCV/ECCV/NeurIPS/ICML/ICLR/ACL 계열 채택 정보를 확인하지 못했다.
- SABER 이미지는 GPT-Image-2가 만든 합성 CLEVR-style 장면이다. 수동 검수를 했어도 layout, 크기, 방향, 질감 같은 의도하지 않은 차이가 남아 실제 사진의 결합 난도를 완전히 대표하지 못한다.
- 학습 데이터도 Gemma 4가 생성한다. 어휘·거리·문체를 통제했지만 생성 모델 특유의 문장 구조가 supervision의 shortcut이 될 수 있다. mixed-length ablation에서 SABER format과 가까워지자 점수가 더 오른 현상도 이를 경고한다.
- 범용 성능은 평균상 유지되지만 Image, Video, Text task는 소폭 하락한다. 182개 task 평균 +0.5만으로 개별 domain의 망각이 없다고 말할 수 없다.
- nested retrieval의 54.1% mAP는 exact binding 외에 superset containment가 아직 큰 병목임을 보여준다. 결합이 좋아져도 부분 장면과 더 큰 장면의 포함 관계를 안정적으로 표현하지는 못한다.
- 이 방법은 MLLM 기반 embedder의 공유 파라미터에 의존한다. CLIP처럼 modality encoder가 분리된 architecture에서 같은 text-only 전이가 성립한다는 근거는 없다.
- 공식 코드 저장소를 이번 실행에서 확인하지 못했다. 데이터 생성·수동 검수·LiNeS 설정을 재현하려면 공개 artifact 상태를 다시 확인해야 한다.

# 내가 이해한 핵심

핵심은 “합성 데이터를 많이 쓰면 좋아진다”가 아니라 **정답과 오답의 단어를 똑같이 두고 관계만 바꾸면, representation이 관계를 무시할 여지를 줄일 수 있다**는 것이다. 일반 image-text contrastive data에서는 negative가 다른 객체나 다른 문장을 포함해 개념 존재만 구분해도 loss가 내려간다. 이 논문은 그 쉬운 경로를 닫는다.

text-only transfer는 공유 MLLM backbone의 장점을 선명하게 보여준다. 시각 tokenizer가 내놓은 token과 텍스트 token이 같은 후반 network를 통과한다면, 후반 층에서 “속성을 올바른 객체에 묶어 pooled embedding에 남기는 법”을 텍스트로 가르쳐도 이미지 표현이 달라질 수 있다. Appendix의 attention 분석에서 base의 binding margin이 후반부에 무너지고 finetuning 후 18~26층에서 더 유지되는 결과가 이 해석과 맞는다.

다만 최종 점수는 능력 하나를 추가한 순수한 이득이 아니다. LiNeS가 없으면 SABER는 더 좋고 MMEB-v3는 크게 나빠진다. 따라서 실용적인 교훈은 **관계 중심 hard negative + 공유 backbone + update 보존 규제**의 조합이며, 특정 compositional benchmark만 최적화하는 것은 충분하지 않다.

# 다음에 연결해서 읽을 논문

- [Winoground: Probing Vision and Language Models for Visio-Linguistic Compositionality](https://arxiv.org/abs/2204.03162): 같은 단어로 다른 구성을 만드는 대표적 초기 진단이다.
- [When and Why Vision-Language Models Behave like Bags-of-Words, and What to Do About It? (ARO)](https://arxiv.org/abs/2210.01936): 객체·속성·관계와 word-order 민감도를 체계화한 직접 선행 연구다.
- [SugarCrepe: Fixing Hackable Benchmarks for Vision-Language Compositionality](https://arxiv.org/abs/2306.14610): text-negative artifact를 줄인 compositionality 평가와 SABER의 차이를 볼 수 있다.
- [Dense and Aligned Captions Promote Compositional Reasoning in VL Models](https://arxiv.org/abs/2305.19595): 더 정밀한 image-text supervision으로 compositionality를 높이는 대안이다.
- [LiNeS: Post-training Layer Scaling Prevents Forgetting and Enhances Model Merging](https://arxiv.org/abs/2410.17146): 이 논문이 결합 능력과 범용 embedding 성능 사이를 조정하는 핵심 보존 기법이다.
