---
title: "LangSmith tracing_context로 trace를 project, workspace, replica로 라우팅하기"
description: "LangSmith에서 LANGSMITH_PROJECT, langsmith_extra, tracing_context, workspace별 Client, WriteReplica를 써서 trace 목적지를 실무 기준으로 나누는 방법을 정리한 노트"
date: 2026-06-23
tags:
  - langsmith
  - observability
  - tracing
  - python
aliases:
  - "/blog/langsmith-trace-routing-projects-workspaces"
---

# LangSmith tracing_context로 trace를 project, workspace, replica로 라우팅하기

LangSmith를 붙인 뒤 꽤 빨리 부딪히는 문제가 하나 있다.

- 로컬 실험 trace와 운영 trace가 섞인다
- 같은 앱인데 고객군별로 trace를 분리하고 싶다
- 운영 trace는 본 workspace에 남기고, 디버깅용 사본은 다른 project에 미러링하고 싶다

이때 `LANGSMITH_PROJECT`만 고정해 두면 부족하다.  
실제로는 호출 단위 override, `tracing_context`, workspace별 `Client`, `WriteReplica`까지 알아야 운영 구조가 깔끔해진다.

이번 글에서는 Python SDK 기준으로 아래 흐름만 실전적으로 정리한다.

1. 앱 전체 기본 project를 고정하는 방법
2. 특정 호출만 다른 project로 보내는 방법
3. 고객/환경별로 workspace 자체를 분기하는 방법
4. 한 번의 trace를 여러 목적지로 복제하는 방법

## 언제 이 주제가 바로 필요해지나

아래 중 둘 이상이면 보통 project routing을 별도 설계해야 한다.

- `default` project에 모든 trace가 쌓여 검색이 어려워졌다
- staging, production, 로컬 디버깅 trace를 확실히 분리하고 싶다
- tenant별 trace를 workspace나 project 단위로 분리해야 한다
- 운영 trace는 유지하되 일부 요청만 별도 project로 미러링하고 싶다

반대로 지금은 개인 공부용 스크립트 한두 개만 돌리는 단계라면 `LANGSMITH_PROJECT` 하나만 잡아도 충분하다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith openai
```

PowerShell:

```powershell
$env:LANGSMITH_TRACING="true"
$env:LANGSMITH_API_KEY="lsv2_your_key"
$env:OPENAI_API_KEY="sk-your_key"
```

기본 traceable 예제:

```python
from openai import OpenAI
from langsmith import traceable
from langsmith.wrappers import wrap_openai

oai_client = wrap_openai(OpenAI())


@traceable
def answer(question: str) -> str:
    result = oai_client.chat.completions.create(
        model="gpt-4.1-mini",
        temperature=0,
        messages=[{"role": "user", "content": question}],
    )
    return result.choices[0].message.content or ""
```

이제부터는 이 trace가 어느 project, 어느 workspace, 몇 개의 목적지로 가는지를 제어하는 이야기다.

## 1. 앱 전체 기본 목적지는 `LANGSMITH_PROJECT`로 고정한다

공식 문서 기준으로 project를 따로 지정하지 않으면 LangSmith는 `default` project를 사용한다.  
작은 스크립트가 아니라면 보통 가장 먼저 이 값부터 고정한다.

```powershell
$env:LANGSMITH_PROJECT="support-agent-prod"
```

이 방식은 아래처럼 "이 프로세스 전체를 하나의 project로 보내고 싶다"는 상황에 맞다.

- 배포 환경별 분리
- 기능별 서비스 분리
- 로컬 개발용 trace 분리

project가 아직 없어도 첫 trace가 들어가면 자동으로 생성된다.

## 2. 특정 함수나 호출만 다른 project로 보내려면 override를 쓴다

정적 환경 변수만으로는 "이 요청만 별도 project로 보내고 싶다"를 처리하기 어렵다.  
문서 기준으로 Python에서는 세 단계가 가능하다.

- `@traceable(..., project_name="...")`
- 호출 시 `langsmith_extra={"project_name": "..."}`
- wrapped OpenAI 호출에 같은 `langsmith_extra` 전달

### 함수 단위 기본 project 지정

```python
from langsmith import traceable


@traceable(project_name="support-agent-debug", name="classify_intent")
def classify_intent(text: str) -> str:
    if "refund" in text.lower():
        return "billing"
    return "general"
