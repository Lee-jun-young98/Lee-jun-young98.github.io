---
title: "Skill-RAG: Failure-State-Aware Retrieval Augmentation via Hidden-State Probing and Skill Routing"
date: 2026-08-25
tags:
  - "paper-review"
  - "LLM"
  - "RAG"
  - "Routing"
author: "Kai Wei, Raymond Li, Xi Zhu, Zhaoqian Xue, Jiaojiao Han, Jingcheng Niu, Fan Yang"
journal: "arXiv 2026"
paper: "https://arxiv.org/abs/2604.15771"
aliases:
  - "/papers/llm/skill-rag-failure-aware-skill-routing-for-rag"
---

# 한 줄 메모

이번 주 후보들 중 `Skill-RAG`를 고른 이유는 단순히 "검색을 더 할지 말지"가 아니라 "왜 지금 retrieval이 실패했는지"를 hidden state와 skill routing으로 분해해서 본다는 점이 가장 실무적이었기 때문이다. 특히 multi-hop RAG, 실패 복구 루프, domain-aware query rewriting을 자주 다루는 내 블로그 방향과 잘 맞는다.

# 논문 메타데이터

- 제목: [Skill-RAG: Failure-State-Aware Retrieval Augmentation via Hidden-State Probing and Skill Routing](https://arxiv.org/abs/2604.15771)
- 저자: Kai Wei, Raymond Li, Xi Zhu, Zhaoqian Xue, Jiaojiao Han, Jingcheng Niu, Fan Yang
- 기관: University of Michigan, University of British Columbia, Rutgers University, University of Pennsylvania, New Jersey Institute of Technology, Independent Researcher, Wake Forest University
- 최초 공개일: 2026-04-17
- 최신 버전 갱신일: 2026-08-07
- 링크:
  - 논문 abs: [arXiv 2604.15771](https://arxiv.org/abs/2604.15771)
  - 논문 HTML: [arXiv HTML](https://arxiv.org/html/2604.15771v4)

# 이번 주 후보 논문 스크리닝

이번 주에는 작은 모델 라우터, adaptive RAG, domain routing, multi-domain learning 관점에서 아래 후보들을 먼저 좁혔다. 이번 실행일은 2026-08-25이고, 후보군은 최근 몇 달 논문과 공식 연구 글 중에서 지금 읽을 가치가 높은 것만 추렸다.

1. [Skill-RAG: Failure-State-Aware Retrieval Augmentation via Hidden-State Probing and Skill Routing](https://arxiv.org/abs/2604.15771)
   선택. retrieval failure를 단순 재검색 문제가 아니라 `failure state -> corrective skill` 문제로 재정의한 점이 가장 새로웠다. hidden-state probe, query rewrite, decomposition, evidence focusing, exit까지 실제 RAG 운영 제어면과 직접 연결된다.
2. [Route Before Retrieve: Activating Latent Routing Abilities of LLMs for RAG vs. Long-Context Selection](https://arxiv.org/abs/2605.10235)
   보류. RAG와 long-context 사이를 사전 라우팅하고, 작은 모델 distillation까지 제안해서 매우 강한 후보였다. 다만 이번에는 retrieval 이후 실패 복구까지 다루는 논문이 더 실무적으로 중요하다고 봤다.
3. [Continual Model Routing in Evolving Model Hubs](https://arxiv.org/abs/2605.28577)
   보류. 2,000개가 넘는 후보 모델과 continual learning 관점을 결합한 점은 강력하다. 하지만 이번 글 한 편은 모델 허브 라우팅보다 RAG 제어 계층에 더 가까운 논문으로 좁히는 편이 맞았다.
4. [R3AG: Retriever Routing for Retrieval-Augmented Generation](https://arxiv.org/abs/2604.22849)
   보류. retriever selection 문제를 retrieval quality와 generation utility로 분해한 점이 좋다. 다만 router가 "어느 retriever를 고를까"에 집중해 있고, failure recovery loop의 폭은 `Skill-RAG`보다 좁다.
5. [Grounded Cache Routing for Retrieval-Augmented Generation: When Is It Safe to Reuse an Answer?](https://arxiv.org/abs/2605.27494)
   보류. 캐시 재사용 안전성은 production 관점에서 매우 중요하고 실험도 탄탄하다. 하지만 주제가 cache safety 쪽으로 이동해 이번 자동화의 핵심인 small router / adaptive retrieval 흐름과는 약간 달랐다.
6. [Cost-Aware Query Routing in RAG: Empirical Analysis of Retrieval Depth Tradeoffs](https://arxiv.org/abs/2606.02581)
   보류. 비용, latency, 품질을 묶어서 discrete bundle을 고르는 문제 설정은 실용적이다. 다만 28-query 규모의 실험 세팅보다 `Skill-RAG`의 failure taxonomy가 블로그와 후속 구현 아이디어로 더 풍부했다.
7. [Lightweight Chunk Selection for Mobile Retrieval-Augmented Generation](https://arxiv.org/abs/2608.03148)
   보류. 2026-08-04 공개로 최근성은 높고 작은 모델/모바일 제약과도 잘 맞는다. 하지만 chunk selector 중심이라 이번 주의 라우팅 메인 축으로 잡기에는 범위가 좁았다.
8. [Unlocking dependable responses with Gemini Enterprise Agent Platform’s Agentic RAG](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/)
   참고만. 2026-06-05 Google Research 공식 글로 cross-corpus planning, query rewriting, sufficient-context 판단을 잘 설명한다. 다만 공개된 실험 세부와 ablation 깊이는 논문보다 얕아서 deep review 대상에서는 제외했다.

# 최종 선정 이유

`Skill-RAG`를 최종 선택한 이유는 세 가지다.

1. retrieval 실패를 "증거 부족"이 아니라 "질문-증거 정렬 실패"로 본다. 이 관점이 실제 사내 문서 RAG에서 훨씬 자주 맞다.
2. 라우팅 단위를 `retrieve / do-not-retrieve`에서 끝내지 않고 `query rewrite / decomposition / evidence focusing / exit`로 세분화했다. 이것이 LangGraph 상태 머신으로 바로 번역된다.
3. OOD multi-hop 세트에서 이득이 크다. production RAG에서 진짜 아픈 구간이 바로 분포 바깥의 길고 꼬인 질문이기 때문이다.

# 논문이 풀려는 문제

기존 adaptive RAG는 대체로 아래 둘 중 하나에 집중한다.

- retrieval이 필요한가
- retrieval을 몇 번 더 할 것인가

그런데 retrieval을 한 번 했는데도 답이 틀리는 경우가 많다. 이때 실패 원인은 다양하다.

- 질문 표면형이 corpus indexing 방식과 맞지 않는다.
- multi-hop 질문이라 한 번의 검색 결과만으로는 reasoning chain이 풀리지 않는다.
- 너무 넓은 질문이라 관련 문서는 잡히지만 정답에 필요한 evidence slot이 비어 있다.
- 더 검색해도 해결되지 않는 genuinely hard case다.

논문은 이 상황을 `post-retrieval failure`로 정의하고, retrieval control을 coarse decision이 아니라 `failure-conditioned recovery policy`로 바꾼다.

# 기존 방법의 한계

논문이 비판하는 기존 방법의 한계는 명확하다.

1. retrieval decision granularity가 너무 거칠다.
   FLARE, DRAGIN, Adaptive-RAG, Probing-RAG류 방법은 언제 retrieval할지, 몇 번 반복할지에 초점을 둔다. 하지만 실패 원인별 corrective action은 분리하지 않는다.
2. retrieval failure를 uncertainty로만 본다.
   내부 상태가 불확실하다는 사실만으로는 어떤 교정 행동을 해야 하는지 알 수 없다.
3. 반복 retrieval이 항상 도움이 된다는 가정이 있다.
   multi-hop 질문이나 misaligned query에서는 재검색을 여러 번 해도 같은 종류의 실패가 반복될 수 있다.

이 논문이 중요한 이유는 retrieval failure를 `질문-증거 정렬 실패의 구조적 패턴`으로 해석했다는 점이다.

# 핵심 아이디어

핵심 아이디어는 두 단계다.

1. hidden-state probe로 현재 상태가 "답변 가능"인지 "retrieval failure state"인지 판단한다.
2. failure state가 감지되면 prompt-based skill router가 원인을 진단하고 네 가지 skill 중 하나를 고른다.

네 가지 skill은 다음과 같다.

- Query rewriting
- Question decomposition
- Evidence focusing
- Exit

즉 `should retrieve?`에서 멈추지 않고 `how should retrieval be corrected?`로 간다.

이 논문을 읽으면서 가장 좋았던 부분은 `exit`를 정식 skill로 넣은 점이다. retrieval budget을 계속 태우는 대신, 더 검색해도 풀리지 않는 case를 종료하는 정책을 모델에 맡긴다.

# 방법론 상세 설명

## 1. Probe 학습

저자들은 HotpotQA, NQ, TriviaQA의 학습 split에서 두 조건으로 답을 생성한다.

- no retrieval
- single-step retrieval

각 예제에서 reasoning token과 answer token이 생성될 때의 hidden state를 뽑아 correctness label과 묶는다. probe는 final two-thirds layer에서 every-other-layer를 사용하고, 각 layer hidden state를 mean pooling한 뒤 per-layer MLP binary classifier를 학습한다.

수식 수준에서 보면:

- 선택한 layer 집합 `S`를 만든다.
- 각 layer hidden representation `h_l`을 mean pooling으로 얻는다.
- layer별 sigmoid MLP가 `p_l`을 낸다.
- 최종 점수는 `p_hat = average(p_l)`다.

이 구조의 의미는 간단하다. 출력 confidence를 보는 대신, 생성 도중 내부 상태가 이미 "지금 답을 낼 수 있는가"를 말해준다고 본다.

## 2. Gating decision

추론 시 `p_hat`를 threshold `tau`와 비교한다.

- `p_hat >= tau`: retrieval 없이 바로 답하거나 현재 context로 충분하다고 본다.
- `p_hat < tau`: retrieval이 필요하거나, 이미 retrieval 후라면 failure recovery loop로 진입한다.

이 probe는 논문 기준 추가적인 별도 LLM 호출 없이 lightweight하게 붙는다. 실무 관점에서는 이게 중요하다. router가 아무리 좋아도 inference cost가 크면 운영하기 어렵기 때문이다.

## 3. Skill router

probe가 failure state를 감지하면 skill router는 아래 입력을 본다.

- 원 질문
- 실패한 reasoning trace와 answer
- 현재 retrieved evidence

그리고 네 가지 corrective skill 중 하나를 고른다.

### Query rewriting

질문 표면형이 corpus의 표현과 잘 안 맞을 때 쓴다. 예를 들어 entity alias, 표현 차이, 설명형 질문을 검색 친화적인 키워드형으로 바꾼다.

### Question decomposition

multi-hop 질문에서 premise가 얽혀 있을 때 sub-query들로 나누고, 각 hop을 분리한 뒤 최종 retrieval query를 다시 만든다.

### Evidence focusing

질문은 넓고 증거는 너무 산만할 때, 현재 context에서 비어 있는 evidence slot을 뽑아 그것만 타깃팅하는 retrieval query를 만든다.

### Exit

더 검색해도 해결되지 않을 가능성이 높을 때 loop를 중단한다. 저자들은 이것을 missing knowledge나 model capacity limit case로 해석한다.

## 4. 전체 파이프라인

논문 Figure 1을 내가 다시 정리하면 아래 흐름이다.

```text
query
  -> answer without retrieval
  -> probe judges if enough
  -> if insufficient: retrieve
  -> generate with evidence
  -> probe re-checks sufficiency
  -> if failure: skill router selects correction
  -> revised query / focused evidence / decomposition / exit
  -> repeat until sufficient, exit, or budget exhausted
```

이 구조는 사실상 `probe-gated corrective retrieval loop`다. 논문 스스로도 contribution을 "first probe-and-route pipeline for post-retrieval failure recovery"로 정리한다.

# 모델 구조 또는 파이프라인 설명

시스템 관점에서 보면 이 논문은 두 모듈 조합이다.

1. hidden-state probe
   LLM 내부 representation을 읽어 현재 answer readiness를 추정한다.
2. prompt-based skill router
   실패 원인을 분류하고 corrective action을 선택한다.

여기서 중요한 것은 retrieval module 자체를 바꾸지 않는다는 점이다. BM25 기반 retriever 위에 붙는 control layer라서, 기존 RAG stack 위에 얹기 쉽다.

내가 실무 시스템으로 번역하면 다음처럼 본다.

- `probe`는 "지금 더 찾을 가치가 있는가"를 본다.
- `router`는 "찾는다면 어떤 방식으로 다시 찾을 것인가"를 본다.
- `exit`는 "그만 찾자"를 담당한다.

RAG에서 흔히 섞이는 세 가지 책임을 깔끔하게 분리한 셈이다.

# 실험 설정과 주요 결과 해석

## 데이터셋과 설정

- In-domain: NQ, TriviaQA, HotpotQA
- OOD test: MuSiQue, 2WikiMultiHopQA
- 평가 샘플: OOD는 각 500개
- retriever: BM25
- backbone models: Llama3-8B, Qwen3-8B, Gemma2-9B
- metric: EM, Accuracy

여기서 흥미로운 점은 probe 학습은 in-domain 데이터로 하고, 진짜 차별점은 OOD multi-hop 세트에서 본다는 것이다. 저자들이 자신들의 방법이 "harder structural failures"에서 강하다는 주장을 실험 설계로 밀고 간 셈이다.

## Table 1: 메인 결과

논문이 가장 강하게 주장하는 표다.

- Llama3-8B에서는 HotpotQA에서만 DRAGIN과 single-step이 일부 지표를 앞선다.
- Qwen3-8B에서는 MuSiQue에서 Probing-RAG 대비 ACC +6.4, EM +5.3
- 같은 Qwen3-8B에서 2WikiMultiHopQA는 ACC +9.5, EM +6.4
- Gemma2-9B에서는 MuSiQue ACC +6.1, 2WikiMultiHopQA ACC +13.6

내 해석은 이렇다.

1. in-domain에서는 "조금 더 좋거나 비슷한" 정도다.
2. 진짜 차이는 OOD multi-hop에서 난다.
3. 따라서 이 논문은 평균적 open-domain QA 개선보다 `distribution shift + structural reasoning failure` 복구에 더 특화돼 있다.

즉 production에서 가장 값비싼 실패 구간에 성능을 쓰는 방법이다.

## Figure 2: hidden-state geometry

Figure 2는 이 논문의 가장 인상적인 그림이다. 표보다 이 그림이 더 중요한 이유는, 저자들이 skill vocabulary를 그냥 heuristic으로 고른 게 아니라 failure state가 실제 representation space에서 어느 정도 분리된다고 주장하기 때문이다.

- 기본 retrieval 3회 후에도 틀린 케이스를 t-SNE로 투영하면 두 클러스터가 나온다.
- re-retrieval만 하면 일부만 이동한다.
- 4-skill vocabulary를 넣으면 왼쪽 실패 클러스터가 상당히 줄어든다.
- 반대로 6개 이상 auto-generated skill로 늘리면 클러스터 구조가 무너진다.

저자 해석은 명확하다. 너무 많은 skill은 오히려 failure space의 구조를 흐린다. 나는 이 결과를 "skill taxonomy는 많을수록 좋은 게 아니다"라는 실용적 힌트로 읽었다.

## Figure 3: 효율과 skill 분포

Figure 3A에서 retrieval rounds가 모든 데이터셋에서 줄어든다.

- NQ: 1.38 -> 1.30
- TriviaQA: 1.30 -> 1.24
- HotpotQA: 1.62 -> 1.55
- MuSiQue: 2.05 -> 1.78
- 2Wiki: 1.85 -> 1.58

in-domain 절감은 작지만, OOD에서는 0.27 round씩 줄인다. round가 0.27 줄었다는 숫자 자체보다 중요한 건 `더 많이 틀리는 질문에서 오히려 retrieval도 덜 태운다`는 점이다.

Figure 3B는 dataset별 어떤 skill이 많이 쓰이는지도 보여준다.

- NQ는 query rewrite 40%, evidence focusing 35%
- TriviaQA는 rewrite 45%
- HotpotQA는 decomposition 45%
- MuSiQue는 decomposition 48%, exit 22%
- 2Wiki도 decomposition 45%

이 부분이 좋았다. skill distribution 자체가 데이터셋의 질문 구조와 맞물린다. 즉 router가 적어도 무작위로 행동하는 것은 아니다.

## Table 2: exit skill trade-off

Table 2는 hard case만 따로 떼어 `exit`가 쓸 만한지 본다.

- Qwen3-8B가 exit를 가장 자주 고른다: 23.1%
- Gemma2-9B: 21.9%
- Llama3-8B: 19.8%
- OOD에서 exit 비율이 더 높고, MuSiQue는 28%까지 간다.

trade-off도 꽤 현실적이다.

- accuracy는 exit 제거 버전 대비 0.5~0.6pt 손해
- 대신 stopped query당 retrieval round 1.38~1.42 절약

이건 production cost 관점에서 충분히 고민할 가치가 있다. 특히 long-context search 비용이 큰 엔터프라이즈 RAG라면 accuracy 0.5pt와 search round 1.4회의 교환은 도메인에 따라 이득일 수 있다.

## Appendix Table 3: 케이스 스터디

개인적으로는 Appendix의 사례가 꽤 설득력 있었다. "1518 dancing plague victims suffered from what disease?" 류 질문에서 Probing-RAG는 query drift로 계속 엇나가고, Skill-RAG는 query misalignment로 진단한 뒤 "victims physical exhaustion consequences" 쪽으로 rewrite해서 정답 `exhaustion`을 찾는다.

이 예시는 논문 주장 전체를 잘 압축한다. failure를 `더 찾자`가 아니라 `다르게 찾자`로 바꿨다.

# 표와 그림에서 중요한 포인트

## Figure 1

논문의 설계도가 전부 들어 있다. probe가 sufficiency를 판단하고, failure 시 router가 corrective skill을 고르는 구조를 한 장으로 보여준다. LangGraph로 옮기면 거의 그대로 state machine이 된다.

## Table 1

정량적 핵심은 OOD multi-hop에서의 큰 이득이다. 이 논문을 단순 adaptive RAG 논문으로 읽으면 안 되고, `failure recovery policy` 논문으로 읽는 편이 맞다.

## Figure 2

skill 수를 무작정 늘리는 게 아니라 failure representation space의 구조에 맞춰 적당한 vocabulary를 잡아야 한다는 메시지가 담겨 있다.

## Figure 3

정확도만 올린 게 아니라 retrieval round를 줄였다는 점에서, routing이 cost control 정책으로도 작동함을 보여준다.

# 헷갈리거나 추가 확인이 필요한 부분

읽으면서 몇 군데는 더 확인하고 싶었다.

1. `prompt-based skill router without additional LLM calls`라는 표현이 약간 모호하다.
   같은 backbone 호출 안에서 처리한다는 뜻인지, 별도 routing forward가 없는 건지 문장이 완전히 투명하진 않다.
2. probe threshold `tau` calibration 절차가 본문에 자세히 드러나지 않는다.
   도메인별 threshold 민감도가 큰데, 이 부분이 운영에서 중요하다.
3. retriever가 BM25 하나로 고정돼 있다.
   skill 자체는 query reformulation인데 dense/hybrid retriever 조합에서도 같은 이득이 유지될지 궁금하다.
4. hidden-state probe의 backbone별 전이성이 얼마나 되는지 더 보고 싶다.
   논문은 세 backbone으로 평가하지만, probe를 backbone별로 따로 학습하는지 deployment cost가 어느 정도인지 운영 관점 설명이 더 필요하다.

# 실무 적용 가능성

실무 적용 가능성은 높다. 특히 아래 상황에서 그렇다.

- multi-hop 성격 질문이 많다.
- 검색 결과는 "관련 있어 보이는데" 답이 자주 틀린다.
- query rewrite, decomposition, citation repair 같은 후처리 체인을 이미 운영 중이다.
- retrieval budget을 통제해야 한다.

실제 서비스에서 바로 가져갈 수 있는 포인트는 세 가지다.

1. retrieval failure taxonomy를 명시한다.
   단순 miss/hit가 아니라 rewrite, decomposition, refocus, stop을 상태로 둔다.
2. exit를 first-class action으로 취급한다.
   계속 찾는 대신 fail-fast 또는 human handoff가 가능해진다.
3. hidden-state probe가 부담되면 초기엔 observable proxy로 대체한다.
   groundedness score, answer grader, reranker margin, retrieval overlap 같은 값으로 probe 자리를 먼저 흉내 낼 수 있다.

# 직접 구현한다면 어떤 구조로 만들지

내가 구현한다면 논문을 그대로 복제하기보다 다음 형태로 만든다.

## 오프라인

1. production query에서 retrieval 실패 사례를 수집한다.
2. 실패 원인을 `rewrite / decompose / refocus / stop`으로 라벨링한다.
3. backbone hidden state를 저장할 수 있으면 probe를 학습한다.
4. 어렵다면 probe 대신 grader ensemble을 만들어 failure gate로 쓴다.

## 온라인

```text
query
  -> domain router
  -> initial retriever
  -> answer draft
  -> failure gate
  -> if fail: skill router
  -> corrected retrieval action
  -> regenerate
  -> stop / handoff / continue
```

여기서 논문보다 내가 추가하고 싶은 것은 `domain router`다. enterprise RAG는 보통 문서군이 여러 개라서, query rewrite 이전에 어느 corpus를 볼지부터 자주 틀린다.

# LangChain, LangGraph, RAG 시스템에 적용할 수 있는 아이디어

## LangChain

- `RunnableBranch`로 `answer-direct / retrieve / rewrite / decompose / stop`을 분기할 수 있다.
- retriever wrapper에 `failure_reason`과 `skill_used` 메타데이터를 남기면 로그 분석이 쉬워진다.
- evaluator chain을 붙여 probe 대체 신호를 만들 수 있다.

## LangGraph

이 논문은 LangGraph에 특히 잘 맞는다. 거의 그대로 state graph로 옮길 수 있다.

```text
START
  -> answer_or_retrieve_gate
  -> retrieve
  -> generate
  -> failure_probe
  -> if sufficient: END
  -> if failed: skill_router
  -> rewrite_or_decompose_or_refocus_or_exit
  -> retrieve
```

state에는 다음 필드를 두면 된다.

- `retrieval_round`
- `failure_reason`
- `skill_history`
- `selected_domain`
- `sufficient_context`
- `handoff_required`

## 멀티도메인 RAG

`Skill-RAG`를 멀티도메인에 확장하면 아래 2단 라우팅이 자연스럽다.

1. domain router
   어느 corpus 또는 collection을 볼지 정한다.
2. failure-aware skill router
   선택된 domain 안에서 rewrite, decompose, refocus, exit를 고른다.

이렇게 하면 domain misroute와 retrieval misalignment를 분리해서 추적할 수 있다.

# 한계와 비판

내 기준에서 이 논문의 한계도 분명하다.

1. retriever 다양성이 약하다.
   BM25 하나로 correction skill의 효과를 보여줬기 때문에, dense/hybrid/graph 조합에서 얼마만큼 유지될지는 아직 모른다.
2. skill router가 prompt-driven이다.
   failure taxonomy가 바뀌면 prompt engineering과 calibration 부담이 다시 생긴다.
3. probe 학습 데이터 수집 비용이 숨겨져 있다.
   reasoning trace와 hidden state 저장, backbone별 학습, threshold tuning은 생각보다 운영 난도가 있다.
4. 평가가 QA 중심이다.
   enterprise RAG에서 많은 extraction, summarization, policy QA, SQL hybrid QA에선 다른 failure mode가 나타날 수 있다.
5. 지나치게 skill을 늘리면 geometry가 무너진다는 결과는 흥미롭지만, 반대로 "4개가 항상 최적"이라는 뜻은 아니다.
   도메인별 failure space에 맞춘 재설계가 필요하다.

# 읽고 난 뒤의 내 생각

이 논문을 읽고 가장 크게 남은 문장은 "검색 실패는 정보 부족이 아니라 정렬 실패일 수 있다"는 점이다.

실무에서는 retrieval hit rate나 reranker score를 열심히 보는데, 사용자가 체감하는 실패는 보통 "관련 문서를 가져왔는데도 답이 틀림"이다. `Skill-RAG`는 바로 그 불편한 지점을 제대로 겨냥한다.

그리고 이 논문은 agentic RAG를 과장하지 않는다. 거대한 multi-agent orchestra를 만들기보다, 정말 필요한 제어만 남긴다.

- 지금 그만 답해도 되는가
- 더 찾는다면 어떤 방식으로 찾아야 하는가
- 더 찾아도 안 풀리는가

이 세 질문이 production RAG 제어의 핵심인데, 논문은 이를 비교적 단정한 형태로 정리했다.

내 연구 방향으로 이어서 해보고 싶은 것은 두 가지다.

1. hidden-state probe 없이도 쓸 수 있는 작은 failure gate 만들기
   1B 이하 router나 non-parametric grader로 대체 가능한지
2. domain routing과 skill routing 결합하기
   `wrong corpus`와 `wrong retrieval action`을 분리해서 교정 가능한지

# 블로그용 짧은 요약 초안

`Skill-RAG`는 adaptive RAG를 한 단계 더 밀어 붙인 논문이다. 검색이 필요한지 여부만 판단하는 대신, retrieval 이후에도 왜 실패했는지를 hidden-state probe로 감지하고, query rewrite, question decomposition, evidence focusing, exit 중 하나를 선택해 복구한다. 특히 MuSiQue, 2Wiki 같은 OOD multi-hop QA에서 gains가 크고, retrieval round도 함께 줄여서 실무적 가치가 높다. 내 기준 핵심 메시지는 "더 찾을까?"보다 "다르게 찾을까?"다.

# 참고 링크

- [Skill-RAG: Failure-State-Aware Retrieval Augmentation via Hidden-State Probing and Skill Routing](https://arxiv.org/abs/2604.15771)
- [Skill-RAG HTML 버전](https://arxiv.org/html/2604.15771v4)
- [Route Before Retrieve: Activating Latent Routing Abilities of LLMs for RAG vs. Long-Context Selection](https://arxiv.org/abs/2605.10235)
- [Continual Model Routing in Evolving Model Hubs](https://arxiv.org/abs/2605.28577)
- [R3AG: Retriever Routing for Retrieval-Augmented Generation](https://arxiv.org/abs/2604.22849)
- [Grounded Cache Routing for Retrieval-Augmented Generation: When Is It Safe to Reuse an Answer?](https://arxiv.org/abs/2605.27494)
- [Cost-Aware Query Routing in RAG: Empirical Analysis of Retrieval Depth Tradeoffs](https://arxiv.org/abs/2606.02581)
- [Lightweight Chunk Selection for Mobile Retrieval-Augmented Generation](https://arxiv.org/abs/2608.03148)
- [Google Research: Unlocking dependable responses with Gemini Enterprise Agent Platform’s Agentic RAG](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/)
