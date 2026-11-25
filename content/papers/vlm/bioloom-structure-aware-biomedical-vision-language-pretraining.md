---
title: "BioLoom: Scaling Biomedical Vision-Language Models by Learning from the Structure of Scientific Articles"
date: 2026-11-25
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Yuwei Yang, Xiaoxiao Sun, Alejandro Lozano, Yuan-Sen Ting, Yuhui Yuan, Liang Zheng, Serena Yeung-Levy"
paper: "https://arxiv.org/abs/2611.33151"
code: "https://github.com/yuweiyang-anu/BioLoom"
project: "https://bioloom-clip.github.io/"
thumbnail: "/papers/assets/vlm/bioloom-structure-aware-biomedical-vision-language-pretraining/bioloom-architecture.svg"
---

# 한 줄 요약

BioLoom은 과학 논문의 article–figure–panel 계층을 exact pair, semi-positive, masked pair, hard negative로 바꿔 contrastive VLM을 학습하고, 52.4M image-text pair에서 biomedical zero-shot 분류와 검색 성능을 함께 끌어올린다.

# 논문 정보

- 제목: BioLoom: Scaling Biomedical Vision-Language Models by Learning from the Structure of Scientific Articles
- 저자: Yuwei Yang, Xiaoxiao Sun, Alejandro Lozano, Yuan-Sen Ting, Yuhui Yuan, Liang Zheng, Serena Yeung-Levy
- 발표: arXiv:2611.33151v1, 2026-11-24 제출; 학회 게재 여부는 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2611.33151), [공식 PDF](https://arxiv.org/pdf/2611.33151), [공식 HTML](https://arxiv.org/html/2611.33151)
- 코드/프로젝트: [프로젝트 페이지](https://bioloom-clip.github.io/), [저자 공식 GitHub](https://github.com/yuweiyang-anu/BioLoom) (MIT), [모델](https://huggingface.co/ChartFoundation/BioLoom-models), [Loom52M](https://huggingface.co/datasets/ChartFoundation/Loom52M)
- 논문 라이선스: arXiv perpetual non-exclusive license
- 키워드: biomedical VLM, contrastive pretraining, scientific figures, hierarchical supervision, image-text retrieval

# 핵심 아이디어

기존 biomedical CLIP 계열은 논문의 figure와 caption을 독립적인 image-text pair로 평평하게 만든다. 하지만 한 figure 안의 microscopy panel과 sibling chart는 정확히 같은 내용을 묘사하지 않아도 같은 실험을 서로 보완하고, 같은 article의 다른 figure는 문맥을 공유하며, 다른 article의 같은 content type은 구별하기 어려운 negative다.

BioLoom은 이 구조를 네 종류의 관계로 보존한다. 같은 image의 text는 exact pair, 같은 figure의 다른 panel/whole-figure text는 semi-positive, 같은 article의 다른 figure는 main loss에서 제외할 masked pair, 다른 article이면서 content type이 같은 pair는 더 강한 hard negative다. 데이터 규모만 늘리는 대신 **어떤 pair를 얼마나 가깝게 또는 멀게 둘지**를 논문 구조에서 가져온다.

# VLM 관점에서 중요한 이유

이 연구는 image-text pretraining의 supervision 단위를 개별 pair에서 문서 구조로 확장한다. 특히 “related”를 무조건 positive나 negative로 만들지 않고 exact alignment, 약한 관계 정렬, masking을 분리한다. 복합 과학 그림처럼 부분 간 관계가 중요한 데이터에서는 pair 수보다 관계의 종류를 보존하는 것이 중요한 설계 변수가 된다는 증거다.

또한 BioLoom은 39.3M panel pair와 13.1M whole-figure pair를 함께 사용한다. local visual detail과 global experimental context를 한 dual-encoder가 학습하며, ablation에서 panel-only와 whole-only 모두 mixed view보다 낮다. document understanding과 scientific image retrieval에도 직접 연결되는 결과다.

# Method

## 1. Loom52M 구축

출발점은 BIOMEDICA의 article–figure record다. Gemini 3.5 Flash-Lite에 whole figure, 원 caption, figure를 언급하는 본문 문단 최대 2개를 입력해 panel bounding box와 두 종류의 설명을 만든다.

- visual description: panel에서 실제 보이는 내용만 요약
- contextual caption: 원 caption과 mentioning paragraph의 실험 문맥을 결합
- whole-figure sample: 원 figure와 원 caption을 그대로 유지

순수 chart figure 10.8M개 이상은 제외하되 biomedical image와 chart가 섞인 figure의 chart panel은 남긴다. 최종 Loom52M은 whole-figure pair 13.1M개와 panel pair 39.3M개, 총 52.4M pair다.

## 2. Structure-aware contrastive learning

image anchor $x_i$에 대해 text 후보를 exact set $\mathcal{E}_i$, same-figure semi-positive set $\mathcal{P}_i$, same-article cross-figure set $\mathcal{A}_i$, cross-article set $\mathcal{N}_i$로 나눈다.

주 loss $\mathcal{L}_{\mathrm{mask}}$는 exact pair를 맞추되 $\mathcal{P}_i$와 $\mathcal{A}_i$를 denominator에서 빼 관련 pair를 잘못 밀어내지 않는다. relation loss $\mathcal{L}_{\mathrm{rel}}$은 $\mathcal{P}_i$를 약한 positive로 사용하고, $\mathcal{N}_i$ 중 content type이 같은 pair에 $\alpha=1.1$ 가중치를 준다.

$$
\mathcal{L}=\mathcal{L}_{\mathrm{mask}}+\lambda\mathcal{L}_{\mathrm{rel}},
\qquad \lambda=0.05.
$$

## 3. Dual-encoder pretraining

vision encoder는 ViT-L/14, text encoder는 BioClinical ModernBERT다. scratch variant와 DFN-2B로 vision encoder를 초기화한 variant를 모두 학습하며, 52.4M pair를 8×H200, global batch 1,536으로 10 epoch 학습한다. image와 text embedding의 cosine similarity가 zero-shot classification과 양방향 retrieval의 공통 출력이다.

# 핵심 그림

![과학 논문의 전체 그림과 본문에서 panel crop과 두 종류의 caption을 만들고, exact·semi-positive·masked·hard-negative 관계를 두 contrastive loss로 학습한 뒤 ViT와 biomedical text encoder가 공통 embedding을 출력하는 BioLoom 파이프라인](/papers/assets/vlm/bioloom-structure-aware-biomedical-vision-language-pretraining/bioloom-architecture.svg)

_논문 내용을 바탕으로 재구성한 BioLoom 전체 architecture._ 출처: [공식 HTML Figure 3](https://arxiv.org/html/2611.33151#S3.F3), 논문 Equations 4–6. 원 논문의 성능 요약 Figure 1보다 **데이터 구축에서 pair 관계가 loss로 변환되는 전체 흐름**을 보여주는 Figure 3이 방법의 핵심을 가장 잘 설명하므로 재구성 대상으로 골랐다.

그림의 입력은 whole figure, 원 caption, mentioning paragraph다. annotation 단계가 panel crop, visual description, contextual caption을 만들고 article–figure–panel ID를 유지한다. 가운데의 네 관계는 같은 batch 안에서 서로 다른 역할을 맡는다. exact pair는 $\mathcal{L}_{\mathrm{mask}}$의 정답, same-figure pair는 $\mathcal{L}_{\mathrm{rel}}$의 약한 positive, same-article cross-figure pair는 두 loss에서 문맥 충돌을 피하려고 mask, same-type cross-article pair는 가중 negative다.

학습 때는 이 두 loss가 ViT-L/14와 BioClinical ModernBERT를 함께 갱신한다. 추론 때는 annotation pipeline과 관계 label이 필요 없고, image와 text를 각각 encoder에 넣어 정규화된 embedding을 얻는다. zero-shot 분류는 class prompt embedding과의 cosine similarity, 검색은 image-text similarity 순위로 계산한다.

# Experiments / Results

- zero-shot classification: 43개 dataset, 67개 task, 10개 biomedical domain. task→dataset→domain 순서로 평균한 뒤 10개 domain을 동일 가중한다.
- BioLoomBench: 2026년 논문의 figure 15,000개, 15개 domain. concise/original caption의 image-to-text와 text-to-image Recall@$K$를 평가한다.
- BioMedFlickr: 7,185 image-caption pair, 동일 caption을 공유하는 항목을 relevant set으로 묶은 수정 protocol을 사용한다.
- main model: ViT-L/14(224×224) + BioClinical ModernBERT, 최대 text length 512.

## 주요 실험 결과

아래는 원 논문 **Tables 2–4**에서 headline 비교를 같은 평가 설정끼리 옮긴 것이다. retrieval의 mean R@1은 I2T와 T2I R@1의 산술평균이며, 차이는 percentage point(%p)다.

| 평가 설정 / 지표 (%, ↑)                              | BioLoom (DFN-2B) | 가장 강한 비교 기준 |         차이 | 출처    |
| ---------------------------------------------------- | ---------------: | ------------------: | -----------: | ------- |
| 10-domain zero-shot, domain-balanced mean accuracy   |        **56.82** |   MedPMC-CLIP 48.77 |  **+8.05%p** | Table 2 |
| BioLoomBench concise caption, bidirectional mean R@1 |        **63.20** |    BiomedCLIP 46.37 | **+16.83%p** | Table 3 |
| BioMedFlickr, bidirectional mean R@1                 |        **10.59** |    MedPMC-CLIP 7.55 |  **+3.04%p** | Table 4 |

출처: [공식 HTML Table 2](https://arxiv.org/html/2611.33151#S3.T2), [Table 3](https://arxiv.org/html/2611.33151#S3.T3), [Table 4](https://arxiv.org/html/2611.33151#S3.T4). BioLoomBench에서 BioLoom의 방향별 R@1은 I2T 66.81%, T2I 59.59%이고, BiomedCLIP은 51.65%, 41.09%다. 즉 한 방향만 좋아진 결과가 아니다.

구조-aware objective 자체의 효과는 **Table 5(b)**가 더 직접적이다. 같은 scratch ViT-L/14와 같은 데이터에서 standard InfoNCE 대비 full objective를 비교한다.

| Scratch setting / 지표 (%, ↑)       | Full objective | Standard InfoNCE |        차이 | 출처       |
| ----------------------------------- | -------------: | ---------------: | ----------: | ---------- |
| zero-shot mean accuracy             |      **52.89** |            51.55 | **+1.34%p** | Table 5(b) |
| BioLoomBench bidirectional mean R@1 |      **57.13** |            49.71 | **+7.42%p** | Table 5(b) |
| BioMedFlickr bidirectional mean R@1 |       **8.42** |             6.60 | **+1.82%p** | Table 5(b) |

mask와 relation loss는 완전히 같은 목적을 최적화하지 않는다. relation loss에 exact pair까지 넣으면 zero-shot accuracy는 54.41%로 full objective보다 높지만, BioLoomBench/BioMedFlickr retrieval은 52.79%/7.30%로 떨어진다. 저자 설정은 classification 최고점 하나보다 세 평가의 균형을 택한다.

data pipeline ablation도 이 해석을 지지한다(Table 6). 25M pair 조건에서 mixed view는 zero-shot 49.42%, BioLoomBench 47.73%인데 panel-only는 40.22%/31.14%, whole-only는 32.49%/15.61%다. local panel과 global figure 문맥이 상보적이다.

# Limitations / Discussion

- BioLoom은 dual encoder라서 caption이나 임상 답변을 생성하지 않는다. 논문도 language decoder와의 결합을 후속 과제로 둔다.
- ViT-S에서 ViT-L까지는 좋아지지만 ViT-H는 현재 설정에서 더 좋아지지 않는다. 저자들은 더 큰 모델에 데이터와 최적화 설정의 재조정이 필요하다고 본다.
- panel annotation은 Gemini 3.5 Flash-Lite가 생성한다. 13.1M whole figure의 추정 annotation 비용은 Batch API 기준 약 $16,700, 96 concurrent request의 측정 처리 시간은 약 139시간이다. data engine의 재현에는 모델 접근성과 비용이 필요하다.
- 8×H200에서 ViT-L/14 10 epoch 학습은 약 42시간으로 추정된다. 구조 supervision은 효율적인 아이디어지만 전체 pretraining 자체는 여전히 큰 자원을 요구한다.
- 논문은 scientific literature 기반 분류·검색에 집중한다. 생성형 medical QA, report generation, 실제 임상 workflow의 안전성이나 calibration을 이 결과만으로 주장할 수 없다.
- arXiv v1이며 학회 게재 여부는 확인되지 않았다.

# 내가 이해한 핵심

BioLoom의 핵심은 “caption을 더 길게 만든다”보다 **관련성의 강도를 loss에 보존한다**는 데 있다. 같은 figure의 sibling panel은 exact positive도 random negative도 아니다. 이 중간 관계를 semi-positive로 분리하고, 같은 article의 다른 figure는 섣불리 negative로 쓰지 않으며, 겉모양이 비슷한 cross-article sample은 오히려 hard negative로 강화한다.

실험에서 가장 설득력 있는 부분도 headline classification보다 retrieval ablation이다. full objective가 InfoNCE 대비 BioLoomBench mean R@1을 +7.42%p 높이는 반면 zero-shot은 +1.34%p다. 즉 article structure는 category boundary만 학습시키기보다 image와 scientific text의 세밀한 대응을 더 크게 개선한다.

# 다음에 연결해서 읽을 논문

- [BiomedCLIP: a multimodal biomedical foundation model pretrained from fifteen million scientific image-text pairs](https://arxiv.org/abs/2303.00915): scientific literature 기반 biomedical CLIP의 대표 기준선이다.
- [BIOMEDICA: An Open Biomedical Image-Caption Archive, Dataset, and Vision-Language Models Derived from Scientific Literature](https://arxiv.org/abs/2501.07171): Loom52M의 article–figure source와 초기 model 계보를 제공한다.
- [Panel2Patch: Hierarchical Vision-Language Alignment for Scientific Figures](https://arxiv.org/search/?query=Panel2Patch&searchtype=title): figure, panel, region 수준 supervision을 다루는 직접 인접 연구다.
- [MedPMC: A Scalable Medical Vision-Language Dataset and Model](https://arxiv.org/search/?query=MedPMC&searchtype=title): panel 분리와 text alignment를 강화한 가장 강한 zero-shot 기준선이다.
