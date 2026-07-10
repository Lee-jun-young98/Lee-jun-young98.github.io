---
title: "LangChain RubricMiddleware로 agent 결과를 자기검토하며 재시도하기"
description: "Deep Agents의 RubricMiddleware로 agent 출력에 합격 기준을 걸고, grader 모델과 테스트 도구를 조합해 self-evaluation 루프를 만드는 실전 학습 노트"
date: 2026-07-10
tags:
  - langchain
  - deep-agents
  - evaluation
  - python
aliases:
  - "/blog/rubric-middleware-self-evaluation"
---

# LangChain RubricMiddleware로 agent 결과를 자기검토하며 재시도하기

에이전트가 한 번에 정답을 내기 어려운 작업이 있다. 예를 들어:

- 출력 형식이 엄격한 보고서나 체크리스트 작성
- 테스트를 통과해야 하는 코드 생성
- 빠뜨리면 안 되는 항목이 있는 운영 문서 초안 작성

이럴 때 Deep Agents의 `RubricMiddleware`를 쓰면 "무엇을 만족해야 끝인지"를 rubric으로 선언하고, 별도의 grader 모델이 결과를 검토한 뒤 부족하면 다시 수정하게 만들 수 있다.

공식 문서 기준으로 `RubricMiddleware`는 runtime 시점의 LLM-as-a-judge 패턴이다. agent가 응답을 만든 뒤 grader가 rubric을 검사하고, `needs_revision`이면 피드백을 다시 대화에 주입해 한 번 더 돌린다.

## 언제 유용한가

`RubricMiddleware`는 아래 같은 상황에서 특히 실용적이다.

- "좋아 보이는 답"보다 "명시한 기준을 만족하는 답"이 중요한 작업
- 코드 생성 결과를 테스트 도구로 다시 검증하고 싶을 때
- 사람 리뷰 전에 기계적인 1차 품질 게이트를 두고 싶을 때
- LangSmith offline eval 이전에 런타임 자기검토 루프를 넣고 싶을 때

반대로 단순 Q&A처럼 한 번 답하면 끝나는 작업에는 과하다. grader 모델 호출이 추가되므로 비용과 지연이 늘어난다.

## 사전 준비

공식 quickstart와 Deep Agents 문서 흐름을 기준으로 보면 최소 준비는 아래 정도다.

```bash
python -m venv .venv
source .venv/bin/activate

pip install -U langchain deepagents langchain-openai
```

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1

pip install -U langchain deepagents langchain-openai
$env:OPENAI_API_KEY="your-api-key"
```

`RubricMiddleware` 예제는 보통 `create_deep_agent(...)`와 checkpointer를 함께 쓴다. rubric을 같은 thread에 유지하거나 중간 상태를 이어가려면 checkpointer가 사실상 기본이라고 보는 편이 안전하다.

## 1. 가장 작은 RubricMiddleware 예제

공식 문서의 기본 패턴은 간단하다. `create_deep_agent(...)`에 `RubricMiddleware`를 붙이고, 실행할 때 `rubric` 문자열을 state에 넣는다.

```python
from deepagents import RubricMiddleware, create_deep_agent
from langchain.messages import HumanMessage
from langgraph.checkpoint.memory import InMemorySaver


