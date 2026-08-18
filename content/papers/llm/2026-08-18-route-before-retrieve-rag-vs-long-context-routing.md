---
title: "Route Before Retrieve: RAG vs Long Context 라우팅을 먼저 결정하는 방법"
date: 2026-08-18
tags:
  - "paper-review"
  - "LLM"
  - "RAG"
  - "Routing"
author: "Yiwen Chen, Kuan Li, Fuzhen Zhuang, Deqing Wang, Zhao Zhang, Liwen Zhang, Yong Jiang, Shuai Wang, Minhao Cheng"
journal: "arXiv 2026"
paper: "https://arxiv.org/abs/2605.10235"
aliases:
  - "/papers/llm/route-before-retrieve-rag-vs-long-context-routing"
---

# 한 줄 요약

RAG를 먼저 돌려보고 실패하면 Long Context로 가는 기존 방식보다, 질의와 문서 메타데이터만 보고 미리 라우팅하는 작은 전용 router가 더 싸고 더 안정적일 수 있다는 논문이다.

# 논문 메타데이터

- 제목: Route Before Retrieve: Activating Latent Routing Abilities of LLMs for RAG vs. Long-Context Selection
- 저자: Yiwen Chen, Kuan Li, Fuzhen Zhuang, Deqing Wang, Zhao Zhang, Liwen Zhang, Yong Jiang, Shuai Wang, Minhao Cheng
- 기관: Beihang University, HKUST, Alibaba Group, Pennsylvania State University
- 링크: https://arxiv.org/abs/2605.10235
- 공개일: 2026-05-12 (arXiv v2)

# 이번 주 후보

## 후보 1. Route Before Retrieve: Activating Latent Routing Abilities of LLMs for RAG vs. Long-Context Selection

- 선택
- 이유: RAG 시스템에서 바로 적용 가능한 routing 문제를 정면으로 다루고, prompt-only 대 distillation 대 small router까지 연결되어 있어서 실무 전환 아이디어가 가장 명확하다.

## 후보 2. Continual Model Routing in Evolving Model Hubs

- 보류
- 이유: 매우 좋은 논문이지만 초점이 RAG 라우팅보다 "수천 개 모델 허브에서의 continual model selection"에 더 가깝다. 내 블로그의 LangChain/RAG 독자에게는 한 단계 더 추상적이다.

## 후보 3. LLMRouter: Unified Infrastructure for Developing, Evaluating, and Deploying LLM Routers

- 보류
- 이유: 최신성은 매우 좋고 survey+benchmark 성격도 강하지만, 이번 주에는 "프레임워크 소개"보다 "한 가지 routing 아이디어를 깊게 파는 글"이 더 낫다.

## 후보 4. Opportunity Is Not Realizability: Selection-Valid Diagnostics for Multi-LLM Routing

- 제외
- 이유: 진단과 평가 프레임은 흥미롭지만, 바로 구현해볼 수 있는 구조적 제안보다 평가론 성격이 강하다.

## 후보 5. OrcaRouter: A Production-Oriented LLM Router with Hybrid Offline-Online Learning

- 보류
- 이유: production bandit router 관점은 좋지만, 이번 자동화의 핵심 키워드인 RAG vs LC 선택과 직접 연결되지는 않는다.

## 후보 6. VDGR-RAG: Vectors, Directories, Graphs, and Reflection for Enterprise QA

- 제외
- 이유: enterprise RAG 아키텍처로는 실용적이지만, 논문의 중심이 retrieval fusion과 domain structure 활용에 있고 routing 자체의 통찰은 상대적으로 약하다.

## 후보 7. Cross-Domain Hybrid OPD for Generalizable Search Agents

- 제외
- 이유: 멀티도메인 학습 관점에서는 흥미롭지만 search agent 학습 논문이라 이번 주 주제 중 "작은 모델 router / RAG routing"과는 거리가 있다.

