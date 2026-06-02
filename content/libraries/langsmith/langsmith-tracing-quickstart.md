---
title: LangSmith tracing 빠르게 붙이기: traceable과 wrap_openai 실전 예제
description: LangSmith에서 OpenAI 기반 Python 앱의 trace를 남기기 위해 LANGSMITH_TRACING, project, endpoint, traceable, wrap_openai를 어떻게 붙이는지 정리한 실전 입문 노트
date: 2026-06-02
tags:
  - langsmith
  - observability
  - llm
  - python
aliases:
  - "/blog/langsmith-tracing-quickstart"
---

# LangSmith tracing 빠르게 붙이기: traceable과 wrap_openai 실전 예제

LangSmith를 처음 붙일 때 가장 자주 하는 일은 "내 앱이 실제로 어떤 입력을 받고, 어떤 도구를 거쳐, 어떤 모델 호출을 했는지"를 trace로 남기는 것이다.

이 단계에서 evaluation이나 automation까지 한 번에 들어가려 하면 오히려 흐름이 복잡해진다. 먼저 tracing만 확실히 붙여 두면 이후에 문제 재현, 프롬프트 비교, 태그 기반 필터링, 운영 모니터링으로 자연스럽게 확장할 수 있다.

이번 글에서는 공식 문서 기준으로 아래 네 가지만 먼저 잡는다.

- Python 앱에서 LangSmith tracing을 켜는 최소 환경 변수
- `wrap_openai(...)`로 OpenAI 호출을 자동 추적하는 방법
- `@traceable`로 애플리케이션 함수와 도구 함수를 한 trace로 묶는 방법
- project, region endpoint, metadata/tag 설정에서 자주 막히는 지점

## 언제 이 방식이 실용적인가

다음 조건이면 거의 항상 이 조합부터 시작하면 된다.

- OpenAI Python SDK 기반으로 이미 동작하는 앱이 있다
- LangChain 없이 순수 Python 함수 호출 흐름을 먼저 관찰하고 싶다
- RAG, tool calling, 전처리 함수까지 한 화면에서 보고 싶다
- 나중에 trace 검색과 필터링을 위해 project, metadata, tags도 함께 정리하고 싶다

반대로 처음부터 멀티 서비스 분산 추적이나 대규모 샘플링 정책이 필요하다면 tracing만 붙이는 입문 단계를 넘어선 요구다. 그 경우에는 LangSmith의 project routing, replicas, sampling 문서를 같이 보는 편이 낫다.

## 사전 준비

공식 tracing quickstart 기준으로 Python 환경에서는 `langsmith`와 `openai`를 설치하면 된다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langsmith openai
```

필수 환경 변수는 세 가지다.

```bash
export LANGSMITH_TRACING=true
export LANGSMITH_API_KEY="ls__your_key"
export OPENAI_API_KEY="sk-..."
```

PowerShell에서는 이렇게 잡으면 된다.

```powershell
$env:LANGSMITH_TRACING="true"
$env:LANGSMITH_API_KEY="ls__your_key"
$env:OPENAI_API_KEY="sk-..."
```

실무에서는 아래 변수도 거의 같이 쓴다.

- `LANGSMITH_PROJECT`: trace를 `default` 대신 원하는 project로 분리할 때 사용
- `LANGSMITH_ENDPOINT`: EU, APAC 등 미국 이외 리전을 쓰는 계정일 때 필요
- `LANGSMITH_WORKSPACE_ID`: 하나의 API 키가 여러 workspace에 연결되어 있을 때 명시적으로 지정

예를 들면:

```powershell
$env:LANGSMITH_PROJECT="langsmith-study-notes"
$env:LANGSMITH_ENDPOINT="https://eu.api.smith.langchain.com"
```

## 1. 가장 작은 tracing 예제

핵심은 두 줄이다.

- `wrap_openai(OpenAI())`: 모델 호출 자체를 자동 span으로 남긴다
- `@traceable`: 내가 만든 함수 경계를 trace/run으로 남긴다

```python
from openai import OpenAI
from langsmith import traceable
from langsmith.wrappers import wrap_openai

client = wrap_openai(OpenAI())


@traceable(run_type="tool", name="retrieve_context")
def retrieve_context(question: str) -> str:
    faq = {
        "trace": "LangSmith trace는 한 번의 요청에서 실행된 run들의 묶음이다.",
        "project": "Project는 여러 trace를 모아 두는 컨테이너다.",
    }
    for key, value in faq.items():
        if key in question.lower():
            return value
    return "LangSmith는 LLM 애플리케이션의 tracing과 관측에 사용된다."


@traceable(name="answer_with_context")
def answer_with_context(question: str) -> str:
    context = retrieve_context(question)
    response = client.chat.completions.create(
        model="gpt-5.4-mini",
        messages=[
            {
                "role": "system",
                "content": "주어진 문맥만 사용해 간결하게 답하라.",
            },
            {
                "role": "user",
                "content": f"질문: {question}\n문맥: {context}",
            },
        ],
    )
    return response.choices[0].message.content or ""


if __name__ == "__main__":
    print(answer_with_context("LangSmith trace가 뭐야?"))
```

이 스크립트를 실행하면 LangSmith UI에서 바깥쪽 `answer_with_context` run, 그 안의 `retrieve_context` run, 그리고 nested OpenAI 호출을 한 trace 안에서 볼 수 있다.

## 2. tags와 metadata를 같이 남기기

trace를 몇 번만 쌓아도 곧 "로컬 테스트만 보고 싶다", "RAG 관련 요청만 보고 싶다", "배포 버전별로 비교하고 싶다" 같은 요구가 생긴다. 이때 tags와 metadata를 초반부터 붙여 두면 나중에 trace를 찾기 쉬워진다.

공식 문서 기준으로 Python에서는 호출 시점에 `langsmith_extra`를 넘길 수 있다.

```python
from openai import OpenAI
from langsmith import traceable
from langsmith.wrappers import wrap_openai

