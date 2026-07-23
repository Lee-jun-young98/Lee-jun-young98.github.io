---
title: "LangGraph 그래프를 Mermaid와 PNG로 시각화하기"
description: "CompiledStateGraph의 get_graph(), draw_mermaid(), draw_mermaid_png()로 실행 구조를 문서화하고 조건부 edge가 과도하게 표시되는 문제를 피하는 방법"
date: 2026-07-24
tags:
  - langgraph
  - python
  - visualization
  - debugging
aliases:
  - "/blog/langgraph-graph-visualization-mermaid-png"
---

# LangGraph 그래프를 Mermaid와 PNG로 시각화하기

LangGraph workflow가 커지면 코드만 보고 분기와 합류 지점을 확인하기 어렵다. 컴파일된 graph의 `get_graph()`를 사용하면 실행하지 않고도 구조를 Mermaid 문자열이나 PNG로 내보낼 수 있다.

시각화는 예쁜 문서 그림을 만드는 기능에 그치지 않는다. 조건부 edge가 의도한 node만 가리키는지, 종료 경로가 빠지지 않았는지, fan-out 뒤의 합류가 맞는지를 PR에서 빠르게 검토하는 실행 구조 테스트로 쓸 수 있다.

## 사전 준비

```bash
python -m venv .venv
source .venv/bin/activate
pip install -U langgraph
```

PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -U langgraph
```

Mermaid 문자열 생성에는 별도 패키지나 네트워크가 필요 없다. PNG 생성 방식에 따라 인터넷 연결 또는 브라우저 패키지가 추가로 필요하다.

## 1. 실행 가능한 분기 graph를 만든다

아래 예제는 외부 LLM 없이 그대로 실행할 수 있다. 점수에 따라 승인 또는 재검토 node로 이동한다.

```python
from typing import Literal
from typing_extensions import TypedDict

from langgraph.graph import END, START, StateGraph


class ReviewState(TypedDict):
    score: int
    decision: str


def classify(state: ReviewState):
    return {}


def route_review(state: ReviewState) -> Literal["approve", "revise"]:
    return "approve" if state["score"] >= 80 else "revise"


def approve(state: ReviewState):
    return {"decision": "approved"}


def revise(state: ReviewState):
    return {"decision": "needs revision"}


builder = StateGraph(ReviewState)
builder.add_node("classify", classify)
builder.add_node("approve", approve)
builder.add_node("revise", revise)
builder.add_edge(START, "classify")
builder.add_conditional_edges("classify", route_review)
builder.add_edge("approve", END)
builder.add_edge("revise", END)

graph = builder.compile()

assert graph.invoke({"score": 91, "decision": ""})["decision"] == "approved"
assert graph.invoke({"score": 55, "decision": ""})["decision"] == "needs revision"
```

`StateGraph` builder가 아니라 `compile()` 결과에서 `get_graph()`를 호출한다. 시각화 대상은 실제로 실행할 compiled graph이므로 문서와 런타임 구조의 차이를 줄일 수 있다.

## 2. Mermaid 문자열을 파일로 저장한다

위 예제 아래에 다음 코드를 붙인다.

```python
from pathlib import Path

mermaid = graph.get_graph().draw_mermaid()
Path("review-workflow.mmd").write_text(mermaid, encoding="utf-8")
print(mermaid)
```

생성된 `.mmd` 파일은 Mermaid Live Editor, Mermaid CLI, Mermaid를 지원하는 Markdown 문서나 저장소에서 렌더링할 수 있다. 텍스트 형식이라 diff가 가능하므로 자동 생성한 그림 바이너리만 커밋하는 것보다 구조 변경을 리뷰하기 쉽다.

간단한 smoke test도 추가할 수 있다.

```python
assert "classify" in mermaid
assert "approve" in mermaid
assert "revise" in mermaid
```

이 테스트는 graph의 의미 전체를 증명하지는 않지만 node 등록 누락이나 이름 변경을 빠르게 감지한다.

## 3. 조건부 edge가 모든 node로 뻗는 문제를 막는다

라우팅 함수의 반환 타입이 단순 `str`이면 renderer는 가능한 목적지를 알 수 없다. 이때 graph 그림에서 조건부 edge가 모든 node로 연결된 것처럼 보일 수 있다.

가장 간단한 방법은 예제처럼 반환 타입을 `Literal`로 제한하는 것이다.

```python
def route_review(state: ReviewState) -> Literal["approve", "revise"]:
    ...
```

라우팅 결과와 실제 node 이름을 분리하고 싶다면 `path_map`을 명시한다.

```python
def route_review(state: ReviewState) -> Literal["pass", "retry"]:
    return "pass" if state["score"] >= 80 else "retry"


