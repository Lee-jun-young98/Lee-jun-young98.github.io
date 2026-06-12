---
title: "LangSmith list_runs로 운영 trace를 정밀하게 조회하기"
description: "LangSmith에서 list_runs, filter, trace_filter, tree_filter, read_run(load_child_runs=True)을 조합해 운영 trace를 좁혀 보고 export하는 방법을 Python 예제로 정리한 실전 노트"
date: 2026-06-12
tags:
  - langsmith
  - observability
  - python
  - tracing
aliases:
  - "/blog/langsmith-query-traces-sdk"
---

# LangSmith list_runs로 운영 trace를 정밀하게 조회하기

LangSmith tracing을 붙이고 나면 곧 이런 요구가 생긴다.

- "최근 24시간 안에 실패한 root run만 보고 싶다"
- "feedback 점수가 낮은 trace 안에서 특정 tool run만 뽑고 싶다"
- "child run 출력까지 확인해서 export용 표를 만들고 싶다"
- "운영 로그가 많아졌는데 SDK 조회가 느리거나 429가 난다"

이때 핵심은 UI에서 눈으로만 찾지 말고 `list_runs(...)`를 조회 API처럼 다루는 것이다.  
LangSmith 공식 문서는 단순 필터 인자, 구조화된 filter 문법, `trace_filter`/`tree_filter`, `read_run(..., load_child_runs=True)`, 그리고 `/runs/query` rate limit까지 함께 설명한다.

이 글에서는 그 흐름만 실무 기준으로 정리한다.

- `list_runs(...)`를 언제 단순 인자로 시작하고 언제 filter 문자열로 넘어갈지
- `filter`, `trace_filter`, `tree_filter`의 역할 차이
- child run의 `inputs`/`outputs`까지 보고 싶을 때의 조회 패턴
- `select`, `start_time`, `limit`로 속도와 rate limit을 관리하는 방법

## 언제 이 방식이 특히 유용한가

아래 같은 상황이면 LangSmith trace query를 먼저 익혀두는 편이 좋다.

- agent, RAG, tool calling trace가 많아서 UI 수동 탐색이 느려졌다
- production 오류와 feedback 저점 사례만 따로 모아서 분석하고 싶다
- 특정 tool 호출이 들어간 trace만 export해서 데이터 프레임으로 보고 싶다
- annotation queue나 evaluator를 붙이기 전에 먼저 운영 패턴을 파악하고 싶다

반대로 trace 수가 아직 적고 단순 디버깅만 한다면 UI 필터만으로도 충분한 경우가 많다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith
```

PowerShell:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:LANGSMITH_PROJECT="support-agent-prod"
```

기본 클라이언트:

```python
from langsmith import Client

client = Client()
```

## 1. 먼저 단순 인자로 조회하고, 복잡해지면 filter로 넘어간다

공식 문서 기준으로 `list_runs(...)`는 keyword 인자만으로도 꽤 많은 조회를 처리할 수 있다.  
처음부터 긴 filter 문자열을 만들기보다, 단순 인자로 충분한지 먼저 보는 편이 유지보수에 좋다.

### 최근 24시간 LLM run 보기

```python
from datetime import datetime, timedelta, timezone
from langsmith import Client

client = Client()

runs = client.list_runs(
    project_name="support-agent-prod",
    start_time=datetime.now(timezone.utc) - timedelta(days=1),
    run_type="llm",
)

for run in runs:
    print(run.id, run.name, run.start_time)
```

### 실패하지 않은 root run만 보기

```python
from langsmith import Client

client = Client()

runs = client.list_runs(
    project_name="support-agent-prod",
    is_root=True,
    error=False,
)

for run in runs:
    print(run.id, run.name, run.status)
```

여기서 중요한 기준은 단순하다.

- `project_name`, `start_time`, `run_type`, `error`, `is_root` 정도로 끝나면 keyword 인자
- feedback, tags, metadata, trace 내부 조건까지 섞이면 `filter` 계열

## 2. `filter`는 "지금 보고 싶은 run 자체" 조건이다

복잡한 조회는 LangSmith filter 문법으로 간다.  
공식 문서 기준으로 자주 쓰는 비교 함수는 `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `has`, `search`다.

### latency가 5초보다 긴 run 찾기

```python
from langsmith import Client

client = Client()

slow_runs = client.list_runs(
    project_name="support-agent-prod",
    filter='gt(latency, "5s")',
)

for run in slow_runs:
    print(run.id, run.latency)
```

### 특정 feedback key가 4점 초과인 run 찾기

```python
from langsmith import Client

client = Client()

high_score_runs = client.list_runs(
    project_name="support-agent-prod",
    filter='and(eq(feedback_key, "star_rating"), gt(feedback_score, 4))',
)

for run in high_score_runs:
    print(run.id, run.feedback_stats)
