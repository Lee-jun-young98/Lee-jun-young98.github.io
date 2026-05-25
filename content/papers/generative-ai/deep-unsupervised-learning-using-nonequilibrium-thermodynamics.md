---
title: "Deep Unsupervised Learning using Nonequilibrium Thermodynamics"
date: 2025-01-08
thumbnail: "/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1748d6e1cee5.png"
socialImage: "/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1748d6e1cee5.png"
paper_sync: true
tags:
  - "paper-review"
  - "Generative AI"
  - "Generative"
author: "Jascha Sohl-Dickstein, Eric A. Weiss, Niru Maheswaranathan, Surya Ganguli"
journal: "ICML 2015"
---

---

---

[https://arxiv.org/abs/1503.03585](https://arxiv.org/abs/1503.03585)

[/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.pdf](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.pdf)

# Abstract

---

- 복잡한 데이터를 다루는 기계 학습 문제를 해결하기 위한 새로운 방법 제시

- Forward Diffusion: 데이터를 서서히 변형시켜 구조를 파괴

- Reverse Diffusion: 파괴된 구조를 다시 복원하는 방법을 학습

- 매우 유연하면서도 계산적으로 처리 가능한 생성 모델을 만들 수 있게 하며, 복잡한 모델을 빠르게 학습하고, 샘플을 생성하며, 확률을 계산하는 데 도움을 줌

- 또한, 학습된 모델을 통해 조건부 확률이나 사후 확률을 계산할 수 있음

---

---

# 1. Introduction

---

- 확률 모델은 두 가지 중요한 특성인 tractability과 flexibility 사이에서 균형을 맞춰야 하는 문제를 겪음

- tractability
  - 데이터를 빠르게 분석하고 맞추기 쉬움

  - 복잡한 데이터 구조를 잘 설명하지 못함

- Flexibility
  - 데이터를 더 잘 맞출 수 있음

  - 모델을 평가하거나 학습시키는 데 필요한 정규화 상수를 계산하는 것이 매우 어려움

---

---

# 2. Algorithm

---

- Forward나 inference에서 diffusion process가 복잡한 데이터 분포를 간단, 다루기 쉬운, 분포로 변환하는 것이 목표

- 제한 시간에 diffusion process가 모델 분포를 학습하는 것이 목표

![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1748d6e1cee5.png)

- 첫줄은 forward trajectory

- 두번째줄은 학습된 reverse trajectory

- 세번째줄은 drift term

---

## 2. 1. Foward Trajectory

---

- 데이터 분포에서 시작하여 T 단계의 확산을 수행하는 과정

- 주어진 데이터 분포에서 각 단계마다 상태가 확산되며 점진적으로 변화하는 과정

- 데이터 분포에서 최종적으로 얻을 수 있는 상태 분포를 구하는 데 사용

- 수식
  - 데이터 분포 정의 q(x(0))
    - x(0)는 데이터의 초기 상태를 의미함

  - 목표 분포 π(y)로의 변환
    - 초기 데이터 분포 q(x(0))를 점진적으로 변화하여 Well-behaved(잘 정의)된 목표 분포 π(y)로 만듦

    - Well-behaved → 수학적 분석이나 계산이 용이한 상태를 의미

  - 마르코프 확산 커널 Tπ(y∣y′;β) 적용
    - 상태 y'에서 y로 전이될 확률을 정의하는 확산 커널

    - β는 diffusion rate(확산 속도)로 변환의 정도를 조절함

> [!note]
> **목표 분포 계산**

> [!note]
> **조건부 확률 정의**

> [!note]
> **Forward Trajectory**

---

## 2. 2. Reverse Trajectory

---

> [!note]
> **Reverse Trajectory**
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)
> 
>   - p(x^(T))=π(x^(T))
>     - p(x^(T))
>       - T-번째 단계의 확률 분포
> 
>       - p(x^(T))는 확산 과정의 마지막 단계에서 데이터 x(T)가 가지는 확률 분포를 나타냄
> 
>     - π(x^(T))
>       - x^(T)에 대해 목표로 하는 정규화된(analytically tractable) 확률 분포
> 
>       - 보통 수학적으로 단순하고 계산이 용이한 분포임(가우시안 분포)
> 
>     - =
>       - p(x(T))가 확산 과정의 마지막 단계에서 π(x^(T))와 같아짐을 의미
> 
>       - 즉, T-단계가 확산이 완료되면 p(x^(T))는 더 이상 초기 데이터의 구조를 포함하지 않고 π(x^(T))와 동일한 분포로 전환됨

