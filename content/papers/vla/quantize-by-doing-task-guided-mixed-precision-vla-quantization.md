---
title: "Quantize by Doing: Task-Guided Mixed-Precision Quantization of Vision-Language-Action Models"
date: 2026-10-30
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Jiuyi Xu et al."
paper: "https://arxiv.org/abs/2610.38661"
code: "https://github.com/jiuyixu25/QbD-VLA"
thumbnail: "/papers/assets/vla/quantize-by-doing-task-guided-mixed-precision-vla-quantization/overview.svg"
---

# 한 줄 요약

QbD-VLA는 layer group의 bit-width를 한 단계씩 낮추고 짧은 폐루프 task success로 채택 여부를 정해, component 상호작용을 반영한 약 4-bit weight·6-bit 미만 activation 구성을 찾는다.

# 논문 정보

- 제목: Quantize by Doing: Task-Guided Mixed-Precision Quantization of Vision-Language-Action Models
- 저자: Jiuyi Xu, Xiao Hu, Meida Chen, Song Wang, Yang Ye, Yangming Shi
- 발표: 확인 필요 (arXiv v1, 2026-10-28)
- 링크: [arXiv](https://arxiv.org/abs/2610.38661) · [HTML](https://arxiv.org/html/2610.38661)
- 코드/프로젝트: [공식 GitHub](https://github.com/jiuyixu25/QbD-VLA)
- 키워드: VLA quantization, mixed precision, closed-loop evaluation, task success, on-robot inference

# 핵심 아이디어

기존 post-training quantization은 calibration input의 action error, activation kurtosis, reconstruction error처럼 offline sensitivity를 보고 bit를 배분한다. 그러나 로봇은 앞선 오차가 다음 관측을 바꾸며, 한 group의 quantization 효과도 다른 group의 precision에 따라 달라진다. QbD-VLA는 현재 mixed-precision configuration에서 한 group만 다음 precision으로 낮춘 후보를 simulator에 직접 rollout하고, full-precision 대비 success floor를 Wilson interval로 넘는 후보만 greedy하게 채택한다.

# VLA 관점에서 중요한 이유

VLA의 수십억 parameter를 on-robot GPU에 올리려면 낮은 정밀도가 필요하지만, open-loop action 유사도는 폐루프 성공을 보장하지 않는다. 이 논문은 $\pi_{0.5}$, OpenVLA-OFT, X-VLA, $\pi_0$ 네 구조에서 **실제 task success를 allocation objective로 사용**하고, 동일 group도 주변 precision에 따라 민감도가 뒤집힌다는 실증을 제공한다. 동시에 simulation-selected allocation이 $\pi_{0.5}$ 실로봇에서 완전히 실패한 결과까지 공개해 deployment validation의 경계를 명확히 한다.

# Robot / Embodied Setting

allocation은 LIBERO-Spatial의 10개 task에서 짧은 horizon rollout으로 수행하고, 고정된 구성을 LIBERO Object·Goal·Long에 그대로 적용한다. X-VLA는 SIMPLER의 variant-aggregation에서 allocation하고 visual-matching split에서 평가한다. 실로봇은 411개 demonstration으로 LoRA fine-tuning한 X-VLA와 $\pi_{0.5}$를 Franka Research 3의 색깔 cube picking에 배포한다.

# Method

1. vision encoder, language backbone, projector, action head를 architecture에 맞는 layer group으로 나누고 각 group에 FP→W8A8→W4A8→W4A6→W4A4 순서를 둔다.
2. configuration cost는 parameter-weighted nominal bit-width $C(c)=W(c)+A(c)$로 정의한다. activation 값은 실제 peak memory가 아니라 weight 수로 가중한 배분 지표다.
3. full precision의 짧은 rollout 성공률에 $\tau$를 곱해 acceptance floor $f$를 고정한다.
4. 현재 구성에서 한 group만 한 단계 낮춘 후보들을 cost reduction 순으로 평가한다. 한 batch는 task마다 1 episode이며 최대 3 batch까지 Wilson lower/upper bound로 조기 수락·거절한다.
5. 더 낮출 수 없을 때까지 반복한 뒤, accepted path에서 최소 cost이면서 full evaluation threshold를 만족하는 구성을 선택한다. policy training이나 calibration은 하지 않는다.

# 핵심 그림

![VLA layer group의 bit-width를 낮추고 simulator 폐루프 성공률과 Wilson bound로 채택하는 QbD-VLA 탐색 구조](/papers/assets/vla/quantize-by-doing-task-guided-mixed-precision-vla-quantization/overview.svg)

> 논문 Figure 1과 Equations (1)–(4)를 바탕으로 재구성한 QbD-VLA allocation loop. 출처: [논문 HTML의 Figure 1과 Section 3](https://arxiv.org/html/2610.38661#S3). 원문은 CC BY 4.0이며, 탐색과 최종 배포의 차이를 드러내기 위해 직접 재구성했다.
>
> 구조 그림을 고른 이유는 이 논문의 핵심이 특정 quantized model보다 **현재 configuration 안에서 폐루프 행동 결과를 되먹이는 탐색 절차**이기 때문이다. 입력은 pretrained VLA와 group별 precision이며, 후보 생성기·simulator rollout·Wilson sequential test가 반복된다. 출력은 frozen mixed-precision allocation이다. allocation 단계에는 simulator와 여러 episode가 필요하지만, 추론 시에는 이 탐색 모듈이 사라지고 선택한 precision의 VLA가 관측과 언어를 action으로 변환한다.

# Experiments / Results

## 주요 실험 결과

| LIBERO 4-suite 평균 성공률 (%, ↑) | QbD-VLA | uniform W4A6 |    차이 | 출처    |
| --------------------------------- | ------: | -----------: | ------: | ------- |
| $\pi_{0.5}$ (W4A5.74)             |    96.2 |         96.5 |  -0.3%p | Table 1 |
| OpenVLA-OFT (W4A5.94)             |    91.8 |         22.4 | +69.4%p | Table 1 |
| X-VLA (W4.16A5.90)                |    95.8 |         61.9 | +33.9%p | Table 1 |
| $\pi_0$ (W4.14A4.47)              |    73.5 |         72.0 |  +1.5%p | Table 1 |

네 행은 동일한 LIBERO suite와 공식 20 initial states/task 조건을 비교했다. QbD allocation은 Spatial에서만 선택했는데도 나머지 세 suite에 그대로 전이된다. 특히 LIBERO-Spatial에서 $\pi_{0.5}$ QbD는 98.5%인 반면 동일 cost의 action-error, activation-kurtosis, reconstruction-error allocation은 각각 27.5%, 0.0%, 52.0%다(Table 3). 다만 full precision 대비 4-suite 평균은 $\pi_{0.5}$ 96.8→96.2(-0.6%p), OpenVLA-OFT 96.5→91.8(-4.7%p), X-VLA 97.6→95.8(-1.8%p), $\pi_0$ 74.6→73.5(-1.1%p)로 소폭 손실이 남는다.

실로봇에서는 X-VLA가 full precision 11/30에서 QbD 13/30으로 유지됐지만, $\pi_{0.5}$는 6/6에서 0/6으로 붕괴했고 gripper close command도 0/6이었다(Table 5). 서로 다른 trial 수이므로 X-VLA와 $\pi_{0.5}$의 성공률을 한 행에서 직접 비교하지 않았다.

# Limitations / Discussion

greedy path는 전역 최적을 보장하지 않고, predefined group·RTN quantizer·제한된 bit 후보에 결과가 종속된다. 한 allocation run에 600–970 simulation episode가 필요하며 simulator가 없는 task에는 적용하기 어렵다. nominal bit-width는 실제 memory와 integer-kernel latency가 아니어서 hardware speedup도 별도 측정해야 한다. 실로봇 평가는 한 cube-picking task와 두 fine-tuned policy뿐이고, $\pi_{0.5}$의 완전 실패 원인도 규명되지 않았다. 200-episode 평가에서 1–2%p 차이는 sampling noise 범위일 수 있다.

# 내가 이해한 핵심

QbD-VLA가 보여주는 것은 “어느 layer가 민감한가”가 layer의 고정 속성이 아니라 **현재 폐루프 policy configuration과 함께 정해지는 조건부 속성**이라는 점이다. 그래서 싸고 정적인 proxy보다 task rollout이 더 정확하지만, simulator success조차 real hardware의 gripper command 붕괴를 잡지 못하므로 마지막 검증 단계는 줄일 수 없다.

# 다음에 연결해서 읽을 논문

- [VLAQuantBench](https://arxiv.org/abs/2606.06567): VLA component quantization의 폐루프 상호작용 분석
- [ActQuant](https://arxiv.org/abs/2605.24011): action-guided sub-4-bit VLA quantization
- [OpenVLA-OFT](https://arxiv.org/abs/2502.19645): 평가 대상인 continuous-action OpenVLA fine-tuning
- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): simulation-to-real quantization 전이가 실패한 flow-matching VLA