agent = create_deep_agent(
    model="openai:gpt-5.5",
    middleware=[
        RubricMiddleware(
            model="openai:gpt-5.5",
            max_iterations=3,
        ),
    ],
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": "rubric-demo"}}

result = agent.invoke(
    {
        "messages": [HumanMessage("봄을 주제로 짧은 하이쿠를 써 줘.")],
        "rubric": (
            "- 답변은 정확히 세 줄이다\n"
            "- 5-7-5 리듬을 따른다\n"
            "- 봄의 분위기가 드러난다"
        ),
    },
    config=config,
)

print(result["messages"][-1].content)
```

핵심은 네 가지다.

- 작업용 모델과 grader 모델을 분리할 수 있다.
- rubric은 agent 생성 시점이 아니라 invocation state에서 넣는다.
- grader가 `needs_revision`을 내리면 같은 thread 안에서 다시 수정 루프가 돈다.
- `max_iterations`에 도달하면 더 이상 무한 재시도하지 않는다.

## 2. 실무형 패턴: grader에게 테스트 도구를 준다

공식 rubric 문서에서 가장 실전적인 포인트는 grader가 추상적으로만 판단하지 않게 하는 것이다. grader에게 테스트용 tool을 주면 "말로만 그럴듯한 결과"보다 "실제로 검증한 결과"를 기준으로 판정할 수 있다.

아래 예시는 생성된 Python 코드 안에 `find_duplicates` 함수가 들어 있는지 확인하고, 몇 개의 케이스를 직접 실행해 grader가 판단 재료로 쓰게 하는 패턴이다.

```python
from deepagents import RubricMiddleware, create_deep_agent
from langchain.messages import HumanMessage
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver


@tool
def run_test_suite(code: str) -> dict:
    """생성된 Python 코드가 요구사항을 만족하는지 간단한 테스트를 돌린다."""
    namespace = {"__builtins__": __builtins__}

    try:
        exec(code, namespace)
    except Exception as exc:
        return {"ok": False, "failures": [f"코드 실행 실패: {exc}"]}

    find_duplicates = namespace.get("find_duplicates")
    if find_duplicates is None:
        return {"ok": False, "failures": ["find_duplicates 함수가 없습니다."]}

    tests = [
        ("basic", [1, 2, 2, 3, 1], [2, 1]),
        ("empty", [], []),
        ("no_duplicates", [1, 2, 3], []),
    ]

    failures = []
    for name, items, expected in tests:
        try:
            actual = find_duplicates(items)
            if actual != expected:
                failures.append(f"{name}: expected {expected}, got {actual}")
        except Exception as exc:
            failures.append(f"{name}: {exc}")

    return {"ok": not failures, "failures": failures}


agent = create_deep_agent(
    model="openai:gpt-5.5",
    middleware=[
        RubricMiddleware(
            model="openai:gpt-5.5",
            tools=[run_test_suite],
            max_iterations=4,
            system_prompt=(
                "너는 생성된 코드를 rubric 기준으로 검토하는 grader다. "
                "필요하면 run_test_suite 도구를 먼저 호출하고 판정하라."
            ),
        )
    ],
    checkpointer=InMemorySaver(),
)

config = {"configurable": {"thread_id": "code-rubric-demo"}}

result = agent.invoke(
    {
        "messages": [
            HumanMessage(
                "중복 원소만 반환하는 Python 함수 find_duplicates를 작성해 줘."
            )
        ],
        "rubric": (
            "- 답변에는 find_duplicates 함수가 포함된다\n"
            "- 빈 리스트에서도 동작한다\n"
            "- 중복이 없는 입력에서는 빈 리스트를 반환한다\n"
            "- 기본 테스트를 통과한다"
        ),
    },
    config=config,
)

print(result["messages"][-1].content)
```

이 패턴의 장점은 분명하다.

- grader가 막연히 "좋아 보인다"고 끝내지 않는다.
- 실패 이유가 tool 결과로 남아 다음 수정 루프에 반영된다.
- 코드, 템플릿, 보고서처럼 명시 기준이 있는 작업에 잘 맞는다.

## 3. iteration 로그를 직접 받아 보기

rubric 루프가 실제로 몇 번 돌았는지 보려면 `on_evaluation` 콜백을 붙이는 방법이 가장 단순하다. 공식 문서 기준으로 이 콜백은 각 grader pass 뒤에 `RubricEvaluation` 딕셔너리를 받는다.

```python
from deepagents import RubricMiddleware, create_deep_agent
from deepagents.middleware.rubric import RubricEvaluation


def log_evaluation(ev: RubricEvaluation) -> None:
    print(f"iteration={ev['iteration']} result={ev['result']}")
    print(ev["explanation"])


agent = create_deep_agent(
    model="openai:gpt-5.5",
    middleware=[
        RubricMiddleware(
            model="openai:gpt-5.5",
            on_evaluation=log_evaluation,
            max_iterations=3,
        )
    ],
)
```

로컬 디버깅에서는 이 콜백이면 충분하고, UI까지 붙일 때는 `stream_events(..., version="v3")`와 `CustomTransformer`로 `stream.custom` 이벤트를 받는 방식이 더 좋다.

## 4. 같은 rubric을 다음 호출에도 이어가려면

공식 문서 기준으로 한 번의 `invoke()`는 terminal verdict가 날 때까지 rubric 루프를 끝까지 돈다. 그런데 checkpointer와 같은 `thread_id`를 유지하면 같은 rubric을 후속 호출에도 이어갈 수 있다.

이 점은 아래처럼 유용하다.

- 긴 문서 초안을 여러 턴에 걸쳐 다듬기
- 중간에 사람이 피드백을 추가하고 다시 같은 합격 기준으로 재검토하기
- 취소 후 재개했을 때 rubric 상태를 이어가기

반대로 새 기준으로 다시 채점하고 싶다면 다음 호출에서 새 `rubric` 문자열을 명시적으로 넘기는 편이 안전하다.

## 자주 막히는 포인트

### 1. rubric을 agent 생성 시점에 고정하려고 한다

`RubricMiddleware`는 middleware로 붙이되, 실제 채점 기준은 invocation state의 `rubric`으로 넣는다. 이걸 뒤집으면 재사용성이 크게 떨어진다.

### 2. grader 모델을 너무 비싸게 잡는다

공식 문서도 grader 모델은 작업 모델보다 더 작거나 저렴한 모델을 쓰는 경우를 전제로 설명한다. grader가 매 iteration마다 추가 호출되므로 비용 차이가 금방 커진다.

### 3. 테스트 가능한 작업인데 grader에게 도구를 안 준다

코드 생성, 표 형식 검증, 파일 검사처럼 확인 가능한 작업은 추상적 판단보다 tool 기반 검증이 훨씬 안정적이다.

### 4. `max_iterations_reached`와 `needs_revision`을 혼동한다

문서 기준으로 마지막 grader pass가 `needs_revision`이어도, 전체 런이 iteration cap 때문에 끝났다면 terminal 상태는 `max_iterations_reached`일 수 있다. 운영 코드에서는 최종 메시지만 보지 말고 상태를 함께 확인해야 한다.

### 5. 일반 agent 작업에 무조건 붙인다

rubric loop는 강력하지만 항상 공짜는 아니다. 기준이 애매한 작업에 쓰면 비용만 늘고 품질 이득은 크지 않을 수 있다.

## 추천 적용 순서

개인적으로는 아래 순서가 가장 안전하다.

1. rubric 없이 기본 deep agent 결과 품질을 먼저 본다.
2. 실패 기준이 분명한 작업에만 rubric을 붙인다.
3. 가능하면 grader에 검증용 tool을 하나 준다.
4. `on_evaluation`이나 streaming 이벤트로 실제 재시도 횟수를 기록한다.
5. 이후 LangSmith 평가셋으로 offline eval을 따로 만든다.

이렇게 하면 runtime 자기검토와 offline 평가를 역할별로 분리할 수 있다.

## 참고 자료

- [LangChain Deep Agents rubric docs](https://docs.langchain.com/oss/python/deepagents/rubric)
- [LangChain Deep Agents customization docs](https://docs.langchain.com/oss/python/deepagents/customization)
- [LangChain Python quickstart](https://docs.langchain.com/oss/python/langchain/quickstart)