## 후보 8. Google Research Blog - Unlocking dependable responses with Gemini Enterprise Agent Platform’s Agentic RAG

- 제외
- 이유: 공식 연구 블로그로서 방향성은 참고할 만하지만, 논문급의 실험/ablation/한계 분석을 제공하지 않아 이번 주 deep review 대상로는 부족하다.

## 후보 9. NEC Labs - Learning to Route: A Rule-Driven Agent Framework for Hybrid-Source Retrieval-Augmented Generation

- 제외
- 이유: 실무 시스템 관찰이 좋아서 참고 링크로는 유용하지만, 이번 글처럼 representation probing과 distillation까지 다루는 연구 밀도는 아니다.

# 최종 선정 이유

이번 주에는 "작은 모델 router", "RAG", "domain-aware routing", "LangGraph에 바로 넣을 수 있는 구조"라는 네 조건을 동시에 만족하는 논문이 중요했다. 이 논문은 세 가지 점에서 우선순위가 높다.

첫째, 문제 정의가 정확하다. 실제 서비스에서는 모든 질문을 Long Context로 밀어넣는 것도 비싸고, 무조건 RAG를 먼저 태우는 것도 retrieval miss가 나면 답질이 흔들린다. 둘째, 해결 방식이 과하게 복잡하지 않다. 메타데이터만 보고 미리 route를 결정하고, 그 reasoning trace를 작은 모델로 distill한다. 셋째, 결과가 단순 accuracy 자랑이 아니라 cost-efficiency tradeoff까지 같이 보여준다.

논문이 아주 완성형이라고 보지는 않지만, "라우팅은 이미 큰 모델 안에 잠재돼 있고, 우리는 그 decision boundary를 끌어내어 작은 전용 모듈로 만들 수 있다"는 메시지는 내 블로그와 앞으로의 RAG 시스템 연구 방향에 직접 연결된다.

# 논문이 풀려는 문제

Long-context LLM이 강해지면서 문서 전체를 그대로 넣는 LC(Long Context) 전략이 가능해졌지만, 실제로는 모든 질의가 LC를 필요로 하지는 않는다. 반대로 RAG는 싸고 빠르지만 retrieval quality에 성능이 묶인다.

그래서 질문은 단순하다.

- 지금 이 질의는 RAG로 충분한가
- 아니면 문서 전체를 읽는 LC가 필요한가

기존의 Self-Route류 방법은 보통 RAG를 먼저 시도한 뒤 "답변 불가" 같은 self-assessment 신호가 나오면 LC로 fallback한다. 그런데 이 방식은 이미 retrieval 비용을 먼저 냈고, 모델의 자기평가가 부정확하면 잘못된 fallback이 발생한다.

이 논문은 이 문제를 "answer 전에 route를 결정하는 pre-routing" 문제로 재정의한다.

# 기존 방법의 한계

논문이 지적하는 기존 한계는 꽤 설득력 있다.

1. 기존 fallback 방식은 passive하다.
   RAG를 먼저 돌린 다음 실패를 감지해야 하므로, 라우팅이라기보다 사후 복구에 가깝다.

2. retrieval overhead를 항상 낸다.
   결국 LC가 더 맞는 질의라도, Self-Route는 retrieval, embedding, vector search, reranking 비용을 먼저 지불한다.

3. self-assessment가 불안정하다.
   모델이 실제로는 LC가 필요한데도 RAG 답을 강하게 믿거나, 반대로 RAG로 충분한데도 과하게 보수적으로 LC를 고를 수 있다.

4. 해석 가능성이 낮다.
   왜 LC를 골랐는지, 왜 RAG를 골랐는지 reasoning trace가 약하다.

# 핵심 아이디어

핵심 아이디어는 생각보다 간단하다.

- 질의와 문서 메타정보만 보고
- "이 문제는 어떤 종류의 정보 배치와 reasoning을 요구하는가"를 먼저 판단한 뒤
- RAG 또는 LC 중 하나를 고른다

