---
title: Junyoung AI Study Notes
---

# Junyoung AI Study Notes

AI 모델을 공부하고, 실험과 프로젝트로 검증한 내용을 기록합니다.

완성된 결과만 모으기보다 실제로 막힌 지점, 다시 확인한 개념, 구현과 바로 연결되는 판단을 중심으로 정리합니다.

## Focus

- LLM fine-tuning과 SFT 실험 파이프라인
- Computer vision과 medical image AI
- Diffusion model, multimodal model, AI agent 설계 및 구현
- Docker, Hydra, GPU 서버, S3/MinIO 기반 실험 관리

## Projects

- [[10_projects/LLM-SFT-Training-Platform|LLM SFT Training Platform]]  
  Hydra 설정 기반으로 QA 데이터 전처리부터 모델별 trainer, 평가, 결과물 업로드까지 이어지는 학습 파이프라인을 정리한 프로젝트입니다.

- [[10_projects/Pressure-Ulcer-AI|Pressure Ulcer AI]]  
  욕창 상처 이미지를 기반으로 4단계 분류 모델을 설계하고, 의료 이미지 분류와 설명 가능성을 함께 검토한 프로젝트입니다.

- [[10_projects/Fire-Detection-Robot|Fire Detection Robot]]  
  YOLO 기반 객체 탐지 모델을 학습하고 Jetson/OpenCV 연동까지 고려한 edge AI 프로젝트입니다.

## Study Notes

### Library Study Notes

- [[libraries/langsmith/langsmith-evaluate-with-attachments|LangSmith attachments濡?硫?고え??evaluation ?댁쁺?섍린]]  
  dataset example??PDF, image, audio attachment瑜?遺숈씠怨?`evaluate()`?먯꽌 `attachments`瑜?諛쏆븘 ?ㅼ젣 硫?고え??target/evaluator瑜??뚮━?뒗 ?먮쫫???뺣━??湲?낅땲??

- [[libraries/langsmith/langsmith-pairwise-evaluation-experiments|LangSmith pairwise evaluation으로 두 실험을 비교하기]]  
  `evaluate()`로 만든 두 experiment를 `randomize_order`, `runs`, pairwise score mapping 기준으로 비교하는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-retry-failed-evaluation-examples|LangSmith evaluation에서 실패한 example만 재시도하기]]  
  `error_handling="ignore"`, `list_runs`, `list_examples`, `experiment=results.experiment_name`으로 실패한 evaluation example만 다시 실행하는 패턴을 정리한 글입니다.

- [[libraries/langsmith/langsmith-offline-evaluation-quickstart|LangSmith offline evaluation quickstart with dataset and evaluate()]]  
  Build a small LangSmith regression eval set with `evaluate()` and metadata filtering.

- [[libraries/langsmith/langsmith-tracing-quickstart|LangSmith tracing 빠르게 붙이기: traceable과 wrap_openai 실전 예제]]  
  LangSmith에서 OpenAI 호출을 추적하기 위한 최소 tracing 설정과 흔한 실수를 정리한 글입니다.

- [[libraries/langsmith/langsmith-dataset-splits-version-tags|LangSmith dataset split과 version tag로 평가셋 고정하기]]  
  dataset example를 split과 metadata로 나누고 version tag를 붙여 재현 가능한 평가셋을 운영하는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-annotation-queues-sdk|LangSmith annotation queue로 사람 검토 흐름 만들기]]  
  review rubric과 feedback config를 고정하고 실패 run을 queue로 모아 사람 검토를 운영하는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-presigned-feedback-tokens|LangSmith presigned feedback token으로 프론트엔드 평가 수집하기]]  
  `create_feedback()`, presigned token URL, child run 피드백을 조합해 사용자 평가를 안전하게 수집하는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-prompt-commit-tags-cache|LangSmith prompt commit tag로 프롬프트 배포 고정하기]]  
  `push_prompt`, `pull_prompt`, commit tag, prompt cache를 묶어 코드 수정 없이 프롬프트 버전을 배포하는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-automation-rules-webhooks|LangSmith automation rule과 webhook으로 운영 점검 자동화하기]]  
  automation rule, online evaluator, annotation queue, webhook을 분리해서 운영 품질 점검 흐름을 자동화하는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-threads-query-sdk|LangSmith thread_id로 멀티턴 대화 추적하고 SDK로 조회하기]]
  `thread_id`, `uuid7()`, `list_threads`, `read_thread`를 기준으로 멀티턴 대화 세션을 추적하고 다시 조회하는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-query-traces-sdk|LangSmith list_runs로 운영 trace를 정밀하게 조회하기]]
  `list_runs`, `filter`, `trace_filter`, `tree_filter`, `read_run(load_child_runs=True)`를 조합해 운영 trace를 좁혀 보고 export하는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-experiment-metrics-sdk|LangSmith read_project(include_stats=True)로 experiment 지표 가져오기]]
  `evaluate()` 결과의 `experiment_name`과 `read_project(include_stats=True)`를 조합해 latency, cost, token, feedback 통계를 조회하는 방법을 정리한 글입니다.
