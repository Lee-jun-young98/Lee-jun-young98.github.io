---
title: "VideoResearcher: Self-Improving Tool Design for Long-Video Understanding"
date: 2026-09-18
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Dingqiang Ye, Dongdi Zhao, Kaishen Wang, Qingqiao Hu, Jingchen Sun, Yijun Liang, Yuqi Jia, Yiqiao Huang, Yunjie Tian, Jiaxing Zhang, Chuanyang Jin, Ke Zhang, Vishal M. Patel, Di Fu"
paper: "https://arxiv.org/abs/2609.19664"
code: ""
project: ""
---

# 한 줄 요약

장문 비디오 에이전트의 실패 궤적에서 부족한 증거 획득 능력을 진단하고, 이를 보완하는 실행 가능한 비디오 도구를 자동으로 설계·검증·축적해 모델 파라미터를 바꾸지 않고 성능을 높인다.

# 논문 정보

- 제목: VideoResearcher: Self-Improving Tool Design for Long-Video Understanding
- 저자: Dingqiang Ye, Dongdi Zhao, Kaishen Wang, Qingqiao Hu, Jingchen Sun, Yijun Liang, Yuqi Jia, Yiqiao Huang, Yunjie Tian, Jiaxing Zhang, Chuanyang Jin, Ke Zhang, Vishal M. Patel, Di Fu
- 발표: 확인 필요 (arXiv v1, 2026-09-17)
- 링크: [arXiv:2609.19664](https://arxiv.org/abs/2609.19664)
- 코드/프로젝트: 공개 링크 확인 필요
- 키워드: long-video understanding, multimodal agent, self-improvement, tool synthesis, evidence acquisition

# 핵심 아이디어

VideoResearcher는 장문 비디오 질의응답을 수행하는 **Solving Loop**와 그 실행 기록을 바탕으로 도구를 개선하는 **Evolving Loop**를 결합한다. Worker와 비디오 인식 모델은 고정한 채, 실패가 발생한 증거 수집 절차만 실행 가능한 Python 도구로 다시 설계한다. 새 도구는 동일한 개발 세트에서 기존 도구 상자보다 정확도를 엄격히 높일 때만 채택되며, 성공과 실패 경험은 다음 진화 라운드의 메모리로 남는다.

# VLM 관점에서 중요한 이유

장문 비디오 VLM의 병목을 모델 크기나 최대 문맥 길이만이 아니라 **질문에 필요한 시각 증거를 어떻게 찾는가**의 문제로 분리했다. 특히 프롬프트나 미리 정의된 도구 조합을 최적화하는 수준을 넘어, 에이전트가 관찰 실패를 새로운 지각 절차로 번역한다. 이는 고정된 VLM도 외부 도구 계층을 진화시켜 새로운 관찰 능력을 획득할 수 있음을 보여준다.

# Method

- Solving Loop에서 Worker는 비디오를 직접 보지 않고 도구를 호출한다. 도구가 고정된 perception model에 시간 구간, 샘플링 속도, 시각 질의를 전달하고 텍스트 관찰을 돌려준다.
- 초기 도구 상자는 전체 또는 지정 구간을 질의하는 범용 `ask_video` 하나로 시작한다. 각 문제의 도구 선택, 인자, 관찰, 최종 답을 완전한 궤적으로 저장한다.
- Evolving Loop의 Capability Auditor와 Trajectory Analyzer가 이야기 범위와 증거 품질 관점에서 반복되는 실패를 찾아 하나의 도구 개발 목표로 좁힌다.
- Tool Designer와 Coding Assistant가 목표, 입출력 스키마, 프레임 선택·시간 분할·관찰 집계 정책을 명세하고 실행 가능한 후보 도구를 만든다.
- Debugger가 등록·실행·스키마를 검사한 뒤, 고정된 Worker·perception model·시드로 기존 도구 상자와 후보를 같은 300개 ALLVB 개발 문제에서 비교한다. 정확도가 엄격히 증가한 후보만 채택한다.
- 검증기는 새 도구가 실제로 호출되었는지, 어떤 증거가 추가되었는지, 정답 변화와 어떻게 연결되는지를 기록하고 성공·실패 사례를 경험 메모리에 누적한다.

# Experiments / Results

- LVBench, LongVideoBench, Video-MME의 전체 정확도 평균이 기본 에이전트 72.1에서 74.5로 2.4점 상승했다.
- 동일한 기본 에이전트와 진화 예산을 사용한 자기개선 방법과 비교해 SkillOpt 69.8, AutoResearch 71.7, Meta-Harness 73.5보다 높은 74.5를 기록했다.
- 벤치마크별 전체 정확도는 LVBench 68.4, LongVideoBench 75.0, Video-MME 80.2였다. 기본 에이전트 대비 각각 +1.5, +1.8, +3.9점이다.
- 진화 과정에서 약 512프레임을 다섯 구간으로 나눠 장면 랜드마크를 만드는 도구와, 후보 사건 주변의 짧은 클립을 촘촘히 스캔하는 도구가 채택됐다. 개발 정확도는 68.7→75.0→76.7로 올랐다.
- 반면 전역 행동 앵커, 장면 간 개체 연결, 단일 중간 구간 요약 도구는 개발 정확도를 낮춰 거부됐다. 자동 생성 자체보다 통제된 역검증이 중요한 구성 요소임을 보여준다.
- Round 2가 LVBench 68.9, LongVideoBench 75.5, Video-MME 80.0을 기록한 반면 Round 7은 68.4, 75.0, 80.2였다. 도구를 더 진화시킨다고 모든 데이터셋에서 단조롭게 개선되지는 않았다.

# Limitations / Discussion

- 도구 선택 기준이 하나의 300문항 개발 세트 정확도이므로 반복 진화가 이 세트에 과적합될 수 있다. 저자들도 독립적인 후보 선택 데이터의 필요성을 지적한다.
- 검증 보고서는 궤적에 기반한 설명이지 독립적인 인과 실험이 아니다. 새 관찰과 정답 수정 사이의 인과성을 완전히 보장하지 않는다.
- 진화 범위가 증거 획득 도구로 제한되어 Worker의 추론 구조, 에이전트 역할 구성, perception model 자체의 오류는 개선하지 못한다.
- 최종 성능은 강한 Worker와 많은 계산 자원에 의존한다. 실험은 기본적으로 GPT-5.6-SOL Worker, Qwen3.5-4B perception model, 8×B200 배포를 사용하며 문제당 최대 10회의 도구 호출을 허용한다.
- 인간 설계 시스템과의 비교는 공개된 서로 다른 설정의 점수를 참조하므로 엄밀한 동일 조건 비교가 아니다.
- 도구가 실행 코드를 생성·수정하는 구조인 만큼 실제 배포에서는 샌드박싱, 자원 제한, 보안 검증이 추가로 필요하다.

# 내가 이해한 핵심

이 논문의 핵심은 자기개선의 단위를 프롬프트나 모델 가중치가 아니라 **관찰 알고리즘**으로 잡은 것이다. 장문 비디오에서 오답의 원인이 추론 부족이 아니라 결정적 장면을 놓친 데 있다면, 실패 궤적을 분석해 새로운 검색·샘플링 절차를 코드로 만들고 같은 조건에서 역검증하는 편이 직접적이다. 결과적으로 VLM의 고정된 지각 능력을 바꾸지 않아도, 무엇을 언제 어떻게 볼지를 담당하는 도구 계층은 경험을 통해 확장될 수 있다.

# 다음에 연결해서 읽을 논문

- [VideoScout: Learning Agentic Active Exploration with Adaptive Reasoning Pacing for Long Video Understanding](/papers/vlm/videoscout-learning-agentic-active-exploration-with-adaptive-reasoning-pacing-for-long-video-understanding)
- [VideoAgent: Long-form Video Understanding with Large Language Model as Agent](https://arxiv.org/abs/2403.10517)
- [Deep Video Discovery: Agentic Search with Tool Use for Long-form Video Understanding](https://arxiv.org/search/?query=Deep+Video+Discovery+Agentic+Search+with+Tool+Use&searchtype=title)
- [VideoSeek: Long-Horizon Video Understanding with Agentic Search](https://arxiv.org/search/?query=VideoSeek+Long-Horizon+Video+Understanding+with+Agentic+Search&searchtype=title)
