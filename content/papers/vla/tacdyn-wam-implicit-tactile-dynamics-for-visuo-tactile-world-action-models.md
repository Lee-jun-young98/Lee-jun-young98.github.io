---
title: "TacDyn-WAM: Learning Implicit Tactile Dynamics in a Heterogeneous Visuo-Tactile World Action Model"
date: 2026-10-02
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Enyi Wang, Mingxin Wang, Quan Shi, Hetian Guo, Hongyu Wang, Xi Wang, Bin Qian, Yupeng Zheng, Wenxuan Song, Houde Liu, Yong Xu, Cheng Chi, Wenchao Ding, Yilun Chen, Yan Wang"
paper: "https://arxiv.org/abs/2610.00638"
code: ""
project: "https://enyi-bean.github.io/TacDyn-WAM-Page/"
thumbnail: "/papers/assets/vla/tacdyn-wam-implicit-tactile-dynamics-for-visuo-tactile-world-action-models/overview.svg"
---

# 한 줄 요약

TacDyn-WAM은 미래 촉각 픽셀을 생성하는 대신 dynamics-aware tactile representation의 다중 horizon 변화를 한 번에 예측해 contact-rich 조작의 성공률과 추론 속도를 함께 개선한다.

# 논문 정보

- 제목: TacDyn-WAM: Learning Implicit Tactile Dynamics in a Heterogeneous Visuo-Tactile World Action Model
- 저자: Enyi Wang 외 14명
- 발표: arXiv:2610.00638 (2026-09-30), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.00638) · [프로젝트](https://enyi-bean.github.io/TacDyn-WAM-Page/)
- 코드/프로젝트: 공식 프로젝트와 supplementary core code가 공개되었다고 명시되나 독립 코드 저장소 URL은 확인하지 못함
- 키워드: world action model, visuo-tactile policy, tactile dynamics, contact-rich manipulation, joint attention

# 핵심 아이디어

촉각은 접촉 위치나 힘의 작은 변화에도 픽셀이 크게 달라져 demonstration 분포 밖에서 미래 이미지를 복원하기 어렵다. TacDyn-WAM은 masked spatio-temporal prediction과 relational distillation으로 TacRep 공간을 학습하고, Implicit Tactile Dynamics Expert가 미래 표현과 변화량을 여러 horizon에 대해 한 번에 예측한다. 현재 촉각 상태는 read-only memory로 action expert에 공급하며 vision·tactile·action expert는 block-wise causal joint attention으로 상호작용한다.

# VLA 관점에서 중요한 이유

World-action model의 미래 예측 대상을 modality마다 다르게 설계해야 한다는 주장을 실험으로 뒷받침한다. 카메라는 visual latent, 촉각은 pixel이 아닌 implicit dynamics를 예측하고 action expert가 둘을 함께 읽는다. 이는 VLA를 multimodal하게 확장할 때 모든 센서를 같은 tokenization·generation recipe에 넣는 접근의 한계를 보여준다.

# Robot / Embodied Setting

- 시뮬레이션: 손가락마다 visuo-tactile sensor가 있는 UniVTAC의 8개 접촉 조작 task.
- 실제 로봇: Franka Research 3, 평행 gripper 양쪽의 Xense tactile sensor, wrist 및 third-person camera.
- 실제 task: cup 쌓기, plug 빼기/끼우기, cup lid 풀기, whiteboard 닦기; task당 60개 teleoperation demonstration, 방법당 task별 20회 평가.
- Pretraining은 OmniViTac 6,000 trajectory subset을 사용하며 실제 task fine-tuning 조건은 baseline과 동일하다.

# Method

1. TacRep encoder를 tactile clip의 masked spatio-temporal prediction과 관계 구조 보존으로 학습한다.
2. Visual expert와 Implicit Tactile Dynamics Expert가 서로 다른 target space에서 미래를 예측한다.
3. Read-only tactile memory가 현재 접촉 상태를 보존하고 action expert에 key/value로 제공한다.
4. 4-stage training으로 tactile grounding, tactile-action alignment, joint training 순서로 연결을 열어 pretrained expert의 붕괴를 막는다.

# 핵심 그림

![시각 미래 latent와 암묵적 촉각 dynamics를 별도 expert로 예측하고 action expert에서 결합하는 TacDyn-WAM](/papers/assets/vla/tacdyn-wam-implicit-tactile-dynamics-for-visuo-tactile-world-action-models/overview.svg)

> 논문 Figures 2–4와 Section 2를 바탕으로 재구성했다. 구조 그림을 고른 이유는 시각과 촉각에 서로 다른 예측 공간을 배정하고 read-only memory로 현재 촉각을 보존하는 이질적 설계가 핵심 기여이기 때문이다. 출처: [논문 Section 2](https://arxiv.org/html/2610.00638v1#S2), [공식 프로젝트](https://enyi-bean.github.io/TacDyn-WAM-Page/).

# Experiments / Results

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓) | 제안 방법 | 비교 기준 | 차이 | 출처 |
| --- | ---: | ---: | ---: | --- |
| FR3 5-task 평균, pretrained 성공률 (%, ↑) | 85.0 | FTP-1 55.0 | +30.0%p | 논문 Table 3 |
| FR3 5-task 평균, per-task only 성공률 (%, ↑) | 71.0 | InternVLA-A1 40.0 | +31.0%p | 논문 Table 3 |
| FR3 Remove Plug, pretrained 성공률 (%, ↑) | 85.0 | FTP-1 45.0 | +40.0%p | 논문 Table 3 |
| UniVTAC 8-task 평균, 성공률 (%, ↑) | 81.5 | 논문 제공 demonstration만 사용 | — | 논문 Table 1 |
| A100, action당 latency (ms, ↓) | 9.7 | LingBot-VA optimized 33.5 | -23.8 ms (71.0% 감소) | 논문 Table 4 |

실제 5개 task 평균에서 modest-scale pretraining을 더한 TacDyn-WAM은 대규모 약 3,000시간 tactile pretraining baseline FTP-1보다 30.0%p 높다. Per-task 데이터만 쓴 버전도 vision-only base보다 31.0%p 높다. Latency 비교는 action chunk 길이가 TacDyn-WAM 50, LingBot-VA 40으로 다르므로 action당 수치만 비교했다.

# Limitations / Discussion

TacRep과 tactile dynamics expert는 한 종류의 vision-based tactile sensor에 맞춰 학습된다. Force sensor나 taxel array, 다른 광학 촉각 센서로의 cross-sensor 일반화는 검증되지 않았다. Pretraining 시 실제 task의 무행동 촉각 clip을 representation 단계에 포함하므로 완전한 zero-shot sensor transfer로 해석해서는 안 된다.

# 내가 이해한 핵심

촉각에서 “미래를 본다”는 것은 다음 이미지를 예쁘게 복원하는 일이 아니라 접촉이 깊어지는지, 미끄러지는지, 회전하는지를 action에 유용한 좌표계에서 예측하는 일이다. TacDyn-WAM의 강점은 modality별 예측 목표를 분리했지만 attention에서는 다시 결합했다는 점이다.

# 다음에 연결해서 읽을 논문

- InternVLA-A1: TacDyn-WAM의 vision world-action base를 이해하기 위해
- FTP-1: 대규모 tactile pretraining과 implicit dynamics modeling의 차이를 비교하기 위해
- ForeTac-VLA: explicit tactile forecasting과 본 논문의 implicit prediction을 비교하기 위해
