---
title: "OxyGen: Unified KV Cache Management for VLA Inference under Multi-Task Parallelism"
date: 2026-10-15
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "NeurIPS 2026"
authors: "Xiangyu Li et al."
paper: "https://arxiv.org/abs/2603.14371"
code: "https://github.com/air-embodied-brain/OxyGen"
project: "https://air-embodied-brain.github.io/OxyGen"
thumbnail: "/papers/assets/vla/oxygen-unified-kv-cache-management-for-vla-inference/overview.svg"
---

# 한 줄 요약

OxyGen은 하나의 관측에서 만든 KV cache를 행동·언어 expert가 공유하고, 끝나지 않은 언어 요청을 제어 주기 사이에서 연속 배치해 멀티태스크 VLA의 행동 빈도와 언어 처리량을 함께 높이는 추론 시스템이다.

# 논문 정보

- 제목: OxyGen: Unified KV Cache Management for VLA Inference under Multi-Task Parallelism
- 저자: Xiangyu Li, Huaizhi Tang, Xin Ding, Weijun Wang, Ting Cao, Yunxin Liu
- 발표: NeurIPS 2026, arXiv:2603.14371v4 (2026-10-14 교체본)
- 링크: [arXiv](https://arxiv.org/abs/2603.14371) · [HTML 원문](https://arxiv.org/html/2603.14371)
- 코드/프로젝트: [공식 코드](https://github.com/air-embodied-brain/OxyGen) · [공식 프로젝트](https://air-embodied-brain.github.io/OxyGen)
- 키워드: Mixture-of-Transformers VLA, KV cache, multi-task parallelism, continuous batching, on-device inference

# 핵심 아이디어

Mixture-of-Transformers(MoT) VLA는 같은 관측에서 행동과 언어를 생성할 수 있지만, 기존 런타임은 두 작업을 독립 요청처럼 실행해 시각·언어 prefix를 중복 계산한다. OxyGen은 KV cache를 작업과 프레임을 가로지르는 공유 자원으로 승격한다. 한 번의 prefill 결과는 행동 expert와 언어 expert가 함께 쓰고, 언어 생성 상태는 다음 프레임까지 보존되어 여러 미완료 요청과 배치된다.

# VLA 관점에서 중요한 이유

VLA의 멀티태스킹 능력은 모델 구조만으로 실시간 로봇 능력이 되지 않는다. 행동은 매 제어 주기 안에 끝나야 하지만 설명·기억·계획 같은 언어 출력은 여러 주기에 걸쳐도 된다. OxyGen은 이 비대칭 deadline을 모델 변경 없이 런타임 수준에서 다루며, action frequency를 지키면서 남는 계산 슬롯으로 언어 작업을 진전시키는 구체적 serving abstraction을 제시한다.

# Robot / Embodied Setting

- 주 모델: $\pi_{0.5}$의 공유 VLM backbone, flow-matching action expert, autoregressive language expert.
- 속도 설정: LIBERO, DROID, ALOHA의 카메라 수·해상도·action dimension을 따른 구성.
- 하드웨어: NVIDIA GeForce RTX 4090, Jetson AGX Thor.
- 일반화 검증: Xiaomi-Robotics-0, StarVLA 기반 2~4 expert 구성.
- 실제 배포: Jetson AGX Thor를 탑재한 humanoid robot, RGB 3-view $224\times224$, action horizon 10, denoising 10회.

# Method

1. 프레임 $t$의 관측 $o_t$를 VLM backbone에 한 번 입력해 modality-agnostic KV cache $\mathcal{K}_t$를 만든다.
2. 같은 $\mathcal{K}_t$를 action expert의 denoising과 새 language request의 prefix로 공유해 중복 prefill을 제거한다.
3. 각 언어 요청은 cache, 생성 토큰, 종료 상태를 담은 재개 가능한 상태 $\sigma_t=(\mathcal{K}_t,y_t,\delta_t)$로 저장한다.
4. 매 프레임 미완료 언어 상태를 하나의 batch로 쌓고 각각 $k$ token만 진행한 뒤 다시 저장한다. 행동은 해당 프레임 deadline 안에 먼저 갱신된다.
5. 고정된 출력 길이 $N$에서 작은 $k$는 batch를 키워 throughput을 높이지만 개별 언어 응답 완료 시간은 늘린다.

# 핵심 그림

![한 번의 관측 prefill을 행동과 언어 expert가 공유하고 언어 요청을 여러 제어 프레임에 걸쳐 연속 배치하는 OxyGen 구조](/papers/assets/vla/oxygen-unified-kv-cache-management-for-vla-inference/overview.svg)

> 논문 Figure 2와 Figure 3을 바탕으로 재구성. 출처: [arXiv HTML, Figure 2–3](https://arxiv.org/html/2603.14371). 입력·cache 수명·행동 deadline의 관계를 한국어로 단순화했다.

구조 그림을 고른 이유는 OxyGen의 기여가 새 VLA backbone이 아니라 cache의 소유권과 시간축을 바꾸는 런타임 데이터 흐름이기 때문이다. 입력 관측은 한 번만 prefill되고, action expert는 현재 프레임의 행동 chunk를 즉시 생성한다. language expert는 동일 cache에서 시작하되 미완료 상태를 다음 프레임으로 넘기며 다른 요청과 함께 decode한다. 따라서 학습 흐름은 바뀌지 않고 추론 스케줄만 바뀐다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (단위, ↑/↓)                              | OxyGen |       비교 기준 |               차이 | 출처                |
| --------------------------------------------------------- | -----: | --------------: | -----------------: | ------------------- |
| 실제 humanoid, 전체 추론 지연 (ms, ↓)                     |  393.4 | isolated 1029.8 | -636.4 ms (-61.8%) | 원문 Figure 8, §4.7 |
| Xiaomi-Robotics-0, RTX 4090, $N=30,k=5$ (speedup, ↑)      |  3.23× |  isolated 1.00× |             +2.23× | 원문 Table 1        |
| StarVLA Qwen3VL-PI_v3, RTX 4090, $N=30,k=5$ (speedup, ↑)  |  3.60× |  isolated 1.00× |             +2.60× | 원문 Table 1        |
| StarVLA + GR00T + OFT, 4 experts, $N=30,k=5$ (speedup, ↑) |  3.69× |  isolated 1.00× |             +2.69× | 원문 Table 1        |

실제 humanoid 수치는 같은 $\pi_{0.5}$, 같은 관측·출력 설정에서 action path와 language path를 합친 비교다. OxyGen은 1029.8 ms를 393.4 ms로 줄였고, 그중 language path는 822.3 ms에서 195.4 ms로 감소했다. 논문은 RTX 4090에서 최대 70 Hz 행동 빈도와 200 token/s 이상의 언어 처리량을 동시에 보고하지만, 이는 실제 humanoid 표와 다른 하드웨어·평가 설정이므로 같은 행에서 직접 비교하지 않았다.

# Limitations / Discussion

- 평가는 주로 행동 expert 하나와 언어 expert 하나에 집중하며 video 등 추가 출력 modality는 미검증이다.
- 언어 요청마다 고정 decoding budget $k$를 사용하므로 실제 workload에 맞춘 동적 scheduler가 필요하다.
- batch가 커지면 cache stacking/splitting 비용이 증가한다. 논문 Table 7에서 JAX batch 30의 관리 비용은 frame latency의 17.5%다.
- action quality는 유지되지만, 멀티태스크 언어 출력의 의미적 품질과 장기 로봇 작업 성공에 대한 폐루프 검증은 제한적이다.
- async control, 모델 압축, speculative decoding과의 결합은 향후 과제로 남는다.

# 내가 이해한 핵심

MoT VLA의 공유 backbone을 실제 공유 계산으로 바꾸려면, KV cache를 요청 내부 메모리가 아니라 서로 다른 deadline을 조정하는 시스템 자원으로 봐야 한다.

# 다음에 연결해서 읽을 논문

- $\pi_{0.5}$: OxyGen이 활용하는 action/language expert 구조와 원래 추론 경로를 이해하기 좋다.
- RAVEL: 연속 환경에서 비동기 action inference가 시간 지연을 다루는 방식과 비교할 수 있다.
- Decoupled Early Exits: task별 계산량 조절이라는 모델 수준 접근과 OxyGen의 런타임 수준 접근을 대비할 수 있다.
