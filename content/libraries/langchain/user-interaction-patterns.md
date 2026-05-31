---
title: LangChain 에이전트는 사용자와 어떻게 상호작용할까
description: LangChain과 LangGraph 기반 에이전트가 사용자 입력, 스트리밍, 도구 호출, 승인 단계, 메모리를 통해 상호작용하는 방식을 정리한 실전 가이드
date: 2026-05-31
tags:
  - langchain
  - agent
  - interaction
  - python
---

# LangChain 에이전트는 사용자와 어떻게 상호작용할까

LangChain이나 LangGraph로 에이전트를 만들다 보면 "모델이 답변을 잘하느냐"보다 먼저 정리해야 할 질문이 있다.

- 사용자의 입력은 어떤 형태로 들어오나
- 에이전트는 중간 진행 상황을 어떻게 보여주나
- 도구 호출 전후에 사용자에게 무엇을 보여줘야 하나
- 승인이나 수정 같은 개입은 어디서 받나
- 이전 대화 맥락은 어떻게 이어지나

이 문서는 LangChain 공식 문서 기준으로, 에이전트가 사용자와 상호작용하는 기본 구조를 한 번에 이해할 수 있도록 정리한 노트다.

## 한 줄로 요약하면

LangChain 에이전트의 사용자 상호작용은 보통 아래 흐름으로 이루어진다.

1. 사용자가 메시지를 보낸다
2. 에이전트가 현재 메시지와 대화 상태를 읽는다
3. 필요하면 도구를 호출하거나 사용자 확인을 기다린다
4. 중간 상태는 스트리밍으로 보여줄 수 있다
5. 최종 답변과 업데이트된 상태를 다시 사용자에게 돌려준다

즉 "질문 -> 답변"만 있는 구조가 아니라, 메시지, 상태, 도구, 승인, 스트리밍이 함께 묶인 상호작용 구조라고 보는 편이 맞다.

## 1. 가장 기본적인 상호작용: 메시지 기반 대화

공식 agents 문서 기준으로 LangChain 에이전트는 보통 `messages`를 입력으로 받는다.

```python
from langchain.agents import create_agent

agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    system_prompt="사용자 질문에 간결한 한국어로 답한다.",
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "LangChain 에이전트는 사용자와 어떻게 상호작용해?",
            }
        ]
    }
)

print(result["messages"][-1].content)
```

여기서 중요한 점은 세 가지다.

- 사용자 입력은 보통 `messages` 배열 안에 들어간다
- 에이전트 출력도 다시 `messages`에 쌓인다
- 즉 UI 입장에서는 "채팅 메시지 목록"을 중심으로 연결하면 된다

가장 단순한 챗 UI는 사실상 이 `messages` 입력과 출력만 잘 연결해도 동작한다.

## 2. 실제 상호작용은 답변 한 번으로 끝나지 않는다

실서비스에서는 사용자가 단일 질문만 하지 않는다.

- 방금 답변을 이어서 다시 묻는다
- 도구 실행 결과를 기반으로 후속 질문을 한다
- "아니, 그건 말고"처럼 방향을 수정한다
- 승인하거나 거절하면서 흐름에 개입한다

그래서 LangChain 에이전트는 현재 입력만 보는 것이 아니라, 대화 상태를 함께 본다.  
공식 문서에서는 이 맥락 유지에 `checkpointer`와 `thread_id`를 붙이는 패턴을 기본으로 안내한다.

```python
from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver

agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": "chat-user-1"}}

agent.invoke(
    {"messages": [{"role": "user", "content": "내 이름은 민수야."}]},
    config=config,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "내 이름 기억해?"}]},
    config=config,
)
```

이 구조 때문에 사용자와의 상호작용은 "요청 하나 처리"보다는 "같은 스레드 안에서 상태를 이어가는 대화"에 더 가깝다.

## 3. 사용자는 최종 답변만 보지 않고, 진행 상태도 본다

사용자 경험에서 꽤 중요한 부분이 스트리밍이다.  
공식 streaming 문서 기준으로 LangChain/LangGraph는 최종 텍스트만 한 번에 주는 대신 중간 이벤트를 흘려보낼 수 있다.

사용자 입장에서는 이런 식으로 보이게 된다.

- "생각 중"
- "도구 호출 중"
- "검색 결과 정리 중"
- "최종 답변 생성 중"

즉 상호작용은 답변 텍스트 하나를 받는 것이 아니라, 실행 과정을 단계적으로 관찰하는 방식까지 포함한다.

실제로 UI에서 많이 쓰는 패턴은 아래와 같다.

- 토큰 스트리밍: 답변 문장이 한 글자씩 또는 청크 단위로 보인다
- 상태 스트리밍: 현재 어떤 노드나 단계가 실행 중인지 보인다
- 커스텀 이벤트 스트리밍: "검색 시작", "승인 대기", "DB 업데이트 완료" 같은 이벤트를 직접 보낸다

사용자가 "멈췄나?"라고 느끼지 않게 만드는 핵심이 이 스트리밍 계층이다.

