---
title: "BiCAT: Bimanual Coordination Action Tokenization"
date: 2026-11-19
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Xuanwei Liu, Guipu Cao, Zhongyi Luo, Jiafei Duan"
paper: "https://arxiv.org/abs/2611.23499"
code: "https://github.com/MAGICLAB-NUS/BiCAT"
project: "https://magiclab-nus.github.io/BiCAT/"
thumbnail: "/papers/assets/vla/bicat-bimanual-coordination-action-tokenization/architecture.png"
---

# 한 줄 요약

BiCAT은 양팔 action chunk를 하나의 벡터로 뭉개지 않고, 좌우 팔이 공유하는 움직임 표현과 상대 팔의 문맥을 action tokenizer 안에서 함께 학습해 양팔 VLA의 조정 능력을 높인다.

# 논문 정보

- 제목: BiCAT: Bimanual Coordination Action Tokenization
- 저자: Xuanwei Liu, Guipu Cao, Zhongyi Luo, Jiafei Duan
- 발표: 확인 필요 (arXiv v1, 2026-11-17)
- 링크: [arXiv](https://arxiv.org/abs/2611.23499) · [HTML](https://arxiv.org/html/2611.23499v1)
- 코드/프로젝트: [GitHub](https://github.com/MAGICLAB-NUS/BiCAT) · [프로젝트 페이지](https://magiclab-nus.github.io/BiCAT/)
- 키워드: bimanual manipulation, action tokenization, cross-arm attention, FSQ, semi-autoregressive VLA

# 핵심 아이디어

기존 discrete-action VLA는 두 팔의 관절을 연결한 하나의 벡터를 토큰화하거나, 각 팔을 따로 토큰화해 상호작용을 policy가 암묵적으로 배워야 했다. BiCAT은 먼저 우측 팔의 부호를 embodiment별로 뒤집어 좌우의 대응 관절을 같은 canonical motion space에 맞춘다. 두 팔은 encoder와 FSQ vocabulary를 공유하지만, symmetric causal cross-attention을 거쳐 상대 팔의 과거·현재 문맥을 각자의 token stream에 반영한다. 마지막에는 같은 시간 위치의 좌우 code를 짝지어 joint decoder가 두 궤적을 함께 복원한다.

# VLA 관점에서 중요한 이유

이 논문은 양팔 협응을 더 큰 VLM이나 별도 planner가 아니라 **VLA와 로봇 사이의 action representation**에 넣는다. 좌우 팔의 동작 원형은 공유하면서 역할은 분리하고, 두 팔의 token block을 두 번의 decoding step으로 생성한다. 실험상 reconstruction MSE나 token accuracy보다 시각 입력 의존도, 재계획 간 일관성, chunk 경계의 부드러움이 closed-loop 성공과 더 강하게 연결돼, action tokenizer를 단순 압축기가 아니라 제어 inductive bias로 봐야 함을 보여준다.

# Robot / Embodied Setting

시뮬레이션은 RoboTwin 2.0의 50개 task, 2,500 demonstrations로 tokenizer와 PaliGemma 2-3B VLA를 학습한다. 평가는 사전에 고른 10개 task를 single-arm, loosely coupled, tightly coupled로 나누고 task당 100 rollouts를 수행한다. 실제 로봇은 Bimanual SO-101, Unitree G1 humanoid, Bimanual YAM의 세 embodiment와 여섯 task를 사용한다. task당 100 demonstrations(Pen은 105)로 Molmo2-ER 기반 VLA를 학습하고 각 방법을 task당 25회 평가한다.

# Method

1. **Canonicalization:** 우측 팔에 embodiment별 sign vector를 적용하고 좌우 대응 관절에서 공유한 범위로 정규화해, inward reach 같은 대칭 동작을 같은 좌표 표현으로 맞춘다.
2. **Shared causal encoder:** 32-step chunk를 두 단계 causal convolution으로 팔마다 8개 latent position으로 압축하고, encoder parameter를 좌우가 공유한다.
3. **Cross-arm coordination:** 좌→우와 우→좌에 같은 causal cross-attention block을 적용한다. 각 latent는 자기 팔의 residual path를 유지하면서 같은 시점까지 상대 팔의 문맥을 받는다.
4. **Shared FSQ:** 4차원 grid levels $(8,8,6,5)$로 팔당 8개 token을 만들며, 좌우가 1,920개 symbol vocabulary를 공유한다.
5. **Joint decoder:** 같은 시간의 좌우 quantized vector를 연결한 memory에서 32-step 양팔 action을 동시에 복원하고 reconstruction loss로 tokenizer를 학습한다.
6. **Semi-autoregressive VLA:** tokenizer를 고정한 뒤 VLM이 왼팔 8개 token을 병렬 생성하고, 그 block에 조건화해 오른팔 8개를 병렬 생성한다. 추론은 두 번의 sequential block prediction 뒤 joint decoder가 연속 action을 복원한다.

# 핵심 그림

![좌우 팔 action을 canonicalize한 뒤 공유 encoder, symmetric cross-arm attention, FSQ와 joint decoder를 거쳐 학습하고 VLM이 두 arm token block을 순차 생성하는 BiCAT 구조](/papers/assets/vla/bicat-bimanual-coordination-action-tokenization/architecture.png)

> Figure 2 원본. 출처: [arXiv HTML Figure 2](https://arxiv.org/html/2611.23499v1#S3.F2), CC BY 4.0. 캡션: 좌우 대응 관절을 canonical motion space로 맞춘 뒤 shared encoder와 causal cross-attention으로 상대 팔 문맥을 주입하고, FSQ code를 joint decoder가 양팔 action으로 복원하는 tokenizer 학습 및 VLA 추론 흐름.
>
> 실제 로봇 montage보다 양팔 협응이 어디에 들어가는지 직접 보여주므로 이 그림을 골랐다. 학습에서는 좌우 action chunk가 canonicalization → shared temporal encoder → symmetric cross-attention → FSQ → joint reconstruction으로 흐른다. 추론에서는 관측·언어를 받은 VLM이 왼팔 block을 먼저, 오른팔 block을 그 결과에 조건화해 생성하고 frozen decoder가 실행 action을 낸다. 기존 joint tokenizer가 모든 관절을 한 token에 섞거나 per-arm tokenizer가 상대 팔을 보지 않는 것과 달리, BiCAT은 **공유 motion vocabulary와 명시적 partner context**를 동시에 유지한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (%, ↑ 또는 ms, ↓)                 |          BiCAT |                비교 기준 |      차이 | 출처    |
| -------------------------------------------------- | -------------: | -----------------------: | --------: | ------- |
| RoboTwin 2.0 10-task 평균 성공률                   |           69.3 |                 NAC 51.7 |   +17.6%p | Table 2 |
| RoboTwin tightly coupled, Pick Dual Bottles 성공률 |           44.0 |         ActionCodec 23.0 |   +21.0%p | Table 2 |
| RoboTwin tightly coupled, Place Dual Shoes 성공률  |           41.0 |          ActionCodec 6.0 |   +35.0%p | Table 2 |
| 실제 3 embodiment·6 task pooled 성공률             | 75.3 (113/150) | OAT-single 49.3 (74/150) |   +26.0%p | Table 5 |
| H200 action-chunk policy latency                   |        40.5 ms |      OAT-single 229.1 ms | -188.6 ms | Table 1 |

시뮬레이션 비교는 같은 data, PaliGemma backbone, observation, optimization 설정에서 tokenizer와 prediction schedule만 바꿨다. 실제 pooled 성공률은 논문이 제시한 성공 trial 수를 같은 150회 분모로 환산했다. BiCAT은 real SO-101 Block에서 25/25, G1 Bottle에서 24/25였지만 YAM Pen은 8/25로 task별 난도 차이가 크다. single-block ablation은 latency를 줄이는 대신 평균 성공률이 69.3%에서 51.1%로 18.2%p 하락해 두 번째 arm block의 조건화가 단순 계산 부담 이상임을 뒷받침한다.

# Limitations / Discussion

좌우 대응 관절을 맞추는 sign vector는 embodiment별로 수동 지정하며, 비대칭 morphology나 팔마다 자유도가 다른 플랫폼에는 그대로 적용하기 어렵다. 정책의 왼팔→오른팔 순서는 실험에서 우세했지만 역할이 반대인 task나 동적인 leader–follower 전환에는 고정 순서가 제약이 될 수 있다. RoboTwin 평가는 50개 학습 task 중 10개에서 수행됐고, 실제 평가는 세 플랫폼·여섯 task·task당 25회로 제한된다. 또한 continuous flow-based VLA와의 전체 시스템 비교가 아니라 autoregressive discrete tokenizers 사이의 통제 비교다. 공식 top-conference 게재는 확인되지 않았다.

# 내가 이해한 핵심

BiCAT의 핵심은 “두 팔을 하나로 볼 것인가, 둘로 볼 것인가”라는 이분법을 피한 데 있다. 움직임의 문법은 공유하고 token stream은 분리하되, token이 만들어질 때부터 상대 팔을 보게 한다. 따라서 협응은 VLM이 긴 sequence에서 우연히 발견해야 하는 패턴이 아니라 tokenizer가 보존해야 할 구조가 된다.

# 다음에 연결해서 읽을 논문

- [NAC](https://arxiv.org/search/?query=Neural+Action+Codec+for+Vision-Language-Action+Models&searchtype=title): 두 block action codec과 BiCAT의 강한 시뮬레이션 baseline
- [ActionCodec](https://arxiv.org/search/?query=ActionCodec+What+Makes+for+Good+Action+Tokenizers&searchtype=title): reconstruction 외 어떤 tokenizer 성질이 제어 성능과 연결되는지 분석
- [OAT](https://arxiv.org/search/?query=Ordered+Action+Tokenizer&searchtype=title): coarse-to-fine ordered action token과 token-wise/block-wise decoding 비교
- [RDT-1B](https://arxiv.org/abs/2410.07864): 양팔 조작을 위한 diffusion foundation model
