---
title: "LangChain Deep Agents CompositeBackend로 workspace와 memory 분리하기"
description: "Practical guide to routing Deep Agents workspace, offloaded artifacts, and durable memory with CompositeBackend."
date: 2026-07-03
tags:
  - langchain
  - agent
  - deep-agents
  - memory
  - python
aliases:
  - "/blog/langchain-deep-agents-composite-backend-workspace-memory"
---

# LangChain Deep Agents `CompositeBackend`로 `workspace`와 `memory` 분리하기

Deep Agents를 실제 작업에 붙이기 시작하면 금방 파일이 섞이기 시작한다.

- 에이전트가 당장 쓰는 scratch 파일
- 큰 tool 결과를 offload한 내부 파일
- 사용자별로 오래 남겨야 하는 장기 memory
- 실제 프로젝트 디렉터리의 문서와 코드

이걸 전부 한 backend에 몰아넣으면 곧 정리가 어려워진다. 특히 `FilesystemBackend` 하나만 바로 물리면 agent 내부 아티팩트와 프로젝트 파일이 같은 루트에 섞여 버린다.

2026-07-03 기준 공식 문서에서는 Deep Agents가 `CompositeBackend`로 경로 prefix마다 다른 backend를 라우팅하는 방식을 권장한다. 또한 기본 backend는 `StateBackend()`이며, Deep Agents의 내부 offloaded tool 결과와 conversation history는 default backend에 기록된다.

이 글에서는 아래만 실무 기준으로 정리한다.

- 왜 `CompositeBackend`가 기본 선택지에 가까운가
- `/workspace/`, `/memories/`를 어떻게 분리할지
- 로컬 개발과 운영 배포에서 backend를 어떻게 다르게 볼지
- 자주 틀리는 namespace, `virtual_mode`, internal artifact 처리 포인트

## 언제 바로 써야 하나

다음 조건이면 `CompositeBackend`를 먼저 검토하는 편이 낫다.

- agent가 파일을 읽고 쓰지만, 모든 파일을 영구 저장할 필요는 없다
- thread 안에서만 유지할 scratch space와 여러 thread에 공유할 memory를 분리하고 싶다
- 실제 프로젝트 디렉터리와 agent 내부 아티팩트를 분리하고 싶다
- multi-user 환경이라 user별 memory namespace가 필요하다

반대로 짧은 prototype이고 장기 저장이 전혀 없다면 기본 `StateBackend()`만으로도 충분하다.

## 사전 준비

```bash
pip install -U deepagents langgraph langchain-openai
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

예제는 로컬 개발을 기준으로 `InMemoryStore()`를 쓴다. 운영에서는 Redis, Postgres, cloud store 같은 실제 LangGraph store를 붙여야 한다.

## 핵심 개념 먼저 정리

공식 backend 문서를 실무적으로 줄이면 구조는 아래처럼 보면 된다.

1. `default=StateBackend()`로 thread-scoped scratch space를 둔다
2. `/workspace/`만 실제 프로젝트 디렉터리로 보낸다
3. `/memories/`만 durable store로 보낸다
4. Deep Agents 내부 artifact는 default backend에 남겨 실제 파일시스템을 오염시키지 않는다

특히 문서에서 중요한 부분은 이것이다.

- `FilesystemBackend` 단독 사용 시 `/large_tool_results/`, `/conversation_history/` 같은 내부 파일도 실디스크에 저장된다
- 그래서 대부분의 경우 `FilesystemBackend`는 `CompositeBackend` 안에서 특정 prefix에만 붙이는 편이 낫다
- `StoreBackend`는 cross-thread persistence에 적합하지만 multi-user 환경에서는 반드시 `namespace`를 명시해야 한다

## 1. 가장 실용적인 기본형: `/workspace/`는 디스크, 나머지는 state

먼저 가장 흔한 패턴부터 보자. 에이전트가 프로젝트 파일은 실제 디스크에서 읽고 쓰되, 내부 오프로딩 파일은 thread state에만 남기고 싶을 때다.

```python
from deepagents import create_deep_agent
from deepagents.backends import CompositeBackend, FilesystemBackend, StateBackend
from langgraph.checkpoint.memory import InMemorySaver


