---
title: "VideoEvolve: Co-Evolving Memory and Retrieval for Long Video Understanding"
date: 2026-10-08
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Yongchao Xu, Bowen Ye, Jiefeng Gan, Junkai Ma, Wenzhao Li, Sen Tao, Yi Wei, Jiawei Liu"
paper: "https://arxiv.org/abs/2610.10183"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/videoevolve-co-evolving-memory-and-retrieval-for-long-video-understanding/videoevolve-architecture.svg"
---

# 한 줄 요약

긴 비디오에서 무엇을 기억할지와 어떻게 검색할지를 두 에이전트가 번갈아 강화학습하며 함께 개선하고, 병목·능력 진단으로 다음 학습 대상을 조정하는 메모리 기반 Video-MLLM 프레임워크다.

# 논문 정보

- 제목: VideoEvolve: Co-Evolving Memory and Retrieval for Long Video Understanding
- 저자: Yongchao Xu, Bowen Ye, Jiefeng Gan, Junkai Ma, Wenzhao Li, Sen Tao, Yi Wei, Jiawei Liu
- 발표: 확인 필요(arXiv v1, 2026-10-07 제출)
- 링크: [arXiv:2610.10183](https://arxiv.org/abs/2610.10183), [HTML 원문](https://arxiv.org/html/2610.10183)
- 코드/프로젝트: 공식 공개 링크 확인 필요
- 키워드: long video understanding, Video-MLLM, multimodal agent, external memory, retrieval, agentic reinforcement learning

# 핵심 아이디어

기존 메모리 기반 긴 비디오 시스템은 질문마다 검색 방식은 바꾸지만, 처음 무엇을 저장했는지는 고정하는 경우가 많다. 이때 빠진 장면은 매번 원본 비디오를 다시 봐야 하고, 저장한 정보도 검색 에이전트가 찾지 못하면 쓸모가 없다. VideoEvolve는 이 비대칭을 없애기 위해 질문을 보지 않고 메모리를 보강하는 **Memory Evolver**와, 질문에 맞춰 메모리를 탐색하고 필요할 때 원본 비디오를 다시 보는 **Retrieval Evolver**를 교대로 학습한다.

핵심은 단순히 두 모델을 동시에 튜닝하는 데 있지 않다. Retrieval Evolver의 정답 여부가 어떤 정보를 저장해야 하는지에 대한 보상이 되고, 새로 구축된 메모리가 다음 Retrieval Evolver의 학습 환경이 된다. 여기에 BEF(Bottleneck-Aware Evolution Feedback)가 현재 병목이 기억인지 검색인지 판단해 학습 예산을 나누고, CEF(Capability-Aware Evolution Feedback)가 아직 약하지만 학습 가능한 비디오 능력에 표본을 더 배정한다.

# VLM 관점에서 중요한 이유

긴 비디오 VLM의 문제를 입력 토큰 압축이나 질문별 프레임 선택만으로 보지 않고, **지속 메모리의 쓰기 정책과 읽기 정책 사이의 정렬 문제**로 재정의한다. 한 비디오에 여러 질문이 들어오는 현실적인 환경에서는 매번 전체 영상을 재처리하는 대신 질문 독립적 메모리를 재사용해야 한다. VideoEvolve는 다운스트림 질의응답 경험이 다시 메모리 구성 정책을 고치게 만들어, “무엇을 기억할 것인가” 자체를 학습 가능한 에이전트 행동으로 만든다.

또한 정확도와 자원 비용을 하나의 가중합으로 섞지 않고, 같은 과제 보상을 얻은 궤적 사이에서만 비용을 tie-breaker로 쓴다. 따라서 더 싼 행동이 정답 행동을 밀어내지 않도록 품질 우선 최적화를 설계했다는 점도 에이전트형 VLM에서 의미가 있다.

# Method

1. **고정 Base Memory 생성:** 낮은 프레임률의 전체 비디오 개요를 Root–Super–Macro 3단계 계층으로 정리한다. 이 Base는 모든 공진화 주기에서 고정되어 광범위한 시간 범위와 검색 앵커를 제공한다.
2. **Memory Evolver의 Observe–Decide–Augment:** 현재 메모리, 구성 이력, 남은 예산을 보고 조사할 Macro와 시간 구간·관찰량·정보 초점을 선택한다. 동결된 멀티모달 Writer가 선택 장면과 자막을 출처 연결 레코드로 바꾸고, 이를 Delta $\Delta_v^k$로 저장한다. 각 주기의 메모리는 누적 덧붙이기가 아니라 같은 Base에서 $M_v^k=\mathrm{Merge}(B_v,\Delta_v^k)$로 다시 만든다.
3. **Retrieval Evolver의 Search–Inspect & Revisit–Reason:** 질문, 검색 문맥, 도구 이력을 조건으로 계층 탐색, 어휘·의미·시간 검색, 문서·키프레임 열람을 수행한다. 정보가 부족하면 예산 안에서 `view_video`로 원본 구간을 다시 보고 답을 낸다.
4. **교대 Agentic RL:** 주기 $k$에서 먼저 Retrieval Evolver를 고정한 채 여러 후보 메모리를 평가해 Memory Evolver를 업데이트한다. 새 정책으로 메모리를 재구축한 뒤 그 메모리를 고정하고 Retrieval Evolver를 업데이트한다. 즉 $(C^k,R^k,M^k)\rightarrow(C^{k+1},R^k,M^{k+1})\rightarrow(C^{k+1},R^{k+1},M^{k+1})$의 순서다.
5. **검증 가능한 보상:** 메모리 쪽은 기존에 틀린 질문을 새 메모리로 맞힌 `rescue`를 보상하고, 기존 정답을 잃은 `regress`와 잘못된 구성 궤적을 벌점으로 준다. 검색 쪽은 최종 정답과 잘못된 도구 궤적으로 보상을 정의한다. 정확도가 같은 후보 사이에서만 시각 관찰량·메모리 비용·도구 사용량을 비교한다.
6. **BEF와 CEF:** Memory-only와 Revisit-enabled 결과를 짝지어 추가 관찰로 고쳐진 실패는 메모리 수요로, 여전히 못 풀거나 추가 관찰 없이 고쳐진 사례는 검색 수요로 집계한다. CEF는 Action & Motion, Order, Change, Temporal Reasoning 등 9개 능력별 수요를 평활화해 frontier·exploration·retention 표본을 섞은 다음 주기 커리큘럼을 만든다.
7. **학습과 추론 분리:** Retrieval Evolver만 2단계 SFT로 도구 사용을 초기화한 뒤 교대 RL을 수행한다. 추론 시에는 새 비디오에서 Memory Evolver가 재사용 가능한 메모리를 한 번 만들고 Retrieval Evolver가 질문별로 답한다. BEF와 CEF는 학습 때만 사용된다.

# 핵심 그림

![VideoEvolve가 고정 Base Memory에서 Memory Evolver와 Retrieval Evolver를 교대로 학습하고 BEF와 CEF로 다음 주기를 조정하는 구조](/papers/assets/vlm/videoevolve-co-evolving-memory-and-retrieval-for-long-video-understanding/videoevolve-architecture.svg)

> 그림 1. 고정 Base Memory, 선택적 Delta 보강, 질문별 검색·원본 재방문, 그리고 BEF/CEF가 닫힌 공진화 루프를 만드는 흐름. [논문 Figure 2와 Sections 3.1–3.6](https://arxiv.org/html/2610.10183)을 바탕으로 한국어로 재구성했다. 원문은 arXiv 비독점 라이선스이므로 원본 그림을 복사하지 않았다.

결과 도표보다 원문 Figure 2의 전체 아키텍처를 골랐다. 이 논문의 새로움은 단일 성능 수치보다 **쓰기 정책과 읽기 정책이 서로의 환경과 감독 신호를 어떻게 바꾸는가**에 있기 때문이다. 왼쪽에서 저프레임률 비디오가 고정 Base로 들어가고, 위쪽 Memory Evolver가 질문을 보지 않은 채 시각 증거를 관찰해 Delta를 만든다. 아래쪽 Retrieval Evolver는 업데이트된 메모리를 질문 조건으로 탐색하며 부족할 때만 원본 구간을 다시 본다.

학습에서는 먼저 $R^k$를 고정해 후보 메모리의 downstream QA 성과로 $C^{k+1}$을 만들고, 같은 Base에서 $M^{k+1}$을 재구축한 다음 이를 고정해 $R^{k+1}$을 학습한다. BEF는 Memory-only와 Revisit-enabled의 정확도 차이 및 실제 재방문 여부로 어느 쪽이 병목인지 정하고, CEF는 9개 능력의 수요에 따라 표본 분포를 바꾼다. 추론에는 이 진단·업데이트 루프가 없고, 학습된 Memory Evolver가 만든 메모리와 Retrieval Evolver의 도구 호출만 남는다.

# Experiments / Results

- Qwen3-VL-8B Retrieval backbone을 쓴 VideoEvolve는 Video-MME(자막 포함) 73.9%, LongVideoBench 70.2%, LVBench 58.9%, MLVU 72.4%, MMVU 75.1%를 기록했다(Table 1).
- 같은 Table 1의 공개 agentic 8B 계열 ParaVT-8B와 비교하면 LongVideoBench는 60.4% → 70.2%(+9.8%p), LVBench는 39.8% → 58.9%(+19.1%p), MMVU는 68.6% → 75.1%(+6.5%p)다. 다만 각 방법의 학습 데이터와 도구 구성이 완전히 같지는 않다.
- 핵심 인과 비교는 Table 3의 같은 구현 내 ablation이다. Base(no evolution) 대비 전체 모델은 Video-MME overall +7.1%p, LongVideoBench overall +8.1%p, LVBench +8.6%p, MLVU +7.7%p, MMVU +7.6%p 향상했다.
- 교대 업데이트를 제거하면 LongVideoBench(long)가 65.5%에서 61.5%로 4.0%p 떨어졌다. BEF와 CEF를 모두 제거하면 MMVU가 75.1%에서 68.4%로 6.7%p 떨어져, 단순 공진화만으로는 능력 편향을 막기 어렵다는 저자 주장과 맞는다.
- LVBench 공진화 동역학(Table 4)에서 Memory-only와 Revisit-enabled의 차이는 cycle 0의 4.7%p에서 cycle 4의 0.5%p로 줄었다. 메모리가 더 유용해지며 질문마다 원본 영상을 다시 볼 필요가 감소했다는 간접 증거다.

## 주요 실험 결과

| 벤치마크 / 지표 (정확도 %, ↑) | VideoEvolve | Base (no evolution) |   차이 | 출처         |
| ----------------------------- | ----------: | ------------------: | -----: | ------------ |
| Video-MME overall (자막 포함) |        73.9 |                66.8 | +7.1%p | 원문 Table 3 |
| Video-MME long (자막 포함)    |        67.1 |                57.2 | +9.9%p | 원문 Table 3 |
| LongVideoBench overall        |        70.2 |                62.1 | +8.1%p | 원문 Table 3 |
| LongVideoBench long           |        65.5 |                57.3 | +8.2%p | 원문 Table 3 |
| LVBench                       |        58.9 |                50.3 | +8.6%p | 원문 Table 3 |
| MLVU                          |        72.4 |                64.7 | +7.7%p | 원문 Table 3 |
| MMVU                          |        75.1 |                67.5 | +7.6%p | 원문 Table 3 |

위 표는 논문 Table 3의 동일 시스템 내 `Base (no evolution)`과 전체 VideoEvolve를 직접 대조했다. backbone·평가 프로토콜이 같은 통제 비교이므로 서로 다른 외부 시스템의 최고 수치보다 공진화의 기여를 읽기에 적합하다. 가장 큰 차이는 Video-MME long의 +9.9%p이며, 긴 구간에서 희소한 증거를 Base에 선택적으로 보강하고 다시 찾는 설계가 특히 중요하다는 해석을 뒷받침한다.

# Limitations / Discussion

- 평가는 오프라인 객관식 비디오 이해에 집중한다. 스트리밍 영상, 개방형 대화, 직접적인 오디오 이해에 효과가 있는지는 검증하지 않았다.
- Base와 Delta 레코드는 동결된 멀티모달 Writer의 지각·요약 품질에 의존한다. 출처 링크가 붙은 레코드라도 사실성이 자동으로 보장되지는 않는다.
- 유한한 관찰·재방문 예산 때문에 짧은 사건이나 미세한 시각 단서를 계속 놓칠 수 있다.
- 정책 학습은 정답 라벨을 사용하고, BEF/CEF는 고정 진단 풀과 사전 정의한 9개 능력 분류에 의존한다. 새로운 도메인에서 이 분류와 샘플링 규칙이 그대로 일반화된다는 보장은 없다.
- 일부 외부 baseline 비교는 memory construction 모델, retrieval 모델, 자막 사용, 데이터·도구 설정이 다르다. 따라서 Table 1·2의 방법 간 수치를 모두 엄밀한 동등 조건 비교로 읽으면 안 된다.
- 메모리 구성에 필요한 초기 비디오 처리 비용, 저장 용량, 반복 RL 학습 비용을 end-to-end 효율 지표로 충분히 보고하지 않는다.
- arXiv와 검색 가능한 공식 학회 자료에서 CVPR, ICCV, ECCV, NeurIPS, ICML, ICLR, ACL 계열 채택 기록을 확인하지 못했다.

# 내가 이해한 핵심

VideoEvolve에서 가장 중요한 변화는 외부 메모리를 단순한 저장소가 아니라 **학습되는 환경**으로 다룬다는 점이다. 검색기가 실패한 이유가 “필요한 정보가 애초에 없어서”인지 “있는데 못 찾아서”인지 분리하고, 전자라면 쓰기 정책을, 후자라면 읽기 정책을 더 학습한다. 두 정책을 동시에 흔들지 않고 한쪽을 고정한 채 다른 쪽의 효과를 측정하는 교대 방식은 이 책임 할당을 가능하게 한다.

다만 공진화가 곧 지속적인 자율 학습을 뜻하지는 않는다. 현재 형태는 정답이 있는 고정 데이터와 진단 풀에서 주기적으로 최적화하며, 추론 중에는 정책이 업데이트되지 않는다. 그래서 이 논문의 “self-evolving”은 배포 후 무한히 스스로 배우는 시스템보다는, downstream 경험을 메모리 쓰기·읽기 정책 양쪽에 되먹임하는 훈련 절차로 이해하는 편이 정확하다.

# 다음에 연결해서 읽을 논문

- [WorldMM: Dynamic Multimodal Memory Agent for Long Video Reasoning](https://arxiv.org/abs/2512.02425)
- [M3-Agent: Seeing, Listening, Remembering, and Reasoning](https://arxiv.org/abs/2508.09736)
- [VideoZoomer: Reinforcement-Learned Temporal Focusing for Long Video Reasoning](https://arxiv.org/abs/2512.22315)
- [VideoTapestry: Query-Adaptive Memory Refinement for Multi-Agent Long-Video Understanding](/papers/vlm/videotapestry-query-adaptive-memory-refinement-for-multi-agent-long-video-understanding)
