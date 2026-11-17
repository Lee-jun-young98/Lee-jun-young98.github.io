---
title: "ThinkWAM: Rethinking Latent Futures for Action Refinement"
date: 2026-11-17
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Haoyun Tang, Baqiao Deng, Enjin Zhou, Songwen Tian, Keyao Xu, Bowen Jing, Kun Wang, Ke Ma, Zhandong Mei, Huibin Li"
paper: "https://arxiv.org/abs/2611.21258"
code: ""
project: "https://thinkwam-project.github.io/"
thumbnail: "/papers/assets/vla/thinkwam-proposal-rethink-refine/architecture.png"
---

# 한 줄 요약

ThinkWAM은 첫 ActionDiT가 제안한 action chunk로 multi-horizon future latent를 보정한 뒤 같은 ActionDiT를 다시 실행해 행동을 다듬는 proposal–rethink–refine loop로, 실행 전에 행동과 예상 결과를 양방향으로 맞춘다.

# 논문 정보

- 제목: ThinkWAM: Rethinking Latent Futures for Action Refinement
- 저자: Haoyun Tang, Baqiao Deng, Enjin Zhou, Songwen Tian, Keyao Xu, Bowen Jing, Kun Wang, Ke Ma, Zhandong Mei, Huibin Li
- 발표: 확인 필요 (arXiv v1, 2026-11-16)
- 링크: [arXiv](https://arxiv.org/abs/2611.21258) · [HTML](https://arxiv.org/html/2611.21258v1)
- 코드/프로젝트: [프로젝트 페이지](https://thinkwam-project.github.io/)
- 키워드: world-action model, latent future, action refinement, proposal–rethink–refine, V-JEPA, affordance memory, flow matching

# 핵심 아이디어

일반적인 latent WAM은 현재 관측에서 미래 표현을 예측해 action head에 주지만, 아직 제안하지 않은 행동과 무관한 미래는 잘못된 chunk와 좋은 chunk에 같은 결과를 제시할 수 있다. ThinkWAM은 먼저 완전한 chunk $A_t^{(0)}$를 제안하고, 이 proposal이 각 horizon의 base future latent에 residual correction을 가하도록 한다. corrected future를 같은 ActionDiT의 두 번째 pass에 넣어 실제 실행할 $A_t^{(1)}$을 생성한다. action이 future를 바꾸고 future가 다시 action을 바꾸는 폐루프를 물리 실행 전에 latent space에서 한 번 닫는 셈이다.

# VLA 관점에서 중요한 이유

VLA와 WAM의 결합에서 미래 예측은 종종 학습용 auxiliary loss나 단방향 condition에 머문다. ThinkWAM은 "내가 하려는 행동이라면 어떤 미래가 생기는가"를 proposal-conditioned residual로 명시하고, 그 결과를 같은 action expert가 다시 읽게 한다. 픽셀 video를 생성하거나 여러 candidate를 rollout하지 않고 latent correction만 수행하므로 two-pass 구조여도 A1Z에서 101.2ms/chunk를 보고한다. 이는 world modeling을 별도 시각 생성 기능이 아니라 실행 직전 action review 모듈로 사용하는 방향이다.

# Robot / Embodied Setting

시뮬레이션은 LIBERO, OOD perturbation을 포함한 LIBERO-Plus, 20 fixed tasks의 RoboTwin 2.0 Clean/Random, 50 demonstrations/task의 RoboCasa24를 사용한다. 실제 Galaxea A1Z는 하나의 green object를 box에 넣는 demonstration만 학습하고, 같은 prompt로 두 target, color distractors, purple-light 조건을 각각 30회 평가한다. 성공은 두 target을 모두 box에 넣는 것으로 정의하며 OOD fine-tuning은 없다.

# Method

1. **관측–행동 memory:** frozen V-JEPA가 current observation을 visual token으로 만들고, learned memory slot이 visual token과 최근 executed-action history에 cross-attend한다.
2. **Affordance guidance:** visual prefix에서 contact heatmap을 예측하고 certainty-weighted summary를 memory residual로 더한다. 이 경로는 affordance supervision gradient와 inference-time memory update를 모두 제공한다.
3. **Near-fine, far-coarse future:** horizon별 JEPA head가 현재 context에서 미래 latent를 병렬 예측한다. LIBERO의 $h=7,15,31$에서 token 수를 288, 144, 72로 줄여 가까운 미래는 세밀하게, 먼 미래는 거칠게 표현한다.
4. **Proposal:** language-action feature와 guided memory를 조건으로 첫 ActionDiT pass가 전체 chunk $A_t^{(0)}$를 만든다.
5. **Rethink:** proposal 전체가 horizon별 residual predictor를 조건화해 base future $\hat z_{t+h}$를 corrected future로 바꾼다. 이 단계가 행동별 예상 결과의 차이를 만든다.
6. **Refine:** corrected near/mid/far latent를 두 번째 pass의 context에 추가하고, weight를 공유하는 같은 ActionDiT가 실행 chunk $A_t^{(1)}$를 생성한다. 학습은 demonstration future와 action에 공동 supervision을 주고, 추론은 두 pass와 latent correction을 모두 유지하되 픽셀 decoding은 하지 않는다.

# 핵심 그림

![현재 관측과 실행 행동 memory에서 base future latent를 예측하고 affordance로 memory를 보강한 뒤, 첫 ActionDiT의 action proposal로 future residual을 고쳐 두 번째 ActionDiT pass가 실행 action chunk를 만드는 ThinkWAM 구조](/papers/assets/vla/thinkwam-proposal-rethink-refine/architecture.png)

> Figure 2 원본. 출처: [arXiv HTML Figure 2](https://arxiv.org/html/2611.21258v1#S3.F2), CC BY 4.0. 캡션: affordance-guided memory, multi-horizon temporal JEPA, proposal-conditioned latent correction, shared ActionDiT의 두 pass를 잇는 전체 구조.
>
> 이 그림을 고른 이유는 결과 montage보다 논문의 핵심인 양방향 연결을 직접 보여주기 때문이다. 입력은 observation, language, robot state, 최근 executed actions이며, memory와 temporal JEPA가 near/mid/far base futures를 예측한다. 첫 ActionDiT가 $A_t^{(0)}$를 만들면 residual predictor가 식 (6)–(8)의 base futures를 proposal에 맞게 보정하고, 같은 ActionDiT의 두 번째 pass가 $A_t^{(1)}$을 낸다. 기존 단방향 latent WAM과 달리 future→action뿐 아니라 action→future 경로가 실행 전에 추가된다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 성공률 (%, ↑)                                   | ThinkWAM |              비교 기준 |     차이 | 출처    |
| ----------------------------------------------------------- | -------: | ---------------------: | -------: | ------- |
| LIBERO-Plus 7-category macro 평균, OOD fine-tuning 없음     |    84.76 |      VLANeXt Base 84.5 |  +0.26%p | Table 2 |
| RoboTwin 2.0 Random, 20 fixed tasks                         |    65.85 |              PAVE 45.2 | +20.65%p | Table 3 |
| RoboCasa24, 50 demonstrations/task, action pretraining 없음 |    65.17 | same-data ForeWAM 59.2 |  +5.97%p | Table 4 |
| 실제 A1Z 3 OOD 조건 평균, 각 30 trials                      |     64.4 |       $\pi_{0.5}$ 56.7 |   +7.7%p | Table 5 |
| LIBERO-Plus ablation                                        |    84.76 |      w/o rethink 80.51 |  +4.25%p | Table 6 |

실제 A1Z에서는 two targets 73.3%, color distractors 56.7%, purple light 63.3%로 평균 64.4%를 기록했다. $\pi_{0.5}$는 각각 66.7%, 50.0%, 53.3%여서 같은 조건별 차이는 +6.6, +6.7, +10.0%p다. ThinkWAM latency는 101.2ms/chunk로 $\pi_{0.5}$의 119.9ms보다 낮지만, 구현·모델 크기·action pretraining이 다르므로 이 수치를 순수한 architecture 효율 비교로 해석하면 안 된다.

Ablation에서 full model은 LIBERO-Plus 84.76%, rethink 제거는 80.51%, latent correction만 제거한 two-pass variant는 81.59%, affordance 제거는 82.01%, 둘 다 제거하면 76.41%다. 즉 두 번째 pass 자체보다 proposal이 future representation을 실제로 바꾸는 경로와 affordance guidance가 함께 기여한다.

# Limitations / Discussion

저자도 two-pass inference가 단일-pass policy보다 계산을 늘리고, horizon·token budget·memory 구조를 benchmark마다 설계해야 한다고 인정한다. 미래 target은 frozen V-JEPA latent이므로 접촉력, 미세한 object state, task completion을 항상 보존한다는 보장이 없다. 실제 평가는 pick-and-place 한 task family와 270 trials(3 methods×3 conditions×30)에 한정되고, deformable object, force control, 장기 mobile manipulation은 검증되지 않았다. 비교표에는 action pretraining과 데이터 예산이 다른 baseline이 섞여 있어 RoboTwin/RoboCasa의 모든 숫자를 완전 통제 비교로 볼 수 없다. top conference 게재도 확인되지 않았다.

# 내가 이해한 핵심

ThinkWAM의 본질은 더 정확한 미래를 영상으로 보여주는 데 있지 않다. **첫 행동 초안이 예상 미래를 바꾸고, 바뀐 미래가 같은 정책의 두 번째 결정을 바꾸도록 학습한 것**이 핵심이다. 따라서 world model의 가치는 photorealistic prediction보다 action-sensitive representation에 있다. 다음 단계는 두 pass의 추가 비용을 event-triggered review로 줄이고, latent correction이 실제 실패를 얼마나 사전에 감지·수정했는지 calibration까지 측정하는 것이다.

# 다음에 연결해서 읽을 논문

- [JEPA-WAM](https://arxiv.org/abs/2604.16195): latent future prediction을 VLA에 결합하는 직접 기반선
- [V-JEPA 2](https://arxiv.org/abs/2506.09985): ThinkWAM future target과 visual encoder의 표현 기반
- [FastWAM](https://arxiv.org/abs/2607.01994): pixel generation 없이 효율적인 world-action conditioning을 지향하는 비교군
- [ResWAM](https://arxiv.org/abs/2611.19559): 전체 미래보다 변화 residual만 학습하는 상보적 WAM 설계
