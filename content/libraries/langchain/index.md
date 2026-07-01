---
title: LangChain
---

# LangChain

LangChain 실전에서 바로 효과를 볼 만한 에이전트, 메모리, 미들웨어 패턴을 정리하는 공간입니다.

기본 `create_agent` 사용법에서 시작해 runtime context, dynamic prompt, model/tool middleware, multi-agent 흐름까지 한 단계씩 이어서 정리합니다.

## 글 목록

- [[libraries/langchain/create-deep-agent-quickstart|LangChain Deep Agents create_deep_agent로 planning, filesystem, subagent를 한 번에 붙이기]]
- [[libraries/langchain/custom-middleware-hooks-state-tools|LangChain custom middleware로 before_model, after_model, state_schema 묶어 에이전트 정책 넣기]]
- [[libraries/langchain/custom-state-middleware|LangChain custom state와 middleware로 사용자별 컨텍스트 다루기]]
- [[libraries/langchain/mcp-server-tools|LangChain에서 MCP 서버 도구를 agent에 붙이기]]
- [[libraries/langchain/mcp-resources-prompts-interceptors|LangChain MCP resource, prompt, interceptor로 서버 문맥 연결하기]]
- [[libraries/langchain/create-agent-tool-calling|create_agent로 도구 호출 에이전트 시작하기]]
- [[libraries/langchain/human-in-the-loop-agent-approval|Human-in-the-Loop으로 에이전트 확인 단계 넣기]]
- [[libraries/langchain/short-term-memory|short-term memory로 대화 맥락 이어가기]]
- [[libraries/langchain/trim-messages-before-model|trim_messages로 context window 넘치기 전에 대화 기록 자르기]]
- [[libraries/langchain/summarization-middleware|SummarizationMiddleware로 긴 대화를 요약 메모리로 압축하기]]
- [[libraries/langchain/structured-output-response-format|structured output으로 에이전트 응답 스키마 고정하기]]
- [[libraries/langchain/runtime-context-toolruntime|runtime context와 ToolRuntime으로 사용자별 설정 주입하기]]
- [[libraries/langchain/markdown-messages|markdown messages로 스트리밍 응답을 읽기 좋은 UI로 렌더링하기]]
- [[libraries/langchain/headless-tools-client-execution|headless tools로 브라우저 전용 도구를 client에서 실행하기]]
- [[libraries/langchain/toolruntime-stream-writer-progress|ToolRuntime.stream_writer로 도구 진행 상황 스트리밍하기]]
- [[libraries/langchain/toolruntime-command-state-updates|ToolRuntime와 Command(update=...)로 tool에서 state 쓰기]]
- [[libraries/langchain/dynamic-prompt-system-instructions|dynamic_prompt로 상황별 system prompt 주입하기]]
- [[libraries/langchain/anthropic-prompt-caching-middleware|AnthropicPromptCachingMiddleware로 긴 system prompt 비용과 지연 줄이기]]
- [[libraries/langchain/dynamic-model-selection-middleware|middleware로 동적 모델 선택과 도구 호출 제어하기]]
- [[libraries/langchain/dynamic-tool-selection|동적 도구 선택으로 프롬프트를 줄이고 권한도 나누기]]
- [[libraries/langchain/llm-tool-selector-middleware|LLMToolSelectorMiddleware로 많은 도구 중 필요한 것만 고르기]]
- [[libraries/langchain/llm-tool-emulator-middleware|LLMToolEmulator로 실제 툴 없이 에이전트 흐름 테스트하기]]
- [[libraries/langchain/provider-tool-search-middleware|ProviderToolSearchMiddleware로 provider 검색형 도구 지연 로딩하기]]
- [[libraries/langchain/shell-tool-middleware|ShellToolMiddleware로 agent에 지속형 셸 세션 붙이기]]
- [[libraries/langchain/filesystem-file-search-middleware|FilesystemFileSearchMiddleware로 코드베이스 glob/grep 검색 붙이기]]
- [[libraries/langchain/todo-list-middleware|TodoListMiddleware로 복잡한 작업 계획 추적하기]]
- [[libraries/langchain/context-editing-clear-tool-outputs|ContextEditingMiddleware로 오래된 tool output 정리하기]]
- [[libraries/langchain/model-call-limit-middleware|ModelCallLimitMiddleware로 에이전트 모델 호출 상한 걸기]]
- [[libraries/langchain/tool-retry-middleware|ToolRetryMiddleware로 실패하는 도구 호출 재시도하기]]
- [[libraries/langchain/tool-call-limit-middleware|ToolCallLimitMiddleware로 agent tool 호출 수 제한 걸기]]
- [[libraries/langchain/model-retry-middleware|ModelRetryMiddleware로 모델 호출 재시도하기]]
- [[libraries/langchain/model-fallback-middleware|ModelFallbackMiddleware로 모델 장애에 대비하기]]
- [[libraries/langchain/long-term-memory-store|long-term memory로 사용자 선호 저장하고 다시 꺼내기]]
- [[libraries/langchain/pii-middleware-redaction-guardrails|PIIMiddleware로 입력과 출력의 민감정보 가려내기]]
- [[libraries/langchain/openai-moderation-middleware|OpenAIModerationMiddleware로 입력, 출력, tool 결과 안전성 검사하기]]
- [[libraries/langchain/user-interaction-patterns|에이전트는 사용자와 어떻게 상호작용할까]]
- [[libraries/langchain/handoffs-customer-support|handoffs로 고객지원 상태 전환 에이전트 만들기]]
- [[libraries/langchain/subagents-supervisor-pattern|subagents로 역할 분리한 에이전트 만들기]]
- [[libraries/langchain/supervisor-subagent-call-flow|supervisor가 subagent를 호출할 때 내부 로직은 어떻게 될까]]
- [[libraries/langchain/supervisor-subagent-router-pattern|supervisor는 subagent를 어떤 방식으로 고를까]]