여기서 메타정보는 문서 전체가 아니다.

- user query
- task type
- document title/type
- document length
- leading snippet(head)
- answering model 정보
- RAG configuration

즉, 비싼 retrieval이나 full-document LC pass 전에 미리 싸게 route를 고르자는 것이다.

논문의 더 흥미로운 주장은, 이 routing 능력이 새로 학습되어야 하는 것이 아니라 이미 큰 LLM 내부에 latent ability로 존재한다는 점이다. 적절한 structured prompt를 주면 그 잠재 능력이 활성화된다고 본다.

# 방법론 상세 설명

## 1. latent routing ability 검증

논문은 바로 Pre-Route를 제안하지 않고, 먼저 "정말 LLM 안에 routing 능력이 숨어 있는가?"를 검증한다.

### Behavioral evidence: Best-of-N

동일한 metadata를 주고 세 가지 prompt paradigm을 비교한다.

- answer directly
- unconstrained CoT
- Pre-Route structured reasoning

그리고 `N in {1, 2, 4, 8}`의 Best-of-N 샘플링으로 routing accuracy를 본다.

관찰은 명확하다.

- direct/unconstrained CoT는 `N`이 커질수록 routing accuracy가 크게 오른다
- Pre-Route는 `N=1`에서도 높은 accuracy를 보이고, 이후 증가폭이 완만하다

이 해석은 중요하다. 모델이 원래 routing 지식을 모르던 게 아니라, single shot에서는 그 지식을 안정적으로 꺼내지 못했다는 뜻이다. structured guideline이 그 불안정성을 줄여준다는 주장이다.

### Representation evidence: linear probe

저자들은 frozen representation 위에 linear probe를 올려서 다음 타깃을 예측한다.

- ideal label
- model’s own route choice
- document type
- task type

핵심은 ideal label의 linear separability다. Qwen3-1.7B에서 unconstrained CoT 대비 Pre-Route가 ideal-label probe accuracy를 크게 끌어올리고, distillation을 더하면 조금 더 개선된다. 저자 해석대로라면 structured prompt가 decision boundary를 representation space에서 더 잘 드러나게 만든 셈이다.

나는 이 부분을 꽤 높게 평가했다. 그냥 "prompt가 잘 된다"가 아니라, 왜 잘 되는지를 representation level에서 설명하려는 시도이기 때문이다. 물론 probe 결과만으로 인과를 강하게 말하긴 어렵지만, 최소한 논문의 핵심 서사를 떠받치는 보조 증거로는 충분하다.

## 2. Pre-Route 프레임워크

Pre-Route는 여섯 단계 reasoning chain으로 route를 결정한다.

1. task & document characterization
2. distribution pattern judgment
3. context-window feasibility
4. retrieval feasibility
5. model capability consideration
6. efficiency trade-off

이 여섯 단계는 결국 다음 질문들로 요약된다.

- 답에 필요한 정보가 문서 한 군데에 모여 있는가, 여기저기 흩어져 있는가
- retrieval이 놓치기 쉬운 유형인가
- full context를 넣을 수는 있어도 position sensitivity 때문에 오히려 손해인가
- 지금 answer model이 LC reasoning을 충분히 소화할 수 있는가
- 비용을 고려하면 RAG 쪽으로 기울어야 하는가

마지막에는 route뿐 아니라 rationale도 함께 출력한다. 여기서 중요한 점은 retrieval result가 아니라 "retrieval feasibility"를 추론한다는 점이다. 실제 검색을 해보고 실패를 감지하는 것이 아니라, 검색이 잘될 유형인지 먼저 분류하는 셈이다.

## 3. ideal label 정의

이 논문의 label 정의는 꽤 실무적이다.

- LC의 QA 성능이 RAG보다 높으면 LC
- 그렇지 않으면 RAG

