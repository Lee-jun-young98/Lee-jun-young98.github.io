---
title: Blog
hideAutoFolderListing: true
---

# Blog

공부하면서 직접 확인하고 정리한 글들을 역할별로 묶어 보는 공간입니다.

단순한 날짜 나열보다 어떤 성격의 글인지 바로 보이도록 섹션 단위로 정리합니다.

## Library / Model Generation Policy

- [[libraries/langchain/dynamic-model-settings-middleware|LangChain middleware로 요청별 model settings 동적 조정하기]]

## Library / Agent State & Usage Accounting

- [[libraries/langchain/extended-model-response-state-updates|LangChain ExtendedModelResponse로 model call 결과와 state 함께 갱신하기]]

## Library / Dynamic Tool Discovery & Execution

- [[libraries/langchain/runtime-tool-registration-middleware|LangChain runtime tool registration으로 실행 중 발견한 도구 연결하기]]

## Library / Agent Runtime Identity & Authorization

- [[libraries/langchain/runtime-execution-info-server-info|LangChain Runtime execution_info와 server_info로 실행 문맥 추적하기]]

## Library / Agent Control Flow

- [[libraries/langchain/middleware-jump-to-agent-routing|LangChain middleware jump_to로 에이전트 루프 제어하기]]

## Library / Output Contracts

- [[libraries/langchain/dynamic-response-format-middleware|LangChain middleware로 상황별 response format 동적 선택하기]]

## Library / Model Capability & Routing

- [[libraries/langchain/model-profiles-capability-gating|LangChain model profile로 모델 기능을 실행 전에 검사하기]]

## Library / Message Interoperability

- [[libraries/langchain/standard-content-blocks-cross-provider|LangChain content_blocks로 모델별 메시지를 같은 형식으로 다루기]]

## Library / Observability & Evaluation

- [[libraries/langsmith/langsmith-few-shot-evaluator-corrections|few-shot evaluator로 사람의 평가 수정사항 반영하기]]
- [[libraries/langsmith/langsmith-experiment-repetitions-concurrency-cache|평가 반복·동시성·캐시로 실험 비용과 분산 관리하기]]
- [[libraries/langsmith/langsmith-production-trace-agent-backtesting|운영 trace로 새 agent 버전 backtest하기]]
- [[libraries/langsmith/langsmith-local-evaluation-no-upload|LangSmith upload_results=False로 평가를 로컬에서만 실행하기]]
- [[libraries/langsmith/langsmith-run-evals-rest-api|REST API만으로 dataset 기반 evaluation 실행하기]]
- [[libraries/langsmith/langsmith-upload-external-experiments-rest-api|REST API로 외부 실험 결과 업로드하기]]
- [[libraries/langsmith/langsmith-pytest-evals-ci|LangSmith pytest로 LLM eval과 회귀 테스트를 CI에 붙이기]]
- [[libraries/langsmith/langsmith-evaluate-existing-experiment|LangSmith 기존 experiment에 evaluator만 다시 붙이기]]
- [[libraries/langsmith/langsmith-retry-failed-evaluation-examples|LangSmith evaluation에서 실패한 example만 재시도하기]]
- [[libraries/langsmith/langsmith-offline-evaluation-quickstart|LangSmith offline evaluation 빠르게 시작하기]]
- [[libraries/langsmith/langsmith-summary-evaluators-pass-rate-f1|LangSmith summary_evaluators로 experiment pass rate와 F1 집계하기]]
- [[libraries/langsmith/langsmith-evaluate-intermediate-steps|LangSmith evaluate()에서 중간 단계까지 평가하기]]

## Library / Dataset Preparation & Normalization

- [[libraries/langsmith/langsmith-dataset-transformations-chat-model-schema|dataset transformations로 운영 trace를 평가셋 형식으로 정규화하기]]

## Library / Online Production Evaluation

- [[libraries/langsmith/langsmith-multi-turn-online-evaluators|multi-turn online evaluator로 전체 대화 품질 평가하기]]
- [[libraries/langsmith/langsmith-online-code-evaluators|online code evaluator로 운영 trace 품질 가드레일 걸기]]

## Library / OpenTelemetry Tracing & Evaluation

- [[libraries/langsmith/langsmith-trace-with-opentelemetry-python|LangChain 없이 OpenTelemetry Python trace를 LangSmith로 보내기]]
- [[libraries/langsmith/langsmith-evaluate-with-opentelemetry|OpenTelemetry trace를 LangSmith experiment로 평가하기]]

