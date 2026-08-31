---
title: "VDGR-RAG: Vectors, Directories, Graphs, and Reflection Are All You Need for Unified Reasoning over Hierarchical Enterprise Knowledge"
date: 2026-08-31
tags:
  - "paper-review"
  - "LLM"
  - "RAG"
  - "Routing"
  - "GraphRAG"
author: "Wenqi Chen, Haofei Yang, Rui Yang, Fangming Li"
journal: "arXiv preprint arXiv:2608.07994"
paper: "https://arxiv.org/abs/2608.07994"
aliases:
  - "/papers/vdgr-rag-hierarchical-enterprise-knowledge-routing"
---

# 한 줄 요약

VDGR-RAG는 enterprise RAG에서 자주 터지는 문제를 아주 정면으로 다룬다. 벡터 검색만으로는 비슷한 용어가 많은 멀티도메인 문서를 제대로 못 가르고, 그래프만으로는 문서 계층 구조를 충분히 못 쓰며, agentic search만으로는 경로 선택 비용이 커진다. 이 논문은 그래서 벡터, TOC 기반 디렉터리 탐색, entity graph 탐색, reflection을 따로 분리한 뒤 조합하는 구조를 제안한다.

# 논문 메타데이터

- 제목: VDGR-RAG: Vectors, Directories, Graphs, and Reflection Are All You Need for Unified Reasoning over Hierarchical Enterprise Knowledge
- 저자: Wenqi Chen, Haofei Yang, Rui Yang, Fangming Li
- 기관: Huawei Technologies, ICT AI Competence Center, Shanghai, China
- 링크: [arXiv abs](https://arxiv.org/abs/2608.07994), [arXiv html](https://arxiv.org/html/2608.07994v2)
- 공개일: 2026-08-08 arXiv v1, 2026-08-18 v2

# 이번 주 후보 논문 목록

이번 주에는 작은 모델 라우터, RAG, domain routing, multi-domain retrieval 관점에서 아래 후보를 먼저 훑었다.

1. **CacheRouter: A Dual-Path Tool Routing Architecture with Cache-Preserving Main-Model Isolation for Long-Tail Tool Discovery**  
   - 날짜: 2026-08-24  
   - 링크: [arXiv](https://arxiv.org/abs/2608.22708)  
   - 메모: 아주 최신이고 실전 agent architecture 관점에서 강하다. 다만 핵심이 tool schema disclosure와 prompt cache 유지라서, 이번 주제인 RAG/domain routing 중심 리뷰 대상으로는 약간 옆으로 간다.
2. **VDGR-RAG: Vectors, Directories, Graphs, and Reflection Are All You Need for Unified Reasoning over Hierarchical Enterprise Knowledge**  
   - 날짜: 2026-08-08, v2는 2026-08-18  
   - 링크: [arXiv](https://arxiv.org/abs/2608.07994)  
   - 메모: enterprise multi-domain RAG, knowledge base routing, hierarchical document reasoning, ablation까지 한 번에 담고 있어서 이번 자동화 목적과 가장 잘 맞는다.
3. **Route Before Retrieve: Activating Latent Routing Abilities of LLMs for RAG vs. Long-Context Selection**  
   - 날짜: 2026-05-11  
   - 링크: [arXiv](https://arxiv.org/abs/2605.10235)  
   - 메모: 작은 라우터 대신 LLM 자체의 latent routing 능력을 끌어내는 접근이 흥미롭다. 다만 focus가 multi-domain enterprise retrieval보다는 RAG 대 long-context 선택 문제에 더 가깝다.
4. **Continual Model Routing in Evolving Model Hubs**  
   - 날짜: 2026-05-27  
   - 링크: [arXiv](https://arxiv.org/abs/2605.28577)  
   - 메모: 작은 모델/큰 모델 라우터 연구에서는 매우 중요하다. 하지만 retrieval pipeline이나 domain routing보다 model hub evolution 문제에 초점이 있다.
5. **R3AG: Retriever Routing for Retrieval-Augmented Generation**  
   - 날짜: 2026-04-22  
   - 링크: [arXiv](https://arxiv.org/abs/2604.22849)  
   - 메모: retriever routing 문제를 깔끔하게 정식화했다. 다만 이번 주 글로는 시스템 구조가 비교적 좁고, hierarchical document handling이나 multi-domain noise 해소 관점은 VDGR-RAG가 더 풍부하다.
6. **Learning to Route: A Rule-Driven Agent Framework for Hybrid-Source Retrieval-Augmented Generation**  
   - 날짜: WWW 2026 공개는 2026-04-12, arXiv은 2025-09-30  
   - 링크: [ACM DOI](https://dl.acm.org/doi/10.1145/3774904.3792676), [arXiv](https://arxiv.org/abs/2510.02388)  
   - 메모: 문서 vs 데이터베이스 source routing이 실무적으로 아주 좋다. 다만 최신성에서 밀리고, 이번 주에는 같은 enterprise routing 계열 중 VDGR-RAG가 더 새롭고 더 넓은 retrieval 조합을 보여준다.
7. **A-RAG: Scaling Agentic Retrieval-Augmented Generation via Hierarchical Retrieval Interfaces**  
   - 날짜: 2026-02-03  
   - 링크: [arXiv](https://arxiv.org/abs/2602.03442)  
   - 메모: 올해 agentic RAG의 강한 baseline이다. 이번 리뷰에선 오히려 비교 대상으로 읽는 편이 더 적절했다.

# 같이 본 공식 연구 게시물

- [Google Research: Unlocking dependable responses with Gemini Enterprise Agent Platform’s Agentic RAG](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/)  
  multi-agent planning, query rewriting, routing, sufficient-context check를 production 관점에서 설명한다.
- [NEC Labs: How Rule-Driven Routing Makes Retrieval-Augmented Generation Smarter](https://www.nec-labs.com/blog/how-rule-driven-routing-makes-retrieval-augmented-generation-smarter/)  
  document corpus와 relational DB 사이 source routing이 왜 필요한지 문제 정의가 명확하다.

# 최종 선정 이유

이번 주엔 `CacheRouter`가 가장 최신이었지만, 내 블로그와 연구 방향 기준으로는 VDGR-RAG가 더 중요했다.

- 내가 요즘 더 자주 부딪히는 문제는 "어떤 모델을 고를까"보다 "어느 지식 베이스와 어느 retrieval route를 먼저 태울까"에 가깝다.
- LangChain/LangGraph/RAG 시스템으로 바로 옮길 때도 model router보다 retrieval router 쪽이 당장 구현 가치가 높다.
- 이 논문은 단순히 hybrid retrieval을 말하는 데서 멈추지 않고, domain routing, directory-aware search, graph propagation, reflection을 각각 분리된 실패 모드 대응책으로 설계했다.
- ablation이 비교적 설득력 있다. 특히 "TOC-based search가 왜 큰 이득인지", "routing이 cross-domain noise를 얼마나 줄였는지"가 수치로 드러난다.

# 논문이 풀려는 문제

enterprise 문서 QA에서는 비슷한 용어가 여러 product line과 sub-domain에 걸쳐 반복된다. 예를 들어 telecom 문서에서 4G LTE와 5G NR은 파라미터 이름과 절차 설명이 표면적으로 매우 비슷할 수 있다. 이때 vanilla vector RAG는 semantic similarity만 보고 비슷한 chunk를 잘 가져오지만, 정작 현재 질문의 정확한 domain과 hierarchy를 못 맞추는 일이 생긴다.

논문은 이 문제를 세 가지로 본다.

1. 멀티도메인 문서에서 domain routing이 부정확하다.
2. 문서가 실제로는 chapter/section/subsection 구조를 갖지만, flat chunk retrieval은 이 구조를 거의 버린다.
3. graph-based retrieval, vector retrieval, agentic retrieval가 각자 장점이 있는데 기존 방식은 이들을 충분히 분리해서 조합하지 못한다.

# 기존 방법의 한계

저자들이 비교한 흐름은 대략 세 부류다.

- **vector-based RAG**  
  BM25 + dense retrieval은 빠르고 구현이 쉽지만, "비슷한 텍스트"와 "정답이 있는 텍스트"를 잘 구분하지 못한다.
- **graph-based RAG**  
  entity graph나 summary tree를 만들면 multi-hop reasoning에 도움은 되지만, 문서 디렉터리 구조를 직접 reasoning path로 쓰는 데는 한계가 있다.
- **agentic RAG**  
  retrieval step을 agent에게 열어 주면 유연해지지만, 어떤 route를 먼저 타고 얼마나 더 찾아야 하는지까지 잘 설계하지 않으면 호출 수가 늘고 경로 선택이 불안정해진다.

이 논문이 특히 비판하는 지점은 "한 retrieval path 안에 너무 많은 역할을 섞어 버리는 것"이다. 예를 들어 BookRAG는 graph search와 TOC reasoning을 함께 쓰지만, 저자들은 오히려 그렇게 tightly coupled된 구조가 각 모드의 장점을 제한한다고 본다.

# 핵심 아이디어

VDGR-RAG의 핵심은 retrieval을 하나의 알고리즘으로 보지 않고, 서로 다른 representation space를 탐색하는 여러 route의 조합으로 보는 데 있다.

- 벡터 route는 lexical/semantic 근접성을 본다.
- TOC route는 문서 계층 구조 안에서 "어느 섹션 아래가 맞는가"를 본다.
- graph route는 entity 간 연결성과 content-entity 관계를 본다.
- reflection은 현재 evidence가 부족할 때 query를 다시 쓰게 만든다.
- directory backtracking은 "처음 찾은 위치 근처 sibling branch에 답이 있을 수 있다"는 문서 구조적 편향을 이용한다.

즉, 이 논문은 retrieval failure를 한 가지 원인으로 보지 않는다. 위치 편향, 도메인 오염, 엔티티 연결 누락, query mismatch를 서로 다른 실패 모드로 나누고 각각 다른 tool을 붙인다.

# 방법론 상세 설명

## 1. H²KG 구성

논문의 기반 자료구조는 `H²KG(Hierarchical Heterogeneous Knowledge Graph)`다.

- `Directory node`
  - 문서의 TOC hierarchy에서 root, chapter, section, subsection을 뽑는다.
  - `Path_full`, `Path_parent`, `Ver_prod` 같은 속성을 둔다.
- `Content node`
  - chunk 하나를 노드 하나로 둔다.
  - raw content와 source, title을 가진다.
- `Entity node`
  - LLM이 chunk에서 domain-specific entity를 뽑아 만든다.
  - entity importance score도 같이 둔다.

엣지는 세 종류다.

- containment edge: directory-to-directory, directory-to-content
- existence edge: content-to-entity
- co-occurrence edge: entity-to-entity

흥미로운 점은 explicit relation extraction을 거의 포기하고, 대신 entity co-occurrence graph로 간다는 것이다. relation triple 추출은 비싸고 noisy하니, 문장 단위 공기출현으로 충분히 semantic association을 만들겠다는 판단이다. 이건 실무적으로 꽤 공감된다.

## 2. LLM 기반 semantic augmentation

directory node에는 원문 텍스트가 없기 때문에 summary를 bottom-up으로 만든다. child summary들을 받아 상위 directory summary를 합성한다. 이 요약이 나중에 routing과 TOC search의 핵심 입력이 된다.

이 설계는 아주 중요하다. 일반적인 chunk RAG에서는 "문서 구조"가 인덱싱 후 거의 사라지는데, 여기서는 summary가 있는 directory node를 하나의 retrieval 단위로 만든다.

## 3. Knowledge Base Routing

여러 domain-specific H²KG가 있을 때, 먼저 query를 어느 knowledge base로 보낼지 정한다.

- 각 H²KG의 상위 디렉터리 몇 레벨만 라우팅 컨텍스트로 노출한다.
- LLM이 query와 directory node들을 보고 대상 H²KG를 고른다.
- confidence가 낮은 knowledge base는 제외한다.
- 높은 confidence 순으로 retrieval pipeline을 태우고, 충분한 evidence가 모이면 early exit한다.

이 부분은 "top-level TOC를 router feature로 쓴다"는 점이 핵심이다. 단순 domain label 분류보다 실제 문서 구조를 훨씬 잘 반영한다.

## 4. Multi-Route Retrieval

세 route를 독립적으로 실행한 뒤 evidence level에서 합친다.

### Route 1: Naive RAG

BM25 + dense retrieval + reranking이다. baseline이자 빠른 first-pass다.

### Route 2: TOC-Based Agentic Search

이 route는 정말 문서형 지식 베이스에 잘 맞는다.

1. query와 directory node 임베딩 유사도로 top-L candidate directory를 뽑는다.
2. LLM이 `Path_full`과 summary를 읽고 더 구체적인 directory를 고른다.
3. 선택된 directory subtree 아래의 content node를 수집한다.

중요한 건 LLM에게 deeper directory를 선호하게 유도한다는 점이다. 더 깊은 섹션은 보통 topic specificity가 높으니 retrieval scope를 좁히는 데 유리하다.

### Route 3: Entity-Enhanced Graph Search

이 route는 query entity를 뽑고, content node와 entity node 양쪽에 초기 score를 준 다음 Personalized PageRank를 수행한다.

- content node score는 text/title/summary hit와 entity importance를 함께 본다.
- entity node score는 query와 entity name embedding similarity를 쓴다.
- 두 score를 정규화한 뒤 `beta`로 섞어 personalization vector를 만든다.
- subgraph 위에서 PPR을 돌려 top-K content node를 고른다.

즉, graph search를 entity seed 하나로만 시작하지 않고, content side score와 entity side score를 함께 쓰는 하이브리드 초기화다. 이게 꽤 실전적이다.

## 5. Directory Backtracking

처음 가져온 chunk들이 맞는 subtree 근처에 있지만 정확한 node는 놓쳤을 때를 겨냥한다.

- 1차로는 vector route가 가져온 content node의 sibling content를 본다.
- 부족하면 한 단계 올라가 parent directory의 sibling branch를 탐색한다.
- 필요한 만큼 위로 올라가되 최대 depth를 둔다.

이 아이디어는 문서형 corpus에서 자주 먹힌다. 특히 운영 문서, API 문서, 정책 문서처럼 비슷한 section이 나란히 있을 때 유효하다.

## 6. Dynamic Reflection

evidence가 아직 충분하지 않으면 LLM이 knowledge gap을 분석하고 refined query를 만든다. 그러고 나서 retrieval을 다시 한 번 돈다.

여기서 reflection은 "답변 자체를 self-critique"하는 쪽보다 retrieval planning에 한정돼 있다. 이 점이 좋다. reflection을 너무 넓게 쓰면 비용만 늘고 불안정해지기 쉽다.

# 모델 구조 또는 파이프라인 설명

내가 이해한 VDGR-RAG의 실제 실행 흐름은 아래처럼 요약할 수 있다.

```text
User Query
  -> Knowledge Base Routing
  -> for selected domain H²KGs by confidence:
       -> Route 1: Vector Retrieval
       -> Route 2: TOC Agentic Search
       -> Route 3: Entity Graph Search
       -> Evidence Merge + Sufficiency Check
       -> if insufficient and enabled:
            Directory Backtracking
  -> if still insufficient and enabled:
       Dynamic Reflection -> rewritten query -> another retrieval pass
  -> Final Answer Generation
```

실제로는 여기서 sufficiency check가 early exit을 허용한다. 그래서 모든 domain, 모든 route, 모든 reflection을 무조건 다 도는 구조가 아니다.

# 실험 설정과 주요 결과 해석

## 데이터셋

telecommunications enterprise product document를 네 묶음으로 나눈다.

- ES(Energy Saving): 약 276만 tokens, 1,927 chunks, 6,234 entities
- FM(Fault Management): 약 3.9만 tokens, 73 chunks, 497 entities
- EA(Experience Assurance): 약 44.9만 tokens, 333 chunks, 1,747 entities
- GD(General Dataset): 약 7,291만 tokens, 64,823 chunks, 91,846 entities

전체 질의는 대략 700개라고 한다. ES, FM, EA에서는 공개 baseline을 재현했고, 훨씬 큰 GD에서는 self-eval과 ablation 중심으로 본다.

## 평가 지표

- `RR(Retrieval Recall)`: 정답 evidence를 얼마나 회수했는가
- `AA(Answer Accuracy)`: 최종 답변 정확도

둘 다 LLM-as-a-judge를 사용했다. 이건 practical하지만, 동시에 judge 편향이라는 약점도 생긴다.

## 주요 결과

세 개 도메인 세트에서 VDGR-RAG가 전부 최고다.

- ES: `98.5 RR / 97.6 AA`
- FM: `92.4 RR / 91.7 AA`
- EA: `98.7 RR / 97.3 AA`

가장 인상적인 부분은 ES와 EA에서 baseline과 격차가 꽤 크다는 점이다. 반면 FM에서는 격차가 상대적으로 좁다. 내 해석은 이렇다.

- ES, EA는 구조와 규모가 더 커서 directory-aware routing과 graph augmentation 이점이 크게 드러난다.
- FM은 데이터 규모가 작고 구조 복잡성이 낮아서 sophisticated retrieval stack의 추가 이득이 상대적으로 줄어든다.

# 표와 그림에서 중요한 포인트

## Table 2: baseline 비교

이 표에서 정말 중요한 건 "어느 baseline이 항상 강한가"가 아니라 "dataset에 따라 강한 retrieval mode가 다르다"는 사실이다.

- ES에서는 HippoRAG가 baseline 중 상대적으로 강하다.
- FM에서는 A-RAG가 baseline 중 가장 높은 AA를 낸다.
- EA에서는 BookRAG가 가장 강한 baseline이다.

즉, 특정 retrieval paradigm 하나로 전부 먹히지 않는다. 저자들이 multi-route 조합을 주장하는 이유가 여기서 정당화된다.

## Table 3: progressive ablation

GD에서의 ablation은 꽤 설득력 있다.

- M1 naive RAG: `80.5 RR / 76.5 AA`
- M2 + TOC agentic search: `91.3 RR / 88.6 AA`
- M3 + graph search: `92.0 RR / 90.5 AA`
- M4 + reflection: `94.5 RR / 92.4 AA`
- M5 full: `96.9 RR / 95.7 AA`

여기서 가장 큰 메시지는 TOC-based agentic search가 1차 점프를 만든다는 점이다. naive RAG에서 바로 M2로 갈 때 AA가 `+12.1` 오른다. "문서 구조를 retrieval primitive로 쓰는 것"이 이 시스템의 진짜 핵심이라는 뜻이다.

그리고 M2에서 graph search를 붙인 M3보다, reflection을 붙인 M4가 더 많이 오른 것도 흥미롭다. 즉, missing evidence를 다시 찾게 만드는 retrieval control loop가 생각보다 강하다.

## Table 4: directory backtracking

ES에서 directory backtracking은

- RR `97.2 -> 98.3`
- AA `95.8 -> 97.0`

으로 개선된다.

폭은 아주 크지 않지만, 이건 중요하다. backtracking은 메인 retrieval이 아니라 recovery mechanism이기 때문이다. 첫 retrieval이 근처까진 갔지만 정답 subtree를 살짝 벗어난 상황에서만 작동하므로, 적당한 비용으로 tail case를 줄여 주는 역할이라고 보는 게 맞다.

다만 저자들도 인정하듯 GD처럼 hierarchy가 너무 크고 깊으면 depth 3 backtracking은 별 이득이 없다.

## Table 5: knowledge base routing

merged ES+FM+EA에서 routing 유무 비교는 아래와 같다.

- without routing: `92.4 RR / 92.3 AA`
- with routing: `96.6 RR / 95.1 AA`

이건 꽤 실무적인 메시지다. domain routing은 단순한 최적화가 아니라 cross-domain terminology contamination을 줄이는 정확도 기능이다.

## Figure 2

Figure 2는 이 논문의 설계 철학을 가장 잘 보여준다.

- (a) multi-route retrieval을 병렬 또는 조합 가능한 모듈로 둔다.
- (b) directory backtracking은 현재 위치에서 주변 구조를 더듬는다.
- (c) reflection은 retrieval query 자체를 다시 계획한다.

즉, "더 많이 검색한다"가 아니라 "다른 표현 공간을 탐색하고, 위치를 보정하고, 질의를 다시 설계한다"가 포인트다.

## Figure 3

BookRAG와 비교했을 때 VDGR-RAG는 평균 LLM calls per query를 `7.22 -> 4.14`로 줄이면서 AA는 더 높다. 저자 해석대로 BookRAG는 sub-question decomposition을 먼저 타면서 호출 수가 늘고, VDGR-RAG는 더 robust한 direct multi-route retrieval로 이를 줄인다.

이건 production 관점에서 꽤 큰 장점이다. retrieval quality보다도 호출 수 감소가 바로 latency와 cost로 연결되기 때문이다.

# 헷갈리거나 추가 확인이 필요한 부분

- entity extraction과 summary 생성에 쓰인 프롬프트가 본문에 충분히 공개돼 있지 않다. 재현성 관점에서 아쉽다.
- RR, AA를 모두 LLM judge로 평가했는데, domain-specific telecom QA에서 judge 일관성이 어느 정도인지 더 보고 싶다.
- knowledge base routing의 confidence threshold와 top-N directory exposure가 결과에 얼마나 민감한지 추가 ablation이 없다.
- FM처럼 작은 데이터셋에서 baseline 대비 향상이 제한적인 이유를 더 세밀하게 분석하지는 않는다.
- GD는 self-evaluation과 ablation 위주라서, 공개 baseline과 같은 강도의 정면 비교는 부족하다.

# 실무 적용 가능성

이 논문은 "바로 제품에 넣을 수 있나?" 기준으로 보면 꽤 가능성이 높다.

- 문서 corpus가 section hierarchy를 가진다.
- 서로 다른 product/domain 문서가 섞여 있고 용어가 많이 겹친다.
- 단순 vector RAG가 비슷한 chunk를 자꾸 잘못 가져온다.
- GraphRAG를 넣고 싶지만 full relation extraction 비용은 부담된다.

이런 조건이면 VDGR-RAG의 아이디어를 부분적으로만 가져와도 효과가 있을 가능성이 크다.

특히 실무에서는 full H²KG를 한 번에 다 만들기보다 아래 순서가 좋아 보인다.

1. top-level knowledge base routing
2. TOC-based directory retrieval
3. vector + directory merge
4. 부족한 경우에만 graph route와 reflection 추가

처음부터 전체 구조를 다 얹기보다, 회수율 병목이 실제로 어디서 생기는지 보고 단계적으로 붙이는 편이 맞다.

# 직접 구현한다면 어떤 구조로 만들지

내가 구현한다면 monolithic agent 하나로 만들지 않고, retrieval planner와 execution layer를 나눈다.

## offline indexing

- 문서 파서
- chunker
- section tree extractor
- entity extractor
- directory/content/entity summary generator
- H²KG builder
- vector index builder

## online query path

- `kb_router`
  - 입력: user query, domain별 top-level section summary
  - 출력: candidate knowledge base 목록 + confidence
- `route_vector`
  - BM25/dense/hybrid + rerank
- `route_directory`
  - directory embedding search -> LLM filter -> subtree collect
- `route_graph`
  - query entity extraction -> candidate node scoring -> PPR
- `evidence_judge`
  - sufficiency, overlap, contradiction check
- `directory_backtracker`
  - sibling / ancestor-sibling expansion
- `query_reflector`
  - gap analysis 후 refined query 생성
- `answer_synthesizer`

핵심은 route별 실행 로그를 반드시 남기는 것이다. 이 구조는 성능만큼 디버깅 가능성이 중요하다.

# LangChain, LangGraph, RAG 시스템에 적용할 수 있는 아이디어

이 논문은 LangGraph로 옮기기가 꽤 좋다.

## LangGraph

- state에 `selected_kbs`, `evidence`, `sufficiency`, `iteration`, `route_logs`를 둔다.
- `router_node`에서 knowledge base 선택
- `parallel_retrieval_node`에서 vector/directory/graph route를 병렬 호출
- `judge_node`에서 sufficiency 판정
- 부족하면 `backtrack_node` 또는 `reflect_node`로 conditional edge 분기
- 충분하면 `answer_node`로 종료

특히 directory backtracking과 reflection은 `Command` 기반 분기나 conditional edge와 잘 맞는다.

## LangChain

- retriever 하나로 숨기지 말고 `tool` 단위로 route를 분리하는 편이 낫다.
- `Structured output`으로 router decision schema를 고정해야 한다.
- middleware 레벨에서 iteration cap, budget cap, fallback order를 제어하면 운영성이 좋아진다.

## 일반 RAG 시스템

- vector store 하나만 늘리는 대신, 문서 계층을 별도 index로 유지하자.
- entity graph를 처음부터 relation triple graph로 만들 필요는 없다.
- reflection은 final answer self-critique보다 retrieval query rewrite에 먼저 쓰는 편이 비용 대비 효율이 좋다.
- domain routing은 검색 최적화가 아니라 정확도 장치로 봐야 한다.

# 한계와 비판

가장 큰 한계는 이 논문이 enterprise private corpus 위에서 강하고, 공개 benchmark 범용성은 아직 제한적이라는 점이다.

- telecom 도메인에 꽤 특화돼 있다.
- directory quality가 낮거나 문서 구조가 무너지면 TOC route 이득이 줄어들 수 있다.
- entity extraction과 summary 생성이 LLM 품질에 의존한다.
- routing, filtering, sufficiency check, reflection까지 LLM call이 많아져 운영 복잡도가 올라간다.
- `All You Need`라는 제목과 달리 실제로는 꽤 많은 moving parts를 가진 시스템이다.

개인적으로는 "full system이 강하다"는 결론은 납득되지만, 각 구성요소의 비용 대비 효용을 공개 benchmark에서도 더 보고 싶다.

# 읽고 난 뒤의 내 생각

이 논문을 읽고 다시 확인한 건, enterprise RAG의 핵심 병목이 더 이상 "좋은 embedding 하나 고르기"가 아니라는 점이다. 실제 병목은 아래에 더 가깝다.

- 질문을 어느 domain으로 보내야 하는가
- 문서 구조를 retrieval에 어떻게 다시 살릴 것인가
- 현재 evidence가 충분한지 누가 판정할 것인가
- 첫 검색이 빗나갔을 때 어디를 다시 뒤질 것인가

즉, retrieval 자체보다 retrieval control plane이 중요해지고 있다.

내 연구/블로그 방향과도 잘 맞는다. 나는 앞으로도 작은 모델 라우터나 멀티에이전트 orchestration을 보겠지만, 실제 제품성은 이런 "query routing + evidence sufficiency + structure-aware retrieval" 층에서 많이 갈린다고 본다.

# 블로그용 짧은 요약 초안

VDGR-RAG는 enterprise 문서 QA에서 벡터 검색 하나로는 해결되지 않는 문제를 잘 보여주는 논문이다. 핵심은 retrieval을 하나의 검색기로 보지 않고, domain routing, TOC 기반 directory 탐색, entity graph 탐색, reflection loop로 분리한 뒤 상황에 맞게 조합하는 것이다.

특히 흥미로웠던 점은 문서의 section hierarchy를 그냥 메타데이터로 두지 않고 실제 retrieval primitive로 끌어올렸다는 부분이다. 실무에서 product 문서, 운영 문서, 정책 문서처럼 구조가 뚜렷한 corpus를 다룬다면 이 아이디어는 GraphRAG보다 먼저 적용해 볼 가치가 있다.

# 참고 링크

- [VDGR-RAG arXiv abs](https://arxiv.org/abs/2608.07994)
- [VDGR-RAG arXiv html](https://arxiv.org/html/2608.07994v2)
- [CacheRouter arXiv](https://arxiv.org/abs/2608.22708)
- [Route Before Retrieve arXiv](https://arxiv.org/abs/2605.10235)
- [Continual Model Routing in Evolving Model Hubs](https://arxiv.org/abs/2605.28577)
- [R3AG arXiv](https://arxiv.org/abs/2604.22849)
- [Learning to Route at WWW 2026](https://dl.acm.org/doi/10.1145/3774904.3792676)
- [Google Research Agentic RAG post](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/)
- [NEC Labs rule-driven routing post](https://www.nec-labs.com/blog/how-rule-driven-routing-makes-retrieval-augmented-generation-smarter/)
