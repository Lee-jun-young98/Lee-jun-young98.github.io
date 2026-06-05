---
title: LangChain
---

# LangChain

LangChain을 실전에서 쓰면서 자주 부딪히는 에이전트, 메모리, 미들웨어 패턴을 정리하는 공간입니다.

기본 `create_agent` 사용법부터 시작해서 runtime context, dynamic prompt, model/tool middleware, multi-agent 흐름까지 한 단계씩 이어서 정리합니다.

## 글 목록

- [[libraries/langchain/create-agent-tool-calling|create_agent로 도구 호출 에이전트 시작하기]]
- [[libraries/langchain/human-in-the-loop-agent-approval|Human-in-the-Loop으로 에이전트 승인 단계 넣기]]
- [[libraries/langchain/short-term-memory|short-term memory로 대화 맥락 유지하기]]
- [[libraries/langchain/summarization-middleware|SummarizationMiddleware로 긴 대화를 요약 메모리로 압축하기]]
- [[libraries/langchain/structured-output-response-format|structured output으로 에이전트 응답 스키마 고정하기]]
- [[libraries/langchain/runtime-context-toolruntime|runtime context와 ToolRuntime으로 사용자별 설정 주입하기]]
- [[libraries/langchain/dynamic-prompt-system-instructions|dynamic_prompt로 상황별 system prompt 주입하기]]
- [[libraries/langchain/dynamic-model-selection-middleware|middleware로 동적 모델 선택과 도구 노출 제어하기]]
- [[libraries/langchain/context-editing-clear-tool-outputs|ContextEditingMiddleware로 오래된 tool output 정리하기]]
- [[libraries/langchain/tool-retry-middleware|ToolRetryMiddleware로 실패하는 도구 호출 재시도하기]]
- [[libraries/langchain/tool-call-limit-middleware|ToolCallLimitMiddleware로 agent tool 호출 한도 걸기]]
- [[libraries/langchain/pii-middleware-redaction-guardrails|PIIMiddleware로 입력과 출력의 민감정보 가드레일 두기]]
- [[libraries/langchain/user-interaction-patterns|에이전트는 사용자와 어떻게 상호작용할까]]
- [[libraries/langchain/subagents-supervisor-pattern|subagents로 역할 분리된 에이전트 만들기]]
- [[libraries/langchain/supervisor-subagent-call-flow|supervisor가 subagent를 호출할 때 내부 로직은 어떻게 흐를까]]
- [[libraries/langchain/supervisor-subagent-router-pattern|supervisor는 subagent를 어떤 식으로 고를까]]
