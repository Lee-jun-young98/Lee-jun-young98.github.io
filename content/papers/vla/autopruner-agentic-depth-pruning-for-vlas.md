---
title: "AutoPruner: Agentic Depth Pruning for Vision-Language-Action Models"
date: 2026-10-20
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Model Compression"
venue: "확인 필요"
authors: "Tao Lin, Yikeng Chen, Qiwei Liang, Zinan Xie, Zhengtu Liang, Renjing Xu"
paper: "https://arxiv.org/abs/2610.23880"
code: ""
project: ""
thumbnail: "/papers/assets/vla/autopruner-agentic-depth-pruning-for-vlas/overview.svg"
---

# 한 줄 요약

action 변화로 layer 민감도를 재고, LLM agent가 가지치기 구조와 recovery recipe를 폐루프 성공률 피드백으로 함께 탐색해 VLA를 실제로 짧게 만드는 방법이다.

# 논문 정보

- 제목: AutoPruner: Agentic Depth Pruning for Vision-Language-Action Models
- 저자: Tao Lin 외 5명
- 발표: 확인 필요 (arXiv v1, 2026-09-23; cs.RO 신규 목록 2026-10-20)
- 링크: [arXiv](https://arxiv.org/abs/2610.23880)
- 라이선스: arXiv perpetual non-exclusive license
- 키워드: VLA, layer pruning, agentic optimization, recovery, deployment efficiency

# 핵심 아이디어

AutoPruner는 layer를 하나씩 우회했을 때 representation 유사도가 아니라 **action chunk가 얼마나 바뀌는지** 측정한다. 이 functional probe와 이전 trial의 성공률·비용·진단을 LLM agent에게 주고, 삭제할 layer 집합과 no recovery·demonstration recovery·teacher-guided recovery 중 하나를 함께 제안하게 한다.

제안은 실제 도구로 pruning·recovery·closed-loop rollout을 거친다. 실패 원인을 구조와 recovery 부족으로 구분해 다음 proposal에 반영하고, 목표 성공률을 넘는 후보만 물리적으로 짧아진 checkpoint로 내보낸다.

# VLA 관점에서 중요한 이유

VLA 압축은 perplexity나 hidden-state similarity 같은 정적 proxy가 실제 robot success와 어긋날 수 있다. AutoPruner는 action-sensitive layer와 task별 허용 가능한 depth를 폐루프 평가로 판단하고, 삭제 구조와 성능 회복을 분리하지 않는다.

특히 OpenVLA-OFT Object에서는 32개 layer 중 4개만 남기면서 parameter·latency·memory를 함께 줄였다. 다만 이는 범용 압축률이 아니라 특정 model-suite와 recovery budget에 맞춘 deployment configuration이다.

# Robot / Embodied Setting

- models: OpenVLA-OFT, StarVLA, FastWAM
- benchmark: LIBERO Object, Spatial, Goal, Long
- main evaluation: model-suite별 500 episodes
- search case study: OpenVLA-OFT Object, 4 proposals × 200 episodes
- hardware profiling: RTX 4090, 10 warmup 뒤 50 inference requests
- calibration: model당 24 inputs로 single-layer action deviation 측정

# Method

backbone layer 집합에서 삭제 집합 $D$와 recovery recipe $r$를 골라 목표 성공률 $\tau$를 만족하면서 $|D|$를 최대화한다.

$$
\max_{D,r}|D|\quad\mathrm{s.t.}\quad \mathrm{SR}(R_r(\pi_D),\mathcal S)\ge\tau.
$$

layer $i$의 민감도는 calibration input에서 원래 policy와 해당 layer를 우회한 policy의 action chunk L2 차이로 계산한다. agent state에는 평가 이력, functional evidence, 최신 진단이 들어간다. agent는 삭제 집합과 recovery를 JSON으로 제안하고, 도구가 이를 실행한 뒤 성공률과 비용을 되돌려준다. 같은 구조도 더 강한 recovery 뒤에는 viable해질 수 있으므로 두 결정을 하나의 search loop에서 갱신한다.

# 핵심 그림

![functional layer probe와 LLM agent가 pruning, recovery, closed-loop evaluation을 반복해 배포 checkpoint를 고르는 AutoPruner 파이프라인](/papers/assets/vla/autopruner-agentic-depth-pruning-for-vlas/overview.svg)

> 그림 1. AutoPruner의 구조–회복 공동 탐색 흐름. 논문 Figure 2와 Algorithm 1을 바탕으로 직접 재구성했다. 출처: [arXiv:2610.23880](https://arxiv.org/html/2610.23880).

구조 그림을 고른 이유는 핵심이 특정 pruning mask가 아니라 **functional evidence → agent proposal → 실제 recovery·rollout → 진단 축적**의 순환에 있기 때문이다. 입력은 dense VLA, task suite, 성공률 threshold와 search budget이다.

probe는 action-sensitive layer prior를 만들고, agent는 삭제 구조와 recovery를 동시에 고른다. 도구가 물리적 pruning과 학습, 평가를 실행하며, 성공한 후보는 짧아진 checkpoint로 export된다. 실패도 다음 round의 retention rule이나 recovery 변경 근거가 된다.

# Experiments / Results

## 주요 실험 결과

아래 값은 논문 Table I–II에서 직접 대조했다. 성공률 차이는 같은 model-suite 안에서 %p로 계산했다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓) | 제안 방법 | 비교 기준 | 차이 | 출처 |
| --- | ---: | ---: | ---: | --- |
| OpenVLA-OFT Object, layer 수 (개, ↓) | 4 | dense 32 | -28 (-87.5%) | Table I |
| OpenVLA-OFT Object, 성공률 (%, ↑) | 92.6 | dense 98.2 | -5.6%p | Table I |
| OpenVLA-OFT Object, latency (ms, ↓) | 41 | dense 102 | -61 (-59.8%), 2.50× | Table I |
| OpenVLA-OFT Object, parameter (B, ↓) | 2.05 | dense 7.71 | -5.66 (-73.4%) | Table I |
| OpenVLA-OFT Object, peak memory (GiB, ↓) | 4.10 | LightVLA 14.50 | -10.40 (-71.7%) | Table II |
| FastWAM Object, 성공률 (%, ↑) | 99.8 | dense 99.8 | 0.0%p | Table I |

12개 model-suite deployment 모두 90%가 넘는 성공률을 유지하며 backbone layer의 16.7–87.5%를 제거했다. 가장 큰 압축인 OpenVLA-OFT Object는 성공률 5.6%p를 내주고 latency를 102 ms에서 41 ms로 줄였다. 반면 Long suite는 두 model에서 더 많은 layer를 유지해 task별 압축 한계가 다름을 보였다.

# Limitations / Discussion

search 한 번이 recovery 학습과 수백 회 rollout을 요구해 초기 최적화 비용이 크다. 12개 설정 모두 LIBERO이며 real robot latency·success는 검증하지 않았다. LLM agent는 GPT-5.5를 사용했지만 다른 agent, prompt, seed에 대한 안정성 비교가 제한적이다.

Table II의 baseline 성공률은 각 원 논문의 평가 출처를 따르므로 모든 runtime method가 완전히 동일한 재평가 protocol을 공유하는 것은 아니다. 92.6%가 허용 가능한지도 deployment의 안전 요구에 따라 달라진다.

# 내가 이해한 핵심

VLA layer의 redundancy는 model 전체에 고정된 성질이 아니라 task와 recovery 방식의 함수다. 그래서 정적 점수로 한 번에 자르기보다 실제 행동 성공을 oracle로 삼아 압축 실험 자체를 순차 의사결정 문제로 다루는 것이 핵심이다.

# 다음에 연결해서 읽을 논문

- Causal Analysis of Robot Foundation Models Enables Efficiency Gains: causal intervention 기반 layer 선택과 비교할 수 있다.
- Decoupled Early Exits: layer를 제거하지 않고 task별 compute를 동적으로 할당한다.
- LightVLA / VLA-Pruner: visual-token pruning과 physical depth pruning의 차이를 볼 수 있다.