```

### 호출 단위로 project 덮어쓰기

공식 문서 기준 호출 시 넘기는 `langsmith_extra["project_name"]`는 decorator에 적은 `project_name`과 환경 변수보다 우선한다.

```python
result = classify_intent(
    "Need a refund for duplicate charge",
    langsmith_extra={"project_name": "support-agent-oneoff-debug"},
)
```

### OpenAI wrapper 호출에도 같은 방식 적용

```python
from openai import OpenAI
from langsmith.wrappers import wrap_openai

client = wrap_openai(OpenAI())

response = client.chat.completions.create(
    model="gpt-4.1-mini",
    messages=[{"role": "user", "content": "hello"}],
    langsmith_extra={"project_name": "sandbox-openai-calls"},
)
```

이 패턴은 아래 경우에 특히 실용적이다.

- 평소엔 운영 project를 쓰되 특정 요청만 debug project로 보낼 때
- feature branch 실험 trace만 따로 분리할 때
- 동일 함수라도 호출자에 따라 project를 달리하고 싶을 때

## 3. 요청 단위 분기는 `tracing_context`가 제일 유연하다

`tracing_context`는 전역 환경 변수를 바꾸지 않고, 특정 코드 블록 안의 tracing 설정만 덮어쓴다.  
공식 문서 기준 우선순위는 `tracing_context`가 가장 높고, 그 아래가 전역 configure, 그 아래가 환경 변수다.

### 요청별 project, tags, metadata 함께 넣기

```python
import langsmith as ls


def handle_request(client_id: str, region: str, question: str) -> str:
    client_tier = "enterprise" if client_id.startswith("ent-") else "standard"

    with ls.tracing_context(
        enabled=True,
        project_name=f"support-{client_tier}",
        tags=["production", f"region-{region}", f"tier-{client_tier}"],
        metadata={
            "client_id": client_id,
            "region": region,
            "tier": client_tier,
        },
    ):
        return answer(question)
```

이 방식이 좋은 이유는 trace 목적지와 분류 기준을 "호출 컨텍스트"로 같이 밀어 넣을 수 있기 때문이다.

### 민감 요청만 tracing 끄기

```python
import langsmith as ls


def handle_sensitive_request(question: str, contains_pii: bool) -> str:
    with ls.tracing_context(enabled=not contains_pii):
        return answer(question)
```

trace를 완전히 끄지 않고 metadata만 바꾸는 것도 가능하지만, 민감정보 정책이 엄격하면 아예 `enabled=False`로 막는 편이 단순하다.

### 중첩된 context는 안쪽 것이 우선한다

문서 기준 nested `tracing_context`에서는 innermost context가 우선한다.

```python
import langsmith as ls

with ls.tracing_context(enabled=False):
    with ls.tracing_context(enabled=True, project_name="temporary-debug"):
        answer("trace only this call")
```

이 점을 모르고 바깥에서 끈 뒤 안쪽에서 다시 trace가 생기는 상황을 놓치기 쉽다.

## 4. workspace 자체를 나누려면 `Client`를 분리하고 `tracing_context(client=...)`를 쓴다

project 분리는 한 workspace 안에서의 정리다.  
tenant 분리나 조직 분리가 더 강하게 필요하면 workspace를 나눠야 한다.

공식 문서 기준 Python에서는 workspace별 `Client`를 만들고 `tracing_context(client=...)`로 라우팅한다.

```python
import os
from langsmith import Client, tracing_context

api_key = os.getenv("LS_CROSS_WORKSPACE_KEY")

premium_client = Client(
    api_key=api_key,
    api_url="https://api.smith.langchain.com",
    workspace_id="workspace-premium-id",
)

standard_client = Client(
    api_key=api_key,
    api_url="https://api.smith.langchain.com",
    workspace_id="workspace-standard-id",
)


def get_workspace_target(customer_id: str):
    if customer_id.startswith("premium_"):
        return premium_client, "premium-customer-traces"
    return standard_client, "standard-customer-traces"


def handle_customer_request(customer_id: str, question: str) -> str:
    client, project_name = get_workspace_target(customer_id)
    with tracing_context(enabled=True, client=client, project_name=project_name):
        return answer(question)
```

이 구조는 아래처럼 쓰기 좋다.

- enterprise 고객 trace를 별도 workspace로 격리
- 내부 운영팀과 외부 고객 trace를 분리
- dev/staging/prod를 workspace 차원에서 분리

## 5. 한 번의 trace를 여러 목적지로 보내려면 `WriteReplica`를 쓴다

동적 routing은 한 trace를 "한 목적지"로 보내는 방식이다.  
반면 replica는 같은 trace를 여러 목적지에 동시에 복제한다.

문서 기준 replica는 아래 용도에 맞다.

- production trace를 staging project에도 미러링
- 같은 trace를 여러 workspace에 동시에 보관
- 특정 replica에만 metadata override 적용

### 런타임 replica 설정

```python
from langsmith import tracing_context
from langsmith.run_trees import ApiKeyAuth, WriteReplica

