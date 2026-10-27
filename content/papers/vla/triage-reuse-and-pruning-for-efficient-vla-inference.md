---
title: "TRIAGE: Efficient Vision-Language-Action Inference Needs Both Reuse and Pruning"
date: 2026-10-27
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Efficient Inference"
  - "Token Pruning"
venue: "확인 필요"
authors: "Sooyoung Kwon, Carlee Joe-Wong, Kyunghan Lee"
paper: "https://arxiv.org/abs/2610.34519"
code: ""
project: ""
thumbnail: "/papers/assets/vla/triage-reuse-and-pruning-for-efficient-vla-inference/overview.svg"
---

# 한 줄 요약

TRIAGE는 visual token의 중요도와 KV-cache drift를 함께 보고 매 step마다 재계산·재사용·가지치기 중 하나를 선택해, VLA 성공률을 거의 유지하면서 Jetson의 prefill latency를 줄이는 training-free 추론 기법이다.

# 논문 정보

- 제목: TRIAGE: Efficient Vision-Language-Action Inference Needs Both Reuse and Pruning
- 저자: Sooyoung Kwon, Carlee Joe-Wong, Kyunghan Lee
- 발표: 확인 필요 (arXiv v1, 2026-10-25)
- 링크: [arXiv](https://arxiv.org/abs/2610.34519) · [HTML](https://arxiv.org/html/2610.34519)
- 코드/프로젝트: 논문 공개 시점에 확인되지 않음
- 키워드: VLA inference, KV cache, token pruning, embedded robot, latency

# 핵심 아이디어

VLA의 visual token 일부만 재계산할 때 기존 방법은 나머지를 전부 버리거나 전부 cache에서 재사용한다. TRIAGE의 진단은 cache가 현재 frame과 거의 같으면 재사용이 유리하지만 drift가 크면 stale context를 attention에 주입하므로 차라리 pruning이 낫다는 것을 보인다.

이에 따라 고정 budget 안에서 **중요하면서 cache가 유효하지 않은 token**을 우선 재계산한다. budget 밖 token은 cache drift가 threshold 아래이고 age limit 안이면 재사용하고, 그렇지 않으면 prune한다. 재계산 token 수가 고정되어 prefill latency를 직접 제어할 수 있다.

# VLA 관점에서 중요한 이유

로봇 온보드 컴퓨팅에서는 평균 속도뿐 아니라 control deadline과 tail latency가 중요하다. TRIAGE는 VLA backbone 재학습 없이 기존 KV-cache와 shallow-layer signal만 사용하며, visual token이 입력의 약 90%를 차지하는 병목을 직접 다룬다.

또한 reuse와 pruning을 경쟁하는 두 선택지가 아니라 token 상태에 따라 달리 써야 하는 보완적 연산으로 정리한다. 특히 작은 compute budget에서 stale cache가 전체 attention을 오염시키는 실패를 피한다.

# Robot / Embodied Setting

- LIBERO: Spatial, Object, Goal, Long 각 500 episodes
- SimplerEnv Google Robot: Move Near Visual Matching/Variant Aggregation, Pick Coke Can Variant Aggregation
- backbones: OpenVLA-7B(256 visual tokens), OpenVLA-OFT(두 camera, 512 visual tokens, 8-action chunk)
- hardware: NVIDIA Jetson AGX Orin과 RTX 3090, bf16; 동일 observation stream에서 suite당 250 queries latency 측정
- baselines: VLA-Cache, VLA-Pruner, SAFE-Pruner, SpecPrune-VLA, full recomputation

# Method

얕은 layer $\ell_s=2$에서 token $i$의 현재 attention value $v_{i,h}$와 마지막 재계산 때 저장한 $\bar v_{i,h}$의 head 평균 상대 변화량을 drift로 정의한다.

$$d_i=\frac{1}{H}\sum_{h=1}^{H}\frac{\lVert v_{i,h}-\bar v_{i,h}\rVert_2}{\lVert\bar v_{i,h}\rVert_2}.$$

이 계산은 $\ell_s$까지 모든 token을 처리하는 과정에서 얻으므로 추가 backbone pass가 필요 없다. importance는 decoding token이 해당 visual token에 주는 attention으로 정한다. cache validity는 drift threshold $\delta$와 최대 age $T$를 함께 사용한다.

재계산 budget $B$는 3단계로 배분된다: (1) 중요한데 cache가 무효인 token, (2) 아직 남은 중요한 token, (3) cache 유지에 필요한 maintenance token. 이후 유효 cache는 reuse하고 나머지는 prune한다. OpenVLA에서는 $B=88$, OpenVLA-OFT에서는 기본 $B=163$을 쓴다.

# 핵심 그림

![TRIAGE가 visual token의 중요도와 cache drift를 이용해 재계산, 재사용, 가지치기로 나누고 고정 budget으로 VLA backbone을 실행하는 구조](/papers/assets/vla/triage-reuse-and-pruning-for-efficient-vla-inference/overview.svg)

> 그림 1. TRIAGE의 token routing과 cache 갱신 흐름. 논문 Figures 1, 3과 Sections III–IV를 바탕으로 재구성했다. 출처: [arXiv:2610.34519, Figure 1](https://arxiv.org/html/2610.34519#S1).

구조 그림을 고른 이유는 정확도–latency trade-off가 어떤 token을 버릴지보다 세 경로로 어떻게 분기하는지에서 결정되기 때문이다. 현재 image token은 shallow layers에서 drift와 importance를 얻는다. 중요한 invalid-cache token은 먼저 고정 budget에 들어가 깊은 layer까지 재계산된다.

budget 밖에서도 cache가 유효하면 KV를 재사용해 배경 정보를 보존하고, drift가 크거나 너무 오래된 cache는 prune해 stale context 전파를 막는다. 재계산 결과는 cache를 갱신하고, 세 경로의 token representation이 action decoder로 모인다. 학습 단계는 없고 backbone weight도 바뀌지 않는다.

# Experiments / Results

## 주요 실험 결과

동일 backbone의 full recomputation 및 비슷한 가속 baseline과 비교했다. 성공률은 %p, latency는 원문 millisecond를 그대로 썼다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓)        | 제안 방법 |                비교 기준 |               차이 | 출처                      |
| --------------------------------------- | --------: | -----------------------: | -----------------: | ------------------------- |
| OpenVLA LIBERO 평균 SR (%, ↑)           |      73.7 |         SAFE-Pruner 70.1 |             +3.6%p | Table I, 동일 0.45× FLOPs |
| OpenVLA, Jetson prefill latency (ms, ↓) |     167.7 | full recomputation 229.5 |  -61.8 ms (-26.9%) | Table I                   |
| OpenVLA-OFT LIBERO 평균 SR (%, ↑)       |      95.8 |  full recomputation 97.1 |             -1.3%p | Table I                   |
| OpenVLA-OFT, Jetson E2E latency (ms, ↓) |     443.1 | full recomputation 653.0 | -209.9 ms (-32.1%) | Table I                   |
| SimplerEnv 평균 SR (%, ↑)               |      54.5 |  full recomputation 54.8 |             -0.3%p | Table II                  |
| LIBERO-Object, $B=18$ SR (%, ↑)         |      75.8 |          VLA-Pruner 51.4 |            +24.4%p | Figure 4                  |

OpenVLA-OFT에서 TRIAGE는 full recomputation 대비 prefill을 433.9→224.0 ms로 48.4% 줄이고 평균 성공률은 1.3%p 낮다. 작은 budget $B=18$에서는 reuse-only가 stale cache 때문에 0.0%, prune-only가 정보 손실로 22.4%까지 무너지지만 TRIAGE는 75.8%를 유지한다.

# Limitations / Discussion

drift threshold는 backbone·task·scene 속도에 따라 달라진다. 논문에서도 reuse가 해로워지는 지점이 OpenVLA 0.5, OpenVLA-OFT 0.3으로 달라 배포 전 calibration이 필요하다. 여러 hyperparameter는 원리적으로 유도되지 않고 development episodes에서 경험적으로 정했다.

drift는 변화가 일어난 뒤에야 감지한다. 빠른 물체 운동은 optical flow나 motion vector처럼 선행 신호가 더 적합할 수 있다. 평가도 OpenVLA 계열 두 backbone과 simulation benchmark에 한정되며 실제 이동형 robot의 전력, thermal throttling, deadline miss는 측정하지 않았다.

# 내가 이해한 핵심

TRIAGE의 핵심은 token을 **중요/불필요**로만 자르지 않고, 중요도와 cache 신선도를 분리한 것이다. 덜 중요해도 최신 cache라면 context로 남길 가치가 있고, 중요해도 오래된 cache라면 재계산하지 못할 때 버리는 편이 안전하다. 이 2축 분해가 작은 budget에서 특히 강하다.

# 다음에 연결해서 읽을 논문

- VLA-Cache: 모든 비재계산 token을 재사용하는 극단과 비교할 수 있다.
- VLA-Pruner / SAFE-Pruner: cache 없이 중요도 기반으로 token을 버리는 반대 극단이다.
- AutoPruner: token이 아니라 VLA depth를 동적으로 줄이는 구조적 가속 접근이다.
