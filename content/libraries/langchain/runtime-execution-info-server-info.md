---
title: "LangChain Runtime execution_info와 server_info로 실행 문맥 추적하기"
description: "도구와 middleware에서 thread, run, task, retry, 배포 인증 정보를 읽어 로그·멱등성 키·권한 검사를 구성하는 실전 패턴"
date: 2026-08-04
tags:
  - langchain
  - agent
  - runtime
  - observability
  - python
---

# LangChain Runtime `execution_info`와 `server_info`로 실행 문맥 추적하기

에이전트가 외부 API를 호출할 때는 단순히 사용자 입력만 아는 것으로 부족하다. 지금 실행이 어느 thread와 run에 속하는지, 같은 node가 몇 번째로 재시도되는지, LangGraph Server에서 어떤 assistant와 인증 사용자가 호출했는지를 함께 알아야 로그와 멱등성 처리를 안정적으로 만들 수 있다.

LangChain `create_agent`는 내부적으로 LangGraph runtime을 사용한다. 최신 runtime은 다음 두 읽기 전용 정보를 도구와 middleware에 주입한다.

- `runtime.execution_info`: checkpoint, task, thread, run, node 재시도 정보
- `runtime.server_info`: LangGraph Server가 주입하는 assistant, graph, 인증 사용자 정보

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.0" "langgraph>=1.1.5" langchain-openai
export OPENAI_API_KEY="your-api-key"
```

PowerShell에서는 마지막 줄을 다음처럼 설정한다.

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

`execution_info`와 `server_info`는 `langgraph>=1.1.5`가 필요하다. Deep Agents를 직접 사용한다면 공식 문서 기준 `deepagents>=0.5.0`을 사용한다.

## 1. 도구 호출에 실행 식별자 남기기

도구 함수에 `runtime: ToolRuntime` 매개변수를 선언하면 모델에게 노출되는 tool schema에는 이 인자가 포함되지 않고 실행 시 자동으로 주입된다.

```python
import json

from langchain.tools import ToolRuntime, tool


@tool
def create_report(topic: str, runtime: ToolRuntime) -> str:
    """Create a report and return its audit metadata."""
    info = runtime.execution_info
    audit = {
        "topic": topic,
        "thread_id": info.thread_id if info else None,
        "run_id": info.run_id if info else None,
        "task_id": info.task_id if info else None,
        "node_attempt": info.node_attempt if info else 1,
    }
    print(json.dumps(audit, ensure_ascii=False))
    return f"'{topic}' 보고서를 생성했습니다."
```

각 필드의 의미를 구분해야 한다.

- `thread_id`: checkpointer를 사용하는 대화 thread 식별자. persistence 없이 실행하면 `None`일 수 있다.
- `run_id`: 한 번의 graph 실행 식별자. `RunnableConfig`에 제공되지 않으면 `None`일 수 있다.
- `task_id`: 현재 node task 식별자
- `checkpoint_id`, `checkpoint_ns`: 현재 실행의 checkpoint 위치
- `node_attempt`: 현재 node 실행 차수이며 1부터 시작
- `node_first_attempt_time`: 첫 시도 시작 Unix timestamp. 값이 없을 수 있다.

관측 로그에는 `thread_id`, `run_id`, `task_id`를 함께 기록하는 편이 좋다. thread만 기록하면 여러 사용자 턴을 구분하기 어렵고, run만 기록하면 장기 대화 전체를 묶기 어렵다.

## 2. 재시도 차수로 외부 side effect 보호하기

`node_attempt`는 retry가 일어난 node의 현재 시도를 알려 준다. 결제, 이메일, 티켓 생성처럼 중복 실행이 위험한 도구에서는 이 값만 보고 두 번째 호출을 막기보다 안정적인 멱등성 키를 만드는 보조 신호로 사용한다.

```python
from hashlib import sha256

from langchain.tools import ToolRuntime, tool


def idempotency_key(runtime: ToolRuntime, operation: str) -> str:
    info = runtime.execution_info
    stable_parts = [
        info.thread_id if info and info.thread_id else "no-thread",
        info.run_id if info and info.run_id else "no-run",
        info.task_id if info else "no-task",
        operation,
    ]
    return sha256(":".join(stable_parts).encode()).hexdigest()


@tool
def issue_refund(order_id: str, runtime: ToolRuntime) -> str:
    """Issue one idempotent refund for an order."""
    key = idempotency_key(runtime, f"refund:{order_id}")
    attempt = runtime.execution_info.node_attempt if runtime.execution_info else 1
    # 실제 구현에서는 결제 API의 Idempotency-Key header로 key를 전달한다.
    return f"refund requested: key={key[:12]}, node_attempt={attempt}"
