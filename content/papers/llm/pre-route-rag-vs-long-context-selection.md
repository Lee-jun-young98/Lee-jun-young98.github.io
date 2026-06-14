---
title: "Route Before Retrieve: Activating Latent Routing Abilities of LLMs for RAG vs. Long-Context Selection"
date: 2026-06-14
tags:
  - "paper-review"
  - "LLM"
  - "RAG"
  - "Routing"
  - "Long-Context"
author: "Yiwen Chen, Kuan Li, Fuzhen Zhuang, Deqing Wang, Zhao Zhang, Liwen Zhang, Yong Jiang, Shuai Wang, Minhao Cheng"
journal: "arXiv"
paper: "https://arxiv.org/abs/2605.10235"
aliases:
  - "/papers/llm/2026-06-14-route-before-retrieve-rag-vs-long-context-selection"
  - "/papers/llm/route-before-retrieve-rag-vs-long-context-selection"
  - "/papers/llm/pre-route-rag-vs-long-context-selection"
---

# 한 줄 요약

이 논문은 "질문을 받은 뒤 일단 검색부터 해보자"가 아니라, **검색 전에 먼저 라우팅 판단을 내려야 한다**고 주장한다. 더 중요한 점은 이 판단이 반드시 큰 모델의 전유물이 아니라, 큰 모델의 구조화된 판단 과정을 distillation 하면 작은 모델도 꽤 실용적인 라우터가 될 수 있다는 점이다.

# 논문 메타데이터

- 제목: Route Before Retrieve: Activating Latent Routing Abilities of LLMs for RAG vs. Long-Context Selection
- 저자: Yiwen Chen, Kuan Li, Fuzhen Zhuang, Deqing Wang, Zhao Zhang, Liwen Zhang, Yong Jiang, Shuai Wang, Minhao Cheng
- 기관: Beihang University, HKUST, Alibaba Group, Pennsylvania State University
- 링크: https://arxiv.org/abs/2605.10235
- 공개일: 2026-05-11

# 이번 주 후보 논문 / 연구 글

## 최종 후보

