---
title: "ReAct: Synergizing Reasoning and Acting in Language Models"
date: 2026-05-23
tags:
  - "paper-review"
  - "LLM"
  - "Agent"
author: "Shunyu Yao, Jeffrey Zhao, Dian Yu, Nan Du, Izhak Shafran, Karthik Narasimhan, Yuan Cao"
journal: "ICLR 2023"
paper: "https://arxiv.org/abs/2210.03629"
aliases:
  - "/papers/react-synergizing-reasoning-and-acting"
---

# 한 줄 요약

ReAct는 LLM이 생각만 길게 하는 Chain-of-Thought나 행동만 수행하는 방식에서 벗어나, reasoning trace와 external action을 번갈아 생성하게 만든 agent prompting 방법이다.

# Introduction

기존 LLM prompting은 크게 두 흐름으로 나뉜다. 하나는 Chain-of-Thought처럼 모델 내부의 추론 과정을 유도하는 방식이고, 다른 하나는 WebGPT나 API 호출처럼 외부 환경에서 행동을 수행하게 하는 방식이다.

문제는 둘 중 하나만으로는 한계가 있다는 점이다. Reasoning-only 방식은 외부 정보를 갱신할 수 없고, action-only 방식은 왜 그런 행동을 선택했는지 추적하기 어렵다. ReAct는 이 둘을 하나의 루프에 넣어 모델이 생각하고, 행동하고, 관찰하고, 다시 생각하도록 만든다.

# Related Work

ReAct는 Chain-of-Thought prompting, tool-using language model, embodied decision making 연구 흐름 위에 있다.

Chain-of-Thought는 모델이 중간 추론을 만들게 해서 복잡한 문제를 더 잘 풀게 하지만, 외부 세계와 상호작용하지 않는다. 반대로 web navigation이나 interactive environment agent는 행동을 통해 정보를 얻지만, 내부 계획과 오류 수정 과정이 불투명할 수 있다.

ReAct는 reasoning과 acting을 분리된 기능으로 보지 않고, 서로를 보완하는 한 쌍으로 본다. Reasoning은 계획을 만들고 예외 상황을 처리하며, action은 외부 지식이나 환경 관찰을 가져와 reasoning을 업데이트한다.

# Method

ReAct의 기본 포맷은 단순하다.

```text
Thought: 현재 문제를 어떻게 풀지 생각한다.
Action: 검색, API 호출, 환경 행동 같은 외부 행동을 수행한다.
Observation: 행동 결과를 관찰한다.
Thought: 관찰 결과를 반영해 다음 계획을 수정한다.
```

핵심은 이 구조를 few-shot prompt로 보여주면, 별도의 모델 구조 변경 없이 LLM이 reasoning-action-observation 루프를 따라가도록 만들 수 있다는 점이다.

예를 들어 질문 답변 태스크에서는 모델이 바로 답을 내는 대신 검색 행동을 수행하고, 검색 결과를 관찰한 뒤 답을 보정한다. ALFWorld나 WebShop 같은 환경에서는 행동 결과가 다음 관찰로 들어오고, 모델은 그 결과를 바탕으로 다음 action을 고른다.

# Experiments

논문은 ReAct를 두 종류의 태스크에서 평가한다.

- Knowledge-intensive QA: HotpotQA, Fever 등 외부 지식이 필요한 질문 답변
- Decision making: ALFWorld, WebShop처럼 순차 행동이 필요한 환경

비교 대상은 reasoning-only, acting-only, imitation/reinforcement learning 기반 방법들이다. 논문은 ReAct가 QA에서는 hallucination을 줄이고, decision making에서는 행동 성공률과 해석 가능성을 높인다고 보고한다.

# Result

ReAct의 장점은 성능만이 아니라 디버깅 가능성에 있다. Thought, Action, Observation이 명시적으로 남기 때문에 모델이 왜 특정 행동을 했는지 추적할 수 있다.

또한 reasoning이 action selection을 돕고, observation이 reasoning을 갱신하는 구조라서 긴 작업에서 오류를 고칠 여지가 생긴다. 이 점 때문에 이후 LangChain, LlamaIndex, OpenAI tool calling 기반 agent 설계에서도 ReAct 스타일 루프가 기본 패턴처럼 쓰이게 되었다.

# 한계

ReAct는 prompt 기반 방법이기 때문에 모델이 포맷을 안정적으로 따르지 못하면 루프가 깨질 수 있다. 또한 잘못된 observation을 받거나, action space가 모호한 환경에서는 잘못된 행동을 반복할 수 있다.

실제 서비스에 적용하려면 다음 보완이 필요하다.

- action schema를 명확하게 제한하기
- observation을 짧고 구조화해서 제공하기
- 실패 횟수와 중단 조건을 두기
- memory와 tool result cache를 붙이기

# Takeaway

ReAct는 AI agent 논문 흐름에서 가장 먼저 읽어야 할 논문 중 하나다. 이유는 간단하다. 이후 agent 시스템에서 반복적으로 등장하는 planner, tool call, observation, retry loop의 기본 형태를 아주 간결하게 보여주기 때문이다.

Voyager, Reflexion, Toolformer, SWE-agent 같은 논문을 읽을 때도 ReAct를 기준점으로 두면 각 논문이 무엇을 추가했는지 보기 쉬워진다.

# 출처

- [arXiv: ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)
- [Google Research Blog: ReAct](https://research.google/blog/react-synergizing-reasoning-and-acting-in-language-models/)
