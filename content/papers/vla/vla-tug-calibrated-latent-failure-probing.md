---
title: "VLA-Tug: Failure Prediction and Classification via Calibrated Latent Probing"
date: 2026-11-08
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Michal P. Podolinsky, Yunhao Yang, Daniel Little, Hong Lu, Rohan Siva, Olin Goudey, Neel P. Bhatt, Matthias Scheutz, Ufuk Topcu"
paper: "https://arxiv.org/abs/2611.08425"
code: "https://vla-tug.github.io/"
project: "https://vla-tug.github.io/"
thumbnail: "/papers/assets/vla/vla-tug-calibrated-latent-failure-probing/overview.svg"
---

# 한 줄 요약

VLA-Tug는 frozen VLA의 중간 embedding을 recurrent probe로 읽어 실패를 onset 전에 경보하고 유형까지 분류하며, conformal calibration으로 false alarm과 missed detection을 함께 제어한다.

# 논문 정보

- 제목: Failure Prediction and Classification in Vision-Language-Action Models Via Calibrated Latent Probing
- 저자: Michal P. Podolinsky, Yunhao Yang, Daniel Little, Hong Lu, Rohan Siva, Olin Goudey, Neel P. Bhatt, Matthias Scheutz, Ufuk Topcu
- 발표: 확인 필요 (arXiv v1, 2026-11-05)
- 링크: [arXiv](https://arxiv.org/abs/2611.08425) · [HTML](https://arxiv.org/html/2611.08425)
- 코드/프로젝트: [공식 프로젝트·코드·데이터](https://vla-tug.github.io/)
- 키워드: VLA failure detection, latent probing, conformal calibration, failure mode, runtime monitoring

# 핵심 아이디어

성공/실패 rollout 전체에 하나의 label을 붙이면 detector가 실패 이후의 명백한 상태만 학습하기 쉽다. VLA-Tug는 사람이 표시한 failure onset 이전 구간도 failure-positive로 감독해 조기 징후를 학습한다. frozen VLA layer embedding을 recurrent encoder가 latent failure space로 압축하고, score head는 경보 확률을, mode head는 실패 유형을 낸다. max-conformal calibrator는 episode-level false-positive와 early true-positive 조건을 함께 만족하도록 trigger를 정한다.

# VLA 관점에서 중요한 이유

VLA 자체를 다시 학습하지 않고 내부 representation에서 배포 위험을 읽어내며, 단순 stop signal이 아니라 `grasp_failure`, `wrong_target`, `object_displacement` 같은 mode를 제공해 steering 정책과 연결한다. 3,180개 annotated episode를 공개하고 LIBERO, LIBERO-X, GR00T, 실제 robot에서 unseen-task generalization을 평가했다. LIBERO-X new-skill의 unseen early-detection AUC는 39.0으로 strongest listed baseline 30.1보다 +8.9%p 높고, probe latency는 GPU 0.12 ms/step이다.

# Robot / Embodied Setting

LIBERO-10은 10 task 중 3개를 unseen으로 남기는 split, LIBERO-X는 new-task(175/43 seen/unseen), new-signature(162/56), new-skill(159–209/9–59) split을 쓴다. 실제 평가는 drawer, basket, stove, mushroom, tomato, block, eggplant, pineapple의 8개 task와 510 demonstrations로 fine-tune한 policy를 사용하며 leave-one-task-out으로 평가한다. 전체 dataset은 3,180 annotated manipulation episodes이고, 각 실패 rollout에는 failure onset과 mode가 붙는다.

# Method

1. frozen VLA backbone의 매 timestep embedding을 추출해 recurrent encoder(LSTM)에 넣고 시간 정보를 유지한 latent failure state를 만든다.
2. score head는 failure score를, mode head는 실패 유형 분포를 예측한다. CLIP-derived semantic feature를 mode prediction에 결합한 변형도 사용한다.
3. `onset_pre` supervision은 실제 실패 onset 전 구간을 positive로, onset 이후 구간을 loss에서 제외해 “이미 실패한 뒤 탐지”하는 shortcut을 줄인다.
4. 별도 calibration split에서 max-conformal threshold를 정해 target false-positive rate와 early true-positive rate의 episode-level 조건을 동시에 다룬다.
5. runtime에는 threshold를 넘는 첫 timestep에 alarm과 mode를 내고, robot을 정지시키거나 expert steering을 호출한다. VLA action policy의 weight는 그대로 유지한다.

# 핵심 그림

![VLA-Tug의 frozen VLA embedding, recurrent probe, conformal trigger와 failure-mode steering 구조](/papers/assets/vla/vla-tug-calibrated-latent-failure-probing/overview.svg)

> 논문 Figure 1, Figure 2와 Sections 3–4를 바탕으로 재구성한 VLA-Tug runtime monitor. 출처: [논문 HTML Figure 1](https://arxiv.org/html/2611.08425#S1.F1). 원본 그림을 복제하지 않고 학습 label, probe head, calibration, 배포 trigger 흐름을 한국어로 정리했다.
>
> 구조 그림을 고른 이유는 VLA-Tug의 핵심이 새 action policy가 아니라 **frozen policy 옆에 붙는 calibrated monitor**라는 점을 보여주기 위해서다. 학습 때는 embedding sequence와 onset/mode annotation으로 recurrent probe를 맞추고 calibration split에서 threshold를 정한다. 추론 때는 관측 → frozen VLA embedding → failure score/mode → calibrated alarm → stop 또는 steering으로 이어지며 action 생성 자체는 원래 VLA가 담당한다.

# Experiments / Results

## 주요 실험 결과

| 평가 설정 / 지표 (↑, 비용은 ↓)                    | VLA-Tug |       비교 기준 |      차이 | 출처    |
| ------------------------------------------------- | ------: | --------------: | --------: | ------- |
| LIBERO-10 $\pi_0$ unseen early-detection AUC (%)  |    47.9 |   SAFE-MLP 39.9 |    +8.0%p | Table 3 |
| LIBERO-X new-signature unseen AUC (%)             |    47.0 |   SAFE-MLP 46.2 |    +0.8%p | Table 3 |
| LIBERO-X new-skill unseen AUC (%)                 |    39.0 |  SAFE-LSTM 30.1 |    +8.9%p | Table 3 |
| Real robot unseen AUC (%)                         |    25.8 |  SAFE-LSTM 25.1 |    +0.7%p | Table 3 |
| LIBERO-X probe latency (GPU ms/step, ↓)           |    0.12 | SAFE-LSTM 0.066 | +0.054 ms | Table 3 |
| Unseen real-robot failure-mode top-3 accuracy (%) |    70.4 |   majority 32.6 |   +37.8%p | Table 7 |

early-detection AUC는 failure onset까지 탐지한 비율(TPR-early)과 false-positive rate 곡선의 면적이다. VLA-Tug가 모든 split에서 최고는 아니다. 예를 들어 LIBERO-X new-task unseen은 40.2로 SAFE-MLP 42.3보다 -2.1%p이고, GR00T LIBERO-10 unseen은 47.4로 SAFE-LSTM 51.2보다 -3.8%p다. 장점은 여러 unseen split에서 경쟁력 있는 조기 탐지와 mode 분류, 0.12 ms GPU overhead를 함께 제공하는 데 있다.

# Limitations / Discussion

공식 top-conference 채택은 확인되지 않았다. failure onset과 mode annotation이 필요하고, annotator 정의가 달라지면 calibration과 mode boundary도 바뀔 수 있다. conformal guarantee는 calibration과 deployment data의 exchangeability에 기대므로 큰 distribution shift에서는 약해질 수 있다. 실제 robot unseen early-detection AUC 25.8은 절대적으로 낮고, 모든 benchmark에서 strongest detector를 이기지도 않는다. mode-aware steering은 예시와 lightweight intervention 결과를 제시하지만 복잡한 recovery policy 전체를 해결하는 것은 아니다.

# 내가 이해한 핵심

VLA-Tug의 포인트는 실패 이미지를 분류하는 것이 아니라, policy 내부의 시간적 representation이 흔들리는 시점을 onset 전에 포착하고 그 경보의 오탐률을 calibration으로 관리하는 것이다. mode head는 경보를 “멈춰라”에서 “왜 멈춰야 하는가”로 바꿔 후속 controller가 어떤 correction을 적용할지 선택하게 한다.

# 다음에 연결해서 읽을 논문

- [SAFE](https://arxiv.org/abs/2506.09937): conformal failure detection의 주요 learned baseline
- [FailureSpot](https://arxiv.org/abs/2605.02850): trajectory failure localization 비교군
- [VLA-Pilot](https://arxiv.org/abs/2602.02601): VLA runtime steering과 monitor 연결 관점
- [Backtrack](https://arxiv.org/abs/2610.32941): frozen VLA에 lightweight recovery를 붙이는 보완적 접근
