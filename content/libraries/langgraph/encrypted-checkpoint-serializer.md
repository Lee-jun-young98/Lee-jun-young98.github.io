---
title: "LangGraph EncryptedSerializer로 checkpoint를 AES 암호화하기"
description: "LangGraph의 EncryptedSerializer와 LANGGRAPH_AES_KEY를 이용해 SQLite·Postgres checkpoint를 저장 시점에 암호화하고 운영할 때의 키 관리 주의점을 정리한 노트"
date: 2026-07-20
tags:
  - langgraph
  - python
  - persistence
  - security
aliases:
  - "/blog/langgraph-encrypted-checkpoint-serializer"
---

# LangGraph EncryptedSerializer로 checkpoint를 AES 암호화하기

LangGraph checkpointer에는 대화 메시지뿐 아니라 tool 결과, 승인 전 payload, 중간 계산값처럼 민감할 수 있는 graph state가 저장된다. 데이터베이스 권한과 디스크 암호화가 있어도 애플리케이션이 저장하는 checkpoint 자체를 암호화해야 하는 환경이 있다.

이때 checkpointer 구현을 새로 만들 필요는 없다. `EncryptedSerializer`를 `SqliteSaver`나 `PostgresSaver`의 `serde`에 주입하면 state가 직렬화된 뒤 AES로 암호화되어 저장되고, graph가 읽을 때 자동으로 복호화된다.

## 언제 필요한가

- checkpoint에 개인정보, 상담 내용, 내부 문서 조각이 들어간다
- 데이터베이스 운영자에게도 state 원문을 노출하지 않아야 한다
- 백업 파일이나 개발용 SQLite 파일 유출 위험을 줄이고 싶다
- 기존 checkpointer API를 유지하면서 application-level encryption을 추가하고 싶다

단, 이것은 전송 구간 암호화를 대신하지 않는다. DB 연결에는 TLS를 쓰고, 계정 권한·백업·로그·키 관리도 별도로 통제해야 한다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langgraph langgraph-checkpoint-sqlite pycryptodome
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langgraph langgraph-checkpoint-sqlite pycryptodome
```

운영 Postgres를 쓴다면 `langgraph-checkpoint-postgres`와 PostgreSQL driver도 설치한다.

## 1. AES 키를 코드 밖에서 준비한다

`from_pycryptodome_aes()`는 인자를 생략하면 `LANGGRAPH_AES_KEY` 환경 변수를 읽는다. AES 키는 16, 24, 32바이트여야 하므로 아래처럼 32자의 무작위 ASCII 문자열을 만들 수 있다.

```python
import secrets

print(secrets.token_urlsafe(24))  # ASCII 32자
```

PowerShell에서 현재 프로세스에만 넣는 예시:

```powershell
$env:LANGGRAPH_AES_KEY="생성한-32자-키"
```

`.env` 파일을 Git에 커밋하거나 소스 코드에 키를 하드코딩하지 않는다. 운영에서는 secret manager에서 프로세스 환경 변수나 `key=` 인자로 주입하는 편이 안전하다.

## 2. SQLite checkpoint를 암호화한다

아래 예제는 외부 LLM 없이 그대로 실행할 수 있다. 첫 실행에서 이름을 저장하고, 같은 `thread_id`로 두 번째 실행을 이어서 checkpoint 복호화까지 확인한다.

```python
import sqlite3
from typing_extensions import TypedDict

from langgraph.checkpoint.serde.encrypted import EncryptedSerializer
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph


class State(TypedDict):
    name: str
    greeting: str


def greet(state: State):
    return {"greeting": f"안녕하세요, {state['name']}님"}


builder = StateGraph(State)
builder.add_node("greet", greet)
builder.add_edge(START, "greet")
builder.add_edge("greet", END)

connection = sqlite3.connect("checkpoint.db", check_same_thread=False)
serde = EncryptedSerializer.from_pycryptodome_aes()
checkpointer = SqliteSaver(connection, serde=serde)
graph = builder.compile(checkpointer=checkpointer)

config = {"configurable": {"thread_id": "user-42"}}

result = graph.invoke(
    {"name": "민지", "greeting": ""},
    config,
)
print(result["greeting"])

snapshot = graph.get_state(config)
print(snapshot.values)

connection.close()
```

예상 출력:

```text
안녕하세요, 민지님
{'name': '민지', 'greeting': '안녕하세요, 민지님'}
```

애플리케이션에서는 평소처럼 state dict를 주고받는다. 암복호화 경계는 `EncryptedSerializer`와 checkpointer 사이에 있으므로 node 코드는 바뀌지 않는다.

## 3. 실제 DB에 평문이 남지 않았는지 확인한다

`graph.get_state()`가 정상 동작하는 것만으로는 암호화 적용을 검증하기 부족하다. SQLite 파일에서 민감 문자열을 직접 검색해 원문이 없는지도 확인한다.

```python
from pathlib import Path

