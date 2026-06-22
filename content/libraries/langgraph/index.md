---
title: LangGraph
---

# LangGraph

LangGraph는 상태를 가진 workflow와 agent를 그래프 형태로 설계하면서도, 세밀한 제어 흐름을 유지할 수 있게 해 주는 라이브러리다.

처음에는 `StateGraph`, `Command`, `interrupt`, `checkpointer`처럼 자주 마주치는 기본 도구부터 익히고, 이후에는 `Send`, subgraph, durable execution 같은 패턴으로 확장해 가는 흐름이 실전에서 가장 자연스럽다.

## 글 목록

### Foundations

- [[libraries/langgraph/checkpointer-persistence-threads|checkpointer로 thread 상태를 저장하고 같은 ID로 이어서 실행하기]]
- [[libraries/langgraph/store-cross-thread-long-term-memory|store로 cross-thread 장기 메모리 붙이기]]
- [[libraries/langgraph/add-messages-chat-history|add_messages로 채팅 히스토리를 안전하게 누적·교체·삭제하기]]
- [[libraries/langgraph/reducers-parallel-state-merges|reducer로 병렬 state update 안전하게 합치기]]
- [[libraries/langgraph/interrupt-human-approval-resume|interrupt()로 사람 승인 대기 후 Command(resume=...)로 재개하기]]
- [[libraries/langgraph/command-routing-state-updates|Command로 상태 업데이트와 라우팅을 한 번에 처리하기]]
- [[libraries/langgraph/input-output-private-state-schemas|input_schema, output_schema, private state로 공개 입력과 내부 상태 분리하기]]
- [[libraries/langgraph/functional-api-entrypoint-task-workflows|Functional API에서 @entrypoint와 @task로 replay-safe workflow 만들기]]
- [[libraries/langgraph/toolnode-command-state-updates|ToolNode로 tool 결과와 state 업데이트 함께 반영하기]]

### Runtime & Reliability

- [[libraries/langgraph/retry-policy-node-retries|RetryPolicy로 일시 실패 노드만 안전하게 재시도하기]]
- [[libraries/langgraph/error-handler-recovery-routing|error_handler로 실패 후 보상 흐름과 대체 경로 만들기]]
- [[libraries/langgraph/cache-policy-node-caching|cache_policy로 비싼 노드 결과 재사용하기]]
- [[libraries/langgraph/deferred-node-cleanup-finalizers|defer=True로 cleanup, audit, notification을 run 마지막으로 미루기]]
- [[libraries/langgraph/graceful-shutdown-runcontrol-resume|RunControl로 graceful shutdown 후 안전하게 재개하기]]
- [[libraries/langgraph/recursion-limit-remaining-steps|recursion_limit과 RemainingSteps로 루프 안전장치 두기]]
- [[libraries/langgraph/stream-mode-updates-messages-custom|stream()으로 updates, messages, custom 이벤트 흘려보내기]]
- [[libraries/langgraph/time-travel-replay-fork|time travel로 체크포인트 replay와 fork 디버깅하기]]

### Composition Patterns

- [[libraries/langgraph/send-dynamic-parallelism|Send로 동적 병렬 fan-out/map-reduce 처리하기]]
- [[libraries/langgraph/subgraph-persistence-modes-state-inspection|subgraph에서 checkpointer=None, True, False를 어떻게 고를까]]
- [[libraries/langgraph/subgraph-parent-handoff|subgraph에서 Command.PARENT로 부모 그래프로 handoff하기]]
