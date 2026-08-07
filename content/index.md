---
title: Junyoung Lee | AI Systems Engineer
---

# Junyoung Lee

AI Systems Engineer

Building AI systems that are fast, reliable, and useful in the real world.

## Focus

- LLM Systems
- Agent Systems
- AI Platform
- Vision
- Performance Optimization

## What I Build

- **Production LLM Platforms**  
  Kubernetes 기반 model serving, embedding, VectorDB, observability, deployment architecture를 다룹니다.

- **Agent & RAG Systems**  
  LangGraph, LangChain, LangSmith 기반 agent runtime, memory, evaluation, guardrails, streaming을 정리합니다.

- **High-performance Model Serving**  
  vLLM, GPU serving, batching, TTFT, throughput, benchmark 관점에서 AI 시스템 성능을 개선합니다.

- **Vision AI Systems**  
  medical image AI, detection, segmentation, edge AI 프로젝트를 실제 서비스 가능성 중심으로 다룹니다.

이 공간은 논문 요약만 모으는 곳이 아니라, 연구 아이디어를 실제 구현·평가·운영 가능한 시스템으로 바꾸는 과정을 기록하는 포트폴리오입니다.

## Projects

- [[10_projects/LLM-SFT-Training-Platform|LLM SFT Training Platform]]  
  Hydra 기반 설정 관리, QA 데이터셋, trainer 구조, 실험 추적을 묶어 LLM SFT 파이프라인을 정리한 프로젝트입니다.

- [[10_projects/Pressure-Ulcer-AI|Pressure Ulcer AI]]  
  욕창 분류와 병변 해석을 목표로 데이터 정리, 학습, 평가 흐름을 다룬 medical image AI 프로젝트입니다.

- [[10_projects/Fire-Detection-Robot|Fire Detection Robot]]  
  YOLO, Jetson, OpenCV 기반으로 edge 환경에서 화재 탐지를 다룬 프로젝트입니다.

## Study Notes

### Library Study Notes

- [[libraries/langgraph/store-ttl-memory-expiration|LangGraph Store TTL로 장기 메모리 만료 정책 운영하기]]<br>
  PostgresStore의 기본·항목별 TTL과 조회 갱신, sweeper 생명주기를 조합해 cross-thread 메모리를 자동 만료하는 방법을 정리했습니다.

- [[libraries/langchain/extended-model-response-state-updates|LangChain ExtendedModelResponse로 model call 결과와 state 함께 갱신하기]]<br>
  `wrap_model_call`에서 모델 응답을 보존하면서 token usage와 감사 메타데이터를 reducer 기반 agent state에 함께 누적하는 방법을 정리했습니다.

- [[libraries/langsmith/langsmith-trace-with-opentelemetry-python|LangSmith에 OpenTelemetry Python trace 보내기]]<br>
  LangChain 없이 만든 Python 서비스의 span을 OTLP로 보내고 입력·출력·token·metadata를 LangSmith run 필드에 매핑하는 방법을 정리했습니다.

- [[libraries/langsmith/langsmith-experiment-repetitions-concurrency-cache|LangSmith 평가 반복·동시성·캐시로 실험 비용과 분산 관리하기]]<br>

- [[libraries/langgraph/async-nodes-ainvoke-event-loop|LangGraph async 노드와 ainvoke로 I/O 병렬 처리하기]]<br>
  독립 I/O 노드를 같은 super-step에서 병렬 실행하고 이벤트 루프 블로킹을 피하는 패턴을 정리했습니다.

- [[libraries/langchain/runtime-tool-registration-middleware|LangChain runtime tool registration으로 실행 중 발견한 도구 연결하기]]<br>
  MCP, 데이터베이스, 외부 registry에서 실행 중 발견한 도구를 model 노출과 실제 실행 경로에 함께 연결하는 방법을 정리했습니다.

- [[libraries/langchain/runtime-execution-info-server-info|LangChain Runtime execution_info와 server_info로 실행 문맥 추적하기]]<br>
  도구와 middleware에서 thread, run, task, retry, 배포 인증 정보를 읽어 로그·멱등성·권한 검사를 구성하는 방법을 정리했습니다.

