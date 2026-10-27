---
title: "Joint Latent Reasoning and Observation for Agentic Video Understanding"
date: 2026-10-27
paper_monitor: true
tags:
  - "paper-review"
  - "VLM"
venue: "확인 필요"
authors: "Junzhang Liu, Hao Yuan, Qi Zhang, Yiming Wu, Long Chen, Zhecan Wang"
paper: "https://arxiv.org/abs/2610.35229"
code: ""
project: ""
thumbnail: "/papers/assets/vlm/joint-latent-reasoning-and-observation-for-agentic-video-understanding/larva-architecture.svg"
---

# 한 줄 요약

LARVA는 비디오 에이전트의 관찰과 추론을 텍스트로 풀어 쓰지 않고 각각 고정 길이 latent token으로 연결하며, 두 모듈을 다음 도구 선택과 최종 답 손실로 함께 학습해 정확도와 추론 속도를 동시에 높인다.

# 논문 정보

- 제목: Joint Latent Reasoning and Observation for Agentic Video Understanding
- 저자: Junzhang Liu, Hao Yuan, Qi Zhang, Yiming Wu, Long Chen, Zhecan Wang
- 발표: arXiv:2610.35229v1 (2026-10-26), venue 확인 필요
- 링크: [arXiv 초록](https://arxiv.org/abs/2610.35229), [arXiv HTML](https://arxiv.org/html/2610.35229)
- 코드/프로젝트: 논문은 공개 예정이라고 밝혔으나 현재 공식 공개 링크 확인 필요
- 라이선스: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- 키워드: video-language model, multimodal agent, latent reasoning, active frame acquisition, trajectory distillation, long-video understanding

# 핵심 아이디어

긴 비디오를 다 보는 대신 필요한 구간을 반복해서 찾는 에이전트에서는 관찰 하나가 현재 질문의 답뿐 아니라 **다음에 어디를 볼지**도 바꾼다. 기존 증류 방식은 관찰을 caption으로, 추론을 chain-of-thought로 직렬화한다. 이 방식은 사람이 읽기 쉽지만 토큰이 길고, caption이 현재 보이는 내용을 요약하면서도 다음 탐색에 필요한 미세 단서를 버릴 수 있다.

LARVA는 reasoner와 observer 사이의 메시지를 연속 latent state로 바꾼다. reasoner는 매 라운드 고정 길이 reasoning block $Z_t$를 만든 뒤 `Overview`, `Skim`, `Focus` 중 다음 도구 호출 또는 최종 답을 텍스트로 출력한다. observer는 선택된 프레임을 고정 길이 observation block $O_t$로 압축하고, 이 상태가 다음 라운드의 reasoner context에 직접 들어간다.

핵심은 두 latent interface를 따로 맞추지 않고 jointly optimize한다는 점이다. 다음 도구 호출과 최종 답의 손실이 observer까지 역전파되고, teacher observation 재구성 및 frozen textual CoT student의 다음 추론 분포와 맞추는 KL 손실이 latent state에 추가 의미 제약을 준다.

# VLM 관점에서 중요한 이유

- 비디오 토큰 절약을 프레임 pruning만의 문제가 아니라 **관찰 표현–추론–다음 획득 행동**을 함께 설계하는 문제로 본다.
- observer가 만든 표현을 caption 품질이 아니라 이후 도구 선택과 답변에 유용한가로 학습한다. 이는 멀티모달 에이전트의 내부 통신을 task-oriented representation으로 바꾸는 접근이다.
- reasoning과 observation을 각각 8개 latent token으로 제한해 긴 textual CoT와 caption을 없애면서도, 단순히 중간 텍스트를 생략한 Direct Policy보다 정확도가 높다.
- 동일 teacher trajectory를 쓰는 통제 비교에서 정확도뿐 아니라 획득 라운드, 처리 프레임, latency가 함께 줄어든다. 즉 효율 이득이 답변 품질을 희생한 결과가 아니다.

# Method

1. teacher reasoner(DeepSeek-V4.1-Flash)와 teacher observer(Qwen3.8-27B)가 `Overview` 64프레임, `Skim/Focus` 16프레임 도구를 사용해 20,000개 상호작용 trajectory를 만든다. 오답 또는 invalid tool call이 있는 trajectory는 제거한다.
2. 먼저 teacher의 텍스트 추론·행동·답을 모방하는 CoT student와, teacher의 텍스트 관찰을 모방하는 observer를 학습한다. 두 모델은 latent reasoner와 latent observer의 초기값이 되며 frozen CoT student는 분포 정렬 기준이 된다.
3. reasoner는 매 결정 전에 식 (1)의 고정 길이 $Z_t=[z_t^1,\ldots,z_t^k]$를 autoregressive하게 계산하고, 이를 조건으로 도구 호출 또는 답을 텍스트로 낸다. observer는 선택 프레임·도구 종류·선택 query로부터 식 (2)의 $O_t\in\mathbb{R}^{n\times d}$를 만든다. 둘은 backbone을 공유하지만 rank 16의 별도 LoRA와 projector를 쓴다.
4. 학습에서는 teacher의 discrete acquisition action을 replay한다. 식 (4)의 $\mathcal L_{\mathrm{act}}$가 다음 action과 최종 답을 지도하며, $O_t$에서 이후 action과 답으로 가는 gradient가 observer도 업데이트한다. 다만 선택 동작 자체는 discrete이므로 현재 action을 거슬러 미분하지 않는다.
5. 식 (5)의 $\mathcal L_{\mathrm{obs}}$는 latent observation에서 teacher의 텍스트 관찰을 복원한다. 식 (6)의 $\mathcal L_{\mathrm{align}}$는 같은 질문·action·다음 CoT prefix에서 textual context와 latent context가 frozen CoT student에 유도하는 다음-token 분포를 KL로 맞춘다.
6. 전체 손실은 $\mathcal L=\lambda_{\mathrm{act}}\mathcal L_{\mathrm{act}}+\lambda_{\mathrm{obs}}\mathcal L_{\mathrm{obs}}+\lambda_{\mathrm{align}}\mathcal L_{\mathrm{align}}$이며 실험에서는 세 가중치가 모두 1이다. 주 설정은 reasoning/observation block당 8 latent token, 최대 8회 획득이다.
7. 추론에서는 teacher action replay, 텍스트 관찰 복원, 분포 정렬을 모두 제거한다. reasoner가 스스로 도구를 고르고 observer의 latent output을 받아 다음 결정을 반복하며, 도구 호출과 최종 답만 텍스트로 드러난다.

# 핵심 그림

![질문과 비디오에서 latent reasoner가 프레임 획득 도구를 선택하고 latent observer의 압축 관찰을 받아 반복한 뒤 답하며, 학습 때만 세 가지 손실이 두 모듈을 공동 최적화하는 LARVA 구조](/papers/assets/vlm/joint-latent-reasoning-and-observation-for-agentic-video-understanding/larva-architecture.svg)

> 그림 1. 논문 Figure 2와 식 (1)–(7)을 바탕으로 재구성한 LARVA 학습·추론 파이프라인. 출처: [arXiv HTML Figure 2 및 Method](https://arxiv.org/html/2610.35229#S3), CC BY 4.0. 원본 그림을 복사하지 않고 한국어 설명도로 재구성했다.

전체 아키텍처 그림을 고른 이유는 이 논문의 차별점이 개별 video encoder가 아니라 **reasoner–observer 사이의 연속 interface와 joint gradient path**에 있기 때문이다. 입력 질문과 누적 context에서 reasoner가 8개 $Z_t$를 만든 뒤 명시적 도구 호출을 출력하고, 선택된 비디오 구간은 observer가 8개 $O_t$로 압축한다. $O_t$와 이전 $Z_t$가 다음 라운드에 남아 `획득 → 관찰 → 다음 획득 또는 답`의 폐루프를 이룬다.

학습에서는 teacher action을 고정해 선택 프레임을 공급한다. $\mathcal L_{\mathrm{act}}$는 미래 action과 답에 필요한 정보를 $O_t$에 심고, $\mathcal L_{\mathrm{obs}}$는 관찰 내용을 보존하며, $\mathcal L_{\mathrm{align}}$는 latent context가 textual teacher context와 비슷한 다음 추론 분포를 만들게 한다. 추론에서는 세 auxiliary branch와 textual CoT/caption이 사라지고, tool call과 최종 답만 해석 가능한 텍스트로 남는다.

# Experiments / Results

- 학습 데이터는 VideoMarathon, VideoHolmes train, LongVideo-Reason에서 만든 20,000개 trajectory다. backbone은 Qwen2.5-VL-7B와 Qwen3-VL-4B이며, 다섯 video QA benchmark에서 accuracy를 비교한다.
- Table 1의 동일 backbone·동일 teacher trajectory 통제에서 LARVA는 CoT Policy를 7B 평균 +2.6%p, 4B 평균 +2.8%p 앞선다. 7B의 VideoHolmes에서는 39.2%에서 44.3%로 +5.1%p다.
- Table 2에서 latent reasoner와 observer를 따로 학습하면 Video-MME가 55.2%지만 joint training은 62.4%로 +7.2%p다. latent observation 자체보다 송신자와 수신자를 함께 적응시키는 것이 핵심이라는 근거다.
- Table 3의 같은 H200 측정에서 LARVA는 질문당 8.2초로 CoT Policy 48.3초보다 40.1초 짧고 5.9배 빠르다. 평균 획득 라운드는 4.8→3.2(-33.3%), 프레임은 112.5→75.9(-32.5%)다.
- Table 5의 동일 64+16 frame budget, 100문항 human evaluation에서 새 answer-relevant evidence를 얻는 비율은 full LARVA 35%, latent-reasoning/textual-observation 15%로 +20%p다. 이는 첫 추가 획득만 평가한 결과다.

## 주요 실험 결과

Table 1에서 같은 teacher trajectory로 학습한 CoT Policy와만 비교했다. 값은 benchmark accuracy이며 차이는 절대 %p이다. 서로 다른 backbone은 같은 행에서 섞지 않았다.

| Backbone / benchmark (accuracy %, ↑) | LARVA | CoT Policy |   차이 | 출처    |
| ------------------------------------ | ----: | ---------: | -----: | ------- |
| Qwen2.5-VL-7B / VideoHolmes          |  44.3 |       39.2 | +5.1%p | Table 1 |
| Qwen2.5-VL-7B / Video-MME            |  62.4 |       59.9 | +2.5%p | Table 1 |
| Qwen2.5-VL-7B / LVBench              |  45.0 |       41.3 | +3.7%p | Table 1 |
| Qwen2.5-VL-7B / LongVideoBench       |  58.1 |       56.8 | +1.3%p | Table 1 |
| Qwen2.5-VL-7B / MLVU                 |  68.8 |       68.4 | +0.4%p | Table 1 |
| Qwen3-VL-4B / VideoHolmes            |  48.2 |       42.7 | +5.5%p | Table 1 |
| Qwen3-VL-4B / Video-MME              |  62.1 |       60.2 | +1.9%p | Table 1 |
| Qwen3-VL-4B / LVBench                |  41.3 |       39.1 | +2.2%p | Table 1 |
| Qwen3-VL-4B / LongVideoBench         |  57.4 |       55.0 | +2.4%p | Table 1 |
| Qwen3-VL-4B / MLVU                   |  66.7 |       64.9 | +1.8%p | Table 1 |

모든 통제 비교가 양수라는 점은 latent interface가 특정 benchmark 하나에만 맞은 결과가 아님을 보여준다. 다만 MLVU의 +0.4%p처럼 작은 차이도 있고 분산·유의성은 Table 1에 제시되지 않아, 10개 셀의 일관성과 평균 이득을 중심으로 읽는 편이 안전하다.

# Limitations / Discussion

- sampled visual frame만 처리하며 audio를 쓰지 않는다. 대화·환경음이 답의 핵심인 audiovisual 질문에는 직접 적용할 수 없다.
- teacher-generated trajectory와 frozen CoT student에 의존한다. teacher의 잘못된 탐색을 상속할 수 있고, teacher action replay는 student가 잘못 탐색한 뒤 만나는 state를 충분히 다루지 못한다.
- latent state는 caption이나 CoT보다 해석하기 어렵다. 실패 원인이 시각 압축, 추론, 프레임 선택 중 어디인지 분리하기 쉽지 않다.
- 8개 observation token으로의 압축은 fine-grained detail을 버릴 수 있다. token sweep은 8개까지 좋아지지만, 더 긴 표현과의 정확도–비용 trade-off는 제한적으로만 탐색했다.
- human evidence 평가는 100문항의 첫 추가 acquisition만 본다. 전체 trajectory에서 필요한 근거를 빠짐없이 수집하는지는 직접 측정하지 않는다.
- 코드는 공개 예정 상태다. 현시점에는 구현과 20,000개 teacher trajectory를 독립 재현하기 어렵고, venue도 확인 필요다.

# 내가 이해한 핵심

이 논문의 핵심은 “텍스트를 latent로 압축하면 빠르다”보다 더 구체적이다. 관찰을 보내는 observer와 그 관찰로 다음 행동을 정하는 reasoner는 하나의 통신 시스템이다. 송신자만 teacher caption에 맞추고 수신자를 고정하면 두 모델의 interface가 어긋나며 실제로 성능이 떨어진다. 미래 행동과 최종 답의 gradient가 observer까지 도달하도록 둘을 함께 학습해야 latent token이 **보이는 것의 요약**이 아니라 **다음 결정을 위한 충분통계**에 가까워진다.

그래서 Table 2가 Table 1만큼 중요하다. latent/latent를 따로 학습하면 textual baseline보다 낮지만 joint training을 켜면 가장 강한 구성이 된다. 효율은 representation 형식에서 나오고, 정확도는 그 표현을 실제 의사결정 목표에 맞춰 공동 적응시킨 데서 나온다.

# 다음에 연결해서 읽을 논문

- [VideoSeek: Long-Horizon Video Agent with Tool-Guided Seeking](https://arxiv.org/search/?query=VideoSeek%3A+Long-Horizon+Video+Agent+with+Tool-Guided+Seeking&searchtype=title) — LARVA가 통제 실험에 사용하는 `Overview/Skim/Focus` 획득 도구의 출발점.
- [Training Large Language Models to Reason in a Continuous Latent Space](https://arxiv.org/abs/2412.06769) — textual CoT를 연속 hidden state로 바꾸는 latent reasoning의 대표 선행 연구.
- [VideoEvolve: Co-Evolving Memory and Retrieval for Long Video Understanding](/papers/vlm/videoevolve-co-evolving-memory-and-retrieval-for-long-video-understanding) — 장시간 비디오에서 검색과 memory를 함께 개선하는 다른 폐루프 접근.
- [The Answer Knows Where to Look: Zooming before MLLMs Answer under Visual-Token Budgets](/papers/vlm/the-answer-knows-where-to-look-zooming-before-mllms-answer) — 답변 전에 근거 위치와 view action을 고르는 이미지 기반의 대응 사례.
