---
title: LangChain FilesystemFileSearchMiddleware로 코드베이스 glob/grep 검색 붙이기
description: LangChain FilesystemFileSearchMiddleware로 에이전트에 glob_search와 grep_search를 추가해 코드베이스 탐색 효율을 높이는 실전 패턴 정리
date: 2026-06-18
tags:
  - langchain
  - agent
  - middleware
  - file-search
  - python
---

# LangChain FilesystemFileSearchMiddleware로 코드베이스 glob/grep 검색 붙이기

코드 리뷰, 리팩터링 보조, 운영 스크립트 점검 같은 에이전트를 만들다 보면 "파일을 읽기 전에 어디를 봐야 하는지"부터 빨리 좁히는 단계가 필요합니다.

이때 모든 파일 내용을 한 번에 모델에 넣는 방식은 비효율적입니다. 먼저 파일 이름 패턴과 내용 패턴으로 후보를 좁히고, 그다음 필요한 파일만 읽게 하는 흐름이 훨씬 안정적입니다.

LangChain의 `FilesystemFileSearchMiddleware`는 바로 이 첫 단계에 맞는 미들웨어입니다. 공식 문서 기준으로 에이전트에 아래 두 도구를 자동으로 추가합니다.

- `glob_search`: 파일 경로 패턴 검색
- `grep_search`: 파일 내용 정규식 검색

2026년 6월 18일 기준 공식 문서에서 확인되는 주요 설정값은 다음입니다.

- `root_path`: 검색 루트 디렉터리
- `use_ripgrep=True`: 가능하면 `ripgrep` 사용, 없으면 Python regex로 fallback
- `max_file_size_mb=10`: 이보다 큰 파일은 검색 대상에서 제외

이 글에서는 `FilesystemFileSearchMiddleware`를 코드베이스 탐색형 agent에 붙이는 가장 실용적인 패턴만 정리합니다.

## 언제 잘 맞는가

아래처럼 "먼저 찾고, 나중에 읽는" 흐름이 필요한 경우에 특히 잘 맞습니다.

- 큰 저장소에서 관련 파일 후보를 빠르게 좁혀야 할 때
- 특정 함수명, 설정 키, 에러 문자열이 어디에 있는지 찾고 싶을 때
- `.py`, `.ts`, `.md`처럼 확장자별로 다른 탐색 전략을 쓰고 싶을 때
- 전체 파일 시스템 도구를 바로 열기 전에 검색 전용 도구만 먼저 주고 싶을 때

반대로 아래라면 다른 도구를 같이 봐야 합니다.

- 파일을 읽고 수정하는 작업까지 한 번에 하려면 `FilesystemMiddleware`나 별도 read/edit tool이 필요하다
- 벡터 검색이나 의미 검색이 필요하면 file search만으로는 부족하다
- 바이너리 파일, 대용량 로그, 압축 파일이 주 대상이면 검색 정확도가 떨어질 수 있다

## 사전 준비

```bash
pip install -U langchain
```

`ripgrep`가 설치돼 있으면 검색 속도와 정규식 처리 면에서 유리합니다.

```bash
rg --version
```

모델 provider 패키지도 함께 준비합니다. 예를 들어 OpenAI를 쓴다면:

```bash
pip install -U "langchain[openai]"
```

PowerShell:

```powershell
$env:OPENAI_API_KEY="sk-..."
```

## 1. 가장 작은 형태의 예제

아래 예제는 `/workspace` 아래 파일을 glob/grep으로 찾을 수 있는 agent를 만듭니다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import FilesystemFileSearchMiddleware
from langchain.messages import HumanMessage


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[],
    middleware=[
        FilesystemFileSearchMiddleware(
            root_path="/workspace",
            use_ripgrep=True,
            max_file_size_mb=10,
        )
    ],
)


result = agent.invoke(
    {
        "messages": [
            HumanMessage(
                content="`async def`가 들어간 Python 파일을 찾아서 후보 파일 경로만 먼저 알려줘."
            )
        ]
    }
)

print(result["messages"][-1].content)
```

핵심은 간단합니다.

- 직접 tool을 정의하지 않아도 middleware가 검색 도구를 주입한다
- 모델은 필요할 때 `glob_search`, `grep_search`를 조합해 후보를 좁힌다
- 파일 전체 내용을 바로 읽지 않으므로 컨텍스트 낭비를 줄이기 쉽다

## 2. 코드베이스 탐색용으로 프롬프트를 좁혀 주면 더 안정적이다

검색 도구가 있다고 해서 모델이 항상 좋은 순서로 쓰는 것은 아닙니다. "먼저 glob으로 범위를 좁히고, 그다음 grep으로 내용 검색" 같은 절차를 system prompt에 명시하면 결과가 더 일관적입니다.

```python
from langchain.agents import create_agent
from langchain.agents.middleware import FilesystemFileSearchMiddleware


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[],
    system_prompt=(
        "You are a codebase search assistant. "
        "Use glob_search first to narrow file types or folders, "
        "then use grep_search for exact content matches. "
        "Do not guess file paths without searching."
    ),
    middleware=[
        FilesystemFileSearchMiddleware(
            root_path="/workspace",
            use_ripgrep=True,
        )
    ],
)
```

이 패턴은 아래 같은 질문에서 특히 유용합니다.

- "Redis 관련 설정 파일이 어디 있지?"
- "JWT 검증 로직이 구현된 파일만 먼저 찾아줘."
- "deprecated API를 쓰는 `.ts` 파일 목록만 뽑아줘."

## 3. 검색 결과만으로 끝내지 말고 읽기 단계와 분리하는 편이 좋다

공식 문서 기준으로 이 middleware는 검색 도구를 제공하지만 파일 읽기/수정 도구까지 같이 넣어 주지는 않습니다. 그래서 실전에서는 보통 아래처럼 2단계로 나눕니다.

1. `FilesystemFileSearchMiddleware`로 후보 파일을 찾는다
2. 별도 read/edit tool 또는 `FilesystemMiddleware`로 필요한 파일만 읽는다

예를 들어 "관련 파일 후보를 고른 뒤 일부 파일만 읽게" 하고 싶다면 직접 읽기 tool을 좁게 제공할 수 있습니다.

```python
from pathlib import Path

