---
title: "Visual Tokens on Demand: Visual Budgeting for Scalable and Efficient Multi-Image Reasoning in Multimodal LLMs"
date: 2026-10-15
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Aimon Rahman, Joymallya Chakraborty, Vidit Bansal, Abhishek Dan"
paper: "https://arxiv.org/abs/2610.18858"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/visual-tokens-on-demand-multi-image-reasoning/mmvb-architecture.svg"
---

# 한 줄 요약

mmVB는 질문과 여러 이미지의 관계를 작은 사전 예측기로 읽어 이미지별 최소 해상도를 정한 뒤 frozen MLLM에 전달함으로써, 평균 정확도의 94.4%를 유지하면서 visual token 9.2배, prefill FLOPs 7.3배, TTFT 약 5배를 절감한다.

# 논문 정보

- 제목: Visual Tokens on Demand: Visual Budgeting for Scalable and Efficient Multi-Image Reasoning in Multimodal LLMs
- 저자: Aimon Rahman, Joymallya Chakraborty, Vidit Bansal, Abhishek Dan (Amazon)
- 발표: arXiv:2610.18858v1, 2026-10-13 제출. CVPR·ICCV·ECCV·NeurIPS·ICML·ICLR·ACL 계열의 공식 채택 정보는 확인되지 않아 venue는 **확인 필요**로 둔다.
- 링크: [arXiv](https://arxiv.org/abs/2610.18858), [HTML 논문](https://arxiv.org/html/2610.18858)
- 코드/프로젝트: 확인된 공식 공개 링크 없음
- 키워드: multi-image reasoning, visual token budgeting, MLLM efficiency, query-conditioned resolution, pre-encoding compression

# 핵심 아이디어

기존 visual token pruning·merging은 대개 full-resolution ViT를 이미 통과한 뒤 token을 줄인다. 따라서 vision encoder 계산은 절감하지 못하고, attention map을 읽는 방식은 FlashAttention이나 API-only 모델과 충돌한다. 여러 이미지를 같은 비율로 줄이는 방법도 비교·계수·차이 찾기처럼 어느 이미지의 미세 정보가 필요한지 질문에 따라 달라지는 과제에는 취약하다.

mmVB(multi-modal Visual Budgeter)는 압축을 **visual encoding 이전의 해상도 배분 문제**로 바꾼다. 각 이미지의 저비용 thumbnail feature와 질문 embedding을 $N+1$개 token으로 만들고, 작은 Transformer가 전체 이미지 집합을 함께 보며 이미지마다 5단계 해상도 중 하나를 예측한다. 예측된 해상도로 원본 이미지를 resize한 뒤 기존 MLLM을 한 번만 실행하므로 base model 재학습, 내부 attention 접근, 새 visual-language interface가 필요 없다.

학습 label은 full-resolution에서 정답인 샘플만 대상으로 만든다. 이미지별 낮은 해상도부터 정답이 유지되는 첫 level을 찾고, 모든 이미지를 함께 줄여도 정답인지 검증한 뒤 필요하면 level을 완화한다. 이 label은 전역 최소 token 조합을 보장하지 않지만 항상 실제 MLLM 정답으로 검증된 보수적 feasible allocation이다.

# VLM 관점에서 중요한 이유

다중 이미지 입력의 병목을 “어떤 token을 버릴까”가 아니라 “질문에 답하려면 각 이미지를 얼마나 자세히 봐야 하나”로 재정의한다. 이 관점은 image relevance와 required detail을 동시에 다루며, full ViT 이전에 비용을 줄일 수 있다는 점에서 post-encoding pruning과 본질적으로 다르다.

또한 Qwen3.5-4B에서 만든 해상도 결정이 Qwen3.5-27B, Claude Opus 4.6, Pixtral Large에도 별도 학습 없이 전달된다. 이는 predictor가 특정 backbone의 attention artifact만 복제하기보다 image-query 난이도를 어느 정도 포착한다는 증거다. 다만 ReMI와 MIRB처럼 수치 추론·visual chain reasoning이 강한 과제에서는 정확도 손실이 크고, 의료 영상처럼 작은 병변이 중요한 domain은 학습 분포 밖이다.

# Method

## 1. 이미지·질문을 싼 proxy token으로 변환

각 입력 이미지 $I_i$는 frozen ImageNet EfficientNet-B0으로 1,280차원 feature를 얻고 $d=256$으로 투영한다. 질문 $Q$는 대상 MLLM의 frozen input embedding을 평균 pooling한 뒤 $d_{\text{LLM}}\rightarrow64\rightarrow256$ bottleneck으로 보낸다. 고해상도 MLLM vision encoder 대신 작은 thumbnail encoder를 먼저 쓰므로 overhead는 약 2 ms다.

## 2. 질문 조건부 cross-image budget 예측

질문 token 하나와 $N$개 image token을 2-layer, 4-head Transformer에 넣는다. 각 image representation에 공유 MLP $256\rightarrow64\rightarrow4$를 적용해 누적 ordinal probability를 예측한다.

$$
P(\ell_i\ge k)=\sigma(z_{i,k}),\qquad
\hat\ell_i=\sum_{k=1}^{4}\mathbf{1}[\sigma(z_{i,k})>0.5]
$$

$\hat\ell_i\in\{0,1,2,3,4\}$는 이미지별 최소 visual-token level이다. 1.6M trainable parameter만 학습하고 EfficientNet-B0와 MLLM embedding은 고정한다. 고정된 전체 budget $B$가 있으면 각 level 승격의 효용 $\sigma(z_{i,k})$을 추가 token 비용으로 나눈 값이 큰 순서대로 배분하는 greedy knapsack 변형도 쓸 수 있다.

## 3. 검증된 ordinal label 생성과 frozen MLLM 추론

offline label 생성은 (1) 각 이미지를 독립적으로 level 0부터 올리는 ascending search, (2) 예측 조합의 joint verification, (3) 실패 시 single-image·uniform relaxation의 세 단계다. 반환된 조합은 base MLLM이 실제 정답을 내는지 항상 검사한다. 학습 후에는 mmVB가 정한 해상도로 각 이미지를 줄이고 frozen MLLM에 한 번 전달한다. post-encoding token surgery가 없으므로 positional encoding과 FlashAttention 경로도 그대로 유지한다.

# 핵심 그림

![여러 이미지와 질문을 작은 frozen encoder로 요약하고 cross-image Transformer가 이미지별 해상도 level을 정한 뒤 resize된 이미지들을 frozen MLLM에 전달하는 mmVB 아키텍처 재구성도](/papers/assets/vlm/visual-tokens-on-demand-multi-image-reasoning/mmvb-architecture.svg)

_논문 Figure 2, Algorithm 1, Sections 2.1–2.3을 바탕으로 재구성._ 원문은 CC BY 4.0이지만 학습과 추론의 차이를 한 화면에서 설명하기 위해 직접 SVG로 다시 그렸다. 출처: [Figure 2와 Architecture](https://arxiv.org/html/2610.18858#S2.SS1), [label 생성 Algorithm 1](https://arxiv.org/html/2610.18858#S2.SS3), [Appendix Architecture Details](https://arxiv.org/html/2610.18858#A1). 이 논문의 핵심 기여가 benchmark 하나의 결과보다 **pre-encoding budget prediction과 frozen MLLM 연결 방식**에 있으므로 구조 그림을 선택했다.

그림의 위쪽은 학습 흐름이다. full-resolution 정답 샘플에서 각 이미지의 해상도를 단계적으로 낮추고 joint verification해 conservative ordinal label을 만든 뒤, 1.6M-parameter budgeter만 ordinal BCE로 학습한다. 아래 추론 흐름에서는 질문과 저비용 image feature가 2-layer cross-image Transformer에서 상호작용하고, shared ordinal head가 각 이미지의 level을 낸다. 선택된 해상도로 resize한 이미지만 기존 vision encoder와 LLM을 통과한다. 기존 post-encoding pruning과 달리 full ViT 실행 전부터 token 수가 줄고, base MLLM의 weight·attention·positional structure는 바뀌지 않는다.

# Experiments / Results

- base MLLM은 Qwen3.5-4B이며 greedy decoding, thinking mode off로 평가한다. 학습은 VQAv2·TextVQA·GQA의 30k image에서 만든 484k single-image sample과 Mantis-Instruct의 50k multi-image sample을 curriculum으로 사용한다.
- 평가는 MuirBench, MIBench, Mantis-Eval, NLVR2, Visual Haystacks, MMIU, MIRB, ReMI의 8개 multi-image benchmark다. 이미지 수는 1–62개 범위지만 Visual Haystacks는 최대 10개로 제한한다.
- 비교군 VisionZip, ToFu, VisionTrim, ZooPrune은 모두 full ViT 뒤에 token을 줄인다. mmVB는 accuracy retention과 compression의 harmonic mean에서 8개 중 6개 최고이며 평균 HM은 0.90이다.
- 논문의 9.2배 token 감소와 7.3배 prefill FLOP 감소는 benchmark별 비율의 geometric mean이다. “94.4% 정확도 유지”도 각 benchmark의 `mmVB / Full Res.` 비율을 geometric mean한 값이라 단순 accuracy 평균점과 다르다.

## 주요 실험 결과

아래 표는 논문 Table 1의 동일한 Qwen3.5-4B, decoding, benchmark 설정에서 Full Resolution과 mmVB를 맞춰 옮겼다. `정확도 차이`는 `mmVB - Full Res.`의 절대 %p이며, token 절감은 sample당 visual token 기준이다.

| Benchmark | Full Res. 정확도 (%) | mmVB 정확도 (%) | 정확도 차이 | Full tokens/sample | mmVB tokens/sample | token 절감 | 출처    |
| --------- | -------------------: | --------------: | ----------: | -----------------: | -----------------: | ---------: | ------- |
| MuirBench |                 63.6 |            62.9 |      -0.7%p |              3,236 |                389 |       8.3× | Table 1 |
| MIBench   |                 78.1 |            77.9 |      -0.2%p |              1,237 |                248 |       5.0× | Table 1 |
| Mantis    |                 69.9 |            68.2 |      -1.7%p |              2,119 |                118 |      18.0× | Table 1 |
| NLVR2     |                 86.5 |            82.8 |      -3.7%p |              1,649 |                 89 |      18.5× | Table 1 |
| VHay      |                 69.5 |            69.6 |      +0.1%p |              2,187 |                594 |       3.7× | Table 1 |
| MMIU      |                 50.9 |            53.2 |      +2.3%p |              2,980 |                453 |       6.6× | Table 1 |
| MIRB      |                 67.2 |            56.5 |     -10.7%p |              1,756 |                193 |       9.1× | Table 1 |
| ReMI      |                 24.7 |            19.2 |      -5.5%p |              2,573 |                155 |      16.6× | Table 1 |

MuirBench·MIBench에서는 5–8배 token을 줄이면서 손실이 0.7%p 이하이고, Visual Haystacks와 MMIU는 오히려 +0.1%p, +2.3%p다. 반면 MIRB는 -10.7%p, ReMI는 -5.5%p이므로 “94.4% 유지”라는 aggregate만으로 모든 reasoning type이 보존된다고 볼 수 없다. 수치와 조건은 [논문 Table 1 및 Section 3](https://arxiv.org/html/2610.18858#S3)에서 직접 대조했다.

multi-image 학습의 효과는 Table 3에서 분리된다.

| Benchmark | Single-image 학습 SI (%) | Single+multi-image 학습 MI (%) | MI 효과 | MI tokens/sample | 출처    |
| --------- | -----------------------: | -----------------------------: | ------: | ---------------: | ------- |
| MuirBench |                     61.7 |                           62.9 |  +1.2%p |              389 | Table 3 |
| MIBench   |                     74.6 |                           77.9 |  +3.3%p |              248 | Table 3 |
| Mantis    |                     65.4 |                           68.2 |  +2.8%p |              118 | Table 3 |
| NLVR2     |                     79.2 |                           82.8 |  +3.6%p |               89 | Table 3 |
| VHay      |                     63.9 |                           69.6 |  +5.7%p |              594 | Table 3 |
| MMIU      |                     50.1 |                           53.2 |  +3.1%p |              453 | Table 3 |
| MIRB      |                     53.3 |                           56.5 |  +3.2%p |              193 | Table 3 |
| ReMI      |                     20.0 |                           19.2 |  -0.8%p |              155 | Table 3 |

Visual Haystacks의 +5.7%p와 NLVR2의 +3.6%p는 이미지별 독립 난이도 예측만으로는 부족하고 cross-image relevance를 학습해야 함을 보여준다. 반대로 ReMI는 MI가 -0.8%p여서 curriculum이 모든 reasoning domain에 보편적으로 이득인 것은 아니다. [논문 Table 3](https://arxiv.org/html/2610.18858#S3)에서 수치와 같은 평가 설정을 확인했다.

# Limitations / Discussion

- budgeter 학습 분포는 VQAv2·TextVQA·GQA와 Mantis-Instruct 중심이다. 의료 영상의 microcalcification처럼 질문만으로 필요 해상도를 추정하기 어려운 작은 신호에는 token을 과소 배분할 수 있다.
- label 생성은 full-resolution에서 맞힌 샘플만 사용하므로, base MLLM이 원래 틀리는 사례의 optimal budget은 학습하지 않는다. 또한 greedy relaxation은 둘 이상의 이미지를 동시에 올려야 하는 최소 조합을 놓칠 수 있어 label이 보수적으로 과다 배분될 수 있다.
- ordinal head의 네 sigmoid에는 명시적 monotonic constraint가 없다. 최종 합은 유효 level을 내지만 확률 자체가 순서를 위반할 가능성은 남는다.
- main 성능은 Qwen3.5-4B 한 base model에 집중된다. black-box transfer는 세 모델에서 확인했지만 accuracy retention은 89.8–92.9%로 main model의 94.4%보다 낮다.
- MIRB와 ReMI의 큰 accuracy 하락은 visual chain reasoning과 numerical reasoning에서 낮은 해상도가 치명적일 수 있음을 보인다. 평균 HM이 세부 failure mode를 가릴 수 있다.
- Visual Haystacks는 원래 10,000장 이상까지 가능하지만 실험은 최대 10장으로 제한한다. 제목의 “scalable”이 극단적 image-set scale까지 실증된 것은 아니다.
- 비교한 post-encoding baseline은 공개 설정의 특정 keep ratio를 쓴다. 각 benchmark에 맞춘 최적 tuning과의 완전한 Pareto-front 비교는 아니다.
- 공식 코드와 외부 재현 결과는 아직 확인되지 않았다.

# 내가 이해한 핵심

이 논문은 visual token compression을 representation surgery가 아니라 **센서의 읽기 해상도를 먼저 정하는 routing 문제**로 본다. 질문이 “두 제품의 라벨 문구 차이”라면 두 이미지를 자세히 보고, “빨간 자동차가 있는 사진은?”이라면 대부분을 thumbnail로 유지하는 식이다. 작은 cross-image Transformer가 먼저 정보 수요를 예측하고, 비싼 MLLM은 정해진 예산만 소비한다.

가장 좋은 점은 효율 경로가 base model과 느슨하게 결합된다는 것이다. MLLM 내부 attention map이나 hidden state가 필요 없고 입력 이미지 크기만 바꾸므로 closed API에도 적용할 수 있다. 동시에 이것이 가장 큰 약점이다. predictor가 중요 신호를 놓치면 MLLM은 이미 삭제된 해상도를 복구할 수 없고, 이를 감지하는 uncertainty fallback도 제시하지 않는다.

실무적으로는 고정 압축률 하나보다 질문·image-set별 adaptive budget이 낫다는 근거가 강하다. 다만 high-stakes document·medical·remote-sensing 시스템이라면 최소 level floor, predictor uncertainty에 따른 full-resolution fallback, domain-specific label distillation을 추가하고 MIRB/ReMI 유형의 세부 과제를 따로 검증해야 한다.

# 다음에 연결해서 읽을 논문

- [VisionZip: Longer is Better but Not Necessary in Vision Language Models](https://arxiv.org/abs/2412.04467): Table 1의 attention 기반 post-encoding pruning 비교군이다.
- [VisionTrim: Efficient Vision-Language Models via Visual Token Trimming](https://arxiv.org/abs/2505.17106): 높은 accuracy를 유지하지만 full ViT 이후 token을 고르는 방식과 mmVB의 계산 절감 차이를 비교할 수 있다.
- [Visual Haystacks: Answering Harder Questions About Sets of Images](https://arxiv.org/abs/2407.13766): mmVB가 relevance allocation을 보이는 needle-in-a-haystack 평가의 원 설계다.
- [Mantis: Interleaved Multi-Image Instruction Tuning](https://arxiv.org/abs/2405.01483): 50k multi-image budget-label 학습 data와 Mantis-Eval의 배경이다.
- [LLaVA-PruMerge](https://arxiv.org/abs/2403.15388): visual token pruning·merging 계열이 효율과 detail preservation을 어떻게 절충하는지 비교할 수 있다.
