---
title: "RoboACE: Adversarial Co-Evolution for Robot Self-Improvement"
date: 2026-11-12
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Delin Zhao, Zhengrong Yue, Junlin He, Yali Wang"
paper: "https://arxiv.org/abs/2611.13034"
code: "https://github.com/DeLin1001/RoboACE"
project: ""
thumbnail: "/papers/assets/vla/roboace-adversarial-coevolution-robot-self-improvement/overview.svg"
---

# 한 줄 요약

RoboACE는 frozen foundation model과 VLA의 가중치를 바꾸지 않고, 약점을 찾는 curriculum harness와 그 약점에 대응하는 execution harness를 번갈아 수정해 연습 과제와 실행 소프트웨어를 함께 진화시키는 robot self-improvement 프레임워크다.

# 논문 정보

- 제목: RoboACE: Adversarial Co-Evolution for Robot Self-Improvement
- 저자: Delin Zhao, Zhengrong Yue, Junlin He, Yali Wang
- 발표: 확인 필요 (arXiv v1, 2026-11-09; 2026-11-11 cs.RO 신규 목록)
- 링크: [arXiv](https://arxiv.org/abs/2611.13034) · [HTML](https://arxiv.org/html/2611.13034)
- 코드/프로젝트: [공식 GitHub 저장소](https://github.com/DeLin1001/RoboACE)
- 키워드: robot self-improvement, adversarial co-evolution, curriculum harness, execution harness, frozen VLA, LIBERO

# 핵심 아이디어

고정된 연습 과제에서 execution만 개선하면 이미 드러난 실패에는 강해져도 다음 약점을 찾는 방식은 그대로 남는다. RoboACE는 이를 두 개의 지속적으로 수정 가능한 harness로 분리한다. curriculum harness는 이전 실행의 Capability Profile을 읽고 현재 execution이 어려워할 유효한 조건을 만든다. execution harness는 고정된 task snapshot에서 planning, code skill, $\pi_{0.5}$ 호출과 handoff를 수정한다. 두 단계는 동시에 움직이지 않고 번갈아 진행해, 어떤 challenge에 어떤 revision이 효과가 있었는지 비교 가능하게 유지한다.

# VLA 관점에서 중요한 이유

이 논문은 VLA 성능 향상을 곧바로 weight update와 동일시하지 않는다. 같은 official $\pi_{0.5}$ controller를 쓰면서도 언제 whole-task VLA를 계속 호출할지, 언제 code skill로 전환할지, subgoal을 어떻게 ground할지, 실패를 어떤 reusable memory로 남길지를 바꾸면 LIBERO-PRO와 LIBERO-X에서 큰 차이가 난다. 즉 VLA의 action prior 위에 놓인 **도구 계약, memory, curriculum, 검증 절차**도 학습 가능한 policy stack의 일부라는 관점을 분명히 한다.

# Robot / Embodied Setting

개발과 평가는 모두 LIBERO simulation ecosystem에서 수행한다. GPT-6.1 Terra, SAM 3, frozen $\pi_{0.5}$를 사용하고, campaign은 30개 practice condition, 최대 40개 internal benchmark condition, 27개 저장 round를 유지했다. 개발 중 76개의 서로 다른 native LIBERO condition과 admission을 통과한 constructed world를 사용했다. 최종 평가는 LIBERO, LIBERO-Plus, LIBERO-PRO, LIBERO-X의 고정된 200-condition panel 각각에서 수행하며, episode당 20 Hz·8,000 control step(시뮬레이션 시간 6분 40초) 예산을 적용한다.

# Method

1. **Phase 1 — curriculum 진화:** round $k$의 Capability Profile $P_k$에서 해결된 능력, 미해결 gap, 불확실성을 읽고 practice condition을 유지·교체·추가한다. native task는 원 정의를 보존하고, constructed world는 물리적 유효성·도달 가능성·instruction/goal/scene 일치 검사를 통과해야 한다.
2. **고정 snapshot:** admission을 통과한 practice와 internal benchmark를 $\mathcal{T}_k$로 고정한다. 이 시점부터 execution phase가 끝날 때까지 task definition, initialization, model setting, budget을 바꾸지 않는다.
3. **Phase 2 — execution 진화:** independent agent가 planning, code skill, VLA control을 선택해 $\mathcal{T}_k$를 실행한다. external optimizer는 outcome, trajectory, public observation, tool feedback을 보고 prompt, skill description, tool interface, memory의 Candidate revision을 만든 뒤 동일 snapshot에서 Stable과 비교한다.
4. **evidence consolidation:** Experience Consolidator가 허용된 task-level 결과와 lesson을 $P_{k+1}$로 요약한다. raw image·trajectory·model/tool call은 curriculum에 넘기지 않아 역할 간 정보 누출을 제한한다.
5. **장기 방향 점검:** Strategic Advisor는 여러 round의 반복 실패를 드물게 검토하고 탐색 방향만 제안한다. 실제 revision 설치 여부는 각 local optimizer가 다시 시험해 결정한다.
6. **학습과 배포의 차이:** campaign 중에는 두 harness의 prompt·skill·tool·interface·memory만 버전업하며 LLM/VLA weight는 학습하지 않는다. 최종 평가는 진화 loop 밖에서 frozen final deployment로 수행한다.

# 핵심 그림

![Capability Profile에서 curriculum harness가 고정 task snapshot을 만들고 execution harness가 frozen VLA와 code skill을 시험한 뒤 다음 profile로 증거를 되돌리는 RoboACE 교대 진화 구조](/papers/assets/vla/roboace-adversarial-coevolution-robot-self-improvement/overview.svg)

> 논문 Figure 2와 §3.1–3.5를 바탕으로 재구성. 출처: [arXiv HTML Figure 2 및 Method](https://arxiv.org/html/2611.13034#S3). 캡션: current capability의 약점을 찾는 curriculum revision과 그 약점에 대응하는 execution revision을 고정 snapshot 사이에서 번갈아 수행하는 RoboACE 파이프라인.
>
> 이 그림을 고른 이유는 결과 bar chart보다 **$P_k \rightarrow$ curriculum revision $\rightarrow \mathcal{T}_k \rightarrow$ execution revision $\rightarrow P_{k+1}$**이라는 교대 구조가 논문의 차별점을 직접 보여주기 때문이다. 입력은 이전 round의 Capability Profile과 task/asset pool이다. curriculum agent와 optimizer가 유효한 challenge를 고르고 admission check가 비교 snapshot을 고정한다. execution agent는 frozen $\pi_{0.5}$, code skill, planning tool을 조합하며, optimizer는 같은 조건에서 Stable과 Candidate를 비교한다. 마지막 consolidator가 결과를 다음 profile로 바꾸고, Strategic Advisor는 여러 round에 걸친 막힘만 별도로 점검한다. model weight는 이 흐름 어디에서도 갱신되지 않는다.

# Experiments / Results

## 주요 실험 결과

| 평가 panel / 성공률 (%, ↑, 각 200 conditions) | RoboACE after |        비교 기준 |    차이 | 출처    |
| --------------------------------------------- | ------------: | ---------------: | ------: | ------- |
| LIBERO                                        |          99.0 |      before 63.5 | +35.5%p | Table 2 |
| LIBERO-Plus                                   |          94.5 |      before 64.5 | +30.0%p | Table 2 |
| LIBERO-PRO                                    |          74.0 | $\pi_{0.5}$ 60.5 | +13.5%p | Table 2 |
| LIBERO-X                                      |          30.5 | $\pi_{0.5}$ 11.5 | +19.0%p | Table 2 |
| LIBERO-PRO                                    |          74.0 |        VoLo 60.5 | +13.5%p | Table 2 |
| LIBERO-X                                      |          30.5 |       RPent 12.5 | +18.0%p | Table 2 |

모든 RoboACE·agent baseline 평가는 같은 200-condition panel과 episode budget을 사용하며 timeout과 infrastructure error도 실패로 센다. $\pi_{0.5}$ 비교는 최종 RoboACE가 사용하는 official controller를 상위 agent 없이 연속 실행한 값이라, LIBERO-PRO의 +13.5%p와 LIBERO-X의 +19.0%p는 controller weight보다 orchestration stack의 효과를 보여준다. 다만 OpenVLA-OFT·$\pi_0$-FAST·Cosmos Policy·GR00T N1.7 일부 수치는 저자 보고 또는 공개 benchmark 결과를 포함하므로, 위 표는 동일 실행으로 직접 평가한 before/$\pi_{0.5}$/agent baseline 비교를 중심으로 적었다.

# Limitations / Discussion

실험은 한 번의 development trajectory와 LIBERO simulation에 한정되며 physical robot 검증이 없다. 논문도 independent campaign, 더 넓은 환경, 실제 로봇 검증을 다음 단계로 명시한다. 최종 성능은 GPT-6.1 Terra, SAM 3, $\pi_{0.5}$와 작성된 tool/skill 생태계 전체에 의존해 비용과 재현성 분석이 더 필요하다. curriculum이 fresh VLA rollout 없이 challenge를 admission하므로 실제 난이도를 사전에 보장하지 않으며, Strategic Advisor와 optimizer의 판단 오류가 누적될 수 있다. 또한 LIBERO-X 30.5%는 개선 폭은 크지만 절대 성공률은 여전히 낮다.

# 내가 이해한 핵심

RoboACE의 핵심은 self-improvement를 “모델이 스스로 weight를 학습한다”가 아니라 **실패를 찾는 시험과 실패를 고치는 실행 계약을 함께 버전 관리한다**로 재정의한 것이다. 고정 snapshot과 Stable/Candidate 비교가 없으면 curriculum이 쉬워진 것인지 execution이 나아진 것인지 분리하기 어렵다. 반대로 이 교대 프로토콜을 넣으면 frozen VLA의 능력을 더 잘 끌어내면서도 revision의 원인을 감사할 수 있다.

# 다음에 연결해서 읽을 논문

- [RoboRSI](https://arxiv.org/abs/2610.12424): RoboACE execution infrastructure의 기반이 된 reusable robot self-evolution
- [EmbodiedRSI](https://arxiv.org/abs/2610.10498): hypothesis-guided experiment selection을 통한 active continual robot learning
- [Reconstruct, Practice, Go Real](https://arxiv.org/abs/2610.02204): offline data로 practice를 만든 뒤 execution을 개선하는 고정 curriculum 접근
- [$\pi_{0.5}$](https://proceedings.mlr.press/v305/black25a.html): RoboACE가 frozen controller로 사용한 open-world VLA
