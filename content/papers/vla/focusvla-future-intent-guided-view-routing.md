---
title: "FocusVLA: Future-Intent Guided Dynamic View Routing for Vision-Language-Action Models"
date: 2026-10-24
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Multi-View"
  - "Robot Manipulation"
venue: "확인 필요 (arXiv 저자 코멘트: CoRL 2026)"
authors: "Huixin Xu, Ziya Yu, Peng Li"
paper: "https://arxiv.org/abs/2610.31423"
code: ""
project: ""
thumbnail: "/papers/assets/vla/focusvla-future-intent-guided-view-routing/overview.svg"
---

# 한 줄 요약

FocusVLA는 action history에서 미래 상호작용 intent를 예측하고 action step마다 global·wrist view 가중치를 바꿔, 정적 multi-view fusion의 wrist-view 의존 관성을 줄인다.

# 논문 정보

- 제목: FocusVLA: Future-Intent Guided Dynamic View Routing for Vision-Language-Action Models
- 저자: Huixin Xu, Ziya Yu, Peng Li
- 발표: 확인 필요 (arXiv v1, 2026-10-22; 저자 코멘트는 “Accepted at CoRL 2026”이나 공식 proceedings/OpenReview 기록은 이번 조사에서 미확인)
- 링크: [arXiv](https://arxiv.org/abs/2610.31423)
- 라이선스: CC BY 4.0
- 키워드: multi-view VLA, future intent, dynamic routing, stage awareness, manipulation

# 핵심 아이디어

third-person camera는 target localization·transport의 전역 문맥을, wrist camera는 grasp·alignment·contact의 국소 단서를 준다. 그러나 정적 fusion VLA는 초기에 형성된 view preference를 이후 단계까지 유지하는 view-dependency inertia를 보인다.

FocusVLA의 Future Intent Bridge는 vision-language prefix, robot state, short action history에서 미래 action horizon의 각 step이 local interaction을 요구할 확률을 예측한다. 이 확률은 step-wise global/local routing weights와 chunk-level intent token 양쪽으로 변환된다.

# VLA 관점에서 중요한 이유

더 많은 camera를 넣는 것과 그 camera를 적절한 순간에 쓰는 것은 다르다. FocusVLA는 backbone을 바꾸지 않고 action-generation side에서 view contribution을 동적으로 조절한다.

수동 phase annotation 대신 end-effector speed·rotation·gripper event에서 binary interaction labels를 자동 생성해 future intent를 명시적으로 감독한다. 단순 attention visualization이 아니라 stage-conditioned masking으로 static baseline의 실제 view 의존도도 진단한다.

# Robot / Embodied Setting

- simulation: RoboTwin 2.0 전체 50 tasks, task당 100 trials; short부터 extra-long/dexterous까지 5 horizon groups
- real robot: Piper arm, Intel RealSense D435i 2대(global/local), 6 tasks, method·task당 30 trials
- baseline: RDT, $\pi_0$, $\pi_{0.5}$; 동일 demonstration, optimization steps, seeds, protocol
- weak intent labels: 양팔 end-effector translation/rotation, gripper-close window, motion heuristics에서 자동 생성

# Method

Future Intent Bridge는 recent action dynamics를 temporal summary로 만들고, language query와 visual/state-history key-value의 cross-attention으로 미래 intent sequence를 낸다.

$$
I_t=[i_t^{(1)},\ldots,i_t^{(H)}],\qquad
\alpha^{(k)}=f_{route}(i_t^{(k)})=[\alpha_g^{(k)},\alpha_l^{(k)}].
$$

$i_t^{(k)}$는 $k$번째 future action이 local interaction evidence를 요구할 확률이고, $1-i_t^{(k)}$는 workspace-level motion 확률로 해석한다. pooled intent는 chunk token으로 action backbone에 들어가고, 각 $\alpha^{(k)}$는 global/local visual context를 step마다 혼합한다.

학습 loss는 action MSE와 trajectory-derived label에 대한 intent BCE의 합이다. intent branch warm-up 뒤 joint optimization하며 안정화를 위해 일부 teacher forcing을 사용한다.

# 핵심 그림

![글로벌 카메라와 손목 카메라, 언어·상태·행동 이력에서 Future Intent Bridge가 step-wise routing weight와 chunk intent token을 만들어 action backbone을 조절하는 FocusVLA 구조](/papers/assets/vla/focusvla-future-intent-guided-view-routing/overview.svg)

> 그림 1. FocusVLA의 future-intent 기반 dynamic view routing. 논문 Figure 1과 Figure 3, Sections 3.2–3.3을 바탕으로 직접 재구성했다. 출처: [arXiv:2610.31423](https://arxiv.org/html/2610.31423#S3).

구조 그림을 고른 이유는 global/local view를 단순 합치는 것이 아니라 future action step마다 다르게 배분하는 것이 핵심이기 때문이다. 입력은 두 시점 view, instruction, robot state, recent actions이고 Future Intent Bridge가 진행 상태를 추론한다.

step-wise route는 각 action token이 참조할 view 비율을 바꾸고, chunk token은 horizon 전체의 진행 요약을 제공한다. 기존 visual encoder·language model·action backbone은 유지되므로 adapter처럼 결합할 수 있다.

# Experiments / Results

## 주요 실험 결과

아래 값은 논문 Table 1–3과 Section 4.2에서 동일 데이터·평가 설정끼리 대조했다. 성공률 차이는 %p로 계산했다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓)         | 제안 방법 |           비교 기준 |     차이 | 출처                                      |
| ---------------------------------------- | --------: | ------------------: | -------: | ----------------------------------------- |
| RoboTwin 2.0 전체 50-task 평균 SR (%, ↑) |     76.92 |   $\pi_{0.5}$ 66.82 | +10.10%p | Table 2, task당 100 trials                |
| RoboTwin medium-horizon 평균 SR (%, ↑)   |      67.8 |    $\pi_{0.5}$ 54.9 |  +12.9%p | Table 2                                   |
| RoboTwin long-horizon 평균 SR (%, ↑)     |      85.6 |    $\pi_{0.5}$ 77.1 |   +8.5%p | Table 2                                   |
| Piper 6-task real 평균 SR (%, ↑)         |      85.0 |    $\pi_{0.5}$ 71.7 |  +13.3%p | Section 4.2, task당 30 trials             |
| 9-task ablation 평균 SR (%, ↑)           |      73.7 | learned static 67.5 |   +6.2%p | Table 3, 95% CI                           |
| 9-task ablation 평균 SR (%, ↑)           |      73.7 |     E2E future 55.7 |  +18.0%p | Table 3, explicit intent supervision 효과 |

stage-conditioned masking에서 baseline은 planning stage에 global view를 가리면 85%→65%(-20%p), local view를 가리면 85%→20%(-65%p)였다. 전역 계획 단계조차 wrist view에 과도하게 의존한다는 진단이 routing 동기를 뒷받침한다.

# Limitations / Discussion

future intent는 task progress의 한 표현일 뿐이며 명시적 subgoal, object interaction state, language-grounded intermediate plan은 다루지 않는다. label도 trajectory heuristic으로 만들어져 느린 transport나 비정형 contact를 잘못 분류할 수 있다.

평가는 특정 dual-view 구성과 Piper/RoboTwin 중심이다. camera 수·배치와 embodiment가 크게 바뀌는 cross-embodiment routing은 검증되지 않았다. CoRL 2026 상태 역시 arXiv 저자 코멘트 외 공식 기록을 확인하지 못했다.

# 내가 이해한 핵심

multi-view VLA의 병목은 feature capacity만이 아니라 **언제 어느 시야를 믿을지**에 있다. 미래 행동의 성격을 먼저 약하게 예측하고 그 예측을 perception allocation에 되먹임하면, 같은 backbone도 단계 변화에 더 민감해진다.

# 다음에 연결해서 읽을 논문

- $\pi_{0.5}$: FocusVLA가 non-invasive routing을 얹는 강한 flow-VLA baseline이다.
- RDT: random view masking과 intent-guided routing의 차이를 이해하는 비교점이다.
- Multi-view Masked World Models: multi-camera representation 학습과 action-side routing을 연결해 볼 수 있다.
