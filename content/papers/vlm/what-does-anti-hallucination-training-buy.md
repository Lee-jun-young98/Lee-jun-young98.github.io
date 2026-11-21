---
title: "What Does Anti-Hallucination Training Buy? Saying Less, Cheap Pruning, and the Rest"
date: 2026-11-21
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Lingkai Bu, Qian Gao"
paper: "https://arxiv.org/abs/2611.25814"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/what-does-anti-hallucination-training-buy/audit-pipeline.svg"
---

# 한 줄 요약

VLM 환각 완화의 성과를 같은 recall에서 비교하면, 공개 LLaVA-1.5 방법 8개 중 7개가 **덜 말하기를 넘어서 제거한 환각의 최소 2/3**를 500장으로 학습한 11-feature 로지스틱 probe가 재현한다. 따라서 CHAIR 감소는 recall-matched control과 값싼 사후 baseline을 함께 통과해야 한다.

# 논문 정보

- 제목: What Does Anti-Hallucination Training Buy? Saying Less, Cheap Pruning, and the Rest
- 저자: Lingkai Bu, Qian Gao
- 발표: arXiv:2611.25814v1, 2026-11-19 제출; 학회 게재 여부는 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2611.25814), [공식 PDF](https://arxiv.org/pdf/2611.25814), [공식 HTML](https://arxiv.org/html/2611.25814)
- 라이선스: CC BY-NC-SA 4.0
- 코드/프로젝트: arXiv 메타데이터와 본문에서 공식 공개 저장소 링크를 확인하지 못함
- 키워드: VLM hallucination, CHAIR, preference training, matched recall, post-hoc pruning, DPO

# 핵심 아이디어

상세 caption에서 물체를 덜 언급하면 환각도 자연히 줄어든다. CHAIR와 informativeness를 나란히 보고하는 것만으로는 “학습이 같은 모델을 단순히 짧게 만든 효과”를 제거할 수 없다. 이 논문은 훈련된 시스템이 제거한 base-caption 물체 수를 **첫 등장 순위별로 정확히 맞춘** 두 반사실 baseline을 만든다.

1. position-matched random: 같은 rank에서 같은 수의 물체를 무작위 삭제한다. 이것이 “덜 말하기” 효과다.
2. cheap probe: 같은 삭제 budget에서 환각 확률이 높은 물체부터 지운다. 500장에 맞춘 11-feature logistic regression이며 surface 5개, COCO prior 3개, 생성 확률 3개만 쓴다.
3. 훈련 방법이 random보다 추가로 제거한 환각 중 probe가 재현한 비율을 accounted share로 정의한다.

$$
\mathrm{share}=
\frac{R_{\mathrm{probe}}-R_{\mathrm{rand}}}
{R_{\mathrm{method}}-R_{\mathrm{rand}}}.
$$

사전 기준은 $\mathrm{share}\ge0.667$이다. share가 1을 넘을 수도 있는데, 동일한 rank별 삭제 수에서 probe가 학습 방법보다 더 많은 base hallucination을 제거했다는 뜻이다.

# VLM 관점에서 중요한 이유

이 논문은 새 anti-hallucination model보다 **효과 크기의 올바른 기준선**을 제안한다. 생성 길이와 물체 recall이 바뀌는 preference training에서는 CHAIR만 비교하면 실제 시각 grounding 개선과 보수적으로 말하는 정책을 혼동한다. 또한 환각률이 뒤쪽 물체일수록 급격히 높아지므로 삭제 개수뿐 아니라 첫 등장 rank도 고정해야 한다.

두 번째 메시지는 “학습으로 얻은 효과가 값싼 신호로도 가능한가”이다. probe·CLIP label DPO가 ground-truth DPO의 beyond-brevity gain을 상당 부분 회복한다면, 비싼 preference 데이터의 가치는 같은 비용·recall control 아래에서 cheap label보다 얼마나 더 얻는지로 측정해야 한다.

# Method

## 1. matched-recall 평가

COCO val2014의 2,000장을 fitting 500장(A), calibration 500장(B), held-out 1,000장(C)으로 나눈다. 실제 평가는 B+C 1,500장이며, AMBER 1,004장과 Object HalBench 295장으로 반복한다. 서로 다른 물체 단위 CHAIR와 recall은 다음과 같다.

$$
\mathrm{CHAIR}_d=100\frac{\sum_i|\mathcal O_i\setminus\mathcal G_i|}{\sum_i|\mathcal O_i|},\qquad
\mathrm{Recall}=100\frac{\sum_i|\mathcal O_i\cap\mathcal G_i|}{\sum_i|\mathcal G_i|}.
$$

강한 baseline 실험에서는 각 시스템 full recall의 80%에서 probe-guided pruning과 앞에서부터 자르는 Trunc의 $\mathrm{CHAIR}_d$ 차이 $G_{\mathrm{probe}}$를 측정한다. 양수면 같은 recall에서 probe가 단순 truncation보다 낫다.

## 2. 11-feature cheap probe

- Surface: token 위치, 물체 rank, 언급 횟수, 전체 물체 수, 주변 hedge 표현
- Prior: COCO class hallucination prior, 앞서 언급된 class와의 co-occurrence, class 빈도
- Confidence: 첫 token·최소·평균 log-probability

표준화 후 $C=1$ logistic regression을 fitting set 500장에만 맞추고 동결한다. accounted-share에는 base-model probe를 base caption에 적용하고, strong-baseline에는 각 시스템의 500장 caption으로 맞춘 자체 probe를 쓴다.

## 3. cheap signal로 DPO label 만들기

모델당 이미지별 네 caption을 생성하고 GT, probe, 또는 object-level CLIP score로 환각 물체를 표시한다. response-level에서는 표시가 가장 적은/많은 caption을 chosen/rejected로 삼고, object-level에서는 같은 caption에서 표시된 문장이 제거된 버전을 chosen으로 삼는다. 모든 arm은 2,527 pairs, 동일한 LoRA-DPO 설정으로 학습한다.

# 핵심 그림

![base VLM caption과 anti-hallucination 방법을 같은 물체 recall 및 첫 등장 rank별 삭제 수에서 맞춘 뒤 random deletion, 11-feature cheap probe, 훈련 방법의 환각 제거량을 비교하고 cheap signal DPO까지 평가하는 감사 파이프라인](/papers/assets/vlm/what-does-anti-hallucination-training-buy/audit-pipeline.svg)

_논문 Figure 1과 Sections 3–7을 바탕으로 재구성._ 출처: [공식 HTML Figure 1 및 Protocol](https://arxiv.org/html/2611.25814#S3), [공식 PDF](https://arxiv.org/pdf/2611.25814). 원 Figure 1은 제거량 분해 결과를 중심으로 하므로, 입력 → 통제 변수 → 세 가지 제거량 → label 가치 평가의 전체 방법론을 설명하기 위해 재구성 구조도를 선택했다.

왼쪽에서 base VLM caption과 훈련된 caption의 물체 recall을 맞추고, 물체의 첫 등장 rank별 삭제 수까지 고정한다. 가운데 random branch는 위치와 짧아짐만으로 사라지는 환각을, probe branch는 동일 budget에서 11개 값싼 신호로 추가 제거 가능한 환각을 측정한다. 학습 방법의 제거량과 비교해 saying less, cheap pruning, rest로 분해한다.

오른쪽에서는 같은 probe와 CLIP score를 preference labeler로 바꿔 동일한 DPO recipe를 학습한다. 즉 분석 단계의 “싼 설명”이 실제 훈련 신호로도 ground-truth gain을 얼마나 회복하는지 검증한다. 이 그림은 새 VLM architecture가 아니라 **anti-hallucination 효과를 감사하는 평가·학습 파이프라인**이다.

# Experiments / Results

- 공개 시스템: LLaVA-1.5-7B 기반 RLAIF-V, HA-DPO, OPA-DPO, EOS, HALVA, POVID, CSR-iter3, CHAIR-DPO; 추가 SENTINEL
- 새 backbone: Qwen2.5-VL-7B, InternVL2.5-8B
- 지표: distinct-object $\mathrm{CHAIR}_d$, object recall, accounted share, beyond-brevity gain $G$, recovery ratio $R$
- 불확실성: 1,000회 image-level bootstrap 95% interval, seed 0

## 주요 실험 결과

아래 표는 원 논문의 **Table 1**을 옮겼다. COCO는 held-out 1,500장에서 base caption의 환각 물체 중 position-matched random, frozen probe, 각 방법이 제거한 개수다. AMBER와 OHB는 원문이 share만 보고했다.

| LLaVA-1.5-7B 방법 | COCO $R_{rand}$ | COCO $R_{probe}$ | COCO $R_{method}$ | COCO share | AMBER share | OHB share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| RLAIF-V | 780 | 1,021 | 1,192 | **0.59** | 0.83 | **0.62** |
| HA-DPO | 461 | 686 | 738 | 0.81 | 1.48 | 0.75 |
| OPA-DPO | 933 | 1,142 | 1,232 | 0.70 | 0.84 | 0.74 |
| EOS | 452 | 671 | 741 | 0.76 | 1.40 | 0.68 |
| HALVA | 274 | 457 | 489 | 0.85 | 2.01 | 0.73 |
| POVID | 517 | 751 | 850 | 0.70 | 1.11 | **0.63** |
| CSR-iter3 | 820 | 1,050 | 1,075 | 0.90 | 1.09 | 0.88 |
| CHAIR-DPO | 817 | 1,050 | 1,144 | 0.71 | 1.02 | 0.69 |
| **사전 기준 통과 수** |  |  |  | **7/8** | **8/8** | **6/8** |

출처: [공식 HTML Table 1](https://arxiv.org/html/2611.25814#S5.T1). 굵은 share는 사전 기준 0.667 미만이다. 예를 들어 HA-DPO의 COCO share는 $(686-461)/(738-461)=0.812$로, 덜 말하기를 넘어선 제거 효과의 약 81%를 cheap probe가 같은 rank budget에서 재현한다.

Cheap-label DPO(Table 3)도 같은 방향이다.

| backbone / label | beyond-brevity mean $G$ (CHAIR 점, ↑) | GT gain 회복률 $R$ | matched random 대비 |
| --- | ---: | ---: | ---: |
| Qwen2.5-VL / GT | +3.81 | 1.000 | — |
| Qwen2.5-VL / probe | +2.67 | 0.702 [0.560, 0.849] | +2.21 [+1.57, +2.87] |
| Qwen2.5-VL / CLIP | +3.31 | 0.869 [0.736, 1.013] | +2.85 [+2.12, +3.59] |
| Qwen2.5-VL / matched random | +0.46 | — | — |
| InternVL2.5 / GT | +3.67 | 1.000 | — |
| InternVL2.5 / probe | +2.68 | 0.730 [0.554, 0.914] | +1.29 [+0.52, +2.02] |

출처: [공식 HTML Table 3](https://arxiv.org/html/2611.25814#S7.T3). Qwen에서 CLIP label은 probe label보다 $0.64$ CHAIR 점 더 큰 beyond-brevity gain을 냈고 95% interval은 [0.10, 1.20]점이다. “cheap signal이면 모두 같다”가 아니라 CLIP signal이 이 설정에서 더 강했다.

Strong baseline(Table 2)은 COCO에서 9개 LLaVA 시스템 중 8개, AMBER에서 9개 전부를 통과했다. Qwen base의 $G_{probe}$는 +4.46 [+3.43, +5.36]점이고, 실제 문장 삭제로 구현해도 +5.45 [+4.38, +6.45]점이었다. 다만 InternVL2.5 COCO accounted-share는 네 training design 중 2개만 기준을 통과해 논문의 일반화 주장 자체가 실패로 기록됐다.

# Limitations / Discussion

- CHAIR human check의 precision은 COCO 0.531, AMBER 0.581로 사전 기준 0.80보다 낮았다. 세 번째 annotator 재평가도 0.683, 0.707이어서 핵심 evaluator 자체의 오차가 크다.
- 대상은 상세 caption의 **물체 존재** 환각이다. 속성·관계·OCR·reasoning hallucination으로 바로 일반화할 수 없다.
- probe의 강한 feature 일부는 완성된 caption과 teacher-forced token probability가 필요해 online decoder가 아니다. 500장의 in-domain label도 필요하며 zero-shot AMBER strong baseline은 실패했다.
- held-out COCO의 87.8%가 train2017에 속하고 41.9%가 LLaVA-1.5 instruction data에 등장한다. 완전한 unseen-image 일반화를 주장하지 않는다.
- 인간평가 independent subset이 60/15/25 items로 작고, task A와 C는 annotator agreement gate를 통과하지 못해 descriptive result로만 남았다.
- Qwen2.5-VL의 SENTINEL share 0.99는 beyond-position removal 129 objects에 기반한 작은 표본이다.
- 논문은 arXiv v1이며 공식 코드·학회 게재 여부는 확인되지 않았다.

# 내가 이해한 핵심

환각 완화에서 가장 먼저 물어야 할 질문은 “CHAIR가 얼마나 내려갔나”가 아니라 **같은 recall로 덜 말했을 때보다 얼마나 더 내려갔나**이다. 그 다음에는 첫 등장 위치를 맞춘 값싼 detector가 그 초과 이득을 얼마나 재현하는지 봐야 한다. 두 control을 통과한 잔여분만이 새로운 학습법의 고유한 grounding 개선 후보가 된다.

이 논문의 장점은 자기 주장이 깨지는 경우도 사전 기준에 따라 남겼다는 점이다. RLAIF-V는 cheap account가 가장 약했고, InternVL2.5 COCO의 accounting은 실패했으며, CHAIR evaluator human validation도 실패했다. “대부분 설명 가능”이라는 결론은 모든 모델·벤치마크에 대한 보편 법칙이 아니라 감사 프로토콜이 실제로 반증 가능하다는 사례다.

실무적으로는 VLM captioner나 document extraction model을 개선할 때 정확도와 출력 coverage를 함께 맞춘 뒤, rule/probe/CLIP 같은 cheap baseline의 잔여 성능을 보고 expensive preference data의 가치를 판단해야 한다.

# 다음에 연결해서 읽을 논문

- [What Transfers from Text to Vision? Capability Scaling Laws and Transfer Dynamics for VLMs](/papers/vlm/what-transfers-from-text-to-vision-capability-scaling-laws): VLM 결과를 단일 score가 아니라 예측 가능한 구성 요소로 분해한다는 방법론적 연결이 있다.
- [Did I See It or Think It? Probing Reality Monitoring in Vision-Language Models with Concept Injection](/papers/vlm/did-i-see-it-or-think-it-reality-monitoring-in-vlms): 환각을 output metric이 아니라 내부 시각 증거와 개념 주입의 구분 문제로 본다.
- [Learning to Think with Images Faithfully via Adaptive Data Selection](/papers/vlm/learning-to-think-with-images-faithfully): 최종 정답 개선과 실제 시각 증거 의존성을 분리해 평가한다.
- [Object Hallucination in Image Captioning](https://arxiv.org/abs/1809.02156): 이 논문이 감사하는 CHAIR 지표의 원 논문이다.
