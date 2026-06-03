---
title: LangGraph
---

# LangGraph

LangGraph는 상태를 가진 workflow와 agent를 그래프 형태로 설계할 때 강한 제어력을 주는 라이브러리다.

처음에는 `StateGraph`, `Command`, `interrupt`, `checkpointer`처럼 실제 흐름을 바꾸는 핵심 도구부터 익히고, 이후에는 subgraph, durable execution, map-reduce 패턴으로 확장하는 흐름이 실전에서 가장 자연스럽다.

## 글 목록

- [[libraries/langgraph/interrupt-human-approval-resume|interrupt()로 사람 승인 대기 후 Command(resume=...)로 재개하기]]
- [[libraries/langgraph/command-routing-state-updates|Command로 상태 업데이트와 라우팅을 한 번에 처리하기]]
