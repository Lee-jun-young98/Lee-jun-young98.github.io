---
title: "Reinforcement Learning with Visually Attributable On-Policy Self-Distillation"
date: 2026-10-20
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Shiao Xie, Siyu Chen, Jianwei Lv, Xiandong Li, Yujin Wang"
paper: "https://arxiv.org/abs/2610.26856"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/reinforcement-learning-with-visually-attributable-on-policy-self-distillation/vag-training-pipeline.svg"
---

# 한 줄 요약

VAG는 특권 시각 crop을 쓰는 자기증류 교정이 실제 시각 근거와 같은 방향일 때만 GRPO advantage에 반영해, 동일 Qwen3.5-4B·동일 데이터 조건에서 6개 세밀 시각 추론 평균을 GRPO 69.65%에서 81.33%로 +11.68%p 높인다.

# 논문 정보

- 제목: Reinforcement Learning with Visually Attributable On-Policy Self-Distillation
- 저자: Shiao Xie, Siyu Chen, Jianwei Lv, Xiandong Li, Yujin Wang (Baidu Inc.)
- 발표: arXiv:2610.26856v1, 2026-10-19 제출. 공식 학회 채택 정보는 확인되지 않아 venue는 **확인 필요**로 두었다.
- 링크: [arXiv](https://arxiv.org/abs/2610.26856), [HTML 논문](https://arxiv.org/html/2610.26856), [PDF](https://arxiv.org/pdf/2610.26856)
- 코드/프로젝트: 공식 코드나 프로젝트 페이지는 이번 확인에서 찾지 못했다. 논문 HTML은 저자가 공개한 [Qwen3.5-4B checkpoint](https://huggingface.co/baidu/VAG-Qwen3.5-4B)와 [Qwen3.5-9B checkpoint](https://huggingface.co/baidu/VAG-Qwen3.5-9B)를 연결한다.
- 라이선스: arXiv.org perpetual non-exclusive license
- 키워드: multimodal RLVR, on-policy self-distillation, visual attribution, fine-grained perception, high-resolution VLM, token-level credit assignment

# 핵심 아이디어

RLVR는 정답 여부를 검증 가능한 reward로 주지만 한 응답의 모든 token에 같은 trajectory advantage를 배정한다. 반대로 on-policy self-distillation(OPSD)은 학생이 생성한 token을 근거가 잘 보이는 privileged crop을 받은 teacher가 다시 채점해 조밀한 교정을 주지만, teacher–student 확률 차이가 시각 근거 때문인지 문체·언어 prior·view 변화 때문인지 구분하지 못한다.

논문은 이 문제를 **privileged-correction contamination**으로 정의한다. 핵심 해법 Visual-Attribution Gating(VAG)은 같은 EMA teacher가 근거 보존 crop과 그 crop의 random-mask 버전을 각각 보게 하고, 두 view의 token log-probability 차이로 시각 근거의 방향을 측정한다. teacher–student 교정과 이 시각 contrast의 부호가 같을 때만 교정을 허용하고, 다르면 verifier 기반 GRPO advantage로 되돌아간다.

# VLM 관점에서 중요한 이유

VLM의 reasoning post-training에서는 최종 정답만 맞는 것과 중간 token이 이미지의 올바른 부분에 의존하는 것이 다르다. VAG는 이 간극을 별도 attribution model 없이 학습 신호 자체에서 다룬다. 특히 근거가 token을 지지하는 경우뿐 아니라 근거가 token을 반박하는 경우도 두 신호의 부호가 함께 음수이면 보존한다. 즉 단순히 visual-sensitive token만 고르는 것이 아니라 **교정 방향이 시각 개입과 일치하는가**를 묻는다.

이 구분은 실험에서도 중요하다. 동일 Qwen3.5-4B와 약 6.2K 학습 예제를 쓴 OPSD는 평균 69.26%로 GRPO 69.65%보다 낮지만, VAG는 81.33%다. 조밀한 teacher signal 자체보다 그 signal의 근거 귀속을 검증하는 일이 더 중요할 수 있다는 결과다.

# Method

## 1. verifier가 trajectory anchor 생성

원본 이미지와 질문에서 학생 정책이 입력당 8개 응답을 on-policy로 생성한다. task verifier의 이진 reward를 그룹 내 정규화해 $A_{\mathrm{ORM}}$을 얻는다. 이 값은 응답 전체의 정답성을 안정적으로 표시하지만 모든 token에 동일하다.

## 2. 동일 EMA teacher의 두 시각 view

positive teacher는 정답 근거를 중심으로 자른 crop $I_+$를, negative teacher는 같은 crop의 임의 직사각형을 검게 가린 $I_-$를 받는다. 두 branch는 동일 EMA 파라미터, 동일 질문, 동일 학생 생성 prefix와 token을 공유한다.

positive teacher와 학생의 sampled-token log-probability 차이를 후보 교정으로 둔다.

$$
\delta_t=\operatorname{sg}[\log p_{T+}(\hat y_t)-\log p_S(\hat y_t)].
$$

두 teacher view의 차이는 visual evidence contrast다.

$$
v_t=\operatorname{sg}[\log p_{T+}(\hat y_t)-\log p_{T-}(\hat y_t)].
$$

$\delta_t$와 $v_t$가 같은 부호면 teacher의 촉진 또는 억제가 시각 근거와 같은 방향이고, 반대 부호면 contamination으로 본다. 저자 진단에서는 반대 부호가 생성 token의 39.1%에 나타났다.

## 3. attribution gate로 GRPO advantage 변조

gate는 $g_t=\mathbbm{1}[\delta_t v_t>0]$이다. visual contrast는 sigmoid weight로, teacher correction은 tanh로 제한한 뒤 trajectory anchor에 더한다.

$$
\widetilde A_t=A_{\mathrm{ORM}}+\eta g_t\widetilde v_t\tanh(\delta_t/\tau).
$$

gate가 닫히면 token을 학습에서 버리는 것이 아니라 $\widetilde A_t=A_{\mathrm{ORM}}$으로 돌아간다. 최종 objective는 이 token-level advantage를 넣은 clipped GRPO이며 추가 학습 파라미터나 보조 loss는 없다. dual-view OPSD가 이미 두 teacher view를 계산하는 조건에서는 sign test만 추가되고 teacher forward pass도 늘지 않는다.

# 핵심 그림

![원본 이미지의 학생 rollout, verifier trajectory advantage, 근거 crop과 random-mask crop을 보는 동일 EMA teacher, 부호 일치 gate, token-level advantage와 GRPO update로 이어지는 VAG 학습 파이프라인](/papers/assets/vlm/reinforcement-learning-with-visually-attributable-on-policy-self-distillation/vag-training-pipeline.svg)

_논문 Figure 3과 Equations 2, 5, 7–10을 바탕으로 재구성._ 출처: [Figure 3과 Method](https://arxiv.org/html/2610.26856#S3), [VAG algorithm](https://arxiv.org/html/2610.26856#A4). 원문은 arXiv 비독점 라이선스이므로 원본을 복사하지 않고 한국어 설명도를 만들었다. 기여의 핵심이 정성 예시보다 **trajectory reward, dual-view teacher, token gate가 결합되는 학습 구조**에 있어 전체 architecture를 골랐다.

그림은 학습 흐름을 세 단계로 분리한다. 학생은 원본 이미지에서 응답을 생성하고 verifier는 응답 단위 $A_{\mathrm{ORM}}$을 만든다. 동일 EMA teacher의 positive branch는 근거 crop을, negative branch는 random-mask crop을 보면서 각각 $\delta_t$와 $v_t$를 계산한다. 두 값의 부호가 같을 때만 token 교정이 trajectory anchor를 변조해 GRPO update로 들어간다. 추론 시에는 verifier, crop, 두 teacher branch가 모두 제거되고 학습된 학생이 원본 이미지만 한 번 본다는 점이 agentic zoom이나 multi-pass 추론과 다르다.

# Experiments / Results

- Qwen3.5-4B를 Vision-OPD에서 파생한 약 6.2K 예제로 1 epoch full-parameter 학습한다. 입력당 rollout 8개, batch 48, 최대 1,024 token, 8×NVIDIA H800 조건이다.
- 여섯 평가 항목은 V\* Bench, ZoomBench, HR-Bench 4K/8K, MME-RealWorld EN/CN이며 모두 accuracy(%)다. 같은 규모·데이터·프로토콜의 matched baseline과 비교한다.
- VAG 평균 81.33%는 base 64.30%보다 +17.03%p, GRPO 69.65%보다 +11.68%p, OPSD 69.26%보다 +12.07%p, 가장 강한 matched baseline OPD-V 80.01%보다 +1.32%p 높다.
- OPD-V 대비 가장 큰 단일 차이는 ZoomBench의 65.92%→69.35%(+3.43%p)다. 반면 V\* Bench는 OPD-V 94.76%가 VAG 94.24%보다 0.52%p 높다.
- holdout 네 과제 평균은 base 82.65%, VAG 85.31%(+2.66%p)다. 다만 POPE는 base 88.28%에서 88.72%로 +0.44%p에 그친다.
- advantage ablation에서 $A_{\mathrm{ORM}}$만 쓴 69.65%에 raw $\delta_t$를 더하면 77.12%, visual sensitivity까지 더하면 78.80%, full gate는 81.33%다.

## 주요 실험 결과

아래 표는 논문 Table 1의 **Qwen3.5-4B matched post-training group**만 옮겼다. 모든 값은 동일한 여섯 benchmark의 accuracy(%)이며, `차이`는 VAG에서 비교 기준을 뺀 절대 차이(%p)다.

| 비교 (동일 4B·데이터·평가, accuracy %, ↑) | 비교 기준 |   VAG |         차이 |
| ----------------------------------------- | --------: | ----: | -----------: |
| Base Qwen3.5-4B, 6개 평균                 |     64.30 | 81.33 | **+17.03%p** |
| GRPO, 6개 평균                            |     69.65 | 81.33 | **+11.68%p** |
| OPSD, 6개 평균                            |     69.26 | 81.33 | **+12.07%p** |
| Vision-OPD, 6개 평균                      |     77.10 | 81.33 |  **+4.23%p** |
| OPD-V, 6개 평균                           |     80.01 | 81.33 |  **+1.32%p** |
| OPD-V, ZoomBench                          |     65.92 | 69.35 |  **+3.43%p** |

가장 공정한 주장은 matched group 평균이다. VAG가 397B·1T 모델보다 평균이 높다는 비교도 논문에 있지만 모델 규모, 학습 데이터와 평가 방식이 다르므로 위 표의 같은 조건 비교와 섞지 않았다. 수치는 [Table 1과 Section 4.3](https://arxiv.org/html/2610.26856#S4.SS3)에서 직접 대조했다.

구성요소 효과는 논문 Table 4의 동일 학습 protocol ablation이다.

| advantage 구성 (6개 평균 accuracy %, ↑) |      점수 | $A_{\mathrm{ORM}}$ 대비 |
| --------------------------------------- | --------: | ----------------------: |
| $A_{\mathrm{ORM}}$                      |     69.65 |                    기준 |
| $+\eta\delta_t$                         |     77.12 |                 +7.47%p |
| $+\eta\widetilde v_t\delta_t$           |     78.80 |                 +9.15%p |
| Full VAG                                | **81.33** |            **+11.68%p** |

raw distillation margin만으로도 큰 이득이 있지만, visual-sensitivity weighting과 sign-consistent gate가 각각 추가 이득을 만든다. 수치는 [Table 4](https://arxiv.org/html/2610.26856#S4.T4)에서 확인했다.

# Limitations / Discussion

- venue는 확인 필요다. arXiv metadata와 본문에서 CVPR/ICCV/ECCV/NeurIPS/ICML/ICLR/ACL 계열 채택을 확인하지 못했다.
- positive crop은 task-relevant evidence의 위치를 알고 있다는 전제다. 저자 데이터는 기존 Vision-OPD 계열의 합성 예제를 쓰므로, 자유형 실제 데이터에서 crop supervision을 만드는 비용과 오류가 성능에 미치는 영향은 분리되지 않았다.
- random mask가 “근거만 제거하고 나머지는 동일하게 유지한다”는 인과적 개입의 근사다. mask artifact 자체가 teacher 확률을 바꾸거나 근거를 충분히 가리지 못할 수 있다.
- 39.1% conflict 진단과 ablation은 특정 Qwen3.5-4B 및 학습 데이터에 기반한다. 다른 backbone, 언어, open-ended generation에서도 같은 오염률과 최적 $\tau,\eta$가 유지된다는 보장은 없다.
- full-parameter 1-epoch 학습에 8×H800을 사용한다. sign gate 자체는 싸지만 dual teacher replay를 포함한 전체 OPSD 학습은 계산량이 작지 않다.
- 평가는 fine-grained 고해상도 과제에 집중되어 있다. 네 holdout에서 평균은 좋아졌지만 더 넓은 document, video, grounding, agent benchmark로 일반화되었다고 말하기에는 범위가 좁다.
- 공개 checkpoint 링크는 확인했지만 이번 실행에서 공식 코드 저장소는 확인하지 못했다. 데이터 구성, crop 생성과 evaluator 세부를 완전히 재현하기 전에는 결과를 독립 검증하기 어렵다.

# 내가 이해한 핵심

이 논문의 핵심은 teacher를 더 강하게 만드는 것이 아니라 **teacher의 조언을 반사실적 시각 개입으로 감사하는 것**이다. 근거 crop에서 어떤 token 확률이 올라갔다는 사실만으로는 그 변화가 근거 때문이라고 할 수 없다. 같은 teacher가 근거를 가린 view에서 어떻게 바뀌는지를 함께 봐야 교정의 방향을 시각 정보에 귀속할 수 있다.

또한 gate가 실패한 token을 0으로 만드는 대신 trajectory-level verifier signal로 되돌리는 설계가 중요하다. attribution test는 보수적일 수 있는데, 이때 학습 신호 전체를 버리면 표본 효율이 나빠진다. VAG는 신뢰할 수 있는 조밀 신호만 추가하고 그렇지 않을 때는 이미 검증된 거친 신호를 유지한다.

다만 이 방법은 “올바른 crop”이라는 강한 학습 시점 privileged information에 의존한다. 따라서 다음 질문은 정답 근거 위치를 모르는 일반 데이터에서 evidence-present/evidence-degraded pair를 얼마나 신뢰성 있게 만들 수 있는가, 그리고 잘못된 개입에도 gate가 안전하게 동작하는가다.

# 다음에 연결해서 읽을 논문

- [Vision-OPD: Learning to See Fine Details for Multimodal LLMs via On-Policy Self-Distillation](https://arxiv.org/abs/2605.18740): VAG가 사용하는 privileged crop 기반 자기증류의 직접 선행 연구다.
- [OPD-V: Visual On-Policy Self-Distillation with Modality Balance](https://arxiv.org/abs/2608.05131): evidence-present/degraded contrast로 visual sensitivity를 측정하는 가장 강한 matched baseline이다.
- [Self-Distilled RLVR](https://arxiv.org/abs/2604.03128): verifier reward와 on-policy self-distillation을 결합하는 일반 원리를 비교할 수 있다.
- [Decomposed On-Policy Distillation for Vision-Language Reasoning](https://arxiv.org/abs/2606.00564): token correction gradient를 시각 grounding 관점에서 분해하는 대안이다.
- [V\*: Guided Visual Search as a Core Mechanism in Multimodal LLMs](https://arxiv.org/abs/2312.14135): 학습 시 privileged crop 대신 추론 시 능동 visual search를 쓰는 접근과 대비된다.
