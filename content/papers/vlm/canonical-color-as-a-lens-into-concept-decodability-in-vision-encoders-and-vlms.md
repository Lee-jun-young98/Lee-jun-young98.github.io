---
title: "Canonical Color as a Lens into Concept Decodability in Vision Encoders and VLMs"
date: 2026-09-12
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "EMNLP 2026"
authors: "Xiaofu Chen, Stella Frank, Yova Kementchedjhieva"
paper: "https://arxiv.org/abs/2609.09124"
code: ""
project: ""
---

# 한 줄 요약

이미지의 실제 색을 제거해도 비전 인코더에서 물체의 전형적 색(canonical color)이 선형적으로 복원되며, VLM 후학습은 이 의미 정보가 읽히는 위치를 비전 타워에서 인터페이스·디코더 쪽으로 재배치할 수 있음을 보인 분석 연구다.

# 논문 정보

- 제목: Canonical Color as a Lens into Concept Decodability in Vision Encoders and VLMs
- 저자: Xiaofu Chen, Stella Frank, Yova Kementchedjhieva
- 발표: EMNLP 2026
- 링크: [arXiv:2609.09124](https://arxiv.org/abs/2609.09124)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: vision encoder probing, canonical color, concept decodability, VLM post-training, representation analysis

# 핵심 아이디어

색은 픽셀에서 직접 보이는 속성이면서 동시에 "바나나는 노랗다"처럼 물체 개념에 결합된 지식이다. 저자들은 RGB 색상 단서를 회색조 변환과 히스토그램 평활화로 제거한 뒤, 동결된 중간 표현에서 전형적 색과 물체 정체성을 각각 선형 probe로 예측한다. 실제 표면색과 전형적 색을 분리하기 위해 비정상 색으로 재착색한 Visual-CounterFact도 대조군으로 사용한다.

# VLM 관점에서 중요한 이유

최종 답변 정확도만 보면 정보가 비전 인코더, 멀티모달 연결부, 언어 디코더 중 어디서 형성되거나 손실되는지 알기 어렵다. 이 연구는 동일한 비전 백본의 VLM 후학습 전후와 디코더 visual-token 상태를 층별로 비교해, 후학습이 의미 정보를 단순히 지우기보다 다른 표현 형식으로 옮길 수 있음을 보여준다. VLM 해석 가능성 연구에서 "정보의 존재"와 "선형적으로 읽을 수 있는 위치"를 구분해야 한다는 실증적 근거다.

# Method

- Wikidata와 기존 object–color 자료를 바탕으로 708개 물체 클래스와 10개 기본 전형색을 구성하고, 클래스당 최대 5개 이미지를 수집한다.
- RGB를 상한선으로 두고, 회색조 변환 뒤 이미지별 히스토그램 평활화를 적용해 색도와 단순 밝기 단서를 줄인다.
- CLIP, SigLIP, DINOv2, ViT-MAE, Swin-V2의 모든 층에서 평균 풀링한 patch 표현을 추출한다.
- 동결 표현 위에 L2 정규화 multinomial logistic regression을 학습한다. 색 probe는 물체 클래스 단위 5-fold 교차검증으로 동일 클래스 이미지 누수를 막고, 물체 probe는 클래스별 이미지 hold-out을 사용한다.
- CLIP–Molmo, CLIP–mPLUG-Owl, SigLIP–PaliGemma의 후학습 전후 비전 타워를 비교하고, visual interface 이후와 LLM 디코더의 visual-token 평균 표현도 probe한다.

# Experiments / Results

- 회색조+히스토그램 평활화에서도 다섯 인코더 모두 13.98% 다수 클래스 기준선을 넘었고, DINOv2가 가장 높은 peak를 보였다.
- DINOv2-S/B/L/g의 전형색 정확도는 Gray+HE에서 41.8% → 43.8% → 46.0% → 48.0%로 규모에 따라 단조 증가했다.
- 모델이 예측한 물체의 전형색과 색 probe 예측이 일치하는 비율은 CLIP, SigLIP, DINOv2, Swin-V2 후반 층에서 대략 55–65%였다.
- Molmo와 mPLUG-Owl의 후학습 비전 타워에서는 물체·색 정보의 선형 접근성이 낮아졌지만, visual interface 및 디코더 visual-token 상태에서 상당 부분 회복됐다. PaliGemma는 원래 SigLIP 패턴을 비교적 잘 보존했다.
- 회색조 이미지에 대한 최종 VLM 응답은 내부 probe와 일치하지 않았다. 예를 들어 canonical-color 응답 정확도는 Molmo 44.5%, mPLUG-Owl 25.6%, PaliGemma 4.1%로, 최종 출력이 시각 증거와 언어 사전지식 및 출력 형식을 함께 반영함을 보여준다.

# Limitations / Discussion

- 전형적 색이라는 한 속성에 집중하므로 재질, 질감, 기능, affordance 같은 다른 의미 속성에 그대로 일반화할 수 없다.
- 선형 probe는 선택한 readout으로 쉽게 접근 가능한 정보만 측정한다. 낮은 정확도가 표현 내부 정보의 완전한 부재를 뜻하지 않는다.
- 데이터는 클래스당 이미지 수가 작고 Wikidata의 단일 has-color 속성과 수작업 필터링에 의존한다.
- 내부 정보가 디코더에서 읽힌다는 사실만으로 최종 예측에 인과적으로 사용된다고 결론낼 수 없다.

# 내가 이해한 핵심

VLM 후학습은 비전 표현의 의미를 항상 강화하거나 보존하는 단순한 과정이 아니다. 같은 개념 정보가 비전 타워에서는 선형적으로 덜 보이지만 연결 모듈 뒤에서는 다시 잘 보일 수 있다. 따라서 VLM을 진단할 때 특정 모듈 하나의 probe 결과만으로 "개념을 잃었다"고 판단하면 안 되고, 비전 타워부터 인터페이스와 디코더까지 정보가 어떤 형식으로 이동하는지를 추적해야 한다.

# 다음에 연결해서 읽을 논문

- [Visual CounterFact: Challenging Multimodal Models with Counterfactual Images](https://arxiv.org/search/?query=Visual+CounterFact&searchtype=title)
- [ColorBench: Can VLMs See and Understand Colors?](https://arxiv.org/search/?query=ColorBench&searchtype=title)
- [Learning Transferable Visual Models From Natural Language Supervision](/papers/multimodal/learning-transferable-visual-models-from-natural-language-supervision)
