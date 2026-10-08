---
title: "Juno: Taming Predictive Latents for Vision-Language-Action Models"
date: 2026-10-08
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Yuchen Zhu, Chenyi Xu, Yulin Zhang, Gang Xu, Wentao Zhu"
paper: "https://arxiv.org/abs/2610.09940"
code: ""
project: "https://juno-policy.github.io/"
thumbnail: "/papers/assets/vla/juno-taming-predictive-latents-for-vlas/overview.svg"
---

# 한 줄 요약

Juno는 하나의 action-conditioned JEPA를 제어 정렬 표현·미래 latent teacher·적응 가능한 dynamics model로 재사용해 SimplerEnv 평균 성공률을 60.9%에서 68.5%, 실제 로봇 누적 OOD shift를 0%에서 70%로 높인다.

# 논문 정보

- 제목: Juno: Taming Predictive Latents for Vision-Language-Action Models
- 저자: Yuchen Zhu, Chenyi Xu, Yulin Zhang, Gang Xu, Wentao Zhu
- 발표: arXiv:2610.09940v1 (2026-10-07), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.09940) · [HTML 원문](https://arxiv.org/html/2610.09940)
- 코드/프로젝트: [공식 프로젝트 페이지](https://juno-policy.github.io/) · 원문에서 코드 저장소 공개는 확인하지 못했다.
- 키워드: VLA, action-conditioned JEPA, predictive latent, world model, test-time training

# 핵심 아이디어

미래 표현을 예측하는 JEPA를 VLA에 단순히 붙이면 로봇 embodiment와 제어 분포가 맞지 않거나, 미래 정렬 loss가 action learning을 방해하거나, 배포 shift에서 teacher 자체가 틀릴 수 있다. Juno는 이 세 문제를 VLA lifecycle의 세 단계에 맞춰 분리한다.

먼저 embodiment-matched trajectory로 action-conditioned JEPA를 학습하고 motion-weighted patch dynamics를 global CLS에 모은다. 정책 학습에서는 현재 JEPA patch를 VLA visual token에 융합하고, 별도 reasoning branch가 미래 latent를 예측하도록 distill한 뒤 그 hidden state를 flow-matching action decoder에 연결한다. 배포 시에는 성공·실패 transition 모두로 dynamics를 먼저 적응시키고, 성공으로 검증된 실행만 사용해 정책을 보수적으로 재정렬한다.

# VLA 관점에서 중요한 이유

Juno의 핵심은 world-model latent가 “미래를 잘 맞히는가”와 “행동으로 디코딩 가능한가”를 구분한다는 점이다. 미래 latent를 action generation에 직접 조건화하되 transformation parameter를 분리해 간섭을 줄이고, 실패 rollout도 잘못된 행동 label이 아니라 유효한 dynamics supervision으로 사용한다. 이는 VLA post-training에서 실패 데이터를 버리지 않고도 정책 오염을 피하는 구체적인 설계다.

# Robot / Embodied Setting

- base VLA: Qwen3GR00T, flow-matching action decoder.
- simulation: WidowX 기반 SimplerEnv, GR1 embodiment의 RoboCasa-GR1 24개 tabletop task.
- real robot: AgileX Cobot Magic의 오른쪽 6-DoF PiPER arm과 parallel gripper, 7D end-effector delta action.
- real adaptation data: red cube를 blue bowl에 넣는 과제, 세 시작 위치에서 총 60 demonstrations.
- test-time adaptation: shift 조건별 40 rollout을 수집한 offline adaptation 후 고정된 정책을 20회 평가.

# Method

1. action-conditioned JEPA encoder/predictor를 embodiment-matched transition으로 학습한다.
2. dynamic CLS loss로 움직임이 큰 patch의 변화가 compact global state에 반영되도록 한다.
3. 현재 JEPA patch를 VLA visual token에 융합하고, decoupled reasoning query가 여러 미래 시점 latent를 예측한다.
4. reasoning hidden state가 flow-matching action decoder를 조건화해 미래 예측이 실제 action으로 이어지게 한다.
5. Juno-TTT 1단계는 성공·실패 전체 transition으로 dynamics를 적응시키고, 2단계는 teacher를 고정한 뒤 성공 실행만으로 LoRA와 action head를 재정렬한다.

# 핵심 그림

![Juno의 제어 정렬 JEPA, 예측 추론, dynamics-first test-time adaptation 구조](/papers/assets/vla/juno-taming-predictive-latents-for-vlas/overview.svg)

> 논문 Figure 1과 Section 3을 바탕으로 재구성. 출처: [arXiv HTML, Figure 1](https://arxiv.org/html/2610.09940). 제어 정렬 사전학습, VLA 내부의 분리된 미래 latent 추론, 배포 후 dynamics-first 적응을 한 흐름으로 정리했다.

구조 그림을 고른 이유는 Juno의 기여가 단일 모듈보다 pretraining–policy learning–deployment 전체 연결 방식에 있기 때문이다. 학습 때는 현재 관찰과 action으로 미래 JEPA latent를 만들고 reasoning branch가 이를 맞추며, 추론 때는 미래 영상 없이 현재 영상·언어만으로 latent와 action을 생성한다. 배포 적응에서는 실패까지 dynamics update에 쓰되 정책 target에는 성공 실행만 넣는 비대칭이 기존 joint adaptation과 가장 다르다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (성공률 %, ↑)                 | Juno |          비교 기준 |    차이 | 출처         |
| ---------------------------------------------- | ---: | -----------------: | ------: | ------------ |
| SimplerEnv 평균                                | 68.5 |  60.9 (Qwen3GR00T) |  +7.6%p | 원문 Table 1 |
| RoboCasa-GR1 24-task 평균                      | 59.6 |    48.8 (Qwen3OFT) | +10.8%p | 원문 Table 2 |
| 실제 로봇, background+height+object 누적 shift | 70.0 |   0.0 (Qwen3GR00T) | +70.0%p | 원문 Table 3 |
| 실제 로봇, Gaussian noise에서 TTT              | 65.0 | 40.0 (Juno frozen) | +25.0%p | 원문 Table 4 |
| 실제 로봇, dynamic lighting에서 TTT            | 70.0 | 55.0 (Juno frozen) | +15.0%p | 원문 Table 4 |

RoboCasa-GR1에서는 24개 과제 중 21개에서 Qwen3GR00T보다 높고 16개에서 최고 성능을 냈다. SimplerEnv ablation은 full model 68.5%에서 fusion 제거 시 53.9%로 14.6%p 하락해, predictive branch만 추가하는 것이 아니라 현재 patch grounding과 함께 써야 함을 보여 준다.

# Limitations / Discussion

- 실제 로봇 평가는 하나의 물체 옮기기 과제와 단일 arm에 집중되어 장기·다과제 일반성은 미확인이다.
- shift별 test-time rollout 40개와 offline optimization이 필요해 즉시 online adaptation으로 보기는 어렵다.
- 실제 로봇 성공률은 조건당 20회라 표본이 작고, baseline의 in-domain 40%가 낮아 절대 격차 해석에 주의가 필요하다.
- dynamics teacher가 심한 shift에서 충분히 교정되지 않으면 2단계 policy re-alignment도 잘못된 목표를 따를 수 있다.
- 여러 embodiment에 하나의 공통 Juno를 쓰는 설정은 아직 검증하지 않았다.

# 내가 이해한 핵심

미래 latent의 가치는 예측 정확도 그 자체가 아니라 행동 생성에 유용한 좌표계인가에 달려 있다. Juno는 이를 맞추기 위해 사전학습 데이터의 embodiment, VLA 내부 gradient 경로, 배포 데이터의 성공 여부를 각각 다르게 취급한다. 특히 실패의 결과는 dynamics에는 진실이지만 행동 모방에는 거짓이라는 구분이 가장 실용적인 통찰이다.

# 다음에 연결해서 읽을 논문

- UniWAM: 단일 backbone 안에서 world와 action prediction을 통합하는 직접 비교 대상.
- Completion Aware Guidance: world-action model의 불완전한 미래 예측을 action guidance로 보정하는 접근.
- FAVOR: 미래 예측을 실행 검증과 online recovery에 쓰는 방법.
