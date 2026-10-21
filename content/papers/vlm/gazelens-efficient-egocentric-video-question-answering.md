---
title: "GazeLens for Efficient Egocentric Video Question Answering with Simple Gaze-Driven Adaptive Token Reduction"
date: 2026-10-21
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
  - "VideoQA"
  - "efficient-inference"
  - "egocentric-video"
venue: "확인 필요"
authors: "Trong-Thang Pham, Anh Nguyen, Hien Van Nguyen, Ngan Le"
paper: "https://arxiv.org/abs/2610.28502"
code: "공개 링크 확인 필요"
project: "공식 프로젝트 페이지 확인 필요"
thumbnail: "/papers/assets/vlm/gazelens-efficient-egocentric-video-question-answering/gazelens-architecture.svg"
---

# 한 줄 요약

GazeLens는 egocentric video에서 **인코딩 전 동적 프레임 선택**과 **시선·질문 조건부 공간 압축**을 결합해 프레임당 시각 토큰을 2개로 줄이면서 StreamGaze의 정확도와 입력 순전파 연산량을 함께 개선한다.

# 논문 정보

- 제목: GazeLens for Efficient Egocentric Video Question Answering with Simple Gaze-Driven Adaptive Token Reduction
- 저자: Trong-Thang Pham, Anh Nguyen, Hien Van Nguyen, Ngan Le
- 발표: arXiv:2610.28502v1, 2026-10-20 제출; venue는 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.28502) · [HTML](https://arxiv.org/html/2610.28502) · [PDF](https://arxiv.org/pdf/2610.28502)
- 코드/프로젝트: 논문에 검증 가능한 공개 링크가 없어 확인 필요
- 라이선스: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- 키워드: egocentric VideoQA, gaze-guided VLM, frame selection, token reduction, efficient inference

# 핵심 아이디어

고정 개수 프레임과 균일 샘플링은 반복·흐림 프레임에도 비용을 쓰고, gaze 중심 crop은 주변 문맥을 잃는다. GazeLens는 이 두 손실을 시간축과 공간축에서 따로 처리한다.

1. 1 FPS 후보 시퀀스에서 연속 프레임의 HOG 변화량과 Laplacian sharpness를 결합해 4–16개 프레임을 동적으로 고른다.
2. 각 선택 프레임의 patch feature를 gaze 중심 Gaussian으로 가중해 focus token을 만들고, 보완 가중치로 peripheral-context token을 만든다. 별도의 global mean token도 유지한다.
3. 질문 임베딩으로 만든 scalar gate가 focus와 context를 섞어 primary token을 만든다.
4. primary token과 global token, 즉 프레임당 2개 토큰만 LLM에 입력한다.

# VLM 관점에서 중요한 이유

- **줄이는 위치가 중요하다.** 프레임을 vision encoder 전에 제거하므로 LM token만 줄이는 방식보다 encoder 계산까지 피할 수 있다.
- **사용자 attention을 정답 evidence와 동일시하지 않는다.** gaze는 강한 prior이지만 질문이 주변 사물을 물을 수 있으므로 complementary pool과 global token을 남긴다.
- **질문이 공간 예산의 의미를 바꾼다.** 같은 gaze라도 질문에 따라 focus/context 비중을 조절해, 시선 센서 정보를 고정 crop이 아니라 조건부 representation으로 사용한다.
- 500M급 소형 VLM에서 정확도–비용 trade-off를 직접 다뤄 smart-glasses 같은 제한된 환경에 실용적이다.

# Method

## 1. Dynamic Frame Selection

연속 후보 프레임 $I_{i-1}, I_i$의 HOG descriptor 차이

$$
\delta_i=\lVert\phi(I_i)-\phi(I_{i-1})\rVert_2
$$

와 $3\times3$ Laplacian variance 기반 sharpness $\ell_i$를 clip 내부에서 정규화해 합친다. HOG는 장면·동작 변화, sharpness는 복원 가능한 공간 세부를 각각 선호한다. 점수에 따라 $t_{\min}=4$에서 $t_{\max}=16$ 사이의 프레임을 고르며, StreamGaze test에서는 평균 12.72개였다.

## 2. Focus-Aware Gaze Aggregation

선택 프레임을 vision encoder로 patch feature $F_t$로 바꾼 뒤 gaze 좌표 $(x_t,y_t)$를 중심으로 Gaussian heatmap을 만든다. 이를 정규화해 gaze-focus token $\mathbf g_t$를, 반대쪽 가중치로 complementary token $\mathbf c_t$를 구한다. 전체 patch 평균 $\mathbf m_t$는 global scene token으로 따로 남긴다. hard crop과 달리 gaze 오차가 있어도 주변 정보를 완전히 버리지 않는다.

## 3. Question-Conditioned Semantic Gating

질문 token embedding을 평균·L2 정규화하고 2-layer MLP와 sigmoid를 통과시켜 $s\in[0,1]$을 얻는다.

$$
\mathbf p_t=s\mathbf g_t+(1-s)\mathbf c_t
$$

$s$가 클수록 gaze-focus를, 작을수록 주변 문맥을 강조한다. 최종적으로 선형 projection한 $\mathbf p_t$와 $\mathbf m_t$만 질문 token과 함께 LLM에 넣는다. semantic gate, 두 projector, 그리고 LLM의 LoRA($r=8$, $\alpha=16$, q/v projection)를 4 epoch 동안 cross-entropy와 label smoothing으로 학습한다.

# 핵심 그림

![연속 egocentric video와 gaze 좌표에서 HOG·sharpness로 프레임을 선택하고, focus·context·global token을 만든 뒤 질문 조건 gate로 프레임당 두 토큰만 LLM에 전달하는 GazeLens 구조](/papers/assets/vlm/gazelens-efficient-egocentric-video-question-answering/gazelens-architecture.svg)

> 그림 1. 논문 Figure 2와 Section 3을 바탕으로 재구성한 GazeLens 전체 파이프라인. 출처: [논문 HTML의 Figure 2](https://arxiv.org/html/2610.28502#S3). 원본 그림을 그대로 복제하지 않고 학습 가능한 부분과 parameter-free 선택기를 구분해 재구성했다.

구조 그림을 고른 이유는 이 논문의 핵심 기여가 단일 성능 곡선보다 **언제 무엇을 줄이는가**에 있기 때문이다. 입력은 video·gaze·질문이고, parameter-free HOG/sharpness 선택기가 vision encoder 호출 수를 줄인다. 선택된 feature에서는 gaze Gaussian이 focus와 complement를 만들고 질문 gate가 둘을 섞으며, global mean은 항상 남는다. 학습 때는 gate/projector/LoRA가 CE loss로 갱신되지만, 추론 때는 같은 경로가 별도 teacher 없이 프레임당 2개 visual token을 출력한다.

# Experiments / Results

- 데이터: StreamGaze의 Past, Present, Proactive 질문. Macro는 세 유형의 동일 가중 평균, Micro는 전체 test example을 pooled 평가한다.
- backbone: SmolVLM2 256M/500M 계열. GazeLens 결과는 3개 seed 평균이다.
- 비용: Table 2의 TFLOPs는 입력 순전파 산술량이며 video decoding, 외부 frame selection, preprocessing, autoregressive answer generation은 제외한다.
- transfer: EgoGazeVQA의 EGTEA로 학습하고 held-out Ego4D/EgoExo 1,265개에서 평가한다.

## 주요 실험 결과

| 설정 / 지표 (%, ↑; TFLOPs ↓)       | GazeLens |            비교 기준 |            차이 | 출처    |
| ---------------------------------- | -------: | -------------------: | --------------: | ------- |
| 500M, StreamGaze Macro             |     53.9 |   SmolVLM2-500M 45.9 |          +8.0%p | Table 2 |
| 500M, StreamGaze Micro             |     64.0 |   SmolVLM2-500M 58.2 |          +5.8%p | Table 2 |
| 500M, input-forward TFLOPs         |    3.055 |  SmolVLM2-500M 4.742 | -1.687 (-35.6%) | Table 2 |
| 500M, StreamGaze Macro             |     53.9 |       LLaMA-VID 48.3 |          +5.6%p | Table 2 |
| 500M, StreamGaze Micro             |     64.0 |       LLaMA-VID 57.6 |          +6.4%p | Table 2 |
| Dynamic selector, 평균 frame 수    |    12.72 | Uniform $T=16$ 16.00 |  -3.28 (-20.5%) | Table 3 |
| Dynamic selector, StreamGaze Macro |     53.9 |  Uniform $T=16$ 52.5 |          +1.4%p | Table 3 |
| EgoGazeVQA combined accuracy       |    57.71 | Uniform $T=16$ 56.84 |         +0.87%p | Table 5 |
| EgoGazeVQA 평균 frame 수           |     5.74 | Uniform $T=16$ 15.72 |  -9.98 (-63.5%) | Table 5 |

Table 2의 동일 500M 계열 비교에서 GazeLens는 SmolVLM2-500M보다 Macro +8.0%p, Micro +5.8%p 높으면서 입력 순전파량은 35.6% 낮다. LLaMA-VID도 프레임당 두 토큰을 쓰지만, GazeLens는 gaze prior와 global token을 결합해 Macro +5.6%p를 얻는다. 다만 Voila-A는 Proactive에서 65.0%로 GazeLens의 64.5%보다 +0.5%p 높아 gaze-triggered alert에 더 유리했다.

Table 3의 controlled ablation에서는 다른 공간 압축·학습 weight를 고정한 채 dynamic selector가 uniform 16-frame보다 평균 3.28개 적은 프레임으로 Macro +1.4%p를 냈다. learned gate(53.9%) 역시 gaze only(52.4%), equal blend(52.9%), complement only(52.0%)보다 높아 질문 조건 혼합이 필요함을 뒷받침한다. EgoGazeVQA에서는 5.74 frames로 Uniform-16보다 +0.87%p지만, Uniform-7의 58.10%보다는 -0.39%p여서 모든 데이터셋에서 accuracy 우위라고 해석하면 안 된다.

# Limitations / Discussion

- gaze sensor가 없거나 좌표가 누락되면 Gaussian pooling이 사실상 uniform에 가까워져 핵심 spatial prior가 사라진다.
- temporal selector는 질문을 보지 않는다. 반복적으로 보여도 답에 필요한 프레임을 HOG 변화가 작다는 이유로 제거할 수 있다.
- 선택 프레임을 독립 encoding하므로, 변화가 없는 영역의 visual token을 frame 간 재사용하지 않는다.
- 프레임당 2 token은 fine-grained spatial reasoning에 부족할 수 있다. 질문·장면 난도에 따른 동적 spatial budget이 후속 과제다.
- 보고한 FLOPs는 end-to-end latency나 wearable 전력 측정이 아니다. frame selection, decoding, preprocessing, answer generation도 제외돼 실제 장치 효율을 그대로 뜻하지 않는다.
- egocentric video와 gaze는 사용자의 활동·주의 패턴과 주변인을 드러낼 수 있다. 저자도 동의, 수집·보관 최소화, 접근 통제를 배포 전제 조건으로 명시한다.

# 내가 이해한 핵심

이 논문의 핵심은 gaze를 “정답 위치”로 믿는 것이 아니라 **값싼 spatial proposal**으로 쓰고, 질문이 그 proposal을 얼마나 믿을지 결정하게 한 데 있다. 또한 temporal reduction을 encoder 앞에 배치하고 spatial reduction을 encoder 뒤에 배치해, 두 축의 중복을 서로 다른 비용 단계에서 제거한다. 결과적으로 단순한 2-token 표현도 focus·complement·global의 역할 분리가 되어 있으면 작은 VLM에서 꽤 강한 Pareto point를 만들 수 있다.

# 다음에 연결해서 읽을 논문

- [GazeVLM: Gaze-guided Vision-Language Models for Efficient and Robust Inference](https://openreview.net/forum?id=RAUMsywTko): gaze-guided token selection과 robustness 비교.
- [An Image is Worth 1/2 Tokens After Layer 2: Plug-and-Play Inference Acceleration for Large Vision-Language Models](https://arxiv.org/abs/2403.06764): LM 내부 visual-token pruning과 reduction stage 비교.
- [FrameFusion: Combining Similarity and Importance for Video Token Reduction on Large Visual Language Models](https://arxiv.org/abs/2501.01986): temporal redundancy 제거를 learned feature 단계에서 수행하는 접근.
- [VideoLLM-online: Online Video Large Language Model for Streaming Video](https://arxiv.org/abs/2406.11816): streaming interaction과 memory까지 확장한 설계.
