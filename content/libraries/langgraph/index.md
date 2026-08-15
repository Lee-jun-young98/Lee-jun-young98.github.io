---
title: LangGraph
---

# LangGraph

LangGraph는 상태를 가진 workflow와 agent를 그래프 형태로 설계하면서도, 실행 제어 흐름을 눈에 보이게 유지할 수 있게 해 주는 라이브러리입니다.

처음에는 `StateGraph`, `Command`, `interrupt`, `checkpointer`처럼 자주 마주치는 기본 도구부터 익히고, 이후에는 `Send`, subgraph, durable execution 같은 패턴으로 확장해 가면 자연스럽습니다.

## 글 목록

### Foundations

- [[libraries/langgraph/conditional-entry-point-start-routing|conditional entry point로 입력별 시작 노드 바로 고르기]]
- [[libraries/langgraph/context-schema-runtime-context|context_schema와 Runtime context로 요청별 설정 주입하기]]

- [[libraries/langgraph/interrupt-validation-loop-conditional-edges|interrupt() 검증 루프를 while True 대신 conditional edge로 만들기]]

- [[libraries/langgraph/postgres-checkpointer-production|PostgresSaver로 durable checkpointer 운영하기]]
- [[libraries/langgraph/pydantic-state-validation-coercion|Pydantic state로 입력 검증과 자동 coercion 붙이기]]
- [[libraries/langgraph/store-semantic-search-memory|store semantic search로 장기 메모리 검색 붙이기]]
- [[libraries/langgraph/toolruntime-toolnode-state-store-context|ToolRuntime으로 ToolNode 안에서 state, store, context 모두 주입하기]]
- [[libraries/langgraph/checkpointer-persistence-threads|checkpointer로 thread 상태를 저장하고 같은 ID로 이어서 실행하기]]
- [[libraries/langgraph/command-resume-vs-dict-thread-inputs|기존 thread에 새 입력을 넣을 때는 dict를 쓰고, interrupt 재개에만 Command(resume=...) 쓰기]]
- [[libraries/langgraph/store-cross-thread-long-term-memory|store로 cross-thread 장기 메모리 붙이기]]
- [[libraries/langgraph/add-messages-chat-history|add_messages로 채팅 히스토리를 안전하게 추가하고 교체하고 제거하기]]
- [[libraries/langgraph/reducers-parallel-state-merges|reducer로 병렬 state update 안전하게 합치기]]
- [[libraries/langgraph/overwrite-bypass-reducers-reset-state|Overwrite로 reducer를 우회해 state를 리셋하기]]
- [[libraries/langgraph/interrupt-human-approval-resume|interrupt()로 사람 확인 대기 후 Command(resume=...)로 재개하기]]
- [[libraries/langgraph/parallel-interrupts-resume-map|병렬 interrupt를 ID 매핑으로 한 번에 재개하기]]
- [[libraries/langgraph/command-routing-state-updates|Command로 상태 업데이트와 라우팅을 한 번에 처리하기]]
- [[libraries/langgraph/input-output-private-state-schemas|input_schema, output_schema, private state로 공개 입력과 내부 상태 분리하기]]
- [[libraries/langgraph/functional-api-entrypoint-task-workflows|Functional API에서 @entrypoint와 @task로 replay-safe workflow 만들기]]
- [[libraries/langgraph/toolnode-command-state-updates|ToolNode로 tool 결과와 state 업데이트를 함께 반영하기]]

### Runtime & Reliability

