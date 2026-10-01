---
title: "Exemplar2VQA: A Scalable Exemplar-Driven Visual Question Answering Generation Framework via Multi-Agent Coding"
date: 2026-10-01
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "NeurIPS 2026"
authors: "Jiayu Ying, Qijian Tian, Ruijie Xu, Xinnan Zhu, Daoguo Dong, Jiachen Xu, Xin Tan"
paper: "https://arxiv.org/abs/2609.37655"
code: "https://github.com/yingjiayu12/Exemplar2VQA"
project: ""
thumbnail: "/papers/assets/vlm/exemplar2vqa-scalable-exemplar-driven-visual-question-answering-generation/exemplar2vqa-pipeline.svg"
---

# 한 줄 요약

Exemplar2VQA는 공간 질문 예시 하나를 여러 코딩 에이전트와 결정론적 기하 API로 실행 가능한 생성기로 바꿔, LLM의 공간 환각을 줄이면서 대규모 3D VQA 학습 데이터를 만든다.

# 논문 정보

- 제목: Exemplar2VQA: A Scalable Exemplar-Driven Visual Question Answering Generation Framework via Multi-Agent Coding
- 저자: Jiayu Ying, Qijian Tian, Ruijie Xu, Xinnan Zhu, Daoguo Dong, Jiachen Xu, Xin Tan
- 발표: NeurIPS 2026
- 링크: [arXiv:2609.37655](https://arxiv.org/abs/2609.37655)
- 코드/프로젝트: [공식 GitHub](https://github.com/yingjiayu12/Exemplar2VQA)
- 키워드: VQA generation, spatial reasoning, MLLM, multi-agent coding, synthetic data, sim-to-real

# 핵심 아이디어

공간 VQA 데이터를 LLM이 문장으로 직접 답하게 만들면 거리, 방향, 가림, 시점 변환에서 그럴듯한 오답이 섞인다. Exemplar2VQA는 LLM에게 정답 계산을 맡기지 않고 **계산 절차를 코드로 작성하게 한 뒤**, 시뮬레이터 메타데이터와 검증된 기하 API가 정답을 계산하도록 역할을 분리한다.

1. 사용자는 원하는 질문 유형을 보여 주는 공간 QA exemplar를 제공한다.
2. Camera track은 장면을 어떻게 촬영할지 계획하고 AI2-THOR에서 multi-view 관측을 수집한다.
3. QA track은 exemplar의 고유 객체와 수치를 변수로 추상화하고, 기하 API를 호출하는 Python 생성기를 작성한다.
4. 두 track 모두 Architect, Coder, Reviewer, Refiner의 네 역할로 나뉜다. 실행 오류와 물리 충돌은 traceback을 근거로 반복 수정한다.
5. 완성된 코드는 장면 메타데이터의 객체 조합을 순회해 질문과 결정론적 정답을 대량 생성한다.

# VLM 관점에서 중요한 이유

이 연구는 합성 VLM 데이터의 품질 문제를 더 강한 teacher model로 해결하지 않는다. 언어 모델은 질문의 의미와 프로그램 구조를 해석하고, 연속 공간의 수학은 코드와 도구가 담당한다. 즉 **신경 모델의 애매한 추론과 기호 실행의 정확성을 조합하는 데이터 엔진**이다.

또한 실내 합성 데이터로만 Qwen2.5-VL을 미세조정했는데 실제 영상 기반 VSI-Bench와 outdoor·mixed-scene benchmark까지 개선되었다. 이는 공간 관계의 계산 규칙이 렌더링 스타일보다 전이 가능할 수 있음을 보여 준다. 반면 원시 현실 이미지에서 장면 메타데이터를 얻는 문제는 해결하지 않았으므로, 실제 데이터 자동화의 전체 파이프라인이라기보다 정확한 정답 생성 계층에 가깝다.

# Method

1. **Exemplar parsing:** QA Architect가 구체적 객체명, 개수, 시점, 비교 대상을 placeholder로 치환해 일반화된 schema를 만든다.
2. **Camera generation:** Camera Architect가 자연어 촬영 요구를 JSON trajectory로 바꾸고, Camera Coder가 $SE(3)$ pose를 계산하는 Python 코드를 만든다. AI2-THOR 실행 중 충돌이나 경계 이탈이 생기면 Reviewer와 Refiner가 수정한다.
3. **QA generation:** QA Coder는 scene metadata의 3D bounding box, camera pose, visibility를 입력받아 질문을 인스턴스화하고 정답을 계산하는 코드를 만든다.
4. **Geometric API:** 3D footprint 투영, 평면 각도, 상대 방향, 투영 거리, bounding-box 거리, 애매한 축 근처 각도 제거 등을 함수로 제공한다. LLM은 함수를 조합하고 실제 산술은 실행기가 담당한다.
5. **Quality filtering:** `is_angle_ambiguous` 같은 검사를 통과하지 못한 경계 사례는 QA로 만들지 않는다.
6. **Training:** 생성한 indoor 데이터만으로 Qwen2.5-VL-3B는 SFT, 7B는 LoRA 학습한다. VSI-Bench용 multi-view 이미지는 연속 회전 영상으로 변환하며, MMSI-Bench는 multi-image 형식을 유지한다.

# 핵심 그림

![공간 QA 예시가 카메라 생성과 QA 생성의 두 트랙을 거쳐 검증된 학습 데이터로 확장되는 Exemplar2VQA 설명도](/papers/assets/vlm/exemplar2vqa-scalable-exemplar-driven-visual-question-answering-generation/exemplar2vqa-pipeline.svg)

_논문 Figure 1·2와 Section 3을 바탕으로 재구성._ 한 개의 exemplar가 두 개의 독립된 4-agent track과 결정론적 기하 API를 거쳐 대규모 QA 데이터가 되는 흐름을 요약한다. 정성 예시보다 이 구조가 논문의 핵심인 "의미 해석은 agent, 공간 계산은 실행기"라는 경계를 가장 잘 보여 주므로 선택했다. 출처: [논문 Figure 1·2 및 Section 3](https://arxiv.org/html/2609.37655v1). 원 논문은 CC BY 4.0이지만, 흐름을 한국어로 명확히 전달하기 위해 직접 재구성했다.

# Experiments / Results

- MMSI-Bench는 1,000개 multi-image 선택형 질문, VSI-Bench는 288개 실제 영상에서 만든 5,000개 이상의 QA로 평가한다.
- 논문 Table 1에서 Qwen2.5-VL-7B 기반 Exemplar2VQA의 MMSI-Bench Overall은 28.2로 base 25.9보다 2.3%p 높다. 다만 일부 세부 범주에서는 하락하므로 모든 공간 능력이 균일하게 좋아진 것은 아니다.
- Table 3의 SpaCE-10 zero-shot Overall은 42.2로 동일 base 33.3보다 8.9%p 높아, 합성 indoor supervision이 다른 공간 benchmark로 전이됨을 보인다.
- Table 5에서 네 역할을 하나의 agent에 합치면 QA 생성 성공률은 34.0%이지만, Architect·Coder·Reviewer·Refiner를 분리하면 92.0%로 58.0%p 상승한다. Camera trajectory도 60.0%에서 84.0%로 24.0%p 상승한다.
- Table 6에서 Gemini3.5-Flash 직접 annotation은 평균 28.2로 base 35.3보다 7.1%p 낮아졌다. 코드 실행 기반 Exemplar2VQA는 42.9로 base보다 7.6%p, 직접 annotation보다 14.7%p 높다.

## 주요 실험 결과

논문 Table 6의 통제된 비교를 옮겼다. 세 방법 모두 Qwen2.5-VL-3B를 기반으로 하고, 10K synthetic training examples와 VSI-Bench multiple-choice subset, 동일 fine-tuning 설정을 사용한다. 값은 정확도(%, 높을수록 좋음)이며 차이는 Exemplar2VQA에서 각 비교 기준을 뺀 절대 %p다.

| 방법 / VSI-Bench 설정 (정확도 %, ↑) | Relative Distance | Relative Direction | Route Plan | Appearance Order | 평균 | Exemplar2VQA와 평균 차이 |
| ----------------------------------- | ----------------: | -----------------: | ---------: | ---------------: | ---: | -----------------------: |
| Qwen2.5-VL-3B Base                  |              34.7 |               42.6 |       28.9 |             35.0 | 35.3 |                   +7.6%p |
| Gemini3.5-Flash 직접 annotation     |              31.7 |               40.4 |       34.5 |              6.3 | 28.2 |                  +14.7%p |
| Exemplar2VQA                        |              43.8 |               52.1 |       35.1 |             40.5 | 42.9 |                        — |

직접 annotation은 Route Plan만 base보다 좋아지고 Appearance Order에서 28.7%p 하락한다. 반면 코드 기반 정답은 네 범주 모두 base를 넘어선다. 단순히 더 많은 합성 문장을 만드는 것보다, cross-view consistency와 기하 계산을 실행 가능한 규칙으로 고정하는 편이 중요하다는 결과다. 원자료: [논문 Table 6 및 Section 4.5](https://arxiv.org/html/2609.37655v1).

# Limitations / Discussion

- 현재 범위는 정적이고 object-centric한 공간 관계에 집중한다. 연속 동작 추적 같은 dynamic spatiotemporal event는 다루지 않는다.
- 정답 계산에는 시뮬레이터가 제공하는 명시적 3D scene metadata가 필요하다. raw real-world image만으로 같은 데이터를 만들려면 upstream perception model이 추가되어야 한다.
- 생성 성공률은 기반 coding LLM의 능력에 묶여 있다. 복잡한 algorithmic edge case와 physics-engine glitch에서는 네 agent 구조도 실패한다.
- Table 5의 성공률은 100개 seed example에서 측정되어, 더 다양한 exemplar와 장면에서의 신뢰구간은 불분명하다.
- 합성 indoor data에서 outdoor benchmark로 전이가 관찰됐지만, 문화권·건축 양식·객체 분포가 크게 다른 현실 환경까지 일반화된다는 보장은 없다.
- 고차 객체 관계는 최악의 경우 객체 수 $M$에 대해 $O(M^4)$ enumeration이 될 수 있다. 논문 환경에서는 방당 관측 객체가 약 20개라 100개 장면 QA 인스턴스화가 약 25초였지만, 밀집 장면에서는 병목이 될 수 있다.

# 내가 이해한 핵심

Exemplar2VQA의 중요한 선택은 "LLM이 공간 추론을 잘하도록 프롬프트를 고치는 것"이 아니라 **LLM이 공간 추론을 직접 하지 못하게 경계를 그은 것**이다. agent는 자연어 의도를 코드와 API 호출 순서로 번역하고, 정답은 검증 가능한 수학 실행에서 나온다.

이 관점은 VLM 데이터 생성 전반에 확장할 수 있다. OCR 좌표, 문서 layout, temporal alignment처럼 외부 도구가 더 정확한 부분은 tool execution으로 고정하고, VLM/LLM은 schema induction과 예외 처리에 집중시키는 편이 teacher annotation보다 안정적일 수 있다. 다만 tool이 볼 수 없는 현실 신호는 여전히 perception error에 노출되므로, 실제 적용에서는 metadata 추출의 uncertainty까지 정답에 전파해야 한다.

# 다음에 연결해서 읽을 논문

- [Thinking in Space: How Multimodal Large Language Models See, Remember, and Recall Spaces](https://arxiv.org/abs/2412.14171): VSI-Bench와 video-based spatial intelligence의 문제 설정을 이해하기 좋다.
- [MMSI-Bench: A Benchmark for Multi-Image Spatial Intelligence](https://arxiv.org/abs/2505.23764): Exemplar2VQA의 주요 multi-image 평가 축과 질문 taxonomy를 제공한다.
- [ViewSpatial-Bench: Evaluating Multi-Perspective Spatial Localization in Vision-Language Models](https://arxiv.org/abs/2505.21500): 사람·객체 시점 변화에 대한 zero-shot 전이를 비교할 수 있다.
- [Program-Aided Language Models](https://arxiv.org/abs/2211.10435): 언어 모델이 계산을 직접 수행하지 않고 프로그램으로 위임하는 설계의 선행 맥락이다.
