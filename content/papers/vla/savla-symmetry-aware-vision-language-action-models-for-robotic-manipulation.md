---
title: "SAVLA: Symmetry-Aware Vision-Language-Action Models for Robotic Manipulation"
date: 2026-09-16
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Robot Manipulation"
  - "Equivariance"
venue: "확인 필요"
authors: "Junle Li, Weixian Waylon Li, Fuxiang Wu, Fusheng Hao, Fengxiang He"
paper: "https://arxiv.org/abs/2609.16641"
code: ""
project: ""
---

# 한 줄 요약

SAVLA는 frozen vision-language backbone에 equivariant flow-matching action head와 learned canonicalizer를 붙여, 시점·장면 회전에 대한 VLA의 공간 일반화를 크게 높인다.

# 논문 정보

- 제목: SAVLA: Symmetry-Aware Vision-Language-Action Models for Robotic Manipulation
- 저자: Junle Li, Weixian Waylon Li, Fuxiang Wu, Fusheng Hao, Fengxiang He
- 발표: 확인 필요 (arXiv v1, 2026-09-15)
- 링크: [arXiv](https://arxiv.org/abs/2609.16641)
- 코드/프로젝트: 확인 필요
- 키워드: VLA, equivariance, symmetry, canonicalization, flow matching, spatial generalization

# 핵심 아이디어

일반 VLA는 공간 관계를 demonstration에서만 암묵적으로 배운다. 학습 데이터가 덮지 않은 카메라·scene pose에서는 같은 과제도 좌표 변화로 인해 실패할 수 있다. SAVLA는 symmetry를 architecture에 직접 넣어 이 sample inefficiency를 줄인다.

pretrained vision-language backbone은 완전히 동결한다. action head는 state, action, conditioning을 invariant channel과 equivariant channel로 나누고 모든 layer에서 이 type을 보존한다. learned canonicalizer는 oblique-view image를 기준 좌표계로 바꾸며 geometric condition도 동일하게 회전시킨다.

# VLA 관점에서 중요한 이유

VLA의 language·vision representation이 풍부해도 행동 head가 좌표 변환 법칙을 모르면 공간 일반화는 demonstration coverage에 묶인다. SAVLA는 backbone을 다시 학습하지 않고 control head에 geometric inductive bias를 넣어 이 문제를 분리해서 해결한다.

이는 더 많은 viewpoint augmentation만 사용하는 것보다 어떤 변화에 output이 같이 변해야 하는지를 명시한다. 데이터가 적은 robot learning에서 symmetry-aware policy가 특히 유리할 수 있다.

# Robot / Embodied Setting

- 벤치마크: LIBERO 4개 suite
- baseline: GR00T N1.5
- 입력 변화: camera/scene rotation과 oblique view
- backbone: pretrained vision-language model, frozen
- action 생성: equivariant flow-matching head
- 검증 범위: 시뮬레이션 manipulation 중심, 실제 로봇 평가는 확인되지 않음

# Method

action head 내부 표현을 회전에 변하지 않아야 하는 invariant quantity와 회전에 따라 함께 변해야 하는 equivariant quantity로 구분한다. layer를 통과해도 이 변환 규칙을 유지해 action이 장면 좌표 변화에 일관되게 반응하도록 한다.

canonicalizer는 관찰 영상을 표준 시점으로 정렬하고, state와 action condition도 같은 좌표 변환으로 맞춘다. canonicalization과 equivariant head를 결합해 pixel-level viewpoint 변화와 geometric control 변화를 동시에 처리한다.

# Experiments / Results

LIBERO 4개 suite 평균에서 GR00T N1.5보다 성공률이 5.1%p 높았다. 회전 변화를 적용한 LIBERO-Goal에서는 평균 성공률이 baseline 41.5%에서 SAVLA 90.4%로 상승했다.

이 결과는 평균 in-distribution 개선보다 rotation OOD에서 차이가 훨씬 크다는 점이 중요하다. symmetry bias가 일반 capacity 증가가 아니라 목표로 한 geometric shift에 직접 기여했음을 시사한다.

# Limitations / Discussion

평가는 LIBERO 시뮬레이션에 한정되어 있다. 실제 카메라 calibration error, depth ambiguity, non-rigid object, clutter와 occlusion에서도 canonicalizer와 equivariance가 유지되는지는 확인이 필요하다.

어떤 symmetry group과 좌표 표현을 가정했는지에 따라 적용 범위가 제한될 수 있다. 정확한 canonicalization이 어려운 장면에서는 오히려 error가 action head로 전달될 가능성이 있다. 실제 로봇 및 다른 backbone·embodiment에 대한 검증도 필요하다.

# 내가 이해한 핵심

SAVLA는 VLA의 공간 지능을 더 큰 backbone에서 기대하지 않고, 행동이 따라야 할 기하학적 법칙을 action head에 명시한다. “같은 장면을 돌리면 행동도 같은 방식으로 돌아야 한다”는 단순한 원리를 모델 구조 전체에서 보존한 것이 핵심이다.

# 다음에 연결해서 읽을 논문

- GR00T N1.5: SAVLA가 사용하는 baseline과 action formulation
- Equivariant Diffusion Policy: diffusion/flow policy에 symmetry를 넣는 선행 접근
- Transporter Networks: manipulation에서 spatial equivariance를 활용한 대표 연구
- LIBERO: long-horizon language-conditioned manipulation benchmark 구성
