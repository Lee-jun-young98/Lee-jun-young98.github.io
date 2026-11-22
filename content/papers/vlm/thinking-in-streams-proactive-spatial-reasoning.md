---
title: "Thinking in Streams: Proactive Spatial Reasoning with Vision-Language Models"
date: 2026-11-22
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Junyoung Hong, Minsu Kim, Jaehyun Kim, Jeonghwan Cho, Jiwoo Lee, Seon Joo Kim"
paper: "https://arxiv.org/abs/2611.25865"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/thinking-in-streams-proactive-spatial-reasoning/prospace-vlm-architecture.svg"
---

# 한 줄 요약

ProSpace-VLM은 매 프레임의 3D point map과 camera pose를 VLM 중간층에 주입해 기존 KV cache를 공간 기억으로 쓰며, ProSpace-Bench에서 같은 native-streaming 계열 최강 baseline보다 적시 응답을 **3.7%p**, 올바른 침묵을 **2.5%p** 높인다.

# 논문 정보

- 제목: Thinking in Streams: Proactive Spatial Reasoning with Vision-Language Models
- 저자: Junyoung Hong, Minsu Kim, Jaehyun Kim, Jeonghwan Cho, Jiwoo Lee, Seon Joo Kim
- 발표: arXiv:2611.25865v1, 2026-11-19 제출; 학회 게재 여부는 확인 필요
- 링크: [arXiv](https://arxiv.org/abs/2611.25865), [공식 PDF](https://arxiv.org/pdf/2611.25865), [공식 HTML](https://arxiv.org/html/2611.25865)
- 라이선스: arXiv perpetual non-exclusive license
- 코드/프로젝트: arXiv 메타데이터와 본문에서 공식 공개 저장소·프로젝트 링크를 확인하지 못함
- 키워드: streaming VLM, proactive spatial reasoning, spatial memory, KV cache, 3D geometry, abstention

# 핵심 아이디어

일반 video VQA는 정해진 시점에 질문하지만, 실제 보조자는 “이 방에 다시 오면 가방을 알려줘”처럼 **조건이 성립하는 순간을 스스로 골라야** 한다. 저자들은 이를 proactive spatial reasoning으로 정의하고, 양성 episode에서는 유효 응답 구간 안에 답하는지, absence episode에서는 끝까지 침묵하는지를 함께 평가한다.

핵심 모델은 별도 외부 memory를 만들지 않는다. 들어오는 프레임에서 인과적으로 추정한 3D point map과 camera pose를 각 visual token에 맞춰 encoding하고 VLM의 초기~중간층에 더한다. 그 결과 KV cache에 쌓이는 key/value가 “무엇을 봤는가”뿐 아니라 “어디서 무엇을 봤는가”를 포함한다. 오래된 token은 공통 좌표계의 voxel 단위로 고르므로 stream이 길어져도 token budget을 통제한다.

# VLM 관점에서 중요한 이유

이 논문은 streaming VLM의 기억을 단순 frame history가 아니라 **시점 변화에도 유지되는 공간 상태**로 바꾼다. 새 memory network를 붙이는 대신 이미 추론에 필요한 KV cache의 write/read 경로를 재사용한다는 점도 실용적이다. 공간 좌표가 token과 결합돼 있으므로 오래된 token을 시간 순서가 아니라 3D coverage에 따라 선택할 수 있다.

평가도 중요하다. 적시 응답만 높이면 무조건 빨리 답하는 모델이 유리하고, correct abstention만 높이면 아무 말도 하지 않는 모델이 유리하다. 두 축을 양성/absence stream에서 함께 보고 premature, delayed, miss, false alarm을 분리해야 proactive assistant의 실제 실패를 드러낼 수 있다.

# Method

## 1. ProSpace task와 데이터

query $q$를 먼저 받고 video stream $V=(v_0,\ldots,v_T)$를 순차 처리한다. 양성 episode의 정답 시간창 $W=[t_s,t_e]$ 안에서 처음 응답하면 timely이며, absence episode에서 $\hat t=\infty$이면 correct abstention이다.

ProSpace-Bench는 242개 실내 scene과 18개 house의 약 61시간 video를 1 fps로 표본화한 3,636 episode다. 아홉 task는 다음 세 층위로 나뉜다.

- Object: object finding, re-finding, 보이지 않는 물체의 상대 방향
- Camera: ego rotation, 시작점 복귀, 시작 영역을 다시 보는 visual homing
- Scene: 방 전환, 특정 방 진입, 이전 방 재방문

학습용 ProSpace-Train은 scene이 겹치지 않는 100K positive/absence stream으로 구성된다.

## 2. causal geometry encoding

각 프레임에서 vision encoder가 visual token을 만들고 CUT3R가 point map과 camera pose를 인과적으로 추정한다. point map을 visual-token grid에 resample해 token $j$의 3D 위치 $\mathbf{x}_{t,j}$를 얻고, camera center $\mathbf{c}_t$와 rotation $\mathbf{R}_t$를 결합한다.

$$
\mathbf{g}_{t,j}=\left[\phi(\mathbf{x}_{t,j}),\psi(\mathbf{c}_t,\mathbf{R}_t)\right].
$$

$\phi$는 3D 위치의 Fourier feature, $\psi$는 camera center와 continuous 6D rotation의 Fourier feature다.

## 3. KV cache를 공간 기억으로 사용

초기~중간 VLM layer 집합 $\mathcal L$에서 layer별 MLP로 geometric encoding을 투영해 visual hidden state에 더한다.

$$
\widetilde{\mathbf h}_{t,j}^{(\ell)}=\mathbf h_{t,j}^{(\ell)}+f_\ell(\mathbf g_{t,j}),\qquad \ell\in\mathcal L.
$$

이 상태에서 만들어진 geometry-aware key/value가 프레임마다 cache에 누적되고, 현재 frame은 standard causal attention으로 과거 공간 기억을 읽는다. 최근 frame은 전부 보존하고 오래된 frame은 voxel마다 가장 이른 token 하나를 남긴다. budget을 넘으면 voxel 크기를 키운다.

## 4. wait/respond 결정

LoRA와 geometric projection MLP를 decision-token cross-entropy로 학습한다. 추론 시 매 프레임의 `respond` 확률이 threshold $\tau$를 처음 넘는 시점을 응답 시간으로 정한다.

$$
\hat t=\min\{t\ge t_q:P_\theta(\texttt{respond}\mid q,v_{0:t})\ge\tau\}.
$$

# 핵심 그림

![공간 요청과 스트리밍 프레임이 vision encoder와 causal geometry encoder를 거쳐 visual token 및 3D 위치·camera pose로 변환되고, 중간층 geometry injection과 voxel token selection을 통해 KV cache 공간 기억에 누적된 뒤 wait 또는 respond 결정을 내리는 ProSpace-VLM 구조](/papers/assets/vlm/thinking-in-streams-proactive-spatial-reasoning/prospace-vlm-architecture.svg)

_논문 Figure 3과 Equations (1)–(4)를 바탕으로 재구성._ 출처: [공식 HTML Figure 3 및 Method](https://arxiv.org/html/2611.25865#S3.SS3). 원 Figure 3이 전체 architecture를 직접 설명하므로, 장식적 정성 결과보다 **입력 → geometry 정렬 → 중간층 주입 → KV cache → 응답** 흐름을 선택했다. 원본 그림은 arXiv perpetual non-exclusive license라서 그대로 재사용하지 않았다.

왼쪽에서 공간 요청은 먼저 입력되고 frame은 한 장씩 도착한다. vision encoder의 token마다 CUT3R가 추정한 point와 camera pose를 연결하고, layer별 MLP가 초기~중간층 hidden state에 geometric encoding을 더한다. 학습 때는 projection MLP와 language model LoRA를 decision-token loss로 맞춘다.

가운데의 KV cache는 별도 지도 데이터 구조가 아니라 VLM의 원래 cache다. 다만 저장되는 key/value가 공통 3D 좌표를 품으므로, 추론 때 current token이 과거의 공간 상태를 causal attention으로 읽고 오래된 token은 voxel coverage를 유지하도록 줄일 수 있다. 마지막으로 매 frame `wait/respond` 확률을 계산해 조건이 성립할 때만 응답한다.

# Experiments / Results

- 기반 모델: Qwen2.5-VL-7B-Instruct 계열, Stream3D-VLM-8B 등
- 주 지표: positive episode의 timely response (%), absence episode의 correct abstention (%)
- 비교군: proprietary/general/spatial/streaming VLM, ProSpace SFT를 적용한 prefix-polling 및 native-streaming 모델
- 학습: geometric projection MLP와 LLM LoRA; response decision cross-entropy

## 주요 실험 결과

아래 표는 원 논문 **Table 1**의 평균 열 중, 같은 ProSpace SFT native-streaming 설정과 인간 결과를 옮겼다. 각 값은 timely response / correct abstention (%)이며 서로 다른 두 episode 집합의 지표이므로 합쳐서 단일 정확도로 해석하지 않는다.

| 방법 | 적시 응답 (%, ↑) | 올바른 침묵 (%, ↑) | Stream3D-VLM-8B 대비 | 출처 |
| --- | ---: | ---: | ---: | --- |
| Human (900 subset) | 83.1 | 94.8 | 참고 상한 | Table 1 |
| VideoLLM-online-8B + ProSpace SFT | 49.4 | 71.9 | -18.7%p / -12.9%p | Table 1 |
| Qwen2.5-VL-7B + ProSpace SFT | 61.7 | 78.7 | -6.4%p / -6.1%p | Table 1 |
| Stream3D-VLM-8B + ProSpace SFT | 68.1 | 84.8 | 기준 | Table 1 |
| **ProSpace-VLM (CUT3R)** | **71.8** | **87.3** | **+3.7%p / +2.5%p** | Table 1 |
| ProSpace-VLM (StreamVGGT) | 71.3 | 85.5 | +3.2%p / +0.7%p | Table 1 |

출처: [공식 HTML Table 1](https://arxiv.org/html/2611.25865#S4.T1). CUT3R 버전은 Stream3D-VLM-8B보다 timely response가 $71.8-68.1=3.7$%p, correct abstention이 $87.3-84.8=2.5$%p 높다. 같은 Qwen2.5-VL-7B SFT와 비교하면 각각 +10.1%p, +8.6%p다. 다만 인간 수치는 900-episode subset이라 전체 모델 평균과 엄밀한 동일 표본 비교가 아니다.

Table 2 ablation도 geometry의 각 요소가 필요함을 보인다.

| Camera pose | Point map | Multi-layer injection | 적시 응답 (%, ↑) | 올바른 침묵 (%, ↑) |
| --- | --- | --- | ---: | ---: |
| 없음 | 없음 | 없음 | 61.7 | 78.7 |
| 있음 | 있음 | 없음 | 70.9 | 85.9 |
| **있음** | **있음** | **있음** | **71.8** | **87.3** |

출처: [공식 HTML Table 2](https://arxiv.org/html/2611.25865#S4.T2). 완전한 구성은 baseline보다 timely response +10.1%p, correct abstention +8.6%p다. multi-layer 주입 자체의 추가 이득은 full geometry single-layer 대비 +0.9%p와 +1.4%p다.

# Limitations / Discussion

- human과 최고 모델 사이에는 subset 기준으로도 timely response 11.3%p, correct abstention 7.5%p 차이가 남는다.
- benchmark는 실내 scene 위주이며 1 fps로 표본화한다. 빠른 사건, 야외, 동적 물체가 많은 환경으로의 일반화는 검증되지 않았다.
- geometry quality가 CUT3R/StreamVGGT 추정에 의존한다. textureless 영역, motion blur, dynamic scene에서 잘못된 3D 좌표가 cache에 누적될 수 있다.
- 두 평균 지표는 trade-off를 압축한다. task별로는 Object Finding처럼 single-frame recognition으로 풀리는 경우와 Object Direction처럼 장기 spatial state가 필요한 경우의 난도가 크게 다르다.
- correct abstention이 높아도 miss가 많을 수 있고 timely response가 높아도 false alarm이 많을 수 있다. 배포에서는 threshold별 precision-recall과 비용 비대칭을 추가로 봐야 한다.
- arXiv v1이며 공식 코드·프로젝트와 학회 게재 여부가 확인되지 않았다.

# 내가 이해한 핵심

streaming VLM의 병목은 context 길이만이 아니다. 같은 물체를 다른 시점에서 다시 봤을 때 과거 token과 현재 token이 **같은 공간에 속한다는 좌표계**가 없으면 KV cache는 긴 영상 기록일 뿐 공간 기억이 되기 어렵다. ProSpace-VLM은 geometry를 token의 부가 feature로 주입해 기존 causal attention이 공간적 연관을 읽게 만든다.

또 하나의 핵심은 “언제 말할지”가 독립적인 reasoning task라는 점이다. 정답 문장을 생성할 수 있어도 조건이 아직 성립하지 않았을 때 기다리거나, 끝까지 성립하지 않았을 때 침묵하지 못하면 proactive agent로는 실패다. 그래서 positive와 absence stream을 함께 구성한 평가가 모델 architecture만큼 중요하다.

# 다음에 연결해서 읽을 논문

- [APM-Bench: Benchmarking Cross-session Persistent Memory for Egocentric Streaming Video Assistants](/papers/vlm/apm-bench-cross-session-persistent-memory-for-egocentric-streaming-video-assistants): 한 stream의 공간 기억을 넘어 session 간 장기 기억을 평가한다.
- [DK-VLM: Geometry as Position for Spatial Reasoning in Vision-Language Models](/papers/vlm/dk-vlm-geometry-as-position-for-spatial-reasoning): geometry를 VLM position representation으로 넣는 설계와 비교할 수 있다.
- [VideoEvolve: Co-Evolving Memory and Retrieval for Long Video Understanding](/papers/vlm/videoevolve-co-evolving-memory-and-retrieval-for-long-video-understanding): 긴 video에서 memory selection과 retrieval을 함께 학습하는 다른 접근이다.
- [CUT3R: Continuous 3D Perception Model with Persistent State](https://arxiv.org/abs/2501.12387): ProSpace-VLM이 causal point map과 camera pose를 얻는 geometry encoder다.
