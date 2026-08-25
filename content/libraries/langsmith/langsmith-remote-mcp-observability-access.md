---
title: "LangSmith Remote MCP로 trace와 evaluation 데이터를 AI 도구에 연결하기"
description: "OAuth 또는 API key로 LangSmith Remote MCP를 연결하고 trace, thread, dataset, experiment를 안전하게 조회하는 운영 패턴"
date: 2026-08-25
tags:
  - langsmith
  - mcp
  - observability
  - evaluation
aliases:
  - "/blog/langsmith-remote-mcp-observability-access"
---

# LangSmith Remote MCP로 trace와 evaluation 데이터를 AI 도구에 연결하기

운영 장애를 분석할 때 AI coding assistant에게 다음 작업을 시키고 싶을 수 있다.

- production project의 최근 실패 root run 10개 찾기
- 특정 thread의 대화 흐름 요약하기
- evaluation dataset의 example과 최근 experiment 지표 비교하기
- 지난달 workspace별 trace 사용량 확인하기

LangSmith Remote MCP는 이런 읽기 작업을 MCP-compatible client의 tool로 노출한다. 별도 MCP 서버를 배포하지 않아도 hosted endpoint에 연결할 수 있고, 사용자용 client는 OAuth, headless 프로그램은 API key를 쓸 수 있다.

이 글에서는 연결 자체보다 운영에서 중요한 경계를 중심으로 정리한다.

- OAuth와 API key를 언제 구분할지
- AI에게 넓은 자연어 요청 대신 어떤 조회 조건을 명시할지
- tool 이름이 create/update처럼 보여도 실제 실행 tool인지 확인하는 법
- 큰 trace와 thread를 문자 기반 page로 안전하게 읽는 법
- 현재 Codex CLI에서 OAuth 연결이 실패할 때의 우회 경로

## 사전 준비

필요한 것은 아래와 같다.

1. LangSmith Cloud 또는 Remote MCP를 활성화한 self-hosted LangSmith
2. 조회 대상 workspace와 project에 접근 가능한 사용자 계정
3. Streamable HTTP와 OAuth 2.1 dynamic client registration을 지원하는 MCP client
4. headless client라면 최소 권한의 LangSmith API key

LangSmith Cloud US의 기본 endpoint는 다음과 같다.

```text
https://api.smith.langchain.com/mcp
```

EU, APAC, AWS US를 사용한다면 workspace의 region endpoint를 선택해야 한다. self-hosted는 v0.16 이상에서 다음 경로를 사용한다.

```text
https://<your-langsmith-host>/api/mcp
```

## 1. 대화형 client는 OAuth로 연결한다

Cursor처럼 OAuth-compatible client에서는 API key를 설정 파일에 넣을 필요가 없다.

```json
{
  "mcpServers": {
    "LangSmith": {
      "url": "https://api.smith.langchain.com/mcp"
    }
  }
}
```

처음 tool을 사용할 때 browser가 열리면 LangSmith에 로그인하고 권한을 승인한다. access token과 refresh token은 client가 관리한다.

OAuth session의 권한은 로그인한 사용자와 workspace 권한을 그대로 따른다. MCP를 연결했다고 기존에 보지 못하던 project나 dataset을 볼 수 있게 되는 것은 아니다.

### 연결 후 첫 확인 요청

처음부터 전체 trace를 읽게 하기보다 작은 요청으로 범위를 확인한다.

```text
LangSmith에서 접근 가능한 project 이름만 최대 20개 보여 줘.
아직 run 상세는 조회하지 마.
```

그다음 project를 명시해 조회한다.

```text
project "support-agent-prod"에서 최근 실패한 root run을
최대 10개만 조회해. run id, 시작 시각, error만 요약해.
```

이렇게 단계적으로 요청하면 잘못된 workspace나 project를 대량 조회하는 실수를 줄일 수 있다.

## 2. headless client는 `X-Api-Key`를 사용한다

browser 로그인을 할 수 없는 backend나 script에서는 LangSmith API key를 `X-Api-Key` header로 보낸다. 공식 문서의 AI SDK 예시는 다음 형태다.

```bash
npm install @ai-sdk/mcp
```