- [[libraries/langgraph/max-concurrency-parallel-task-limits|max_concurrency로 병렬 task 동시 실행 수 제한하기]]
- [[libraries/langgraph/checkpoint-history-pagination-filter|checkpoint history를 filter, before, limit로 페이지네이션하기]]
- [[libraries/langgraph/task-checkpoint-debug-streaming|tasks와 checkpoints 스트림으로 실행 중 노드 진단하기]]
- [[libraries/langgraph/invoke-v2-graph-output-interrupts|invoke v2와 GraphOutput으로 결과와 interrupt 분리하기]]
- [[libraries/langgraph/store-ttl-memory-expiration|Store TTL로 장기 메모리 만료 정책 운영하기]]
- [[libraries/langgraph/async-nodes-ainvoke-event-loop|async 노드와 ainvoke로 I/O 병렬 처리하기]]
- [[libraries/langgraph/checkpoint-thread-retention-delete|checkpoint를 thread 단위로 보존하고 삭제하기]]
- [[libraries/langgraph/subgraph-streaming-v2-namespaces|subgraph 스트림을 v2 namespace로 라우팅하기]]
- [[libraries/langgraph/pending-writes-parallel-failure-resume|pending writes로 병렬 실패를 이어서 복구하기]]
- [[libraries/langgraph/state-snapshot-tasks-failure-diagnostics|StateSnapshot.tasks로 실패 노드 진단하기]]
- [[libraries/langgraph/graph-visualization-mermaid-png|graph를 Mermaid와 PNG로 시각화하기]]
- [[libraries/langgraph/encrypted-checkpoint-serializer|EncryptedSerializer로 checkpoint를 AES 암호화하기]]
- [[libraries/langgraph/set-node-defaults-graph-wide-fault-tolerance|set_node_defaults()로 retry, timeout, error_handler 기본값 한 번에 깔기]]
- [[libraries/langgraph/durability-modes-sync-async-exit|durability로 sync, async, exit를 언제 고를까]]
- [[libraries/langgraph/backward-compatibility-graph-migrations|backward compatibility로 in-flight thread 안 깨고 그래프 변경하기]]
- [[libraries/langgraph/static-breakpoints-interrupt-before-after|static breakpoint로 노드 전후 실행을 멈춰 되짚어보기]]
- [[libraries/langgraph/retry-policy-node-retries|RetryPolicy로 일시 실패 노드만 안전하게 재시도하기]]
- [[libraries/langgraph/runtime-execution-info-retry-fallbacks|runtime.execution_info로 재시도 차수별 fallback 분기하기]]
- [[libraries/langgraph/timeout-policy-node-timeouts|TimeoutPolicy로 느린 노드를 run_timeout, idle_timeout으로 끊기]]
- [[libraries/langgraph/error-handler-recovery-routing|error_handler로 실패 후 보상 흐름과 대체 경로 만들기]]
- [[libraries/langgraph/cache-policy-node-caching|cache_policy로 비싼 노드 결과 재사용하기]]
- [[libraries/langgraph/delta-channel-checkpoint-storage|DeltaChannel로 긴 thread checkpoint 크기 줄이기]]
- [[libraries/langgraph/deferred-node-cleanup-finalizers|defer=True로 cleanup, audit, notification을 run 마지막으로 미루기]]
- [[libraries/langgraph/graceful-shutdown-runcontrol-resume|RunControl로 graceful shutdown 후 안전하게 재개하기]]
- [[libraries/langgraph/recursion-limit-remaining-steps|recursion_limit와 RemainingSteps로 루프 안전장치 넣기]]
- [[libraries/langgraph/event-streaming-v3-projections|event streaming v3로 상태, 토큰, interrupt를 한 스트림에서 다루기]]
- [[libraries/langgraph/stream-mode-updates-messages-custom|stream()으로 updates, messages, custom 이벤트 흘려보내기]]
- [[libraries/langgraph/time-travel-replay-fork|time travel로 체크포인트 replay와 fork 되짚어보기]]
- [[libraries/langgraph/update-state-manual-patching|update_state()로 thread 상태를 수동 수정하고 이어서 실행하기]]
- [[libraries/langgraph/bulk-update-state-supersteps|bulk_update_state()로 여러 superstep checkpoint를 한 번에 심기]]

### Composition Patterns

- [[libraries/langgraph/add-node-destinations-command-routing-rendering|add_node(destinations=...)로 Command 라우팅 그래프를 읽기 좋게 그리기]]
- [[libraries/langgraph/send-dynamic-parallelism|Send로 동적 병렬 fan-out과 map-reduce 처리하기]]
- [[libraries/langgraph/subgraph-node-vs-invoke|subgraph를 node로 직접 붙일지, node 안에서 invoke할지 고르기]]
- [[libraries/langgraph/subgraph-persistence-modes-state-inspection|subgraph에서 checkpointer=None, True, False를 어떻게 고를까]]
- [[libraries/langgraph/subgraph-parent-handoff|subgraph에서 Command.PARENT로 부모 그래프로 handoff하기]]