동률이면 더 싼 RAG를 고른다.

즉, route accuracy는 단순 분류 정답률이 아니라 "성능-비용 균형에 맞는 올바른 의사결정 비율"이다. 이 정의가 좋았던 이유는, production router에서 정말 원하는 목적함수와 가까워 보이기 때문이다.

## 4. distillation: 큰 모델 reasoning을 작은 router로 압축

가장 실용적인 부분은 distillation이다.

teacher가 reasoning trace와 route를 생성하면, ideal label과 일치하는 sample만 rejection sampling으로 남긴다. 이후 student는 `(metadata -> reasoning trace + route)`를 SFT로 학습한다.

포인트는 "정답만 베끼는 distillation"이 아니라 "어떻게 route를 결정했는가"를 학습시킨다는 데 있다. 논문 표현대로 answer distillation이 아니라 planning distillation에 가깝다.

# 모델 구조 또는 파이프라인 설명

내가 이해한 파이프라인은 아래와 같다.

```text
User Query
  -> Metadata Builder
     - task type
     - doc title/type
     - doc length
     - head snippet
     - answer model
     - rag config
  -> Pre-Route Router
     - 6-step reasoning
     - route = RAG | LC
     - rationale
  -> Execution Path
     - if RAG: retrieve -> rerank -> answer
     - if LC: full-context answer
```

학습 시에는 여기에 teacher/student distillation이 추가된다.

```text
Teacher LLM
  -> reasoning trace + route
  -> ideal-label filter
  -> filtered training set
  -> small router SFT
```

실무적으로는 이 router를 LangGraph entry node 또는 retrieval orchestration 앞단 classifier로 두면 된다.

# 실험 설정과 주요 결과 해석

## 데이터셋과 평가

- In-domain: LaRA
- OOD: LongBench-v2
- Retrieval setup: chunk size 600, overlap 100, `gte-multilingual-base` embedding, `gte-multilingual-reranker-base` reranker, rerank size 5 또는 7/10 변형
- 메트릭:
  - Route Accuracy
  - QA Score
  - LC Selection Rate

LC Selection Rate를 비용 proxy로 쓰는 점이 좋다. 실제 production에서는 토큰 비용, latency, retriever I/O가 중요하니, accuracy만 보는 router 평가는 부족하다.

## LaRA in-domain 결과

핵심 패턴은 일관적이다.

- Pre-Route가 Self-Route보다 route accuracy와 QA에서 대체로 우세하다.
- 동시에 LC 사용률을 많이 낮춘다.
- 큰 teacher의 reasoning을 distill한 `D-Q1.7B`가 작은 router 중 가장 실용적이다.

특히 강한 answer model인 Qwen3-235B[T] 기준으로 보면:

- Self-Route: QA 3.34, LC 33.9%, Acc 0.52
- Pre-Route(D-Q1.7B)[N]: QA 3.43, LC 22.7%, Acc 0.69
- Pre-Route(D-Q1.7B)[T]: QA 3.44, LC 26.0%, Acc 0.67

이건 꽤 큰 차이다. 더 적은 LC 사용으로 더 높은 QA와 더 높은 route accuracy를 만든다. 작은 router가 그냥 싸기만 한 게 아니라 decision quality도 올라간다.

또 하나 흥미로운 점은 prompt-only small model인 `Q1.7B`가 불안정하다는 것이다. 논문도 small model error가 대체로 over-conservative, 즉 LC 과선택으로 나타난다고 분석한다. 이건 내 경험과도 맞다. 작은 모델은 retrieval sufficiency를 판단할 때 surface cue에 끌리기 쉽다.

## LongBench-v2 OOD 결과

OOD에서도 메시지는 비슷하다.

- Self-Route가 binary MCQ 평가에서는 겉보기 QA 점수가 덜 나빠 보일 수 있다.
- 그래도 Pre-Route는 LC 사용률을 더 낮추면서 비슷하거나 더 나은 accuracy를 유지한다.

