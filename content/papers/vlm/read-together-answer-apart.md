---
title: "Read Together, Answer Apart: How Earlier Questions Help Vision-Language Models Look"
date: 2026-11-19
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Xinyi Guo, Kaile Huang, Xitong Ling, Mingyi He, Chende Zheng, Jianyu Xu, Chao He, Dongqing Song"
paper: "https://arxiv.org/abs/2611.24785"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/read-together-answer-apart/read-together-answer-apart-pipeline.svg"
---

# 한 줄 요약

여러 질문을 함께 읽는 prefill은 앞 질문이 모은 시각 정보를 뒤 질문에 전달하지만, 답변 decoding에서는 다른 질문 stem이 간섭한다. **Read Together, Answer Apart**는 이 두 단계를 분리해 공유 prefill은 유지하고 답변만 격리한다.

# 논문 정보

- 제목: Read Together, Answer Apart: How Earlier Questions Help Vision-Language Models Look
- 저자: Xinyi Guo, Kaile Huang, Xitong Ling, Mingyi He, Chende Zheng, Jianyu Xu, Chao He, Dongqing Song
- 발표: arXiv:2611.24785v1, 2026-11-18 제출; 학회 게재 여부는 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2611.24785), [공식 PDF](https://arxiv.org/pdf/2611.24785), [공식 HTML](https://arxiv.org/html/2611.24785)
- 코드/프로젝트: arXiv 본문과 메타데이터에서 공식 링크를 확인하지 못함
- 키워드: VLM, co-asking, multi-question VQA, visual grounding, attention mask, prefill, decoding interference

# 핵심 아이디어

한 이미지에 여러 질문을 한 번에 넣는 co-asking은 모델에 따라 정확도를 올리기도, 떨어뜨리기도 한다. 저자들은 이를 질문별로 단일 질문 답과 co-asked 답을 짝지어 **repair**(혼자 틀린 답을 함께 물었을 때 맞힘)와 **damage**(혼자 맞힌 답을 함께 물었을 때 틀림)로 분해한다. DCI의 22개 공개 VLM에서 repair는 15.4–29.8%로 일관되지만 damage는 약한 모델의 30.8%에서 강한 모델의 4.7%까지 크게 줄어든다. 겉으로 불규칙한 총점 변화는 서로 반대인 두 현상의 합이다.

원인은 transformer의 두 단계가 다르게 작동하기 때문이다.

1. **공유 prefill의 이득**: 앞 질문 $Q_{<k}$가 이미지 $V$를 읽어 token state에 시각 문맥을 담고, 뒤 질문 $Q_k$가 이를 읽어 자신의 표적 영역에 더 집중한다.
2. **답변 decoding의 손해**: 답 $A_k$를 생성할 때는 모든 질문 stem $Q_{j\ne k}$가 보이므로, 관련 없는 stem이 정답을 흔든다.
3. **Read Together, Answer Apart**: 질문들은 표준 causal mask로 한 번에 prefill하되, 각 답변을 생성할 때는 자기 질문 이외의 stem을 가리고 position ID를 자기 질문 바로 뒤로 재배치한다.

# VLM 관점에서 중요한 이유

이 연구는 긴 multimodal prompt가 단순히 “context가 길어져서” 나빠진다고 보지 않는다. 질문 token 자체가 이미지에서 읽은 정보를 임시 visual memory처럼 전달할 수 있고, 그 이득은 답변 단계의 text interference와 분리된다. 즉 multimodal inference 최적화에서는 같은 token을 prefill 때 보존하고 decoding 때 가리는 **단계별 attention 정책**이 필요하다.

또한 attention map만 관찰하지 않고, 앞 질문의 image attention을 차단하는 인과 개입으로 시각 정보 전달을 검증한다. 14개 mask-capable 모델 모두에서 표적 attention과 정확도가 함께 떨어졌고, 민감한 layer가 먼저 나타난 뒤 3–11개 layer 후 현재 질문의 표적 집중이 약해졌다. “앞 질문이 scene을 읽고 뒤 질문이 그 결과를 이용한다”는 두 단계 경로를 지지한다.

# Method

## 1. 질문 수준 repair와 damage

DCI는 한 이미지에 16개 질문을 묶는다. 22개 공개 VLM(1B–35B)의 각 질문을 단독으로 물은 답과 co-asking 답을 비교해 wrong→right를 repair, right→wrong을 damage로 센다. 같은 이미지 질문, 길이를 맞춘 text-only 질문, 다른 이미지에서 가져온 질문을 앞 문맥으로 둔 통제를 통해 단순 길이·번호 형식 효과와 scene-specific visual context를 분리한다.

같은 이미지 질문이 누적될수록 repair는 첫 질문 11.1%에서 11–16번째 질문 23.9%까지 오른다. 이전 표적과 겹치지 않는 영역(IoU < 0.1)에서도 18.6%에서 22.5%로 증가하므로, 동일 물체를 반복해서 본 효과만은 아니다.

## 2. cross-question visual grounding 개입

14개 모델에서 앞 질문 $Q_{<k}$의 text는 그대로 두고, 그 질문들만 image token $V$에 attention하지 못하게 한다($V \nrightarrow Q_{<k}$). 현재 질문 $Q_k$는 이미지와 앞 질문을 모두 볼 수 있다. 따라서 성능 차이는 앞 질문이 이미지에서 읽어 전달한 정보에 귀속된다.

DCI 2–16번째 질문 20,797쌍에서 이 차단은 pooled 정확도를 1.77%p 낮추고 repair의 24.6%를 없앴다. 차단 layer window를 이동한 실험에서는 앞 질문의 시각 읽기가 주로 early-to-middle layer에 나타나며, 3–11개 layer 뒤 현재 질문의 target attention 저하가 최대가 된다.

## 3. 공유 prefill, 격리 decoding

표준 co-asking은 $[V,I,Q_1,\ldots,Q_K,A_1,\ldots,A_K]$ 순서를 쓴다. causal prefill에서 $Q_k$는 $V$, instruction $I$, 앞 질문 $Q_{<k}$만 읽는다. 반면 $A_k$는 마지막 질문 뒤에서 생성되므로 모든 $Q_{j\ne k}$를 읽는다.

제안법은 다음처럼 작동한다.

- **Shared reading**: $[V,I,Q_1,\ldots,Q_K]$를 기존 causal mask로 한 번 prefill하고 KV cache를 공유한다.
- **Isolated answering**: $A_k$는 $V$, $I$, 자기 질문 $Q_k$, 이전 답 prefix $A_{<k}$만 읽으며 다른 질문 stem은 mask한다.
- **Position re-indexing**: 원래 prompt에서 멀리 떨어진 $A_k$와 $A_{<k}$의 rotary position을 $Q_k$ 바로 뒤로 연속 배치한다.

# 핵심 그림

![한 이미지와 여러 질문을 함께 prefill해 앞 질문의 시각 정보를 뒤 질문에 전달하고, 각 답변 decoding에서는 다른 질문 stem을 차단하는 Read Together Answer Apart 파이프라인](/papers/assets/vlm/read-together-answer-apart/read-together-answer-apart-pipeline.svg)

_논문 Figure 5와 Equation 1을 바탕으로 재구성._ 출처: [공식 HTML Figure 5](https://arxiv.org/html/2611.24785#S5.F5), [공식 PDF](https://arxiv.org/pdf/2611.24785). 원본의 attention matrix를 그대로 복제하지 않고 입력→공유 prefill→격리 decoding→답변 흐름을 한국어로 다시 그렸다. 이 논문의 핵심은 모델 backbone보다 **prefill과 decoding의 비대칭적 mask 구조**이므로, 정성 attention 예시보다 Figure 5의 전체 방법 파이프라인을 선택했다.

왼쪽 입력에서 image token, instruction, 여러 질문을 한 prompt로 묶는다. 위쪽 shared prefill에서는 $Q_1\rightarrow Q_2\rightarrow Q_3$의 causal 연결을 유지해 앞 질문이 이미지에서 읽은 scene context를 뒤 질문에 전달한다. 아래쪽 isolated decoding에서는 각 $A_k$가 자기 $Q_k$만 보게 하되 image와 instruction, 앞 답 prefix는 유지한다. 이때 답 token의 RoPE position을 자기 질문 직후로 옮겨 mask로 생기는 인위적 거리도 제거한다. 학습은 없으며 추론 시 attention mask와 position ID만 바뀐다.

# Experiments / Results

- 모델: 22개 open-weight VLM로 현상 분석, 그중 custom mask가 가능한 14개 모델로 인과 개입과 제안법 평가
- 벤치마크: DCI(이미지당 16문항), WebUI(10문항), FinTabNet(20문항), GQA(5문항)
- DCI 제안법 비교 표본: 한 question order에서 22,181개 paired observation
- 비교: Single-Q, 표준 Co-Asking, IPPD식 prefill·decoding 동시 격리, 제안법
- 강건성: DCI의 세 random question order 총 66,554개 observation과 closed-candidate log-likelihood 평가

## 주요 실험 결과

아래 표는 원 논문의 **Table 4**를 옮긴 것이다. 1-Q, Co, Ours는 질문 수가 같은 각 벤치마크에서 14개 모델의 count-pooled 정확도(%, ↑)다. `차이`는 같은 설정의 Ours−Co를 **%p**로 계산했다. `개선 모델`의 괄호는 모델별 최대 개선 폭이며 pooled 차이와 혼동하면 안 된다.

| 벤치마크 / 설정 (정확도 %, ↑) | Single-Q | Co-Asking | Ours | 차이 | 개선 모델 (최대) |
| --- | ---: | ---: | ---: | ---: | ---: |
| DCI, 16 questions | 62.8 | 60.2 | **62.0** | **+1.8%p** | 12/14 (+4.7%p) |
| WebUI, 10 questions | 72.6 | 67.3 | **69.6** | **+2.3%p** | 10/14 (+11.4%p) |
| FinTabNet, 20 questions | 46.9 | **46.6** | 46.3 | **−0.3%p** | 8/14 (+5.3%p) |
| GQA, 5 questions | 64.3 | 64.4 | 64.4 | **0.0%p** | 5/14 (+1.1%p) |

출처: [공식 HTML Table 4](https://arxiv.org/html/2611.24785#S5.T4), 논문 p.8. DCI의 제안법은 co-asking이 single-Q보다 잃은 2.6%p 중 1.8%p, 즉 반올림 전 집계 기준 70%를 회복한다. Qwen2.5-VL-7B에서는 59.8%→64.5%로 **+4.71%p**다(Table 3).

WebUI는 최대 효과가 크다. InternVL3-8B에서 44.1%→55.4%로 **+11.3%p**(논문은 반올림 전 +11.4%p)를 얻고, pooled도 +2.3%p다. 반면 FinTabNet은 8/14 모델이 좋아져도 작은 Gemma-4 모델 두 개의 큰 하락 때문에 pooled −0.3%p다. “개선된 모델 수”와 전체 평균이 다른 방향일 수 있음을 보여준다.

메커니즘 검증도 중요하다. DCI의 2–16번째 질문에서 앞 질문의 image attention을 막으면 14개 모델 모두 성능이 내려가며 pooled −1.77%p다. 첫 질문은 prefill 시 다른 질문을 읽을 수 없는데도 decoding 때 뒤 질문 stem을 읽는다. 이 stem을 가리면 damaged answer가 127개에서 61개로 66개 감소해, 손해의 일부가 answer-time interference임을 직접 분리한다(Table 2).

# Limitations / Discussion

- 핵심 분석은 여러 질문을 한 번에 넣고 답을 번호순으로 생성하는 prompt 형식에 한정된다. multi-turn chat처럼 매 turn마다 새 prefill이 생기는 설정과는 cache·position 동작이 다르다.
- 제안법은 모델 내부 custom attention mask와 position ID를 제어할 수 있어야 한다. 폐쇄형 API나 fused serving stack에서는 바로 적용하기 어렵다.
- 14개 모델 중 DCI 2개, FinTabNet 6개, GQA 9개는 co-asking 대비 개선되지 않았다. 특히 FinTabNet pooled 정확도는 오히려 0.3%p 낮아 범용적인 무손실 최적화가 아니다.
- 다른 stem을 가리면 유용한 언어적 상호작용도 함께 없어진다. 질문 사이에 논리적 의존성이 있는 실제 대화에서는 답변 격리가 성능을 해칠 수 있다.
- attention 차단은 visual pathway의 인과적 필요성을 강하게 보이지만, 앞 질문 state가 어떤 scene representation을 부호화하는지까지 완전히 해석하지는 않는다.
- 원문은 arXiv v1이며 학회 게재 여부와 공식 코드 공개는 확인되지 않았다.

# 내가 이해한 핵심

이 논문의 가장 좋은 통찰은 **같은 문맥이 계산 단계에 따라 도움이 되기도, 방해가 되기도 한다**는 점이다. 앞 질문은 prefill에서 이미지 탐색을 분담하는 동료지만, decoding에서는 정답 token을 흔드는 distractor가 된다. context를 통째로 유지하거나 삭제하는 이분법보다 token 간 연결을 단계별로 설계해야 한다.

또한 질문 token을 단순한 text instruction으로만 보면 co-asking repair를 설명하기 어렵다. 앞 질문 token은 이미지를 본 뒤 scene-specific visual information을 가진 상태가 되고, 뒤 질문은 그 state를 읽는다. 이는 긴 VLM prompt의 중간 token을 reusable visual workspace로 활용할 가능성을 보여준다.

실무적으로는 여러 필드 OCR, UI 검사, 문서 QA처럼 한 이미지에 많은 질의를 묶을 때 (1) 한 번의 shared visual prefill로 비용을 줄이고, (2) 질문 간 visual reading은 허용하되, (3) answer branch에서는 unrelated stem을 차단하는 serving 구조를 고려할 수 있다. 다만 표·문서처럼 질문 간 언어적 연관이 큰 경우에는 benchmark별 검증이 필요하다.

# 다음에 연결해서 읽을 논문

- [Intra-Prompt Parallel Decoding for Common-Context Question Answering](https://arxiv.org/search/?query=Intra-Prompt+Parallel+Decoding+for+Common-Context+Question+Answering&searchtype=title): 질문을 prefill부터 격리하는 접근과, 시각적 cross-question repair를 보존하는 본 논문의 차이를 비교하기 좋다.
- [Cross-Modal Information Flow in Multimodal Large Language Models](https://arxiv.org/search/?query=Cross-Modal+Information+Flow+in+Multimodal+Large+Language+Models&searchtype=title): layer별 visual information flow 개입의 방법론적 기반이다.
- [How VLMs Plan What's Next](/papers/vlm/how-vlms-plan-whats-next): 질문 token과 image token 사이 pointer·relay 흐름을 activation patching으로 더 세밀하게 추적한다.
- [Visual Tokens on Demand](/papers/vlm/visual-tokens-on-demand-multi-image-reasoning): visual context를 항상 유지하지 않고 필요할 때만 쓰는 효율화 관점에서 연결된다.