- [[libraries/langsmith/langsmith-production-trace-agent-backtesting|LangSmith 운영 trace로 새 agent 버전 backtest하기]]<br>
  실제 운영 입력과 기존 출력을 baseline experiment로 고정하고 새 agent를 같은 dataset에서 평가해 배포 전 회귀를 찾는 방법을 정리했습니다.

- [[libraries/langgraph/checkpoint-thread-retention-delete|LangGraph checkpoint를 thread 단위로 보존하고 삭제하기]]<br>
  자동 TTL을 기대하지 않고 완료된 thread의 checkpoint와 pending write를 안전하게 정리하는 운영 패턴을 정리했습니다.

- [[libraries/langgraph/subgraph-streaming-v2-namespaces|LangGraph subgraph 스트림을 v2 namespace로 라우팅하기]]<br>
  루트와 중첩 그래프의 update를 한 스트림에서 받고 namespace로 UI·로그 scope를 안전하게 나누는 방법을 정리했습니다.

- [[libraries/langsmith/langsmith-custom-cost-tracking-usage-metadata|LangSmith usage_metadata로 custom model과 tool 비용 추적하기]]<br>
  custom·self-hosted model의 token usage와 유료 tool 비용을 trace에 기록해 한곳에서 분석하는 방법을 정리했습니다.

- [[libraries/langchain/middleware-jump-to-agent-routing|LangChain middleware jump_to로 에이전트 루프 제어하기]]<br>
  `before_model`, `after_model`, `can_jump_to`를 조합해 agent를 조기 종료하거나 model과 tools 경로로 안전하게 재진입하는 방법을 정리했습니다.

- [[libraries/langgraph/pending-writes-parallel-failure-resume|LangGraph pending writes로 병렬 실패를 이어서 복구하기]]<br>
  같은 super-step의 성공한 node 출력을 보존하고 재개 시 실패한 node만 다시 실행하는 복구 패턴을 정리했습니다.

- [[libraries/langsmith/langsmith-local-evaluation-no-upload|LangSmith upload_results=False로 평가를 로컬에서만 실행하기]]<br>
  임시 experiment와 trace를 업로드하지 않고 evaluator를 검증하고 실패 사례를 CI quality gate로 쓰는 방법을 정리했습니다.

- [[libraries/langchain/dynamic-response-format-middleware|LangChain middleware로 상황별 response format 동적 선택하기]]<br>
  runtime context와 대화 상태를 기준으로 `response_format`을 선택하고 반환 타입·권한·middleware 순서를 안전하게 관리하는 방법을 정리했습니다.

- [[libraries/langsmith/langsmith-multi-turn-online-evaluators|LangSmith multi-turn online evaluator로 전체 대화 품질 평가하기]]<br>
  같은 `thread_id`의 여러 턴을 idle time 뒤 하나의 대화로 조립해 semantic outcome과 trajectory를 평가하는 운영 패턴을 정리했습니다.

- [[libraries/langgraph/state-snapshot-tasks-failure-diagnostics|LangGraph StateSnapshot.tasks로 실패 노드 진단하기]]<br>
  실패한 thread의 checkpoint에서 node별 error와 interrupt를 구분하고 안전한 복구 판단에 연결하는 방법을 정리했습니다.

- [[libraries/langchain/model-profiles-capability-gating|LangChain model profile로 모델 기능을 실행 전에 검사하기]]<br>
  context window, tool calling, structured output, multimodal 지원을 호출 전에 확인하고 capability fallback을 구성하는 방법을 정리했습니다.

- [[libraries/langchain/standard-content-blocks-cross-provider|LangChain content_blocks로 모델별 메시지를 같은 형식으로 다루기]]<br>
  OpenAI와 Anthropic의 text, reasoning, image 출력을 표준 블록으로 읽고 저장·UI 경계를 공급자에서 분리하는 방법을 정리했습니다.

- [[libraries/langgraph/graph-visualization-mermaid-png|LangGraph graph를 Mermaid와 PNG로 시각화하기]]
  조건부 라우팅을 정확히 표시하고 Mermaid 원문과 PNG를 문서·PR·CI에서 활용하는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-prompt-optimization-job-rest-api|LangSmith Prompt Optimization Job을 REST API로 자동화하기]]
  비동기 prompt optimization job을 시작하고 상태·로그를 폴링한 뒤 평가와 환경 승격으로 연결하는 흐름을 정리한 글입니다.