```

### production 태그가 붙은 오류 run 찾기

```python
from langsmith import Client

client = Client()

error_runs = client.list_runs(
    project_name="support-agent-prod",
    filter='and(has(tags, "production"), neq(error, null))',
)

for run in error_runs:
    print(run.id, run.name, run.error)
```

실무에서는 `search("...")`보다 구조화 필터를 먼저 쓰는 편이 좋다.  
공식 문서 기준으로 full-text search는 더 엄격한 rate limit 구간에 들어간다.

## 3. `trace_filter`는 root run 조건, `tree_filter`는 trace 내부 아무 run 조건이다

이 구분을 이해하면 LangSmith 조회가 훨씬 강해진다.

- `filter`: 지금 반환할 run 자체의 조건
- `trace_filter`: 그 run이 속한 trace의 root run 조건
- `tree_filter`: 그 trace 안의 임의 run 조건

예를 들어 "feedback이 나쁜 trace 안에서 `RetrieveDocs` run만 뽑고 싶다"면 아래처럼 쓴다.

```python
from langsmith import Client

client = Client()

runs = client.list_runs(
    project_name="support-agent-prod",
    filter='eq(name, "RetrieveDocs")',
    trace_filter='and(eq(feedback_key, "user_score"), eq(feedback_score, 0))',
)

for run in runs:
    print(run.id, run.trace_id, run.name)
```

이번에는 "trace 안에 `ExpandQuery`라는 child run이 있었던 경우에만 `RetrieveDocs` run을 뽑고 싶다"면 `tree_filter`를 같이 건다.

```python
from langsmith import Client

client = Client()

runs = client.list_runs(
    project_name="support-agent-prod",
    filter='eq(name, "RetrieveDocs")',
    trace_filter='and(eq(feedback_key, "user_score"), eq(feedback_score, 1))',
    tree_filter='eq(name, "ExpandQuery")',
)

for run in runs:
    print(run.id, run.trace_id, run.name)
```

이 패턴이 실무에서 좋은 이유는 "어떤 trace 맥락에서 나온 run인가"를 서버 쿼리 단계에서 먼저 좁힐 수 있기 때문이다.

## 4. child run의 실제 `outputs` 값까지 보려면 `read_run(load_child_runs=True)`로 hydrate한다

공식 문서 기준으로 `tree_filter`는 searchable field에는 강하지만, child run의 임의 `inputs`/`outputs` payload를 전부 서버에서 세밀하게 검사하는 용도는 아니다.  
이럴 때는 2단계로 가는 편이 정석이다.

1. `list_runs(...)`로 후보 root trace를 좁힌다
2. `read_run(..., load_child_runs=True)`로 child run 트리를 불러와 로컬에서 검사한다

```python
from datetime import datetime, timedelta, timezone
from langsmith import Client

client = Client()


def iter_runs(run):
    yield run
    for child in run.child_runs or []:
        yield from iter_runs(child)


candidate_roots = client.list_runs(
    project_name="support-agent-prod",
    is_root=True,
    start_time=datetime.now(timezone.utc) - timedelta(days=7),
    tree_filter='and(eq(run_type, "tool"), eq(name, "search_docs"))',
    select=["id"],
)

matching_roots = []

for candidate in candidate_roots:
    root = client.read_run(candidate.id, load_child_runs=True)
    if any(
        child.id != root.id
        and child.run_type == "tool"
        and child.name == "search_docs"
        and "refund-policy" in str(child.outputs or {})
        for child in iter_runs(root)
    ):
        matching_roots.append(root)

print(f"matched={len(matching_roots)}")
```

이 방식은 아래 같은 작업에 바로 이어진다.

- 특정 tool 결과를 포함한 trace만 export
- retriever 입력/출력만 모아서 품질 분석
- root run feedback과 child run 동작을 한 표로 합치기

## 5. export 스크립트에서는 `select`를 먼저 줄여야 한다

공식 문서에서 가장 실무적인 팁 중 하나가 `select`다.  
기본값은 모든 필드를 가져오기 때문에 inputs/outputs가 큰 run에서는 응답이 무거워지기 쉽다.

### 가벼운 요약 조회

```python
from datetime import datetime, timedelta, timezone
from langsmith import Client

client = Client()

runs = client.list_runs(
    project_name="support-agent-prod",
    start_time=datetime.now(timezone.utc) - timedelta(days=3),
    is_root=True,
    select=["id", "name", "start_time", "latency", "total_tokens", "error"],
    limit=100,
)

for run in runs:
    print(run.id, run.name, run.latency, run.total_tokens)
```

처음엔 요약 필드만 뽑고, 진짜 확인이 필요한 trace만 `read_run(...)`으로 다시 읽는 흐름이 효율적이다.

## 6. `run_ids` 조회는 다른 필터를 무시한다

공식 문서에서 명시하는 중요한 함정이 하나 있다.  
run ID 목록을 주는 조회는 다른 filter 인자를 무시한다.

```python
from langsmith import Client

