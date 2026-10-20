---
title: "UMI-WM: Interactive World Modeling for Bimanual Manipulation from Wrist Cameras"
date: 2026-10-20
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "World Model"
venue: "확인 필요"
authors: "Jingxiang Guo, Haoyu Zhao, Xidong Zhang, Yuhang Zheng, Hao Wu, Chen Gao, Jianshu Zhou, Shuicheng Yan, Weihao Yuan"
paper: "https://arxiv.org/abs/2610.23913"
code: ""
project: ""
thumbnail: "/papers/assets/vla/umi-wm-bimanual-wrist-camera-world-model/overview.svg"
---

# 한 줄 요약

양팔의 상대 camera pose와 gripper action을 각 손목 stream에 주입하고 sparse hub로 장면 정보를 교환해, 두 손목 영상을 함께 생성·평가·robot action으로 복원하는 bimanual world model이다.

# 논문 정보

- 제목: UMI-WM: Interactive World Modeling for Bimanual Manipulation from Wrist Cameras
- 저자: Jingxiang Guo 외 8명
- 발표: 확인 필요 (arXiv v1, 2026-09-30; cs.RO 신규 목록 2026-10-20)
- 링크: [arXiv](https://arxiv.org/abs/2610.23913)
- 라이선스: CC BY-SA 4.0
- 키워드: bimanual manipulation, interactive world model, UMI, wrist camera, action fidelity

# 핵심 아이디어

UMI-WM은 각 arm의 10D 상대 camera pose·gripper width를 해당 wrist-view token에만 주입하고, sparse hub token으로 두 stream의 shared scene 정보를 교환한다. CameraNoise, CamRay, PRoPE가 motion·geometry를 conditioning하고 block-causal history가 긴 rollout을 이어간다.

30-step Teacher를 4-step Student로 distill한다. 생성 영상에는 같은 frozen inverse dynamics model(IDM)을 적용해 action을 복원하고, conditioning action과의 차이를 Bimanual Action Fidelity(BAF)로 측정한다. 이 공통 interface는 world-model teleoperation과 physical robot IK 연결에도 쓰인다.

# VLA 관점에서 중요한 이유

양손 manipulation의 world model은 두 action을 따르면서 서로 다른 wrist camera가 같은 장면을 일관되게 보여야 한다. UMI-WM은 action following을 시각 품질과 분리된 정량 지표로 만들고, visual prediction → inverse action recovery → robot execution을 한 loop로 연결한다.

또한 portable UMI data의 서로 다른 local frame을 window 첫 frame 기준 상대 action으로 통일해 public robot data, open-world UMI, calibrated studio UMI를 함께 학습한다. bimanual policy pretraining·planning을 위한 data interface라는 의미가 크다.

# Robot / Embodied Setting

- data: public robot data + open-world UMI + in-studio calibrated bimanual UMI
- observation: left/right wrist RGB, 30 Hz
- action: arm별 relative translation 3D + rotation 6D + gripper width 1D
- evaluation: 320 held-out episodes, 1,008 paired-wrist windows, window당 189 frames
- generation: A100 80GB, Teacher 30 steps / Student 4 steps
- physical application: IDM action recovery 후 calibrated IK와 gripper command로 실행

# Method

각 arm의 pose를 window 첫 frame 기준으로 바꾸어 global frame 의존성을 없애고 10D action으로 표현한다. frozen VAE와 video DiT가 두 wrist stream을 처리하며, shared temporal transformer가 aligned action을 encode한다. view $v$에는 대응 arm $\pi(v)$의 action state만 gated residual로 주입한다.

SRAE는 view·role·actor identity를 분리하고 sparse hub attention은 양팔의 요약을 교환한다. CameraNoise는 camera motion에 맞춘 noise를, CamRay와 PRoPE는 ray·relative pose geometry를 제공한다. Student는 block-causal distillation로 4-step generation을 수행한다. 마지막으로 IDM이 생성 영상에서 양팔 action을 복원해 BAF를 계산하거나 robot IK로 보낸다.

# 핵심 그림

![양팔 action을 좌우 wrist stream에 각각 주입하고 sparse hub와 geometry conditioning으로 공동 영상을 생성한 뒤 IDM으로 action을 복원하는 UMI-WM 구조](/papers/assets/vla/umi-wm-bimanual-wrist-camera-world-model/overview.svg)

> 그림 1. UMI-WM의 multi-view 생성과 action recovery 흐름. 논문 Figure 4와 Equation 1–3을 바탕으로 직접 재구성했다. 출처: [arXiv:2610.23913](https://arxiv.org/html/2610.23913).

구조 그림을 고른 이유는 양손 action이 각 wrist stream에 따로 들어가면서 hub에서만 shared context를 교환하는 구조와, 생성 결과가 다시 action으로 복원되는 loop를 함께 보여주기 위해서다. 입력은 양손 history와 arm별 상대 pose·gripper sequence다.

DiT의 view-specific injection은 control separation을, sparse hub와 geometry module은 cross-view consistency를 맡는다. Teacher에서 distill된 Student가 미래 wrist video를 만들면 frozen IDM이 action을 회수해 BAF 평가나 physical robot IK에 사용한다.

# Experiments / Results

## 주요 실험 결과

아래 값은 논문 Table 1–3에서 직접 대조했다. BAF·LPIPS·FPS는 같은 320-episode test set과 명시된 생성 설정 안에서만 비교했다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓) | 제안 방법 | 비교 기준 | 차이 | 출처 |
| --- | ---: | ---: | ---: | --- |
| BAF (↑), Teacher vs best adapted action baseline | 76.36 | Gamma-World 52.93 | +23.43 | Table 3 |
| BAF (↑), Student 4-step vs best camera baseline | 71.55 | Matrix-Game 3.0 41.26 | +30.29 | Table 3 |
| paired-wrist generation (FPS, ↑) | Student 1.81 | Teacher 0.26 | +1.55, 6.9× | Table 1 |
| LPIPS (↓) | Teacher 0.332 | Gamma-World 0.397 | -0.065 | Table 1 |
| BAF (↑), full geometry vs w/o CamRay+hub routing | 76.36 | 46.79 | +29.57 | Table 2 |
| Student sampling BAF / FPS | 4-step 71.55 / 1.81 | 2-step 53.82 / 3.31 | +17.73 / -1.50 | Table 2 |

Teacher와 Student의 BAF는 각각 76.36, 71.55로 모든 생성 baseline보다 높았다. 4-step Student는 Teacher보다 6.9배 빠르면서 BAF를 4.81만 잃었다. geometry conditioning 제거 시 BAF가 약 29점 떨어져 cross-view control에서 camera geometry가 핵심임을 보였다.

# Limitations / Discussion

주요 정량 평가는 생성 fidelity와 IDM 기반 action fidelity이며, 대규모 closed-loop robot task success 비교는 아니다. BAF는 같은 frozen IDM의 오차와 tolerance 선택에 의존하고, GT video도 97.72로 100이 아니다.

4-step Student의 1.81 paired FPS는 30 Hz real-time control보다 훨씬 느리다. public data 일부는 shared-frame calibration이 없어 geometric supervision이 불균일하고, physical execution은 대표 rollout 중심이다. 긴 horizon의 contact error 누적과 안전성은 추가 검증이 필요하다.

# 내가 이해한 핵심

양손 world model에서 좋은 영상만으로는 action을 따랐는지 알 수 없다. UMI-WM의 핵심은 두 view를 공동 생성하는 구조와, 생성 영상이 실제 conditioning action을 담았는지 inverse dynamics로 다시 확인하는 평가·실행 interface를 함께 만든 것이다.

# 다음에 연결해서 읽을 논문

- UMI / Diffusion Policy: portable wrist-camera demonstration interface의 출발점이다.
- Gamma-World: sparse hub multi-view modeling의 직접적인 구조적 선행 연구다.
- UniW(A)M: world generation과 action prediction을 mixture-of-experts로 통합한다.
- ForeTac-VLA: bimanual·contact-rich setting에서 tactile prediction을 결합하는 방향이다.
