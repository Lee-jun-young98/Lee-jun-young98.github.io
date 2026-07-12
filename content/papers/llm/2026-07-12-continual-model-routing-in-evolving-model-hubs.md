---
title: "Continual Model Routing in Evolving Model Hubs: 계속 늘어나는 모델 허브에서 라우터를 유지하는 법"
date: 2026-07-12
tags:
  - "paper-review"
  - "LLM"
  - "Routing"
  - "Small-Model"
  - "Multi-Domain"
author: "Jack Bell, Giacomo Carfi, Gerlando Gramaglia, Vincenzo Lomonaco"
journal: "arXiv 2026"
paper: "https://arxiv.org/abs/2605.28577"
aliases:
  - "/papers/llm/continual-model-routing-in-evolving-model-hubs"
  - "/papers/continual-model-routing-in-evolving-model-hubs"
---

# 한 줄 요약

이 논문은 모델 라우팅을 "한 번 학습해 두고 끝내는 분류기"가 아니라, 계속 새로운 모델이 추가되는 허브 환경에서 **잊지 않으면서 갱신되어야 하는 continual learning 문제**로 다시 정의한다. 내 관점에서는 작은 모델 라우터, 도메인 라우팅, 멀티도메인 전문가 선택을 한 단계 더 현실적인 시스템 문제로 끌어내린 논문이다.

# 논문 메타데이터

