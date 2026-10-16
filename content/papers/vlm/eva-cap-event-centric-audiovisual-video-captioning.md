---
title: "EVA-Cap: Optimizing Audiovisual Video Captioning via Event-Centric Alignment"
date: 2026-10-16
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "NeurIPS 2026"
authors: "Jiapeng Shi, Qiuxia Hou, Jiaqi Leng, Junke Wang, Yanhao Zhang, Haonan Lu, Ziyi Ye, Zuxuan Wu"
paper: "https://arxiv.org/abs/2610.22186"
code: "https://github.com/OPPO-Mente-Lab/EVA-Cap"
project: ""
thumbnail: "/papers/assets/vlm/eva-cap-event-centric-audiovisual-video-captioning/eva-cap-training-pipeline.svg"
---

# 한 줄 요약

EVA-Cap은 오디오·비디오 캡션을 하나의 문장으로만 보지 않고 사건의 누락, 화자 귀속, 시청각 동기화를 각각 보상하는 점진적 SFT→GRPO 학습으로, 같은 7B급 캡셔너 대비 세 event-centric 정확도를 7.4–9.5%p 높인다.

# 논문 정보

- 제목: EVA-Cap: Optimizing Audiovisual Video Captioning via Event-Centric Alignment
- 저자: Jiapeng Shi, Qiuxia Hou, Jiaqi Leng, Junke Wang, Yanhao Zhang, Haonan Lu, Ziyi Ye, Zuxuan Wu (Fudan University, OPPO AI Center)
- 발표: NeurIPS 2026. [arXiv 메타데이터](https://arxiv.org/abs/2610.22186)와 [NeurIPS 공식 Downloads 목록](https://neurips.cc/Downloads/2026)에서 확인했다.
- 링크: [arXiv:2610.22186](https://arxiv.org/abs/2610.22186), [HTML 논문](https://arxiv.org/html/2610.22186)
- 코드/프로젝트: [저자 공식 GitHub](https://github.com/OPPO-Mente-Lab/EVA-Cap). 논문이 연결한 저장소이며 공개 코드는 추후 제공 예정이라고 명시돼 있다.
- 키워드: audiovisual video captioning, omni-modal language model, event-centric alignment, GRPO, speaker attribution, temporal synchronization

# 핵심 아이디어

기존 시청각 캡셔너는 긴 정답 캡션 전체를 next-token loss나 단일 holistic reward로 학습한다. 그러면 문장이 자연스럽더라도 중요한 소리를 빼먹거나, 대사를 잘못된 인물에게 붙이거나, 맞는 사건을 틀린 장면과 동시에 일어난 것처럼 서술하는 오류가 한 점수 안에 섞인다.

EVA-Cap은 캡션을 사건열 $E=(e_1,\ldots,e_K)$로 보고 각 사건을 `(modality, type, character, content)` 튜플로 분해한다. 이 표현에서 세 보상을 만든다.

1. **Global Event Completeness $\mathcal{R}_{\mathrm{comp}}$**: 정답의 audio/visual event가 생성 캡션에 얼마나 빠짐없이 들어갔는지 recall로 잰다.
2. **Intra-Event Attribution $\mathcal{R}_{\mathrm{attr}}$**: 등장인물이 명시된 사건을 캡션이 올바른 화자·행위자에게 귀속했는지 평가한다.
3. **Inter-Event Synchronization $\mathcal{R}_{\mathrm{sync}}$**: audio event마다 hard-negative visual event 후보를 만들고, 생성 캡션에서 올바른 동시 사건을 찾는 F1을 계산한다.

세 보상을 한꺼번에 넣지 않는 것도 중요하다. 첫 GRPO 라운드는 completeness와 synchronization만 사용하고, 두 번째 라운드에서 attribution을 추가한다. 처음부터 세 보상을 모두 켜면 Table 4에서 V2A/A2V/화자 귀속/일반 캡셔닝이 모두 악화됐다. 저자들은 전역 사건 구조와 세부 화자 귀속 사이의 초기 optimization conflict로 해석한다.

# VLM 관점에서 중요한 이유

이 논문은 omni-modal 입력을 받는 것과 modality 사이의 **사건 구조를 맞게 결합하는 것**이 다르다는 점을 학습 목표 수준에서 다룬다. Qwen2.5-Omni는 이미 audio와 video를 시간 순서대로 interleave하지만, 기본 모델의 V2A/A2V 정확도는 각각 8.4%/11.9%에 불과하다. 단순 SFT만으로 44.8%/46.1%까지 올라가고, event reward까지 적용하면 55.4%/56.2%가 된다. 병목이 backbone의 입력 형식만이 아니라 supervision의 단위에도 있다는 증거다.

또한 event completeness를 높이면 보통 더 긴 캡션과 hallucination 위험이 따라온다. EVA-Cap은 completeness를 recall로 밀면서 attribution과 synchronization을 별도 제약으로 둔다. 실제로 평균 길이는 633.0→748.2 token으로 늘지만 1,000 token당 hallucination은 8.2→8.1로 증가하지 않았다. 다만 가장 긴 출력 구간에서는 DiaDem보다 hallucination이 높아 detail–faithfulness trade-off가 해결된 것은 아니다.

# Method

## 1. EVA-Data: 사건 단위 품질 관리가 있는 63K 데이터

저자들은 LLaVA-Video, FineVideo, Shot2Story에서 200초 미만 영상 100K개를 모은다. AVoCaDO가 전체 캡션을 초기화하고, Gemini-2.5-Pro가 원 영상과 초안을 함께 보고 시간 동기화와 인물 귀속을 정제한다. 별도로 Gemini-2.5-Pro가 timestamp가 있는 audio/visual event tuple을 추출하며, GPT-4.1이 각 tuple이 정제 캡션에 올바른 동기 관계로 포함됐는지 검증한다. event hit ratio 0.8 미만은 버려 최종 63K pair를 얻는다. 평균 영상 길이는 73.7초, 평균 캡션 길이는 504.3단어다.

## 2. SFT와 점진적 GRPO

Qwen2.5-Omni-7B Thinker가 audio/video를 하나의 시간 interleaved token sequence로 인코딩한다. vision/audio encoder는 동결하고 adapter와 LLM만 업데이트한다. 먼저 EVA-Data 63K 전체로 2 epoch SFT한다. 이어 reward variation이 충분한 영상만 rollout 단계에서 골라 3.2K개로 두 차례 GRPO를 수행한다.

- **GRPO stage 1:** $\mathcal{R}_{\mathrm{comp}}+\mathcal{R}_{\mathrm{sync}}$. 전역 사건 coverage와 modality 사이의 시간 결합을 먼저 맞춘다.
- **GRPO stage 2:** $\mathcal{R}_{\mathrm{comp}}+\mathcal{R}_{\mathrm{sync}}+\mathcal{R}_{\mathrm{attr}}$. 같은 사건 안에서 화자·행위자 귀속까지 세밀하게 맞춘다.

Qwen3.5-27B가 reward judge로 사용된다. synchronization reference는 각 audio event에 인접 visual event를 포함한 5개 후보를 붙여 hard negative를 만든다. SFT 모델을 영상당 8회 rollout한 뒤 평균 sync reward가 $(0,0.75)$인 query, 유효 query가 5개 이상인 영상, 합산 reward 표준편차 상위 50%만 남긴다. 이 선별은 GRPO가 이미 완전히 맞히거나 전혀 구분하지 못하는 예보다 학습 신호가 있는 예에 집중하게 한다.

# 핵심 그림

![원시 시청각 영상에서 검증된 EVA-Data를 만들고 Qwen2.5-Omni를 SFT한 뒤 completeness와 synchronization, attribution 보상을 순차적으로 추가해 EVA-Cap을 학습하는 파이프라인 재구성도](/papers/assets/vlm/eva-cap-event-centric-audiovisual-video-captioning/eva-cap-training-pipeline.svg)

_논문 Figure 2, Figure 4와 Sections 3.1–3.2를 바탕으로 재구성._ 단일 정성 예시보다 **데이터 품질 관리→모델 입력→두 단계 최적화→추론 출력**을 한눈에 연결해야 이 논문의 차별점을 이해하기 쉬워 전체 학습 아키텍처를 골랐다. 출처: [논문 Figure 2와 Figure 4](https://arxiv.org/html/2610.22186#S3), [arXiv 원문](https://arxiv.org/abs/2610.22186). 원문은 CC BY 4.0이며, 학습 전용 judge와 배포 시 추론 경계를 명확히 하기 위해 한국어 SVG로 직접 재구성했다.

그림 왼쪽은 **오프라인 데이터 구축**이다. raw video에서 holistic caption을 만들고, 원 시청각 신호를 보며 시간·화자를 정제한 뒤, 별도로 추출한 event tuple의 80% 이상이 캡션에 올바르게 반영된 sample만 EVA-Data로 남긴다. 가운데의 Qwen2.5-Omni Thinker는 동결된 audio/video encoder와 학습되는 adapter·LLM으로 구성된다. 위쪽 학습 흐름은 63K SFT 뒤 3.2K GRPO로 이어지며, stage 1이 전역 coverage와 cross-modal sync를 먼저 잡고 stage 2가 character attribution을 추가한다. 오른쪽 추론에서는 reward judge나 reference event가 필요하지 않고, 영상과 지시문만으로 하나의 상세 캡션을 생성한다.

주요 수식의 연결도 명확하다. $\mathcal{R}_{\mathrm{comp}}$는 정답 event set에 대한 coverage indicator의 평균이고, $\mathcal{R}_{\mathrm{attr}}$는 character-bearing event의 coverage와 인물 일치를 함께 요구한다. $\mathcal{R}_{\mathrm{sync}}$는 audio query별 visual candidate 선택의 F1이다. 이 합성 reward가 GRPO advantage를 통해 adapter와 LLM에 전달되며, 인코더 자체는 바뀌지 않는다.

# Experiments / Results

- backbone은 Qwen2.5-Omni-7B이고 모든 방법에서 video sampling은 2 FPS, 최대 생성 길이는 2,048이다. SFT는 batch 128, learning rate $10^{-5}$, 2 epoch이며 GRPO는 batch 16, group size 8, learning rate $2\times10^{-6}$, KL penalty 0.04다. 학습에는 NVIDIA H20 32장이 사용됐다.
- 일반 캡셔닝은 video-SALMONN-2와 UGC-VideoCap의 직접 품질 평가, Daily-Omni와 WorldSense의 caption→QA cascade로 측정한다.
- event-centric 평가는 ChronusAV의 200초 미만 영상 1,066개에서 V2A/A2V grounding을, AV-SpeakerBench Speaker Recognition 422개 QA에서 화자 귀속을 측정한다. 생성 캡션만 보고 Gemini-2.5-Pro가 QA에 답하고 Seed-1.6이 VDCscore와 정확도를 계산하므로 end-to-end 직접 답변 성능과 혼동하면 안 된다.
- Table 1에서 EVA-Cap은 video-SALMONN-2 total error 34.6%, UGC-VideoCap 평균 76.9로 같은 7B DiaDem의 36.5%와 75.6보다 각각 1.9%p 낮고 1.3%p 높다. 하지만 hallucination 단독은 EVA-Cap 17.0%, DiaDem 15.5%라 모든 축에서 우위인 것은 아니다.
- Table 4에서 SFT 후 stage 1에 completeness만 더하면 V2A +8.5%p, AV-Speaker +2.1%p, Daily-Omni +3.7%p다. synchronization을 함께 넣으면 A2V가 추가 +2.1%p, stage 2에서 attribution을 넣으면 AV-Speaker가 추가 +3.1%p 오른다.

## 주요 실험 결과

아래는 논문 Table 3의 동일한 QA-cascaded event-centric 평가 설정에서 **7B 공개 모델끼리** 비교한 값이다. V2A/A2V는 ChronusAV accuracy, AV-Speaker는 AV-SpeakerBench multiple-choice accuracy이며 모두 백분율(↑)이다. 차이는 EVA-Cap−DiaDem의 절대 정확도 차이(%p)로 계산했다.

| 모델 / 설정 (7B, %, ↑) |    V2A Acc |    A2V Acc | AV-Speaker Acc | 출처    |
| ---------------------- | ---------: | ---------: | -------------: | ------- |
| TimeChat               |       31.6 |       30.1 |           23.7 | Table 3 |
| AVoCaDO                |       40.9 |       44.9 |           26.8 | Table 3 |
| DiaDem                 |       45.9 |       47.7 |           32.7 | Table 3 |
| **EVA-Cap**            |   **55.4** |   **56.2** |       **40.1** | Table 3 |
| **EVA-Cap − DiaDem**   | **+9.5%p** | **+8.5%p** |     **+7.4%p** | 계산값  |

가장 중요한 비교는 같은 7B 크기의 강한 task-specific captioner DiaDem과의 차이다. 세 지표가 모두 오르므로 한 종류의 보상을 과도하게 최적화한 결과로 보기 어렵다. 특히 AV-Speaker +7.4%p는 completeness와 synchronization만으로 설명되지 않는 character attribution 보상의 효과와 방향이 맞는다. 수치와 평가 절차는 [논문 Table 3 및 Section 4.2](https://arxiv.org/html/2610.22186#S4.SS2)에서 직접 대조했다.

다만 폐쇄형 Gemini-2.5-Pro는 같은 표에서 V2A 61.2%, A2V 61.0%, AV-Speaker 49.1%로 EVA-Cap보다 각각 5.8, 4.8, 9.0%p 높다. “기존 방법을 모두 능가한다”가 아니라 **동급 공개 7B 모델 중 가장 강하고 폐쇄형 frontier model과의 격차를 줄였다**고 읽는 편이 정확하다.

# Limitations / Discussion

- EVA-Data 구축은 AVoCaDO뿐 아니라 Gemini-2.5-Pro와 GPT-4.1에 의존한다. 자동 검증 뒤에도 proprietary teacher의 편향과 잔여 annotation error가 남을 수 있다.
- reward 역시 Qwen3.5-27B judge에 의존한다. 저자들은 Gemini-2.5-Pro와 200개 항목에서 약 85% 일치, Gemma-4-31B-it 교체 시 유사한 향상을 보였지만, 15% 안팎의 불일치와 judge가 공유하는 blind spot은 제거되지 않는다.
- 빠른 scene transition에서는 시각 사건 누락과 audio–visual misalignment가 남고, 여러 인물과 off-screen speech가 함께 나오면 speaker binding을 틀린다. instance-level spatial/temporal grounding이 명시적이지 않은 한계다.
- event completeness가 긴 캡션을 유도한다. 길이 구간을 맞춘 부록 Table 8에서 1,000–2,048 token 출력의 hallucination은 EVA-Cap 17.0%, DiaDem 14.9%로 EVA-Cap이 2.1%p 높다.
- event precision reward를 더하면 절대 hallucination은 17.7→16.2%로 줄지만 miss rate 19.0→20.9%, Daily-Omni 53.7→51.6으로 악화된다. 더 보수적인 캡션이 반드시 더 유용하거나 length-normalized하게 충실한 것은 아니다.
- 평가가 모델 생성 캡션→Gemini QA→Seed scoring의 cascade라 caption 품질 외에 두 judge의 오류가 포함된다. 직접 human evaluation이나 완전 결정적 event grounding 지표로 동일한 결론이 유지되는지는 추가 검증이 필요하다.
- 32 H20 GPU와 여러 대형 judge 호출을 요구하는 데이터·RL pipeline은 재현 비용이 높다. 코드 저장소는 연결됐지만 arXiv v1 시점에는 코드 공개가 예정 상태다.

# 내가 이해한 핵심

EVA-Cap의 핵심은 “캡션 RL을 했다”가 아니라 **긴 문장을 평가 가능한 사건 관계로 바꾼 다음, 어려운 제약을 순서대로 학습했다**는 데 있다. coverage, cross-modal timing, character identity는 모두 캡션 충실도의 일부지만 서로 다른 난이도와 gradient 방향을 가진다. 전역 구조와 동기화를 먼저 맞추고 화자 귀속을 나중에 넣은 Table 4 결과는 세 목표를 동시에 쓰는 것보다 curriculum 자체가 중요함을 보여준다.

VLM 설계 관점에서는 backbone을 바꾸지 않고 supervision granularity만 바꿔 큰 향상을 얻었다는 점이 눈에 띈다. audio/video encoder를 동결했는데도 V2A와 A2V가 기본 모델 대비 약 47%p/44%p 상승했다. 더 나은 sensor encoder만 찾기 전에, 모델이 출력에서 보존해야 할 사건과 관계를 명시하고 그 관계별 실패를 따로 보상하는 접근이 유효하다.

동시에 이 방식은 구조를 내부적으로 완전히 학습했다기보다 강한 teacher/judge가 만든 event ontology를 모델에 증류한 것이다. 다음 단계는 캡션 뒤에서 사건을 재추출해 채점하는 대신, 모델이 timestamp·speaker·entity link를 직접 내보내고 프로그램으로 검증할 수 있게 만드는 것이다.

# 다음에 연결해서 읽을 논문

- [OmniCapBench: A Deep-Structured Evaluation Framework for Fine-Grained Audio-Visual Captioning](https://arxiv.org/abs/2610.12458): EVA-Cap이 학습한 completeness·attribution·synchronization을 Reference–Event–Shot 구조로 더 세밀하게 평가한다.
- [AVoCaDO: An Audiovisual Video Captioner Driven by Temporal Orchestration](https://arxiv.org/abs/2510.10395): EVA-Data의 초기 captioner이며, temporal orchestration 기반 SFT와 event-centric GRPO의 차이를 비교할 수 있다.
- [Qwen2.5-Omni Technical Report](https://arxiv.org/abs/2503.20215): EVA-Cap backbone의 Thinker와 audio/video interleaving 구조를 이해하는 데 필요하다.
