---
title: "LangSmith thread_id로 멀티턴 대화 추적하고 SDK로 조회하기"
description: "LangSmith에서 thread_id를 모든 run에 일관되게 붙여 멀티턴 대화를 추적하고, Python SDK의 list_threads와 read_thread로 대화 흐름을 조회하는 방법을 실전 예제로 정리한 노트"
date: 2026-06-09
tags:
  - langsmith
  - observability
  - threads
  - python
aliases:
  - "/blog/langsmith-threads-query-sdk"
---

# LangSmith thread_id로 멀티턴 대화 추적하고 SDK로 조회하기

LangSmith tracing을 붙인 뒤 챗봇이나 에이전트를 운영하다 보면 곧 이런 요구가 생긴다.  
"이 사용자의 대화 전체를 한 번에 보고 싶다", "한 세션 안에서 어느 턴에서 오류가 시작됐는지 찾고 싶다", "문제 대화를 다시 재생해서 evaluator나 파인튜닝 입력으로 쓰고 싶다" 같은 요구다.

이때 핵심은 trace를 많이 남기는 것이 아니라, 같은 대화에 속한 run들을 같은 `thread_id`로 묶는 것이다. LangSmith는 이 메타데이터를 기준으로 멀티턴 대화를 thread 단위로 보여주고, SDK에서도 다시 조회할 수 있게 해준다.

이번 글에서는 공식 문서를 기준으로 아래 흐름만 실무 중심으로 정리한다.

- `thread_id`를 어떤 run에 어떻게 붙여야 하는지
- Python에서 `uuid7()`으로 정렬 가능한 thread ID를 만드는 방법
- `list_threads(...)`와 `read_thread(...)`를 언제 어떻게 나눠 써야 하는지
- 기본 조회 범위, child run 포함 여부 같은 자주 헷갈리는 지점

## 언제 이 방식이 특히 유용한가

아래 상황이면 LangSmith thread 구성이 거의 필수에 가깝다.

- 챗봇, 고객지원 봇, 코파일럿처럼 멀티턴 대화가 이어진다
- 한 번의 trace보다 "사용자 세션 전체"를 기준으로 디버깅해야 한다
- 특정 대화만 다시 재생해서 분석하거나 evaluator 입력으로 넘기고 싶다
- thread별 turn 수, 비용, latency, feedback을 묶어서 보고 싶다

반대로 단발성 배치 작업이나 한 번 호출로 끝나는 파이프라인이면 thread까지 설계하지 않아도 tracing만으로 충분한 경우가 많다.

## 사전 준비

공식 문서 기준으로 Python에서는 `langsmith`와 `openai` 정도면 시작할 수 있다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith openai
```

PowerShell:

```powershell
$env:LANGSMITH_TRACING="true"
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:OPENAI_API_KEY="sk-..."
$env:LANGSMITH_PROJECT="support-chat-prod"
```

현재 문서 기준으로 `uuid7()` helper는 Python `langsmith` `v0.4.43+`에서 제공된다.

## 1. 같은 대화의 모든 run에 `thread_id`를 붙이기

LangSmith는 run metadata 안의 아래 키 중 하나를 보고 thread를 묶는다.

- `thread_id`
- `session_id`
- `conversation_id`

실무에서는 새 이름을 섞기보다 `thread_id` 하나로 통일하는 편이 가장 덜 헷갈린다.

가장 중요한 점은 "루트 run만"이 아니라 child run까지 같은 `thread_id`를 가져야 한다는 것이다. 그래야 thread 필터, token 집계, 비용 집계가 어긋나지 않는다.

```python
from langsmith import traceable, uuid7
from openai import OpenAI
from langsmith.wrappers import wrap_openai

client = wrap_openai(OpenAI())


def make_thread_id() -> str:
    return str(uuid7())


@traceable(run_type="tool")
def retrieve_faq(question: str, *, thread_id: str) -> str:
    return f"[thread={thread_id}] 환불 정책 FAQ를 찾았습니다."


@traceable(name="support_chat_turn")
def run_turn(question: str, *, thread_id: str) -> str:
    context = retrieve_faq(
        question,
        langsmith_extra={"metadata": {"thread_id": thread_id}},
        thread_id=thread_id,
    )

    response = client.chat.completions.create(
        model="gpt-5.4-mini",
        messages=[
            {"role": "system", "content": "한국어로 짧고 실무적으로 답변하세요."},
            {"role": "user", "content": f"질문: {question}\n문맥: {context}"},
        ],
        langsmith_extra={"metadata": {"thread_id": thread_id}},
    )
    return response.choices[0].message.content or ""


