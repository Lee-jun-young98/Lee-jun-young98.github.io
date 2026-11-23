---
title: "LoCo-WAM: Test-Time Training as Long Context for World-Action Models"
date: 2026-11-23
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Sheng Cheng, Deqian Kong"
paper: "https://arxiv.org/abs/2611.26853"
code: ""
project: ""
thumbnail: "/papers/assets/vla/loco-wam-test-time-long-context/architecture.svg"
---

# 한 줄 요약

LoCo-WAM은 짧은 observation window를 그대로 둔 채 실제로 관측된 episode frame의 video loss로 video expert LoRA를 계속 갱신해, 오래된 경험을 parameter state에 축적하는 world-action model 적응법이다.

# 논문 정보

- 제목: LoCo-WAM: Test-Time Training as Long Context for World-Action Models
- 저자: Sheng Cheng, Deqian Kong
- 발표: 확인 필요 (arXiv v1, 2026-11-19)
- 링크: [arXiv](https://arxiv.org/abs/2611.26853) · [HTML](https://arxiv.org/html/2611.26853v1)
- 코드/프로젝트: 공개 확인 필요
- 키워드: world-action model, test-time training, long context, video expert, LoRA, robot manipulation

# 핵심 아이디어

일반 world-action model은 최근 $P$개 관측으로 미래 frame latent를 상상하고 그 미래를 조건으로 action chunk를 만든다. LoCo-WAM은 action 실행 뒤 실제 미래 frame이 도착하면, 이미 완료된 과거 window를 self-supervised training sample로 재사용해 video expert의 LoRA만 한두 step 갱신한다. adapter는 episode 동안 누적되고 다음 episode에서 0으로 reset되므로 입력 token 수를 늘리지 않고도 window 밖 경험이 이후 action에 영향을 준다.

# VLA 관점에서 중요한 이유

긴 robot task의 memory를 늘리는 전형적인 방법은 더 긴 context model을 다시 학습하거나 외부 memory를 붙이는 것이다. LoCo-WAM은 **observation을 저장해 다시 attention하는 대신, 그 결과를 video dynamics adapter에 압축**한다. RoboCasa GR-1에서 2.4초 history의 LoCo-WAM이 9.6초 base model과 사실상 같고, 4.8초 모델은 9.6초 base보다 +4.8%p 높다는 결과는 test-time learning을 implicit long context로 볼 근거를 준다.

# Robot / Embodied Setting

Long-WAM은 RoboCasa GR-1과 RoboCasa365에서, LingBot-VA는 LIBERO-Mem과 RoboTwin 2.0에서 평가한다. RoboCasa GR-1은 18개 pick-and-place와 6개 articulated task, RoboCasa365는 18개 atomic·16개 seen composite·16개 unseen composite task를 포함한다. 모든 평가는 simulation이며, 실제 robot 결과는 없다.

# Method

1. **Predict-then-act WAM:** video expert $\Phi_v$가 고정 길이 history $H_t$에서 imagined future $\hat z_t$를 rollout하고, action expert $\Phi_a$가 $H_t,\hat z_t$를 조건으로 action chunk $a_t$를 denoise한다.
2. **Episode-local LoRA:** pretrained weight는 고정하고 video expert의 선형층에 $W'=W+\frac{\alpha}{r}BA$를 붙인다. $B=0$으로 시작해 episode 첫 decision에서는 base model과 동일하다.
3. **Self-supervised update:** 과거 chunk의 미래 frame이 모두 관측되면 그 window의 history와 실제 frame latent를 Equation 3의 flow-matching video loss에 넣어 $\Theta_v$만 갱신한다. action expert와 architecture는 바꾸지 않는다.
4. **다음 action에 반영:** 적응된 video expert가 상상한 미래와 그 expert가 계산한 history/future feature가 모두 frozen action expert로 들어간다. adapter는 decision마다 누적되고 episode 경계에서 reset된다.
5. **비동기형:** 현재 action chunk를 실행하는 동안 update하고 다음 decision에서 $\Theta_{t-1}$을 사용해 observation-to-action latency를 줄인다.

# 핵심 그림

![고정 길이 observation history가 적응된 video expert와 frozen action expert를 거쳐 action이 되고, 실행 후 실제 frame의 video loss가 episode-local LoRA로 돌아가는 LoCo-WAM 구조](/papers/assets/vla/loco-wam-test-time-long-context/architecture.svg)

> 논문 내용을 바탕으로 재구성. 출처: [원문 §3](https://arxiv.org/html/2611.26853v1#S3), Equations 1–9 및 Algorithm 1. 캡션: 고정 길이 predict-then-act 경로와, 완료된 과거 window로 video expert adapter를 갱신하는 test-time learning 경로를 구분했다.
>
> 원문 Figure 1은 history 길이에 따른 성공률을 잘 보여주지만 모델의 정보 흐름은 생략한다. 그래서 **입력 window, imagined future, action, 실제 outcome, video-loss update가 만드는 순환**을 설명하는 아키텍처를 골랐다. 추론에서는 $H_t\rightarrow(\Phi_v+\Theta_t)\rightarrow\hat z_t\rightarrow\Phi_a\rightarrow a_t$로 흐르고, 적응에서는 실제로 관측된 $z$가 $\mathcal L_{video}$를 통해 $\Theta_v$만 갱신한다. 학습 신호는 action label이 아니라 environment frame이며 action expert는 고정된다.

# Experiments / Results

## 주요 실험 결과

| 동일 평가 설정 / 성공률 (%, ↑)            | LoCo-WAM |                비교 기준 |   차이 | 출처               |
| ----------------------------------------- | -------: | -----------------------: | -----: | ------------------ |
| RoboCasa GR-1, Long-WAM 2.4 s, 전체       |     73.6 |    같은 2.4 s base: 67.9 | +5.7%p | Table 1            |
| RoboCasa GR-1, 2.4 s async, 전체          |     74.9 |    같은 2.4 s base: 67.9 | +7.0%p | Table 1            |
| RoboCasa GR-1, Long-WAM 4.8 s, 전체       |     78.3 |    같은 4.8 s base: 71.1 | +7.2%p | Table 1            |
| RoboCasa GR-1, 4.8 s LoCo vs 9.6 s base   |     78.3 |         9.6 s base: 73.5 | +4.8%p | Table 1 / Figure 1 |
| LIBERO-Mem, LingBot-VA 8-chunk, task 성공 |     32.2 |  같은 8-chunk base: 27.5 | +4.7%p | Table 3            |
| RoboCasa GR-1, 4.8 s, video-loss update   |     78.3 | action-loss update: 73.3 | +5.0%p | Table 6            |

RoboCasa GR-1은 24개 task 평균이며 Table 1의 값은 세 run 평균과 표준편차다. 4.8초 LoCo-WAM은 78.3±1.9%, 같은 context base는 71.1±3.5%다. async 2.4초 모델은 latency가 0.62초로 synchronous 0.76초보다 짧지만 base의 0.57초보다는 길다. 2.4초 LoCo-WAM 73.6%와 9.6초 base 73.5%의 +0.1%p 차이는 사실상 동률로 해석하는 편이 안전하다.

# Limitations / Discussion

결과는 네 simulation benchmark에 한정되어 real-robot sensor noise, contact dynamics, safety 제약에서 online gradient update가 안정적인지는 확인되지 않았다. 매 decision의 backward pass는 memory와 latency를 늘리고, async형도 action chunk 실행 시간 안에 update를 끝내야 한다. episode마다 adapter를 reset하므로 cross-episode 지식은 남지 않으며, 매우 긴 episode에서 drift가 누적될 가능성도 있다. update는 observed outcome을 학습하지만 실패 원인을 명시적으로 구분하지 않는다.

# 내가 이해한 핵심

LoCo-WAM에서 long context는 token sequence가 아니라 **episode 동안 누적되는 parameter state**다. 특히 action expert를 직접 고치는 것보다 video expert의 미래 예측을 고쳤을 때 성능이 더 좋다는 점은 WAM의 adaptation target이 action imitation보다 dynamics correction에 가까워야 함을 시사한다.

# 다음에 연결해서 읽을 논문

- [Long-WAM](https://arxiv.org/search/?query=Long-WAM&searchtype=title): LoCo-WAM의 첫 번째 base world-action model
- [LingBot-VA](https://arxiv.org/search/?query=LingBot-VA&searchtype=title): LIBERO-Mem·RoboTwin 실험의 두 번째 backbone
- [MemoryWAM](https://arxiv.org/search/?query=MemoryWAM&searchtype=title): persistent memory를 직접 모델링하는 비교 방향
- [WEVO](/papers/vla/wevo-world-model-vla-optimization): world model 안에서 VLA policy 자체를 최적화하는 접근