## Library / Trace Routing & Configuration

- [[libraries/langsmith/langsmith-tracing-quickstart|traceable과 wrap_openai로 tracing 시작하기]]
- [[libraries/langsmith/langsmith-distributed-tracing-python|분산 tracing으로 서비스 간 trace 이어 붙이기]]
- [[libraries/langsmith/langsmith-custom-run-id-feedback|custom run ID로 feedback과 조회 흐름 안정적으로 연결하기]]
- [[libraries/langsmith/langsmith-trace-routing-projects-workspaces|tracing_context로 trace를 project, workspace, replica로 라우팅하기]]
- [[libraries/langsmith/langsmith-dataset-splits-version-tags|dataset split과 version tag로 평가셋 고정하기]]

## Library / Trace Coverage & Cost Control

- [[libraries/langsmith/langsmith-custom-cost-tracking-usage-metadata|usage_metadata로 custom model과 tool 비용 추적하기]]
- [[libraries/langsmith/langsmith-tracing-sampling-conditional|sampling과 conditional tracing으로 필요한 trace만 남기기]]

## Library / Monitoring & Alerting

- [[libraries/langsmith/langsmith-dashboards-alerts-monitoring|dashboards와 alerts로 운영 trace 감시하기]]

## Library / Multimodal Evaluation

- [[libraries/langsmith/langsmith-evaluate-with-attachments|attachments로 image, PDF, audio eval dataset 운영하기]]

## Library / Comparative Evaluation

- [[libraries/langsmith/langsmith-pairwise-annotation-queues|pairwise annotation queue로 사람 A/B 리뷰 붙이기]]
- [[libraries/langsmith/langsmith-pairwise-evaluation-experiments|pairwise evaluation으로 두 실험 비교하기]]

## Library / Feedback Collection

- [[libraries/langsmith/langsmith-create-feedback-list-feedback|create_feedback와 list_feedback으로 사용자 평가 수집하고 분석하기]]
- [[libraries/langsmith/langsmith-presigned-feedback-tokens|presigned feedback token으로 프론트엔드에서 평가 수집하기]]
- [[libraries/langsmith/langsmith-annotation-queues-sdk|annotation queue로 사람 검토 흐름 만들기]]

## Library / Feedback & Review Ops

- [[libraries/langsmith/langsmith-annotation-queue-sdk|annotation queue를 Python SDK로 운영하기]]
- [[libraries/langsmith/langsmith-annotation-queue-rubric-sdk|LangSmith annotation queue rubric을 코드로 관리하기]]

## Library / Human Review to Offline Evals

- [[libraries/langsmith/langsmith-assertions-offline-evals|assertion으로 human review를 offline eval로 연결하기]]

## Library / Feedback Analytics

- [[libraries/langsmith/langsmith-feedback-formulas-sdk|feedback formula로 여러 평가 점수를 composite metric으로 묶기]]

## Library / PromptOps

- [[libraries/langsmith/langsmith-prompt-webhooks-deploy-automation|prompt webhook으로 프롬프트 배포 자동화하기]]
- [[libraries/langsmith/langsmith-prompt-commit-tags-cache|prompt commit tag로 프롬프트 배포 고정하기]]

## Library / Prompt Optimization

- [[libraries/langsmith/langsmith-prompt-optimization-job-rest-api|Prompt Optimization Job을 REST API로 실행하고 검증하기]]

## Library / Production Operations

- [[libraries/langsmith/langsmith-automation-rules-webhooks|automation rule과 webhook으로 운영 알림 자동화하기]]

## Library / Privacy & Compliance

- [[libraries/langsmith/langsmith-mask-sensitive-traces|민감정보를 가리고 trace를 남기는 방법]]

## Library / Developer Tooling

- [[libraries/langsmith/langsmith-cli-traces-datasets-threads|LangSmith CLI로 trace, dataset, thread를 터미널에서 바로 다루기]]

## Library / Data Export & Warehousing

- [[libraries/langsmith/langsmith-bulk-export-s3-parquet|bulk export로 trace를 S3/Parquet로 내보내기]]

## Library / Workflow Reliability

