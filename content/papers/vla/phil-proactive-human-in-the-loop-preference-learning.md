---
title: "PHIL: Correct Robots Before They Make Mistakes"
date: 2026-11-05
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Xinkai Jiang, Jing Jiang, Hongyi Zhou, Pankhuri Vanjani, Ahmad Baki, Jakub Suliga, Ge Li, Zhuoyue Li, Gerhard Neumann, Rudolf Lioutikov"
paper: "https://arxiv.org/abs/2611.05667"
code: ""
project: "https://intuitive-robots.github.io/PHIL-page/"
thumbnail: "/papers/assets/vla/phil-proactive-human-in-the-loop-preference-learning/overview.svg"
---

# 한 줄 요약

PHIL은 XR로 정책의 미래 action chunk를 미리 보여주고 오류 전에 사람이 개입하게 한 뒤, 같은 상태에서 거절된 예측과 실제 교정 궤적을 preference pair로 학습해 X-VLA의 평균 성공률을 57.8%에서 76.9%로 높인다.

# 논문 정보

- 제목: Correct Robots Before They Make Mistakes: Proactive Human-in-the-Loop Intervention via Preference Learning
- 저자: Xinkai Jiang, Jing Jiang, Hongyi Zhou, Pankhuri Vanjani, Ahmad Baki, Jakub Suliga, Ge Li, Zhuoyue Li, Gerhard Neumann, Rudolf Lioutikov
- 발표: 확인 필요 (arXiv v1, 2026-11-03)
- 링크: [arXiv](https://arxiv.org/abs/2611.05667) · [HTML](https://arxiv.org/html/2611.05667)
- 코드/프로젝트: [프로젝트](https://intuitive-robots.github.io/PHIL-page/) · 코드 공개 확인 필요
- 키워드: proactive intervention, human-in-the-loop, preference learning, XR teleoperation, X-VLA post-training

# 핵심 아이디어

reactive correction은 로봇이 이미 틀린 뒤 사람에게 넘겨 recovery action까지 학습 데이터에 섞인다. PHIL은 정책이 예측한 $H$-step end-effector trajectory를 물리 공간에 XR로 표시해, 사람이 실행 전에 거절하도록 한다. 개입 중에도 고정 주기 $B$마다 정책을 shadow query하고, 거절 예측 $A^-$와 같은 query state에서 실제로 이어진 $H$개 action $A^+$를 짝지어 $A^+ \succ A^-$ preference supervision으로 쓴다.

# VLA 관점에서 중요한 이유

VLA post-training에서 “좋은 action을 더 모으는 것”과 “이 상태에서 정책이 내려고 한 나쁜 action보다 교정 action이 낫다”를 구분한다. proactive data를 behavior cloning만 하면 이득이 일관되지 않았지만, 같은 positive sample에 rejected prediction을 붙인 pairwise objective는 Towel Folding 40%→68%, Cook the Carrot 28%→52%로 높였다. X-VLA에서도 세 task·세 demonstration budget 평균이 HG-DAgger 57.8%에서 PHIL 76.9%로 상승한다.

# Robot / Embodied Setting

실환경 4개 task를 평가한다. Pick Up Banana와 Towel Folding은 단일 단계이고, Cook the Carrot와 Lemon in the Drawer는 각각 3단계 장기 task다. BESO 기반 diffusion policy는 네 task 모두, pretrained X-VLA는 ceiling에 가까운 Banana를 제외한 세 task에서 평가한다. base demonstrations는 Banana 3/6/9개, 나머지는 10/20/30개이며 adaptation 조건마다 5개 correction episodes를 추가한다. 각 SR/TCS 수치는 조건당 25 rollouts다.

# Method

1. base demonstration으로 action-chunking policy를 학습하거나 VLA를 task에 fine-tune한다.
2. rollout 중 정책을 매 $B\leq H$ control steps마다 query하고, $H$-step Cartesian end-effector trajectory를 XR에 표시한다.
3. 사람이 미래 오류를 예상하면 실행 전에 takeover한다. 정책은 개입 중에도 같은 schedule로 shadow prediction을 계속 내며, release 시 마지막으로 수용된 prediction은 negative에서 제외한다.
4. 각 retained query state $c_t$에서 거절 예측 $A_t^-$와 다음 $H$개 실제 실행 action $A_t^+$를 같은 horizon으로 묶는다. positive window는 release 뒤 policy action을 일부 포함할 수도 있다.
5. native imitation loss 차이 $\Delta_\theta=\ell_\theta(A^-,c)-\ell_\theta(A^+,c)$에 logistic preference loss를 적용하고, original demonstration의 imitation loss를 함께 유지한다.
6. 수집·후학습이 끝난 뒤 inference에서는 XR이나 사람 없이 post-trained diffusion policy/X-VLA가 기존처럼 action chunk를 생성한다.

# 핵심 그림

![PHIL의 XR 사전 개입, 동일 상태 preference pair 구성, VLA 후학습 파이프라인](/papers/assets/vla/phil-proactive-human-in-the-loop-preference-learning/overview.svg)

> 논문 Figure 1, Figure 3, Equations (4)–(9)를 바탕으로 재구성한 PHIL 파이프라인. 출처: [논문 HTML Figure 1 및 Method](https://arxiv.org/html/2611.05667#S3). 원본 그림을 복제하지 않고 rollout, pair 생성, post-training, 배포 흐름을 한국어로 도식화했다.
>
> 구조 그림을 고른 이유는 PHIL의 핵심이 XR 장치 자체보다 **같은 물리 상태에서 거절 action과 교정 action을 정렬하는 데이터 생성 구조**에 있기 때문이다. 수집 시에는 정책 예측 → XR preview → 사람 takeover → shadow query가 반복되고, 학습 시에는 $(c,A^+,A^-)$가 base imitation과 preference loss로 들어간다. 배포 추론에서는 human/XR branch가 제거된다.

# Experiments / Results

## 주요 실험 결과

| 설정 / 지표 (success rate %, ↑)         | PHIL |      비교 기준 |    차이 | 출처                |
| --------------------------------------- | ---: | -------------: | ------: | ------------------- |
| X-VLA, 3 task×3 demo budget 평균        | 76.9 | HG-DAgger 57.8 | +19.1%p | Abstract / Table I  |
| X-VLA Towel Folding, 10 demos           |   64 |   HG-DAgger 32 |   +32%p | Table I             |
| X-VLA Cook the Carrot, 20 demos         |   68 |   HG-DAgger 48 |   +20%p | Table I             |
| X-VLA Lemon in Drawer, 10 demos         |   92 |   HG-DAgger 68 |   +24%p | Table I             |
| Diffusion Policy, 전체 task·budget 평균 | 70.3 | HG-DAgger 44.0 | +26.3%p | Abstract / Figure 5 |
| Diffusion Policy Cook Carrot, 10 demos  |   52 |   HG-DAgger 24 |   +28%p | Figure 5            |

Table I의 모든 값은 조건당 25 rollouts와 5 correction episodes를 사용한다. Lemon in the Drawer에서 PHIL은 30 demonstrations일 때 SR/TCS 100%/100%에 도달하고 HG-DAgger는 80%/88%다(+20%p SR). 같은 proactive positive data를 쓰되 preference objective만 비교한 ablation에서도 Towel Folding 40%→68%(+28%p), Cook the Carrot 28%→52%(+24%p)로 rejected action의 명시적 negative supervision이 중요했다.

# Limitations / Discussion

공식 venue와 code 공개는 확인되지 않았다. 실험은 한 실로봇 setup의 4개 task, 조건당 25 rollouts에 한정되고 intervention 품질은 operator가 미래 궤적을 올바르게 판별하는 능력과 XR registration에 의존한다. 개입 중 query가 한 번도 없거나 완전한 $H$-step window가 남지 않으면 preference pair가 생성되지 않는다. proactive와 reactive data를 섞은 hybrid 조건은 objective에 따라 오히려 악화됐고, safety guarantee·다중 사용자 일관성·대규모 generalist VLA capability 보존은 검증하지 않았다.

# 내가 이해한 핵심

PHIL은 실패 뒤의 recovery를 모방시키기보다 실패 직전 같은 상태에서 “정책이 하려던 것”과 “사람이 실제로 한 것”을 직접 대조한다. 그래서 correction을 단순 추가 demonstration이 아니라 state-aligned preference로 바꾸며, deployment 때는 사람 없이도 그 순위를 action distribution에 내재화한다.

# 다음에 연결해서 읽을 논문

- [HG-DAgger](https://arxiv.org/abs/1805.11169): human-gated behavior cloning 비교 기준
- [X-VLA](https://arxiv.org/abs/2510.10274): PHIL이 post-training한 pretrained VLA backbone
- [VR-DAgger](https://arxiv.org/abs/2605.27114): immersive VR 기반 uncertainty-guided on-policy correction
- [Predictive Preference Learning from Human Interventions](https://arxiv.org/abs/2510.01545): proactive intervention preference learning의 선행 접근