- [[libraries/langgraph/encrypted-checkpoint-serializer|LangGraph EncryptedSerializer로 checkpoint를 AES 암호화하기]]
  SQLite와 Postgres checkpoint payload를 저장 시점에 암호화하고 키 관리·회전·평문 migration에서 놓치기 쉬운 점을 정리한 글입니다.

- [[libraries/langsmith/langsmith-dataset-transformations-chat-model-schema|LangSmith dataset transformations로 운영 trace를 평가셋 형식으로 정규화하기]]
  Chat Model schema로 메시지와 tool 정의를 OpenAI 표준 형식으로 바꾸고, system prompt 제거 여부와 저장 결과 검증 기준을 정리한 글입니다.
- [[libraries/langchain/wrap-tool-call-error-handling|LangChain wrap_tool_call로 도구 오류를 안전하게 복구하기]]<br>
  `@wrap_tool_call`, `ToolMessage`, middleware 합성 순서를 이용해 도구 예외를 분류·마스킹하고 agent가 안전하게 복구하도록 만드는 패턴을 정리했습니다.

- [[libraries/langgraph/command-resume-vs-dict-thread-inputs|LangGraph 기존 thread에 새 입력을 넣을 때는 dict를 쓰고, interrupt 재개에만 Command(resume=...) 쓰기]]  
  checkpointer가 있는 thread에서 새 사용자 입력은 plain dict로 다시 시작하고, `Command(resume=...)`는 interrupt 재개에만 써야 하는 이유를 검증 예제로 정리한 글입니다.

- [[libraries/langsmith/langsmith-run-evals-rest-api|LangSmith REST API만으로 dataset 기반 evaluation 실행하기]]  
  SDK 없이 LangSmith REST API로 dataset example 조회, experiment(session) 생성, run 업로드, feedback 채점까지 묶는 실전 노트입니다.

- [[libraries/langgraph/overwrite-bypass-reducers-reset-state|LangGraph Overwrite로 reducer를 우회해 state를 리셋하기]]  
  reducer가 붙은 `messages`나 list channel을 특정 단계에서 완전 교체해야 할 때 `Overwrite`와 `__overwrite__`를 쓰는 패턴을 정리한 글입니다.

- [[libraries/langgraph/context-schema-runtime-context|LangGraph context_schema와 Runtime context로 요청별 설정 주입하기]]  
  `context_schema`, `Runtime[Context]`, `graph.invoke(..., context=...)`로 사용자 티어, locale, 모델 선택 같은 요청별 설정을 state 밖에서 다루는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-pairwise-annotation-queues|LangSmith pairwise annotation queue로 사람 A/B 리뷰 붙이기]]  
  comparative experiment와 pairwise annotation queue를 연결해 두 실험 출력을 사람 기준으로 빠르게 비교하는 방법을 정리한 글입니다.

- [[libraries/langchain/filesystem-middleware-agent-workspace|LangChain FilesystemMiddleware로 에이전트 작업 공간 붙이기]]  
  `FilesystemMiddleware`, `StateBackend`, `CompositeBackend`, `LangSmithSandbox`를 묶어 파일 작업 공간과 실행 환경을 붙이는 패턴을 정리한 글입니다.

- [[libraries/langgraph/interrupt-validation-loop-conditional-edges|LangGraph interrupt() 검증 루프를 while True 대신 conditional edge로 만들기]]  
  `interrupt()` 재개 규칙 때문에 validation loop를 Python `while True`가 아니라 state와 conditional edge로 설계하는 방법을 정리한 글입니다.

- [[libraries/langchain/rubric-middleware-self-evaluation|LangChain RubricMiddleware로 agent 결과를 자기검토하며 재시도하기]]  
  `RubricMiddleware`, grader 모델, 검증용 tool을 조합해 deep agent 출력에 런타임 합격 기준을 걸고 자동 재시도 루프를 만드는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-dashboards-alerts-monitoring|LangSmith dashboards와 alerts로 운영 trace 감시하기]]  
  dashboard와 alert를 이용해 에러율, latency, 비용, feedback score를 운영 지표로 감시하는 방법을 정리한 글입니다.

