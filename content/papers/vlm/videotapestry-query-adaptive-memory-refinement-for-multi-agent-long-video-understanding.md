---
title: "VideoTapestry: Query-Adaptive Memory Refinement for Multi-Agent Long-Video Understanding"
date: 2026-10-06
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Yucheng Liu, Yufei Yin, Mingxiao Feng, Jiajun Deng, Wengang Zhou, Houqiang Li"
paper: "https://arxiv.org/abs/2610.06672"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/videotapestry-query-adaptive-memory-refinement-for-multi-agent-long-video-understanding/videotapestry-architecture.svg"
---

# 한 줄 요약

VideoTapestry는 미리 만든 3단계 비디오 메모리를 질문에 맞춰 Overview→Skim→Focus 에이전트가 거친 시간대부터 세부 관계까지 다시 관찰·수정하고, 전역 맥락과 정밀 증거를 합친 메모리로 장시간 비디오 질문에 답하는 training-free 프레임워크다.

# 논문 정보

- 제목: VideoTapestry: Query-Adaptive Memory Refinement for Multi-Agent Long-Video Understanding
- 저자: Yucheng Liu, Yufei Yin, Mingxiao Feng, Jiajun Deng, Wengang Zhou, Houqiang Li
- 발표: arXiv:2610.06672v1 (2026-10-05 제출), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.06672), [HTML 논문](https://arxiv.org/html/2610.06672), [PDF](https://arxiv.org/pdf/2610.06672)
- 코드/프로젝트: 2026-10-06 기준 arXiv와 논문 본문에서 공식 공개 링크를 확인하지 못함
- 키워드: long-video understanding, video-language model, multimodal agent, hierarchical memory, query-adaptive refinement, video QA

# 핵심 아이디어

긴 비디오 질의응답에는 두 가지 상반된 실패가 있다. 질문부터 시작해 필요한 구간을 찾는 top-down 탐색은 첫 위치 추정이 틀리면 핵심 장면을 놓치고, 질문과 무관하게 미리 메모리를 만드는 bottom-up 방식은 특정 질문이 요구하는 작은 디테일을 저장하지 못한다. VideoTapestry는 둘을 결합한다.

먼저 MemDreamer 방식으로 비디오를 `SuperEvent → MacroEvent → local Subgraph`의 고정 계층으로 만든다. 추론할 때는 각 수준에 맞춘 에이전트가 `Plan → Observe → Update → Decide`를 한 번씩 수행한다. Overview Agent는 전역 타임라인과 ASR을 이용해 관련 SuperEvent와 이웃을 보존하고 나머지를 압축한다. Skim Agent는 선택한 하위 MacroEvent를 다시 관찰해 후보 구간을 좁힌다. Focus Agent는 Entity·Event·OCRText 관계가 담긴 Subgraph를 세부 검증한다.

마지막에는 압축·보강된 전역 SuperEvent 뼈대와 질문 관련 Macro/Subgraph 경로만 원래 부모 아래에 결합한다. Answer Agent는 이 **composite query-adaptive memory**만 받고 추가 검색 없이 답한다. 새 증거를 별도 로그 끝에 덧붙이는 대신 기존 메모리 노드를 질문에 맞게 다시 쓴다는 점이 핵심이다.

# VLM 관점에서 중요한 이유

VideoTapestry는 더 긴 컨텍스트나 추가 학습보다 **무엇을 어떤 해상도로 다시 볼지**와 **관찰 결과를 어떤 표현에 통합할지**를 분리한다. 하나의 에이전트가 전역 서사, 사건 위치, 세부 객체 관계를 모두 처리하지 않고 메모리의 의미 수준과 에이전트 역할을 맞춘다. 이는 장시간 비디오 VLM에서 성능 병목이 단순 프레임 수보다 검색 단위와 최종 컨텍스트 구성에 있을 수 있음을 보여 준다.

또한 전역 뼈대와 세부 경로 중 어느 하나만으로는 충분하지 않다는 통제 실험이 중요하다. 같은 탐색 결과를 고정했을 때 refined Super만 쓰면 85.0%, refined paths만 쓰면 80.5%지만 둘을 합치면 87.0%다. 세부 증거를 찾더라도 전체 사건 흐름을 함께 보존해야 답변 단계가 그 증거를 올바르게 해석할 수 있다는 뜻이다.

# Method

1. **고정 계층 메모리 구축:** 비디오를 전역 서사의 SuperEvent, 국소 사건의 MacroEvent, Entity·Event·OCRText와 typed relation으로 된 Subgraph의 3수준으로 미리 구성한다. 이 오프라인 메모리와 모델 파라미터는 평가 중 고정된다.
2. **Overview 수준 정제:** 질문의 entity/OCR/semantic anchor로 넓은 구간을 잡고 프레임 grid와 선택 구간 ASR을 관찰한다. 증거가 연결된 SuperEvent와 양옆 이웃은 원문과 새 증거를 보존하고, 무관한 SuperEvent는 짧게 압축한다.
3. **Skim·Focus 수준 정제:** 선택된 부모의 자식만 다음 에이전트에 노출한다. Skim은 MacroEvent 구간을 재관찰하고, Focus는 관련 Subgraph의 객체·행동·OCR·관계를 검증한다. 수준 간에는 전체 trajectory가 아니라 다음에 확인할 짧은 instruction을 넘긴다.
4. **합성 메모리 조립:** 방문한 각 수준의 임시 메모리 중 압축된 전역 scaffold와 정제된 local paths를 원래 계층에 맞춰 조립하고, compact handoff trace와 함께 직렬화한다.
5. **독립 답변:** Answer Agent는 조립된 메모리에서만 답을 예측하며 새 프레임·ASR 검색은 하지 않는다. 전체 과정은 별도 학습 없이 같은 frozen backbone과 도구 호출로 수행된다.

# 핵심 그림

![고정된 3단계 비디오 메모리에서 Overview, Skim, Focus 에이전트가 질문 관련 가지를 차례로 재관찰하고 전역 뼈대와 세부 경로를 합쳐 Answer Agent에 전달하는 VideoTapestry 구조 재구성도](/papers/assets/vlm/videotapestry-query-adaptive-memory-refinement-for-multi-agent-long-video-understanding/videotapestry-architecture.svg)

_논문 내용을 바탕으로 재구성._ 계층 메모리, 수준별 에이전트, 도구 기반 정제, 합성 메모리, 최종 답변의 전체 추론 경로가 이 방법의 기여를 가장 직접적으로 보여 주므로 architecture/overview 그림을 골랐다. 출처: [논문 Figure 2와 Sections 3.1–3.3](https://arxiv.org/html/2610.06672). 원문은 CC BY 4.0이며, 수준별 역할과 학습 없는 추론 흐름을 한국어로 분명히 보이기 위해 직접 재구성했다.

그림의 입력은 긴 비디오, 질문·선택지, 그리고 질문과 독립적으로 미리 구축한 3단계 메모리다. Overview는 전역 타임라인에서 넓은 증거 구간을 찾고 시각·ASR로 SuperEvent를 보강한다. Skim은 선택된 자식 MacroEvent만 좁혀 관찰하고, Focus는 local Subgraph의 세부 관계를 검증한다. 각 에이전트의 `Plan→Observe→Update→Decide` 결과는 다음 수준의 후보와 instruction을 정하며, 마지막에는 압축된 전체 scaffold와 정제된 관련 가지가 함께 Answer Agent로 간다. 학습 단계는 없고, 오프라인 메모리 구축과 질문별 추론을 구분해야 한다.

# Experiments / Results

- LVBench(103개 비디오, 1,549 QA), LongVideoBench validation(1,337문항, 이 중 long subset 564문항), Video-MME Long(300개 비디오, 900 QA), EgoSchema 500문항 subset에서 평가한다.
- 기본 설정은 Overview·Skim·Focus·Answer 모두 frozen GPT-5.5를 사용한다. Whisper는 선택된 Video-MME 구간의 ASR, Qwen3-Embedding은 semantic retrieval에 쓴다.
- Direct baseline은 같은 frozen backbone과 같은 평가 예제를 쓰되 agentic framework 없이 답한다. 따라서 Table 1의 동일 백본 비교는 모델 교체 효과가 아니라 검색·메모리 구성 효과를 측정한다.
- ablation은 Video-MME Long의 고정 200문항 subset, 같은 사전 구축 메모리와 도구 예산에서 수행한다.
- 저자 보고상 네 backbone(GPT-5.5, GPT-5, Qwen3.7-Plus, Qwen3.6-27B) 모두에서 direct 대비 +7.0~+9.5%p 향상된다.

## 주요 실험 결과

아래 값은 논문 Table 1의 동일 GPT-5.5 백본 end-to-end 비교다. 지표는 accuracy(%, ↑)이며 차이는 VideoTapestry에서 Direct를 뺀 절대 %p다. `Video-MME (Long)`은 제공 subtitle 없이 평가한 설정이다.

| 벤치마크 / 지표 (accuracy %, ↑) | GPT-5.5 Direct | VideoTapestry |    차이 | 출처    |
| ------------------------------- | -------------: | ------------: | ------: | ------- |
| LVBench Overall                 |           64.3 |          81.5 | +17.2%p | Table 1 |
| LongVideoBench Long             |           64.0 |          78.9 | +14.9%p | Table 1 |
| Video-MME Long (w/o subtitles)  |           74.8 |          84.6 |  +9.8%p | Table 1 |
| EgoSchema Val                   |           76.0 |          83.0 |  +7.0%p | Table 1 |

같은 모델을 그대로 쓴 비교에서 네 데이터셋 모두 개선되고, 특히 LVBench에서 +17.2%p다. 다만 각 데이터셋의 전체 프로토콜과 질문 수가 다르므로 네 차이를 한 평균으로 합치지 않았다. LVBench 세부 항목에서는 temporal grounding이 43.1→83.2%(+40.1%p), summarization이 65.4→89.7%(+24.3%p)로 가장 크게 오른다.

Table 3의 200문항 통제 실험도 메커니즘을 뒷받침한다. 완전한 VideoTapestry는 87.0%이고, visual observation 제거는 84.0%(-3.0%p), ASR 제거는 81.5%(-5.5%p), 구조화된 node update 대신 append-only evidence를 쓰면 85.5%(-1.5%p), 단일 에이전트로 합치면 82.5%(-4.5%p)다. 같은 탐색을 고정한 composite-memory 비교에서는 static memory 79.5%, refined Super only 85.0%, refined paths only 80.5%, 둘을 합친 VideoTapestry 87.0%다. 수치·단위·평가 설정은 [논문 Tables 1–4와 Sections 4.1–4.5](https://arxiv.org/html/2610.06672)에서 직접 대조했다.

# Limitations / Discussion

- 초기 계층은 고정되어 있다. 잘못된 event grouping이나 시간 경계가 만들어지면 query-time 재관찰도 존재하지 않는 부모–자식 경로를 복구하지 못한다.
- 오프라인 메모리 구축 비용과 질문마다 여러 모델·시각·ASR 도구를 호출하는 비용이 추가된다. 논문은 정확도 향상을 계산 효율 우위로 해석할 수 없다고 명시하며 latency·비용 비교도 보고하지 않는다.
- refined memory는 모델이 해석한 시각·전사 증거에 의존하므로 한 수준의 오류가 다음 선택과 최종 답으로 전파될 수 있다. uncertainty prompt와 modality 분리가 충돌 해결을 보장하지는 않는다.
- 주 결과는 강한 proprietary GPT-5.5 backbone에 크게 의존한다. 네 backbone에서 방향은 일관되지만 절대 성능과 도구 비용을 오픈 모델만으로 재현할 수 있는지는 별도 검증이 필요하다.
- agentic 방법 간에는 query-time model 조합, transcript 사용, 도구 예산이 서로 다르다. 따라서 Table 1의 다른 방법과 수평 비교보다 동일 백본 Direct 및 통제 ablation이 더 신뢰할 만한 근거다.
- 공식 코드·프로젝트가 확인되지 않아 프롬프트 외의 memory builder, tool scheduling, 실패 복구 구현을 독립적으로 검증하기 어렵다.

# 내가 이해한 핵심

가장 중요한 설계는 “관련 장면만 찾기”가 아니라 **전체 이야기는 얇게 남기고 필요한 가지는 두껍게 다시 쓰는 것**이다. 긴 비디오에서는 정답 장면 하나를 잘 찾아도 그 장면이 전체 사건에서 어떤 위치인지 잃으면 오답이 생긴다. 반대로 전역 요약만 유지하면 질문이 묻는 OCR·행동·관계가 사라진다. VideoTapestry의 합성 메모리는 이 두 해상도를 동시에 유지한다.

또 하나의 핵심은 역할 분담의 단위가 사람처럼 임의의 직책이 아니라 데이터 구조의 수준과 정확히 맞물린다는 점이다. Overview, Skim, Focus는 같은 일을 세 번 반복하지 않고 서로 다른 후보 공간과 관찰 해상도를 가진다. 그래서 이 방법은 일반적인 multi-agent debate보다 hierarchical retrieval controller에 가깝다.

# 다음에 연결해서 읽을 논문

- [MemDreamer: Decoupling Perception and Reasoning for Long Video Understanding via Hierarchical Graph Memory and Agentic Retrieval Mechanism](https://arxiv.org/abs/2606.07512): VideoTapestry가 고정 계층 메모리를 구성할 때 직접 따르는 기반 방법이다.
- [VideoAgent: A Memory-augmented Multimodal Agent for Video Understanding](https://arxiv.org/abs/2403.11481): query-independent memory와 agentic retrieval의 초기 대표 사례다.
- [VideoSeek: Long-Horizon Video Agent with Tool-Guided Seeking](https://arxiv.org/abs/2603.20185): 질문 중심 top-down 탐색과 VideoTapestry의 사전 메모리 보강 방식을 비교할 수 있다.
- [VideoScout: Learning Agentic Active Exploration with Adaptive Reasoning Pacing for Long Video Understanding](https://arxiv.org/abs/2609.15606): 학습된 explore/notes/rewatch 정책과 training-free 계층 정제의 차이를 볼 수 있다.
