---
title: "Benchmarking the Explanatory Quality of Open-Weight Vision-Language Models in Face Recognition"
date: 2026-09-21
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Laurent Colbois, Sébastien Marcel"
paper: "https://arxiv.org/abs/2609.21879"
code: "https://gitlab.idiap.ch/biometric/vlmfr"
project: ""
---

# 한 줄 요약

VLM의 얼굴 동일인 판별 성능뿐 아니라 설명이 신원에 안정적인 단서를 쓰는지, 가려진 얼굴 부위를 지어내지 않는지를 구조화된 JSON과 자동 감사 지표로 함께 평가한 벤치마크다.

# 논문 정보

- 제목: Benchmarking the Explanatory Quality of Open-Weight Vision-Language Models in Face Recognition
- 저자: Laurent Colbois, Sébastien Marcel
- 발표: 확인 필요 (arXiv v1, 2026-09-18)
- 링크: [arXiv:2609.21879](https://arxiv.org/abs/2609.21879)
- 코드/프로젝트: [Idiap VLM Face Recognition Benchmark](https://gitlab.idiap.ch/biometric/vlmfr)
- 키워드: vision-language model, face verification, explainability, faithfulness, relevance, structured decoding, hallucination audit

# 핵심 아이디어

얼굴 두 장을 비교하는 VLM에게 유사도 점수와 자유 형식 근거만 요구하면 설명을 대규모로 검증하기 어렵다. 이 논문은 모델이 비교한 얼굴 특징, 각 이미지에서의 묘사, 특징별 비교, 종합 근거, 최종 유사도 점수를 고정 JSON 스키마로 출력하게 한다. 이 구조 덕분에 설명을 두 축으로 자동 감사할 수 있다.

- **Relevance**: 안경, 표정, 조명, 배경처럼 신원 판단에 불안정한 단서를 얼마나 적게 사용하는가.
- **Faithfulness**: 선글라스·마스크 등으로 가려진 눈, 코, 입을 보았다고 설명하지 않는가.

저자들은 불안정 단서와 얼굴 부위에 대한 어휘집을 만들고, 구조화된 특징 항목에서 해당 표현의 비율을 세어 relevance와 faithfulness를 계산한다. 정확한 판별과 그럴듯한 설명을 같은 것으로 취급하지 않는 것이 핵심이다.

# VLM 관점에서 중요한 이유

VLM의 자연어 근거는 읽기 쉽다는 이유만으로 설명 가능하다고 오해되기 쉽다. 이 연구는 같은 얼굴 검증 오류율을 보이는 모델도 불안정 단서 의존과 가려진 영역 환각에서 크게 다를 수 있음을 보여 준다. 즉 VLM 평가에서 최종 답의 정확도와 시각적 근거의 품질을 분리해야 하며, 구조화된 생성은 그 품질을 자동으로 회귀 테스트하는 실용적인 인터페이스가 될 수 있다.

또한 모델 크기를 키우면 판별 정확도와 스키마 준수는 대체로 좋아지지만 relevance가 단조롭게 개선되지는 않았다. 스케일 자체가 시각적으로 타당한 설명을 보장하지 않는다는 점은 고위험 VLM 배포와 후학습 평가에 중요한 경고다.

# Method

1. 두 얼굴 이미지를 입력하고 동일인 여부를 판단하도록 하되, 특징별 묘사와 비교, 전체 설명, 0과 1 사이 유사도 점수를 JSON으로 생성하게 한다.
2. Gemma 3, Qwen2.5-VL, InternVL3의 1B~78B 여러 크기를 zero-shot, temperature 0 조건에서 평가한다.
3. LFW, ARFace, Soteria, CelebA에 대해 균형 잡힌 genuine/impostor 쌍과 identity-disjoint 10-fold 프로토콜을 구성한다.
4. 판별 지표로 EER, accuracy, failure-to-acquire(FTA)를 보고한다.
5. 불안정 특징 어휘가 등장한 비율의 여집합을 relevance로, 가려진 부위를 언급한 비율의 여집합을 faithfulness로 정의한다. 유효 JSON을 만들지 못한 경우까지 반영한 end-to-end 설명 품질도 함께 본다.

# Experiments / Results

- 전용 얼굴 인식기 ArcFace 계열은 네 데이터셋에서 EER 0.1~3.0%를 기록해 모든 VLM보다 크게 앞섰다.
- VLM 중 Gemma3-27B가 LFW 5.2%, ARFace 7.1%, Soteria 4.6% EER로 대부분의 데이터셋에서 가장 낮은 오류율을 보였다.
- 작은 모델은 구조화 출력 제약에 특히 취약했다. InternVL3-1B는 데이터셋에 따라 약 27~29%의 FTA를 보였고, Qwen2.5-VL-3B도 자유 형식 출력 대비 EER가 크게 악화됐다.
- 비슷한 판별 성능이 설명 품질까지 같다는 뜻은 아니었다. InternVL3-38B와 Qwen2.5-VL-72B는 유사한 검증 성능을 보였지만 InternVL3-38B의 relevance가 더 낮았다.
- 일부 모델은 특징 항목의 최대 약 20%에서 법과학적으로 불안정한 단서를 사용했고, 가림 데이터셋에서는 최대 약 10%가 보이지 않는 얼굴 부위를 언급했다.
- relevance는 각 계열의 중간 크기 모델에서 가장 좋은 경우가 많았고, faithfulness는 대체로 스케일과 함께 개선됐지만 예외가 있었다.

# Limitations / Discussion

- 어휘집 기반 relevance는 표현 변형과 문맥을 모두 포착하지 못하며, 불안정 단서 위반의 보수적인 하한에 가깝다.
- faithfulness는 ARFace와 Soteria의 가림 주석에 한정되어 흉터를 새로 만들어 내는 등 다른 환각은 측정하지 못한다.
- temperature 0의 단일 결정적 디코딩만 사용해 생성 변동성, 프롬프트 변화, 샘플링 온도의 영향을 다루지 않는다.
- LFW와 CelebA가 VLM 사전학습 데이터에 포함됐을 가능성이 있어 일반화 성능과 암기 효과가 섞일 수 있다.
- 설명이 보이는 안정적 특징을 사실대로 묘사했는지에 대한 세밀한 correctness는 별도 라벨 부족으로 아직 평가하지 못한다.
- 얼굴 생체정보를 다루는 만큼 실제 적용에는 데이터 동의, 편향, 프라이버시, 인간 전문가의 책임 범위를 함께 검토해야 한다.

# 내가 이해한 핵심

이 논문의 가장 큰 기여는 새로운 얼굴 인식 모델이 아니라 **설명을 테스트 가능한 출력으로 바꾸는 평가 설계**다. 자유로운 자연어를 그대로 두고 또 다른 LLM에게 채점시키는 대신, 생성 단계에서 비교 단위를 구조화하고 비교적 단순한 규칙으로 감사를 수행한다. 지표의 범위는 좁지만 실패가 어디서 생겼는지 사람이 추적하기 쉽다.

실무적으로는 정확도 하나만 최적화한 뒤 설명을 덧붙이는 방식보다, 구조화된 근거 스키마와 설명 품질 지표를 학습·배포 파이프라인의 회귀 테스트로 넣는 접근이 더 안전하다. 동시에 구조화 출력 자체가 작은 모델의 판별 성능과 응답 성공률을 떨어뜨릴 수 있으므로, 설명 가능성에는 실제 추론 비용이 따른다는 점도 중요하다.

# 다음에 연결해서 읽을 논문

- [FaithScore: Fine-grained Evaluations of Hallucinations in Large Vision-Language Models](https://aclanthology.org/2024.findings-emnlp.290/): 자유 형식 VLM 응답의 세밀한 환각 평가와 비교하기 좋다.
- [FaceXBench: Evaluating Multimodal LLMs on Face Understanding](https://arxiv.org/abs/2501.10360): 얼굴 이해 전반에서 MLLM 능력을 측정하는 선행 벤치마크다.
- [FaceLLM: A Multimodal Large Language Model for Face Understanding](https://arxiv.org/abs/2507.10300): 얼굴 이해에 특화된 MLLM의 학습 방식과 본 논문의 평가 축을 연결해 볼 수 있다.
