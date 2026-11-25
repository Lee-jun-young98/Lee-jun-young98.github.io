---
title: "FoveaWAM: Role-Aware 4D World-Action Modeling for Dynamic Manipulation"
date: 2026-11-25
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Jiaqi Yin, Baoyue Zhang, Jiyuan Zhang, Wenxuan Liu, Zhaofei Yu, Yue Deng, Tiejun Huang"
paper: "https://arxiv.org/abs/2611.31705"
code: "https://github.com/ArrebolBlack/FoveaWAM"
project: "https://foveawam.github.io/"
thumbnail: "/papers/assets/vla/foveawam-role-aware-4d-dynamic-manipulation/architecture.png"
---

# 한 줄 요약

FoveaWAM은 동적 조작에서 target에는 정밀한 SE(3) 미래를, 주변 context에는 희소 3D flow만 예측해 15.1 ms 지연으로 시시각각 움직이는 장면을 제어한다.

# 논문 정보

- 제목: FoveaWAM: Role-Aware 4D World-Action Modeling for Dynamic Manipulation
- 저자: Jiaqi Yin, Baoyue Zhang, Jiyuan Zhang, Wenxuan Liu, Zhaofei Yu, Yue Deng, Tiejun Huang
- 발표: 확인 필요 (arXiv v1, 2026-11-23)
- 링크: [arXiv](https://arxiv.org/abs/2611.31705) · [HTML](https://arxiv.org/html/2611.31705v1)
- 코드/프로젝트: [GitHub](https://github.com/ArrebolBlack/FoveaWAM) · [OnTimeBench](https://github.com/ArrebolBlack/OnTimeBench) · [프로젝트 페이지](https://foveawam.github.io/)
- 키워드: world-action model, dynamic manipulation, SE(3) prediction, sparse 3D flow, native-latency evaluation

# 핵심 아이디어

동적 조작에서 모든 pixel의 미래를 같은 해상도로 생성할 필요가 없다는 관찰에서 출발한다. contact를 결정하는 target은 8개 미래 시점의 정밀 SE(3) trajectory로, collision·clearance·구동을 좌우하는 context는 patch 수준 sparse 3D flow로, static scene은 현재 RGB-D frame으로 표현한다. 이 role-aware allocation이 세계 예측 비용을 줄이면서 action에 필요한 물리 정보를 남긴다.

# VLA 관점에서 중요한 이유

기존 WAM은 미래 영상 생성 지연 때문에 예측한 시점과 실제 action 실행 시점이 어긋날 수 있다. FoveaWAM은 예측 decoder를 학습 때만 사용하고 추론 때 world stream의 KV를 한 번 계산해 action denoising에서 재사용한다. 또한 world를 멈추지 않는 OnTimeBench를 제안해, 높은 paused-world 성공률이 실제 동적 제어 성능을 과대평가할 수 있음을 정량화한다.

# Robot / Embodied Setting

OnTimeBench는 MuJoCo·robosuite의 Franka Panda를 20 Hz로 제어하며, moving-target grasp/place/pass/capture/impact의 14 task와 1,400 held-out test scene을 포함한다. target 속도는 0.03–1.14 m/s이고 task당 성공한 expert demonstration 800개를 사용한다. DOMINO에서는 24개 single-arm dynamic task(Intercept 8, Track 16)를 평가한다. latency는 RTX 5090의 time-to-action p95다.

# Method

1. **Role-aware input:** 현재 RGB-D frame, target SE(3) history, robot-state history를 base frame에서 정렬한다.
2. **Metric scene tokens:** frozen MAE ViT-B/16의 14×14 RGB patch를 depth로 back-project하고, 3D point embedding과 3D RoPE를 부여한다.
3. **Two-stream transformer:** scene token $S$, summary token $M$, noisy action token $A$가 masked attention을 공유하되 world/action FFN은 분리한다. $A$는 모든 token을 읽고 world token은 action noise를 읽지 않는다.
4. **Role-aware future supervision:** linear decoder가 $S$에서 8-step sparse 3D flow, $M$에서 target SE(3) trajectory를 예측한다. 이 decoder는 학습에만 사용한다.
5. **Fast inference:** world stream을 query당 한 번 계산해 KV cache를 만들고, action stream만 flow-matching denoising 동안 반복한다.

아래 Figure 3은 구조, attention mask, 학습·추론 차이를 한 번에 보여주므로 동적 실험 장면보다 핵심 그림으로 적합하다.

# 핵심 그림

![현재 RGB-D와 target 및 robot history에서 scene·summary token을 만들고, world stream의 3D flow와 SE(3) supervision을 action stream과 결합하는 FoveaWAM 구조](/papers/assets/vla/foveawam-role-aware-4d-dynamic-manipulation/architecture.png)

> Figure 3 원본. 출처: [arXiv HTML Figure 3](https://arxiv.org/html/2611.31705v1#S2.F3), CC BY 4.0. 캡션: scene/summary/action token, masked attention, 분리된 FFN, 학습 전용 future decoder와 추론 시 KV cache를 포함한 FoveaWAM 전체 구조.
>
> 입력 RGB-D·target/robot history는 metric scene token $S$와 summary token $M$이 되고, noisy command는 action token $A$가 된다. 세계 branch는 $S$에서 sparse flow, $M$에서 target SE(3)를 학습하지만 action을 보지 않는다. action branch는 두 world representation을 모두 읽어 chunk를 denoise한다. 추론에서는 두 decoder를 제거하고 world KV를 cache하므로, 미래 representation은 action 생성에 남되 명시적 미래를 매 step 복원하는 비용은 사라진다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (↑, 지연은 ↓)      | FoveaWAM |               비교 기준 |      차이 | 출처    |
| ----------------------------------- | -------: | ----------------------: | --------: | ------- |
| OnTimeBench native 성공률 (%)       |     82.1 |              PUMA: 61.4 |   +20.7%p | Table 1 |
| OnTimeBench +150 ms 성공률 (%)      |     34.1 |              PUMA: 31.1 |    +3.0%p | Table 1 |
| OnTimeBench paused-world 성공률 (%) |     90.3 | $\pi_{0.5}$+SE(3): 76.0 |   +14.3%p | Table 1 |
| RTX 5090 time-to-action p95 (ms)    |     15.1 | OpenWAM-$\alpha$: 151.7 | -136.6 ms | Table 1 |
| DOMINO 24-task 전체 성공률 (%)      |     46.8 |        DynamicWAM: 26.9 |   +19.9%p | Table 2 |
| DOMINO manipulation score           |     62.0 |        DynamicWAM: 41.4 |     +20.6 | Table 2 |

OnTimeBench native는 각 policy가 실제 추론하는 동안 world를 계속 움직이는 동일 protocol이다. `+150 ms`와 paused-world는 서로 다른 timing 조건이므로 native 값과 같은 행에서 섞지 않았다. FoveaWAM의 Track 성공률은 55.5%로 높지만 Intercept는 PUMA 36.3%보다 낮은 29.4%여서 모든 dynamic 유형에서 우세한 것은 아니다.

# Limitations / Discussion

target pose history가 외부 tracker로 주어진다는 가정이 강하고, target/context/static role도 task마다 정의해야 한다. 실험은 simulation 중심이며 실제 perception noise, occlusion, tracker failure에서의 안정성은 확인되지 않았다. 15.1 ms는 RTX 5090 기준이고 hardware가 달라지면 native timing 순위도 달라질 수 있다. target이 여러 개이거나 context 자체의 독립 운동을 정밀하게 예측해야 하는 task에는 sparse role decomposition이 부족할 수 있다.

# 내가 이해한 핵심

동적 조작용 world model의 병목은 미래를 예측하느냐가 아니라 **무엇을 어느 정밀도로, 언제까지 예측하느냐**다. FoveaWAM은 contact target에 계산을 집중하고 나머지는 action에 필요한 만큼만 모델링해, 예측 정확도와 제어 시점 사이의 trade-off를 구조적으로 다룬다.

# 다음에 연결해서 읽을 논문

- [DOMINO](https://arxiv.org/search/?query=DOMINO+dynamic+manipulation&searchtype=title): dynamic manipulation과 optical-flow history 비교의 기반
- [PUMA](https://arxiv.org/search/?query=PUMA+robot+dynamic+manipulation&searchtype=title): sparse flow 기반 강한 baseline
- [OpenWAM](https://arxiv.org/search/?query=OpenWAM&searchtype=title): 명시적 world-action model의 지연 비교
- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): flow-matching action policy 및 SE(3) history ablation 기반
