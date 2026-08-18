---
title: "LangSmith trajectory evaluator로 agent 실행 경로 평가하기"
description: "최종 답변만 보지 않고 agent의 node와 tool 호출 순서를 수집해 trajectory, final response, single-step 평가를 분리하는 실전 노트"
date: 2026-08-18
tags:
  - langsmith
  - evaluation
  - agents
  - python
aliases:
  - "/blog/langsmith-agent-trajectory-evaluation"
---

# LangSmith trajectory evaluator로 agent 실행 경로 평가하기

agent가 정답을 냈다는 사실만으로 실행이 안전했다고 말하기는 어렵다. 불필요한 검색을 여러 번 했거나, 쓰기 tool을 먼저 호출한 뒤 우연히 답을 맞혔을 수도 있다. 반대로 최종 답은 조금 부족해도 올바른 도구 경로 대부분을 수행했다면 개선 지점이 비교적 명확하다.

이럴 때 평가는 세 층으로 나누는 편이 좋다.

1. **final response**: 최종 답변이 정확한가
2. **trajectory**: 기대한 node와 tool 호출 경로를 밟았는가
3. **single step**: router나 첫 tool 선택처럼 중요한 한 단계를 올바르게 골랐는가

LangSmith의 `evaluate()` / `aevaluate()`는 target이 반환한 임의의 구조를 evaluator에 전달하므로, target에서 실행 경로를 `trajectory` 배열로 반환하면 별도 제품 기능에 종속되지 않고 경로 점수를 기록할 수 있다.

## 사전 준비

```bash
pip install -U langsmith
```

PowerShell 환경 변수 예시:

```powershell
$env:LANGSMITH_API_KEY="lsv2_your_key"
```

dataset example은 질문뿐 아니라 기대 경로도 reference output에 포함해야 한다.

```python
from langsmith import Client

client = Client()
dataset_name = "support-agent-trajectory"

if not client.has_dataset(dataset_name=dataset_name):
    dataset = client.create_dataset(dataset_name=dataset_name)
    client.create_examples(
        dataset_id=dataset.id,
        examples=[
            {
                "inputs": {"question": "주문 42의 배송 상태를 알려줘"},
                "outputs": {
                    "answer_contains": "배송",
                    "trajectory": ["intent_router", "lookup_order"],
                },
            },
            {
                "inputs": {"question": "환불 정책이 뭐야?"},
                "outputs": {
                    "answer_contains": "환불",
                    "trajectory": ["intent_router", "search_policy"],
                },
            },
        ],
    )
```

## 1. target이 답변과 실행 경로를 함께 반환하게 만든다

framework와 무관하게 evaluator가 받을 계약은 단순하다.

```python
def run_agent(inputs: dict) -> dict:
    question = inputs["question"]
    trajectory = ["intent_router"]

    if "주문" in question:
        trajectory.append("lookup_order")
        answer = "주문 42는 배송 중입니다."
    else:
        trajectory.append("search_policy")
        answer = "환불은 구매 후 7일 이내 신청할 수 있습니다."

    return {"response": answer, "trajectory": trajectory}
```

실제 LangGraph agent라면 `astream(..., stream_mode="debug", subgraphs=True)`에서 task 진입 node를 모으고, tool node 입력의 `AIMessage.tool_calls`에서 tool 이름을 추가할 수 있다. 다만 debug event의 payload 구조를 애플리케이션 계약처럼 고정해서는 안 된다. LangGraph 버전을 고정하고 실제 event fixture로 수집 코드를 테스트하는 편이 안전하다.

## 2. 정확 일치보다 subsequence 점수가 실용적인 경우가 많다

관측용 node나 캐시 조회가 중간에 추가돼도 핵심 경로는 맞을 수 있다. 기대 경로가 실제 경로 안에 같은 순서로 나타나는지를 계산하면 이런 보조 단계를 허용할 수 있다.

```python
def trajectory_subsequence(outputs: dict, reference_outputs: dict) -> dict:
    expected = reference_outputs["trajectory"]
    actual = outputs["trajectory"]

    if not expected:
        score = 1.0
    else:
        matched = 0
        for step in actual:
            if matched < len(expected) and step == expected[matched]:
                matched += 1
        score = matched / len(expected)

    return {
        "key": "trajectory_subsequence",
        "score": score,
        "comment": f"expected={expected}, actual={actual}",
    }
```

예를 들어 기대 경로가 `intent_router → lookup_order`이고 실제 경로가 `intent_router → cache_check → lookup_order`라면 1.0이다. 반면 순서가 뒤집히거나 `lookup_order`를 호출하지 않으면 감점된다.

subsequence만으로는 중복 호출을 벌점 처리하지 않는다. tool loop 비용까지 보고 싶다면 별도 evaluator를 둔다.

```python
def no_excessive_steps(outputs: dict) -> dict:
    steps = len(outputs["trajectory"])
    return {
        "key": "step_budget",
        "score": 1 if steps <= 4 else 0,
        "comment": f"steps={steps}, limit=4",
    }
```

