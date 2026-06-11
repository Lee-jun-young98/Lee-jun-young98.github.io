---
title: LangGraph
---

# LangGraph

LangGraph는 상태를 가진 workflow와 agent를 그래프 형태로 설계하면서도, 세밀한 제어 흐름을 유지할 수 있게 해 주는 라이브러리다.

처음에는 `StateGraph`, `Command`, `interrupt`, `checkpointer`처럼 자주 마주치는 기본 도구부터 익히고, 이후에는 `Send`, subgraph, durable execution 같은 패턴으로 확장해 가는 흐름이 실전에서 가장 자연스럽다.

## 글 목록

### Foundations

- [[libraries/langgraph/checkpointer-persistence-threads|checkpointer로 thread 상태를 저장하고 같은 ID로 이어서 실행하기]]
- [[libraries/langgraph/add-messages-chat-history|add_messages로 채팅 히스토리를 안전하게 누적·교체·삭제하기]]
- [[libraries/langgraph/interrupt-human-approval-resume|interrupt()로 사람 승인 대기 후 Command(resume=...)로 재개하기]]
- [[libraries/langgraph/command-routing-state-updates|Command로 상태 업데이트와 라우팅을 한 번에 처리하기]]

### Runtime & Reliability

- [[libraries/langgraph/retry-policy-node-retries|RetryPolicy로 일시 실패 노드만 안전하게 재시도하기]]
- [[libraries/langgraph/stream-mode-updates-messages-custom|stream()으로 updates, messages, custom 이벤트 흘려보내기]]
- [[libraries/langgraph/time-travel-replay-fork|time travel로 체크포인트 replay와 fork 디버깅하기]]

### Composition Patterns

- [[libraries/langgraph/send-dynamic-parallelism|Send로 동적 병렬 fan-out/map-reduce 처리하기]]
- [[libraries/langgraph/subgraph-parent-handoff|subgraph에서 Command.PARENT로 부모 그래프로 handoff하기]]
