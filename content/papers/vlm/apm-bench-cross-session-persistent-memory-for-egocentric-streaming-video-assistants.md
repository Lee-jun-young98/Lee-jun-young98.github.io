---
title: "APM-Bench: Benchmarking Cross-session Persistent Memory for Egocentric Streaming Video Assistants"
date: 2026-10-01
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Jianguo Huang, Jinming Liu, Qiyao Wang, Liang Xu, Jianhang Li, Zhimian Wen, Mingda Li, Shule Lu, Zhicheng Wang, Yuhan Guo, Xin Jin, Wenjun Zeng"
paper: "https://arxiv.org/abs/2609.37559"
code: "https://github.com/Jianguo-Huang11/APM-Bench/tree/main"
project: "https://jianguo-huang11.github.io/APM-Bench/"
thumbnail: "/papers/assets/vlm/apm-bench-cross-session-persistent-memory-for-egocentric-streaming-video-assistants/persistent-memory-tradeoff.svg"
---

# 한 줄 요약

APM-Bench는 끊어진 여러 1인칭 비디오 세션을 하나의 생활 궤적으로 묶어 장기 회상, 현재 장면 인식, 선제적 응답을 함께 평가하고, 기존 비디오 메모리가 정확도·응답 지연·저장 비용을 동시에 만족하지 못함을 보여 준다.

# 논문 정보

