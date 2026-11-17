---
title: "ScaleVLA: Scaling Vision-Language-Action Models to 552 Billion Parameters"
date: 2026-11-17
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Ruixi Yu, Dairu Liu, Xuchuan Chen, Zekun Qi, Zekai Li, Zhuo Cao, Luyang Niu, Yingsheng Zhang, Sikai Liang, Ke Fan, He Wang, Li Yi"
paper: "https://arxiv.org/abs/2611.21607"
code: ""
project: "https://galaxygeneralrobotics.github.io/scalevla/"
thumbnail: "/papers/assets/vla/scalevla-frontier-backbone-scaling/architecture.png"
---

# 한 줄 요약

ScaleVLA는 552B sparse MoE VLM의 causal-encoder 특징을 동결해 4-step flow-matching Action DiT에 연결함으로써, 같은 행동 헤드·데이터 조건에서 큰 사전학습 백본이 저데이터 학습, OOD 일반화, 접촉 정밀 조작을 실제로 개선하는지 검증한다.

# 논문 정보

- 제목: ScaleVLA: Scaling Vision-Language-Action Models to 552 Billion Parameters
- 저자: Ruixi Yu, Dairu Liu, Xuchuan Chen, Zekun Qi, Zekai Li, Zhuo Cao, Luyang Niu, Yingsheng Zhang, Sikai Liang, Ke Fan, He Wang, Li Yi
- 발표: 확인 필요 (Tech Report, arXiv v1, 2026-11-16)
- 링크: [arXiv](https://arxiv.org/abs/2611.21607) · [HTML](https://arxiv.org/html/2611.21607v1)
- 코드/프로젝트: [프로젝트 페이지](https://galaxygeneralrobotics.github.io/scalevla/)
- 키워드: VLA scaling, frontier VLM, mixture of experts, flow matching, action DiT, sample efficiency, LIBERO-PRO, contact-rich manipulation

# 핵심 아이디어

로봇 정책의 나머지 조건을 가능한 한 고정하고 VLM 백본만 2B, 8B, 32B, 552B로 바꾼다. 가장 큰 모델은 DeepSeek-V4.1-Flash-1017의 552B sparse MoE이며, 전체 언어 decoder를 돌리지 않고 20-layer causal encoder의 출력 특징만 한 번 읽는다. 동결 VLM에서 나온 visual/text token과 robot state를 무작위 초기화한 Action DiT가 받아 연속 action chunk를 생성한다. 이 설계는 "텍스트 reasoning을 여러 번 호출해서 좋아진 것"과 "큰 사전학습 표현 자체가 행동 학습에 유리한 것"을 분리하려는 통제 실험이다.

# VLA 관점에서 중요한 이유

VLA 연구는 흔히 action representation, 데이터 규모, 후학습 방법이 동시에 바뀌어 backbone scaling 효과를 해석하기 어렵다. 이 논문은 동일 Action DiT, 초기화, robot demonstration, 학습 budget을 유지해 큰 VLM 표현의 효과를 직접 비교한다. 552B는 2B보다 276배 크지만 sparse expert 활성화, decoder 생략, chunk당 feature 재사용 덕분에 RoboCasa 지연은 115ms에서 216ms로 1.9배만 증가했다. 다만 4×H200이라는 시스템 비용까지 포함해 "효율적"이라고 일반화해서는 안 된다.

# Robot / Embodied Setting

시뮬레이션은 single-arm language-conditioned LIBERO와 LIBERO-PRO, Panda gripper의 RoboCasa, dual-hand DexJoCo를 사용한다. 저데이터 평가는 LIBERO Goal/Long의 task당 5·10·25·50 demonstrations를 같은 nested subset과 5,000 optimizer steps로 비교한다. 실세계 평가는 top camera와 두 wrist camera를 쓰는 bimanual charger insertion이며, 오른팔 grasp/hand-over 뒤 왼팔이 socket 정렬·삽입·release를 수행한다. 각 정책은 in-domain 10회, charger/power-strip 위치를 바꾼 OOD 15회로 평가된다.

# Method

1. **동결 frontier VLM:** image encoder와 DeepSeek-V4.1-Flash의 20-layer causal encoder가 이미지와 지시를 token sequence로 만든다. 20-layer decoder는 실행하지 않고, 다음 layer attention에 공급될 5,120차원 특징을 읽는다.
2. **행동 조건 형성:** feature adapter가 backbone token을 action-head width로 투영하고, state encoder가 proprioception과 embodiment 정보를 표현한다. image/non-image token의 순서와 modality label을 보존한다.
3. **Flow-matching Action DiT:** GR00T N1.7 계열 action head가 cross-attention과 self-attention을 번갈아 적용한다. backbone은 고정하고 adapter, state/action encoder, DiT, decoder만 demonstration으로 학습한다.
4. **추론:** Gaussian noise에서 시작해 예측 velocity를 네 번 적분하여 action chunk를 만든다. 네 flow step이 같은 VLM 특징을 재사용하므로 backbone forward는 chunk당 한 번이다. LIBERO에서는 16-step chunk 중 8개 command를 실행하고 재계획한다.
5. **학습과 추론의 차이:** 학습 때는 동결 backbone 특징을 미리 계산해 재사용하고 action head만 업데이트한다. 배포 때는 현재 observation마다 backbone을 한 번 실행하고 네 번의 flow step으로 새 chunk를 만든다.

# 핵심 그림

![카메라 이미지와 언어 지시를 동결 552B VLM encoder가 특징으로 만들고, robot state와 함께 Action DiT의 cross-attention과 self-attention을 거쳐 네 번의 flow step으로 연속 action chunk를 생성하는 ScaleVLA 구조](/papers/assets/vla/scalevla-frontier-backbone-scaling/architecture.png)

> Figure 2 원본. 출처: [arXiv HTML Figure 2](https://arxiv.org/html/2611.21607v1#S3.F2), CC BY 4.0. 캡션: ScaleVLA의 동결 VLM encoder와 학습 가능한 flow-matching action head 연결.
>
> 결과 요약 Figure 1 대신 이 그림을 고른 이유는 backbone scaling 효과를 해석하려면 어떤 계산이 동결되고 어떤 모듈이 robot demonstration으로 학습되는지 먼저 분리해야 하기 때문이다. 입력은 camera images, language instruction, robot state이고, VLM의 causal encoder 특징이 adapter를 통해 Action DiT의 cross-attention에 들어간다. self-attention은 noisy action token끼리의 시간 관계를 처리하고 action decoder가 연속 chunk를 낸다. 기존 반복 reasoning형 frontier-model control과 달리 decoder를 생략하고 chunk당 한 번만 VLM을 읽는 것이 핵심이다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 성공률 (%, ↑)                    | ScaleVLA 552B |                                      비교 기준 |    차이 | 출처          |
| -------------------------------------------- | ------------: | ---------------------------------------------: | ------: | ------------- |
| LIBERO 4-suite 평균, full demonstrations     |          96.1 |                        Cosmos-Reason2-32B 94.0 |  +2.1%p | Table 2       |
| LIBERO-PRO 3 perturbations 평균, 재학습 없음 |          45.1 | 최상위 smaller backbone Cosmos-Reason2-8B 31.3 | +13.8%p | Table 3       |
| LIBERO Goal, task당 5 demonstrations         |          77.4 |                               2B backbone 39.4 | +38.0%p | Table 7, §4.4 |
| 실제 charger insertion, in-domain 10 trials  |   90.0 (9/10) |                  Cosmos-Reason2-2B 40.0 (4/10) | +50.0%p | Table 8       |
| 실제 charger insertion, OOD 15 trials        |   53.3 (8/15) |                  Cosmos-Reason2-2B 33.3 (5/15) | +20.0%p | Table 8       |

LIBERO-PRO에서 작은 백본의 최고 평균은 31.3%이고 ScaleVLA는 45.1%다. 단, 세부 Object-Env perturbation에서는 Cosmos-Reason2-32B 32.4%가 ScaleVLA 31.2%보다 높아 모든 OOD 축에서 일관되게 우세한 것은 아니다. 실로봇에서는 같은 Action DiT와 학습 데이터 조건에서 2B 대비 삽입 성공이 4/10에서 9/10으로 늘었고, 성공한 in-domain trial의 median insertion time도 85.9초에서 58.1초로 줄었다. $\pi_{0.5}$+동일 action head와 비교하면 in-domain은 8/10→9/10(+10.0%p), OOD는 7/15→8/15(+6.7%p)다.

# Limitations / Discussion

552B 정책은 네 대의 H200에 tensor/expert parallelism을 사용한 반면 작은 백본은 한 GPU를 쓴다. 따라서 latency만으로 비용·에너지·배포 가능성을 비교할 수 없다. backbone 계열도 Qwen3-VL, Cosmos-Reason2, DeepSeek 한정이라 parameter count와 pretraining corpus·architecture·MoE 효과가 완전히 분리되지 않는다. LIBERO의 일부 suite는 포화에 가깝고 LIBERO-PRO 절대 성공률 45.1%는 여전히 낮다. 실제 평가는 한 bimanual charger task와 총 25 trials에 한정되며, 384ms round-trip latency와 asynchronous chunk execution이 동적 환경이나 안전한 접촉에서 충분한지 확인되지 않았다. 논문은 Tech Report이며 top conference 게재는 확인되지 않았다.

# 내가 이해한 핵심

이 논문의 가장 강한 결론은 "552B면 무엇이든 해결한다"가 아니라, **robot data와 action head를 고정해도 큰 web-pretrained 표현이 적은 시연과 contact-sensitive OOD에 실질적인 이득을 준다**는 것이다. 동시에 그 이득은 dense scaling law라기보다 sparse MoE, encoder-only readout, chunk reuse라는 시스템 공동 설계 위에서 성립한다. 앞으로는 성공률뿐 아니라 active parameters, memory traffic, GPU-hours, closed-loop control frequency를 함께 보고 backbone scaling을 평가해야 한다.

# 다음에 연결해서 읽을 논문

- [GR00T N1.7](https://arxiv.org/abs/2609.14625): ScaleVLA가 채택한 action-head 계열과 sparse VLM readout의 기반
- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): 대규모 robot pretraining을 거친 작은 backbone과 frontier web-pretrained backbone의 대비
- [LIBERO-PRO](https://arxiv.org/abs/2510.03827): scene/object perturbation에서 VLA 일반화를 분해하는 평가 기준
- [Training Reasoning Models in Simulation to Natively Use Real Robots](/papers/vla/pear-robot-use-reinforcement-learning): frontier reasoning model을 pose-level agent로 직접 후학습하는 다른 경로
