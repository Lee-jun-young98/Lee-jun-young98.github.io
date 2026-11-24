---
title: "SANA-Robot: Efficient World Action Model with Hybrid Memory"
date: 2026-11-24
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Yuyang Zhao, Zekai Li, Yicheng Pan, Jiaming Tang, Zhuoyang Zhang, Jiaxu Xing, Moritz Reuss, Quanquan Peng, Junsong Chen, Enze Xie, Zhijian Liu, Song Han"
paper: "https://arxiv.org/abs/2611.28943"
code: ""
project: "https://nvlabs.github.io/Sana/Robot/"
thumbnail: "/papers/assets/vla/sana-robot-efficient-world-action-model-hybrid-memory/architecture.svg"
---

# 한 줄 요약

SANA-Robot은 고정 크기 선형-attention 상태와 짧은 softmax window를 결합해 분 단위 기억을 유지하면서, 4.5B world-action model을 edge GPU에서 실시간 정책과 world simulator로 함께 실행한다.

# 논문 정보

- 제목: SANA-Robot: Efficient World Action Model with Hybrid Memory
- 저자: Yuyang Zhao, Zekai Li, Yicheng Pan, Jiaming Tang, Zhuoyang Zhang, Jiaxu Xing, Moritz Reuss, Quanquan Peng, Junsong Chen, Enze Xie, Zhijian Liu, Song Han
- 발표: 확인 필요 (arXiv v1, 2026-11-21)
- 링크: [arXiv](https://arxiv.org/abs/2611.28943) · [HTML](https://arxiv.org/html/2611.28943v1)
- 코드/프로젝트: [공식 프로젝트 페이지](https://nvlabs.github.io/Sana/Robot/) · 코드 공개 확인 필요
- 키워드: world-action model, hybrid memory, linear attention, real-time robot policy, video prediction

# 핵심 아이디어

기존 WAM은 video prediction이 action 생성에 물리적 미래를 제공하지만, 긴 history의 attention 비용과 video expert의 연산량 때문에 실시간 배치가 어렵다. SANA-Robot은 8개 hybrid DiT block마다 세 개의 gated delta network(GDN) layer와 한 개의 local softmax layer를 둔다. GDN은 과거를 고정 크기 recurrent state에 압축하고, softmax layer는 가까운 chunk를 정확히 다시 본다. 같은 모델에 video/action token별 noise level을 다르게 주면 forward dynamics model(FDM), inverse dynamics model(IDM), policy를 하나의 flow-matching objective로 학습할 수 있다.

# VLA 관점에서 중요한 이유

이 논문은 장기 기억, 미래 예측, 낮은 latency를 서로 다른 모델로 분리하지 않고 하나의 WAM 안에서 함께 다룬다. 특히 RoboDojo memory 성공률 52.33%와 RTX 5090 NVFP4 기준 action chunk당 115 ms는 **기억 길이가 늘어도 inference cost를 일정하게 유지하는 구조적 선택**이 실제 제어 성능과 deployment 속도로 이어짐을 보여준다. LIBERO-Pro 평균도 기존 최고 표 값 64.00%에서 68.09%로 올라, 효율화가 robustness를 희생하지 않았다는 근거를 제공한다.

# Robot / Embodied Setting

simulation은 RoboDojo, RoboTwin 2.0, LIBERO-Plus/Pro/Max에서 평가하고, 실제 로봇은 dual-arm과 dexterous manipulation의 Make Coffee, Tower of Hanoi, Magic Cube를 포함한다. 입력은 여러 camera view, proprioception, language instruction이고 출력은 continuous action chunk다. 실제 배치에서는 memory phase와 denoising phase를 비동기화해 로봇 제어를 30 Hz로 유지한다. WorldArena와 DROID에서는 동일 backbone의 action-conditioned video simulator 능력도 별도로 평가한다.

# Method

1. **통합 token 공간:** camera별 video VAE가 현재 관측 $o$와 미래 video $z$를 latent로 만들고, proprioception $s$와 action $a$를 함께 DiT에 넣는다. multi-view rotary position embedding은 view를 $2\times2$ 공간 grid에 배치한다.
2. **Hybrid memory DiT:** 8개 block 각각에서 세 GDN layer가 모든 과거 chunk를 고정 크기 상태로 누적하고, 한 softmax layer가 sliding window 안의 세부 관계를 복원한다. memory가 길어져도 GDN state 크기와 step당 비용은 일정하다.
3. **하나의 FDM/IDM/policy:** video와 action token의 noise level을 독립적으로 설정한다. action을 주고 미래 video를 복원하면 FDM, video transition에서 action을 복원하면 IDM, 현재 관측과 언어로 action을 denoise하면 policy가 된다.
4. **Chunk-causal training:** episode를 시간순 chunk로 pack하고 과거 chunk의 recurrent state를 teacher-forcing 없이 이어서 학습한다. variable-length sequence와 memory phase sampling으로 긴 episode도 같은 model에 넣는다.
5. **실시간 추론:** prefix cache, kernel fusion, CUDA graph와 FP8/NVFP4 GEMM을 적용한다. memory state update를 action 실행과 겹치고, 짧은 softmax window만 유지해 on-edge latency를 낮춘다.

# 핵심 그림

![다중 카메라와 로봇 상태가 video VAE, hybrid-memory DiT, video/action head로 흐르고 recurrent memory가 다음 chunk로 이어지는 SANA-Robot 구조](/papers/assets/vla/sana-robot-efficient-world-action-model-hybrid-memory/architecture.svg)

> 논문 내용을 바탕으로 재구성. 출처: [원문 Figure 2](https://arxiv.org/html/2611.28943v1#S2.F2), §§2, 4–5. 캡션: 현재 관측·언어·proprioception을 통합한 뒤 GDN의 전역 recurrent state와 softmax의 국소 window를 결합하고, token별 noise 조건으로 policy와 world simulator를 전환하는 흐름이다.
>
> 실험 장면보다 **장기 기억과 실시간성을 동시에 만드는 hybrid block 및 통합 출력 경로**가 논문의 핵심이므로 아키텍처 그림을 골랐다. 입력은 camera별 latent와 robot state로 합쳐지고, 각 block에서 GDN state는 모든 과거를 압축해 다음 chunk로 넘기며 softmax는 최근 detail을 보존한다. 학습 때는 video/action noise mask가 FDM·IDM·policy 역할을 정하고, 추론 때는 action head가 chunk를 출력한다. action-conditioned video head를 켜면 같은 backbone이 미래 장면을 생성한다.

# Experiments / Results

## 주요 실험 결과

| 동일 평가 설정 / 지표 (↑/↓)               | SANA-Robot-AR |                   비교 기준 |                    차이 | 출처    |
| ----------------------------------------- | ------------: | --------------------------: | ----------------------: | ------- |
| RoboDojo memory 성공률 (%, ↑)             |         52.33 |                DM0.5: 47.44 |                 +4.89%p | Table 3 |
| RoboDojo 전체 평균 성공률 (%, ↑)          |         27.09 |           InternW0-Δ: 23.91 |                 +3.18%p | Table 3 |
| LIBERO-Plus 전체 성공률 (%, ↑)            |          94.0 |            InternW0-Δ: 92.8 |                  +1.2%p | Table 5 |
| LIBERO-Pro 평균 성공률 (%, ↑)             |         68.09 | Continuous Reasoning: 64.00 |                 +4.09%p | Table 6 |
| 실제 Tower of Hanoi score (%, ↑)          |          83.6 |             OpenWAM-α: 45.7 |                 +37.9%p | Table 8 |
| RTX 5090, action chunk latency (ms, ↓)    | 115.0 (NVFP4) |           eager BF16: 607.8 |   −492.8 ms / 5.3× 빠름 | Table 2 |
| Jetson Thor, action chunk latency (ms, ↓) | 288.0 (NVFP4) |         eager BF16: 1,390.1 | −1,102.1 ms / 4.8× 빠름 | Table 2 |

RoboDojo의 각 cell은 average score와 success rate를 함께 제공하므로 위 표에서는 success rate만 사용했다. 전체 평균의 비교 기준은 같은 공식 leaderboard에서 SANA-Robot을 제외한 최고 WAM인 InternW0-Δ이며, GPT-6 Astra는 model class가 달라 별도 행으로 보고된다. 실제 Tower of Hanoi는 7개 ring을 오류 전까지 올바르게 쌓은 비율형 score로, binary task success와 동일한 지표가 아니다. latency는 모두 synchronous $N=1$, denoising $K=4$ 조건이며 정밀도가 다른 eager BF16과 NVFP4를 성능 손실 검증 없이 완전히 동등한 계산으로 해석해서는 안 된다.

# Limitations / Discussion

4.5B 모델은 기존 대형 WAM보다 작지만 여전히 저가형 robot computer에는 무겁고, 보고된 30 Hz closed-loop는 비동기 실행으로 action을 계속 재생하는 control frequency이지 매 33 ms마다 새 chunk를 생성한다는 뜻은 아니다. NVFP4 latency와 policy quality의 정밀도별 상세 ablation도 제한적이다. RoboDojo에서 open dimension 성공률은 4.58%로 낮고, 실제 실험은 세 task family에 집중된다. 긴 memory가 무엇을 저장했는지는 attention/state 분석으로만 간접 확인하며, episode를 넘는 지속 기억은 다루지 않는다.

# 내가 이해한 핵심

SANA-Robot의 핵심은 context window를 길게 만드는 대신 **과거의 요약은 recurrent linear state에, 최근의 정확한 상호작용은 softmax window에 맡기는 계산 분업**이다. WAM의 미래 예측 능력을 유지하면서 robot policy의 latency budget에 맞추려면 model compression만이 아니라 memory operator 자체를 바꿔야 한다는 사례다.

# 다음에 연결해서 읽을 논문

- [LoCo-WAM](/papers/vla/loco-wam-test-time-long-context): parameter update를 implicit long context로 쓰는 대비되는 접근
- [InternW0](https://arxiv.org/search/?query=InternW0&searchtype=title): RoboDojo·LIBERO에서의 주요 WAM 비교 기준
- [OpenWAM](https://arxiv.org/search/?query=OpenWAM&searchtype=title): 실제 실험 및 benchmark의 공개 WAM baseline
- [SANA](https://arxiv.org/abs/2410.10629): hybrid linear attention 계열의 효율적 diffusion backbone 배경
