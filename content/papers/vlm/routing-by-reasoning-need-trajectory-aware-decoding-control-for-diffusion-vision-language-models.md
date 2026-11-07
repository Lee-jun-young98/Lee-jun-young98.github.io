---
title: "Routing by Reasoning Need: Trajectory-Aware Decoding Control for Diffusion Vision-Language Models"
date: 2026-09-12
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "Findings of EMNLP 2026"
authors: "Yixiang Liu, Zhongxing Xu, Zhonghua Wang, Xiaoying Tang"
paper: "https://arxiv.org/abs/2609.11315"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/routing-by-reasoning-need-trajectory-aware-decoding-control-for-diffusion-vision-language-models/routed-decoding-pipeline.svg"
---

# 한 줄 요약

Diffusion VLM의 중간 답변 궤적을 읽어 샘플별로 조기 확정, 기존 예산 유지, 추론 지원 디코딩 중 하나를 선택함으로써 고정 길이 디코딩의 과잉 정제와 성급한 종료를 함께 줄이는 training-free 방법이다.

# 논문 정보

- 제목: Routing by Reasoning Need: Trajectory-Aware Decoding Control for Diffusion Vision-Language Models
- 저자: Yixiang Liu, Zhongxing Xu, Zhonghua Wang, Xiaoying Tang
- 발표: Findings of EMNLP 2026
- 링크: [arXiv:2609.11315](https://arxiv.org/abs/2609.11315)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: diffusion VLM, adaptive decoding, reasoning budget, trajectory routing, multimodal reasoning

# 핵심 아이디어

Diffusion VLM은 답을 한 번에 왼쪽에서 오른쪽으로 확정하지 않고 반복적으로 마스킹·정제한다. 따라서 답이 이미 안정됐는지, 여전히 내부 표현이 바뀌는지, 시각 근거가 충분한지를 중간 궤적에서 관찰할 수 있다. 저자들은 모든 문제에 동일한 생성 길이를 주는 것을 reasoning-budget mismatch로 정의하고, 관찰된 상태에 따라 세 가지 디코딩 행동을 라우팅한다.

# VLM 관점에서 중요한 이유

멀티모달 추론에서 "더 오래 생각하기"는 항상 좋은 정책이 아니다. 단순 VQA는 정답이 일찍 닫힌 뒤 추가 정제로 오히려 흔들릴 수 있고, 복잡한 문제는 짧게 끝내면 시각적 근거와 chain-of-thought가 잘린다. 이 논문은 diffusion VLM의 반복 궤적 자체를 계산 예산 배분 신호로 사용해, 추론 길이를 전역 하이퍼파라미터가 아니라 입력별 제어 문제로 바꾼다.

# Method

- 동결된 LLaDA-V의 고정 예산 궤적에서 파싱 가능한 답이 한 구간 동안 얼마나 반복되는지를 answer closure로 측정한다.
- 답 형식의 유효성, 이미지 토큰 attention, prefix 지배 위험, 답 뒤집힘 위험을 결합해 visual-format closure 신호를 만든다.
- 초기 층과 최종 층의 토큰 분포 간 Jensen–Shannon divergence를 집계해 representation revision pressure를 계산한다.
- 세 신호와 CoT-sensitive guard를 이용해 `CommitRoute`, `PreserveRoute`, `ReasonRoute` 중 하나를 고른다.
- Commit은 처음 안정된 답을 확정하고, Preserve는 기본 128-step 출력을 유지하며, Reason은 미리 정한 추론 지원 설정으로 다시 디코딩한다. 모델 가중치, verifier, 정답 라벨은 사용하지 않는다.

# 핵심 그림

![이미지와 질문이 LLaDA-V의 128-step 확산 궤적을 만들고 세 신호를 거쳐 Commit, Preserve, Reason 경로로 분기되는 추론 파이프라인](/papers/assets/vlm/routing-by-reasoning-need-trajectory-aware-decoding-control-for-diffusion-vision-language-models/routed-decoding-pipeline.svg)

> **그림 1. reasoning-need routed decoding control.** 논문 Figure 2, Sections 3.1–3.6, Equations (1)–(12), Algorithm 1을 바탕으로 직접 재구성했다. 원문 그림을 복사하지 않았으며, 출처는 [arXiv:2609.11315](https://arxiv.org/html/2609.11315)이다.

구조 그림을 고른 이유는 이 논문의 기여가 별도 학습 모듈보다 **관찰된 확산 궤적을 어떤 행동으로 연결하는가**에 있기 때문이다. 입력 이미지·질문·선택적 보기/CoT 지시는 동결된 LLaDA-V의 기본 예산 $B=(T,L,M)$ 아래에서 토큰 상태 $y_t$, hidden state $H_t$, token distribution $P_t$의 128-step 궤적을 만든다. 라우터는 이 궤적에서 같은 파싱 답이 반복되는 answer closure $C_A$, 형식 유효성·image-token attention·prefix 지배·답 뒤집힘 위험을 합친 visual-format closure $C_V$, 초기층과 최종층 분포의 Jensen–Shannon divergence를 집계한 revision pressure $\rho$를 계산한다.

학습은 전혀 없고 추론 흐름만 달라진다. CoT-sensitive guard가 켜지고 답이 닫히지 않았거나 $\rho$가 높으면 **ReasonRoute**가 고정된 추론 지원 설정 $\lambda_{on}$으로 다시 디코딩한다. 답이 안정적이고 시각·형식 근거가 충분하며 revision pressure가 낮으면 **CommitRoute**가 처음 안정된 답을 확정한다. 어느 쪽도 정당화되지 않으면 **PreserveRoute**가 원래 128-step 출력을 그대로 반환한다. 즉 $C_A$, $C_V$, $\rho$는 정답 판별기가 아니라 `reason → commit → preserve` 우선순위로 안전한 행동을 고르는 신호다.

# Experiments / Results

- MME, MMMU, MMStar의 answer-focused 설정과 ScienceQA-IMG, A-OKVQA, MME-CoT의 support-sensitive 설정에서 평가했다.
- 고정 128-step 대비 MME는 73.41 → 79.96(+6.55), MMMU는 42.44 → 49.44(+7.00), ScienceQA-IMG는 75.31 → 88.60(+13.29)으로 향상됐다.
- MME-CoT에서는 2-step이 48.72, 128-step이 49.57인 반면 제안법은 52.42를 기록해 무조건 짧게 생성하는 정책이 CoT에 안전하지 않음을 보였다.
- 라우팅 분포도 과제 특성에 맞게 달랐다. MME는 75.99%를 조기 확정했지만, CoT 설정의 ScienceQA-IMG는 88.75% 유지·11.25% 추론 지원, MME-CoT는 71.79% 유지·28.21% 추론 지원으로 배분됐다.
- ScienceQA-IMG 보조 분석에서 BLEU-4 0.105 → 0.124, ROUGE-L 0.268 → 0.296, SBERT 0.697 → 0.720으로 설명 유사도도 개선됐다.

## 주요 실험 결과

논문 Table 1에서 같은 동결 LLaDA-V와 원래 benchmark parser를 사용한 `Len128` 및 제안법을 대조했다. 모든 값은 최종 답 정확도(%)이며, 차이는 `Ours − Len128`의 %p다. 서로 다른 평가 설정의 점수를 같은 행에서 직접 비교하지 않았다.

| 평가 설정     | Len128 정확도 (%) | Ours 정확도 (%) | 차이 (%p) |
| ------------- | ----------------: | --------------: | --------: |
| MME           |             73.41 |           79.96 |     +6.55 |
| MMMU          |             42.44 |           49.44 |     +7.00 |
| MMStar        |             49.90 |           50.77 |     +0.87 |
| ScienceQA-IMG |             75.31 |           88.60 |    +13.29 |
| A-OKVQA       |             83.75 |           88.75 |     +5.00 |
| MME-CoT       |             49.57 |           52.42 |     +2.85 |

표의 원자료와 조건: [논문 Table 1](https://arxiv.org/html/2609.11315). `Len128`은 모든 샘플에 같은 기본 128-step 예산을 주고, `Ours`는 같은 frozen model에서 궤적 상태에 따라 세 행동을 고른다. 가장 큰 개선은 ScienceQA-IMG의 +13.29%p이며, MME-CoT에서도 짧은 `Len2`(48.72%)가 `Len128`보다 0.85%p 낮은 반면 제안법은 `Len128`보다 +2.85%p 높다. 따라서 이득은 무조건 일찍 멈춘 결과가 아니다. 논문 Table 2의 평균 step도 MME 128.00, ScienceQA-IMG 118.09, MME-CoT 102.09로 보고되어, 정확도 향상과 실제 지연시간 절감은 설정별로 분리해 해석해야 한다.

# Limitations / Discussion

- 핵심 실험이 하나의 diffusion VLM인 LLaDA-V에 집중되어 다른 diffusion 또는 autoregressive VLM으로의 일반화는 추가 검증이 필요하다.
- 라우터는 정답 여부를 판정하지 않는다. 답이 안정됐다는 것과 답이 맞다는 것은 다르며, threshold와 guard 설계에 성능이 의존한다.
- CoT 품질 평가는 참조 텍스트 지표와 LLM judge를 사용한 보조 분석으로, 생성된 근거의 인과적 충실성을 입증하지 않는다.
- 일부 비교법은 benchmark-matched 구현이 없어 표의 직접 비교가 불완전하며, routing trace를 얻는 비용까지 포함한 실제 지연시간 이득은 설정별로 따져야 한다.

# 내가 이해한 핵심

이 논문의 포인트는 "적응형으로 step 수를 줄인다"보다 더 넓다. diffusion 궤적이 보여주는 상태를 근거로 지금 해야 할 행동을 고른다. 답이 닫혔으면 멈추고, 애매하면 안전하게 기본값을 유지하며, 추론 구조가 필요한 경우에만 지원 모드를 켠다. 즉 계산량 최적화와 추론 보존을 하나의 단축 규칙으로 해결하지 않고 명시적인 라우팅 문제로 분리한다.

# 다음에 연결해서 읽을 논문

- [LLaDA-V: Large Language Diffusion Models with Visual Instruction Tuning](https://arxiv.org/search/?query=LLaDA-V&searchtype=title)
- [Beyond Fixed: Training-Free Variable-Length Denoising for Diffusion Large Language Models](https://arxiv.org/search/?query=Beyond+Fixed+Training-Free+Variable-Length+Denoising&searchtype=title)
- [MME-CoT: Benchmarking Chain-of-Thought in Large Multimodal Models](https://arxiv.org/search/?query=MME-CoT&searchtype=title)
