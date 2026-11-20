---
title: "Learning to Think with Images Faithfully via Adaptive Data Selection"
date: 2026-11-20
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Yu Zhao, Jiaxin Zhang, Rohit Saxena, Fazl Barez, Pasquale Minervini, Yiwen Guo"
paper: "https://arxiv.org/abs/2611.26199"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/learning-to-think-with-images-faithfully/faithtwi-training-pipeline.svg"
---

# 한 줄 요약

줌 도구를 자주 호출한다고 시각 증거를 충실히 쓰는 것은 아니다. **FaithTwI**는 현재 정책이 정답 영역 crop으로 실제 이득을 얻는 질문만 계속 골라 학습하고, 이미 전체 이미지로 풀 수 있는 질문에는 직접 답하도록 보상해 정확도와 증거 충실성을 함께 높인다.

# 논문 정보

- 제목: Learning to Think with Images Faithfully via Adaptive Data Selection
- 저자: Yu Zhao, Jiaxin Zhang, Rohit Saxena, Fazl Barez, Pasquale Minervini, Yiwen Guo
- 발표: arXiv:2611.26199v1, 2026-11-19 제출; 학회 게재 여부는 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2611.26199), [공식 PDF](https://arxiv.org/pdf/2611.26199), [공식 HTML](https://arxiv.org/html/2611.26199)
- 코드/프로젝트: arXiv 메타데이터와 본문에서 공식 공개 링크를 확인하지 못함
- 키워드: VLM, thinking with images, visual search, crop-and-zoom agent, adaptive data selection, GRPO, faithfulness

# 핵심 아이디어

Thinking with Images(TwI)는 VLM이 고해상도 이미지의 일부를 crop·zoom해 다시 관찰하도록 만든다. 그러나 최종 정답이 맞더라도 모델이 반환된 crop을 실제 근거로 썼는지는 별개다. 저자들은 첫 crop을 정답 영역, 무관 영역, 회색·검은 이미지로 바꾸는 통제 실험에서 기존 모델이 **표적이 없는 crop에도 표적이 보인다고 말하거나**, 반대로 표적이 있는데도 없다고 말하는 현상을 확인한다.

핵심 원인은 고정 학습 데이터다. 훈련 중 모델의 전체 이미지 인식 능력이 좋아지면 처음에는 zoom이 필요했던 질문도 도구 없이 풀 수 있게 된다. 이때 계속 zoom trajectory를 강화하면 모델은 crop 내용을 무시해도 보상을 받을 수 있다. FaithTwI는 매 RL step에서 현재 정책 $\pi_t$를 사용해 다음 차이를 추정한다.

$$
\mathrm{acc}_{\pi_t}(I,V^+,q)-\mathrm{acc}_{\pi_t}(I,q)
$$

정답 crop $V^+$가 전체 이미지 $I$보다 정확도를 최소 $\delta$만큼 높이는 질문만 RL 학습에 남긴다. 동시에 이미 도구 없이 안정적으로 맞히는 질문에는 tool-free trajectory 보상을 줘 불필요한 zoom을 줄인다.

# VLM 관점에서 중요한 이유

이 논문은 multimodal agent의 **도구 호출 횟수**와 **도구 결과에 대한 인과적 의존성**을 분리한다. crop 위치가 그럴듯하고 최종 답이 맞아도, crop을 검은 이미지로 바꿨을 때 같은 주장을 유지한다면 설명 가능한 시각 추론이라고 보기 어렵다. 따라서 VLM 에이전트 평가는 answer accuracy뿐 아니라 반환 증거를 바꿨을 때 내부 판단과 답이 적절히 변하는지도 봐야 한다.

또한 curriculum을 난이도순으로 한 번 정하지 않고, **현재 정책이 어떤 시각 증거에서 아직 이득을 얻는지**로 매 step 다시 정의한다. 데이터 난이도가 모델 능력에 따라 이동하는 agentic post-training에서 유용한 일반 원리다. 선택은 zoom이 필요한 샘플을 유지하고, adaptiveness reward는 zoom이 불필요해진 샘플에서 직접 답하도록 만들어 두 신호가 서로 보완된다.

# Method

## 1. 시각 검색 질문 합성

고해상도 이미지를 작은 영역으로 나누고, 생성 모델이 각 영역의 물체 유형을 열거한 뒤 SAM3로 정확한 bounding box를 얻는다. 겹치는 box를 합치고 confidence 상위 32개 물체를 유지한다. 물체 crop, 주변을 포함한 정답 crop, 축소된 전체 이미지를 함께 사용해 단일 물체 속성 또는 두 물체의 공간 관계 질문을 만든다.

질문은 세 검증을 거친다. Set-of-Mark로 지시 대상이 하나로 특정되는지 확인하고, 여러 crop 조건의 답을 대조해 정답이 시각적으로 지지되는지 확인하며, 이미지를 주지 않고도 맞힐 수 있는 질문은 버린다. 표적 영역을 다른 patch나 Gaussian noise로 가려 정말 답할 수 없게 만든 예시와, 무관 영역에 같은 편집을 적용해 여전히 답할 수 있는 대조 예시도 만든다.

최종 RL 데이터는 13K 문항이며 단일 물체 67.5%, 공간 관계 25.0%, 답변 불가 7.5%다. 1K SFT 예시는 직접 답하기, 정답 crop 후 답하기, 첫 zoom 실패에서 회복하기, 여러 영역을 찾고 답변 불가를 선언하기의 네 행동을 가르친다.

## 2. 현재 정책 기반 adaptive selection

각 샘플 $(I,q,y,V^+)$에 대해 현재 정책으로 전체 이미지만 본 답과 정답 crop을 함께 본 답을 각각 샘플링한다. crop 위치를 정책이 직접 찾게 하지 않고 $V^+$를 제공하므로 이 비교는 탐색 능력이 아니라 **증거 자체의 추가 가치**를 측정한다.

$$
\mathrm{acc}_{\pi_t}(I,V^+,q)-\mathrm{acc}_{\pi_t}(I,q)\ge\delta
$$

조건을 통과한 질문만 해당 step의 GRPO 학습에 들어간다. 실제 RL trajectory에는 $V^+$가 주어지지 않으며, 모델이 전체 이미지와 질문만 보고 직접 답할지 어디를 zoom할지 결정한다.

## 3. adaptiveness reward와 GRPO

질문마다 12개 trajectory를 샘플링한다. 그룹 정확도가 $\alpha=0.5$ 이상이고 도구 없이 맞힌 비율이 $\rho=0.25$ 이상이면, 그 그룹의 올바른 tool-free trajectory에 adaptiveness reward를 준다. 전체 보상은 정답, 적응성, 형식 보상의 가중합이며 GRPO로 최적화한다.

선택만 제거하면 step 24 이후 도구 사용률이 1% 아래로 무너지고, 보상만 제거하면 마지막에도 99.4%가 도구를 호출한다. 전체 방법은 마지막 88.8%에서 zoom을 유지하되 이미 풀 수 있는 질문에는 직접 답하는 절충을 학습한다.

# 핵심 그림

![고해상도 이미지에서 검증된 시각 검색 질문을 합성하고 현재 정책의 전체 이미지 정확도와 정답 crop 정확도 차이로 샘플을 선택한 뒤 적응성 보상을 포함한 GRPO로 FaithTwI를 학습하는 파이프라인](/papers/assets/vlm/learning-to-think-with-images-faithfully/faithtwi-training-pipeline.svg)

_논문 Figure 4와 Equations 2–5를 바탕으로 재구성._ 출처: [공식 HTML Figure 4 및 Method](https://arxiv.org/html/2611.26199#S3), [공식 PDF](https://arxiv.org/pdf/2611.26199). 원본 Figure 4는 질문 합성만 보여주므로, 논문의 핵심인 **합성 → 현재 정책으로 증거 이득 측정 → step별 선택 → GRPO** 흐름을 한 장에서 설명하기 위해 전체 방법론 파이프라인으로 다시 그렸다.

왼쪽에서는 고해상도 이미지에서 SAM3 물체 box를 만들고, 전체 이미지·물체 crop·주변 crop으로 질문을 생성·검증해 $(I,q,y,V^+)$를 만든다. 가운데 학습 단계에서는 같은 현재 정책 $\pi_t$에 전체 이미지만 주는 branch와 정답 crop까지 주는 branch를 비교한다. 후자가 최소 $\delta$만큼 더 정확한 질문만 선택되므로, 모델 능력이 올라가 zoom이 더는 유용하지 않은 질문은 자동으로 빠진다.

선택된 질문의 실제 rollout에는 정답 crop이 주어지지 않는다. 정책이 직접 답하거나 zoom 도구를 호출하고, 정답 보상과 형식 보상에 adaptiveness reward를 더해 GRPO로 갱신한다. 추론 시에는 이 선택기나 정답 box가 없고, 학습된 정책이 전체 이미지와 질문만 받아 직접 답할지 crop-and-zoom할지 결정한다.

# Experiments / Results

- 기본 모델: Qwen2.5-VL-7B; 추가 실험은 Qwen3-VL-4B, Qwen3.5-4B
- 학습: 1 epoch SFT 후 GRPO 40 steps, step당 384문항 × 문항당 12 trajectories
- 시각 검색: V*, HR-Bench 4K/8K, MME-RealWorld 영·중문, ZoomBench
- 충실성/환각: 통제 crop 교체 실험, RePOPE, AMBER, HaloQuest, VizWiz
- 비교: DeepEyes, PixelReasoner, Thyme, DeepEyesV2, Mini-o3, Adaptive CoF, PyVision-Image, CodeV, ZwZ

## 주요 실험 결과

아래 표는 원 논문의 **Table 2** 중 모든 비교 모델에 공통으로 보고된 V*, HR-Bench 4K/8K, ZoomBench를 옮겼다. 모두 answer accuracy(%, ↑)이며 동일한 Qwen2.5-VL-7B 계열 비교다. `최강 baseline 대비`는 각 열에서 FaithTwI를 제외한 최고값과의 차이를 **%p**로 계산했다.

| 모델 / 정확도 (%, ↑) | V* | HR-Bench 4K | HR-Bench 8K | ZoomBench |
| --- | ---: | ---: | ---: | ---: |
| DeepEyes | 85.6 | 75.1 | 72.6 | 46.6 |
| Mini-o3 | 88.2 | 77.5 | 73.3 | 50.3 |
| PyVision-Image | 88.7 | 78.1 | 74.3 | 미보고 |
| ZwZ-7B | 88.5 | 75.4 | 73.3 | 55.6 |
| CodeV | 84.8 | 76.1 | 71.3 | 50.5 |
| **FaithTwI** | **90.1** | **79.5** | **77.3** | **56.8** |
| **최강 baseline 대비** | **+1.4%p** | **+1.4%p** | **+3.0%p** | **+1.2%p** |

출처: [공식 HTML Table 2](https://arxiv.org/html/2611.26199#S3.T2), 논문 Table 2. PyVision-Image의 ZoomBench는 원문이 보고하지 않아 임의 수치를 채우지 않았다. 논문 초록의 `+11.6%`, `+7.9%`, `+9.4%`는 강한 동급 baseline 차이가 아니라 base Qwen2.5-VL-7B 대비 향상이다(V*: 78.5→90.1, HR-Bench 4K: 71.6→79.5, HR-Bench 8K: 67.9→77.3).

충실성 통제 실험도 핵심이다. 첫 반환 crop을 정답/무관 crop으로 강제 교체한 V* 평가(Table 4)에서 FaithTwI는 FNR 8.7%, FPR 2.2%, target-recognition accuracy 94.5%다. CodeV는 FPR이 0.7%로 낮지만 FNR이 87.9%라 표적이 실제 있어도 거의 인정하지 못하고, PixelReasoner는 FNR 2.3%지만 FPR 56.9%라 무관 crop에도 표적이 있다고 말한다. FaithTwI는 두 오류를 함께 낮춘다.

환각 평가(Table 5)에서는 HaloQuest 70.7%, VizWiz 57.1%로 CodeV의 62.2%, 54.9%보다 각각 **+8.5%p**, **+2.2%p** 높다. 다만 RePOPE 93.6%는 PixelReasoner와 동률이고, AMBER 87.3%는 PixelReasoner 87.9%보다 **−0.6%p**다. 모든 benchmark에서 단독 우위라는 주장은 아니다.

# Limitations / Discussion

- 질문 합성과 검증에 Qwen 계열 생성·judge 모델과 SAM3를 사용하므로 자동 검증 오류나 특정 모델의 편향이 데이터에 남을 수 있다.
- adaptive selection은 매 step마다 전체 이미지 조건과 정답 crop 조건의 여러 답을 샘플링한다. 384문항 × 12 trajectories 외에 선택용 추론도 필요해 계산 비용이 커진다.
- 통제 실험은 첫 crop에 대한 명시적 발화를 judge해 FNR/FPR을 계산한다. 이것이 최종 답이 crop에 인과적으로 얼마나 의존했는지를 완전히 측정하지는 않는다.
- 주요 비교는 Qwen2.5-VL-7B 기반이며, 다른 크기·도구·domain에서 동일한 선택 임계값과 보상 균형이 유지되는지는 추가 검증이 필요하다.
- 모델은 최대 8 interaction turns와 정의된 crop-and-zoom interface 안에서 학습된다. 자유로운 코드 실행이나 여러 vision specialist를 조합하는 agent에는 직접 일반화되지 않을 수 있다.
- arXiv v1이며 학회 게재 여부와 공식 코드 공개는 확인되지 않았다.

# 내가 이해한 핵심

FaithTwI의 본질은 “도구를 쓰게 보상”하는 것이 아니라 **도구 결과가 현재 모델의 정답 가능성을 실제로 높이는 샘플만 보상**하는 것이다. 고정된 어려운 문제 목록도 훈련 중에는 쉬워질 수 있으므로, 데이터의 유효성은 모델 상태와 함께 변한다.

또 하나 중요한 점은 도구 사용의 양극단을 피했다는 것이다. selection만 없으면 모델은 direct answer로 수렴해 미세한 증거를 놓치고, adaptiveness reward가 없으면 거의 모든 질문에서 zoom하는 의례적 행동이 남는다. 올바른 agent policy는 “항상 호출”이나 “전혀 호출 안 함”이 아니라 증거의 한계에 맞춰 행동을 바꾸는 정책이다.

실무에서는 OCR·문서 이해·검사 시스템의 crop tool 학습에서도 같은 진단을 적용할 수 있다. tool result를 정확한 crop, 무관 crop, 빈 이미지로 교체해 주장의 민감도를 측정하고, 현재 모델이 tool result로 실제 개선되는 샘플을 online curriculum으로 유지하는 방식이다.

# 다음에 연결해서 읽을 논문

- [Learning Where to Look: Observation Policy Optimization for Thinking with Images](/papers/vlm/learning-where-to-look-observation-policy-optimization-for-thinking-with-images): crop 위치를 학습하는 관점과, crop의 유효성을 step별 데이터 선택에 쓰는 FaithTwI를 비교하기 좋다.
- [Look Where It Counts: A Free, Label-Free Visual Evidence Signal for Fine-Grained Vision-Language Reasoning](/papers/vlm/look-where-it-counts-label-free-visual-evidence-for-fine-grained-vision-language-reasoning): crop 전후 정답 확률 차이를 시각 증거 신호로 쓰는 연결점이 있다.
- [Visual Tokens on Demand](/papers/vlm/visual-tokens-on-demand-multi-image-reasoning): 필요한 순간에만 시각 token을 불러오는 효율화 관점에서 adaptiveness와 연결된다.
- [DeepEyes: Incentivizing “Thinking with Images” via Reinforcement Learning](https://arxiv.org/search/?query=DeepEyes+Incentivizing+Thinking+with+Images+via+Reinforcement+Learning&searchtype=title): FaithTwI가 재현하고 비판하는 기본 TwI RL 설정이다.