예를 들어 Qwen3-235B[T] answer model 기준:

- Self-Route: QA 0.50, LC 46.6%, Acc 0.55
- Pre-Route(D-Q1.7B)[N]: QA 0.50, LC 28.8%, Acc 0.61
- Pre-Route(R1)[T]: QA 0.48, LC 24.0%, Acc 0.65

즉 OOD에서도 "쉽거나 retrieval-friendly한 샘플을 값싸게 넘기고, 진짜 LC가 필요한 샘플만 올리는" 성질이 유지된다.

# 표와 그림에서 중요한 포인트

## Figure 1

cost-effectiveness visualization인데, 논문의 메시지를 한 장으로 압축한다. 단순히 정확도가 더 높다는 그림이 아니라 "비용 대비 더 나은 operating point"를 보여주는 그림이다. 이 논문이 routing 논문으로서 의미가 있는 이유도 여기에 있다.

## Figure 2

Best-of-N 결과가 핵심이다. structured prompt를 주지 않았을 때는 `N`이 늘수록 accuracy가 크게 오르고, structured prompt를 주면 `N=1`부터 이미 높은 편이다. 이 그림이 곧 "latent ability exists, but activation is unstable"라는 논문 전체 논리의 출발점이다.

## Figure 3

Pre-Route overview. 메타데이터 기반 reasoning -> route 결정 -> rejection sampling -> small router distillation이라는 논문 구조를 가장 잘 보여준다. 읽으면서 느낀 건, 사실상 "reasoning-annotated router data generation pipeline" 논문으로 읽어도 된다는 점이다.

## Table 2

routing cost 분석이다.

- Self-Route with Qwen3-235B: 총 `0.76e-3 USD`
- Pre-Route with Qwen3-235B: 총 `1.07e-3 USD`
- Pre-Route with Qwen3-1.7B: 총 `0.16e-3 USD`

중요한 해석은 "큰 모델로 직접 reasoning router를 쓰면 planner cost가 약간 늘 수 있지만, distill된 small router를 쓰면 오히려 매우 싸진다"는 것이다.

## Table 3

in-domain 메인 결과표다. top results가 대부분 Pre-Route 계열에 모여 있고, 특히 distilled router가 꽤 강하다. 논문 주장대로 plug-and-play small router를 만들 수 있다는 근거가 여기 있다.

## Table 5

ablation이 좋다. 특히 `No Decision Rules`에서 LC rate가 45.3%까지 튀는 게 인상적이다. structured reasoning의 핵심은 막연한 chain-of-thought가 아니라 "의사결정 규칙을 노출하는 것"이라는 점을 보여준다.

## Table 6

metadata robustness가 생각보다 좋다.

- Head-only만으로도 Self-Route보다 낫다.
- Generated-Meta가 Full-Meta 격차를 상당히 메운다.

실무적으로는 이게 중요하다. production 문서 시스템에서 `doc_type`, `task_type` 라벨이 깔끔하게 존재하지 않는 경우가 많기 때문이다.

## Table 13 / 14

문서 유형과 난이도별 breakdown도 의미 있다.

- Paper, Financial에서 gains가 특히 크다.
- Hallucination task에서 Self-Route accuracy 0.22 -> Pre-Route 0.75로 큰 폭 개선

이건 retrieval miss나 self-assessment failure가 심한 케이스일수록 proactive routing이 더 유리하다는 신호로 읽힌다.

# 헷갈리거나 추가 확인이 필요한 부분

1. ideal label 생성 과정이 완전히 deployment 현실을 대변하는지는 더 봐야 한다.
   LC와 RAG의 정답 품질 차이가 아주 작을 때 무조건 RAG를 선호하는 규칙은 합리적이지만, 실제 서비스는 latency SLO나 citation quality 같은 추가 목적함수가 있다.

