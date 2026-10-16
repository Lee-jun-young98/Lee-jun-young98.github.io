---
title: "REKI: Registering Knowledge in VLAs"
date: 2026-10-16
paper_monitor: true
tags:
  - "paper-review"
  - "VLA"
  - "Robotics"
venue: "확인 필요"
authors: "Juliette Marrie et al."
paper: "https://arxiv.org/abs/2610.22178"
code: "https://github.com/kyutai-labs/reki"
project: ""
thumbnail: "/papers/assets/vla/reki-registering-knowledge-in-vlas/overview.svg"
---

# 한 줄 요약

REKI는 현재 프레임의 VLM 특징을 action expert의 register token에 압축해 KV cache로 이어 붙임으로써, 공개 데이터만 쓴 2.4B VLA에 거의 공짜에 가까운 단기 기억과 안정적인 행동 생성을 더한다.

# 논문 정보

- 제목: REKI: Registering Knowledge in VLAs
- 저자: Juliette Marrie, Paul Pacaud, Adrien Ramanana Rahary, Shizhe Chen, Moritz Böhle
- 발표: arXiv:2610.22178v1 (2026-10-15), venue 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2610.22178) · [HTML 원문](https://arxiv.org/html/2610.22178)
- 코드/프로젝트: [공식 코드·모델·학습 파이프라인](https://github.com/kyutai-labs/reki)
- 키워드: VLA memory, register token, flow matching, public-data pretraining, action expert

# 핵심 아이디어

대부분의 VLA는 매 action chunk를 현재 관측만 보고 새로 결정한다. REKI는 Qwen3.5-2B VLM 뒤의 0.2B flow-matching action expert에 프레임당 32개의 register token을 둔다. register는 현재 VLM 문맥을 cross-attention으로 읽고 과거 register를 self-attention으로 읽지만 action token은 읽지 않는다. 따라서 관측에만 의존하는 register의 key/value를 다음 프레임과 열 번의 Euler denoising step에 재사용할 수 있다.

# VLA 관점에서 중요한 이유

기억을 위해 과거 이미지를 VLM에 다시 넣으면 시각 토큰 비용이 누적되고, recurrent state를 쓰면 학습을 시간순으로 unroll해야 한다. REKI는 기존 action expert의 attention 안에 기억을 배치해 VLM은 프레임당 한 번만 실행하고 학습 window도 한 batch로 처리한다. 특히 같은 장면에서 서로 다른 행동 mode 사이를 왕복하는 VLA의 chunk-level 진동을 줄였다는 점이 장기 조작에서 실용적이다.

# Robot / Embodied Setting

- 사전학습: 공개 robot demonstration, 모션 플래닝 시뮬레이션, 약 35만 egocentric human episode와 vision-language/spatial grounding 데이터.
- 시뮬레이션: LIBERO/LIBERO-Plus, RoboTwin/Clean2Rand, RoboCasa365, RoboCasa-GR1.
- 실제 로봇: 6-DoF UR5 + Weiss WSG50, 고정 RGB 카메라, 15 Hz, 1 m × 1 m tabletop.
- 실제 태스크: pick, place, stack, sweep를 포함한 5개 태스크; 태스크당 학습 50 episode, 평가 10 episode.
- 행동: 7D absolute joint state, 30-step(2초) action chunk.

# Method

1. 언어 지시와 현재 multi-view 관측을 Qwen3.5-2B VLM으로 인코딩해 문맥 $E_t$를 만든다.
2. robot state embedding $g_t$와 flow time이 adaptive normalization을 통해 현재 noisy action chunk를 조절한다.
3. action expert의 32개 register가 $E_t$를 읽고 과거 $K-1$ 프레임 register와 self-attention한다. action token은 현재·과거 register와 자기 자신을 읽는다.
4. 프레임별 register의 key/value를 rolling KV cache에 저장한다. 기본 $K=3$이지만, 저장된 register 자체가 더 오래된 정보를 요약했으므로 정보는 window보다 길게 남을 수 있다.
5. 학습 때 $K$개 프레임을 한 번에 batch 처리하고 모든 프레임의 flow-matching loss를 평균한다. 추론 때 register는 첫 Euler step에서만 계산하고 나머지 9회에 재사용한다.

# 핵심 그림

![현재 관측을 VLM으로 인코딩하고 action expert의 register KV cache를 프레임 사이에 보존해 행동 chunk를 생성하는 REKI 구조](/papers/assets/vla/reki-registering-knowledge-in-vlas/overview.svg)

> 논문 Figure 3을 바탕으로 재구성. 출처: [arXiv HTML, Figure 3](https://arxiv.org/html/2610.22178). register가 action token을 읽지 않는 attention 방향과 학습·추론 시 cache 재사용을 한국어로 단순화했다.

이 구조 그림을 고른 이유는 REKI의 기여가 별도 memory network가 아니라 action expert 내부 register의 attention mask와 cache 수명에 있기 때문이다. 입력 관측·언어는 VLM 문맥이 되고, register는 이 문맥과 과거 register를 읽어 기억을 갱신한다. noisy action은 기억과 현재 문맥을 함께 읽고 flow velocity로 변환된다. 학습에서는 세 프레임 모두 loss를 받지만, 추론에서는 register KV만 rolling cache로 넘겨 VLM 재계산을 피한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (단위, ↑/↓)                  | REKI |            비교 기준 |     차이 | 출처                |
| --------------------------------------------- | ---: | -------------------: | -------: | ------------------- |
| LIBERO-Plus OOD 전체 성공률 (%, ↑)            | 90.4 |  InternVLA-A1.5 84.8 |   +5.6%p | 원문 Table 4        |
| RoboTwin Clean2Rand 평균 성공률 (%, ↑)        | 65.8 |    scratch REKI 52.0 |  +13.8%p | 원문 §6.1, Table 5  |
| RoboCasa365 평균 성공률 (%, ↑)                | 38.4 | Qwen-RobotManip 35.9 |   +2.5%p | 원문 Table 6        |
| H100, 2-view, 10-action chunk latency (ms, ↓) | 21.8 |  InternVLA-A1.5 51.3 | -29.5 ms | 원문 Figure 6, §6.3 |

LIBERO-Plus 비교는 공개 데이터 사전학습 모델끼리의 같은 benchmark 설정이다. Clean2Rand의 13.8%p 차이는 같은 REKI 구조에서 공개 데이터 사전학습 유무만 바꾼 결과다. 실제 UR5에서는 REKI가 $\pi_{0.5}$보다 태스크별 7~37.5%p 높았고, memory 제거 시 긴 horizon 세 태스크에서 12~17.5%p 하락했지만 Figure 8의 태스크별 막대값이 본문에 모두 텍스트로 제공되지 않아 임의 숫자로 표를 채우지 않았다.

# Limitations / Discussion

- 기억 window는 기본 3프레임이며 장시간의 명시적 사건 검색이나 외부 memory bank는 제공하지 않는다.
- RoboTwin in-distribution에서는 85.9/84.6으로 InternVLA-A1.5의 93.3/93.0보다 낮다.
- 실제 로봇 평가는 5개 태스크, 태스크당 10회로 제한되어 다양한 embodiment와 장시간 작업에 대한 통계는 더 필요하다.
- memory register와 공개 데이터 사전학습 외에도 augmentation, state dropout, 데이터 혼합이 성능에 큰 영향을 주므로 단일 요소의 효과로 해석하면 안 된다.
- 공개 데이터만 사용했지만 32 H100에서 20만 step 사전학습해 재현 비용은 여전히 크다.

# 내가 이해한 핵심

VLA 기억의 핵심 비용은 과거를 저장하는 용량보다 과거 이미지를 다시 인코딩하는 데 있다. REKI는 action expert가 이미 가진 self-attention의 KV cache에 관측 요약만 남겨 이 비용을 거의 없앴다.

# 다음에 연결해서 읽을 논문

- SmoLSTM: recurrent state를 통해 장기 기억을 유지하는 방식과 REKI의 register cache를 비교할 수 있다.
- Dual-Stream Memory: 짧은 temporal context와 장기 memory를 분리한 설계와 대조하기 좋다.
- OxyGen: VLA의 KV cache를 멀티태스크 serving 자원으로 확장한 시스템 관점을 이어서 볼 수 있다.
