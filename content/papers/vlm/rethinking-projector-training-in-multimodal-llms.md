---
title: "Rethinking Projector Training in Multimodal LLMs"
date: 2026-10-14
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "NeurIPS 2026"
authors: "Fabian Gröger, Naël Ouerghemi, Shuo Wen, Maria Brbić"
paper: "https://arxiv.org/abs/2610.18598"
code: "https://github.com/mlbio-epfl/PORTAL"
project: "https://brbiclab.epfl.ch/projects/portal/"
thumbnail: "/papers/assets/vlm/rethinking-projector-training-in-multimodal-llms/portal-architecture.svg"
---

# 한 줄 요약

PORTAL은 MLLM의 Stage-I projector 학습이 정밀한 image-text 대응보다 두 표현 분포의 거친 기하 정렬에 가깝다는 증거를 제시하고, 1,024개 비라벨 이미지와 LLM embedding 통계만으로 폐형식 projector를 만들어 558k paired-caption 학습 성능의 대부분을 복원한다.

# 논문 정보

- 제목: Rethinking Projector Training in Multimodal LLMs
- 저자: Fabian Gröger, Naël Ouerghemi, Shuo Wen, Maria Brbić (EPFL, University of Basel, HSLU)
- 발표: NeurIPS 2026. arXiv v1은 2026-10-13 제출되었고 camera-ready로 명시되어 있으며, NeurIPS 2026 공식 Downloads 목록에서도 제목을 확인했다.
- 링크: [arXiv:2610.18598](https://arxiv.org/abs/2610.18598), [HTML 논문](https://arxiv.org/html/2610.18598v1), [NeurIPS 2026 공식 목록](https://neurips.cc/Downloads/2026)
- 코드/프로젝트: [공식 코드](https://github.com/mlbio-epfl/PORTAL), [공식 프로젝트 페이지](https://brbiclab.epfl.ch/projects/portal/)
- 키워드: multimodal LLM, projector alignment, optimal transport, training-free initialization, feature distribution, efficient pretraining

# 핵심 아이디어

LLaVA 계열은 보통 frozen vision encoder와 frozen LLM 사이의 projector만 558k image-caption pair로 먼저 학습한 뒤(Stage I), projector와 LLM을 multimodal instruction data로 함께 학습한다(Stage II). 저자들은 Stage I이 정말 세밀한 시각-언어 대응을 학습한다면 적은 데이터나 서로 다른 데이터로 학습한 projector의 단순 weight interpolation으로 성능을 유지하기 어려워야 한다고 본다.

실험은 반대 결과를 보인다. LCS-558k의 10–20%만으로도 downstream gain 대부분이 회복되고 30–40%에서 포화한다. 같은 초기값에서 LCS-558k와 ShareGPT-1.2M으로 따로 학습한 projector는 두 weight를 선형 보간해도 성능이 유지되며, 50:50 혼합은 16-benchmark 평균 49.0으로 두 endpoint의 48.0과 48.8보다 높다. 따라서 Stage I은 하나의 정밀한 semantic map보다 visual feature를 LLM이 처리 가능한 넓은 영역에 놓는 **coarse geometric conditioning**이라는 해석이 가능하다.

PORTAL(Projector via Optimal-transpoRT ALignment)은 이 관찰을 학습 없는 초기화로 바꾼다. 비라벨 이미지의 patch feature와 LLM input embedding table을 각각 PCA하고, 상위 축의 평균·방향·분산만으로 Gaussian optimal-transport map을 닫힌 형태로 계산한다. paired caption도 gradient step도 필요 없고, 이후 Stage II는 기존 LLaVA recipe를 그대로 쓴다.

# VLM 관점에서 중요한 이유

VLM 구축 비용을 줄이는 것보다 더 근본적인 기여는 projector pretraining의 역할을 다시 정의했다는 점이다. 흔히 Stage I을 “이미지와 언어의 의미를 맞추는 단계”라고 설명하지만, PORTAL의 결과는 적어도 frozen-backbone LLaVA 설정에서는 평균과 공분산 수준의 분포 정렬만으로 상당 부분 대체할 수 있음을 보인다. 무엇을 paired data로 학습해야 하는지, 어떤 부분은 구조적 초기화로 해결할 수 있는지를 분리한다.

또한 결과는 backbone 의존적이다. LLaMA 3.2 1B/CLIP에서는 PORTAL이 trained projector보다 2.6 평균점 높지만, Qwen 2.5 7B/CLIP과 OLMo 2 1B/CLIP에서는 낮고 gap이 OCR·Chart에 집중된다. 즉 coarse statistics는 일반 시각·지식 과제에 충분할 수 있어도 문자 배치 같은 higher-order spatial structure를 모두 보존하지는 않는다. 데이터 없는 정렬의 가능성과 paired supervision이 계속 필요한 영역을 동시에 보여준다.

# Method

## 1. Stage-I 역할 진단

저자들은 LLaVA 1.5의 2-layer MLP projector를 대상으로 두 진단을 한다. 첫째, LCS-558k와 ShareGPT-1.2M의 사용 비율을 바꾸고 동일한 Stage-II LLaVA-665k tuning 뒤 16개 benchmark를 평가한다. 둘째, 같은 초기값에서 서로 다른 corpus로 Stage-I을 마친 projector $W_{\mathrm{LCS}}$, $W_{\mathrm{ShareGPT}}$를

$$
W_\alpha=(1-\alpha)W_{\mathrm{LCS}}+\alpha W_{\mathrm{ShareGPT}}
$$

로 보간한다. cross-data interpolation은 유지되지만 서로 다른 random seed에서 출발한 두 projector의 중간점은 captioning CIDEr가 약 80에서 0.7로 붕괴한다. 초기값이 loss basin을 고르고, 데이터는 그 basin 안의 해를 고른다는 해석이다.

## 2. PORTAL 폐형식 projector

source visual patch token $X$와 target language feature $Y$에서 평균 $\mu_s,\mu_t$, 상위 $k$개 PCA basis $V_s,V_t$, 축별 표준편차 $\sigma_s,\sigma_t$를 구한다. 기본값은 COCO val2017 비라벨 이미지 1,024장과 LLM input embedding table, $k=512$다.

$$
W_1=V_t\operatorname{diag}\left(\frac{\sigma_t}{\sigma_s}\right)V_s^\top,
\qquad
b_1=\mu_t-W_1\mu_s
$$

$W_1$은 source를 whiten하고 target 주축으로 회전한 뒤 target spread에 맞춰 rescale한다. $b_1$은 target mean으로 recenter한다. 표준 LLaVA projector $f(x)=W_2\,\mathrm{GELU}(W_1x+b_1)+b_2$의 두 번째 층은 $W_2=I$, $b_2=0$으로 둔다. 따라서 construction에는 양쪽 PCA 한 번씩만 필요하며, 논문 설정에서는 단일 RTX 3090에서 30초 미만이다.

## 3. 동일한 Stage-II로 공정 비교

PORTAL, random initialization, 558k-pair trained projector를 만든 뒤 모든 설정에 동일한 LLaVA-665k Stage-II instruction tuning을 적용한다. 비교 범위는 Vicuna·LLaMA·Qwen·OLMo의 0.5B–8B 여섯 LLM backbone, CLIP·SigLIP 두 vision encoder의 일곱 조합과 16개 benchmark다. 이 통제는 “projector 초기화가 Stage II 이후 무엇을 남기는가”를 분리한다.

# 핵심 그림

![비라벨 이미지와 LLM embedding에서 각각 PCA 통계를 추출하고 Gaussian optimal transport로 PORTAL projector를 만든 뒤 기존 Stage-II instruction tuning과 평가로 연결하는 한국어 아키텍처 도식](/papers/assets/vlm/rethinking-projector-training-in-multimodal-llms/portal-architecture.svg)

_논문 Figure 1, Eq. 2, Figure 4와 Sections 3–5를 바탕으로 재구성._ 원 논문은 arXiv non-exclusive license이므로 원본 Figure를 복사하지 않고 방법론 흐름을 직접 그렸다. 출처: [Figure 1과 전체 개념](https://arxiv.org/html/2610.18598v1#S1.F1), [PORTAL 식과 Method](https://arxiv.org/html/2610.18598v1#S4.SS1), [Figure 4와 compute 비교](https://arxiv.org/html/2610.18598v1#S5.SS2). 이 논문의 핵심은 단일 결과 plot보다 **paired Stage-I을 어떤 통계 연산으로 치환하는지**이므로 구조 그림을 선택했다.

그림의 위쪽 기존 경로는 image-caption pair로 frozen vision encoder와 frozen LLM 사이의 projector만 gradient 학습한다. 아래 PORTAL 경로는 비라벨 이미지에서 visual patch 분포를, LLM embedding table에서 language 분포를 독립적으로 얻는다. 각 분포의 평균·상위 PCA 방향·축별 spread를 계산하고, source whitening → target 축 회전 → target scale 조정 → mean recentering 순서의 폐형식 $W_1,b_1$로 projector를 구성한다. 두 경로 뒤의 Stage II는 동일하게 projector와 LLM을 instruction tuning하므로, Table 1의 차이는 Stage-I 초기화 방식에서 온다. PORTAL warm start 뒤 paired caption을 조금 추가하는 경우 약 4k pair에서 558k baseline에 도달하며, 이때 학습 흐름과 추론 구조 자체는 바뀌지 않는다.

# Experiments / Results

- 16개 benchmark는 Knowledge(AI2D, ScienceQA, MathVista, MMMU), General(GQA, MME, SEED-Bench Lite, MMBench), OCR/Chart(TextVQA, OCRBench-v2, DocVQA, ChartQA), Vision-Centric(CV-Bench 2D/3D, BLINK, RealWorldQA) 네 범주다.
- trained baseline은 Stage-I LCS-558k와 Stage-II LLaVA-665k를 쓴다. PORTAL과 Random은 Stage-I paired sample 0개이며, 세 방법의 Stage II는 동일하다.
- Table 1의 Avg는 16개 benchmark 점수의 비가중 평균이다. 논문은 per-sample paired bootstrap 1,000회로 95% 신뢰구간을 계산한다.
- PORTAL은 일곱 encoder–LLM 조합 중 세 조합에서 trained baseline을 넘고, 나머지 네 조합에서는 baseline 평균의 96.3–99.3%를 유지한다. 단, 개별 benchmark metric의 scale이 섞인 평균이므로 모델 간 절대 능력 비교보다 같은 조합 안의 initialization 비교로 읽어야 한다.
- Appendix Table 9에서 Vicuna 1.5 7B/CLIP의 PORTAL은 다른 unpaired alignment인 CORAL과 Gromov-Wasserstein보다 높지만, 차이는 각각 +1.07점과 +0.37점이다. “unpaired alignment 전반”의 효과와 PORTAL 고유 효과를 구분할 필요가 있다.

## 주요 실험 결과

아래 표는 논문 Table 1에서 같은 encoder·LLM·Stage-II 조건의 Avg16을 맞춰 비교한 것이다. `차이`는 `PORTAL - 558k-pair trained baseline`의 절대 평균점 차이다. 이 값은 정확도 %p가 아니라 서로 다른 benchmark score를 평균한 **평균점**이다.

| Vision / LLM           | Stage-I 초기화   | Paired captions | Avg16 (↑) | Trained 대비 |   차이 | 출처    |
| ---------------------- | ---------------- | --------------: | --------: | -----------: | -----: | ------- |
| CLIP / Vicuna 1.5 7B   | Trained baseline |            558k |      48.0 |       100.0% |      — | Table 1 |
| CLIP / Vicuna 1.5 7B   | PORTAL           |               0 |      47.4 |        98.8% | -0.6점 | Table 1 |
| SigLIP / Vicuna 1.5 7B | Trained baseline |            558k |      49.0 |       100.0% |      — | Table 1 |
| SigLIP / Vicuna 1.5 7B | PORTAL           |               0 |      48.7 |        99.3% | -0.3점 | Table 1 |
| CLIP / LLaMA 3.1 8B    | Trained baseline |            558k |      50.8 |       100.0% |      — | Table 1 |
| CLIP / LLaMA 3.1 8B    | PORTAL           |               0 |      52.2 |       102.7% | +1.4점 | Table 1 |
| CLIP / LLaMA 3.2 1B    | Trained baseline |            558k |      41.6 |       100.0% |      — | Table 1 |
| CLIP / LLaMA 3.2 1B    | PORTAL           |               0 |      44.2 |       106.2% | +2.6점 | Table 1 |
| CLIP / Qwen 2.5 7B     | Trained baseline |            558k |      52.6 |       100.0% |      — | Table 1 |
| CLIP / Qwen 2.5 7B     | PORTAL           |               0 |      51.7 |        98.3% | -0.9점 | Table 1 |
| CLIP / Qwen 2.5 0.5B   | Trained baseline |            558k |      37.6 |       100.0% |      — | Table 1 |
| CLIP / Qwen 2.5 0.5B   | PORTAL           |               0 |      39.9 |       106.1% | +2.3점 | Table 1 |
| CLIP / OLMo 2 1B       | Trained baseline |            558k |      43.8 |       100.0% |      — | Table 1 |
| CLIP / OLMo 2 1B       | PORTAL           |               0 |      42.2 |        96.3% | -1.6점 | Table 1 |

PORTAL이 항상 baseline을 이기는 것은 아니지만, paired caption과 Stage-I gradient step 없이 모든 조합에서 -1.6점 이내이고 세 조합에서는 더 높다. 특히 SigLIP/Vicuna에서 Random은 baseline의 82.5%(40.5점)에 그치지만 PORTAL은 99.3%(48.7점)를 회복해, 좋은 geometry initialization이 단순 Stage-I 생략과 다름을 보여준다. 수치·설정은 [논문 Table 1 및 Section 5.1](https://arxiv.org/html/2610.18598v1#S5.SS1)에서 직접 대조했다.

다른 unpaired 방법과의 통제 비교도 중요하다.

| Vicuna 1.5 7B / CLIP 초기화 | Paired captions | Projector optimization | Avg16 (↑) | Trained 대비 | 출처    |
| --------------------------- | --------------: | ---------------------- | --------: | -----------: | ------- |
| Stage-I trained baseline    |            558k | gradient               |     48.03 |       100.0% | Table 9 |
| Random                      |               0 | 없음                   |     44.90 |        93.5% | Table 9 |
| CORAL                       |               0 | 없음, closed form      |     46.36 |        96.5% | Table 9 |
| Gromov-Wasserstein          |               0 | iterative              |     47.06 |        98.0% | Table 9 |
| PORTAL                      |               0 | 없음, closed form      |     47.43 |        98.8% | Table 9 |

PORTAL은 Random보다 +2.53점, CORAL보다 +1.07점, GW보다 +0.37점 높다. 이는 paired correspondence가 없어도 distribution matching이 대부분의 Stage-I 이득을 만든다는 주장을 지지하지만, PORTAL의 우위가 매우 큰 것은 아니다. 수치는 [Appendix Table 9](https://arxiv.org/html/2610.18598v1#A5.SS1)에서 확인했다. 추가로 Figure 4는 PORTAL warm start가 약 4k caption에서 full 558k baseline에 도달해 alignment FLOPs를 약 135배 줄이며, 10k부터 baseline을 넘는다고 보고한다.

# Limitations / Discussion

- 핵심 분석은 frozen vision/LLM backbone과 LLaVA 1.5의 2-layer MLP projector를 중심으로 한다. 더 복잡한 Q-Former, resampler, cross-attention connector가 같은 보간 성질을 보인다고 단정할 수 없다.
- Gaussian approximation은 평균과 공분산만 맞추고 higher-order structure를 버린다. 저자들도 Qwen 2.5 7B와 OLMo 2 1B의 잔여 gap이 OCR·Chart에 집중된다고 보고하며, 문자 단위 spatial layout이 paired supervision을 필요로 할 수 있다고 본다.
- 모든 main result는 Stage II에서 projector와 LLM을 학습하지만 vision encoder는 고정한다. vision backbone까지 end-to-end로 업데이트하는 regime에는 아직 검증되지 않았다.
- 16-benchmark suite는 single-image 중심이며 long-context grounding, multi-image reasoning을 강하게 시험하지 않는다. audio·video·3D encoder로의 일반화도 미검증이다.
- main 실험 대부분은 seed 42 한 번이며, 신뢰구간은 sample bootstrap이지 training seed variation이 아니다. 작은 평균점 차이를 최적화 안정성의 증거로 해석하면 안 된다.
- PORTAL은 Stage-I만 없앤다. 동일한 LLaVA-665k 또는 3.2M-sample Stage-II instruction tuning은 여전히 필요하므로 “완전한 training-free MLLM”은 아니다.
- 저자들은 coarse geometric conditioning을 데이터와 일치하는 가장 단순한 설명으로 제시할 뿐 유일한 메커니즘이라고 주장하지 않는다. PORTAL은 존재 증명에 가깝다.

# 내가 이해한 핵심

projector가 해야 할 일은 이미지 patch 하나를 특정 단어와 정확히 짝짓는 것이라기보다, LLM attention이 낯설지 않은 방향·크기의 token 분포로 visual feature를 보내는 것일 수 있다. PORTAL은 이를 source whitening과 target coloring이라는 고전적인 통계 정렬로 구현한다. 이후 Stage II가 실제 task-specific semantics를 학습하므로 Stage I에는 생각보다 약한 조건만 필요하다는 구조다.

가장 설득력 있는 증거는 PORTAL의 단일 성능 숫자보다 세 관찰의 결합이다. 적은 data에서 빠르게 포화하고, 같은 basin의 서로 다른 data 해를 보간할 수 있으며, 아예 marginal statistics만 맞춘 폐형식 해도 비슷한 downstream 성능을 낸다. 반면 다른 seed의 해는 보간할 수 없고 OCR gap이 남는다. “아무 projector나 된다”가 아니라 **호환되는 기하 영역은 넓지만 basin과 세부 구조는 여전히 중요하다**는 결론이 적절하다.

실무적으로는 새 vision encoder를 여러 LLM에 붙일 때 558k paired corpus를 매번 만드는 대신, 작은 비라벨 image pool로 PORTAL을 계산하고 필요하면 수천 pair로 보정하는 경로가 생긴다. 다만 문서 VQA나 chart reading처럼 문자 위치가 중요한 제품이라면 aggregate average만 보고 Stage I을 제거하지 말고 OCR category를 별도로 검증해야 한다.

# 다음에 연결해서 읽을 논문

- [LLaVA-1.5: Improved Baselines with Visual Instruction Tuning](https://arxiv.org/abs/2310.03744): PORTAL이 대체하는 558k Stage-I과 유지하는 665k Stage-II 표준 recipe를 이해하는 기준점이다.
- [Cambrian-1: A Fully Open, Vision-Centric Exploration of Multimodal LLMs](https://arxiv.org/abs/2406.16860): projector data scaling과 16개 benchmark 범주화의 배경을 확인할 수 있다.
- [With Limited Data for Multimodal Alignment, Let the Structure Guide You](https://arxiv.org/abs/2506.16895): 같은 연구진의 구조 보존 기반 limited-data alignment와 완전한 unpaired initialization의 차이를 비교할 수 있다.
- [Deep CORAL: Correlation Alignment for Deep Domain Adaptation](https://arxiv.org/abs/1607.01719): Appendix 통제군이자 second-order feature alignment의 직접적인 선행 방법이다.