```typescript
import { createMCPClient } from "@ai-sdk/mcp";

const apiKey = process.env.LANGSMITH_API_KEY;
if (!apiKey) {
  throw new Error("LANGSMITH_API_KEY is required");
}

const client = await createMCPClient({
  transport: {
    type: "http",
    url: "https://api.smith.langchain.com/mcp",
    headers: { "X-Api-Key": apiKey },
  },
});

const tools = await client.tools();
console.log(Object.keys(tools).sort());
```

중요한 점은 header 이름이다.

- Remote MCP: `X-Api-Key`
- standalone LangSmith MCP Server: `LANGSMITH-API-KEY`

둘을 섞으면 인증 오류가 난다. key는 저장소의 MCP 설정이나 source code에 직접 적지 말고 secret manager 또는 environment variable로 주입한다.

## 3. 조회 tool과 문서 안내 tool을 구분한다

Remote MCP가 제공하는 대표 tool은 다음 역할로 나뉜다.

| 역할 | 대표 tool |
| --- | --- |
| thread | `get_thread_history` |
| prompt | `list_prompts`, `get_prompt_by_name` |
| trace | `fetch_runs`, `list_projects` |
| dataset | `list_datasets`, `list_examples`, `read_dataset`, `read_example` |
| experiment | `list_experiments` |
| billing | `get_billing_usage` |

여기서 가장 큰 함정은 이름만 보고 mutation을 기대하는 것이다. 공식 tool surface에서 `push_prompt`, `create_dataset`, `update_examples`, `run_experiment`는 현재 작업을 직접 실행하는 tool이 아니라 해당 작업 방법을 알려 주는 documentation-only tool이다.

따라서 아래 요청은 기대와 다르게 동작할 수 있다.

```text
이 trace를 바로 새 dataset으로 만들어 줘.
```

안전한 요청은 경계를 분리한다.

```text
실패한 root run 10개를 조회하고 dataset 후보 표를 만들어 줘.
변경 작업은 실행하지 말고, create_dataset과 update_examples에 필요한
SDK 절차만 별도로 정리해 줘.
```

즉 Remote MCP는 우선 관측 데이터 탐색 계층으로 쓰고, 실제 변경은 검토 가능한 SDK script나 별도 승인 흐름으로 넘기는 편이 좋다.

## 4. `fetch_runs`에는 항상 범위와 limit를 준다

`fetch_runs`는 project, run type, error, root 여부뿐 아니라 LangSmith FQL의 `filter`, `trace_filter`, `tree_filter`도 지원한다.

AI에게 단순히 "오류 원인을 찾아 줘"라고 하면 조회 범위가 모호하다. 최소한 다음 조건을 같이 준다.

- project 이름
- 시간 범위
- `is_root` 또는 `run_type`
- error 여부
- 반환 개수 `limit`
- 필요한 field

예시:

```text
project "support-agent-prod"에서 지난 24시간의 root run만 대상으로,
error가 있는 run을 최신순 최대 20개 조회해.
각 run은 id, start_time, latency, error만 먼저 보여 줘.
child run은 아직 읽지 마.
```

후속 요청에서 특정 trace만 깊게 읽는다.

```text
방금 결과의 첫 번째 trace id에 속한 run을 page 1부터 읽고,
tool run의 name과 error를 실행 순서대로 정리해.
```

이 2단계 방식은 큰 inputs와 outputs를 처음부터 모두 context에 넣는 일을 피한다.

## 5. 큰 thread와 trace는 문자 기반 page를 끝까지 확인한다

`get_thread_history`와 `trace_id`를 지정한 `fetch_runs`는 item 개수가 아니라 문자 수 기준으로 page를 나눈다.

- `page_number`는 1부터 시작한다
- 기본 `max_chars_per_page`는 25,000이다
- 최대값은 30,000이다
- response의 `total_pages`까지 다음 page를 요청해야 전체 결과다
- `preview_chars`로 긴 문자열을 먼저 줄일 수 있다

운영 요청에는 이 조건을 명시하는 편이 좋다.

