---
title: "SR-VLA: Stall-Reduced VLA Execution via Predicted-Input Lookahead and Selective KV Cache Repair"
date: 2026-11-18
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Tao Zhang, Yi Zhong, Jinhao Ruan, Yipeng Gao, Linfeng Zhong, Youming Yang, Yuan Wang"
paper: "https://arxiv.org/abs/2611.22356"
code: ""
project: ""
thumbnail: "/papers/assets/vla/sr-vla-predicted-input-lookahead-kv-repair/overview.svg"
---

# 한 줄 요약

SR-VLA는 현재 action chunk가 실행되는 동안 다음 boundary의 image·proprioception을 예측해 frozen VLA의 KV cache와 action을 미리 계산하고, 실제 입력이 도착하면 필요한 visual-token KV만 선택적으로 고쳐 control stall을 줄인다.

# 논문 정보

- 제목: SR-VLA: Stall-Reduced VLA Execution via Predicted-Input Lookahead and Selective KV Cache Repair
- 저자: Tao Zhang, Yi Zhong, Jinhao Ruan, Yipeng Gao, Linfeng Zhong, Youming Yang, Yuan Wang
- 발표: 확인 필요 (arXiv v1, 2026-11-17; IEEE 제출 상태만 명시)
- 링크: [arXiv](https://arxiv.org/abs/2611.22356) · [HTML](https://arxiv.org/html/2611.22356v1)
- 코드/프로젝트: 공개 링크 확인되지 않음
- 키워드: asynchronous VLA, predictive lookahead, KV cache repair, control stall, speculative execution, LIBERO

# 핵심 아이디어

action chunking은 VLA 호출 횟수를 줄여도 다음 chunk boundary에서 최신 observation을 받은 뒤 전체 inference를 기다리는 stall은 남긴다. 너무 일찍 비동기 추론하면 오래된 입력과 실제 boundary state가 달라지고, 예측 결과를 무조건 쓰면 제어가 틀어지며, 전부 다시 계산하면 lookahead 이득을 잃는다. SR-VLA는 다음 boundary 입력 자체를 예측해 speculative cache–action pair를 만들고, 실제 입력과의 mismatch 및 task risk로 accept·selective repair를 결정한다.

# VLA 관점에서 중요한 이유

VLA 실시간화 연구는 작은 backbone, quantization, action tokenizer, chunk 길이에 주로 집중했지만 SR-VLA는 **입력 도착 전 계산**과 **입력 도착 후 검증**을 분리한다. 특히 speculative result를 binary accept/recompute가 아니라 transformer KV cache의 영향받은 token만 갱신하는 중간 경로로 다룬다. 따라서 backbone weight를 건드리지 않고 $\pi_{0.5}$와 OpenVLA-OFT 두 계열에 적용할 수 있다.

# Robot / Embodied Setting

평가는 LIBERO의 Spatial, Object, Goal, Long 네 suite에서 수행한다. frozen $\pi_{0.5}$는 action chunk $K=5$, frozen OpenVLA-OFT는 $K=8$을 사용하고, predictor만 학습한다. 모든 timing은 40GB A100 GPU에서 측정한다. robustness 평가는 LIBERO-Spatial에서 현재 chunk의 action 1·3·5 직전에 target object를 0, 1, 3, 5cm 이동시키고 injection point를 무작위 선택한다. 실제 로봇 실험은 없다.

# Method

1. **Next-boundary predictor:** 현재 image $o_t$, proprioception $p_t$, 이미 commit된 action chunk $A_t$를 받아 $(\hat o_{t+K},\hat p_{t+K})$를 예측한다. action/state MLP가 shared representation을 만들고, MLP state decoder와 FiLM-conditioned compact U-Net image branch가 같은 boundary를 예측한다.
2. **Speculative VLA pass:** 현재 chunk 실행과 겹쳐 predicted inputs와 instruction을 frozen VLA에 넣어 speculative KV cache $\hat{\mathcal K}_{t+K}$와 action $\hat A_{t+K}$를 미리 만든다.
3. **Query-level gate:** 실제 $(o_{t+K},p_{t+K})$가 도착하면 patch mismatch와 proprioception error를 보는 observation-driven gate, mandatory update를 보장하는 task-protection gate가 repair 필요 여부를 정한다.
4. **Token-level repair:** repair가 필요하면 predicted–real top-$k$ patch error와 task-aware top-ratio risk를 이용해 갱신할 visual-token KV entry를 고른다. 실제 입력으로 그 entry만 다시 계산하고 repaired cache에서 action을 재생성한다.
5. **Execution:** gate가 꺼지면 speculative action을 즉시 실행하고, 켜지면 repaired action으로 교체한다. 현재 실행 중인 chunk에는 speculative 결과가 영향을 주지 않는다.

# 핵심 그림

![현재 관측과 실행 중 action chunk에서 다음 boundary 입력을 예측해 frozen VLA의 speculative KV cache와 action을 만들고, 실제 입력이 도착하면 mismatch gate와 task gate로 accept 또는 선택적 KV repair를 수행하는 SR-VLA 구조](/papers/assets/vla/sr-vla-predicted-input-lookahead-kv-repair/overview.svg)

> 논문 Figure 2와 §III-A–C를 바탕으로 재구성. 출처: [arXiv HTML Figure 2 및 Method](https://arxiv.org/html/2611.22356v1#S3.F2). 캡션: action execution과 next-boundary inference를 겹치고, 실제 입력 도착 뒤 query-level trigger와 token-level selection으로 speculative cache를 검증·수정하는 SR-VLA 실행 경로.
>
> 이 그림을 고른 이유는 단순 latency chart보다 예측·검증·repair의 critical path를 한 번에 보여주기 때문이다. 학습 대상은 action/state MLP, proprio decoder, FiLM-conditioned U-Net predictor이며 base VLA는 frozen이다. 추론 중에는 현재 입력과 committed action에서 predicted boundary input을 만들고 frozen VLA가 speculative pair를 생성한다. 실제 boundary에서는 patch/proprio mismatch와 task protection이 query-level repair를 결정하고, top-$k$ error·top-ratio risk가 갱신할 KV token을 제한한다. 기존 synchronous VLA와 달리 대부분의 계산을 action 실행 시간에 숨기되, 잘못된 예측을 무조건 신뢰하지 않는다.

# Experiments / Results

## 주요 실험 결과

| LIBERO / 지표 (↑/↓)                  | SR-VLA | 같은 backbone 동기 기준 |     차이 | 출처      |
| ------------------------------------ | -----: | ----------------------: | -------: | --------- |
| $\pi_{0.5}$ 평균 성공률 (%, ↑)       |   96.9 |                    96.4 |   +0.5%p | Table III |
| $\pi_{0.5}$ query/action (ms, ↓)     |   9.59 |                   25.62 | -16.03ms | Table III |
| $\pi_{0.5}$ mean stall/query (ms, ↓) |  47.95 |                  128.11 | -80.16ms | Table III |
| $\pi_{0.5}$ query speedup (×, ↑)     |   2.67 |                    1.00 |   +1.67× | Table III |
| OpenVLA-OFT 평균 성공률 (%, ↑)       |   97.2 |                    97.1 |   +0.1%p | Table III |
| OpenVLA-OFT mean stall/query (ms, ↓) | 106.19 |                  135.18 | -28.99ms | Table III |

$\pi_{0.5}$ 계열에서 SR-VLA는 VLASH의 60.25ms보다도 stall을 12.30ms 줄이면서 평균 성공률은 96.9% 대 96.6%로 비슷하다. OpenVLA-OFT 계열의 논문 기준 speedup은 synchronous OFT 대비 1.27×이며, Table III의 1.93×는 synchronous $\pi_{0.5}$를 공통 기준으로 한 값이므로 둘을 혼동하면 안 된다. target을 5cm 이동한 조건에서 synchronous $\pi_{0.5}$와 SR-VLA 모두 성공률 72.2%이고, SR-VLA는 repair rate를 31.68%에서 60.26%로 높이면서도 1.52× query speedup을 유지한다(Figure 5c).

# Limitations / Discussion

실험은 LIBERO simulation과 단일 A100 timing에 한정되며 실제 sensor transport, controller jitter, remote inference가 섞인 robot system은 검증되지 않았다. predictor는 다음 boundary 한 점만 예측하므로 긴 chunk, 빠른 object motion, occlusion에서 오차가 커질 수 있다. suite별 threshold와 top-$k$/risk ratio를 별도로 설정해 새로운 robot·camera·task로 옮길 때 calibration 비용이 생긴다. KV cache를 명시적으로 다룰 수 없는 API형 또는 다른 내부 구조의 VLA에는 그대로 적용하기 어렵다. 공식 IEEE 게재는 확인되지 않았고 코드 공개 링크도 없다.

# 내가 이해한 핵심

SR-VLA의 핵심은 미래를 완벽히 예측하는 것이 아니라 **미리 계산한 transformer state 중 무엇을 다시 믿어도 되는지 결정하는 것**이다. prediction은 latency를 숨길 만큼만 정확하면 되고, 실제 입력은 query gate와 token repair로 안전장치를 제공한다. world-model-like predictor를 행동 생성의 주체가 아니라 scheduling과 cache reuse를 위한 시스템 구성 요소로 사용한 점이 독특하다.

# 다음에 연결해서 읽을 논문

- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): SR-VLA가 frozen backbone으로 사용하는 flow-based VLA
- [OpenVLA-OFT](https://arxiv.org/abs/2502.19645): 두 번째 backbone과 action-chunk setting
- [RAVEL](https://arxiv.org/abs/2609.34170): flow-based VLA의 asynchronous rolling inference
- [VSpark](https://arxiv.org/abs/2611.22666): autoregressive VLA를 위한 lossless speculative decoding
