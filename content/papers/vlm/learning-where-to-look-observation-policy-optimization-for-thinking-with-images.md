---
title: "Learning Where to Look: Observation Policy Optimization for Thinking with Images"
date: 2026-11-04
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "NeurIPS 2026"
authors: "Junfeng Wang, Jiawei Liu, Yongchao Xu, Tao Jiang, Jiangbo Ai, Jin Zhang, Chong Wang, Qixing Zhang"
paper: "https://arxiv.org/abs/2611.04943"
code: "https://github.com/Yann0122/Observation-Policy-Optimization"
project: "https://github.com/Yann0122/Observation-Policy-Optimization"
thumbnail: "/papers/assets/vlm/learning-where-to-look-observation-policy-optimization-for-thinking-with-images/opo-training-pipeline.svg"
---

# 한 줄 요약

OPO는 VLM이 불확실한 zoom-in 결정을 만날 때 같은 reasoning prefix에서 서로 다른 crop을 분기하고, crop의 증거 충분성 보상을 해당 bounding-box token에만 귀속해 Qwen3-VL-2B의 V*/HR-Bench 4K/8K 정확도를 각각 +10.0/+12.4/+15.8%p 높인다.

# 논문 정보

- 제목: Learning Where to Look: Observation Policy Optimization for Thinking with Images
- 저자: Junfeng Wang, Jiawei Liu, Yongchao Xu, Tao Jiang, Jiangbo Ai, Jin Zhang, Chong Wang, Qixing Zhang
- 발표: NeurIPS 2026, arXiv:2611.04943v1 (2026-11-03 제출, 2026-11-04 공개 배치)
- 링크: [arXiv 초록](https://arxiv.org/abs/2611.04943), [HTML](https://arxiv.org/html/2611.04943), [PDF](https://arxiv.org/pdf/2611.04943)
- 코드/모델/데이터: [공식 저장소](https://github.com/Yann0122/Observation-Policy-Optimization), [OPO-8B 모델](https://huggingface.co/Yann0122/OPO-8B), [DeepEyes-Datasets-47k](https://huggingface.co/datasets/ChenShawn/DeepEyes-Datasets-47k). 확인 시점에 저장소의 학습·평가 코드는 아직 공개 예정 상태다.
- 키워드: thinking with images, visual tool use, observation policy, high-resolution VQA, agentic RL, GRPO

# 핵심 아이디어

고해상도 VQA에서 모델은 전체 이미지만 보고 답하기보다 필요한 영역을 찾아 zoom-in해야 한다. 그런데 최종 정답 reward만 쓰면, 좋은 crop을 얻고도 뒤의 reasoning이 틀린 trajectory는 벌을 받고 엉뚱한 crop 뒤 우연히 정답을 맞힌 trajectory는 보상을 받는다. OPO는 이 **관찰 행동과 최종 결과 사이의 credit mismatch**를 두 단계로 줄인다.

1. **UOB(Uncertainty-Guided Observation Branching)**은 각 zoom-in tool call을 observation event로 보고 bounding-box token의 entropy가 높은 event에 rollout 예산을 더 배분한다.
2. 같은 pre-tool reasoning prefix에서 suffix만 다시 sampling해 서로 다른 crop을 만든다. 이미 뽑힌 crop과 IoU가 높은 후보는 제거해 제한된 예산으로 다양한 영역을 탐색한다.
3. **ELAA(Evidence-Localized Advantage Attribution)**는 sibling crop을 evidence-sufficiency judge로 비교하고, 그 local advantage를 image index·region label·bounding box token에만 준다.
4. 나머지 reasoning과 answer token은 기존처럼 정답·format·tool-use로 만든 global outcome advantage를 받는다.

논문의 사전 분석에서 bounding-box token entropy의 평균/중앙값은 0.522/0.501로 reasoning token의 0.229/0.225보다 두 배 이상 높다. 즉 모델이 “어디를 볼지” 정하는 순간에 불확실성이 집중되며, OPO는 그 지점에 exploration과 국소 보상을 함께 배치한다.

# VLM 관점에서 중요한 이유

- visual tool use를 단순히 “도구를 호출했는가”가 아니라 **어떤 시각 증거를 획득했는가**라는 policy-learning 문제로 바꾼다.
- 같은 prefix에서 crop만 달리한 sibling trajectory는 관찰 행동의 효과를 비교하기 좋은 통제군이다. 서로 다른 전체 trajectory를 비교할 때 섞이던 reasoning 차이를 줄인다.
- token-level mask로 local advantage를 observation-action token에만 적용해 perception action과 downstream reasoning의 학습 신호를 분리한다.
- 새로운 vision encoder나 별도 detector 없이 Qwen3-VL의 기존 zoom tool interface와 PPO objective를 유지한다. 바뀌는 것은 rollout 배분과 advantage 귀속 방식이다.
- 강한 32B·MoE 모델도 실패한 trajectory의 82.0%가 localization failure였다는 Appendix I 결과는, backbone scaling만으로 “어디를 볼지” 문제가 사라지지 않음을 보여 준다.

# Method

## 1. observation event와 불확실성

Qwen3-VL의 zoom-in call은 image index, region label, bounding box를 생성한다. OPO는 이를 observation-action token으로 정의한다. 각 질문에 총 rollout 예산 $M$을 두고 먼저 $B$개 base trajectory를 첫 유효 tool call까지 생성한다. 기본 설정은 $M=8$, $B=2$, 남은 branch/backfill 예산은 $P=6$이다.

event $e$의 bbox token entropy를 질문 내부 pre-action baseline과 비교해 정규화한 anomaly score $z(e)$를 계산한다. 점수가 높을수록 모델이 해당 관찰 위치에 유난히 불확실하다는 뜻이다. allocator는 높은 $z(e)$에 더 많은 child rollout을 배분한다.

## 2. UOB: 같은 prefix에서 다양한 crop 분기

child trajectory는 처음부터 다시 만들지 않는다. prompt와 pre-tool prefix를 고정하고 tool-call suffix부터 resampling한다. 후보 crop $c$가 기존 sibling crop과 겹치는 정도는 다음으로 측정한다.

$$
\mathrm{Red}(c\mid e)=\max_{c'\in\mathcal{C}_e}\mathrm{IoU}(b_c,b_{c'}).
$$

$\tau_{red}$보다 중복도가 높은 후보를 버리고, 통과한 tool call을 실제로 실행해 새 crop을 모델에 돌려준 뒤 multi-turn reasoning을 끝까지 진행한다. 목표 개수 $M$을 채우지 못하면 일반 rollout으로 backfill한다.

## 3. ELAA: 증거 보상을 관찰 token에만 귀속

최종 정답, 형식, tool-use quality로 global reward를 만든다.

$$
R_i^{global}=w_{acc}r_i^{acc}+w_{fmt}r_i^{fmt}+w_{tool}r_i^{tool}.
$$

동시에 vision-language judge가 질문과 crop을 보고 evidence sufficiency를 0/1로 판정한다. 같은 prefix를 공유하는 sibling group 안에서 이 점수를 정규화해 $A_{i,g}^{local}$을 만든다. observation-action token mask $m_{i,t}(g)$로 최종 token-level advantage를 결합한다.

$$
A_{i,t}=(1-m_{i,t}(g))A_i^{global}+m_{i,t}(g)\lambda_{local}A_{i,g}^{local}.
$$

따라서 bounding-box를 만든 token은 crop의 증거 품질로, 그 밖의 reasoning/answer token은 trajectory 결과로 학습된다. PPO objective 자체는 바꾸지 않는다.

# 핵심 그림

![이미지와 질문을 받은 VLM이 base rollout의 불확실한 zoom event를 찾고, 같은 reasoning prefix에서 중복되지 않는 crop을 분기한 뒤, local evidence advantage를 관찰 token에만 주고 global outcome advantage를 나머지 token에 주어 policy를 갱신하는 OPO 구조](/papers/assets/vlm/learning-where-to-look-observation-policy-optimization-for-thinking-with-images/opo-training-pipeline.svg)

> 그림 1. 원 논문 Figure 2와 Sections 4.1–4.2, Equations (3)–(11)을 바탕으로 재구성한 OPO 학습 파이프라인. 출처: [arXiv PDF Figure 2](https://arxiv.org/pdf/2611.04943#page=5), [arXiv HTML Method](https://arxiv.org/html/2611.04943#S4). 원본 그림을 복제하지 않고 논문 내용을 한국어로 다시 그린 재구성이다.

이 그림을 고른 이유는 OPO의 핵심이 model block을 새로 추가하는 데 있지 않고, **rollout-time 분기와 token-level advantage 귀속이 하나의 학습 loop로 연결되는 방식**에 있기 때문이다. 왼쪽에서 이미지·질문과 base rollout이 들어오고, UOB는 bbox token entropy가 높은 event를 선택한다. 가운데에서 reasoning prefix를 고정한 채 서로 다른 bbox를 resampling하고 IoU 중복 filter를 거쳐 sibling crop을 만든다.

오른쪽 ELAA에서는 각 crop의 증거 충분성을 sibling group 안에서 비교한다. 이 local advantage는 image index·region label·bbox token에만 적용되고, 최종 정답·형식·tool-use의 global advantage는 나머지 reasoning과 answer token을 담당한다. 학습 때에는 judge와 여러 branch가 필요하지만, 추론 때에는 학습된 VLM과 기존 zoom-in tool만 사용한다. outcome-level GRPO와 달라진 핵심은 “좋은 crop을 고른 행동”을 뒤의 reasoning 성공 여부와 분리해 직접 강화한다는 점이다.

# Experiments / Results

- Qwen3-VL-Instruct 2B와 8B를 8× NVIDIA H20에서 200 iteration 학습한다. batch는 64 prompt, prompt당 rollout은 8개이며 최대 5 assistant turn을 허용한다.
- 학습 데이터와 zoom-tool 형식은 DeepEyes와 맞춘다. 평가 benchmark는 V*와 HR-Bench 4K/8K이고, Table 1의 OPO 전후 비교는 같은 Qwen3-VL backbone에서 수행한다.
- Qwen3-VL-2B는 V* 75.9→85.9(+10.0%p), HR-Bench 4K 66.0→78.4(+12.4%p), 8K 60.6→76.4(+15.8%p)로 개선된다.
- Qwen3-VL-8B는 같은 순서로 88.0→92.7(+4.7%p), 81.4→85.5(+4.1%p), 76.5→80.8(+4.3%p)다.
- 동일 backbone·학습 budget·zoom-tool 조건으로 재학습한 DeepEyes-style outcome GRPO보다 OPO-2B는 V*/4K/8K 전체 정확도가 +3.2/+6.9/+5.3%p 높다. 일부 세부 task에서는 GRPO가 앞서므로 OPO가 모든 cell에서 우월하다는 뜻은 아니다.
- ablation에서 OPO-2B full은 85.9/78.4/76.4다. UOB와 ELAA를 모두 제거하면 82.7/71.5/71.1, ELAA만 제거하면 83.8/76.5/73.8로 낮아져 두 구성의 기여를 분리해 확인할 수 있다.

## 주요 실험 결과

Table 1의 동일 backbone 전후 비교다. 모든 값은 overall accuracy(%, ↑)이며 차이는 %p다.

| backbone / 벤치마크 (overall accuracy %, ↑) |  OPO | Base |    차이 | 출처    |
| ------------------------------------------- | ---: | ---: | ------: | ------- |
| Qwen3-VL-2B / V*                            | 85.9 | 75.9 | +10.0%p | Table 1 |
| Qwen3-VL-2B / HR-Bench 4K                   | 78.4 | 66.0 | +12.4%p | Table 1 |
| Qwen3-VL-2B / HR-Bench 8K                   | 76.4 | 60.6 | +15.8%p | Table 1 |
| Qwen3-VL-8B / V*                            | 92.7 | 88.0 |  +4.7%p | Table 1 |
| Qwen3-VL-8B / HR-Bench 4K                   | 85.5 | 81.4 |  +4.1%p | Table 1 |
| Qwen3-VL-8B / HR-Bench 8K                   | 80.8 | 76.5 |  +4.3%p | Table 1 |

2B의 향상 폭이 8B보다 크지만, OPO-8B도 HR-Bench 4K에서 Qwen3-VL-235B-A22B의 85.4%를 0.1%p 앞선다. 단, 모델별 tool 사용과 평가 보고 범위가 다르므로 이 cross-model 값은 동일 조건의 scaling law로 해석하면 안 된다.

Table 2는 같은 학습 조건에서 OPO와 outcome-level GRPO를 통제 비교한다.

| Qwen3-VL-2B / 벤치마크 (overall accuracy %, ↑) |  OPO | DeepEyes-style GRPO |   차이 | 출처    |
| ---------------------------------------------- | ---: | ------------------: | -----: | ------- |
| V*                                             | 85.9 |                82.7 | +3.2%p | Table 2 |
| HR-Bench 4K                                    | 78.4 |                71.5 | +6.9%p | Table 2 |
| HR-Bench 8K                                    | 76.4 |                71.1 | +5.3%p | Table 2 |

이 통제표가 핵심 주장에 더 직접적이다. tool 호출 자체와 final-answer reward만 강화하는 것보다, 같은 prefix에서 crop 대안을 탐색하고 증거 품질을 bbox token에 귀속하는 편이 세 benchmark 전체 정확도를 모두 높인다.

# Limitations / Discussion

- 현재 tool은 image zoom-in 하나다. OCR, detection, segmentation, search, code execution처럼 행동 공간과 결과 형식이 다른 tool에도 같은 local credit 구조가 통하는지는 검증되지 않았다.
- 학습·평가는 주로 Qwen3-VL-2B/8B에 한정된다. 더 강한 native multimodal model과 다른 architecture family에서의 확장성은 확인이 필요하다.
- evidence-sufficiency reward는 별도 VLM judge에 의존한다. judge가 중요한 증거를 놓치거나 그럴듯하지만 불충분한 crop을 승인하면 잘못된 local advantage가 observation token에 직접 주입될 수 있다.
- branch rollout은 같은 prefix에서 인과 비교에 가까운 sample을 만들지만, $M=8$ 기준으로 일반 rollout보다 학습 compute와 tool execution이 늘어난다. $M=16$은 8보다 정확도가 조금 높지만 비용도 더 크다.
- V*, HR-Bench는 fine-grained high-resolution perception에 적합하지만 document, chart, scientific image, 장시간 video처럼 다른 증거 획득 환경까지 대표하지 않는다.
- Table 2에서 OPO가 모든 세부 task를 이기지는 않는다. 예를 들어 Qwen3-VL-8B의 V* Spatial은 OPO 90.8%, GRPO 93.4%다. local evidence optimization이 전체 평균을 안정화해도 특정 reasoning subset의 trade-off는 남는다.
- 더 안정적인 관찰 능력은 접근성과 세밀한 분석에 유용하지만, surveillance나 privacy-invasive inspection에도 쓰일 수 있다. 저자도 evidence judge의 miscalibration이 과신을 키울 수 있음을 지적한다.

# 내가 이해한 핵심

OPO의 핵심은 reward를 하나 더 붙인 것이 아니라 **비교 가능한 trajectory를 먼저 만드는 sampling design**이다. 서로 다른 전체 rollout 두 개는 생각의 경로, tool 호출 시점, 답변 방식이 모두 달라 crop의 효과만 떼어 보기 어렵다. 반면 같은 pre-tool prefix에서 bbox만 다시 뽑은 sibling은 “어디를 봤는가”가 주요 차이가 된다. 그 다음에야 evidence judge 점수를 관찰 token에 귀속하는 것이 설득력을 갖는다.

또 하나 중요한 점은 모델의 불확실성을 무조건 answer confidence로 읽지 않는다는 것이다. 논문에서는 answer token entropy가 평균 0.006으로 거의 결정적인데도 bbox token entropy는 0.522다. 모델은 답을 확신하는 것처럼 보여도 실제로는 어디를 봐야 할지 매우 불확실할 수 있다. VLM calibration은 최종 답 확률만이 아니라 **증거 획득 action의 entropy와 crop sufficiency**를 함께 봐야 한다.

다음 단계에서는 zoom뿐 아니라 OCR·search·segmentation 중 어떤 tool을 언제 쓸지까지 branch하고, judge 하나의 0/1 판정 대신 detector confidence, OCR coverage, citation grounding처럼 tool-specific evidence signal을 결합할 수 있다. 추론 시에도 높은 observation entropy를 감지하면 추가 zoom budget을 주는 adaptive test-time policy로 이어질 가능성이 있다.

# 다음에 연결해서 읽을 논문

- [DeepEyes: Incentivizing “Thinking with Images” via Reinforcement Learning](https://arxiv.org/abs/2505.14362) — OPO가 같은 데이터와 zoom interface로 통제 비교하는 outcome-level GRPO 기준이다.
- [V*: Guided Visual Search as a Core Mechanism in Multimodal LLMs](https://arxiv.org/abs/2312.14135) — visual search와 V* benchmark의 출발점으로, 관찰 위치 선택이 왜 필요한지 이해할 수 있다.
- [CodeV: Code with Images for Faithful Visual Reasoning via Tool-Aware Policy Optimization](https://arxiv.org/abs/2511.19661) — crop이 아니라 code tool output의 evidence quality를 reward로 쓰는 인접 접근이다.
- [The Answer Knows Where to Look: Zooming before MLLMs Answer under Visual-Token Budgets](/papers/vlm/the-answer-knows-where-to-look-zooming-before-mllms-answer) — answer distribution으로 zoom region을 고르는 training-free 방식과 OPO의 학습형 observation policy를 비교할 수 있다.