- [[libraries/langgraph/pending-writes-parallel-failure-resume|pending writes로 병렬 node 부분 실패를 이어서 복구하기]]
- [[libraries/langgraph/postgres-checkpointer-production|PostgresSaver로 durable checkpointer를 운영 환경에 붙이기]]
- [[libraries/langgraph/set-node-defaults-graph-wide-fault-tolerance|set_node_defaults()로 retry, timeout, error_handler 기본값 한 번에 깔기]]
- [[libraries/langgraph/durability-modes-sync-async-exit|durability로 sync, async, exit를 워크로드별로 고르기]]
- [[libraries/langgraph/retry-policy-node-retries|RetryPolicy로 일시 실패 노드만 안전하게 재시도하기]]
- [[libraries/langgraph/runtime-execution-info-retry-fallbacks|runtime.execution_info로 재시도 차수별 fallback 분기하기]]
- [[libraries/langgraph/timeout-policy-node-timeouts|TimeoutPolicy로 느린 노드를 run_timeout, idle_timeout으로 끊기]]
- [[libraries/langgraph/error-handler-recovery-routing|error_handler로 실패 후 보상 흐름과 대체 경로 만들기]]
- [[libraries/langgraph/deferred-node-cleanup-finalizers|defer=True로 cleanup, audit, notification을 run 마지막으로 미루기]]
- [[libraries/langgraph/recursion-limit-remaining-steps|recursion_limit와 RemainingSteps로 루프 안전장치 두기]]

## Library / Workflow Operations

- [[libraries/langgraph/store-ttl-memory-expiration|Store TTL로 cross-thread 장기 메모리 만료 정책 운영하기]]
- [[libraries/langgraph/checkpoint-thread-retention-delete|delete_thread로 checkpoint 보존 기간과 thread 삭제 운영하기]]
- [[libraries/langgraph/graceful-shutdown-runcontrol-resume|RunControl로 graceful shutdown 후 안전하게 재개하기]]

## Library / Workflow Thread Continuation

- [[libraries/langgraph/checkpointer-persistence-threads|checkpointer로 thread 상태를 저장하고 같은 ID로 이어서 실행하기]]
- [[libraries/langgraph/command-resume-vs-dict-thread-inputs|기존 thread에 새 입력을 넣을 때는 dict를 쓰고, interrupt 재개에만 Command(resume=...) 쓰기]]
- [[libraries/langgraph/interrupt-human-approval-resume|interrupt()로 사람 확인 대기 후 Command(resume=...)로 재개하기]]

## Library / Human-in-the-Loop Workflows

- [[libraries/langgraph/interrupt-validation-loop-conditional-edges|interrupt() 검증 루프를 while True 대신 conditional edge로 만들기]]
- [[libraries/langgraph/parallel-interrupts-resume-map|병렬 interrupt를 ID 매핑으로 한 번에 재개하기]]
- [[libraries/langgraph/interrupt-human-approval-resume|interrupt()로 사람 확인 대기 후 Command(resume=...)로 재개하기]]

## Library / Workflow Composition

- [[libraries/langgraph/add-node-destinations-command-routing-rendering|add_node(destinations=...)로 Command 라우팅 그래프를 읽기 좋게 그리기]]
- [[libraries/langgraph/subgraph-node-vs-invoke|subgraph를 node로 직접 붙일지, node 안에서 invoke할지 고르기]]

## Library / Workflow Evolution

- [[libraries/langgraph/backward-compatibility-graph-migrations|backward compatibility로 in-flight thread 안 깨고 그래프 변경하기]]

## Library / Workflow Debugging

- [[libraries/langgraph/subgraph-streaming-v2-namespaces|subgraphs=True와 v2 namespace로 중첩 workflow 진행 상황 라우팅하기]]
- [[libraries/langgraph/graph-visualization-mermaid-png|graph를 Mermaid와 PNG로 시각화해 실행 구조 검토하기]]
- [[libraries/langgraph/static-breakpoints-interrupt-before-after|static breakpoint로 노드 전후 실행을 멈춰 디버깅하기]]

## Library / Workflow Performance

- [[libraries/langgraph/async-nodes-ainvoke-event-loop|LangGraph async 노드와 ainvoke로 I/O 병렬 처리하기]]
- [[libraries/langgraph/cache-policy-node-caching|cache_policy로 비싼 노드 결과 재사용하기]]
- [[libraries/langgraph/delta-channel-checkpoint-storage|DeltaChannel로 긴 thread checkpoint 크기 줄이기]]

## Library / Workflow Security

- [[libraries/langgraph/encrypted-checkpoint-serializer|EncryptedSerializer로 checkpoint를 AES 암호화하기]]

## Library / Workflow State Repair & Reset

- [[libraries/langgraph/overwrite-bypass-reducers-reset-state|Overwrite로 reducer를 우회해 누적 state 리셋하기]]

## Library / Conversation Observability

