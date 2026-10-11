---
title: "OmniCapBench: A Deep-Structured Evaluation Framework for Fine-Grained Audio-Visual Captioning"
date: 2026-10-11
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "NeurIPS 2026 (Evaluations & Datasets Track)"
authors: "Zhongyu Yang, Jiale Tao, Ruitao Chen, Zuhao Yang, Yingfang Yuan, Xueliang Zhao, Auden, Kai Wang, Shuai Shao, Biao Wang, Steve Yves, Qinglin Lu"
paper: "https://arxiv.org/abs/2610.12458"
code: ""
project: "https://01yzzyu.github.io/OmniCapBench/"
thumbnail: "/papers/assets/vlm/omnicapbench-deep-structured-audio-visual-captioning-evaluation/omnicapbench-evaluation-pipeline.svg"
---

# 한 줄 요약

OmniCapBench는 자유형 오디오·비디오 캡션을 하나의 점수로 채점하지 않고 참조 개체·시각 shot·오디오 event의 원자 단위로 생성하게 한 뒤, 구조는 결정적 규칙으로 검증하고 의미는 정렬된 쌍에 한정해 판정함으로써 정체성 붕괴·시간 오정렬·음원-화면 오결합을 각각 드러내는 진단형 벤치마크다.

# 논문 정보