- 제목: APM-Bench: Benchmarking Cross-session Persistent Memory for Egocentric Streaming Video Assistants
- 저자: Jianguo Huang, Jinming Liu, Qiyao Wang, Liang Xu, Jianhang Li, Zhimian Wen, Mingda Li, Shule Lu, Zhicheng Wang, Yuhan Guo, Xin Jin, Wenjun Zeng
- 발표: 확인 필요 (arXiv v1, 2026-09-29)
- 링크: [arXiv:2609.37559](https://arxiv.org/abs/2609.37559)
- 코드/프로젝트: [GitHub](https://github.com/Jianguo-Huang11/APM-Bench/tree/main) · [프로젝트 페이지](https://jianguo-huang11.github.io/APM-Bench/) · [Hugging Face 데이터셋](https://huggingface.co/datasets/Jianguo-Huang11/APM-Bench)
- 키워드: egocentric video, streaming VLM, persistent memory, multimodal agent, proactive assistance, evidence availability

# 핵심 아이디어

기존 streaming-video benchmark는 대개 하나의 연속 비디오 안에서 기억을 평가한다. 하지만 실제 웨어러블 비서 사용은 카메라가 꺼졌다가 몇 시간 또는 며칠 뒤 다시 켜지는 식으로 끊어진다. APM-Bench는 이 차이를 **activity-related multi-session trajectory**로 모델링한다.

1. EgoLife와 HD-EPIC에서 관련 활동을 묶어 104개 trajectory, 549개 session, 2,719개 candidate를 만든다. trajectory당 영상은 평균 69분, session은 평균 13분이며 실제 시간 간격은 수 시간에서 수일까지 이어진다.
2. 평가를 Cross-session Understanding, Real-time Perception, Adaptive Response의 세 능력과 12개 세부 task로 나눈다.
3. 모델은 질의 시점까지의 현재 causal video prefix와 이전 session에서 저장한 persistent memory만 볼 수 있다. 미래 frame을 사용하는 누수를 막는다.
4. raw video, text summary, KV cache, visual token, event tree, parametric memory, reasoning thought 등 서로 다른 기억 표현을 성능뿐 아니라 time-to-first-token과 video hour당 저장 비용으로 비교한다.
5. 최근 두 session만 공개하는 별도 5지선다 평가를 두어, 근거가 실제로 남아 있을 때 답하는 능력과 근거가 사라졌음을 인정하는 능력을 분리한다.

# VLM 관점에서 중요한 이유

이 논문은 video VLM의 장기 기억을 단순한 long-context 정확도 문제가 아니라 **무엇을 저장하고, 언제 꺼내며, 근거가 없을 때 어떻게 행동할지**의 시스템 문제로 바꾼다. 모든 과거 frame을 다시 넣는 방식은 회상 성능이 높지만 저장 비용과 지연이 크고, 관련 없는 과거가 현재 장면 인식을 오히려 방해할 수 있다.

또한 multimodal agent에게 회상과 행동은 다른 능력임을 드러낸다. 가장 강한 모델도 과거 사실을 잘 찾는 것에 비해, 현재 상황과 연결해 적절한 순간에 개입하는 MPA와 TPG에서는 낮은 점수를 받는다. 즉 실용적인 비디오 비서는 retrieval만 잘해서는 부족하고, memory coverage 추적, relevance gating, 시점 판단, 근거 부족 표현이 함께 필요하다.

# Method

1. **Trajectory 구성:** EgoLife에서 165개, HD-EPIC에서 34개 후보 trajectory를 만들고 사람이 활동 연관성을 검토해 104개를 선택한다. 이를 실제 timestamp가 보존된 549개 session으로 분할한다.
2. **Candidate 정제:** 6,412개 초기 후보에 choice-blind review, timestamp filtering, video-agent review, human verification을 순서대로 적용해 2,719개로 줄인다. 300개 표본에서 두 annotator의 Cohen's kappa는 0.868이다.
3. **Cross-session Understanding:** Episodic Recall, Entity State Tracking, Temporal Reasoning을 4지선다 정확도로 평가한다. 모두 이전 session의 근거가 필요하다.
4. **Real-time Perception:** 현재 session에서 Action Recognition, Counting, OCR, Spatial Understanding을 평가한다. 과거 memory가 현재 인식에 주는 간섭도 함께 드러난다.
5. **Adaptive Response:** ERA, RCR, MPA, PRM, TPG에서 매 probe마다 `SILENT` 또는 `INTERVENE`를 판단한다. 결정이 맞아야 gate를 통과하고, 그 뒤 DeepSeek-V4-Flash가 설명과 응답 품질을 1-5점으로 평가한다. 최종 task 점수는 0-100으로 환산한다.
6. **Memory protocol:** general video model은 최근 4 frame만 보는 SimpleStream, 모든 이전 영상을 재생하는 Raw Video as Memory, session 종료 시 생성한 Text Summary as Memory로 비교한다. 모든 video input은 1 FPS다.
7. **전용 시스템 비교:** HERMES, ReKV, FLUXMem, Flash-VStream, StreamForest, OASIS, Video-SALMONN S, VST를 공식 설정으로 실행해 다섯 memory representation 계열을 비교한다.
8. **Evidence Availability-Aware:** 260개 문항에서 최근 두 session만 허용한다. 130개는 필요한 근거가 그 안에 있고, 130개는 밖에 있다. 다섯 번째 선택지로 근거 부족을 명시하게 한다.

# 핵심 그림

![끊어진 비디오 세션에서 persistent memory가 과거 근거를 저장하고 현재 장면에 선택적으로 주입되며, 효용·지연·저장 비용 사이의 절충을 만든다는 설명도](/papers/assets/vlm/apm-bench-cross-session-persistent-memory-for-egocentric-streaming-video-assistants/persistent-memory-tradeoff.svg)

_논문 Figure 1·2와 Table 3을 바탕으로 재구성._ 위쪽은 session 사이의 실제 시간 간격을 넘어 memory가 재사용되는 흐름을, 아래쪽은 raw video, text summary, event memory가 만드는 효용·지연·저장 비용의 절충을 요약한다. benchmark 제작 pipeline보다 이 그림이 persistent memory의 작동 조건과 논문의 주된 실험 결론을 한 번에 연결하므로 핵심 그림으로 골랐다. 수치와 구조의 출처: [논문 Figure 1, Figure 2, Table 3](https://arxiv.org/html/2609.37559v1).

# Experiments / Results

- 104개 trajectory에는 Cross-session Understanding 887개, Real-time Perception 716개, Adaptive Response 1,116개로 총 2,719개 candidate가 있다. Adaptive Response의 timestamp probe까지 합치면 전체 평가 probe는 5,371개다.
- Raw Video as Memory의 Gemini 3.6 Flash가 세 capability 평균 60.21로 가장 높았다. 그러나 raw video 저장 비용은 공통 3.01 GiB/video-hour이고, 가장 강한 전용 persistent system인 OASIS도 평균 41.46, TTFT 32.44초, 2.66 GiB/video-hour였다.
- 같은 Gemini 3.6 Flash에서 text summary는 raw video보다 Cross-session Understanding가 21.87%p 낮지만 Real-time Perception은 1.78%p 높았다. 과거 정보가 많을수록 현재 장면을 항상 더 잘 보는 것은 아니다.
- Adaptive Response에서는 명시적으로 등록한 조건을 감시하는 RCR과 PRM이 자율적으로 과거 경험을 연결해야 하는 MPA와 TPG보다 대체로 쉬웠다. raw video Gemini의 RCR은 73.62지만 MPA는 26.52, TPG는 25.58이다.
- 근거 가용성 평가에서 raw video Gemini는 접근 가능한 근거에 대한 정확도 85.38%지만, 근거가 없음을 탐지하는 비율은 59.23%에 그쳐 26.15%p 차이가 났다. 잘 회상하는 모델이 자신의 기억 범위를 잘 아는 것은 아니다.

## 주요 실험 결과

논문 Table 3에서 같은 Gemini 3.6 Flash의 memory protocol만 비교했다. 세 capability 점수와 Overall은 0-100이며 높을수록 좋다. 차이는 `Text Summary - Raw Video`이고, 같은 모델·1 FPS 설정에서 memory representation만 바꾼 결과다.

| 벤치마크 / 지표 (0-100, ↑)        | Text Summary | Raw Video | 차이 (%p) | 출처    |
| --------------------------------- | -----------: | --------: | --------: | ------- |
| Cross-session Understanding       |        47.50 |     69.37 |    -21.87 | Table 3 |
| Real-time Perception              |        65.98 |     64.20 |     +1.78 | Table 3 |
| Adaptive Response                 |        47.14 |     47.05 |     +0.09 | Table 3 |
| 세 capability 비가중 평균 Overall |        53.54 |     60.21 |     -6.67 | Table 3 |

Text summary는 시각 세부를 잃어 cross-session recall이 크게 낮아지지만, 현재 장면 인식에서는 raw history의 간섭을 줄여 오히려 소폭 좋아진다. 따라서 압축률만 높이는 memory가 아니라 질의 시점에 필요한 과거 정보만 선택적으로 주입하는 설계가 필요하다. 원자료: [논문 Table 3](https://arxiv.org/html/2609.37559v1).

# Limitations / Discussion

- 데이터는 EgoLife와 HD-EPIC의 1인칭 생활·주방 활동에 기반한다. 야외 이동, 사회적 상호작용, 장기간의 다양한 개인 습관으로 일반화되는지는 추가 검증이 필요하다.
- 일부 trajectory는 source annotation을 바탕으로 재구성되고 timestamp를 영상에 덧입힌다. 실제 사용자의 자연스러운 기기 on/off 패턴을 그대로 수집한 것은 아니다.
- Adaptive Response의 최종 품질은 DeepSeek-V4-Flash judge에 의존한다. 결정 gate는 규칙 기반이지만, 설명의 유용성 평가는 judge bias와 reference coverage의 영향을 받을 수 있다.
- proprietary model의 TTFT는 Table 3에 보고되지 않아 최고 정확도 시스템의 실제 응답 비용을 완전히 비교하기 어렵다.
- 여러 전용 memory system은 backbone이 서로 다르다. 따라서 방법 간 격차를 memory architecture만의 인과 효과로 해석하면 안 된다.
- 전용 방법 대부분은 원래 단일 연속 stream을 위해 만들어졌고 persistent-state export를 지원하지 않는다. 논문이 보고한 storage는 inference 중 유지 state를 추정한 값이다.
- Evidence Availability-Aware set은 최근 두 session이라는 고정 제한과 260개 문항으로 구성된다. 더 긴 memory budget이나 불완전한 부분 근거 상황은 별도 평가가 필요하다.
- 공식 venue는 arXiv와 프로젝트 페이지에서 확인되지 않아 `확인 필요`로 표시했다. Hugging Face 페이지는 code와 annotation을 2026년 11월 이전 공개 예정이라고 명시하므로 현재 저장소의 완전성도 재확인이 필요하다.

# 내가 이해한 핵심

장기 비디오 memory의 목표는 과거를 최대한 많이 보존하는 것이 아니라, **나중에 필요한 근거가 무엇인지 모르는 상태에서 손실을 관리하고, 현재 순간에 필요한 부분만 꺼내며, 빠진 근거를 스스로 아는 것**이다. 이 세 단계 중 하나라도 실패하면 raw video replay처럼 비싸거나, summary처럼 세부를 잃거나, 잘못된 확신으로 답하게 된다.

특히 recall과 proactive assistance의 격차가 중요하다. 과거 장면을 맞히는 것은 retrieval 문제에 가깝지만, 선제적 개입은 과거 경험과 현재 scene을 연결하고, 지금 행동 가능한지 판단하고, 침묵이 더 나은 경우를 구분해야 한다. 실용적인 multimodal agent의 memory module은 저장소가 아니라 coverage metadata와 relevance policy를 가진 의사결정 계층이어야 한다.

# 다음에 연결해서 읽을 논문

- [OASIS: On-Demand Hierarchical Event Memory for Streaming Video Reasoning](https://openaccess.thecvf.com/content/CVPR2026/html/Liang_OASIS_On-Demand_Hierarchical_Event_Memory_for_Streaming_Video_Reasoning_CVPR_2026_paper.html): APM-Bench에서 가장 강한 전용 persistent system이며 event-structured memory의 장단점을 확인할 수 있다.
- [StreamArena: Toward Continuous, Interactive, and Long-Horizon Agentic Streaming Video Understanding](https://arxiv.org/abs/2608.05703): 단일 장시간 상호작용 평가와 다중 session 평가의 차이를 비교하기 좋다.
- [EgoStream: A Diagnostic Benchmark for Streaming Episodic Memory in Egocentric Vision](https://arxiv.org/abs/2605.31557): streaming episodic recall을 더 세분화한 선행 benchmark다.
- [What Should a Streaming Video Model Remember?](https://arxiv.org/abs/2606.16353): memory에 무엇을 남길지와 relevance selection 문제를 직접 다룬다.
