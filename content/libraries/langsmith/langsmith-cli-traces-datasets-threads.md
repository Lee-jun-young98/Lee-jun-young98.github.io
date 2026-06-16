---
title: "LangSmith CLI로 trace, dataset, thread를 터미널에서 바로 다루기"
description: "LangSmith CLI alpha를 사용해 로그인, profile 전환, run 검색, dataset 확인, thread 조회, API 래핑까지 터미널 중심으로 운영하는 방법을 한국어 예제와 함께 정리한 실전 노트"
date: 2026-06-16
tags:
  - langsmith
  - cli
  - observability
  - tooling
aliases:
  - "/blog/langsmith-cli-traces-datasets-threads"
---

# LangSmith CLI로 trace, dataset, thread를 터미널에서 바로 다루기

LangSmith는 보통 Python SDK나 웹 UI로 많이 쓰지만, 운영 중에는 "지금 에러 난 run만 빨리 보고 싶다", "이 프로젝트의 dataset 이름을 터미널에서 바로 확인하고 싶다", "현재 로그인된 계정과 workspace를 빠르게 전환하고 싶다" 같은 요구가 자주 생긴다.

이럴 때 LangSmith CLI가 생각보다 유용하다. 특히 노트북이 아니라 터미널 중심으로 작업하는 팀, CI에서 간단한 검증을 붙이고 싶은 팀, UI를 열기 전에 빠르게 사실 확인을 하고 싶은 팀에 잘 맞는다.

이 글에서는 현재 공식 문서를 기준으로 아래 흐름만 실전적으로 정리한다.

- LangSmith CLI 설치와 로그인
- profile로 계정과 workspace를 분리하는 방법
- `run`, `thread`, `dataset` 명령으로 운영 정보를 빠르게 조회하는 방법
- 아직 전용 서브커맨드가 없는 API를 `langsmith api`로 바로 호출하는 방법
- alpha 단계에서 자주 헷갈리는 제한 사항

## 언제 이 방식이 특히 유용한가

아래 같은 상황이면 CLI가 꽤 잘 맞는다.

- 브라우저를 열기 전에 최근 실패 run만 빠르게 확인하고 싶다
- 여러 LangSmith 계정이나 workspace를 번갈아 쓰는데 환경 변수로 계속 바꾸기 번거롭다
- dataset, thread, prompt, automation 관련 운영 스크립트를 터미널에서 얇게 붙이고 싶다
- CI나 배치 작업에서 "특정 프로젝트가 존재하는지", "최근 run이 비어 있는지" 정도를 가볍게 점검하고 싶다

반대로 복잡한 trace 탐색, feedback drill-down, prompt 편집, annotation queue 운영처럼 화면 기반 맥락이 중요한 작업은 여전히 UI가 더 낫다.

## 사전 준비

공식 문서 기준으로 LangSmith CLI는 alpha 단계다. 설치 후 `langsmith --help`로 현재 서브커맨드를 바로 확인하는 습관이 안전하다.

```bash
curl -fsSL https://cli.langsmith.com/install.sh | sh
langsmith --help
```

업그레이드는 다음처럼 한다.

```bash
langsmith self-update
```

Cloud 환경 로그인은 OAuth를 지원한다.

```bash
langsmith auth login
```

Self-hosted LangSmith를 쓰면 API key를 직접 넣거나 API-key profile을 만드는 방식이 보통 더 단순하다.

```powershell
$env:LANGSMITH_ENDPOINT="https://langsmith.mycompany.com"
$env:LANGSMITH_API_KEY="lsv2_your_key"
langsmith whoami
```

## 1. 먼저 로그인 상태와 현재 profile을 분리해 두기

CLI를 실제로 쓰다 보면 제일 먼저 필요한 것은 "지금 어느 계정과 어느 workspace로 붙어 있나"를 헷갈리지 않는 것이다.

```bash
langsmith whoami
langsmith profile list
```

예를 들어 개인 실험용 Cloud와 회사 self-hosted 환경을 같이 쓴다면 profile을 나눠 두는 편이 낫다.

```bash
langsmith profile create personal --workspace-id <workspace-id> --set-current
langsmith profile create company --workspace-id <workspace-id>
langsmith profile use company
langsmith whoami
```

