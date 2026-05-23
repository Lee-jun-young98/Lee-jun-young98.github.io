---
title: "DDPM: 노이즈를 예측하는 생성 모델로 이해하기"
description: Denoising Diffusion Probabilistic Models를 읽고 forward process, reverse process, epsilon prediction 중심으로 정리한 공부 노트
date: 2026-05-23
tags:
  - paper-review
  - diffusion
  - generative-model
---

# DDPM: 노이즈를 예측하는 생성 모델로 이해하기

읽은 논문은 Jonathan Ho, Ajay Jain, Pieter Abbeel의 **Denoising Diffusion Probabilistic Models**이다.  
Diffusion model의 기본 구조를 이해하려고 읽었고, 특히 “왜 이미지를 직접 생성하는 대신 노이즈를 조금씩 제거하는 방식으로 생각하는가?”에 집중했다.

## 한 줄로 이해한 내용

DDPM은 데이터를 한 번에 생성하지 않고, 완전한 노이즈에서 시작해 여러 단계에 걸쳐 노이즈를 제거하면서 샘플을 만든다.

학습할 때는 실제 이미지에 점점 Gaussian noise를 추가하는 forward process를 정의하고, 모델은 그 과정을 거꾸로 되돌리는 reverse process를 배운다.

## Forward process

Forward process는 원본 이미지 `x_0`에 조금씩 노이즈를 섞어 `x_T`에 가까워질수록 거의 순수한 Gaussian noise가 되게 만든다.

중요한 점은 이 과정은 학습되는 게 아니라 미리 정해진다는 것이다.  
`beta_t`라는 noise schedule에 따라 각 step에서 얼마나 많은 노이즈를 추가할지 결정한다.

처음에는 “굳이 이미지를 망가뜨리는 과정을 왜 넣지?”라고 생각했는데, 이렇게 해두면 reverse process가 배워야 할 목표가 명확해진다. 모델은 각 단계에서 이전보다 조금 더 깨끗한 이미지를 복원하는 방향으로 학습된다.

## Reverse process

Reverse process는 `x_T`에서 시작해서 `x_0`를 향해 가는 생성 과정이다.  
논문에서는 이 과정을 parameterized Markov chain으로 보고, 각 step의 Gaussian transition을 neural network가 예측하도록 한다.

여기서 내가 중요하게 본 부분은 모델이 “완성된 이미지”를 바로 맞히는 것이 아니라는 점이다. 모델은 현재 noisy sample에서 제거해야 할 노이즈를 예측한다.

이 단순화된 epsilon prediction objective가 실제 sample quality에 좋게 작동한다는 점이 DDPM의 핵심 중 하나로 보였다.

## 학습 목표를 어떻게 볼 수 있을까

논문은 variational bound 관점에서 학습 목표를 설명한다. 처음 읽을 때는 KL term과 likelihood 식이 부담스러웠지만, 직관적으로는 다음처럼 이해했다.

- forward process는 이미지를 noise로 보내는 고정된 과정이다.
- reverse process는 noise에서 이미지로 돌아오는 학습 가능한 과정이다.
- 모델은 각 step에서 “이 noisy image에 섞인 noise가 무엇인지”를 맞힌다.

즉 모델이 노이즈를 잘 맞히면, 샘플링할 때 그 노이즈를 제거하면서 점점 이미지다운 결과를 만들 수 있다.

## 인상적이었던 점

DDPM은 CIFAR-10에서 좋은 FID와 Inception Score를 보였지만, 개인적으로 더 흥미로웠던 건 생성 과정을 해석하는 방식이었다. GAN처럼 한 번에 이미지를 뽑는 방식보다 느리지만, 생성이 여러 denoising step으로 나뉘기 때문에 학습 과정의 의미가 비교적 분명하게 느껴졌다.

또 diffusion이 denoising score matching, Langevin dynamics와 연결된다는 설명도 중요해 보였다. 아직 수식까지 완전히 편하게 다루지는 못했지만, diffusion model이 단순한 trick이 아니라 확률 모델링 관점에서 이어지는 구조라는 점을 확인했다.

## 아직 헷갈리는 부분

- variational bound의 각 KL term이 실제 구현에서 어떻게 단순화되는지
- noise schedule을 바꾸면 sample quality와 학습 안정성이 어떻게 달라지는지
- DDPM 이후 모델들이 sampling 속도를 줄이기 위해 어떤 아이디어를 추가했는지

## 다음에 해볼 것

작은 이미지 데이터셋으로 forward process를 직접 시각화해보고 싶다.  
원본 이미지가 step마다 어떻게 noise로 변하는지, 그리고 학습된 모델이 반대로 어떻게 denoising하는지 보면 논문 구조가 훨씬 잘 잡힐 것 같다.
