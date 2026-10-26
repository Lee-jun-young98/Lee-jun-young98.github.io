---
title: "MAST-VLA: Skill-Conditioned Adaptation with Trajectory-Affordance Priors"
date: 2026-10-26
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Multi-Skill Manipulation"
  - "Affordance"
venue: "확인 필요 (arXiv 저자 코멘트: CoRL 2026)"
authors: "Jiachi Yang, Zhiyi Xu, Hongquan Zhang, Xin Tan, Zhizhong Zhang, Jingyu Gong, Yuan Xie"
paper: "https://arxiv.org/abs/2610.32312"
code: ""
project: ""
thumbnail: "/papers/assets/vla/mast-vla-skill-conditioned-adaptation-with-trajectory-affordance-priors/overview.svg"
---

# 한 줄 요약

MAST-VLA는 primitive skill에 따라 LoRA expert를 고르고 demonstration trajectory에서 만든 affordance heatmap으로 action attention을 편향해, 한 정책의 장기 multi-skill 조작을 안정화한다.

# 논문 정보

- 제목: MAST-VLA: Skill-Conditioned Adaptation with Trajectory-Affordance Priors for Multi-Skill Robot Manipulation
- 저자: Jiachi Yang, Zhiyi Xu, Hongquan Zhang, Xin Tan, Zhizhong Zhang, Jingyu Gong, Yuan Xie
- 발표: 확인 필요 (arXiv 저자 코멘트는 “Accepted to CoRL 2026”이나 공식 proceedings/OpenReview 기록은 이번 조사에서 미확인)
- 링크: [arXiv](https://arxiv.org/abs/2610.32312) · [HTML](https://arxiv.org/html/2610.32312)
- 라이선스: CC BY 4.0
- 키워드: multi-skill VLA, LoRA-MoE, skill routing, trajectory affordance, CALVIN

# 핵심 아이디어

긴 조작 sequence는 instruction에서 **무슨 primitive skill을 쓸지**와 image에서 **어디를 접촉하고 어떻게 움직일지**를 동시에 알아야 한다. MAST-VLA는 이를 두 conditioning path로 분리한다.

첫째, rotation·push·pick·place·stack·switch 같은 coarse skill condition이 skill query와 LoRA-MoE router bias를 선택한다. 둘째, demonstration의 future gripper trajectory를 image plane에 투영해 dense heatmap target을 만들고, 예측 heatmap을 visual patch bias로 바꿔 action head가 interaction-relevant region을 더 보게 한다.

# VLA 관점에서 중요한 이유

일반적인 shared adapter는 여러 skill의 action pattern을 한 파라미터 공간에 겹친다. MAST-VLA는 backbone 지식을 보존하면서 skill별 저랭크 expert를 sparse하게 호출해 cross-skill interference를 줄인다. 또한 affordance를 별도 perception output으로만 쓰지 않고 action decoder의 attention prior로 직접 넣는다.

# Robot / Embodied Setting

- simulation: CALVIN ABC→D, scene A–C 학습 후 unseen scene D 평가
- protocol: reset 없이 5개 subtask를 연속 수행; Success@1–5와 평균 완료 길이(Avg. Len)
- real robot: 2개 tabletop scene, 8개 length-3 sequence; nesting, pick-and-place, pushing, stacking, insertion
- direct baseline: VLA-Adapter-Pro
- action output: future $H$-step action chunk

# Method

관측 $o_t$, instruction $l$, coarse skill $s_t$에서 action chunk를 예측한다.

$$
\pi_\theta(o_t,l,s_t)\mapsto \hat a_{t:t+H-1}.
$$

LLM block의 FFN 쪽 LoRA-MoE는 skill query와 routing bias로 Top-$k$ expert를 선택한다. 별도의 heatmap head는 trajectory-affordance map $\hat H$를 예측하고, 이를 patch-level bias로 변환해 action head의 cross-attention에 더한다. 학습은 action $L_1$, weighted BCE heatmap loss, router auxiliary loss를 함께 쓴다.

$$
\mathcal L=\|\hat a-a\|_1+\lambda_{hm}\mathcal L_{hm}+\lambda_{moe}\mathcal L_{moe}.
$$

# 핵심 그림

![시각·언어·로봇 상태와 primitive skill이 LLM의 skill-conditioned LoRA-MoE 및 trajectory-affordance heatmap을 거쳐 action chunk로 이어지는 MAST-VLA 구조](/papers/assets/vla/mast-vla-skill-conditioned-adaptation-with-trajectory-affordance-priors/overview.svg)

> 그림 1. MAST-VLA의 두 conditioning path. 논문 Figure 1과 Sections 3.1–3.3을 바탕으로 재구성했다. 출처: [arXiv:2610.32312, Figure 1](https://arxiv.org/html/2610.32312#S3).

구조 그림을 고른 이유는 성능 향상이 단일 모듈이 아니라 skill-conditioned expert routing과 affordance-guided action decoding의 결합에서 나오기 때문이다. 입력 image·instruction·proprioception은 shared VLA backbone으로 들어가고, instruction-derived primitive condition은 LoRA expert 선택을 바꾼다.

학습 때 future gripper trajectory로 heatmap target을 만들지만, 추론 때는 heatmap head의 예측만 사용한다. 예측 heatmap은 visual patch attention을 접촉·이동 경로 쪽으로 편향하며, action head가 최종 chunk를 출력한다. 기존 shared adapter와 달리 skill 분리와 공간 grounding이 명시적이다.

# Experiments / Results

## 주요 실험 결과

아래 수치는 동일한 CALVIN ABC→D protocol의 Table 1–2에서 직접 대조했다. Success 차이는 %p, Avg. Len 차이는 절대 길이다.

| 로봇 / 태스크 / 지표 (단위, ↑/↓) | 제안 방법 | 비교 기준 | 차이 | 출처 |
| --- | ---: | ---: | ---: | --- |
| CALVIN ABC→D Success@5 (%, ↑) | 84.7 | VLA-Adapter-Pro 80.0 | +4.7%p | Table 1 |
| CALVIN ABC→D Avg. Len (0–5, ↑) | 4.65 | VLA-Adapter-Pro 4.50 | +0.15 | Table 1 |
| CALVIN ABC→D Success@5 (%, ↑) | 84.7 | FLOWER 77.5 | +7.2%p | Table 1 |
| Full model Success@5 (%, ↑) | 84.7 | no query/MoE/heatmap 80.0 | +4.7%p | Table 2 |
| Full model Success@5 (%, ↑) | 84.7 | mismatched skill 80.9 | +3.8%p | Table 2 |

Success@1은 baseline 98.5%와 제안법 99.4%로 이미 포화에 가깝지만 Success@4–5에서 격차가 커진다. 이는 두 conditioning path가 단일 primitive의 즉시 성공보다 skill transition에서 누적되는 오류를 줄인다는 해석과 맞는다.

# Limitations / Discussion

primitive taxonomy가 lexical/fuzzy matching으로 주어지므로 완전한 end-to-end skill discovery는 아니다. instruction이 taxonomy 밖이거나 복합 skill을 동시에 요구할 때 routing condition이 불안정할 수 있다.

real-robot 결과는 두 tabletop scene의 length-3 sequence에 한정된다. 또한 affordance target이 demonstration trajectory 투영에 의존하므로 camera calibration 오류와 occlusion, 여러 가능한 trajectory가 있는 상황을 충분히 표현하는지는 추가 검증이 필요하다.

# 내가 이해한 핵심

이 논문은 multi-task VLA를 하나의 거대한 shared policy로만 보지 않는다. **무슨 동작 계열인가**는 parameter routing에, **어디를 건드릴 것인가**는 attention bias에 맡겨 서로 다른 종류의 간섭을 각기 다른 위치에서 줄인다.

# 다음에 연결해서 읽을 논문

- VLA-Adapter: MAST-VLA가 직접 확장한 parameter-efficient baseline이다.
- CORAL: LoRA expert를 multi-task robot learning에 배치하는 관점을 비교할 수 있다.
- SpatialVLA / FALCON: explicit spatial prior가 action generation에 들어가는 다른 방식을 비교하기 좋다.