- [[libraries/langgraph/postgres-checkpointer-production|LangGraph PostgresSaver로 durable checkpointer 운영하기]]  
  `PostgresSaver`, `checkpointer.setup()`, `thread_id`, `interrupt()`를 묶어 운영 환경에서 thread 상태를 안전하게 이어가는 방법을 정리한 글입니다.

- [[libraries/langchain/tool-args-schema-validation|LangChain @tool과 args_schema로 도구 입력 스키마를 단단하게 만들기]]  
  `@tool`, `args_schema`, `parse_docstring`, `return_direct`를 기준으로 LangChain 도구 입력 검증과 설계 포인트를 정리한 글입니다.

- [[libraries/langsmith/langsmith-online-code-evaluators|LangSmith online code evaluator로 운영 trace 품질 가드레일 걸기]]  
  `perform_eval(run)`, evaluator filter, sampling, extended retention까지 묶어 운영 품질 체크를 거는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-manage-evaluators-sdk|LangSmith evaluators를 SDK로 생성·수정·비용 추적하기]]  
  evaluator를 workspace 자산처럼 관리하면서 prompt judge, code evaluator, spend 추적까지 묶는 운영 패턴을 정리했습니다.

- [[libraries/langsmith/langsmith-distributed-tracing-python|LangSmith 분산 tracing으로 서비스 간 trace 이어 붙이기]]  
  `get_current_run_tree()`, `to_headers()`, `TracingMiddleware`, `tracing_context(parent=...)`로 Python 서비스 사이 trace를 끊기지 않게 전파하는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-summary-evaluators-pass-rate-f1|LangSmith summary_evaluators로 pass rate와 F1 한 번에 집계하기]]  
  `evaluate()` 결과를 example 단위에서 끝내지 않고 experiment-level pass rate, F1, p95 latency로 묶는 방법을 정리한 글입니다.

- [[libraries/langchain/quickjs-code-interpreter-middleware|LangChain Deep Agents CodeInterpreterMiddleware로 agent 안에 QuickJS 계산 루프 넣기]]  
  QuickJS interpreter와 `CodeInterpreterMiddleware`, PTC, `mode="thread"` 상태 지속 범위를 실전 기준으로 정리한 글입니다.

- [[libraries/langgraph/delta-channel-checkpoint-storage|LangGraph DeltaChannel로 긴 thread checkpoint 크기 줄이기]]  
  `DeltaChannel`, bulk reducer, `snapshot_frequency`로 대화 기록 같은 append-heavy state의 checkpoint 저장량을 줄이는 방법을 정리한 글입니다.

- [[libraries/langgraph/update-state-manual-patching|LangGraph update_state()로 thread 상태를 수동 수정하고 이어서 실행하기]]  
  `get_state_history()`, `update_state()`, `as_node`를 이용해 체크포인트에서 분기 실행하고 테스트용 부분 실행을 빠르게 만드는 방법을 정리한 글입니다.

- [[libraries/langgraph/overwrite-bypass-reducers-reset-state|LangGraph Overwrite로 reducer를 우회해 state를 리셋하기]]  
  reducer가 붙은 누적 state를 특정 단계에서 새 기준값으로 갈아끼우고 싶을 때 `Overwrite`를 적용하는 패턴을 정리한 글입니다.

- [[libraries/langgraph/bulk-update-state-supersteps|LangGraph bulk_update_state()로 여러 superstep checkpoint를 한 번에 심기]]  
  `bulk_update_state()`, `get_state_history()`, `invoke(None, config)`를 묶어 여러 단계 checkpoint fixture를 만들고 뒤쪽 실행만 재개하는 방법을 정리한 글입니다.

- [[libraries/langchain/delete-messages-removemessage|LangChain RemoveMessage로 대화 기록 일부만 안전하게 지우기]]  
  `RemoveMessage`, `REMOVE_ALL_MESSAGES`, `after_model`, `before_model`을 써서 short-term memory를 직접 재구성하는 패턴을 정리한 글입니다.

- [[libraries/langchain/custom-guardrails-before-after-agent|LangChain custom guardrails로 before_agent와 after_agent 안전 레이어 넣기]]  
  `before_agent`에서 금지 요청을 조기 차단하고 `after_agent`에서 최종 응답을 재검사하는 실전 guardrail 패턴을 정리했습니다.

