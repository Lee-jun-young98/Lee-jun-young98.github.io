---
title: "VLA-ZO: Fast Zeroth-Order Adaptation for Vision-Language-Action Models"
date: 2026-10-06
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Jaemin Kim, Jiahn Kim, Taesik Gong"
paper: "https://arxiv.org/abs/2610.06271"
code: ""
project: ""
thumbnail: "/papers/assets/vla/vla-zo-fast-zeroth-order-adaptation/overview.svg"
---

# 한 줄 요약

VLA-ZO는 vision-language prefix를 고정하고 action-side만 zeroth-order로 적응시키며 prefix state를 probe·step 사이에서 재사용해, $\pi_{0.5}$의 q=64 적응 시간을 153,220초에서 4,709초로 줄이면서 viewpoint-shift 성공률 63.58%를 유지한다.

# 논문 정보

- 제목: VLA-ZO: Fast Zeroth-Order Adaptation for Vision-Language-Action Models
- 저자: Jaemin Kim, Jiahn Kim, Taesik Gong
- 발표: arXiv:2610.06271v1 (2026-10-05), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.06271) · [HTML 원문](https://arxiv.org/html/2610.06271)
- 코드/프로젝트: arXiv 원문에서 공식 코드·프로젝트 링크를 확인하지 못했다.
- 키워드: zeroth-order optimization, test-time adaptation, prefix caching, action expert, LIBERO

# 핵심 아이디어

역전파 없이 forward evaluation만으로 gradient를 근사하는 ZO 최적화는 inference 수준의 메모리로 적응할 수 있지만, query direction마다 $+\epsilon z$와 $-\epsilon z$를 평가하므로 큰 VLA에서는 느리다. VLA-ZO는 perturbation 대상이 action expert에만 있으면 vision-language prefix 출력은 모든 query에서 동일하다는 중복을 이용한다.

한 step 안에서 prefix를 한 번만 계산하고(within-step reuse), 같은 demonstration을 다시 볼 때 저장된 conditioning state를 사용하며(across-step reuse), 다음 minibatch를 미리 disk→host→device로 옮긴다(schedule-aware prefetch). 적응 objective·query·parameter space는 바꾸지 않고 실행 경로만 최적화한다.

# VLA 관점에서 중요한 이유

VLA의 현장 적응은 camera pose·조명·외관 변화 때문에 필요하지만 robot GPU는 학습용 activation memory를 감당하기 어렵다. 이 논문은 prefix/action expert로 분리된 최신 VLA 구조를 시스템 최적화 경계로 사용해, forward-only 적응을 실제 운용 가능한 시간으로 끌어내린다. $\pi_{0.5}$뿐 아니라 OpenVLA-OFT action head에서도 같은 원리가 작동한다는 점도 중요하다.

# Robot / Embodied Setting

- 벤치마크: LIBERO Spatial, Object, Goal, LIBERO-10의 40 task.
- 적응 데이터: target visual condition에서 scene당 1개, 총 5개 expert demonstration.
- 평가: task·condition당 40 initial state, condition당 1,600 episode.
- 변화: camera viewpoint Small/Medium/Large, Medium viewpoint+blur, Medium viewpoint+lighting.
- backbone: $\pi_{0.5}$ flow-matching action expert와 OpenVLA-OFT L1 regression head.

# Method

1. 정책을 frozen vision-language prefix $f_\phi$와 적응 가능한 action module $g_\psi$로 나눈다: $h_i=f_\phi(o_i,\ell)$, $\pi(a_i\mid o_i,\ell)=g_\psi(a_i\mid h_i)$.
2. action-side LoRA만 ZO finite difference로 갱신한다. $q$개 방향은 update마다 $2q$회 forward objective 평가를 요구하지만 backward graph는 만들지 않는다.
3. within-step reuse로 각 sample의 $h_i$를 한 번 계산해 같은 update의 모든 probe에 공유한다.
4. across-step reuse로 고유 observation별 state를 disk cache에 저장해 다음 방문에서 prefix를 다시 계산하지 않는다.
5. sampler schedule을 한 step 앞서 복원해 다음 minibatch state를 비동기 prefetch하고 I/O를 현재 $2q$ action probe 뒤에 숨긴다.

# 핵심 그림

![VLA-ZO의 고정 prefix와 action-side ZO, 캐시 및 prefetch 구조](/papers/assets/vla/vla-zo-fast-zeroth-order-adaptation/overview.svg)

> 논문 내용을 바탕으로 Figure 3을 재구성. 출처: [arXiv HTML, Figure 3](https://arxiv.org/html/2610.06271). 한 번 계산한 prefix state가 같은 step의 $2q$ probe와 이후 update에서 재사용되고, 다음 batch가 비동기로 공급되는 구조를 나타낸다.

구조 그림을 고른 이유는 성능 자체보다 어떤 계산을 고정·재사용해 25–33배 속도를 얻는지가 핵심이기 때문이다. 학습/적응 시 vision-language prefix는 frozen이고 action adapter만 $\hat\nabla L$로 갱신된다. 추론 시에는 업데이트된 action module을 일반 VLA처럼 실행하므로 캐시·prefetch 경로는 적응 과정에만 존재한다. 수식상 제거되는 것은 $2qBT$번의 prefix 실행이며, action-side $2qBT$ 평가는 그대로 남는다.

# Experiments / Results

## 주요 실험 결과

| $\pi_{0.5}$ viewpoint shift (성공률 %, ↑ / 적응 시간 s, ↓) | 성공률 |  시간 | 비교 기준                         |                  차이 | 출처         |
| ---------------------------------------------------------- | -----: | ----: | --------------------------------- | --------------------: | ------------ |
| VLA-ZO, q=16                                               |  58.17 | 1,504 | Baseline ZO q=16: 57.63 / 38,487  | +0.54%p / 25.59× 빠름 | 원문 Table 1 |
| VLA-ZO, q=64                                               |  63.58 | 4,709 | Baseline ZO q=64: 63.77 / 153,220 | -0.19%p / 32.54× 빠름 | 원문 Table 1 |
| VLA-ZO, q=64                                               |  63.58 | 4,709 | Zero-shot: 48.27 / 해당 없음      |              +15.31%p | 원문 Table 1 |
| OpenVLA-OFT VLA-ZO, q=4                                    |  52.67 |   109 | Zero-shot: 49.48 / 해당 없음      |               +3.19%p | 원문 Table 3 |

q=64에서 optimized path는 baseline ZO와 사실상 같은 성공률(-0.19%p)을 유지하면서 시간을 42.6시간에서 1.31시간으로 줄인다. 다만 compound View+Noise에서는 VLA-ZO q=64가 55.8%로 DART 55.4%와 비슷하고, View+Light에서는 60.8%로 DART 56.8%보다 4.0%p 높아 shift 유형에 따라 이득이 다르다.

# Limitations / Discussion

- 실험은 simulation LIBERO visual shift에 집중하며, 실제 robot onboard hardware의 전력·I/O·wall-clock 변동은 검증되지 않았다.
- disk cache 크기는 demonstration 길이에 따라 늘고, prefix가 적응 대상이면 state 재사용 가정이 깨진다.
- action-side 적응은 viewpoint shift에서 잘 작동하지만 모든 시각 변화에 최적이라는 보장은 없다. View+Noise q=16은 DART보다 낮다.
- 높은 q는 빨라져도 여전히 수십 분~1시간대이며 완전한 online 즉시 적응으로 보기 어렵다.

# 내가 이해한 핵심

이 논문의 알고리즘적 새로움은 ZO estimator 변경보다 “무엇을 perturb하느냐가 무엇을 cache할 수 있느냐를 결정한다”는 구조적 통찰이다. prefix를 고정하면 수많은 query가 같은 perception 결과를 반복 계산하는 낭비가 드러나고, VLA를 모델이 아니라 prefix–action computation graph로 보는 순간 deployment 최적화가 가능해진다.

# 다음에 연결해서 읽을 논문

- DART: one-shot VLA adaptation의 강한 비교 기준.
- FLA / VLA Models Are More Generalizable Than You Think: vision-side adaptation과 비교하기 좋다.
- OpenVLA-OFT: action head 경계가 다른 구조에서 재사용 원리가 어떻게 옮겨지는지 볼 수 있다.
