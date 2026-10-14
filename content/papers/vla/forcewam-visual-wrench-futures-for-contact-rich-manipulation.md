---
title: "ForceWAM: Decoupling Future and Response Learning from Demo and Play Data"
date: 2026-10-14
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Zijun Xu et al."
paper: "https://arxiv.org/abs/2610.18852"
code: ""
project: "https://force-wam.github.io/"
thumbnail: "/papers/assets/vla/forcewam-visual-wrench-futures-for-contact-rich-manipulation/overview.svg"
---

# 한 줄 요약

ForceWAM은 성공 demonstration으로 목표 visual-wrench future를 만들고 task-agnostic play로 그 future를 실현하는 inverse dynamics를 학습해 접촉 작업의 반응성과 일반화를 함께 얻는다.

# 논문 정보

- 제목: ForceWAM: Decoupling Future and Response Learning from Demo and Play Data for Contact-Rich Manipulation
- 저자: Zijun Xu, Wendi Chen, Xinkai Wang, Jiachen Zou 외
- 발표: arXiv:2610.18852v1 (2026-10-13), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.18852) · [HTML 원문](https://arxiv.org/html/2610.18852)
- 코드/프로젝트: [공식 프로젝트](https://force-wam.github.io/)
- 키워드: contact-rich manipulation, force world model, inverse dynamics, play data, visual-wrench future

# 핵심 아이디어

성공 시연은 목표 작업이 어떤 접촉 결과를 가져야 하는지는 보여 주지만, 힘이 어긋났을 때 어떤 국소 행동으로 복구할지는 충분히 보여 주지 않는다. ForceWAM은 이 둘을 분리한다. ForceWM은 성공 task data만으로 미래 wrist video와 6축 wrench를 생성하고, IDM은 task와 play 모두에서 기록된 visual-wrench future를 실현한 action을 학습한다.

# VLA 관점에서 중요한 이유

언어 조건 정책에 task-agnostic play를 그대로 섞으면 목표와 무관한 행동 분포를 모방할 수 있다. ForceWAM은 언어가 정한 목표 future와 접촉 반응 지식을 서로 다른 모듈에 배치해, play의 풍부한 force-response 정보를 목표 정책을 흐리지 않고 재사용한다. 이는 multimodal VLA에서 modality 추가보다 supervision의 역할 분리가 중요함을 보여 준다.

# Robot / Embodied Setting

- 로봇: 6축 force/torque sensor와 wrist camera를 장착한 실제 manipulator.
- 작업: force-regulated sliding, box flipping, disturbance가 있는 flipping, Hanoi ring placement.
- 관측: wrist RGB, 현재·연속 6축 wrench, 언어 instruction.
- 평가: 각 task/조건당 동일 초기 상태 20회, safety stop·사람 개입 없이 완료해야 성공. Sliding은 5–15 N 유지와 전체 경로 완료를 추가 요구.
- 데이터: task별 성공 demonstration과 task-agnostic pressing·sliding·release play 최대 200 episode.

# Method

1. ForceWM은 현재 image·wrench·language에서 future visual latent와 future wrench trajectory를 joint EDM으로 생성한다.
2. IDM은 현재 관측과 기록된 visual-wrench future에서 짧은 Cartesian TCP pose·gripper action sequence를 diffusion으로 복원한다.
3. task data는 ForceWM과 IDM을 모두, play data는 IDM만 학습한다.
4. future condition dropout·perturbation으로 생성 오차에 대한 IDM의 강건성을 높인다.
5. 추론에서 느린 ForceWM은 future reference를 주기적으로 갱신하고, causal IDM은 새 wrench 측정이 올 때마다 action을 빠르게 수정한다.

# 핵심 그림

![성공 task demonstration이 ForceWM을, task와 play가 IDM을 학습하고 배포 시 visual-wrench future와 실시간 힘 피드백으로 행동을 갱신하는 ForceWAM](/papers/assets/vla/forcewam-visual-wrench-futures-for-contact-rich-manipulation/overview.svg)

> 논문 Figure 2를 바탕으로 재구성. 출처: [arXiv HTML, Figure 2](https://arxiv.org/html/2610.18852). 학습 데이터 분리와 slow-fast 배포 경로를 강조했다.

구조 그림을 고른 이유는 성공 시연과 play의 역할을 분리하는 factorization이 논문의 핵심이기 때문이다. 학습 시 ForceWM은 task-compatible future만, IDM은 더 넓은 action-contact response를 배운다. 추론 시 언어 조건 ForceWM의 시각·힘 목표가 느린 기준이 되고, causal IDM이 실제 wrench prefix를 받아 빠르게 action을 보정한다.

# Experiments / Results

## 주요 실험 결과

| 실제 작업 / 성공률 (%, ↑) | ForceWAM Full-play | Task-only IDM |  증가 |      강한 외부 baseline | 출처                   |
| ------------------------- | -----------------: | ------------: | ----: | ----------------------: | ---------------------- |
| Sliding, 5–15 N·전체 경로 |                 85 |            40 | +45%p | FA-WAM / ImplicitRDP 20 | 원문 Table 1, Figure 4 |
| Box flip                  |                 95 |            75 | +20%p |               FA-WAM 60 | 원문 Table 1           |
| Box flip + disturbance    |                 85 |            65 | +20%p |               FA-WAM 40 | 원문 Table 1           |
| Hanoi ring placement      |                 90 |            75 | +15%p |             Fast-WAM 65 | 원문 Table 1           |

task demonstration, ForceWM, IDM update 수를 고정하고 play episode만 늘린 비교에서 네 작업 모두 15–45%p 상승했다. 특히 sliding의 +45%p는 시각적 경로만으로는 규정 힘을 유지하기 어렵고, play에서 얻은 action-wrench transition이 실제 제어에 직접 기여했음을 보여 준다.

# Limitations / Discussion

- 네 조건, task당 20회인 단일 실제 setup 결과라 embodiment·sensor·작업 일반화는 제한적이다.
- wrist camera와 6축 F/T sensor의 정확한 동기화·calibration에 의존한다.
- ForceWM의 느린 갱신 사이에 접촉 상태가 급변하면 cached future가 오래될 수 있다.
- play가 안전 범위를 벗어난 접촉까지 충분히 덮는지, 다른 재질·도구로 전이되는지는 검증되지 않았다.
- 공식 conference venue는 확인되지 않았다.

# 내가 이해한 핵심

목표를 아는 데이터와 물리 반응을 아는 데이터는 같지 않다. 성공 시연은 “어디로 가야 하는가”를, play는 “힘이 이렇게 변할 때 어떻게 반응하는가”를 담당하게 한 분리가 성능의 원천이다.

# 다음에 연결해서 읽을 논문

- TacDyn-WAM: tactile latent dynamics를 action generation과 결합하는 다른 접촉 모델이다.
- FA-WAM: force-aware joint world-action modeling과 ForceWAM의 분리형 설계를 비교할 수 있다.
- Diffusion Policy: IDM의 action diffusion 기반을 이해하는 출발점이다.
