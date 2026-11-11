---
title: "C²-Routing: Complementary Cropping and Compression for Efficient Vision-Language Inference"
date: 2026-11-11
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Guorui Lu, Qinyu Chen"
paper: "https://arxiv.org/abs/2611.14469"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/c2-routing-complementary-cropping-compression/c2-routing-architecture.svg"
---

# 한 줄 요약

질문과 이미지에 따라 작은 세부는 crop, 넓게 퍼진 근거는 전체 이미지 compression으로 보내고, 원본·축소 입력의 공동 정답 확률을 예측하는 safety gate로 위험한 축소만 되돌려 1,024-token 기준선보다 평균 FLOPs 36.53%, visual token 42.36%를 추가 절감한다.

# 논문 정보

- 제목: C²-Routing: Complementary Cropping and Compression for Efficient Vision-Language Inference
- 저자: Guorui Lu, Qinyu Chen (Leiden University)
- 발표: arXiv:2611.14469v1, 2026-11-10 공개; 학회 게재 여부는 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2611.14469), [공식 PDF](https://arxiv.org/pdf/2611.14469)
- 코드/프로젝트: 논문과 arXiv 페이지에서 공식 코드·프로젝트 링크를 확인하지 못함
- 키워드: VLM efficiency, VQA, visual token budget, adaptive cropping, image compression, routing, safety gate

# 핵심 아이디어

시각 토큰을 줄이는 한 가지 전략은 모든 질문에 잘 맞지 않는다. 질문 근거가 이미지의 작은 영역에 모이면 전체 이미지를 낮은 해상도로 줄일수록 필요한 글자나 객체가 사라지지만, 해당 영역을 crop하면 같은 토큰 예산에서 더 크게 보인다. 반대로 여러 객체의 관계나 장면 전체가 필요한 질문은 crop이 문맥을 버리기 쉽고, 전체 이미지를 적당히 압축하는 편이 안전하다.

C²-Routing은 이 상보성을 **전략 선택**과 **위험 판단**으로 분리한다. frozen SmolVLM-500M이 이미지-질문 공동 특징을 한 번 추출하고, selection head가 crop과 compression 중 하나를 고른다. crop은 Grounding DINO-tiny가 질문 관련 영역을 찾고, compression은 resolution head가 256 또는 512 visual-token cap을 고른다.

축소 입력이 항상 안전한 것은 아니므로, 각 branch의 risk head는 원본 입력과 축소 입력의 정답 여부를 `(둘 다 정답, 축소가 해로움, 축소가 이로움, 둘 다 오답)` 네 상태로 함께 예측한다. safety gate는 축소로 잃을 예상 정확도와 아낄 계산량을 비교해 축소 입력을 받아들이거나 1,024-token 원본으로 fallback한다. 모든 결정이 target VLM 호출 전에 이뤄지고 target 내부 상태를 읽지 않으므로 black-box frontend로 쓸 수 있다.

# VLM 관점에서 중요한 이유

이 논문은 단순히 “시각 토큰을 많이 줄였다”보다 **동일한 1,024-token cap을 적용한 원본 기준선에서 추가 절감량을 측정**한다. 토큰 cap 자체가 Qwen2.5-VL-7B의 4개 데이터셋 표본에서 FLOPs 55.64%를 이미 줄였다는 사실을 분리해, routing의 순수한 기여를 더 공정하게 본다.

또한 crop과 compression의 역할을 질문별로 나눈다. Qwen2.5-VL-7B에서 crop은 local-detail 과제 평균을 4.60%p 높이지만 global-context 과제는 3.14%p 낮춘다. compression은 local detail에는 불리하지만 넓은 문맥을 보존하면서 계산량을 안정적으로 줄인다. 이 결과는 효율적 VLM 입력 설계가 해상도 하나를 고르는 문제가 아니라 **근거의 공간 분포를 추정하는 문제**임을 보여준다.

# Method

## 1. 공유 image-question encoder와 전략 선택

입력 $x_i=(I_i,Q_i)$에 대해 frozen SmolVLM-500M encoder $E$가 공유 특징 $h_i=E(I_i,Q_i)$를 만든다. selection head는 이 특징으로 crop $R$ 또는 compression을 고른다. crop branch는 frozen Grounding DINO-tiny의 box·confidence를 사용하며, compression branch는 resolution head가 $C_{256}$ 또는 $C_{512}$를 선택한다.

$$
a_i^0 \in \mathcal A_{red}=\{R,C_{256},C_{512}\},\qquad \pi_i\in\{a_i^0,F\}
$$

$F$는 visual-token cap 1,024의 원본 입력이다. 실제 배포 입력 $\pi_i$는 safety gate가 초기 축소안 $a_i^0$를 승인할지 원본 $F$로 되돌릴지에 따라 정해진다. 학습 label은 frozen target VLM을 원본·crop·두 compression 입력에서 미리 실행해 얻은 답 점수와 계산비용으로 만든다.

## 2. 공동 정답 상태를 예측하는 safety gate

원본 정답 여부 $Y_i^F$와 축소 입력 정답 여부 $Y_i^a$를 함께 보면 네 상태가 생긴다.

$$
11=(1,1),\quad H=(1,0),\quad B=(0,1),\quad 00=(0,0)
$$

$H$는 축소가 정답을 망친 경우, $B$는 오히려 축소가 정답을 만든 경우다. 단순히 축소 입력의 오답 확률만 보면 원본도 틀리는 $00$과 축소가 개선한 $B$를 구분하지 못한다. risk head는 네 상태 확률을 예측하고, 축소가 일으키는 예상 정확도 손실을 다음처럼 계산한다.

$$
r^a(z_i^a)=p_H^a(z_i^a)-p_B^a(z_i^a)
$$

## 3. 정확도 손실과 계산 절감을 함께 보는 fallback

validation set에서 축소 입력의 원본 대비 평균 inference cost $\bar\rho_a$를 구하고, $\lambda$로 정확도-계산 trade-off를 조절한다. gate는 아래 조건에서만 축소안을 승인한다.

$$
\hat r^a(z_i^a)\le\lambda(1-\bar\rho_a)
$$

즉 예상 손실이 계산 절감의 효용보다 크면 원본으로 fallback한다. crop risk head는 공유 특징에 crop 면적, box 수, localization confidence를 더하고, compression risk head는 선택한 token level을 더한다. 축소 이미지를 별도 encode하지 않아 decision overhead를 제한한다.

# 핵심 그림

![질문과 이미지의 공유 특징에서 crop 또는 compression을 선택하고, 공동 정답 상태를 예측한 safety gate가 축소 입력 승인 또는 원본 fallback을 결정한 뒤 frozen VLM에 한 번 전달하는 C²-Routing 구조](/papers/assets/vlm/c2-routing-complementary-cropping-compression/c2-routing-architecture.svg)

_논문 내용을 바탕으로 재구성._ 출처: [공식 PDF](https://arxiv.org/pdf/2611.14469), Figure 2(전체 C²-Routing 개요), Eqs. 1-7(후보 입력, 공동 정답 상태, risk score, utility와 fallback 규칙). 원본 도판을 복사하지 않고 학습 때 필요한 offline answer label과 추론 때의 단일 target-VLM 호출을 구분해 한국어 SVG로 다시 그렸다. 이 논문의 핵심 기여는 개별 성능 plot보다 **crop/compression 선택과 safety fallback이 연결되는 전체 입력 라우팅 구조**에 있으므로 architecture figure를 골랐다.

왼쪽의 이미지·질문은 frozen SmolVLM-500M에서 공유 특징이 된 뒤 두 경로로 갈린다. local-detail에 유리한 crop 경로는 Grounding DINO-tiny로 질문 관련 영역을 찾고, global-context에 유리한 compression 경로는 256/512-token 예산을 고른다. branch별 risk head는 원본과 축소 입력의 공동 정답 상태를 예측한다. 가운데 gate는 $p_H-p_B$와 계산 절감량을 비교해 축소 입력을 승인하거나 $F_{1024}$로 fallback하며, 최종 입력과 원래 질문만 frozen target VLM에 한 번 전달한다. 기존 단일-resolution 방법과 달리 공간적으로 집중된 근거와 분산된 근거를 다른 연산으로 처리하고, 축소가 도움이 되는 $B$ 상태까지 보존하려는 것이 핵심 차이다.

# Experiments / Results

- 데이터: local detail, global context, text/document, mixed perception을 포함한 18개 데이터셋, 총 206,996문항. 같은 이미지·문서와 공유 source를 group으로 묶어 약 4:2:4 train/validation/test로 분리했다.
- 모델: frozen Qwen2.5-VL-7B, Qwen2.5-VL-3B, InternVL3-8B. router는 모델별로 18개 데이터셋을 합쳐 학습하고, 4개 seed 평균을 보고한다.
- 자원: 모든 학습·평가를 RTX 3090에서 수행한다. 원본과 crop은 최대 1,024 visual token, compression은 256 또는 512 token이다.
- 비교군: CARES-F1024, CropVLM-F1024, ViCrop, ZoomEye. frontend, localization, 반복 target 호출까지 end-to-end FLOPs에 포함한다.
- latency: Qwen2.5-VL-7B, 데이터셋별 10문항(총 180개), 3회 반복에서 Balanced-A는 $F_{1024}$의 0.765초 대비 0.659초로 평균 latency를 13.72% 줄였다(95% CI 9.47-17.52%).
- safety-gate ablation: gate가 없는 Balanced-A의 3모델 평균 score loss는 1.583%p, FLOPs 절감은 42.87%였다. crop·compression gate를 모두 켜면 score loss가 0.462%p로 줄고 FLOPs 절감은 36.53%가 된다.

## 주요 실험 결과

아래 표는 공식 PDF Table 1의 18개 데이터셋 평균에서 Balanced-A와 동일한 1,024-token 원본 기준선 $F_{1024}$를 대조한 것이다. score는 각 데이터셋의 task score를 동일 가중 평균한 값이며, 차이는 절대 **%p**다. FLOPs와 token은 기준선 대비 end-to-end 절감률이다.

| Target VLM / 18-dataset 평균 | $F_{1024}$ score | Balanced-A score | score 차이 | FLOPs 절감 (%, ↑) | visual-token 절감 (%, ↑) | 출처 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Qwen2.5-VL-7B | 67.03 | 66.35 | **-0.673%p** | **36.47** | **41.67** | Table 1 |
| Qwen2.5-VL-3B | 66.60 | 65.78 | **-0.815%p** | **35.31** | **41.30** | Table 1 |
| InternVL3-8B | 66.89 | 66.99 | **+0.101%p** | **37.81** | **44.10** | Table 1 |
| 3모델 평균 | - | score retention **99.23%** | 상대 score **-0.77%** | **36.53** | **42.36** | Abstract, Sec. 4.3 |

수치·단위·설정은 [공식 PDF Table 1](https://arxiv.org/pdf/2611.14469)과 Section 4.3에서 직접 대조했다. 세 모델 모두에서 이미 token cap이 걸린 기준선보다 약 35-38%의 FLOPs를 더 줄였고, InternVL3-8B는 평균 score가 0.101%p 상승했다. Qwen 두 모델의 절대 score 손실은 각각 0.673%p, 0.815%p다.

가장 가까운 효율 baseline CARES-F1024와 비교하면, 논문이 보고한 3모델 평균 FLOPs 절감은 CARES 32.87%에서 Balanced-A 36.53%로 **+3.66%p** 커지고, mean task score는 **+1.11%p** 높다. 반면 accuracy-oriented ViCrop·ZoomEye는 score를 올릴 수 있지만 반복 이미지·호출 때문에 원본보다 FLOPs가 증가한다. 따라서 이 결과는 “최고 score” 경쟁보다 제한된 정확도 손실 아래 end-to-end 비용을 낮추는 trade-off로 읽어야 한다.

# Limitations / Discussion

- 전체 3모델·18데이터셋 결과는 1,024-token cap 이후의 추가 절감만 측정한다. token cap 자체와 routing의 기여를 완전히 분리한 실험은 Qwen2.5-VL-7B와 4개 데이터셋의 672문항에 한정된다.
- router 학습 label을 만들려면 target VLM을 원본, crop, 256-token compression, 512-token compression 입력에서 offline으로 여러 번 실행해야 한다. 배포 추론은 한 번이지만 새 target model·도메인에 맞춘 사전 비용이 든다.
- crop 안전 gate의 이득은 모델과 설정에 따라 흔들린다. Table 3에서 Balanced-A의 crop gate 추가는 평균 score를 약간 낮추며, 저자도 더 신뢰할 수 있는 fallback criterion을 향후 과제로 둔다.
- text/document 과제는 축소에 특히 민감하다. Qwen2.5-VL-7B에서 crop, 256-token, 512-token compression의 평균 손실이 각각 7.35, 12.12, 3.85%p여서 OCR·문서 배포에는 보수적 설정이 필요하다.
- end-to-end FLOPs는 크게 줄지만 실제 latency 절감은 13.72%다. frontend overhead와 하드웨어·kernel 효율 때문에 FLOPs 절감이 같은 비율의 wall-clock 개선으로 이어지지 않는다.
- 공식 코드와 외부 held-out 재현 결과가 아직 확인되지 않았다. venue도 arXiv 외에는 확인되지 않아 frontmatter에 `확인 필요`로 표시했다.

# 내가 이해한 핵심

가장 중요한 통찰은 **visual token budget이 아니라 visual evidence geometry를 먼저 판단해야 한다**는 것이다. 같은 256개 token이라도 작은 표지판을 전체 축소로 보는 것과 그 영역을 crop해 보는 것은 정보량이 전혀 다르다. 반대로 여러 객체의 상대 위치가 답이면 crop의 확대 이점보다 문맥 손실이 더 크다. C²-Routing은 이 선택을 작은 공동 encoder 위의 classification 문제로 만든다.

safety gate의 네 상태 설계도 설득력이 있다. “축소 입력이 틀릴 확률”만 예측하면 원본도 틀리는 사례에 불필요하게 fallback하고, 축소가 불필요한 배경을 제거해 새로 맞힌 사례도 잃는다. $p_H-p_B$는 fallback으로 회복할 수 있는 손해에서 축소가 만든 이익을 빼므로, 원본을 무조건 상한선으로 보는 것보다 실제 정확도 변화에 가깝다.

다만 model-agnostic은 model-free와 다르다. target VLM의 답으로 router label을 만들고 모델별 gate parameter를 선택하므로, 내부 activation은 필요 없지만 각 target에 맞춘 offline adaptation은 필요하다. 실무에서는 자주 바뀌는 API 모델보다 오래 유지할 frozen deployment model, 그리고 요청량이 커서 사전 label-generation 비용을 상쇄할 서비스에 더 잘 맞을 것이다.

# 다음에 연결해서 읽을 논문

- [CARES: Towards Adaptive Visual Token Pruning in Multimodal Large Language Models](https://arxiv.org/search/?query=CARES+adaptive+visual+token+pruning&searchtype=all): 같은 lightweight image-question frontend로 해상도를 선택하는 가장 가까운 비교군과 crop branch의 추가 효과를 비교한다.
- [VisionZip: Longer is Better but Not Necessary in Vision Language Models](https://arxiv.org/abs/2412.04467): input-level routing 뒤에 vision-encoder 내부 token pruning을 결합할 때의 상보성을 볼 수 있다.
- [The Answer Knows Where to Look: Zooming before MLLMs Answer under Visual-Token Budgets](/papers/vlm/the-answer-knows-where-to-look-zooming-before-mllms-answer): 작은 시각 근거를 answer-conditioned zoom으로 찾는 방법과 C²-Routing의 사전 routing을 비교할 수 있다.
- [Visual Tokens on Demand: Visual Budgeting for Scalable and Efficient Multi-Image Reasoning in Multimodal LLMs](/papers/vlm/visual-tokens-on-demand-multi-image-reasoning): 단일 이미지의 crop/compression과 다중 이미지의 token budgeting을 연결해 읽기 좋다.
