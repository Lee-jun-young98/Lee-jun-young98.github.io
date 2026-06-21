---
title: LangChain Deep Agents `create_deep_agent`로 planning, filesystem, subagent를 한 번에 붙이기
description: Deep Agents의 `create_deep_agent`로 LangChain 에이전트에 planning, 가상 파일시스템, 서브에이전트, memory를 빠르게 붙이는 실전 패턴 정리
date: 2026-06-21
tags:
  - langchain
  - deepagents
  - agent
  - python
  - productivity
aliases:
  - "/blog/langchain-create-deep-agent-quickstart"
---

# LangChain Deep Agents `create_deep_agent`로 planning, filesystem, subagent를 한 번에 붙이기

LangChain에서 `create_agent(...)`는 제어권이 크지만, 실전형 에이전트를 만들다 보면 금방 다음 항목들이 필요해집니다.

- 작업 계획을 쪼개는 planning
- 파일을 읽고 쓰는 가상 filesystem
- 긴 세션을 버티는 context 관리와 summarization
- 복잡한 일을 분리하는 subagent

이걸 매번 직접 조립해도 되지만, 빠르게 시작하고 싶다면 `deepagents`의 `create_deep_agent(...)`가 더 실용적일 때가 많습니다.

2026-06-21 기준 공식 문서에서 Deep Agents는 LangChain 위에 올라간 standalone library이며, LangGraph runtime을 사용해 durable execution, streaming, human-in-the-loop 같은 기능을 제공합니다. 또한 long-running coding/research 작업용으로 filesystem, summarization, subagents, prompt caching 같은 기본 하네스를 미리 조립해 둡니다.

이 글에서는 다음만 실무 기준으로 빠르게 정리합니다.

- `create_agent` 대신 `create_deep_agent`를 먼저 검토할 시점
- 최소 예제로 바로 실행하는 방법
- `checkpointer`, `skills`, `memory`, `subagents`를 어디까지 붙일지 판단하는 기준
- default filesystem 도구를 숨길 때의 주의점

## 언제 바로 써볼 만한가

다음 조건이면 `create_deep_agent`가 잘 맞습니다.

- 리서치, 코딩, 문서 작성처럼 여러 단계 작업이 길게 이어진다
- 단순 tool calling을 넘어서 파일 읽기/쓰기와 작업 계획이 필요하다
- supervisor/subagent 분리나 context isolation이 중요하다
- LangGraph를 처음부터 직접 짜기보다 기본 하네스를 빨리 확보하고 싶다

반대로 아래라면 여전히 `create_agent(...)`가 더 단순합니다.

- tool 1~3개짜리 짧은 assistant면 충분하다
- filesystem, planning, subagent가 전혀 필요 없다
- 하네스 기본 동작보다 세밀한 loop 제어가 더 중요하다

## 사전 준비

공식 quickstart 기준으로 Deep Agents는 tool calling을 지원하는 모델이 필요합니다.

```bash
pip install -U deepagents langchain-openai
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

메모리를 세션 단위로 유지하려면 checkpointer도 같이 준비합니다.

```python
from langgraph.checkpoint.memory import InMemorySaver

checkpointer = InMemorySaver()
```

## 1. 가장 작은 실행 예제

아래 예제는 weather tool 하나만 직접 주고, 나머지 하네스는 `create_deep_agent(...)`에 맡기는 형태입니다.

```python
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import InMemorySaver


def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"{city} is sunny."


agent = create_deep_agent(
    model="openai:gpt-5.5",
    tools=[get_weather],
    system_prompt="You are a concise travel assistant.",
    checkpointer=InMemorySaver(),
)


result = agent.invoke(
    {"messages": [{"role": "user", "content": "서울 날씨 보고 1박 2일 일정 초안도 잡아줘."}]},
    config={"configurable": {"thread_id": "trip-plan-seoul"}},
)

