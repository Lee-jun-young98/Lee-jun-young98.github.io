---
title: Blog
hideAutoFolderListing: true
---

# Blog

공부하면서 직접 확인하고 정리한 글들을 역할별로 묶어 두는 공간입니다.

단순한 날짜순 나열보다 어떤 성격의 글인지 바로 보이도록 섹션 단위로 정리합니다.

## Library / Observability & Evaluation

- [[libraries/langsmith/langsmith-evaluate-existing-experiment|LangSmith 기존 experiment에 evaluator만 다시 붙이기]]
- [[libraries/langsmith/langsmith-retry-failed-evaluation-examples|LangSmith evaluation에서 실패한 example만 재시도하기]]
- [[libraries/langsmith/langsmith-offline-evaluation-quickstart|LangSmith offline evaluation 빠르게 시작하기: dataset, evaluate(), aevaluate()]]

## Library / Trace Routing & Configuration

- [[libraries/langsmith/langsmith-tracing-quickstart|traceable과 wrap_openai로 tracing 시작하기]]
- [[libraries/langsmith/langsmith-trace-routing-projects-workspaces|tracing_context로 trace를 project, workspace, replica로 라우팅하기]]
- [[libraries/langsmith/langsmith-dataset-splits-version-tags|dataset split과 version tag로 평가셋 고정하기]]

## Library / Multimodal Evaluation

- [[libraries/langsmith/langsmith-evaluate-with-attachments|attachments로 image, PDF, audio eval dataset 운영하기]]

## Library / Comparative Evaluation

- [[libraries/langsmith/langsmith-pairwise-evaluation-experiments|pairwise evaluation으로 두 실험을 비교하기]]

## Library / Feedback Collection

- [[libraries/langsmith/langsmith-presigned-feedback-tokens|presigned feedback token으로 프론트엔드 평가 수집하기]]
- [[libraries/langsmith/langsmith-annotation-queues-sdk|annotation queue로 사람 검수 흐름 만들기]]

## Library / PromptOps

- [[libraries/langsmith/langsmith-prompt-commit-tags-cache|prompt commit tag로 프롬프트 배포 고정하기]]

## Library / Production Operations

- [[libraries/langsmith/langsmith-automation-rules-webhooks|automation rule과 webhook으로 운영 점검 자동화하기]]

## Library / Developer Tooling

- [[libraries/langsmith/langsmith-cli-traces-datasets-threads|LangSmith CLI로 trace, dataset, thread를 터미널에서 바로 다루기]]

## Library / Workflow Reliability

- [[libraries/langgraph/retry-policy-node-retries|RetryPolicy로 일시 실패 노드만 안전하게 재시도하기]]
- [[libraries/langgraph/error-handler-recovery-routing|error_handler로 실패 후 보상 흐름과 대체 경로 만들기]]
- [[libraries/langgraph/deferred-node-cleanup-finalizers|defer=True로 cleanup, audit, notification을 run 마지막으로 미루기]]
- [[libraries/langgraph/recursion-limit-remaining-steps|recursion_limit과 RemainingSteps로 루프 안전장치 두기]]

## Library / Workflow Operations

- [[libraries/langgraph/graceful-shutdown-runcontrol-resume|RunControl로 graceful shutdown 후 안전하게 재개하기]]

## Library / Workflow Debugging

- [[libraries/langgraph/static-breakpoints-interrupt-before-after|static breakpoint로 노드 전후 실행을 멈춰 디버깅하기]]

## Library / Workflow Performance

- [[libraries/langgraph/cache-policy-node-caching|cache_policy로 비싼 노드 결과 재사용하기]]

## Library / Conversation Observability

- [[libraries/langsmith/langsmith-threads-query-sdk|thread_id로 멀티턴 대화 추적하고 SDK로 조회하기]]

## Library / Trace Analytics

- [[libraries/langsmith/langsmith-query-traces-sdk|list_runs, filter, trace_filter로 운영 trace를 정밀하게 조회하기]]

## Library / Experiment Analytics

- [[libraries/langsmith/langsmith-experiment-metrics-sdk|read_project(include_stats=True)로 experiment 지표 가져오기]]

## Library / Feedback & Review Ops

- [[libraries/langsmith/langsmith-annotation-queue-rubric-sdk|LangSmith annotation queue rubric을 코드로 관리하기]]

## Library / Agent Foundations

