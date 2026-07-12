---
title: "LangChain FilesystemMiddleware로 에이전트 작업 공간 붙이기"
description: "Deep Agents의 FilesystemMiddleware를 LangChain create_agent에 붙여 read/write/edit, sandbox 실행, 장단기 파일 저장소를 구성하는 실전 패턴을 정리한 한국어 스터디 노트"
date: 2026-07-12
tags:
  - langchain
  - deep-agents
  - middleware
  - python
  - sandbox
aliases:
  - "/blog/filesystem-middleware-agent-workspace"
---

# LangChain FilesystemMiddleware로 에이전트 작업 공간 붙이기

도구 호출 에이전트가 실제로 일을 하려면 "텍스트 응답"만으로는 부족합니다. 파일을 읽고, 중간 결과를 저장하고, 필요하면 코드를 실행할 수 있는 작업 공간이 있어야 합니다.

LangChain 문서에서 이 역할을 맡는 대표 기능이 `FilesystemMiddleware`입니다. 공식 문서 기준으로 이 미들웨어는 파일시스템 도구를 에이전트에 노출하고, 백엔드에 따라 단기 상태 저장소, 장기 저장소, 샌드박스 실행 환경까지 연결할 수 있습니다.

특히 다음 상황에서 바로 실전성이 생깁니다.

- CSV, JSON, Markdown 같은 파일을 읽고 분석해야 할 때
- 긴 작업 중간 결과를 파일로 남겨 다음 턴에서 다시 읽고 싶을 때
- 호스트 머신이 아니라 격리된 샌드박스에서 코드나 셸 명령을 실행하고 싶을 때
- 일부 경로만 장기 저장소로 보내 thread를 넘어 재사용하고 싶을 때

## 언제 쓰면 좋은가

이 미들웨어는 단순 챗봇보다 "작업하는 agent"에 가깝게 만들 때 의미가 큽니다.

- 데이터 분석 agent
- 코드 수정/리팩터링 agent
- 리서치 결과를 파일로 누적하는 agent
- 장기 메모리를 파일 구조로 관리하고 싶은 agent

반대로 에이전트가 외부 API 몇 개만 호출하면 충분하고 파일을 직접 다룰 필요가 없다면, 굳이 filesystem 계층까지 붙이지 않아도 됩니다.

## 사전 준비

공식 문서 예제는 `deepagents`와 `langsmith`를 함께 사용합니다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain deepagents langsmith
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
$env:LANGSMITH_API_KEY="lsv2_..."
$env:LANGSMITH_TRACING="true"
```

## 가장 단순한 시작점: StateBackend

가장 가벼운 시작은 상태 기반 백엔드입니다. 이 방식은 파일을 graph state 안에 저장하므로 같은 thread 안에서는 이어지지만, 다른 thread로 넘어가면 지속되지 않습니다.

```python
from langchain.agents import create_agent
from deepagents.backends import StateBackend
from deepagents.middleware import FilesystemMiddleware


agent = create_agent(
    model="openai:gpt-5-mini",
    tools=[],
    middleware=[
        FilesystemMiddleware(backend=StateBackend()),
    ],
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "notes/today.md 파일을 만들고, 오늘 해야 할 일 세 개를 적어줘. "
                    "마지막에는 파일 내용을 요약해서 답해줘."
                ),
            }
        ]
    }
)

print(result["messages"][-1].content)
```

이 구성만으로도 문서 기준 `ls`, `read_file`, `write_file`, `edit_file` 같은 파일 도구를 agent가 쓸 수 있습니다.

## 왜 StateBackend만으로는 부족해지나

실전에서는 곧 두 가지 한계가 드러납니다.

- thread가 바뀌면 파일이 유지되지 않는다
- 코드 실행이 필요한 작업에는 별도 샌드박스가 없다

그래서 작업 유형에 따라 백엔드를 나눠야 합니다.

## 장기 저장이 필요하면 CompositeBackend로 경로 분리

공식 문서의 핵심 패턴 중 하나가 `CompositeBackend`입니다. 기본 경로는 단기 상태 저장소에 두고, 특정 경로만 `StoreBackend`로 보내 thread를 넘어 유지하게 만드는 방식입니다.

```python
from langchain.agents import create_agent
from deepagents.backends import CompositeBackend, StateBackend, StoreBackend
from deepagents.middleware import FilesystemMiddleware
from langgraph.store.memory import InMemoryStore


