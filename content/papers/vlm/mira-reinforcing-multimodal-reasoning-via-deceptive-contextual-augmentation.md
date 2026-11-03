---
title: "MIRA: Reinforcing Multimodal Reasoning via Deceptive Contextual Augmentation"
date: 2026-11-03
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "NeurIPS 2026"
authors: "Zhihan Yin, Jianxin Liang, Yifeng Yao, Nonghai Zhang, Bingyue Peng, Chunguang Qie, Huishuai Zhang, Dongyan Zhao"
paper: "https://arxiv.org/abs/2611.03087"
code: "https://github.com/Hans-M-Yin/mira-neurips26"
project: "https://neurips.cc/virtual/2026/poster/153690"
thumbnail: "/papers/assets/vlm/mira-reinforcing-multimodal-reasoning-via-deceptive-contextual-augmentation/mira-training-pipeline.svg"
---

# 한 줄 요약

MIRA는 정답을 바꾸는 기만적 시각 설명을 assistant prefix로 주입하고 같은 GRPO 그룹 절반에만 재검토 trigger를 붙여, Qwen2.5-VL-7B의 네 시각 수학 벤치마크 평균을 50.15%에서 57.18%로 약 +7.03%p 높인다.

# 논문 정보

- 제목: MIRA: Reinforcing Multimodal Reasoning via Deceptive Contextual Augmentation
- 저자: Zhihan Yin, Jianxin Liang, Yifeng Yao, Nonghai Zhang, Bingyue Peng, Chunguang Qie, Huishuai Zhang, Dongyan Zhao
- 발표: NeurIPS 2026, arXiv:2611.03087v1 (2026-11-02 제출, 2026-11-03 공개 배치)
- 링크: [NeurIPS 공식 페이지](https://neurips.cc/virtual/2026/poster/153690), [arXiv 초록](https://arxiv.org/abs/2611.03087), [PDF](https://arxiv.org/pdf/2611.03087)
- 코드/모델/데이터: [공식 저장소](https://github.com/Hans-M-Yin/mira-neurips26), [MIRA-7B](https://huggingface.co/hansQAQ/MIRA-7B), [MIRA-RL-Dataset](https://huggingface.co/datasets/hansQAQ/MIRA-RL-Dataset)
- 키워드: multimodal reasoning, RLVR, deceptive context, visual self-correction, GRPO, hallucination

# 핵심 아이디어

멀티모달 추론은 첫 시각 해석이 틀리면 그 오류를 전제로 긴 reasoning chain을 이어 가기 쉽다. MIRA는 vision encoder 자체를 바꾸는 대신 **초기 오인 뒤에도 이미지를 다시 보고 회복하는 정책**을 학습한다.

1. 현재 policy가 질문에 필요한 올바른 시각 설명 $C_{pos}$를 만든다.
2. expert가 정답에 영향을 주는 세부 사실을 바꿔 기만적 설명 $C_{neg}$와 수정 전·후 쌍 $M$을 만든다.
3. text-only verifier가 $C_{pos}$로는 맞고 $C_{neg}$로는 틀린 경우만 남겨 실제로 모델을 속이는 sample을 고른다.
4. $C_{neg}$를 사용자 지시가 아니라 모델이 이미 말한 것처럼 assistant reasoning prefix에 넣는다.
5. 같은 GRPO rollout 그룹의 절반에는 “이미지를 잘못 봤을 수 있다”는 trigger를 넣고 절반에는 넣지 않아, correction 행동의 상대 reward를 학습한다.

별도 SFT cold start나 사람이 쓴 CoT는 필요하지 않는다. 정답·format 보상에 명시적 시각 오류 correction 보상을 더하되, correction 보상은 최종 정답도 맞을 때만 활성화해 그럴듯한 정정 문장만 만드는 reward hacking을 줄인다.

# VLM 관점에서 중요한 이유

- perception과 reasoning을 독립 모듈처럼 취급하지 않고, 잘못된 시각 전제가 reasoning 중 어떻게 증폭되는지를 직접 학습 대상으로 만든다.
- 기만적 설명을 user prompt가 아니라 assistant prefix에 넣어 “외부 정보에 반박”하는 것이 아니라 “자신의 이전 시각 해석을 수정”하는 궤적을 만든다.
- trigger가 없는 inference에서도 correction이 나타나도록 group-relative 비교를 이용한다. 즉 trigger는 배포 시 prompt trick이 아니라 학습 중 행동 탐색 장치다.
- 같은 Qwen2.5-VL-7B backbone의 여러 GRPO 계열과 비교하고, Qwen2-VL-7B·Qwen3-VL-4B·8B에서도 12개 비교 중 11개 개선과 1개 동률을 보고해 특정 한 모델에만 묶이지 않는다는 근거를 제시한다.
- HallusionBench와 FREAK처럼 수학 외 visual hallucination benchmark도 함께 평가해, reasoning accuracy와 perception robustness의 동시 개선을 확인한다.

# Method

## 1. 기만적 시각 context 구성

이미지 $I$와 질문 $Q$에 대해 policy가 질문 관련 설명 $C_{pos}$를 만든다. expert model은 이미지, 질문, 정답을 보며 특정 시각 사실을 바꾸고 수정 쌍 $M$을 기록한다.

$$
(C_{neg}, M)=\Theta(q_{modify}, I, Q, C_{pos}).
$$

text-only verifier가 $C_{pos}$에서는 정답 $y^*$를 맞히고 $C_{neg}$에서는 틀리는 경우만 $D_{aug}$에 보존한다. 원본 $D_0$도 함께 학습해 기만적 context에 과적합되는 것을 막는다.

## 2. intra-group reflection trigger

각 augmented sample에서 $N$개 rollout을 만들고 $K=N/2$에만 trigger를 붙인다. 동일한 잘못된 prefix 아래에서 “재검토를 유도받은 궤적”과 “자연스럽게 계속한 궤적”을 한 그룹에 두기 때문에 GRPO가 두 행동의 상대적 이점을 안정적으로 계산할 수 있다. $K$가 0이나 $N$에 가까우면 그룹 내 행동이 동질화되어 credit signal이 약해진다.

## 3. assistant prefix와 보상

실제 rollout 입력은 다음과 같다.

```text
user: [image], [question]
assistant: <think>[deceptive context], [optional trigger]
```

외부에서 고정한 prefix와 trigger는 policy action으로 간주하지 않고 loss mask에서 제외한다. 생성 continuation만 GRPO objective에 들어가므로, policy가 sampling하지 않은 token에 likelihood를 붙이는 off-policy 오류를 피한다.

$$
R_i=\alpha r_{format}+\beta r_{acc}+\gamma r_{cor}\,r_{format}\,r_{acc}.
$$

$r_{cor}$는 output이 expert가 바꾼 잘못된 사실을 명시적으로 거부하고 원래 시각 근거를 회복했는지 judge model로 확인한다. 논문 설정은 $\alpha=0.4$, $\beta=1.0$, $\gamma=0.2$이며, Qwen2.5-VL-7B를 2 epoch, learning rate $10^{-6}$, rollout batch 128로 학습한다.

# 핵심 그림

![이미지와 질문에서 올바른 설명을 만들고, expert가 정답을 바꾸는 기만적 설명을 생성·검증한 뒤, assistant prefix와 반쪽 reflection trigger를 사용해 GRPO로 시각 자기수정을 학습하는 MIRA 파이프라인](/papers/assets/vlm/mira-reinforcing-multimodal-reasoning-via-deceptive-contextual-augmentation/mira-training-pipeline.svg)

> 그림 1. 원 논문 Figure 1, Sections 4.1–4.3, Equations (4)–(9)를 바탕으로 재구성한 MIRA 데이터 생성·RL 학습 파이프라인. 출처: [arXiv PDF Figure 1](https://arxiv.org/pdf/2611.03087#page=4), [공식 저장소의 Method 설명](https://github.com/Hans-M-Yin/mira-neurips26#method). 원본 이미지를 복제하지 않고 논문 내용을 한국어로 다시 그린 재구성이다.

이 그림을 고른 이유는 MIRA의 핵심이 inference architecture 변경이 아니라 **기만적 context 생성, filtering, 그룹 내 trigger 배치, correction-aware GRPO**가 연결되는 전체 학습 파이프라인에 있기 때문이다. 입력 이미지·질문에서 policy가 질문 관련 설명을 만들고, expert가 정답에 영향을 주는 사실만 교란한다. verifier는 이 교란이 실제로 답을 뒤집는지 검사해 무효 sample을 버린다.

학습에서는 검증된 $C_{neg}$가 assistant `<think>` prefix가 되고, 같은 그룹의 절반만 trigger를 받는다. rollout의 최종 정답·형식·명시적 correction으로 reward를 만든 뒤 group advantage를 계산해 policy를 갱신한다. 배포 시에는 이 데이터 생성기, 잘못된 prefix, trigger, correction judge가 필요 없고 원래 이미지와 질문만 입력한다. 기존 GRPO와 달라진 부분은 학습 input과 그룹 내 행동 다양화, 그리고 정답으로 gating된 correction reward다.

# Experiments / Results

- 학습 원본은 ViRL-39K와 MMK12에서 약 18K sample을 뽑고, original과 augmented를 약 1:2로 구성한다. 공개 저장소의 release dataset은 28,643개 example을 제공한다.
- reasoning benchmark는 MathVista, MathVerse, MathVision, WeMath이며 vision/general benchmark는 MMMU-Pro, HallusionBench, FREAK이다.
- Table 1에서 MIRA는 Qwen2.5-VL-7B 대비 7개 benchmark 모두 개선한다. MathVista +7.0%p, MathVerse +7.1%p, MathVision +4.7%p, WeMath +9.3%p, MMMU-Pro +2.5%p, HallusionBench +4.1%p, FREAK +0.6%p다. 논문 표의 FREAK delta 행은 +0.4로 인쇄돼 있지만 30.6-30.0은 +0.6이므로 여기서는 원 점수로 다시 계산했다.
- 네 수학 benchmark의 단순 평균은 base 50.15%에서 MIRA 57.18%로 +7.03%p다. 논문 Table 3의 57.18과 일치한다.
- Table 4에서 full MIRA 평균 57.2%, correction reward 제거 56.7%, full trigger 55.8%, trigger 제거 55.1%, augmented context까지 제거한 GRPO 55.6%다. 절반 trigger와 correction reward가 각각 기여하며, 모든 rollout에 trigger를 넣는 것도 최적이 아니다.
- Table 6의 controlled input에서 reflection recall은 27.42%→42.96%(+15.54%p), successful reflection rate는 36.33%→59.54%(+23.21%p), augmented accuracy는 19.48%→50.66%(+31.18%p)다.

## 주요 실험 결과

Table 1은 동일한 Qwen2.5-VL-7B backbone을 직접 비교한다. 모든 값은 accuracy(%, ↑)이며 차이는 %p다.

| 벤치마크 / 지표 (accuracy %, ↑) | MIRA | Qwen2.5-VL-7B |   차이 | 출처                   |
| ------------------------------- | ---: | ------------: | -----: | ---------------------- |
| MathVista                       | 75.2 |          68.2 | +7.0%p | Table 1                |
| MathVerse                       | 53.8 |          46.7 | +7.1%p | Table 1                |
| MathVision                      | 29.0 |          24.3 | +4.7%p | Table 1                |
| WeMath                          | 70.7 |          61.4 | +9.3%p | Table 1                |
| MMMU-Pro                        | 41.0 |          38.5 | +2.5%p | Table 1                |
| HallusionBench                  | 69.8 |          65.7 | +4.1%p | Table 1                |
| FREAK                           | 30.6 |          30.0 | +0.6%p | Table 1 원 점수 재계산 |

수학 과제의 증가 폭이 더 크지만, 학습 분포 밖에 가까운 HallusionBench와 FREAK에서도 악화되지 않는 점이 중요하다. 다만 Table 1의 전체 Avg. 52.9는 모든 benchmark의 단순 산술 평균이 아니라 MMMU-Pro의 두 subset 처리 등 저자 evaluation pipeline을 따르므로 위 행을 다시 평균한 값과 직접 같다고 가정하면 안 된다.

Table 6은 “정답을 맞혔는가”와 “실제로 잘못된 시각 설명을 고쳤는가”를 분리한다.

| controlled input 지표 (%, ↑) |  MIRA |  Base |     차이 | 출처       |
| ---------------------------- | ----: | ----: | -------: | ---------- |
| reflection recall            | 42.96 | 27.42 | +15.54%p | Table 6(a) |
| successful reflection rate   | 59.54 | 36.33 | +23.21%p | Table 6(a) |
| augmented accuracy           | 50.66 | 19.48 | +31.18%p | Table 6(a) |
| normal accuracy              | 68.69 | 43.51 | +25.18%p | Table 6(a) |

이 결과는 단순히 trigger 문구를 더 자주 출력한 것이 아니라, 교란된 sample에서 명시적 correction과 정답이 함께 늘었음을 보인다. 그러나 clean MathVerse에서 false correction rate가 0.30%에서 1.07%로 상승하므로 “더 많이 되돌아보기”가 항상 안전한 것은 아니다.

# Limitations / Discussion

- 본 실험의 중심은 7B Qwen 계열이다. Qwen3-VL 4B·8B 전이 결과는 있지만 더 큰 foundation model과 다른 architecture family의 scaling은 검증되지 않았다.
- 기만적 context는 expert가 offline으로 만든 합성 오류다. 자연 발생하는 vision encoder 오류나 실제 사용자 환경의 모호성과 분포가 다를 수 있다.
- 데이터 생성에는 GPT-5.4급 expert가 필요하고, correction reward에는 Qwen3-VL-32B judge가 필요해 학습 비용과 외부 모델 의존성이 크다. 논문은 전체 학습이 약 16시간 걸렸다고 보고한다.
- evaluation은 regex와 GPT-4o judge를 함께 써 소량의 API stochasticity가 남는다. reflection metric도 judge가 명시적 revision을 판정하므로 내부의 암묵적 시각 재검토를 완전히 포착하지 못한다.
- MathVerse false correction rate는 0.30%에서 1.07%로 오른다. 올바른 해석을 괜히 뒤집거나, perception을 수정한 뒤 reasoning에는 수정 전 전제를 계속 쓰는 실패가 Appendix F.4에 보고된다.
- “reflection한 sample”은 모델마다 다른 부분집합일 수 있어 Table 6의 조건부 SRR을 reflection 자체의 인과 효과로 해석하면 안 된다.
- augmented ratio가 너무 높으면 성능이 떨어진다. 합성 오류 회복만 과도하게 연습하면 일반 reasoning signal의 다양성이 줄어드는 trade-off가 있다.

# 내가 이해한 핵심

MIRA의 가장 좋은 아이디어는 오류를 단순 noise로 넣는 것이 아니라 **현재 policy가 믿을 법한 이전 발화**로 바꿔 넣는 것이다. user가 “이 설명은 틀릴 수 있다”고 알려 주면 모델은 외부 명제를 의심하면 되지만, assistant prefix는 자신이 이미 관찰했다고 가정한 내용을 뒤집어야 한다. 실제 멀티모달 CoT에서 필요한 recovery와 더 닮은 학습 신호다.

절반 trigger 설계도 GRPO의 구조를 잘 이용한다. trigger 자체를 배포 시 의존하는 대신 한 그룹 안에서 correction을 유도받은 행동과 자발적 행동을 경쟁시킨다. correction reward가 정답 reward로 gating되므로 “죄송합니다, 다시 보겠습니다” 같은 표면적 반성보다 잘못된 시각 사실을 고치고 답까지 맞히는 궤적이 선택된다.

동시에 clean input의 false correction 증가는 중요한 경고다. 신뢰할 수 있는 VLM에는 무조건 많이 반성하는 정책이 아니라, **언제 다시 볼지와 언제 현재 perception을 유지할지**를 calibration하는 별도 신호가 필요하다. 다음 단계는 실제 모델 오류를 online으로 수집하고, uncertainty나 evidence conflict에 따라 reflection budget을 조절하며, 수정된 perception이 후속 reasoning에 일관되게 사용되는지 검사하는 방향일 것이다.

# 다음에 연결해서 읽을 논문

- [PAPO: Perception-Aware Policy Optimization for Multimodal Reasoning](https://arxiv.org/abs/2507.06448) — MIRA Table 1의 강한 동일-backbone 비교군으로, 시각 perception reward와 policy optimization의 다른 결합 방식을 비교할 수 있다.
- [VL-Rethinker: Incentivizing Self-Reflection of Vision-Language Models with Reinforcement Learning](https://arxiv.org/abs/2504.08837) — intra-group reflection trigger의 직접적인 선행 아이디어다.
- [Vision-R1: Incentivizing Reasoning Capability in Multimodal Large Language Models](https://openreview.net/forum?id=UZIjskfbfU) — multimodal RLVR의 reasoning 강화가 perception 오류 회복과 어떻게 다른지 볼 수 있다.
- [The Alignment Illusion in Multimodal Large Language Models](/papers/vlm/the-alignment-illusion-in-multimodal-large-language-models) — 이미지가 바뀌어도 내부 representation과 답이 텍스트 쪽에 고정되는 현상을 분석해, MIRA가 다루는 perception–reasoning gap과 연결된다.