- [[libraries/langchain/server-side-tool-use|LangChain server-side tool use로 web_search를 provider 쪽에서 실행하기]]  
  provider 내장 web search를 `bind_tools`로 붙이고 `content_blocks`로 결과를 다루는 방법을 정리한 글입니다.

- [[libraries/langchain/deep-agents-composite-backend-workspace-memory|LangChain Deep Agents CompositeBackend로 workspace와 memory 분리하기]]  
  `CompositeBackend`, `StateBackend`, `FilesystemBackend`, `StoreBackend`를 조합해 thread별 scratch space와 cross-thread memory를 분리하는 패턴을 정리한 글입니다.

- [[libraries/langsmith/langsmith-evaluate-with-opentelemetry|LangSmith OpenTelemetry trace를 experiment로 평가하기]]  
  OpenTelemetry로 계측된 앱을 LangSmith experiment와 dataset example에 연결해 평가하는 패턴을 정리한 글입니다.

- [[libraries/langsmith/langsmith-upload-external-experiments-rest-api|LangSmith REST API로 외부 실험 결과 업로드하기]]  
  LangSmith 밖에서 끝난 평가 결과를 externally-managed dataset과 experiment로 올려 비교하는 방법을 정리한 글입니다.

- [[libraries/langgraph/set-node-defaults-graph-wide-fault-tolerance|LangGraph set_node_defaults()로 retry, timeout, error_handler 기본값 한 번에 깔기]]
  `set_node_defaults()`로 graph-wide retry, timeout, error handler 기본 정책을 선언하고 예외 노드만 override하는 패턴을 정리했습니다.

- [[libraries/langgraph/pydantic-state-validation-coercion|LangGraph Pydantic state로 입력 검증과 타입 coercion 붙이기]]
  외부 입력이 섞이는 그래프에서 `BaseModel` state로 validation, 기본값, 타입 coercion을 붙이는 기준을 정리했습니다.

- [[libraries/langchain/custom-stream-transformers|LangChain custom stream transformers로 stream_events v3 확장 채널 만들기]]
  `StreamTransformer`, `StreamChannel`, middleware `transformers` 등록으로 retrieval progress 같은 앱 전용 스트림 채널을 만드는 패턴을 정리했습니다.

- [[libraries/langgraph/durability-modes-sync-async-exit|LangGraph durability로 sync, async, exit를 언제 고를까]]
  checkpointer와 `durability` 옵션을 함께 써서 성능과 복구 가능성 사이의 균형을 잡는 기준을 정리했습니다.

- [[libraries/langchain/trim-messages-before-model|LangChain trim_messages로 context window 넘치기 전에 대화 기록 자르기]]  
  `before_model`, `trim_messages`, `RemoveMessage`를 조합해 긴 대화 히스토리를 최근 문맥 위주로 줄이는 패턴을 정리한 글입니다.

- [[libraries/langchain/handoffs-customer-support|LangChain handoffs로 고객지원 상태 전환 에이전트 만들기]]  
  `current_step`, `Command(update=...)`, middleware를 조합해 순차 제약이 있는 고객지원 에이전트를 구성하는 방법을 정리한 글입니다.

- [[libraries/langgraph/store-semantic-search-memory|LangGraph store semantic search로 장기 메모리 검색 붙이기]]
  `store.search(query=...)`와 embedding index로 여러 thread에 걸친 사용자 장기 메모리를 의미 기반으로 다시 찾는 패턴을 정리했습니다.

- [[libraries/langgraph/backward-compatibility-graph-migrations|LangGraph backward compatibility로 in-flight thread 안 깨고 그래프 변경하기]]
  checkpointer가 있는 운영 그래프를 바꿀 때 node rename, state schema 변경, versioned rollout을 어떻게 잡아야 하는지 정리했습니다.

- [[libraries/langsmith/langsmith-create-feedback-list-feedback|LangSmith create_feedback와 list_feedback으로 사용자 평가 수집하고 분석하기]]  
  `create_feedback()`, `list_feedback()`, `list_runs()`를 묶어 운영 중인 사용자 평가를 저장하고 다시 분석하는 흐름을 정리했습니다.