- [[libraries/langchain/create-deep-agent-quickstart|Deep Agents create_deep_agent로 planning, filesystem, subagent를 한 번에 붙이기]]
- [[libraries/langchain/custom-middleware-hooks-state-tools|custom middleware로 before_model, after_model, state_schema 묶어 에이전트 정책 넣기]]
- [[libraries/langchain/mcp-server-tools|MCP 서버 도구를 agent에 붙이기]]
- [[libraries/langchain/mcp-resources-prompts-interceptors|MCP resource, prompt, interceptor로 서버 문맥 연결하기]]
- [[libraries/langchain/custom-state-middleware|custom state와 middleware로 사용자별 컨텍스트 다루기]]
- [[libraries/langchain/create-agent-tool-calling|create_agent로 도구 호출 에이전트 시작하기]]
- [[libraries/langchain/short-term-memory|short-term memory로 대화 맥락 이어가기]]
- [[libraries/langchain/summarization-middleware|SummarizationMiddleware로 긴 대화를 요약 메모리로 압축하기]]
- [[libraries/langchain/structured-output-response-format|structured output으로 에이전트 응답 스키마 고정하기]]
- [[libraries/langchain/runtime-context-toolruntime|runtime context와 ToolRuntime으로 사용자별 설정 주입하기]]
- [[libraries/langchain/toolruntime-command-state-updates|ToolRuntime와 Command(update=...)로 tool에서 state 쓰기]]
- [[libraries/langchain/dynamic-prompt-system-instructions|dynamic_prompt로 상황별 system prompt 주입하기]]
- [[libraries/langchain/dynamic-model-selection-middleware|middleware로 동적 모델 선택과 도구 호출 제어하기]]
- [[libraries/langchain/dynamic-tool-selection|동적 도구 선택으로 프롬프트를 줄이고 권한을 나누기]]
- [[libraries/langchain/llm-tool-selector-middleware|LLMToolSelectorMiddleware로 많은 도구 중 필요한 것만 고르기]]
- [[libraries/langchain/provider-tool-search-middleware|ProviderToolSearchMiddleware로 provider 검색형 도구 지연 로딩하기]]
- [[libraries/langchain/todo-list-middleware|TodoListMiddleware로 복잡한 작업 계획 추적하기]]
- [[libraries/langchain/context-editing-clear-tool-outputs|ContextEditingMiddleware로 오래된 tool output 정리하기]]
- [[libraries/langchain/tool-retry-middleware|ToolRetryMiddleware로 실패하는 도구 호출 재시도하기]]
- [[libraries/langchain/tool-call-limit-middleware|ToolCallLimitMiddleware로 agent tool 호출 수 제한 걸기]]
- [[libraries/langchain/model-retry-middleware|ModelRetryMiddleware로 모델 호출 재시도하기]]
- [[libraries/langchain/long-term-memory-store|long-term memory로 사용자 선호 저장하고 다시 꺼내기]]
- [[libraries/langchain/pii-middleware-redaction-guardrails|PIIMiddleware로 입력과 출력의 민감정보 가드레일 두기]]
- [[libraries/langchain/user-interaction-patterns|에이전트는 사용자와 어떻게 상호작용할까]]
- [[libraries/langchain/human-in-the-loop-agent-approval|Human-in-the-Loop으로 에이전트 확인 단계 넣기]]

## Library / Agent Cost & Performance

- [[libraries/langchain/anthropic-prompt-caching-middleware|AnthropicPromptCachingMiddleware로 긴 system prompt 비용과 지연 줄이기]]

## Library / Agent Execution Environment

- [[libraries/langchain/shell-tool-middleware|ShellToolMiddleware로 agent에 지속형 셸 세션 붙이기]]
- [[libraries/langchain/filesystem-file-search-middleware|FilesystemFileSearchMiddleware로 코드베이스 glob/grep 검색 붙이기]]

## Library / Agent Guardrails

- [[libraries/langchain/model-call-limit-middleware|ModelCallLimitMiddleware로 에이전트 모델 호출 상한 걸기]]
- [[libraries/langchain/openai-moderation-middleware|OpenAIModerationMiddleware로 입력, 출력, tool 결과 안전성 검사하기]]

## Library / LangGraph Tool Execution

- [[libraries/langgraph/toolnode-command-state-updates|ToolNode로 tool 결과와 state 업데이트 함께 반영하기]]

## Library / LangGraph Foundations

- [[libraries/langgraph/store-cross-thread-long-term-memory|store로 cross-thread 장기 메모리 붙이기]]
- [[libraries/langgraph/checkpointer-persistence-threads|checkpointer로 thread 상태를 저장하고 같은 ID로 이어서 실행하기]]
- [[libraries/langgraph/add-messages-chat-history|add_messages로 채팅 히스토리를 안전하게 누적·교체·삭제하기]]
- [[libraries/langgraph/reducers-parallel-state-merges|reducer로 병렬 state update 안전하게 합치기]]
- [[libraries/langgraph/interrupt-human-approval-resume|interrupt()로 사람 확인 대기 후 Command(resume=...)로 재개하기]]
- [[libraries/langgraph/command-routing-state-updates|Command로 상태 업데이트와 라우팅을 한 번에 처리하기]]
- [[libraries/langgraph/input-output-private-state-schemas|input_schema, output_schema, private state로 공개 입력과 내부 상태 분리하기]]
- [[libraries/langgraph/functional-api-entrypoint-task-workflows|Functional API에서 @entrypoint와 @task로 replay-safe workflow 만들기]]

## Library / LangGraph Runtime & Observability

- [[libraries/langgraph/stream-mode-updates-messages-custom|stream()로 updates, messages, custom, debug 이벤트 흘려보내기]]
- [[libraries/langgraph/time-travel-replay-fork|time travel로 체크포인트 replay와 fork 디버깅하기]]

## Library / LangGraph Composition Patterns

- [[libraries/langgraph/send-dynamic-parallelism|Send로 동적 병렬 fan-out/map-reduce 처리하기]]
- [[libraries/langgraph/subgraph-persistence-modes-state-inspection|subgraph에서 checkpointer=None, True, False를 어떻게 고를까]]
- [[libraries/langgraph/subgraph-parent-handoff|subgraph에서 Command.PARENT로 부모 그래프로 handoff하기]]

## Library / Multi-Agent Patterns

- [[libraries/langchain/subagents-supervisor-pattern|subagents로 역할 분리한 에이전트 만들기]]
- [[libraries/langchain/supervisor-subagent-call-flow|supervisor가 subagent를 호출할 때 내부 로직은 어떻게 흐를까]]
- [[libraries/langchain/supervisor-subagent-router-pattern|supervisor는 subagent를 어떤 방식으로 고를까]]

## Training / MLOps

- [[blog/hydra-llm-sft-training-pipeline|Hydra로 LLM SFT 실험 설정 정리하기]]