```text
thread "customer-42"의 history를 page 1부터 조회해.
각 응답의 total_pages를 확인하고 마지막 page까지 이어서 읽되,
긴 message는 preview_chars로 먼저 줄여서 요약해.
누락된 page가 있으면 완료라고 말하지 마.
```

페이지 하나만 읽고 전체 thread라고 판단하는 것이 대표적인 분석 오류다.

## 6. evaluation 비교는 dataset을 먼저 고정한다

`list_experiments`는 `reference_dataset_id` 또는 `reference_dataset_name`이 필요하다. 자연어 이름이 비슷한 dataset이 많다면 ID를 먼저 확인한다.

```text
이름이 "support-regression"인 dataset의 id와 최신 version 정보를 확인해.
그 id를 reference_dataset_id로 사용해 최근 experiment 5개의
latency, cost, feedback metric을 비교해.
```

dataset example까지 확인할 때는 split과 `as_of` version을 같이 고정해야 서로 다른 평가셋을 같은 실험처럼 비교하는 일을 피할 수 있다.

## 자주 틀리는 점

### 1. hosted endpoint와 self-hosted endpoint 경로를 섞는다

Cloud 기본 endpoint는 `/mcp`, self-hosted와 BYOC는 일반적으로 `/api/mcp`다. region과 배포 형태를 먼저 확인한다.

### 2. OAuth와 API key를 한 설정에 동시에 넣는다

대화형 client는 OAuth를 우선하고, headless client에서만 `X-Api-Key`를 쓰는 편이 단순하다. key를 추가한다고 OAuth 호환 문제가 해결되는 것은 아니다.

### 3. documentation-only tool을 mutation tool로 오해한다

`create_dataset` 같은 이름만 보고 데이터가 생성됐다고 판단하지 않는다. tool 결과와 실제 LangSmith 상태를 다시 확인한다.

### 4. `limit` 없이 넓은 trace 조회를 요청한다

AI context와 LangSmith query 비용을 동시에 키운다. 작은 목록 조회 뒤 선택한 trace만 확장한다.

### 5. 첫 page만 보고 전체 대화를 요약한다

반드시 `total_pages`를 확인한다. 긴 tool output은 preview를 먼저 사용한다.

### 6. 현재 Codex CLI에서 OAuth Remote MCP를 바로 연결하려 한다

2026년 8월 25일 공식 문서 기준 Codex CLI의 OAuth flow는 MCP authorization에 필요한 `resource` parameter 문제로 LangSmith Remote MCP와 호환되지 않는다. 로그인 성공처럼 보여도 initialize 단계에서 auth-required 오류가 날 수 있다.

공식 우회는 Codex 안에서 LangSmith CLI를 사용하는 것이다.

```bash
langsmith auth login
langsmith project list
```

호환성 문제는 client 업데이트로 바뀔 수 있으므로 적용 전에 최신 공식 문서를 다시 확인한다.

## 추천 운영 흐름

1. OAuth로 로그인한 뒤 `list_projects`로 권한 범위를 확인한다
2. project, 시간, root 여부, limit를 고정해 작은 run 목록을 가져온다
3. 선택한 trace나 thread만 page 단위로 확장한다
4. dataset ID와 version을 고정한 뒤 experiment를 비교한다
5. AI가 만든 요약에는 조회 조건과 run/dataset ID를 함께 남긴다
6. mutation은 documentation-only 응답을 검토한 뒤 별도 SDK script로 실행한다
7. headless 연결은 최소 권한 API key를 secret으로 주입하고 주기적으로 교체한다

Remote MCP의 장점은 AI에게 LangSmith 전체를 막연히 맡기는 데 있지 않다. 관측 데이터에 대한 좁고 재현 가능한 조회를 tool call로 만들고, 실제 변경은 분리하는 데 있다.

## 참고 자료

- [LangSmith Remote MCP](https://docs.langchain.com/langsmith/langsmith-remote-mcp)
- [LangSmith MCP Server tool reference](https://docs.langchain.com/langsmith/langsmith-mcp-server)
- [Query traces using the SDK](https://docs.langchain.com/langsmith/export-traces)
- [Trace query syntax](https://docs.langchain.com/langsmith/trace-query-syntax)
- [LangSmith CLI](https://docs.langchain.com/langsmith/cli)