builder.add_conditional_edges(
    "classify",
    route_review,
    {
        "pass": "approve",
        "retry": "revise",
    },
)
```

`Literal`과 `path_map`은 그림만 고치는 장식이 아니다. 라우터가 낼 수 있는 값과 graph가 받아들이는 목적지의 계약을 코드에 남긴다.

## 4. PNG로 내보낸다

기본 `draw_mermaid_png()`는 Mermaid.Ink API를 사용하므로 인터넷 연결이 필요하다.

```python
graph.get_graph().draw_mermaid_png(
    output_file_path="review-workflow.png",
)
```

CI가 외부 API 호출을 허용하지 않거나 재현 가능한 로컬 렌더링이 필요하면 Pyppeteer 방식을 선택할 수 있다.

```bash
pip install -U pyppeteer
```

```python
from langchain_core.runnables.graph import MermaidDrawMethod

graph.get_graph().draw_mermaid_png(
    draw_method=MermaidDrawMethod.PYPPETEER,
    output_file_path="review-workflow.png",
    background_color="white",
    padding=10,
)
```

Pyppeteer는 최초 실행 때 Chromium을 내려받을 수 있다. 빌드 시간과 cache 용량을 고려해야 한다. 문서에 이미지가 꼭 필요하지 않다면 CI에서는 `.mmd`만 생성·검증하고 PNG는 릴리스 단계에서 만드는 편이 단순하다.

Graphviz 기반 `draw_png()`도 있지만 Python 패키지 외에 시스템의 Graphviz/pygraphviz 설치가 필요할 수 있어 컨테이너와 로컬 환경의 native dependency 차이를 점검해야 한다.

## 5. subgraph 내부까지 보고 싶을 때

기본 `get_graph()`는 상위 graph 중심으로 보여 준다. subgraph를 펼쳐서 검사하려면 `xray=True`를 전달한다.

```python
expanded = graph.get_graph(xray=True)
Path("review-workflow-expanded.mmd").write_text(
    expanded.draw_mermaid(),
    encoding="utf-8",
)
```

subgraph가 많으면 전체 그림이 오히려 읽기 어려워진다. 상위 구조 문서에는 기본 그림을 쓰고, 디버깅용 artifact에만 expanded 그림을 남기는 방식이 실용적이다.

## 자주 놓치는 함정

### 1. 시각화된 edge가 실제 실행 규칙을 바꾸지는 않는다

`destinations`와 일부 type hint는 renderer가 가능한 경로를 이해하도록 돕는다. 그것만 추가해도 runtime route가 생긴다고 생각하면 안 된다. 실제 제어 흐름은 `add_edge()`, `add_conditional_edges()`, `Command(goto=...)`가 결정한다.

### 2. PNG byte와 파일 경로 사용법을 섞지 않는다

`output_file_path`를 생략하면 `draw_mermaid_png()`는 PNG bytes를 반환하므로 Notebook의 `Image(...)`에 바로 넣을 수 있다. 파일을 남기려면 경로를 명시하고, 이후 로직이 반환값에 의존하지 않게 한다.

### 3. Mermaid.Ink 장애를 graph 오류로 오해하지 않는다

기본 PNG 렌더링 실패는 graph compile 실패가 아니라 네트워크, API rate limit, proxy 문제일 수 있다. 먼저 `draw_mermaid()`가 정상 문자열을 만드는지 확인해 graph 구조 문제와 renderer 문제를 분리한다.

### 4. 그림 snapshot만으로 동작 테스트를 대신하지 않는다

그림은 가능한 경로를 보여 주지만 state 값별로 어떤 경로가 선택되는지는 보장하지 않는다. 예제의 두 `invoke()` assertion처럼 주요 분기별 실행 테스트를 함께 둔다.

## 실무 적용 체크리스트

1. compiled graph에서 `get_graph()`를 호출한다.
2. 조건부 router에 `Literal` 반환 타입 또는 `path_map`을 지정한다.
3. PR에서는 diff 가능한 Mermaid 원문을 우선 artifact로 남긴다.
4. PNG renderer의 네트워크·브라우저·native dependency를 CI 정책에 맞게 고른다.
5. subgraph 펼치기는 디버깅 목적일 때만 `xray=True`로 사용한다.
6. 시각화 snapshot과 주요 라우팅 실행 테스트를 함께 유지한다.

## 참고 자료

- [LangGraph Graph API: Visualize your graph](https://docs.langchain.com/oss/python/langgraph/use-graph-api#visualize-your-graph)
- [LangGraph Graph API overview](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [StateGraph.add_conditional_edges API reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_conditional_edges)
- [StateGraph.add_node API reference](https://reference.langchain.com/python/langgraph/graph/state/StateGraph/add_node)
