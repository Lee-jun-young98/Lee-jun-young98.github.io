---
title: "VideoLVR: Latent Visual Reasoning over Grounded Video Evidence"
date: 2026-10-28
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Shilong Li, Xingyuan Bu, Hao Shi, Yun Xing, Weixin Feng, Qiangpeng Yang, Shilei Wen"
paper: "https://arxiv.org/abs/2610.37613"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/videolvr-latent-visual-reasoning-over-grounded-video-evidence/videolvr-architecture.svg"
---

# 한 줄 요약

VideoLVR는 비디오 속 시공간 근거를 입력 영상의 시각 토큰 어휘에서 찾아 잠재 블록으로 되먹임하고, 텍스트와 시각 토큰 행동을 함께 강화학습해 추가 프레임을 문맥에 붙이지 않고도 근거 기반 비디오 추론을 개선한다.

# 논문 정보

- 제목: VideoLVR: Latent Visual Reasoning over Grounded Video Evidence
- 저자: Shilong Li, Xingyuan Bu, Hao Shi, Yun Xing, Weixin Feng, Qiangpeng Yang, Shilei Wen
- 발표: arXiv:2610.37613v1 (2026-10-27), venue 확인 필요
- 링크: [arXiv 초록](https://arxiv.org/abs/2610.37613), [PDF](https://arxiv.org/pdf/2610.37613)
- 코드/프로젝트: 공식 공개 링크 확인 필요
- 라이선스: [arXiv 비독점 배포 라이선스](https://arxiv.org/licenses/nonexclusive-distrib/1.0/)
- 키워드: video-language model, latent visual reasoning, visual grounding, video QA, visual token prediction, reinforcement learning

# 핵심 아이디어

긴 비디오를 chain-of-thought(CoT)만으로 추론하면 뒤 단계에서 앞서 본 시각 근거를 잊기 쉽다. 타임스탬프와 bounding box를 텍스트로 쓰면 위치는 남지만 실제 시각 내용은 남지 않고, crop·frame을 다시 넣으면 근거가 늘 때마다 멀티모달 문맥이 커진다.

VideoLVR는 각 추론 주장에 필요한 여러 시점의 local region을 하나의 **grouped latent visual block**으로 묶는다. 학습 때는 이 region들이 가리키는 시각 토큰을 정답으로 삼고, 현재 영상의 모든 시각 토큰을 후보 어휘로 둔 visual token prediction(VTP)을 수행한다. 추론 때는 decoder hidden state를 시각 embedding 공간으로 투영한 연속 latent state를 다음 입력으로 되먹임하므로 새 crop이나 frame을 다시 인코딩하지 않는다.

강화학습 단계의 text–visual policy optimization(TVPO)은 입력 영상 어휘에서 고른 시각 토큰 index도 텍스트 토큰과 같은 action으로 취급한다. 최종 답의 정오 reward가 어떤 말을 생성할지뿐 아니라 어떤 시각 근거를 latent feedback으로 선택할지도 함께 최적화한다.

# VLM 관점에서 중요한 이유

- visual grounding을 읽을 수 있는 좌표 출력이 아니라 **추론 중 재사용할 시각 내용**의 문제로 다룬다.
- 입력 영상 자체를 sample-specific visual vocabulary로 사용한다. 별도 visual tokenizer나 고정 codebook 없이 같은 영상 안의 유사 토큰을 negative로 삼아 시간 중복을 구별한다.
- 여러 시점의 region을 같은 주장 단위로 묶어, frame별 근거가 아니라 추론 단계가 요구하는 temporally distributed evidence를 표현한다.
- continuous latent feedback의 효율과 discrete visual action의 강화학습 가능성을 연결한다. SFT에서는 연속 query를 되먹이고, TVPO에서는 샘플한 실제 visual token embedding을 되먹인다.
- zero/noise intervention에서도 성능이 떨어져 latent block이 단순한 추가 계산 슬롯이 아니라 학습된 시각 정보를 운반한다는 통제 근거를 제시한다.

# Method

1. OneThinker와 Video-R1의 video QA에서 Qwen3-VL-30B-A3B-Thinking teacher가 텍스트 추론, 중간 주장, timestamp와 box로 된 시공간 근거를 함께 만든다. 답 일치, evidence 형식·유효성 검사를 통과한 trajectory만 남기고, 각 evidence를 실제로 쓰는 문장 앞에 오도록 teacher가 다시 정렬한다.
2. 근거 그룹 $\mathcal G_k=(c_k,\mathcal R_k)$는 주장 $c_k$와 여러 region $r_{k,j}=(t_{k,j},b_{k,j})$를 연결한다. 각 box를 영상 encoder의 시공간 token grid에 사상하고, region 내부 token을 읽기 순서로 모은 뒤 region들을 timestamp 순으로 이어 하나의 target sequence $\widetilde E_k$를 만든다.
3. 텍스트와 latent block 사이에는 `<bot>`/`<eot>` 경계를 둔다. 두 층 MLP $g_\phi$가 latent 위치 직전 hidden state $h_{k,l}$를 visual query $q_{k,l}$로 바꾼다. 입력 영상의 전체 visual token $V=(v_1,\ldots,v_N)$에 대해 $-\lVert q-v_i\rVert_2^2/(d\tau)$를 logit으로 사용해 목표 token index를 분류한다.
4. SFT 손실은 $\mathcal L_{\mathrm{SFT}}=\mathcal L_{\mathrm{text}}+\lambda\mathcal L_{\mathrm{VTP}}$다. text position은 next-token prediction, latent position은 VTP로 학습하며, target visual embedding을 latent 입력에 teacher forcing한다.
5. SFT 추론에서는 `<bot>` hidden state를 $g_\phi$로 투영해 첫 latent state를 만들고, 이어지는 hidden state도 같은 방식으로 되먹인다. 고정 예산 $K=8$개를 생성한 뒤 controller가 `<eot>`를 넣고 텍스트 생성을 재개한다. 추가 영상 관찰은 문맥에 넣지 않는다.
6. TVPO에서는 visual query가 만든 분포에서 입력 영상 token index를 샘플한다. 텍스트·시각 action 전체에 최종 답 정오로 계산한 group-normalized advantage를 공유하고 GRPO clipping objective로 language model과 $g_\phi$를 함께 업데이트한다.
7. 주 설정은 2 FPS, 최대 256 frames, frame당 131,072 pixels다. SFT는 8.8K trajectory를 2 epochs 학습하고, RL은 SFT 모델이 8회 모두 맞힌 쉬운 문제를 제외한 19K multiple-choice question에서 prompt당 8 rollouts를 사용한다.

# 핵심 그림

![비디오와 질문에서 시공간 근거 trajectory를 만들고 visual token prediction으로 텍스트와 잠재 시각 블록을 공동 학습한 뒤, 추론에서 latent state를 되먹이며 TVPO가 텍스트와 시각 행동을 함께 최적화하는 VideoLVR 구조](/papers/assets/vlm/videolvr-latent-visual-reasoning-over-grounded-video-evidence/videolvr-architecture.svg)

> 그림 1. 논문 Figure 1과 식 (1)–(9)을 바탕으로 재구성한 VideoLVR의 데이터 합성, SFT, 추론, TVPO 흐름. 출처: [arXiv PDF Figure 1 및 Sections 3–4](https://arxiv.org/pdf/2610.37613). arXiv 비독점 배포 라이선스이므로 원본을 복사하지 않고 한국어 설명도로 재구성했다.

전체 아키텍처 그림을 고른 이유는 이 논문의 차별점이 근거 annotation 자체보다 **localized region → grouped visual target → latent feedback → joint text/visual policy**로 이어지는 연결에 있기 때문이다. 입력 비디오와 질문에서 teacher가 중간 주장별 시공간 근거를 만든다. 같은 주장을 지지하는 여러 시점의 region은 timestamp 순으로 합쳐지고, decoder는 텍스트 사이에 잠재 시각 블록을 생성한다.

학습에서는 $\mathcal L_{\mathrm{text}}$가 추론 문장을, $\mathcal L_{\mathrm{VTP}}$가 입력 영상 어휘 안에서 정확한 근거 token을 구별하도록 한다. SFT 추론에서는 연속 projected state를 $K$회 되먹여 문맥 증가를 피한다. TVPO에서는 실제 token index를 샘플한 discrete visual action과 text action 모두에 답 정오 advantage를 적용한다. 기존 좌표 grounding과 달리 위치 표기만 남기지 않고, crop 재삽입 방식과 달리 새 multimodal observation을 계속 추가하지 않는 것이 핵심 변화다.

# Experiments / Results

- Video-MMMU, TempCompass, MMVU, LongVideo-Reason, VideoMathQA의 zero-shot accuracy를 LMMs-Eval로 평가한다. 재현 결과는 기본적으로 3회 전체 평가 평균이며, 종합 점수는 다섯 benchmark 점수의 비가중 평균이다.
- 같은 Qwen3-VL-8B backbone에서 VideoLVR SFT 평균은 63.95%로 원 backbone 61.31%보다 +2.64%p, 같은 8.8K trajectory를 MSE로 학습한 LVR-8B 62.71%보다 +1.24%p다.
- 같은 SFT 초기값·RL data의 통제 비교에서 TVPO는 text action만 학습하는 GRPO를 다섯 benchmark 모두 앞서며 평균 63.31%→64.39%(+1.08%p)다.
- grouped evidence는 First-Region 63.15%, Per-Region 63.11%보다 각각 +0.80%p, +0.84%p 높다. 서로 관련된 여러 시점의 근거를 같은 reasoning block에 두는 설계가 유효하다는 근거다.
- latent step을 끄면($K=0$) 62.12%, $K=8$은 63.95%다(+1.83%p). $K=16/32$에서는 다시 낮아져 latent budget을 늘리는 것만으로 성능이 단조 증가하지 않는다.
- 8-step 경계는 유지한 채 state를 zero/noise로 바꾸면 평균이 62.75%/62.07%로 하락한다. 학습된 latent content가 full 모델 대비 각각 +1.20%p/+1.88%p를 기여한다.

## 주요 실험 결과

Table 1의 동일 Qwen3-VL-8B backbone과 공식 zero-shot 설정만 비교했다. 값은 accuracy이며 차이는 절대 %p다. VideoSearcher는 원 논문의 다른 평가 설정이라 표에서 제외했다.

| Benchmark / 지표 (accuracy %, ↑) | VideoLVR-8B | Qwen3-VL-8B-Instruct |    차이 | 출처    |
| -------------------------------- | ----------: | -------------------: | ------: | ------- |
| Video-MMMU 평균                  |       67.44 |                64.33 | +3.11%p | Table 1 |
| TempCompass                      |       77.39 |                73.89 | +3.50%p | Table 1 |
| MMVU                             |       61.70 |                59.30 | +2.40%p | Table 1 |
| LongVideo-Reason                 |       78.20 |                76.40 | +1.80%p | Table 1 |
| VideoMathQA                      |       35.00 |                32.62 | +2.38%p | Table 1 |
| 다섯 benchmark 비가중 평균       |       63.95 |                61.31 | +2.64%p | Table 1 |

모든 benchmark에서 같은 방향의 이득이 나타나므로 평균 향상이 한 데이터셋에만 의존하지 않는다. 특히 TempCompass와 Video-MMMU의 이득은 temporal perception과 전문 영상 이해에서 grounding된 latent evidence가 유용함을 시사한다. 다만 Table 1은 표준편차나 통계적 유의성을 제시하지 않으므로 작은 차이를 과대해석하면 안 된다.

TVPO의 고유 효과는 같은 초기 모델과 RL 데이터로 맞춘 Table 5에서 보는 편이 안전하다.

| RL 방식 / 지표 (accuracy %, ↑) |  TVPO | text-only GRPO |    차이 | 출처    |
| ------------------------------ | ----: | -------------: | ------: | ------- |
| Video-MMMU 평균                | 68.22 |          67.11 | +1.11%p | Table 5 |
| TempCompass                    | 77.60 |          77.33 | +0.27%p | Table 5 |
| MMVU                           | 60.50 |          59.40 | +1.10%p | Table 5 |
| LongVideo-Reason               | 79.90 |          77.70 | +2.20%p | Table 5 |
| VideoMathQA                    | 35.71 |          35.00 | +0.71%p | Table 5 |
| 다섯 benchmark 비가중 평균     | 64.39 |          63.31 | +1.08%p | Table 5 |

# Limitations / Discussion

- 저자도 밝히듯 8.8K SFT trajectory가 synthesized spatio-temporal grounding에 의존한다. teacher가 잘못 짚은 timestamp·box나 누락한 근거가 그대로 latent target을 제한할 수 있다.
- latent state는 사람이 직접 읽을 수 있는 좌표·crop보다 실패 원인을 해석하기 어렵다. intervention은 정보가 실렸음을 보이지만 어떤 객체·사건이 표현됐는지까지 설명하지 않는다.
- RL reward는 final-answer correctness 하나뿐이다. 올바른 근거를 골랐는지 직접 보상하지 않아 shortcut policy가 정답만 맞힐 가능성을 완전히 배제하지 못한다.
- SFT 학습의 latent 길이는 target region 크기에 따라 달라지지만 추론은 고정 $K=8$이다. $K=16/32$에서 오히려 하락하므로 질문별 budget routing이 필요할 수 있다.
- 최대 256 frames, 2 FPS라는 입력 범위 안의 실험이다. 훨씬 긴 비디오, 매우 짧은 순간, audio가 핵심인 질문으로 일반화되는지는 별도 검증이 필요하다.
- 코드·데이터 생성 파이프라인의 공식 공개 링크와 top-conference venue를 확인하지 못했다. 독립 재현성과 학회 상태는 후속 확인이 필요하다.

# 내가 이해한 핵심

VideoLVR의 가장 흥미로운 점은 latent visual reasoning을 단순한 feature regression으로 보지 않는 데 있다. 비디오에서는 인접 frame의 token이 매우 비슷하므로 MSE로 한 점을 따라가게 하는 것만으로는 “어느 순간의 어느 근거인지”를 구별하라는 압력이 약하다. 입력 영상 전체를 그 샘플의 어휘로 바꾸면, VTP는 정답 token을 비슷한 시간대의 token과 직접 경쟁시킨다. Table 2의 MSE 대비 +1.24%p는 이 분류 관점이 실제로 더 적합하다는 통제 결과다.

또 SFT와 RL의 표현 방식이 미묘하게 다르다. SFT는 projection head가 만든 연속 state를 되먹여 부드러운 내부 사고를 얻고, TVPO는 같은 분포에서 token index를 샘플해 policy gradient가 걸리는 discrete action으로 바꾼다. 즉 **연속 표현의 효율**과 **이산 행동의 학습 가능성**을 한 visual vocabulary 위에서 연결한 설계다.

# 다음에 연결해서 읽을 논문

- [Latent Visual Reasoning](https://arxiv.org/abs/2509.24251) — VideoLVR가 비디오와 VTP로 확장한 MSE 기반 latent visual reconstruction의 직접 선행 연구.
- [Open-o3-Video: Grounded Video Reasoning with Explicit Spatio-Temporal Evidence](https://arxiv.org/abs/2510.20579) — timestamp와 box를 텍스트 reasoning 안에 노출하는 explicit grounding 접근.
- [VideoLatent: Video-Language Learning via Latent Self-Forcing](https://arxiv.org/abs/2606.22870) — localized evidence annotation 없이 video QA에서 latent reasoning을 학습하는 비교 대상.
- [Joint Latent Reasoning and Observation for Agentic Video Understanding](/papers/vlm/joint-latent-reasoning-and-observation-for-agentic-video-understanding) — frame acquisition agent에서 reasoner–observer 통신 전체를 latent interface로 바꾼 대응 사례.
