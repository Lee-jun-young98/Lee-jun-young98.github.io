---
title: "LangChain 조건부 HITL과 approve·edit·reject·respond 결정 운영하기"
description: "HumanInTheLoopMiddleware의 when 조건과 네 가지 결정을 사용해 위험한 도구 호출만 멈추고 안전하게 재개하는 실전 패턴"
date: 2026-08-14
tags:
  - langchain
  - agent
  - human-in-the-loop
  - middleware
  - python
---

# LangChain 조건부 HITL과 approve·edit·reject·respond 결정 운영하기

모든 도구 호출을 승인 창으로 보내면 안전해 보이지만, 조회 작업까지 멈춰 agent 사용성이 크게 떨어진다. 실무에서는 **같은 도구라도 위험한 인자일 때만 멈추고**, 검토 목적에 맞는 결정을 허용하는 편이 낫다.

LangChain `HumanInTheLoopMiddleware`는 `interrupt_on`의 `when` 조건으로 검토 대상을 좁히고, 다음 네 결정을 지원한다.

- `approve`: 원래 인자로 실행
- `edit`: 검토자가 인자를 고친 뒤 실행
- `reject`: 실행하지 않고 거절 이유를 agent에게 전달
- `respond`: 도구를 실행하지 않고 사람의 답을 성공한 도구 결과로 전달

이 글은 단순 승인 버튼을 넘어 조건부 정책, `GraphOutput.interrupts`, 안전한 재개 payload를 한 흐름으로 정리한다.

## 사전 준비

조건부 `when`은 `langchain>=1.3.3`이 필요하다.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U "langchain>=1.3.3" langgraph langchain-openai
```

PowerShell에서는 API 키를 다음처럼 설정한다.

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

운영에서는 프로세스 재시작 뒤에도 interrupt를 복구할 수 있는 PostgreSQL 같은 영속 checkpointer를 써야 한다. 아래 `InMemorySaver`는 로컬 예제용이다.

## 1. 위험한 인자일 때만 멈추기

다음 정책은 `SELECT` 쿼리는 바로 실행하고, 데이터를 바꾸는 SQL만 승인 대상으로 보낸다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import (
    HumanInTheLoopMiddleware,
    ToolCallRequest,
)
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver


@tool
def execute_sql(query: str) -> str:
    """검증된 데이터베이스에서 SQL을 실행한다."""
    return f"executed: {query}"


def is_write_query(request: ToolCallRequest) -> bool:
    query = request.tool_call["args"].get("query", "")
    return not query.lstrip().upper().startswith("SELECT")


agent = create_agent(
    model="openai:gpt-5.4",
    tools=[execute_sql],
    middleware=[
        HumanInTheLoopMiddleware(
            interrupt_on={
                "execute_sql": {
                    "allowed_decisions": ["approve", "edit", "reject"],
                    "when": is_write_query,
                    "description": "쓰기 SQL을 실행하기 전에 검토하세요.",
                }
            }
        )
    ],
    checkpointer=InMemorySaver(),
)
```

`when`이 `False`이면 호출은 interrupt batch에 들어가지 않고 자동 실행된다. 따라서 검토자는 실제로 판단할 작업만 보게 된다. 이 함수는 모델 판단이 아니라 경로, SQL 종류, 금액처럼 **코드로 검증 가능한 값**에 기반해야 한다.

## 2. interrupt를 구조화된 출력으로 읽기

`version="v2"`로 호출하면 결과는 `GraphOutput`이며, 정상 상태는 `value`, 대기 중인 검토 요청은 `interrupts`에서 읽는다.

```python
config = {"configurable": {"thread_id": "sql-review-42"}}

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "30일 지난 임시 레코드를 삭제해 줘.",
            }
        ]
    },
    config=config,
    version="v2",
)

if result.interrupts:
    request = result.interrupts[0].value
    for action, review in zip(
        request["action_requests"], request["review_configs"], strict=True
    ):
        print(action["name"], action["arguments"])
        print(review["allowed_decisions"])
else:
    print(result.value["messages"][-1].content)
```

UI는 `action_requests`의 도구명·인자·설명과 `review_configs`의 허용 결정을 함께 렌더링하면 된다. 클라이언트가 임의의 결정 유형을 만들어 보내지 않도록 서버에서도 허용 목록을 다시 확인한다.

## 3. approve, edit, reject로 재개하기

재개할 때는 최초 호출과 **같은 `thread_id`**를 사용하고, `Command(resume={"decisions": [...]})`를 전달한다.

```python
from langgraph.types import Command


approved = agent.invoke(
    Command(resume={"decisions": [{"type": "approve"}]}),
    config=config,
    version="v2",
)
```

인자를 수정하려면 전체 action을 명시한다.