2. LaRA 자체가 얼마나 production-like한가.
   논문은 꽤 설득력 있게 실험했지만, 실제 사내 문서나 customer support corpus처럼 더 지저분한 환경에서도 같은 패턴이 유지되는지는 별도 검증이 필요하다.

3. binary route만으로 충분한가.
   현실에서는 `RAG`, `LC`, `Hybrid`, `Multi-hop RAG`, `Graph RAG`, `ask-clarification` 같은 action space가 더 자연스럽다. 이 논문은 그중 가장 단순한 2-way split만 다룬다.

4. representation probe 해석의 강도
   linear probe 결과는 재밌지만, "structured prompt가 routing dimension을 만든다"와 "원래 있던 dimension을 더 잘 읽게 한다" 사이 인과는 여전히 조심해서 읽어야 한다.

# 실무 적용 가능성

실무 적용성은 높다. 특히 다음 조건에서 바로 의미가 있다.

- 긴 문서 QA 시스템이 이미 있고
- 모든 질의를 LC로 보내기엔 비용이 크고
- retrieval miss가 자주 나며
- 현재 fallback 로직이 단순 rule 또는 self-critique 기반인 경우

내가 보기엔 이 논문의 가장 좋은 포인트는 architecture change가 작다는 점이다. retriever나 answer model을 바꾸지 않고, 앞단에 얇은 router만 추가해도 된다.

# 직접 구현한다면 어떤 구조로 만들지

내가 직접 만들면 아래 구조로 간다.

1. `metadata extractor`

- query length
- question type classifier
- doc length
- head snippet
- title
- source/domain
- retriever candidate stats(optional)

2. `teacher router dataset builder`

- strong LLM으로 6-step reasoning 생성
- 실제 RAG/LC answer score 비교
- ideal label 생성
- teacher error filtering

3. `small router`

- 1B~3B class instruct model
- output schema:
  - route
  - confidence
  - rationale
  - fallback hint

4. `executor`

- `route=RAG`면 dense+sparse hybrid retrieval
- `route=LC`면 compression 또는 full-context path
- low confidence면 hybrid path나 second opinion 실행

5. `online evaluator`

- answer quality proxy
- citation coverage
- latency
- token cost
- user correction signal

논문은 reasoning trace 전체를 생성하게 하지만, 실제 서비스에서는 최종 router output을 JSON으로 강하게 제한할 것이다.

# LangChain, LangGraph, RAG 시스템에 적용할 수 있는 아이디어

## LangChain

- `RunnableBranch` 앞단에 Pre-Route 스타일 classifier를 둔다.
- metadata만 모아 router chain을 한 번 태운 뒤 `RAGChain`과 `LongContextChain`으로 분기한다.

## LangGraph

- `route_planner` 노드를 별도로 둔다.
- 상태에 `query`, `doc_meta`, `router_reason`, `route`, `confidence`를 저장한다.
- `confidence`가 낮으면 `secondary_router`나 `hybrid_retrieval` 노드로 보낸다.

## RAG 시스템

- 단순 2-way route에 그치지 않고 4-way로 확장할 수 있다.
  - `simple_rag`
  - `multi_hop_rag`
  - `long_context`
  - `clarify_or_reject`

- 문서 도메인별로 router prior를 달리 준다.
  - policy/manual 문서는 RAG 우선
  - financial report / scientific paper는 LC 혹은 hybrid 우선

- retriever score를 route 이후가 아니라 route feature로 일부 활용한다.
  다만 이 논문의 정신은 "retrieval을 먼저 하지 않는 것"이므로, 아주 싸게 얻을 수 있는 prior만 넣는 게 맞다.

# 한계와 비판

1. 문제를 너무 예쁘게 단순화했다.
   현실의 RAG routing은 2-class decision보다 훨씬 복잡하다.

