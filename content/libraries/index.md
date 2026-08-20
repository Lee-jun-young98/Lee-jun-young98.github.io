---
title: Library Study Notes
---

# Library Study Notes

라이브러리를 실제로 써보면서 사용법과 운영 패턴을 정리한 노트 모음입니다.

지금은 LangChain, LangGraph, LangSmith를 중심으로 agent, memory, evaluation, observability 주제를 이어서 정리하고 있습니다.

## 목록

- [[libraries/langchain/index|LangChain]]
- [[libraries/langgraph/index|LangGraph]]
- [[libraries/langsmith/index|LangSmith]]

LangChain 섹션에서는 runtime context, ToolRuntime, middleware, multi-agent, memory 같은 실전 주제를 추적합니다.

### Recent LangGraph Notes

- [[libraries/langgraph/messages-state-custom-fields|LangGraph MessagesState에 사용자 정의 필드 확장하기]]
- [[libraries/langgraph/entrypoint-final-return-save-state|LangGraph entrypoint.final로 반환값과 저장 상태 분리하기]]
- [[libraries/langgraph/add-sequence-linear-pipeline|LangGraph add_sequence로 순차 파이프라인 간결하게 만들기]]
- [[libraries/langgraph/max-concurrency-parallel-task-limits|LangGraph max_concurrency로 병렬 task 동시 실행 수 제한하기]]
- [[libraries/langgraph/checkpoint-history-pagination-filter|LangGraph checkpoint history를 filter, before, limit로 페이지네이션하기]]
- [[libraries/langgraph/conditional-entry-point-start-routing|LangGraph conditional entry point로 시작 노드 바로 고르기]]
- [[libraries/langgraph/task-checkpoint-debug-streaming|LangGraph tasks와 checkpoints 스트림으로 실행 중 노드 진단하기]]
- [[libraries/langgraph/invoke-v2-graph-output-interrupts|LangGraph invoke v2와 GraphOutput으로 결과와 interrupt 분리하기]]
- [[libraries/langgraph/store-ttl-memory-expiration|LangGraph Store TTL로 장기 메모리 만료 정책 운영하기]]
- [[libraries/langgraph/async-nodes-ainvoke-event-loop|LangGraph async 노드와 ainvoke로 I/O 병렬 처리하기]]
- [[libraries/langgraph/checkpoint-thread-retention-delete|LangGraph checkpoint를 thread 단위로 보존하고 삭제하기]]
- [[libraries/langgraph/subgraph-streaming-v2-namespaces|LangGraph subgraph 스트림을 v2 namespace로 라우팅하기]]
- [[libraries/langgraph/pending-writes-parallel-failure-resume|LangGraph pending writes로 병렬 실패를 이어서 복구하기]]
- [[libraries/langgraph/state-snapshot-tasks-failure-diagnostics|LangGraph StateSnapshot.tasks로 실패 노드 진단하기]]
- [[libraries/langgraph/graph-visualization-mermaid-png|LangGraph graph를 Mermaid와 PNG로 시각화하기]]
- [[libraries/langgraph/encrypted-checkpoint-serializer|LangGraph EncryptedSerializer로 checkpoint를 AES 암호화하기]]
- [[libraries/langgraph/command-resume-vs-dict-thread-inputs|LangGraph 기존 thread에 새 입력을 넣을 때는 dict를 쓰고, interrupt 재개에만 Command(resume=...) 쓰기]]
- [[libraries/langgraph/context-schema-runtime-context|LangGraph context_schema와 Runtime context로 요청별 설정 주입하기]]
- [[libraries/langgraph/overwrite-bypass-reducers-reset-state|LangGraph Overwrite로 reducer를 우회해 state를 리셋하기]]

- [[libraries/langgraph/interrupt-validation-loop-conditional-edges|LangGraph interrupt() 검증 루프를 while True 대신 conditional edge로 만들기]]

- [[libraries/langgraph/postgres-checkpointer-production|LangGraph PostgresSaver로 durable checkpointer 운영하기]]
- [[libraries/langgraph/add-node-destinations-command-routing-rendering|LangGraph add_node(destinations=...)로 Command 라우팅 그래프를 읽기 좋게 그리기]]
- [[libraries/langgraph/delta-channel-checkpoint-storage|LangGraph DeltaChannel로 긴 thread checkpoint 크기 줄이기]]
- [[libraries/langgraph/update-state-manual-patching|LangGraph update_state()로 thread 상태를 수동 수정하고 이어서 실행하기]]
- [[libraries/langgraph/bulk-update-state-supersteps|LangGraph bulk_update_state()로 여러 superstep checkpoint를 한 번에 심기]]
- [[libraries/langgraph/subgraph-node-vs-invoke|LangGraph subgraph를 node로 직접 붙일지, node 안에서 invoke할지 고르기]]
- [[libraries/langgraph/set-node-defaults-graph-wide-fault-tolerance|LangGraph set_node_defaults()로 retry, timeout, error_handler 기본값을 한 번에 깔기]]
- [[libraries/langgraph/pydantic-state-validation-coercion|LangGraph Pydantic state로 입력 검증과 자동 coercion 붙이기]]
- [[libraries/langgraph/durability-modes-sync-async-exit|LangGraph durability로 sync, async, exit를 언제 고를까]]
- [[libraries/langgraph/store-semantic-search-memory|LangGraph store semantic search로 장기 메모리 검색 붙이기]]
- [[libraries/langgraph/backward-compatibility-graph-migrations|LangGraph backward compatibility로 in-flight thread 안 깨고 그래프 변경하기]]
- [[libraries/langgraph/parallel-interrupts-resume-map|LangGraph 병렬 interrupt를 ID 매핑으로 한 번에 재개하기]]
- [[libraries/langgraph/toolruntime-toolnode-state-store-context|LangGraph ToolRuntime으로 ToolNode 안에서 state, store, context 모두 주입하기]]

