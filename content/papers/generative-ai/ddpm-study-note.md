---
title: "Denoising Diffusion Probabilistic Models"
date: 2025-01-10
tags:
  - "paper-review"
  - "Generative AI"
  - "Generative"
author: "Jonathan Ho, Ajay Jain, Pieter Abbeel"
journal: "NEURIPS 2020"
notion_id: "1738d6e1-cee5-80e2-ab24-c3260c5d314c"
notion_url: "https://www.notion.so/Denoising-Diffusion-Probabilistic-Models-1738d6e1cee580e2ab24c3260c5d314c"
notion_synced: true
aliases:
  - "/papers/ddpm-study-note"
---

---

---

[https://arxiv.org/abs/2006.11239](https://arxiv.org/abs/2006.11239)

[/assets/notion/ddpm-study-note-1778d6e1cee5.pdf](/assets/notion/ddpm-study-note-1778d6e1cee5.pdf)

# Abstarct

---

- 비평형 열역학에서 영감을 받은 latent variable model의 일종

- 새로운 연결을 바탕으로 한 weight된 variational bound를 통해 학습되며, 이 연결은 diffusion probabilistic model과 Langevin dynamics를 이용한 denoising score 매칭 사이의 관계에 기반함

- 또한, 진행형 손실 압축 방식을 자연스럽게 수용하며, autoregressive decoding의 일반화로 해석될 수 있음

- CIFAR10 dataset에서 Inception Score 9.46과 SOTA FID score 3.17을 얻음

---

# 1. Introduction

---

![](/assets/notion/ddpm-study-note-1758d6e1cee5.png)

- Diffusion probabilistic model은 variational inference를 사용하여 샘플을 데이터와 일치시키는 매개변수화 된 Markov chain임

- 이 chain의 전이 과정은 reverse된 diffusion process를 학습함

- diffusion process는 데이터에 점진적으로 noise를 추가하는 Markov chain이며, 샘플링의 반대 방향으로 진행되어 signal이 파괴될 때까지 계속함

- diffusion이 작은 gaussian noise로 구성될 때, 샘플링 chain transition을 conditional gaussian으로 설정하는 것이 충분하며, 이를 통해 신경망 매개변수화가 가능함 

- Diffusion Model은 학습에서 정의와 효율적이지만, 우수한 품질의 샘플을 생성하는 것에 대해 입증할 수 없음

- 우리는 diffusion model이 우수한 품질의 샘플을 생성하는 거를 입증했으며, 때때로 다른 타입의 생성모델보다 좋은 성능을 보여줌

- 또한, 확산 모델의 특정 매개변수가 훈련 중 여러 노이즈 수준에서 Denoising score matching과 샘플링 중 annealed된 Langevin dynamics와 동등성을 보임

- 모델의 샘플 품질은 뛰어나지만, 다른 loglikelihoods 기반 모델과 비교하면 경쟁력 있는 loglikelihoods를 가지지 않음

---

---

# 2. Background

---

> [!note]
> **확산 모델 개념**
>   - 잠재 변수 모델로, 데이터 x0와 동일한 차원을 가진 잠재 변수 x1:T를 포함함
> 
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
>   - 역방향 과정: pθ(x0:T)
>     - 학습된 가우시안 전이를 가진 마르코프 체인으로 정의됨
> 
>     - 초기 상태
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
>     - 전이 확률
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
>   - 정방향 과정
>     - 근사 사후 확률 q(x1:T|x0)로, 마르코프 체인을 사용하여 데이터에 점진적으로 가우시안 노이즈를 추가함
> 
>     - 전이 확률
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
>   - 학습 목표
>     - 데이터 x0의 음의 로그 우도를 최소화하는 Variational bound 최적화`
> 
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)

> [!note]
> **Forward Process의 분산(βt)**
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
>   - 평균(mean): 이는 x0의 신호가 시간이 지나면서 감소하는 효과를 나타냄
> 
>   - 분산(variance): 이는 시간에 따라 노이즈가 증가하는 것을 나타냄

- Forward process에서 βt를 학습 가능하거나 고정된 하이퍼 파라미터로 사용 가능

- βt가 작을수록 Forward process와 Reverse Process의 조건부 분포가 유사하여 Reverse Process의 학습 및 샘플 생성 과정이 더욱 안정적이고 효율적임

> [!note]
> **효율적인 학습을 위한 training 수식 재정의**
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
>   - **LT:** DKL(q(xT∣x0)∣∣p(xT))
>     - Forward Process의 마지막 단계에서 q(xT∣x0)와 p(xT) 간의 차이를 측정
> 
>   - **Lt−1:** DKL(q(xt−1∣xt,x0)∣∣pθ(xt−1∣xt))
>     - Reverse Process와 Forward Process 간의 조건부 분포 차이를 측정
> 
>   - **L0:**−log⁡pθ(x0∣x1)
>     - Reverse Process가 최종적으로 x0를 얼마나 잘 복원하는지를 나타냄
> 
>   - 이 재구성은 각 KL 발산이 **가우시안 분포 간의 비교**로 표현될 수 있도록 설계됨 → 계산이 더 단순하고 효율적임

---

---

# 3. Diffusion models and denoising autoencoders

---

- Diffusion model은 제한적인 구조처럼 보이지만, 실제로는 구현에서 많은 자유도를 제공함

- 모델 설계와 선택에 대한 방향성을 제공하기 위해 Denoising Score Matching과 Diffusion 모델 간의 새로운 명시적인 연결을 제시함

## 3. 1. Forward Process and LT

---

- 본 논문에서는 Forward Process βt가 학습 가능하다는 사실을 무시하고, 이를 일정한 값으로 고정하는 방식으로  진행

## 3. 2. Reverse Process and L1:T-1

---

> [!note]
> **Reverse process and L1:T-1**
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
>   - 1<t≤T, 뒤의 시그마 항은 학습하지 않음
> 
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)

> [!note]
> **Training and Sampling**
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
>   - Equation(12)는 다양한 noise scale t에 걸쳐 denoising score matching과 유사한 형태를 가짐 → 모델은 노이즈를 제거하면서 **데이터 분포를 학습하도록 최적화됨**
> 
>   - Langevin Dynamics와의 관계
>     - 이 과정은 **Langevin dynamics**를 닮은 역과정(reversal process)을 통해 데이터 샘플을 생성함
> 
>     - ϵ-예측(parameterization) 방식은 이 Langevin dynamics와 유사하며, 이를 사용하면 확산 모델의 변분 경계를 간소화할 수 있음
> 
>   - 매개 변수화 전략
>     - 역과정에서 사용할 평균 함수(mean function approximator)를 ϵ~t 또는 ϵ으로 학습할 수 있음
> 
>     - x0를 직접 예측하는 것도 가능하지만, 실험 결과 x0를 예측하는 방식은 샘플 품질이 낮아짐
> 
>     - ϵ-예측 방식이 Langevin dynamics와의 유사성을 유지하면서도 학습 목표를 단순화한다는 점에서 효과적임
> 
>   - DDPM의 학습 및 샘플링 과정은 ϵ-parameterization 방식에 크게 의존하며, 이는 이론적 근거와 실험적 검증 모두에서 정당화 됨

## 3. 3 Data scaling, reverse process decoder, and L0

---

> [!note]
> **Data scaling, reverse process decoder**
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
>   - 이미지 데이터 스케일링
>     - {0,1, … , 255}로 구성되며, [-1, 1] 범위로 선형 스케일링함 → reverse process이 항상 일정한 범위의 입력을 처리하도록 보장함
> 
>   - 샘플링 과정의 마지막 단계
>     - reverse process의 마지막 단계에서는 discrete decoder를 사용하여 확률 pθ(x0∣x1)를 계산함
> 
>     - Decoder는 가우시안 분포 N(x;μ,σ2)에서 x0을 추출하며, 여기서 μ=ϵθ(x1,1), σ2=β1I
> 
>     - 이산 데이터의 특성을 고려하여 x0의 값에 따라 구간을 정의함
> 
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
>   - D는 데이터 차원을 나타내며, i는 특정 좌표를 나타냄
> 
>   - pθ(x0|x1)는 각 차원별로 독립적인 가우시안 확률을 곱한 값으로 계산됨
> 
>   - 샘플링 출력 ϵθ(x1,1)를 노이즈 없이 표시하여 결과 이미지를 얻음
> 
>   -  더 강력한 디코더를 사용해 모델 확장성을 올릴 수 있음

## 3.4 Simplified training objective

---

> [!note]
> **Simplified training objective**
>   - 12번과 13번에서 variational bound가 정의되며, 모델 파라미터 θ에 대해 미분 가능하여 학습에 사용할 수 있음
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
>   - 그러나 Sample의 품질 향상 및 구현의 간소화를 위해, 손실함수를 변경함
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
>     - ϵ는 가우시안 노이즈 샘플 N(0, 1)
> 
>     - αˉt는 시간 t에 따른 누적 노이즈 감쇠 계수
> 
>     - ϵθ는 모델이 예측하는 노이즈
> 
>   - 이 함수는 ϵ-예측 모델 ϵθ이 실제 노이즈 ϵ를 얼마나 정확히 예측하는지 측정함
> 
>   - t는 1에서 T 사이의 균일한 값으로 샘플링 됨
> 
>   - t = 1: L0에 해당하며, 이는 디코더 정의의 적분을 가우시안 확률 밀도 함수의 구간 폭(bin width)로 근사함
> 
>   - 작은 t에서는 노이즈가 거의 없는 데이터를 복원하는 간단한 작업이 주어짐
> 
>   - 큰 t에서는 더 많은 노이즈를 포함한 데이터를 복원하는 어려운 작업이 주어짐
> 
>   - 단순화된 손실 함수는 어려운 작업에 네트워크가 더 집중하도록 가중치를 조정함
> 
> → 결론적으로, Lsimple는 손실 가중치 조정을 통해 학습 효율성과 샘플 품질을 동시에 개선한 설계로, DDPM 모델의 성공적인 학습 과정의 핵심적인 부분임

---

---

# 4. Experiments

---

> [!note]
> **주요 내용**
>   - T=1000으로 설정
> 
>   - Foward Process Variance βt
>     - β1 = 10^-4
> 
>     - βt = 0.02
> 
>   - 이 값들은 데이터 범위 [-1, 1]에 비해 충분히 작게 설정돼있음
> 
> → Foward process와 reverse process를 비슷한 함수 형태를 가지게 하고, 최종 노이즈 상태 xT에서 신호 대 잡음비(SNR)를 가능한 낮게 유지함
> 
> ![](/assets/notion/ddpm-study-note-1768d6e1cee5.png)
> 
>   - U-Net 구조를 사용하며, 이는 Pixel CNN++의 Unmasked 버전과 유사함
> 
>   - 시간 t는 Transformer의 sinusoidal positional embedding을 통해 네트워크에 전달됨

## 4.1 Sample quality

---

> [!note]
> **Sample quality**
> ![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)
> 
>   - IS(Inception Score)
> [https://wikidocs.net/231773](https://wikidocs.net/231773)
> 
>     - 정확도(Sharpness)
> 
> ![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)
> 
>     - 다양성(Diversity)
> 
> ![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)
> 
>     - Inception Score
> 
> ![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)
> 
>   - FID(Frechet Inception Distance)
> [https://wikidocs.net/231774](https://wikidocs.net/231774)
> 
>     - 생성 모델과 생성한 데이터와 실제 데이터 간의 차이를 중점으로 측정하는 평가지표로 FID 지표가 낮을 수록 생성 모델의 생성 능력이 높다는 것
> 
> ![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)

![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)

![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)

## 4.2 Reverse process parameterization and training objective ablation

---

> [!note]
> Reverse process parameterization과 학습 목표에 대한 실험
>   - 파라미터 실험 결과
> ![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)
> 
>     - ϵ 예측 방식은 특히 단순화된 목표로 학습할 때 우수한 샘플 품질을 제공함
> 
>     - learned diagonal과 fixed isotropic으로 학습 했을 때 보다 고정된 분산을 사용한 ϵ을 예측하는 방식이 더 실용적이고 효과적임

## 4. 3 Progressive coding

---

> [!note]
> Progressive coding
>   - train과 test 차이가 0.03 bits/dim으로 매우 적음
> 
>   - Diffusion model은 손실 압축에서 매우 우수한 성능을 보임
> 
>   - 다른 likelihood 기반 모델에서 보고된 차이와 비슷하며, diffusion 모델이 과적합 되지 않음을 나타냄
> 
>   - 에너지 기반 모델 및 AIS를 사용하는 점수 매칭보다 우수함 → 하지만 likelihood 기반 생성 모델보다는 경쟁력이 부족

> [!note]
> **Progressive lossy compression**
>   - 모델의 Rate-Distortion 행동을 더 깊이 분석하기 위해 progressive lossy compression을 도입함
> 
> ![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)
> 
> ![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)
> 
>   - x0는 다음과 같은 식을 통해 추정함
> 
> ![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)

> [!note]
> **Progressive generation**
>   - ^x0의 진행된 생성에 따른 변화
> 
> ![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)
> 
>   - stochastic predictions x0 ~ pθ(x0|xt) 시각화(xt 고정 후 t에 대해 확률 적 예측)
> ![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)
> 
>     - t가 작을 때는 세부사항을 제외한 특징들이 보존되고, t가 클 때는 대규모 특징만 보존됨

> [!note]
> **Connection to autoregressive decoding**
>   - Variational bound를 재정의
> ![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)
> 
>     - DKL은 Kullback-Leibler 발산을 나타내며, H(x0)는 엔트로피 항임
> 
>   - Diffusion Process와 autoregressive 모델 연결
>     - Diffusion Process length T를 데이터의 차원 수에 맞추고, forward process에서 q(xt|x0)가 처음 t개의 좌표를 마스크하여 x0에 모든 확률 질량을 배치한다고 가정
> 
>     - p(xT)는 빈 이미지에 모든 확률 질량 배치하도록 설정하며, pθ(xt-1|xt)는 완전 표현 가능한 조건부 분포로 설정
> 
>   - Training with this diffusion
>     - DKL(q(xT)∥p(xT))=0이 되고, 
> 
>     - DKL(q(xt−1∣xt)∥pθ(xt−1∣xt))을 최소화하면 pθ는 t+1, … , T 좌표를 그대로 복사하고, t번째 좌표를 t+1, … , T 좌표를 기반으로 예측하도록 학습
> 
>   - Autoregressive model
>     - 이 특정 diffusion을 사용하여 pθ를 학습하는 것은 Autoregressive model을 학습하는 것과 같다고 결론 지음

## 4. 4 Interpolation

---

- q(stochastic encoder)를 사용해 잠재 공간에서 소스 이미지 x0와 x0’를 보간함

- xt, x’t ~ q(xt|x0)로 소스 이미지를 잠재 표현으로 변환하고, 선형 보간된 잠재 표현 밑의 식을 사용하여 역방향 과정 p(x0|x~t)로 복원해 이미지 공간에 디코딩

![](/assets/notion/ddpm-study-note-1778d6e1cee5.png)

- 이는 손상된 이미지의 선형 보간에서 발생하는 아티팩트를 제거하고 CelebA-HQ 256 x 256 데이터 세트 실험에서는 역방향 과정이 고품질 복원을 생성하며, 포즈, 피부색, 헤어스타일, 표정, 배경 등 속성을 부드럽게 변화시키는 보간 결과를 보여줌

- t 값이 커질수록 거칠고 다양한 보간이 가능하며, t = 1000에서 새로운 샘플이 생성됨

---

---

# 5. Related Work

---

---

---

# 6. Conclusion

---

- diffusion model를 이용하여 높은 퀄리티의 디퓨전 이미지 발표

- 이번 연구를 통해 발견하 것
  - Markov chain 학습을 위한  Diffusion model과 variational inference 사이에서 연결성

  - denoising한 score matching과 annealed Langevin dynamics

  - autoregressive models

  - progressive lossy compression

- Diffusion model은 이미지 데이터에 대해 뛰어난 inductive bias를 가지고 있는 것으로 보이므로, 우리는 이를 다른 데이터 형태와 다른 유형의 생성 모델 및 머신 러닝 시스템의 구성 요소로 활용하는 가능성을 조사해볼 것을 기대함

---

---