store = InMemoryStore()

backend = CompositeBackend(
    default=StateBackend(),
    routes={"/memories/": StoreBackend()},
)

agent = create_agent(
    model="openai:gpt-5-mini",
    tools=[],
    store=store,
    middleware=[
        FilesystemMiddleware(backend=backend),
    ],
)
```

이렇게 두면 예를 들어:

- `/scratch/report.md`는 현재 thread 안에서만 유지
- `/memories/user-preferences.md`는 다른 thread에서도 재사용

처럼 역할을 분리할 수 있습니다.

파일 경로만으로 단기 메모리와 장기 메모리를 구분할 수 있어서, state schema를 복잡하게 늘리지 않고도 운영하기 편합니다.

## 샌드박스까지 붙이면 execute 도구가 생긴다

LangChain의 "데이터 분석 agent from scratch" 튜토리얼에서는 `LangSmithSandbox` 백엔드를 붙여 파일 작업과 코드 실행을 함께 다룹니다. 문서 설명상 이 백엔드가 sandbox protocol을 구현하므로, `FilesystemMiddleware`가 파일 도구뿐 아니라 `execute` 도구까지 노출합니다.

```python
from langchain.agents import create_agent
from deepagents.backends.langsmith import LangSmithSandbox
from deepagents.middleware import FilesystemMiddleware
from langsmith.sandbox import SandboxClient


client = SandboxClient()
sandbox = client.create_sandbox(name="langchain-docs")
backend = LangSmithSandbox(sandbox=sandbox)

agent = create_agent(
    model="openai:gpt-5-mini",
    tools=[],
    middleware=[
        FilesystemMiddleware(backend=backend),
    ],
)
```

이 구성을 쓰면 agent는 샌드박스 안에서:

- 파일 업로드 후 읽기
- 스크립트 작성
- 셸 명령 실행
- 결과 파일 다시 읽기

같은 흐름을 처리할 수 있습니다.

## CSV 분석 예시

아래 예시는 샌드박스에 CSV를 올린 뒤, agent가 파일을 읽고 필요하면 실행 환경을 활용하게 만드는 형태입니다.

```python
import csv
import io

from langchain.agents import create_agent
from deepagents.backends.langsmith import LangSmithSandbox
from deepagents.middleware import FilesystemMiddleware
from langsmith.sandbox import SandboxClient


rows = [
    ["date", "product", "units", "revenue"],
    ["2026-07-01", "A", 10, 250],
    ["2026-07-02", "B", 4, 120],
    ["2026-07-03", "A", 3, 75],
]

buf = io.StringIO()
csv.writer(buf).writerows(rows)

client = SandboxClient()
sandbox = client.create_sandbox(name="sales-agent")
backend = LangSmithSandbox(sandbox=sandbox)
backend.upload_files([("/sales.csv", buf.getvalue().encode())])

agent = create_agent(
    model="openai:gpt-5-mini",
    tools=[],
    middleware=[FilesystemMiddleware(backend=backend)],
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "/sales.csv를 읽고 제품별 총매출을 한 문단으로 요약해줘. "
                    "필요하면 파이썬으로 계산해도 된다."
                ),
            }
        ]
    }
)