- [[libraries/langsmith/langsmith-custom-run-id-feedback|LangSmith custom run ID로 feedback과 조회 흐름 안정적으로 연결하기]]  
  `uuid7()`, `langsmith_extra={"run_id": ...}`, `trace(..., run_id=...)`, `create_feedback()`를 묶어 feedback과 trace를 안정적으로 연결하는 방법을 정리했습니다.

- [[libraries/langsmith/langsmith-prompt-webhooks-deploy-automation|LangSmith prompt webhook으로 프롬프트 배포 자동화하기]]
  `push_prompt`, `prompt-webhooks` API, `tag:update`, FastAPI 수신 서버를 묶어 프롬프트 배포 자동화를 구성하는 방법을 정리했습니다.

- [[libraries/langsmith/langsmith-feedback-formulas-sdk|LangSmith feedback formula로 여러 평가 점수를 composite metric으로 묶기]]  
  `create_feedback_formula()`, `list_feedback_formulas()`, `update_feedback_formula()`로 개별 평가 점수를 dataset 또는 experiment 단위 종합 점수로 묶는 방법을 정리했습니다.

- [[libraries/langsmith/langsmith-bulk-export-s3-parquet|LangSmith bulk export로 trace를 S3/Parquet로 내보내기]]  
  Smith API bulk export로 tracing project를 S3-compatible bucket에 Parquet로 적재하고 scheduled export까지 운영하는 방법을 정리했습니다.

- [[libraries/langgraph/parallel-interrupts-resume-map|LangGraph 병렬 interrupt를 ID 매핑으로 한 번에 재개하기]]  
  `stream.interrupts`와 `Interrupt.id`를 이용해 parallel branch의 승인 응답을 안전하게 재개하는 패턴을 정리했습니다.

- [[libraries/langgraph/toolruntime-toolnode-state-store-context|LangGraph ToolRuntime으로 ToolNode 안에서 state, store, context 함께 주입하기]]  
  `ToolRuntime`으로 `ToolNode` 안에서 graph state, user context, persistent store를 함께 읽고 `Command(update=...)`까지 안전하게 반영하는 패턴을 정리한 글입니다.

- [[libraries/langgraph/event-streaming-v3-projections|LangGraph event streaming v3로 상태, 토큰, interrupt를 한 스트림에서 다루기]]  
  `stream_events(..., version="v3")`에서 `stream.values`, `stream.messages`, raw protocol event, interrupt resume를 어떻게 나눠 쓰는지 정리한 글입니다.

- [[libraries/langgraph/timeout-policy-node-timeouts|LangGraph TimeoutPolicy로 느린 노드를 run_timeout, idle_timeout으로 끊기]]  
  `TimeoutPolicy`, `NodeTimeoutError`, `heartbeat`로 느리거나 멈춘 async 노드를 안전하게 제한하는 패턴을 정리한 글입니다.

- [[libraries/langchain/anthropic-prompt-caching-middleware|LangChain AnthropicPromptCachingMiddleware로 긴 system prompt 비용과 지연 줄이기]]  
  Claude agent에서 반복되는 system prompt, tool schema, 대화 prefix를 캐시해 비용과 지연을 줄이는 방법을 정리했습니다.

- [[libraries/langchain/headless-tools-client-execution|LangChain headless tools로 브라우저 전용 도구를 client에서 실행하기]]  
  Python agent에는 schema-only tool만 두고, React `useStream`에서 geolocation, localStorage 같은 브라우저 전용 도구를 실행하는 패턴을 정리했습니다.

- [[libraries/langchain/markdown-messages|LangChain markdown messages로 스트리밍 응답을 읽기 좋은 UI로 렌더링하기]]  
  `useStream`, `react-markdown`, code block highlighting을 조합해 assistant 메시지를 표, 리스트, 코드 블록까지 읽기 좋게 그리는 방법을 정리했습니다.

- [[libraries/langgraph/static-breakpoints-interrupt-before-after|LangGraph static breakpoint로 노드 전후 실행을 멈춰 디버깅하기]]  
  `interrupt_before`, `interrupt_after`로 노드 전후 state를 단계별로 확인하는 흐름을 정리했습니다.

