---
title: "PhysCount: Do MLLMs Count Visual Appearances or Physical Entities?"
date: 2026-10-30
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Lidong Lu, Jiaxin Lv, Liangrui Dong, Xinyi Mao, Lidong Zou, Zhenquan Li, Tong Lu, Guo Chen"
paper: "https://arxiv.org/abs/2610.40530"
code: ""
project: "https://physcount.github.io"
thumbnail: "/papers/assets/vlm/physcount-do-mllms-count-visual-appearances-or-physical-entities/physcount-pipeline.svg"
---

# 한 줄 요약

PhysCount는 거울·유리를 통해 한 물체가 여러 번 보이는 장면에서 MLLM이 **보이는 출현 수**와 **실재하는 물리 개체 수**를 구분하는지 측정하며, 최고 모델도 관련 질문 묶음을 모두 맞힌 비율이 13.36%에 그친다는 간극을 드러낸다.

# 논문 정보

- 제목: PhysCount: Do MLLMs Count Visual Appearances or Physical Entities?
- 저자: Lidong Lu, Jiaxin Lv, Liangrui Dong, Xinyi Mao, Lidong Zou, Zhenquan Li, Tong Lu, Guo Chen
- 발표: arXiv:2610.40530v1 (2026-10-29), venue 확인 필요
- 링크: [arXiv 초록](https://arxiv.org/abs/2610.40530), [HTML](https://arxiv.org/html/2610.40530), [PDF](https://arxiv.org/pdf/2610.40530)
- 코드/프로젝트: [공식 프로젝트 페이지](https://physcount.github.io), benchmark는 논문 acceptance 이후 공개 예정이며 공개 저장소는 확인 필요
- 라이선스: [arXiv 비독점 배포 라이선스](https://info.arxiv.org/help/license/index.html#non-exclusive-license-to-distribute)
- 키워드: MLLM evaluation, visual counting, physical grounding, mirror understanding, appearance–entity correspondence, VQA

# 핵심 아이디어

일반적인 visual counting은 화면에서 보이는 target instance를 세면 끝난다고 가정한다. 하지만 한 고양이가 직접 한 번, 거울에 여러 번 나타나거나 유리 너머로 보이면 **appearance**와 **physical entity**가 일대일로 대응하지 않는다. PhysCount는 이 차이를 구조화된 annotation과 서로 연결된 질문 묶음으로 명시한다.

각 image–target group에서 annotator는 모든 target appearance의 위치를 표시하고, 직접 관찰·반사·유리 투과 중 어떤 방식으로 보이는지 분류하며, 같은 실재 개체를 묘사하는 appearance끼리 하나의 identity group으로 묶는다. 여기서 네 종류의 질문을 만든다.

1. 모든 visible appearance를 세는 질문
2. 중복 appearance를 합쳐 physical entity를 세는 질문
3. 직접·반사·투과처럼 특정 image-formation mode를 세는 질문
4. “직접 보이면서 반사에도 나타나는 개체”처럼 appearance–entity correspondence를 계산하는 질문

최종 숫자 하나만 맞히는 평가와 달리 같은 annotation group의 모든 질문을 정확히 풀었는지 보는 Group-Acc를 함께 사용한다. 이 설계는 객체를 찾지 못한 오류와, 찾은 관찰들을 동일한 물리 개체로 잘못 묶은 오류를 분리해 드러낸다.

# VLM 관점에서 중요한 이유

- 동일한 image와 target에서도 질문이 요구하는 **계수 단위**에 따라 정답이 달라진다. 숫자 생성 능력보다 질문 의미와 시각 evidence를 어떤 개체 단위로 조직하는지가 핵심이다.
- reflection과 transmission은 visual token의 개수를 늘리지만 물리 개체를 늘리지는 않는다. VLM이 patch-level evidence를 persistent object representation으로 묶을 수 있는지 직접 검사한다.
- appearance를 정확히 센 group만 남긴 Phys-Gnd도 보고해, perception 성공 뒤의 identity reasoning을 조건부로 평가한다.
- 해상도를 높여도 Group-Acc가 1,024-pixel long edge 이후 7.37%에서 포화된다. 더 많은 pixel이 entity correspondence 문제를 자동으로 해결하지 않는다는 통제 근거다.
- 관련 질문을 함께 제시하면 Qwen3.8-27B Group-Acc가 7.37%에서 23.96%로 +16.59%p 오른다. 같은 scene graph를 일관되게 재사용하는 prompting 또는 memory 설계의 가능성을 보여준다.

# Method

1. Common Canvas, GPIC 등 공개 image collection에서 Qwen3.6-35B-A3B가 mirror·glass 때문에 겉보기 count가 달라지는 후보를 자동 선별하고, 사람이 localizable target과 판정 가능한 장면만 선택한다.
2. image 안의 각 target category마다 별도 annotation group을 만든다. annotator는 모든 appearance의 위치와 direct/reflection/through-glass mode를 기록하고, 같은 물리 개체를 나타내는 appearance에 동일 identity를 부여한다.
3. 첫 annotator가 이 scene representation에서 integer-answer 질문을 작성한다. 두 번째 annotator가 위치·mode·identity를 재검사하고, GPT-5.6 Sol이 구조 annotation과 QA의 일관성을 검사한 뒤 세 번째 annotator가 flagged pair를 최종 교정한다.
4. 한 group에서 appearance, entity, image-formation, correspondence의 네 question family를 생성한다. 전체 benchmark는 546 images, 651 target-specific groups, 4,595 questions, 137 normalized targets이며 599 groups가 네 family를 모두 포함한다.
5. question별 absolute error와 bounded normalized absolute error(NAE)를 계산한다. group-level family accuracy의 곱을 평균한 Score, group의 모든 답이 exact match인 Group-Acc, appearance count가 맞은 group 안에서 나머지 세 family를 평가하는 Phys-Gnd를 함께 보고한다.
6. 40개 proprietary/open-weight MLLM은 기본적으로 같은 image의 질문을 서로 독립적으로 받으며 최대 long edge 4,096 pixels를 사용한다. 별도 분석에서 해상도와 independent/joint question presentation만 바꾼다.

# 핵심 그림

![공개 이미지 후보를 자동·인간 선별하고 각 출현의 위치와 관찰 방식을 표시한 뒤 동일 물리 개체끼리 묶어 네 질문군과 세 평가 지표를 만드는 PhysCount 구성 파이프라인](/papers/assets/vlm/physcount-do-mllms-count-visual-appearances-or-physical-entities/physcount-pipeline.svg)

> 그림 2. 논문 Figure 2, Sections 3.1–3.5와 식 (1)–(2)을 바탕으로 재구성한 PhysCount 데이터 구축·평가 파이프라인. 출처: [arXiv HTML Figure 2 및 Section 3](https://arxiv.org/html/2610.40530#S3). arXiv 비독점 배포 라이선스이므로 원본을 복사하지 않고 한국어 설명도로 재구성했다.

이 그림을 고른 이유는 PhysCount가 새 모델 아키텍처가 아니라 **appearance annotation → image-formation mode → physical identity grouping → 일관성 질문군**으로 이어지는 평가 방법론을 제안하기 때문이다. 입력은 mirror·glass가 포함된 자연 image와 target category다. 먼저 각 visible occurrence를 분리하고 direct/reflection/through-glass label을 붙인 다음, 여러 occurrence가 같은 실재 물체를 나타내면 하나의 identity group으로 합친다.

이 scene representation에서 네 question family가 파생되고, MLLM은 integer answer를 출력한다. NAE는 각 count의 오차를, Score는 family 전반의 균형을, Group-Acc는 한 장면에서 파생된 모든 답의 완전한 일관성을 측정한다. 기존 counting benchmark가 appearance와 entity를 암묵적으로 같은 단위로 취급했다면, PhysCount는 그 사이의 identity edge를 평가 대상으로 끌어낸 것이 핵심 변화다.

# Experiments / Results

- 40개 MLLM과 5명의 인간을 동일한 4,595 image–question protocol에서 평가한다. 인간 평균은 Score 97.10, Group-Acc 95.98인 반면 최고 모델 Gemini 3.7 Flash는 각각 36.45, 13.36이다.
- 최고 모델과 인간의 Group-Acc 차이는 82.62%p다. 개별 질문을 일부 맞히는 것과 동일 scene에서 appearance·entity·formation·correspondence를 모두 일관되게 푸는 것은 크게 다르다.
- Gemini 3.7 Flash의 NAE는 appearance 20.08, entity 27.36, image formation 30.62, correspondence 33.88이다. 같은 visual inventory에서도 identity relation이 더 많이 필요한 family일수록 오차가 커진다.
- Qwen3.8-27B에서 long edge를 512→4,096 pixels로 높이면 Score는 21.04→28.84(+7.80%p)지만 Group-Acc는 5.38→7.37(+1.99%p)이고 1,024 pixels 이후에는 증가하지 않는다.
- 같은 Qwen3.8-27B/4,096-pixel 설정에서 관련 질문을 독립적으로 묻는 대신 group 단위로 함께 묻자 Score는 28.84→40.17(+11.33%p), Group-Acc는 7.37→23.96(+16.59%p), Phys-Gnd는 65.96→78.56(+12.60%p)로 오른다.
- appearance가 하나인 entity와 비교해 한 entity가 네 번 이상 나타나는 bin에서는 40개 모델 중 32개가 더 낮은 Score를 보인다. multiplicity를 맞춘 비교에서도 40개 중 31개가 서로 다른 observation mode 사이의 correspondence에서 더 큰 오차를 낸다.

## 주요 실험 결과

Table 1의 동일 independent-question protocol에서 최고 모델과 인간 평균을 비교했다. Score, Group-Acc, Phys-Gnd는 모두 %, 높을수록 좋으며 차이는 절대 %p다.

| 평가 지표 (%, ↑) | Gemini 3.7 Flash | 인간 5명 평균 | 모델-인간 차이 | 출처    |
| ---------------- | ---------------: | ------------: | -------------: | ------- |
| Score            |            36.45 |         97.10 |       -60.65%p | Table 1 |
| Group-Acc        |            13.36 |         95.98 |       -82.62%p | Table 1 |
| Phys-Gnd         |            73.00 |         99.49 |       -26.49%p | Table 1 |

Group-Acc의 82.62%p 격차가 가장 크다. 이는 최고 모델도 한 annotation group의 모든 파생 count를 동시에 일관되게 맞히지 못함을 뜻한다. Phys-Gnd는 appearance count를 이미 맞힌 group만 남긴 조건부 지표이므로 전체 성공률처럼 해석하면 안 된다.

Table 3은 model·resolution·generation 설정을 고정하고 질문 제시 방식만 비교한다.

| Qwen3.8-27B, 4,096 px 지표 (%, ↑/↓) | Joint | Independent |     차이 | 출처    |
| ----------------------------------- | ----: | ----------: | -------: | ------- |
| Entity NAE (↓)                      | 26.26 |       32.42 |  -6.16%p | Table 3 |
| Correspondence NAE (↓)              | 33.39 |       44.68 | -11.29%p | Table 3 |
| Score (↑)                           | 40.17 |       28.84 | +11.33%p | Table 3 |
| Group-Acc (↑)                       | 23.96 |        7.37 | +16.59%p | Table 3 |
| Phys-Gnd (↑)                        | 78.56 |       65.96 | +12.60%p | Table 3 |

Joint presentation의 가장 큰 이득은 Group-Acc +16.59%p와 correspondence NAE -11.29%p다. 다만 image-formation NAE는 29.66에서 32.76으로 3.10%p 악화되므로, 모든 세부 능력이 동시에 좋아진 것은 아니다.

# Limitations / Discussion

- benchmark가 mirror와 glass처럼 appearance–entity 불일치가 명확한 자연 image에 집중한다. occlusion, viewpoint 변화, video에서의 장기 object permanence까지 직접 평가하지 않는다.
- 546 images와 651 target groups는 정밀 annotation에는 유용하지만, 137 target의 장꼬리 분포와 domain별 표본 수 때문에 세부 category 차이를 안정적으로 추정하기에는 작을 수 있다.
- independent 질문과 joint 질문은 정보 조건 자체가 다르다. joint 성능 향상은 entity reasoning 개선뿐 아니라 관련 질문이 서로 힌트를 제공한 효과도 포함한다.
- Phys-Gnd는 appearance 질문을 맞힌 group이 모델마다 달라 model 간에 완전히 동일한 subset을 비교하는 지표가 아니다.
- candidate screening과 QA consistency check에 각각 Qwen3.6-35B-A3B와 GPT-5.6 Sol을 사용했다. 사람이 최종 판정했지만 특정 모델의 선별 편향이 후보 pool과 질문 표현에 남을 가능성이 있다.
- 논문은 완전한 benchmark를 acceptance 이후 공개한다고 밝힌다. 현재 공개 artifact만으로 전체 4,595문항과 evaluation script를 독립 재현할 수 있는지는 확인 필요다.
- top-conference venue는 확인되지 않았다. arXiv v1의 결과이며 후속 version에서 모델 목록·수치·공개 정책이 바뀔 수 있다.

# 내가 이해한 핵심

이 논문의 핵심은 counting을 detection 뒤의 단순 합산으로 보지 않고 **관찰 그래프 위의 quotient operation**으로 바꿔 본 데 있다. appearance node를 모두 찾은 뒤 “같은 실재 개체”라는 identity edge로 연결된 node들을 하나의 equivalence class로 접어야 entity count가 나온다. reflection count, direct∩reflection count 같은 질문은 같은 그래프에서 node label과 equivalence class 사이의 집합 연산으로 계산된다.

따라서 더 높은 resolution이 appearance node를 잘 찾게 해도 identity edge가 좋아진다는 보장은 없다. Table 2에서 Group-Acc가 일찍 포화되는 이유와 Table 3에서 joint questioning이 크게 도움 되는 이유가 이 관점에서 연결된다. 후자는 모델이 여러 질문을 통해 하나의 shared scene graph를 암묵적으로 유지하도록 유도하기 때문이다. 다음 단계는 최종 숫자만 내게 하기보다 appearance location, mode, identity link를 구조적으로 출력하고 각각을 검증하는 모델·평가가 될 가능성이 크다.

# 다음에 연결해서 읽을 논문

- [MirrorQA: Benchmarking Multimodal LLMs on Mirror-Orientation Reasoning](https://aclanthology.org/2026.acl-long.1975/) — 거울 장면의 좌우 방향 변환을 평가하며 PhysCount의 identity grouping과 보완적인 실패 축을 제공한다.
- [CAPTURe: Evaluating Spatial Reasoning in Vision Language Models via Occluded Object Counting](https://arxiv.org/abs/2503.06229) — 보이는 occurrence가 아니라 가려진 실재 물체를 추론하는 counting benchmark다.
- [UNICBench: Unified Counting Benchmark for MLLMs](https://arxiv.org/abs/2603.06492) — image·video·audio-visual counting을 포괄하지만 counting unit의 identity correspondence는 PhysCount가 더 명시적으로 분해한다.
- [TRIAD: Benchmarking Omni-Modal Ambiguity in Multimodal Large Language Models](/papers/vlm/triad-benchmarking-omni-modal-ambiguity-in-multimodal-large-language-models) — 개별 modality evidence와 결합된 scene-level answer의 일관성을 group 단위로 평가한다는 점에서 연결된다.
