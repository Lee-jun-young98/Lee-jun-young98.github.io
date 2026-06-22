---
title: LangChain ShellToolMiddleware로 agent에 지속형 셸 세션 붙이기
description: LangChain ShellToolMiddleware로 agent에 persistent shell session을 붙이고 workspace_root, execution_policy, redaction_rules를 실무적으로 고르는 방법 정리
date: 2026-06-22
tags:
  - langchain
  - agent
  - middleware
  - execution
  - python
---

# LangChain ShellToolMiddleware로 agent에 지속형 셸 세션 붙이기

에이전트가 코드베이스를 읽고, 명령을 실행하고, 결과를 다시 해석해야 하는 작업에서는 단순 API tool 몇 개만으로는 금방 한계가 온다.

- 프로젝트 루트에서 `pytest`를 돌려야 한다
- 빌드 결과를 확인하고 로그를 다시 읽어야 한다
- 여러 명령의 결과를 이어 받아 점검해야 한다

이럴 때 LangChain의 `ShellToolMiddleware`를 쓰면 agent에 "한 번 쓰고 사라지는 명령 실행기"가 아니라 "지속형 셸 세션"을 붙일 수 있다.

2026년 6월 22일 기준 LangChain 공식 문서는 Shell tool middleware를 아래 용도에 맞는 기능으로 설명한다.

- system command 실행
- 개발/배포 자동화
- 테스트와 검증 워크플로
- 파일 시스템 작업과 스크립트 실행

이 글에서는 아래만 실전 기준으로 정리한다.

- `ShellToolMiddleware`가 일반 tool 함수와 어떻게 다른지
- `workspace_root`, `startup_commands`, `env`를 언제 쓸지
- `HostExecutionPolicy`, `DockerExecutionPolicy`, `CodexSandboxExecutionPolicy`를 어떻게 고를지
- redaction과 human-in-the-loop 관련 주의점

## 언제 쓰면 좋은가

아래 같은 작업은 shell 세션이 잘 맞는다.

- 코드 수정 전후로 테스트, lint, grep, 빌드 명령을 반복 실행하는 에이전트
- 문서 생성, 데이터 변환, 배포 점검처럼 여러 CLI를 이어 써야 하는 자동화
- 같은 작업 디렉터리 안에서 파일을 만들고 다시 읽어야 하는 워크플로

반대로 아래 상황은 먼저 다시 생각하는 편이 좋다.

- 단일 REST API 호출처럼 구조화된 tool 하나면 충분한 작업
- 셸 접근 자체가 과한 권한이 되는 멀티테넌트 서비스
- 사람 승인 interrupt가 꼭 필요한 고위험 실행 흐름

공식 문서 기준으로 persistent shell session은 현재 human-in-the-loop interrupt와 함께 동작하지 않는다. 승인 단계가 꼭 필요하면 별도 승인 계층을 두거나 shell 자체를 다른 실행기로 분리하는 편이 낫다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langchain-openai
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langchain langchain-openai
$env:OPENAI_API_KEY="sk-..."
```

## 1. 가장 작은 예제

공식 문서 기준으로 `ShellToolMiddleware`는 `create_agent(...)`의 `middleware`에 넣는다.  
별도의 shell tool 함수를 직접 만들 필요는 없다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ShellToolMiddleware, HostExecutionPolicy


agent = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[],
    middleware=[
        ShellToolMiddleware(
            workspace_root="./workspace",
            execution_policy=HostExecutionPolicy(),
        )
    ],
)


result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "현재 디렉터리 파일 목록을 보고 README가 있으면 첫 20줄만 보여줘.",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

이 미들웨어는 셸 세션을 하나 열고, agent가 그 세션 안에서 명령을 순차적으로 실행하게 한다. 그래서 `cd`, 환경 변수, 생성된 파일 같은 문맥이 짧은 작업 동안 이어진다.

## 2. `workspace_root`를 명시하지 않으면 임시 디렉터리를 쓴다

공식 문서 기준으로 `workspace_root`를 생략하면 agent 시작 시 임시 디렉터리를 만들고 종료 시 제거한다.

이 동작은 데모에는 편하지만 실무에서는 대개 명시적으로 경로를 주는 편이 낫다.

- agent가 어떤 경로를 읽고 쓰는지 분명해진다
- 실행 후 생성된 파일을 사람이 다시 확인하기 쉽다
- 테스트용 작업 디렉터리와 실제 서비스 디렉터리를 분리하기 좋다

```python
from pathlib import Path

from langchain.agents import create_agent
from langchain.agents.middleware import ShellToolMiddleware, HostExecutionPolicy


workspace = Path("agent-workspace").resolve()
workspace.mkdir(parents=True, exist_ok=True)

agent = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[],
    middleware=[
        ShellToolMiddleware(
            workspace_root=str(workspace),
            execution_policy=HostExecutionPolicy(),
        )
    ],
)
```

## 3. `startup_commands`와 `env`로 세션 기본 상태를 고정한다

셸 기반 agent는 "세션이 어떤 상태에서 시작하느냐"가 중요하다. `startup_commands`와 `env`를 쓰면 매 실행마다 같은 준비 단계를 강제할 수 있다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ShellToolMiddleware, HostExecutionPolicy


agent = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[],
    middleware=[
        ShellToolMiddleware(
            workspace_root="./workspace",
            startup_commands=[
                "python --version",
                "echo Session initialized",
            ],
            env={
                "APP_ENV": "dev",
                "PYTHONUNBUFFERED": "1",
            },
            execution_policy=HostExecutionPolicy(),
        )
    ],
)
```

