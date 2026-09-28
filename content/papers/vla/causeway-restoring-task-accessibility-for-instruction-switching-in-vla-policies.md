---
title: "Causeway: Restoring Task Accessibility for Instruction Switching in VLA Policies"
date: 2026-09-28
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
  - "Instruction Switching"
  - "Representation Steering"
venue: "확인 필요"
authors: "Qingzi Wang, Kaixi Feng, Guangyao Shi, Xiyang Wu, Ang Li, Dinesh Manocha"
paper: "https://arxiv.org/abs/2609.30913"
code: ""
project: ""
---

# 한 줄 요약

Causeway는 이전 과업이 만든 비표준 상태에서 새 지시를 수행하지 못하는 VLA를, action-stream representation에 test-time gradient write를 적용해 새 과업의 진입 상태로 복귀시킨다.

# 논문 정보

- 제목: Causeway: Restoring Task Accessibility for Instruction Switching in VLA Policies
- 저자: Qingzi Wang, Kaixi Feng, Guangyao Shi, Xiyang Wu, Ang Li, Dinesh Manocha
- 발표: 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2609.30913), [HTML](https://arxiv.org/html/2609.30913)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: VLA, instruction switching, task islands, representation steering, test-time intervention

# 핵심 아이디어

한 과업을 수행한 뒤의 로봇·물체 상태는 새 과업의 학습 분포에서 벗어나 있을 수 있다. 저자들은 이 때문에 단독으로는 잘 수행하는 과업도 지시 전환 후에는 시작조차 못 하는 상태를 task island라고 부른다.

Causeway는 새 과업 demonstration에서 re-entry pose를 정하고, frozen VLA의 decoding graph를 역전파해 action token hidden state에 작은 perturbation을 쓴다. 외부 controller가 action을 생성하는 대신 VLA 자체가 복귀 동작을 decode하며, handoff neighborhood에 도달하면 intervention을 끄고 원래 정책에 제어를 넘긴다.

# VLA 관점에서 중요한 이유

멀티태스크 성능이 높아도 과업별 표준 초기 상태만 평가하면 연속 작업 능력을 과대평가할 수 있다. Causeway는 instruction switching을 상태 접근성 문제로 분리해 평가한다.

재학습이나 새 action head 없이 서로 다른 세 VLA architecture의 내부 action representation을 조종할 수 있다는 점도, deployment-time policy repair의 가능성을 보여준다.

# Robot / Embodied Setting

- 시뮬레이션: LIBERO-Goal 71 cross-object task pairs, LIBERO-Object 추가 평가
- switch 시점: step 30, step 60, 이전 과업 완료 후
- 정책: pi_0.5, OpenVLA-OFT, GR00T N1.5
- 실로봇: xArm, button/bowl/corn instruction switching
- action: 6D pose increment와 gripper command의 chunk

# Method

Target 과업의 phase-compatible demonstration segment에서 handoff pose를 선택한다. 현재 end-effector pose와 목표 pose의 translation·rotation error를 계산하고, 이 error를 줄이는 action이 나오도록 decoding hidden state에 공유 perturbation을 gradient descent로 찾는다.

위치, approach axis, roll, gripper channel을 분해해 안정적으로 steering하고, 목표 neighborhood에 도달하면 write를 중단한다. 이 과정에서 VLA weight는 바뀌지 않는다.

# Experiments / Results

LIBERO-Goal에서 bare switching 평균 성공률은 pi_0.5 26.0%, OpenVLA-OFT 3.4%, GR00T N1.5 9.9%였지만 Causeway는 각각 61.6%, 64.5%, 47.5%로 높였다. Handoff neighborhood 도달률도 모델에 따라 42~72%p 증가했다.

| 로봇 / 벤치마크 / 태스크  | 제안 방법 |  비교 기준 |    차이 | 해석                          |
| ------------------------- | --------: | ---------: | ------: | ----------------------------- |
| pi_0.5 LIBERO-Goal switch |     61.6% | Bare 26.0% | +35.6%p | task island에서 재진입        |
| OpenVLA-OFT switch        |     64.5% |  Bare 3.4% | +61.1%p | architecture가 달라도 큰 회복 |
| GR00T N1.5 switch         |     47.5% |  Bare 9.9% | +37.6%p | flow 계열에서도 적용 가능     |

# Limitations / Discussion

Task-relative coordinate와 target-task demonstration coverage가 필요하다. 큰 scene shift나 in-grasp dynamics처럼 모델링하지 않은 요인에서는 성능이 떨어지고, architecture마다 write layer와 강도를 보정해야 한다.

Backpropagation을 포함한 test-time intervention 비용과 safety constraint도 실제 고속 제어에서 별도 평가가 필요하다. Privileged servo/placement reference보다 낮은 경우가 있어, 정책 내부 steering만으로 모든 복귀를 해결하지는 못한다.

# 내가 이해한 핵심

새 지시를 이해하는 능력과 그 지시를 시작할 수 있는 물리 상태에 도달하는 능력은 다르다. 연속 작업 VLA에는 두 과업 사이를 잇는 상태 복구 계층이 필요하다.

# 다음에 연결해서 읽을 논문

- Self-Adaptive VLA: 이전 rollout context로 hardware shift에 적응
- Robotic Steering: task-specific representation을 선택적으로 fine-tune하는 접근
- H-VLA: 장기 과업을 key action과 motion plan으로 분해
- VLA-Feedback: 실행 중 feedback으로 계획을 실시간 보정
