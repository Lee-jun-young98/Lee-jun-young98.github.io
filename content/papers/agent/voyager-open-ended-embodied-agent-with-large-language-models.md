---
title: "Voyager: An Open-Ended Embodied Agent with Large Language Models"
date: 2026-05-25
thumbnail: "/papers/assets/agent/voyager-components.png"
socialImage: "https://lee-jun-young98.github.io/papers/assets/agent/voyager-components.png"
tags:
  - "paper-review"
  - "Agent"
  - "LLM"
  - "Embodied AI"
author: "Guanzhi Wang, Yuqi Xie, Yunfan Jiang, Ajay Mandlekar, Chaowei Xiao, Yuke Zhu, Linxi Fan, Anima Anandkumar"
journal: "arXiv 2023"
paper: "https://arxiv.org/abs/2305.16291"
project: "https://voyager.minedojo.org/"
---

![](/papers/assets/agent/voyager-components.png)

# 한 줄 요약

Voyager는 Minecraft 환경에서 LLM을 단순한 응답 생성기가 아니라, 스스로 목표를 만들고 코드를 실행하며 실패 피드백을 반영하고 성공한 행동을 스킬 라이브러리에 저장하는 lifelong agent로 구성한 논문이다.

# Introduction

이 논문의 문제의식은 open-ended environment에서 agent가 정해진 태스크 하나만 푸는 것이 아니라, 계속 탐색하고 새로운 행동을 배우며 누적된 지식을 다음 문제에 재사용할 수 있어야 한다는 점이다.

기존 강화학습이나 imitation learning은 low-level action을 직접 학습하는 경우가 많아 Minecraft처럼 목표가 다양하고 장기 계획이 필요한 환경에서는 탐색 비용이 크다. 반면 LLM은 월드 지식과 코드 생성 능력을 갖고 있으므로, 환경 상태를 읽고 실행 가능한 프로그램을 만들어 행동하게 할 수 있다.

Voyager의 핵심 질문은 다음과 같다.

- LLM이 스스로 다음 목표를 정할 수 있는가?
- 실패한 코드를 환경 피드백으로 고칠 수 있는가?
- 성공한 행동을 재사용 가능한 skill로 저장할 수 있는가?
- 이렇게 누적된 skill이 새로운 world/task에서도 전이되는가?

# Related Work

논문이 기대는 흐름은 크게 세 가지다.

첫째, ReAct나 Reflexion처럼 reasoning과 acting을 반복하는 LLM agent 연구다. 이런 방법들은 LLM이 생각, 행동, 관찰을 오가며 문제를 풀게 하지만, 장기적으로 축적되는 skill memory가 약하다.

둘째, AutoGPT류의 autonomous agent 흐름이다. 목표를 쪼개고 도구를 호출하는 방식은 유용하지만, 환경 피드백을 안정적으로 반영하거나 성공한 행동을 구조화된 라이브러리로 남기는 부분은 충분히 강하지 않다.

셋째, embodied AI와 Minecraft benchmark다. Minecraft는 crafting, navigation, combat, resource gathering이 모두 섞여 있어 agent가 장기 계획과 재사용 가능한 행동 단위를 배워야 하는 환경이다.

# Method

Voyager는 세 모듈로 구성된다.

## Automatic Curriculum

Automatic curriculum은 agent가 다음에 무엇을 할지 정하는 모듈이다. 단순히 사람이 정한 목표를 수행하는 것이 아니라, 현재 상태와 이미 달성한 진행 상황을 보고 탐색을 넓힐 수 있는 다음 task를 제안한다.

예를 들어 agent가 숲에 있으면 나무를 캐고 crafting table을 만드는 일이 자연스럽고, 사막에 있으면 cactus나 sand를 수집하는 일이 더 적절할 수 있다. 이처럼 curriculum은 환경과 진행도에 맞춰 다음 목표를 생성한다.

## Skill Library

Skill library는 성공한 행동을 executable code 형태로 저장하는 메모리다. Voyager는 low-level action sequence 대신 JavaScript 코드로 행동을 표현한다. 이 방식의 장점은 하나의 skill이 시간적으로 긴 행동을 담을 수 있고, 나중에 비슷한 상황에서 검색해 재사용할 수 있다는 것이다.

새로운 task가 주어지면 Voyager는 task description과 유사한 기존 skill을 검색하고, 필요한 경우 여러 skill을 조합해 더 복잡한 행동을 만든다. 이 구조 덕분에 catastrophic forgetting을 줄이고 능력을 누적할 수 있다.