from langchain.agents import create_agent
from langchain.agents.middleware import FilesystemFileSearchMiddleware
from langchain.tools import tool


ROOT = Path("/workspace").resolve()


@tool
def read_selected_file(path: str) -> str:
    """Read a UTF-8 text file under /workspace after search narrowed the target."""
    target = (ROOT / path).resolve()
    if ROOT not in target.parents and target != ROOT:
        raise ValueError("Path must stay inside /workspace")
    return target.read_text(encoding="utf-8")


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[read_selected_file],
    middleware=[
        FilesystemFileSearchMiddleware(
            root_path=str(ROOT),
            use_ripgrep=True,
            max_file_size_mb=5,
        )
    ],
)
```

이렇게 분리하면 검색 범위와 실제 읽기 권한을 따로 통제할 수 있습니다.

## 4. `glob_search`와 `grep_search`의 역할을 분리해서 생각하면 좋다

공식 문서 설명을 기준으로 두 도구의 역할은 꽤 다릅니다.

### `glob_search`

- `**/*.py`, `src/**/*.ts` 같은 패턴 검색
- 파일 경로 기준으로 후보를 빠르게 좁힘
- 수정 시각 기준으로 정렬된 파일 목록 반환

### `grep_search`

- 파일 내용 정규식 검색
- `include`로 확장자나 파일 패턴 제한 가능
- `files_with_matches`, `content`, `count` 같은 출력 모드 지원

실무에서는 보통 아래 순서가 잘 먹힙니다.

1. `glob_search`로 디렉터리와 확장자를 먼저 제한
2. `grep_search`로 함수명, 에러 코드, 환경 변수 키를 검색
3. 필요한 파일만 읽기 도구로 넘긴다

## 5. 운영에서 자주 겪는 함정

### 1. `root_path`를 너무 넓게 잡으면 검색 잡음이 커진다

저장소 루트 전체를 열어도 되지만, 실제로는 `src`, `app`, `packages/api`처럼 관심 디렉터리로 줄이는 편이 더 낫습니다. 검색 후보가 줄어야 모델의 다음 단계도 안정적입니다.

### 2. 이 middleware만으로는 파일 읽기와 수정이 해결되지 않는다

검색은 어디를 볼지 결정하는 단계입니다. 내용을 해석하거나 패치를 만들려면 읽기/수정 도구가 추가로 필요합니다.

### 3. 큰 파일이 기본적으로 제외될 수 있다

공식 문서 기준 기본 `max_file_size_mb`는 `10`입니다. 대형 로그, 생성 산출물, vendor 파일이 많다면 일부 검색 누락처럼 보일 수 있습니다.

### 4. `ripgrep`가 없으면 동작은 하지만 체감이 달라질 수 있다

문서 기준 `use_ripgrep=True`여도 `ripgrep`가 없으면 Python regex로 fallback 합니다. 따라서 로컬 개발 환경과 운영 환경의 속도 차이가 크게 날 수 있습니다.

### 5. 정규식을 너무 공격적으로 쓰면 모델이 결과를 놓칠 수 있다

예를 들어 괄호, 백슬래시, 점 문자가 많은 패턴은 이스케이프를 잘못 만들기 쉽습니다. 애매한 경우는 넓게 한 번 찾고, 그다음 더 좁히는 방식이 안전합니다.

## 추천 적용 순서

작은 코드 탐색 agent라면 아래 순서가 무난합니다.

1. `root_path`를 실제 작업 디렉터리로 제한한다
2. `FilesystemFileSearchMiddleware`만 먼저 붙인다
3. system prompt에 "glob 먼저, grep 나중" 규칙을 넣는다
4. 정말 필요한 경우에만 파일 읽기 도구를 추가한다
5. 검색 결과가 너무 많으면 디렉터리 범위와 `include` 패턴을 더 좁힌다

## 마무리

`FilesystemFileSearchMiddleware`는 화려한 기능보다 기본기가 좋은 도구입니다.

- 파일 내용을 전부 모델에 넣기 전에 후보를 줄일 수 있다
- `glob_search`와 `grep_search`만으로도 코드베이스 탐색 품질이 크게 좋아진다
- 읽기/수정 권한을 나중 단계로 분리하기 쉬워 안전한 편이다

코드 검색이 필요한 LangChain agent를 만들고 있다면, 이 middleware는 가장 먼저 붙여 볼 만한 실전 옵션입니다.

## 참고 자료

- [LangChain prebuilt middleware](https://docs.langchain.com/oss/python/langchain/middleware/built-in)
- [LangChain middleware overview](https://docs.langchain.com/oss/python/langchain/middleware/overview)
- [LangChain tools](https://docs.langchain.com/oss/python/langchain/tools)
