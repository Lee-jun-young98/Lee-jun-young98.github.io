---
title: LangChain Human-in-the-Loop으로 에이전트 승인 단계 넣기
description: LangChain의 HumanInTheLoopMiddleware와 checkpointer를 사용해 도구 실행 전에 승인 단계를 넣는 실전 입문 가이드
date: 2026-05-27
tags:
  - langchain
  - agent
  - human-in-the-loop
  - python
---

# LangChain Human-in-the-Loop으로 에이전트 승인 단계 넣기

AI agent를 데모로 만들 때는 도구 호출이 잘 되는지만 먼저 본다.  
그런데 실제로 운영을 생각하면 그 다음 질문이 바로 나온다.

- 이 도구 실행을 정말 바로 허용해도 되나?
- 메일 발송, 결제, DB 수정 같은 작업은 사람이 한 번 확인해야 하지 않나?
- 에이전트가 실수했을 때 어디에서 멈추게 해야 하나?

LangChain은 이런 상황을 위해 `HumanInTheLoopMiddleware`를 제공한다.  
핵심은 간단하다. 특정 도구 호출이 나오면 바로 실행하지 않고 interrupt를 발생시켜 사람 승인을 기다리게 만드는 방식이다.

이번 글에서는 아래만 실전 기준으로 빠르게 정리한다.

- 어떤 상황에서 human-in-the-loop가 필요한지
- `HumanInTheLoopMiddleware`를 붙이는 최소 예제
- 승인 후 다시 이어서 실행하는 흐름
- 자주 막히는 포인트

## 언제 필요한가

모든 agent에 승인 단계를 넣을 필요는 없다.  
다만 아래처럼 "잘못 실행되면 복구 비용이 큰 작업"에는 거의 기본값처럼 생각하는 편이 좋다.

- 메일 전송, Slack 발송, 고객 응답
- DB update, delete
- 외부 API로 실제 상태를 바꾸는 작업
- 비용이 큰 장기 작업 실행

반대로 단순 조회, 문서 검색, 계산 같은 읽기 전용 도구는 굳이 매번 사람 승인을 넣지 않아도 된다.

## 사전 준비

LangChain 공식 문서 기준으로 human-in-the-loop는 middleware와 checkpointer를 같이 이해하는 편이 좋다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

OpenAI를 예시로 하면 환경 변수는 아래처럼 준비한다.

```bash
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 승인 단계가 들어간 최소 예제

아래 예제는 `send_email` 도구를 실행하기 전에 반드시 사람 승인을 거치게 만든다.

```python
from langchain.agents import create_agent
from langchain.tools import tool
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langgraph.checkpoint.memory import InMemorySaver


@tool
def send_email(to: str, subject: str, body: str) -> str:
    """지정한 수신자에게 이메일을 전송한다."""
    return f"sent email to={to} subject={subject}"


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[send_email],
    middleware=[
        HumanInTheLoopMiddleware(
            interrupt_on={
                "send_email": True,
            }
        )
    ],
    checkpointer=InMemorySaver(),
    system_prompt="이메일 전송이 필요하면 도구를 호출하되, 필요한 정보를 먼저 확인하라.",
)

config = {"configurable": {"thread_id": "email-demo-1"}}

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "내일 오전 10시에 회의가 있다고 alex@example.com으로 메일 보내줘.",
            }
        ]
    },
    config=config,
)

print(result)
```

여기서 중요한 부분은 두 군데다.

- `interrupt_on={"send_email": True}`: 이 도구는 바로 실행하지 말고 멈추기
- `checkpointer=InMemorySaver()`: 멈춘 상태를 다시 이어가기 위한 상태 저장

즉, 승인 단계를 쓰려면 "멈춤"과 "재개"를 위한 상태 저장이 같이 있어야 한다.

## 2. 승인 후 이어서 실행하기

공식 문서 흐름 기준으로 interrupt가 발생하면 사용자는 승인 또는 거절 결정을 내려 다시 실행을 이어가게 된다.

예를 들어 UI나 서버에서 아래처럼 처리할 수 있다.

```python
from langgraph.types import Command


