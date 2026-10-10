---
title: "Syn-Omni: Structured Specialization and Progressive Collaboration for Omnimodal Embeddings"
date: 2026-10-10
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "Findings of EMNLP 2026 (공식 ACL Anthology 확인 필요)"
authors: "Youngtaek Oh, Qiyu Wu, Hiromi Wakaki, Junmo Kim, Yuki Mitsufuji"
paper: "https://arxiv.org/abs/2610.12256"
code: "https://github.com/sony/syn-omni"
project: ""
thumbnail: "/papers/assets/vlm/syn-omni-structured-specialization-and-progressive-collaboration-for-omnimodal-embeddings/syn-omni-architecture.svg"
---

# 한 줄 요약

Syn-Omni는 frozen Omni-MLLM에 공유 LoRA와 모달리티별 expert LoRA를 병렬로 두고, hard routing에서 soft routing으로 점진 전환해 모달리티 고유성은 보존하면서 이미지·비디오·오디오·오디오비주얼 표현을 하나의 검색 공간에서 협업시킨다.

# 논문 정보

- 제목: Syn-Omni: Structured Specialization and Progressive Collaboration for Omnimodal Embeddings
- 저자: Youngtaek Oh, Qiyu Wu, Hiromi Wakaki, Junmo Kim, Yuki Mitsufuji (KAIST, Sony Group Corporation)
- 발표: Findings of EMNLP 2026 (Long, Findings) — [arXiv 메타데이터](https://arxiv.org/abs/2610.12256)와 [Sony 공식 연구 목록](https://github.com/sony/creativeai)이 채택을 표기한다. 2026-10-10 기준 ACL Anthology 논문 항목은 검색되지 않아 최종 권·페이지 정보는 확인 필요다.
- 링크: [arXiv:2610.12256](https://arxiv.org/abs/2610.12256), [HTML 논문](https://arxiv.org/html/2610.12256)
- 코드/프로젝트: [Sony GitHub 저장소](https://github.com/sony/syn-omni)
- 키워드: omnimodal embedding, multimodal retrieval, OME-LoRA, mixture of experts, progressive routing, contrastive learning

# 핵심 아이디어

기존 옴니모달 임베더는 여러 모달리티의 데이터를 하나의 LoRA에 섞어 학습한다. 공통 의미 공간을 만들기에는 단순하지만, 텍스트·이미지·비디오·오디오가 요구하는 서로 다른 단서를 같은 저랭크 부분공간에 밀어 넣어 모달리티 특화 표현이 약해질 수 있다. 반대로 모달리티별 모델을 완전히 분리하면 고유성은 남지만 오디오와 비디오처럼 서로 보완적인 신호를 공유하지 못한다.

Syn-Omni는 이 양극단을 두 단계로 절충한다.

1. **Orthogonal Modality-Expert LoRA(OME-LoRA)**는 모든 입력에 켜지는 shared LoRA와 텍스트·이미지·비디오·오디오별 expert LoRA를 병렬로 배치한다. shared 경로와 expert의 입력 부분공간이 겹치지 않도록 직교 페널티를 적용해 중복을 줄인다.
2. **Progressive Synergy Routing(PSR)**은 학습 초반에는 입력에 실제로 존재하는 모달리티 expert만 hard routing으로 활성화하고, 이후 cosine schedule로 학습된 soft routing을 섞는다. expert가 먼저 자기 모달리티의 prior를 익힌 뒤 다른 모달리티 expert의 정보를 받아들이게 하는 curriculum이다.

soft router에는 binary cross-entropy 대신 **Synergy Margin Loss(SML)**를 쓴다. 현재 입력의 모달리티 expert 점수가 부재 모달리티보다 margin만큼 높도록 만들되, 부재 expert를 무조건 0으로 누르지는 않는다. 그래서 오디오 입력에 비디오 expert가 보완적으로 기여하는 식의 교차 모달 협업 여지를 남긴다.

# VLM 관점에서 중요한 이유

VLM의 멀티모달 확장은 보통 encoder나 projector를 어떻게 붙일지에 집중하지만, 이 논문은 **적응 파라미터 자체를 어떤 의미 단위로 분리할지**를 묻는다. 동일한 Omni-MLLM 안에서도 보편 의미를 담당하는 경로와 시각·시간·음향 특성을 담당하는 경로를 구조적으로 나누면, 하나의 임베딩 공간을 유지하면서도 모달리티별 성능을 균형 있게 끌어올릴 수 있다는 주장이다.

특히 audiovisual Hit@1이 동일 데이터·백본의 공유 LoRA 기준선보다 3.0%p 상승한다. 단일 이미지나 텍스트에 비해 두 신호의 결합이 중요한 환경에서, 단순한 mixed-modality 학습보다 “먼저 전문화하고 나중에 협업”하는 순서가 중요하다는 증거다. 이 설계는 검색 임베더뿐 아니라 VQA, 멀티모달 agent memory, 장기 비디오 표현에서 modality adapter를 조직하는 방식에도 연결된다.

# Method

## 1. 입력과 공통 임베딩

기본 모달리티 집합은 텍스트 $T$, 이미지 $I$, 비디오 $V$, 오디오 $A$다. 각 입력은 Qwen2.5-Omni의 모달리티 encoder와 frozen LLM backbone을 통과하고, 마지막 layer의 last-token pooling으로 임베딩 $\mathbf{e}(x_m)$을 만든다. 학습 데이터는 단일 모달리티뿐 아니라 text-image, text-video, audio-video 같은 조합을 포함한 112만 pair이며, matched pair를 InfoNCE로 가깝게 만든다.

## 2. OME-LoRA

각 backbone layer에서 hidden state $\mathbf{h}$는 다음처럼 갱신된다.

$$
\mathbf{y}=W_0\mathbf{h}+\Delta W_{shr}(\mathbf{h})+\sum_{m\in\{T,I,V,A\}}w_m\Delta W_m(\mathbf{h}).
$$

$W_0$는 frozen backbone, $\Delta W_{shr}$는 공통 의미를 담는 shared LoRA, $\Delta W_m$은 모달리티별 expert다. 3B 설정에서 shared rank는 8, expert는 각각 rank 4여서 전체 유효 rank는 24다. 직교 손실은 LoRA의 입력 projection $A$만 대상으로 shared와 각 expert의 cosine similarity 제곱을 줄이며, shared 쪽에는 stop-gradient를 걸어 공통 축이 expert에 끌려가지 않게 한다.

## 3. PSR과 SML

router는 hidden state의 pooled representation에서 네 expert의 soft weight $\mathbf{v}^{R}$를 예측한다. 실제 입력 모달리티 indicator $\mathbf{v}^{mod}$와 soft weight를 학습 진행률에 따라 섞는다.

$$
w_m^{(t)}=(1-\alpha_t)v_m^{mod}+\alpha_t v_m^R.
$$

처음 10%는 $\alpha_t=0$인 warmup, 다음 50%는 cosine blending, 나머지는 $\alpha_t=1$인 synergy 구간이다. SML은 present expert가 absent expert보다 margin $\gamma=0.2$ 이상 높도록 할 뿐 absent expert를 0으로 고정하지 않는다. 최종 손실은 contrastive loss, orthogonal penalty, SML의 가중합이다.

# 핵심 그림

![텍스트·이미지·비디오·오디오 입력이 frozen Qwen2.5-Omni와 공유 및 모달리티별 LoRA 경로를 지나고, 점진적 라우팅으로 하나의 임베딩을 만드는 Syn-Omni 구조 재구성도](/papers/assets/vlm/syn-omni-structured-specialization-and-progressive-collaboration-for-omnimodal-embeddings/syn-omni-architecture.svg)

_논문 Figure 2와 Section 3을 바탕으로 재구성._ 이 논문의 기여는 최종 점수보다 shared/expert 경로의 분리와 hard-to-soft routing의 학습 순서에 있으므로 전체 아키텍처 그림을 선택했다. 출처: [논문 Figure 2 및 Section 3](https://arxiv.org/html/2610.12256#S3). 원문은 CC BY 4.0이지만, 학습 단계와 손실의 연결을 한국어로 명확히 설명하기 위해 직접 재구성했다.

그림의 흐름은 **입력 → 모달리티 encoder와 frozen backbone → shared LoRA 및 네 expert LoRA → 가중합 → 공통 embedding**이다. shared 경로는 모든 입력의 공통 의미를 맡고, expert 경로는 각 모달리티의 고유 단서를 맡는다. 학습 초반에는 입력에 존재하는 expert만 선택하지만, 후반에는 router가 부재 모달리티 expert도 작은 가중치로 활용한다. 직교 손실은 shared와 expert의 역할 중복을 줄이고, SML은 관련 expert 간 협업이 완전히 꺼지는 것을 막는다. 추론에서는 shared LoRA는 backbone에 merge할 수 있지만 입력별 expert와 router는 동적으로 남는다.

# Experiments / Results

- 평가 범위는 image 36개, video 23개, audio 12개, audiovisual 10개로 총 81개 task다. classification, retrieval, QA, visual grounding을 포함하며 통합 지표는 task별 Hit@1의 macro average다.
- 3B와 7B 모두 Qwen2.5-Omni backbone을 고정하고 112만 sample로 1 epoch 학습한다. Uni-Omni는 같은 데이터와 최적화 설정에서 rank-16 shared LoRA만 사용하는 통제 기준선이다.
- 3B Syn-Omni는 전체 49.4%로 Uni-Omni 47.7%보다 1.7%p 높다. 향상은 image +1.3%p, video +0.1%p, audio +2.5%p, audiovisual +3.0%p로, 복합 모달리티에서 가장 크다.
- 7B는 전체 51.6%로 Uni-Omni 50.7%보다 0.9%p 높다. image 71.7%, video 41.4%, audio 48.7%, audiovisual 44.6%다.
- 단순히 shared LoRA rank를 16에서 36으로 늘리면 3B 전체 점수가 47.7%에서 48.2%로 0.5%p 오르는 데 그친다. shared+expert 구조는 rank 24에서 48.7%, PSR까지 더하면 49.4%다. 증가한 용량만으로 성능 향상을 설명하기 어렵다는 통제다.

## 주요 실험 결과

아래는 논문 Table 1의 동일 backbone·학습 데이터·평가 suite 비교다. `차이`는 Syn-Omni에서 Uni-Omni를 뺀 절대 Hit@1 차이(%p)다. 모달리티별 task 수가 다르므로 `전체`는 각 task 점수의 평균으로 읽어야 하며, 한 모달리티의 표본 수 가중 평균으로 해석하면 안 된다.

| 모델 규모 / 평가군 (task 수, Hit@1 %, ↑) | Uni-Omni | Syn-Omni |   차이 | 출처    |
| ---------------------------------------- | -------: | -------: | -----: | ------- |
| 3B / Image (36)                          |     66.8 |     68.1 | +1.3%p | Table 1 |
| 3B / Video (23)                          |     40.4 |     40.5 | +0.1%p | Table 1 |
| 3B / Audio (12)                          |     43.1 |     45.6 | +2.5%p | Table 1 |
| 3B / Audiovisual (10)                    |     40.4 |     43.4 | +3.0%p | Table 1 |
| 3B / 전체 (81)                           |     47.7 |     49.4 | +1.7%p | Table 1 |
| 7B / 전체 (81)                           |     50.7 |     51.6 | +0.9%p | Table 1 |

핵심은 video 단독 이득이 0.1%p로 작지만 audiovisual은 3.0%p 오른다는 점이다. expert의 분리가 모든 모달리티를 동일하게 올리는 만능 장치라기보다, 서로 다른 신호가 함께 들어오는 상황에서 협업 경로를 더 잘 조직하는 장치라는 해석이 맞다. 수치·단위·task 수는 [논문 Table 1](https://arxiv.org/html/2610.12256#S4)에서 직접 대조했다.

구조 ablation도 같은 결론을 지지한다. Table 3에서 trainable parameter가 같은 44.9M일 때 rank-24 shared-only는 47.6%, shared+expert OME-LoRA는 48.7%로 +1.1%p다. PSR을 포함한 최종 모델은 router를 포함해 48.3M parameter로 49.4%에 도달한다. Table 4에서는 progressive routing+SML이 hard routing 48.6%보다 +0.8%p 높다.

# Limitations / Discussion

- 동적 expert routing은 standard LoRA처럼 전부 backbone에 merge할 수 없다. VALOR-32k audiovisual, batch 1, RTX A6000 설정에서 3B latency는 300.3ms에서 354.6ms로 18.1%, 7B는 377.1ms에서 443.5ms로 17.6% 증가한다. peak GPU memory 증가는 1% 미만이지만 실시간 query encoding에는 부담이다.
- 전체 평균은 81개 task의 서로 다른 데이터 분포를 macro-average한 값이다. 특히 video 향상은 3B에서 +0.1%p에 불과하므로 모든 모달리티에 큰 일관된 이득이 있다고 일반화하기 어렵다.
- 학습은 Qwen2.5-Omni 3B/7B 한 backbone 계열과 112만 sample mixture에 집중된다. 다른 Omni-MLLM이나 encoder 구조에서도 shared/expert 직교성이 같은 효과를 내는지는 검증되지 않았다.
- video는 8 frame uniform sampling, audio는 16kHz라는 고정 전처리를 쓴다. 장기 비디오의 세밀한 시간 사건이나 고해상도 음향 구조를 얼마나 보존하는지는 별도 평가가 필요하다.
- router가 부재 모달리티 expert를 활용한다는 분석은 routing weight와 representation cosine similarity 중심이다. 그 expert가 실제로 어떤 의미 지식을 전달했는지에 대한 causal intervention은 제한적이다.
- 저자가 명시하듯 대규모 학습 데이터의 편향이 교차 모달 검색에 전파될 수 있고, 통합 임베딩은 감시나 신원 연결에 오용될 가능성이 있다.

# 내가 이해한 핵심

이 논문의 가장 중요한 설계는 expert를 만든 것 자체보다 **expert가 고유성을 확보하기 전에 섞지 않는 것**이다. 처음부터 soft routing을 쓰면 여러 expert가 비슷한 방향으로 수렴해 분리의 의미가 약해진다. 반대로 끝까지 hard routing만 쓰면 다른 모달리티의 유용한 단서를 빌리지 못한다. warmup → blending → synergy라는 시간축이 구조적 분리와 협업을 동시에 가능하게 한다.

직교 손실도 같은 철학을 따른다. shared path를 고정된 기준으로 삼고 expert의 입력 부분공간만 밀어내므로, 공통 의미 축을 보존하면서 특화 방향을 확보한다. 결과적으로 Syn-Omni는 “하나의 모델인가, 여러 모델인가”라는 선택을 “공통 축 + 전문 축 + 학습 단계별 교류”로 바꾼다. 다만 성능 이득의 상당 부분이 audio와 audiovisual에 집중되고 latency가 약 18% 늘기 때문에, 실제 시스템에서는 retrieval 품질과 인코딩 비용을 함께 평가해야 한다.

# 다음에 연결해서 읽을 논문

- [Omni-Embed-Mini: Binding Modalities Without Forgetting via Dense Distillation](https://arxiv.org/abs/2610.02148): frozen text geometry를 anchor로 쓰는 방식과 Syn-Omni의 shared/expert 적응 방식을 비교할 수 있다.
- [VLM2Vec-V2: Advancing Multimodal Embedding for Videos, Images, and Visual Documents](https://arxiv.org/abs/2507.04590): Syn-Omni가 확장한 image·video 평가 및 contrastive embedding 계보를 이해하는 기준선이다.
- [LIMoE: Learning Multiple Modalities with One Sparse Mixture-of-Experts Model](https://arxiv.org/abs/2206.02770): 모달리티별 expert specialization과 load balancing 문제의 선행 연구다.
- [ImageBind: One Embedding Space To Bind Them All](https://arxiv.org/abs/2305.05665): 이미지 중심 anchor로 여섯 모달리티를 묶는 방식과 Omni-MLLM 기반 적응을 대조할 수 있다.