프로필별로 endpoint와 인증 정보를 분리해 두면 스크립트에서 환경 변수를 매번 덮어쓰지 않아도 된다. 운영 실수도 줄어든다.

## 2. 프로젝트와 최근 run을 터미널에서 바로 확인하기

CLI의 장점은 "지금 무슨 일이 일어나고 있는지"를 얇게 보는 데 있다. 최근 trace를 UI 없이 확인하고 싶으면 `trace`와 `run` 계열 명령이 가장 먼저 손에 익는다.

공식 문서 기준으로 출력은 기본적으로 JSON이며, 사람이 보기 좋게 표 형태로 보고 싶으면 `--format pretty`를 붙인다.

```bash
langsmith --format pretty project list
langsmith --format pretty trace list --project "support-agent-prod" --limit 5
```

```bash
langsmith run list --project "support-agent-prod"
```

`run list`는 기본적으로 최근 7일 범위에서 최대 50개를 반환한다. 실패 run만 좁혀서 보고 싶으면 필터를 같이 건다.

```bash
langsmith run list \
  --project "support-agent-prod" \
  --filter 'neq(error, null)'
```

특정 run 상세를 보고 싶으면 ID로 읽는다.

```bash
langsmith run get 2d0bc2d1-6d90-4d67-9c4a-2c56b6b5b9f2
```

운영에서는 보통 아래 순서가 제일 무난하다.

1. `run list`로 최근 실패나 고비용 run을 찾는다.
2. 눈에 띄는 run ID를 `run get`으로 확인한다.
3. 더 깊은 트리 분석이 필요하면 그때 UI나 Python SDK로 넘어간다.

## 3. thread 조회로 대화 단위를 빠르게 확인하기

이미 `thread_id`를 잘 붙여 두었다면 CLI에서도 대화 단위 조회가 가능하다. SDK 글에서 설명한 thread 추적 방식을 터미널 쪽으로 확장하는 셈이다.

```bash
langsmith thread list --project "support-chat-prod"
```

특정 thread 상세를 보려면 ID를 넘긴다.

```bash
langsmith thread get 018fb6c5-9ec0-7d7f-a7b4-2c7d2b1f63a1 \
  --project "support-chat-prod"
```

이 흐름은 고객 문의 재현이나 세션 단위 장애 확인에 잘 맞는다. UI를 열기 전 "이 thread에 run이 몇 개였는지", "마지막 활동 시각이 언제인지" 정도를 빨리 보는 용도다.

## 4. dataset 이름과 예제 개수를 터미널에서 확인하기

평가용 dataset을 운영하는 팀이라면 CLI로 존재 여부를 빠르게 점검할 수 있다.

```bash
langsmith dataset list
langsmith dataset get "support-eval-dataset"
```

오프라인 평가 파이프라인을 돌리기 전에 dataset 이름이 맞는지, 잘못된 workspace에 붙어 있지는 않은지 확인하는 정도만으로도 꽤 쓸모가 있다.

특히 아래 같은 체크를 배치 작업 앞단에 넣기 좋다.

- 평가용 dataset이 존재하는지
- 운영 profile이 staging인지 production인지
- 사람이 기대한 프로젝트와 실제 CLI 대상이 같은지

## 5. 전용 명령이 없으면 `langsmith api`로 바로 감싼다

CLI가 alpha라서 모든 기능이 전용 서브커맨드로 다 열려 있지는 않다. 이때는 `langsmith api`가 제일 실용적이다. 공식 문서도 이 경로를 기본 escape hatch로 안내한다.

예를 들어 현재 endpoint와 인증으로 일반 REST 엔드포인트를 바로 호출할 수 있다.

```bash
langsmith api sessions?limit=5
```

OpenAPI 스펙 기준으로 어떤 엔드포인트가 있는지 먼저 훑고 싶다면 이렇게 본다.

```bash
langsmith api ls --tag datasets
langsmith api info GET sessions
```

이 방식의 장점은 간단하다.

- CLI 로그인과 profile 설정을 그대로 재사용한다
- `curl`보다 endpoint와 auth 구성이 덜 번거롭다
- 새 기능이 전용 명령으로 나오기 전에도 API를 바로 쓸 수 있다

