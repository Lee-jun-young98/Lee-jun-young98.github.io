---
title: "Wormhole: Escaping the Instruction Black Hole in VLA Policies"
date: 2026-11-28
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Xuetao Li et al."
paper: "https://arxiv.org/abs/2611.34280"
code: ""
project: ""
thumbnail: "/papers/assets/vla/wormhole-instruction-black-hole/architecture.png"
---

# 한 줄 요약

Wormhole은 실행 중 명령이 바뀌어도 기존 동작에 붙잡히는 VLA의 `instruction black hole`을 진단하고, 최적수송으로 새 태스크의 접근 상태까지 로봇을 부드럽게 재배치한 뒤 frozen policy에 제어를 돌려준다.

# 논문 정보

- 제목: Escaping the Instruction Black Hole of Vision-Language-Action Policies via Optimal-Transport Wormholes
- 저자: Xuetao Li, Chen Liu, Jing Wu, Sheng Liu, Miao Li
- 발표: 확인 필요 (arXiv v1, 2026-11-25)
- 링크: [arXiv](https://arxiv.org/abs/2611.34280) · [HTML](https://arxiv.org/html/2611.34280)
- 코드/프로젝트: 공개 확인 필요
- 키워드: instruction switching, frozen VLA, optimal transport, test-time steering, policy recovery

# 핵심 아이디어

정적 imitation data에서는 로봇 상태만으로 이미 수행 중인 태스크를 알아낼 수 있는 `committed region`이 생긴다. 이 영역에서는 instruction이 action에 추가 정보를 주지 않으므로 학습 손실은 명령을 무시하는 정책과 듣는 정책을 구분하지 못한다. 저자들은 이를 transmission ratio와 behavioral event horizon으로 측정한다. 해결책은 언어 신호를 더 세게 넣는 것이 아니라, 기존 태스크의 policy rollout exit와 새 태스크의 성공 trajectory entry를 entropic optimal transport로 연결해 새 태스크가 이미 진행 중인 상태로 로봇을 옮기는 것이다.

# VLA 관점에서 중요한 이유

VLA의 language grounding을 정적 instruction-following accuracy만으로 평가하면 실행 중 사용자 개입을 놓칠 수 있음을 보인다. 특히 attention이 instruction을 계속 읽더라도 action에는 반영되지 않을 수 있다. 학습 없이 frozen $\pi_0$/$\pi_{0.5}$의 committed-switch 성공률을 최대 1.2%에서 93.1%로 올린 결과는 상태 재배치가 모델 내부 steering보다 강력한 recovery interface가 될 수 있음을 보여준다.

# Robot / Embodied Setting

평가는 LIBERO-Spatial의 동일 layout·서로 다른 bowl 목표 pair와 LIBERO-Goal의 object/placement switch pair에서 수행한다. backbone은 공개 $\pi_0$와 $\pi_{0.5}$이며, early·committed·late 시점에 instruction을 바꾼다. 핵심 Table 1은 초기 상태 0–19, 양방향 전환을 합쳐 방법당 early 40회, committed 160회, late 80회를 평가한다. 정책 가중치는 수정하지 않고 simulator state와 successful execution library를 사용한다.

# Method

1. **Black-hole diagnosis:** 원래/새 instruction이 만든 action displacement의 비율로 transmission ratio를 정의하고, switch 성공이 초기값의 절반 이하로 떨어지는 시점을 event horizon으로 잡는다.
2. **Mouth A — old-task exits:** switch state에서 frozen base policy의 old instruction rollout 16개를 샘플링해 기존 태스크가 끌어가는 exit 분포를 만든다.
3. **Mouth B — new-task entries:** 새 instruction의 성공 trajectory에서 approach-phase state를 모으고 남은 completion time으로 가중한다.
4. **OT throat:** old exits와 new entries 사이의 entropic optimal transport coupling을 풀어 far mouth $y^*$와 이동 축을 정한다.
5. **Rate-limited traversal:** gripper open → lift → transit → settle 순서로 action 변화량을 제한하며 $y^*$ 부근으로 이동한 뒤 새 instruction을 넣은 원래 policy에 제어를 반환한다.
6. **Optional distillation:** relocation teacher가 만든 589개 switching episode로 `[LOC]` grounding token을 학습하면 별도 plug-in 없이 committed switch 92.1%를 달성한다.

아래 Figure 2를 고른 이유는 실패 원인, OT 기반 재배치, 선택적 distillation까지 한 화면에서 학습·추론 흐름을 함께 보여주기 때문이다.

# 핵심 그림

![기존 태스크의 exit와 새 태스크의 entry를 최적수송으로 연결하고 frozen VLA를 새 태스크 상태에서 재개하는 Wormhole 파이프라인](/papers/assets/vla/wormhole-instruction-black-hole/architecture.png)

> 원 논문 Figure 2 원본(CC BY 4.0). 출처: [arXiv HTML Figure 2](https://arxiv.org/html/2611.34280#Sx2.F2). 캡션: instruction이 읽히지만 action에 쓰이지 않는 black hole을 진단하고, old-task exit와 new-task entry를 OT로 연결해 rate-limited traversal 후 frozen policy를 재개한다.
>
> 입력은 switch 시점의 observation·robot state, old/new instruction, base-policy rollout과 새 태스크 성공 궤적이다. 추론 시에는 `exit sampling → OT coupling → bounded traversal → frozen policy hand-back`이 실행된다. 학습은 필수가 아니며 하단 distillation 경로만 relocation teacher data와 `[LOC]` token을 사용한다. 기존 action-space steering과 달리 action 방향만 섞지 않고 **새 태스크의 committed region 자체로 상태를 옮기는 것**이 핵심 차이다.

# Experiments / Results

## 주요 실험 결과

| LIBERO-Spatial, 방법 / 지표 (%, ↑/↓)    |     기본 정책 | Wormhole |    차이 | 출처    |
| --------------------------------------- | ------------: | -------: | ------: | ------- |
| $\pi_0$ committed-switch 성공률 (↑)     |           0.0 |     93.1 | +93.1%p | Table 1 |
| $\pi_{0.5}$ committed-switch 성공률 (↑) |           1.2 |     93.1 | +91.9%p | Table 1 |
| $\pi_0$ late-switch 성공률 (↑)          |           0.0 |     91.2 | +91.2%p | Table 1 |
| $\pi_{0.5}$ late-switch 성공률 (↑)      |           0.0 |     86.2 | +86.2%p | Table 1 |
| $\pi_{0.5}$ action discontinuity (↓)    | retreat: 1.49 |     0.32 |   -1.17 | Table 1 |
| $\pi_{0.5}$ jerk (↓)                    | retreat: 0.30 |     0.09 |   -0.21 | Table 1 |

Table 1의 committed 결과는 각 행 160회, late 결과는 80회 trial이다. Wormhole과 scripted retreat는 성공률이 비슷하지만, $\pi_{0.5}$에서 Wormhole의 switch discontinuity 0.32는 retreat 1.49의 약 21%이며 jerk도 0.09 대 0.30이다. 다만 LIBERO-Goal의 다른-object switch에서는 조건에 따라 Wormhole 64.6–91.7%가 retreat 70.8–97.9%보다 낮은 경우도 있다(Table 2).

# Limitations / Discussion

Wormhole은 새 태스크의 성공 trajectory library, simulator state, collision-free traversal controller에 의존한다. far mouth가 관절 한계나 긴 approach 끝에 놓이면 도달하지 못할 수 있고, 두 태스크의 초기 approach가 겹치면 gate가 재배치를 생략해 policy가 다시 freeze할 수 있다. 실제 로봇 검증이 없으며 LIBERO의 제한된 task pair가 중심이므로 93.1%를 일반적인 open-world correction 성능으로 확대 해석하면 안 된다.

# 내가 이해한 핵심

이 논문의 중요한 관찰은 “instruction attention이 남아 있다”와 “instruction이 control을 바꾼다”가 다르다는 것이다. static imitation이 만든 state-language shortcut을 inference-time prompt로 깨기 어렵다면, 정책이 새 명령을 자연스럽게 수행할 수 있는 상태까지 물리적으로 옮기는 편이 더 직접적이다.

# 다음에 연결해서 읽을 논문

- [Causeway](https://arxiv.org/abs/2609.30913): instruction switching에서 task accessibility를 복원하는 학습 기반 접근
- [$\pi_0$](https://arxiv.org/abs/2410.24164): 평가 backbone의 flow-matching VLA 구조
- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): knowledge transfer와 장기 manipulation backbone
- [ReGuide](https://arxiv.org/abs/2609.38616): frozen VLA의 공간 목표를 test time에 교정하는 접근