- [[libraries/langsmith/langsmith-evaluate-with-attachments|LangSmith attachments로 멀티모달 evaluation 운영하기]]  
  dataset example에 PDF, image, audio attachment를 넣고 `evaluate()`에서 활용하는 패턴을 정리했습니다.
- [[libraries/langsmith/langsmith-annotation-queue-sdk|LangSmith annotation queue를 Python SDK로 운영하기]]  
  `create_feedback_config`, `create_annotation_queue`, `add_runs_to_annotation_queue`를 조합해 사람 리뷰 큐를 운영하는 흐름을 정리한 글입니다.

- [[libraries/langsmith/langsmith-assertions-offline-evals|LangSmith assertion으로 human review를 offline eval로 연결하기]]  
  single-run annotation queue에서 적은 assertions를 dataset example의 `reference_outputs["assertions"]`로 저장하고, 이를 여러 metric evaluator로 다시 채점하는 패턴을 정리했습니다.

- [[libraries/langsmith/langsmith-mask-sensitive-traces|LangSmith에서 민감정보를 가리고 trace는 남기는 방법]]  
  `hide_inputs`, `anonymizer`, `process_inputs`, `tracing_context`로 PII를 가리면서 trace 구조를 유지하는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-tracing-sampling-conditional|LangSmith tracing sampling? conditional tracing?? ??? ??? ?? ??]]  
  `LANGSMITH_TRACING_SAMPLING_RATE`, `Client(tracing_sampling_rate=...)`, `tracing_context(enabled=...)`? ??? ?? trace ??? ??? ???? ?? ???? ??? ??????.

- [[libraries/index|Library Study Notes]]  
  LangSmith, LangChain, LangGraph 라이브러리 학습 노트를 모아 둔 페이지입니다.

- [[libraries/langsmith/langsmith-retry-failed-evaluation-examples|LangSmith evaluation에서 실패한 example만 재시도하기]]  
  `list_runs`, `list_examples`를 이용해 실패한 evaluation example만 다시 실행하는 방법을 정리했습니다.

- [[libraries/langchain/custom-state-middleware|LangChain custom state와 middleware로 사용자별 컨텍스트 다루기]]  
  `create_agent`, `state_schema`, `ToolRuntime`를 묶어 사용자별 상태를 주입하는 패턴을 정리했습니다.
- [[libraries/langchain/mcp-adapters-multi-server-tools|LangChain MCP adapters? ?? MCP ?? ?? ????]]  
  `langchain-mcp-adapters`, `MultiServerMCPClient`, stateful session, HTTP header/auth ???? MCP ?? ??? ????? ??? ?? ??? ??? ????.

- [[libraries/langchain/toolruntime-stream-writer-progress|LangChain ToolRuntime.stream_writer로 도구 진행 상황 스트리밍하기]]  
  `stream_mode="custom"`과 `["updates", "custom"]`로 긴 tool 실행 중간 진행 상황을 사용자에게 보여주는 패턴을 정리했습니다.

- [[libraries/langchain/llm-tool-emulator-middleware|LangChain LLMToolEmulator로 실제 툴 없이 에이전트 흐름 테스트하기]]  
  `LLMToolEmulator()`로 환불, 메일, 외부 API 같은 부작용 툴을 에뮬레이션하고 로컬·CI에서 tool-calling 흐름을 빠르게 검증하는 방법을 정리했습니다.

### Library / Agent Streaming Basics

- [[libraries/langchain/agent-stream-events-messages-tool-calls|LangChain agent.stream_events()로 messages와 tool_calls를 함께 스트리밍하기]]  
  `stream_events(version="v3")`, `stream.interleave(...)`, `stream.output`, `stream_mode=["messages", "updates"]`를 기준으로 LangChain agent 스트리밍 기본 소비 패턴을 정리한 글입니다.

### Library / Structured Output & Extraction

- [[libraries/langchain/chatopenai-structured-output-json-schema|LangChain ChatOpenAI.with_structured_output()로 JSON Schema 강제하기]]  
  `with_structured_output(..., method="json_schema")`로 추출·분류 응답을 타입 안정적인 객체로 받고, tool calling과 함께 확장하는 패턴을 정리한 글입니다.
