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

# Experiments / Results

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
