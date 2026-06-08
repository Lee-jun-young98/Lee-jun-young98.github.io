---
title: Junyoung AI Study Notes
---

# Junyoung AI Study Notes

AI 모델을 공부하고, 실험과 프로젝트로 검증한 내용을 기록합니다.

완성된 결과만 모으기보다 실제로 막힌 지점, 다시 확인한 개념, 구현과 바로 연결되는 패턴을 중심으로 정리합니다.

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

- [[libraries/langsmith/langsmith-tracing-quickstart|LangSmith tracing 빠르게 붙이기: traceable과 wrap_openai 실전 예제]]  
  LangSmith에서 OpenAI 호출을 추적하기 위한 최소 tracing 설정과 흔한 실수를 정리한 글입니다.

- [[libraries/langsmith/langsmith-dataset-splits-version-tags|LangSmith dataset split과 version tag로 평가셋 고정하기]]  
  dataset example을 split과 metadata로 나누고 version tag를 붙여 재현 가능한 평가셋을 운영하는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-annotation-queues-sdk|LangSmith annotation queue로 사람 검토 흐름 만들기]]  
  review rubric과 feedback config를 고정하고 실패 run을 queue로 모아 사람 검토를 운영하는 방법을 정리한 글입니다.

- [[libraries/langsmith/langsmith-prompt-commit-tags-cache|LangSmith prompt commit tag로 프로젝트 배포 고정하기]]  
  `push_prompt`, `pull_prompt`, commit tag, prompt cache를 묶어 코드 수정 없이 프로젝트 버전을 배포하는 방법을 정리한 글입니다.

### Library / Agent Foundations

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

- [[libraries/langchain/dynamic-prompt-system-instructions|LangChain dynamic_prompt로 상황별 system prompt 주입하기]]  
  `dynamic_prompt`로 사용자 역할, 대화 길이, 선호에 따라 system prompt를 호출마다 조립하는 패턴을 정리한 글입니다.

- [[libraries/langchain/dynamic-model-selection-middleware|LangChain middleware로 동적 모델 선택과 도구 호출 제어하기]]  
  `wrap_model_call`로 비용 최적화와 권한별 도구 호출 제어를 구현하는 방법을 정리한 글입니다.

- [[libraries/langchain/context-editing-clear-tool-outputs|LangChain ContextEditingMiddleware로 오래된 tool output 정리하기]]  
  긴 agent 대화에서 오래된 도구 출력만 정리해 컨텍스트 비용을 줄이는 방법을 정리한 글입니다.

- [[libraries/langchain/tool-retry-middleware|LangChain ToolRetryMiddleware로 실패하는 도구 호출 재시도하기]]  
  외부 API와 검색 도구의 일시 실패를 재시도하고 최종 실패 UX까지 설계하는 방법을 정리한 글입니다.

- [[libraries/langchain/tool-call-limit-middleware|LangChain ToolCallLimitMiddleware로 agent tool 호출 수 제한 걸기]]  
  `run_limit`, `thread_limit`, `tool_name`, `exit_behavior`로 도구 사용량을 제한해 비용 폭주와 루프를 막는 방법을 정리한 글입니다.

- [[libraries/langchain/model-retry-middleware|LangChain ModelRetryMiddleware로 모델 호출 재시도하기]]  
  `retry_on`, `on_failure`, exponential backoff로 일시적인 provider 실패를 복구하고 모델 내부 `max_retries`와 역할을 나누는 방법을 정리한 글입니다.

- [[libraries/langchain/pii-middleware-redaction-guardrails|LangChain PIIMiddleware로 입력과 출력의 민감정보 가드레일 두기]]  
  `redact`, `mask`, `block`, custom detector와 `apply_to_input`/`apply_to_tool_results`/`apply_to_output`을 조합해 민감정보 경계를 두는 방법을 정리한 글입니다.

- [[libraries/langchain/user-interaction-patterns|LangChain 에이전트는 사용자와 어떻게 상호작용할까]]  
  메시지, 스트리밍, 도구 호출, 확인 단계, UI 연결 구조까지 포함한 사용자 상호작용 패턴을 정리한 글입니다.

- [[libraries/langchain/human-in-the-loop-agent-approval|LangChain Human-in-the-Loop으로 에이전트 확인 단계 넣기]]  
  위험한 도구 호출 전에 사람 확인을 넣는 흐름을 정리한 글입니다.

### Library / LangGraph Foundations

- [[libraries/langgraph/time-travel-replay-fork|LangGraph time travel로 체크포인트 replay와 fork 디버깅하기]]  
  `get_state_history`, `update_state`, `as_node`를 기준으로 과거 체크포인트를 재실행하거나 새 분기로 실험하는 방법을 정리한 글입니다.

- [[libraries/langgraph/subgraph-parent-handoff|LangGraph subgraph에서 Command.PARENT로 부모 그래프로 handoff하기]]  
  `StateGraph`를 계층화하고 subgraph 안의 중간 결과를 부모 graph의 다음 단계로 넘기는 패턴을 정리한 글입니다.

- [[libraries/langgraph/send-dynamic-parallelism|LangGraph Send로 동적 병렬 fan-out/map-reduce 처리하기]]  
  `Send`와 reducer를 함께 써서 입력 개수에 따라 병렬 작업을 펼치고 결과를 안전하게 모으는 패턴을 정리한 글입니다.

- [[libraries/langgraph/interrupt-human-approval-resume|LangGraph interrupt()로 사람 확인 대기 후 Command(resume=...)로 재개하기]]  
  사람 확인 단계가 필요한 workflow에서 checkpointer, `thread_id`, resume 흐름을 어떻게 연결하는지 정리한 글입니다.

- [[libraries/langgraph/command-routing-state-updates|LangGraph Command로 상태 업데이트와 라우팅을 한 번에 처리하기]]  
  Graph API에서 상태 갱신과 다음 노드 분기를 한 번에 처리하는 패턴을 정리한 글입니다.

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

## Direction

모델 자체를 이해하는 것에서 멈추지 않고, 데이터를 준비하고 실험을 재현하며 결과물을 운영 가능한 형태로 정리하는 AI engineer 방향을 목표로 공부하고 있습니다.

## Site

- [[About|About]]