- 연속 확산(Continuous Diffusion)
  - β가 작으면 역방향 확산과 순방향 확산이 동일한 함수적 관계를 가짐

  - 긴 trajectory이 일수록 diffusion rate β를 줄여 안정적인 확산을 구현 가능

- q(x^(t)∣x^(t−1))와 q(x^(t−1)∣x^(t)) 모두 동일한 분포를 유지 → 학습과 계산을 단순화하면서도 정확성을 유지함

- 학습 단계에서 주요 추정 항목
  - 가우시안 확산(Gaussian diffusion)
    - 평균 (fμ(x^(t),t))

    - 공분산 (fΣ(x^(t),t))

  - 이항 확산(Binomial diffusion)
    - 비트 플립 확률 (fb(x^(t),t)

- Reverse Markov Transition(역 마르코프 정의, MLP를 정의함)
  - fμ(x^(t),t): 가우시안 분포에서 평균을 정의

  - fΣ(x^(t),t): 가우시안 분포에서 공분산을 정의

  - fb(x^(t),t): 이항 분포에서 비트 플립 확률을 제공

- 계산 비용 고려
  - 학습 데이터 크기

  - 시간 단계 T

  - 사용된 함수 계산의 복잡도

---

## 2. 3. Model Probability

---

![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1748d6e1cee5.png)

- p(x^(0))
  - 생성 모델이 데이터 x^(0)에 할당하는 확률

- 이 확률은 모든 가능한 확산 경로 x^(1), x^(2), … , x^(T)에 대해 적분하여 계산됨

- p(x^(0⋯T))
  - 전체 trajectories의 x^(0⋯T))확률

- (6)번의 식은 고차원 공간에서 수행되므로 계산이 비실용적임

> [!note]
> **위의 문제를 해결하기 위한 식**
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)
> 
>   - 분포 p(x^(0))을 계산하는 데 사용 됨
> 
>   - 분모와 분자에 q(x^(1⋯T)∣x^(0))를 추가하여 Importance sampling 기법에서 흔히 사용되는 방식으로, 적분을 계산하기 쉽게 만듦
> 
>   - q(x^(1⋯T)∣x^(0)) → forward trajectory 속도를 빠르게 만들어줌
> 
>   - 분포 p(x^(0))를 직접 계산하기 어려운 상황에서 확산 경로  q(x^(1⋯T)∣x^(0))를 샘플링하여 계산을 근사하는 방식
> 
>   - infinitesimal(무한소) β
>     - β가 매우 작을 경우, 순방향과 역방향 경로의 확률 분포가 동일해짐
> 
>     - 이로 인해 적분 계산에서 단일 샘플만으로도 정확한 결과가 도출됨
> 
>   - 준정적 과정
>     - 변화가 매우 느리게 이루어져 시스템이 항상 평형 상태에 가까운 경우를 의미하며, 여기서는 무한소 infinitesimal(무한소) β가 이를 보장함

---

## 2.4. Training

---

> [!note]
> **학습**
>   - L: 모델의 로그 우도(log likelihood)를 의미
> 
>   - q(x^(0)): 데이터의 실제 분포 (데이터 생성 분포)
> 
>   - p(x^(0)): 모델이 예측한 데이터 분포
> 
>   - 데이터의 실제 분포와 모델 분포 간의 일치도를 나타냄
> 
>   - 목표는 L을 최대화하여 모델이 데이터 분포를 더 잘 근사하도록 학습

> [!note]
> **우도의 확장**
>   - 내적 ∫dx^(1⋯T): T-단계 경로(trajectory) 전체를 적분하여 계산
> 
>   - q(x^(1⋯T)∣x^(0)): T-단계 경로의 순방향 확률 분포
> 
>   - 분수 부분: p(x^(T))는 마지막 상태의 확률, 역방향 경로 p(x^(t−1)∣x^(t))와 순방향 경로 q(x^(t)∣x^(t−1))의 비율을 계산
> 
>   - 목적: 역방향 경로와 순방향 trajectory의 분포 비율을 활용해 모델의 학습 효율을 개선

> [!note]
> **Jensen’s inequality 적용**
>   - L의 하한(lower bound) 도출
> 
>   - p(x^(0⋯T)): 전체 T-의 분포
> 
>   - L은 trajectory T에 대한 평균 우도로 하한이 정의됨

> [!note]
> **하한 K**
>   - K: 로그 우도의 하한

