---
title: "LangSmith 분산 tracing으로 서비스 간 trace 이어 붙이기"
description: "get_current_run_tree(), to_headers(), TracingMiddleware, tracing_context(parent=...)를 이용해 Python 서비스 사이에서 LangSmith trace를 끊기지 않게 전파하는 방법을 정리한 실전 노트"
date: 2026-07-12
tags:
  - langsmith
  - tracing
  - observability
  - python
aliases:
  - "/blog/langsmith-distributed-tracing-python"
---

# LangSmith 분산 tracing으로 서비스 간 trace 이어 붙이기

LangSmith tracing을 한 프로세스 안에서만 붙이면 금방 한계가 온다.

- API gateway에서 요청을 받는다
- 별도 retrieval 서비스로 검색을 보낸다
- evaluator worker가 후처리를 한다
- 각 서비스는 trace가 남는데 한 요청으로 이어져 보이지 않는다

이럴 때 필요한 것이 분산 tracing이다.  
LangSmith는 `langsmith-trace`와 `baggage` 헤더를 이용해 서비스 사이에서 같은 trace를 이어 붙일 수 있다.

이 글에서는 Python 기준으로 아래 흐름만 실전적으로 정리한다.

- 클라이언트 서비스에서 현재 run context를 헤더로 전파하는 법
- FastAPI/ASGI 서버에서 trace를 이어 받는 법
- `TracingMiddleware`를 못 쓰는 프레임워크에서 수동으로 parent를 연결하는 법
- 멀티 워크스페이스 또는 프로젝트 라우팅과 함께 쓸 때의 주의점
- 실제로 자주 깨지는 함정

## 언제 유용한가

아래 같은 구조면 초반에 바로 익혀 두는 편이 좋다.

- BFF, API gateway, worker가 분리된 서비스 구조
- retrieval, tool execution, scoring이 각각 다른 프로세스에서 돈다
- 운영 장애가 "어느 서비스에서 시작됐는지"를 trace 단위로 봐야 한다
- tenant별로 다른 project나 workspace에 trace를 보내야 한다

반대로 단일 FastAPI 앱 안에서만 LangSmith를 붙이는 수준이면 tracing quickstart만으로도 충분한 경우가 많다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith fastapi uvicorn httpx
```

기본 환경 변수:

```bash
export LANGSMITH_API_KEY="lsv2_..."
export LANGSMITH_TRACING="true"
export LANGSMITH_PROJECT="gateway-prod"
```

알아둘 점:

- 2026년 7월 12일 기준 공식 문서는 `TracingMiddleware`가 `langsmith==0.1.133`에서 추가됐다고 안내한다.
- 공식 troubleshooting 문서는 Python 3.11 이상을 권장한다. 3.10 이하에서는 `asyncio`와 thread 경계에서 trace nesting이 끊길 수 있다.
- API key가 여러 workspace에 연결돼 있다면 `Client(..., workspace_id=...)`를 명시하는 편이 안전하다.

## 핵심 개념

분산 tracing의 핵심은 단순하다.

1. 현재 실행 중인 run context를 꺼낸다.
2. 이를 HTTP 헤더로 다음 서비스에 넘긴다.
3. 서버 쪽에서 그 헤더를 parent context로 받아 같은 trace 아래에 새 run을 붙인다.

클라이언트 쪽 핵심 API는 보통 이 둘이다.

- `get_current_run_tree()`
- `run_tree.to_headers()`

서버 쪽 핵심은 아래 둘 중 하나다.

- `TracingMiddleware`
- `tracing_context(parent=request.headers)` 또는 `langsmith_extra={"parent": request.headers}`

## 1. 클라이언트 서비스에서 헤더 전파하기

아래 예제는 gateway 서비스가 downstream 검색 서비스로 요청을 보내는 최소 형태다.

```python
import httpx
from langsmith import traceable
from langsmith.run_helpers import get_current_run_tree


@traceable(name="call_search_service", run_type="tool")
async def call_search_service(query: str) -> dict:
    headers: dict[str, str] = {}

    if run_tree := get_current_run_tree():
        headers.update(run_tree.to_headers())

    async with httpx.AsyncClient(base_url="http://127.0.0.1:8001") as client:
        response = await client.post(
            "/search",
            json={"query": query},
            headers=headers,
            timeout=10.0,
        )
        response.raise_for_status()
        return response.json()