print(result["messages"][-1].content)
```

공식 튜토리얼 기준으로 샌드박스 업로드 경로는 `/sales.csv` 같은 절대 POSIX 경로여야 합니다. `sales.csv`처럼 상대 경로를 주면 `invalid_path`로 거절됩니다.

## 같이 붙이면 좋은 조합

`FilesystemMiddleware`는 혼자도 유용하지만, 실제로는 다른 미들웨어와 묶일 때 힘이 더 잘 나옵니다.

### 1. SummarizationMiddleware

파일 읽기 결과와 실행 로그는 길어지기 쉽습니다. 문서 튜토리얼도 `FilesystemMiddleware` 다음 단계로 `SummarizationMiddleware`를 붙이는 흐름을 권장합니다.

```python
from langchain.agents import create_agent
from deepagents.backends import StateBackend
from deepagents.middleware import FilesystemMiddleware, SummarizationMiddleware


model = "openai:gpt-5-mini"
backend = StateBackend()

agent = create_agent(
    model=model,
    tools=[],
    middleware=[
        FilesystemMiddleware(backend=backend),
        SummarizationMiddleware(model=model, backend=backend),
    ],
)
```

긴 `read_file` 출력이나 여러 번의 `execute` 로그가 쌓이는 세션이라면 거의 필수에 가깝습니다.

### 2. Skills 혹은 Memory 계층

반복 작업 규칙이 많다면 skill 파일을 두고, 에이전트가 필요할 때만 읽게 하는 편이 시스템 프롬프트를 계속 불리는 것보다 낫습니다. 장기적으로는 `/memories/` 같은 경로를 `StoreBackend`에 연결해 지속 파일과 작업 파일을 구분하는 편이 운영이 수월합니다.

## 흔한 함정

### 1. 호스트 파일시스템과 샌드박스를 혼동한다

`LangSmithSandbox`를 쓰면 agent가 보는 파일은 샌드박스 안의 파일입니다. 로컬 워크스페이스 파일이 자동으로 보이지 않습니다. 필요한 파일은 명시적으로 업로드해야 합니다.

### 2. 상대 경로 업로드를 시도한다

공식 튜토리얼 기준으로 `upload_files()` 경로는 절대 POSIX 경로여야 합니다. Windows 경로나 상대 경로를 그대로 넣으면 실패합니다.

### 3. 실행 환경을 붙였는데 안전장치를 안 둔다

`execute` 도구가 열리면 agent 권한이 강해집니다. 운영 환경에서는 Human-in-the-Loop, tool limits, 별도 샌드박스 이미지 같은 제약을 함께 고려하는 편이 맞습니다.

### 4. 긴 파일 출력이 그대로 대화 기록을 채운다

`read_file` 결과나 실행 로그를 계속 본문에 남기면 context window가 빨리 찹니다. summarization이나 context editing 없이 오래 끌면 성능과 비용이 빠르게 나빠집니다.

### 5. 단기 저장과 장기 저장을 구분하지 않는다

모든 파일을 장기 저장소로 보내면 잡다한 산출물이 쌓이고, 반대로 전부 state에만 두면 thread를 바꿀 때 아무것도 남지 않습니다. 경로 규칙을 먼저 정하는 편이 좋습니다.

## 정리

`FilesystemMiddleware`는 LangChain agent에 "작업 공간"을 붙이는 가장 실용적인 출발점입니다.

핵심 판단 기준은 아래처럼 정리할 수 있습니다.

1. 같은 thread 안에서만 파일이 필요하면 `StateBackend`
2. 일부 경로를 계속 남겨야 하면 `CompositeBackend + StoreBackend`
3. 코드 실행까지 필요하면 `LangSmithSandbox`
4. 로그와 파일 출력이 길어질 가능성이 있으면 `SummarizationMiddleware`를 함께 사용

파일을 읽고 쓰는 능력은 많은 agent 데모에서 생략되지만, 실제로는 이 계층이 붙는 순간부터 agent가 "답변하는 봇"에서 "작업하는 시스템"으로 바뀝니다.

## 참고 자료

- [LangChain prebuilt middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [Build a data analysis agent from scratch](https://docs.langchain.com/oss/python/langchain/deep-agent-from-scratch)
- [LangChain agents](https://docs.langchain.com/oss/python/langchain/agents)