if __name__ == "__main__":
    thread_id = make_thread_id()

    answer = run_turn(
        "환불 처리 상태를 어디서 확인하나요?",
        thread_id=thread_id,
        langsmith_extra={"metadata": {"thread_id": thread_id}},
    )
    print(thread_id)
    print(answer)
```

이 예제에서 중요한 건 `run_turn`, `retrieve_faq`, OpenAI 호출 모두에 같은 `thread_id`를 전달한 점이다.  
공식 문서 기준으로 child run에 thread metadata가 빠지면 thread 필터링과 thread 단위 토큰 집계가 정확히 동작하지 않을 수 있다.

## 2. `uuid7()`을 쓰면 시간순 정렬이 덜 꼬인다

문서에서는 thread ID로 아무 문자열이나 쓸 수 있지만, 권장 방식은 UUID v7이다.  
UUID v7은 타임스탬프가 포함돼 있어서 thread를 시간순으로 다루기 쉽다.

```python
from langsmith import uuid7

thread_id = str(uuid7())
print(thread_id)
```

직접 만든 세션 키를 쓰는 것도 가능하지만, 실무에서 아래 문제가 자주 생긴다.

- 같은 사용자 ID를 여러 대화가 공유한다
- 프런트엔드와 백엔드의 세션 키 규칙이 다르다
- 정렬은 되는데 유일성이 깨지거나, 유일성은 되는데 정렬이 어색하다

처음부터 별도 저장 키가 필요하지 않다면 UUID v7이 가장 무난하다.

## 3. `list_threads(...)`로 프로젝트 전체 대화 목록 보기

`list_threads(...)`는 "이 프로젝트에 어떤 대화들이 있었는가"를 훑어볼 때 쓴다.  
결과는 최근 활동 순으로 정렬되고, 각 thread마다 root run들이 묶여서 반환된다.

```python
from langsmith import Client

client = Client()

threads = client.list_threads(project_name="support-chat-prod")

for thread in threads:
    print(thread["thread_id"])
    print(f"runs={thread['count']}")
    print(f"last_active={thread['max_start_time']}")
```

실무적으로는 아래 두 용도가 가장 많다.

- 최근 장애나 불만 대화 세션 후보를 빠르게 훑기
- thread별 turn 수와 마지막 활동 시각을 보고 조사 우선순위 정하기

## 4. `read_thread(...)`로 특정 대화를 턴 순서대로 재생하기

특정 `thread_id`를 이미 알고 있다면 `read_thread(...)`가 더 직접적이다.  
이 API는 thread wrapper가 아니라 `Run` 객체들을 바로 돌려준다.

```python
from langsmith import Client

client = Client()

runs = list(
    client.read_thread(
        thread_id="018fb6c5-9ec0-7d7f-a7b4-2c7d2b1f63a1",
        project_name="support-chat-prod",
        order="asc",
    )
)

for run in runs:
    print(run.id, run.name, run.start_time, run.status)
```

멀티턴 대화를 재생할 때는 보통 `order="asc"`를 주는 편이 안전하다.  
기본값도 오름차순이지만, 재생 로직을 명시적으로 적어 두면 후속 유지보수가 쉬워진다.

메시지 기반 앱이라면 입력과 출력을 간단히 꺼내 대화를 다시 만들 수도 있다.

```python
from langsmith import Client

client = Client()

for run in client.read_thread(
    thread_id="018fb6c5-9ec0-7d7f-a7b4-2c7d2b1f63a1",
    project_name="support-chat-prod",
    order="asc",
):
    user_msg = run.inputs.get("messages", [{}])[-1].get("content", "")
    assistant_msg = (run.outputs or {}).get("content", "")
    print(f"User: {user_msg}")
    print(f"Assistant: {assistant_msg}")
```

이 패턴은 아래 작업으로 바로 이어지기 좋다.

- 실패 대화 세션 재생
- 파인튜닝용 대화 추출
- thread 단위 evaluator 전처리

## 5. child run까지 보고 싶으면 `is_root=False`를 명시하기

`list_threads(...)`는 root run만 반환한다.  
그리고 `read_thread(...)`도 기본값은 `is_root=True`라서 tool call, sub-chain, nested trace는 빠질 수 있다.

세부 디버깅이 목적이면 아래처럼 child run까지 포함해 읽는 편이 낫다.

```python
from langsmith import Client

client = Client()

for run in client.read_thread(
    thread_id="018fb6c5-9ec0-7d7f-a7b4-2c7d2b1f63a1",
    project_name="support-chat-prod",
    is_root=False,
    order="asc",
):
    print(run.run_type, run.name, run.start_time)