client = Client()

run_ids = [
    "a36092d2-4ad5-4fb4-9c0d-0dba9a2ed836",
    "9398e6be-964f-4aa4-8ae9-ad78cd4b7074",
]

runs = client.list_runs(run_ids=run_ids)

for run in runs:
    print(run.id, run.name)
```

그래서 보통은 이렇게 나눈다.

1. 조건 기반으로 후보 ID를 모은다
2. 이후 상세 재조회나 batch export에 `run_ids`를 쓴다

`project_name`과 함께 섞어 썼다고 안전장치가 생기지 않는다는 점을 기억해두는 편이 좋다.

## 7. rate limit은 "7일 이하 + 구조화 조회" 쪽이 훨씬 유리하다

2026년 6월 12일 기준 LangSmith 공식 문서의 `/runs/query` 가이드는 조회 rate limit을 꽤 구체적으로 적고 있다.

- `start_time` 없이 조회하면 large time window 취급이다
- 7일 이하 window가 더 완화된 limit을 가진다
- full-text `search()`는 더 엄격하다
- `child_run_ids`를 select에 넣어도 더 엄격한 tier로 간다

실무 권장 패턴은 아래 정도로 정리된다.

1. 항상 `start_time`을 명시한다
2. 가능하면 7일 이하 구간으로 쪼갠다
3. `select`로 필요한 필드만 가져온다
4. `search()`보다 `eq()`/`has()` 같은 구조화 필터를 우선한다
5. `limit`를 걸어 exploratory query를 짧게 돌린다

```python
from datetime import datetime, timedelta, timezone
from langsmith import Client

client = Client()

runs = client.list_runs(
    project_name="support-agent-prod",
    start_time=datetime.now(timezone.utc) - timedelta(days=2),
    filter='and(has(tags, "production"), neq(error, null))',
    select=["id", "name", "trace_id", "start_time", "error"],
    limit=50,
)

for run in runs:
    print(run.id, run.trace_id, run.error)
```

trace를 정말 대량으로 빼야 하면 공식 문서도 SDK query보다 bulk export 기능을 권장한다.

## 자주 틀리는 점

### 1. `filter`와 `trace_filter`를 같은 뜻으로 쓰면 결과가 어긋난다

`filter`는 반환할 run 자체 조건이고 `trace_filter`는 root run 조건이다.  
예를 들어 feedback이 root run에만 붙는 구조라면 `filter`에 feedback 조건을 걸어도 원하는 run이 안 나올 수 있다.

### 2. child run payload 검색을 서버 쿼리 하나로 끝내려 하면 한계가 있다

공식 문서도 arbitrary child `inputs`/`outputs` predicate는
`list_runs(...) -> read_run(..., load_child_runs=True) -> 로컬 순회`
패턴을 권장한다.

### 3. `start_time`을 생략하고 "왜 이렇게 느리지?"라고 느끼기 쉽다

문서 기준으로 `start_time`이 없으면 large time window tier로 간다.  
운영 스크립트는 기본 조회 범위를 명시적으로 좁혀두는 편이 안전하다.

### 4. exploratory query인데 `inputs`, `outputs`를 기본으로 다 가져오면 무겁다

처음엔 `select=["id", "name", ...]` 같은 가벼운 필드만 쓰고, 필요한 trace만 상세 조회하는 식이 좋다.

### 5. `search()`를 남용하면 429를 더 빨리 맞는다

텍스트 검색은 편하지만 rate limit이 더 빡빡하다.  
metadata, tags, feedback, run_type 같은 구조화 조건으로 먼저 좁히는 편이 낫다.

## 추천 운영 흐름

개인적으로는 아래 흐름이 가장 무난하다.

1. tracing 시점에 tags와 metadata를 먼저 잘 심는다
2. 운영 조회는 `start_time + project_name + select`부터 시작한다
3. feedback, latency, error 기준 선별은 `filter`/`trace_filter`로 좁힌다
4. child run 내부 payload 검사는 `read_run(load_child_runs=True)`로 후처리한다
5. 대량 export는 query 스크립트를 무리하게 키우기보다 bulk export로 넘긴다

이 정도만 잡아도 LangSmith가 "trace를 보는 UI"에서 끝나지 않고, 운영 분석용 관측 데이터 계층으로 바뀐다.

## 참고 자료

- [Query traces using the SDK](https://docs.langchain.com/langsmith/export-traces)
- [Trace query syntax](https://docs.langchain.com/langsmith/trace-query-syntax)
- [Add metadata and tags to traces](https://docs.langchain.com/langsmith/add-metadata-tags)
- [Configure threads](https://docs.langchain.com/langsmith/threads)
- [Run (span) data format](https://docs.langchain.com/langsmith/run-data-format)