- [[libraries/langsmith/langsmith-annotation-queue-rubric-sdk|LangSmith annotation queue rubric을 코드로 관리하기]]  
  `create_feedback_config()`와 `create_annotation_queue()`로 사람 검토 rubric을 코드로 관리하고 automation과 연결하는 흐름을 정리한 글입니다.

- [[libraries/index|Library Study Notes]]  
  LangSmith, LangChain, LangGraph 중심 라이브러리 학습 노트를 모아 둔 페이지입니다.

### Library / Agent Foundations

- [[libraries/langchain/create-deep-agent-quickstart|LangChain Deep Agents `create_deep_agent`로 planning, filesystem, subagent를 한 번에 붙이기]]  
  `create_deep_agent`, `checkpointer`, `thread_id`, `subagents`, `excluded_tools` 기준으로 Deep Agents 하네스를 빠르게 붙이는 방법을 정리한 글입니다.

- [[libraries/langchain/custom-middleware-hooks-state-tools|LangChain custom middleware로 before_model, after_model, state_schema 묶어 에이전트 정책 넣기]]  
  `before_model`, `after_model`, `state_schema`, middleware tool을 묶어 agent 정책을 재사용 가능한 단위로 구성하는 방법을 정리한 글입니다.

- [[libraries/langchain/mcp-server-tools|LangChain에서 MCP 서버 도구를 agent에 붙이기]]  
  `client.get_tools()`, `client.session(...)`, `handle_tool_errors=False` 기준으로 MCP 도구 연동 패턴을 정리한 글입니다.

- [[libraries/langchain/mcp-resources-prompts-interceptors|LangChain MCP resource, prompt, interceptor로 서버 문맥 연결하기]]  
  `get_resources()`, `get_prompt()`, structured content artifact, tool interceptor로 서버 문맥을 agent에 주입하는 방법을 정리한 글입니다.

- [[libraries/langchain/create-agent-tool-calling|LangChain create_agent로 도구 호출 에이전트 시작하기]]  
  LangChain v1의 `create_agent`를 기준으로 tool calling agent를 시작하는 방법을 정리한 글입니다.

- [[libraries/langchain/short-term-memory|LangChain short-term memory로 대화 맥락 이어가기]]  
  checkpointer와 `thread_id`로 대화 상태를 이어 가는 방법을 정리한 글입니다.

- [[libraries/langchain/summarization-middleware|LangChain SummarizationMiddleware로 긴 대화를 요약 메모리로 압축하기]]  
  긴 대화의 오래된 메시지를 요약 상태로 압축하고 최근 문맥만 남기는 패턴을 정리한 글입니다.

- [[libraries/langchain/structured-output-response-format|LangChain structured output으로 에이전트 응답 스키마 고정하기]]  
  `response_format`, `ProviderStrategy`, `ToolStrategy`로 안정적인 구조화 응답을 받는 방법을 정리한 글입니다.

- [[libraries/langchain/runtime-context-toolruntime|LangChain runtime context와 ToolRuntime으로 사용자별 설정 주입하기]]  
  사용자 정보, 권한, 기타 설정값을 agent와 tool에 주입하는 방법을 정리한 글입니다.

- [[libraries/langchain/toolruntime-command-state-updates|LangChain ToolRuntime와 Command(update=...)로 tool에서 state 쓰기]]  
  `runtime.state`, `runtime.context`, `Command(update=...)`, `ToolMessage`를 조합해 tool이 short-term memory를 직접 갱신하는 방법을 정리한 글입니다.

- [[libraries/langchain/dynamic-prompt-system-instructions|LangChain dynamic_prompt로 상황별 system prompt 주입하기]]  
  `dynamic_prompt`로 사용자 역할, 대화 길이, 선호에 따라 system prompt를 호출마다 조립하는 패턴을 정리한 글입니다.