## 6. Python에서 CLI를 얇게 감싸 CI 점검용으로 쓰기

SDK가 아니라 CLI를 일부러 쓰는 이유는 "로컬 개발 환경과 CI에서 같은 인증/출력 형식을 재사용하고 싶어서"인 경우가 많다. 그럴 때는 `subprocess`로 얇게 감싸는 정도면 충분하다.

```python
import json
import subprocess


def get_recent_failed_runs(project_name: str) -> list[dict]:
    result = subprocess.run(
        [
            "langsmith",
            "trace",
            "list",
            "--project",
            project_name,
            "--error",
            "--limit",
            "3",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


if __name__ == "__main__":
    runs = get_recent_failed_runs("support-agent-prod")
    print(f"failed_runs={len(runs)}")
    for run in runs:
        print(run["id"], run.get("name"), run.get("error"))
```

이 코드는 "최근 실패 run이 전혀 없으면 성공", "있으면 슬랙 알림" 같은 얇은 운영 자동화에 붙이기 좋다. 복잡한 후처리가 필요해지는 순간에는 SDK로 넘어가는 편이 낫다.

## 자주 틀리는 점

### 1. CLI가 정식 stable이라고 가정하고 스크립트를 고정해 버리는 경우

공식 문서 기준으로 LangSmith CLI는 alpha다. 명령 이름이나 출력 형태가 바뀔 수 있으니, 장기 운영 스크립트라면 `langsmith --help`와 `langsmith <subcommand> --help` 기준으로 주기적으로 확인하는 편이 안전하다.

### 2. Cloud OAuth 로그인과 self-hosted 인증 방식을 같은 것으로 보는 경우

Cloud는 `langsmith auth login` 흐름이 편하지만, self-hosted는 endpoint와 API key를 명시해야 하는 경우가 많다. 특히 profile을 섞어 쓰면 잘못된 endpoint로 붙어도 바로 눈치채기 어렵다.

### 3. 복잡한 trace 분석까지 CLI 하나로 끝내려는 경우

CLI는 빠른 조회와 자동화에 강하다. 하지만 child run 트리, feedback 맥락, prompt diff 같은 깊은 탐색은 UI나 SDK가 더 낫다. CLI는 첫 확인 지점으로 쓰는 편이 맞다.

### 4. `langsmith api` 응답 형태를 직접 고정 파싱하는 경우

raw API 응답은 전용 커맨드보다 더 저수준이다. 필요한 필드만 꺼내고, 없는 필드에 대비한 방어 코드를 두는 편이 안전하다.

### 5. profile 전환 없이 같은 머신에서 여러 workspace를 번갈아 쓰는 경우

로컬 실험, staging, production을 한 세션에서 넘나들면 의외로 다른 workspace에 run을 쌓거나 dataset을 잘못 조회하는 실수가 많다. CLI를 쓴다면 profile 분리는 거의 필수에 가깝다.

## 추천 운영 흐름

개인적으로는 아래 조합이 가장 실용적이다.

1. 평소에는 `langsmith profile`과 `whoami`로 대상 workspace를 먼저 확인한다.
2. 장애 확인은 `run list`나 `thread list`로 얇게 시작한다.
3. 세부 데이터가 더 필요하면 `langsmith api`로 해당 엔드포인트만 직접 호출한다.
4. 분석 로직이 길어지면 CLI에서 멈추지 말고 Python SDK나 UI로 바로 넘어간다.

LangSmith를 이미 쓰고 있는데 운영 확인이 여전히 브라우저 의존적이라면, CLI를 붙이는 것만으로도 꽤 많은 "빠른 사실 확인" 작업이 편해진다.

## 참고 자료

- [LangSmith CLI overview](https://docs.langchain.com/langsmith/langsmith-cli)
- [Profile configuration](https://docs.langchain.com/langsmith/profile-configuration)
- [Authentication methods](https://docs.langchain.com/langsmith/authentication-methods)
- [Query threads using the SDK](https://docs.langchain.com/langsmith/query-threads)
- [Trace query syntax](https://docs.langchain.com/langsmith/trace-query-syntax)