- [[libraries/langsmith/langsmith-threads-query-sdk|thread_id로 멀티턴 상태 추적하고 SDK로 조회하기]]

## Library / Trace Analytics

- [[libraries/langsmith/langsmith-query-traces-sdk|list_runs, filter, trace_filter로 운영 trace를 정확하게 조회하기]]

## Library / Experiment Analytics

- [[libraries/langsmith/langsmith-experiment-metrics-sdk|read_project(include_stats=True)로 experiment 지표 가져오기]]
- [[libraries/langsmith/langsmith-summary-evaluators-pass-rate-f1|summary_evaluators로 pass rate, F1, p95 latency 함께 보기]]

## Library / Evaluator Management

- [[libraries/langsmith/langsmith-manage-evaluators-sdk|LangSmith evaluators를 SDK로 생성·수정·비용 추적하기]]

## Library / Agent Foundations

- [[libraries/langchain/custom-guardrails-before-after-agent|custom guardrails로 before_agent와 after_agent 안전 레이어 넣기]]
- [[libraries/langchain/server-side-tool-use|server-side tool use로 web_search를 provider 쪽에서 실행하기]]

- [[libraries/langchain/create-deep-agent-quickstart|Deep Agents create_deep_agent로 planning, filesystem, subagent를 한 번에 붙이기]]
- [[libraries/langchain/custom-middleware-hooks-state-tools|custom middleware로 before_model, after_model, state_schema 묶어 에이전트 확장하기]]
- [[libraries/langchain/custom-stream-transformers|custom stream transformers로 stream_events v3 확장 채널 만들기]]
- [[libraries/langchain/mcp-adapters-multi-server-tools|MCP adapters? ?? MCP ?? ?? ????]]
- [[libraries/langchain/mcp-server-tools|MCP 서버 도구를 agent에 붙이기]]
- [[libraries/langchain/mcp-resources-prompts-interceptors|MCP resource, prompt, interceptor로 서버 문맥 연결하기]]
- [[libraries/langchain/custom-state-middleware|custom state와 middleware로 사용자별 컨텍스트 넣기]]
- [[libraries/langchain/create-agent-tool-calling|create_agent로 도구 호출 에이전트 시작하기]]
- [[libraries/langchain/structured-output-response-format|structured output으로 에이전트 응답 스키마 고정하기]]
- [[libraries/langchain/runtime-context-toolruntime|runtime context와 ToolRuntime으로 사용자별 설정 주입하기]]
- [[libraries/langchain/toolruntime-stream-writer-progress|ToolRuntime.stream_writer로 도구 진행 상황 스트리밍하기]]
- [[libraries/langchain/toolruntime-command-state-updates|ToolRuntime과 Command(update=...)로 tool에서 state 갱신하기]]
- [[libraries/langchain/dynamic-prompt-system-instructions|dynamic_prompt로 상황별 system prompt 주입하기]]
- [[libraries/langchain/dynamic-model-selection-middleware|middleware로 동적 모델 선택과 도구 호출 제어하기]]
- [[libraries/langchain/dynamic-tool-selection|동적 도구 선택으로 프로젝트를 줄이고 권한별로 나누기]]
- [[libraries/langchain/llm-tool-selector-middleware|LLMToolSelectorMiddleware로 많은 도구 중 필요한 것만 고르기]]
- [[libraries/langchain/provider-tool-search-middleware|ProviderToolSearchMiddleware로 provider 검색형 도구 지연 로딩하기]]
- [[libraries/langchain/todo-list-middleware|TodoListMiddleware로 복잡한 작업 계획 추적하기]]
- [[libraries/langchain/context-editing-clear-tool-outputs|ContextEditingMiddleware로 오래된 tool output 정리하기]]
- [[libraries/langchain/tool-retry-middleware|ToolRetryMiddleware로 실패한 도구 호출 재시도하기]]
- [[libraries/langchain/tool-call-limit-middleware|ToolCallLimitMiddleware로 agent tool 호출 상한 걸기]]
- [[libraries/langchain/model-retry-middleware|ModelRetryMiddleware로 모델 호출 재시도하기]]
- [[libraries/langchain/long-term-memory-store|long-term memory로 사용자 선호 저장하고 다시 꺼내기]]
- [[libraries/langchain/pii-middleware-redaction-guardrails|PIIMiddleware로 입력과 출력의 민감정보 가리기]]
- [[libraries/langchain/user-interaction-patterns|에이전트가 사용자와 어떻게 상호작용할까]]
- [[libraries/langchain/human-in-the-loop-agent-approval|Human-in-the-Loop로 에이전트 확인 단계 넣기]]