client = wrap_openai(OpenAI())


@traceable(name="customer_support_pipeline")
def customer_support_pipeline(question: str) -> str:
    response = client.chat.completions.create(
        model="gpt-5.4-mini",
        messages=[
            {"role": "system", "content": "질문을 한 문단으로 답하라."},
            {"role": "user", "content": question},
        ],
    )
    return response.choices[0].message.content or ""


result = customer_support_pipeline(
    "LangSmith project를 왜 나눠야 해?",
    langsmith_extra={
        "tags": ["local", "study-note", "support"],
        "metadata": {
            "feature": "langsmith-tracing",
            "environment": "dev",
            "app_version": "2026-06-02",
        },
    },
)

print(result)
```

이렇게 남긴 tags와 metadata는 LangSmith UI에서 필터링과 그룹화에 바로 쓸 수 있다.

## 3. project를 분리해서 보는 이유

LangSmith의 기본 project 이름은 `default`다. 작은 실험에서는 괜찮지만, 금방 아래 문제가 생긴다.

- 로컬 실험 trace와 실제 앱 trace가 섞인다
- 특정 기능 변경 전후 비교가 어렵다
- 팀원이 같은 workspace를 쓰면 검색 범위가 너무 넓어진다

그래서 보통은 기능이나 환경 기준으로 project를 먼저 나눈다.

- `myapp-dev`
- `myapp-staging`
- `myapp-rag`
- `langsmith-study-notes`

정적 설정만 필요하면 환경 변수로 충분하다.

```bash
export LANGSMITH_PROJECT="langsmith-study-notes"
```

공식 개념 문서 기준으로 project는 trace를 모아 두는 컨테이너다. trace 검색과 운영 관점에서 가장 먼저 정리해야 하는 단위라고 봐도 무리가 없다.

## 4. trace, run, thread를 헷갈리지 않기

처음 LangSmith UI를 보면 이 셋이 비슷해 보여서 자주 섞인다.

- `project`: 여러 trace를 담는 큰 묶음
- `trace`: 한 번의 요청 또는 작업에서 실행된 run들의 묶음
- `run`: LLM 호출, retriever 호출, 함수 실행 같은 개별 작업 단위
- `thread`: 여러 turn의 대화를 하나의 대화 흐름으로 묶은 것

특히 thread는 "대화 전체"이고, trace는 "그 대화 안의 한 turn 또는 한 작업 실행"에 가깝다. 멀티턴 앱을 만들 때는 이 차이를 알고 봐야 UI 해석이 쉬워진다.

## 자주 막히는 지점

### 1. `wrap_openai(...)`만 쓰고 tracing 환경 변수를 안 넣는 경우

공식 문서 기준으로 `wrap_openai`를 써도 `LANGSMITH_TRACING=true`가 없으면 trace가 기록되지 않는다. 코드만 감싸고 UI에 아무것도 안 보이면 가장 먼저 이 값을 확인하면 된다.

### 2. 미국 외 리전 계정인데 `LANGSMITH_ENDPOINT`를 안 넣는 경우

EU나 APAC 계정인데 기본 US endpoint로 보내면 인증이 실패할 수 있다. 계정 리전이 기본 US가 아니면 endpoint를 같이 설정해야 한다.

### 3. 여러 workspace가 연결된 키인데 `LANGSMITH_WORKSPACE_ID`를 빼먹는 경우

한 API 키가 여러 workspace 접근 권한을 가질 수 있다. 이때 어느 workspace에 trace를 쓸지 불분명하면 의도한 곳이 아닌 곳에 보이거나 인증 문제가 생길 수 있다.

### 4. project를 안 나눠서 나중에 trace를 못 찾는 경우

처음엔 `default`에 다 넣어도 되지만, 며칠만 지나면 실험/개발/운영 trace가 섞여서 필터링 비용이 커진다. 초반부터 `LANGSMITH_PROJECT`를 정해 두는 편이 낫다.

### 5. thread를 trace와 같은 것으로 생각하는 경우

한 번의 사용자 요청이 하나의 trace이고, 여러 요청 turn을 이어 붙인 것이 thread다. 대화 앱 디버깅에서 이 차이를 모르고 보면 "왜 대화 전체가 한 행에 안 보이지?" 같은 혼란이 생긴다.

## 다음에 이어서 보면 좋은 주제

tracing이 붙었다면 다음 순서가 자연스럽다.

1. metadata/tag 설계를 정해서 trace 필터링 기준 만들기
2. dataset 기반 evaluation quickstart로 회귀 검증 붙이기
3. 알림 규칙이나 automation으로 실패 trace 후속 처리하기

개인적으로는 tracing 없이 evaluation으로 바로 넘어가기보다, 먼저 trace를 안정적으로 보고 나서 평가 지표를 붙이는 순서를 추천한다. 그래야 점수 변화가 생겼을 때 원인 trace를 바로 따라갈 수 있다.

## 참고 자료

- [LangSmith Tracing quickstart](https://docs.langchain.com/langsmith/observability-quickstart)
- [Trace OpenAI applications](https://docs.langchain.com/langsmith/trace-openai)
- [Observability concepts](https://docs.langchain.com/langsmith/observability-concepts)
- [Log traces to a specific project](https://docs.langchain.com/langsmith/log-traces-to-project)
- [Add metadata and tags to traces](https://docs.langchain.com/langsmith/add-metadata-tags)