```

포인트는 이것뿐이다.

- 현재 trace 안에서 실행되고 있어야 `get_current_run_tree()`가 값을 준다
- `to_headers()`가 `langsmith-trace`와 필요 시 `baggage`를 만든다
- 일반 비즈니스 헤더와 섞어서 보내도 된다

## 2. FastAPI에서 `TracingMiddleware`로 자연스럽게 이어 받기

ASGI 앱이라면 공식 문서 기준 가장 단순한 방법은 `TracingMiddleware`다.

```python
from fastapi import FastAPI
from langsmith import traceable
from langsmith.middleware import TracingMiddleware

app = FastAPI()
app.add_middleware(TracingMiddleware)


@traceable(name="retrieve_documents", run_type="tool")
async def retrieve_documents(query: str) -> list[str]:
    return [
        f"retrieved doc for: {query}",
        "secondary hit",
    ]


@app.post("/search")
async def search(payload: dict) -> dict:
    docs = await retrieve_documents(payload["query"])
    return {"documents": docs}
```

이렇게 두면 upstream 서비스가 보낸 `langsmith-trace` 헤더를 서버가 받아서 같은 trace 아래 run을 이어 붙인다.

이 방식이 좋은 이유는 아래와 같다.

- route 함수 안에서 매번 parent wiring 코드를 쓰지 않아도 된다
- 서비스 내부의 `@traceable` 함수들이 같은 trace tree 아래로 들어간다
- FastAPI, Starlette 같은 ASGI 계층에서 적용이 자연스럽다

## 3. 미들웨어를 쓰기 어려우면 `tracing_context(parent=...)`로 수동 연결하기

Flask, 커스텀 서버, 또는 일부 핸들러만 선택적으로 이어 붙이고 싶다면 수동 parent 연결이 더 명확할 수 있다.

```python
import langsmith as ls
from fastapi import FastAPI, Request

app = FastAPI()


@ls.traceable(name="run_business_logic")
async def run_business_logic(payload: dict) -> dict:
    return {
        "normalized_query": payload["query"].strip().lower(),
        "status": "ok",
    }


@app.post("/search")
async def search(request: Request, payload: dict) -> dict:
    with ls.tracing_context(parent=request.headers):
        return await run_business_logic(payload)
```

이 방식은 아래 상황에서 특히 유용하다.

- middleware 전체 적용이 부담스럽다
- trusted internal route에서만 distributed tracing을 열고 싶다
- 서버 프레임워크가 ASGI가 아니거나 미들웨어 연결이 애매하다

공식 문서에는 `langsmith_extra={"parent": request.headers}`를 직접 넘기는 방법도 나온다.  
한두 개 함수만 연결할 때는 이 방식도 충분하다.

## 4. project 또는 workspace를 동시에 라우팅하기

분산 tracing을 붙이다 보면 "같은 trace를 이어 붙이되 tenant별로 다른 project에 보내고 싶다"는 요구가 자주 생긴다.

이때는 `Client`와 `tracing_context`를 같이 쓴다.

```python
from langsmith import Client, traceable, tracing_context

premium_client = Client(
    api_key="YOUR_API_KEY",
    api_url="https://api.smith.langchain.com",
    workspace_id="ws_premium",
)

standard_client = Client(
    api_key="YOUR_API_KEY",
    api_url="https://api.smith.langchain.com",
    workspace_id="ws_standard",
)


def pick_route(customer_id: str):
    if customer_id.startswith("premium_"):
        return premium_client, "premium-gateway-traces"
    return standard_client, "standard-gateway-traces"


@traceable(name="handle_request")
def handle_request(payload: dict, customer_id: str) -> dict:
    return {"ok": True, "payload": payload, "customer_id": customer_id}


def serve_request(payload: dict, customer_id: str) -> dict:
    client, project_name = pick_route(customer_id)
    with tracing_context(enabled=True, client=client, project_name=project_name):
        return handle_request(payload, customer_id)
```

이 패턴은 분산 tracing 자체를 만드는 예제라기보다, trace 목적지를 런타임에 바꾸는 예제다.  
하지만 실제 운영에서는 둘이 자주 같이 묶인다.

예를 들어 아래처럼 생각하면 된다.

- upstream gateway는 tenant별 project를 고른다
- 그 상태에서 downstream 서비스로 `langsmith-trace` 헤더를 보낸다
- 각 서비스는 같은 trace를 공유하면서도 목적지 workspace/project 규칙을 맞춘다

## 5. Python 3.10 이하, `asyncio`, thread pool에서 trace가 끊길 수 있다

이 부분은 실전에서 꽤 중요하다.

공식 troubleshooting 문서 기준으로 Python 3.11 미만에서는 `contextvars` 전파 한계 때문에 child run이 별도 top-level trace처럼 분리될 수 있다.

예를 들어 아래 같은 상황이다.

- `asyncio.create_task(...)`
- streaming 중 비동기 child 호출
- `ThreadPoolExecutor`
- LangGraph/LangChain runnable과 `@traceable` 함수를 섞는 구조

문제가 생기면 보통 이렇게 대응한다.

1. 가능하면 Python 3.11 이상으로 올린다.
2. 그래도 경계가 복잡하면 parent run tree를 명시적으로 넘긴다.
3. LangChain/LangGraph runnable이면 `config`를 child 호출에 같이 넘긴다.

직접 SDK만 쓸 때의 수동 parent 전달 예시는 아래처럼 잡을 수 있다.

```python
import langsmith as ls


