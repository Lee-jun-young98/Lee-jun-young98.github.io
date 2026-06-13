---
title: "LangGraph defer=True로 정리 작업을 run 마지막으로 미루기"
description: "LangGraph Graph API에서 defer=True를 사용해 branch 길이가 달라도 cleanup, audit, notification 같은 후처리를 마지막에 안전하게 실행하는 패턴 정리"
date: 2026-06-13
tags:
  - langgraph
  - agent
  - workflow
  - python
aliases:
  - "/blog/langgraph-deferred-node-cleanup-finalizers"
---

# LangGraph `defer=True`로 정리 작업을 run 마지막으로 미루기

LangGraph로 workflow를 짜다 보면 "핵심 작업은 먼저 끝내고, 마지막에 한 번만 정리하고 싶다"는 요구가 자주 나온다.

- 병렬 branch가 모두 끝난 뒤 audit log 남기기
- 긴 branch까지 완료된 다음 Slack 알림 보내기
- 중간 산출물을 다 모은 뒤 임시 리소스 정리하기

이때 짧은 branch와 긴 branch가 같은 노드로 합류하면, 보통은 "언제 그 노드가 실행되느냐"가 헷갈린다.  
LangGraph는 이런 상황을 위해 `add_node(..., defer=True)`를 제공한다.

공식 문서 기준으로 deferred node는 "run이 끝나기 직전"까지 실행을 미루는 노드다. 실무적으로는 finalizer, cleanup, audit, notification 같은 후처리 단계에 잘 맞는다.

이번 글에서는 아래를 빠르게 정리한다.

- `defer=True`가 정확히 무엇을 보장하는지
- branch 길이가 다를 때 왜 useful한지
- 바로 실행 가능한 Python 예제
- reducer, retry, checkpointer와의 역할 차이
- 자주 하는 실수

## 언제 쓰면 좋은가

아래 같은 조건이면 `defer=True`를 먼저 떠올리면 된다.

- 어떤 노드가 반드시 "마지막 근처"에 한 번만 실행되어야 한다
- 앞단 branch 길이가 서로 다르다
- 후처리 노드가 너무 일찍 실행되면 안 된다

대표 예시는 이렇다.

- 병렬 분석이 끝난 뒤 최종 리포트 발행 로그 남기기
- map-reduce 이후 캐시 파일, 임시 디렉터리 정리하기
- 여러 검증 branch가 끝난 뒤 실패 요약을 한 번만 발송하기

반대로 아래 상황에는 다른 도구가 더 맞다.

- 중간 단계에서 바로 다음 분기를 결정해야 한다: `Command` 또는 conditional edge
- 동적으로 worker를 여러 개 만들고 싶다: `Send`
- 실패 복구나 대화 이어가기가 필요하다: `checkpointer`

## 사전 준비

예제는 Python 3.10+와 `langgraph`만 있으면 된다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langgraph
```

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langgraph
```

## 1. 왜 필요한가: branch 길이가 다르면 합류 타이밍이 꼬인다

LangGraph runtime은 graph를 super-step 단위로 실행한다. 같은 super-step에 잡힌 노드들은 병렬로 실행되고, 그 step에서 생긴 state update는 다음 step에서 보인다.

그래서 아래처럼 한 branch는 한 단계, 다른 branch는 두 단계인 구조에서는 "마지막 알림 노드"가 너무 일찍 실행될 수 있다.

```text
START
  -> prepare
  -> quick_check -> finalize?
  -> slow_check -> slow_check_2 -> finalize?
```

이때 `finalize`를 deferred node로 두면 LangGraph는 다른 pending task가 모두 끝날 때까지 `finalize` 실행을 미룬다. 공식 예제도 `d` 노드에 `defer=True`를 주어 긴 `"b"` branch가 끝날 때까지 기다리게 만든다.

## 2. 가장 작은 실행 예제

아래 예제는 빠른 검증 branch와 느린 검증 branch를 돌린 뒤, 마지막에 한 번만 배포 알림을 남긴다.

```python
from typing import Annotated
import operator
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


class DeployState(TypedDict):
    events: Annotated[list[str], operator.add]
    deploy_ready: bool
    notification_sent: bool


def prepare(state: DeployState):
    return {"events": ["prepare"], "deploy_ready": True}


def quick_check(state: DeployState):
    return {"events": ["quick_check"]}


def slow_check(state: DeployState):
    return {"events": ["slow_check"]}


def slow_check_2(state: DeployState):
    return {"events": ["slow_check_2"]}


def notify(state: DeployState):
    if not state["deploy_ready"]:
        return {"events": ["notify_skipped"], "notification_sent": False}
    return {
        "events": [f"notify_after={state['events'][-1]}"],
        "notification_sent": True,
    }


builder = StateGraph(DeployState)
builder.add_node("prepare", prepare)
builder.add_node("quick_check", quick_check)
builder.add_node("slow_check", slow_check)
builder.add_node("slow_check_2", slow_check_2)
builder.add_node("notify", notify, defer=True)

builder.add_edge(START, "prepare")
builder.add_edge("prepare", "quick_check")
builder.add_edge("prepare", "slow_check")
builder.add_edge("quick_check", "notify")
builder.add_edge("slow_check", "slow_check_2")
builder.add_edge("slow_check_2", "notify")
builder.add_edge("notify", END)

graph = builder.compile()

result = graph.invoke(
    {
        "events": [],
        "deploy_ready": False,
        "notification_sent": False,
    }
)

print(result["events"])
print(result["notification_sent"])
```

