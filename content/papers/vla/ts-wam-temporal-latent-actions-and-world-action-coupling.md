---
title: "TS-WAM: Temporal Latent Actions and World-Action Coupling for Vision-Language Robot Control"
date: 2026-10-16
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Menghao Yin et al."
paper: "https://arxiv.org/abs/2610.21922"
code: ""
project: ""
thumbnail: "/papers/assets/vla/ts-wam-temporal-latent-actions-and-world-action-coupling/overview.svg"
---

# 한 줄 요약

TS-WAM은 미래 프레임을 보는 EMA teacher로 현재 관측의 latent action을 자기지도 학습하고, 그 latent로 예측한 미래 시각 특징의 변화량을 flow action head에 연결해 action-free human video를 실제 제어 성능으로 바꾼다.

# 논문 정보

- 제목: TS-WAM: Temporal Latent Actions and World-Action Coupling for Vision-Language Robot Control
- 저자: Menghao Yin, Jiaju Yin, Xiyue Dong, Lixin Xu, Zhenhui Zhang, Ke Zhang, Yating Feng, Renjing Xu
- 발표: arXiv:2610.21922v1 (2026-10-15), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.21922) · [HTML 원문](https://arxiv.org/html/2610.21922)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: world-action model, JEPA, latent action, action-free video, future feature prediction

# 핵심 아이디어

TS-WAM은 `vlm-jepa`와 `delta-lwm`을 end-to-end로 결합한다. online student는 현재 이미지와 언어만 보고 latent action $\hat z_t$를 예측하고, EMA teacher는 현재·미래 이미지를 함께 본 target $z_t^Y$를 제공한다. delta-lwm은 현재 DINOv3 특징과 latent action으로 미래 특징의 절대값이 아니라 변화량 $\Delta F_t=F_{t+1}-F_t$를 예측한다. 이 예측 미래 특징을 DiT flow action head의 조건으로 넣어 세계 변화 예측과 행동 생성을 직접 연결한다.

# VLA 관점에서 중요한 이유

action-free video는 규모가 크지만 로봇 action label이 없어 VLA에 바로 쓰기 어렵다. TS-WAM은 미래를 보는 teacher가 만든 temporal code를 현재만 보는 student가 맞히게 하여 video의 변화 정보를 latent action으로 바꾼다. 동시에 action head가 예측 미래 특징에 의존하도록 학습해, world model이 보조 loss에 머무르지 않고 실제 행동 선택에 관여하게 만든다.

# Robot / Embodied Setting

- 시뮬레이션: LIBERO 4개 suite, LIBERO-Plus 7개 OOD 변화, SimplerEnv의 WindowX·Google Robot.
- 실제 로봇: 7-DoF Franka Research 3 단일 팔과 RevoTron 양팔 humanoid + dexterous hands.
- 실제 태스크: bowl stacking, item sorting, 두 플랫폼의 long-horizon drawer open-place-close.
- OOD 조건: 추가 조명, 물체 배치 변경, tabletop 배경 texture 변경.
- 학습/배포: 4×A100 학습, 1×RTX 4090 추론, 30 Hz 제어.

# Method

1. online X-VLM은 현재 관측·언어와 latent query를 받아 predictor를 통해 $\hat z_t$를 만든다.
2. EMA teacher는 현재와 미래 프레임을 함께 보고 target latent $z_t^Y$를 만든다. stop-gradient target과 student latent의 L1 temporal alignment를 학습한다.
3. frozen DINOv3가 현재·미래 공간 특징 $F_t,F_{t+1}$를 만들고, delta-lwm이 $(F_t,\hat z_t)$에서 $\widehat{\Delta F}_t$를 예측한다.
4. 예측 미래 특징 $\hat F_{t+1}=F_t+\widehat{\Delta F}_t$와 현재 특징, VLM 문맥, robot state를 DiT flow action head에 넣는다.
5. 학습 초기는 실제 미래 특징도 섞고 점차 예측 특징의 비율을 높인다. 추론에서는 teacher와 실제 미래 프레임을 제거하고 예측 미래 특징만 사용한다.

# 핵심 그림

![현재 관측에서 latent action을 예측하고 미래 특징 변화량을 거쳐 flow action head로 연결하는 TS-WAM 학습 및 추론 구조](/papers/assets/vla/ts-wam-temporal-latent-actions-and-world-action-coupling/overview.svg)

> 논문 Figure 2와 식 (1)–(10)을 바탕으로 재구성. 출처: [arXiv HTML, Method](https://arxiv.org/html/2610.21922). EMA teacher가 학습 때만 미래 프레임을 보고 추론 때 제거되는 흐름을 구분했다.

구조 그림을 고른 이유는 latent action 학습과 future-feature conditioning이 직렬로 연결되는 것이 TS-WAM의 핵심이기 때문이다. 학습에서는 미래 프레임이 teacher target과 $\Delta F_t$ supervision을 제공한다. 추론에서는 현재 관측·언어만으로 $\hat z_t$와 $\widehat{\Delta F}_t$를 차례로 만들고, action head가 예상되는 세계 변화까지 조건으로 행동을 생성한다. temporal loss는 latent predictor에, world loss는 delta-lwm에, flow loss는 전체 online 경로에 gradient를 보낸다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (단위, ↑/↓)                       | TS-WAM |         비교 기준 |     차이 | 출처                 |
| -------------------------------------------------- | -----: | ----------------: | -------: | -------------------- |
| LIBERO-Plus 7종 OOD 전체 성공률 (%, ↑)             |   75.7 |     VLA-JEPA 62.9 |  +12.8%p | 원문 Table III       |
| 실제 로봇 4태스크 IND 평균 성공률 (%, ↑)           |  72.50 | $\pi_{0.5}$ 55.00 | +17.50%p | 원문 Table IV        |
| 실제 로봇 4태스크, 3 OOD 평균 성공률 (%, ↑)        |  62.92 | $\pi_{0.5}$ 35.00 | +27.92%p | 원문 §IV-C, Table IV |
| LIBERO-Plus 전체, human video 제거 ablation (%, ↑) |   75.7 |              64.8 |  +10.9%p | 원문 Figure 7, §IV-D |

실제 OOD 평균은 조명·배치·배경의 각 조건에서 네 태스크를 20회씩 평가한 동일 설정이다. TS-WAM의 IND→OOD 하락은 9.58%p이고 $\pi_{0.5}$는 20.00%p다. 표준 LIBERO는 97.0%로 $\pi_{0.5}$의 96.9%와 거의 같지만, 분포 변화가 있는 LIBERO-Plus와 실제 OOD에서 격차가 커져 temporal/world supervision의 주효과가 robustness임을 보여준다.

# Limitations / Discussion

- delta-lwm은 한 step의 feature 변화량을 예측하며 장기 rollout simulator는 아니다.
- DINOv3 encoder가 frozen이어서 접촉이나 작은 상태 변화가 사전학습 특징에 충분히 표현되지 않을 수 있다.
- 인간 video의 카메라·행동 분포와 로봇의 embodiment 차이를 latent가 얼마나 일관되게 흡수하는지는 더 분해된 분석이 필요하다.
- 실제 로봇은 두 플랫폼·네 태스크로 제한되고, 논문은 공개 코드나 데이터 처리 pipeline 링크를 제공하지 않는다.
- teacher가 보는 미래와 배포 시 student가 예측해야 하는 미래 사이의 오류가 연속 제어에서 누적될 가능성이 남는다.

# 내가 이해한 핵심

action-free video를 쓰는 것만으로는 충분하지 않고, video에서 배운 시간적 변화가 action head가 실제로 읽는 미래 조건으로 이어져야 제어 일반화에 기여한다.

# 다음에 연결해서 읽을 논문

- VLA-JEPA: TS-WAM의 temporal self-supervision 출발점과 latent action 표현을 비교할 수 있다.
- Forward Dynamics Models: 행동으로 미래를 예측하는 보조 목표가 VLA 성능에 연결되는 다른 설계를 볼 수 있다.
- PLaW-VLA: pixel 대신 predictive latent world modeling을 사용하는 방식과 비교하기 좋다.