1. [Route Before Retrieve: Activating Latent Routing Abilities of LLMs for RAG vs. Long-Context Selection](https://arxiv.org/abs/2605.10235)
   - RAG vs Long Context 선택 문제를 정면으로 다루고, 큰 모델의 라우팅 능력을 작은 모델로 증류하는 구조가 매우 실무적이다.
2. [IR3DE: A Linear Router for Large Language Models](https://arxiv.org/abs/2606.06098)
   - 도메인 expert 라우팅을 선형 ridge regression으로 푸는 점이 참신하다. 다만 이번 주제에서 원하는 RAG 시스템 연결성은 상대적으로 약했다.
3. [When More Documents Hurt RAG: Mitigating Vector Search Dilution with Domain-Scoped, Model-Agnostic Retrieval](https://arxiv.org/abs/2606.11350)
   - 실제 운영형 RAG의 "문서가 많아질수록 오히려 성능이 떨어지는" 문제를 잘 짚었다. 하지만 이번 주에는 라우팅 그 자체보다 검색 스코프 설계 쪽 비중이 더 컸다.
4. [RAGRouter-Bench: A Dataset and Benchmark for Adaptive RAG Routing](https://arxiv.org/abs/2602.00296)
   - 적응형 RAG 라우팅 연구의 기반 벤치마크라서 중요하다. 다만 새로운 메서드보다 벤치마크 논문에 가깝다.
5. [Lightweight Query Routing for Adaptive RAG: A Baseline Study on RAGRouter-Bench](https://arxiv.org/abs/2604.03455)
   - 고전 ML 분류기로도 꽤 높은 라우팅 성능이 나온다는 점이 인상적이다. 하지만 구조적 통찰은 Pre-Route보다 얕다.
6. [Continual Model Routing in Evolving Model Hubs](https://arxiv.org/abs/2605.28577)
   - 2,000개 이상 후보 모델을 다루는 continual routing 문제 설정이 좋다. 다만 내 블로그의 현재 축인 RAG 운영 설계와는 약간 거리가 있다.
7. [Learning Agent Routing From Early Experience](https://arxiv.org/abs/2605.07180)
   - lightweight LLM과 full agent 사이를 라우팅하는 문제를 early experience memory로 푼다. 에이전트 운영 관점에서는 매우 흥미롭지만, 이번 주의 핵심 축인 RAG/LC 선택보다 agent escalation 쪽이다.
8. [Unlocking dependable responses with Gemini Enterprise Agent Platform’s Agentic RAG](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/)
   - 공식 연구 블로그로서 멀티에이전트 RAG의 제품화 방향을 잘 보여준다. 다만 논문 리뷰 대상으로는 분석 가능한 세부 실험 정보가 부족했다.

## 제외 / 보류 이유 요약

- IR3DE는 도메인 expert routing 자체는 매우 강하지만, LangChain/LangGraph 기반 RAG 설계로 바로 옮길 때 필요한 retrieval-level 판단은 적었다.
- MASDR-RAG는 운영형 엔터프라이즈 RAG에 바로 적용 가능한 통찰이 있으나, 이번 자동화의 "작은 모델 라우터" 축과는 살짝 어긋났다.
- RAGRouter-Bench와 그 baseline study는 앞으로 계속 참조할 가치가 크지만, 이번 주의 깊은 리뷰 대상으로는 메서드 논문이 더 적합했다.

# 최종 선정 이유

이번 주에는 `Pre-Route`를 골랐다. 이유는 세 가지다.

1. **주제 적합성**이 가장 높다. RAG, long-context, small router distillation, metadata-based routing이 한 논문 안에 모두 들어 있다.
2. **실무 번역 가능성**이 높다. 논문의 입력이 `query + lightweight metadata`라서 LangChain, LangGraph, 사내 문서 QA 시스템에 바로 이식할 수 있다.
3. **연구 방향 연결성**이 높다. "작은 모델은 어디까지 라우터로 쓸 수 있는가?", "retrieval 이전에 계획을 세우는 편이 나은가?"라는 질문이 지금의 agentic RAG 흐름과 정확히 맞물린다.

# 논문이 풀려는 문제

긴 문서를 다루는 시스템에서 우리는 대개 두 가지 선택지를 가진다.

- `RAG`: 필요한 조각만 검색해서 답한다.
- `Long Context`: 문서 전체 또는 매우 긴 컨텍스트를 모델에 넣고 답한다.

문제는 둘 중 무엇이 더 낫냐가 **질문과 문서의 형태마다 달라진다**는 점이다.

- 날짜, 이름, 특정 시점 같은 국소적 사실은 RAG가 유리하다.
- 여러 장면이나 섹션에 흩어진 근거를 모아야 하는 질문은 Long Context가 유리하다.
- 문서가 길어도 관련 근거가 한 군데 모여 있으면 굳이 LC를 쓸 필요가 없다.
- 반대로 문서 길이가 context window 안에 들어가더라도, evidence가 분산돼 있으면 retrieval-first 방식은 부분 정답만 만들 수 있다.

즉 핵심 문제는 "어떻게 답할까"보다 한 단계 앞의 **"어떤 경로로 답할까"**다.

# 기존 방법의 한계

논문이 주로 비판하는 대상은 `Self-Route` 계열이다. 이 방식은 대체로 다음 순서를 따른다.

1. 일단 RAG를 수행한다.
2. 모델이 검색 결과로 답할 수 없다고 판단하면 LC로 escalate 한다.

표면적으로는 합리적이지만, 논문은 이 전략의 약점을 꽤 설득력 있게 짚는다.

## 1. 수동적이다

라우팅 판단이 retrieval 이후에 일어난다. 즉 이미 검색 비용을 써버린 뒤다. 잘못된 검색을 한 뒤에야 "아, LC가 맞았네"라고 깨닫는다.

## 2. 자기확신 오류에 취약하다

모델이 `unanswerable`을 잘못 말하면 필요 없는 LC로 올라가고, 반대로 검색 결과 일부만 보고 "충분하다"고 착각하면 RAG에 머무른다.

## 3. 부분 정답을 잘못된 정답으로 착각한다

특히 근거가 여러 군데 흩어진 질문에서 retrieval 결과 일부만 맞아도 "답했다"고 느끼기 쉽다. 하지만 채점 기준이 세밀하면 이는 낮은 품질 답이다.

## 4. 해석 가능성이 낮다

왜 RAG를 골랐는지, 왜 LC를 골랐는지 reasoning trace가 없다. 운영 중 장애 분석이나 룰 보정이 어렵다.

# 핵심 아이디어

이 논문의 핵심 명제는 간단하다.

> LLM은 원래 라우팅 능력이 없었던 것이 아니라, 그 능력이 잠복해 있었고 적절한 가이드라인으로 꺼내야 한다.

즉 라우터를 "새로 학습된 외부 분류기"로만 보지 않는다. 큰 모델이 이미 갖고 있는 판단력을 **구조화된 reasoning scaffold**로 안정화하고, 그 과정을 작은 모델에 distill 한다.

논문은 이를 `Pre-Route`라고 부른다.

- 검색 전에
- 문서 전체를 읽기 전에
- 저비용 metadata만 보고
- 구조화된 질문을 따라 reasoning한 뒤
- `RAG` 또는 `LONG_CONTEXT`를 선택한다

# 방법론 상세 설명

## 입력 신호

Pre-Route는 아주 무거운 입력을 쓰지 않는다. 논문에서 사용하는 입력은 대략 다음과 같다.

- 사용자 질문
- task type
- 문서 제목
- 문서 타입
- 문서 길이
- answering model 정보
- 문서 head snippet
- RAG 설정값(chunk size, overlap, reranker size 등)

중요한 점은 **retrieval 결과 자체를 보지 않는다**는 것이다. 이게 Self-Route와 가장 큰 차이다.

## 6단계 reasoning chain

논문은 라우팅을 막연한 "감"이 아니라 구조화된 사고 절차로 바꾼다.

1. 질문 타입과 문서 타입을 파악한다.
2. 관련 정보가 한 부분에 몰려 있는지, 여러 구간에 흩어져 있는지 본다.
3. 문서가 모델 context window 안에 들어가는지 본다.
4. keyword retrieval로 해결 가능한 문제인지, 암묵적 종합 추론이 필요한지 본다.
5. answering model의 실제 능력을 고려한다.
6. 품질이 비슷하면 비용과 지연 측면에서 RAG를 우선한다.

마지막 규칙이 실전적이다. 이 논문은 일관되게 **동률이면 RAG를 선택**한다. 이유는 당연하다. LC는 비싸기 때문이다.

## 이상적 라벨 정의

이 논문에서 특히 마음에 드는 부분은 "정답 라우트"를 감성적으로 두지 않는다는 점이다.

- 특정 샘플에서 LC의 답 품질이 더 좋으면 LC
- 둘의 성능이 비슷하거나 사실상 동률이면 더 싼 RAG

즉 ideal label은 정확도와 비용을 동시에 반영한다. "무조건 더 좋은 답"이 아니라 "효율-품질 균형에서 최적의 경로"를 정답으로 둔다.

## distillation 방식

큰 모델인 Qwen3-235B-A22B나 DeepSeek-R1이 만든 reasoning chain을 그대로 작은 모델에 주입하는 식이 아니다. 두 단계가 있다.

1. **rejection sampling**
   - teacher가 낸 reasoning/decision 중 ideal label과 일치하는 샘플만 남긴다.
   - 즉 teacher의 좋은 판단만 골라 학습 데이터로 쓴다.
2. **path SFT**
   - student는 최종 라벨만 맞추는 것이 아니라, 그 판단에 도달하는 경로까지 배운다.

이게 중요한 이유는 작은 모델이 단순 분류기처럼 동작하지 않고, 적어도 라우팅 문제에서는 구조화된 사고 절차를 모방하게 만들기 때문이다.

# 모델 구조 또는 파이프라인 설명

실제 시스템 파이프라인은 아래처럼 이해하면 된다.

```text
User Query
  -> Meta Builder
     - query
     - doc title/type/length/head
     - model info
     - rag config
  -> Pre-Route Router
     - structured reasoning
     - decision: RAG or LONG_CONTEXT
  -> Executor
     - if RAG: retrieve -> rerank -> answer
     - if LONG_CONTEXT: full/long-context answer
  -> Final Response
```

내가 보기엔 이 구조의 장점은 라우터가 answerer와 완전히 분리된다는 점이다.

- answer model이 바뀌어도 라우터 프롬프트만 조금 조정하면 된다.
- retrieval 스택이 바뀌어도 라우터는 메타데이터 인터페이스만 유지하면 된다.
- small router를 edge나 API gateway 근처에 둘 수도 있다.

# 실험 설정

## 데이터셋

- In-domain: `LaRA`
- Out-of-domain: `LongBench-v2`

LaRA는 학습과 주평가에 쓰이고, LongBench-v2는 일반화 성능을 보는 용도다.

## 비교 대상

- Always-LC
- Always-RAG
- Self-Route
- Pre-Route with large router
- Pre-Route with small router
- Pre-Route with distilled small router

## 사용 모델

라우터 쪽에는 DeepSeek-R1, Qwen3-235B, Qwen3-1.7B, Distilled-Qwen3-1.7B 등을 쓰고, 답변 모델 쪽에는 Qwen3 1.7B/4B/8B/30B/235B, DeepSeek-R1, Qwen-Max 등을 다양하게 사용한다.

이렇게 answer model을 여러 개로 바꿔가며 본 점은 좋다. 특정 백본 하나에만 맞춘 라우터 논문보다 실전 감각이 있다.

# 주요 결과 해석

## 1. large router는 매우 공격적으로 LC 사용률을 줄인다

LaRA 메인 실험에서 Self-Route는 대체로 LC 비율이 25%~41% 수준인데, Pre-Route large 계열은 이를 자주 한 자릿수나 10%대 초반으로 낮춘다. 그런데 QA 점수는 유지되거나 오히려 더 좋다.

예를 들어 Qwen3-235B 답변 모델 기준으로:

- Always-LC: QA 3.51 / LC 100%
- Always-RAG: QA 3.33 / LC 0%
- Self-Route: QA 3.34 / LC 33.9%
- Pre-Route (Q235B, T): QA 3.40 / LC 18.3%
- Pre-Route (D-Q1.7B, N): QA 3.43 / LC 22.7%

여기서 흥미로운 지점은 **distilled 1.7B router가 Self-Route보다 더 높은 QA를 내면서도 LC를 덜 쓴다**는 점이다.

## 2. 작은 모델은 prompt-only로는 불안정하지만, distillation 후에는 꽤 쓸 만하다

논문 전체에서 가장 중요한 메시지다.

- prompt-only Qwen3-1.7B는 LC를 과다 선택하는 경향이 있다.
- distilled Qwen3-1.7B는 LC 비율을 크게 낮추면서 accuracy를 회복한다.

즉 "작은 모델은 라우터로 못 쓴다"가 아니라, **작은 모델의 zero-shot 판단은 약하지만 큰 모델의 decision boundary를 옮겨주면 꽤 실용적**이라는 결론에 가깝다.

## 3. Self-Route의 핵심 실패는 retrieval 실패가 아니라 sufficiency 판단 실패다

논문 appendix 사례가 좋다.

- evidence가 분산된 질문인데 retrieved chunk 일부만 보고 RAG로 충분하다고 착각
- 반대로 단일 시점/단일 사실 질문인데 `unanswerable`을 말하고 LC로 escalate

즉 문제는 "검색이 됐느냐"가 아니라 **검색된 정보가 질문의 요구를 충분히 덮는가**를 못 본다는 점이다.

# 표와 그림에서 중요한 포인트

## Figure 2: Best-of-N 실험

가장 인상적인 그림 중 하나다. 구조화된 guideline이 없으면 라우팅 accuracy가 샘플링 수 증가에 따라 많이 올라간다. 반대로 Pre-Route는 `N=1`에서도 높은 성능을 내고 curve가 빨리 포화된다.

내 해석은 이렇다.

- 모델 안에 잠복한 routing knowledge는 있다.
- 문제는 그 지식이 single-shot에서 안정적으로 호출되지 않는다는 것이다.
- Pre-Route의 structured prompt는 그 불안정성을 줄이는 일종의 activation scaffold다.

## Table 1: linear probe 결과

논문은 단순히 성능 숫자만 보여주지 않고, representation space에서 routing signal이 더 선형 분리 가능해졌다고 주장한다.

- Qwen3-1.7B에서 Pre-Route prompt가 direct/unconstrained CoT보다 ideal route probe 정확도가 높다.
- distillation까지 하면 더 오른다.
- 흥미롭게도 8B direct보다 1.7B Pre-Route가 더 나은 경우가 있다.

즉 규모만 키우는 것보다 **문제를 구조화하는 방식**이 더 중요하다는 메시지다.

## Table 2: routing cost

큰 teacher router는 reasoning trace를 만들기 때문에 routing 자체 비용이 아주 싸지는 않다. 하지만 distilled 1.7B router로 바꾸면 routing cost가 Self-Route 대비 약 1/5 수준까지 내려간다.

포인트는 이것이다.

- answer 비용이 전체 비용의 대부분이긴 하다.
- 그래도 라우터가 매 요청마다 비싸면 운영상 의미가 줄어든다.
- 그래서 이 논문의 distillation은 단순 accuracy 향상이 아니라 **배치 가능한 비용 구조**를 만드는 단계다.

## Table 5: ablation

가장 눈에 띈 부분은 `No Decision Rules`다. QA는 비슷해도 LC rate가 크게 뛴다. 이건 구조화된 reasoning 자체만큼이나 **명시적 의사결정 규칙**이 중요하다는 뜻이다.

실무적으로 번역하면 이렇다.

- "애매하면 싼 쪽" 같은 policy가 없으면 모델은 쉽게 보수적으로 무거운 경로를 선택한다.
- 라우터는 추론기이면서 동시에 정책 엔진이어야 한다.

## Table 10, 11, 12: traditional ML 및 세부 breakdown

Random Forest와 Decision Tree도 metadata만으로 어느 정도 맞춘다. 하지만 distilled Pre-Route가 더 낫다. 특히 hallucination-sensitive 질문에서 Self-Route 정확도 0.22 vs Pre-Route 0.75는 꽤 강한 신호다.

내 해석은 단순하다.

- metadata feature engineering만으로도 baseline은 충분히 만들 수 있다.
- 하지만 query semantics와 evidence distribution을 함께 보는 능력은 결국 LLM reasoning이 더 강하다.

# 헷갈리거나 추가 확인이 필요한 부분

## 1. LaRA 자체가 얼마나 현실적인 production proxy인가

논문은 document type, difficulty, context length를 잘 나눴지만, 실제 사내 문서 QA에서 보는 messy metadata, 권한 제약, cross-document dependencies가 어느 정도 반영되는지는 더 보고 싶다.

## 2. retrieval quality가 크게 달라질 때도 동일하게 유지되는가

본문과 appendix에서 rerank size 변화에는 비교적 robust하다고 말하지만, embedding 모델 변경, chunking policy 변경, hybrid sparse+dense 도입 같은 더 큰 retrieval distribution shift까지 버티는지는 아직 미지수다.

## 3. route space가 2개뿐이다

이 논문은 `RAG` vs `LONG_CONTEXT` 이진 선택이다. 하지만 실제 시스템은 보통 더 많다.

- cheap dense RAG
- hybrid RAG
- graph RAG
- agentic RAG
- web fallback
- human escalation

따라서 다음 단계 연구는 다중 경로 라우팅이어야 한다.

## 4. metadata 품질 의존성

논문은 head-only metadata에서도 잘 된다고 주장하지만, 문서 head가 실제로는 노이즈이거나 boilerplate일 수 있다. 예를 들어 법률 문서나 사내 정책 문서에서 첫 단락이 거의 모든 파일이 비슷하다면 효과가 줄 수 있다.

# 실무 적용 가능성

실무 적용 가능성은 높다. 특히 아래 조건에서 유용하다.

1. 문서가 길고, 모든 질문에 LC를 태우기엔 비싸다.
2. 질문 유형이 혼재돼 있다.
3. retrieval-first가 과잉 검색 또는 과소 검색을 동시에 일으킨다.
4. answer model은 고정하고, 앞단 판단기만 싸게 두고 싶다.

즉 이 논문은 "RAG를 더 잘 검색하는 법"보다 **RAG를 쓸지 말지를 더 잘 고르는 법**에 가깝다.

# 직접 구현한다면 어떤 구조로 만들지

내가 직접 구현하면 다음 구조로 갈 것 같다.

## 1. 라우터를 별도 노드로 분리

- 입력: query, doc metadata, corpus metadata, retrieval config, budget tier
- 출력: route label, confidence, rationale, fallback condition

## 2. route label을 2단계로 확장

논문은 2-way지만 실전에서는 최소 4-way가 좋다.

- `keyword_rag`
- `semantic_rag`
- `long_context`
- `agentic_rag`

## 3. rationale를 로그로 남기기

단순히 route만 저장하지 말고 아래를 남겨야 한다.

- evidence distribution 추정
- expected cost tier
- why not alternatives
- confidence

이게 있어야 운영 중 오판 사례를 클러스터링해서 룰을 다시 다듬을 수 있다.

## 4. small router + policy layer 조합

작은 모델만 믿지 말고 rule layer를 덧붙이는 편이 안전하다.

- 문서가 window를 초과하면 LC 금지 또는 chunked LC
- 날짜/조항/이름 질의면 RAG prior 강화
- compare/summarize/multi-hop이면 LC prior 강화

논문이 말하는 "guideline"을 서비스 코드 레벨의 정책으로 일부 굳히는 방식이다.

# LangChain, LangGraph, RAG 시스템에 적용할 수 있는 아이디어

## LangChain

- `Runnable` 앞단에 router chain을 둔다.
- router output schema를 `route`, `reason`, `confidence`, `budget_note`로 강제한다.
- retrieval chain과 long-context chain을 각각 별도 runnable로 두고 router가 dispatch 한다.

## LangGraph

LangGraph와는 특히 잘 맞는다. 거의 그래프 분기 노드 문제다.

- `router_node`: metadata 기반 structured reasoning
- conditional edge:
  - `RAG` -> retriever -> reranker -> answer
  - `LONG_CONTEXT` -> document loader -> compressor/packer -> answer
  - low confidence -> judge node 또는 second router

여기서 논문의 distillation 아이디어를 적용하면, production graph 앞단에 작은 모델 라우터를 두고, low-confidence case만 큰 모델 라우터로 넘기는 2-tier routing도 가능하다.

## RAG 시스템

이 논문을 RAG 시스템에 적용할 때 가장 좋은 포인트는 retrieval을 항상 호출하지 않아도 된다는 점이다.

- 지금 많은 시스템은 "어차피 검색은 싸다"라고 가정하고 매번 retrieval을 탄다.
- 하지만 chunking, embedding, rerank, permission filtering, hybrid search가 붙으면 retrieval도 결코 공짜가 아니다.

Pre-Route는 retrieval 호출 자체를 선택적으로 만들 수 있다.

# 한계와 비판

## 1. route target이 너무 단순하다

실제 프로덕션은 이진 선택보다 훨씬 다층적이다. 논문은 좋은 출발점이지만 끝은 아니다.

## 2. distillation 데이터 생성 비용이 싸지 않다

teacher로 reasoning trace를 만들고, ideal label과 맞는 샘플만 골라야 한다. 초기 구축 비용은 꽤 든다.

## 3. 큰 모델의 편향을 작은 모델이 그대로 배울 수 있다

teacher가 systematic bias를 가지면 student도 그 경계를 따라간다. 특히 특정 문서 타입이나 질문 스타일에 대한 보수적 편향이 그대로 굳을 수 있다.

## 4. "metadata만으로 충분하다"는 주장에는 경계가 필요하다

어떤 질문은 정말 retrieval preview나 document structure map을 조금 봐야 맞게 판단할 수 있다. 완전한 pre-retrieval routing만으로 항상 최선이라고 믿으면 위험하다.

# 읽고 난 뒤의 내 생각

이 논문은 엄청 화려한 새 아키텍처를 제안하는 논문은 아니다. 대신 지금 RAG 운영에서 실제로 자주 터지는 애매한 문제를 잘 찌른다.

- 검색 결과 일부만 맞는 경우
- 문서는 길지만 질문은 사실 짧은 경우
- 작은 모델은 겁먹고 LC를 남발하는 경우
- retrieval를 매번 태우는 것이 습관이 돼버린 경우

특히 내가 좋게 본 지점은 **라우팅을 retrieval 이후의 실패 복구가 아니라 retrieval 이전의 계획 단계로 끌어올렸다는 것**이다. 이건 agent 설계 철학과도 맞닿아 있다. 좋은 agent는 실패한 뒤 고치는 것만이 아니라, 아예 처음에 경로를 잘 정한다.

또 하나, 작은 모델 연구 관점에서도 의미가 있다. 작은 모델을 "답변 모델"로 직접 올리는 것보다, **라우터나 플래너 같은 얇은 제어 계층으로 쓰는 편이 더 빨리 실용화될 수 있다**는 감각을 다시 확인시켜 준다.

# 블로그용 짧은 요약 초안

`Pre-Route`는 RAG와 Long Context 중 무엇을 쓸지 검색 전에 먼저 결정하자는 논문이다. 핵심은 큰 모델이 가진 잠복 라우팅 능력을 구조화된 reasoning으로 끌어내고, 그 판단 경계를 작은 모델로 distill 하면 값싼 라우터로도 꽤 강한 성능을 낼 수 있다는 점이다. 실무적으로는 "항상 검색부터"라는 습관을 버리고, query/document metadata 기반의 사전 라우팅 레이어를 RAG 앞단에 두는 설계가 점점 중요해질 것 같다.

# 참고 링크

- 논문 arXiv: https://arxiv.org/abs/2605.10235
- arXiv HTML: https://arxiv.org/html/2605.10235v1
- 비교용 벤치마크: [RAGRouter-Bench](https://arxiv.org/abs/2602.00296)
- 비교용 baseline: [Lightweight Query Routing for Adaptive RAG](https://arxiv.org/abs/2604.03455)
- 비교용 도메인 expert router: [IR3DE](https://arxiv.org/abs/2606.06098)
- 공식 연구 글: [Google Research - Agentic RAG](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/)
