---
title: LangChain long-term memory로 사용자 선호 저장하고 다시 꺼내기
description: LangChain create_agent에 store를 연결해 세션 밖에서도 유지되는 장기 메모리를 만들고, ToolRuntime으로 읽고 쓰는 실전 패턴 정리
date: 2026-06-09
tags:
  - langchain
  - agent
  - memory
  - personalization
  - python
---

# LangChain long-term memory로 사용자 선호 저장하고 다시 꺼내기
`short-term memory`는 같은 thread 안에서만 대화 맥락을 이어준다.  
하지만 실무 agent는 여기서 한 단계 더 가야 할 때가 많다.

- 사용자가 "답변은 짧게 해달라"고 말한 선호를 다음 세션에도 유지하고 싶다
- 이전 상담에서 저장한 고객 정보나 작업 선호를 다시 꺼내고 싶다
- 여러 thread에서 공통으로 참고할 사용자별 메모리를 두고 싶다

이럴 때 LangChain v1 계열 agent는 `store` 기반 `long-term memory`를 붙일 수 있다.  
공식 문서 기준으로 장기 메모리는 LangGraph store 위에 올라가며, `namespace`와 `key`로 JSON 문서를 저장한다.

이 글에서는 아래를 실무 기준으로 빠르게 정리한다.

- `create_agent(..., store=...)`로 장기 메모리 붙이기
- `ToolRuntime`에서 `runtime.store`로 메모리 읽고 쓰기
- 사용자별 namespace를 나누는 패턴
- `InMemoryStore`와 `PostgresStore`를 언제 쓰는지
- 자주 하는 실수와 운영 팁

## 언제 쓰면 좋은가
`long-term memory`는 "대화가 끝난 뒤에도 남아 있어야 하는 정보"에 맞다.

- 사용자 선호: 답변 길이, 언어, 톤
- 계정/프로필 정보: 이름, 팀, 역할
- 반복 작업 맥락: 자주 쓰는 리포트 형식, 승인 정책
- 여러 session에서 재사용할 agent 메모

반대로 아래는 보통 장기 메모리보다 다른 수단이 더 낫다.

- 현재 대화 안에서만 필요한 중간 추론 흔적
- 최신성이 아주 중요한 실시간 데이터
- 저장하면 안 되는 민감정보 원문
- 스키마가 엄격한 업무 데이터베이스 레코드

장기 메모리는 편의성과 개인화에는 좋지만, 데이터 거버넌스와 저장 기준이 같이 따라와야 한다.

## 사전 준비
공식 LangChain 문서 기준으로 agent에 장기 메모리를 붙이려면 `create_agent`에 `store`를 전달하면 된다.  
개발 중에는 `InMemoryStore`, 운영에서는 DB-backed store를 권장한다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain langgraph langchain-openai
```

PostgreSQL 기반 store까지 보려면:

```bash
pip install -U langgraph-checkpoint-postgres
```

OpenAI 예시:

```bash
export OPENAI_API_KEY="your-api-key"
```

Windows PowerShell:

```powershell
$env:OPENAI_API_KEY="your-api-key"
```

## 1. 가장 작은 형태: store를 agent에 연결하기
공식 문서의 기본 형태는 단순하다.

```python
from langchain.agents import create_agent
from langgraph.store.memory import InMemoryStore


store = InMemoryStore()

agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[],
    store=store,
)
```

이렇게만 해도 agent 실행 시 tool 안에서 같은 store에 접근할 수 있는 준비가 끝난다.  
다만 실제로 메모리를 읽고 쓰려면 `ToolRuntime`을 받는 tool을 하나 이상 두는 편이 일반적이다.

## 2. 사용자별 선호를 저장하고 다음 세션에서 다시 읽기
실무에서 가장 바로 쓰이는 패턴은 사용자 선호 저장이다.

```python
from dataclasses import dataclass
from typing_extensions import TypedDict

from langchain.agents import create_agent
from langchain.tools import ToolRuntime, tool
from langgraph.store.memory import InMemoryStore


@dataclass
class Context:
    user_id: str


class PreferencePayload(TypedDict):
    response_style: str
    language: str


store = InMemoryStore()


@tool
def save_preferences(
    preferences: PreferencePayload,
    runtime: ToolRuntime[Context],
) -> str:
    """사용자 선호를 저장한다."""
    assert runtime.store is not None

    runtime.store.put(
        ("users", "preferences"),
        runtime.context.user_id,
        dict(preferences),
    )
    return "preferences saved"


