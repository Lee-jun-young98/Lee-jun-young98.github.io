---
title: "Dual-Stream Memory for Vision-Language-Action Policies"
date: 2026-10-12
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Yang Wang, Ping Liu, Ruiyu Wang, Xuhua Chen, Lingfeng Zhang, Tao Zhang"
paper: "https://arxiv.org/abs/2610.13262"
code: ""
project: ""
thumbnail: "/papers/assets/vla/dual-stream-memory-for-vla-policies/overview.svg"
---

# 한 줄 요약

Dual-Stream Memory는 실행 단계를 압축하는 recurrent token과 task-relevant 과거 frame을 꺼내는 spatial memory를 분리해, RoboMME 평균을 44.51%에서 49.22%, 실제 반복 행동 task 평균을 포함한 4-task 성능을 37.5%에서 62.5%로 높인다.

# 논문 정보

- 제목: Dual-Stream Memory for Vision-Language-Action Policies
- 저자: Yang Wang, Ping Liu, Ruiyu Wang, Xuhua Chen, Lingfeng Zhang, Tao Zhang
- 발표: arXiv:2610.13262v1 (2026-10-09), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.13262) · [HTML 원문](https://arxiv.org/html/2610.13262)
- 코드/프로젝트: 원문에 공개 링크 미기재
- 키워드: embodied memory, Gated DeltaNet, frame retrieval, multi-scale fusion, RoboMME

# 핵심 아이디어

장기 조작 memory에는 서로 다른 두 정보가 필요하다. “지금 몇 번째 단계인가”는 history를 compact state로 누적하는 temporal memory가 잘 다루고, “가려지기 전 물체가 어디 있었는가”는 원본 spatial evidence를 선택적으로 다시 보는 memory가 잘 다룬다. 논문은 6-layer Gated DeltaNet(GDN)이 history를 하나의 512차원 token으로 압축하고, task-conditioned retriever가 threshold 이상의 frame만 유지해 frame당 16개 multi-scale token으로 encoding하도록 두 stream을 분리한다.

# VLA 관점에서 중요한 이유

단순히 더 긴 video context를 VLA에 넣는 대신 memory operation을 execution context와 evidence retrieval로 기능 분해한다. recurrent token은 반복 행동에서 visually aliased stage를 구분하고, retrieval token은 사라진 물체의 세부를 복원한다. 이는 long-horizon VLA memory가 단일 압축 vector나 균일 frame sampling만으로는 충분하지 않다는 실증이다.

# Robot / Embodied Setting

- simulation: RoboMME 4 suites, 16 tasks; retrieval corpus 6,400 episodes와 131 task goals.
- real robot: Piper dual-arm, Pick×3·Swing×2·RePick·Shell 4 tasks.
- 데이터: 실제 task당 100 demonstrations, 모든 방법이 동일한 총 400 demonstrations 사용.
- 평가: simulation은 task당 50 episodes × seeds {0,7,42}; 실제는 task당 30 rollouts와 matched initial states.
- 관측: overhead/front history와 current overhead·wrist cameras, proprioception, instruction.

# Method

1. Temporal stream은 stride 3으로 뽑은 DINOv3 class token을 6-layer GDN에 넣어 한 개의 $c_t\in\mathbb R^{512}$로 압축한다.
2. Progress prediction과 action-conditioned visual-feature reconstruction으로 GDN이 실행 단계와 과거 appearance를 보존하게 pretrain한 뒤 freeze한다.
3. Spatial stream은 SigLIP frame/patch feature와 task text를 사용해 관련도를 계산하고 fixed threshold 이상의 frame만 causal memory에서 선택한다.
4. 선택된 각 frame은 coarse·base·fine feature를 linear projection으로 정렬해 16개 spatial token으로 만든다.
5. Action expert가 temporal·spatial memory를 각각 query하고 gated sum으로 policy hidden state를 조절한다.
6. Stage 2에서는 frozen GDN과 함께 action loss와 retrieval supervision을 공동 최적화한다.

# 핵심 그림

![과거 영상이 GDN temporal token과 task-conditioned retrieved spatial tokens의 두 경로로 나뉘어 VLA action expert를 조절하는 구조](/papers/assets/vla/dual-stream-memory-for-vla-policies/overview.svg)

> 논문 Figure 2를 바탕으로 재구성. 출처: [arXiv HTML, Figure 2](https://arxiv.org/html/2610.13262). Stage 1의 GDN 사전학습, Stage 2의 retrieval/policy 학습, 추론 readout을 한 도식에 정리했다.

구조 그림을 고른 이유는 하나의 history에서 “상태 압축”과 “증거 검색”이 왜 별도 경로여야 하는지 보여주기 위해서다. Temporal stream은 전체 prefix를 하나의 실행-context token으로 줄이고, spatial stream은 instruction에 따라 $m_t$개 frame을 골라 $16m_t$개 token을 보존한다. Action expert는 두 readout을 gated sum으로 합치며, 학습 단계에서는 먼저 GDN을 auxiliary objective로 학습하고 freeze한 뒤 retrieval과 policy를 최적화한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (TSR %, ↑) | 제안 방법 |             비교 기준 |    차이 | 출처           |
| --------------------------- | --------: | --------------------: | ------: | -------------- |
| RoboMME 16-task 평균        |     49.22 | FrameSamp+Modul 44.51 | +4.71%p | 원문 Table II  |
| RoboMME Reference suite     |     45.31 | FrameSamp+Modul 36.33 | +8.98%p | 원문 Table II  |
| 실제 4-task 평균            |      62.5 |  FrameSamp+Modul 37.5 | +25.0%p | 원문 Table III |
| 실제 Pick×3                 |      80.0 |  FrameSamp+Modul 26.7 | +53.3%p | 원문 Table III |
| 실제 Swing×2                |      93.3 |  FrameSamp+Modul 36.7 | +56.6%p | 원문 Table III |
| 실제 Shell                  |      40.0 |  FrameSamp+Modul 53.3 | -13.3%p | 원문 Table III |

실제 비교는 같은 400 demonstrations와 task당 30 rollouts를 사용한다. 가장 큰 이득은 같은 장면이 반복되지만 다음 행동이 달라지는 Pick×3와 Swing×2에서 발생해 execution-stage memory의 의도와 맞는다. 반면 세 번의 cup swap 뒤 identity를 유지해야 하는 Shell은 악화되어, frame retrieval만으로 object identity tracking을 해결하지 못함을 보여준다.

# Limitations / Discussion

- full system의 두 stream을 완전히 matched한 ablation이 없어 개별 기여의 합성 효과가 명확하지 않다.
- FrameSamp+Modul의 공개 checkpoint aggregation은 제안법과 달라 simulation 비교가 완전히 동일한 학습 조건은 아니다.
- 실제 checkpoint는 비슷한 training loss로 선택됐지만 training steps가 같지는 않다.
- retained-frame 수에 따라 storage와 readout 비용이 증가한다.
- Shell 성능 하락처럼 cross-frame object identity propagation이 없다.
- 실제 검증은 Piper 한 플랫폼과 4 tasks에 한정된다.
- 공식 conference venue와 code 공개는 확인되지 않았다.

# 내가 이해한 핵심

좋은 robot memory는 하나의 압축 벡터도, 모든 frame의 긴 context도 아니다. “현재 단계”는 누적 state로, “과거의 증거”는 선택된 원본 detail로 보존해야 한다. 다만 검색한 frame 사이에서 동일 객체를 계속 추적하는 세 번째 기능이 아직 비어 있다.

# 다음에 연결해서 읽을 논문

- Divide-and-Remember: long-horizon history를 action-relevant recursive memory로 압축한다.
- MemoryVLA: perceptual-cognitive memory를 VLA 내부에 통합한 선행 연구다.
- NativeMEM: policy-aligned native compression과 dual-stream 분해를 비교하기 좋다.
