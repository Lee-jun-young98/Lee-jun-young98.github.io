---
title: "Self-Labeled Preference Transfer for Steerable Robot Manipulation"
date: 2026-10-30
paper_monitor: true
tags: ["paper-review", "VLA", "Robotics"]
venue: "확인 필요"
authors: "Kaiwen Hong et al."
paper: "https://arxiv.org/abs/2610.38000"
thumbnail: "/papers/assets/vla/self-labeled-preference-transfer-for-steerable-robot-manipulation/overview.svg"
---

# 한 줄 요약

선호가 라벨된 source task에서 행동과 선호 인식을 함께 학습한 뒤, frozen recognizer가 새 task의 무라벨 demonstration에 선호를 붙여 VLA의 task 적응과 실행 방식 제어를 동시에 보존한다.

# 논문 정보

- 제목: Self-Labeled Preference Transfer for Steerable Robot Manipulation
- 저자: Kaiwen Hong, Shaoting Peng, Xiangyu Zeng, Pengcheng Wang, Boyuan Tian, Haonan Chen, Yifan Zhu, Yixiao Wang, Katherine Driggs-Campbell
- 발표: 확인 필요 (arXiv v1, 2026-10-27)
- 링크: [arXiv](https://arxiv.org/abs/2610.38000) · [HTML](https://arxiv.org/html/2610.38000)
- 코드/프로젝트: 공개 링크 확인되지 않음
- 키워드: steerable VLA, execution preference, self-labeling, cross-task transfer, robot manipulation

# 핵심 아이디어

SPT는 task 목표가 아니라 **어떻게 실행할지**를 나타내는 선호 vocabulary(예: low/high grasp, center/corner placement)를 다른 task로 옮긴다. Stage A는 선호 라벨이 있는 source demonstration으로 하나의 vision-language backbone을 공유하는 action branch와 preference recognizer를 공동 학습한다. Stage B는 recognizer를 고정해 target demonstration의 실제 행동 스타일을 자동 라벨링하고, 그 라벨을 instruction에 붙여 action policy만 적응시킨다. 따라서 target에서 사람의 선호 라벨을 새로 만들지 않고도 task success를 회복하면서 선호 명령에 대한 반응을 유지한다.

# VLA 관점에서 중요한 이유

일반적인 VLA fine-tuning은 새 task 성공률은 높이지만, source에서 배운 “낮게 잡기” 같은 실행 제어를 지울 수 있다. SPT는 별도 reward model이나 online RL 없이 VLA 자체의 language head를 demonstration recognizer로 재사용해 이 손실을 막는다. 이는 goal instruction과 execution preference를 분리하고, **인식 가능한 행동 의미를 다시 action supervision으로 환류**하는 간단한 transfer recipe다.

# Robot / Embodied Setting

시뮬레이션은 RoboTwin 2.0의 pick-and-place에서 contact height, release height, obstacle clearance, grasp orientation, placement location의 다섯 이진 선호 축을 평가한다. StarVLA-$\alpha$는 세 개의 $224\times224$ RGB view와 instruction을 받아 50-step, 14차원 joint action chunk를 출력한다. 실로봇은 bowl pushing과 billiards로 task type까지 바꾸며, pick-and-place에서 배운 clearance와 air hockey에서 배운 strike style을 각각 전이한다.

# Method

1. Source trajectory $(o_t,s_t,a_t)$에 task instruction과 선호 $c$를 붙인다. action branch는 `Preference: grasp low` 같은 문구가 포함된 prompt로 action chunk를 회귀한다.
2. 같은 pretrained VLM backbone을 쓰는 recognition branch는 짧은 demonstration clip, end-effector state, 선호 질문을 입력받아 이진 answer token을 예측한다.
3. Stage A는 $\mathcal{L}_A=\mathcal{L}_{act}+\lambda\mathcal{L}_{inf}$로 두 branch를 공동 학습한다($\lambda=0.5$).
4. Stage B에서 recognizer $g_{\theta_A}$를 freeze하고, 선호 라벨이 없는 100개 target demonstration에 $\hat c=g_{\theta_A}(\xi_T)$를 붙인다.
5. Stage-A policy 복사본을 $(\ell_T,\hat c,a_T)$로 1,500 step 적응한다. 배포 시 recognizer는 제거되고, 사용자가 선택한 선호 command와 현재 관측만으로 action policy가 실행된다.

# 핵심 그림

![선호 라벨 source 학습, target demonstration 자동 라벨링, 선호 조건부 VLA 배포로 이어지는 SPT 2단계 구조](/papers/assets/vla/self-labeled-preference-transfer-for-steerable-robot-manipulation/overview.svg)

> 논문 Figure 2와 Equation (3)을 바탕으로 재구성한 SPT 구조. 출처: [논문 HTML의 Figure 2와 Section IV](https://arxiv.org/html/2610.38000#S4). 원문은 CC BY 4.0이며, 학습 단계와 배포 단계를 한국어로 한 화면에서 구분하기 위해 직접 재구성했다.
>
> 구조 그림을 고른 이유는 핵심 기여가 특정 로봇 장면보다 **공유 backbone의 두 branch와 frozen self-labeling 경로**에 있기 때문이다. Stage A 입력은 선호 라벨 source trajectory이며, action loss와 recognition loss가 backbone을 함께 갱신한다. Stage B에서는 recognizer의 gradient를 끊고 target 행동을 선호 vocabulary로 변환해 policy만 적응한다. 추론에서는 recognition branch와 target labeling이 사라지고, RGB 관측·task instruction·사용자 선호가 action chunk로 바로 이어진다.

# Experiments / Results

## 주요 실험 결과

| 설정 / 지표 (성공률 %, ↑)                    |  SPT |               비교 기준 |    차이 | 출처      |
| -------------------------------------------- | ---: | ----------------------: | ------: | --------- |
| RoboTwin 5개 축 평균, preference following   | 83.8 |           Naive FT 59.4 | +24.4%p | Table II  |
| RoboTwin 5개 축 평균, task success           | 89.2 |           Naive FT 88.0 |  +1.2%p | Table II  |
| 실로봇 2개 target 평균, preference following | 92.5 |           Naive FT 52.5 | +40.0%p | Table III |
| 실로봇 2개 target 평균, task success         | 95.0 |           Naive FT 90.0 |  +5.0%p | Table III |
| 두 선호 동시 제어, both-following            | 93.8 | Same-init plain FT 42.5 | +51.3%p | Table V   |

RoboTwin 수치는 3개 seed, 선호 command마다 50 rollout을 평가한 Table II 기준이다. recognizer 자체도 target demonstration에서 96.4% 정확도를 기록해 zero-shot Qwen3-VL의 51.8%보다 +44.6%p 높다. 실로봇은 task마다 20회로 표본이 작지만 pushing에서 100%, billiards에서 85%의 선호 준수를 보였다. 논문 abstract에는 simulation preference following을 84.8%로 적은 곳이 있으나, 본문과 Table II의 세부 행 평균은 83.8%이므로 표에는 직접 대조 가능한 83.8%를 사용했다.

# Limitations / Discussion

target demonstration 안에 요청할 행동 스타일이 실제로 존재해야 하며, source에서 정의한 고정 vocabulary 밖의 선호는 다루지 못한다. 주 실험은 이진 축이고, 두 선호 조합 실험도 네 조합을 모두 학습에서 관찰했기 때문에 unseen composition이나 open-vocabulary 제어를 입증하지 않는다. Oracle label 대비 placement 선호 준수는 98%에서 83%로 15%p 낮아 self-label noise가 남고, out-of-vocabulary 행동을 abstain하는 장치도 없다. 실로봇 평가는 두 task와 40회 rollout에 한정된다.

# 내가 이해한 핵심

SPT의 포인트는 pseudo-labeling 자체보다, **행동을 생성하는 VLA가 그 행동의 실행 의미도 읽도록 먼저 훈련한다**는 데 있다. task-only fine-tuning이 선호 제어를 잊는 문제를, source에서 얻은 의미 판별 능력으로 target action data를 다시 조건부 데이터로 바꾸어 해결한다.

# 다음에 연결해서 읽을 논문

- [FineVLA](https://arxiv.org/abs/2605.27284): 세밀한 process instruction으로 steerable VLA를 만드는 접근
- [$\pi_{0.7}$](https://arxiv.org/abs/2604.15483): strategy와 metadata prompt를 사용하는 generalist robot policy
- [Freeform Preference Learning](https://arxiv.org/abs/2506.10912): 언어로 정의한 여러 실행 선호를 학습하는 방식
- [StarVLA-$\alpha$](https://arxiv.org/abs/2606.16643): SPT 시뮬레이션 정책의 기반 VLA
