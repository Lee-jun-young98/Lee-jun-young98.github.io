---
title: "High-Resolution Image Synthesis with Latent Diffusion Models"
date: 2025-01-13
paper_sync: true
tags:
  - "paper-review"
  - "Generative AI"
  - "Generative"
author: "Robin Rombach, Andreas Blattmann, Dominik Lorenz, Patrick Esser, Björn Ommer"
journal: "CVPR 2022"
aliases:
  - "/papers/latent-diffusion-models-study-note"
---

---

---

[https://arxiv.org/abs/2112.10752](https://arxiv.org/abs/2112.10752)

[https://github.com/CompVis/latent-diffusion](https://github.com/CompVis/latent-diffusion)

[/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.pdf](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.pdf)

# Abstract

---

- DM(Diffusion Model)은 이미지 합성결과에서 sota를 가짐

- 하지만 100일이 넘는 GPU 자원 소요와 추론에 자원이 많이 들음

- DM을 학습을 한정된 컴퓨터 자원에서  사용하기 위해 latent space의 강력한 사전학습된 autoencoder를 적용
  - 이전 연구와 비교했을 때, 위의 표현 방식을 기반으로 확습한 모델을 훈련시킬 경우 처음으로 최적의 지점(near-optimal point)에 도달할 수 있게 해주며 복잡성 감소와 세부 사항 보존 사이에서 visual fidelity를 크게 향상시킴

- cross-attention layers를 model architecture에 도입
→ diffusion 모델을 강력하고 유연한 generators로 바꿈 

→ 합성이 가능한 광범위한 조건 inputs을 받는 생성 모델이 됨

→ 입력으로 text or bounding boxes와 high-resolution synthesis을 받음

- 우리의 Latent diffusion models(LDMs)는 sota scores를 얻음
  - image inpainting

  - class-conditional image synthesis

  - highly competitive performance on various tasks
    - text-to-image synthesis

    - unconditional image generation

    - super-resolution

- pixel-based DMs와 비교하여 컴퓨터적 요구치를 많이 줄임

---

---

# 1. Introduction

---

- 복잡하고 자연스러운 장면의 고해상도 합성은 현재 수십억개의 매개 변수를 포함할 수 있는 Autoregressive(AR) transformers를 기반으로 한 확률 모델을 확장하는 방식이 주도하고 있음

- 반면, GAN은 변동성이 비교적 제한적인 데이터에 국한되며 adversarial 학습 절차가 복잡하고 multi-modal distributions으로 확장하는 데 쉽지 않음

- 최근 diffusion model이 이미지 합성 및 그 이상의 작업에서 놀라운 결과를 달성했으며, 클래스 조건부 이미지 합성 및 초해상도에서 sota를 달성함

- unconditional DMs은 이미지 보완(inpainting)과 색채화(colorization) 또는 획 기반 합성(stroke-based synthesis)에 적용될 수 있음

- likelihood-based models은 모델 붕괴(mode-collaspe)를 나타내지 않고 GAN과 같이 학습이 불안정하지 않음

- 매개변수 공유(parameter sharing)을 적극 공유하여 likelihood-based models은 highly complex distributions의 자연 이미지를 수십억개의 파라미터 없이 AR models처럼 모델링할 수 있음

> [!note]
> **Democratizing High-Resolution Image Synthesis**

> [!note]
> **Departure to Latent Space**
> ![](/assets/notion/latent-diffusion-models-study-note-17a8d6e1cee5.png)
> 
>   - Two stages로 나눔
>     1. Perceptual Compression
>       - 빈도가 높은 세부사항을 제거
> 
>       - 약간의 작은 의미론적 분할을 학습함
> 
>     1. Semantic Compression
>       - 실제 생성모델이 의미와 개념적인 구조의 데이터를 학습
> 
> → 첫번째로 지각적으로 동등성하면서도 계산적으로 더 적합한 공간을 찾는 것에 초점을 둠 
> 
>   - Two distinct phases
>     - **autoencoder를 훈련시키며, 이는 데이터 공간과 지각적으로 동등한 저차원 표현 공간을 제공함**
> 
>     - 이전 연구와 다르게, 과도한 공간 압축에 의존할 필요가 없으며 공간 차원에 대해 더 나은 확장성을 보임
> 
>     -  복잡성이 줄어들며 잠재 공간에서 단일 네트워크 패스로 효율적인 이미지 생성을 가능 하게 함
> 
> → 이를 Latent Diffusion Models(LDMs)라 명명함
> 
>   - 위 접근법의 장점
>     - DM training 재사용 혹은 different tasks로 노출
> 
>     - image-to-image, text-to-image task에 효율적으로 노출됨
> 
>     - Unet-backbone 사용, 토큰 기반 조건화 메커니즘을 임의로 가능하게 하는 아키텍처 설계
> 
>   - Contributions
>     1. Higher dimensional data에 대해 graceful하게 확장되며, 이전 작업보다 더 충실하고 상세한 복원을 제공하는 압축 수준에서 작업할 수 있고, Megapixel 이미지의 고해상도 합성에 효율적으로 적용됨
> 
>     1. 여러 작업(Unconditional image synthesis, inpainting, stochastic super-resolution)과 데이터 세트에서 경쟁력 있는 성능을 달성 그리고 계산 비용과 추론 비용이 크게 감소
> 
>     1. Reconstruction과 Generative abilities의 미세한 가중치 조정을 요구하지 않으며, Latent space에 대해 매우 faithful한 복원을 보장함
> 
>     1. Inpainting과 Super-resolution, Semantic synthesis와 같은 조밀하게 조건화된 작업에 대해, 우리 모델의 Convolution 방식이 적용될 수 있으며, 1024x1024px 크기의 큰 일관된 이미지를 생성할 수 있음
> 
>     1. cross-attention을 사용하여 다중 모드 학습을 가능하게 하며 클래스 조건, 텍스트-이미지, 레이아웃-이미지 모델을 훈련시킴

---

---

# 2. Related Work

---

- Generative Models for Image Synthesis

- Diffusion Probabilistic Models

- Two-Stage Image Synthesis

---

---

# 3. Method

---

- Diffusion Models의 계산 요구를 낮추기 위해 Diffusion model과 관련이 없는 세부사항을 무시할 수 있도록 loss terms을 under sampling할 수 있지만 여전히 비용이 많이 드는 function evaluations가 요구됨

- autoencoding 모델을 이용하여 space를 학습함 → 이미지 공간과 지각적으로 동등한 공간을 학습하며 충분히 감소된 계산적인 복잡도를 제공

- 위 접근법의 이점
  1. 고차원 이미지 공간을 벗어냄으로써, 샘플링이 저차원 공간에서 수행되기 때문에 훨씬 더 계산 효율적인 Diffusion Model을 얻음

  1. UNet 아키텍처로부터 물려받은 inductive bias를 이용함, 이로 인해 공간 구조를 가진 데이터에 특히 효과적이며 이전 접근법에서 요구되었던 품질을 저하시키는 과도한 압축 수준의 필요성을 완화함

  1. general-purpose compression models를 얻음. latent space가 여러 생성 모델 훈련에서 사용될 수 있으며 또한 단일 이미지 CLIP 기반 합성과 같은 다른 후속 연구에도 활용될 수 있음

## 3.1. Perceptual Image Compression

---

- Perceptual Compression Model
  - perceptual loss와 patch-based adversarial objective(목적 함수)의 결합에 의해 학습된 autoencoder와 [사전 연구](https://arxiv.org/abs/2012.09841)로 이루어짐

  - 이 방법은 local realism을 강제로 적용하여 복원된 이미지가 이미지 manifold(데이터가 있는 공간)에 제한되도록 보장하고, L2 또는 L1 목표와 같은 픽셀 손실만을 의존하는 것에서 발생할 수 있는 흐림을 방지함

> [!note]
> **Auto Encoder 작동방식**
>   - 주어진 이미지 x∈RH×W×3은 RGB 공간에 위치함
> 
> ![](/assets/notion/latent-diffusion-models-study-note-17a8d6e1cee5.png)
> 
>   - **인코더(Encoder)** E는 이미지를 입력받아 잠재 표현 z로 변환함
> ![](/assets/notion/latent-diffusion-models-study-note-17a8d6e1cee5.png)
> 
> ![](/assets/notion/latent-diffusion-models-study-note-17a8d6e1cee5.png)
> 
>     - z는 다운샘플링된 이미지이며, h와 w는 다운샘플링된 크기이며 c는 채널수임
> 
>   - **디코더(Decoder)** D는 잠재 표현 z를 받아 원래 이미지를 복원하여 x~를 생성함
> ![](/assets/notion/latent-diffusion-models-study-note-17a8d6e1cee5.png)
> 
>   - 중요한 점은 **인코더**가 이미지를 다운샘플링하여 크기를 줄이는 과정인데, 이때 **다운샘플링 비율** f=H/h=W/w이며 f=2^m와 같은 다양한 다운샘플링 인자 m∈N를 실험

> [!note]
> **High-variance latent spaces를 피하기 위한 2가지 regularizations**
>   1. KL-reg
>     - 학습된 잠재 공간이 표준 정규 분포(standard normal)로 가까워지도록 간단한 KL-penalty를 부과함
> 
>   1. VQ-reg
>     - 벡터 양자화(Vector Quantization) 기법을 사용하여 latent vector를 quantization하여 Decoder에서 사용할 수 있도록 변환함
> 
>   - VQGAN과 유사하지만 양자화 계층을 Decoder에 통합하여 2D 구조에서 상대적으로 낮은 압축률을 사용해 더 좋은 재구성을 얻음
> 
>   - 이로 인해 더 정확한 재구성이 가능함
> 
> ![](/assets/notion/latent-diffusion-models-study-note-17a8d6e1cee5.png)

## 3.2. Latent Diffusion Models

---

> [!note]
> **Diffusion Models**
>   - Diffusion Models은 정상 분포에서 점진적으로 noise를 제거하여 데이터 분포 p(x)를 학습하는 확률론적 모델
> 
>   - 이미지 합성에서 가장 성공적인 모델은 variational lower bound를 사용하여 noise 제거 방식 모델과 denoising score가 유사함
> 
>   - 목표 함수는 noise가 제거된 결과와 실제 결과 간의 차이를 최소화하는 방식으로 정의됨
> ![](/assets/notion/latent-diffusion-models-study-note-17a8d6e1cee5.png)
> 
>   - ϵ: 노이즈
> 
>   - xt: input x의 noisy version
> 
>   - ϵθ(xt, t); t = 1…T: Denoising Auto encoder

> [!note]
> **Generative Modeling of Latent Representations**
>   - 신경망 백본은 time-conditional UNet으로 구현 
> 
>   - Foward process가 고정되어 있기 때문에, zt는 훈련 중에 E에서 효율적으로 얻을 수 있으며, p(z)에서 샘플을 추출하여 D를 한 번 통과시켜 이미지 공간으로 복원할 수 있음
> 
>   - E(Encoder)와 D(Decoder)로 구성되고 훈련된 지각 압축 모델을 통해 우리는 고주파의 인식 불가능한 세부사항이 추상화된 효율적이고 저차원적인 잠재 공간에 접근할 수 있게됨 
> 
>   - 데이터의 중요한 의미적 정보를 집중하고 낮은 차원에서 훨씬 효율적인 계산을 통해 학습함
> 
>   - Latent Diffusion Models
> ![](/assets/notion/latent-diffusion-models-study-note-17a8d6e1cee5.png)
> 
>     - Unet이 제공하는 Inductive bias를 이용할 수 있으며 이는 기본 Unet을 주로 2D 합성곱 계층으로 구축할 수 있는 능력과 rewieght된 bound를 사용하여 목표를 지각적으로 가장 중요한 비트에 집중시킬 수 있음
> 
>     - Foward process가 고정되어 있기 때문에, 훈련 중 E로부터 효율적으로 zt를 얻을 수 있고, p(z)에서 샘플을 얻어 Deocder D를 통해 이미지 공간으로 복원할 수 있음

## 3.3. Conditioning Mechanisms

---

- Diffusion model은 다른 생성 모델과 유사하게 조건부 분포를 모델링할 수 있음

- conditional denoising autoencoder를 사용해 diffusion model을 구현하고, 다양한 입력을 통해 합성 과정을 제어할 수 있음

- DMs을 더 유연한 조건부 이미지 생성기로 변환함

→ UNet 백본에 attention mechanisms을 추가하여, 여러 입력 양식에 대해 attention base model을 학습하는데 효과적임

> [!note]
> **LDM with Unet**
>   - 다양한 모달리티로 부터 전처리된 y를 입력하기 위해 인코더를 도입함
> 
> ![](/assets/notion/latent-diffusion-models-study-note-17a8d6e1cee5.png)
> 
>   - 도입된 입코더 값을 cross attention layer에 맵핑을 진행함
> ![](/assets/notion/latent-diffusion-models-study-note-17a8d6e1cee5.png)
> 
> ![](/assets/notion/latent-diffusion-models-study-note-17a8d6e1cee5.png)
> 
>   - 이미지 조건쌍으로 학습하는 LDM은 다음과 같음
> ![](/assets/notion/latent-diffusion-models-study-note-17a8d6e1cee5.png)
> 
> ![](/assets/notion/latent-diffusion-models-study-note-17a8d6e1cee5.png)

---

---

# 4. Experiments

---

> [!note]
>   - VQ-regularized latent spaces에서 학습된 LDM 모델이 더 좋은 sample quality를 보여줬으며, VQ-reqularized 1단계 모델의 재구성 능력은 continuous counterparts에 비해 뒤처짐
> ![](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.png)

> [!note]
>   - 해상도를 > 256^2로 해야 시각화 능력이 상승
> ![](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.png)

> [!note]
> **학습 및 추론 아키텍처 디테일(논문 E절에 기술)**
> ![](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.png)
> 
> ![](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.png)

## 4.1. On Perceptual Compression Tradeoffs

---

> [!note]
> Down Sampling factors {1,2,4,8,16,32}에 따른 품질 변화
>   - 2백만 step동안 훈련했으며 DownSampling Factor(f)가 낮으면(1, 2) 학습이 느리게 되고 f가 너무 높으면(32) 전반적인 sample quality에 제한이 생김 → {4, 16}이 적당함
> 
> ![](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.png)
> 
>   - downsampling을 4로 한 후 다른 모델과 비교한 결과
> ![](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.png)
> 
>   - CelebA-HQ와 ImageNet에서 DDIM Sampler를 이용한 FID, throughput 비교
> ![](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.png)
> 
>     - LDM {4, 8} 모델은 다른 모델에 비해 뛰어난 성능을 보여줌
> 
>     - 특히 픽셀 기반 LDM-1과 비교할 때 LDM {4, 8}이 훨씬 좋은 성능(낮은 FID 점수와 높은 샘플 처리량)을 보여줌

## 4.2. Image Generation with Latent Diffusion

---

> [!note]
> **Sample quality 평가, FID, Precision-and-Recall**
> ![](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.png)

## 4.3. Conditional Latent Diffusion

---

### 4.3.1 Transformer Encoders for LDMs

---

- 텍스트 이미지 모델링을 위해 14억 5천만 개의 매개변수를 가진 KL-정규화된 LDM을 훈련함

- BERT-tokenizer를 이용해 훈련하며 다중 헤드 크로스-어텐션을 통해 UNet에 맵핑됨

- AR 및 GAN 기반 방법들보다 개선된 성능을 보임

### 4.3.2 Convolutional Sampling Beyond 256^2

---

- LDM은 공간적으로 정렬된 조건부 정보를 연결하여 효율적인 범용 이미지 변환 모델로 사용됨

- semantic synthesis, super-resolution, inpainting 모델 훈련, 메가 픽셀 해상도까지 이미지 생성 가능

- Latent space의 PSNR이 결과 품질에 중요한 영향을 미침

> [!note]
> ![](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.png)

## 4.4. Super-Resolution with Latent Diffusion

---

> [!note]
> **LDM을 활용한 Super Resolution과 SR3 비교**
>   1. 그림
> ![](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.png)
> 
>     - 저해상도 이미지를 직접 조건화하여 초해상도 모델로 훈련 가능
> 
>   1. 표
> ![](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.png)
> 
>     - SR3와 비교해 FID에서 우수한 성능을 보이며, IS는 SR3가 더 우수함
> 
>     - 단순 이미지 회귀 모델은 PSNR 및 SSIM에서 최고 성과를 기록했지만, 인간 지각과는 잘 일치하지 않음. 이는 흐릿한 이미지를 선호하는 경향 때문임
> 
>   1. 사용자 연구
> ![](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.png)
> 
>     - PSNR 및 SSIM 개선, BSR
>       - 사후 가이딩(post-hoc guiding): PSNR 및 SSIM 점수를 개선하기 위한 메커니즘
> 
>       - 구현 방식: 이미지 기반 가이더(image-based guider)를 지각 손실(percepptual loss)로 구현
> 
> ![](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.png)
> 
>       - bicubic 다운샘플링으로만 학습되었기 때문에, 실제 세계 이미지에 일반화 x
> 
>       - BSR-Degradation Pipeline
>         - 기존 bicubic 다운샘플링을 대체하여 다양한 열화(degradation)을 적용
> 
>         - JPEG 압축 노이즈
> 
>         - 카메라 센서 노이즈
> 
>         - 다양한 이미지 다운샘플링 인터폴레이션
> 
>         - 가우시안 블러 커널
> 
>         - 가우시안 노이즈

## 4.5. Inpainting with Latent Diffusion

---

> [!note]
> **Inpainting 모델 비교**
>   - 모델 실험 결과
> ![](/assets/notion/latent-diffusion-models-study-note-17b8d6e1cee5.png)
> 
>     - 모델 구성
>       - VQ-regularized 첫 번째 단계의 latent space에서 큰 Diffusion 모델을 학습
> 
>       - UNet 구조는 세 가지 특징 계층에 대해 attention 레이어를 사용하고, BigGAN residual block을 사용하여 업샘플링 및 다운샘플링
> 
>       - 모델 파라미터 수는 387M으로, 기존 모델인 215M보다 훨씬 큼
> 
>     - 품질 차이
>       - 256^2 및 512^2 해상도에서 샘플 품질에 불일치가 발생했으며, 이는 추가된 attention 모듈에 의해 발생했다고 추측됨
> 
>       - Fine-tuning을 통해 해상도 512^2에서 반 epoch 동안 모델을 조정한 후, 모델이 새로운 특징 통계에 적응하고 최신 FID를 기록을 달성

---

---

# 5. Limitations & Societal Impact

---

> [!note]
> **Limitations**
>   - Pixel-based approach에 비해 계산 요구 사항이 크게 줄지만, 샘플링 과정이 GANs보다 여전히 느림
> 
>   - f= 4 autoencoding 모델에서는 이미지 품질 손실이 매우 적지만, 픽셀 공간에서의 세밀한 정확도를 요구하는 작업에서는 재구성 능력이 병목이 될 수 있음

> [!note]
> **Social Impact**
>   - 딥러닝 모듈이 이미 존재하는 데이터 편향을 재현하거나 악화시키는 경향이 있음
> 
>   - GAN 기반 접근법보다 데이터 분포를 더 잘 포괄하지만, 우리의 이단계 접근법(adversarial training and likelihood-based objective)이 데이터 왜곡을 얼마나 초래할 수 있는 지에 대한 연구 질문이 남아 있음

---

---

# 6. Conclusion

---

- 훈련과 샘플링 효율성을 현저히 향상시키면서도 이미지 품질을 저하시키지 않는 방법을 제시

- 또한, cross-attention based mechanism을 통해, 특정 작업 전용 아키텍처 없이 다양한 조건부 이미지 생성 작업에서 최신 기법들과 비교하여 유리한 결과를 얻었음

---

---
