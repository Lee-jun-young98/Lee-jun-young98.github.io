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

- [[libraries/langgraph/timeout-policy-node-timeouts|LangGraph TimeoutPolicy로 느린 노드를 run_timeout, idle_timeout으로 끊기]]  
  `TimeoutPolicy`, `NodeTimeoutError`, `heartbeat`로 느리거나 멈춘 async 노드를 안전하게 제한하는 패턴을 정리한 글입니다.

- [[libraries/langchain/anthropic-prompt-caching-middleware|LangChain AnthropicPromptCachingMiddleware로 긴 system prompt 비용과 지연 줄이기]]  
  Claude agent에서 반복되는 system prompt, tool schema, 대화 prefix를 캐시해 비용과 지연을 줄이는 방법을 정리했습니다.

- [[libraries/langgraph/static-breakpoints-interrupt-before-after|LangGraph static breakpoint로 노드 전후 실행을 멈춰 디버깅하기]]  
  `interrupt_before`, `interrupt_after`로 노드 전후 state를 단계별로 확인하는 흐름을 정리했습니다.

- [[libraries/langsmith/langsmith-evaluate-with-attachments|LangSmith attachments로 멀티모달 evaluation 운영하기]]  
  dataset example에 PDF, image, audio attachment를 넣고 `evaluate()`에서 활용하는 패턴을 정리했습니다.

- [[libraries/langsmith/langsmith-retry-failed-evaluation-examples|LangSmith evaluation에서 실패한 example만 재시도하기]]  
  `list_runs`, `list_examples`를 이용해 실패한 evaluation example만 다시 실행하는 방법을 정리했습니다.

- [[libraries/langchain/custom-state-middleware|LangChain custom state와 middleware로 사용자별 컨텍스트 다루기]]  
  `create_agent`, `state_schema`, `ToolRuntime`를 묶어 사용자별 상태를 주입하는 패턴을 정리했습니다.