- 제목: OmniCapBench: A Deep-Structured Evaluation Framework for Fine-Grained Audio-Visual Captioning
- 저자: Zhongyu Yang, Jiale Tao, Ruitao Chen 외 9명 (Tencent Hunyuan, Nanyang Technological University, Northumbria University)
- 발표: NeurIPS 2026 Evaluations & Datasets Track. [NeurIPS 공식 Downloads 목록](https://neurips.cc/Downloads/2026), [공식 프로젝트 페이지](https://01yzzyu.github.io/OmniCapBench/), [OpenReview](https://openreview.net/forum?id=WgEmdr50mC)에서 확인했다.
- 링크: [arXiv:2610.12458](https://arxiv.org/abs/2610.12458), [HTML 논문](https://arxiv.org/html/2610.12458)
- 코드/프로젝트: [프로젝트 페이지](https://01yzzyu.github.io/OmniCapBench/), [Hugging Face 데이터셋](https://huggingface.co/datasets/OmniCapBench/OmniCapBench). 프로젝트가 연결한 GitHub 저장소는 2026-10-11 확인 시 404여서 공개 코드 주소는 frontmatter에 확정하지 않았다.
- 키워드: audio-visual captioning, omnimodal MLLM, structured evaluation, temporal grounding, identity tracking, cross-modal alignment

# 핵심 아이디어

기존 오디오·비디오 캡션 평가는 두 선택지 사이에서 흔들린다. 전체 문장을 LLM judge에 맡기면 영상 전반을 다루지만 어떤 오류가 점수를 깎았는지 알기 어렵다. QA probe는 국소 오류를 찾지만 영상의 모든 내용을 덮지 못하고, 질문 생성·정보 추출·판정을 한 LLM에 맡기면서 judge에 따라 결론이 바뀐다.

OmniCapBench는 평가 대상 자체를 자유형 문장에서 세 종류의 원자 단위 집합으로 바꾼다.

1. **References $\mathcal{R}$**: 사람·사물·장면에 영상 전체에서 유지되는 ID를 부여한다.
2. **Events $\mathcal{E}$**: 대화와 비언어 소리를 연속 시간 구간으로 기록한다.
3. **Shots $\mathcal{H}$**: 시각 timeline을 shot/subshot으로 나누고 reference와 event를 해당 구간에 cross-link한다.

모델은 $\hat{\mathcal{S}}(V)=(\hat{\mathcal{R}},\hat{\mathcal{E}},\hat{\mathcal{H}})$ 형태의 JSON을 직접 출력한다. 잘못된 ID, 역전된 시간 구간, 존재하지 않거나 시간상 불가능한 연결은 규칙으로 제거한다. 남은 단위만 tIoU 또는 제한된 local matcher로 정답과 맞춘 후, LLM은 정렬된 작은 의미 필드의 동등성만 판정한다. 구조 판정과 의미 판정을 분리한 것이 핵심이다.

# VLM 관점에서 중요한 이유

이 벤치마크는 “캡션이 자연스러운가”가 아니라 **VLM이 시청각 세계를 내부적으로 일관된 그래프로 만들었는가**를 묻는다. 개체를 한 번 알아보는 것과 장면 전환 뒤에도 같은 개체로 유지하는 것, 소리를 인식하는 것과 그 소리를 내는 화면 속 대상을 연결하는 것은 서로 다른 능력이다. 기존 단일 점수는 이 차이를 숨기지만 Reference–Event–Shot 구조는 각각 CCC, Event F1, EVSA F1로 분리한다.

결과도 이 분해의 필요성을 보여준다. 가장 좋은 기본 지각 점수는 높아도 cross-shot identity consistency는 37.81% 이하였고, Gemini 3.1-Pro조차 Event F1 63.32%에서 EVSA F1 51.46%로 11.86%p 떨어진다. 즉 최신 omnimodal 모델도 오디오와 비디오를 “동시에 처리”하는 것과 둘을 올바른 시간·개체 관계로 묶는 것 사이에 큰 간극이 있다.

# Method

## 1. 벤치마크 구축

Stage I은 공개 데이터와 플랫폼의 후보에서 오디오 존재 여부, 길이, 품질, 사건 밀도를 기준으로 시청각 정보가 충분한 영상을 고른다. 최종 786개 영상은 총 12.8시간이며 1분 미만 482개, 1–3분 228개, 3–5분 76개다.

Stage II는 $\mathcal{R}\rightarrow\mathcal{E}\rightarrow\mathcal{H}$ 순서로 5,818개 reference, 6,537개 event, 11,419개 shot, 39,160개 subshot을 만든다. 각 단계는 **생성 → evaluator ensemble과 programmatic validator → 구조를 고정한 local refinement → 최종 선택**을 반복한다. 구조가 검증된 뒤에는 ID·시간 경계·cross-link를 바꾸지 않고 설명만 다듬어 문장 개선 과정이 새 hallucination을 넣지 못하게 한다.

Stage III은 schema, timestamp, cross-link를 프로그램으로 재검사하고 경계·의미 불일치를 사람이 표적 감사한다. 원본 동영상은 재배포하지 않고 구조 annotation과 원본 URL을 제공한다.

## 2. 구조 우선 평가 계약

평가는 세 단계다.

1. 모델이 자유형 문장 대신 세 prediction track을 native JSON으로 생성한다.
2. 결정적 규칙이 schema와 참조 관계를 검증한다. shot/event는 tIoU로, reference/subshot은 비교 후보가 제한된 LLM matcher로 one-to-one 정렬한다.
3. 구조적으로 정렬된 unit만 local LLM judge에 보낸다. 정답→예측 방향은 누락을 벌점으로 주는 recall, 예측→정답 방향은 hallucination을 벌점으로 주는 precision이다.

Visual 지표는 Ref Subject/Scene F1, RefUse, Cross-Shot Coreference Consistency(CCC), Shot/Subshot F1와 tIoU다. Audio는 Event F1/tIoU와 대화·비대화 의미 점수, Audio-Visual은 speaker attribution과 Event-Shot Association(EVSA) F1을 사용한다. SGC는 다른 점수에 섞는 평균 항목이 아니라 JSON schema 준수 여부를 보는 독립 관문이다.

# 핵심 그림

![오디오·비디오 입력을 Reference, Event, Shot 원자 단위로 생성한 뒤 결정적 구조 검증과 제한된 의미 판정을 거쳐 세부 진단 지표를 산출하는 OmniCapBench 평가 파이프라인 재구성도](/papers/assets/vlm/omnicapbench-deep-structured-audio-visual-captioning-evaluation/omnicapbench-evaluation-pipeline.svg)

_논문 Figure 1, Figure 2와 Sections 3.1–3.2를 바탕으로 재구성._ 데이터 수집 그림보다 **평가 시 입력→구조화 출력→검증→진단 지표** 흐름이 VLM 사용자가 방법의 차이를 더 직접 이해하게 하므로 평가 아키텍처를 선택했다. 출처: [논문 Figure 1과 Section 3](https://arxiv.org/html/2610.12458#S3), [공식 프로젝트의 평가 설명](https://01yzzyu.github.io/OmniCapBench/). 원문은 CC BY 4.0이며, 한국어 설명과 train/evaluation 경계를 명확히 하기 위해 직접 재구성했다.

그림의 위쪽은 benchmark 제작 흐름이다. 후보 영상을 거른 뒤 Reference→Event→Shot 순서로 정답 구조를 만들고, 자동 검증과 사람 감사를 통과한 $\mathcal{S}^{\star}(V)$를 고정한다. 아래쪽 평가 흐름에서는 모델이 동일한 세 track의 예측 $\hat{\mathcal{S}}(V)$를 출력한다. 결정적 validator가 ID·시간·cross-link 오류를 먼저 제거하고, 정렬된 unit만 bounded LLM judge가 의미 비교한다. 기존 global judge와 달리 LLM이 긴 문장을 역파싱하거나 전체 관계를 한 번에 추론하지 않으며, 최종 출력은 단일 caption score가 아니라 identity·temporal·audio·cross-modal 실패의 위치별 지표다.

# Experiments / Results

- proprietary 6개, open-source 3개의 omnimodal MLLM을 786개 영상에서 평가한다. 구조화 instruction을 따르기 어려운 specialized free-form captioner는 본표에서 제외하고 별도 분석한다.
- 기본 지각과 장기 결합 사이의 격차가 크다. Gemini 2.5-Pro의 전체 Ref Subject F1은 80.70%지만 CCC는 37.81%다. sub-minute subset에서도 Ref Subject F1 84.80%에 비해 CCC가 낮아, 개체 발견과 장면 간 동일성 유지가 다른 병목임을 보인다.
- Gemini 3.1-Pro는 Event F1 63.32%, EVSA F1 51.46%로 음향 사건을 찾은 뒤 화면과 결합할 때 11.86%p를 잃는다. Qwen3-Omni-Instruct는 41.70%→13.33%로 28.37%p, Seed2.0은 4.54%→3.52%로 낮다.
- open-source 최고 CCC는 Qwen3-Omni-Captioner 11.51%이고 최고 EVSA F1도 17.42%다. schema 준수율은 89.02–90.77%인데 관계 지표가 낮으므로, 단순 JSON 형식 실패만으로 결과를 설명할 수 없다.
- Table 5의 judge sensitivity에서 weak→strong judge 변화량은 holistic 22.68%p, QA 7.68%p, OmniCapBench 1.42%p다. 구조를 먼저 고정하고 의미 판정을 local pair에 제한하면 judge 교체에 따른 순위·점수 흔들림이 크게 줄어든다는 근거다.

## 주요 실험 결과

아래 값은 논문 Table 3의 동일 benchmark·동일 macro-average 설정에서 직접 대조했다. `Event→EVSA 차이`는 EVSA F1에서 Event F1을 뺀 절대 차이(%p)이며, 음향 사건 검출 뒤 시각 shot과 결합할 때의 추가 손실을 보여준다. SGC, CCC, Event F1, EVSA F1은 모두 백분율 점수(↑)다.

| 모델 / 설정 (%, ↑)   |   SGC |   CCC | Event F1 | EVSA F1 | Event→EVSA 차이 | 출처    |
| -------------------- | ----: | ----: | -------: | ------: | --------------: | ------- |
| Gemini 3.1-Pro       | 97.36 | 34.43 |    63.32 |   51.46 |        -11.86%p | Table 3 |
| Gemini 2.5-Pro       | 96.73 | 37.81 |    58.52 |   43.74 |        -14.78%p | Table 3 |
| Qwen3.5-Omni-Plus    | 96.09 | 29.55 |    53.92 |   40.20 |        -13.72%p | Table 3 |
| Qwen3-Omni-Captioner | 90.77 | 11.51 |    41.31 |   17.42 |        -23.89%p | Table 3 |
| Qwen3-Omni-Instruct  | 89.02 |  9.85 |    41.70 |   13.33 |        -28.37%p | Table 3 |
| MiniCPM-o-2.6        | 72.13 |  4.29 |     6.41 |    2.46 |         -3.95%p | Table 3 |

가장 중요한 비교는 Event F1과 EVSA F1이다. 같은 모델·같은 영상·같은 예측 구조 안에서 측정하므로 실험 조건이 맞으며, 모든 모델에서 EVSA가 더 낮다. 특히 Qwen3-Omni-Instruct의 -28.37%p는 소리를 언급하는 능력과 그것을 올바른 화면 구간에 연결하는 능력이 크게 분리되어 있음을 뜻한다. 수치와 지표 정의는 [논문 Table 3 및 Section 4.2](https://arxiv.org/html/2610.12458#S4.SS2)와 [공식 leaderboard](https://01yzzyu.github.io/OmniCapBench/#leaderboard)에서 교차 확인했다.

judge 안정성도 별도의 matched comparison이다. Table 5에서 weak/mid/strong judge에 대한 OmniCapBench 점수는 56.82/58.24/57.60으로 범위가 1.42%p지만, holistic 평가는 71.24/83.08/93.92로 22.68%p 범위다. 이는 더 강한 judge가 항상 “더 정확한 같은 척도”를 만드는 것이 아니라, 자유형 전체 문장 채점 자체가 judge 능력에 종속될 수 있음을 보여준다.

# Limitations / Discussion

- 정답 구조 $\mathcal{S}^{\star}(V)$에 주석되지 않은 주변부의 참인 사실은 점수를 얻지 못한다. atomic unit이 검증 가능성을 높이지만 열린 세계 영상의 모든 사실을 포괄하지는 않는다.
- 영상 길이가 5분 이하라 장시간 identity memory나 수십 분 단위 사건 결합을 평가하지 않는다. 보고된 CCC 병목은 더 긴 영상에서 악화될 수 있지만 이 데이터만으로 수치를 외삽하면 안 된다.
- Stage II의 초안은 frontier model 여러 계열이 만들며, 그중 일부 계열을 다시 평가한다. validator와 사람 검수가 편향을 줄이지만, 생성 모델과 평가 모델 사이의 stylistic prior 공유를 완전히 배제하지 못한다.
- 엄격한 JSON 출력은 자유형 산문에 최적화된 모델을 불리하게 한다. 이는 통제 가능한 구조 생성 능력을 의도적으로 요구한 결과지만, 기존 caption model의 언어 품질과 직접 비교하는 벤치마크로 읽어서는 안 된다.
- local semantic judge도 LLM 의존성을 완전히 제거하지 않는다. 다만 candidate pair를 제한하고 구조 판정을 먼저 끝내 judge가 수행할 추론 범위를 줄인다.
- 공개 배포는 raw video가 아니라 원본 URL과 annotation 중심이다. 원본 링크 소실이나 플랫폼 정책 변경이 장기 재현성에 영향을 줄 수 있다.

# 내가 이해한 핵심

OmniCapBench의 핵심은 더 강한 judge를 고른 것이 아니라 **judge가 풀어야 할 문제를 작고 검증 가능한 문제로 바꾼 것**이다. 긴 자유형 캡션에서 개체를 추출하고, 같은 인물을 합치고, 시간 범위를 찾고, 소리를 장면과 연결하고, 마지막에 의미까지 판정하면 오류 원인이 뒤섞인다. 이 논문은 앞의 네 단계를 명시적 구조와 규칙으로 외부화한 뒤 LLM에는 local semantic equivalence만 남긴다.

또 하나의 중요한 메시지는 형식 준수와 세계 모델링을 구분해야 한다는 점이다. 최고 모델은 SGC가 97%를 넘지만 CCC는 40%에 못 미친다. JSON을 올바르게 출력하는 능력은 이미 상당히 높아도, 가려졌다 다시 나타난 사람을 같은 ID로 유지하고 소리를 정확한 shot에 묶는 내부 표현은 약하다. 향후 video-language model의 개선 목표는 더 유창한 장문 설명보다 **시간을 가로질러 유지되는 entity memory와 cross-modal binding**에 놓여야 한다.

# 다음에 연결해서 읽을 논문

- [LongVALE: Vision-Audio-Language-Event Benchmark Towards Time-Aware Omni-Modal Perception of Long Videos](https://arxiv.org/abs/2411.19772): timestamp가 있는 audio-visual event 평가와 OmniCapBench의 native atomic 구조를 비교할 수 있다.
- [Qwen3-Omni Technical Report](https://arxiv.org/abs/2509.17765): open omnimodal model의 생성 구조와 OmniCapBench에서 드러난 CCC/EVSA 병목을 함께 볼 수 있다.
- [Video-MME: The First-Ever Comprehensive Evaluation Benchmark of Multi-modal LLMs in Video Analysis](https://arxiv.org/abs/2405.21075): QA 중심 video understanding 평가가 무엇을 잘 측정하고, structured caption 진단이 무엇을 추가하는지 대비할 수 있다.
