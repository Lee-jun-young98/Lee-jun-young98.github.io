---
title: "VideoScout: Learning Agentic Active Exploration with Adaptive Reasoning Pacing for Long Video Understanding"
date: 2026-09-16
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Weixin Xu, Zhenyu Yang, Bing Wang, Shengsheng Qian, Changsheng Xu"
paper: "https://arxiv.org/abs/2609.15606"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/videoscout-learning-agentic-active-exploration-with-adaptive-reasoning-pacing-for-long-video-understanding/videoscout-sea-pipeline.svg"
---

# 한 줄 요약

긴 비디오를 한 번에 희소 샘플링하는 대신, VLM 에이전트가 구간별로 재생 속도를 바꾸고 메모를 갱신하며 필요할 때 다시 보는 방식으로 제한된 시각 문맥 안에서 결정적 증거를 능동적으로 수집한다.

# 논문 정보

- 제목: VideoScout: Learning Agentic Active Exploration with Adaptive Reasoning Pacing for Long Video Understanding
- 저자: Weixin Xu, Zhenyu Yang, Bing Wang, Shengsheng Qian, Changsheng Xu
- 발표: 확인 필요 (arXiv v1, 2026-09-14)
- 링크: [arXiv:2609.15606](https://arxiv.org/abs/2609.15606)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: long video understanding, multimodal agent, adaptive sampling, trajectory-level reinforcement learning, video question answering

# 핵심 아이디어

저자들은 긴 비디오 질의응답을 고정된 프레임 집합의 인코딩 문제가 아니라 순차적 증거 획득(Sequential Evidence Acquisition, SEA) 문제로 정의한다. 에이전트는 매 턴 현재 클립과 압축된 텍스트 메모리만 보고 `speed`, `rewatch`, `answer` 중 하나를 선택한다. 중요하지 않은 구간은 빠르게 훑고, 단서가 있는 구간은 천천히 보거나 다시 확인하며, 증거가 충분할 때 답을 확정한다.

# VLM 관점에서 중요한 이유

긴 비디오 VLM의 병목은 문맥 길이뿐 아니라 어떤 장면에 시각 토큰과 추론 시간을 쓸지 결정하는 정책이다. VideoScout는 프레임 선택을 전처리 단계에 고정하지 않고 관찰 결과에 따라 계속 수정한다. 따라서 VLM을 수동적인 비디오 인코더에서 관찰 예산을 스스로 배분하는 멀티모달 에이전트로 확장한다는 점이 중요하다.

# Method

- 비디오 길이에 따라 10~45초의 연속 chunk로 나누고, Qwen2.5-VL-7B-Instruct 기반 에이전트가 턴 단위로 탐색한다.
- 행동은 `speed(1x/2x/4x)`, 최근 fast-forward 구간의 `rewatch(k)`, 최종 `answer`로 구성된다. 속도가 높을수록 같은 토큰 예산으로 더 많은 chunk를 낮은 밀도로 본다.
- 메모리는 고정된 단어 예산 안에서 매 턴 전체를 다시 쓰는 방식으로 유지되어, 질의 관련 증거만 다음 턴으로 전달한다.
- Gemini 3 Flash가 생성한 탐색 궤적을 정답 일치와 추론 일관성으로 필터링해 10K 궤적·66K 이상 턴의 VideoScout-66K를 구성한다.
- 먼저 턴 단위 SFT로 출력 형식과 행동 정책을 학습하고, 이후 약 4K 프롬프트에서 trajectory-level DAPO를 수행한다. 보상은 정답 정확도, 형식 유효성, 교사와의 답변 시점 IoU를 결합한다.

# 핵심 그림

![긴 비디오와 질의를 입력받아 현재 클립과 이전 메모리를 바탕으로 추론한 뒤 속도 조절, 재시청, 답변 중 하나를 반복 선택하는 VideoScout의 SEA 파이프라인](/papers/assets/vlm/videoscout-learning-agentic-active-exploration-with-adaptive-reasoning-pacing-for-long-video-understanding/videoscout-sea-pipeline.svg)

> 그림 1. 논문 Figure 2와 Section III-A, 식 (1)–(2)를 바탕으로 재구성한 VideoScout의 Sequential Evidence Acquisition 파이프라인. 출처: [arXiv:2609.15606, Figure 2](https://arxiv.org/html/2609.15606#S2.F2). 원 논문의 라이선스는 CC BY-NC-SA 4.0이며, 이 그림은 한국어 설명을 위해 직접 재구성했다.

구조 그림을 고른 이유는 VideoScout의 핵심 차별점이 단일 영상 인코더가 아니라 **관찰 → 메모리 갱신 → 행동 선택 → 다음 관찰**의 폐루프에 있기 때문이다. 입력 비디오는 길이에 따라 연속 chunk로 분할되고, 턴 $t$에서 정책 $\pi_\theta$는 현재 시각 클립 $v_t$, 이전 텍스트 메모리 $m_{t-1}$, 질의 $q$를 받아 추론 흔적 $r_t$, 새 메모리 $m_t$, 행동 $a_t$를 함께 출력한다.

`speed(1×/2×/4×)`는 같은 시각 토큰 예산 안에서 시간 범위와 세부 해상도를 교환하고, `rewatch(k)`는 방금 빠르게 본 창 안의 chunk 하나를 다음 턴에 1×로 다시 관찰하게 한다. `answer(ŷ)`만 rollout을 끝낸다. 학습에서는 먼저 VideoScout-66K의 검증된 턴으로 행동 형식을 SFT하고, 이어 전체 궤적에 대해 정답·형식·교사 답변 시점 IoU 보상을 결합한 DAPO를 적용한다. 즉 학습은 이 폐루프 정책을 만들고, 추론은 고정된 전진 포인터와 제한된 지역 재시청으로 그 정책을 실행한다.

# Experiments / Results

## 주요 실험 결과

논문 Table VI의 동일한 Qwen2.5-VL-7B 기반, 동일 네 벤치마크 설정을 대조했다. 값은 각 벤치마크의 전체 정확도(%, 높을수록 좋음)이며 차이는 완전한 `SFT+RL(DAPO)`에서 `SFT only`를 뺀 절대 변화다.

| 벤치마크 / 지표 (정확도 %, ↑) | SFT+RL (DAPO) | SFT only |   차이 |
| ----------------------------- | ------------: | -------: | -----: |
| LVBench Overall               |          45.1 |     43.4 | +1.7%p |
| VideoMMMU Overall             |          54.6 |     49.4 | +5.2%p |
| MLVU-test Overall             |          51.0 |     47.0 | +4.0%p |
| MINERVA Overall               |          35.4 |     32.5 | +2.9%p |

출처: [원 논문 Table VI](https://arxiv.org/html/2609.15606#S4.T6). 네 조건 모두에서 DAPO까지 포함한 2단계 학습이 SFT 단독보다 높으며, 특히 VideoMMMU에서 +5.2%p로 가장 큰 향상을 보인다. 반대로 RL만 적용한 조건은 각각 18.5, 37.7, 23.7, 8.5로 크게 무너져, 장기 궤적 최적화 전에 출력 형식과 턴별 행동을 익히는 cold start가 필수임을 보여준다.

핵심 모듈의 필요성도 같은 기반 모델과 평가 설정의 Table VIII에서 확인된다.

| 제거 조건 / 지표 (정확도 %, ↑) | 완전한 VideoScout | 제거 변형 |   차이 |
| ------------------------------ | ----------------: | --------: | -----: |
| Notes 제거 — MLVU-test         |              51.0 |      42.0 | -9.0%p |
| Rewatch 제거 — LVBench         |              45.1 |      42.5 | -2.6%p |

출처: [원 논문 Table VIII](https://arxiv.org/html/2609.15606#S4.T8). 조건이 서로 다른 벤치마크 값은 같은 행에서 직접 비교하지 않았다. Notes 제거의 -9.0%p 하락은 멀리 떨어진 단서를 턴 사이에 누적하는 텍스트 상태가 가장 큰 기여를 하고, rewatch의 -2.6%p 하락은 빠른 탐색에서 놓친 세부 정보를 국소적으로 복구하는 기능이 보완적으로 작동함을 뜻한다.

- 9개 장문·교차 도메인 비디오 벤치마크에서 평가했다. 장문 이해 4개 벤치마크 평균은 48.0으로, 기본 Qwen2.5-VL-7B의 41.8보다 6.2점 높았다.
- LVBench 45.1, MINERVA 35.4, MLVU-test 51.0을 기록했다. 같은 에이전트 프레임워크에 학습만 하지 않은 변형의 평균 33.1보다 14.9점 높아, 인터페이스보다 탐색 정책 학습이 핵심임을 보였다.
- 교차 도메인 벤치마크 평균은 45.0으로 비교한 오픈소스 방법 중 가장 높았고, 기본 모델 대비 7.2점 향상됐다.
- SFT만 사용할 때보다 DAPO를 추가하면 LVBench 43.4→45.1, VideoMMMU 49.4→54.6, MLVU 47.0→51.0, MINERVA 32.5→35.4로 개선됐다. RL만 적용하면 행동 형식 학습이 없어 성능이 크게 붕괴했다.
- 메모리를 제거하면 MLVU가 51.0→42.0으로, rewatch를 제거하면 LVBench가 45.1→42.5로 낮아졌다.
- 단순한 WorldSense에서는 샘플당 평균 8.1초에 답했지만 LVBench에서는 35.1초를 사용해, 질의 난도에 따라 실제 추론 비용도 달라졌다.

# Limitations / Discussion

- 텍스트 메모리를 매번 재작성하므로 초기의 잘못된 관찰이 긴 궤적 전체에 남거나 중요한 세부 정보가 압축 과정에서 사라질 수 있다.
- rewatch 범위가 가장 최근 fast-forward 창으로 제한되어, 탐색 후반에 비디오 초반의 단서를 다시 확인할 수 없다.
- 현재 입력은 시각 정보뿐이라 대화, 음향, 배경음 같은 오디오 단서가 필요한 질문에는 대응하지 못한다.
- 교사 궤적을 Gemini 3 Flash로 만들고 답변 시점까지 모방하므로, 교사의 탐색 편향과 오류가 데이터와 보상에 들어갈 수 있다.
- 정확도 향상을 위해 어려운 장문 벤치마크에서는 비교법보다 더 긴 추론 시간을 사용한다. 동일 비용 조건의 효율성 비교가 추가로 필요하다.

# 내가 이해한 핵심

이 논문의 핵심은 더 많은 프레임을 넣는 것이 아니라, 관찰과 추론을 하나의 폐루프로 만든 데 있다. 지금까지 본 내용이 다음에 볼 구간의 속도와 해상도를 바꾸고, 새 관찰은 다시 메모리와 행동을 바꾼다. 장문 멀티모달 문제에서 성능을 좌우하는 것은 최대 문맥 길이만이 아니라 제한된 시각 예산을 배분하는 학습된 정책이라는 주장이다.

# 다음에 연결해서 읽을 논문

- [LongVT: Incentivizing Thinking with Long Videos via Native Tool Calling](https://arxiv.org/search/?query=LongVT+Incentivizing+Thinking+with+Long+Videos&searchtype=title)
- [VideoTemp-o3: Harmonizing Temporal Grounding and Video Understanding in Agentic Thinking-with-Videos](https://arxiv.org/search/?query=VideoTemp-o3&searchtype=title)
- [Video-R1: Reinforcing Video Reasoning in MLLMs](https://arxiv.org/search/?query=Video-R1+Reinforcing+Video+Reasoning&searchtype=title)
