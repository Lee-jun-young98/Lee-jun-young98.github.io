---
title: Junyoung AI Study Notes
---

# Junyoung AI Study Notes

AI 모델을 공부하고, 학습 파이프라인과 프로젝트로 검증하는 과정을 기록합니다.

현재는 LLM fine-tuning, computer vision, medical AI, generative AI, MLOps를 중심으로 공부하고 있습니다. 글은 완성된 결론보다 문제를 이해하고 실험으로 확인하는 흐름을 남기는 데 초점을 둡니다.

## Focus

- LLM fine-tuning과 SFT 학습 파이프라인
- Computer vision과 medical image AI
- Diffusion model, multimodal model, AI agent 논문 리뷰
- Docker, Hydra, GPU 서버, S3/MinIO 기반 실험 관리

## Projects

- [[10_projects/LLM-SFT-Training-Platform|LLM SFT Training Platform]]  
  Hydra 설정 기반으로 QA 데이터 전처리, 모델별 trainer, 평가, 산출물 업로드까지 이어지는 학습 파이프라인을 정리한 프로젝트입니다.

- [[10_projects/Pressure-Ulcer-AI|Pressure Ulcer AI]]  
  욕창 상처 이미지를 기반으로 단계 분류 모델을 설계하고, 의료 이미지 분류와 설명 가능성을 함께 검토한 프로젝트입니다.

- [[10_projects/Fire-Detection-Robot|Fire Detection Robot]]  
  YOLO 기반 화재/연기 객체 탐지 모델을 학습하고, Jetson/OpenCV 연동을 고려한 edge AI 프로젝트입니다.

## Study Notes

### Library Study Notes

- [[libraries/langsmith/langsmith-tracing-quickstart|LangSmith tracing 빠르게 붙이기: traceable과 wrap_openai 실전 예제]]  
  LangSmith에서 OpenAI 앱 실행 로그를 남기기 위한 최소 tracing 설정과 흔한 실수들을 정리한 글입니다.

### Library / Agent Foundations

- [[libraries/langchain/create-agent-tool-calling|LangChain create_agent로 도구 호출 에이전트 시작하기]]  
  LangChain v1의 create_agent를 기준으로 tool calling agent를 시작하는 방법을 정리한 글입니다.

- [[libraries/langchain/short-term-memory|LangChain short-term memory로 대화 맥락 유지하기]]  
  LangChain agent에서 checkpointer와 thread_id로 대화 맥락을 유지하는 방법을 정리한 글입니다.

- [[libraries/langchain/summarization-middleware|LangChain SummarizationMiddleware로 긴 대화를 요약 메모리로 압축하기]]  
  오래된 대화를 자동 요약해 state에 반영하고, 최근 메시지만 원문으로 유지하는 운영 패턴을 정리한 글입니다.

- [[libraries/langchain/structured-output-response-format|LangChain structured output으로 에이전트 응답 스키마 고정하기]]  
  `response_format`, `ProviderStrategy`, `ToolStrategy`로 안정적인 구조화 응답을 받는 방법을 정리한 글입니다.

- [[libraries/langchain/runtime-context-toolruntime|LangChain runtime context와 ToolRuntime으로 사용자별 설정 주입하기]]  
  사용자 정보, 권한, 팀 설정 같은 런타임 의존성을 agent와 tool에 안전하게 주입하는 방법을 정리한 글입니다.

- [[libraries/langchain/dynamic-model-selection-middleware|LangChain middleware로 동적 모델 선택과 도구 노출 제어하기]]  
  `wrap_model_call`로 비용 최적화와 권한별 도구 제어를 구현하는 방법을 정리한 글입니다.

- [[libraries/langchain/context-editing-clear-tool-outputs|LangChain ContextEditingMiddleware로 오래된 tool output 정리하기]]  
  긴 agent 대화에서 오래된 도구 출력만 정리해 비용과 컨텍스트 오염을 줄이는 방법을 정리한 글입니다.

- [[libraries/langchain/tool-retry-middleware|LangChain ToolRetryMiddleware로 실패하는 도구 호출 재시도하기]]  
  외부 API나 검색 도구의 일시적 실패를 agent 레이어에서 재시도하고 최종 실패 UX까지 설계하는 방법을 정리한 글입니다.

- [[libraries/langchain/user-interaction-patterns|LangChain 에이전트는 사용자와 어떻게 상호작용할까]]  
  메시지, 스트리밍, 도구 호출, 승인 단계, UI 연결 구조까지 포함해 사용자 상호작용 흐름을 정리한 글입니다.

- [[libraries/langchain/human-in-the-loop-agent-approval|LangChain Human-in-the-Loop으로 에이전트 승인 단계 넣기]]  
  위험한 도구 호출 전에 사람 승인을 넣는 흐름을 정리한 글입니다.

### Library / LangGraph Foundations

- [[libraries/langgraph/command-routing-state-updates|LangGraph Command로 상태 업데이트와 라우팅을 한 번에 처리하기]]
  상태 갱신과 다음 노드 분기를 한 노드 안에서 함께 처리하는 Graph API 패턴을 정리한 글입니다.

### Library / Multi-Agent Patterns

- [[libraries/langchain/subagents-supervisor-pattern|LangChain subagents로 역할 분리된 에이전트 만들기]]  
  supervisor와 subagent로 agent 책임을 나누는 패턴을 정리한 글입니다.

- [[libraries/langchain/supervisor-subagent-call-flow|LangChain supervisor가 subagent를 호출할 때 내부 로직은 어떻게 흐를까]]  
  supervisor의 tool call이 subagent invoke로 이어지는 내부 흐름을 정리한 글입니다.

- [[libraries/langchain/supervisor-subagent-router-pattern|LangChain supervisor는 subagent를 어떤 식으로 고를까]]  
  supervisor가 router처럼 어떤 subagent를 선택하는지와 라우팅 기준을 정리한 글입니다.

### Collections

- [[blog/index|Blog]]  
  공부 노트 형식의 블로그 글 모음입니다.

- [[libraries/index|Library Study Notes]]  
  LangSmith, LangChain, LangGraph 같은 라이브러리를 주제별로 묶어 정리한 모음 페이지입니다.

### Training / MLOps

- [[blog/hydra-llm-sft-training-pipeline|Hydra로 LLM SFT 실험 설정 정리하기]]  
  LLM 학습 프로젝트에서 설정을 구조화하며 배운 점을 정리한 글입니다.

### Paper Reviews

- [[papers/index|Paper Reviews]]  
  vision, generative AI, multimodal, agent, LLM 논문을 읽고 핵심 아이디어와 구현 관점을 정리합니다.

## Direction

저는 모델 자체를 이해하는 것에서 멈추지 않고, 데이터를 준비하고 실험을 재현하며 결과물을 운영 가능한 형태로 정리하는 AI engineer 방향을 목표로 공부하고 있습니다.

## Site

- [[About|About]]