- [[libraries/langchain/dynamic-model-selection-middleware|LangChain middleware로 동적 모델 선택과 도구 호출 제어하기]]  
  `wrap_model_call`로 비용 최적화와 권한별 도구 호출 제어를 구현하는 방법을 정리한 글입니다.

- [[libraries/langchain/dynamic-tool-selection|LangChain 동적 도구 선택으로 프롬프트를 줄이고 권한을 나누기]]  
  `wrap_model_call`과 `request.override(tools=...)`로 런타임마다 필요한 도구만 노출해 정확도, 비용, 권한 제어를 함께 개선하는 패턴을 정리한 글입니다.

- [[libraries/langchain/llm-tool-selector-middleware|LangChain LLMToolSelectorMiddleware로 많은 도구 중 필요한 것만 고르기]]  
  작은 선택 모델을 앞단에 두고 질의마다 필요한 도구만 남겨 agent의 비용과 정확도를 함께 관리하는 패턴을 정리한 글입니다.

- [[libraries/langchain/provider-tool-search-middleware|LangChain ProviderToolSearchMiddleware로 provider 검색형 도구 지연 로딩하기]]  
  지원 provider의 server-side tool search를 활용해 일부 도구를 필요할 때만 노출하는 LangChain 패턴을 정리한 글입니다.

- [[libraries/langchain/filesystem-file-search-middleware|LangChain FilesystemFileSearchMiddleware로 코드베이스 glob/grep 검색 붙이기]]  
  `glob_search`, `grep_search`, `root_path`, `use_ripgrep` 기준으로 코드베이스 탐색형 agent 패턴을 정리한 글입니다.

- [[libraries/langchain/todo-list-middleware|LangChain TodoListMiddleware로 복잡한 작업 계획 추적하기]]  
  `write_todos` 도구 자동 주입, 계획 추적, 커스텀 prompt, 운영성 middleware 조합을 정리한 글입니다.

- [[libraries/langchain/context-editing-clear-tool-outputs|LangChain ContextEditingMiddleware로 오래된 tool output 정리하기]]  
  긴 agent 대화에서 오래된 도구 출력만 정리해 비용과 컨텍스트 오염을 줄이는 방법을 정리한 글입니다.

- [[libraries/langchain/tool-retry-middleware|LangChain ToolRetryMiddleware로 실패하는 도구 호출 재시도하기]]  
  외부 API와 검색 도구의 일시 실패를 재시도하고 최종 실패 UX까지 설계하는 방법을 정리한 글입니다.

- [[libraries/langchain/tool-call-limit-middleware|LangChain ToolCallLimitMiddleware로 agent tool 호출 수 제한 걸기]]  
  `run_limit`, `thread_limit`, `tool_name`, `exit_behavior`로 도구 사용량을 제한해 비용 폭주와 루프를 막는 방법을 정리한 글입니다.

- [[libraries/langchain/model-retry-middleware|LangChain ModelRetryMiddleware로 모델 호출 재시도하기]]  
  `retry_on`, `on_failure`, exponential backoff로 일시적인 provider 실패를 복구하고 모델 내부 `max_retries`와 역할을 나누는 방법을 정리한 글입니다.

- [[libraries/langchain/long-term-memory-store|LangChain long-term memory로 사용자 선호 저장하고 다시 꺼내기]]  
  `store`, `ToolRuntime`, `context_schema`를 연결해 세션 밖 사용자 선호를 저장하고 다시 읽는 장기 메모리 패턴을 정리한 글입니다.

- [[libraries/langchain/pii-middleware-redaction-guardrails|LangChain PIIMiddleware로 입력과 출력의 민감정보 가드레일 두기]]  
  `redact`, `mask`, `block`, custom detector와 `apply_to_input`/`apply_to_tool_results`/`apply_to_output`을 조합해 민감정보 경계를 두는 방법을 정리한 글입니다.

- [[libraries/langchain/user-interaction-patterns|LangChain 에이전트는 사용자와 어떻게 상호작용할까]]  
  메시지, 스트리밍, 도구 호출, 확인 단계, UI 연결 구조까지 포함한 사용자 상호작용 패턴을 정리한 글입니다.

- [[libraries/langchain/human-in-the-loop-agent-approval|LangChain Human-in-the-Loop으로 에이전트 확인 단계 넣기]]  
  위험한 도구 호출 전에 사람 확인을 넣는 흐름을 정리한 글입니다.

### Library / Agent Guardrails

