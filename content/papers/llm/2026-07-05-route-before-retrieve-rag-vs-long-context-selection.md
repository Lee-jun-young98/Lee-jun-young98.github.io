---
title: "Route Before Retrieve: RAG vs Long-Context 라우팅을 먼저 결정하는 Pre-Route"
date: 2026-07-05
tags:
  - "paper-review"
  - "LLM"
  - "RAG"
  - "Routing"
  - "Long-Context"
author: "Yiwen Chen, Kuan Li, Fuzhen Zhuang, Deqing Wang, Zhao Zhang, Liwen Zhang, Yong Jiang, Shuai Wang, Minhao Cheng"
journal: "arXiv 2026"
paper: "https://arxiv.org/abs/2605.10235"
aliases:
  - "/papers/llm/route-before-retrieve-rag-vs-long-context-selection"
  - "/papers/route-before-retrieve-rag-vs-long-context-selection"
---

# 한 줄 요약

이 논문은 "일단 검색부터 해보고 안 되면 long-context로 넘기자"는 수동적 라우팅 대신, 질문에 답하기 **전에** RAG와 Long-Context 중 어느 경로가 더 유리한지 미리 판정하는 `Pre-Route`를 제안한다. 핵심은 대형 모델의 잠재적 라우팅 능력을 구조화된 추론 프롬프트로 끌어내고, 그 추론 구조를 작은 모델로 distill해서 실전용 경량 라우터로 만드는 데 있다.

# 논문 메타데이터