## Iterative Prompting

Iterative prompting은 실패한 코드를 고치는 루프다. LLM이 코드를 생성하면 Minecraft 환경에서 실행하고, 실행 에러나 환경 피드백을 다시 프롬프트에 넣어 코드를 수정한다. 여기에 self-verification을 붙여 task가 실제로 성공했는지 LLM critic이 확인한다.

즉 Voyager의 실행 루프는 다음처럼 볼 수 있다.

1. 현재 상태를 보고 다음 목표를 정한다.
2. 관련 skill을 검색한다.
3. LLM이 실행 코드를 작성한다.
4. 환경에서 실행한다.
5. 실패하면 에러와 관찰 결과로 코드를 수정한다.
6. 성공하면 skill library에 저장한다.

# Experiments

실험은 Minecraft에서 진행되며, Voyager를 AutoGPT, ReAct, Reflexion 등과 비교한다. 평가는 단순 reward 하나가 아니라 다음 축으로 본다.

- 얼마나 다양한 unique item을 발견하는가
- Minecraft tech tree를 얼마나 빨리 unlock하는가
- 얼마나 넓은 map area를 탐색하는가
- 학습한 skill library가 새로운 world/task에 전이되는가

논문과 프로젝트 페이지에 따르면 Voyager는 160 prompting iterations 동안 63개 unique item을 발견했고, baseline 대비 3.3배 더 많은 unique item을 얻었다. 또한 map traversal은 2.3배 길었고, tech tree milestone은 최대 15.3배 빠르게 unlock했다.

# Result

결과적으로 Voyager의 강점은 "LLM을 agent brain으로 썼다" 자체보다, LLM 주변에 기억과 실행 피드백 구조를 잘 붙였다는 데 있다.

특히 skill library가 중요하다. 단발성 prompting agent는 매 task마다 거의 처음부터 다시 생각하지만, Voyager는 성공한 코드를 계속 축적한다. 이 누적 메모리 덕분에 새로운 world에서도 이전 skill을 검색해 활용할 수 있다.

Ablation에서도 세 구성요소가 모두 중요하다. Automatic curriculum이 없으면 탐색 방향이 약해지고, skill library가 없으면 장기 누적이 어렵고, iterative prompting이 없으면 실행 가능한 코드 품질을 안정적으로 확보하기 어렵다.

# 한계

Voyager는 강력하지만 그대로 일반 업무 agent에 옮기기에는 몇 가지 한계가 있다.

- Minecraft는 코드 실행과 상태 관찰이 비교적 명확한 환경이다.
- GPT-4의 코드 생성 능력에 많이 의존한다.
- 실패 피드백이 잘 구조화되어야 iterative refinement가 잘 돈다.
- 장기 memory가 커질수록 skill 검색 품질과 중복 관리가 중요해진다.

즉 이 논문은 "완성된 범용 agent"라기보다, agent를 만들 때 필요한 구조적 부품을 잘 보여주는 reference architecture에 가깝다.

# Takeaway

Agent를 만들 때 중요한 것은 모델 하나를 고르는 것이 아니라, 모델 바깥의 루프를 설계하는 것이다.

Voyager에서 배울 점은 다음 세 가지다.

- 목표 생성: agent가 다음에 무엇을 해야 하는지 스스로 정해야 한다.
- 실행 피드백: 실패를 관찰하고 코드를 고치는 루프가 있어야 한다.
- 스킬 메모리: 성공한 행동은 재사용 가능한 단위로 저장되어야 한다.

실제 AI agent 서비스를 만든다면 Voyager의 구조를 다음처럼 바꿔볼 수 있다.

- Automatic curriculum -> task planner
- Skill library -> tool/memory library
- Iterative prompting -> execution, error handling, retry loop

그래서 이 논문은 Agent 논문 리뷰의 첫 글로 좋다. 앞으로 ReAct, Reflexion, Toolformer, Generative Agents, SWE-agent 같은 논문을 이어서 읽으면 "reasoning-action loop -> memory/reflection -> tool use -> software engineering agent" 흐름으로 정리할 수 있다.

# 출처

- [arXiv: Voyager: An Open-Ended Embodied Agent with Large Language Models](https://arxiv.org/abs/2305.16291)
- [Project Page: Voyager](https://voyager.minedojo.org/)