## Library / Structured Output & Extraction

- [[libraries/langchain/chatopenai-structured-output-json-schema|ChatOpenAI.with_structured_output()로 JSON Schema 강제하기]]

## Library / Agent Execution Environment

- [[libraries/langchain/filesystem-middleware-agent-workspace|FilesystemMiddleware로 에이전트 작업 공간 붙이기]]
- [[libraries/langchain/create-deep-agent-quickstart|Deep Agents create_deep_agent로 planning, filesystem, subagent를 한 번에 붙이기]]
- [[libraries/langchain/quickjs-code-interpreter-middleware|CodeInterpreterMiddleware로 agent 안에 QuickJS 계산 루프 넣기]]
- [[libraries/langchain/shell-tool-middleware|ShellToolMiddleware로 agent에 지속형 셸 세션 붙이기]]
- [[libraries/langchain/filesystem-file-search-middleware|FilesystemFileSearchMiddleware로 코드베이스 glob/grep 검색 붙이기]]

## Library / Agent Memory Hygiene

- [[libraries/langchain/short-term-memory|short-term memory로 대화 맥락 이어가기]]
- [[libraries/langchain/trim-messages-before-model|trim_messages로 context window 넘치기 전에 기록 자르기]]
- [[libraries/langchain/delete-messages-removemessage|RemoveMessage로 대화 기록 일부만 안전하게 지우기]]
  오래된 턴, 민감한 응답, 잘못된 assistant message를 state에서 제거하는 기준과 패턴을 정리한 글입니다.
- [[libraries/langchain/summarization-middleware|SummarizationMiddleware로 긴 대화를 요약 메모리로 압축하기]]

## Library / Agent Testing

- [[libraries/langchain/llm-tool-emulator-middleware|LLMToolEmulator로 실제 결제, 메일, 외부 API 호출 없이 에이전트 흐름 테스트하기]]

## Library / Agent Self-Evaluation

- [[libraries/langchain/rubric-middleware-self-evaluation|RubricMiddleware로 agent 결과를 자기검토하며 재시도하기]]

## Library / Agent Cost & Performance

- [[libraries/langchain/anthropic-prompt-caching-middleware|AnthropicPromptCachingMiddleware로 긴 system prompt 비용과 지연 줄이기]]

## Library / Frontend Agent UX

- [[libraries/langchain/markdown-messages|markdown messages로 스트리밍 응답을 읽기 좋은 UI로 렌더링하기]]
- [[libraries/langchain/headless-tools-client-execution|headless tools로 브라우저 전용 도구를 client에서 실행하기]]

## Library / Agent Tool Design

- [[libraries/langchain/tool-args-schema-validation|@tool, args_schema, parse_docstring으로 도구 입력 스키마 단단하게 만들기]]
- [[libraries/langchain/headless-tools-client-execution|headless tools로 브라우저 전용 도구를 client에서 실행하기]]

## Library / Agent Tool Reliability

- [[libraries/langchain/wrap-tool-call-error-handling|wrap_tool_call로 도구 오류를 안전하게 복구하기]]

## Library / Agent Streaming Basics

- [[libraries/langchain/agent-stream-events-messages-tool-calls|agent.stream_events()로 messages와 tool_calls를 함께 스트리밍하기]]

## Library / Agent Streaming Extensions

- [[libraries/langchain/custom-stream-transformers|custom stream transformers로 stream_events v3 확장 채널 만들기]]
- [[libraries/langchain/toolruntime-stream-writer-progress|ToolRuntime.stream_writer로 도구 진행 상황 스트리밍하기]]

## Library / Agent Execution Environment

- [[libraries/langchain/quickjs-code-interpreter-middleware|CodeInterpreterMiddleware로 agent 안에 QuickJS 계산 루프 넣기]]
- [[libraries/langchain/deep-agents-composite-backend-workspace-memory|Deep Agents CompositeBackend로 workspace scratch와 durable memory 분리하기]]
- [[libraries/langchain/shell-tool-middleware|ShellToolMiddleware로 agent에 지역 실행 권한 붙이기]]
- [[libraries/langchain/filesystem-file-search-middleware|FilesystemFileSearchMiddleware로 코드베이스 glob/grep 검색 붙이기]]

## Library / Agent Guardrails

