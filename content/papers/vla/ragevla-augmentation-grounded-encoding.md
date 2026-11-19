---
title: "RageVLA: Augmentation-Trained Perception and Action for State-of-the-Art Robustness on LIBERO"
date: 2026-11-19
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Amrit Lal Singh, Smarak Kanjilal"
paper: "https://arxiv.org/abs/2611.23517"
code: ""
project: ""
thumbnail: "/papers/assets/vla/ragevla-augmentation-grounded-encoding/architecture.svg"
---

# 한 줄 요약

RageVLA는 LIBERO의 물체·배경·문장 상관관계를 대규모 재배치 데이터로 끊고, frozen visual features에서 추출한 명시적 object layout과 wrist code를 작은 flow policy에 제공해 위치·task 변화에 강한 VLA를 만든다.

# 논문 정보

- 제목: RageVLA: Augmentation-Trained Perception and Action for State-of-the-Art Robustness on LIBERO
- 저자: Amrit Lal Singh, Smarak Kanjilal
- 발표: 확인 필요 (arXiv v1, 2026-11-17)
- 링크: [arXiv](https://arxiv.org/abs/2611.23517) · [HTML](https://arxiv.org/html/2611.23517v1)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: robust augmentation, grounded encoding, object-centric perception, DINOv3, flow matching, LIBERO-PRO

# 핵심 아이디어

LIBERO의 task당 50 demonstrations는 물체 정체성, 위치, 배경, 지시 문구가 거의 고정돼 있어 큰 VLA도 trajectory replay에 머물 수 있다. RageVLA는 원 demonstration을 object-centric phase로 나눈 뒤 물체·fixture를 임의 위치와 회전으로 옮기고, 다른 환경·surface로 transplant하며, instruction을 paraphrase한다. 정책 쪽에서는 agentview와 wrist image를 수백 개의 VLM token으로 직접 action model에 넣지 않는다. frozen DINOv3 위의 작은 supervised adapter가 3D object list와 gripper 주변의 compact code를 만들고, frozen TinyCLIP이 scene·text embedding을 만든다. 이 grounded context를 작은 flow-matching DiT가 20-step action chunk로 바꾼다.

# VLA 관점에서 중요한 이유

표준 LIBERO 평균이 높아도 object position이나 task가 바뀌면 0에 가까운 기존 VLA가 많다. RageVLA는 scale보다 **학습 데이터의 상관관계 해체와 action input의 명시적 grounding**이 robustness를 좌우할 수 있음을 보여준다. 0.21B s1 모델이 3.3B $\pi_{0.5}$보다 LIBERO-PRO 전체와 Pos+Task에서 크게 앞서며, object position을 의도적으로 섞으면 image가 그대로여도 성공률이 급락한다. 이는 policy가 memorized trajectory가 아니라 제공된 layout을 실제로 사용한다는 mechanism test다.

# Robot / Embodied Setting

LIBERO 130 tasks의 simulator state와 human demonstration을 phase 단위로 변환해 132,610 training trajectories, 2.79M samples를 만든다. held-out layout 1,751 trajectories는 training과 분리된다. 평가는 LIBERO-PRO의 Goal, Spatial, LIBERO-10, Object 네 suite에서 Obj·Pos·Sem·Task·Env 단일 perturbation을 각각 적용하며, cell당 10 tasks×50 initial states, 총 12,000 episodes다. 실제 로봇 실험은 없고 7-DoF end-effector action을 사용하는 LIBERO simulation에 한정된다.

# Method

1. **Phase-level trajectory retargeting:** approach, grasp, transport, place, fixture interaction별 end-effector pose를 대상 object frame에 표현한 뒤 새 object pose로 옮긴다. 재시뮬레이션에서 task success predicate를 통과한 trajectory만 유지한다.
2. **General augmentation:** object와 fixture의 위치·yaw를 무작위화하고, task를 다른 LIBERO environment와 surface에 이식하며, instruction을 paraphrase한다. texture와 color는 바꾸지 않는다.
3. **Agentview object head:** frozen DINOv3 multi-depth feature에서 CenterNet형 adapter가 class heatmap, sub-cell offset, yaw, height를 예측한다. camera ray와 높이 평면의 교점으로 global 3D position을 만든다.
4. **Wrist code:** 같은 frozen DINOv3의 wrist feature를 8 tokens로 압축한다. 학습 때만 쓰는 decoder가 cell class와 depth map을 복원하게 해 grasp 주변 geometry를 code에 보존한다.
5. **Semantic context:** frozen TinyCLIP이 agentview와 instruction을 각각 512차원 vector로 만든다. object list, wrist code, image, text, proprioception을 transformer context encoder가 융합한다.
6. **Flow action engine:** DiT가 noise에서 20×7 action chunk로 가는 velocity를 학습한다. 추론은 Euler 10 steps로 적분하고 앞 10 actions를 실행한 뒤 재계획한다. input group dropout으로 특정 channel 하나에 대한 의존을 줄인다.

# 핵심 그림

![agentview와 wrist image가 frozen DINOv3 및 TinyCLIP을 지나 object list와 wrist code, image와 text embedding이 되고 context encoder와 flow-matching diffusion transformer가 action chunk를 생성하는 RageVLA 구조](/papers/assets/vla/ragevla-augmentation-grounded-encoding/architecture.svg)

> Figure 3 원본. 출처: [arXiv HTML Figure 3](https://arxiv.org/html/2611.23517v1#S4.F3), CC BY 4.0. 캡션: frozen DINOv3·TinyCLIP, 학습되는 perception adapters, context encoder와 flow-matching action model의 parameter와 데이터 흐름. 점선 wrist decoder는 학습 때만 사용된다.
>
> 결과 heatmap보다 robustness의 원인이 되는 explicit perception–action interface를 보여주므로 이 그림을 골랐다. 입력은 agentview·wrist image·instruction·proprioception이며, frozen backbone의 feature를 trainable object head와 wrist adapter가 각각 layout과 국소 grasp code로 바꾼다. context encoder가 이들과 TinyCLIP embedding을 묶고, DiT가 식의 flow velocity를 예측해 action chunk를 denoise한다. 기존 VLM 기반 VLA가 dense image token에서 layout과 action을 한꺼번에 학습하는 것과 달리 RageVLA는 **어디에 무엇이 있는지**를 supervised representation으로 먼저 분리한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (%, ↑)                                    |  RageVLA s1 |             비교 기준 |    차이 | 출처            |
| ---------------------------------------------------------- | ----------: | --------------------: | ------: | --------------- |
| LIBERO-PRO 전체 성공률, 12,000 episodes                    |        72.0 |      $\pi_{0.5}$ 53.0 | +19.0%p | Table III       |
| LIBERO-PRO Pos+Task 평균 성공률                            |        55.0 |      $\pi_{0.5}$ 11.0 | +44.0%p | Table IV        |
| LIBERO-PRO Pos+Task+Env 평균 성공률                        |        65.0 |      $\pi_{0.5}$ 25.0 | +40.0%p | Table IV        |
| LIBERO-Object, x축 28 cm 이동 성공률                       |        86.5 |      $\pi_{0.5}$ 10.5 | +76.0%p | Table VII       |
| LIBERO-Object 원 layout, correct→shuffled object positions | 96.5 → 21.5 | 동일 policy 입력 교란 | -75.0%p | Figure 5 / §V-D |

RageVLA n1은 전체 73.0%로 s1보다 1.0%p 높지만 action engine이 35M에서 100M으로 커진다. 표준 LIBERO에서는 s1과 n1 모두 96.0%로 최고 reported 결과보다 약간 낮다. 저자들은 이것을 거의 매 trajectory의 layout을 바꿔 original path 암기를 억제한 trade-off로 해석한다. 28 cm x-shift 비교는 두 모델을 같은 200-episode harness에서 평가한 수치다. 반면 leaderboard baseline은 논문이 공개 표에서 옮긴 값이며 RageVLA와 동일 training data를 쓰지 않았으므로, 전체 격차는 architecture 하나가 아니라 augmentation과 grounded input의 결합 효과다.

# Limitations / Discussion

평가는 LIBERO simulation만 사용하며 real camera calibration, detector miss, depth noise가 있는 실제 로봇으로 이어지는지는 미확인이다. object head와 wrist decoder의 label은 simulator가 제공하므로 실제 데이터에서는 추가 annotation 또는 geometry pipeline이 필요하다. texture·color augmentation을 하지 않아 LIBERO-10의 object appearance cell이 약점으로 남는다. 130 tasks에 대해 132,610 trajectory를 재시뮬레이션하는 비용도 작지 않다. main result는 한 training seed이며, baseline과 학습 데이터·parameter budget이 달라 순수 architecture 비교로 읽으면 안 된다. 공식 top-conference 게재도 확인되지 않았다.

# 내가 이해한 핵심

RageVLA의 메시지는 더 큰 모델이 언제나 더 잘 보는 것이 아니라, 데이터가 “빨간 컵은 늘 그 자리”라고 가르치면 큰 모델도 그 shortcut을 쓴다는 것이다. 위치와 task를 다양하게 만들고, 그 정보를 object list라는 좁고 검증 가능한 통로로 action model에 주자 작은 policy도 perturbation에 강해졌다. 즉 robustness의 병목을 capacity가 아니라 **상관관계와 interface 설계**에서 찾는다.

# 다음에 연결해서 읽을 논문

- [LIBERO-PRO](https://arxiv.org/search/?query=LIBERO-PRO&searchtype=title): 표준 LIBERO의 위치·task shortcut을 드러내는 robustness benchmark
- [MimicGen](https://arxiv.org/abs/2310.17596): object-centric demonstration retargeting으로 대규모 robot data를 생성하는 기반 방법
- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): RageVLA가 같은 harness에서 object displacement robustness를 비교한 대형 VLA
- [DINOv3](https://arxiv.org/search/?query=DINOv3&searchtype=title): object head와 wrist encoder가 사용하는 dense frozen visual representation
