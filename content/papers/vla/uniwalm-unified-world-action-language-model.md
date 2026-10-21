---
title: "UniWALM: Unified World Action Language Model for Embodied Robot Control"
date: 2026-10-21
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "World Model"
  - "Memory"
venue: "확인 필요"
authors: "Rahul Sajnani, Diego Romeres, Mingyuan Zhang, Kai Gao, Carl Qi, Baichuan Huang, Srinath Sridhar, Dylan Randle, Lillian J. Ratliff, Jose Barreiros, Manikantan Nambi, Jeroen Vanbaar"
paper: "https://arxiv.org/abs/2610.28626"
code: ""
project: "https://rahulsajnani.github.io/projects/uniwalm/"
thumbnail: "/papers/assets/vla/uniwalm-unified-world-action-language-model/overview.svg"
---

# 한 줄 요약

비디오·행동·언어를 하나의 diffusion 기반 Mixture-of-Transformers에서 동시에 생성하고, 생성한 언어를 다음 제어 스텝의 작업 기억으로 다시 넣어 별도 planner 없이 장기 조작을 수행한다.

# 논문 정보

- 제목: UniWALM: Unified World Action Language Model for Embodied Robot Control
- 저자: Rahul Sajnani 외 11명
- 발표: 확인 필요 (arXiv v1, 2026-10-20; cs.RO 신규 목록 2026-10-21)
- 링크: [arXiv](https://arxiv.org/abs/2610.28626)
- 프로젝트: [공식 프로젝트 페이지](https://rahulsajnani.github.io/projects/uniwalm/)
- 라이선스: CC BY-NC-ND 4.0
- 키워드: world-action-language model, multimodal diffusion, language memory, bimanual dexterity, flow matching

# 핵심 아이디어

UniWALM은 현재 multi-view 관측, proprioception, instruction, 선택적 anchor frame과 이전 textual memory를 받아 미래 비디오, action chunk, subtask와 memory 문자열, subtask 완료 신호를 함께 예측한다. 비디오·행동·언어 DiT는 모달리티별 head를 가지되 각 layer의 unified self-attention으로 feature를 공유한다.

언어 출력은 현재 step의 설명으로 끝나지 않는다. `subtask || memory` 문자열이 다음 step의 prompt로 되먹임되고, 완료 신호 $\beta$가 subtask가 끝났을 때만 memory를 갱신한다. 또 Flow Matching with Correction(FMC)은 교란된 action trajectory를 복구하도록 학습해 복합 목표 아래 action stream의 안정성을 보강한다.

# VLA 관점에서 중요한 이유

기존 VLA는 언어를 고정 조건으로만 쓰고, reasoning VLA는 action 전에 autoregressive text를 별도 단계로 생성하는 경우가 많다. UniWALM은 reasoning, memory, control을 동일한 diffusion pass와 shared representation에 넣어 planning latency와 외부 memory bank 의존을 피한다.

특히 real Find-the-Item에서 language memory만으로 성공률을 11.1%에서 61.1%로 높였다. 이는 language가 설명용 부산물이 아니라 관측이 가려진 뒤에도 행동을 이어 주는 제어 상태가 될 수 있음을 보여준다.

# Robot / Embodied Setting

- simulation manipulation: MolmoSpaces, DROID형 Franka, 5 task, task당 1,000 OOD episodes
- simulation memory: RMBench $M(n)$ 4 task, dual-arm AgileX, task당 100 rollouts
- real robot: Flexiv Rizon 두 팔 + Sharpa Wave/Paxini dexterous hands
- real tasks: Cube Pick & Place, Empty Container, Find the Item
- real evaluation: dexterous task당 20회, memory task 18회
- inputs: simulation 2-view, real/RMBench 3-view RGB와 proprioception, instruction

# Method

모델은 다음 joint prediction을 학습한다.

$$
\mathcal V_{1:H}, (\mathcal A,\beta)_{1:N},L
=\mathrm{UniWALM}(\mathcal O,\mathcal S,\mathcal F,T).
$$

$\mathcal V$는 미래 프레임, $\mathcal A$는 action chunk, $\beta$는 subtask 완료 gate, $L$은 `다음 subtask || textual memory`다. pretrained Wan2.2 video DiT의 30-layer 구조를 따라 작은 action/language DiT를 만들고, 세 stream의 token을 unified self-attention으로 섞는다. 학습 때는 video·action·discrete language를 함께 denoise하고 FMC로 action perturbation 복구도 학습한다. 추론 때 미래 비디오 생성은 끄되 shared representation과 language/action stream은 유지한다.

# 핵심 그림

![관측과 기억이 세 개의 DiT stream에 들어가 공유 attention을 거쳐 행동과 다음 subtask 및 textual memory를 출력하는 UniWALM 구조](/papers/assets/vla/uniwalm-unified-world-action-language-model/overview.svg)

> 그림 1. UniWALM의 video–action–language 공동 생성과 language-as-memory loop. 논문 Figure 2와 Section 3.1–3.4를 바탕으로 직접 재구성했다. 출처: [arXiv:2610.28626](https://arxiv.org/html/2610.28626).

구조 그림을 고른 이유는 성능의 핵심이 개별 backbone보다 세 modality가 같은 attention에서 정보를 교환하고, 생성 언어가 다음 control step으로 되돌아가는 폐루프에 있기 때문이다. 입력은 RGB 관측·robot state·instruction·선택적 anchor frame·이전 textual memory다.

video, action, language DiT는 각자 diffusion state를 처리하면서 unified self-attention으로 feature를 공유한다. 학습은 세 출력을 동시에 감독하고 FMC가 교란 action의 correction을 추가한다. 추론에서는 video decoding을 생략하고 action chunk와 `subtask || memory`를 출력하며, 완료 gate가 memory 갱신 시점을 정한다.

# Experiments / Results

## 주요 실험 결과

아래 값은 논문 Table 1–2에서 직접 대조했다. real-world 값은 동일 task·평가 횟수 안에서 %p로 계산했다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓) | 제안 방법 | 비교 기준 | 차이 | 출처 |
| --- | ---: | ---: | ---: | --- |
| real Find the Item, 성공률 (%, ↑) | 61.1 | FastWAM 11.1 | +50.0%p | Table 2, 18 trials |
| real Find the Item, 성공률 (%, ↑) | 61.1 | MolmoB0t 33.3 | +27.8%p | Table 2, 18 trials |
| real Cube Pick&Place, 성공률 (%, ↑) | 95.0 | 차상위 80.0 | +15.0%p | Table 2, 20 trials |
| real 3-task 평균 성공률 (%, ↑) | 68.7 | MolmoB0t 44.4 | +24.3%p | Table 2 |
| MolmoSpaces Pick&Place-Color, 성공률 (%, ↑) | 70.8 | FastWAM 54.4 | +16.4%p | Table 1, 1,000 episodes |
| MolmoSpaces Pick&Place-NextTo, 성공률 (%, ↑) | 38.8 | FastWAM 32.0 | +6.8%p | Table 1, 1,000 episodes |

단순 grasp인 Pick과 Pick-RandCam에서는 UniWALM이 MolmoB0t history variant보다 낮다. 반면 compositional placement와 memory task에서 격차가 커져, language loop의 이점이 짧은 reaching보다 단계 추적과 기억이 필요한 설정에 집중됨을 보여준다.

# Limitations / Discussion

pretrained language/reasoning model 없이도 장점이 있다는 점은 흥미롭지만, language/action DiT와 FMC·LoRA가 함께 추가돼 각 요소의 독립 기여를 완전히 분리하기 어렵다. real-world 평가는 58 rollouts와 세 task에 한정되고 Find-the-Item은 18회라 신뢰구간이 넓다.

언어 기억은 compact하지만 잘못 생성된 기억이 다음 step으로 누적되는 위험이 있다. 논문은 RMBench에서 anchor frame과 완료 gate를 사용하지만, 더 긴 horizon·자유형 instruction·안전-critical recovery에서 memory corruption이 어떻게 관리되는지는 남아 있다.

# 내가 이해한 핵심

이 논문의 가장 중요한 변화는 “VLA가 언어를 이해한다”가 아니라 “정책이 만든 언어를 다음 행동의 상태 변수로 다시 소비한다”는 점이다. world prediction, control, task memory를 같은 representation에 묶어 language를 외부 planner의 출력이 아니라 recurrent control interface로 만든다.

# 다음에 연결해서 읽을 논문

- MemoryVLA: 별도 perceptual-cognitive memory와 생성 언어 memory를 비교할 수 있다.
- Fast-WAM: test-time future generation을 제거한 동일 video backbone 계열의 기준점이다.
- World Action Models are Zero-shot Policies: video-action 공동 생성이 시작된 기본 WAM 계열이다.
