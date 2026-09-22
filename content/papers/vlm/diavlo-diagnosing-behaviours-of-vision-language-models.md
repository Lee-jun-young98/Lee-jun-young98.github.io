---
title: "DiaVLo: Diagnosing Behaviours of Vision-Language Models"
date: 2026-09-21
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "Findings of EMNLP 2026"
authors: "Lorenzo Corti, Jie Yang"
paper: "https://arxiv.org/abs/2609.22008"
code: ""
project: "https://lcorti.github.io/publications/"
---

# 한 줄 요약

사람이 검수한 기대 행동과 VLM이 스스로 설명한 관찰 행동을 비교하고, 반사실적 이미지와 인과 추정으로 어떤 시각 개념이 답변을 움직였는지 진단하는 프레임워크다.

# 논문 정보

- 제목: DiaVLo: Diagnosing Behaviours of Vision-Language Models
- 저자: Lorenzo Corti, Jie Yang
- 발표: Findings of EMNLP 2026
- 링크: [arXiv:2609.22008](https://arxiv.org/abs/2609.22008)
- 코드/프로젝트: [저자 논문 목록](https://lcorti.github.io/publications/) (공개 코드 저장소 링크는 확인 필요)
- 키워드: vision-language model, model diagnosis, VQA, explainability, causal inference, scene graph, counterfactual

# 핵심 아이디어

일반 벤치마크는 정답률을 알려 주지만, 모델이 사람과 같은 시각 개념과 관계를 사용해 답했는지는 설명하지 못한다. DiaVLo는 이를 **SHOULD-KNOW(SK)**와 **REALLY-KNOW(RK)**라는 두 행동 명세로 분리한다.

- SK는 이미지에서 추출한 장면 그래프를 사람이 질문에 맞게 검증·보완한 기대 행동이다.
- RK는 VLM이 답변 근거를 관계 삼중항 형태로 다시 말하게 해 얻은 관찰 행동이다.
- 두 집합을 문장 임베딩 유사도로 대응시켜 행동을 Aligned, Expanded, Divergent로 분류한다.
- RK에 등장한 개념을 이미지에서 가리거나 바꾼 반사실적 입력을 만들고 Double Machine Learning으로 답변에 대한 개념별 인과 효과를 추정한다.

따라서 단순히 답이 맞았는지를 넘어, 모델이 무엇을 보고 어떤 관계를 구성했으며 인간의 기대와 어디에서 갈라졌는지를 표면화한다.

# VLM 관점에서 중요한 이유

VLM은 높은 정답률을 내더라도 시각 정보 대신 언어 사전지식에 기대거나, 객체는 맞게 인식하면서 관계를 다르게 조합할 수 있다. DiaVLo는 이 차이를 행동 명세로 드러내므로 정확도와 시각적 근거 사이의 간극을 분석하는 도구가 된다.

특히 모델이 생성한 자연어 설명을 그대로 신뢰하지 않고, 장면 그래프·인간 검수·반사실적 개입·인과 추정을 함께 사용한다는 점이 중요하다. 완전한 내부 해석은 아니지만, 배포 전 실패 유형을 사람이 읽을 수 있는 개념 수준에서 회귀 테스트하는 실용적 방향을 제시한다.

# Method

1. IETrans 장면 그래프 생성기로 이미지의 객체와 관계 삼중항을 추출한다.
2. 크라우드 작업자가 질문과 이미지에 비추어 삼중항을 검증하고 누락된 관계를 추가해 SK를 만든다.
3. VLM에게 답변과 근거를 생성하게 한 뒤, 근거를 같은 삼중항 형식으로 구조화해 RK를 얻는다.
4. 정확 문자열 일치, OWLv2 기반 시각 개념 위치 확인, 의미 임베딩 유사도를 순차적으로 사용해 SK와 RK를 대응시킨다.
5. 집합 크기와 코사인 유사도 임계값을 바탕으로 행동을 Aligned, Expanded, Divergent로 분류한다.
6. RK 개념을 가린 반사실적 이미지를 만들고 DoWhy/EconML의 Double Machine Learning으로 개념이 출력 토큰에 미치는 효과를 추정한다.
7. 행동 유사도와 실제 성능의 관계는 부트스트랩한 상호정보량으로 평가하고, 인과 효과는 100개 무작위 데이터 분할의 중앙값으로 보고한다.

# Experiments / Results

- InternVL2-8B, LLaVA-1.6-7B, Qwen2.5-VL-7B, ShareGPT4V-7B를 LLaVA-Bench, MMBench, SEED-Bench 2, VQA v2에서 평가했다.
- 520명의 크라우드 작업자가 SK를 검수했으며, 최종 SK 가운데 전문가가 사소한 오류를 다시 고친 비율은 데이터셋별 최대 약 11%였다.
- 총 1,996개 초기 샘플 가운데 1,754개에서 RK를 추출했다. 약 12%는 빈 응답이나 불안정한 지시 수행 때문에 손실됐다.
- 분류된 행동 중 Aligned는 6.4%에 그쳤고, Expanded 52.5%, Divergent 41.1%였다. 모델은 사람보다 객체 속성을 나열하는 데 치우치고 공간적·구성적 관계를 다르게 조직하는 경향을 보였다.
- SK-RK 유사성과 실제 성능 사이의 상호정보량은 무작위 순열 기준보다 유의미했으며, 특히 InternVL2와 LLaVA-1.6에서 행동 명세가 성능을 비교적 잘 설명했다.
- 개념별 인과 효과는 대체로 0 부근에 몰렸지만 일부 개념은 뚜렷한 효과를 보였다. 객관식 데이터에서는 무관한 개념이 활성화되는 것으로 해석할 수 있는 0 효과가 더 많이 나타났다.
- 충분한 반사실 샘플이 약 100개 이상 확보된 경우 RK 기반 인과 그래프는 구조 반증 테스트를 통과했지만, 표본이 적으면 검정력이 낮아 결론이 불확실했다.

# Limitations / Discussion

- RK는 모델의 자기 설명에 의존한다. 인과 검증을 덧붙여도 자기 설명이 실제 내부 계산에 충실하다는 보장은 없다.
- SK 생성에 사람의 검수가 필요해 데이터셋마다 비용이 들고, 대규모 평가로 확장하기 어렵다.
- 평가 모델이 모두 7B~8B 오픈소스 VLM이므로 더 큰 모델과 폐쇄형 모델에 결과를 그대로 일반화할 수 없다.
- 모델이 빈 응답을 내거나 요구된 삼중항 형식을 따르지 않는 문제가 있어 약 12%의 샘플을 잃었다.
- 행동 임계값, OWLv2 위치 추정, 이미지 가림 방식에 따라 SK-RK 대응과 인과 추정이 달라질 수 있다.
- RK를 인과 그래프로 보는 가정에 대한 구조 검정과 위약 검정은 일부 설정에서 결론적이지 않았다.

# 내가 이해한 핵심

이 논문의 핵심은 설명 문장을 그럴듯함으로 평가하는 대신, **모델이 사용했다고 주장하는 개념 관계를 사람이 기대한 개념 관계와 비교 가능한 데이터 구조로 바꾼 것**이다. 그 결과 정답 여부만으로는 보이지 않던 “대상을 인식했지만 관계를 다르게 구성함”, “질문에 필요한 관계보다 묘사 가능한 속성을 우선함” 같은 실패를 구분할 수 있다.

다만 DiaVLo는 모델 내부를 직접 읽는 기계적 해석 도구라기보다, 생성된 설명과 반사실적 행동을 결합한 시스템 수준 진단에 가깝다. 따라서 인과 효과를 내부 회로의 진실로 받아들이기보다는, 재현 가능한 실패 가설을 만들고 추가 실험 대상을 좁히는 신호로 사용하는 것이 적절하다.

# 다음에 연결해서 읽을 논문

- [Eyes Wide Shut? Exploring the Visual Shortcomings of Multimodal LLMs](https://arxiv.org/abs/2401.06209): VLM이 시각 표현을 충분히 활용하지 못하는 문제를 성능 관점에서 연결해 볼 수 있다.
- [FaithScore: Fine-grained Evaluations of Hallucinations in Large Vision-Language Models](https://aclanthology.org/2024.findings-emnlp.290/): 생성 답변의 세밀한 사실성 평가와 DiaVLo의 행동 진단을 비교하기 좋다.
- [On Measuring Faithfulness or Self-consistency of Natural Language Explanations](https://aclanthology.org/2024.acl-long.329/): 자기 설명의 충실성 한계를 이해하는 데 직접 연결된다.
