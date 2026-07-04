---
title: Junyoung AI Study Notes
---

# Junyoung AI Study Notes

AI를 공부하고 실험하면서 직접 확인한 내용을 프로젝트와 스터디 노트 형태로 정리하는 공간입니다.

논문 요약만 모으기보다 실제 구현에서 바로 써볼 수 있는 agent, evaluation, training, vision 주제를 중심으로 정리합니다.

## Focus

- LLM fine-tuning, SFT 파이프라인, 실험 자동화
- Computer vision, medical image AI
- AI agent, evaluation, observability, workflow runtime
- Docker, Hydra, GPU, S3/MinIO 같은 운영 환경 구성

## Projects

- [[10_projects/LLM-SFT-Training-Platform|LLM SFT Training Platform]]  
  Hydra 기반 설정 관리, QA 데이터셋, trainer 구조, 실험 추적을 묶어 LLM SFT 파이프라인을 정리한 프로젝트입니다.

- [[10_projects/Pressure-Ulcer-AI|Pressure Ulcer AI]]  
  욕창 분류와 병변 해석을 목표로 데이터 정리, 학습, 평가 흐름을 다룬 medical image AI 프로젝트입니다.

- [[10_projects/Fire-Detection-Robot|Fire Detection Robot]]  
  YOLO, Jetson, OpenCV 기반으로 edge 환경에서 화재 탐지를 다룬 프로젝트입니다.

## Study Notes

### Library Study Notes

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

- [[libraries/langchain/toolruntime-stream-writer-progress|LangChain ToolRuntime.stream_writer로 도구 진행 상황 스트리밍하기]]  
  `stream_mode="custom"`과 `["updates", "custom"]`로 긴 tool 실행 중간 진행 상황을 사용자에게 보여주는 패턴을 정리했습니다.

- [[libraries/langchain/llm-tool-emulator-middleware|LangChain LLMToolEmulator로 실제 툴 없이 에이전트 흐름 테스트하기]]  
  `LLMToolEmulator()`로 환불, 메일, 외부 API 같은 부작용 툴을 에뮬레이션하고 로컬·CI에서 tool-calling 흐름을 빠르게 검증하는 방법을 정리했습니다.
