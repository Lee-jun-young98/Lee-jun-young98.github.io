---
title: "Robo-MLT: Dual-System Robotic Manipulation for Long-Horizon Medical Laboratory Tasks"
date: 2026-11-11
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Zequan Zeng, Kai Wang, Delvin Ce Zhang, Huaping Liu, Zhipeng Yuan, Junqin Yang, YunLong Zhang"
paper: "https://arxiv.org/abs/2611.13039"
code: ""
project: ""
thumbnail: "/papers/assets/vla/robomlt-dual-system-medical-laboratory-manipulation/overview.svg"
---

# 한 줄 요약

Robo-MLT는 명시적 skill pointer와 다중 프레임 실행 모니터(System 2)를 flow-matching VLA 실행기(System 1)에 결합해, 시각적으로 비슷하지만 절차상 반대 행동이 필요한 장기 의료 실험실 작업에서 순서를 지키고 실패 시 남은 workflow를 재계획한다.

# 논문 정보

- 제목: Robo-MLT: Dual-System Robotic Manipulation for Long-Horizon Medical Laboratory Tasks
- 저자: Zequan Zeng, Kai Wang, Delvin Ce Zhang, Huaping Liu, Zhipeng Yuan, Junqin Yang, YunLong Zhang
- 발표: 확인 필요 (arXiv v1, 2026-11-09; 2026-11-11 cs.RO 신규 목록)
- 링크: [arXiv](https://arxiv.org/abs/2611.13039) · [HTML](https://arxiv.org/html/2611.13039)
- 코드/프로젝트: 공개 링크 미확인
- 키워드: medical laboratory robotics, long-horizon manipulation, dual-system VLA, execution monitoring, workflow recovery, flow matching

# 핵심 아이디어

긴 의료 절차를 하나의 end-to-end policy에 맡기지 않고 **무엇을 언제 수행할지**와 **각 skill을 어떻게 수행할지**를 분리한다. frozen VLM planner가 protocol과 초기 관측을 atomic-skill 순서로 바꾸고, 저주파 System 2가 현재 skill의 완료·불가능 여부를 다중 프레임으로 판정한다. 고주파 System 1은 현재 skill instruction, 세 카메라 영상, proprioception을 받아 flow matching으로 action chunk를 생성한다. System 2가 `advance`이면 pointer를 다음 skill로 옮기고, `recover`이면 VLM이 남은 workflow를 다시 계획한다.

# VLA 관점에서 중요한 이유

VLA가 현재 영상만 보고 행동하면, tube를 analyzer에 넣기 전과 빼야 할 때처럼 영상이 거의 같은 상태에서 절차 단계를 혼동할 수 있다. Robo-MLT는 이를 더 큰 backbone 대신 **명시적 상태와 시간적 증거**로 해결한다. 또한 trajectory 수준의 미세 보정과 workflow 수준의 불가능성 복구를 구분한다. 이는 long-horizon VLA에서 memory가 단순 관측 history가 아니라 protocol state와 recovery boundary를 함께 표현해야 함을 보여준다.

# Robot / Embodied Setting

Agilex dual-arm Static-Aloha, 고정 global camera 1대와 wrist camera 2대, RTX 4090 배포 환경을 사용한다. Blood Gas Analysis는 grasp, cap 제거·폐기, analyzer docking, 약 5 mm 여유의 probe 삽입, 철회, 폐기까지 7개 atomic skill을 수행한다. Tube Sorting은 여러 sample을 읽고 분류해 지정 rack에 놓는다. nominal 평가는 방법·task별 50개 configuration이며, sample-removal 평가는 task별 20회로 operator가 실행 중 sample을 제거한다.

# Method

1. **계획:** frozen VLM이 protocol과 초기 workspace 관측을 skill library의 순서열 $\mathcal{P}$로 변환한다. 학습된 skill 자체는 그대로 두고 순서와 반복만 바꿀 수 있다.
2. **System 2 monitor:** frozen SigLIP2-300M이 $M$개의 multiview 관측을 임베딩하고 causal temporal encoder가 시간 축을 결합한다. 현재 skill text가 query인 cross-attention이 skill-grounded vector $v_t$를 만든다.
3. **결정과 복구:** completion·recovery binary head가 각각 완료 확률 $\hat\gamma_t$와 불가능 확률 $\hat\beta_t$를 출력한다. threshold와 persistence 조건을 거쳐 `stay`, `advance`, `recover` 중 하나를 선택한다.
4. **System 1 executor:** 현재 skill instruction, 세 RGB view, robot state를 조건으로 flow-matching action head가 chunk를 만든다. 비동기 prefetch와 chunk 앞부분 blending으로 20 Hz control을 유지한다.
5. **학습과 추론의 차이:** 학습에는 skill boundary, completion, recovery label이 필요하다. 추론에서는 planner가 최초 plan을 만들고, monitor는 1.33 Hz로 pointer를 갱신하며, executor는 action을 streaming한다. `recover` 때만 VLM replanning을 다시 호출한다.

# 핵심 그림

![프로토콜과 초기 관측이 skill plan이 되고, 다중 프레임 System 2가 pointer와 재계획을 관리하며, System 1 VLA가 action chunk를 실행하는 Robo-MLT 구조](/papers/assets/vla/robomlt-dual-system-medical-laboratory-manipulation/overview.svg)

> 논문 Figure 1, Figure 2, §III를 바탕으로 재구성. 출처: [arXiv HTML Figure 1 및 Method](https://arxiv.org/html/2611.13039#S3). 캡션: 명시적 workflow state를 유지하는 저주파 monitor와 skill-conditioned flow-matching executor가 비동기로 협력하는 Robo-MLT 파이프라인.
>
> 이 그림을 고른 이유는 단순한 실험 장면보다 **planner → skill pointer → monitor decision → action streaming → recovery**의 폐루프가 논문의 핵심 기여를 더 잘 보여주기 때문이다. 입력 protocol·초기 RGB는 skill plan을 만들고, 실행 중 multiview history와 active skill은 System 2의 `stay/advance/recover` 판단으로 이어진다. System 1은 현재 RGB·proprioception·skill text를 action chunk로 바꾼다. `advance`는 pointer만 이동하지만 `recover`는 현재 chunk를 폐기하고 planner가 남은 plan을 수정한다. 학습 때의 boundary/recovery supervision과 추론 때의 비동기 제어 흐름도 그림에서 분리했다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (%, ↑)                    | Robo-MLT |                 비교 기준 |         차이 | 출처             |
| ------------------------------------------ | -------: | ------------------------: | -----------: | ---------------- |
| Blood Gas Analysis, end-to-end SR (50회)   |       82 |            $\pi_{0.5}$ 52 |        +30%p | Figure 5, §IV-B1 |
| Tube Sorting, end-to-end SR (50회)         |       70 |            $\pi_{0.5}$ 48 |        +22%p | Figure 5, §IV-B1 |
| Blood Gas, sample-removal RSR (20회)       |       90 |   learned trigger 제거 65 |        +25%p | Table IV         |
| Tube Sorting, sample-removal RSR (20회)    |       85 |   learned trigger 제거 55 |        +30%p | Table IV         |
| Blood Gas workflow boundary 전체 정시 판정 |    48/50 | single-frame $M=1$: 18/50 | +30 workflow | Table III        |

SR은 제한 시간 안에 모든 sample을 protocol 순서대로 처리한 trial 비율이다. $\pi_{0.5}$ 비교는 같은 skill-boundary annotation을 쓰지만 매 step 현재 관측에서 subtask를 추론하는 baseline이다. sample-removal RSR은 방해 후 남은 sample을 모두 처리했는지를 재며, replanning을 없애면 두 task 모두 0/20이다. 다중 프레임 효과도 크지만 $M=8$에서는 late transition이 26건으로 늘어, 더 긴 history가 항상 낫지는 않다.

# Limitations / Discussion

검증 범위가 단일 dual-arm platform, 한 workspace, 두 의료 protocol, 한 종류의 외부 방해에 한정된다. 새 atomic skill은 teleoperation data와 monitor 재학습이 필요하며, skill library 밖의 행동을 합성하지는 못한다. Oracle Pointer도 50회 중 10회와 13회 실패하므로 monitor를 완벽하게 만들어도 System 1의 정밀 조작 오류가 남는다. 또한 planner/replanner의 안전성과 protocol 준수는 production laboratory나 임상 환경에서 검증되지 않았다.

# 내가 이해한 핵심

이 논문의 요점은 System 1/System 2라는 이름보다 **실패의 시간 규모를 분리한 것**이다. action chunk 안의 위치 오차는 빠른 policy가 고치고, skill이 끝났거나 더는 가능하지 않은지는 느린 monitor가 판단하며, sample 자체가 사라진 경우에만 workflow를 다시 쓴다. 모든 문제를 매 frame의 VLM reasoning으로 해결하지 않아도 long-horizon 일관성과 복구성을 얻을 수 있다는 설계가 설득력 있다.

# 다음에 연결해서 읽을 논문

- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): 같은 장기 조작 비교에서 사용한 대표 hierarchical VLA
- [Fast-in-Slow](https://arxiv.org/abs/2409.02580): 느린 계획과 빠른 제어를 결합하는 계층적 robot policy
- [PALM](https://arxiv.org/abs/2510.22062): policy 내부에서 progress를 예측하는 대안
- [TCoT](https://arxiv.org/abs/2602.19512): trajectory-level success assessment와 recovery를 결합하는 관련 방법