## 4. 도구 호출도 사용자 상호작용의 일부다

LangChain 에이전트는 필요하면 도구를 호출한다.  
하지만 사용자 입장에서는 이 도구 호출이 내부 구현 세부사항이 아니라, 상호작용 경험 그 자체가 된다.

예를 들면 사용자는 이런 흐름을 보게 된다.

- 질문 입력
- 에이전트가 검색 도구 호출
- 검색 결과를 요약
- 다시 최종 답변 반환

즉 에이전트와 사용자의 상호작용은 실제로는 "에이전트 혼자 답하는 구조"가 아니라 "에이전트가 도구를 대신 조작해 사용자 요청을 처리하는 구조"다.

도구 호출이 들어가면 UI에서는 보통 아래를 고려해야 한다.

- 어떤 도구를 호출했는지 보여줄지
- 도구 입력값을 노출할지
- 민감한 도구는 실행 전 승인받을지
- 실패했을 때 재시도/수정 UI를 둘지

공식 문서도 이런 이유로 middleware, human-in-the-loop, runtime context를 함께 설명한다.

## 5. 중요한 상호작용: 사용자 승인과 개입

에이전트가 메일 발송, 결제, 삭제처럼 위험한 작업을 한다면, 사용자와의 상호작용은 단순 채팅으로 끝나지 않는다.  
이때는 사용자 개입 지점이 필요하다.

LangChain은 이를 위해 `HumanInTheLoopMiddleware`를 제공한다.  
이 패턴에서는 에이전트가 도구 호출 직전에 멈추고, 사용자에게 승인을 요청한다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import HumanInTheLoopMiddleware
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver


@tool
def send_email(to: str, subject: str, body: str) -> str:
    """지정한 수신자에게 이메일을 전송한다."""
    return f"sent email to={to}"


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[send_email],
    middleware=[
        HumanInTheLoopMiddleware(
            interrupt_on={"send_email": True}
        )
    ],
    checkpointer=InMemorySaver(),
)
```

이 경우 사용자 상호작용은 이렇게 바뀐다.

1. 사용자가 작업 요청
2. 에이전트가 도구 호출 계획 수립
3. 시스템이 "이 작업을 실행할까요?"를 표시
4. 사용자가 승인/거절/수정
5. 그 결과에 따라 다시 진행

즉 실제 에이전트 UX에서는 "채팅창"만이 아니라 "승인창", "수정창", "재개 버튼"도 사용자 상호작용의 일부다.

## 6. 사용자 정보는 메시지 말고 context로도 들어간다

사용자와 상호작용한다고 해서 모든 정보를 자연어 메시지 안에 넣을 필요는 없다.  
공식 runtime/context 문서 기준으로, 사용자 권한이나 팀 설정 같은 값은 `context`로 주입하는 편이 더 안전하다.

예를 들면:

- user_id
- role
- locale
- feature flag
- 팀별 정책

이 값들은 사용자가 직접 타이핑한 메시지가 아니라, 애플리케이션이 알고 있는 사용자 정보다.  
그래서 보통은 메시지와 분리해서 `context`로 전달한다.

```python
from dataclasses import dataclass
from langchain.agents import create_agent


@dataclass
class UserContext:
    user_role: str
    locale: str


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    context_schema=UserContext,
)

agent.invoke(
    {"messages": [{"role": "user", "content": "오늘 해야 할 일 정리해줘."}]},
    context=UserContext(user_role="manager", locale="ko-KR"),
)
```

이 구조를 쓰면 사용자 상호작용을 두 층으로 나눠서 볼 수 있다.

- 사용자가 직접 보내는 자연어 메시지
- 시스템이 함께 전달하는 사용자 런타임 정보

실무에서는 둘을 분리할수록 권한 제어와 디버깅이 쉬워진다.

## 7. UI 관점에서 보면 무엇을 붙여야 하나

LangChain 에이전트에 UI를 붙일 때는 보통 아래 요소가 필요하다.

- 메시지 입력창
- 메시지 히스토리 렌더링
- 스트리밍 출력 영역
- 도구 호출 상태 표시
- 승인/거절/수정 인터럽트 UI
- 스레드 식별자 관리

즉 "LLM 답변 출력 창"만 만드는 것으로는 부족하다.  
에이전트는 상태를 가진 실행 흐름이기 때문에, UI도 상태 전이를 반영해야 한다.

간단히 말하면:

- chatbot처럼 보이는 부분은 `messages`
- 세션 유지 부분은 `thread_id`
- 진행 상태 부분은 `streaming`
- 안전장치 부분은 `human-in-the-loop`
- 개인화 부분은 `context`

이 다섯 가지를 같이 보면 구조가 한 번에 잡힌다.

## 8. 실제 챗 UI와 연결할 때의 최소 구조

실제로 프론트엔드나 백엔드에 붙일 때는 아래처럼 나누어 생각하면 편하다.

- 프론트엔드: 사용자 입력창, 메시지 리스트, 스트리밍 표시, 승인 버튼
- 백엔드: `agent.invoke()` 또는 `agent.stream()` 호출
- 상태 저장: `thread_id` 관리와 checkpointer 연결

예를 들어 웹 앱에서는 보통 이런 흐름이 된다.

1. 프론트엔드가 사용자 입력과 현재 `thread_id`를 서버로 보낸다
2. 서버가 같은 `thread_id`로 에이전트를 호출한다
3. 서버가 스트리밍 이벤트를 프론트엔드로 흘려보낸다
4. 프론트엔드는 답변 토큰, 도구 상태, 승인 대기 상태를 렌더링한다
5. 사용자가 승인하면 같은 `thread_id`로 다시 재개 요청을 보낸다

백엔드 기준으로 아주 단순화하면 아래 같은 형태다.

```python
from fastapi import FastAPI
from pydantic import BaseModel