replicas = [
    WriteReplica(
        api_url="https://api.smith.langchain.com",
        auth=ApiKeyAuth(api_key="lsv2_key_workspace_a"),
        project_name="project-prod",
    ),
    WriteReplica(
        api_url="https://api.smith.langchain.com",
        auth=ApiKeyAuth(api_key="lsv2_key_workspace_b"),
        project_name="project-staging",
        updates={"metadata": {"environment": "staging"}},
    ),
]

with tracing_context(replicas=replicas):
    answer("What changed in the prompt?")
```

여기서 `updates`는 replica 쪽 run에만 병합된다. 즉 primary trace는 그대로 두고, 복제본에만 metadata나 tags를 덧붙일 수 있다.

### 같은 서버 안에서 project만 복제

모든 replica가 같은 LangSmith 서버를 쓴다면 `api_url`과 `auth`를 생략할 수 있다.

```python
from langsmith import tracing_context
from langsmith.run_trees import WriteReplica

with tracing_context(
    replicas=[
        WriteReplica(project_name="support-prod"),
        WriteReplica(
            project_name="support-debug",
            updates={"metadata": {"copied_from": "support-prod"}},
        ),
    ]
):
    answer("Need help with checkout error")
```

운영에서는 이 방식이 제일 단순하다. 운영 trace는 원래 project에 남기고, 일부 호출을 debug project로 복제하기 쉽다.

## 추천 운영 패턴

개인적으로는 아래 순서가 가장 무난하다.

1. 기본은 `LANGSMITH_PROJECT`로 환경 단위 분리
2. 특정 요청 분기는 `tracing_context(project_name=..., metadata=...)`
3. workspace 격리가 필요할 때만 `Client(workspace_id=...)` 추가
4. 미러링이 필요할 때만 `WriteReplica` 도입

처음부터 workspace와 replica를 동시에 설계하면 복잡도가 빠르게 올라간다.  
대부분은 project 분리만 잘해도 운영성이 크게 좋아진다.

## 자주 막히는 점

### 1. `LANGSMITH_PROJECT`를 넣었는데 호출별 override가 예상과 다르게 보인다

문서 기준 동적 `project_name` override는 환경 변수보다 우선한다.  
decorator, `langsmith_extra`, `tracing_context` 중 무엇이 마지막으로 적용되는지 같이 봐야 한다.

### 2. `LANGSMITH_RUNS_ENDPOINTS`와 `LANGSMITH_ENDPOINT`를 같이 쓴다

replica 환경 변수 문서 기준 두 설정은 함께 쓸 수 없다. 같이 두면 에러가 난다.

### 3. distributed trace인데 replica 인증이 자동 전파된다고 생각한다

공식 문서 기준 replica의 `project_name`과 `updates`는 downstream으로 전달되지만, API key 같은 auth는 자동 전파되지 않는다. 서비스별 자격 증명을 따로 준비해야 한다.

### 4. tenant 분리는 필요한데 project만 계속 늘린다

project는 같은 workspace 안의 분류다. 접근 제어, 청구, 조직 분리가 필요하면 workspace 분기가 더 맞다.

### 5. 민감 요청은 trace를 남기면 안 되는데 metadata만 바꾸고 끝낸다

trace 구조 자체를 남기면 안 되는 정책이면 `enabled=False`로 꺼야 한다. 단순 project 분리나 metadata redaction만으로 충분하지 않을 수 있다.

## 마무리

LangSmith trace routing은 생각보다 빨리 중요한 운영 주제가 된다.

- 기본 분류는 `LANGSMITH_PROJECT`
- 요청별 override는 `langsmith_extra`와 `tracing_context`
- workspace 분기는 `Client(workspace_id=...)`
- 복제는 `WriteReplica`

이 네 단계를 구분해서 보면 구조가 훨씬 명확해진다. tracing을 이미 붙였다면, 다음으로 운영성 차이를 크게 만드는 기능이 바로 routing 쪽이다.

## 참고 자료

- [Log traces to a specific project](https://docs.langchain.com/langsmith/log-traces-to-project)
- [Conditional tracing](https://docs.langchain.com/langsmith/conditional-tracing)
- [LangSmith tracing quickstart](https://docs.langchain.com/langsmith/observability-quickstart)
- [Trace OpenAI applications](https://docs.langchain.com/langsmith/trace-openai)
