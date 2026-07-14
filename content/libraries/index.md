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

- [[libraries/langgraph/context-schema-runtime-context|LangGraph context_schema와 Runtime context로 요청별 설정 주입하기]]

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