예상 결과는 대략 아래 흐름이다.

```text
['prepare', 'quick_check', 'slow_check', 'slow_check_2', 'notify_after=slow_check_2']
True
```

핵심은 `quick_check`가 먼저 끝나더라도 `notify`가 즉시 실행되지 않는다는 점이다.  
`notify`는 다른 pending task인 `slow_check_2`까지 끝난 뒤에야 실행된다.

## 3. 실무에서는 finalizer처럼 생각하면 편하다

`defer=True`는 사실상 "이 노드는 run 마지막에 처리할 일"이라고 선언하는 것에 가깝다.

잘 맞는 작업:

- 감사 로그 기록
- 최종 성공/실패 알림
- 임시 파일 정리
- branch 결과를 모두 본 뒤 한 번만 하는 메트릭 집계

덜 맞는 작업:

- 중간 산출물을 만들어 다음 핵심 로직에서 즉시 소비해야 하는 노드
- 너무 무거워서 run 종료 지연을 크게 만드는 후처리
- 반드시 외부 시스템에 성공해야만 하는 critical path

후자의 경우는 deferred node에 몰아넣기보다 명시적인 reduce 단계나 별도 workflow로 분리하는 편이 낫다.

## 4. reducer와 deferred node는 해결하는 문제가 다르다

`defer=True`는 실행 시점을 미루는 기능이지, 여러 branch 결과를 어떻게 합칠지 정해 주는 기능은 아니다.

예제의 이 줄은 여전히 필요하다.

```python
events: Annotated[list[str], operator.add]
```

병렬 branch가 같은 key에 값을 쓰면 reducer가 병합 규칙을 정한다.  
deferred node는 "언제 실행할까"를 풀고, reducer는 "여러 결과를 어떻게 합칠까"를 푼다.

실전에서는 둘을 같이 쓰는 경우가 많다.

- branch 결과 누적: reducer
- 누적 결과를 마지막에 정리: deferred node

## 5. 흔한 실수

### 5-1. `defer=True`가 자동 집계 노드라고 오해한다

deferred node는 pending task가 끝날 때까지 기다릴 뿐이다.  
branch 결과를 합치는 상태 키에 reducer가 없으면 여전히 충돌하거나 설계가 모호하다.

### 5-2. 핵심 비즈니스 로직을 전부 deferred node 뒤에 몰아넣는다

deferred node는 이름 그대로 후반 처리에 적합하다.  
중요한 메인 로직까지 전부 뒤로 미루면 graph 의도가 흐려지고, 실패 지점도 늦게 드러난다.

### 5-3. 부작용이 큰 후처리를 retry 없이 둔다

Slack 알림, 웹훅 전송, 정산 로그 저장처럼 외부 I/O가 있으면 deferred node에도 `RetryPolicy`를 붙이는 편이 안전하다.

```python
from langgraph.types import RetryPolicy

builder.add_node(
    "notify",
    notify,
    defer=True,
    retry_policy=RetryPolicy(max_attempts=3),
)
```

### 5-4. "마지막"을 "성공이 보장된 뒤"와 같은 뜻으로 해석한다

deferred node는 실행 순서를 조정하는 기능이다.  
사람 승인 후 재개, fault tolerance, thread 지속성은 `checkpointer`가 담당한다.

예를 들어 배포 승인 workflow라면:

- 승인 대기/재개: `interrupt()` + `checkpointer`
- 승인 이후 정리 알림: `defer=True`

이렇게 역할을 나누는 편이 명확하다.

## 6. `defer=True`, `Send`, `Command`를 어떻게 구분할까

- branch 수를 동적으로 늘린다: `Send`
- 상태 업데이트와 라우팅을 한 번에 한다: `Command`
- 후처리 노드를 pending task 뒤로 미룬다: `defer=True`

셋은 경쟁 관계라기보다 조합되는 경우가 많다. 예를 들어:

1. `Send`로 worker fan-out
2. reducer로 결과 누적
3. 핵심 결과 생성
4. `defer=True`로 audit/notification 실행

이 구조는 특히 batch 평가, 다단계 검증, 운영 알림 흐름에서 읽기 쉽다.

## 마무리

LangGraph의 `defer=True`는 복잡한 branch 합류를 모두 해결하는 만능 기능은 아니다.  
대신 "이 노드는 다른 pending task가 다 끝난 뒤 마지막에 돌려라"라는 의도를 아주 명확하게 표현해 준다.

- branch 길이가 다를 때 finalizer를 늦게 실행하고 싶다면 `defer=True`
- branch 결과 병합은 reducer로 따로 설계
- 지속성, 재개, fault tolerance는 `checkpointer`와 구분

cleanup, audit, notification처럼 성격이 분명한 후처리부터 deferred node를 붙이면 graph가 훨씬 읽기 쉬워진다.

## 참고 자료

- [LangGraph Use the Graph API - Defer node execution](https://docs.langchain.com/oss/python/langgraph/use-graph-api#defer-node-execution)
- [LangGraph Graph API Overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [LangGraph Runtime / Pregel](https://docs.langchain.com/oss/python/langgraph/pregel)
- [LangGraph StateGraph.add_node Reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node)