- [[libraries/langchain/custom-guardrails-before-after-agent|custom guardrails로 before_agent와 after_agent 안전 레이어 넣기]]
- [[libraries/langchain/model-call-limit-middleware|ModelCallLimitMiddleware로 에이전트 모델 호출 상한 걸기]]
- [[libraries/langchain/openai-moderation-middleware|OpenAIModerationMiddleware로 입력, 출력, tool 결과 안전성 검사하기]]

## Library / LangGraph Tool Execution

- [[libraries/langgraph/toolruntime-toolnode-state-store-context|ToolRuntime으로 ToolNode 안에서 state, store, context 모두 주입하기]]
- [[libraries/langgraph/toolnode-command-state-updates|ToolNode로 tool 결과와 state 업데이트 함께 반영하기]]

## Library / LangGraph Foundations

- [[libraries/langgraph/context-schema-runtime-context|context_schema와 Runtime context로 요청별 설정 주입하기]]

- [[libraries/langgraph/postgres-checkpointer-production|PostgresSaver로 durable checkpointer를 운영 환경에 붙이기]]
- [[libraries/langgraph/pydantic-state-validation-coercion|Pydantic state로 입력 검증과 타입 coercion 붙이기]]
- [[libraries/langgraph/store-semantic-search-memory|LangGraph store semantic search로 장기 메모리 검색 붙이기]]
- [[libraries/langgraph/store-cross-thread-long-term-memory|store로 cross-thread 장기 메모리 붙이기]]
- [[libraries/langgraph/checkpointer-persistence-threads|checkpointer로 thread 상태를 저장하고 같은 ID로 이어서 실행하기]]
- [[libraries/langgraph/add-messages-chat-history|add_messages로 채팅 히스토리를 안전하게 추가하고 교체하고 제거하기]]
- [[libraries/langgraph/reducers-parallel-state-merges|reducer로 병렬 state update 안전하게 합치기]]
- [[libraries/langgraph/command-routing-state-updates|Command로 상태 업데이트와 라우팅을 한 번에 처리하기]]
- [[libraries/langgraph/input-output-private-state-schemas|input_schema, output_schema, private state로 공개 입력과 내부 상태 분리하기]]
- [[libraries/langgraph/functional-api-entrypoint-task-workflows|Functional API에서 @entrypoint와 @task로 replay-safe workflow 만들기]]

## Library / LangGraph Runtime & Observability

- [[libraries/langgraph/state-snapshot-tasks-failure-diagnostics|StateSnapshot.tasks로 실패 노드 진단하기]]
- [[libraries/langgraph/event-streaming-v3-projections|event streaming v3로 상태, 토큰, interrupt를 한 스트림에서 다루기]]
- [[libraries/langgraph/stream-mode-updates-messages-custom|stream()으로 updates, messages, custom, debug 이벤트 흘려보내기]]
- [[libraries/langgraph/time-travel-replay-fork|time travel로 체크포인트 replay와 fork 디버깅하기]]

## Library / LangGraph Composition Patterns

- [[libraries/langgraph/send-dynamic-parallelism|Send로 동적 병렬 fan-out/map-reduce 처리하기]]
- [[libraries/langgraph/subgraph-node-vs-invoke|subgraph를 node로 직접 붙일지, node 안에서 invoke할지 고르기]]
- [[libraries/langgraph/subgraph-persistence-modes-state-inspection|subgraph에서 checkpointer=None, True, False를 어떻게 고를까]]
- [[libraries/langgraph/subgraph-parent-handoff|subgraph에서 Command.PARENT로 부모 그래프로 handoff하기]]

## Library / Multi-Agent Patterns

- [[libraries/langchain/handoffs-customer-support|handoffs로 고객지원 상태 전환 에이전트 만들기]]
- [[libraries/langchain/subagents-supervisor-pattern|subagents로 역할 분리된 에이전트 만들기]]
- [[libraries/langchain/supervisor-subagent-call-flow|supervisor가 subagent를 호출할 때 내부 로직은 어떻게 흐를까]]
- [[libraries/langchain/supervisor-subagent-router-pattern|supervisor는 subagent를 어떤 방식으로 고를까]]

## Library / Workflow State Repair & Testing

- [[libraries/langgraph/update-state-manual-patching|update_state()로 thread 상태를 수동 수정하고 이어서 실행하기]]
- [[libraries/langgraph/bulk-update-state-supersteps|bulk_update_state()로 여러 superstep checkpoint를 한 번에 심기]]

## Training / MLOps

- [[blog/hydra-llm-sft-training-pipeline|Hydra로 LLM SFT 실험 설정 정리하기]]