## 3. 최종 답변 평가와 같은 experiment에서 함께 실행한다

```python
def final_answer_contains(outputs: dict, reference_outputs: dict) -> dict:
    keyword = reference_outputs["answer_contains"]
    return {
        "key": "answer_contains",
        "score": int(keyword in outputs["response"]),
    }


results = client.evaluate(
    run_agent,
    data=dataset_name,
    evaluators=[
        final_answer_contains,
        trajectory_subsequence,
        no_excessive_steps,
    ],
    experiment_prefix="support-agent-path-v1",
    max_concurrency=4,
)

print(results.to_pandas())
```

이제 답변 점수는 통과했지만 trajectory 점수가 낮은 example만 따로 찾아 "우연히 맞은 실행"을 점검할 수 있다. 반대로 trajectory는 맞고 답변만 틀렸다면 tool 결과 해석이나 응답 생성 단계를 먼저 의심할 수 있다.

## 4. 중요한 router는 single-step dataset으로 따로 압박한다

end-to-end 평가는 원인을 여러 단계에 걸쳐 섞는다. 결제·환불·개인정보 처리처럼 잘못된 route의 비용이 큰 경우에는 router만 직접 호출하는 dataset을 별도로 만든다.

```python
def route_once(inputs: dict) -> dict:
    text = inputs["message"]
    if "환불" in text:
        return {"route": "refund_agent"}
    return {"route": "question_answering_agent"}


def route_correct(outputs: dict, reference_outputs: dict) -> bool:
    return outputs["route"] == reference_outputs["route"]
```

LangGraph를 쓴다면 compile된 graph 전체를 실행하지 않고 해당 node를 직접 `graph.nodes["intent_classifier"].invoke(inputs)`해 route 결과만 평가할 수 있다. 이 dataset에는 경계 표현, 긴 대화 뒤의 의도 전환, 공격적 prompt 같은 실패하기 쉬운 입력을 집중시킨다.

## trajectory 표현을 먼저 표준화한다

같은 동작도 수집 방식에 따라 이름이 흔들리면 비교가 어렵다. 팀에서 다음 계약을 미리 정하는 것이 좋다.

- node는 graph의 안정적인 node name을 사용한다
- tool은 등록된 tool name을 사용한다
- retry는 같은 이름을 반복해 남긴다
- subgraph는 필요하면 `subgraph/node`처럼 namespace를 포함한다
- 모델 내부 chain이나 관측용 callback은 경로에서 제외한다

경로가 너무 상세하면 리팩터링마다 reference가 깨지고, 너무 거칠면 위험한 tool 순서를 잡지 못한다. 평가 목적에 직접 필요한 의미 단계만 남기는 것이 핵심이다.

## 자주 틀리는 점

### 1. trajectory 점수 하나로 품질을 결론낸다

기대 경로 자체가 틀릴 수 있고, 같은 정답에 여러 유효 경로가 있을 수 있다. final response와 안전성 evaluator를 함께 본다.

### 2. exact match만 사용한다

캐시, retry, observability node가 추가되면 의미상 같은 경로도 실패한다. 엄격한 순서가 요구될 때만 exact match를 쓰고, 일반 경로에는 subsequence나 set 기반 점수를 검토한다.

### 3. 실제 결제 tool을 evaluation에서 실행한다

평가 target은 test 환경과 sandbox를 사용해야 한다. 쓰기 tool은 fake 구현으로 교체하고 실제 부작용이 없음을 확인한다.

### 4. 빈 기대 경로와 중복 호출을 정의하지 않는다

빈 reference를 1점으로 볼지, 평가 제외로 볼지 정해야 한다. subsequence 점수는 반복 호출을 자동으로 벌주지 않으므로 step budget evaluator를 별도로 둔다.

### 5. framework debug event를 영구 스키마로 간주한다

event payload는 버전에 따라 달라질 수 있다. dependency를 고정하고 수집기를 작은 단위 테스트로 보호한다.

## 운영 체크리스트

1. 답변, trajectory, single-step 평가를 분리했는가
2. node와 tool 이름의 표준을 정했는가
3. 여러 유효 경로와 보조 node를 허용할 기준이 있는가
4. 위험한 tool은 평가 환경에서 mock 처리했는가
5. 경로 점수와 step budget을 함께 보는가

agent 평가는 "정답인가"에서 끝나지 않는다. **어떤 경로로 정답에 도달했는가**를 별도 신호로 남겨야 회귀 원인을 빠르게 찾고, 불필요하거나 위험한 tool 사용도 배포 전에 잡을 수 있다.

## 참고 자료

- [Evaluate a complex agent](https://docs.langchain.com/langsmith/evaluate-complex-agent)
- [Evaluation concepts](https://docs.langchain.com/langsmith/evaluation-concepts)
- [How to compare experiment results](https://docs.langchain.com/langsmith/compare-experiment-results)
- [How to define an evaluator](https://docs.langchain.com/langsmith/code-evaluator)
