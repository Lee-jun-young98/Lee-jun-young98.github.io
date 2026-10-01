---
title: "Cue the Flow: Steering Flow-Matching Policies for Open-World Delivery Manipulation"
date: 2026-10-01
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "CoRL 2026 (공식 프로그램 확인 필요)"
authors: "Haoxuan Wang, Griffin Galimi, Junhua Huang, Selina Song, Wayne Wu, Yan Yan, Bolei Zhou"
paper: "https://arxiv.org/abs/2609.38989"
code: ""
project: "https://hatchetproject.github.io/delivery_steer/"
thumbnail: "/papers/assets/vla/cue-the-flow-steering-flow-matching-policies/overview.svg"
---

# 한 줄 요약

동결한 flow-matching VLA의 생성 속도장을 공간 cue 기반 대각 affine 변환으로 조향해, 새로운 물체·표현이 등장하는 배송 조작의 목표 지정 실패를 크게 줄인다.

# 논문 정보

- 제목: Cue the Flow: Steering Flow-Matching Policies for Open-World Delivery Manipulation
- 저자: Haoxuan Wang, Griffin Galimi, Junhua Huang, Selina Song, Wayne Wu, Yan Yan, Bolei Zhou
- 발표: arXiv:2609.38989 (2026-09-30), 저자 표기 CoRL 2026; 공식 프로그램 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2609.38989) · [프로젝트](https://hatchetproject.github.io/delivery_steer/)
- 코드/프로젝트: 프로젝트 페이지 공개, 코드 링크는 확인하지 못함
- 키워드: flow matching, policy steering, spatial cue, open-world delivery, mobile manipulation

# 핵심 아이디어

고수준 grounding 모듈(System 2)이 자유형 지시에서 목표 물체의 mask와 Gaussian heatmap을 만들고, 저수준 System 1은 미세조정한 $\pi_{0.5}$를 동결한 채 작은 adapter만 학습한다. Adapter는 각 flow integration step에서 속도 $v$에 차원별 scale $\gamma$와 shift $\beta$를 적용한다. 공간 이동 negative와 zero-heatmap residual을 쓰는 대조학습이 cue 위치를 장면 shortcut보다 우선하도록 만든다.

# VLA 관점에서 중요한 이유

언어 grounding을 더 많이 학습시키는 대신, VLA가 이미 가진 접촉·복구·조작 prior는 보존하고 “어느 물체를 향할지”만 외부 cue로 명시한다. 이는 open-vocabulary planner와 reactive VLA를 결합하는 구체적인 인터페이스이며, adapter가 base policy 대비 약 0.02% 파라미터만 더한다는 점도 실용적이다.

# Robot / Embodied Setting

- 6-DoF arm의 tabletop 조작과 DEEP Robotics LYNX M20 wheeled quadruped 위 동일 arm을 평가한다.
- 두 학습 물체로 80개 demonstration을 수집하고, seen/paraphrase, unseen object/in-domain language, unseen object/novel language 세 설정을 비교한다.
- Qwen3-VL-2B와 SAM2.1이 초기 공간 cue를 만들며, VLA는 단일 RTX 5080에서 15 Hz로 동작한다.
- LIBERO-PRO Object-suite에서도 200 episode의 보조 시뮬레이션 평가를 수행한다.

# Method

1. Grounding model과 segmentation model이 목표 mask를 만들고 중심점 기반 heatmap $h_t$로 변환한다.
2. Cue encoder는 올바른 heatmap과 공간 이동 negative를 대조하고, $E(h_t)-E(0)$ residual로 cue 자체의 효과를 분리한다.
3. Adapter가 각 integration step마다 $\tilde v=v\odot(1+\gamma)+\beta$를 예측해 action chunk의 생성 경로를 조향한다.
4. Flow loss, 공간 대조 loss, residual 대조 loss, modulation 크기 정규화를 함께 최적화하며 base VLA는 고정한다.

# 핵심 그림

![자유형 지시를 공간 cue로 바꾸고 동결 VLA의 flow 속도장을 조향하는 Cue the Flow 파이프라인](/papers/assets/vla/cue-the-flow-steering-flow-matching-policies/overview.svg)

> 그림 1의 핵심 연결을 논문을 바탕으로 재구성했다. 구조 그림을 고른 이유는 이 논문의 기여가 별도 planner의 출력이 VLA 입력 prompt가 아니라 생성 속도장의 affine 조향으로 직접 이어지는 인터페이스에 있기 때문이다. 출처: [논문 Figure 1 및 Sections 3.2–3.3](https://arxiv.org/html/2609.38989#S3).

# Experiments / Results

## 주요 실험 결과

| 로봇 / 태스크 / 지표 (단위, ↑/↓)                                    | 제안 방법 |         비교 기준 |    차이 | 출처             |
| ------------------------------------------------------------------- | --------: | ----------------: | ------: | ---------------- |
| Tabletop, Setting III unseen object + novel language, 성공률 (%, ↑) |      66.7 |       Base-L 29.2 | +37.5%p | 논문 Table 2     |
| Mobile base, Setting III, 성공률 (%, ↑)                             |      41.7 | VP-VLA/Base-L 8.3 | +33.4%p | 논문 Table 2     |
| Tabletop 3-setting 평균, 성공률 (%, ↑)                              |      72.2 |         Base 38.9 | +33.3%p | 논문 Table 2     |
| Mobile base 3-setting 평균, 성공률 (%, ↑)                           |      63.9 |       VP-VLA 44.4 | +19.5%p | 논문 Table 2     |
| LIBERO-PRO Object suite, 200 episodes, 성공률 (%, ↑)                |      15.5 |  Base/VP-VLA 10.5 |  +5.0%p | 논문 Section 4.3 |

가장 강한 분포 이동인 Setting III에서 격차가 가장 커진다. 특히 tabletop에서 기존 VLA는 0.0%, visual-prompt VLA는 4.2%인 반면 제안 방법은 66.7%다. 다만 LIBERO-PRO 절대 성능은 15.5%로 낮아, open-world grounding 문제가 해결됐다고 보기는 이르다.

# Limitations / Discussion

기반 VLA의 affordance와 위치 분포 밖에서는 여전히 취약하고, mobile base의 정지 위치·방향을 제한한다. 평가는 물체 선택과 고정 drop-off에 집중하며 navigation, 사람과의 handover, 밀집 물체 선택은 포함하지 않는다. System 2의 cue를 rollout 시작 시 한 번만 계산하는 장점은 크지만, grounding 자체가 틀렸을 때의 안전한 거부나 재질의 장치는 별도로 보이지 않는다.

# 내가 이해한 핵심

이 논문의 본질은 “큰 VLA를 다시 가르치는 것”보다 “이미 잘하는 행동 prior에 좌표를 건네는 것”이 적은 데이터에서 더 안정적일 수 있다는 주장이다. Input prompting보다 생성 dynamics를 직접 조절한 것이 중요한 차이다.

# 다음에 연결해서 읽을 논문

- VP-VLA: visual prompt를 VLA 입력에 주는 방식과 직접 비교하기 위해
- MOKA: 고수준 grounding과 geometric controller 조합의 한계를 보기 위해
- Correcting WHERE, Preserving HOW: 동일한 target correction 문제를 inference-time guidance로 푸는 관점과 비교하기 위해