@tool
def load_preferences(runtime: ToolRuntime[Context]) -> str:
    """저장된 사용자 선호를 읽는다."""
    assert runtime.store is not None

    item = runtime.store.get(
        ("users", "preferences"),
        runtime.context.user_id,
    )
    if item is None:
        return "no saved preferences"

    return str(item.value)


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[save_preferences, load_preferences],
    store=store,
    context_schema=Context,
)


agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "내 답변은 한국어로 짧고 핵심만 말해. 저장해줘.",
            }
        ]
    },
    context=Context(user_id="user-123"),
)

result = agent.invoke(
    {
        "messages": [
            {
                "role": "user",
                "content": "내 저장된 답변 선호를 확인해줘.",
            }
        ]
    },
    context=Context(user_id="user-123"),
)

print(result["messages"][-1].content)
```

핵심은 세 가지다.

- `context_schema`로 현재 호출의 사용자 식별자를 전달한다
- tool 안에서 `runtime.context.user_id`로 현재 사용자를 구분한다
- `runtime.store.put/get(...)`으로 thread 밖 메모리를 읽고 쓴다

이 패턴이면 다른 thread에서 호출해도 같은 `user_id`라면 같은 메모리를 재사용할 수 있다.

## 3. namespace와 key는 어떻게 나누는가
공식 문서에서 store는 `namespace`와 `key` 구조를 쓴다.  
실무에서는 이 설계를 대충 하면 나중에 검색, 삭제, 마이그레이션이 다 불편해진다.

### 추천 패턴

- `namespace`: 큰 분류
- `key`: 개별 문서 식별자

예를 들면:

```python
namespace = ("users", "preferences")
key = "user-123"
```

또는 더 세분화해서:

```python
namespace = ("org-7", "users", "preferences")
key = "user-123"
```

이렇게 두면 장점이 있다.

- 사용자별, 조직별 격리가 쉽다
- 특정 영역만 검색하거나 백업하기 쉽다
- 저장 데이터 종류가 늘어나도 구조를 유지하기 쉽다

반대로 namespace에 너무 많은 의미를 문자열 한 덩어리로 몰아넣으면 운영이 금방 꼬인다.

## 4. 검색 가능한 메모리로 확장하기
공식 문서의 장기 메모리 가이드는 `IndexConfig`를 붙여 store 검색을 지원하는 예시도 보여준다.  
즉 장기 메모리는 단순 key-value를 넘어 "관련 메모리 찾기"로 확장할 수 있다.

```python
from collections.abc import Sequence

from langgraph.store.base import IndexConfig
from langgraph.store.memory import InMemoryStore


def embed(texts: Sequence[str]) -> list[list[float]]:
    # 실제 운영에서는 LangChain embeddings 또는 자체 임베딩 함수를 연결
    return [[1.0, 2.0] for _ in texts]


store = InMemoryStore(index=IndexConfig(embed=embed, dims=2))

store.put(
    ("users", "memories"),
    "memory-1",
    {
        "text": "사용자는 주간 리포트에서 표보다 bullet 요약을 선호한다.",
        "type": "preference",
    },
)

items = store.search(
    ("users", "memories"),
    filter={"type": "preference"},
    query="리포트 형식 선호",
)

for item in items:
    print(item.key, item.value)
```

이 패턴은 아래처럼 쓸 때 특히 유용하다.

- 사용자가 많아서 메모리 개수가 빠르게 늘어나는 경우
- 특정 사실을 exact key가 아니라 의미 기반으로 찾고 싶은 경우
- "선호", "정책", "이전 작업 요약"처럼 서로 다른 메모리 유형을 함께 저장하는 경우

## 5. 운영에서는 왜 PostgresStore를 더 많이 쓰는가
공식 문서는 개발용으로 `InMemoryStore`, 운영용으로는 DB-backed store를 권장한다.  
`InMemoryStore`는 프로세스가 내려가면 메모리가 사라지기 때문이다.

```python
from langchain.agents import create_agent
from langgraph.store.postgres import PostgresStore  # type: ignore[import-not-found]


DB_URI = "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable"

with PostgresStore.from_conn_string(DB_URI) as store:
    store.setup()

    agent = create_agent(
        model="openai:gpt-5.4-mini",
        tools=[],
        store=store,
    )
