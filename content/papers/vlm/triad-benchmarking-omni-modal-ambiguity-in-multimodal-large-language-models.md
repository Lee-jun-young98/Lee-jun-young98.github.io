---
title: "TRIAD: Benchmarking Omni-Modal Ambiguity in Multimodal Large Language Models"
date: 2026-10-24
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
  - "omnimodal"
  - "multimodal-benchmark"
  - "audio-visual-reasoning"
venue: "NeurIPS 2026 Evaluations and Datasets Track"
authors: "Zhaolu Kang, Yidi Wang, Yile Li, Siqi Zeng, Yingjie He, Richeng Xuan, Zhichao Hu"
paper: "https://arxiv.org/abs/2610.30841"
code: "공개 저장소 URL 확인 필요"
project: "공식 프로젝트 페이지 확인 필요"
thumbnail: "/papers/assets/vlm/triad-benchmarking-omni-modal-ambiguity-in-multimodal-large-language-models/triad-evaluation-pipeline.svg"
---

# 한 줄 요약

TRIAD는 텍스트·이미지·오디오 **셋을 모두 보아야만 답이 하나로 정해지는** 327개 질의를 구성하고, 최신 옴니모달 모델이 높은 개별 질의 정확도와 달리 장면 그룹 전체에서는 일관된 해석을 유지하지 못함을 보여준다.

# 논문 정보