- [[libraries/langchain/model-call-limit-middleware|LangChain ModelCallLimitMiddleware로 에이전트 모델 호출 상한 걸기]]  
  `run_limit`, `thread_limit`, `exit_behavior`, `checkpointer`를 기준으로 과도한 모델 호출과 무한 루프를 막는 방법을 정리한 글입니다.

### Library / Workflow Reliability

- [[libraries/langgraph/retry-policy-node-retries|LangGraph RetryPolicy로 일시 실패 노드만 안전하게 재시도하기]]  
  `RetryPolicy`, `retry_on`, `max_attempts`, backoff를 기준으로 외부 API/LLM 노드의 일시 실패만 재시도하는 방법을 정리한 글입니다.

- [[libraries/langgraph/error-handler-recovery-routing|LangGraph error_handler로 실패 후 보상 흐름과 대체 경로 만들기]]  
  `error_handler`, `NodeError`, `Command`, `RetryPolicy`를 기준으로 최종 실패 뒤 수동 검토, fallback, 보상 경로를 graph 안에서 처리하는 방법을 정리한 글입니다.

- [[libraries/langgraph/deferred-node-cleanup-finalizers|LangGraph defer=True로 정리 작업을 run 마지막으로 미루기]]  
  `defer=True`를 기준으로 branch 길이가 달라도 cleanup, audit, notification 같은 후처리를 마지막에 한 번만 실행하는 패턴을 정리한 글입니다.

### Library / Workflow Operations

- [[libraries/langgraph/graceful-shutdown-runcontrol-resume|LangGraph RunControl로 graceful shutdown 후 안전하게 재개하기]]  
  `RunControl`, `GraphDrained`, `thread_id`, `invoke(None, config)`를 묶어 배포/점검 시점에 workflow를 superstep 경계에서 멈추고 이어서 실행하는 방법을 정리한 글입니다.

### Library / Workflow Performance

- [[libraries/langgraph/cache-policy-node-caching|LangGraph cache_policy로 비싼 노드 결과 재사용하기]]  
  `CachePolicy`, `InMemoryCache`, `SqliteCache`, `key_func`, `ttl`을 기준으로 반복 계산을 줄이고 캐시 적중률을 관리하는 방법을 정리한 글입니다.

### Library / LangGraph Foundations

- [[libraries/langgraph/checkpointer-persistence-threads|LangGraph checkpointer로 thread 상태를 저장하고 이어서 실행하기]]
  `thread_id`, `get_state()`, `get_state_history()`, saver 선택 기준을 묶어 durable execution의 시작점을 정리한 글입니다.

- [[libraries/langgraph/store-cross-thread-long-term-memory|LangGraph store로 cross-thread 장기 메모리 붙이기]]
  `store`, `Runtime`, `context_schema`, semantic search를 기준으로 thread 밖 사용자 메모리를 저장하고 재사용하는 패턴을 정리한 글입니다.

- [[libraries/langgraph/add-messages-chat-history|LangGraph add_messages로 채팅 히스토리를 안전하게 누적하고 수정하기]]
  `MessagesState`, `RemoveMessage`, `Overwrite`를 기준으로 채팅형 그래프의 메시지 상태를 append, replace, delete하는 패턴을 정리한 글입니다.

- [[libraries/langgraph/reducers-parallel-state-merges|LangGraph reducer로 병렬 state update 안전하게 합치기]]
  `Annotated[..., reducer]`, `operator.add`, `INVALID_CONCURRENT_GRAPH_UPDATE`, `update_state()` 기준으로 병렬 state 병합 규칙을 정리한 글입니다.

- [[libraries/langgraph/interrupt-human-approval-resume|LangGraph interrupt()로 사람 확인 대기 후 Command(resume=...)로 재개하기]]  
  사람 확인 단계가 필요한 workflow에서 checkpointer, `thread_id`, resume 흐름을 어떻게 연결하는지 정리한 글입니다.

- [[libraries/langgraph/command-routing-state-updates|LangGraph Command로 상태 업데이트와 라우팅을 한 번에 처리하기]]  
  Graph API에서 상태 갱신과 다음 노드 분기를 한 번에 처리하는 패턴을 정리한 글입니다.

- [[libraries/langgraph/input-output-private-state-schemas|LangGraph input_schema, output_schema, private state로 공개 입력과 내부 상태 분리하기]]
  `input_schema`, `output_schema`, private channel을 사용해 외부 계약과 내부 워크플로 상태를 분리하고 `stream(values)` 노출 범위를 관리하는 패턴을 정리한 글입니다.

