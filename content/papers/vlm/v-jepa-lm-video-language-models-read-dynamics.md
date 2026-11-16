---
title: "V-JEPA-LM: Video-Language Models That Read Dynamics Beyond Static, Text-Aligned Representations"
date: 2026-11-16
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Keuntae Kim, Dongjun Kim, Yong Suk Choi"
paper: "https://arxiv.org/abs/2611.17831"
code: "https://github.com/kkt94/Llama-V-JEPA-LM"
project: ""
thumbnail: "/papers/assets/vlm/v-jepa-lm-video-language-models-read-dynamics/v-jepa-lm-overview.png"
---

# 한 줄 요약

V-JEPA가 이미 담고 있던 속도·방향·순서 정보를 caption/QA만으로는 LLM이 읽지 못한다는 병목을 밝히고, 같은 영상을 변환해 정답이 달라지는 counterfactual supervision으로 4B 모델의 11개 비디오 벤치마크 평균을 기존 동급 최고 61.08에서 72.14로 **11.06%p** 높인다.

# 논문 정보

- 제목: V-JEPA-LM: Video-Language Models That Read Dynamics Beyond Static, Text-Aligned Representations
- 저자: Keuntae Kim, Dongjun Kim, Yong Suk Choi (Hanyang University)
- 발표: arXiv:2611.17831v1, 2026-11-13 공개; 학회 게재 여부는 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2611.17831), [공식 PDF](https://arxiv.org/pdf/2611.17831), [공식 HTML](https://arxiv.org/html/2611.17831v1)
- 코드/모델: [저자 공식 GitHub](https://github.com/kkt94/Llama-V-JEPA-LM). 논문 공개 시점에는 모델·추론 코드를 공개했고 training code, data generator, manifest는 추후 공개 예정이라고 적었다.
- 라이선스: 논문과 Figure 1은 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- 키워드: video-language model, V-JEPA, world-model encoder, temporal reasoning, counterfactual supervision, dynamics, video QA

# 핵심 아이디어

이 논문은 비디오 VLM의 실패를 **encoder에 정보가 없는 문제**와 **LLM이 있는 정보를 답에 사용하지 않는 문제**로 나눈다. held-out speed-ratio 문항에서 frozen V-JEPA feature의 linear probe는 86.7%, bridge feature는 83.5%를 기록하지만, caption+QA로 학습한 VLM의 실제 정답률은 chance 33.3%에 가까운 33.7%다. 시각 정보가 bridge까지 전달됐어도 일반적인 언어 supervision은 변화 자체를 읽도록 요구하지 않는다.

해결책은 동일한 원본 영상에 시간 역전, 속도 변화, 좌우 반전, 사건 순서 변경, 반복 횟수 변경 같은 pixel transformation을 적용하는 것이다. 같은 장면과 같은 질문인데 변환에 따라 정답만 바뀌게 만들면, 장면 내용이나 언어 prior만으로는 loss를 줄일 수 없고 모델은 encoder의 change component를 읽어야 한다. 저자는 14개 construction, 6개 family, 33개 source를 구성해 전체 학습 샘플의 약 6%만 이 supervision으로 채운다.

# VLM 관점에서 중요한 이유

보통 더 강한 video encoder를 붙이면 temporal reasoning도 자연스럽게 좋아질 것이라고 기대한다. 그러나 이 논문은 **representation capacity와 answer behavior 사이에 supervision bottleneck이 있다**고 정량화한다. V-JEPA의 spatiotemporal token에는 서로 다른 영상에 공통인 변화 방향이 존재하지만, caption과 VQA 문항은 대개 영상의 몇 가지 정적 속성만 지목해 이 방향을 사용할 유인을 주지 않는다.

또한 대규모 multi-stage alignment가 필수라는 관행에 도전한다. V-JEPA-LM은 frozen encoder, spectral bridge, pretrained LLM을 4.53M sample의 단일 stage로 학습하고 frame당 32 visual token을 쓴다. 비교되는 공개 video LLM들은 9M~172M sample과 평균 64~256 token/frame을 쓰지만, V-JEPA-LM은 1B~8B 모든 크기 구간에서 11개 benchmark 평균 최고점을 기록한다. 핵심은 더 많은 데이터보다 **encoder가 알고 있는 변화와 직접 연결되는 supervision**이다.

# Method

## 1. frozen encoder의 content와 change 분해

원본 영상 $v$와 pixel transformation $T$가 적용된 $Tv$의 token 위치를 맞춘 뒤 다음처럼 content와 change를 분해한다.

$$
z_T(v)=\Pi_T^{-1}z(Tv),\qquad
c=\frac{z(v)+z_T(v)}{2},\qquad
d=\frac{z(v)-z_T(v)}{2}
$$

frame-wise text-aligned encoder인 SigLIP은 시간 역전이 token 순서만 바꾸므로 정렬 후 token 내부 변화 $d$가 0이다. 반면 predictive spatiotemporal encoder인 V-JEPA에서는 역전·반전·속도 변화가 여러 영상에서 비슷한 channel-space 방향으로 나타난다. 저자는 change의 상대 크기 $r_d$, content와의 overlap $\rho$, 영상 간 consistency $\kappa$로 이 구조를 측정한다.

## 2. 정답이 transformation으로 결정되는 supervision

generator는 공개 데이터의 clip $v$에 $T$를 적용하고, transformation의 answer map $\pi_T$로 정답을 정한다. 14개 construction은 sign flip, order, temporal position, magnitude, count, stop/cut의 6개 family로 묶인다. 같은 장면이 각 답과 균형 있게 나타나도록 sampling하고, option 길이·text-only LLM prior·clip 길이와 timing도 정답과 decorrelate한다.

같은 scene-question pair에서 정답이 반대인 두 sample을 보면 공통 content $c$의 gradient는 상쇄되고 변화 $d$가 answer margin을 만든다. 모든 counterpart를 같은 batch에 강제로 넣지는 않지만 answer-balanced row만으로도 scene-answer shortcut을 줄인다.

## 3. V-JEPA-LM 구조와 단일-stage 학습

frozen V-JEPA 2.1 encoder가 32 frame을 읽는다. 1B·2B 모델은 ViT-L, 3B~8B는 ViT-g를 사용한다. spectral bridge는 frozen encoder 통계로 한 번 계산한 PCA rotation·rescaling과 trainable MLP projector로 clip당 1,024 token, 즉 frame당 32 token을 만든다. 전체 step의 0.6~0.8% 동안 bridge만 warm-up한 뒤 Qwen3 또는 Llama LM 전체를 학습한다.

학습 데이터는 175개 공개 source에서 고정 weight로 뽑은 4.53M row다. 기존 caption+QA mixture를 유지하면서 33개 counterfactual source를 약 6% 추가한다. 별도의 alignment, pretraining, instruction-tuning stage를 연쇄하지 않고 한 stage에서 bridge와 LLM을 연결한다.

# 핵심 그림

![caption과 QA만으로는 V-JEPA의 동역학이 답변에 쓰이지 않는 현상, predictive encoder의 공통 변화 성분, 동일 영상의 counterfactual pair supervision, frozen V-JEPA와 bridge 및 LLM의 단일-stage 학습을 연결한 V-JEPA-LM 전체 구조](/papers/assets/vlm/v-jepa-lm-video-language-models-read-dynamics/v-jepa-lm-overview.png)

_Figure 1 원본._ 출처: [공식 논문 HTML Figure 1](https://arxiv.org/html/2611.17831v1#S1.F1), [공식 PDF](https://arxiv.org/pdf/2611.17831). CC BY 4.0에 따라 저장·표시했으며 저자와 출처를 위에 명시했다. 이 논문의 주장은 새 projector 자체보다 **정보는 encoder에 있지만 supervision이 그것을 읽게 만들지 못한다는 진단과 해결 흐름**에 있으므로 전체 overview/architecture figure를 골랐다.

위쪽 왼쪽은 caption·QA가 한 frame으로도 답할 수 있는 속성을 주로 가르쳐 frozen V-JEPA의 speed probe 86.7%가 실제 답변 33.7%로 이어지지 않는 모습을 보여준다. 가운데는 SigLIP의 frame token과 달리 V-JEPA의 spatiotemporal tube에 영상 간 공유되는 change component가 있음을 나타낸다. 오른쪽은 같은 clip과 질문을 유지하고 transformation $T$만 바꿔 정답이 달라지는 pair가 content shortcut을 상쇄하는 학습 신호가 됨을 설명한다.

아래는 추론 구조다. 입력 video는 frozen V-JEPA encoder를 거쳐 spectral bridge에서 compact visual token이 되고, 질문 token과 함께 LLM에 들어가 답을 생성한다. 학습 때는 caption+QA에 dynamics supervision을 더하지만, 추론 때 별도 tool이나 두 번째 pass는 없다. 기존 V-JEPA video LLM과 비교하면 3개 stage를 1개로, 88.5M sample을 4.53M으로, frame당 288 token을 32개로 줄인 것이 핵심 차이다.

# Experiments / Results

- 모델: Qwen3 1.7B/4B/8B, Llama 3.2 1B/3B와 Llama 3.1 8B. V-JEPA 2.1 encoder는 frozen이다.
- 평가: MVBench, PerceptionTest, TVBench, TempCompass, TOMATO, MotionBench, NExT-QA, MVP, TemporalBench, Something-Something v2, Vinoground의 11개 benchmark에서 12개 score를 계산한다.
- protocol: 공개 모델도 모두 32 frame, 동일 prompt, option-letter scoring으로 재평가하고 12개 score의 단순 평균을 보고한다.
- controlled study: 같은 encoder와 data budget에서 caption+QA, arrow-of-time, annotated temporal QA, counterfactual supervision을 비교한다. CF는 2B 모델 평균을 4.5점, 자연 benchmark의 speed question을 38점 높인다.
- 정보 사용 진단: 540개 held-out speed-ratio item에서 V-JEPA+caption/QA는 bridge probe 83.5%에도 실제 답변 33.7%였지만, CF를 더하면 bridge 91.2%, LM layer 18 이후 약 96%, 최종 답변 92.8%가 된다.

## 주요 실험 결과

아래 표는 [공식 논문 Table 4](https://arxiv.org/html/2611.17831v1#S5.T4)의 size-class별 가장 강한 공개 baseline과 V-JEPA-LM을 같은 32-frame 평가 protocol에서 비교한 것이다. Avg는 11개 benchmark의 12개 score 단순 평균이며, 차이는 절대 **%p**로 계산했다.

| 크기 구간 / 11개 benchmark, 12-score Avg (%, ↑) | V-JEPA-LM | 가장 강한 공개 baseline | baseline 점수 | 차이 | 출처 |
| --- | ---: | --- | ---: | ---: | --- |
| 2B: Ours-2B-Q | **66.02** | Qwen3-VL-2B | 52.45 | **+13.57%p** | Table 4 |
| 4B: Ours-4B-Q | **72.14** | Molmo2-4B | 61.08 | **+11.06%p** | Table 4 |
| 8B: Ours-8B-L | **70.51** | PLM-8B | 64.79 | **+5.72%p** | Table 4 |

가장 눈에 띄는 것은 4B 모델이다. 동급 최고 Molmo2-4B보다 평균이 11.06%p 높고, 더 큰 공개 8B 최고인 PLM-8B의 64.79보다도 7.35%p 높다. 저자 분석에서 4B의 가장 큰 차이는 dynamics 중심 TOMATO 53.5 대 최대 36.5(**+17.0%p**), Vinoground-video 66.8 대 최대 33.8(**+33.0%p**)에서 나온다.

다만 전체 평균에는 학습 source와 가까운 SSv2와 Vinoground 두 score가 들어간다. 저자는 이 셋을 빼도 4B가 70.1로 공개 4B 최고 66.0보다 **4.1%p** 앞선다고 별도로 보고한다. Meta V-JEPA video LLM과 공통 6개 benchmark를 비교한 Table 5에서는 Ours-8B-L이 68.2, V-JEPA 2가 63.3으로 **+4.9%p**이며, training sample은 88.5M에서 4.53M으로 약 19.5배 적다. 평가 설정이 다른 Table 4와 Table 5 수치는 같은 행에서 직접 비교하지 않았다.

# Limitations / Discussion

- 대상은 짧은 video clip의 동역학이다. 저자도 hour-long video는 현재 training scale에서 비싸며 future work라고 명시한다.
- V-JEPA는 text recognition과 single-image question answering을 목표로 학습된 encoder가 아니다. 문서 OCR·정적 이미지 지식 과제에 이 결과를 그대로 일반화할 수 없다.
- 14개 construction은 pixel transformation으로 정답을 정확히 정할 수 있는 변화에 집중한다. 장기 인과, 사회적 상호작용, 미세한 intent처럼 단순 변환으로 만들기 어려운 시간 개념은 별도 supervision이 필요하다.
- 주요 성능 표의 baseline은 저자들이 동일 protocol로 재평가했지만, 일부 모델의 공식 보고 설정과 다르다. 재현 시 32-frame sampling, prompt, option-letter scoring을 그대로 맞춰야 한다.
- 공개 시점의 GitHub에는 weights와 inference 안내가 중심이며 training code, counterfactual generator, manifests는 추후 공개 예정이라고 명시돼 있다. 완전한 data pipeline 재현성은 아직 확인이 필요하다.
- Proposition 2는 encoder minimizer의 linear identifiability와 transformation symmetry 가정을 둔다. 측정 결과가 이 설명을 지지하지만 모든 predictive encoder에 자동 적용되는 보장은 아니다.
- venue는 arXiv 외에 확인되지 않아 `확인 필요`로 표시했다.

# 내가 이해한 핵심

이 논문의 가장 중요한 메시지는 **probe score가 높다고 모델이 그 정보를 사용한다고 말할 수 없다**는 것이다. V-JEPA feature와 bridge에 speed 정보가 남아 있어도, LM의 loss가 그 정보를 읽어야만 줄어드는 구조가 아니면 실제 답변은 chance에 머문다. representation probing과 end-task behavior 사이를 같은 item으로 추적한 Table 3가 이 점을 아주 선명하게 보여준다.

counterfactual pair의 장점은 새 지식을 주입하는 것이 아니라 기존 정보의 **읽는 방향을 정해 주는 것**이다. 같은 장면을 forward/backward 또는 fast/slow로 만들고 정답을 뒤집으면, scene content는 두 sample에 공통이라 분류 경계에 기여하기 어렵고 change component만 안정적인 신호가 된다. 그래서 전체 row의 약 6%만 바꿔도 효과가 크다.

실무적으로는 강한 encoder를 고른 뒤 더 큰 instruction dataset을 찾기 전에, 실패 사례의 답이 encoder 내부에 존재하는지와 supervision이 그 차이를 요구하는지 먼저 분리해 볼 필요가 있다. 정보가 없다면 encoder를 바꿔야 하고, 정보가 있는데 사용하지 않는다면 이 논문처럼 답이 변하는 matched counterfactual을 설계하는 편이 더 데이터 효율적일 수 있다.

# 다음에 연결해서 읽을 논문

- [V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction and Planning](https://arxiv.org/abs/2506.09985): V-JEPA-LM이 frozen world-model encoder에서 읽어 내는 spatiotemporal representation의 출발점이다.
- [V-JEPA 2.1: Unlocking Dense Features in Video Self-Supervised Learning](https://arxiv.org/abs/2603.14482): 실제 backbone과 V-JEPA 2 대비 dense feature 변화, 같은 VLM recipe에서 temporal score가 자동으로 오르지 않는 현상을 확인할 수 있다.
- [Tracing the Arrow of Time in Vision-Language Models](https://arxiv.org/search/?query=Tracing+the+Arrow+of+Time+in+Vision-Language+Models&searchtype=title): video-centric encoder의 시간 방향 정보와 arrow-of-time supervision을 다루는 가장 가까운 선행 연구다.
- [CounterVid: Counterfactual Video Generation for Mitigating Action and Temporal Hallucinations in Video-Language Models](https://arxiv.org/abs/2601.04778): 생성 기반 counterfactual video와 이 논문의 정확한 pixel transformation 기반 answer balancing을 비교해 읽기 좋다.
- [Before It Fades: Reinforcing Temporal Representations at Inference Time in VideoLLMs](/papers/vlm/before-it-fades-reinforcing-temporal-representations-in-videollms): 학습 supervision 대신 추론 시 temporal activation을 보강하는 접근과 연결된다.