> [!note]
> **KL 발산항**
>   - q(x^(t)∣x^(t−1), x^(0)): 데이터에서 계산한 t-1 단계 확률 ,분포
> 
>   - q(x^(t−1)|x^(t)): 모델이 예측한 t-1 단계 확률 분포
> 
>   - 두 분포의 차이를 KL 발산으로 측정하며, 이 값을 최소화 해야함

> [!note]
>   - 엔트로피 H항
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-76aea1100ca6.png)
> 
>     - Hq(X^(T)∣X^(0)): 순방향 경로에서 마지막 단계 T의 조건부 엔트로피
> 
>     - Hq(X^(1)∣X^(0)): 초기 단계의 조건부 엔트로피
> 
>     - Hp(X^(T)): 모델의 마지막 단계 분포의 엔트로피
> 
>   - 엔트로피와 KL divergences의 계산 가능성
>     - KL 발산과 엔트로피 값은 수학적으로 계산 가능하며 Lower Bound on Log Likelihood의 도출은 Variatonal Bayesian Methods에서 사용하는 방식과 유사
> 
>   - quasi-static
>     - Forward와 Reverse의 trajectory가 동일한 경우 L = K로 변환

> [!note]
> **학습 목표**
>   - p(x^(t-1)|x^(t)): Reverse 마르코프 전이의 확률 분포
> 
>   - 목표는 Lower bound on Log likelihood K를 최대화 하는 역방향 전이 확률 p(x^(t-1)|x^(t))를 학습

### 2.4.1 SETTING THE DIFFUSION RATE βt

- Forward trajectory에서 βt(diffusion rate)의 선택은 학습된 모델의 성능에 큰 영향을 줌

- Gaussian Diffusion에서의 Forward 스케줄 β2 학습
  - Gradient Ascent
    - Log Likelihood K를 최대화하기 위해 β2…T를 학습

    - 첫 번째 단계의 β1은 작은 상수로 고정 → 과적합(overfitting)을 방지하기 위함

- Binomial Diffusion에서의 Forward 스케줄 β1…T를 학습
  - Gradient Ascent가 불가능

  - 매 Diffusion 단계에서 원래 신호의 일정 비율 1/T을 제거하는 방식으로 스케줄 설정

  - Diffusion rate βt = 1/T-t+1로 정의

## 2.5. Multiplying Distributions, and Computing Posteriors

---

> [!note]
>   - 노이즈 제거(signal denoising) 또는 결측값 추론(inference of missing values)과 같은 작업 수행
> 
>   - p(x^(0)): 모델 분포 
> 
>   - r(x^(0)): 두 번째 분포 또는 경계가 있는 양의 함수
> 
>   - p~(x^(0)): 위의 두 분포를 곱하여 새로운 분포  생성
> 
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)
> 
>   - 많은 기법에서는 분포를 곱하는 작업이 비용이 많이 들고 복잡함
>     - Variational Autoencoders (VAEs)
> 
>     - Generative Stochastic Networks (GSNs)
> 
>     - Neural Autoregressive Distribution Estimators (NADEs)
> 
>     - 대부분의 그래프 모델(graphical models)

- Diffusion Model은 분포 곱셈이 간단함
  - 두 번째 분포 r(x^(0))를 Diffusion 과정의 각 단계에서 작은 perturbation(섭동)으로 취급하거나, 경우에 따라 r(x^(0))를 정확히 곱하여 각 Diffusion 단계에 반영 가능

- Diffusion Model을 활용한 Denoising 및 Inpainting 결과를 보여줌

![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)

![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)

### 2.5.1. MODIFIED MARGINAL DISTRIBUTIONS

> [!note]
> **수정된 분포 정의**
>   - 새로운 분포 p~(x^(0))를 계산하려면 각 중간 분포 p(x^(t))에 해당하는 함수 r(x^(t))를 곱해야 함
> 
>   - 수정된 경로의 분포를 나타낼 때 **파동 기호(tilde, ~)**를 사용:
>     - 수정된 역 경로 (Modified Reverse Trajectory): p~(x^(0⋯T))
> 
>   - 수정된 역 경로 시작점은 다음과 같이 정의됨
> 
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)
> 
>   - 수정된 중간 분포는 다음과 같이 계산
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)

> [!note]
> **수정된 확산 단계**
>   - 역확산 과정의 기본 Markov kernel 정의
> 
>   - p(x^(t)|x^(t+1))은 역확산 과정에서 다음 평형 조건을 만족
> 
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)
> 
>   - p(x^(t)): 시간 t 단계의 분포
> 
>   - p(x^(t+1)): 시간 t+1 단계의 분포
> 
>   - 수정된 Markov kernel
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)

