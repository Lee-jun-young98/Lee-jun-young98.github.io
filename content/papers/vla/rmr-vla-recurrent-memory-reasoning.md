---
title: "RMR-VLA: Recurrent Memory Reasoning for Vision-Language-Action Models"
date: 2026-11-24
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Yiheng Du, Jingqi Tian, Xu Jiang, Jiexuan Zhang, Shuyu Wang, Zecheng Tang, Jian Zhang"
paper: "https://arxiv.org/abs/2611.30145"
code: ""
project: ""
thumbnail: "/papers/assets/vla/rmr-vla-recurrent-memory-reasoning/architecture.svg"
---

# 한 줄 요약

RMR-VLA는 VLA 내부에 evidence→event→state→grounded subgoal의 재귀 trace를 두어 사라진 시각 단서와 task 진행 상태를 다음 action에 직접 연결하고, rollout reward로 그 memory decision만 GRPO 후학습한다.

# 논문 정보

- 제목: RMR-VLA: Recurrent Memory Reasoning for Vision-Language-Action Models
- 저자: Yiheng Du, Jingqi Tian, Xu Jiang, Jiexuan Zhang, Shuyu Wang, Zecheng Tang, Jian Zhang
- 발표: 확인 필요 (arXiv v1, 2026-11-23)
- 링크: [arXiv](https://arxiv.org/abs/2611.30145) · [HTML](https://arxiv.org/html/2611.30145v1)
- 코드/프로젝트: 공개 확인 필요
- 키워드: recurrent memory, embodied reasoning, grounded subgoal, long-horizon manipulation, GRPO

# 핵심 아이디어

긴 robot task에서 과거 frame을 단순 저장하는 것만으로는 “그때 본 대상이 지금 어느 행동의 목표인가”를 알기 어렵다. RMR은 매 update마다 네 field를 순서대로 생성한다. **evidence**는 현재 frame에서 새로 보인 사실, **event**는 무엇이 변했는지, **state**는 object identity와 task progress의 누적 상태, **subgoal**은 현재 장면 좌표에 grounding된 다음 목표다. 다음 update에는 state와 subgoal만 재귀 입력으로 들어가고, action expert는 이 grounded subgoal을 직접 조건으로 action chunk를 만든다.

# VLA 관점에서 중요한 이유

RMR-VLA는 외부 LLM planner나 별도 memory model 없이 같은 VLA가 기억을 쓰고 행동한다. trace가 text token이므로 exact likelihood를 계산할 수 있어, continuous action flow를 stochastic하게 만들지 않고 memory reasoning만 GRPO로 개선할 수 있다. RoboMME 전체 성공률 66.46%는 recurrence 없는 동일 trace 구조 29.75%보다 +36.71%p 높고, LIBERO-Mem 90.08%는 강한 비교 기준 LTM-π 80.5%보다 +9.58%p 높다. 이는 memory capacity보다 **기억을 현재 subgoal로 번역하는 interface**가 중요하다는 증거다.

# Robot / Embodied Setting

RoboMME의 counting, object permanence, reference, imitation 16개 task에서 task당 50 episode를 평가한다. LIBERO-Mem에서는 motion, sequence, relation, occlusion을 포함한 10개 task에서 task당 40 episode를 사용한다. ButtonUnmaskSwap처럼 cup 아래 단서를 본 뒤 위치가 바뀌는 task, 반복 횟수를 기억해야 하는 bowl-return, 동일 object의 identity를 유지해야 하는 occlusion task가 중심이다. 모든 결과는 simulation이며 실제 robot 실험은 보고하지 않는다.

# Method

1. **Write pass:** 현재 multi-view observation, instruction, 이전 state/subgoal을 VLM에 넣어 evidence $e_t$, event $v_t$, updated state $s_t$, grounded subgoal $g_t$를 순서대로 생성한다. state는 scene이 변했다는 evidence가 있을 때만 수정한다.
2. **Act pass:** 같은 VLM이 현재 입력과 $g_t$를 다시 encode하고, action expert가 그 hidden representation을 조건으로 continuous action chunk를 생성한다. memory text를 별도 planner output으로 쓰지 않고 control conditioning으로 내부 연결한다.
3. **재귀 interface:** 다음 write pass에는 $s_t$와 $g_t$만 넘긴다. evidence/event는 update를 정당화하는 중간 reasoning supervision이고, state/subgoal이 장기 identity와 현재 target을 운반한다.
4. **공동 지도학습:** trace cross-entropy와 action flow-matching loss를 함께 최적화한 뒤 VLM을 고정하고 action expert를 추가 fine-tuning한다. 이 순서가 reasoning과 control을 별도 model로 학습하는 것보다 성능이 높다.
5. **GRPO rollout 후학습:** base VLM과 action expert는 고정하고 VLM LoRA만 업데이트한다. terminal task success에 episode별 subgoal correctness를 더한 reward가 memory token likelihood를 최적화하며, action sampling distribution은 건드리지 않는다.

# 핵심 그림

![현재 관측과 이전 state/subgoal이 write pass에서 네 필드 trace가 되고, grounded subgoal이 act pass의 action expert를 조건화하며 다음 update로 재귀되는 RMR-VLA 구조](/papers/assets/vla/rmr-vla-recurrent-memory-reasoning/architecture.svg)

> 논문 내용을 바탕으로 재구성. 출처: [원문 Figure 2](https://arxiv.org/html/2611.30145v1#S3.F2), §§3.1–3.4 및 Equation 5. 캡션: 한 VLA 안의 write/act 두 pass, state·subgoal 재귀 경로, 지도학습과 GRPO 후학습에서 고정·갱신되는 모듈을 구분했다.
>
> 정성 episode보다 **과거 단서가 current action으로 전달되는 interface와 학습 경로**가 더 일반적인 기여이므로 아키텍처 그림을 골랐다. 추론 때 관측과 이전 memory가 write pass로 들어가 네 field를 만들고, 그중 state와 subgoal만 다음 step으로 순환한다. 같은 VLM의 act pass는 subgoal을 현재 visual feature에 결합해 action expert로 보낸다. 지도학습에서는 trace와 action을 공동 학습한 뒤 action expert를 다듬고, GRPO에서는 action expert를 고정한 채 memory를 쓰는 VLM LoRA만 rollout reward로 갱신한다.

# Experiments / Results

## 주요 실험 결과

| 동일 평가 설정 / 성공률 (%, ↑)          | RMR-VLA + GRPO |                 비교 기준 |     차이 | 출처    |
| --------------------------------------- | -------------: | ------------------------: | -------: | ------- |
| RoboMME 전체, 외부 reasoning model 없음 |          66.46 |  LTM-π (DreamDojo): 58.54 |  +7.92%p | Table 2 |
| RoboMME reference category              |          79.83 | supervised RMR-VLA: 72.83 |  +7.00%p | Table 6 |
| RoboMME 전체, episode reward            |          66.46 | terminal-only GRPO: 61.38 |  +5.08%p | Table 6 |
| RoboMME 전체, recurrent full trace      |          59.71 |    recurrence 없음: 29.75 | +29.96%p | Table 4 |
| LIBERO-Mem 10-task 평균                 |          90.08 |   LTM-π (DreamDojo): 80.5 |  +9.58%p | Table 3 |
| LIBERO-Mem 10-task 평균                 |          90.08 |                π0.5: 65.2 | +24.88%p | Table 3 |

Table 2의 RoboMME 방법들은 task당 50 episode라는 RMR 평가 설정과 published score를 함께 모으므로, 저자 재평가를 뜻하는 별표가 붙은 방법과 원 논문 수치를 구분해야 한다. 외부 reasoning model을 쓰는 GAMMA-9B의 66.0%와 RMR-VLA 66.46%는 model 구성과 평가 출처가 달라 직접 우열로 과장하지 않았다. Table 4 recurrence ablation은 GRPO 없이 모두 같은 supervised schedule로 비교한 값이며, full trace 59.71%와 recurrence 없음 29.75%의 차이는 +29.96%p다. 본문의 “doubling”은 이 비율 관계를 요약한 표현이다.

# Limitations / Discussion

trace label을 만들기 위한 task-specific annotation과 subgoal correctness 판정이 필요하며, state를 text와 image coordinate로 직렬화하는 방식은 복잡한 3D contact state나 deformable object에 충분하지 않을 수 있다. write/act 두 pass는 매 update의 inference 비용을 늘리고, text trace가 잘못된 identity를 확신하면 그 오류가 재귀적으로 누적될 수 있다. 실험은 RoboMME와 LIBERO-Mem simulation에 한정되고 real-robot latency, perception noise, safety는 검증되지 않았다. imitation category의 RoboMME 성공률은 51.00%로 다른 category보다 낮아 세밀한 motion history를 symbolic subgoal만으로 보존하는 데 한계가 보인다.

# 내가 이해한 핵심

RMR의 memory는 과거 frame의 압축본이 아니라 **현재 무엇을 해야 하는지를 계속 다시 쓰는 작업 상태**다. evidence와 event는 state update의 근거를 만들고, grounded subgoal이 memory와 motor control 사이의 좁은 interface가 된다. 그래서 recurrence의 이득은 더 많은 visual token보다 state가 action target으로 번역되는 방식에서 나온다.

# 다음에 연결해서 읽을 논문

- [SmoLSTM](/papers/vla/smolstm-compact-vision-language-action-model-with-recurrent-memory): compact recurrent hidden state로 장기 기억을 유지하는 비교 접근
- [LoCo-WAM](/papers/vla/loco-wam-test-time-long-context): online parameter state를 memory로 사용하는 WAM
- [MemoryVLA](https://arxiv.org/search/?query=MemoryVLA&searchtype=title): RoboMME·LIBERO-Mem의 explicit memory baseline
- [LTM-π](https://arxiv.org/search/?query=LTM-pi+robot&searchtype=all): 두 benchmark에서 강한 장기-memory 비교 기준
