---
title: "Language-Forcing: Advancing Humanoid Loco-Manipulation via Semantic Alignment of Whole-Body World Action Models"
date: 2026-10-20
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "World Action Model"
venue: "확인 필요"
authors: "Yanjun Li, Jiarui Ye, Weiyu Guo, Zixiao He, Kangjie Ye, Dihan Wang, Yishuo Cheng, Zishang Xiang, Mingju Gao, Hao Tang"
paper: "https://arxiv.org/abs/2610.23894"
code: ""
project: "https://openphyslab.github.io/Language-Forcing/"
thumbnail: "/papers/assets/vla/language-forcing-semantic-alignment-for-whole-body-wams/overview.svg"
---

# 한 줄 요약

현재·미래 frame을 읽은 frozen VLM의 task-progress 설명으로 WAM의 미래 시각 feature를 정렬해, 추론 비용을 늘리지 않고 휴머노이드 전신 행동 성공률을 높인다.

# 논문 정보

- 제목: Language-Forcing: Advancing Humanoid Loco-Manipulation via Semantic Alignment of Whole-Body World Action Models
- 저자: Yanjun Li 외 9명
- 발표: 확인 필요 (arXiv v1, 2026-09-28; cs.RO 신규 목록 2026-10-20)
- 링크: [arXiv](https://arxiv.org/abs/2610.23894), [프로젝트](https://openphyslab.github.io/Language-Forcing/)
- 라이선스: CC BY 4.0
- 키워드: world action model, humanoid, loco-manipulation, semantic alignment, future prediction

# 핵심 아이디어

일반 WAM의 future-frame loss는 카메라 이동 같은 큰 변화와 접촉·물체 상태 변화 같은 task-relevant 변화를 구분하지 않는다. Language-Forcing은 현재와 0.96초 뒤 frame, instruction을 frozen VLM에 주어 진행 상태와 다음 상태를 설명하게 한다. frozen text encoder가 이 설명을 embedding으로 만들고, WAM 중간의 action-conditioned future-visual feature와 cosine alignment한다.

이 보조 branch는 offline target 생성과 training에만 쓰인다. inference에서는 VLM과 text encoder를 제거하고 원래 action expert와 future prediction 경로만 사용하므로 추가 latency가 없다.

# VLA 관점에서 중요한 이유

future prediction을 쓰는 robot policy가 픽셀 수준의 예측 정확도보다 task progress를 잘 표현하도록 언어를 supervisory bottleneck으로 사용한다. instruction을 반복하는 것이 아니라 각 transition에 맞춘 “무엇이 끝났고 다음에 무엇이 변할지”를 정렬한다는 점이 중요하다.

휴머노이드 loco-manipulation에서는 몸, 접촉, 물체, camera 변화가 동시에 일어난다. language target이 이 중 행동에 중요한 변화에 attention을 모아 simulation과 실제 전신 task 모두에서 같은 WAM baseline을 개선했다.

# Robot / Embodied Setting

- simulation: HumanoidArena 전신 task, task당 200 demonstrations
- real robot: box 운반, 음식 준비, visual navigation, 옷걸이 이동, 문 열기
- real evaluation: task당 30 trials, method당 총 150 trials
- policy input: image, robot state, task instruction
- action/future model: whole-body WAM의 action expert와 future-visual tokens
- deployment: RTX 4090, KV cache·quantization 적용 시 91 ms

# Method

현재 frame $I_t$와 미래 frame $I_{t+48}$, instruction을 frozen Gemma 4 12B teacher에 넣어 transition-specific 설명 $y_t$를 만든다. UMT5 encoder의 non-padding token을 평균해 4096차원 target $e_t$를 얻는다.

WAM block $\ell$의 future-visual token $F_t^{(\ell)}$만 평균·투영하고 $e_t$와 정렬한다. 이 language loss는 기존 action flow-matching과 visual prediction objective에 더해진다. 최적 설정은 block 22, $\lambda_{LF}=1.0$이며, teacher 생성과 embedding은 offline cache된다.

# 핵심 그림

![현재와 미래 관측으로 만든 task-progress 언어 target을 WAM 중간 future-visual feature에 정렬하고 추론 때 보조 branch를 제거하는 Language-Forcing 구조](/papers/assets/vla/language-forcing-semantic-alignment-for-whole-body-wams/overview.svg)

> 그림 1. Language-Forcing의 학습·추론 구조. 논문 Figure 2와 Section 3.3을 바탕으로 직접 재구성했다. 출처: [arXiv:2610.23894](https://arxiv.org/html/2610.23894).

구조 그림을 고른 이유는 training 전용 semantic branch와 inference policy를 분리해 보여주는 것이 이 방법의 비용 특성을 가장 잘 설명하기 때문이다. 학습에서는 현재·미래 frame과 instruction이 frozen VLM·text encoder를 거쳐 transition-specific target이 된다.

WAM의 future-visual token은 image·state·action을 이미 attend하며, 이 token에만 alignment loss가 연결된다. 추론에서는 점선 branch 전체를 제거하고 action expert를 그대로 실행해 언어 supervision의 효과만 남긴다.

# Experiments / Results

## 주요 실험 결과

아래 값은 논문 Table 2–4와 Section 4.2–4.4에서 직접 대조했다. 성공률 차이는 동일한 데이터·평가 조건에서 %p로 계산했다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓) | 제안 방법 | 비교 기준 | 차이 | 출처 |
| --- | ---: | ---: | ---: | --- |
| HumanoidArena 평균 성공률 (%, ↑) | 79.17 | same WAM w/o LF 68.40 | +10.77%p | §4.2 |
| 실제 5 task 평균 성공률 (%, ↑) | 71.33 | same WAM w/o LF 53.33 | +18.00%p | Table 4 |
| 실제 음식 준비 성공률 (%, ↑) | 70.00 | w/o LF 43.33 | +26.67%p | Table 4 |
| 실제 문 열기 성공률 (%, ↑) | 70.00 | w/o LF 53.33 | +16.67%p | Table 4 |
| matched transition language, SR (%, ↑) | 79.17 | within-task shuffled 63.22 | +15.95%p | Fig. 4 |
| 70% data + LF, SR (%, ↑) | 69.64 | 100% data w/o LF 68.39 | +1.25%p | Table 3 |

실제 robot에서는 5개 task 모두 개선됐고 평균이 53.33%에서 71.33%로 18.00%p 올랐다. 같은 task의 설명을 서로 섞으면 15.95%p 하락해, 일반적인 task language가 아니라 관측 transition과 맞는 의미 supervision이 필요함을 보였다.

# Limitations / Discussion

offline language target은 강한 proprietary-scale VLM teacher 품질과 prompt에 의존하며 생성 비용이 보고의 중심이 아니다. real evaluation은 task당 30회라 세부 task 차이의 불확실성이 크고, 하나의 휴머노이드 계열과 다섯 task에 한정된다.

언어 alignment가 실제 causal representation을 학습했는지, 단지 추가 regularization인지 완전히 분리하지 못한다. future ground-truth frame을 학습 시 사용하므로 online self-improvement나 미래 관측이 없는 데이터에는 그대로 적용하기 어렵다.

# 내가 이해한 핵심

세계모델의 시각 예측에는 task와 무관한 변화가 너무 많다. 언어는 예측할 픽셀을 대신하지 않고, action-conditioned future feature가 “이 변화가 왜 중요한가”를 구분하게 하는 training-time semantic filter로 작동한다.

# 다음에 연결해서 읽을 논문

- FastWAM: Language-Forcing이 확장한 기본 world-action policy 계열이다.
- Beyond Actions / AFCE: 미래 operation target을 행동 학습과 결합하는 다른 방식이다.
- Completion Aware Guidance: task completion 신호를 WAM sampling에 쓰는 추론 방식과 대비된다.