### 2.5.2. MODIFIED DIFFUSION STEPS

> [!note]
> **수정된 확산 단계**
>   - 역확산 과정의 기본 Markov kernel
>     - p^(x^(t)|x^(t+1))은 역확산 과정에서 다음 평형 조건을 만족
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)
> 
>   - 수정된 Markov kernel
>     - 수정된 Markov kernel p~(x^(t)∣x^(t+1))는 수정된 분포 p~(x^(t))에 대해 아래 평형 조건을 만족해야 함
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)
> 
>   - 수식 유도
>     - 수정된 분포 정의
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)
> 
>     - r(x^(t)): t-단계에서 분포를 수정하는 함수
> 
>     - Z~t: 정규화 상수
> 
>     - t+1 - 단계의 분포 p~(x^(t+1))를 대입
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)
> 
>     - 수정된 Markov 커널 p~(x^(t)|x^(t+1))의 평형 조건
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)
> 
>     - 위의 수식을 만족시키기 위해 다음과 같이 정의
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)
> 
>     - 위의 수식을 정규화시키기 위해 다음과 같이 정의
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)
> 
>     - 정규화된 것을 다음과 같이 표현
> 
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)

### 2.5.3. APPLYING r(x^(t))

> [!note]
>   1. r(x^(t))가 충분히 smooth 하다면
> 
>   - reverse diffusion kernel p(x^(t)|x^(t+1))에 대한 small perturbation으로 처리할 수 있음
> 
>   - 이 경우, p~(x(t)∣x(t+1))은 p(x(t)∣x(t+1))와 동일한 함수 형태를 유지하지만
>     - Gaussian kernel: 평균값이 perturbation 됨
> 
>     - binomial kernel: flip rate가 perturbation 됨
> 
>   1. r(x^(t))가 닫힌 형태로 곱셈이 가능하다면
> 
>   - r(x^(t))는 역확산 커널 p(x^(t)|x^(t+1))과 직접 곱셈 가능
> 
>   - 결과적으로 p~(x^(t)|x^(t+1))도 닫힌 형태로 표현 가능
> 
> → 특정 좌표의 값을 고정하는 제약을 적용할 수있음
> 
> → 인페인트 문제에 사용

---

## 2.6. Entropy of Reverse Process

---

> [!note]
> **Reverse Process의 엔트로피**
>   - lower bounds on the conditional entropy of each step in the reverse trajectory
> 
>   - reverse process에서 조건부 엔트로피에 대해 상한과 하한을 정의할 수 있으며 이를 통해 log likelihood의 경계도 도출이 가능함
> 
> ![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)
> 
>   - Hq(X^(t)∣X^(t−1)): t-번째 단계에서의 조건부 엔트로피 (정방향 과정)
> 
>   - Hq(X^(t−1)∣X^(t)): t-번째 단계에서의 조건부 엔트로피 (역방향 과정)
> 
>   - q(x^(1:T)|x^(0)): 정방향 과정의 분포

---

---

# 3. Experiments

---

- Diffusion Probabilistic models의 학습과 평가
  1. 사용된 데이터 세트
    - 연속형 데이터 세트

    - 이진 데이터 세트

  1. 주요 기능
    - 샘플링: 학습된 모델에서 샘플 생성

    - 인페인팅: 누락된 데이터를 복원하는 인페인팅 수행

    - 성능 비교: 다른 기법과 모델 성능 비교

  1. 학습 세부 사항
    - 목적 함수: Theano를 사용해 계산

    - 최적화 알고리즘
      - SFO 사용

      - CIFAR-10 RMSprop 사용

- 3.1. Toy Problems ~ 3.2.1 DATASETS 생략

![](/assets/notion/deep-unsupervised-learning-using-nonequilibrium-thermodynamics-1758d6e1cee5.png)

- Table1
  - 오른쪽 열은 isotropic Gaussian 또는 독립적인 binomial 분포에 비해 개선된 정도를 나타냄

  - Lnull은 log likelihood의 π(x^(0))

  - Binary Heartbeat를 제외한 모든 데이터 세트는 로그 가능도를 계산하기 전에 분산을 1로 맞추기 위해 일정 상수로 스케일링 됨

---

---

# 4. Conclusion

---

- 데이터를 노이즈 분포로 매핑하는 Markov diffusion chain의 reverse를 추정하는 것이 핵심

- 단계 수가 커질수록 각 확산 단계의 역분포는 단순해지고 추정하기 쉬워짐

---

---
