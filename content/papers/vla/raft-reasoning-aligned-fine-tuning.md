---
title: "RAFT: Reasoning-Aligned Fine-Tuning Improves Robustness of VLA Post-Training"
date: 2026-11-04
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Shresth Grover, Andrey Kolobov, Dhruv Shah"
paper: "https://arxiv.org/abs/2611.04368"
code: "https://github.com/princeton-prism/RAFT"
project: "https://princeton-prism.github.io/RAFT"
thumbnail: "/papers/assets/vla/raft-reasoning-aligned-fine-tuning/overview.svg"
---

# 한 줄 요약

RAFT는 소량 task 시연으로 VLA를 바로 fine-tune하기 전에 task-relevant reasoning LoRA를 먼저 학습·동결해, action 적응 중 grounding이 사라지는 것을 막고 실로봇 OOD 성공률을 크게 높인다.

# 논문 정보

- 제목: RAFT: Reasoning-Aligned Fine-Tuning Improves Robustness of VLA Post-Training
- 저자: Shresth Grover, Andrey Kolobov, Dhruv Shah
- 발표: 확인 필요 (arXiv v1, 2026-11-03)
- 링크: [arXiv](https://arxiv.org/abs/2611.04368) · [HTML](https://arxiv.org/html/2611.04368)
- 코드/프로젝트: [GitHub](https://github.com/princeton-prism/RAFT) · [프로젝트](https://princeton-prism.github.io/RAFT)
- 키워드: VLA post-training, reasoning supervision, LoRA, OOD robustness, task grounding

# 핵심 아이디어

좁은 demonstration으로 바로 action fine-tuning하면 nominal success는 오르지만 pretrained VLM의 object·spatial grounding이 훼손될 수 있다. RAFT는 이를 두 단계로 분리한다. Stage I에서 VLM annotator가 만든 object box, keypoint, trace, spatial description, VQA target으로 vision/language LoRA만 학습한다. Stage II에서는 이 adapter를 동결하고 language model·action expert·projection만 action demonstration으로 학습한다.

# VLA 관점에서 중요한 이유

“reasoning data를 action과 함께 많이 넣자”가 아니라 **reasoning으로 먼저 표현을 정렬한 뒤 action gradient로부터 보호하자**는 training schedule을 검증한다. 실제로 co-training은 simulated pick-and-place 평균 63.2%로 Plain FT 79.6%보다 나쁘고, Stage II에서 adapter를 계속 업데이트해도 74.0%로 떨어진다. 반면 동결된 RAFT는 DROID OOD 27.9%→75.0%(+47.1%p), YAM 전체 sequence 35.0%→70.0%(+35.0%p)를 보인다.

# Robot / Embodied Setting

simulation은 MolmoSpaces의 pick-and-place와 open-drawer에서 task별 106 demonstrations를 쓰고 ID, lighting, texture, novel object, prompt shift를 평가한다. 실로봇 DROID는 MolmoBot을 50 demonstrations에 적응해 color·distractor·background shift를 본다. bimanual YAM은 $\pi_{0.5}$를 100 demonstrations로 box 열기→object 집기→box 안에 넣기의 장기 sequence에 적응하고 clutter·box pose·object color·background shift를 평가한다.

# Method

1. 좁은 target dataset $\mathcal D_\eta=(s,a,T)$의 observation과 instruction을 Gemini 3.1 Pro에 넣어 task-relevant reasoning target $r$을 만든다.
2. Stage I은 pretrained parameter를 고정하고 vision encoder와 language model의 LoRA $\phi$만 autoregressive reasoning loss $\mathcal L_{reason}$로 1,000 steps 학습한다.
3. Stage II는 학습된 $\phi^*$와 SigLIP을 동결한다. language model, action expert, projection $\theta$를 action imitation loss $\mathcal L_{BC}$로 5,000 steps 업데이트한다.
4. 추론에는 별도 reasoning generation이 필요하지 않다. 동결된 adapter가 observation representation을 task-relevant 방향으로 변형하고 action policy $\pi_{\theta^*,\phi^*}$가 바로 action을 낸다.
5. object identity·episode progress linear probe와 annotated-region attention enrichment로 Stage I의 grounding이 Stage II 뒤에도 보존되는지 분석한다.

# 핵심 그림

![RAFT의 reasoning alignment와 action adaptation을 분리한 2단계 학습 구조](/papers/assets/vla/raft-reasoning-aligned-fine-tuning/overview.svg)

> 논문 Figure 2와 Equations (1)–(2)를 바탕으로 재구성한 RAFT 아키텍처. 출처: [논문 HTML Figure 2 및 Method](https://arxiv.org/html/2611.04368#S3). 원본을 복제하지 않고 parameter update와 gradient 차단을 중심으로 한국어 도식화했다.
>
> 구조 그림을 고른 이유는 RAFT의 novelty가 새로운 inference module보다 **두 단계에서 어느 parameter를 업데이트·동결하는가**에 있기 때문이다. Stage I에서는 reasoning annotation이 LoRA에만 들어가 grounding을 만들고, Stage II에서는 adapter로 향하는 action gradient를 차단한 채 action path를 적응시킨다. 추론에서는 reasoning text를 생성하지 않고 image·instruction이 정렬된 representation을 거쳐 action expert로 바로 흐른다.

# Experiments / Results

## 주요 실험 결과

| 설정 / 지표 (success rate %, ↑)        | RAFT |     비교 기준 |    차이 | 출처                |
| -------------------------------------- | ---: | ------------: | ------: | ------------------- |
| DROID OOD 3축 평균                     | 75.0 | Plain FT 27.9 | +47.1%p | Figure 6            |
| DROID novel object color               |   83 |   Plain FT 33 |   +50%p | Figure 6 / Sec. 4.2 |
| YAM 5축 pooled full-sequence           | 70.0 | Plain FT 35.0 | +35.0%p | Figure 6            |
| YAM 5축 pooled full-sequence           | 70.0 |   DeLock 36.0 | +34.0%p | Figure 6            |
| Simulation pick-and-place 5-split 평균 | 83.2 | Plain FT 79.6 |  +3.6%p | Figure 12           |
| Simulation open-drawer ID              |   44 |   Plain FT 29 |   +15%p | Figure 5            |

DROID ID에서는 RAFT 63%, Plain FT 60%로 차이가 작지만 shift에서 격차가 커진다. simulated pick-and-place의 novel object는 43% 대 36%(+7%p), open-drawer texture shift는 28% 대 15%(+13%p)다. 같은 5개 split에서 co-training은 63.21%, Stage II adapter trainable은 73.96%로 동결 RAFT 83.21%에 못 미친다. late layer object-identity probe도 RAFT 0.51–0.53, Plain FT 0.45이며 layer 11 task-region attention enrichment는 3.2–3.4× 대 1.9–2.1×다.

# Limitations / Discussion

공식 venue는 확인되지 않았다. reasoning label이 Gemini 3.1 Pro에 의존해 annotation 비용·재현성과 annotator bias가 남는다. task마다 최적 supervision modality가 달라 자동 선택이 아직 open problem이며, 25 demonstrations에서는 RAFT와 Plain FT가 모두 46.2%로 같아 극저데이터 구간의 이득도 제한적이다. simulation 두 task와 실로봇 두 platform에 집중했고 safety·catastrophic failure·더 다양한 embodiment는 검증하지 않았다. Stage II에서 backbone 일부를 계속 fine-tune하므로 broader pretrained capability 보존을 직접 측정한 결과도 더 필요하다.

# 내가 이해한 핵심

RAFT는 reasoning을 실행 시 chain-of-thought로 쓰기보다 **fine-tuning 전에 representation의 좌표축을 정리하는 학습 신호**로 쓴다. action dataset이 좁더라도 어느 object·관계·진행 상태를 보아야 하는지가 adapter에 남고, 이를 동결해야 action loss가 그 정보를 다시 지우지 않는다.

# 다음에 연결해서 읽을 논문

- [RETAIN](https://arxiv.org/abs/2502.19645): pretrained/finetuned weight merging 기반 VLA 적응
- [Breaking Lock-In / DeLock](https://arxiv.org/abs/2604.23121): visual representation drift를 제한하는 비교 방법
- [Embodied Chain-of-Thought](https://arxiv.org/abs/2407.08693): reasoning supervision을 action generation과 연결하는 선행 연구
- [$\pi_{0.5}$](https://arxiv.org/abs/2504.16054): YAM 실험에서 RAFT가 적응한 backbone