```

질문이 "이 대화에 몇 턴이 있었나?"면 root run만으로 충분한 경우가 많다.  
질문이 "도구 호출에서 어디서 실패했나?"면 child run 포함 조회가 필요하다.

## 6. `list_threads(...)`의 기본 조회 범위는 최근 24시간이다

이건 초반에 가장 많이 놓치는 함정 중 하나다.  
공식 문서 기준으로 `list_threads(...)`는 기본적으로 최근 1일 내 run이 있는 thread만 보여준다.

예전 대화가 안 보인다고 해서 thread가 없는 것이 아니라, 조회 창이 좁은 경우가 많다.

```python
import datetime
from langsmith import Client

client = Client()

threads = client.list_threads(
    project_name="support-chat-prod",
    start_time=datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=7),
)

for thread in threads:
    print(thread["thread_id"], thread["max_start_time"])
```

운영 점검 스크립트, 주간 리포트, 과거 세션 백필 작업이면 `start_time`을 항상 명시하는 습관이 좋다.

## 7. 필터로 오류가 있었던 대화만 좁혀 보기

thread 조회는 run 필터와 함께 쓰면 훨씬 강해진다.  
예를 들어, 에러를 한 번이라도 포함한 대화만 찾고 싶다면 이렇게 좁힐 수 있다.

```python
from langsmith import Client

client = Client()

threads = client.list_threads(
    project_name="support-chat-prod",
    filter='eq(status, "error")',
)

for thread in threads:
    print(thread["thread_id"], thread["count"])
```

thread 필터는 내부 run 중 하나라도 조건에 맞으면 해당 thread를 올려준다.  
그래서 "문제가 있었던 대화 세션 찾기"에 잘 맞는다.

## 자주 헷갈리는 점

### 1. 루트 run에만 `thread_id`를 붙이고 끝내는 경우

문서 기준으로 child run에 thread metadata가 없으면 thread 필터링, token 집계, 비용 집계가 어긋날 수 있다.  
특히 nested `@traceable` 함수나 별도 span을 만드는 코드가 있으면 propagation을 직접 확인해야 한다.

### 2. `list_threads(...)` 결과에 예전 대화가 안 보인다고 데이터가 사라졌다고 생각하는 경우

기본 조회 범위가 최근 24시간이라서 자주 생기는 오해다.  
운영 스크립트에서는 `start_time`을 명시적으로 넓혀 두는 편이 안전하다.

### 3. `list_threads(...)`와 `read_thread(...)`의 반환 형태를 같은 것으로 생각하는 경우

`list_threads(...)`는 thread 묶음 객체를 준다.  
`read_thread(...)`는 `Run` 객체 iterator를 바로 준다.  
코드를 섞어 쓰면 필드 접근 방식이 꼬이기 쉽다.

### 4. child run까지 보고 싶은데 `is_root=False`를 빼먹는 경우

tool call, retriever, nested chain 디버깅이 목적이면 기본값으로는 정보가 부족할 수 있다.  
대화 재생이 목적일 때만 root run 기본값이 편하다.

### 5. 사용자 ID를 그대로 `thread_id`로 써서 여러 대화가 한 세션으로 섞이는 경우

`thread_id`는 "사용자"가 아니라 "대화 세션" 식별자에 가깝다.  
한 사용자가 여러 대화를 연속으로 만들 수 있다면 별도 세션 ID를 생성하는 편이 맞다.

## 추천 운영 흐름

개인적으로는 아래 흐름이 가장 단순하고 재사용성이 좋다.

1. 새 대화가 시작되면 `uuid7()`으로 `thread_id`를 만든다.
2. 루트 run, child run, 모델 호출까지 모두 같은 `thread_id`를 metadata에 넣는다.
3. 운영 점검은 `list_threads(...)`로 최근 문제 대화를 좁혀 본다.
4. 특정 세션 분석은 `read_thread(...)`로 재생한다.
5. 실패 thread는 evaluator, annotation queue, 파인튜닝 데이터 생성으로 이어 붙인다.

이 정도만 지켜도 LangSmith가 단순 trace 저장소가 아니라 "세션 단위 디버깅 도구"로 바뀐다.

## 참고 자료

- [Configure threads](https://docs.langchain.com/langsmith/threads)
- [Query threads using the SDK](https://docs.langchain.com/langsmith/query-threads)
- [Custom instrumentation](https://docs.langchain.com/langsmith/annotate-code)
- [Add metadata and tags to traces](https://docs.langchain.com/langsmith/add-metadata-tags)
- [Observability concepts](https://docs.langchain.com/langsmith/observability-concepts)