```

운영 관점에서 `PostgresStore`가 나은 이유는 보통 이렇다.

- 프로세스 재시작 후에도 메모리가 유지된다
- 백업과 접근 제어를 기존 DB 운영 체계에 맞출 수 있다
- 여러 worker가 같은 메모리 저장소를 공유할 수 있다

다만 장기 메모리를 붙였다고 해서 곧바로 "좋은 기억 시스템"이 되는 것은 아니다.  
무엇을 저장하고 언제 갱신할지 정책이 더 중요하다.

## 6. 무엇을 저장할지 기준을 먼저 정해야 한다
LangChain의 memory conceptual guide는 장기 메모리를 semantic, episodic, procedural 관점으로 나눠 생각할 수 있다고 설명한다.

- semantic memory: 사용자 사실, 선호, 프로필
- episodic memory: 과거 agent 행동이나 작업 기록
- procedural memory: agent가 따를 지침이나 운영 규칙

실무에서는 semantic memory부터 시작하는 편이 가장 안전하다.  
사용자 선호나 프로필처럼 구조가 단순하고 효과가 바로 보이기 때문이다.

반면 episodic memory는 금방 길어지고, procedural memory는 잘못 저장하면 agent 동작 전체를 흔들 수 있다.

## 흔한 실수
### 1. short-term memory와 long-term memory 역할을 섞는 경우
현재 대화 히스토리는 checkpointer 쪽 책임이고, 장기 메모리는 thread 밖에도 남아야 하는 정보에 맞다.  
둘을 구분하지 않으면 store에 불필요한 대화 로그가 계속 쌓인다.

### 2. 사용자 구분 없이 전역 namespace에 저장하는 경우
`("preferences",)` 같은 단일 namespace에 모두 넣으면 나중에 사용자 격리가 어려워진다.  
최소한 사용자나 조직 스코프는 명확히 반영하는 편이 낫다.

### 3. 저장 기준 없이 아무 말이나 메모리화하는 경우
공식 conceptual guide도 메모리 생성은 latency와 품질 tradeoff가 있다고 설명한다.  
사용자 한 문장마다 무조건 저장하게 만들면 비용도 늘고 품질도 나빠진다.

### 4. 민감정보 원문을 그대로 저장하는 경우
장기 메모리는 오래 남는다.  
전화번호, 주민등록 관련 정보, 결제 정보 같은 내용은 저장 전 마스킹이나 차단 정책을 먼저 설계해야 한다.

### 5. hot path에서 너무 많은 메모리 판단을 시키는 경우
공식 conceptual guide 기준으로 런타임 중 메모리 생성은 즉시성 장점이 있지만, agent latency와 응답 품질에 부담을 줄 수 있다.  
기억 생성 로직이 무거워지면 background job 분리도 고려해야 한다.

## 운영 팁
- 처음에는 "사용자 선호 2~3개 저장"처럼 좁은 범위로 시작하는 편이 낫다.
- 저장 도구와 조회 도구를 분리하면 trace와 디버깅이 쉬워진다.
- key-value lookup부터 시작하고, 정말 필요할 때만 semantic search를 붙이는 편이 단순하다.
- 장기 메모리에는 저장 TTL, 삭제 정책, 사용자 수정 경로를 같이 설계하는 편이 안전하다.
- 민감정보가 섞일 수 있으면 `PIIMiddleware` 같은 가드레일과 함께 보는 편이 낫다.

## 마무리
LangChain의 `long-term memory`는 "이전 대화 내용을 계속 길게 들고 가는 기능"이라기보다,  
"세션 밖에서도 재사용할 정보를 store에 구조적으로 남기는 기능"에 가깝다.

실무에서는 아래 순서로 접근하면 무리가 적다.

1. `InMemoryStore`로 로컬에서 구조를 먼저 검증한다
2. 사용자 선호 같은 semantic memory부터 저장한다
3. 운영에 들어가면 `PostgresStore` 같은 영속 저장소로 옮긴다
4. 저장 기준, 삭제 정책, 민감정보 정책을 같이 묶어서 운영한다

LangChain agent를 여러 session에 걸쳐 더 개인화하고 싶다면, 다음에 볼 기능이 아니라 지금 바로 붙여볼 만한 기본기다.

## 참고 자료

- [LangChain Long-term memory](https://docs.langchain.com/oss/python/langchain/long-term-memory)
- [LangChain Memory overview](https://docs.langchain.com/oss/python/concepts/memory)
- [LangChain Tools](https://docs.langchain.com/oss/python/langchain/tools)
- [LangChain create_agent Reference](https://reference.langchain.com/python/langchain/agents/#langchain.agents.create_agent)
