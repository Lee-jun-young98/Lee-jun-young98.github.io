---
title: "Where and Why is Grounded Reasoning Useful?"
date: 2026-11-06
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "David Yan, Le Xue, Forrest Huang, Qiuyi Zhang, Dustin Tran, Andrew M. Dai, Yinfei Yang"
paper: "https://arxiv.org/abs/2611.08485"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/where-and-why-is-grounded-reasoning-useful/grounded-reasoning-pipeline.svg"
---

# 한 줄 요약

좌표를 중간 사고에 섞는 grounded reasoning은 일반 공간 추론·세밀 지각에서는 강한 text-CoT보다 낫지 않지만, 말로 고유하게 지칭하기 어려운 대상을 세고 추적할 때 효과가 크며 BrickVision에서는 동일 backbone의 text reasoning보다 21.7%p 높다.

# 논문 정보

- 제목: Where and Why is Grounded Reasoning Useful?
- 저자: David Yan, Le Xue, Forrest Huang, Qiuyi Zhang, Dustin Tran, Andrew M. Dai, Yinfei Yang (Elorian, Princeton University)
- 발표: arXiv:2611.08485v1 (2026-11-05 제출), 학회 venue는 **확인 필요**
- 링크: [arXiv 초록](https://arxiv.org/abs/2611.08485), [HTML](https://arxiv.org/html/2611.08485), [PDF](https://arxiv.org/pdf/2611.08485)
- 코드/프로젝트: 논문은 Elorian 프로젝트 URL을 적었지만 2026-11-06 확인 시 HTTP 404였고, 공개 코드·데이터 저장소도 확인하지 못함
- 키워드: grounded reasoning, coordinate CoT, visual grounding, VLM evaluation, BrickVision, counting

# 핵심 아이디어

이 논문은 “좌표를 출력하면 더 시각적으로 사고한다”는 전제를 세 단계로 검증한다.

1. **Decode-time grounding corruption**: 모델이 CoT 중 좌표를 낼 때마다 무작위 좌표로 바꾸고, 수정된 prefix로 KV cache를 다시 만든다. 이후 토큰이 틀린 좌표에 실제로 조건화되므로 좌표 사용 여부를 측정할 수 있다.
2. **matched training recipe**: Qwen3-VL-8B에 같은 QA와 reasoning 품질을 사용해 text-only와 coordinate-grounded SFT/RL을 맞대결한다. 공간 추론·지각에서는 유의한 이득이 없고 counting에서만 이득이 난다.
3. **undescribable-reference hypothesis**: wire, 동일 모양, 화살표 사슬처럼 언어로 고유하게 부르기 어려운 대상을 계속 가리켜야 할 때 좌표가 외부 포인터 역할을 한다. 동일 장면에 텍스트 label을 붙이면 text-CoT가 grounded CoT를 앞선다.
4. 이 가설을 평가하기 위해 4개 task, 총 1,000문항의 **BrickVision**을 만든다. irregular brick pile을 반복 비교하고 point 또는 integer로 답하게 해 단순 언어 label 우회를 어렵게 한다.

# VLM 관점에서 중요한 이유

- visual grounding의 가치를 “정확한 좌표를 출력했는가”와 “그 좌표를 다음 reasoning에 사용했는가”로 분리한다. grounding metric이 좋아도 task answer가 좌표에 의존하지 않을 수 있다.
- crop/zoom tool이나 visual-feature replay가 아닌 **text-coordinate-only reasoning**의 적용 경계를 밝힌다. 모든 VQA에 좌표 토큰을 강제할 근거는 약하다.
- benchmark가 언어로 쉽게 이름 붙일 수 있는 label·위치 표현을 제공하면 visual reasoning 능력을 과대평가할 수 있다는 평가 설계 문제를 제기한다.
- counting과 tracking에서 좌표는 대상을 재인식하는 표현이라기보다, 언어가 유지하기 어려운 상태를 보존하는 pointer memory로 작동한다.
- 고품질 grounding annotation과 reflection template은 좌표 사용률을 높이지만, 좌표 사용률 증가가 일반 공간 추론 정확도 향상을 보장하지 않는다.

# Method

## 1. 실제 grounding 사용량 측정

완성된 CoT에서 좌표만 사후 교체하면 뒤의 문장에 이미 파생된 관계가 남는다. 저자들은 decoding 도중 좌표가 생성될 때마다 이를 random point로 바꾸고, 편집된 prefix로 KV cache를 reset한 뒤 생성을 계속한다. 질문당 temperature 1.0으로 20개 completion을 뽑아 원래 decoding 대비 평균 accuracy 변화로 reliance를 잰다.

TreeVGR-7B-CI, TreeVGR-7B-RL, iVGR-8B, DeepEyes-7B는 공간 추론과 V\*에서 좌표 corruption의 영향이 대체로 1%p 안팎이다. 반면 CountQA에서 TreeVGR-RL은 -3.19%p, iVGR은 -2.64%p로 더 크게 떨어진다.

## 2. Grounded SFT와 RL의 통제 비교

SpatialMQA·MultihopSpatial을 기반으로 Gemini 3.5 Flash가 text rationale을 만들고, ground-truth point를 reasoning에 삽입하도록 편집한다. 오류·무관 좌표를 걸러 6,368개 SFT sample을 구성한다. Qwen3-VL-8B를 text-only 또는 grounded reasoning으로 SFT한 뒤, RL에서는 format·correctness·grounding reward를 사용한다(text-only에는 grounding reward 제외).

좌표 삽입은 단순 부착보다 `Let's look at [x,y]` 형태의 reflection이 더 강한 사용을 유도한다. 그러나 학습 좌표를 0%에서 100%까지 무작위화해 grounding reliance가 -3.63%p에서 -0.15%p로 약해져도 공간 추론·지각 정확도는 대체로 평평하다. CountQA만 좌표 품질과 함께 단조롭게 나빠진다.

## 3. 언어로 지칭하기 어려운 대상을 위한 좌표 pointer

wire-tracing, visually prompted counting, arrow-following에 direct, text CoT, grounded CoT를 각각 학습한다. arbitrary shape, 단색, 불규칙 배치로 이름·색·위치 표현을 어렵게 만들고, 대조군에는 object나 terminal에 text label을 추가한다. label이 없으면 grounded CoT가 wire-tracing 69.3%로 text CoT 24.4%를 크게 앞서지만, label을 주면 세 task 모두 text CoT가 더 좋다.

## 4. BrickVision 생성과 평가

Crop ID, fine-grained counting, duplicate, unpaired의 네 task를 각 250개 만든다. 절차적으로 만든 isometric 2D scene을 Nano Banana로 restyle하되, bounding-box 보조 render와 고정 aspect ratio를 사용해 원래 segmentation map과 정렬한다. point-answer task는 이 segmentation을 정답 좌표 판정에 사용한다.

# 핵심 그림

![이미지와 질문이 VLM에 들어가 text와 좌표가 섞인 사고를 만들고, 추론 시 좌표를 무작위화한 뒤 KV cache를 재설정해 좌표 의존도를 측정하며, 학습에서는 text-only와 grounded SFT 및 RL을 같은 조건으로 비교하고 언어 label 유무에 따라 좌표 grounding의 효용이 달라지는 전체 분석 구조](/papers/assets/vlm/where-and-why-is-grounded-reasoning-useful/grounded-reasoning-pipeline.svg)

> 그림 1. 원 논문 Figure 2, Sections 3–5, Tables 1·3을 바탕으로 재구성한 grounding 사용량 측정과 통제 학습 pipeline. 출처: [arXiv HTML Figure 2 및 Method](https://arxiv.org/html/2611.08485v1#S3), [PDF](https://arxiv.org/pdf/2611.08485#page=4). arXiv 비독점 배포 라이선스의 원본 그림을 복제하지 않고 논문 내용을 한국어로 다시 그렸다.

이 그림을 고른 이유는 논문의 기여가 새 backbone이 아니라 **좌표가 실제로 쓰이는지 검증하는 개입과, 좌표가 필요한 조건을 분리하는 통제 실험**에 있기 때문이다. 위쪽 추론 흐름에서 이미지·질문은 coordinate-grounded CoT를 만들고, 좌표가 나올 때마다 random point로 교체한 뒤 KV cache를 reset한다. 답 정확도가 내려가는 만큼이 해당 모델의 좌표 reliance다.

아래쪽 학습 흐름은 같은 Qwen3-VL과 QA에서 text-only와 grounded SFT/RL을 비교한다. 이때 grounded branch만 point annotation과 grounding reward를 받는다. 오른쪽의 조건 분기는 핵심 결론을 요약한다. label·고유 묘사가 있으면 text reference로 충분하지만, 불규칙한 동일 색 shape처럼 말로 구별하기 어려우면 좌표가 현재 대상과 이미 본 대상을 유지하는 pointer가 된다. 학습과 추론 모두 별도 vision module을 추가하지 않고 text coordinate token을 쓰며, corruption과 KV reset은 분석 시에만 적용한다.

# Experiments / Results

- 공개 benchmark는 공간 추론 6종, 세밀 지각 3종, counting 2종이다. 기본적으로 3개 checkpoint × 3개 evaluation seed, temperature 1.0을 쓰고 counting은 greedy decoding한다.
- grounded-minus-ungrounded delta는 95% confidence interval이 0을 포함하지 않을 때 유의하다고 본다.
- SFT 후 CountQA는 29.1%→32.7%(+3.6%p), FSC-147은 7.7%→10.3%(+2.6%p)다. 공간 추론과 세밀 지각 9종은 유의한 양의 이득이 없다.
- RL 후에도 CountQA +3.4%p, FSC-147 +2.1%p는 양의 이득이지만, MHS -2.7%p, EmbSpatial -1.7%p, VSR -5.5%p로 grounded recipe가 유의하게 낮다.
- BrickVision에서 동일한 in-domain Qwen3.5-9B fine-tuning은 direct 10.0%, text reasoning 61.2%, grounded reasoning 82.9%다. grounded가 text보다 +21.7%p 높다.
- frontier model 중 GPT-6 Astra가 68.7%로 가장 높고, Claude Opus 5.5 26.1%, GPT-5.6 Sol 18.9%, Gemini 3.8 Flash 15.5%다. 모델별 training·tool 사용 차이가 있어 순수 architecture 비교로 해석하면 안 된다.

## 주요 실험 결과

원 논문 Table 3의 동일 Qwen3-VL-8B, 동일 데이터·평가 설정 비교다. 값은 accuracy 비율이며 차이는 논문이 보고한 grounded−ungrounded %p와 95% confidence interval이다.

| task / benchmark | 단계 | text-only | grounded | 차이 (%p, 95% CI) | 해석                         |
| ---------------- | ---- | --------: | -------: | ----------------: | ---------------------------- |
| CountQA          | SFT  |     0.291 |    0.327 |    **+3.6 ± 2.4** | 0을 제외해 유의한 이득       |
| FSC-147          | SFT  |     0.077 |    0.103 |    **+2.6 ± 1.3** | 0을 제외해 유의한 이득       |
| MultihopSpatial  | RL   |     0.615 |    0.588 |    **-2.7 ± 1.9** | grounded가 유의하게 낮음     |
| EmbSpatial       | RL   |     0.791 |    0.775 |    **-1.7 ± 0.9** | grounded가 유의하게 낮음     |
| VSR              | RL   |     0.789 |    0.733 |    **-5.5 ± 1.3** | grounded가 유의하게 낮음     |
| V\*              | RL   |     0.876 |    0.898 |        +2.3 ± 2.7 | CI가 0을 포함, 유의하지 않음 |

counting의 성공률 차이는 CountQA +3.6%p, FSC-147 +2.6%p다. 같은 recipe가 VSR에서는 -5.5%p이므로 “좌표 grounding은 전반적으로 더 좋은 reasoning”이라는 해석은 지지되지 않는다.

원 논문 Table 4의 BrickVision 1,000문항(각 task 250개) 결과다. fine-tuned 세 행은 동일 Qwen3.5-9B를 benchmark domain에 직접 학습한 진단 실험이며, frontier model의 zero/few-shot 결과와 공정한 leaderboard 비교가 아니다.

| BrickVision method                | Crop ID % | counting % | duplicate % | unpaired % | overall % |
| --------------------------------- | --------: | ---------: | ----------: | ---------: | --------: |
| GPT-6 Astra                       |      90.0 |       25.2 |        74.8 |       84.8 |      68.7 |
| GPT-5.6 Sol                       |      35.2 |        8.4 |        11.6 |       20.4 |      18.9 |
| Gemini 3.8 Flash                  |      20.4 |       15.2 |         8.8 |       17.6 |      15.5 |
| Fine-tuned direct                 |       8.1 |       16.0 |         8.3 |        7.7 |      10.0 |
| Fine-tuned text reasoning         |      85.2 |       66.4 |        39.1 |       54.1 |      61.2 |
| **Fine-tuned grounded reasoning** |  **91.6** |   **95.3** |    **64.7** |   **79.9** |  **82.9** |

동일 fine-tuning 조건에서 grounded reasoning은 text reasoning보다 overall +21.7%p, fine-grained counting +28.9%p, duplicate +25.6%p 높다. 네 task 모두 개선되어 undescribable reference 가설과 일관된다.

# Limitations / Discussion

- 공개 benchmark 통제 학습은 주로 Qwen3-VL-8B, BrickVision 진단은 Qwen3.5-9B에 집중한다. 다른 tokenizer·coordinate format·vision resolution에서 같은 결론이 유지되는지 검증이 필요하다.
- synthetic probe는 variant당 한 번만 학습했고 BrickVision도 procedural scene을 generative style transfer한다. 자연 이미지의 장기 object identity와 occlusion으로 일반화되는지는 불분명하다.
- BrickVision in-domain fine-tuning은 benchmark의 필요 능력을 진단하지만, 일반 VLM의 zero-shot reasoning 품질을 직접 개선하는 방법은 아니다.
- 좌표 corruption은 좌표 token의 인과적 사용을 측정하지만, 모델이 이미지 feature에서 좌표와 같은 관계를 병렬로 계산하거나 corruption 자체를 무시하면 reliance를 과소평가할 수 있다.
- text-only와 grounded trace는 Gemini 3.5 Flash 편집에 의존한다. 길이·문체·정보량을 최대한 맞췄어도 rationale 생성기의 편향이 남을 수 있다.
- 저자들이 결론에서 지적하듯, grounding이 가장 필요한 대상은 말로 설명하기 어렵지만 scalable annotation은 대개 referring expression에 의존한다. 대규모 학습 data를 얻는 문제가 해결되지 않았다.
- 공개 코드와 BrickVision data 저장소를 확인하지 못해 정확한 preprocessing·scoring의 독립 재현은 현재 제한된다.

# 내가 이해한 핵심

이 논문의 가장 중요한 구분은 **grounding accuracy와 grounding utility가 다르다**는 것이다. 모델이 그럴듯한 좌표를 출력해도 답을 만드는 경로가 좌표를 읽지 않으면, 그것은 해석 가능한 장식일 수 있다. decoding 중 좌표를 망가뜨리고 이후 상태까지 다시 계산해야 비로소 사용 여부를 묻는다.

또한 coordinate CoT의 장점은 “공간을 더 잘 이해한다”기보다 **언어가 만들기 어려운 식별자를 제공한다**는 쪽에 가깝다. 빨간 원, A번 블록처럼 이름이 있으면 text token이 훌륭한 pointer다. 이름 없는 수십 개 동일 모양 사이에서 현재 위치·방문 집합을 유지해야 할 때 [x,y]가 더 압축적이고 안정적인 pointer가 된다.

따라서 다음 VLM 설계에서는 모든 reasoning step에 좌표를 강제하기보다, text reference의 ambiguity와 memory 부담을 추정해 grounding을 선택적으로 켜는 routing이 자연스럽다. 평가도 정답률뿐 아니라 좌표 corruption sensitivity, label 유무의 성능 차이, 좌표 calibration을 함께 봐야 한다.

# 다음에 연결해서 읽을 논문

- [Thinking with Visual Grounding](https://arxiv.org/abs/2606.16122) — 고품질 grounding trace 학습의 직접 비교 대상이다.
- [iVGR: Internalizing Visually Grounded Reasoning for MLLMs with Reinforcement Learning](https://arxiv.org/abs/2605.31096) — grounding을 끄면 성능이 오르는 현상에 대해 이 논문과 다른 해석을 제시한다.
- [Grounded Reinforcement Learning for Visual Reasoning](https://arxiv.org/abs/2505.23678) — correctness와 grounding reward를 결합하는 RL 계열이다.
- [BabyVision: Visual Reasoning Beyond Language](https://arxiv.org/abs/2601.06521) — 언어로 우회하기 어려운 visual reasoning benchmark라는 문제의식을 공유한다.
- [Look Where It Counts](/papers/vlm/look-where-it-counts-label-free-visual-evidence-for-fine-grained-vision-language-reasoning) — answer 변화로 visual evidence의 실제 사용을 측정한다는 관점에서 이어 읽기 좋다.
