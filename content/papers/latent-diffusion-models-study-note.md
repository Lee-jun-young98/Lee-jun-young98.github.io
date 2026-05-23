---
title: "Latent Diffusion Models: 픽셀 대신 latent에서 확산하기"
description: High-Resolution Image Synthesis with Latent Diffusion Models를 읽고 latent space, autoencoder, cross-attention 중심으로 정리한 공부 노트
date: 2026-05-23
tags:
  - paper-review
  - diffusion
  - latent-diffusion
  - generative-model
---

# Latent Diffusion Models: 픽셀 대신 latent에서 확산하기

읽은 논문은 Robin Rombach 등의 **High-Resolution Image Synthesis with Latent Diffusion Models**이다.  
Stable Diffusion 계열을 이해하려면 LDM을 먼저 잡아야 할 것 같아서 읽었다.

## 왜 latent에서 diffusion을 할까

DDPM처럼 pixel space에서 diffusion을 하면 고해상도 이미지에서는 계산량이 너무 커진다.  
논문은 이 문제를 해결하기 위해 이미지를 바로 다루지 않고, pretrained autoencoder가 만든 latent space에서 diffusion을 수행한다.

처음에는 “latent로 줄이면 정보가 너무 많이 사라지지 않을까?”라는 생각이 들었다. 그런데 논문에서는 perceptual compression과 semantic compression을 나눠서 설명한다. 이미지의 모든 pixel-level detail을 생성 모델이 직접 다루게 하지 않고, autoencoder가 어느 정도 압축한 표현 위에서 생성 과정을 학습하게 만든다.

## 전체 구조

구조는 크게 두 단계로 볼 수 있다.

1. Autoencoder를 학습해서 이미지를 latent `z`로 압축하고 다시 복원할 수 있게 한다.
2. Diffusion model은 이미지가 아니라 latent `z` 위에서 denoising을 학습한다.

Encoder는 이미지 `x`를 latent representation으로 보내고, decoder는 latent를 다시 이미지로 복원한다. Diffusion model은 이 latent 공간에서 noise를 추가하고 제거한다.

이렇게 하면 pixel space보다 훨씬 작은 공간에서 diffusion을 수행할 수 있어서, 고해상도 이미지 합성의 계산 부담을 줄일 수 있다.

## Downsampling factor가 중요하다

논문에서 흥미로웠던 부분은 latent를 얼마나 압축할지에 대한 trade-off였다.  
downsampling factor가 너무 작으면 pixel space와 크게 다르지 않아 계산 이점이 줄어든다. 반대로 너무 크게 압축하면 복원 품질이 떨어진다.

논문에서는 `f=4`에서 `f=16` 정도가 속도와 품질 사이에서 좋은 균형을 보인다고 설명한다. 이 부분은 단순히 “latent가 좋다”가 아니라, 얼마나 압축하느냐가 모델 품질에 직접 영향을 준다는 점에서 중요하게 느껴졌다.

## Cross-attention의 역할

LDM이 강력해지는 또 다른 이유는 conditioning을 cross-attention으로 유연하게 넣을 수 있다는 점이다.  
텍스트, bounding box, segmentation map 같은 조건을 transformer encoder로 표현한 뒤, UNet 내부의 cross-attention layer에서 latent feature와 결합한다.

이 구조 덕분에 text-to-image, inpainting, super-resolution 같은 여러 task에 같은 diffusion backbone을 활용할 수 있다.

내가 이해한 핵심은 이렇다.  
Diffusion model은 latent를 점점 복원하는 역할을 하고, cross-attention은 “어떤 방향으로 복원해야 하는지”에 대한 조건을 넣어주는 통로다.

## 인상적이었던 점

LDM은 diffusion의 품질을 유지하면서 계산 비용을 줄이려는 접근이다. 단순히 모델을 작게 만드는 것이 아니라, 생성이 일어나는 공간 자체를 바꾼다.

이 관점이 좋았다. 모델 구조를 조금 바꾸는 것보다, 문제를 푸는 표현 공간을 바꾸는 것이 더 큰 차이를 만들 수 있다는 예시처럼 보였다.

## 한계도 같이 보기

논문에서도 LDM이 완벽하다고 말하지 않는다.  
GAN보다 sampling이 느리고, autoencoder를 거치기 때문에 pixel-level accuracy가 중요한 작업에서는 복원 bottleneck이 생길 수 있다.

즉 LDM은 고해상도 생성에서 매우 실용적인 선택이지만, 모든 작업에서 pixel space diffusion을 완전히 대체한다기보다는 비용과 품질 사이의 균형을 잘 잡은 방식으로 보는 게 맞을 것 같다.

## 다음에 해볼 것

- autoencoder의 reconstruction 결과와 latent diffusion 결과를 나눠서 보기
- downsampling factor가 커질수록 어떤 detail이 먼저 사라지는지 확인하기
- cross-attention map을 시각화해서 text condition이 어디에 반영되는지 보기