resume_result = agent.invoke(
    Command(resume=[{"type": "accept"}]),
    config=config,
)

print(resume_result["messages"][-1].content)
```

거절하고 싶다면 `accept` 대신 거절 응답을 보낸다.

```python
reject_result = agent.invoke(
    Command(resume=[{"type": "reject"}]),
    config=config,
)
```

실무에서는 이 `resume` 입력을 사람이 버튼으로 누르게 만들면 된다.

- `Approve`: 실제 도구 실행 계속
- `Reject`: 중단 또는 재질문
- `Edit`: 파라미터 수정 후 다시 실행

## 3. UI를 붙일 때 생각할 점

human-in-the-loop는 코드 한 줄로 끝나지 않는다.  
결국 사람이 무엇을 보고 승인할지 보여줘야 한다.

최소한 아래 정보는 같이 보여주는 편이 좋다.

- 어떤 도구를 호출하려는지
- 어떤 인자를 넣으려는지
- 이 호출이 왜 필요한지
- 승인/거절 뒤 어떤 일이 생기는지

예를 들어 `send_email`이라면 받는 사람, 제목, 본문 초안을 그대로 보여주는 식이 낫다.

## 4. 자주 막히는 포인트

### 4-1. checkpointer 없이 interrupt만 걸면 흐름이 어색해진다

승인 단계는 한 번 멈췄다가 이어서 실행하는 구조다.  
그래서 상태 저장 없이 쓰면 세션을 자연스럽게 복구하기 어렵다.

### 4-2. 모든 도구에 승인 단계를 걸면 사용성이 급격히 나빠진다

읽기 전용 도구까지 모두 사람 확인을 받으면 agent가 거의 수동 도구 모음처럼 변한다.  
승인이 필요한 도구만 좁게 지정하는 편이 낫다.

### 4-3. 승인 UI가 없으면 운영이 더 복잡해질 수 있다

터미널 데모에서는 되지만 실제 서비스에서는 interrupt 상태를 누가 보고 어떤 버튼으로 재개할지 설계해야 한다.  
즉, middleware보다 UI/운영 설계가 더 중요할 때도 많다.

### 4-4. 승인 전에 필요한 정보를 먼저 다 모으게 해야 한다

메일 전송 같은 작업에서 recipient, subject, body가 불완전한 상태로 승인 창이 뜨면 사람이 오히려 더 피곤해진다.  
system prompt에서 "필수 정보가 없으면 먼저 확인 질문"을 하도록 유도하는 편이 좋다.

## 5. 언제 LangGraph 수준으로 더 내려가야 하나

다음 요구가 생기면 middleware 하나로 끝내기보다 LangGraph 흐름 제어를 더 적극적으로 보는 편이 좋다.

- 승인 후 수정된 파라미터를 다시 검증해야 할 때
- 승인 담당자가 여러 역할로 나뉠 때
- 일부 도구는 자동, 일부는 조건부 승인으로 나눠야 할 때
- 승인 이력을 감사 로그로 남겨야 할 때

처음에는 `HumanInTheLoopMiddleware`로 시작하고, 프로세스가 복잡해질 때 그래프 기반 제어로 내려가는 순서가 보통 더 빠르다.

## 마무리

human-in-the-loop는 agent를 덜 똑똑하게 만드는 기능이 아니라, 실제 운영 가능한 형태로 바꾸는 기능에 가깝다.

- 위험한 도구 실행 전에 멈출 수 있고
- 사람 승인 후 다시 이어갈 수 있고
- "실행력"보다 "통제 가능성"이 중요한 구간을 분리할 수 있다

AI agent를 서비스에 가까운 형태로 만들기 시작했다면, tool calling 다음으로 빨리 검토해야 할 기능 중 하나다.

## 참고 자료

- LangChain Human-in-the-Loop: https://docs.langchain.com/oss/python/langchain/human-in-the-loop
- LangChain Agents: https://docs.langchain.com/oss/python/langchain/agents
- LangGraph Persistence / Memory: https://docs.langchain.com/oss/python/langgraph/add-memory
