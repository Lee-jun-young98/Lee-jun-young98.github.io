---
title: "Auto-Encoding Variational Bayes"
date: 2025-01-06
paper_sync: true
tags:
  - "paper-review"
  - "Generative AI"
  - "Generative"
  - "Reconstruction"
author: "Diederik P Kingma, Max Welling"
journal: "arXiv 2013"
---

---

---

[https://arxiv.org/abs/1312.6114](https://arxiv.org/abs/1312.6114)

[/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.pdf](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.pdf)

# Abstarct

---

- reparameterization된 variational lower bound를 재구성하여, 간단하게 최적화할 수 있는 추정치를 얻음

- i.i.d dataset에서 연속적인 latent variables 를 가질 경우, 제안된 lower bound estimator를 사용해 approximate inference model을 학습시킴으로써 posterior inference를 효율적으로 수행할 수 있음

---

---

# 1.  Introduction

---

- Variational Bayesian(VB)방법은 계산이 어려운 사후 확률을 대략적으로 최적화를 포함함

- 일반적인 mean-field 접근법은 근사 사후 분포에 대한 기대값을 분석적으로 계산해야 하며, 일반적일 경우 해결 x

- SGBV(Stochastic Gradient Variational Bayes) 추정치를 이용해 continuous latent variables and/or parameters를 가진 거의 모든 모델에서 효율적인 근사 사후 추론을 가능하게 하고 표준적인 stochastic gradient 상승 기법을 사용해 쉽게 최적화할 수 있음

- 이 논문에서는 SGVB 추정치를 이용해 AutoEncodingVB(AEVB)를 제안함

- recognition model로 사용할 경우, **Variational auto-encoder**라고 불림

---

---

# 2. Method

---

- 연속적인 latent variables를 가진 다양한 방향성 그래프 모델에 대해 lower bound estimator를 유도할 수 있음

- 전체 파라미터에 대해 Maximum likelihood(MLE) or Maximum a posteriori(MAP) 추론을 수행하고, latent variabels에 대해 variational inference를 수행하는 경우를 다룸

![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

- 생성 모델
  - **pθ(z)**: 잠재 변수 z에 대한 사전 분포이며, θ로 파라미터화됨

  - **pθ(x∣z)**: 잠재 변수 z가 주어졌을 때 관측된 데이터 x의 우도이며, θ로 파라미터화됨

- Variational Approximation
  - **qϕ(z∣x)**: 실제 후방 분포 pθ(z∣x)를 근사하는 변분 분포입니다. 실제 후방 분포는 계산이 어렵기 때문에 더 간단한 분포 qϕ(z∣x)로 근사합니다. 이 분포는 ϕ로 파라미터화됨

- 학습
  - 생성 모델의 파라미터 θ와 변분 근사 파라미터 ϕ는 Variational Approximation(ELBO)을 최적화하여 공동으로 학습됨 ELBO는 데이터의 로그 우도에 대한 근사값임

---

## 2. 1. Problem Scenario

---

- **잠재 변수 모델과 추론 문제**:
  - 관측된 데이터 x는 숨겨진 잠재 변수 z에 의해 생성된다고 가정함

  - 데이터 생성 과정은 z가 사전 분포에서 샘플링되고, 그 후 x가 조건부 분포에서 생성되는 두 단계로 이루어짐

  - 문제는 실제 파라미터 θ∗와 잠재 변수 z를 추론하는 것이 어려움

- **세 가지 관련 문제와 해결 방법**:
  - **파라미터 추정**: θ를 효율적으로 추정하여 숨겨진 과정을 모방하거나, 인공 데이터를 생성할 수 있도록 함

  - **잠재 변수 추론**: 주어진 관측값 x에 대해 잠재 변수 z를 효율적으로 추론하여 코딩이나 데이터 표현에 활용함

  - **주변 변수 추론**: x의 분포를 근사하여 이미지 노이즈 제거, 인페인팅, 슈퍼 해상도 등 다양한 추론 작업을 가능하게 함

- **인식 모델 도입**:
  - 실제 후방 분포 pθ(z∣x)를 근사하는 **인식 모델** qϕ(z∣x)를 도입하여, 이를 효율적으로 학습함

  - **인식 모델**은 **확률적 인코더**로, x에 대해 가능한 z 값을 생성함

  - **생성 모델** pθ(x∣z)는 **확률적 디코더**로, z에 대해 가능한 x 값을 생성함

---

## 2. 2. The variational bound

---

- Marginal Likelihood
  - 전체 데이터의 marginal likelihood는 개별 데이터 포인트들의 margin likelihood의 합으로 표현
![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

  - 이것은 다음과 같이 재정의 될 수 있음

![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

  - KL 다이버전스는 근사 후방 분포 qϕ(z∣x)와 실제 후방 분포 pθ(z∣x) 사이의 차이를 측정하며. 이 값은 항상 음이 아닌 값을 가짐

- Lower bound
  - 첫 번째 항은 qϕ(z∣x(i))와 pθ(z) 간의 KL Divergence

  - 두 번째 항은 pθ(x(i)∣z)의 기대값

  - 이 식을

![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

  - 이 식으로 재정의 할 수 있음

![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

- Gradient optimize
  - L(θ,ϕ;x(i))을 최적화하려고 하지만 기울기를 계산하는 데 어려움이 있음

![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

- 위의 방법들은 KL Divergence와 Lower Bound를 위한 Margin Likelihood를 근사하지만, 기울기 추정 문제에서 분산 문제를 해결해야 하는 어려움이 있음

---

## 2. 3. The SGVB estimator and AEVB algorithm

---

- 선택된 posterior qφ(z|x)에 대해 x를 놓지 않고 qϕ(z)로 해서 동작할 수 있음

- 특정한 조건 하에, 미분 가능한 변환을 사용하여 재매개화 함

![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

- qϕ(z∣x)에 대한 기대값을 추정하기 위해 **미분 가능한 변환** gϕ(ϵ,x)을 사용하여 **노이즈 변수** ϵ로부터 샘플링된 값 ϵ(l)을 변환함

- 이는 z~qϕ(z∣x)에 대해, f(z)의 기대값을 다음과 같이 근사할 수 있게 해줌:

![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

- SGVB 추정기

![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

```python
import numpy as np

# Initialize parameters (θ, φ)
theta = np.random.randn()  # 예시로 단일 파라미터 초기화
phi = np.random.randn()    # 예시로 단일 파라미터 초기화

# Hyperparameters
M = 32  # 미니배치 크기
L = 100  # 몬테카를로 샘플링 횟수
learning_rate = 0.001  # 학습률

# Noise distribution p(ε)
def noise_distribution():
    return np.random.randn()  # 예시로 표준 정규분포를 사용

# Function gφ(ε, x) (Reparameterization trick)
def reparameterize(epsilon, x):
    # 예시로 간단한 선형 변환 사용
    return phi * epsilon + x

# Likelihood function pθ(x, z)
def likelihood(x, z):
    return np.exp(-0.5 * (x - z) ** 2)  # 예시로 간단한 Gaussian likelihood

# qφ(z|x) (Variational distribution)
def variational_dist(z, x):
    return np.exp(-0.5 * (z - x) ** 2)  # 예시로 간단한 Gaussian distribution

# SGVB Estimator for a minibatch (L)
def sgvb_estimator(theta, phi, X_batch, noise_batch):
    loss = 0
    for i in range(M):
        x_i = X_batch[i]
        epsilon_i = noise_batch[i]
        z_i = reparameterize(epsilon_i, x_i)
        
        log_p = np.log(likelihood(x_i, z_i))  # log pθ(x(i), z(i))
        log_q = np.log(variational_dist(z_i, x_i))  # log qφ(z(i) | x(i))
        
        loss += log_p - log_q
    
    return -loss / M  # Negative log-likelihood as we are minimizing

# Gradient of SGVB Estimator (Placeholder for actual gradient computation)
def compute_gradients(theta, phi, X_batch, noise_batch):
    # 예시로 gradients를 랜덤으로 설정 (실제 모델에서는 backpropagation으로 계산)
    grad_theta = np.random.randn()  # Placeholder gradient for θ
    grad_phi = np.random.randn()    # Placeholder gradient for φ
    return grad_theta, grad_phi

# Main optimization loop
for epoch in range(1000):  # Example: 1000 epochs
    # 1. Draw a random minibatch of M datapoints
    X_batch = np.random.randn(M)  # 예시 데이터셋
    noise_batch = np.array([noise_distribution() for _ in range(M)])  # 노이즈 샘플링
    
    # 2. Compute gradients using SGVB estimator
    grad_theta, grad_phi = compute_gradients(theta, phi, X_batch, noise_batch)
    
    # 3. Update parameters using gradients (e.g., SGD)
    theta -= learning_rate * grad_theta
    phi -= learning_rate * grad_phi
    
    # Optionally print loss or track convergence
    if epoch % 100 == 0:
        print(f"Epoch {epoch}: θ = {theta}, φ = {phi}")

# Return the optimized parameters
print("Final parameters:", theta, phi)
```

- **KL-divergence**:
  - 방정식 (3)에서 언급된 **KL-divergence** DKL(qϕ(z∣x(i))∥pθ(z))는 일반적으로 분석적으로 적분할 수 있음. 이 항은 근사 후방 분포 qϕ(z∣x(i))가 **prior** pθ(z)와 가까워지도록 **정규화** 역할을 하며, 이는 ϕ를 정규화하는 효과가 있음

- **SGVB 추정기 (두 번째 버전)**:
  - 두 번째 버전의 SGVB 추정기는 다음과 같음:

![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

  - **KL-divergence 항**은 이제 분석적으로 계산되어 제거됨

  - **재구성 오류** 항 logpθ(x(i)∣z(i,l))만 샘플링을 통해 추정해야 함

- **효과**:
  - 이 두 번째 버전의 **SGVB 추정기**는 **generic SGVB 추정기**보다 분산이 적어, 더 안정적인 학습이 가능함

- **전체 데이터셋에 대한 추정기**:
  - 데이터셋 X에 대해 **marginal likelihood lower bound** 추정기를 구하는 방법은 미니배치를 기반으로 함. 미니배치 XM는 전체 데이터셋 X에서 임의로 샘플링된 M개의 데이터 포인트로 구성됨

  - **추정기**는 다음과 같이 정의됨:

![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

  - N은 데이터셋의 총 데이터 포인트 수, M은 미니배치의 크기
![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

  - 는 개별 데이터 포인트에 대한 추정기

- **샘플 수 L 설정**:
  - 실험에서, 각 데이터 포인트에 대해 샘플 수 L은 M=100과 같은 충분히 큰 미니배치를 사용할 경우 1로 설정해도 충분함

  - 이는 **샘플링**의 분산을 줄이면서 계산 효율성을 높이는 방법

- **파라미터 업데이트**:
  - **파라미터** θ와 ϕ에 대해 미니배치에 대한 **기울기** ∇θ,ϕL~(θ;XM)를 계산하고, 이를 **SGD**나 **Adagrad**와 같은 **확률적 최적화 방법**을 사용해 업데이트함

- **오토인코더와의 관계**:
  - 목표 함수는 오토인코더와 유사한 구조를 가짐. 첫 번째 항은 **KL-divergence**로, 근사 후방 분포가 **prior**에 가까워지도록 정규화하는 역할을 함

  - 두 번째 항은 **재구성 오류**로, 이는 오토인코더에서의 **음의 재구성 오차**와 동일함. 이 항은 주어진 코드 z(i,l)가 해당 데이터 포인트 x(i)를 얼마나 잘 재구성하는지를 나타냄

  - *함수 gϕ(⋅)**는 데이터 포인트 x(i)와 랜덤 노이즈 벡터 ϵ(l)를 결합하여 근사 후방 분포로부터 샘플을 생성함:
![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

  - 그런 다음, 샘플 z(i,l)는 생성 모델을 통해 **재구성 확률** logpθ(x(i)∣z(i,l))을 계산하는 데 사용됨.

---

## 2. 4. The reparameterization trick

---

- 연속 확률 변수 z를 조건부 분포 qϕ(z∣x)에서 샘플링하는 대신, 보조 변수 ϵ를 사용해 z를 결정론적인 형태로 표현하는 것

- 다음과 같이 표현함

![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

- ϵ은 p(ϵ)라는 독립적인 주변 분포를 가진 보조 변수임

- gϕ(ϵ,x)는 파라미터 ϕ에 의해 정의된 결정론적 함수임

### 수학적 증명

1. z∼qϕ(z∣x)에서 샘플을 뽑는 대신, z를 결정론적으로 표현한 뒤 기댓값을 계산함

1. 이때, z는 ϵ에 의존하는 형태로 바뀌며, ϵ은 p(ϵ)라는 주변 분포에서 샘플링됨

1. 그러므로, 원래의 기댓값 ∫qϕ(z∣x)f(z)dz는 다음과 같이 변환됨:

![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

이 과정에서, gϕ(ϵ,x)는 z를 다시 ϵ과 x를 이용해 결정할 수 있도록 해줌

- 재매개변수화 기법을 사용하여 미분 가능한 추정기를 구축함

![](/assets/notion/auto-encoding-variational-bayes-1738d6e1cee5.png)

- qϕ(z∣x): 우리가 샘플을 생성하려는 조건부 분포

- f(z): 우리가 계산하고자 하는 함수

- ϵ(l)∼p(ϵ): 독립적인 보조 변수

- gϕ(x,ϵ(l)): 주어진 입력 x와 보조 변수 ϵ(l)를 사용하여 샘플 z를 생성하는 결정론적 함수

- L은 샘플의 개수

- **유효한 역 CDF (Inverse CDF) 사용:**
  - 이 방법에서는 보조 변수 ϵ가 균등 분포 U(0,1)를 따르고, gϕ(ϵ,x)는 qϕ(z∣x)의 역 누적 분포 함수 (Inverse CDF)임

  - 예시로는 **지수 분포(Exponential)**, **코시 분포(Cauchy)**, **로지스틱 분포(Logistic)**, **레이리 분포(Rayleigh)**, **파레토 분포(Pareto)**, **웨이불 분포(Weibull)**, **역수 분포(Reciprocal)**, **곰페르츠 분포(Gompertz)**, **검벨 분포(Gumbel)**, **에를랑 분포(Erlang)** 등이 있음

- **"위치-스케일(location-scale)" 계열 분포 사용:**
  - 이 방법은 **정규 분포(Gaussian)**와 유사한 방식으로, 위치(location)와 스케일(scale) 매개변수를 가진 분포를 다룸. 보조 변수 ϵ는 표준 분포 ϵ∼N(0,1)를 따르고, gϕ(ϵ,x)=location+scale⋅ϵ와 같이 정의됨

  - 예시로는 **라플라스 분포(Laplace)**, **원형 분포(Elliptical)**, **학생 t 분포(Student's t)**, **로지스틱 분포(Logistic)**, **균등 분포(Uniform)**, **삼각 분포(Triangular)**, **정규 분포(Gaussian)** 등이 있음

- **조합(Composition) 기법:**
  - 때때로 여러 보조 변수를 조합하여 복잡한 분포를 생성할 수 있음. 이 방법은 여러 단순한 분포를 합성하여 더 복잡한 분포를 만드는 방식임

  - 예시로는 **로그 정규 분포(Log-Normal)** (정규 분포 변수를 지수화), **감마 분포(Gamma)** (지수 분포 변수들의 합), **디리클레 분포(Dirichlet)** (감마 분포 변수들의 가중 합), **베타 분포(Beta)**, **카이제곱 분포(Chi-Squared)**, **F 분포(F distribution)** 등이 있음

---

---

- 3절 ~ 5절 생략

# 6. Conclusion

---

- **SGVB (Stochastic Gradient VB)**:
  - Variational Lower Bound을 효율적으로 추정할 수 있는 새로운 **추정기**를 도입함

  - 이 추정기는 **미분 가능**하며 SGD을 통해 최적화할 수 있음

- **AEVB (Auto-Encoding VB)**:
  - i.i.d. 데이터셋과 각 데이터 포인트에 대해 연속적인 잠재 변수들이 있을 때, **효율적인 추론** 및 **학습**을 위한 알고리즘인 Auto-Encoding VB를 소개함

  - 이 알고리즘은 **SGVB 추정기**를 사용하여 근사 추론 모델을 학습함

- **이론적 장점**:
  - 이론적으로, 제안된 방법은 **실험 결과**에서도 장점이 확인됨

  - 즉, **SGVB**와 **AEVB**가 실제 문제에서 효율적으로 작동함

---

---