from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver


app = FastAPI()

agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    checkpointer=InMemorySaver(),
)


class ChatRequest(BaseModel):
    thread_id: str
    message: str


@app.post("/chat")
def chat(req: ChatRequest):
    result = agent.invoke(
        {"messages": [{"role": "user", "content": req.message}]},
        config={"configurable": {"thread_id": req.thread_id}},
    )

    return {
        "reply": result["messages"][-1].content,
        "thread_id": req.thread_id,
    }
```

이 예제는 가장 단순한 요청-응답 구조다.  
여기에 스트리밍과 승인 단계를 붙이면 진짜 에이전트 UI에 가까워진다.

실무에서 보통 바로 붙는 추가 요소는 아래다.

- `/chat/stream`: 토큰 또는 상태 이벤트 스트리밍
- `/chat/approve`: 승인 대기 중인 실행 재개
- `/chat/history`: 같은 `thread_id`의 이전 대화 조회

즉 에이전트 앱은 LLM API 하나를 감싼 얇은 서버가 아니라, 대화 상태와 인터럽트를 관리하는 애플리케이션 레이어를 함께 가져간다고 보는 편이 맞다.

## 9. 언제 LangGraph 관점이 더 중요해지나

처음에는 LangChain agent만으로도 충분하다.  
하지만 사용자와의 상호작용이 아래처럼 복잡해지면 LangGraph 관점이 더 중요해진다.

- 여러 단계 승인이 필요할 때
- 한 번 거절되면 수정 후 다시 같은 단계로 돌아가야 할 때
- 긴 작업 중간에 재개가 필요할 때
- 멀티 에이전트 간 handoff를 사용자에게 보여줘야 할 때
- 진행 상황을 단계별로 정확히 스트리밍해야 할 때

이때부터는 상호작용을 "메시지 응답"이 아니라 "상태 머신 기반 워크플로우"로 보는 편이 정확하다.

## 자주 헷갈리는 포인트

### 1. 사용자 상호작용 = 프롬프트 작성이 아니다

프롬프트는 그중 한 부분일 뿐이다.  
실제 상호작용은 메시지 형식, 상태 저장, 도구 호출, 승인, 스트리밍까지 포함한다.

### 2. 모든 사용자 정보가 메시지에 들어갈 필요는 없다

권한, 사용자 ID, 팀 설정은 보통 메시지보다 `context`에 두는 편이 낫다.

### 3. 채팅 UI만 있으면 충분하지 않다

도구 호출 상태, 승인 대기, 재개 흐름이 있으면 별도 인터랙션 컴포넌트가 필요하다.

### 4. 메모리가 없으면 상호작용이 금방 끊긴다

후속 질문이 이어지는 경험을 만들려면 `checkpointer`와 `thread_id`를 같이 봐야 한다.

### 5. 스트리밍은 선택이 아니라 체감 품질에 가깝다

특히 도구 호출이 들어가면 사용자는 중간 진행 상황이 보이지 않을 때 시스템이 멈췄다고 느끼기 쉽다.

## 정리

LangChain이나 LangGraph에서 말하는 사용자 상호작용은 단순히 "질문을 받고 답을 준다"가 아니다.

- 사용자는 메시지를 보낸다
- 에이전트는 상태와 컨텍스트를 함께 읽는다
- 필요하면 도구를 호출하고 진행 상황을 스트리밍한다
- 위험한 작업은 사용자 승인을 기다린다
- 같은 스레드 안에서 맥락을 이어간다

그래서 에이전트를 만들 때는 모델 성능만 보지 말고, 사용자가 어떤 화면에서 어떤 타이밍에 무엇을 보게 되는지까지 같이 설계하는 것이 중요하다.

## 참고 자료

- [LangChain Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [LangChain Short-term memory](https://docs.langchain.com/oss/python/langchain/short-term-memory)
- [LangChain Human-in-the-Loop](https://docs.langchain.com/oss/python/langchain/human-in-the-loop)
- [LangChain Runtime](https://docs.langchain.com/oss/python/langchain/runtime)
- [LangChain Context engineering](https://docs.langchain.com/oss/python/langchain/context-engineering)
- [LangGraph Streaming](https://docs.langchain.com/oss/python/langgraph/streaming)
- [LangGraph Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
