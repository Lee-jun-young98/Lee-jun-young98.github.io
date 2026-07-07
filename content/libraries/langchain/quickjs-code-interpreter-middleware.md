---
title: "LangChain Deep Agents CodeInterpreterMiddleware로 agent 안에 QuickJS 계산 루프 넣기"
description: "Deep Agents의 CodeInterpreterMiddleware로 QuickJS interpreter를 붙여 tool 호출 사이의 루프, 분기, 집계를 코드로 처리하는 실전 가이드"
date: 2026-07-07
tags:
  - langchain
  - deepagents
  - agent
  - python
  - interpreter
aliases:
  - "/blog/langchain-quickjs-code-interpreter-middleware"
---

# LangChain Deep Agents CodeInterpreterMiddleware로 agent 안에 QuickJS 계산 루프 넣기

Deep Agents를 쓰다 보면 곧바로 부딪히는 한계가 있다.  
모델은 한 번의 턴에서 tool call을 여러 개 낼 수는 있지만, 그 배치는 이미 고정되어 있다. 그래서 "결과를 보고 다시 반복", "실패하면 재시도", "여러 결과를 코드로 집계한 뒤 최종값만 모델에 반환" 같은 흐름은 보통 모델 턴을 더 써야 한다.

LangChain 공식 문서 기준으로 이 문제를 푸는 기능이 `CodeInterpreterMiddleware`다.  
이 middleware를 붙이면 Deep Agent 안에 가벼운 QuickJS 런타임이 들어가고, agent는 필요할 때 JavaScript를 작성해 `eval` tool로 실행한다.

핵심은 다음이다.

- interpreter는 agent loop 안에서 돌아간다
- 중간 계산 결과를 전부 모델 컨텍스트로 되돌리지 않아도 된다
- 필요하면 allowlist한 tool을 interpreter 코드에서 직접 호출할 수 있다
- subagent가 있으면 `task()`로 코드 안에서 fan-out도 가능하다

## 언제 유용한가

다음 상황이면 interpreter를 먼저 검토할 만하다.

- tool 여러 개를 순서대로 호출하고 중간 결과를 코드로 정리해야 한다
- 동일한 작업을 목록 전체에 반복 적용해야 한다
- 집계, 정렬, 검증, 재시도 로직을 모델 프롬프트보다 코드에 두는 편이 낫다
- 모델 컨텍스트에 중간 결과를 모두 밀어 넣고 싶지 않다

반대로 아래면 interpreter보다 다른 수단이 맞다.

- 외부 호출 1~2번이면 그냥 일반 tool calling
- 셸 명령, 패키지 설치, 파일 수정, OS 접근이면 sandbox
- 단순한 대화형 assistant면 `create_agent(...)` 또는 기본 Deep Agent로 충분

## 사전 준비

2026-07-07 기준 공식 문서는 interpreter에 `langchain-quickjs>=0.2.0`과 Python `>=3.11`이 필요하다고 설명한다. 설치는 `deepagents[quickjs]`로 시작하는 편이 가장 간단하다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U "deepagents[quickjs]" langchain-openai
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U "deepagents[quickjs]" langchain-openai
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 가장 작은 interpreter 예제

아래처럼 `create_deep_agent(...)`에 `CodeInterpreterMiddleware()`를 넣으면 된다.

```python
from deepagents import create_deep_agent
from langchain_quickjs import CodeInterpreterMiddleware


agent = create_deep_agent(
    model="openai:gpt-5.5",
    middleware=[CodeInterpreterMiddleware()],
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "Use the interpreter to group these rows by team and return totals only: "
                    "[{'team':'alpha','score':8},{'team':'beta','score':13},{'team':'alpha','score':21}]"
                ),
            }
        ]
    }
)

print(result["messages"][-1].content)
```

여기서 agent는 필요하다고 판단하면 JavaScript를 써서 `eval` tool을 호출한다.  
공식 문서 기준 interpreter는 in-memory workspace라서 계산, 변수 저장, `console.log` 출력은 가능하지만 기본적으로 filesystem, shell, network, package manager에는 접근하지 못한다.

## 2. PTC로 tool 호출을 코드 안에서 루프 처리하기

`Programmatic Tool Calling`, 즉 PTC를 켜면 interpreter 코드 안에서 allowlist된 tool을 `tools.*` 네임스페이스로 호출할 수 있다.  
이게 실전에서 가장 강력한 부분이다.

```python
from deepagents import create_deep_agent
from langchain_quickjs import CodeInterpreterMiddleware


def lookup_price(sku: str) -> str:
    """Return the current unit price for a SKU."""
    prices = {
        "A-100": "12000",
        "B-200": "18000",
        "C-300": "9000",
    }
    return prices.get(sku, "0")


agent = create_deep_agent(
    model="openai:gpt-5.5",
    tools=[lookup_price],
    middleware=[
        CodeInterpreterMiddleware(
            ptc=["lookup_price"],
            mode="thread",
        )
    ],
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": (
                    "Use the interpreter as a workflow. "
                    "Check A-100, B-200, C-300 prices, sum them, and return only the total."
                ),
            }
        ]
    }
)

print(result["messages"][-1].content)
```