```

`node_attempt`를 멱등성 키에 넣으면 재시도마다 키가 달라져 중복 side effect를 허용할 수 있으므로 넣지 않는다. 반대로 retry 정책을 디버깅하는 로그와 metric에는 반드시 차수를 남긴다.

## 3. middleware에서 run 단위 로그 연결하기

node-style middleware hook은 두 번째 인자로 `Runtime`을 받을 수 있다. 같은 방식으로 model 호출 전후의 로그를 실행 식별자와 연결한다.

```python
from langchain.agents import AgentState
from langchain.agents.middleware import before_model
from langgraph.runtime import Runtime


@before_model
def log_model_attempt(state: AgentState, runtime: Runtime) -> dict | None:
    info = runtime.execution_info
    if info is None:
        print("model_call execution_info=unavailable")
        return None
    print(
        "model_call "
        f"thread_id={info.thread_id} run_id={info.run_id} "
        f"task_id={info.task_id} attempt={info.node_attempt}"
    )
    return None
```

wrap-style middleware에서는 별도 `Runtime` 인자를 받지 않고 `ModelRequest.runtime`으로 접근한다.

```python
from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call


@wrap_model_call
def add_run_metadata(request: ModelRequest, handler) -> ModelResponse:
    info = request.runtime.execution_info
    if info:
        print(f"model run={info.run_id} attempt={info.node_attempt}")
    return handler(request)
```

## 4. LangGraph Server 인증 정보를 권한 검사에 쓰기

`server_info`는 LangGraph Server가 주입하며 로컬 open-source 실행에서는 `None`이다. 배포 환경에서는 assistant와 graph 식별자, 인증 사용자를 읽을 수 있다.

```python
from langchain.agents import AgentState
from langchain.agents.middleware import before_model
from langgraph.runtime import Runtime


@before_model
def require_authenticated_server_user(
    state: AgentState,
    runtime: Runtime,
) -> dict | None:
    server = runtime.server_info
    # 로컬 개발 실행은 별도 개발 정책으로 처리한다.
    if server is None:
        return None
    if server.user is None:
        raise PermissionError("인증된 사용자만 실행할 수 있습니다.")
    print(
        f"assistant={server.assistant_id} graph={server.graph_id} "
        f"user={server.user.identity}"
    )
    return None
```

로컬에서 `server_info is None`이라는 이유만으로 요청을 허용하는 코드를 그대로 운영 정책으로 사용하면 안 된다. 개발·테스트와 배포 환경을 명시적으로 나누고, 운영에서는 server metadata가 빠진 요청을 fail-closed로 처리할지 결정한다.

## 흔한 실수

### `execution_info`가 항상 있다고 가정한다

runtime reference상 task 준비 전에는 `execution_info`가 `None`일 수 있다. 재사용 helper에서는 반드시 `None`을 처리한다.

### `thread_id`와 `run_id`가 항상 채워진다고 생각한다

checkpointer가 없으면 `thread_id`, config에 run ID가 없으면 `run_id`가 `None`일 수 있다. 문자열 결합이나 DB key 생성 전에 fallback 정책을 정한다.

### `node_attempt`를 전체 agent 재시도 횟수로 해석한다

이 값은 현재 node의 실행 차수다. model node와 tools node는 서로 다른 task와 차수를 가질 수 있다. 전체 요청 재시도 횟수가 필요하면 애플리케이션 계층에서 별도 correlation metadata를 관리한다.

### `server_info`를 클라이언트 입력으로 대체한다

`assistant_id`, `graph_id`, authenticated user는 server가 주입한 metadata일 때만 신뢰한다. 사용자가 보낸 message나 runtime context의 임의 문자열을 같은 권한 신호로 취급하지 않는다.

### 읽기 전용 정보를 수정하려고 한다

`ExecutionInfo`는 현재 실행을 설명하는 metadata다. 애플리케이션 상태를 저장하려면 agent state나 store를 사용하고, 실행 식별자를 바꾸기 위해 객체를 직접 조작하지 않는다.

## 실전 체크리스트

1. 로그에 thread, run, task ID와 node attempt를 함께 남긴다.
2. side effect 도구에는 attempt와 무관한 멱등성 키를 전달한다.
3. `execution_info`, `thread_id`, `run_id`, `server_info`의 `None` 경로를 테스트한다.
4. 로컬 개발과 LangGraph Server의 인증 정책을 명시적으로 분리한다.
5. 권한 판정에는 server가 주입한 authenticated user만 신뢰한다.

## 참고 자료

- [LangChain Runtime](https://docs.langchain.com/oss/python/langchain/runtime)
- [LangGraph Runtime API reference](https://reference.langchain.com/python/langgraph/runtime/Runtime)
- [LangGraph ExecutionInfo API reference](https://reference.langchain.com/python/langgraph/runtime/ExecutionInfo)
- [LangGraph ServerInfo API reference](https://reference.langchain.com/python/langgraph/runtime/ServerInfo)
