---
title: "WISERouter: LLM Routing with Workload Budget Constraint"
description: workload-level budget 아래에서 작은 모델과 큰 모델을 어떻게 섞어 쓸지, WISERouter의 라우팅 설계와 실무 적용 포인트를 정리한 리뷰 노트
date: 2026-08-02
tags:
  - paper-review
  - llm
  - routing
  - rag
  - langgraph
author: "Yifei Li, Zihui Gao, Laks V.S. Lakshmanan"
journal: "arXiv"
paper: https://arxiv.org/abs/2607.23765
aliases:
  - /papers/llm/wiserouter-llm-routing-with-workload-budget-constraint
  - /papers/wiserouter-llm-routing-with-workload-budget-constraint
---

# 한줄 요약

작은 모델과 큰 모델을 섞어 쓰는 문제를 "질문마다 얼마를 쓸지"가 아니라 "이번 달 전체 워크로드 예산 안에서 어떤 질문에 큰 모델을 써야 하는가"로 다시 정의한 라우터 논문이다.

## 논문 메타데이터

- 제목: WISERouter: LLM Routing with Workload Budget Constraint
- 저자: Yifei Li, Zihui Gao, Laks V.S. Lakshmanan
- 기관: The University of British Columbia
- 링크: [arXiv 2607.23765](https://arxiv.org/abs/2607.23765)
- 공개일: 2026-07-26

## 이번 주 후보 논문 / 공식 연구 글

1. [WISERouter: LLM Routing with Workload Budget Constraint](https://arxiv.org/abs/2607.23765)
   워크로드 수준 예산 제약, offline/online 두 모드, bandit 정식화까지 갖춰서 이번 주 후보 중 실무성과 연구성이 가장 균형이 좋았다.
2. [TRACE-Router: Task-Consistent and Adaptive Online Routing for Agentic AI](https://arxiv.org/abs/2607.22465)
   에이전트 태스크 단위 라우팅이라는 문제 정의가 좋았지만, 현재 내 블로그 흐름에서는 범용 라우터 설계보다 agent benchmark 중심 해석 비중이 더 컸다.
3. [Continual Model Routing in Evolving Model Hubs](https://arxiv.org/abs/2605.28577)
   모델 허브가 계속 바뀌는 운영 환경을 다룬 점은 강했지만, 이번 주 글 한 편으로 풀기에는 benchmark와 continual learning 설정 설명 비중이 컸다.
4. [Route Before Retrieve: Activating Latent Routing Abilities of LLMs for RAG vs. Long-Context Selection](https://arxiv.org/abs/2605.10235)
   RAG vs long-context 선택 문제와 소형 모델 distillation이 매력적이었고 다음 후보로 남겨둘 만하다. 다만 이번에는 더 일반적인 multi-LLM budget router를 먼저 정리하는 편이 우선이었다.
5. [Grounded Cache Routing for Retrieval-Augmented Generation: When Is It Safe to Reuse an Answer?](https://arxiv.org/abs/2605.27494)
   캐시 재사용을 "언제 안전한가"로 바꾼 점이 매우 실용적이지만, 범위가 answer cache safety로 좁아서 이번 주 메인 리뷰보다는 후속 RAG 운영 글에 더 어울린다.
6. [RAGRouter-Bench: A Dataset and Benchmark for Adaptive RAG Routing](https://arxiv.org/abs/2602.00296)
   adaptive RAG routing의 벤치마크 기준점으로 가치가 크지만, 새로운 방법론보다 평가 프레임 성격이 강하다.
7. [Adaptive Re-Ranking](https://arxiv.org/abs/2606.25249)
   검색 파이프라인 내부에서 비용 기반 라우팅을 건드린다는 점은 좋았지만, LLM/router 관점의 블로그 방향성과는 한 단계 떨어져 있었다.
8. [Unlocking dependable responses with Gemini Enterprise Agent Platform’s Agentic RAG](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/)
   공식 연구 글이라 실서비스 구조 감각을 주지만, 논문형 분석 대상으로는 정량 설정과 ablation 깊이가 상대적으로 얕다.

## 최종 선정 이유

이번 주에는 "작은 모델 라우터"와 "실제 운영 예산"을 가장 직접적으로 연결하는 글을 고르고 싶었다. WISERouter는 단순히 분류기로 모델을 고르는 수준이 아니라, 남은 예산과 남은 트래픽 길이를 함께 고려해 매 질의 시점에 라우팅 확률을 다시 푼다. 이 점이 실제 SaaS형 LLM 서비스, 사내 assistant, 문서 QA, code agent, RAG gateway 전부에 바로 옮겨갈 수 있다.

또 하나 좋았던 점은 online setting까지 포함했다는 것이다. 현실에서는 모든 질의에 대해 모든 모델의 정답 품질과 비용을 미리 모아두기 어렵다. 논문은 이 문제를 WR-Online으로 확장하고, exploration 비용까지 같은 예산 안에 넣는다. "학습비는 따로, 서빙비는 따로"가 아니라 "둘 다 같은 월간 예산에서 나간다"는 감각이 매우 현실적이다.

## 논문이 풀려는 문제

논문이 겨냥하는 문제는 명확하다.

- 모든 요청을 가장 강한 모델로 보내면 품질은 좋지만 비용이 너무 비싸다.
- 모든 요청을 작은 모델로 보내면 싸지만 어려운 질의에서 품질이 급격히 떨어진다.
- 기존 라우터는 보통 질의 단위의 local decision을 잘 하더라도, 월간/일간 워크로드 전체 예산을 직접 다루지 못한다.

즉 질문은 "이 질의가 어려운가?"가 아니라, "지금 남은 예산과 앞으로 남은 요청 수를 감안할 때 이 질의에 비싼 모델을 써도 되는가?"다.

## 기존 방법의 한계

논문이 지적하는 기존 방법의 한계는 크게 두 가지다.

### 1. per-query budget은 workload budget을 대체하지 못한다

FrugalGPT류 cascade나 일부 bandit 방법은 질의 하나당 얼마까지 쓸지를 제어한다. 하지만 실제 운영 제약은 월간 토큰 예산, 팀 구독 비용, 일일 API quota처럼 워크로드 전체에 걸쳐 있다. 쉬운 질의에는 아껴 쓰고 어려운 질의에 몰아주는 allocation이 되어야 하는데, per-query constraint는 이 유연성을 주지 못한다.

### 2. dense supervision이 너무 비싸다

많은 라우터는 학습 전에 모든 질의-모델 조합의 응답과 비용을 수집해야 한다. 후보 모델이 많아질수록 이 비용은 바로 폭증한다. 작은 모델 라우터를 만들려고 더 큰 labeling bill을 내는 셈이다.

## 핵심 아이디어

WISERouter의 핵심은 LLM routing을 constrained contextual bandit로 바꾸는 것이다.

- context: 질의 임베딩
- action: 어떤 모델에 보낼지
- reward: 선택된 모델의 품질 점수
- cost: 선택된 모델의 비용

목표는 총 reward를 최대화하되, 기대 총 cost가 예산 `B`를 넘지 않게 하는 것이다.

여기서 중요한 포인트는 budget을 정적으로 한 번 나누지 않는다는 점이다. 남은 budget `b`와 남은 라운드 `tau`를 매 시점 다시 보고, `b / tau`라는 현재 시점의 평균 허용 비용으로 선형계획을 다시 푼다. 논문은 이 부분을 Adaptive Linear Programming, ALP로 구현한다.

## 방법론 상세 설명

### 1. 연속 질의 공간을 이산 context로 바꾼다

ALP는 finite context space를 가정하므로, 먼저 질의를 임베딩한 뒤 clustering해서 `J`개의 context bucket으로 바꾼다. 논문에서는 pretrained encoder로 질의를 임베딩한 뒤 K-means로 군집화하고, 들어오는 질의를 가장 가까운 centroid에 붙인다.

이 설정은 꽤 pragmatic하다.

- 모델이 query semantics에 따라 다르게 강점을 보인다는 가정
- 같은 cluster 안에서는 reward/cost 평균이 비슷하다는 가정
- context distribution `pi_j`를 과거 로그에서 추정할 수 있다는 가정

논문 appendix에서 `J=16`일 때 intra-cluster variance가 크게 흔들리지 않고, OpenAI `text-embedding-3-small`과 Qwen3 embedding 둘 다 큰 차이 없이 동작했다고 보여준다. 즉 핵심은 fancy encoder보다 "query를 몇 개의 예산-품질 region으로 거칠게 나눌 수 있느냐"에 더 가깝다.

### 2. WR-Offline: 로그가 충분할 때

과거 데이터가 충분하면 각 `(context, model)` 쌍에 대해 평균 reward `u_hat`와 평균 cost `c_hat`를 계산해 둔다. 그 다음 실제 서빙에서는 매 요청마다 아래 문제를 푼다.

- 현재 남은 예산 `b`
- 남은 요청 수 `tau`
- 현재 질의가 속한 context `j`

이 셋을 가지고 `LP_(tau,b)`를 풀어, context별 모델 선택 확률 `p_(j,k)`를 얻는다. 그리고 그 확률에서 샘플링해 모델을 고른다. 포인트는 새 예산 수준이 들어와도 router를 다시 학습하지 않는다는 것이다. 통계량은 한 번 계산하고, 예산은 inference 시점에만 반영한다.

이 구조는 실무적으로 꽤 좋다.

- 가격표가 바뀌거나 팀 예산이 줄어도 retrain이 필요 없다.
- 월초/월말처럼 budget burn rate가 달라져도 같은 router를 쓸 수 있다.
- cost metric을 돈에서 latency로 바꾸는 확장도 자연스럽다.

### 3. WR-Online: 로그가 부족할 때

현실 문제는 모든 `(질의, 모델)` 조합 로그가 없다는 것이다. WR-Online은 exploration과 exploitation을 같은 budget 안에 넣는다.

- exploration 단계: 각 context 안에서 덜 호출된 모델을 우선 호출해 reward/cost 평균을 채운다.
- exploitation 단계: 추정된 평균값으로 다시 ALP를 푼다.

저자가 강조하는 기여는 여기에 있다. 보통 online router 논문은 exploration을 별도 비용처럼 취급하거나, regret analysis가 deployment 구간만 덮는 경우가 많다. 이 논문은 exploration 비용도 예산에서 빠지는 현실적인 setting을 그대로 유지한다.

## 모델 구조 또는 파이프라인 설명

내가 이해한 전체 파이프라인은 아래와 같다.

1. 사용자 질의를 임베딩한다.
2. 임베딩을 가장 가까운 cluster에 할당한다.
3. 현재 남은 budget과 남은 요청 수를 읽는다.
4. 해당 context에서 각 모델의 예상 reward/cost를 조회한다.
5. ALP를 풀어 현재 시점의 선택 확률을 계산한다.
6. 모델을 하나 선택해 호출한다.
7. budget 상태를 갱신한다.
8. online 모드면 실제 reward/cost 통계도 갱신한다.

중요한 해석은 "router가 매번 정답 모델 하나를 hard classify하는 구조"가 아니라는 점이다. 남은 예산 상태에 따라 같은 context에서도 확률 배치가 달라진다. 그래서 이 논문은 classifier보다는 budget-aware policy에 가깝다.

## 실험 설정과 주요 결과 해석

### 데이터셋

- RouterBench: 36,497개 질의, 10개 모델, 8개 데이터셋(MMLU, HellaSwag, GSM8k, ARC Challenge, Winogrande, MBPP, MT-Bench, RAG)
- SWE-Bench verified subset: 5개 SWE-agent 계열 모델

RouterBench는 일반 질의 라우팅 감각을 보기 좋고, SWE-Bench는 더 고비용의 agent/code setting이라 예산 제어 중요성이 크게 드러난다.

### 주요 결과

#### 1. tight budget에서 강하다

논문은 WR-Offline이 low-to-mid budget에서 baseline을 일관되게 이기거나 최소한 맞춘다고 보고한다. 특히 SWE-Bench의 가장 빡빡한 budget에서 best baseline 대비 평균 품질이 14% 높았다. 이 수치는 "budget을 빡빡하게 줄수록 adaptive allocation의 가치가 커진다"는 메시지를 준다.

#### 2. budget utilization이 좋다

Figure 3에서 저자들은 남은 budget 비율을 본다. WR-Offline은 거의 0에 가깝게 쓰면서 overspend를 피한다. 반대로 static LP 변형은 SWE-Bench에서 5% 이상 예산을 초과했다. 논문에서 정말 중요한 그림은 성능 그래프보다 이 budget utilization 그림이라고 본다. 실제 운영에서는 1~2% overspend도 월간 예산에서는 크게 번질 수 있기 때문이다.

#### 3. retraining cost가 거의 없다

Table 2에서 WR-Offline training latency는 CPU에서 1.50초, FrugalGPT는 GPU에서 `8.85 x 10^3`초 수준이다. 논문은 이를 5,900배 이상 빠르다고 요약한다. 이건 "더 좋은 router"라기보다 "예산 구간이 바뀔 때마다 다시 fitting하지 않아도 되는 router"라는 의미다.

#### 4. online 학습 데이터 요구량이 작다

WR-Online은 RouterBench에서 single pass exploration만으로 offline 방법에 근접한 성능에 도달하며, 논문은 데이터 수집 비용을 90% 줄였다고 보고한다. 내가 보기에 이 결과는 절대 성능보다도 cold-start 운영에 더 의미가 있다. 새 product launch 초기에는 로그가 적고, budget은 오히려 더 민감하기 때문이다.

## 표와 그림에서 중요한 포인트

### Figure 1

이 그림은 기존 방법과 WISERouter를 두 축으로 비교한다.

- workload-level budget을 직접 다루는가
- sparse supervision에서도 학습 가능한가

논문의 위치 선정이 꽤 명확해서, 이후 routing literature를 읽을 때 기준 좌표축으로 쓰기 좋다.

### Figure 3

남은 budget 비율을 보는 그림인데, 사실상 이 논문의 핵심 운영 그림이다. 성능만 보면 baseline과 비슷해 보일 수 있어도, budget을 얼마나 정확히 다루는지에서 차이가 난다.

### Figure 5

WR-Online이 exploration 이후 exploitation으로 넘어가면서 offline 성능에 근접하는 흐름을 보여준다. 여기서 중요한 메시지는 "dense supervision이 항상 필요하지 않다"는 것이다.

### Table 2

학습/추론 latency 비교가 들어 있다. WR-Offline이 budget마다 재학습하지 않아도 되기 때문에 운영 전환 비용이 작다.

### Table 6

exploration으로 추정한 reward/cost가 ground truth와 얼마나 맞는지 보여준다. RouterBench에서 reward Pearson `0.997`, cost Pearson `1.000`은 꽤 인상적이다. SWE-Bench는 reward `0.896`, cost `0.941`로 더 어렵지만, 그래도 exploitation에 쓸 정도로 방향성은 복원된다고 볼 수 있다.

## 헷갈리거나 추가 확인이 필요한 부분

- reward 정의가 task마다 다르다. 운영 환경에 넣으려면 어떤 품질 함수를 쓸지 먼저 고정해야 한다.
- context를 i.i.d.로 보는 가정은 세션형 assistant나 bursty traffic에서 쉽게 깨질 수 있다.
- expected cost로 budget을 갱신하는 방식은 variance가 큰 pricing 환경에서 얼마나 안정적인지 더 보고 싶다.
- cluster 기반 근사에서 rare but critical query가 작은 군집으로 뭉개질 가능성은 남아 있다.

## 실무 적용 가능성

이 논문은 바로 운영 구조로 옮길 수 있다. 특히 아래 상황에 잘 맞는다.

- `mini` / `standard` / `reasoning` 모델을 섞어 쓰는 API gateway
- 문서 QA에서 쉬운 factoid는 소형 모델, 복합 reasoning은 대형 모델로 보내는 RAG router
- code assistant에서 간단한 변환은 저가 모델, repo-wide reasoning은 고가 모델로 보내는 계층형 serving
- 팀/고객별 월간 예산 한도가 있는 SaaS

논문에서 cost를 money로 두었지만, 실제로는 아래처럼 다목적 budget으로 확장할 수 있다.

- money
- latency
- GPU seconds
- retrieval depth
- tool invocation 횟수

## 직접 구현한다면 어떤 구조로 만들지

내가 직접 만든다면 라우터를 아래 4개 계층으로 나눌 것 같다.

### 1. feature layer

- query embedding
- 짧은 handcrafted metadata
  - 질문 길이
  - 코드/비코드
  - retrieval 필요 여부
  - user tier

### 2. context layer

- offline K-means cluster
- cluster별 traffic prior 추정
- drift 감지를 위한 cluster hit ratio 모니터링

### 3. policy layer

- `(context, model)`별 reward/cost 통계 테이블
- 남은 budget / 남은 horizon 입력
- ALP solver
- fallback rule
  - budget 임계치 이하일 때 소형 모델 강제
  - high-risk query tag가 있으면 대형 모델 하한선 보장

### 4. feedback layer

- answer quality proxy 수집
  - explicit thumbs up/down
  - judge model score
  - downstream success
- 실제 token cost와 latency 기록
- online mean update

핵심은 라우터를 "학습된 classifier"로만 두지 않고, "통계 테이블 + policy solver" 형태로 만드는 것이다. 그래야 운영자가 예산 정책을 바꿀 수 있다.

## LangChain, LangGraph, RAG 시스템에 적용할 수 있는 아이디어

### LangChain

- `wrap_model_call` middleware 안에서 query embedding을 만든다.
- state나 request context에 `remaining_budget`, `remaining_horizon`, `user_tier`를 넣는다.
- router policy가 model을 결정한 뒤 실제 chat model binding을 바꾼다.

### LangGraph

- 그래프 앞단에 `budget_router` 노드를 둔다.
- 이 노드가 `selected_model`, `retrieval_depth`, `tool_budget`를 state에 써 준다.
- 이후 generation node, retrieval node가 같은 state를 읽어 동작한다.

내가 특히 해보고 싶은 건 model routing과 retrieval routing을 분리하지 않는 구조다. 예를 들면:

- 쉬운 질문: small model + shallow retrieval
- 중간 질문: medium model + top-k 5 retrieval
- 어려운 질문: large model + iterative retrieval + verifier

즉 WISERouter의 action을 "모델 하나"가 아니라 "모델 + retrieval bundle"로 넓히면, 실제 RAG policy engine으로 바로 확장된다.

## 한계와 비판

이 논문이 강한 만큼 약점도 분명하다.

### 1. representation quality를 거의 외생 변수로 둔다

결정 품질의 상당 부분이 embedding과 clustering에 달려 있는데, 본문에서는 이 부분을 상대적으로 얕게 다룬다. query semantics가 복잡한 production traffic에서는 이게 병목이 될 수 있다.

### 2. reward observability가 낙관적이다

실험에서는 reward가 비교적 잘 정의된다. 하지만 실제 서비스에서는 품질 레이블이 느리게 오거나 거의 안 온다. WR-Online을 운영에 넣으려면 judge model, human feedback, business KPI 같은 noisy proxy를 써야 한다.

### 3. benchmark 규모와 모델 풀이 아직 제한적이다

RouterBench 10개 모델, SWE-Bench 5개 모델은 논문 주장을 보이기엔 충분하지만, 실제 multi-vendor production hub까지 일반화하려면 더 큰 pool에서 봐야 한다.

### 4. action이 single-shot model pick에 머문다

현실 agent/RAG 시스템은 retrieval depth, tool use, verifier 호출까지 함께 결정해야 한다. 이 논문은 좋은 출발점이지만 아직 full pipeline policy로는 확장 전 단계다.

## 읽고 난 뒤의 내 생각

이 논문을 읽고 가장 크게 남은 건 "라우터를 classifier로만 보지 말자"는 점이었다. 많은 routing 구현이 결국 difficulty classifier를 하나 학습해서 threshold로 model id를 뱉는 형태인데, 운영에서 진짜 어려운 건 difficulty 분류보다 budget allocation이다.

또 하나는 small model strategy를 다시 생각하게 만든다는 점이다. 작은 모델을 잘 쓰는 문제는 단순히 작은 모델 성능을 끌어올리는 문제가 아니라, 어느 요청까지 작은 모델에게 맡길지를 policy로 푸는 문제다. 이 policy가 없으면 mini 모델을 도입해도 비용 절감이 생각보다 잘 안 난다.

RAG 관점에서도 배울 점이 있다. 현재 많은 RAG 시스템은 `retrieval on/off`, `top-k`, `reranker on/off`, `judge on/off`를 규칙 기반으로 붙인다. 그런데 이들도 결국 비용이 있는 action이다. WISERouter의 틀을 가져오면 "모델 선택"뿐 아니라 "RAG 경로 선택"도 같은 budget-aware policy로 재해석할 수 있다.

## 블로그용 짧은 요약 초안

WISERouter는 작은 모델과 큰 모델을 섞어 쓰는 문제를 단순 분류가 아니라 예산 배분 문제로 본다. 핵심은 현재 질의만 보지 않고, 남은 예산과 남은 요청 수를 함께 보면서 어떤 질의에 비싼 모델을 쓸지 결정한다는 점이다.

논문은 이 문제를 constrained contextual bandit로 정식화하고, query embedding을 cluster로 이산화한 뒤 Adaptive Linear Programming으로 매 요청마다 정책을 다시 푼다. 로그가 충분한 offline setting과, exploration 비용까지 같은 예산 안에 넣는 online setting을 모두 다뤘다는 점이 특히 좋다.

실험에서는 tight budget에서 baseline보다 더 높은 품질을 내고, static policy보다 예산 위반을 줄이며, online 모드에서는 dense supervision 없이도 성능을 따라간다. LangChain이나 LangGraph에 적용한다면 model choice뿐 아니라 retrieval depth, verifier 호출, tool budget까지 하나의 policy로 묶는 쪽이 가장 흥미롭다.

## 참고 링크

- [arXiv: WISERouter](https://arxiv.org/abs/2607.23765)
- [HTML 논문 본문](https://arxiv.org/html/2607.23765v1)
- [TRACE-Router](https://arxiv.org/abs/2607.22465)
- [Continual Model Routing in Evolving Model Hubs](https://arxiv.org/abs/2605.28577)
- [Route Before Retrieve](https://arxiv.org/abs/2605.10235)
- [Grounded Cache Routing](https://arxiv.org/abs/2605.27494)
- [RAGRouter-Bench](https://arxiv.org/abs/2602.00296)
- [Google Research: Agentic RAG](https://research.google/blog/unlocking-dependable-responses-with-gemini-enterprise-agent-platforms-agentic-rag/)
