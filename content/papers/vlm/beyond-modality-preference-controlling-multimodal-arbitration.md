---
title: "Beyond Modality Preference: Controlling Multimodal Arbitration under Modality Conflict in MLLMs"
date: 2026-11-10
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "WACV 2027"
authors: "Zhaoying Pan, Shenyu Lu, Jun Hui Wong, Junyi Chai, Xiaoqian Wang"
paper: "https://arxiv.org/abs/2611.12883"
code: "https://github.com/zhaoyingpan/modality-arbitration"
project: ""
thumbnail: "/papers/assets/vlm/beyond-modality-preference-controlling-multimodal-arbitration/arbitration-head-steering.svg"
---

# 한 줄 요약

이미지와 텍스트가 충돌할 때 답을 어느 모달리티에 맞출지 좌우하는 소수의 attention head를 activation patching으로 찾고, 그 head의 attention logit만 조절해 재학습 없이 시각·텍스트 어느 쪽으로도 신뢰 우선순위를 전환한다.

# 논문 정보

- 제목: Beyond Modality Preference: Controlling Multimodal Arbitration under Modality Conflict in MLLMs
- 저자: Zhaoying Pan, Shenyu Lu, Jun Hui Wong, Junyi Chai, Xiaoqian Wang
- 발표: WACV 2027; arXiv:2611.12883v1, 2026-11-09 공개
- 링크: [arXiv](https://arxiv.org/abs/2611.12883), [공식 PDF](https://arxiv.org/pdf/2611.12883)
- 코드/프로젝트: [저자 공식 GitHub](https://github.com/zhaoyingpan/modality-arbitration) (MIT License)
- 키워드: MLLM, modality conflict, modality arbitration, activation patching, attention steering, inference-time intervention

# 핵심 아이디어

MLLM은 이미지와 텍스트가 같은 답을 지지할 때는 두 정보를 잘 결합하지만, 서로 다른 답을 지지하면 모델·과제·각 모달리티의 신뢰도에 따라 한쪽을 불안정하게 따른다. 저자들은 이를 단순한 고정 편향이 아니라 transformer 내부에서 **답 생성 직전의 근거 선택(arbitration)** 문제로 본다.

먼저 동일한 문항에 대해 이미지 전용, 텍스트 전용, 이미지–텍스트 충돌 입력을 만든다. 각 attention head의 출력을 단일 모달리티 실행에서 충돌 실행으로 패치했을 때 이미지 정답과 텍스트 정답의 log-probability margin이 양방향으로 얼마나 움직이는지 측정한다. 두 패치 방향에서 모두 일관된 인과 효과를 보이는 상위 head를 `arbitration heads`로 선택한다.

추론 시에는 이 head들에서 신뢰하도록 지정한 모달리티의 token attention logit에 양의 offset을, 경쟁 모달리티에는 음의 offset을 더한다. 전체 hidden state를 이동하거나 한 모달리티를 제거하지 않고, 두 입력을 보존한 채 근거의 상대적 attention만 바꾼다. 추가로 image-only와 text-only의 top-50 logit 분포 유사도로 충돌 강도를 추정해, 두 모달리티가 일치할 때는 개입을 줄이는 adaptive steering도 제시한다.

# VLM 관점에서 중요한 이유

기존 modality-preference 연구는 어느 쪽을 더 따르는지 측정하거나 hidden-state steering vector를 더하는 데 집중했다. 이 논문은 선호를 **소수 attention head의 인과적 제어점**으로 좁히고, 이미지 우선과 텍스트 우선을 같은 메커니즘으로 양방향 제어한다. Qwen3-VL-8B에서는 1,000개가 넘는 head 중 상위 30개만 사용하며, MC²의 10개 안팎 calibration sample로 찾은 head를 다른 conflict benchmark에도 그대로 적용한다.

실제 VLM 시스템에서는 어느 모달리티가 더 믿을 만한지가 과제에 따라 다르다. 의료 영상에서는 이미지가, 문서 질의에서는 최신 텍스트 근거가 우선일 수 있다. 이 방법은 모델이 스스로 진실한 모달리티를 판별한다고 주장하지 않고, 시스템이 지정한 신뢰 정책을 추론 시점에 반영한다는 점이 명확하다. 동시에 partial conflict에서 두 모달리티를 모두 활용해야 하는 더 어려운 문제는 남겨 둔다.

# Method

## 1. 충돌 입력과 answer logit margin

이미지 $x^v$, 텍스트 문맥 $x^t$, 질문 $q$에서 이미지가 지지하는 답 $y^v$와 텍스트가 지지하는 답 $y^t$가 다르면 modality conflict로 정의한다. 충돌 입력 $I_C$에서 선호 방향은 다음 margin으로 측정한다.

$$
\Delta(I_C)=\log p(y^v\mid I_C)-\log p(y^t\mid I_C)
$$

양수면 이미지 답, 음수면 텍스트 답을 더 선호한다. 이 지표는 단순 최종 정답뿐 아니라 개입 전후 선호가 얼마나 이동했는지를 연속적으로 측정한다.

## 2. activation patching으로 arbitration head 찾기

각 layer–head의 마지막 prompt position 출력을 이미지 전용 실행 $o_V^{(\ell,h)}$ 또는 텍스트 전용 실행 $o_T^{(\ell,h)}$에서 가져와 충돌 실행에 대입한다. 이미지 패치가 margin을 양의 방향으로, 텍스트 패치가 음의 방향으로 움직이는 효과를 각각 구한 뒤, 두 방향 중 작은 양의 효과를 calibration set에서 평균한다.

$$
C^{(\ell,h)}=\mathbb{E}_{I_C\sim\mathcal D}\left[\min_{m\in\{V,T\}}\operatorname{ReLU}\left(C_m^{(\ell,h)}\right)\right]
$$

한쪽 패치에서만 우연히 큰 head보다 양쪽 모달리티의 선택을 일관되게 바꾸는 head가 높은 점수를 얻는다. 논문은 상위 효과 head의 위치가 calibration sample 수가 적어도 비교적 안정적임을 Figure 2에서 보인다.

## 3. 선택된 head의 attention logit만 양방향 중재

상위 $k$개 head의 영향도를 정규화한 $\hat c^{(\ell,h)}$로 가중하고, target modality token 집합 $T_m$에는 $+\alpha\hat c$, 경쟁 집합 $T_{\bar m}$에는 $-\alpha\hat c$를 pre-softmax attention score에 더한다.

$$
\tilde a_{i,j}^{(\ell,h)}=a_{i,j}^{(\ell,h)}+\alpha\hat c^{(\ell,h)}\left(\mathbb{I}[j\in T_m]-\mathbb{I}[j\in T_{\bar m}]\right)
$$

개입은 prefill과 autoregressive decoding 모두에 적용하고 생성된 token은 중립 key로 둔다. 주 실험은 $k=30$, $\alpha=30$을 사용한다. 경쟁 모달리티를 완전히 masking하지 않으므로 aligned input의 보완 정보는 유지할 여지가 있다.

## 4. 충돌 강도에 따른 adaptive steering

image-only와 text-only 예측의 top-50 token logit 합집합을 정규화해 cosine similarity $s$를 구한다. calibration threshold $\tau$보다 유사도가 낮을수록 충돌이 강하다고 보고 다음처럼 개입 강도를 키운다.

$$
\alpha=\alpha_{\max}\,\sigma\left(\frac{\tau-s}{\lambda}\right)
$$

따라서 aligned input에서는 Base의 멀티모달 이점을 보존하고, conflict가 강할 때만 지정 모달리티 쪽으로 더 적극적으로 steering한다.

# 핵심 그림

![이미지·텍스트 충돌 입력에서 단일 모달리티 activation patching으로 arbitration head를 찾고, 선택된 head의 attention logit을 시각 또는 텍스트 방향으로 조절하는 전체 파이프라인](/papers/assets/vlm/beyond-modality-preference-controlling-multimodal-arbitration/arbitration-head-steering.svg)

_논문 내용을 바탕으로 재구성._ 출처: [공식 PDF](https://arxiv.org/pdf/2611.12883), Figure 1(전체 방법), Eqs. 1–7(선호 margin, head influence, attention intervention, adaptive strength), Figure 3(adaptive conflict detection). 원본 그림을 복사하지 않고 입력–localization–intervention–출력 흐름을 한국어로 다시 그렸다. 이 논문의 기여는 새 backbone보다 **충돌을 중재하는 head를 인과적으로 찾고 같은 지점에서 양방향 제어하는 절차**에 있으므로 결과 plot보다 전체 방법 파이프라인을 핵심 그림으로 골랐다.

왼쪽에서 동일 문항의 이미지 전용·텍스트 전용·충돌 입력을 각각 실행한다. 가운데의 activation patching은 단일 모달리티 head 출력을 충돌 실행에 넣고 $\Delta$의 변화를 측정해 상위 30개 arbitration head를 정한다. 추론 단계에서는 이 head에서 신뢰 대상 token의 attention logit을 올리고 경쟁 token은 낮춘다. 출력은 이미지 정답 쪽 또는 텍스트 정답 쪽으로 전환되며, adaptive gate는 두 단일 모달리티 예측이 충분히 다를 때만 $\alpha$를 크게 한다. 기존 MPS처럼 전체 residual representation을 이동하는 대신 근거 경쟁이 일어나는 attention head와 token group을 직접 제어하는 것이 핵심 차이다.

# Experiments / Results

- 모델: Qwen3-VL-8B, Qwen2.5-VL-7B, LLaVA-OneVision-7B, InternVL3-8B.
- conflict benchmark: MMCD, MC², CLASH, CorrelationQA. 시각 hallucination은 PhD-sec와 PhD-icc 각 1,000개 sample로 평가한다.
- 비교군: Base, CoT, VCD, conflict-aware prompting(CAP), hidden-state modality preference steering(MPS).
- 상위 30개 head를 MC²의 약 10개 calibration sample로 찾고 다른 benchmark에는 재탐색 없이 적용한다. Qwen3 공식 artifact는 filtering 후 12개 sample을 포함하며, 논문 본문은 일반 설정을 10개로 요약한다.
- Table 5에서 Qwen3-VL-8B/MC² 이미지 우선 정확도는 random head 47.50%, layer-matched random 54.75%, 모든 head 77.10%, 선택된 30개 head 79.50%다. 많이 개입하는 것보다 올바른 head를 선택하는 것이 중요하다.
- PhD-icc 이미지 우선 정확도는 제안법 70.20%로 VCD 69.60%보다 0.60%p 높다. 반대로 텍스트 우선으로 steering하면 이미지 정확도를 58.00%까지 낮춰 양방향 제어 가능성을 확인한다.

## 주요 실험 결과

아래 표는 공식 PDF Table 3의 Qwen3-VL-8B/MC² 결과를 동일 평가 설정끼리 옮긴 것이다. `Acc_v`와 `Acc_t`는 각각 이미지·텍스트가 지지하는 답과의 정확도(%, ↑)다. 각 방향의 비교 기준은 같은 입력·모델에서 양방향 제어를 지원하는 가장 강한 baseline 값이다. 성공률 차이는 절대 **%p**로 계산했다.

| 설정 / 지표 (%, ↑) | 제안법 | 가장 강한 양방향 baseline | 차이 | 출처 |
| --- | ---: | ---: | ---: | --- |
| Image-Primary, 이미지 정답 정확도 $Acc_v$ | **79.50** | CAP 61.10 | **+18.40%p** | Table 3 |
| Text-Primary, 텍스트 정답 정확도 $Acc_t$ | **86.75** | CAP 64.60 | **+22.15%p** | Table 3 |
| Image-Primary, 경쟁 텍스트 정답 정확도 $Acc_t$ (↓) | **5.25** | MPS 27.60 | **-22.35%p** | Table 3 |
| Text-Primary, 경쟁 이미지 정답 정확도 $Acc_v$ (↓) | **1.25** | CAP 24.90 | **-23.65%p** | Table 3 |

수치와 지표 방향은 [공식 PDF Table 3](https://arxiv.org/pdf/2611.12883)에서 직접 대조했다. Base는 방향별 steering을 지원하지 않아 image/text-primary의 직접 baseline으로 쓰지 않았다. 첫 두 행은 target modality를 더 따르는 정도, 뒤 두 행은 경쟁 modality의 답을 억제하는 정도를 보여준다. 특히 Qwen3-VL-8B의 기본 conflict 결과가 $Acc_v=47.25\%$, $Acc_t=42.20\%$였다는 점을 함께 보면, 제안법은 단순 소폭 보정보다 답의 지배 모달리티 자체를 전환한다.

다만 target accuracy만 높이는 것이 항상 task accuracy 향상을 뜻하지는 않는다. 이 평가는 어느 모달리티가 정답인지 외부에서 지정된 controlled conflict setting이다. 실제 배포에서는 신뢰 모달리티 정책이 틀리면 제어가 오히려 오류를 강화할 수 있다.

# Limitations / Discussion

- 신뢰할 모달리티는 시스템이 외부에서 올바르게 지정한다고 가정한다. 방법 자체가 어느 source가 사실인지 판별하지 않는다.
- benchmark는 대체로 이미지 답과 텍스트 답이 명확히 갈리는 단순 conflict다. 두 모달리티에 서로 다른 유용한 정보가 있고 일부만 충돌하는 경우에는 한쪽 우선 steering이 충분하지 않다.
- adaptive gate는 image-only/text-only forward와 top-logit 비교가 필요하므로 기본 멀티모달 추론보다 계산량이 늘어난다. 논문은 정확한 latency·memory overhead를 주 결과표에서 보고하지 않는다.
- head localization은 answer generation 직전 position과 특정 모델 family의 attention 구조에 의존한다. closed model이나 attention 구현이 다른 architecture에는 그대로 적용하기 어렵다.
- Qwen3 artifact가 12개 retained sample을 사용하는 등 본문의 “10개 sample” 요약과 공개 구현 세부가 완전히 같지는 않다. 재현 시 공식 artifact와 filtering 절차를 확인해야 한다.
- $\alpha=30$은 강한 logit 개입이며, benchmark 밖의 긴 자유 생성에서 문체·유창성·세부 근거가 얼마나 보존되는지는 충분히 평가되지 않았다.

# 내가 이해한 핵심

이 논문의 가장 설득력 있는 부분은 modality preference를 모델 전체의 막연한 성향으로 두지 않고, **서로 다른 근거가 마지막 답을 차지하도록 경쟁하는 작은 attention 경로**로 조작 가능하게 만든 점이다. activation patching은 “이 head가 이미지 token을 많이 본다”는 상관관계를 넘어, 단일 모달리티 실행의 head output을 넣었을 때 답 margin이 실제로 움직이는지 검사한다.

또한 양방향 평가가 중요하다. 이미지 accuracy만 올리는 방법은 visual grounding 강화일 수 있지만, 과제에 따라 텍스트가 더 신뢰할 만한 경우를 처리하지 못한다. 같은 head와 같은 식에서 token group의 부호만 바꿔 두 방향 모두 제어한다는 결과는 이 head들이 단순 visual head가 아니라 근거 중재에 관여한다는 해석을 지지한다.

실용적으로는 이 방법을 “진실 판별기”보다 **정책 집행기**로 이해해야 한다. 의료·자율주행·RAG처럼 source priority가 사전에 정해진 시스템에는 유용할 수 있지만, open-world agent가 어느 source를 믿어야 할지 모르는 경우에는 provenance, uncertainty calibration, external verifier가 먼저 필요하다. 다음 단계는 부분 충돌을 span/region 단위로 탐지하고, 질의의 각 하위 주장마다 다른 모달리티를 선택하는 세밀한 arbitration이다.

# 다음에 연결해서 읽을 논문

- [Evaluating and Steering Modality Preferences in Multimodal Large Language Models](https://arxiv.org/abs/2505.20977): 이 논문의 핵심 비교군 MPS가 hidden-state preference direction을 찾고 조절하는 방식과 attention-head 중재의 차이를 볼 수 있다.
- [When Modalities Conflict: How Unimodal Reasoning Uncertainty Governs Preference Dynamics in MLLMs](https://arxiv.org/abs/2511.02243): 모달리티 선호가 각 단일 모달리티의 상대적 uncertainty에 따라 바뀐다는 동역학을 연결한다.
- [Challenges in Understanding Modality Conflict in Vision-Language Models](https://arxiv.org/abs/2509.02805): conflict detection과 resolution이 내부에서 어떻게 분리되는지 비교할 수 있다.
- [CLASH: A Benchmark for Cross-Modal Contradiction Detection](https://arxiv.org/search/?query=CLASH%3A+A+Benchmark+for+Cross-Modal+Contradiction+Detection&searchtype=title): 제안법이 일반화 평가에 사용한 cross-modal contradiction benchmark의 설계를 확인한다.