2. metadata quality에 의존한다.
   논문도 robustness를 보였지만, 완전히 메타데이터가 없거나 head snippet이 오염된 경우는 여전히 취약할 수 있다.

3. answer model과 router model의 coupling이 남아 있다.
   특정 answer model family에서 학습한 router가 다른 closed model 환경으로 얼마나 일반화되는지는 더 봐야 한다.

4. teacher 기반 distillation의 비용이 있다.
   오프라인 구축 단계에서는 여전히 큰 모델과 RAG/LC pairwise evaluation이 필요하다.

5. "왜 LC가 필요한지"를 더 세밀하게 분해하지는 않는다.
   예를 들어 cross-section synthesis, global narrative tracking, citation consistency, temporal aggregation 같은 finer taxonomy가 있으면 더 좋았을 것이다.

# 읽고 난 뒤의 내 생각

이 논문은 화려한 새 모델을 제안하지 않는다. 대신 실제 시스템에서 늘 마주치는 애매한 질문 하나를 제대로 파고든다. "이 질문, 검색해서 풀까 아니면 그냥 길게 읽힐까?"라는 문제다.

내가 특히 좋게 본 부분은 작은 모델 router의 가능성을 꽤 현실적으로 보여준 점이다. 많은 시스템이 결국 큰 모델을 더 앞단에 하나 더 붙이는 식으로 복잡해지는데, 이 논문은 오히려 반대로 간다. 큰 모델에게서 의사결정 패턴을 뽑아내고, 그것을 작은 router로 압축한다.

앞으로 내가 RAG 시스템을 만들 때도, retrieval quality 자체를 계속 올리는 것과 별개로 "이 질의가 retrieval-friendly한가"를 먼저 판정하는 얇은 라우팅 레이어를 거의 기본 컴포넌트처럼 넣게 될 것 같다.

다만 논문을 그대로 믿고 바로 production에 넣기보다는, 내 데이터셋에서 다음 세 가지를 꼭 검증해야 한다.

- domain별 route confusion matrix
- wrong-route가 실제 user-visible failure로 이어지는 비율
- router confidence를 썼을 때 hybrid fallback이 얼마나 개선되는지

# 블로그용 짧은 요약 초안

`Route Before Retrieve`는 RAG를 먼저 실행한 뒤 실패하면 Long Context로 가는 기존 fallback 방식 대신, 질의와 문서 메타정보만 보고 미리 RAG/LC를 선택하는 Pre-Route를 제안한다. 핵심은 이 routing 능력이 이미 큰 LLM 안에 잠재돼 있으며, structured reasoning prompt로 끌어낼 수 있고, 더 나아가 작은 1.7B router로 distill할 수 있다는 점이다. 실험에서는 Self-Route보다 더 낮은 LC 사용률로 더 높은 route accuracy와 QA 성능을 보였고, OOD에서도 cost-efficiency가 유지됐다. RAG 시스템을 운영한다면 retriever를 더 복잡하게 만들기 전에, retrieval-friendly query를 먼저 가려내는 얇은 router 레이어를 고민해볼 만하다.

# 참고 링크

- [arXiv Abstract](https://arxiv.org/abs/2605.10235)
- [arXiv HTML](https://arxiv.org/html/2605.10235v2)
- [OpenReview page](https://openreview.net/forum?id=N1E7rFZJGH)
- [LongBench-v2](https://arxiv.org/abs/2412.15204)
- [Continual Model Routing in Evolving Model Hubs](https://arxiv.org/abs/2605.28577)
- [LLMRouter: Unified Infrastructure for Developing, Evaluating, and Deploying LLM Routers](https://arxiv.org/abs/2608.06867)
- [Google Research Blog: Agentic RAG](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/)
- [NEC Labs: Learning to Route for Hybrid-Source RAG](https://www.nec-labs.com/blog/learning-to-route-a-rule-driven-agent-framework-for-hybrid-source-retrieval-augmented-generation/)