```python
edited = agent.invoke(
    Command(
        resume={
            "decisions": [
                {
                    "type": "edit",
                    "edited_action": {
                        "name": "execute_sql",
                        "args": {
                            "query": "DELETE FROM temp_records WHERE created_at < CURRENT_DATE - INTERVAL '90 days'"
                        },
                    },
                }
            ]
        }
    ),
    config=config,
    version="v2",
)
```

거절은 도구를 실행하지 않고 피드백을 agent에게 돌려준다.

```python
rejected = agent.invoke(
    Command(
        resume={
            "decisions": [
                {
                    "type": "reject",
                    "message": "삭제는 허용하지 않습니다. 건수만 조회하고 종료하세요.",
                }
            ]
        }
    ),
    config=config,
    version="v2",
)
```

`edit`는 작은 오탈자나 범위 조정에 적합하다. 도구 자체나 의미를 크게 바꾸면 모델이 계획을 다시 세우며 예상 밖의 추가 호출을 할 수 있으므로, 큰 변경은 `reject` 후 새 요청으로 받는 편이 명확하다.

## 4. ask_user 도구에는 respond 사용하기

`respond`는 거절의 다른 이름이 아니다. 사람이 실제 구현인 `ask_user`형 도구에서, 답변을 성공한 `ToolMessage`로 돌려주는 결정이다.

```python
@tool
def ask_user(question: str) -> str:
    """작업에 필요한 정보를 사용자에게 질문한다."""
    raise RuntimeError("HITL respond가 대신 처리하므로 실행되면 안 됩니다.")


question_agent = create_agent(
    model="openai:gpt-5.4",
    tools=[ask_user],
    middleware=[
        HumanInTheLoopMiddleware(
            interrupt_on={
                "ask_user": {"allowed_decisions": ["respond"]}
            }
        )
    ],
    checkpointer=InMemorySaver(),
)

question_config = {"configurable": {"thread_id": "onboarding-7"}}
paused = question_agent.invoke(
    {"messages": [{"role": "user", "content": "내 프로필을 완성해 줘."}]},
    config=question_config,
    version="v2",
)

resumed = question_agent.invoke(
    Command(
        resume={
            "decisions": [
                {"type": "respond", "message": "선호 언어는 한국어입니다."}
            ]
        }
    ),
    config=question_config,
    version="v2",
)
```

메일 전송이나 삭제 요청을 거부하면서 `respond`를 쓰면 모델은 작업이 성공했다고 이해한다. 부작용 도구를 막을 때는 반드시 `reject`를 쓴다.

## 5. 여러 호출은 순서와 개수를 맞춘다

한 모델 응답에 여러 도구 호출이 멈췄다면 각 action마다 결정 하나가 필요하며, 결정 순서는 `action_requests` 순서와 같아야 한다.

```python
resume_payload = {
    "decisions": [
        {"type": "approve"},
        {
            "type": "reject",
            "message": "두 번째 변경은 승인 범위를 벗어났습니다.",
        },
    ]
}
```

운영 API에서는 interrupt ID, action 개수, 도구명, 허용 결정, reviewer ID를 함께 저장하고 재개 직전에 다시 대조해야 순서 뒤바뀜과 중복 승인을 막을 수 있다.

## 자주 발생하는 실수

### `accept` 같은 예전 예제를 그대로 사용한다

현재 결정 이름은 `approve`, `edit`, `reject`, `respond`다. 재개 payload도 `resume={"decisions": [...]}` 구조를 사용한다.

### `when`에서 외부 API를 오래 호출한다

조건 함수는 tool call마다 동기적으로 평가될 수 있다. 권한·금액·경로처럼 이미 요청에 있는 값으로 빠르게 판단하고, 외부 정책 조회가 필요하면 별도 캐시와 실패 정책을 둔다.

### 프로덕션에서 `InMemorySaver`를 사용한다

프로세스가 내려가면 대기 중 상태도 사라진다. 운영에서는 영속 checkpointer와 안정적인 `thread_id` 매핑이 필수다.

### 수정된 인자를 다시 검증하지 않는다

`edit`는 검토 UI가 만든 새 입력이다. Pydantic 도구 스키마, 권한 검사, 도메인 validation을 실제 실행 직전에도 통과시켜야 한다.

## 정리

실용적인 HITL은 모든 호출을 멈추는 승인 버튼이 아니라 정책 기반 라우터에 가깝다.

- `when`으로 위험한 호출만 고른다.
- `approve`, `edit`, `reject`를 부작용 도구의 검토 정책에 맞게 제한한다.
- `respond`는 사람이 구현체인 질문 도구에만 쓴다.
- `GraphOutput.interrupts`를 표시하고 같은 thread를 `Command`로 재개한다.
- 여러 action의 결정 순서와 실행 직전 validation을 서버에서 검증한다.

## 참고 자료

- [LangChain Human-in-the-loop](https://docs.langchain.com/oss/python/langchain/human-in-the-loop)
- [LangChain middleware overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)
- [LangGraph interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
