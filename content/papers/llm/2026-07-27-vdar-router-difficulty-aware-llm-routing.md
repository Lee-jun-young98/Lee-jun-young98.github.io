---
title: "VDAR-Router: Adaptive LLMs Routing via Verbalized Query Difficulty Analysis Retrieval"
date: 2026-07-27
tags:
  - "paper-review"
  - "LLM"
  - "Routing"
  - "RAG"
author: "Yu-Chien Tang, Jun-Chen Hung, Wen-Chih Peng, An-Zi Yen"
journal: "arXiv 2026"
paper: "https://arxiv.org/abs/2607.18098"
aliases:
  - "/papers/llm/2026-07-27-vdar-router-difficulty-aware-llm-routing"
  - "/papers/vdar-router-difficulty-aware-llm-routing"
---

# 한 줄 요약

VDAR-Router는 질문 원문이 아니라 "이 질문을 풀려면 어떤 능력이 얼마나 필요한가"를 먼저 서술형으로 분석한 뒤, 그 분석을 기준으로 비슷한 난도의 과거 질의를 검색해 적절한 모델을 고르는 라우터다. 핵심은 semantic similarity가 아니라 difficulty similarity를 라우팅 신호로 쓰는 점이다.

# 논문 메타데이터

- 제목: [VDAR-Router: Adaptive LLMs Routing via Verbalized Query Difficulty Analysis Retrieval](https://arxiv.org/abs/2607.18098)
- 저자: Yu-Chien Tang, Jun-Chen Hung, Wen-Chih Peng, An-Zi Yen
- 기관: National Yang Ming Chiao Tung University, Department of Computer Science
- 공개일: 2026-07-20
- 코드: [anonymous.4open.science/r/vdar-router](https://anonymous.4open.science/r/vdar-router)

# 이번 주 후보 논문 / 연구 게시물

## 1. VDAR-Router: Adaptive LLMs Routing via Verbalized Query Difficulty Analysis Retrieval

- 링크: [arXiv](https://arxiv.org/abs/2607.18098)
- 공개일: 2026-07-20
- 메모: 이번 주 후보 중 내가 찾던 "작은 모델 라우터 + 훈련 없는 실무 라우팅 + 난도 기반 도메인 추상화"에 가장 정확하게 맞는다.

## 2. RAGAL: A Frugal, Fully Local Retrieval-Augmented Assistant for Technical Support at a Government Agency

- 링크: [arXiv](https://arxiv.org/abs/2607.18756)
- 공개일: 2026-07-21
- 메모: 실제 배포 경험과 다중 도메인 retriever fine-tuning 함정이 아주 좋다. 다만 이번 자동화의 초점인 "모델 라우터"보다 "온프레미스 RAG 구축기"에 더 가깝다.

## 3. When Should LLMs Search? Counterfactual Supervision for Search Routing

- 링크: [arXiv](https://arxiv.org/abs/2607.05752)
- 공개일: 2026-07-07
- 메모: search/no-search 라우팅 문제를 잘 정의했다. 하지만 멀티모델 라우팅보다는 search policy 학습에 중심이 있다.

## 4. Modality Relevance is not Modality Utility: Post-hoc Selective Modality Escalation for Cost-Aware Multimodal RAG

- 링크: [arXiv](https://arxiv.org/abs/2607.05438)
- 공개일: 2026-07-03
- 메모: 멀티모달 RAG에서 escalation 시점을 뒤로 미루는 관점이 좋다. 다만 텍스트 RAG/도메인 라우팅 일반론으로 확장하기엔 아직 범위가 좁다.

## 5. When RAG Meets Query Planning: Logical Query Trees for Resolving Exploratory Reasoning Problems

- 링크: [arXiv](https://arxiv.org/abs/2607.00508)
- 공개일: 2026-07-01
- 메모: exploratory reasoning용 PlanRAG는 구조가 흥미롭다. 하지만 query planning이 주제이고 small-model routing과는 거리가 있다.

## 6. UCCI: Calibrated Uncertainty for Cost-Optimal LLM Cascade Routing

- 링크: [arXiv](https://arxiv.org/abs/2605.18796)
- 공개일: 2026-05-11
- 메모: calibration 기반 cascade routing이라 실무성은 매우 높다. 다만 이번 주 최신성에서 밀리고, 도메인 일반화보다 binary cascade 최적화에 더 집중한다.

## 7. Unlocking dependable responses with Gemini Enterprise Agent Platform’s Agentic RAG

- 링크: [Google Research Blog](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/)
- 공개일: 2026-06-19 무렵
- 메모: cross-corpus routing과 sufficient-context loop가 실무적으로 유용하다. 다만 공식 연구 게시물이지, 깊게 읽어 해부할 논문 1편으로 고르기엔 실험과 방법 세부가 제한적이다.

# 최종 선정 이유

이번 주에는 `VDAR-Router`를 골랐다. 이유는 세 가지다.

1. 내가 계속 추적해온 작은 모델 라우터 흐름과 직접 이어진다. 이전의 query embedding, self-reflection, prompt routing보다 한 단계 더 실용적인 abstraction을 제시한다.
2. "어떤 질문인가"가 아니라 "어떤 능력을 요구하는가"를 라우팅 기준으로 삼는 발상이 RAG, LangGraph, multi-domain agent routing에 그대로 이식 가능하다.
3. 추가 router training 없이도 성능을 끌어올리며, 심지어 2B analyst 모델로도 강한 결과를 냈다는 점이 실무 적용 가능성을 높인다.

# 논문이 풀려는 문제

LLM 라우팅의 기본 문제는 간단하다. 모든 요청을 가장 큰 모델로 보내면 품질은 좋을 수 있지만 비용과 지연이 커진다. 반대로 작은 모델 위주로 보내면 어려운 질의에서 품질이 무너진다.

기존 라우터들은 보통 다음 둘 중 하나였다.

- 입력 질의의 표면 의미를 보고 비슷한 과거 질의를 찾는 retrieval형 라우터
- 라벨된 데이터로 별도 router model을 학습하는 supervised router

저자들의 문제의식은 명확하다. 질의 표면이 비슷하다고 해서 필요한 모델 능력이 비슷한 것은 아니다. 반대로 겉보기엔 다른 질의라도 실제로는 같은 수준의 reasoning, tool use, code generation, knowledge retrieval 능력을 요구할 수 있다.

# 기존 방법의 한계

논문이 비판하는 포인트는 꽤 설득력 있다.

## 1. Query semantic similarity는 routing signal로 약하다

- 수학 문제 둘이 문장 형태는 달라도 둘 다 "한 번의 산술 연산"이면 작은 모델로 충분할 수 있다.
- 반대로 "웹사이트 만들어줘"라는 비슷한 문장도 개인 홈페이지와 결제/장바구니가 있는 쇼핑몰은 필요한 능력이 완전히 다르다.

## 2. 추가 router training은 배포 비용과 해석 가능성 문제를 만든다

- RouterDC, Graph-based router, bandit router 같은 방식은 훈련 데이터와 별도 학습 파이프라인이 필요하다.
- 왜 이 질의가 이 모델로 갔는지 사람에게 설명하기도 어렵다.

## 3. Raw query retrieval은 capability alignment를 보장하지 않는다

- 표면적으로 비슷한 질의가 실제로는 다른 reasoning depth를 요구할 수 있다.
- retrieval target이 잘못되면 top-k 이웃이 라우팅 근거로 부적절해진다.

# 핵심 아이디어

핵심은 매우 단순하다.

1. 입력 질의를 바로 embed하지 않는다.
2. 먼저 "Difficulty Analyst"가 질의를 읽고 필요한 능력과 난도를 서술형으로 분석한다.
3. 이 difficulty analysis를 embedding해서 과거 질의들의 difficulty analysis DB에서 top-k를 찾는다.
4. 그 과거 질의들에서 각 후보 모델이 보였던 성능과 비용을 모아 reward를 계산한다.
5. reward가 가장 높은 모델을 현재 질의에 라우팅한다.

즉, retrieval space를 `question space`에서 `capability-demand space`로 바꾼 셈이다.

# 방법론 상세 설명

## 1. Difficulty Analyst

저자들은 analyst LLM에게 질의를 풀기 위해 필요한 능력을 7개 축으로 분석하게 한다.

- reasoning
- comprehension
- instruction following
- agentic capabilities
- knowledge retrieval
- coding
- multilingual ability

논문에서 중요한 점은 이 분석이 단순 숫자 점수가 아니라 "verbalized analysis"라는 것이다. 예를 들어 수학 문제라면:

- 어떤 지식이 필요한지
- reasoning chain이 몇 단계인지
- symbolic manipulation이 필요한지
- instruction이 단순한지

같은 정보를 문장으로 풀어 쓴다.

## 2. Offline DB 구축

훈련 셋의 각 질의 `q_i`에 대해 analyst가 difficulty analysis `a_i = M(q_i)`를 만든다. 이후 이 `a_i`를 embedding model로 인코딩해 DB에 저장한다.

이 단계의 의의는 크다.

- 질의 원문을 저장하는 게 아니라 난도/능력 요구 표현을 저장한다.
- 따라서 lexical overlap이 없어도 capability overlap이 있으면 가까워질 수 있다.

## 3. Test-time retrieval

새 질의 `q`가 들어오면 같은 analyst가 새 difficulty analysis `a`를 만든다. 그 뒤 `a`를 임베딩해 DB에서 비슷한 분석 `top-k`를 찾는다.

여기서 retrieved item은 "비슷한 문장"이 아니라 "비슷한 난도 프로필을 가진 과거 질의"다.

## 4. Reward 기반 모델 선택

저자들은 top-k 이웃 질의들에서 각 모델의 과거 성능 `p_m`과 비용 `c_m`을 모아 평균 reward를 계산한다.

`R(m | q) = (1/k) * Σ_i [ α * p_m(q_i^r) - β * c_m(q_i^r) ]`

- `α + β = 1`
- `α`는 품질 비중
- `β`는 비용 비중

즉, "비슷한 난도 문제에서 이 모델이 얼마나 잘했고 얼마나 비쌌는가"를 현재 질의의 proxy로 쓰는 방식이다.

이 구조 덕분에 strongest model 고정 선택을 피하면서도, 무작정 cheapest model로 떨어지지 않는다.

# 모델 구조 또는 파이프라인 설명

논문 그림 2의 파이프라인은 아래처럼 이해하면 된다.

```text
입력 질의
-> Difficulty Analyst
-> difficulty analysis 텍스트
-> embedding
-> difficulty analysis DB에서 top-k 검색
-> 과거 질의별 모델 성능/비용 조회
-> reward 재계산
-> 최종 모델 선택
```

실제로는 MoE router처럼 end-to-end differentiable하지 않다. 대신 운영 관점에서는 장점이 있다.

- 기존 모델 호출 로그를 그대로 활용 가능
- 별도 router training이 필수가 아님
- 왜 라우팅되었는지 사람이 읽을 수 있음
- analyst model만 교체해도 동작

# 실험 설정과 주요 결과 해석

## 데이터셋

저자들은 세 데이터셋으로 평가했다.

- RouterBench: 10,000 queries, 11 candidate models
- LLMRouterBench: 12,732 queries, 11 candidate models
- ArenaExpert5K: 2,678 queries, 105 candidate models

앞의 두 개는 각 질의에 대한 모델 성능/비용이 있는 일반 라우팅 세팅이고, ArenaExpert5K는 human preference 기반 pairwise 비교만 있어서 모델 ranking 일치도를 보는 세팅이다. 세 데이터셋 모두 80/20 train-test split을 사용했다.

## Analyst / embedding 설정

- Difficulty Analyst: Gemma4-31B 또는 Qwen3.5-4B
- 작은 analyst 실험: Qwen3.5-2B
- Embedding model: Qwen3-Embedding-0.6B
- retrieval size 기본값: `k = 30`

포인트는 "분석용 모델을 아주 크게 쓰지 않아도 되느냐"인데, 저자들은 이 점을 따로 실험했다.

## 결과 1: RouterBench / LLMRouterBench

Table 1에서 VDAR-Router는 raw performance 1등이 아니어도 reward 기준으로 가장 좋다.

- RouterBench, `α=0.8 β=0.2`: Gemma4-31B analyst 기준 reward 48.61
- 같은 조건에서 ICL-Router는 performance는 77.44로 더 높지만 cost 6.60이라 reward 42.15
- Large LLM 고정 선택도 reward 41.76에 그친다

이건 중요한 결과다. 이 논문은 "가장 잘 맞히는 모델"을 찾는 것이 아니라 "비슷한 난도군에서 가격 대비 제일 이득인 모델"을 찾는 쪽에 더 가깝다.

LLMRouterBench에서도 같은 경향이 반복된다.

- Gemma4-31B analyst 기준 reward 42.58
- Qwen3.5-2B analyst 기준 reward 42.40
- RouteLLM은 41.11
- ICL-Router는 38.69

작은 2B analyst로 내려도 reward가 거의 유지된다는 점이 특히 실무적이다.

## 결과 2: ArenaExpert5K

Table 2에서는 pairwise preference 기반 ranking 정합성을 본다.

- VDAR-Router (Qwen3.5-2B): accuracy 60.28, Spearman 0.5137, cost 0.0004
- VDAR-Router (Qwen3.5-4B): accuracy 57.66, Spearman 0.5099, cost 0.0006
- IRT-Router: accuracy 53.22, Spearman 0.1851
- RouteLLM: accuracy 52.85, Spearman 0.0710

여기서는 오히려 2B analyst가 4B analyst보다 조금 더 좋다. 저자 주장대로 difficulty-aware retrieval이 단순 query embedding보다 더 강한 ranking signal을 준다고 볼 수 있다.

## 결과 3: 하이퍼파라미터 영향

Figure 3은 `k`와 `α`를 바꿨을 때 성능 변화를 본다.

- `α`가 커질수록, 즉 성능 비중을 더 줄수록 전반적으로 성능과 accuracy가 좋아진다.
- `k`를 늘리면 항상 좋아지지는 않는다.

내 해석은 이렇다.

- `α`는 결국 "얼마나 공격적으로 큰 모델 쪽을 허용하느냐"의 손잡이다.
- `k`는 너무 크면 난도는 비슷하지만 선호나 출력 스타일이 다른 이웃까지 섞여 신호가 흐려질 수 있다.

# 표와 그림에서 중요한 포인트

## Figure 1

논문의 직관을 가장 잘 보여준다.

- 커피 2잔 가격 계산과 이동 시간 합산은 문장 내용이 달라도 둘 다 쉬운 산술 문제다.
- 개인 홈페이지와 쇼핑몰 생성은 겉보기 주제가 비슷해도 필요한 capability가 다르다.

이 그림 하나로 "semantic similarity != routing similarity"라는 문제 정의가 끝난다.

## Figure 2

시스템 구조는 매우 plug-and-play하다.

- difficulty analysis collection은 offline
- runtime path는 analyst -> retrieval -> reward ranking

즉, 기존 LLM gateway 앞단에 붙이기 쉬운 구조다.

## Table 1

이 표의 핵심은 "최고 성능"이 아니라 "최고 reward"다. 특히 large model 고정 선택과 ICL-Router 대비 cost를 크게 줄이면서 reward를 올린 점이 중요하다.

## Table 2

pairwise preference처럼 noisy하고 subjective한 세팅에서도 Spearman이 크게 오른다. 이건 단지 binary cascade가 아니라 multi-model ranking에도 유효하다는 뜻이다.

## Figure 4

가장 재미있는 부분이다.

저자들은 어려운 수학 질의를 예시로 들어 KNN router와 VDAR retrieval을 비교한다.

- KNN router는 수식 표면 형태가 비슷한 문제를 가져온다.
- VDAR는 "hidden identity 인식", "symbolic manipulation", "combinatorial reasoning" 같은 capability가 비슷한 문제를 가져온다.

즉, retrieval 대상이 "문제의 모양"에서 "문제를 푸는 데 필요한 능력"으로 바뀐다.

## Figure 5

저자들은 Bayesian Rasch model로 질의 난도를 수치화한 뒤, retrieved top-k가 실제로도 난도 차이가 작은지 본다. ECDF 상에서 VDAR가 query-embedding KNN과 random retrieval보다 더 작은 difficulty gap을 보였다.

이 부분은 논문의 핵심 가설을 정량적으로 뒷받침한다.

# 헷갈리거나 추가 확인이 필요한 부분

몇 가지는 읽으면서 더 확인하고 싶었다.

## 1. Difficulty Analyst prompt의 안정성

논문 본문은 prompt 전체를 Appendix로 넘긴다. 실제 운영에서는 analyst prompt가 조금만 흔들려도 retrieval neighborhood가 바뀔 수 있다. prompt robustness 실험이 더 있었으면 좋았을 것 같다.

## 2. 도메인별 capability taxonomy의 충분성

7개 축은 범용적이지만, 실제 enterprise RAG에서는 schema grounding, citation discipline, tool reliability, safety policy adherence 같은 축이 더 중요할 수 있다.

## 3. 비용 계산의 현실성

논문 reward의 cost는 정규화된 비용이다. 실제 프로덕션에서는 토큰 비용, latency, timeout risk, rate limit, cold start까지 포함해야 한다.

## 4. Preference dataset 해석

ArenaExpert5K에서는 human preference가 출력 스타일 편향을 포함할 수 있다. 저자들도 limitation에서 이 점을 인정한다. difficulty가 비슷하다고 preference ranking까지 비슷하다고 단정하긴 어렵다.

# 실무 적용 가능성

실무성은 꽤 높다.

## 적용이 쉬운 이유

- training-free 구조라 바로 붙여볼 수 있다
- analyst는 작은 모델로도 가능성이 보였다
- 과거 요청 로그와 모델별 결과만 있으면 DB를 만들 수 있다
- 라우팅 사유를 텍스트로 남길 수 있어 디버깅이 쉽다

## 특히 잘 맞는 곳

- 여러 사내 RAG assistant 중 어떤 파이프라인을 탈지 고르는 경우
- 작은 모델 / 큰 모델 / tool-heavy agent 사이를 라우팅하는 경우
- domain별 expert chain이 있고 질의 난도도 함께 고려해야 하는 경우
- long-context vs RAG vs search escalation 결정을 내려야 하는 경우

# 직접 구현한다면 어떤 구조로 만들지

내가 구현하면 아래 구조로 간다.

## 1. Offline trace warehouse

- 질의
- gold 또는 judge score
- 선택된 모델
- 후보 모델별 score
- latency / token / failure 로그
- 도메인 태그

이걸 먼저 쌓는다.

## 2. Difficulty analyst service

- 입력: user query, optional conversation state, optional retrieved schema/tool inventory
- 출력: capability summary, difficulty dimensions, estimated failure modes

여기서 바로 자유 텍스트만 저장하지 말고 아래 두 개를 같이 남긴다.

- human-readable analysis
- structured JSON projection

예시:

```json
{
  "reasoning": "high",
  "knowledge_retrieval": "medium",
  "tool_use": "low",
  "coding": "none",
  "domain_specificity": "high",
  "failure_modes": ["schema mismatch", "multi-hop evidence"]
}
```

## 3. Dual retrieval

- analysis text embedding retrieval
- structured field filtering

실무에서는 pure embedding 하나보다, `domain=finance`, `needs_sql=true`, `reasoning>=medium` 같은 filter를 함께 쓰는 편이 더 안정적일 가능성이 높다.

## 4. Reward layer

reward는 논문처럼 단순 평균으로 시작하되, 나중에는 아래 항목을 넣고 싶다.

- answer quality
- token cost
- p95 latency
- tool failure probability
- hallucination risk
- abstain quality

## 5. Online feedback loop

- route decision
- actual model outcome
- human edit cost
- downstream success

이 피드백으로 retrieval DB를 계속 갱신한다.

# LangChain, LangGraph, RAG 시스템에 적용할 수 있는 아이디어

## LangChain

- `Runnable` 앞단에 `DifficultyAnalyzerChain`을 둔다
- 분석 결과를 vector store에 질의해 historical route examples를 찾는다
- `RouterRunnable`이 reward 계산 후 downstream chain 선택

## LangGraph

LangGraph에서는 이 논문이 더 잘 맞는다.

- node 1: `analyze_difficulty`
- node 2: `retrieve_similar_cases`
- node 3: `score_routes`
- conditional edge: `small_llm`, `large_llm`, `rag_chain`, `web_search_chain`, `sql_agent`

중요한 건 conditional edge를 단순 classifier가 아니라 retrieval-backed decision으로 만든다는 점이다.

## RAG 시스템

이 논문 아이디어를 모델 라우팅보다 더 넓게 쓰면 다음도 가능하다.

- retrieve 여부 결정
- retrieval depth 결정
- reranker 사용 여부 결정
- graph RAG / vanilla RAG / long-context direct answer 선택
- citation-required mode vs quick-answer mode 선택

특히 "query text 기반 routing" 대신 "required capability 기반 routing"으로 바꾸면 도메인이 달라도 재사용성이 올라간다.

# 한계와 비판

## 1. 추가 추론 단계가 생긴다

training-free라고는 해도 test-time에 analyst inference가 한 번 더 돈다. ultra-low-latency 제품에서는 이 비용이 작지 않을 수 있다.

## 2. Difficulty analysis 품질에 전체가 의존한다

analyst가 잘못 요약하면 retrieval 이웃 전체가 틀어진다. 결국 router가 아니라 upstream verbalizer 품질에 민감하다.

## 3. 텍스트 분석은 장황하고 불안정할 수 있다

서술형 분석은 해석 가능하지만, 같은 질의에 대해 wording variance가 크면 embedding space가 흔들릴 수 있다.

## 4. Subjective preference는 difficulty만으로 설명되지 않는다

특히 Arena류 데이터셋은 verbosity, style, tone 같은 요소가 끼어든다. 논문 limitation도 이 점을 인정한다.

## 5. 진짜 multi-domain transfer는 아직 덜 검증됐다

논문이 capability abstraction을 강조하지만, "서로 다른 도메인에서 난도 표현이 얼마나 공통적으로 먹히는가"를 강하게 검증한 것은 아니다. 앞으로 cross-domain split이나 unseen-domain routing 평가가 더 필요하다.

# 읽고 난 뒤의 내 생각

이 논문에서 가장 마음에 든 부분은 거창한 새 모델보다 "라우팅 공간을 바꾸자"는 발상이다. 최근 라우팅 연구를 보면 결국 아래 축들 사이에서 같은 문제를 반복한다.

- raw query similarity
- self-reflection
- learned classifier
- cost-aware reward

VDAR-Router는 여기에 "difficulty verbalization"을 끼워 넣어서 retrieval target 자체를 바꿨다. 이건 RAG에서도 그대로 통한다. 예를 들어 "이 질문은 retrieval이 필요한가?"보다 "이 질문은 어떤 증거, 어떤 reasoning depth, 어떤 failure mode를 가지는가?"를 먼저 분석하면 route quality가 확실히 좋아질 수 있다.

내 연구 방향과도 잘 맞는다. 나는 small model router를 단순 gating classifier로 보기보다, "질문의 요구 능력을 낮은 차원의 해석 가능한 중간표현으로 바꾼 뒤 그 표현으로 route"하는 구조가 더 유망하다고 본다. 이 논문은 그 중간표현을 verbalized difficulty analysis로 구현했다.

다만 다음 단계는 분명하다.

- 자유 텍스트 difficulty analysis를 structured latent representation으로 압축하기
- domain metadata와 결합하기
- route outcome feedback으로 online update하기
- model routing뿐 아니라 retrieval routing, tool routing, planning depth control까지 확장하기

# 블로그용 짧은 요약 초안

VDAR-Router는 LLM 라우팅에서 "질문이 무엇을 말하는가"보다 "질문이 어떤 능력을 요구하는가"를 더 중요한 신호로 본다. 질의를 먼저 난도와 요구 capability로 서술형 분석한 뒤, 비슷한 difficulty profile을 가진 과거 사례를 검색해서 어떤 모델이 가장 비용 대비 효율적인지 고른다. 특히 2B급 작은 analyst 모델로도 강한 결과를 낸 점이 인상적이었고, 이 아이디어는 LangGraph 기반 agent routing이나 RAG pipeline selection에도 그대로 옮겨올 수 있다.

# 참고 링크

- [VDAR-Router arXiv](https://arxiv.org/abs/2607.18098)
- [VDAR-Router PDF](https://arxiv.org/pdf/2607.18098)
- [VDAR-Router 코드](https://anonymous.4open.science/r/vdar-router)
- [RAGAL: A Frugal, Fully Local Retrieval-Augmented Assistant for Technical Support at a Government Agency](https://arxiv.org/abs/2607.18756)
- [When Should LLMs Search? Counterfactual Supervision for Search Routing](https://arxiv.org/abs/2607.05752)
- [Modality Relevance is not Modality Utility: Post-hoc Selective Modality Escalation for Cost-Aware Multimodal RAG](https://arxiv.org/abs/2607.05438)
- [When RAG Meets Query Planning: Logical Query Trees for Resolving Exploratory Reasoning Problems](https://arxiv.org/abs/2607.00508)
- [UCCI: Calibrated Uncertainty for Cost-Optimal LLM Cascade Routing](https://arxiv.org/abs/2605.18796)
- [Google Research Blog: Unlocking dependable responses with Gemini Enterprise Agent Platform’s Agentic RAG](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/)