### Recent LangSmith Notes

- [[libraries/langsmith/langsmith-pytest-evals-ci|LangSmith pytest로 LLM eval과 회귀 테스트를 CI에 붙이기]]
- [[libraries/langsmith/langsmith-manage-evaluators-sdk|LangSmith evaluators를 SDK로 생성·수정·비용 추적하기]]
- [[libraries/langsmith/langsmith-evaluate-with-attachments|LangSmith attachments로 멀티모달 evaluation 운영하기]]
- [[libraries/langsmith/langsmith-experiment-metrics-sdk|LangSmith read_project(include_stats=True)로 experiment 지표 가져오기]]

### Recent LangChain Notes

- [[libraries/langchain/tool-content-artifact-return-direct|LangChain tool content와 artifact를 분리하고 return_direct로 루프 끝내기]]
- [[libraries/langchain/deep-agents-skills-progressive-disclosure|LangChain Deep Agents skills로 작업 지침을 점진적으로 불러오기]]
- [[libraries/langchain/private-state-schema-boundaries|LangChain private state로 agent 입출력 스키마 경계 나누기]]
- [[libraries/langchain/llm-response-cache-agent-calls|LangChain LLM response cache로 agent 모델 호출 재사용하기]]
- [[libraries/langchain/human-in-loop-conditional-decisions|LangChain 조건부 HITL과 approve·edit·reject·respond 결정 운영하기]]
- [[libraries/langchain/in-memory-rate-limiter-agent-model|LangChain InMemoryRateLimiter로 agent 모델 호출 속도 제어하기]]
- [[libraries/langchain/anthropic-cache-cross-provider-fallback|Anthropic prompt cache와 cross-provider fallback 안전하게 조합하기]]
- [[libraries/langchain/dynamic-model-settings-middleware|middleware로 요청별 model settings 동적 조정하기]]
- [[libraries/langchain/extended-model-response-state-updates|ExtendedModelResponse로 model call 결과와 state 함께 갱신하기]]
- [[libraries/langchain/runtime-tool-registration-middleware|runtime tool registration으로 실행 중 발견한 도구 연결하기]]
- [[libraries/langchain/runtime-execution-info-server-info|Runtime execution_info와 server_info로 실행 문맥 추적하기]]
- [[libraries/langchain/middleware-jump-to-agent-routing|middleware jump_to로 에이전트 루프 제어하기]]
- [[libraries/langchain/dynamic-response-format-middleware|middleware로 상황별 response format 동적 선택하기]]
- [[libraries/langchain/model-profiles-capability-gating|model profile로 모델 기능을 실행 전에 검사하기]]
- [[libraries/langchain/standard-content-blocks-cross-provider|content_blocks로 모델별 메시지를 같은 형식으로 다루기]]
- [[libraries/langchain/wrap-tool-call-error-handling|wrap_tool_call로 도구 오류를 안전하게 복구하기]]
- [[libraries/langchain/agent-stream-events-messages-tool-calls|agent.stream_events()로 messages와 tool_calls를 함께 스트리밍하기]]
- [[libraries/langchain/rubric-middleware-self-evaluation|RubricMiddleware로 agent 결과를 자기검토하며 재시도하기]]
- [[libraries/langchain/tool-args-schema-validation|@tool과 args_schema로 도구 입력 스키마를 단단하게 만들기]]
- [[libraries/langchain/quickjs-code-interpreter-middleware|CodeInterpreterMiddleware로 agent 안에 QuickJS 계산 루프 넣기]]
- [[libraries/langchain/delete-messages-removemessage|RemoveMessage로 대화 기록 일부만 안전하게 지우기]]
- [[libraries/langchain/custom-guardrails-before-after-agent|custom guardrails로 before_agent와 after_agent 안전 레일 넣기]]
- [[libraries/langchain/server-side-tool-use|server-side tool use로 web_search를 provider 쪽에서 실행하기]]
- [[libraries/langchain/deep-agents-composite-backend-workspace-memory|Deep Agents CompositeBackend로 workspace와 memory 분리하기]]
- [[libraries/langchain/custom-stream-transformers|custom stream transformers로 stream_events v3 확장 채널 만들기]]
- [[libraries/langchain/trim-messages-before-model|trim_messages로 context window 터지기 전에 기록 자르기]]
- [[libraries/langchain/handoffs-customer-support|handoffs로 고객지원 상태 전환 에이전트 만들기]]
- [[libraries/langchain/markdown-messages|markdown messages로 스트리밍 응답을 읽기 좋은 UI로 렌더링하기]]
- [[libraries/langchain/headless-tools-client-execution|headless tools로 브라우저 전용 도구를 client에서 실행하기]]
- [[libraries/langchain/anthropic-prompt-caching-middleware|AnthropicPromptCachingMiddleware로 긴 system prompt 비용과 지연 줄이기]]
