---
title: "AE-VLA: Arm-wise Compositional Generalization in Dual-Arm Vision-Language-Action Models"
date: 2026-10-06
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Zaibin Zhang, Binghao Ran, Yuhan Wu, Zhongbo Zhang, Yifan Wang, Junwei Jiang, Junlan Xiao, Wangcheng Shi, Li Kang, Yiran Qin, Zhenfei Yin, Lijun Wang, Huchuan Lu"
paper: "https://arxiv.org/abs/2610.06184"
code: ""
project: ""
thumbnail: "/papers/assets/vla/ae-vla-arm-wise-compositional-generalization/overview.svg"
---

# 한 줄 요약

AE-VLA는 양팔 action token 분리, skill별 LoRA, arm-wise attention을 결합해 보지 못한 순서·동기화·cross-task 조합 성공률을 simulation 5.53%→21.53%, 실제 SO101 10.00%→39.00%로 높인다.

# 논문 정보

- 제목: Arm-wise Compositional Generalization in Dual-Arm Vision-Language-Action Models
- 저자: Zaibin Zhang 외 12명
- 발표: arXiv:2610.06184v1 (2026-10-05), Technical Report, venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.06184) · [HTML 원문](https://arxiv.org/html/2610.06184)
- 코드/프로젝트: arXiv 원문에서 공식 공개 저장소를 확인하지 못했다.
- 키워드: dual-arm VLA, compositional generalization, SkillLoRA, arm-wise attention, ACG-Bench

# 핵심 아이디어

ACG-Bench는 익숙한 atomic skill 자체가 아니라 두 팔 사이의 실행 순서와 동기화 관계를 바꾼다. 8개 task family, 23개 task-condition 중 17개가 Reorder, Sync, Sync+Reorder, Cross-task Combination이며, 최종 상태뿐 아니라 milestone 순서와 시간 제약을 만족해야 성공으로 센다.

AE-VLA는 하나의 $\pi_{0.5}$ 안에서 왼팔·오른팔 action token을 분리하고, 각 팔의 현재 atomic skill에 맞는 LoRA를 고른다. AWA는 각 arm action이 자신의 wrist/prompt/action history와 global context를 보되 다른 팔의 local action stream에 직접 의존하지 않게 제한해, 학습 때 본 팔 조합을 그대로 암기하는 경향을 줄인다.

# VLA 관점에서 중요한 이유

양팔 정책의 일반화는 “두 팔을 동시에 출력한다”만으로 측정되지 않는다. 동일한 Pick·Place가 새 순서, 새 파트너, 동시 완료 조건에서 다시 조합돼야 한다. 이 연구는 atomic prompt를 모든 방법에 동일하게 제공해 planning과 execution을 분리하고, parameter routing과 attention topology가 조합적 실행에 어떻게 상호작용하는지 통제된 비교로 보여 준다.

# Robot / Embodied Setting

- ACG-Bench: 8 task family, 23 condition(6 in-domain, 17 generalization), condition·방법당 100 simulation episode.
- 학습: 6 source task family에서 각 100개, 총 600 demonstration; 모든 held-out composition은 학습 데이터 0개.
- backbone: 모든 비교에 같은 pretrained $\pi_{0.5}$ 사용, H=50 action chunk.
- 실제 로봇: 2× 6-DoF SO101, global RGB 1대와 wrist RGB 2대, 30Hz.
- 실제 데이터: Stack Bowls/Cubes, Push Cubes task당 50개, 총 150 teleoperation demonstration. 8 condition×20회×4방법=640회.

# Method

1. 입력 prefix를 global image, 두 wrist image, 두 arm prompt/state로 구성한다.
2. joint action token 하나가 양팔을 함께 내는 대신 $H$개의 left token과 $H$개의 right token group을 둔다.
3. 각 팔 router가 10개 atomic skill 중 하나를 예측하고, 공유 SkillLoRA bank에서 해당 rank-4 adapter를 action expert 18개 block과 projection에 적용한다.
4. AWA mask는 global token을 공유하되 각 arm의 local prefix와 causal action history를 분리한다.
5. flow-matching action loss에 router cross-entropy의 0.1배를 더해 backbone·action expert·adapter·router를 함께 미세조정한다.

# 핵심 그림

![AE-VLA의 양팔 token grouping, SkillLoRA routing, arm-wise attention 구조](/papers/assets/vla/ae-vla-arm-wise-compositional-generalization/overview.svg)

> 논문 내용을 바탕으로 Figure 2를 재구성. 출처: [arXiv HTML, Figure 2](https://arxiv.org/html/2610.06184). 공통 global context 아래 왼팔·오른팔 action token group이 각자의 skill adapter와 local attention 경로를 거쳐 joint action chunk를 만드는 구조다.

구조 그림을 고른 이유는 AE-VLA의 성능이 단일 모듈이 아니라 Token Group, SkillLoRA, AWA의 결합에서 나오기 때문이다. 학습 시 router는 atomic skill label의 cross-entropy로 supervision을 받고 flow matching은 두 팔의 action velocity를 학습한다. 추론 시 rule-based scheduler가 per-arm atomic prompt를 주며, router 선택과 AWA mask로 두 local stream을 분리하되 global image를 통해 협업에 필요한 공유 상태는 유지한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / CCSR 성공률 (%, ↑)                 | AE-VLA |         최강 비교 기준 |     차이 | 출처                     |
| ---------------------------------------------- | -----: | ---------------------: | -------: | ------------------------ |
| Simulation 17개 unseen composition 평균        |  21.53 |  Dual $\pi_{0.5}$ 5.53 | +16.00%p | 원문 Table 2 및 Abstract |
| Simulation Stack Bowls / Reorder               |  79.00 |  Dual $\pi_{0.5}$ 4.00 | +75.00%p | 원문 Table 1             |
| Simulation Cube in Bowl / Cross-task Reference |  54.00 |            MA-VLA 3.00 | +51.00%p | 원문 Table 1             |
| 실제 SO101 5개 unseen condition 평균           |  39.00 | Dual $\pi_{0.5}$ 10.00 | +29.00%p | 원문 Table 3             |

실제 환경에서 AE-VLA는 Stack Bowls/Sync를 12/20 성공한 반면 모든 baseline은 0/20이었다. 다만 in-domain 실제 평균은 60%로 Dual $\pi_{0.5}$의 70%보다 10%p 낮다. simulation에서도 AWA를 추가하면 in-domain이 Token Group 45.00%에서 25.00%로 감소해 generalization–retention trade-off가 분명하다.

# Limitations / Discussion

- atomic prompt는 rule-based scheduler가 제공하므로 high-level 계획 생성 능력은 평가하지 않는다.
- SkillLoRA는 adapter weight와 router supervision을 동시에 추가하고, AWA는 cross-arm·temporal attention을 함께 바꿔 각 요소의 순수 효과가 완전히 분리되지 않는다.
- 일부 조건에서는 baseline이 더 낫다. 실제 Push Cubes/Sync는 Dual 6/20, AE-VLA 2/20이다.
- generalization 향상과 함께 in-domain 성능이 떨어지며, 더 다양한 embodiment·자유로운 장기 과업에서의 확장은 미확인이다.

# 내가 이해한 핵심

양팔 조합 일반화에는 “무엇을 공유할지”와 “무엇을 분리할지”가 동시에 중요하다. skill adapter는 Pick·Place 같은 재사용 가능한 parameter를 공유하고, arm-wise attention은 특정 팔 조합의 action correlation을 끊으며, global token은 협업에 필요한 장면 문맥을 남긴다. 세 요소 중 하나만 넣을 때보다 함께 넣을 때 상승폭이 큰 이유다.

# 다음에 연결해서 읽을 논문

- MA-VLA: 동일한 compositional generalization 문제의 직접 비교군.
- $\pi_{0.5}$: AE-VLA가 token grouping과 adapter routing을 얹는 공통 backbone.
- RoboTwin 2.0 / RoboDojo: 더 넓은 bimanual sim-real 평가와의 연결점을 볼 수 있다.