@ls.traceable
async def child_task(query: str):
    return f"child processed: {query}"


@ls.traceable
async def parent_task(query: str, run_tree: ls.RunTree):
    return await child_task(
        query,
        langsmith_extra={"parent": run_tree},
    )
```

trace가 자꾸 옆으로 새면 `parent`나 `config`가 실제로 경계를 넘어가고 있는지부터 보는 편이 빠르다.

## 자주 하는 실수

### 1. 외부 공개 트래픽에 tracing parent 헤더를 그대로 신뢰한다

이건 가장 위험한 실수다.

공식 문서는 `langsmith-trace`와 `baggage`를 trusted context로 취급하므로, public internet에서 들어오는 임의 헤더를 그대로 parent로 쓰지 말라고 명시한다.

즉 아래 원칙이 필요하다.

- distributed tracing은 내부 서비스 간 호출에만 쓴다
- gateway/proxy에서 신뢰되지 않은 inbound header를 제거한다
- `TracingMiddleware`는 공개 외부 요청을 직접 받는 서비스에 무조건 켜지 않도록 주의한다

### 2. upstream에서 헤더를 만들었는데 downstream에서 parent를 안 받는다

한쪽만 구현하면 trace는 이어지지 않는다.

- 클라이언트는 `to_headers()`를 보내야 한다
- 서버는 `TracingMiddleware` 또는 `tracing_context(parent=...)`로 받아야 한다

둘 중 하나라도 빠지면 각각 독립 trace가 된다.

### 3. `baggage`를 빼먹고 태그나 metadata가 기대처럼 안 이어진다

공식 문서 기준 `to_headers()`는 `langsmith-trace`뿐 아니라 선택적으로 `baggage`도 포함한다.  
중간 프록시나 HTTP 클라이언트 래퍼가 일부 헤더를 드롭하면 tags나 metadata 전파가 예상과 달라질 수 있다.

운영 환경에서는 실제 wire header가 살아 있는지 한 번 확인하는 편이 좋다.

### 4. multi-workspace key인데 `workspace_id`를 안 넣는다

programmatic tracing 설정을 쓰는 경우, 특히 다중 workspace 접근 키라면 `Client(..., workspace_id=...)`를 명시하는 편이 안전하다.  
안 그러면 어느 workspace로 들어가는지 헷갈리기 쉽다.

### 5. Python 3.10 이하에서 async child run이 분리되는데 헤더 문제로 착각한다

서비스 간 헤더 전파는 멀쩡한데도 trace tree가 찢어져 보일 수 있다.  
이때는 네트워크보다 먼저 Python 버전과 `contextvars` 전파 이슈를 의심해야 한다.

## 추천 적용 순서

개인적으로는 아래 순서가 가장 덜 꼬인다.

1. 단일 서비스에서 `@traceable`과 `wrap_openai`로 tracing을 먼저 안정화한다.
2. gateway -> downstream 한 구간만 `get_current_run_tree().to_headers()`로 연결한다.
3. downstream은 `TracingMiddleware`로 가장 먼저 붙여 본다.
4. 그다음 tenant/project 라우팅이 필요하면 `tracing_context(client=..., project_name=...)`를 추가한다.
5. 마지막으로 Python 버전, thread pool, streaming 경계를 점검한다.

이 순서로 가면 "헤더 전파 문제"와 "프로세스 내부 context propagation 문제"를 분리해서 볼 수 있다.

## 참고 자료

- [Implement distributed tracing](https://docs.langchain.com/langsmith/distributed-tracing)
- [Trace without setting environment variables](https://docs.langchain.com/langsmith/trace-without-env-vars)
- [Log traces to a specific project](https://docs.langchain.com/langsmith/log-traces-to-project)
- [Troubleshoot trace nesting](https://docs.langchain.com/langsmith/nest-traces)