raw_database = Path("checkpoint.db").read_bytes()

assert "민지".encode("utf-8") not in raw_database
assert "안녕하세요".encode("utf-8") not in raw_database
print("checkpoint payload is not stored as plaintext")
```

이 검사는 테스트용 smoke check다. 암호화 알고리즘의 안전성을 증명하는 검증은 아니지만, `serde`를 빠뜨리거나 다른 checkpointer 인스턴스를 사용한 설정 실수는 잡아낼 수 있다.

## 4. PostgresSaver에도 같은 serializer를 주입한다

운영 DB에서도 경계는 같다.

```python
from langgraph.checkpoint.postgres import PostgresSaver
from langgraph.checkpoint.serde.encrypted import EncryptedSerializer

serde = EncryptedSerializer.from_pycryptodome_aes()

with PostgresSaver.from_conn_string(
    "postgresql://app:password@db.example.com:5432/agents",
    serde=serde,
) as checkpointer:
    checkpointer.setup()  # 최초 배포 또는 migration 단계에서 한 번
    graph = builder.compile(checkpointer=checkpointer)
```

`setup()`을 매 요청마다 실행하지 말고 배포 또는 migration 단계로 분리한다. 비동기 graph 실행에는 `AsyncPostgresSaver`처럼 backend도 async 구현을 맞춘다.

## 운영에서 자주 놓치는 함정

### 1. 키가 바뀌면 기존 checkpoint를 읽지 못한다

암호화에 사용한 키는 데이터 수명과 함께 관리해야 한다. 환경 변수만 새 키로 덮어쓰면 이전 checkpoint 복호화가 실패한다. 키 회전이 필요하면 구 키로 읽고 새 키로 다시 저장하는 migration, key version metadata, 이전 키의 제한적 보관 정책을 먼저 설계한다.

### 2. 암호화 활성화 전의 평문 checkpoint는 자동 변환되지 않는다

`serde`를 추가한 시점 이후의 쓰기만 암호화된다고 가정해야 한다. 기존 테이블이나 백업의 평문 row는 별도 migration 또는 폐기 정책이 필요하다. staging 복제본과 오래된 DB snapshot도 함께 점검한다.

### 3. state는 암호화돼도 metadata와 로그까지 모두 숨겨진다고 가정하면 안 된다

serializer는 checkpoint payload를 보호한다. `thread_id`, DB index, 애플리케이션 로그, tracing payload 등 주변 데이터가 같은 방식으로 전부 암호화된다고 가정하지 않는다. 식별자는 원문 개인정보 대신 UUID 같은 불투명한 값을 쓰는 편이 낫다.

### 4. pickle fallback은 편의 기능이지 신뢰 경계가 아니다

기본 `JsonPlusSerializer`로 표현하기 어려운 Python 객체 때문에 `pickle_fallback=True`를 켤 수 있지만, 신뢰할 수 없는 checkpoint 데이터의 역직렬화에는 위험하다. 암호화는 기밀성을 높이지만 악성 데이터 역직렬화 문제를 자동으로 없애지는 않는다. 가능하면 state를 JSON/msgpack 친화적인 타입으로 제한한다.

### 5. InMemorySaver 암호화는 운영 영속성을 만들어 주지 않는다

`InMemorySaver(serde=serde)`도 가능하지만 프로세스가 종료되면 데이터가 사라진다. 암호화 여부와 persistence backend의 내구성은 별개의 선택이다.

## 실무 적용 체크리스트

1. checkpoint에 들어가는 민감 데이터 목록을 먼저 정한다.
2. 16/24/32바이트 AES 키를 secret manager에서 주입한다.
3. 모든 saver 생성 지점에 동일한 `EncryptedSerializer`를 연결한다.
4. 테스트에서 저장 파일이나 DB dump에 대표 평문이 없는지 검사한다.
5. 키 분실·회전·폐기 절차와 기존 평문 checkpoint migration을 문서화한다.
6. TLS, DB 권한, backup encryption, log masking을 함께 적용한다.

## 참고 자료

- [LangGraph Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [LangGraph checkpointing API reference](https://reference.langchain.com/python/langgraph/checkpoints)
- [EncryptedSerializer API reference](https://reference.langchain.com/python/langgraph.checkpoint/serde/encrypted/EncryptedSerializer)
- [PostgresSaver API reference](https://reference.langchain.com/python/langgraph.checkpoint/postgres/PostgresSaver)