- 제목: [Continual Model Routing in Evolving Model Hubs](https://arxiv.org/abs/2605.28577)
- 저자: Jack Bell, Giacomo Carfi, Gerlando Gramaglia, Vincenzo Lomonaco
- 기관: University of Bologna, University of Modena and Reggio Emilia, ContinualAI
- 공개일: 2026-05-27
- 링크: [arXiv abs](https://arxiv.org/abs/2605.28577), [arXiv HTML](https://arxiv.org/html/2605.28577v1), [PDF](https://arxiv.org/pdf/2605.28577)

# 이번 주 후보 논문과 공식 연구 게시물

| 후보 | 본 이유 | 이번 주 판단 |
| --- | --- | --- |
| [Continual Model Routing in Evolving Model Hubs](https://arxiv.org/abs/2605.28577) | 수천 개 모델, 멀티도메인, continual update, 작은 라우터 유지라는 문제가 한 번에 들어 있다. | 선택 |
| [Learning Agent Routing From Early Experience](https://arxiv.org/abs/2605.07180) | LLM vs agent escalation을 early-experience memory로 라우팅한다는 점이 실무적이다. 다만 주제가 agent escalation 쪽에 더 가깝다. | 제외 |
| [Grounded Cache Routing for Retrieval-Augmented Generation: When Is It Safe to Reuse an Answer?](https://arxiv.org/abs/2605.27494) | RAG 캐시 reuse를 안전성 문제로 재정의한 점이 좋다. 하지만 라우팅 범위가 cache-admit 여부로 좁다. | 제외 |
| [GraphRAG-Router: Learning Cost-Efficient Routing over GraphRAGs and LLMs with Reinforcement Learning](https://arxiv.org/abs/2604.16401) | GraphRAG와 generator LLM을 계층적으로 라우팅하는 강한 RAG 논문이다. 이번 주엔 "지속적 라우터 유지" 쪽이 더 새롭다고 봤다. | 제외 |
| [Lightweight Query Routing for Adaptive RAG: A Baseline Study on RAGRouter-Bench](https://arxiv.org/abs/2604.03455) | TF-IDF+SVM 같은 얕은 라우터가 surprisingly strong하다는 결과가 실무적이다. 다만 baseline study 성격이 강하다. | 제외 |
| [RAGRouter-Bench: A Dataset and Benchmark for Adaptive RAG Routing](https://arxiv.org/abs/2602.00296) | adaptive RAG routing의 평가 기반을 만든 중요한 벤치마크다. 하지만 이번 자동화의 목적상 방법론보다 benchmark contribution이 크다. | 제외 |
| [Unlocking dependable responses with Gemini Enterprise Agent Platform’s Agentic RAG](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/) | 2026-06-05 Google Research 공식 글로 agentic RAG의 workflow, planning, iterative search 감각을 보여 준다. 다만 공개 실험 세부와 ablation이 제한적이다. | 참고만 |

# 최종 선정 이유

이번 주에는 `Continual Model Routing in Evolving Model Hubs`가 가장 중요했다.

첫째, 작은 모델 라우터를 실제 운영 환경으로 옮겼을 때 생기는 문제를 정면으로 다룬다.  
둘째, 도메인 라우팅과 모델 선택을 멀티도메인, 대규모 후보군, 시간에 따른 허브 확장이라는 조건에서 함께 본다.  
셋째, 단순 accuracy 경쟁이 아니라 forgetting, replay budget, candidate explosion, top-k rerank 가능성까지 다룬다.  
넷째, RAG 시스템에도 직접 연결된다. 실무의 RAG 라우팅도 결국 "새 인덱스, 새 리트리버, 새 모델이 계속 늘어날 때 라우터를 어떻게 유지할 것인가"의 문제로 수렴하기 때문이다.

# 논문이 풀려는 문제

기존 모델 라우팅 논문은 대체로 정적인 후보군을 가정한다. 예를 들어 "여러 모델 중 어떤 모델이 이 질의에 가장 적합한가?"는 자주 묻지만, 그 모델 풀이 한 달 뒤 두 배로 늘어났을 때 라우터를 어떻게 갱신할지는 잘 다루지 않는다.

이 논문은 그 빈틈을 정확히 짚는다.

- 모델 허브는 계속 커진다.
- 새로운 도메인과 새 모델 family가 들어온다.
- 과거에 잘 라우팅하던 능력은 잊어버리기 쉽다.
- 후보가 2,000개를 넘으면 full softmax classification이나 post-hoc 비교는 비용이 커진다.

즉 문제는 "좋은 라우터를 학습하자"가 아니라, **"계속 변하는 모델 허브에서 라우터를 싸게, 빠르게, 덜 잊으면서 유지하자"**다.

# 기존 방법의 한계

논문이 비판하는 기존 접근은 크게 세 갈래다.

1. retrieval-only / model-card 검색형 라우팅  
   모델 카드나 설명문을 질의와 매칭해 후보를 찾는 방법이다. 초기에 편하지만, 후보군이 커질수록 brittle해지고 실제 선택 선호를 잘 반영하지 못한다.

2. LLM reasoning 기반 라우팅  
   HuggingGPT 류처럼 모델 메타데이터를 읽고 추론하는 방식이다. 유연하지만 후보가 많아질수록 느리고 안정성이 떨어진다.

3. 일반 continual learning baseline  
   replay, EWC, LwF 같은 표준 기법을 그대로 붙이면 forgetting은 줄일 수 있어도, expanding label space와 hub-scale routing에 맞춘 구조가 부족하다.

핵심은 이 논문이 model routing을 단순 retrieval도, 고정 분류도 아닌 **class-incremental selection**으로 본다는 점이다.

# 핵심 아이디어

핵심은 두 가지다.

1. 문제 재정의  
   모델 라우팅을 pre-inference expert selection의 continual learning 문제로 본다.

2. CARvE  
   `Continual Anchored Router with Contrastive Embeddings`라는 임베딩 기반 라우터를 제안한다. 쿼리를 임베딩하고, 계속 확장되는 모델 임베딩 registry와 비교해서 적절한 모델 ID를 고른다.

이 방식의 장점은 명확하다.

- 거대한 분류 헤드를 매번 다시 만들 필요가 없다.
- 새 모델 ID를 registry에 추가하면서 점진적으로 확장할 수 있다.
- top-k 후보를 뽑아 rerank하는 식으로 운영 확장이 쉽다.

# 방법론 상세 설명

## 1. routing은 model-card text가 아니라 learned embedding space에서 수행된다

CARvE는 model-card 텍스트를 직접 읽지 않는다. 사용자 질의를 backbone LLM hidden state 기반 임베딩으로 바꾸고, 각 모델 ID도 학습된 embedding으로 관리한다. 라우팅은 결국 `query embedding`과 `model embedding`의 유사도 비교다.

내가 보기에 이 결정은 꽤 중요하다. 모델 카드 기반 retrieval은 새 모델이 들어올수록 설명 품질 편차를 그대로 먹는데, CARvE는 실제 supervised prompt-model pair에서 geometry를 배운다.

## 2. expanding label space를 classifier head 대신 registry expansion으로 처리한다

논문이 말하는 계속 학습의 본질은 "새 클래스가 늘어나는 문제"다. 보통 classifier면 출력 차원이 계속 커지고 예전 클래스 분포를 유지하기가 어렵다. CARvE는 이를 embedding registry 확장 문제로 바꾼다.

- 기존 모델 ID embedding은 최대한 안정적으로 보존
- 새 모델 ID embedding만 추가
- query projection도 너무 흔들리지 않게 anchoring

이 설계 덕분에 기존 모델 공간의 geometry를 유지하면서 새 모델을 편입할 수 있다.

## 3. asymmetric anchoring

방법의 기술적 핵심은 anchoring이다.

- embedding anchoring: 예전에 학습된 model embedding의 위치가 너무 흔들리지 않게 묶는다.
- projection anchoring: query를 embedding space로 보내는 projection 자체의 drift를 제한한다.

논문 해석상 projection anchoring의 효과가 더 크다. 결국 라우터가 망가지는 이유는 "모델 점"이 조금 흔들리는 것보다, 질의를 투사하는 좌표계가 통째로 회전해 버리는 데 가깝다는 뜻이다.

## 4. full softmax 대신 fixed-size candidate-set training

후보가 수천 개면 전체 후보에 대해 매 step loss를 계산하는 건 비싸다. 논문은 고정 크기 후보 집합 `K`를 구성해서 contrastive하게 학습한다.

여기엔 여러 종류의 negative가 들어간다.

- hard negatives
- semantic negatives
- far negatives

이 조합이 중요한 이유는, 라우팅이 결국 ranking 문제이기 때문이다. 비슷한 도메인 안에서 헷갈리는 모델을 분리해 내야 한다.

## 5. structured replay

CARvE는 random replay 대신 domain-stratified coreset replay를 쓴다. 논문에서 반복해서 드러나는 메시지는, 그냥 옛 샘플을 섞는 것보다 **도메인과 모델 축을 의식적으로 보존하는 replay**가 더 안정적이라는 점이다.

# 모델 구조 또는 파이프라인 설명

추론 시 파이프라인은 매우 단순하다.

```text
query
  -> backbone hidden state
  -> query projection / normalization
  -> similarity against model registry
  -> choose top-1 model ID
  -> optional top-k rerank downstream
```

학습 파이프라인은 더 흥미롭다.

```text
experience t arrives
  -> add new model IDs to registry
  -> build domain-aware replay buffer
  -> sample candidate set K
  -> contrastive routing loss
  -> keep previous geometry via embedding/projection anchoring
  -> periodic hard-negative mining
```

여기서 좋은 점은 "라우터가 정답을 생성하지 않는다"는 것이다. 작은 모델이 해야 할 일을 `선택`으로 제한하고, 선택 공간을 임베딩 문제로 바꿔 놓았다. 작은 모델 라우터 연구 방향과 정확히 맞닿는다.

# 실험 설정

## 벤치마크: CMRBench

논문은 `CMRBench`를 제안한다. 이 벤치마크는 네 개의 sequential experience로 구성된다.

- APIBench 기반 경험
- ToolMMBench 기반 경험
- 새로 만든 HuggingBench의 두 경험

전체적으로 2,000개가 넘는 후보 모델을 포함한다. 논문은 이 점을 매우 강조한다. 기존 routing benchmark가 고정 후보군을 가정하는 반면, 여기서는 hub expansion이 문제 설정의 일부다.

## 평가 지표

- `M-Acc`: exact model-ID accuracy
- `F-Acc`: model family accuracy
- `D-Acc`: domain accuracy
- `D-Fgt`: domain forgetting

`family accuracy`를 따로 둔 점이 좋았다. exact ID가 틀려도 같은 family의 거의 동등한 모델을 고른 경우와, 완전히 엉뚱한 도메인 모델을 고른 경우를 분리해서 볼 수 있기 때문이다.

## 비교 대상

- retrieval-only
- retrieval-augmented training 계열
- replay 기반 continual fine-tuning
- EWC, LwF 같은 regularization baseline
- model merging
- cumulative / from-scratch / joint training 류 upper bound

# 주요 결과 해석

## 1. low replay budget에서도 forgetting을 꽤 잘 막는다

논문 본문 결과에서 가장 실무적인 숫자는 10% replay 설정이다.

- CARvE: `80.7% D-Acc`, `5.9% D-Fgt`
- standard replay: `75.9% D-Acc`, `13.1% D-Fgt`

즉 적은 replay로도 정확도는 올리고 forgetting은 절반 이하로 줄인다. 작은 운영 비용으로 라우터를 계속 업데이트하고 싶다는 논문의 목적에 직접 맞는다.

## 2. 20% replay에서는 더 안정적이지만, 10%가 이미 꽤 좋은 design point다

20% replay에서는 `82.9% D-Acc`, `3.0% D-Fgt`까지 올라간다. 하지만 논문이 오히려 설득력 있는 이유는 10% 지점이다. 시스템 설계 관점에서는 최고점보다 "어느 지점에서 충분히 괜찮은 trade-off가 나오느냐"가 더 중요하기 때문이다.

## 3. top-1은 빡빡하지만 top-3 domain routing은 거의 실용 수준이다

논문은 2,000개 넘는 후보에서 top-1 exact routing이 엄격한 기준임을 인정한다. 대신 10% replay에서 `top-3 domain accuracy 94.8%`를 보고한다. 이건 중요한 포인트다.

내 해석으로는, production에서는 다음 구조가 더 현실적이다.

1. CARvE가 top-3 후보군 추림
2. 그 안에서 rerank 또는 lightweight evaluation

논문 결론부가 말하는 hybrid pre- and post-inference 전략도 바로 이 방향이다.

## 4. continual operation이 retrain-from-scratch보다 훨씬 싸다

Figure 3(b) 해석에서 논문은 10% domain replay 기준으로 cumulative training보다 TFLOPs와 GPU GB-hours를 크게 줄였다고 말한다. 더 큰 규모 배포로 환산하면 연간 절감액이 17만 달러를 넘는다고 추정한다.

수치의 절대값보다 중요한 메시지는 이것이다. 모델 허브가 빠르게 바뀌는 환경에선, 계속 처음부터 다시 학습하는 건 곧 운영 불가능하다는 것.

# 표와 그림에서 중요한 포인트

## Figure 1: 문제 정의가 이미 절반이다

Figure 1은 "모델 선택"을 단순 추천이 아니라 evolving hub 위의 continual routing으로 그린다. 이 그림 덕분에 논문의 공헌이 새 아키텍처보다 **문제 설정 전환**에 있다는 점이 선명해진다.

## Figure 2: classifier가 아니라 embedding registry라는 점

Figure 2는 CARvE의 핵심인 query embedding, model embedding registry, replay, hard-negative mining, anchoring을 한 장에 정리한다. 특히 "고정 classifier head" 대신 "계속 확장되는 registry"를 쓰는 발상이 이 논문의 기술적 정체성이다.

## Table 3: ablation에서 진짜 중요한 건 replay와 anchoring이다

Table 3에서 domain replay 10%와 20%가 random replay보다 더 좋고, anchoring을 끄면 성능과 forgetting이 모두 나빠진다. 즉 CARvE의 이득은 그냥 contrastive embedding이라서가 아니라,

- 어떤 샘플을 replay하는지
- embedding space를 얼마나 안정적으로 유지하는지

에 달려 있다.

## Figure 3(b): 비용 그래프가 이 논문의 실무 가치를 보여 준다

논문은 accuracy만으로 승부하지 않는다. 라우터 유지 비용을 계속 측정한다. 이건 내가 이런 류의 시스템 논문을 볼 때 가장 높게 평가하는 부분이다. 실제 배포에선 2pt accuracy보다 "다시 학습할 수 있느냐"가 더 중요할 때가 많다.

# 헷갈리거나 추가 확인이 필요한 부분

몇 가지는 아직 더 보고 싶다.

1. label source의 현실성  
   이 논문은 supervised prompt-model pair가 있다는 전제를 둔다. 실제 서비스에서 이 라벨을 어떻게 지속 수집할지까지는 별도 시스템 문제가 남는다.

2. domain label 품질 의존성  
   domain-aware replay가 강점인데, 반대로 말하면 domain 정의가 흐릿한 환경에선 효과가 줄 수 있다.

3. model-card 미사용의 trade-off  
   CARvE는 model-card text를 직접 보지 않아서 supervised signal에는 강하지만, 완전히 새로운 cold-start 모델에 대한 zero-shot generalization은 약할 수 있다.

4. top-1 exact model-ID accuracy의 의미  
   실제로는 비슷한 성능의 동급 모델이 많다. 이 논문이 family accuracy를 둔 이유도 그 때문인데, 운영 지표를 어떻게 둘지는 더 논의가 필요하다.

# 실무 적용 가능성

높다. 특히 아래 상황에서 바로 연결된다.

- 모델/리트리버/툴 후보군이 계속 늘어나는 플랫폼
- 도메인별 specialist model이 따로 있는 멀티도메인 QA
- "어떤 모델을 돌릴지"가 latency와 비용에 직접 영향을 주는 시스템
- 한 번 만든 라우터가 금방 낡아 버리는 환경

중요한 건 이 논문을 그대로 "모델 허브용 라우터"로만 읽지 않는 것이다. 같은 아이디어는 RAG 시스템의 아래 선택에도 그대로 적용된다.

- 어떤 도메인 인덱스로 갈지
- 어떤 retriever family를 고를지
- 어느 generator size를 붙일지
- top-k rerank가 필요한지

# 직접 구현한다면 어떤 구조로 만들지

내가 구현한다면 아래처럼 나눈다.

## 1. registry layer

- `domain_id`
- `model_id`
- `model_family`
- `cost_profile`
- `capability_tags`
- `last_validated_at`

## 2. router layer

- query encoder
- projection head
- ANN index over model embeddings
- top-k candidate export

## 3. continual training layer

- user selection / eval result 로그 수집
- domain-stratified replay buffer
- periodic hard-negative refresh
- anchoring-aware fine-tuning

## 4. execution layer

- selected model invocation
- fallback rerank
- regret logging

이 구조면 모델 라우팅뿐 아니라 retriever 라우팅, domain routing에도 거의 그대로 복제할 수 있다.

# LangChain, LangGraph, RAG 시스템에 적용할 수 있는 아이디어

## LangChain

- router를 `Runnable`로 분리하고, 출력은 `top_k_candidates`, `domain`, `cost_band`, `confidence`로 둔다.
- 이후 chain이 top-1을 바로 쓰거나, confidence가 낮으면 top-3 rerank branch로 보낸다.
- LangSmith trace에 선택 regret를 남기면 continual replay dataset을 만들기 쉽다.

## LangGraph

LangGraph로 옮기면 다음 그래프가 자연스럽다.

```text
START
  -> domain_or_model_router
  -> if high_confidence: execute_selected
  -> else: rerank_top_k
  -> evaluate_outcome
  -> log_regret_and_feedback
  -> END
```

state에는 아래 값이 있으면 좋다.

- `candidate_ids`
- `selected_domain`
- `selected_model`
- `routing_confidence`
- `routing_regret`
- `experience_bucket`

## RAG 시스템

내가 보기엔 이 논문의 가장 좋은 확장 방향은 `2-stage routing`이다.

1. domain router  
   어떤 corpus 또는 retriever family로 갈지 결정

2. executor router  
   small generator, large generator, GraphRAG, long-context 중 무엇을 쓸지 결정

즉 `CARvE` 같은 continual router를 모델 허브뿐 아니라 RAG component registry에도 적용할 수 있다.

# 한계와 비판

1. 문제 정의가 강한 대신, 실제 answer quality loop는 밖에 있다.  
   이 논문은 pre-inference routing에 집중하므로, 선택된 모델이 실제로 생성한 답을 어떻게 다시 반영할지까지는 다루지 않는다.

2. supervised preference accumulation이 필요하다.  
   현실에서는 prompt-model 정답 라벨을 축적하는 파이프라인 자체가 비싸다.

3. 모델 허브 전용 벤치마크의 편향이 있다.  
   Hugging Face style model ecosystem을 잘 반영하지만, 사내 private model registry나 RAG component registry와 완전히 같지는 않다.

4. 도메인 수준 평가는 강하지만, 세부 capability mismatch는 더 복잡하다.  
   예를 들어 같은 도메인 안에서도 latency, context window, tool-use 능력, groundedness가 다를 수 있다.

# 읽고 난 뒤의 내 생각

이 논문을 읽고 가장 강하게 남은 생각은 이것이다.

**작은 모델 라우터의 진짜 문제는 "지금 어느 모델이 맞나?"가 아니라 "내가 어제 배운 선택 기준을 다음 달에도 유지할 수 있나?"다.**

우리는 종종 라우팅을 한 번의 classifier 설계 문제로 본다. 하지만 실제 제품 환경은 훨씬 더 생태계적이다.

- 새 모델이 계속 나온다.
- 기존 모델이 업데이트된다.
- 도메인이 늘어난다.
- 비용 구조가 바뀐다.

그런데 라우터가 이런 변화를 흡수하지 못하면, 아무리 첫 배포 성능이 좋아도 금방 낡는다. 이 논문은 그 점을 아주 정확하게 짚었다.

내 블로그와 연구 방향으로 연결하면 다음 질문이 남는다.

- 작은 모델 라우터를 continual하게 유지하려면 어떤 replay signal이 가장 싸고 강한가?
- RAG에서 domain router와 model router를 하나의 evolving registry로 통합할 수 있는가?
- top-1 선택보다 top-k shortlist + cheap rerank가 더 현실적이라면, 어디서 분기를 끊는 게 최적인가?

# 블로그용 짧은 요약 초안

`Continual Model Routing in Evolving Model Hubs`는 모델 라우팅을 정적인 분류 문제가 아니라, 계속 새로운 모델이 추가되는 허브 환경에서 라우터를 업데이트하는 continual learning 문제로 재정의한다. 논문이 제안한 `CARvE`는 질의와 모델을 같은 임베딩 공간에 놓고, replay와 anchoring으로 예전 선택 기준을 덜 잊으면서 새 모델을 편입한다. 특히 2,000개가 넘는 후보에서 10% replay만으로도 높은 domain accuracy와 낮은 forgetting을 유지한다는 점이 인상적이었다. RAG 관점에서 보면 이 논문은 단순 모델 선택을 넘어서, 늘어나는 retriever와 generator 후보군을 어떻게 지속적으로 라우팅할지에 대한 좋은 설계 힌트를 준다.

# 참고 링크

- 논문: [Continual Model Routing in Evolving Model Hubs](https://arxiv.org/abs/2605.28577)
- HTML: [arXiv HTML](https://arxiv.org/html/2605.28577v1)
- PDF: [arXiv PDF](https://arxiv.org/pdf/2605.28577)
- 비교 후보: [Learning Agent Routing From Early Experience](https://arxiv.org/abs/2605.07180)
- 비교 후보: [Grounded Cache Routing for Retrieval-Augmented Generation](https://arxiv.org/abs/2605.27494)
- 비교 후보: [GraphRAG-Router](https://arxiv.org/abs/2604.16401)
- 비교 후보: [Lightweight Query Routing for Adaptive RAG](https://arxiv.org/abs/2604.03455)
- 비교 후보: [RAGRouter-Bench](https://arxiv.org/abs/2602.00296)
- 공식 연구 글: [Google Research - Agentic RAG](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/)