공식 문서 기준 tool 이름은 interpreter 안에서 camelCase로 보인다.  
즉 `lookup_price`는 JavaScript 코드 안에서 `tools.lookupPrice(...)`처럼 호출된다.

이 패턴이 좋은 이유는 모델이 price 3개를 각각 읽고 다시 reasoning하는 대신, interpreter 안에서 반복 호출과 합계를 끝내고 최종 숫자만 모델에 돌려줄 수 있기 때문이다.

## 3. `mode`로 상태 지속 범위를 고른다

`CodeInterpreterMiddleware`의 중요한 옵션이 `mode`다.

- `"thread"`: 기본값. 같은 thread의 여러 턴에 걸쳐 interpreter 상태가 유지된다
- `"turn"`: 한 턴 안에서만 여러 `eval` 호출이 상태를 공유하고, 다음 턴에는 초기화된다
- `"call"`: `eval` 호출마다 완전히 새 REPL로 시작한다

짧은 데이터 정리라면 `turn`도 괜찮지만, 작업 중간 산출물을 다음 턴에서 다시 쓰고 싶다면 `thread`가 실용적이다.

```python
from deepagents import create_deep_agent
from langchain_quickjs import CodeInterpreterMiddleware


agent = create_deep_agent(
    model="openai:gpt-5.5",
    middleware=[CodeInterpreterMiddleware(mode="thread")],
)
```

공식 문서 기준 `mode="thread"`는 interpreter snapshot을 graph state에 저장하고 다음 턴에 복원한다. 다만 복원되는 것은 serializable한 JavaScript 상태뿐이고, 외부 tool call의 부작용까지 되돌리지는 않는다.

## 4. sandbox와 역할을 헷갈리지 않는 편이 중요하다

공식 문서는 interpreter와 sandbox를 명확히 나눈다.

- interpreter: agent loop 안의 계산, 분기, 상태 보관, tool 조합
- sandbox: 셸 명령, 테스트 실행, 파일 수정, 패키지 설치, OS 접근

예를 들어 "pytest를 돌리고 실패한 파일 목록만 다시 검토" 같은 흐름은 sandbox나 shell 권한이 필요하다.  
반대로 "검색 결과 20개를 필터링해서 상위 5개만 다시 요청" 같은 흐름은 interpreter가 더 적합하다.

## 자주 걸리는 함정

### 1. Python 코드를 실행하는 기능이라고 오해한다

현재 interpreter는 QuickJS 기반이므로 JavaScript 런타임이다.  
Python 코드를 agent 내부에서 직접 돌리는 기능으로 보면 안 된다.

### 2. PTC에 `interrupt_on` 승인 흐름이 자동 적용된다고 생각한다

공식 문서 기준 PTC 호출은 normal tool calling path를 거치지 않는다.  
그래서 PTC로 실행된 tool call마다 `interrupt_on` 승인 정책이 자동 적용되지 않는다.

### 3. 직렬화되지 않는 상태를 다음 턴에도 쓸 수 있다고 기대한다

함수, 클래스 등 unserializable한 런타임 객체는 복원되지 않는다.  
다음 턴까지 유지해야 하는 값은 직렬화 가능한 데이터 구조로 남기는 편이 안전하다.

### 4. 모든 외부 접근이 가능하다고 기대한다

기본 interpreter는 filesystem, network, shell, clock에 접근하지 못한다.  
그런 권한이 필요하면 tool, sandbox, subagent를 명시적으로 붙여야 한다.

## 추천 적용 순서

개인적으로는 아래 순서가 가장 덜 꼬인다.

1. `CodeInterpreterMiddleware()`만 붙여 pure in-memory 계산부터 확인
2. 반복 호출이 필요한 도구만 `ptc=[...]`로 최소 allowlist
3. cross-turn 상태가 필요하면 `mode="thread"`로 올림
4. fan-out이 필요할 때만 subagent와 `task()` 패턴 추가
5. 파일 수정이나 테스트 실행이 필요하면 interpreter 대신 sandbox 계층을 분리

Deep Agent에서 interpreter의 핵심 가치는 "모델이 중간 단계 전체를 직접 들고 가지 않게 만드는 것"에 있다.  
도구 호출이 조금만 복잡해져도 이 차이가 비용, 안정성, 컨텍스트 오염 면에서 꽤 크게 난다.

## 참고 자료

- [Interpreters](https://docs.langchain.com/oss/python/deepagents/interpreters)
- [Dynamic subagents](https://docs.langchain.com/oss/python/deepagents/dynamic-subagents)
- [Deep Agents overview](https://docs.langchain.com/oss/python/deepagents/overview)