print(result["messages"][-1].content)
```

핵심은 `tools=[...]`만 넘겨도 끝이 아니라는 점입니다. 공식 문서 기준으로 Deep Agents 하네스는 planning, virtual filesystem, subagent delegation 쪽 scaffolding을 함께 제공합니다.

## 2. `create_agent`와 무엇이 다른가

실무 관점에서는 "모델 + tool loop"보다 "주변 하네스가 얼마나 붙어 있나"가 차이를 만듭니다.

### `create_agent(...)`

- LangChain 기본 하네스를 직접 조립한다
- middleware를 하나씩 선택해 붙이기 좋다
- 단순하고 세밀한 제어에 유리하다

### `create_deep_agent(...)`

- long-running 작업에 필요한 하네스를 미리 묶어 둔다
- filesystem, summarization, subagents, prompt caching 같은 기본 기능을 빠르게 확보한다
- 코딩/리서치형 agent를 더 적은 보일러플레이트로 시작하기 좋다

즉 `create_deep_agent`는 "더 똑똑한 모델 호출"이라기보다 "실전형 에이전트 하네스 묶음"에 가깝습니다.

## 3. 세션을 이어가려면 `thread_id`와 `checkpointer`를 같이 본다

Deep Agents도 LangGraph runtime 위에서 돌기 때문에, 대화와 작업 상태를 이어가려면 checkpointer와 `thread_id`를 같이 맞춰야 합니다.

```python
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import InMemorySaver


