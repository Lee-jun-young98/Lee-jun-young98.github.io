---
title: LangGraph Store TTL로 장기 메모리 만료 정책 운영하기
description: PostgresStore의 TTL, refresh_on_read, per-item ttl, sweeper를 조합해 cross-thread 장기 메모리를 자동 만료하는 실전 패턴
date: 2026-08-07
tags:
  - langgraph
  - memory
  - postgres
  - operations
  - python
---

# LangGraph Store TTL로 장기 메모리 만료 정책 운영하기

LangGraph의 `store`는 사용자 선호나 프로필처럼 여러 thread가 공유하는 장기 메모리를 보관한다. 하지만 모든 메모리를 영구 보존하면 오래된 추천 맥락, 임시 동의, 세션성 개인화 정보가 계속 쌓인다.

`PostgresStore`의 TTL(time-to-live)을 사용하면 메모리마다 만료 시간을 두고, 읽을 때 수명을 연장할지까지 정할 수 있다. 핵심은 다음 세 가지다.

- `default_ttl`: 별도 설정이 없는 새 항목의 기본 수명(분)
- `ttl=`: `put()` 호출별 수명 재정의(분), `None`이면 만료하지 않음
- `refresh_on_read`: `get()`과 `search()`가 만료 시계를 갱신할지 여부

> [!important]
> Store TTL은 cross-thread 메모리의 수명 정책이다. graph checkpoint와 pending write를 지우는 기능이 아니며, node `CachePolicy.ttl`과도 단위와 대상이 다르다.

## 사전 준비

로컬 PostgreSQL과 Python 3.10+를 준비하고 패키지를 설치한다.

```bash
pip install -U langgraph langgraph-checkpoint-postgres "psycopg[binary]"
```

PowerShell에서는 접속 문자열을 환경 변수로 둔다.

```powershell
$env:POSTGRES_URI = "postgresql://postgres:postgres@localhost:5432/postgres"
```

TTL API는 store 구현체가 `supports_ttl=True`를 제공해야 한다. `InMemoryStore`는 테스트용 메모리 저장소일 뿐 TTL 동작을 검증하는 대체재가 아니다.

## 실행 가능한 최소 예제

아래 코드는 기본 수명을 60분으로 두되, 보안 동의는 10분, 명시적 사용자 선호는 무기한으로 저장한다.

```python
from __future__ import annotations

import os

from langgraph.store.postgres import PostgresStore


DB_URI = os.environ["POSTGRES_URI"]

ttl_config = {
    "default_ttl": 60,
    "refresh_on_read": False,
    "sweep_interval_minutes": 5,
}

with PostgresStore.from_conn_string(DB_URI, ttl=ttl_config) as store:
    # 최초 배포와 패키지 migration 후 한 번 실행한다.
    store.setup()

    # 설정만으로는 만료 row가 자동 삭제되지 않는다.
    store.start_ttl_sweeper()
    try:
        namespace = ("users", "alice", "memories")

        # 기본 TTL 60분
        store.put(namespace, "recent-topic", {"text": "LangGraph TTL 학습 중"})

        # 항목별 TTL 10분
        store.put(
            namespace,
            "temporary-consent",
            {"allowed": True},
            ttl=10,
        )

        # 이 항목만 만료하지 않음
        store.put(
            namespace,
            "language-preference",
            {"language": "ko"},
            ttl=None,
        )

        # 전역 refresh_on_read=False를 그대로 사용한다.
        item = store.get(namespace, "recent-topic")
        print(item.value if item else None)

        # 이 조회에서 반환된 항목만 수명을 갱신한다.
        active = store.search(namespace, limit=10, refresh_ttl=True)
        print([result.key for result in active])
    finally:
        store.stop_ttl_sweeper()
```

`default_ttl`과 `put(..., ttl=...)`의 단위는 **분**이다. 반면 node cache의 `CachePolicy(ttl=...)`은 **초**이므로 같은 숫자를 재사용하면 운영 사고가 나기 쉽다.

## Graph node 안에서 적용하기

graph를 `compile(store=store)`로 만든 뒤에는 `Runtime`에서 같은 store를 사용할 수 있다. 사용자 ID를 namespace에 포함해 tenant 간 메모리를 분리한다.

```python
from dataclasses import dataclass
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime


@dataclass
class Context:
    user_id: str


class State(TypedDict):
    topic: str


def remember_topic(state: State, runtime: Runtime[Context]):
    namespace = ("users", runtime.context.user_id, "recent-topics")
    runtime.store.put(
        namespace,
        state["topic"],
        {"topic": state["topic"]},
        ttl=24 * 60,  # 24시간, 단위는 분
    )
    return {}


builder = StateGraph(State, context_schema=Context)
builder.add_node("remember_topic", remember_topic)
builder.add_edge(START, "remember_topic")
builder.add_edge("remember_topic", END)
graph = builder.compile(store=store)

graph.invoke({"topic": "langgraph-ttl"}, context=Context(user_id="alice"))
```

운영 코드에서는 위 graph 호출이 `with PostgresStore...` 블록과 sweeper 생명주기 안에서 실행되어야 한다.

## 고정 만료와 sliding expiration 고르기

`refresh_on_read=True`는 자주 쓰는 메모리의 수명을 계속 연장하는 sliding expiration에 가깝다. 개인화 선호나 최근 작업 문맥에는 유용하지만, 법적 동의나 임시 권한처럼 정해진 시점에 반드시 만료해야 하는 데이터에는 부적합하다.

그런 경우 전역값을 `False`로 두고 필요한 조회만 `refresh_ttl=True`로 명시하는 편이 안전하다. `search()`는 여러 결과의 TTL을 한꺼번에 갱신할 수 있으므로, 단순 목록 화면이나 배치 분석에서는 `refresh_ttl=False`를 명시해 관찰 자체가 보존 정책을 바꾸지 않게 한다.

## 운영 체크리스트와 흔한 함정

- `setup()`은 필요한 테이블과 migration을 준비한다. 애플리케이션 시작마다 무분별하게 호출하기보다 배포 절차로 관리한다.
- TTL 설정만 전달하고 `start_ttl_sweeper()`를 빼먹으면 만료 row 정리가 주기적으로 실행되지 않는다.
- 프로세스 종료 시 `stop_ttl_sweeper()`를 호출한다. 여러 worker가 각각 sweeper를 띄울지, 별도 정리 worker 하나만 둘지도 정한다.
- 만료 삭제는 sweep 주기에 따라 지연될 수 있다. 정확한 초 단위 삭제 시각을 보장하는 보안 제어로 간주하지 않는다.
- `put()`으로 같은 key를 다시 쓰면 write가 만료 시계를 갱신한다. 재시도와 중복 이벤트가 수명을 의도치 않게 연장하지 않는지 확인한다.
- namespace에 `user_id`나 tenant ID를 포함하되, TTL을 접근 제어의 대체재로 쓰지 않는다.
- checkpoint 보존은 `delete_thread()`, node 결과 캐시는 `CachePolicy`, 장기 메모리 만료는 Store TTL로 각각 분리한다.

## 참고 자료

- [LangGraph BaseStore 공식 레퍼런스](https://reference.langchain.com/python/langgraph.store/base/BaseStore)
- [LangGraph TTLConfig 공식 레퍼런스](https://reference.langchain.com/python/langgraph.store/base/TTLConfig)
- [LangGraph PostgresStore 공식 레퍼런스](https://reference.langchain.com/python/langgraph.store.postgres/base/PostgresStore)
- [LangGraph Store search 공식 레퍼런스](https://reference.langchain.com/python/langgraph.store/base/BaseStore/search)
