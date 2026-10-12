---
title: "Beyond Actions: Learning Future Operation Targets for Vision-Language-Action Models"
date: 2026-10-12
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Min Lin, Bokai Zhou, Jianqi Lin, Kaiyuan Yang, Yicheng Chang, Junjie Yu, Xiaofan Liu, Jianhua Han, Rui Li, Shen Zhao, Xiaodan Liang"
paper: "https://arxiv.org/abs/2610.13212"
code: ""
project: "https://afceproject.github.io/AFCE-Web/"
thumbnail: "/papers/assets/vla/beyond-actions-action-future-coupled-effect-learning/overview.svg"
---

# 한 줄 요약

AFCE는 action·로봇 반응·시각 변화를 하나의 시간순 Effect token으로 압축해 VLA가 action 대신 물리적 결과를 예측하게 하고, DexJoCo 전체 성공률을 $\pi_{0.5}$의 39.15%에서 50.97%로 높인다.

# 논문 정보

- 제목: Beyond Actions: Learning Future Operation Targets for Vision-Language-Action Models
- 저자: Min Lin, Bokai Zhou, Jianqi Lin, Kaiyuan Yang, Yicheng Chang, Junjie Yu, Xiaofan Liu, Jianhua Han, Rui Li, Shen Zhao, Xiaodan Liang
- 발표: arXiv:2610.13212v1 (2026-10-09), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.13212) · [HTML 원문](https://arxiv.org/html/2610.13212)
- 코드/프로젝트: [공식 프로젝트](https://afceproject.github.io/AFCE-Web/) · 코드 공개는 확인되지 않음
- 키워드: effect token, future-grounded target, flow matching, dexterous manipulation, cross-embodiment

# 핵심 아이디어

같은 action command도 접촉과 hand configuration에 따라 다른 결과를 만들고, 다른 motion이 같은 task effect를 낼 수 있다. AFCE는 정책 target을 action 자체에서 Effect로 바꾼다. Stage I tokenizer는 demonstration의 action $A_t$, 실제 robot response $\Delta S_t$, sparse visual transition $V_t$를 $H=30$, $D_E=256$의 시간순 Effect $E_t^*$로 encoding하고 세 정보를 복원하도록 학습한다. Stage II flow-matching VLA는 현재 관측만으로 normalized Effect를 예측하고 state-conditioned decoder가 이를 실행 가능한 action chunk로 바꾼다.

# VLA 관점에서 중요한 이유

VLA의 output representation을 “무슨 명령을 내렸는가”에서 “그 명령이 무엇을 바꾸는가”로 옮긴다. 이 target은 future evidence를 포함하지만 배포 시에는 현재 image·instruction·state만 필요하다. 또한 single-arm과 bimanual embodiment가 shared Effect model을 쓰고 입출력 adapter만 분리해, action dimension이 다른 로봇 사이의 공유 단위를 물리적 결과로 제안한다.

# Robot / Embodied Setting

- benchmark: DexJoCo rand-obj, single-arm 6개와 bimanual dexterous task 5개.
- 입력: scene/wrist images, language instruction, proprioceptive state.
- 평가: task당 50 episodes × environment seed 3개, method당 총 1,650 closed-loop episodes.
- action horizon: 30 steps; 추론 시 10 flow-denoising steps.
- 비교: 공개 DexJoCo $\pi_{0.5}$ multi-task checkpoint와 UVT.

# Method

1. Stage I tokenizer $T_\phi(A_t,\Delta S_t,V_t)$가 step별 Effect token을 만든다.
2. Action reconstruction, state-transition reconstruction, sparse visual-transition reconstruction이 Effect가 실행 세부와 물리 변화를 함께 보존하도록 학습시킨다.
3. Tokenizer를 freeze하고 Effect를 cache·normalize해 Stage II의 고정 target으로 쓴다.
4. Flow-matching VLA가 현재 image·language·state에서 Effect distribution을 예측한다.
5. State-conditioned decoder가 denormalized Effect를 continuous action chunk로 변환하고 closed loop로 다시 계획한다.
6. Embodiment별 tokenizer/decoder interface와 shared Effect predictor를 분리한다.

# 핵심 그림

![시연의 행동과 로봇 반응 및 시각 변화가 Effect token을 만들고 VLA가 현재 관측에서 Effect를 예측해 행동으로 복호화하는 AFCE 2단계 구조](/papers/assets/vla/beyond-actions-action-future-coupled-effect-learning/overview.svg)

> 논문 Figure 2를 바탕으로 재구성. 출처: [arXiv HTML, Figure 2](https://arxiv.org/html/2610.13212). Stage I의 target construction과 Stage II의 배포 경로를 분리했다.

구조 그림을 고른 이유는 future evidence가 학습 target을 만들 때만 쓰이고 배포 입력에는 들어오지 않는 점을 명확히 보여주기 위해서다. Stage I은 $(A,\Delta S,V)$를 하나의 Effect로 압축하고 재구성 loss로 실행 가능성을 보존한다. Stage II의 핵심 식은 $\hat Z_t\sim p_\theta(Z\mid o_t)$, $\hat A_t=D_\psi(\mathcal N^{-1}(\hat Z_t),s_t)$이며, 현재 관측에서 결과를 상상한 뒤 state-conditioned action으로 읽어낸다.

# Experiments / Results

## 주요 실험 결과

| DexJoCo rand-obj / 성공률 (%, ↑) |  AFCE | $\pi_{0.5}$ |     차이 | 출처         |
| -------------------------------- | ----: | ----------: | -------: | ------------ |
| 전체 11-task 평균                | 50.97 |       39.15 | +11.82%p | 원문 Table 1 |
| bimanual 5-task 평균             | 37.33 |        9.73 | +27.60%p | 원문 Table 1 |
| Microwave                        | 81.33 |       32.00 | +49.33%p | 원문 Table 1 |
| Photograph                       | 59.33 |        8.00 | +51.33%p | 원문 Table 1 |
| single-arm 6-task 평균           | 62.33 |       63.67 |  -1.34%p | 원문 Table 1 |

모든 방법은 동일한 rand-obj protocol에서 task당 150회(50×3 seeds) 평가된다. AFCE는 총 841/1,650회를 성공했고, 전체 이득은 주로 bimanual task에서 왔다. 반대로 Pinch Tongs는 43.33%에서 5.33%로 크게 하락했으므로, Effect target이 정밀 단일팔 제어까지 일관되게 개선한다고 말할 수는 없다.

# Limitations / Discussion

- Effect target 생성에 시간 정렬된 action, robot state, future image가 모두 필요하다.
- sparse visual feature는 미세 접촉을 놓치고 occlusion·viewpoint 변화에 취약할 수 있다.
- 256차원 Effect도 ground-truth replay 성공이 25/110에 그쳐 representation reconstruction이 실행 가능성을 보장하지 않는다.
- precision-sensitive Pinch Tongs에서 큰 회귀가 있어 aggregate gain이 균일하지 않다.
- 한 checkpoint의 세 environment seed 분산이며 독립 training runs의 분산은 아니다.
- shared Effect가 실제 embodiment-invariant representation이라는 증거는 아직 부족하다.
- 공식 conference venue와 code 공개는 확인되지 않았다.

# 내가 이해한 핵심

AFCE의 강점은 미래를 pixel로 생성하는 데 있지 않다. 행동과 그 결과를 같은 latent target에 묶어 “어떻게 움직일지”와 “무엇을 바꿀지” 사이의 간극을 줄인다. 다만 결과 중심 압축이 정밀 제어 세부를 버릴 수 있다는 trade-off도 실험에서 드러난다.

# 다음에 연결해서 읽을 논문

- Forward Dynamics Models: 미래 결과를 action feature의 보조 supervision으로 쓰는 대안이다.
- UNITAS: action과 scene 변화를 metric 3D point flow로 통일한다.
- Direction-Scale Decomposition: action representation 자체의 구조가 제어 성능에 미치는 영향을 다룬다.
