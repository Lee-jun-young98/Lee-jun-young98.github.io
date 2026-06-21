---
title: "R3AG: Retriever Routing for Retrieval-Augmented Generation"
date: 2026-06-21
tags:
  - "paper-review"
  - "LLM"
  - "RAG"
  - "Routing"
author: "Tong Zhao, Yutao Zhu, Yucheng Tian, Zhicheng Dou"
journal: "arXiv 2026"
paper: "https://arxiv.org/abs/2604.22849"
aliases:
  - "/papers/llm/r3ag-retriever-routing-for-rag"
---

# 한 줄 메모

이번 주에 읽은 라우팅/RAG 계열 논문들 중에서 `R3AG`가 가장 실무적으로 바로 가져다 쓰기 좋았다. 핵심은 단순히 "어떤 retriever가 관련 문서를 잘 찾는가"가 아니라 "그 문서가 실제 generator의 정답 생성에 도움이 되는가"를 따로 모델링했다는 점이다.

# 논문 메타데이터

- 제목: [R3AG: Retriever Routing for Retrieval-Augmented Generation](https://arxiv.org/abs/2604.22849)
- 저자: Tong Zhao, Yutao Zhu, Yucheng Tian, Zhicheng Dou
- 기관: Renmin University of China, South China University of Technology
- 공개일: 2026-04-22
- 링크:
  - 논문 abs: [arXiv 2604.22849](https://arxiv.org/abs/2604.22849)
  - 논문 HTML: [arXiv HTML](https://arxiv.org/html/2604.22849v1)

# 이번 주 후보 논문 스크리닝

이번 주에는 "작은 모델 라우터", "RAG 라우팅", "도메인 라우팅", "멀티도메인 학습/배치" 관점에서 아래 후보를 먼저 훑었다.

1. [R3AG: Retriever Routing for Retrieval-Augmented Generation](https://arxiv.org/abs/2604.22849)
   선택. retriever routing을 retrieval relevance가 아니라 generation utility까지 포함해 정의한다. 구현 난이도 대비 실무 전환 가능성이 높고, benchmark/ablation도 깔끔하다.
2. [GraphRAG-Router: Learning Cost-Efficient Routing over GraphRAGs and LLMs with Reinforcement Learning](https://arxiv.org/abs/2604.16401)
   보류. 문제 설정은 좋지만 GraphRAG 조합, SFT, 2-stage RL까지 들어가서 재현 비용이 높다. 이번 주 블로그용으로는 논문 자체보다 시스템 비용 구조 설명이 더 커진다.
3. [RAGRouter-Bench: A Dataset and Benchmark for Adaptive RAG Routing](https://arxiv.org/abs/2602.00296)
   보류. 매우 중요한 benchmark 논문이지만 "방법"보다 "평가 세트" 중심이다. 이번 주에는 벤치마크보다 실전 시스템 설계로 연결되는 쪽을 우선했다.
4. [Skill-RAG: Failure-State-Aware Retrieval Augmentation via Hidden-State Probing and Skill Routing](https://arxiv.org/abs/2604.15771)
   보류. 실패 상태 진단과 skill routing 아이디어는 흥미롭지만, hidden-state probing과 multi-turn correction loop까지 같이 다뤄야 해서 글이 복잡해진다.
5. [When More Documents Hurt RAG: Mitigating Vector Search Dilution with Domain-Scoped, Model-Agnostic Retrieval](https://arxiv.org/abs/2606.11350)
   보류. 멀티도메인 실무 문제를 정확히 찌른다. 다만 scoped domain retrieval의 엔지니어링 감각이 강하고, 일반적 라우팅 프레임워크로 확장되는 정도는 `R3AG`보다 좁다.
6. [BoundaryRouter: Learning Agent Routing From Early Experience](https://arxiv.org/abs/2605.07180)
   보류. 작은 모델/직접 추론과 agent 실행 사이 라우팅이라는 점에서 매우 흥미롭다. 다만 RAG보다는 agent escalation에 더 가깝다.
7. [Continual Model Routing in Evolving Model Hubs](https://arxiv.org/abs/2605.28577)
   보류. 멀티모델 허브에서의 continual routing 문제는 중요하지만, 이번 자동화의 핵심 축인 RAG/도메인 라우팅에서 약간 벗어난다.
8. [Unlocking dependable responses with Gemini Enterprise Agent Platform’s Agentic RAG](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/)
   참고만. 공식 연구 블로그로서 제품/시스템 관점은 좋지만 논문 리뷰 대상으로는 실험 세부와 ablation이 충분하지 않다.

# 최종 선정 이유

`R3AG`를 고른 이유는 세 가지다.

1. 문제 정의가 정확하다. "retriever가 좋은가?"와 "generator에게 도움이 되는가?"를 분리해서 보는 시각이 실제 RAG 운영 문제와 맞닿아 있다.
2. 구현 아이디어가 현실적이다. 대형 RL 파이프라인이나 multi-agent orchestration 없이도, supervision 수집과 contrastive learning만으로 충분히 재현 가능해 보인다.
3. 내 블로그/연구 방향과의 관련성이 높다. LangChain, LangGraph, 다중 retriever, domain-scoped retrieval, no-retrieval fallback, retriever selection policy 같은 주제와 직접 연결된다.

# 논문이 풀려는 문제

기존 RAG는 대체로 retriever를 하나 고정한다. 하지만 실제로는 query마다 잘 맞는 retriever가 다르다.

- entity exact match가 중요한 질문은 sparse/BM25류가 유리할 수 있다.
- 의미적 패러프레이즈가 많은 질문은 dense retriever가 유리할 수 있다.
- 아예 retrieval이 필요 없는 질문도 있다.

즉, RAG의 병목은 이제 "retrieval을 하느냐 마느냐"만이 아니라 "어떤 retriever를 왜 선택하느냐"로 이동했다.

이 논문은 이 문제를 retriever routing으로 정의한다. 그리고 단순 relevance 기반 routing이 아니라, 최종 answer generation에 유리한 retriever를 query별로 고르는 문제로 다시 세팅한다.

# 기존 방법의 한계

논문이 지적하는 기존 방법의 한계는 크게 두 가지다.

1. `single and static capability` 가정
   많은 라우터가 retriever 성능을 고정된 점수처럼 본다. 예를 들어 "이 retriever는 semantic search에 강함" 같은 식이다. 하지만 실제 성능은 query마다 흔들린다.
2. retrieval relevance와 generation usefulness를 혼동
   문서가 relevance metric 상 좋아 보여도, generator 입장에서는 정답 생성에 전혀 도움이 안 되거나 오히려 혼란을 줄 수 있다.

이 지점이 이 논문의 핵심이다. IR 점수와 downstream generation utility는 같지 않다.

# 핵심 아이디어

논문의 아이디어는 retriever capability를 두 축으로 쪼개는 것이다.

- Retrieval Quality
  - 이 retriever가 query에 대해 질 좋은 근거 문서를 찾는 능력
- Generation Utility
  - 그 문서가 실제 generator의 정답 생성에 기여하는 능력

그리고 query가 들어오면 이 두 capability embedding을 query-conditioned attention으로 합쳐서, 지금 query에 가장 잘 맞는 retriever를 고른다.

이 구조는 실무적으로도 납득이 간다. 같은 문서라도:

- retrieval 관점에서는 relevant하지만
- answer synthesis 관점에서는 너무 장황하거나
- 필요한 reasoning path를 포함하지 않거나
- distractor를 많이 포함할 수 있다.

`R3AG`는 바로 이 틈을 모델링한다.

# 방법론 상세 설명

논문의 학습은 크게 3단계로 이해하면 된다.

## 1. Query encoder와 retriever capability space 정의

각 query와 retriever를 같은 표현 공간으로 보낸다. 다만 retriever는 하나의 벡터가 아니라 두 종류의 capability vector를 갖는다.

- retrieval quality encoder `phi_r`
- generation utility encoder `phi_g`

여기서 좋은 점은 retriever를 "텍스트 설명"으로 라우팅하지 않고, 실제 supervision으로 capability embedding을 학습한다는 것이다.

## 2. Retrieval Quality supervision

retrieved document를 외부 judge LLM으로 평가해서, 각 retriever가 query에 대해 얼마나 질 좋은 문서를 찾았는지 점수를 만든다. 이 점수로 positive/negative retriever set을 나누고 contrastive loss를 건다.

논문 입장에서 retrieval quality는 generation outcome과 분리된 별도 신호다. 이 분리가 중요하다. generator가 못 읽어서 틀린 것과 retriever가 못 찾은 것을 섞지 않기 때문이다.

## 3. Generation Utility supervision

generation utility는 더 직관적이다. 각 query-retriever 쌍에 대해 실제로 RAG 답변을 생성해 보고, EM/F1과 retriever의 전역 평균 정답률을 섞어 utility score를 만든다.

즉 query별 국소 성과와 retriever별 전역 성향을 같이 넣는다. 논문 Figure 3은 이 두 supervision이 서로 다른 역할을 한다는 점을 보여준다.

## 4. Query-conditioned fusion

두 encoder를 학습한 뒤에는 이 capability embedding을 freeze하고, multi-head attention으로 두 벡터를 query에 맞게 합친다. 그 다음 "이 retriever가 useful한가?"를 binary classification 형태로 학습한다.

내가 이해한 구조는 대략 아래와 같다.

```text
query
  -> query encoder

candidate retriever_i
  -> retrieval-quality embedding
  -> generation-utility embedding

[query, rq_i, gu_i]
  -> query-conditioned multi-head attention fusion
  -> usefulness score

top-1 retriever 선택
  -> retrieve top-k docs
  -> generator answer
```

# 모델 구조 또는 파이프라인 설명

이 논문을 시스템 관점에서 다시 그리면 아래와 같다.

1. 후보 retriever pool을 준비한다.
   이 논문은 BM25와 7개 dense retriever를 사용한다.
2. 오프라인에서 supervision data를 만든다.
   query마다 각 retriever가 가져온 문서를 judge로 평가하고, 실제 answer generation도 돌린다.
3. 두 종류의 capability encoder를 contrastive learning으로 학습한다.
4. query-conditioned fusion module을 학습한다.
5. 온라인 inference에서는 각 candidate retriever의 usefulness score를 계산해 top-1을 고른다.
6. 필요하면 `no-retrieval` 옵션도 선택한다.

실무에서 이 구조가 좋은 이유는 online latency에 큰 추가가 없기 때문이다. 무거운 부분은 supervision 수집이지, 라우팅 추론 자체는 비교적 가볍다.

# 실험 설정과 주요 결과 해석

## 데이터셋과 백본

- Benchmarks: TriviaQA, Natural Questions, HotpotQA
- Generator: LLaMA3-8B-Instruct
- Corpus: 2018 English Wikipedia
- Retrieval depth: top-5 documents
- Candidate retrievers: BM25 + 7 dense retrievers

후보 retriever 스펙도 흥미롭다. E5-base-v2는 0.11B에 6.40ms, Qwen3-embedding-4B는 4.02B에 32.19ms로, 정확도뿐 아니라 latency/size 스펙트럼을 같이 본다.

## Table 2에서 봐야 할 포인트

가장 중요한 표는 Table 2다.

- `R3AG` 평균 성능: EM 43.06 / F1 53.86
- 최고 단일 retriever `E5-large`: EM 41.31 / F1 51.81
- `Oracle Single Best`: EM 41.53 / F1 52.05
- `IRCoT`: EM 41.86 / F1 52.80
- `LTRR`: EM 39.14 / F1 48.85
- `RouterRetriever`: EM 38.08 / F1 48.34

여기서 중요한 해석은 두 가지다.

1. 단일 최고 retriever보다 좋아지는 것은 예상 가능하다.
   query별로 다른 retriever를 고르니 당연히 이득이 있을 수 있다.
2. 그런데 `Oracle Single Best`보다도 높다.
   이건 "dataset 전체에서 제일 좋은 retriever 하나를 고르는 전략"보다, query별 동적 선택이 실제로 의미 있다는 증거다.

특히 TriviaQA에서 62.24/71.52, NQ에서 37.81/49.32, HotpotQA에서 29.13/40.73으로 고르게 강하다. 특정 데이터셋에만 먹히는 라우터라기보다, 적어도 세 벤치마크에서는 일관성이 있다.

## Table 3 ablation

이 표는 이 논문이 왜 괜찮은지 잘 보여준다.

- `w/o MHA`: EM -0.89 / F1 -1.88
- `w/o RQ Encoder`: EM -0.93 / F1 -2.26
- `w/o GU Encoder`: EM -1.01 / F1 -2.15

즉,

- 단순 평균 결합이 아니라 query-conditioned fusion이 실제로 필요하고
- retrieval quality와 generation utility 둘 다 빠지면 성능이 떨어진다.

특히 `RQ`와 `GU`가 비슷한 폭으로 중요하다는 점이 인상적이다. 이 논문의 문제정의가 과장되지 않았다는 뜻이다.

## Table 4 no-retrieval 분석

이 부분은 실무적으로 매우 중요하다.

- TriviaQA에서 no-retrieval 선택률 37.82%
- NQ에서 15.23%
- HotpotQA에서 9.52%

그런데 no-retrieval로 보낸 subset의 EM@는 각각 76.33, 43.51, 31.78이다. 즉 router가 "검색 안 해도 되는 질문"을 꽤 잘 가려낸다.

이건 비용 최적화 관점에서 매우 큰 힌트다. 실제 서비스에서는 검색 비용, re-rank 비용, context expansion 비용이 모두 있으니, retrieval skip policy는 별도 기능이 아니라 routing의 일부로 넣는 것이 맞다.

## Table 5 cross-generator generalization

router는 LLaMA3-8B-Instruct로 학습했는데, test 시 generator를 Qwen3-8B로 바꿔도 평균 EM/F1이 40.82/52.82로 강하다. Oracle Single Best보다 아주 약간 낮지만 큰 붕괴는 없다.

이 결과는 `generation utility`를 쓰더라도 라우터가 특정 generator에 완전히 과적합되지는 않았음을 시사한다. 다만 나는 이 결과를 "backbone 교체에도 바로 안전"하다고 읽기보다는, instruction-tuned 8B 계열 사이에서는 어느 정도 policy transfer가 된다고 보는 편이 맞다고 생각한다.

# 표와 그림에서 중요한 포인트

## Figure 1

논문의 출발점이다.

- retrieval이 항상 도움이 되는 것은 아니다.
- retriever에 따라 generation 결과 품질이 달라진다.

사실 이 두 문장만으로도 실무 RAG 문제의 절반을 설명한다.

## Figure 3

retrieval quality supervision과 generation utility supervision을 분리한 그림이다. 이 논문의 가장 중요한 도식이다. 나는 이 그림을 보고 이 논문이 "retriever router"이면서도 실제로는 "end-to-end RAG utility estimator"에 가깝다고 느꼈다.

## Figure 4

generation utility의 가중치 민감도 분석이다. 논문은 query-level answer quality와 retriever-level global correctness가 서로 보완적이라고 해석한다. 즉 local signal만으로도 부족하고 global prior만으로도 부족하다는 뜻이다.

# 헷갈리거나 추가 확인이 필요한 부분

몇 가지는 읽으면서 메모해둘 가치가 있었다.

1. retrieval quality judge의 안정성
   retrieval quality를 외부 LLM judge로 만들었는데, judge bias가 encoder에 얼마나 주입되는지 더 보고 싶다.
2. top-1 routing만으로 충분한가
   현실 시스템에서는 retriever mixture나 top-2 fallback이 더 실용적일 수 있다.
3. supervision 수집 비용의 데이터 의존성
   논문은 10k supervision item 당 대략 비용을 제시하지만, corpus/domain이 바뀌면 judge prompt와 generation utility 분포가 꽤 달라질 수 있다.
4. 한국어/도메인 문서에서의 일반화
   Wikipedia 기반 open-domain QA 결과라서, 실제 사내 문서/정책 문서/스키마 기반 KB에서는 결과가 다를 수 있다.

# 실무 적용 가능성

실무 적용 가능성은 높다. 특히 아래 조건에서 그렇다.

- retriever 후보가 이미 2개 이상 있는 팀
- BM25, dense, hybrid, graph retriever를 혼용 중인 팀
- query 유형별 성능 편차가 큰 팀
- retrieval 비용을 줄이고 싶은 팀

바로 제품에 넣을 수 있는 포인트는 다음과 같다.

1. `no-retrieval`을 정식 choice로 두기
2. retriever 선택 기준을 offline relevance가 아니라 final answer utility 기준으로 재학습하기
3. 도메인별 collection routing과 retriever family routing을 분리하기
4. query 로그 기반으로 utility label을 계속 축적하기

# 직접 구현한다면 어떤 구조로 만들지

내가 직접 구현한다면 논문 그대로 복제하기보다 조금 더 운영 친화적으로 바꿀 것 같다.

## 오프라인

1. query 샘플링
   production query + synthetic hard query를 섞는다.
2. candidate retriever별 top-k 문서 저장
3. judge 기반 retrieval quality score 산출
4. 실제 generator answer 생성 후 answer utility score 산출
5. 두 score로 router training set 구성

## 온라인

1. lightweight query classifier
   먼저 no-retrieval / retrieval-needed를 얕게 자른다.
2. retriever router
   dense vs sparse vs hybrid vs domain collection을 고른다.
3. optional fallback
   answer confidence가 낮으면 second retriever 또는 merged retrieval을 호출한다.

논문은 top-1 routing이지만, 서비스에서는 `router -> top-1 -> low confidence면 top-2 fallback` 구조가 더 안전하다.

# LangChain, LangGraph, RAG 시스템에 적용할 수 있는 아이디어

## LangChain

- `RetrieverRouterChain` 비슷한 추상화를 두되 score를 relevance가 아니라 utility proxy로 학습한다.
- retriever별 metadata에 domain, latency, token budget, average groundedness를 넣고 policy feature로 쓴다.
- `RunnableBranch`로 no-retrieval / BM25 / vector / hybrid / graph 경로를 분기할 수 있다.

## LangGraph

- router node를 별도 stateful node로 둔다.
- state에 `retrieval_needed`, `selected_retriever`, `fallback_count`, `grounding_score`를 넣는다.
- answer grading node가 낮은 점수를 주면 다른 retriever로 재시도하는 conditional edge를 만든다.

아래 식의 그래프가 가장 자연스럽다.

```text
ingest query
  -> route query
  -> if no retrieval: answer
  -> if retrieval needed: chosen retriever
  -> generate
  -> grade grounding
  -> if weak: fallback retriever or exit
```

## 멀티도메인 RAG

이 논문을 멀티도메인으로 확장하면 retriever routing 전에 domain routing을 한 층 더 넣을 수 있다.

- 1차: domain router
- 2차: domain 내부 retriever router
- 3차: no-retrieval / lightweight answer / heavy answer 분기

즉 `domain -> retriever -> generation mode`의 3단 라우팅으로 확장 가능하다.

# 한계와 비판

논문 limitation 섹션과 내 해석을 합치면 다음과 같다.

1. capability representation이 비교적 단순하다.
   더 강한 fusion이나 listwise routing으로 올라갈 여지가 있다.
2. 여러 retriever 조합을 직접 다루지 않는다.
   현실에서는 top-1보다 fusion retrieval이 더 자주 필요하다.
3. QA 중심 평가다.
   summarization, grounded extraction, SQL/text hybrid QA, enterprise KB QA로 가면 양상이 다를 수 있다.
4. supervision pipeline이 생각보다 싸지는 않다.
   generator utility는 싸도 judge 기반 retrieval quality는 여전히 비용이 든다.
5. end-to-end latency보다 answer quality에 더 무게가 있다.
   운영 환경에서는 latency percentile과 cache hit까지 같이 들어가야 한다.

# 읽고 난 뒤의 내 생각

이 논문을 읽고 가장 남는 문장은 "relevant한 문서와 useful한 문서는 다르다"는 것이다.

RAG를 실제로 운영해 보면, 검색 상위 문서가 눈으로 보기엔 멀쩡해도 generator가 틀린 답을 내는 경우가 많다. 그때 우리는 보통 generator prompting, reranker, context compression만 만지는데, 사실 더 앞단에서 "이번 질문에 이 retriever를 쓰는 게 맞나?"를 다시 물어야 한다.

그 의미에서 `R3AG`는 화려한 새 아키텍처라기보다, RAG 운영에서 정말 중요한 관찰을 잘 구조화한 논문이다. 특히 domain-scoped retrieval, no-retrieval decision, adaptive graph/text retriever 선택 같은 연구 방향으로 자연스럽게 이어진다.

내 연구 방향과 연결하면 다음 두 가지를 더 해보고 싶다.

1. 작은 라우터 모델 distillation
   `R3AG`의 utility-aware policy를 1B 이하 라우터로 증류할 수 있는지
2. domain router + retriever router 결합
   멀티도메인 문서 저장소에서 domain misroute와 retriever misroute를 분리 추적할 수 있는지

# 블로그용 짧은 요약 초안

`R3AG`는 RAG의 retriever 선택 문제를 "관련 문서를 잘 찾는가"와 "그 문서가 실제 답변 생성에 도움이 되는가"로 분리해 푸는 논문이다. 이 분해가 중요한 이유는 relevance가 높아도 generator utility가 낮은 경우가 실제 서비스에서 흔하기 때문이다. 논문은 retrieval quality와 generation utility를 별도 encoder로 학습한 뒤, query-conditioned attention으로 둘을 합쳐 retriever를 선택한다. 결과적으로 단일 retriever, 정적 라우팅, retrieval necessity baseline보다 일관되게 좋았고, no-retrieval까지 routing choice로 포함한 점도 실무적으로 유의미하다.

# 참고 링크

- [R3AG: Retriever Routing for Retrieval-Augmented Generation](https://arxiv.org/abs/2604.22849)
- [R3AG HTML 버전](https://arxiv.org/html/2604.22849v1)
- [RAGRouter-Bench: A Dataset and Benchmark for Adaptive RAG Routing](https://arxiv.org/abs/2602.00296)
- [GraphRAG-Router: Learning Cost-Efficient Routing over GraphRAGs and LLMs with Reinforcement Learning](https://arxiv.org/abs/2604.16401)
- [BoundaryRouter: Learning Agent Routing From Early Experience](https://arxiv.org/abs/2605.07180)
- [Skill-RAG: Failure-State-Aware Retrieval Augmentation via Hidden-State Probing and Skill Routing](https://arxiv.org/abs/2604.15771)
- [When More Documents Hurt RAG: Mitigating Vector Search Dilution with Domain-Scoped, Model-Agnostic Retrieval](https://arxiv.org/abs/2606.11350)
- [Google Research: Unlocking dependable responses with Gemini Enterprise Agent Platform’s Agentic RAG](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/)
