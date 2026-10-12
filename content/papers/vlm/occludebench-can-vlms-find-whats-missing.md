---
title: "OccludeBench: Can VLMs Find What's Missing?"
date: 2026-10-12
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Jasin Cekinmez, Addison J. Wu, Ryo Mitsuhashi, Linrong Cai, Xingyu Fu, Zhuang Liu"
paper: "https://arxiv.org/abs/2610.13790"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/occludebench-can-vlms-find-whats-missing/occludebench-diagnostic-pipeline.svg"
---

# 한 줄 요약

OccludeBench는 완전히 가려진 물체를 반사·그림자 같은 직접 증거로 복원하는 문제에서 VLM이 문맥 추론보다 평균 20.0%p 낮다는 사실을 보이고, 병목이 단서 감지나 위치 연결이 아니라 **전체 장면 속 투영 영역에서 물체를 꺼내 읽는 단계**임을 OccludeTrace로 분리해 낸다.

# 논문 정보

- 제목: OccludeBench: Can VLMs Find What's Missing?
- 저자: Jasin Cekinmez, Addison J. Wu, Ryo Mitsuhashi, Linrong Cai, Xingyu Fu, Zhuang Liu (Princeton University)
- 발표: 확인 필요. arXiv v1은 2026-10-09 제출되었으며, 2026-10-12 기준 CVPR·ICCV·ECCV·NeurIPS·ICML·ICLR·ACL 계열의 공식 채택 자료는 확인하지 못했다.
- 링크: [arXiv:2610.13790](https://arxiv.org/abs/2610.13790), [HTML 논문](https://arxiv.org/html/2610.13790)
- 코드/프로젝트: 논문 및 arXiv 메타데이터에서 공식 공개 주소를 확인하지 못했다.
- 키워드: VLM evaluation, occlusion reasoning, shadow and reflection, visual evidence, amodal completion, VQA

# 핵심 아이디어

OccludeBench는 물체를 검은 polygon 또는 bounding box로 **완전히** 가리고, 남은 시각 증거만으로 자유형 답을 생성하게 한다. 378개 이미지 중 197개는 반사나 그림자라는 특정 물리 단서를 읽어야 하는 `direct`, 181개는 장면 문맥으로 답을 유추할 수 있는 `inferential`이다. 부분 가림이 아니라 답 물체를 완전히 숨기고, 가림 좌표와 정답을 통제하므로 “모델이 실제 증거를 사용했는가”를 비교적 깨끗하게 검사한다.

핵심 진단인 OccludeTrace는 direct 문제의 추론을 네 단계로 나눈다.

1. 반사나 그림자가 있다는 사실을 감지한다.
2. 투영 영역만 crop했을 때 원 물체를 인식한다.
3. 투영을 만든 원 물체의 위치를 네 후보 중 찾는다.
4. 전체 이미지 안에서 강조된 투영 영역을 자세히 읽어 그 안의 물체를 복원한다.

기본 문제를 맞힌 사례와 틀린 사례를 나누어 보니 1–3단계는 거의 갈라지지 않았지만, 4단계는 실패 사례 50% 대 성공 사례 91%로 41%p 벌어졌다. 즉 모델은 단서의 존재와 기하학적 연결을 아예 모르는 것이 아니라, 지역 단서를 전역 문맥 속에서 선택하고 물체 정체성으로 읽어 내는 데 실패한다.

# VLM 관점에서 중요한 이유

많은 VLM 벤치마크는 문맥만으로 답을 맞혀도 높은 점수를 줄 수 있다. OccludeBench의 direct/inferential 쌍은 답을 맞힌 결과보다 **결정적 시각 증거를 사용했는지**를 겨냥한다. 다섯 VLM 평균은 direct 42.7%, inferential 62.7%로 20.0%p 차이가 났지만, 사람은 63.4%와 68.5%로 차이가 5.1%p였고 통계적으로 유의하지 않았다.

또한 더 긴 reasoning, crop·zoom 도구, few-shot 예시만으로는 이 간극이 안정적으로 사라지지 않았다. 반면 먼저 가려진 영역을 inpaint해 후보를 만든 뒤, 그 후보가 반사·그림자의 물리 조건과 맞는지 다시 대조하는 `inpaint-then-confront`는 생성 문제를 검증 문제로 바꾸어 GPT-5.4와 Gemini 3.1 Pro의 direct–inferential 차이를 통계적으로 유의하지 않은 수준까지 줄였다. 이는 VLM의 시각 정보가 완전히 사라진 것이 아니라 **열린 형태로 회수하기보다 명시적 가설을 반증하는 접근이 더 쉽다**는 증거다.

# Method

## 1. 데이터 구축과 평가

저자들은 인터넷 353장, Visual Genome 19장, 직접 촬영 6장을 모아 실제 반사와 그림자의 물리 특성을 유지했다. direct는 정반사 47.7%, 난반사 28.4%, 그림자 23.9%이고, inferential은 기술·가정·문화·활동·자연 장면을 포함한다. 인간 annotator가 범주와 정답에 만장일치한 이미지만 남겼으며, 의견이 갈린 41장은 제거했다.

다섯 VLM에는 같은 온도 0의 자유형 질문을 준다. 답은 Claude Opus 4.6과 GPT-5.4 두 judge 가운데 하나라도 정답 물체와 동등하다고 판단하면 맞은 것으로 처리한다. 이 ensemble 판정은 저자 gold 판정과 98% 일치했다. 사람 기준선은 영어권 473명에게 각 6문항을 무작위로 배정해 같은 자유형 조건에서 수집했다.

## 2. OccludeTrace와 개입

OccludeTrace는 동일한 direct 이미지에서 cue detection, cropped projection recognition, source mapping, highlighted-region recovery를 독립 prompt로 측정한다. 투명 box로 가림 위치만 알려주는 control에서는 모든 모델이 86–94% 수준으로 물체를 읽어, 가림 영역을 찾지 못한 것이 주된 원인이라는 설명도 배제한다.

개입 실험은 high-reasoning, 최대 5회의 crop·zoom·edge detection·flip·rotate, 두 개의 few-shot trace, 반사·그림자를 보라는 steering, 그리고 inpaint-then-confront를 비교한다. 마지막 방법은 (1) 원 이미지를 유지하며 가려진 영역을 채우고, (2) 가려진 원본과 생성된 후보를 함께 보며 물리적 일관성을 판정한 뒤 답을 수정한다. 학습은 없고, 추론 시 외부화된 시각 가설을 추가하는 방식이다.

# 핵심 그림

![OccludeBench 데이터 구성, 네 단계 OccludeTrace 진단, inpaint-then-confront 개입을 연결한 한국어 파이프라인 재구성도](/papers/assets/vlm/occludebench-can-vlms-find-whats-missing/occludebench-diagnostic-pipeline.svg)

_논문 Figure 3, Figure 5, Figure 9와 Sections 2–3을 바탕으로 재구성._ 단순 예시 이미지보다 **벤치마크 입력 → 병목 진단 → 가설 생성과 반증**의 전체 흐름이 연구의 공헌과 결과를 함께 설명하므로 이 구조를 골랐다. 출처: [논문 Figure 3 및 Section 2](https://arxiv.org/html/2610.13790#S2), [Figure 5와 OccludeTrace](https://arxiv.org/html/2610.13790#S3.SS2), [Figure 9와 inpaint-then-confront](https://arxiv.org/html/2610.13790#S3.SS3). 원문은 CC BY-NC-SA 4.0이며 원본 그림을 복사하지 않고 논문 내용을 바탕으로 직접 재구성했다.

그림 왼쪽은 실제 이미지에서 목표 물체를 완전히 가리고, 남는 증거가 특정 반사·그림자인 direct와 넓은 장면 문맥인 inferential로 나누는 입력 단계다. 가운데 OccludeTrace는 단서 감지 → crop 인식 → 원천 위치 연결 → 전체 장면 속 투영 회수 순서이며, 마지막 단계만 실패·성공 사례 사이에 41%p 차이가 난다. 오른쪽은 학습과 분리된 추론 개입이다. 모델이 먼저 채움 후보를 생성한 뒤 원본의 물리 단서와 충돌하는지 대조하고 답을 수정하므로, 직접적인 열린 답 생성 대신 명시적 가설 검증으로 문제를 바꾼다.

# Experiments / Results

- 평가 모델은 GPT-5.4, Claude Opus 4.6, Gemini 3.1 Pro, Qwen 3 VL 8B, Llama 4 Maverick이다. 모든 모델이 direct에서 inferential보다 낮았다.
- 다섯 모델 평균은 전체 52.3%, 사람은 65.9%다. 모델의 direct–inferential 차이는 평균 20.0%p지만 사람의 차이는 5.1%p이며, 사람의 범주 차이는 유의하지 않았다($p=0.079$).
- OccludeTrace에서 기본 direct 문제를 틀린 사례도 cue detection 99%, crop recognition 79%, source mapping 85%로 앞 단계를 대체로 통과했다. highlighted-region recovery만 50%로, 성공 사례 91%보다 41%p 낮았다.
- tool use는 GPT-5.4 direct 정확도를 51.8%에서 46.7%로 낮췄다. steering의 최대 개선은 GPT-5.4 thinking 조건 51.8%→69.2%였지만 inferential과의 간극은 남았다.
- inpaint-then-confront는 GPT-5.4 direct를 37.6%→54.3%(+16.7%p), Gemini 3.1 Pro를 71.6%→82.2%(+10.6%p)로 높였다. 각 모델의 inferential 정확도는 같은 62.4%, 87.8%를 비교 기준으로 유지했다.

## 주요 실험 결과

아래 표는 논문 Table 1의 동일 378개 benchmark, 동일 open-ended prompt와 동일 judge 설정에서 직접 대조한 정확도다. `차이`는 `inferential - direct`의 절대 정확도 차이(%p)다.

| 모델 / 정확도 (%, ↑) | Direct | Inferential |    차이 | 출처    |
| -------------------- | -----: | ----------: | ------: | ------- |
| GPT-5.4              |   37.6 |        62.4 | +24.8%p | Table 1 |
| Claude Opus 4.6      |   51.8 |        75.1 | +23.3%p | Table 1 |
| Gemini 3.1 Pro       |   71.6 |        87.8 | +16.2%p | Table 1 |
| Qwen 3 VL 8B         |   20.9 |        46.4 | +25.5%p | Table 1 |
| Llama 4 Maverick     |   31.6 |        42.0 | +10.4%p | Table 1 |

모든 모델이 같은 방향으로 하락하며, 최고 전체 정확도의 Gemini 3.1 Pro도 direct에서 16.2%p 낮다. 이는 작은 open model만의 용량 문제가 아니라 frontier VLM에도 공통적인 **직접 시각 증거 선택 실패**임을 보여준다. 수치와 조건은 [논문 Table 1 및 Section 3.1](https://arxiv.org/html/2610.13790#S3.SS1)에서 확인했다.

개입 효과는 Table 3의 matched comparison으로 별도 확인했다.

| 모델 / 설정 (정확도 %, ↑)       | Direct | 같은 Inferential 기준 |    차이 | 범주 차이 검정 $p$ | 출처    |
| ------------------------------- | -----: | --------------------: | ------: | -----------------: | ------- |
| GPT-5.4 baseline                |   37.6 |                  62.4 | +24.8%p |            <0.0001 | Table 3 |
| GPT-5.4 inpaint-confront        |   54.3 |                  62.4 |  +8.1%p |               0.12 | Table 3 |
| Gemini 3.1 Pro baseline         |   71.6 |                  87.8 | +16.2%p |             0.0001 | Table 3 |
| Gemini 3.1 Pro inpaint-confront |   82.2 |                  87.8 |  +5.6%p |               0.15 | Table 3 |

GPT-5.4의 direct 향상은 +16.7%p, Gemini 3.1 Pro는 +10.6%p다. 두 모델 모두 $p>0.05$가 되었지만, 이것은 두 범주의 성능이 같다는 증명이 아니라 이 표본에서 유의한 차이를 검출하지 못했다는 뜻이다. 또한 image generation이 없는 모델에는 같은 개입을 적용하지 않았으므로 모델 간 보편적 개선으로 해석하면 안 된다. 출처: [논문 Table 3 및 Section 3.3](https://arxiv.org/html/2610.13790#S3.SS3).

# Limitations / Discussion

- 378개 중 197개 direct 사례가 반사와 그림자에 집중되어, 음영·굴절·가림 뒤 움직임 같은 다른 간접 물리 증거로 결과를 일반화하기 어렵다.
- 인터넷 이미지가 93.4%이고 Visual Genome과 직접 촬영 subset은 매우 작다. 저자도 출처별 정확도는 noisy하다고 명시한다.
- 자유형 답 채점은 두 평가 대상 모델을 포함한 LLM judge에 의존한다. gold와 98% 일치하지만, “한 judge라도 맞다고 하면 정답” 규칙은 경계 사례에서 관대할 수 있다.
- 모델별 API 버전과 proprietary image-generation 동작은 장기 재현성이 낮다. inpaint-then-confront는 생성 가능한 두 모델에만 평가되었다.
- direct와 inferential은 동일 이미지의 counterfactual pair가 아니라 서로 다른 이미지 집합이다. 사람 난이도 분포와 범주 내 하위 유형 검정을 제공하지만 모든 scene-level confound를 제거하지는 못한다.
- 유의하지 않은 $p$값은 동등성의 증거가 아니다. 더 큰 표본이나 사전 등록된 equivalence margin이 있어야 “간극 제거”를 강하게 주장할 수 있다.

# 내가 이해한 핵심

이 논문의 가장 중요한 구분은 **볼 수 있음**과 **사용할 수 있음**이다. 모델은 반사나 그림자를 거의 항상 감지하고, 잘라서 보여주면 그 안의 물체도 읽고, 어느 위치의 물체와 연결되는지도 찾는다. 그런데 같은 단서가 전체 장면에 들어가면 필요한 부분을 회수하지 못한다. 따라서 더 강한 encoder나 더 긴 chain-of-thought만으로 해결된다고 단정하기 어렵고, 전역 문맥 속 국소 증거를 선택해 reasoning state로 올리는 인터페이스가 필요하다.

inpaint-then-confront의 효과도 “생성 이미지가 정답을 복원했다”로 읽으면 안 된다. 예시에서는 첫 infill이 틀렸지만, 모델이 그 구체적인 후보와 원본의 물리 단서를 대조하며 오류를 발견했다. 핵심은 latent한 가능성을 외부 시각 가설로 바꿔 **반증 가능한 상태**를 만든 데 있다. 앞으로 VLM agent의 visual scratchpad도 자연어 설명만 늘리기보다 crop, mask, reconstruction처럼 원본 증거와 대조 가능한 중간 표현을 남기는 방향이 중요하다.

# 다음에 연결해서 읽을 논문

- [V\*Bench: A Comprehensive Benchmark Suite for Visual Reasoning](https://arxiv.org/abs/2505.19227): 저수준·고수준 시각 추론 실패를 더 넓은 과제군에서 비교할 수 있다.
- [Look Where It Counts: A Free, Label-Free Visual Evidence Signal for Fine-Grained Vision-Language Reasoning](https://arxiv.org/abs/2609.24244): 답의 확률 변화로 evidence crop을 찾는 접근과 OccludeTrace의 수동 단서 분리를 연결해 볼 수 있다.
- [The Alignment Illusion in Multimodal Large Language Models](https://arxiv.org/abs/2609.30210): 시각 입력이 없어도 답 형식과 의미가 유지되는 현상을, OccludeBench의 context shortcut 문제와 함께 읽을 수 있다.