agent = create_deep_agent(
    model="openai:gpt-5.5",
    backend=CompositeBackend(
        default=StateBackend(),
        routes={
            "/workspace/": FilesystemBackend(
                root_dir="C:/projects/customer-support-bot",
                virtual_mode=True,
            ),
        },
    ),
    checkpointer=InMemorySaver(),
    system_prompt=(
        "Use /workspace/ for project files. "
        "Do not store long-term user preferences in workspace files."
    ),
)
```

이 구성의 의미는 단순하다.

- `/workspace/...`만 실제 디스크로 간다
- 그 외 경로는 thread-scoped state에 남는다
- 큰 tool 결과 offload나 conversation history 같은 내부 artifact도 `StateBackend()`에 머문다

즉 "프로젝트 파일은 실제로 수정하지만, agent 내부 부산물은 휘발성으로 둔다"는 분리가 된다.

## 2. 장기 memory까지 붙이는 운영형: `/memories/`를 store로 분리

여기서 한 단계 더 가면 `/memories/`를 durable store로 분리할 수 있다.

```python
from dataclasses import dataclass

from deepagents import create_deep_agent
from deepagents.backends import (
    CompositeBackend,
    FilesystemBackend,
    StateBackend,
    StoreBackend,
)
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.store.memory import InMemoryStore


@dataclass
class AgentContext:
    user_id: str


backend = CompositeBackend(
    default=StateBackend(),
    routes={
        "/workspace/": FilesystemBackend(
            root_dir="C:/projects/customer-support-bot",
            virtual_mode=True,
        ),
        "/memories/": StoreBackend(
            namespace=lambda rt: ("users", rt.context.user_id, "deep-agent-memory"),
        ),
    },
)

agent = create_deep_agent(
    model="openai:gpt-5.5",
    backend=backend,
    context_schema=AgentContext,
    checkpointer=InMemorySaver(),
    store=InMemoryStore(),
    memory=["/memories/profile.md"],
    system_prompt=(
        "Use /workspace/ for task files and /memories/ for durable user preferences."
    ),
)

config = {"configurable": {"thread_id": "thread-001"}}
context = AgentContext(user_id="user-123")

agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "앞으로 답변은 한국어로 하고, 출장을 자주 가니 출장 체크리스트를 기억해줘.",
            }
        ]
    },
    config=config,
    context=context,
)
```

이 패턴에서 역할은 명확하다.

- `thread_id`: 같은 대화의 short-term history와 scratch file을 이어 준다
- `/memories/`: thread를 넘어 다시 불러와야 하는 사용자 선호를 저장한다
- `namespace`: 어떤 사용자 memory인지 분리한다

공식 production 문서 기준으로 `thread_id`와 `context`는 거의 항상 같이 전달하는 것이 권장된다.

## 3. 에이전트가 어떤 경로를 쓰는지 먼저 규칙을 박아 두기

backend만 나눠 두고 prompt를 비워 두면 agent가 `/workspace/`와 `/memories/`를 섞어 쓰기 쉽다. 보통 아래처럼 경로 역할을 system prompt에 먼저 고정하는 편이 안정적이다.

```python
system_prompt = """
You are a support operations agent.

Path conventions:
- Use /workspace/ for task-local drafts, reports, and intermediate files.
- Use /memories/ for durable user preferences and reusable facts.
- Do not store secrets in /memories/.
- Prefer updating existing files over creating duplicates.
""".strip()
```

경로 설계가 곧 memory policy다. 이걸 prompt에 명시하지 않으면 storage만 나눠 놓고 의미는 섞이게 된다.

## 4. 왜 `FilesystemBackend` 단독 사용을 피하라고 하나

공식 문서상 가장 중요한 함정 중 하나다.

`FilesystemBackend(root_dir=...)`만 단독으로 붙이면 agent 내부 데이터도 같은 루트에 저장된다.

- `/large_tool_results/`
- `/conversation_history/`
- 기타 내부 filesystem artifact

이건 로컬 실험에서는 괜찮아 보여도 프로젝트 디렉터리에서는 금방 지저분해진다. 그래서 실제 코드나 문서 디렉터리를 agent에 열어 줄 때는 대개 아래 원칙이 낫다.

- default는 `StateBackend()`
- 실제 디스크는 `/workspace/` 같은 특정 prefix로만 route
- 장기 저장은 `/memories/` 같은 별도 prefix로 분리

## 5. `virtual_mode=True`는 사실상 기본값처럼 보는 편이 안전하다

공식 backend 문서는 `FilesystemBackend`를 쓸 때 `virtual_mode=True` 사용을 강하게 권장한다. 이유는 단순하다.

- `..` 같은 상위 경로 이동 차단
- 루트 밖 절대경로 접근 제한
- path 정규화와 prefix 기반 접근 제어

```python
FilesystemBackend(
    root_dir="C:/projects/customer-support-bot",
    virtual_mode=True,
)
```

로컬 개발에서도 이 옵션을 빼고 시작할 이유가 거의 없다.

단, `LocalShellBackend`로 shell 실행까지 열어 두면 이야기가 달라진다. 공식 문서 기준으로 shell access가 있으면 `virtual_mode=True`만으로는 보안 경계가 되지 않는다.

## 6. Multi-user 환경에서는 `namespace`를 생략하면 안 된다

`StoreBackend()`를 그냥 만들면 storage scope가 너무 넓어질 수 있다.

공식 문서 기준으로 새 코드에서는 `namespace`를 항상 명시하는 편이 맞고, production에서는 특히 user 또는 tenant 기준으로 분리해야 한다.

예를 들면 아래 같은 패턴이 자주 필요하다.

```python
StoreBackend(
    namespace=lambda rt: ("users", rt.context.user_id, "deep-agent-memory"),
)
```

혹은 assistant별 공유 memory가 필요하면 assistant ID를 쓸 수도 있다. 핵심은 "무엇을 공유하고 무엇을 격리할지"를 코드로 명시하는 것이다.

## 7. 경로 prefix 설계는 짧고 역할이 분명해야 한다

내 경험상 아래처럼 두세 개만 유지하는 편이 가장 덜 꼬인다.

- `/workspace/`: 현재 작업 파일
- `/memories/`: durable memory
- `/docs/`: 읽기 전용 reference 자료

공식 문서처럼 더 긴 prefix도 가능하지만, prefix가 많아질수록 agent instruction과 운영 정책이 같이 복잡해진다.

긴 prefix가 필요한 경우에도 "긴 prefix가 우선 매칭된다"는 규칙을 알고 있어야 한다. 예를 들어 `"/memories/projects/"`는 `"/memories/"`보다 우선한다.

## 자주 겪는 함정

### 1. `FilesystemBackend` 하나만 붙이고 끝내기

처음에는 단순해 보여도 내부 artifact가 디스크에 섞인다. 프로젝트 디렉터리를 열어 주는 순간부터는 `CompositeBackend`가 더 안전하다.

### 2. `StoreBackend`를 쓰면서 `store=`를 안 넘기기

로컬 개발에서는 `create_deep_agent(..., store=...)`가 필요하다. LangSmith Deployment처럼 플랫폼이 store를 자동 provision하는 환경이 아니면 직접 넣어야 한다.

### 3. `namespace` 없이 여러 사용자를 한 저장공간에 섞기

이건 memory leak와 권한 문제로 바로 이어진다. production이라면 거의 항상 user 또는 tenant 단위 namespace가 필요하다.

### 4. `thread_id`와 long-term memory를 같은 개념으로 보기

`thread_id`는 conversation continuity다. `/memories/`는 cross-thread persistence다. 둘은 역할이 다르다.

### 5. 경로 역할을 prompt에 안 적기

backend routing만 맞춰 놓아도 agent는 엉뚱한 위치에 파일을 쓸 수 있다. `/workspace/`와 `/memories/`의 의미를 prompt에 못 박는 편이 안정적이다.

## 추천 적용 순서

1. 기본 `StateBackend()`로 prototype을 먼저 돌린다
2. 실제 파일 접근이 필요해지면 `/workspace/`만 `FilesystemBackend`로 연다
3. cross-thread memory가 필요해지면 `/memories/`에 `StoreBackend`를 붙인다
4. `context_schema`와 `namespace`로 multi-user scope를 고정한다
5. 이후에만 shell, sandbox, HITL 같은 더 강한 실행 권한을 추가한다

## 마무리

Deep Agents에서 backend는 단순 저장소 설정이 아니라 context와 memory 경계를 설계하는 일에 가깝다.

실무에서는 아래 구성이 가장 출발점으로 좋다.

- default: `StateBackend()`으로 내부 artifact와 scratch space 처리
- `/workspace/`: 실제 디스크나 mounted volume
- `/memories/`: durable store

이렇게 나누면 프로젝트 파일, 내부 offload 결과, 장기 memory가 서로 역할별로 분리되고 운영 중에도 훨씬 덜 꼬인다.

## 참고 자료

- [Deep Agents backends](https://docs.langchain.com/oss/python/deepagents/backends)
- [Deep Agents going to production](https://docs.langchain.com/oss/python/deepagents/going-to-production)
- [Deep Agents memory](https://docs.langchain.com/oss/python/deepagents/memory)
- [Deep Agents permissions](https://docs.langchain.com/oss/python/deepagents/permissions)
- [Deep Agents profiles](https://docs.langchain.com/oss/python/deepagents/profiles)
- [Deep Agents create_deep_agent quickstart](https://docs.langchain.com/oss/python/deepagents/quickstart)
