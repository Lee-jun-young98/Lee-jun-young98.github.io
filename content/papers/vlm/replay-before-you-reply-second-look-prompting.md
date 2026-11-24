---
title: "Replay Before You Reply: Second-Look Prompting for Unified Multimodal Encoding"
date: 2026-11-24
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Yicheng Zhang, Xun Zhang, Jingyuan Ma, Tianyu Yu, Yuan Yao"
paper: "https://arxiv.org/abs/2611.30909"
code: "https://github.com/zycccishere/second-look-prompting"
project: ""
thumbnail: "/papers/assets/vlm/replay-before-you-reply-second-look-prompting/second-look-causal-attention.png"
---

# 한 줄 요약

Second-Look Prompting은 표준 VLM 입력 $\langle V,T\rangle$을 $\langle V,T,V,T\rangle$로 한 번 더 제시해 causal attention의 단방향 결합을 보완하며, 학습 없이 3B–72B 공개 모델 9개와 frontier 모델 3개 모두의 12개 벤치마크 평균을 높인다.

# 논문 정보

- 제목: Replay Before You Reply: Second-Look Prompting for Unified Multimodal Encoding
- 저자: Yicheng Zhang, Xun Zhang, Jingyuan Ma, Tianyu Yu, Yuan Yao
- 발표: arXiv:2611.30909v1, 2026-11-23 제출; 학회 게재 여부는 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2611.30909), [공식 PDF](https://arxiv.org/pdf/2611.30909), [공식 HTML](https://arxiv.org/html/2611.30909)
- 라이선스: 논문과 그림은 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- 코드/프로젝트: [저자 공식 GitHub](https://github.com/zycccishere/second-look-prompting), Apache-2.0
- 키워드: second-look prompting, causal attention, multimodal prefill, visual scratchpad, test-time computation

# 핵심 아이디어

일반적인 decoder-only VLM은 image token $V$ 뒤에 question token $T$를 놓는다. causal mask 때문에 $T$는 $V$를 읽을 수 있지만, 먼저 계산된 $V$는 아직 나타나지 않은 질문을 읽을 수 없다. 순서를 $\langle T,V\rangle$로 바꾸면 이번에는 질문이 이미지를 보지 못하므로 불완전한 방향만 뒤집힌다.

SLP는 원래 prefix를 그대로 둔 채 같은 image-question pair를 뒤에 붙인다. 두 번째 image block $V_2$는 $V_1$과 $T_1$을 모두 읽어 질문에 맞는 visual state를 만들고, 두 번째 question block $T_2$가 이 state를 읽어 답을 생성한다. parameter update, 추가 task 정보, 모델 내부 수정은 필요 없다.

# VLM 관점에서 중요한 이유

이 논문은 VLM 성능을 generation-time chain-of-thought만의 문제로 보지 않고 **prefill에서 modality가 어떤 순서로 상태를 쓰는가**의 문제로 돌린다. 기존 causal backbone을 바꾸지 않아도 input presentation만으로 question-conditioned visual representation을 만들 수 있다는 점이 실용적이다.

더 흥미로운 결과는 두 번째 image가 단순 재관찰 이상의 계산 공간이라는 것이다. 일부 모델에서는 실제 image 대신 흰 image block을 넣어도 text-only repetition보다 reasoning이 좋아진다. 저자들은 attention 차단과 readout probe를 통해 추가 visual token의 hidden state가 image와 question 정보를 담는 prefill scratchpad로 작동한다고 해석한다.

# Method

## 1. Cross-modal partial observation

표준 입력은 $\langle V_1,T_1\rangle$이다. causal layer $l$에서 위치 $i$의 hidden state는 앞 위치 $j\le i$만 볼 수 있으므로, $V_1$은 질문과 무관하게 계산된다. 이후 생성 token은 두 modality를 함께 읽을 수 있지만, 이미 만들어진 visual state를 질문 조건에 맞게 다시 쓰지는 못한다.

## 2. Second-Look Prompting

SLP는 다음처럼 같은 pair를 그대로 반복한다.

$$
\langle V,T\rangle \longrightarrow
\langle V_1,T_1,V_2,T_2\rangle.
$$

$V_2$는 이전의 image와 question을 읽어 question-guided visual encoding을 만들고, $T_2$는 이 state와 전체 prefix를 읽는다. 저자들은 $V_2$를 multimodal prefill scratchpad라고 부른다. 출력 supervision이나 decoding rule은 바뀌지 않으며, 평가에서는 같은 checkpoint와 같은 example에 입력 배열만 바꾼다.

# 핵심 그림

![표준 입력, 단순 반복, 이미지 재배치, Second-Look Prompting의 causal attention mask를 비교하며 SLP에서 두 번째 이미지가 질문을 읽고 두 번째 질문이 visual scratchpad를 읽는 두 단계를 표시한 구조도](/papers/assets/vlm/replay-before-you-reply-second-look-prompting/second-look-causal-attention.png)

_논문 Figure 2 원본을 여백 없이 사용._ 출처: [공식 HTML Figure 2](https://arxiv.org/html/2611.30909#S2.F2), [원본 PNG](https://arxiv.org/html/2611.30909v1/causal-masks-in-variants.png). CC BY 4.0, 변경 없음. Figure 1의 성능 요약보다 **어떤 token block이 무엇을 볼 수 있는지**를 직접 설명하는 Figure 2가 방법의 핵심 architecture를 가장 정확히 보여주므로 선택했다.

그림에서 행은 query, 열은 key다. (a) 표준 입력과 (b) 같은 modality 반복은 visual block이 질문을 읽지 못한다. (c)는 $V_2$가 $V_1,T_1$을 읽는 1단계를 만들지만, 이를 읽을 뒤쪽 text block이 없다. (d) SLP는 $T_2$를 더해 ① 질문 조건부 visual state 작성과 ② 그 scratchpad를 읽는 답변 경로를 모두 완성한다.

학습과 추론의 흐름은 구분해야 한다. main 결과의 SLP는 **추가 학습 없는 추론 입력 변환**이다. 별도의 continued-training 실험에서는 같은 배열로 학습했을 때 모델이 이 경로를 더 잘 활용하는지도 확인하지만, 그것은 main method의 필수 조건이 아니다.

# Experiments / Results

- 모델: Qwen2.5-VL 3B/7B/32B/72B, Gemma-3-IT 4B/12B/27B, MiniCPM-V4.5, MiniCPM-o4.5, GPT-5.4 mini, Gemini 3 Flash, Claude Haiku 4.5
- reasoning 7개: DynaMath, MATH-Vision, LogicVista, VisualPuzzles, MMMU, MathVista, We-Math
- perception 5개: AI2D, OCRBench, SEED-Bench-2-Plus, MMBench, MMStar
- 각 proprietary model은 inference 비용 때문에 benchmark당 1,000 example을 평가했다. 비교 쌍 안에서는 prompt template, decoding 설정, example이 같다.

## 주요 실험 결과

아래 표는 원 논문 **Table 1**의 12개 benchmark 전체 평균이다. 점수는 각 benchmark의 0–100 점수를 동일 가중 평균한 값이며, 차이는 논문이 반올림 전 수치로 계산한 score point다.

| 모델 | 표준 $\langle V,T\rangle$ | SLP $\langle V,T,V,T\rangle$ | 차이 (point) | 출처 |
| --- | ---: | ---: | ---: | --- |
| GPT-5.4 mini | 70.9 | **72.6** | **+1.7** | Table 1 |
| Gemini 3 Flash | 84.1 | **85.2** | **+1.1** | Table 1 |
| Claude Haiku 4.5 | 68.3 | **69.5** | **+1.3** | Table 1 |
| Qwen2.5-VL-72B | 67.0 | **68.3** | **+1.3** | Table 1 |
| Qwen2.5-VL-32B | 64.7 | **66.1** | **+1.4** | Table 1 |
| Qwen2.5-VL-7B | 58.8 | **58.9** | **+0.1** | Table 1 |
| Qwen2.5-VL-3B | 52.3 | **53.0** | **+0.8** | Table 1 |
| MiniCPM-o4.5 | 62.8 | **63.6** | **+0.8** | Table 1 |
| MiniCPM-V4.5 | 62.9 | **63.6** | **+0.6** | Table 1 |
| Gemma-3-27B-IT | 56.2 | **57.1** | **+0.9** | Table 1 |
| Gemma-3-12B-IT | 50.5 | **51.9** | **+1.3** | Table 1 |
| Gemma-3-4B-IT | 43.2 | **43.5** | **+0.2** | Table 1 |

출처: [공식 HTML Table 1](https://arxiv.org/html/2611.30909#S3.T1). 전체 평균은 12/12 모델에서 상승했다. 공개 모델 9개의 평균 개선은 +0.8 point이며, Qwen2.5-VL-32B와 72B에서는 reasoning 평균이 각각 +2.1, +1.8 point 올라 perception의 +0.4, +0.6보다 크다. 예외도 있다. Qwen2.5-VL-7B의 perception 평균은 78.3에서 77.5로 **-0.8 point** 떨어져, 반복이 모든 하위 task를 일률적으로 개선하는 것은 아니다.

개별 benchmark의 가장 큰 대표 이득은 Gemini 3 Flash의 MATH-Vision 76.8 → 82.4, 즉 **+5.6 point**다. 논문의 paired bootstrap에서는 12개 모델 중 9개의 전체 평균 개선에 대한 95% confidence interval이 0을 제외하며, proprietary 모델 3개가 모두 여기에 포함된다.

메커니즘 실험도 성능표와 연결된다. scratchpad probe에서 readout이 원 입력을 직접 못 보고 추가 block만 읽게 했을 때, image block의 최선 결과가 6개 모델 중 5개에서 text block보다 좋았고 평균 margin은 7.0 point였다(Table 3). 이는 같은 image를 다시 보는 효과만이 아니라 visual token position 자체의 계산 역할이 있음을 뒷받침한다.

# Limitations / Discussion

- tokenized image와 question을 모두 반복하므로 prefix가 길어진다. 저자들의 5,000-step 통제 학습은 16×A100에서 14.2시간이 32.0시간으로 늘어 wall-clock이 2.25배가 됐다.
- duplicate image는 position-sensitive task를 방해할 수 있다. stress test에서 CountQA는 -0.12 point, SpatialMQA는 +0.54였지만 RefCOCOg grounding은 -1.11 point였다.
- main 설정은 원래 입력이 $\langle V,T\rangle$인 single-image prompt에 한정된다. multi-image 또는 interleaved image-text 입력을 어떤 단위로 replay할지는 해결하지 않았다.
- 모델별 이득 편차가 크다. 예컨대 Qwen2.5-VL-7B 전체 평균은 +0.1 point에 그치고 perception은 악화됐다. 배포 전에는 target model과 task에서 직접 검증해야 한다.
- Figure 2의 within-block attention은 설명용 schematic이며 실제 model attention pattern과 동일하다고 가정하면 안 된다.
- arXiv v1이며 학회 게재 여부는 확인되지 않았다.

# 내가 이해한 핵심

SLP의 본질은 “같은 것을 두 번 물으면 더 잘한다”가 아니다. 첫 번째 $\langle V,T\rangle$은 기존 모델이 익숙한 prefix를 유지하고, 두 번째 $V$는 질문을 본 뒤 visual state를 쓰며, 두 번째 $T$가 그 state를 읽는다. 반복은 causal graph에 원래 없던 **질문 → 시각 상태 → 답변** 경로를 입력 쪽에서 만든다.

또한 blank image와 attention-blocking control은 visual token을 단순한 pixel carrier가 아니라 latent workspace로 볼 근거를 준다. 다만 모든 모델에서 blank image가 통하지는 않으므로 “visual token이면 자동으로 scratchpad가 된다”기보다, 각 architecture의 position encoding과 visual token diversity가 계산 가능성을 좌우한다고 보는 편이 맞다.

# 다음에 연결해서 읽을 논문

- [Read Together, Answer Apart: How Earlier Questions Help Vision-Language Models Look](/papers/vlm/read-together-answer-apart): 여러 질문을 shared prefill에 함께 넣어 후속 질문이 앞선 문맥으로 시각 evidence를 더 잘 찾게 하는 인접 입력 설계다.
- [How VLMs Plan What's Next](/papers/vlm/how-vlms-plan-whats-next): autoregressive VLM 내부에서 visual binding과 pointer transfer가 어떤 head를 통해 이어지는지 분석한다.
- [Ask Twice, Look Twice: Prompt Echoing Resolves the Question-First Paradox in Vision-Language Models](https://arxiv.org/abs/2607.15565): question-first 순서에서 prompt echoing으로 causal attention 제약을 다루는 직접 선행 연구다.
- [Filler Tokens are Transformers' Hidden Computation](https://arxiv.org/abs/2404.15758): 내용 없는 추가 token이 latent computation 공간으로 작동할 수 있다는 text-only 관점을 제공한다.
