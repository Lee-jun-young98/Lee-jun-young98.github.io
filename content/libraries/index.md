---
title: Library Study Notes
---

# Library Study Notes

라이브러리를 실제로 써 보면서 사용법과 운영 패턴을 정리한 노트 모음입니다.

지금은 LangChain, LangGraph, LangSmith를 중심으로 agent, memory, evaluation, observability 주제를 이어서 정리하고 있습니다.

## 목록

- [[libraries/langchain/index|LangChain]]
- [[libraries/langgraph/index|LangGraph]]
- [[libraries/langsmith/index|LangSmith]]

LangChain 섹션에서는 runtime context, ToolRuntime, middleware, multi-agent, memory 같은 실전 주제를 추적합니다.

### Recent LangGraph Notes

- [[libraries/langgraph/durability-modes-sync-async-exit|LangGraph durability로 sync, async, exit를 언제 고를까]]
- [[libraries/langgraph/store-semantic-search-memory|LangGraph store semantic search로 장기 메모리 검색 붙이기]]
- [[libraries/langgraph/backward-compatibility-graph-migrations|LangGraph backward compatibility로 in-flight thread 안 깨고 그래프 변경하기]]
- [[libraries/langgraph/parallel-interrupts-resume-map|LangGraph 병렬 interrupt를 ID 매핑으로 한 번에 재개하기]]
- [[libraries/langgraph/toolruntime-toolnode-state-store-context|LangGraph ToolRuntime으로 ToolNode 안에서 state, store, context 함께 주입하기]]

### Recent LangSmith Notes

- [[libraries/langsmith/langsmith-pytest-evals-ci|LangSmith pytest로 LLM eval과 회귀 테스트를 CI에 붙이기]]
- [[libraries/langsmith/langsmith-evaluate-with-attachments|LangSmith attachments로 멀티모달 evaluation 운영하기]]
- [[libraries/langsmith/langsmith-experiment-metrics-sdk|LangSmith read_project(include_stats=True)로 experiment 지표 가져오기]]

### Recent LangChain Notes

- [[libraries/langchain/trim-messages-before-model|trim_messages로 context window 넘치기 전에 대화 기록 자르기]]
- [[libraries/langchain/handoffs-customer-support|handoffs로 고객지원 상태 전환 에이전트 만들기]]
- [[libraries/langchain/markdown-messages|markdown messages로 스트리밍 응답을 읽기 좋은 UI로 렌더링하기]]
- [[libraries/langchain/headless-tools-client-execution|headless tools로 브라우저 전용 도구를 client에서 실행하기]]
- [[libraries/langchain/anthropic-prompt-caching-middleware|AnthropicPromptCachingMiddleware로 긴 system prompt 비용과 지연 줄이기]]