- 제목: TRIAD: Benchmarking Omni-Modal Ambiguity in Multimodal Large Language Models
- 저자: Zhaolu Kang, Yidi Wang, Yile Li, Siqi Zeng, Yingjie He, Richeng Xuan, Zhichao Hu
- 발표: NeurIPS 2026 Evaluations and Datasets Track; arXiv:2610.30841v1, 2026-10-22 제출
- 링크: [arXiv](https://arxiv.org/abs/2610.30841) · [HTML](https://arxiv.org/html/2610.30841) · [PDF](https://arxiv.org/pdf/2610.30841) · [NeurIPS 2026 공식 목록](https://neurips.cc/Downloads/2026)
- 코드/프로젝트: 카메라 레디 시 GitHub·Hugging Face 공개를 예고했지만, 현재 검증 가능한 공개 URL은 확인 필요
- 라이선스: 논문은 arXiv non-exclusive license. 데이터는 이미지별 원 라이선스를 유지하고 오디오·메타데이터는 CC BY 4.0으로 공개 예정
- 키워드: omni-modal MLLM, multimodal ambiguity, audio-visual reasoning, counterfactual consistency, benchmark

# 핵심 아이디어

일반적인 멀티모달 벤치마크는 각 입력이 이미 충분히 결정적이어서 모델이 가장 쉬운 한 모달리티만 보고도 맞힐 수 있다. TRIAD는 이를 막기 위해 다음 조건을 만족하는 항목만 남긴다.

1. 전체 텍스트 $\mathcal{T}$·이미지 $\mathcal{V}$·오디오 $\mathcal{A}$를 함께 주면 정답 후보가 정확히 하나다.
2. 세 가지 2-모달리티 조합에서는 정답 후보가 둘 이상 남는다.
3. 같은 상황에서 한 모달리티만 바꾼 sister query를 장면 그룹으로 묶어, 모델이 바뀐 근거에 따라 답을 실제로 갱신하는지 검사한다.
4. 개별 질의 정확도뿐 아니라 그룹의 모든 sister를 맞혀야 성공하는 group accuracy를 주 지표로 쓴다.

# VLM 관점에서 중요한 이유

- **멀티모달 융합을 입력 형식이 아니라 인과적 필요성으로 정의한다.** 이미지가 포함됐다는 사실이 아니라, 이미지를 빼면 답이 결정되지 않아야 진짜 시각 의존 문제다.
- **높은 VQA 정확도의 맹점을 드러낸다.** 최상위 모델은 개별 질의에서 90.4%지만 그룹 정확도는 71.2%로 내려가, 국소적인 option matching과 일관된 장면 해석이 다름을 보여준다.
- **오디오가 부가 정보로 밀리는 현상을 정량화한다.** 모델은 텍스트를 먼저 anchor로 삼고 이미지·오디오를 확인 신호처럼 쓰는 경향이 있어, 오디오가 바뀌어도 결론을 충분히 수정하지 않는다.
- **멀티모달 에이전트의 실제 실패와 닿아 있다.** 환경 신호 하나가 바뀌었을 때 계획을 고쳐야 하는 에이전트에도 sister-group 일관성과 counterfactual control이 중요하다.

# Method

## 1. Mutual-disambiguation criterion

모달리티 집합을 $\mathcal{M}=\{\mathcal{T},\mathcal{V},\mathcal{A}\}$, 일부 모달리티 $S$만 보았을 때 일관적인 답의 집합을 $\mathcal{Y}_S(x)$라 한다. 항목은 다음을 만족해야 한다.

$$
|\mathcal{Y}_{\mathcal{M}}(x)|=1,\qquad
\forall S\subset\mathcal{M},\ |S|=2:\ |\mathcal{Y}_S(x)|>1.
$$

즉 전체 triplet에서는 정답이 유일하고, text–image·text–audio·image–audio 어느 쌍만으로도 답이 확정되지 않는다. 5명의 annotator가 모든 부분집합을 체크해 decorative modality와 option-string leakage를 제거한다.

## 2. Taxonomy and scene groups

각 질의에는 텍스트·이미지·오디오별로 하나씩 총 18개 ambiguity leaf 가운데 라벨이 붙는다. 텍스트는 anaphoric/syntactic/logical/pragmatic/temporal/lexical, 이미지는 semiotic/grounding/spatial/kinematic/observational/contextual, 오디오는 referential/prosodic/indexical/phonetic/environmental/symbolic으로 나뉜다.

327개 질의는 86개 장면 그룹에 속한다. 한 그룹의 2·3·4·8개 sister query는 핵심 장면과 option 의미를 공유하되 한 모달리티의 단서만 바꾼다. 따라서 고정된 장면 prior로 같은 답을 반복하면 group accuracy에서 실패한다.

## 3. Diagnostic protocol

14개 모델을 Standard multiple choice, CoT multiple choice, option을 숨긴 Open-ended의 세 prompt로 평가한다. Full triplet 외에도 no-input, 단일 모달리티, leave-one-out 입력을 측정한다. 이 데이터에서는 두 모달리티만으로 답이 유일하지 않으므로, ablation 점수가 높은 것은 robustness가 아니라 shortcut·option prior의 신호로 해석한다.

# 핵심 그림

![TRIAD가 텍스트·이미지·오디오의 상호 모호성을 검사해 장면 그룹을 만들고, 14개 옴니모달 모델을 전체 입력과 부분 입력에서 질의 정확도·그룹 정확도로 진단하는 파이프라인](/papers/assets/vlm/triad-benchmarking-omni-modal-ambiguity-in-multimodal-large-language-models/triad-evaluation-pipeline.svg)

> 그림 1. 논문 Figure 1, Definition 1, Sections 3–5를 바탕으로 재구성한 TRIAD 구성·평가 파이프라인. 출처: [논문 HTML Figure 1 및 Method](https://arxiv.org/html/2610.30841#S3). 원본 그림은 재사용하지 않았으며, 논문 내용을 바탕으로 재구성했다.

모델 아키텍처를 새로 제안하는 논문이 아니므로, 구조 그림 대신 **benchmark가 어떤 입력을 만들고 어떤 실패를 측정하는지**를 한 번에 보여주는 전체 방법론 파이프라인을 골랐다. 입력은 text·image·audio와 question/options이고, 5인 검수는 full triplet에서 정답 1개·모든 2-modality view에서 후보 2개 이상이라는 조건을 확인한다. 통과 항목은 한 모달리티 단서만 바꾼 scene group으로 묶인다. 평가 때 모델은 Full/단일/leave-one-out 입력과 세 prompt를 거치고, 출력은 query accuracy와 모든 sister를 맞혀야 하는 group accuracy로 집계된다. 학습 단계는 없으며 TRIAD는 fine-tuning용 데이터가 아닌 held-out 진단셋이다.

# Experiments / Results

- 데이터: 327 queries, 86 scene groups, 영어 184개·중국어 143개, group size 2/3/4/8.
- 모델: proprietary 6개와 open-source 8개, 총 14개 native text–image–audio 모델.
- 설정: temperature 0, 질의당 1 sample. 모델·random은 327개 전체, human은 비용 통제를 위한 100개 stratified subset에서 측정했다.
- 지표: $\mathrm{Acc}_q$는 질의별 정확도, $\mathrm{Acc}_g$는 한 group의 모든 sister query를 맞힌 그룹 비율이다.
- 통계: scene group 단위 10,000회 bootstrap 95% CI와 Holm–Bonferroni 보정 paired test를 사용한다.

## 주요 실험 결과

| 설정 / 지표 (%, ↑)                   | Gemini 3.1 Pro |        비교 기준 |    차이 | 출처      |
| ------------------------------------ | -------------: | ---------------: | ------: | --------- |
| Standard, query accuracy             |           90.4 |       Human 95.1 |  -4.7%p | Table 1/7 |
| Standard, group accuracy             |           71.2 |       Human 91.6 | -20.4%p | Table 1/7 |
| Open-ended, query accuracy           |           18.4 |       Human 88.4 | -70.0%p | Table 1/7 |
| Open-ended, group accuracy           |            4.6 |       Human 79.2 | -74.6%p | Table 1/7 |
| Standard, Full group accuracy        |           71.2 |    No-Image 57.2 | +14.0%p | Table 1   |
| Standard, Full group accuracy        |           71.2 |    No-Audio 51.8 | +19.4%p | Table 1   |
| Standard, 1-ambiguous query accuracy |           95.4 | 3-ambiguous 87.8 |  +7.6%p | Table 2   |

Human과 모델의 평가 subset이 다르므로 수치를 paired comparison으로 읽으면 안 되지만, 같은 논문이 제시한 reference gap은 분명하다. 최상위 모델의 query accuracy는 human보다 4.7%p 낮은 반면 group accuracy 차이는 20.4%p로 커진다. 개별 sister를 맞히는 능력보다 **바뀐 단서에 따라 장면 해석을 일관되게 갱신하는 능력**이 더 부족하다.

option을 제거하면 최상위 모델은 query accuracy가 90.4%에서 18.4%로 72.0%p, group accuracy가 71.2%에서 4.6%로 66.6%p 떨어진다. 반면 human open-ended reference는 각각 88.4%, 79.2%다. 따라서 multiple choice의 후보 집합이 모델에게 상당한 추론 scaffold를 제공한다.

또한 Table 5에서 모델 14개의 평균 query accuracy는 group size 2에서 8로 갈 때 70.5%→68.0%(-2.5%p)에 그치지만 group accuracy는 51.8%→8.9%(-42.9%p)로 붕괴한다. 이는 큰 그룹의 개별 항목이 단순히 더 어렵기보다 동일한 counterfactual rule을 sister 전체에 유지하지 못한다는 증거다.

# Limitations / Discussion

- 327개 규모의 진단셋이며 fully three-way ambiguous 항목은 38개뿐이라 세부 strata 일반화에 제한이 있다.
- 언어는 영어와 중국어, 오디오는 주로 제한된 voice actor와 permissive source에 집중돼 문화·억양·소음 다양성이 실제 환경보다 좁다.
- well-posedness 판정은 5인 검수에 의존하고, open-ended score는 두 judge model의 평균이므로 인간 판단과 자동 채점의 편향이 남는다.
- human 수치는 100개 stratified subset, model 수치는 327개 전체에서 계산돼 같은 행의 단순한 paired 우열로 해석해서는 안 된다.
- proprietary API version drift, 일부 open-source stack의 16 kHz downsampling, 5초 이상 clip truncation은 재현성 위협이다.
- 저자가 명시하듯 training set으로 쓰기에는 너무 작고 진단 목적의 구성 편향이 있다. leaderboard 최적화가 실제 자연스러운 모호성 처리 능력으로 곧장 이어진다고 볼 수 없다.

# 내가 이해한 핵심

TRIAD의 가장 중요한 메시지는 “세 모달리티를 입력했다”와 “세 모달리티가 결론을 바꿀 수 있다”가 전혀 다르다는 것이다. 현재 모델은 텍스트로 초기 가설을 만들고 시각·오디오를 사후 정당화에 쓰기 쉬우며, 그래서 한 단서가 바뀌어도 답을 안정적으로 뒤집지 못한다. VLM 평가에서는 평균 정확도뿐 아니라 **모달리티 제거 시의 민감도, sister 간 flip, 그룹 일관성**을 함께 봐야 실제 cross-modal binding을 측정할 수 있다.

# 다음에 연결해서 읽을 논문

- [CODIS: Benchmarking Context-Dependent Visual Comprehension for Multimodal Large Language Models](https://aclanthology.org/2024.acl-long.573/): text–image ambiguity에서 TRIAD의 tri-modal 설정으로 이어지는 선행 벤치마크.
- [MUCAR: Benchmarking Multilingual Cross-Modal Ambiguity Resolution for Multimodal Large Language Models](https://aclanthology.org/2025.emnlp-main.760/): multilingual ambiguity와 그룹 기반 진단의 연결.
- [OmniBench: Towards the Future of Universal Omni-Language Models](https://proceedings.neurips.cc/paper_files/paper/2025/hash/2c7c4a12a9dcf7dace9896d08154c705-Abstract-Datasets_and_Benchmarks_Track.html): 더 넓은 옴니모달 능력 평가와 TRIAD의 좁고 인과적인 진단을 비교할 수 있다.
- [AVHBench: A Cross-Modal Hallucination Benchmark for Audio-Visual Large Language Models](https://arxiv.org/abs/2410.18325): 오디오–비디오 불일치와 hallucination 관점의 보완 읽기.