agent = create_deep_agent(
    model="openai:gpt-5.5",
    tools=[],
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": "research-brief-001"}}

agent.invoke(
    {"messages": [{"role": "user", "content": "AI 에이전트 관찰성 도구 후보를 정리해줘."}]},
    config=config,
)

agent.invoke(
    {"messages": [{"role": "user", "content": "방금 정리한 후보 중 오픈소스만 남겨줘."}]},
    config=config,
)
```

프로덕션에서는 `InMemorySaver()` 대신 DB-backed checkpointer를 써야 재시작 이후에도 상태가 유지됩니다.

## 4. 실전에서 바로 자주 붙는 옵션

공식 customization 문서의 시그니처 기준으로 `create_deep_agent(...)`는 아래 항목들을 함께 받습니다.

- `subagents`
- `skills`
- `memory`
- `permissions`
- `backend`
- `interrupt_on`
- `response_format`
- `context_schema`
- `checkpointer`
- `store`

실무에서는 전부 한 번에 쓰기보다 아래 순서가 무난합니다.

1. `tools`, `system_prompt`, `checkpointer`로 최소 agent를 만든다
2. 파일 작업이 필요하면 `permissions`와 `backend`를 붙인다
3. 작업 분리가 필요할 때만 `subagents`를 추가한다
4. 자주 재사용하는 작업 규칙은 `skills`로 뺀다
5. 사람 승인 지점이 필요하면 `interrupt_on`을 넣는다

## 5. 파일 작업이 필요할 때 특히 효율이 좋다

Deep Agents 문서 기준으로 기본 하네스는 가상 filesystem 도구 계층을 제공합니다. 대표적으로 다음 도구들이 붙습니다.

- `ls`
- `read_file`
- `write_file`
- `edit_file`
- `glob`
- `grep`

즉 "문서를 읽고 요약한 뒤 결과 파일을 저장"하거나 "코드베이스를 grep 한 뒤 수정 후보를 정리"하는 종류의 작업에서 별도 filesystem tool 세트를 직접 만들 필요가 없습니다.

이건 `create_agent(...)`에서 middleware를 하나씩 조립할 때보다 초기 구현 속도 차이가 큽니다.

## 6. subagent가 필요한 시점

Deep Agents는 delegation을 기본 능력으로 봅니다. 다음 경우면 subagent 도입 가치가 분명합니다.

- 메인 agent가 조사와 작성, 검토를 한 세션에서 모두 하려 한다
- 중간 tool 결과가 너무 길어 main context를 오염시킨다
- 특정 전문 역할을 분리해야 한다

예를 들어 아래처럼 research와 writing을 나누는 방향을 생각할 수 있습니다.

```python
from deepagents import SubAgent, create_deep_agent


researcher = SubAgent(
    name="researcher",
    description="Collects facts and source notes.",
    system_prompt="Find reliable facts first, then return concise notes.",
    tools=[],
)

writer = SubAgent(
    name="writer",
    description="Turns research notes into a polished draft.",
    system_prompt="Write clearly in Korean and keep the structure tight.",
    tools=[],
)


agent = create_deep_agent(
    model="openai:gpt-5.5",
    tools=[],
    subagents=[researcher, writer],
)
```

다만 역할이 애매하면 subagent가 오히려 왕복 비용만 늘립니다. "진짜로 context를 분리해야 하는가"를 먼저 보세요.

## 7. default filesystem 도구를 숨기고 싶다면 `excluded_tools`

이건 문서 기준으로 중요한 함정입니다.

filesystem 도구가 모델에게 너무 넓게 열려 보여서 숨기고 싶을 때, `FilesystemMiddleware` 자체를 빼는 방식은 허용되지 않습니다. Deep Agents 기본 스택에서 required scaffolding이라서 `excluded_middleware`로 제거하려 하면 `ValueError`가 납니다.

대신 model-visible tool surface만 줄이려면 harness profile의 `excluded_tools`를 써야 합니다.

```python
from deepagents import HarnessProfile, register_harness_profile


register_harness_profile(
    "openai:gpt-5.5",
    HarnessProfile(
        excluded_tools=frozenset(
            {"ls", "read_file", "write_file", "edit_file", "glob", "grep"}
        )
    ),
)
```

이 포인트를 놓치면 "filesystem을 잠그려다 하네스를 깨는" 식의 설정 실수가 나옵니다.

## 자주 겪는 함정

### 1. 아무 모델이나 넣어도 될 거라고 생각하기

Deep Agents quickstart 기준으로 tool calling 지원 모델이 필요합니다. provider/model 문자열만 바꾼다고 다 되는 게 아닙니다.

### 2. 긴 세션인데 `thread_id`를 매번 바꿔 버리기

같은 작업을 이어가고 싶으면 같은 `thread_id`를 유지해야 합니다. checkpointer만 있고 `thread_id`가 계속 바뀌면 메모리가 이어지지 않습니다.

### 3. 단순 agent에도 무조건 Deep Agents를 쓰기

짧은 Q&A bot에 filesystem, planning, subagent까지 얹으면 구조만 무거워집니다. 기본 `create_agent(...)`가 더 낫습니다.

### 4. filesystem 도구를 "완전히 제거"하려고 middleware를 빼기

공식 profiles 문서 기준으로 이건 막혀 있습니다. 숨기려면 `excluded_tools`, 제거가 아니라 노출 축소라는 관점으로 접근해야 합니다.

### 5. 하네스가 다 해주니 prompt 설계가 덜 중요하다고 생각하기

하네스가 좋아도 `system_prompt`가 모호하면 planning과 delegation 품질이 흔들립니다. Deep Agents도 결국 명확한 역할 정의가 있어야 잘 작동합니다.

## 추천 적용 순서

1. 먼저 `create_deep_agent`로 최소 예제를 돌린다
2. `checkpointer + thread_id`로 세션 지속성을 확인한다
3. 파일 작업이 필요할 때만 permissions/backend를 추가한다
4. 컨텍스트 오염이 심해질 때 subagent를 도입한다
5. 이후에만 skills, memory, human approval을 붙인다

## 마무리

`create_deep_agent(...)`는 LangChain의 `create_agent(...)`를 대체하는 만능 함수라기보다, "코딩/리서치형 장기 작업"에 맞춘 기본 하네스를 한 번에 올려 주는 선택지에 가깝습니다.

특히 아래 조건이면 바로 써볼 가치가 큽니다.

- planning이 필요하다
- 파일을 읽고 쓰며 작업한다
- 긴 세션에서 context 관리가 중요하다
- subagent로 책임 분리가 필요하다

반대로 짧고 단순한 assistant라면 `create_agent(...)`가 더 낫습니다. 결국 기준은 기능 수가 아니라 하네스가 필요한 작업 길이와 복잡도입니다.

## 참고 자료

- [Deep Agents overview](https://docs.langchain.com/oss/python/deepagents/overview)
- [Deep Agents quickstart](https://docs.langchain.com/oss/python/deepagents/quickstart)
- [Customize Deep Agents](https://docs.langchain.com/oss/python/deepagents/customization)
- [Deep Agents profiles](https://docs.langchain.com/oss/python/deepagents/profiles)
- [LangChain agents overview](https://docs.langchain.com/oss/python/langchain/agents)
- [Build a data analysis agent from scratch](https://docs.langchain.com/oss/python/langchain/deep-agent-from-scratch)
