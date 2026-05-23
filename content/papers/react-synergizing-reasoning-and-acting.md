---
title: "ReAct: LLM 에이전트는 어떻게 생각하고 행동하는가"
description: ReAct 논문을 Abstract, Introduction, Related Work, Method, Experiments, Results 흐름으로 정리한 AI Agent 논문 리뷰 노트
date: 2026-05-23
tags:
  - paper-review
  - ai-agent
  - react
  - llm
---

# ReAct: LLM 에이전트는 어떻게 생각하고 행동하는가

읽은 논문은 Shunyu Yao 외 저자의 **ReAct: Synergizing Reasoning and Acting in Language Models**다.  
AI agent의 기본 루프인 reasoning, action, observation 구조를 이해하기 위해 첫 번째 리뷰 논문으로 골랐다.

- 논문: [arXiv:2210.03629](https://arxiv.org/abs/2210.03629)
- 저자: Shunyu Yao, Jeffrey Zhao, Dian Yu, Nan Du, Izhak Shafran, Karthik Narasimhan, Yuan Cao
- 발표: arXiv 2022, ICLR 2023
- 키워드: LLM agent, reasoning, acting, tool use, observation, prompting

## 1. Abstract 요약

이 논문은 LLM의 두 능력인 reasoning과 acting을 하나의 루프 안에서 결합하는 ReAct를 제안한다.

기존 연구에서는 Chain-of-Thought 같은 reasoning 방식과 action plan generation 같은 acting 방식이 주로 따로 연구되었다. ReAct는 모델이 추론 문장과 실제 행동을 번갈아 생성하게 한다. 추론은 현재 상황을 이해하고 계획을 업데이트하는 데 쓰이고, 행동은 외부 지식베이스나 환경에서 추가 정보를 얻는 데 쓰인다.

논문은 ReAct를 지식 기반 질의응답, 사실 검증, 상호작용 의사결정 태스크에 적용했다. HotpotQA와 FEVER에서는 Wikipedia API를 사용해 hallucination과 error propagation 문제를 줄였고, ALFWorld와 WebShop에서는 기존 imitation learning, reinforcement learning 방식보다 높은 성공률을 보였다고 보고한다.

## 2. Introduction 요약

Introduction의 문제의식은 명확하다. LLM은 언어 이해와 추론에서는 강력하지만, 외부 세계와 상호작용하면서 문제를 해결하는 능력은 아직 제한적이다.

논문은 기존 접근을 크게 두 가지로 본다.

첫째, reasoning 중심 접근이다. Chain-of-Thought prompting은 중간 추론 과정을 생성하게 해 복잡한 문제에서 성능을 높인다. 하지만 모델 내부 지식에 의존하기 때문에 사실 오류나 hallucination이 생길 수 있고, 한번 잘못된 추론이 나오면 뒤 단계로 전파될 수 있다.

둘째, acting 중심 접근이다. 모델이 외부 환경에서 행동을 선택하거나 계획을 생성하는 방식이다. 하지만 행동만 있고 명시적인 추론 과정이 부족하면 왜 그런 행동을 했는지 해석하기 어렵고, 복잡한 상황에서 계획을 수정하기 어렵다.

ReAct의 목표는 이 둘을 결합하는 것이다. 모델은 `Thought`로 상황을 추론하고, `Action`으로 외부 환경에 개입하고, `Observation`으로 결과를 받은 뒤 다시 다음 `Thought`를 만든다.

## 3. Related Work 요약

이 논문의 Related Work는 크게 네 흐름과 연결된다.

첫째, LLM의 reasoning 능력이다. Chain-of-Thought prompting처럼 모델이 답만 내는 것이 아니라 중간 추론 과정을 생성하게 하는 연구가 배경이 된다.

둘째, language model을 이용한 decision making이다. 모델이 텍스트 기반 환경에서 행동을 선택하거나 계획을 세우는 연구들이 여기에 해당한다.

셋째, tool use와 external knowledge access다. LLM이 외부 검색, 지식베이스, API 등을 사용하면 모델 내부 지식만으로 답할 때보다 최신성이나 정확성을 보완할 수 있다.

넷째, interpretability다. ReAct의 trajectory는 Thought, Action, Observation이 드러나기 때문에 모델이 어떤 판단 흐름으로 답에 도달했는지 비교적 추적하기 쉽다.

## 4. Method / Approach 요약

ReAct의 기본 형식은 다음과 같다.

```text
Question: ...
Thought: ...
Action: ...
Observation: ...
Thought: ...
Action: ...
Observation: ...
Answer: ...
```

모델은 few-shot 예시를 보고 이 패턴을 따라간다. 핵심은 추론과 행동이 분리된 단계가 아니라 서로 영향을 주는 반복 구조라는 점이다.

`Thought`는 현재 문제 상태를 해석하고 다음에 무엇을 해야 할지 결정하는 역할을 한다. `Action`은 검색, 지식베이스 조회, 환경 조작 같은 외부 행동이다. `Observation`은 행동 결과로 돌아온 정보다.

논문은 ReAct를 단순한 prompt engineering 이상의 agent trajectory 형식으로 다룬다. 모델은 한 번에 정답을 말하지 않고, 필요한 정보를 얻기 위해 행동하고 그 결과로 추론을 수정한다.

## 5. Experiments 요약

논문은 크게 두 종류의 태스크에서 실험한다.

첫째, knowledge-intensive reasoning tasks다. HotpotQA와 FEVER가 사용된다. 이 태스크들은 질문에 답하거나 사실 여부를 검증하기 위해 외부 지식이 중요하다. ReAct는 Wikipedia API를 호출하면서 필요한 정보를 찾아 답을 구성한다.

둘째, interactive decision making tasks다. ALFWorld와 WebShop이 사용된다. ALFWorld는 텍스트 기반 가정 환경에서 목표를 달성하는 태스크이고, WebShop은 온라인 쇼핑 환경에서 조건에 맞는 상품을 찾는 태스크다.

비교 대상은 Chain-of-Thought, Act-only 방식, imitation learning, reinforcement learning 기반 방법 등이다. 논문은 ReAct가 reasoning-only와 acting-only의 약점을 보완하는지 확인한다.

## 6. Results 요약

HotpotQA와 FEVER에서는 ReAct가 외부 Wikipedia API와 상호작용하면서 hallucination을 줄이고, 잘못된 추론이 이어지는 문제를 완화한다. Chain-of-Thought는 그럴듯한 추론을 만들 수 있지만 외부 사실 확인이 없으면 틀린 방향으로 진행될 수 있다. ReAct는 관찰 결과를 통해 중간 판단을 수정할 수 있다.

ALFWorld와 WebShop에서는 ReAct가 적은 수의 in-context example만으로도 강한 성능을 보인다. arXiv abstract에 따르면 ALFWorld에서는 기존 imitation/reinforcement learning 방법보다 34%p, WebShop에서는 10%p 높은 success rate를 보였다.

결과의 핵심은 ReAct가 단순히 성능만 올리는 것이 아니라 trajectory의 해석 가능성도 높인다는 점이다. 사람이 Thought, Action, Observation의 흐름을 보면서 모델이 어디서 잘했거나 틀렸는지 확인할 수 있다.

## 7. Limitations / Discussion

ReAct는 agent 구조의 중요한 출발점이지만 몇 가지 한계가 있다.

첫째, prompt 기반 방식이기 때문에 모델이 항상 안정적으로 올바른 행동을 선택한다고 보장하기 어렵다.

둘째, 환경이나 도구의 설계가 중요하다. Action space가 복잡하거나 Observation이 지저분하면 모델의 판단도 흔들릴 수 있다.

셋째, 장기 기억이나 반복 학습 구조는 약하다. 한 문제 안에서 관찰을 반영할 수는 있지만, 여러 번의 실패 경험을 체계적으로 축적하는 구조는 Reflexion 같은 후속 연구에서 더 직접적으로 다뤄진다.

넷째, Thought를 그대로 노출하는 방식은 서비스 환경에서는 비용, 지연 시간, 보안 문제를 만들 수 있다.

## 8. 내가 이해한 핵심

ReAct의 핵심은 "LLM agent는 생각만 해서도 안 되고, 행동만 해서도 안 된다"는 점이다.

생각만 하는 모델은 외부 사실을 확인하지 못해 hallucination에 취약하다. 행동만 하는 모델은 왜 그런 행동을 하는지 추적하기 어렵고, 계획을 고치기 어렵다. ReAct는 이 둘을 번갈아 수행하면서 agent의 기본 루프를 만든다.

AI agent를 구현할 때 이 논문은 거의 기본 문법처럼 볼 수 있다.

```text
Reason about the task
Use a tool or interact with the environment
Read the result
Update the plan
Repeat until done
```

## 9. 다음에 연결해서 읽을 논문

- Toolformer: Language Models Can Teach Themselves to Use Tools
- Reflexion: Language Agents with Verbal Reinforcement Learning
- Voyager: An Open-Ended Embodied Agent with Large Language Models
