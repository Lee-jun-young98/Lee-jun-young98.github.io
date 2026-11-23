---
title: "FORTH: Grounding Tactile VLA Execution via Forward-Only Proxy-Control Pairing"
date: 2026-11-23
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Junde Li, Wei-Han Yu, Xiangyi Chu, Yaoxin Li, Jiawei Xu, Ka-Fai Un, Pui-In Mak"
paper: "https://arxiv.org/abs/2611.26744"
code: "https://github.com/Jordanlllll/FORTH"
project: ""
thumbnail: "/papers/assets/vla/forth-tactile-vla-forward-only-grounding/architecture.svg"
---

# 한 줄 요약

FORTH는 촉각 표현, VLA adapter 업데이트, slip 제어의 proxy objective를 실제 접촉 관측량과 각각 짝지어, backprop 없이 적응하면서 과도한 그립 힘을 억제하는 tactile VLA 실행 프레임워크다.

# 논문 정보

- 제목: FORTH: Grounding Tactile VLA Execution via Forward-Only Proxy-Control Pairing
- 저자: Junde Li, Wei-Han Yu, Xiangyi Chu, Yaoxin Li, Jiawei Xu, Ka-Fai Un, Pui-In Mak
- 발표: 확인 필요 (arXiv v1, 2026-11-19)
- 링크: [arXiv](https://arxiv.org/abs/2611.26744) · [HTML](https://arxiv.org/html/2611.26744v1)
- 코드/프로젝트: [공식 코드](https://github.com/Jordanlllll/FORTH) (MIT)
- 키워드: tactile VLA, force grounding, forward-only learning, zeroth-order adaptation, slip control

# 핵심 아이디어

논문은 낮은 task loss가 곧 force grounding을 뜻하지 않는다고 본다. frozen visual backbone은 접촉 기하를 버릴 수 있고, downstream loss는 token-level gradient 정렬 실패를 숨기며, 이진 slip detector는 이미 늦게 반응할 수 있다. FORTH는 이 세 단절에 맞춰 (1) local goodness로 학습하는 촉각 trunk, (2) action head만 바꾸는 token-parallel zeroth-order adapter, (3) incipient slip을 연속 촉각 비율로 감지하는 SlipGuard를 연결한다.

# VLA 관점에서 중요한 이유

VLA가 language prompt에 맞는 action을 내더라도 실제 접촉 하중이 바뀌지 않으면 force-aware policy라고 부르기 어렵다. FORTH의 기여는 단순히 촉각 센서를 더하는 것이 아니라, **표현–최적화–제어 각 단계의 학습 신호가 어떤 물리량을 움직여야 하는지**를 검증 가능한 형태로 만든 점이다. LIBERO 성공률을 유지하면서 deformable shell의 peak grip을 22.43 N에서 0.77 N으로 낮춘 결과는 task success와 physical integrity를 함께 봐야 함을 보여준다.

# Robot / Embodied Setting

실제/모사 tactile interface에서 normal force와 shear force를 측정하고, rubber·plastic·metal의 friction drop 및 deformable structural shell crush를 평가한다. VLA policy는 30 Hz, rank-8 adapter는 1 Hz, tactile servo는 500 Hz로 동작한다. task-level 평가는 LIBERO Spatial/Object/Long 세 suite에서 수행하며 Goal suite는 제외한다.

# Method

1. **Layer-local tactile representation:** tactile surface를 patchify해 $48\times d$ token으로 만들고 $d=128$의 두 Forward-Forward block을 통과시킨다. 각 block은 $g=\sum_i f_i^2$의 local goodness로 real contact와 counterfactual negative를 구분하므로 global backbone으로 gradient를 보내지 않는다.
2. **Token-noise low-rank adaptation:** action head의 rank-8 adapter에 $\pm\sigma\epsilon$ perturbation을 가하고 대칭 loss 차분으로 token별 directional derivative를 얻는다. $T$ token의 추정을 합쳐 adapter만 갱신하며 backbone은 고정한다.
3. **SlipGuard:** shear-to-normal ratio $\rho_t=F_t^s/F_t^n$를 nominal episode에서 보정한 $\tau=\bar\rho+3\sigma_\rho$와 비교한다. 두 frame 연속 초과할 때만 gate를 열고, correction을 $\Delta F_{max}$로 제한한다.
4. **Paired grounding audit:** 표현은 contact geometry, update는 true-gradient alignment, controller는 slip recovery와 damage reduction이라는 서로 다른 물리 observable로 평가한다.

# 핵심 그림

![촉각 표면 입력에서 Forward-Forward trunk, token-parallel rank-8 adapter, VLA 정책, SlipGuard 폐루프로 이어지는 FORTH 아키텍처](/papers/assets/vla/forth-tactile-vla-forward-only-grounding/architecture.svg)

> 논문 내용을 바탕으로 재구성. 출처: [원문 Figure 1](https://arxiv.org/html/2611.26744v1#S0.F1), [Figure 2](https://arxiv.org/html/2611.26744v1#S3.F2), §§4–6 및 Equations 4–15. 캡션: local tactile representation, forward-only adapter update, slip-triggered force correction을 하나의 실행 폐루프로 정리했다.
>
> 실험 장면보다 **세 grounding level이 실제 robot loop에서 어떻게 연결되는지**가 논문의 차별점을 더 잘 설명하므로 아키텍처 그림을 골랐다. 입력 tactile surface는 local trunk에서 contact feature가 되고, zeroth-order update는 action-head adapter만 바꾼다. 추론 중 VLA의 nominal force와 sensor의 $F^s,F^n$이 SlipGuard로 들어가며, gate는 slip 직전에 제한된 force correction을 robot에 돌려준다. FF trunk 학습과 adapter 적응은 별도 objective를 쓰고, SlipGuard는 실시간 제어 경로다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (↑/↓)                        | FORTH / SlipGuard |          비교 기준 |                   차이 | 출처              |
| --------------------------------------------- | ----------------: | -----------------: | ---------------------: | ----------------- |
| LIBERO Spatial 성공률 (%, ↑)                  |              99.3 |  OpenVLA-OFT: 97.6 |                 +1.7%p | Table 4           |
| LIBERO Object 성공률 (%, ↑)                   |              98.6 |  OpenVLA-OFT: 98.4 |                 +0.2%p | Table 4           |
| LIBERO Long 성공률 (%, ↑)                     |              94.8 |  OpenVLA-OFT: 94.5 |                 +0.3%p | Table 4           |
| 세 suite 평균 성공률 (%, ↑)                   |              97.6 |  OpenVLA-OFT: 96.8 |                 +0.8%p | Table 4           |
| 7B 1-pass peak activation memory (MB, ↓)      |               334 |    backprop: 2,381 | −2,047 MB / 7.12× 적음 | Table 1           |
| deformable shell peak grip (N, ↓)             |              0.77 | reflex ramp: 22.43 |    −21.66 N / 29× 낮음 | Figure 4, Table 5 |
| deformable shell residual deformation (mm, ↓) |              0.01 | reflex ramp: 10.62 |              −10.61 mm | Table 5           |

LIBERO 수치는 같은 suite 열을 비교했지만 published baseline의 sensor/input 조건이 FORTH와 완전히 동일한 것은 아니다. 반면 shell audit은 동일 substrate의 paired episode이며, 22.43 N과 0.77 N은 peak force다. Table 2의 integrated over-force damage와 섞어 해석하면 안 된다. forward-only 1 pass는 backprop보다 latency가 짧지만 한 update에 $2T$ pass가 필요하므로, 전체 update 비용은 token 병렬화 정도에 좌우된다.

# Limitations / Discussion

촉각 plant와 force channel이 있는 실행 stack이 필요해 RGB-only VLA에 즉시 적용되지는 않는다. LIBERO의 높은 성공률은 tactile safety가 필요한 실제 contact-rich task를 직접 대표하지 않으며, published baseline 간 입력 조건도 다르다. deformable-shell audit은 deterministic substrate에서 arm당 한 paired episode이고, controller parameter가 다른 robot·sensor·material에서도 그대로 유지되는지는 더 넓은 실험이 필요하다. zeroth-order update는 memory를 줄이지만 많은 forward evaluation을 요구한다.

# 내가 이해한 핵심

이 논문의 핵심은 “힘을 예측한다”가 아니라 **loss가 줄 때 실제 접촉 상태도 올바른 방향으로 변하는가**를 묻는 데 있다. VLA의 semantic success와 물리적 안전성 사이를 잇기 위해서는 각 proxy마다 대응하는 control observable이 필요하다.

# 다음에 연결해서 읽을 논문

- [OpenVLA-OFT](https://arxiv.org/abs/2502.19645): FORTH의 LIBERO 비교 기준인 flow-matching VLA fine-tuning
- [Octo](https://arxiv.org/abs/2405.12213): LIBERO 표에 포함된 generalist robot policy
- [Forward-Forward Algorithm](https://arxiv.org/abs/2212.13345): local goodness 기반 학습의 원형
- [ForeTac-VLA](/papers/vla/foretac-vla-forecasting-based-tactile-vision-language-action-model): tactile forecasting을 VLA action generation에 넣는 다른 접근