- [[libraries/langgraph/functional-api-entrypoint-task-workflows|LangGraph Functional API로 @entrypoint와 @task workflow 만들기]]
  `@entrypoint`, `@task`, `thread_id`, `invoke(None, config=...)`를 묶어 기존 Python 제어 흐름에 replay-safe persistence를 붙이는 패턴을 정리한 글입니다.

- [[libraries/langgraph/toolnode-command-state-updates|LangGraph ToolNode로 tool 결과와 state 업데이트 함께 반영하기]]
  `ToolNode`, `ToolMessage`, `Command(update=...)`, `InjectedToolCallId`를 묶어 tool 호출과 state 갱신을 안전하게 연결하는 패턴을 정리한 글입니다.

### Library / LangGraph Runtime & Observability

- [[libraries/langgraph/stream-mode-updates-messages-custom|LangGraph stream()으로 updates, messages, custom 이벤트 흘려보내기]]
  `version="v2"` 기준으로 `updates`, `values`, `messages`, `custom`, `tasks`, `debug`를 언제 쓰는지 실전 예제로 정리한 글입니다.

- [[libraries/langgraph/time-travel-replay-fork|LangGraph time travel로 체크포인트 replay와 fork 디버깅하기]]  
  `get_state_history`, `update_state`, `as_node`를 기준으로 과거 체크포인트를 재실행하거나 새 분기로 실험하는 방법을 정리한 글입니다.

### Library / LangGraph Composition Patterns

- [[libraries/langgraph/send-dynamic-parallelism|LangGraph Send로 동적 병렬 fan-out/map-reduce 처리하기]]  
  `Send`와 reducer를 함께 써서 입력 개수에 따라 병렬 작업을 펼치고 결과를 안전하게 모으는 패턴을 정리한 글입니다.

- [[libraries/langgraph/subgraph-persistence-modes-state-inspection|LangGraph subgraph에서 checkpointer=None, True, False를 어떻게 고를까]]  
  per-invocation, per-thread, stateless 세 mode와 nested state inspection, namespace 충돌 함정을 정리한 글입니다.

- [[libraries/langgraph/subgraph-parent-handoff|LangGraph subgraph에서 Command.PARENT로 부모 그래프로 handoff하기]]  
  `StateGraph`를 계층화하고 subgraph 안의 중간 결과를 부모 graph의 다음 단계로 넘기는 패턴을 정리한 글입니다.

### Library / Multi-Agent Patterns

- [[libraries/langchain/subagents-supervisor-pattern|LangChain subagents로 역할 분리한 에이전트 만들기]]  
  supervisor와 subagent로 책임을 나누는 패턴을 정리한 글입니다.

- [[libraries/langchain/supervisor-subagent-call-flow|LangChain supervisor가 subagent를 호출할 때 내부 로직은 어떻게 흐를까]]  
  supervisor의 tool call이 subagent invoke로 이어지는 내부 호출 흐름을 정리한 글입니다.

- [[libraries/langchain/supervisor-subagent-router-pattern|LangChain supervisor는 subagent를 어떤 방식으로 고를까]]  
  supervisor가 router처럼 어떤 subagent를 선택하는지 기준을 정리한 글입니다.

### Collections

- [[blog/index|Blog]]  
  공부 노트를 성격별로 묶어 둔 글 모음입니다.

- [[libraries/index|Library Study Notes]]  
  LangSmith, LangChain, LangGraph 같은 라이브러리계 노트를 모아 둔 페이지입니다.

### Training / MLOps

- [[blog/hydra-llm-sft-training-pipeline|Hydra로 LLM SFT 실험 설정 정리하기]]  
  LLM 학습 프로젝트에서 설정을 구조화하며 배운 점을 정리한 글입니다.

### Paper Reviews

- [[papers/index|Paper Reviews]]  
  vision, generative AI, multimodal, agent, LLM 논문을 읽고 구현 관점을 정리합니다.

### Library / Agent Safety & Moderation

- [[libraries/langchain/openai-moderation-middleware|LangChain OpenAIModerationMiddleware로 입력, 출력, tool 결과 안전성 검사하기]]  
  `check_input`, `check_output`, `check_tool_results`, `exit_behavior`를 기준으로 사용자 입력과 모델 문맥 전체에 안전성 검사를 거는 방법을 정리한 글입니다.

## Direction

모델 자체를 이해하는 것에서 멈추지 않고, 데이터를 준비하고 실험을 재현하며 결과물을 운영 가능한 형태로 정리하는 AI engineer 방향을 목표로 공부하고 있습니다.

## Site

- [[About|About]]