이 패턴은 아래 상황에서 특히 유용하다.

- PATH, PYTHONPATH, feature flag 같은 환경을 통제해야 할 때
- 특정 가상환경이나 도구 버전을 먼저 확인해야 할 때
- 세션 시작 시 기본 헬스체크를 한 번 돌리고 싶을 때

## 4. 실행 정책은 기능보다 먼저 보안 관점에서 고른다

공식 문서 기준으로 주요 실행 정책은 세 가지다.

- `HostExecutionPolicy`: 호스트에서 직접 실행한다. 신뢰된 환경에서 가장 단순하다.
- `DockerExecutionPolicy`: agent run마다 별도 Docker 컨테이너를 띄워 더 강한 격리를 준다.
- `CodexSandboxExecutionPolicy`: Codex CLI sandbox를 재사용해 syscall/filesystem 제약을 추가한다.

실무 기준 추천은 대체로 아래와 같다.

- 개인 개발 환경, 이미 VM/컨테이너 안에서 돌고 있는 내부 도구: `HostExecutionPolicy`
- 사내 자동화나 CI처럼 격리가 더 중요한 환경: `DockerExecutionPolicy`
- Codex 기반 워크플로나 추가 샌드박스가 이미 있는 환경: `CodexSandboxExecutionPolicy`

예를 들면 Docker 격리 설정은 아래처럼 시작할 수 있다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import ShellToolMiddleware, DockerExecutionPolicy


agent = create_agent(
    model="openai:gpt-4.1-mini",
    tools=[],
    middleware=[
        ShellToolMiddleware(
            workspace_root="/workspace",
            startup_commands=["python --version"],
            execution_policy=DockerExecutionPolicy(
                image="python:3.11-slim",
                command_timeout=60.0,
            ),
        )
    ],
)
```

## 5. redaction은 출력 마스킹이지 권한 통제가 아니다

공식 문서 기준 `redaction_rules`는 command output을 모델에 돌려주기 전에 마스킹하는 용도다. 중요한 점은 이것이 비밀 유출을 원천 차단하는 보안 장치는 아니라는 점이다.

- redaction은 실행 후 출력 문자열을 정리하는 단계다
- `HostExecutionPolicy`에서 민감정보 접근 자체를 막아주지는 않는다
- 셸이 읽을 수 있는 파일 범위와 환경 변수 범위는 별도로 제한해야 한다

즉 redaction은 "마지막 필터"로 보고, 실제 보호는 실행 정책과 workspace 설계에서 먼저 해야 한다.

## 자주 하는 실수

### 1. shell이 있으면 아무 tool도 필요 없다고 생각한다

shell은 강력하지만 구조화된 tool을 완전히 대체하지는 않는다. 결제, 티켓 생성, CRM 조회처럼 명시적 권한과 검증이 필요한 작업은 여전히 전용 tool이 낫다.

### 2. `HostExecutionPolicy`를 기본값처럼 넓게 쓴다

로컬 데모는 쉽지만 운영 환경에서 그대로 가져가면 위험하다. 특히 agent가 읽을 수 있는 디렉터리와 환경 변수를 최소화해야 한다.

### 3. `workspace_root`를 안 주고 결과 파일이 사라졌다고 당황한다

임시 디렉터리 동작을 모르고 시작하면 생성 산출물이 실행 종료와 함께 사라질 수 있다.

### 4. interrupt 기반 승인 흐름과 같이 붙인다

공식 문서 limitation대로 persistent shell session은 현재 human-in-the-loop interrupt와 같이 쓰기 어렵다. 승인 단계가 중요하면 shell 실행 전후를 분리한 설계가 더 안전하다.

## 추천 적용 순서

1. 읽기 전용 작업부터 `workspace_root`를 좁게 잡아 붙인다.
2. 개발 환경에서는 `HostExecutionPolicy`로 빠르게 검증한다.
3. 운영 자동화로 갈 때는 `DockerExecutionPolicy` 또는 sandbox 정책으로 올린다.
4. 민감한 출력이 있으면 `redaction_rules`를 추가한다.
5. 장기적으로는 shell이 꼭 필요한 작업만 남기고 나머지는 구조화된 tool로 분리한다.

셸은 에이전트에게 가장 강한 도구 중 하나다. 그래서 `ShellToolMiddleware`의 핵심은 "명령 실행 기능을 켜는 것"보다 "어떤 경계 안에서 켤지"를 먼저 정하는 데 있다.

## 참고 자료

- [LangChain prebuilt middleware docs](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [ShellToolMiddleware reference](https://reference.langchain.com/python/langchain/agents/middleware/shell_tool/ShellToolMiddleware)
- [Anthropic middleware integration](https://docs.langchain.com/oss/python/integrations/middleware/anthropic)
