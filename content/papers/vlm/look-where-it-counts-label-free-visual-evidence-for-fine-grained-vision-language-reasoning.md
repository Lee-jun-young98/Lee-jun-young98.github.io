---
title: "Look Where It Counts: A Free, Label-Free Visual Evidence Signal for Fine-Grained Vision-Language Reasoning"
date: 2026-09-23
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Santi Ram Tiwari, Nihal Naik, Devbrat Pandey, Nishant Sinha"
paper: "https://arxiv.org/abs/2609.24244"
code: ""
project: ""
---

# 한 줄 요약

정답 후보를 가장 확신하게 만드는 이미지 crop을 고르는 것만으로 별도 학습·정답 라벨·박스 주석 없이 미세 시각 증거를 찾고, VLM의 세부 질문 정확도를 약 70%에서 85%로 높인다.

# 논문 정보

- 제목: Look Where It Counts: A Free, Label-Free Visual Evidence Signal for Fine-Grained Vision-Language Reasoning
- 저자: Santi Ram Tiwari, Nihal Naik, Devbrat Pandey, Nishant Sinha
- 발표: 확인 필요 (arXiv v1, 2026-09-21)
- 링크: [arXiv:2609.24244](https://arxiv.org/abs/2609.24244)
- 코드/프로젝트: 확인 필요
- 키워드: multimodal large language model, fine-grained visual reasoning, label-free grounding, crop selection, contrastive evidence gap, self-distillation

# 핵심 아이디어

고해상도 이미지의 작은 물체나 주변부 속성을 묻는 질문에서 VLM이 틀리는 이유를 추론 능력보다 **입력 단계의 지각 병목**으로 본다. 전체 이미지를 축소하면 정답에 필요한 픽셀이 사라지고, 모델은 실제 시각 증거 대신 언어 사전지식으로 답할 수 있다.

논문은 이를 진단하기 위해 두 가지 신호를 제안한다.

- **Answer peakedness**: 여러 후보 crop 가운데 모델의 다음 토큰 분포 엔트로피가 가장 낮아지는 영역을 선택한다. 정답 문자열이나 박스 주석을 사용하지 않는다.
- **Contrastive evidence gap**: 같은 출력 토큰이 질문 관련 crop과 무관한 crop에서 각각 얼마나 높은 확률을 받는지 로그 확률 차이로 측정한다. 값이 클수록 해당 출력이 시각 증거에 민감하다고 해석한다.

첫 번째 신호는 추론 시 정답 영역을 찾고 다시 답하는 데 쓰이며, 두 번째는 모델 confidence와 결합해 근거 있는 답과 자신 있게 틀린 답을 구분하는 진단 신호로 쓰인다.

# VLM 관점에서 중요한 이유

VLM의 오답을 모두 “reasoning 실패”로 묶으면 더 큰 언어 모델이나 추가 CoT 학습으로 해결하려 하기 쉽다. 이 논문은 일부 실패가 실제로는 필요한 픽셀이 인코더에 충분히 들어오지 않은 문제이며, 모델의 출력 분포 변화만으로 그 증거 위치를 찾을 수 있음을 보여 준다.

특히 정답 라벨이나 외부 teacher 없이 모델 자체를 probe한다는 점이 실용적이다. 동시에 confidence만으로는 언어 prior에 기반한 confident error를 걸러내지 못하지만, evidence gap은 “무엇을 보여 줬을 때 답이 바뀌는가”를 측정하므로 두 신호가 상보적이다.

# Method

1. 입력 이미지와 질문에 대해 VLM의 기본 답변과 토큰 확률을 계산한다.
2. 이미지를 16개 grid crop 후보로 나누고, 전체 이미지와 각 crop을 함께 넣어 한 번씩 forward한다.
3. 각 crop에서 출력 분포의 negative entropy를 계산하고 가장 peaked한 crop을 질문 관련 영역 `z+`로 선택한다.
4. 선택 crop을 추가한 입력으로 다시 답해 fine-grained inference 결과를 얻는다.
5. 이미 생성된 출력 토큰에 대해 `log p(token | z+) - log p(token | z-)`를 계산해 토큰별 contrastive evidence gap을 만든다.
6. 토큰별 gap의 평균을 trajectory grounding score로 사용하고, 모델 confidence와 결합해 정답 여부 및 confident error를 예측한다.
7. 학습 확장인 SEG-Distill에서는 EMA self-teacher가 crop 정보를 본 분포를 target으로 삼고, evidence gap에 따라 trajectory 또는 token별 distillation 가중치를 조절한다.

# 핵심 그림

![전체 이미지와 질문에서 16개 crop을 평가해 관련 영역을 고르고, 추론 답변 또는 evidence-gap 기반 자기증류로 보내는 파이프라인](/papers/assets/vlm/look-where-it-counts-label-free-visual-evidence/seg-distill-pipeline.svg)

> 그림 1 재구성. 입력 이미지와 질문에서 후보 crop을 만들고, 답변 분포가 가장 뾰족해지는 영역 `z+`를 선택한 뒤 추론과 학습에 사용하는 전체 파이프라인. 출처: [논문 Figure 1 및 식 (3)–(8)](https://arxiv.org/pdf/2609.24244). 논문 내용을 바탕으로 직접 재구성했다.

이 그림은 논문의 핵심이 단일 모델 블록보다 **어떤 시각 영역을 보여 주었을 때 출력 분포가 어떻게 달라지는지**를 측정하는 전체 흐름에 있기 때문에 골랐다. 입력 `I, q`에서 16개 grid crop을 만들고, 각 crop을 붙였을 때의 다음 토큰 분포 엔트로피가 가장 낮은 영역을 `z+`로 선택한다. 추론에서는 `전체 이미지 + z+`로 다시 답해 작은 시각 단서를 복원한다.

학습 경로는 학생이 전체 이미지로 생성한 각 토큰 `y_k`에 대해 관련 crop `z+`와 무관 crop `z−` 조건의 로그확률 차이 `Δ_k`를 계산한다. 이 차이의 trajectory 평균 `p`를 0–2 범위 가중치 `w`로 바꿔, `z+`를 본 EMA 자기교사 분포와 학생 분포의 정렬 강도를 조절한다. 즉 peakedness는 **어디를 볼지**, evidence gap은 **그 영역이 실제 답변 토큰에 얼마나 영향을 주었는지**를 담당한다. 다만 이 학습 경로는 300-step 파일럿에서 기본 모델을 넘지 못했고, 검증된 이득은 왼쪽의 학습 없는 추론 경로에 집중된다.

# Experiments / Results

- Qwen2.5-VL-7B, Qwen3-VL-8B, Qwen3-VL-30B-A3B를 V\*Bench의 191개 객관식 샘플에서 평가했다. 세부 속성 질문 115개와 전역 문맥이 필요한 상대 위치 질문 76개로 나뉜다.
- label-free crop 선택은 세 모델에서 정답 영역을 chance 대비 4.4~5.1배 잘 찾았다. 정답 영역 hit rate는 각각 83.5%, 80.0%, 92.2%였다.
- Qwen3-VL-8B의 세부 속성 정확도는 전체 이미지만 쓸 때 70.4%에서 선택 crop을 함께 쓸 때 85.2%로 올랐다. 무작위 crop은 71.4%, center crop은 68.7%여서 단순 zoom 효과만으로 설명되지 않았다.
- evidence gap과 confidence를 합친 정답 예측 AUC는 모델별 0.926, 0.992, 0.979로 confidence 단독보다 모두 높았다.
- confidence 상위 절반 안에서도 evidence gap이 정답과 오답을 구분한 AUC는 0.97~1.00으로, 자신 있게 틀린 답을 탐지하는 신호가 됐다.
- 반면 Qwen2.5-VL-7B를 300 step씩 학습한 SEG-Distill 파일럿에서는 base 71.7%, ungated OPD 71.2%, trajectory gate 70.7%, token gate 69.1%로 어떤 변형도 base를 넘지 못했다.

## 주요 실험 결과

Qwen3-VL-8B의 crop 선택 ablation은 단순 확대가 아니라 **질문에 맞는 영역을 고르는 방향**이 성능 향상의 원인임을 가장 직접적으로 분리하므로 핵심 비교로 골랐다. 모든 값은 같은 V\*Bench 평가 설정에서 계산된 정확도(%, ↑)이며, `direct`는 미세 속성 115문항, `rel. pos.`는 전역 문맥이 필요한 상대 위치 76문항이다.

| Crop 선택 방식 | Direct attributes 정확도 (%, ↑) | 전체 정확도 (%, ↑) | Relative position 정확도 (%, ↑) | Direct 기준 full image 대비 차이 |
| --- | ---: | ---: | ---: | ---: |
| Full image (crop 없음) | 70.4 | 72.3 | 75.0 | 기준 |
| Center crop | 68.7 | 71.7 | 76.3 | -1.7%p |
| Random crop | 71.4 | 71.0 | 70.5 | +1.0%p |
| Anti-selected (가장 낮은 peakedness) | 67.8 | 66.5 | 64.5 | -2.6%p |
| **Peakedness-selected (제안 방식)** | **85.2** | **83.2** | **80.3** | **+14.8%p** |
| Oracle bounding box | 100.0 | 89.0 | 72.4 | +29.6%p |

출처: [원 논문 Table III](https://arxiv.org/pdf/2609.24244), Qwen3-VL-8B, full-vocabulary answer-letter log-probability 평가. 제안 방식은 random crop보다 **13.8%p**, 반대 방향 선택보다 **17.4%p** 높다. 반면 상대 위치에서는 tight oracle box가 72.4%로 전체 이미지 75.0%보다 낮아, 국소 확대가 전역 문맥을 없앨 수 있다는 한계도 함께 드러난다.

# Limitations / Discussion

- 16개 crop마다 forward pass가 필요해 기본 추론보다 계산량이 크게 증가한다.
- 평가는 V\*Bench 한 개와 객관식 letter scoring에 한정됐으며, 자유 생성·다양한 해상도·여러 grounding 데이터셋에서의 일반화는 검증되지 않았다.
- 세부 속성에는 tight crop이 유리하지만 상대 위치처럼 전역 문맥이 필요한 질문에서는 crop이 오히려 관계 정보를 제거할 수 있다.
- grounding 평가는 target box hit 중심이다. IoU와 attention/Grad-CAM, CRG 등 더 많은 위치 추정 baseline과의 비교가 필요하다.
- SEG-Distill의 부정적 결과는 7B 모델의 짧은 파일럿 학습에서 얻었으므로, 신호 자체가 학습에 쓸 수 없다는 결론보다는 현재 목적함수와 privileged view 설계가 부족하다는 증거에 가깝다.
- 공개 코드와 확정 venue는 확인되지 않았다.

# 내가 이해한 핵심

이 논문의 가장 좋은 부분은 “모델이 확신하는가”와 “모델이 올바른 시각 증거에 반응하는가”를 분리한 것이다. 같은 답을 자신 있게 생성해도 관련 영역을 보여 줬을 때 토큰 확률이 더 올라가지 않는다면, 그 답은 이미지보다 언어 prior에서 나왔을 가능성이 크다.

다만 crop 선택이 강한 것은 세부 정보가 국소 영역에 모여 있을 때다. 전역 관계 문제에서는 `full image + 하나의 tight crop`만으로는 충분하지 않으므로, 실제 시스템에서는 질문 유형을 먼저 판별하거나 여러 해상도의 crop과 전체 문맥을 함께 유지하는 routing이 필요하다.

# 다음에 연결해서 읽을 논문

- [Eyes Wide Shut? Exploring the Visual Shortcomings of Multimodal LLMs](https://arxiv.org/abs/2401.06209): VLM이 언어 prior에 의존하고 시각 정보를 충분히 사용하지 않는 문제를 더 넓게 분석한다.
- [V-Zero: Self-Improving Visual Reasoning for MLLMs without Training Data](https://arxiv.org/abs/2505.03389): crop 기반 시각 탐색과 on-policy distillation을 외부 teacher 관점에서 비교할 수 있다.
- [When Should a VLM Look? Paying Only for Visual Calls That Were Needed and Used](https://arxiv.org/abs/2609.22910): 시각 도구 호출이 실제로 필요했고 반환된 픽셀을 사용했는지를 분리해 보상하는 후속 관점을 제공한다.