- 제목: [Route Before Retrieve: Activating Latent Routing Abilities of LLMs for RAG vs. Long-Context Selection](https://arxiv.org/abs/2605.10235)
- 저자: Yiwen Chen, Kuan Li, Fuzhen Zhuang, Deqing Wang, Zhao Zhang, Liwen Zhang, Yong Jiang, Shuai Wang, Minhao Cheng
- 기관: Beihang University, HKUST, Alibaba Group, Pennsylvania State University
- 공개일: 2026-05-11
- 링크: [arXiv abs](https://arxiv.org/abs/2605.10235), [arXiv html](https://arxiv.org/html/2605.10235v1)

# 이번 주 후보 논문 목록

| 후보                                                                                                              | 왜 봤는가                                                                                                                                                                  | 이번 주 최종 선택 여부 |
| ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| [Route Before Retrieve](https://arxiv.org/abs/2605.10235)                                                         | RAG vs long-context 선택 문제를 정면으로 다루고, 대형 라우터의 추론을 소형 모델로 증류한다. 내 관심사인 "작은 모델 라우터"와 "RAG 라우팅"이 정확히 겹친다.                 | 선택                   |
| [Continual Model Routing in Evolving Model Hubs](https://arxiv.org/abs/2605.28577)                                | 수천 개 모델 허브에서 라우터를 continual learning 문제로 재정의한 점이 강하다. 다만 이번 주 자동화의 핵심인 RAG/도메인 라우팅보다는 모델 허브 선택 문제 쪽 비중이 더 크다. | 제외                   |
| [TwinRouterBench](https://arxiv.org/abs/2605.18859)                                                               | agent step-level routing benchmark로 매우 실용적이다. 다만 벤치마크 중심이라 구현 아이디어보다 평가 프레임 설계가 핵심이다.                                                | 제외                   |
| [Adaptive Re-Ranking](https://arxiv.org/abs/2606.25249)                                                           | 검색 파이프라인에서 query별로 BM25, 경량 reranker, heavy reranker를 라우팅한다. 실무적으로 좋지만 LLM/RAG 논문 리뷰로는 범위가 좁다.                                       | 제외                   |
| [Look Before You Zoom](https://arxiv.org/abs/2606.21968)                                                          | Visual RAG에서 해상도-문맥 trade-off를 라우팅하는 흥미로운 사례다. 하지만 멀티모달 VQA라 이번 블로그 축과는 약간 비껴간다.                                                 | 제외                   |
| [When More Documents Hurt RAG](https://arxiv.org/abs/2606.11350)                                                  | 대규모 이종 문서 컬렉션에서 vector search dilution을 다루며 domain-scoped retrieval을 제안한다. 실무성은 높지만 라우터의 추론 설계보다는 검색 스코프 설계가 주제다.        | 제외                   |
| [Comprehensive Comparison of RAG Methods Across Multi-Domain Conversational QA](https://arxiv.org/abs/2602.09552) | 멀티도메인 conversational QA에서 여러 RAG 기법을 비교한다. 중요한 survey-style empirical study지만 새 구현 아이디어는 상대적으로 약하다.                                   | 제외                   |

# 최종 선정 이유

이번 주에는 `Route Before Retrieve`가 가장 중요했다.

첫째, 주제 적합성이 높다. 작은 모델 라우터, RAG 라우팅, 문서 유형별 분기, 비용-성능 trade-off가 한 논문 안에 같이 들어 있다.  
둘째, 실무로 옮기기 쉽다. 입력으로 full document를 보지 않고 메타데이터와 head snippet만으로 라우팅한다는 점이 특히 좋다.  
셋째, 단순 벤치마크 소개가 아니라 방법론, probe 분석, distillation, ablation이 모두 있다.  
넷째, LangChain/LangGraph 기반 시스템에서 바로 middleware나 pre-check node로 구현할 수 있다.

# 이 논문이 풀려는 문제

RAG와 long-context는 둘 다 "긴 문서 질의응답"의 답처럼 보이지만, 실제로는 서로 잘하는 문제가 다르다.

- RAG는 저비용이고 evidence grounding에 강하다.
- Long-Context는 전역 비교, 멀리 떨어진 단서 통합, 다중 문단 reasoning에 강하다.

문제는 실제 서비스에서 어느 요청을 어느 경로로 보낼지 자동으로 정해야 한다는 점이다. 무조건 RAG를 먼저 태우면 검색 비용이 항상 들어가고, retrieval failure 판단도 부정확하다. 무조건 long-context로 보내면 비용이 비싸고 lost-in-the-middle 문제가 생긴다.

즉, 질문은 "답을 어떻게 생성할까?"가 아니라 그 전에 "이번 질문은 RAG가 맞나, LC가 맞나?"이다.

# 기존 방법의 한계

논문은 대표 baseline으로 `Self-Route`를 둔다. Self-Route는 일단 RAG로 답해 본 다음, 모델이 `unanswerable`이라고 말하면 long-context로 fallback한다.

이 접근의 한계는 명확하다.

1. 수동적이다. retrieval failure가 발생한 뒤에야 LC로 간다.
2. 검색 비용을 항상 선지불한다.
3. 모델의 자기판단에 기대므로 과소확신과 과신 모두에 취약하다.
4. 왜 RAG/LC를 골랐는지 설명 가능성이 낮다.

특히 이 논문이 강조하는 포인트는, "검색 결과가 대충 답할 수 있어 보인다"와 "이 문제는 정말 RAG로 푸는 편이 낫다"가 다르다는 점이다. 비교 질문이나 분산 근거가 필요한 질문은 일부 chunk가 맞아 보여도 실제로는 LC가 더 적합할 수 있다.

# 핵심 아이디어

핵심은 세 가지다.

1. LLM 안에는 이미 잠재적인 라우팅 능력이 있다.
2. 그 능력은 구조화된 추론 가이드라인을 주면 더 안정적으로 드러난다.
3. 그 추론 경로를 작은 모델에 distill하면 값싼 production router로 쓸 수 있다.

논문은 이를 `Pre-Route`라고 부른다. 이름 그대로 검색 전에 route를 먼저 결정한다.

# 방법론 상세 설명

## 1. 입력은 full context가 아니라 lightweight metadata

Pre-Route는 문서 전체를 읽고 라우팅하지 않는다. 대신 아래 같은 신호를 쓴다.

- 문서 타입: novel / paper / financial report
- 문서 길이
- 질문 길이
- task type 또는 difficulty 관련 신호
- 문서 첫 부분 snippet(head)

이게 중요한 이유는, 라우팅이 retrieval이나 long-context 본추론보다 훨씬 싸야 의미가 있기 때문이다. 라우터가 무거우면 본말전도다.

## 2. 구조화된 추론 절차

논문 초록과 본문 설명을 종합하면, Pre-Route는 대략 다음 질문들을 내부적으로 수행한다.

1. 이 질문은 어떤 종류의 문제인가
2. 답의 근거가 한 군데에 국소적으로 있을 가능성이 높은가
3. 여러 부분의 전역 통합이나 비교가 필요한가
4. 검색으로 충분한 coverage를 얻을 수 있는가
5. 비용까지 감안하면 어느 경로가 더 합리적인가

초록에서 명시한 표현은 `task analysis`, `coverage estimation`, `information-need prediction`이다. 이 세 단계가 사실상 라우팅 판단의 뼈대다.

## 3. 이상적 라벨 정의

이 논문은 단순히 "teacher가 고른 경로"를 정답으로 쓰지 않는다. 대신 샘플마다 `RAG`와 `LC`의 실제 QA 성능을 비교해서 이상적 라벨을 만든다.

- LC가 더 잘하면 LC
- 성능이 비슷하면 더 싼 RAG

이 정의가 좋은 이유는, 라우팅의 목표를 accuracy-only가 아니라 cost-aware optimal decision으로 둔다는 점이다.

## 4. teacher filtering + path distillation

distillation도 꽤 깔끔하다.

- teacher가 reasoning trace와 route decision을 생성한다.
- 그 결정이 이상적 라벨과 일치하는 샘플만 남긴다.
- 남은 고품질 reasoning path로 student를 SFT한다.

논문 표현대로라면 answer distillation이 아니라 "어떻게 판단했는가"를 옮기는 쪽에 가깝다. 작은 모델이 그냥 정답 label만 외우는 게 아니라 판단 구조를 배운다는 주장이다.

# 모델 구조 또는 파이프라인 설명

실전 파이프라인으로 바꾸면 아래와 같다.

```text
Query + lightweight metadata
  -> Pre-Route router
    -> RAG path
    -> or Long-Context path
  -> Answer model
```

학습 파이프라인은 다음에 가깝다.

```text
Teacher LLM
  -> structured reasoning trace + route
  -> ideal-label consistency filtering
  -> student SFT
  -> distilled small router
```

내가 보기에 이 논문은 "라우터도 일종의 task classifier"라는 관점과 "라우터는 explainable chain을 갖는 policy model"이라는 관점을 절충한다. 최종 배포는 small classifier-like router처럼 쓰되, 학습은 reasoning-heavy teacher로 밀어붙인다.

# 실험 설정

## 데이터셋

- `LaRA`: in-domain main experiment
- `LongBench-v2`: out-of-distribution 평가

LaRA는 논문 부록 설명상 아래 축을 가진다.

- task: localization / comparison / reasoning / hallucination
- document type: novel / paper / financial
- context length: 32k, 128k

LongBench-v2는 단일 문서 QA, 멀티 문서 QA, 긴 in-context learning, dialogue understanding, code repository, structured data까지 포함한다. 부록 통계상 총 503개 샘플이고 길이는 최대 167k까지 간다.

## 비교 기준

- Always-RAG
- Always-LC
- Self-Route
- Pre-Route large router
- Pre-Route small router
- Distilled Pre-Route small router

여기서 흥미로운 점은 답변 모델도 여러 크기의 Qwen 계열과 DeepSeek를 섞어본다는 것이다. 즉 특정 answer model 한 개에만 맞춘 결과는 아니다.

# 주요 결과 해석

## 1. Self-Route보다 "더 적게 LC를 쓰면서" 더 잘 맞힌다

논문의 핵심 메시지는 accuracy만 오른다는 게 아니다. LC 사용률도 낮춘다.

LaRA 메인 실험 표(Table 3)에서 distilled 1.7B router는 강한 answer model 조합에서 Self-Route보다 더 높은 accuracy를 보이면서 LC 비율을 꽤 낮춘다. 이건 실무적으로 매우 중요하다. 성능을 올리려면 보통 더 비싼 경로를 더 많이 써야 하는데, 이 논문은 route quality를 올려서 둘 다 잡으려 한다.

## 2. OOD에서도 baseline보다 무너지지 않는다

LongBench-v2 결과(Table 4 및 부록 Table 10/11)는 in-domain dataset 전용 꼼수는 아니라는 신호를 준다. 절대 점수는 task 특성상 낮고 noisy하지만, Pre-Route가 Self-Route 대비 더 나은 accuracy-cost trade-off를 유지한다는 방향성은 유지된다.

## 3. 작은 모델 단독 zero-shot보다, 큰 모델 reasoning을 증류한 작은 모델이 낫다

이건 내 관심사와 가장 맞닿는 결과다. 논문은 Qwen3-1.7B 같은 small router를 그냥 쓰는 것보다, teacher filtering을 거친 distilled version이 훨씬 안정적이라고 보고한다. 즉 작은 모델을 라우터로 쓰려면 zero-shot prompting보다 reasoning distillation이 핵심이라는 메시지다.

# 표와 그림에서 중요한 포인트

## Figure 1 / 초반 개념도

논문 초반의 핵심 그림은 사실상 "RAG 먼저"와 "route 먼저"의 차이를 보여준다. 여기서 중요한 건 retrieval을 실행하기 전에 이미 분기가 일어난다는 점이다. 서비스 구조상 이 차이는 latency와 infra cost 차이로 직결된다.

## Table 3: LaRA 메인 결과

이 표에서 봐야 할 것은 QA score 하나가 아니다.

- `QA`
- `LC(%)`
- `Acc`

세 개를 같이 봐야 한다. 논문이 설득력 있는 이유는 "성능만 오른다"가 아니라 "LC 남용을 줄이면서 route accuracy를 높인다"를 같이 보여주기 때문이다.

## Table 5: ablation

논문은 reasoning guideline에서 일부 단계를 빼면 성능이 떨어지거나 LC 사용률이 튄다고 보고한다. 이 결과는 단순히 "프롬프트가 길어서 좋아졌다"보다, task analysis/decision rule/reflection 각각이 역할을 한다는 주장에 힘을 싣는다.

내 해석으로는 여기서 제일 중요한 것은 `decision rules` 파트다. 이게 없으면 라우터가 조금만 애매해도 안전하게 LC 쪽으로 쏠리는 것으로 보인다.

## Table 12: traditional ML baseline 비교

이 표는 꽤 유용하다. 동일 metadata를 주고 Decision Tree, Random Forest와 비교했을 때 Pre-Route SFT가 더 낫다. 즉 이 논문이 얻는 이득이 단순 feature engineering만의 결과는 아니라는 뜻이다.

다만 반대로 읽으면, metadata 자체도 꽤 강한 신호다. 즉 production에서는 "작은 LLM router + 얕은 ML fallback" 하이브리드도 검토할 수 있다.

## Table 14: difficulty breakdown

이 표는 논문에서 가장 실무적인 insight 중 하나다.

- Hallucination task에서 Self-Route가 특히 크게 무너진다.
- Location task에서는 Pre-Route가 강하다.

왜냐하면 Self-Route는 "답을 못 하겠음"을 fallback 트리거로 쓰는데, negative answer와 unanswerable을 자주 헷갈린다. 반면 Pre-Route는 아예 질문 구조를 먼저 본다. 이 차이가 hallucination-sensitive QA에서 크게 난다.

# 헷갈리거나 추가 확인이 필요한 부분

몇 가지는 더 확인하고 싶다.

1. metadata의 실제 확보 비용
   문서 타입, task type 같은 필드가 production에서 항상 깔끔하게 주어지는가? 논문은 head-only와 generated-meta도 실험했지만, 완전 무메타 상황에서 얼마나 버틸지는 아직 애매하다.

2. binary routing의 한계
   RAG vs LC 두 갈래만 본다. 하지만 실무에서는 `skip retrieval`, `hybrid retrieve + LC`, `cheap rerank`, `multi-hop agentic retrieval`처럼 선택지가 더 많다.

3. answer model dependence
   여러 answer model을 섞긴 했지만, 결국 이상적 라벨은 특정 retrieval setup과 특정 answer path에 종속된다. 배포 환경이 바뀌면 라벨도 다시 만들어야 할 수 있다.

4. 문서군 편향
   novel, paper, financial report 세 종류는 좋은 시작이지만, 실제 엔터프라이즈 RAG의 계약서, 위키, 티켓, 로그, 코드베이스, 표 데이터까지 충분히 대표하진 않는다.

# 실무 적용 가능성

높다. 특히 다음 상황에서 바로 쓸 수 있다.

- 문서 QA 시스템에서 모든 요청을 long-context로 보내기엔 비용이 큰 경우
- retrieval quality가 케이스별로 크게 달라지는 경우
- 질문 종류가 local fact lookup과 global synthesis로 섞여 있는 경우
- domain별 문서 구조 차이가 큰 경우

이 논문의 가장 좋은 점은 라우터 입력이 가볍다는 것이다. full retrieval을 돌리기 전에 분기할 수 있으니, 실제 latency budget 안에 들어오기 쉽다.

# 직접 구현한다면 어떤 구조로 만들지

내가 구현하면 아래 구조로 만든다.

## 1. feature layer

- query text
- query length
- corpus/domain id
- document family
- top-level collection stats
- head snippet
- 최근 retrieval hit quality priors

## 2. router layer

- 1차: 아주 싼 rule-based / tree-based coarse filter
- 2차: small LLM router 또는 distilled classifier
- 출력: `route`, `confidence`, `reason`, `expected_cost`

## 3. execution layer

- `RAG`
- `LongContext`
- `Hybrid`
- `AskClarification` optional

## 4. feedback loop

- 실제 answer quality proxy 수집
- user correction / abstention / follow-up rate 기록
- route regret logging

이 논문의 포인트를 그대로 따라간다면, offline에서 teacher로 trace를 만들고 filtered trace만으로 small router를 지속적으로 재학습시키는 식이 적절하다.

# LangChain, LangGraph, RAG 시스템에 적용할 수 있는 아이디어

## LangChain

- middleware나 custom runnable로 `pre_route(query, metadata)`를 먼저 실행
- route가 `rag`면 retriever 체인으로, `lc`면 long-context prompt chain으로 분기
- router reason을 tracing metadata에 남겨 route 품질을 나중에 분석

## LangGraph

- 그래프 시작 노드에 `router` 노드를 둔다
- state에 `route`, `route_reason`, `route_confidence`를 기록
- 이후 `rag_node`, `long_context_node`로 conditional edge 분기
- 종료 후 evaluator 노드에서 route regret를 계산해 memory/store에 누적

## RAG 시스템

- collection-level domain routing과 query-level mode routing을 분리
- 먼저 `어느 corpus로 갈까`를 결정하고, 그다음 `RAG vs LC`를 결정
- retrieval score만으로 route하지 말고 question form과 evidence dispersion 신호를 같이 사용

여기서 특히 중요한 건, 이 논문을 그대로 쓰기보다 `2-stage routing`으로 확장하는 것이다.

1. domain router
2. mode router(RAG vs LC vs Hybrid)

내 블로그와 연구 방향을 생각하면 이 확장이 가장 자연스럽다.

# 한계와 비판

이 논문은 재미있지만 몇 가지 비판 포인트가 있다.

1. "latent routing ability"라는 표현은 다소 서사적이다.
   실제로는 structured prompt + filtered supervision + distillation이 성능을 만든다. 잠재 능력의 존재를 강하게 주장하기보다, 좋은 decision decomposition을 설계했다고 보는 편이 더 정확하다.

2. binary framing이 다소 단순하다.
   현실의 RAG 시스템은 retrieval depth, rerank budget, long-context window size, domain-specific retriever 선택까지 연속적인 선택지를 가진다.

3. oracle-style ideal label에 가까운 데이터 구축 비용이 크다.
   실제 서비스마다 이런 supervised routing set을 만들기 쉽지 않다.

4. benchmark가 아직 narrow하다.
   LaRA와 LongBench-v2는 유의미하지만, 코드베이스 QA나 enterprise wiki처럼 production-heavy setting에 대한 직접 검증은 더 필요하다.

# 읽고 난 뒤의 내 생각

이 논문은 "RAG냐 LC냐"를 다루지만, 실제로는 더 큰 질문을 건드린다.  
"에이전트나 RAG 시스템에서 어떤 expensive capability를 언제 켜야 하는가?"

이 관점으로 보면, Pre-Route는 단지 RAG 라우터가 아니라 비용 제약 아래서 능력을 선택하는 작은 policy model이다. 그래서 앞으로는 다음 방향이 더 중요해 보인다.

- query difficulty routing
- domain routing
- tool vs memory vs retrieval routing
- small model policy / large model executor 분리

특히 작은 모델 라우터를 연구하려면, 작은 모델에게 곧바로 최종 답 생성을 시키기보다 **선택 문제**를 맡기는 것이 훨씬 현실적이라는 점을 다시 확인했다.

# 블로그용 짧은 요약 초안

`Route Before Retrieve`는 RAG 시스템에서 검색을 먼저 돌리고 실패하면 long-context로 가는 기존 방식 대신, 질문에 답하기 전에 어떤 경로가 더 유리한지 미리 판단하는 라우터 `Pre-Route`를 제안한다. 문서 타입, 길이, head snippet 같은 가벼운 메타정보만으로도 질문의 정보 분산 정도와 근거 coverage를 추정해 RAG와 LC를 고른다는 점이 핵심이다. 특히 큰 모델의 구조화된 판단 과정을 작은 모델로 distill해 실전 배포 가능한 1.7B 라우터로 만든 부분이 인상적이었다. 내 관점에서는 이 논문이 단순한 RAG 최적화가 아니라, "작은 모델은 정책을 맡고 큰 모델은 실행을 맡는" 시스템 설계 방향을 잘 보여준다.

# 참고 링크

- 논문: [Route Before Retrieve: Activating Latent Routing Abilities of LLMs for RAG vs. Long-Context Selection](https://arxiv.org/abs/2605.10235)
- HTML 버전: [arXiv HTML](https://arxiv.org/html/2605.10235v1)
- 비교 후보: [Continual Model Routing in Evolving Model Hubs](https://arxiv.org/abs/2605.28577)
- 비교 후보: [TwinRouterBench](https://arxiv.org/abs/2605.18859)
- 비교 후보: [Adaptive Re-Ranking](https://arxiv.org/abs/2606.25249)
- 비교 후보: [Look Before You Zoom](https://arxiv.org/abs/2606.21968)
- 비교 후보: [When More Documents Hurt RAG](https://arxiv.org/abs/2606.11350)
- 비교 후보: [Comprehensive Comparison of RAG Methods Across Multi-Domain Conversational QA](https://arxiv.org/abs/2602.09552)
