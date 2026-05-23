---
title: "Medical SAM Adapter: SAM을 의료 영상에 맞추는 방법"
description: Medical SAM Adapter 논문을 읽고 SAM이 의료 영상에서 약해지는 이유와 adapter 기반 domain adaptation을 정리한 공부 노트
date: 2026-05-23
tags:
  - paper-review
  - medical-ai
  - segmentation
  - sam
---

# Medical SAM Adapter: SAM을 의료 영상에 맞추는 방법

읽은 논문은 **Medical SAM Adapter**이다.  
SAM이 일반 이미지 segmentation에서는 강력하지만, 의료 영상에서는 그대로 쓰기 어렵다는 문제의식에서 출발한다.

## 왜 SAM을 그대로 쓰기 어려울까

의료 영상은 일반 자연 이미지와 다르게 보이는 경우가 많다.

- 조직 경계가 흐릿하다.
- 병변이 작거나 대비가 약하다.
- MRI, CT, 초음파처럼 modality마다 분포가 다르다.
- 일반 이미지에서 학습한 object prior가 잘 맞지 않는다.

SAM은 큰 규모의 일반 이미지 데이터로 학습되었기 때문에, 의료 영상의 이런 특성을 충분히 알고 있다고 보기 어렵다. 그래서 vanilla SAM을 의료 영상에 바로 적용하면 segmentation 성능이 크게 떨어질 수 있다.

## 논문의 핵심 아이디어

Medical SAM Adapter는 SAM 전체를 다시 학습하지 않고, 기존 SAM은 대부분 freeze한 뒤 작은 adapter를 추가해 의료 영상에 맞춘다.

이 접근이 흥미로운 이유는 parameter-efficient adaptation이기 때문이다.  
논문에서는 전체 parameter 중 일부만 업데이트하면서도 여러 의료 영상 segmentation task에서 성능을 끌어올린다.

내가 이해한 핵심은 이렇다.

- SAM이 이미 가진 일반 segmentation 능력은 최대한 유지한다.
- 의료 영상에 필요한 domain-specific feature는 adapter가 보완한다.
- 전체 모델을 다 fine-tuning하는 것보다 계산 비용과 overfitting 위험을 줄인다.

## SAM 구조와 adapter 위치

SAM은 크게 Image Encoder, Prompt Encoder, Mask Decoder로 구성된다.  
Medical SAM Adapter는 이 구조를 완전히 바꾸기보다, SAM 내부에 adapter 모듈을 삽입한다.

adapter는 보통 bottleneck 구조를 가진다.  
차원을 줄이는 down projection, 비선형 함수, 다시 차원을 올리는 up projection을 거치면서 적은 parameter로 feature를 조정한다.

이 방식은 “큰 모델을 그대로 다시 학습하기 어렵다면, 중간에 작은 조정 장치를 넣자”는 관점으로 볼 수 있다.

## SD-Trans와 HyP-Adpt

논문에서 제안하는 중요한 구성은 SD-Trans와 HyP-Adpt이다.

SD-Trans는 3D volume에서 spatial dimension과 depth dimension 사이의 상관관계를 다루기 위한 방법이다. 의료 영상은 2D slice만 보는 것보다 인접 slice 사이의 관계가 중요한 경우가 많기 때문에, depth 정보를 어떻게 반영할지가 중요하다.

HyP-Adpt는 prompt embedding을 활용해 adapter feature를 조정한다.  
prompt가 단순히 mask decoder에만 들어가는 것이 아니라, adapter가 어떤 feature를 강조할지에도 영향을 주는 구조로 이해했다.

## 실험에서 봐야 할 점

논문은 여러 modality와 task에서 실험한다. BTCV, REFUGE2, BraTS 2021, thyroid ultrasound, skin lesion segmentation 같은 다양한 의료 영상 데이터셋이 포함된다.

인상적이었던 점은 단일 task에만 맞춘 것이 아니라, 여러 의료 segmentation 문제에서 adapter 기반 접근의 효과를 보였다는 것이다. 특히 vanilla SAM과 비교했을 때 의료 domain adaptation의 필요성이 분명하게 드러난다.

## 내가 가져간 생각

이 논문은 foundation model을 의료 AI에 적용할 때 무작정 전체 fine-tuning을 하기보다, domain gap을 줄이는 작은 모듈을 어디에 넣을지 고민하는 예시로 볼 수 있다.

의료 영상에서는 데이터가 제한적이고 annotation 비용이 크다. 그래서 모든 parameter를 업데이트하는 방식보다, 기존 foundation model의 지식을 유지하면서 필요한 부분만 조정하는 접근이 현실적으로 중요해 보인다.

## 아직 더 보고 싶은 부분

- adapter를 Image Encoder 어디에 넣을 때 가장 효과적인지
- 2D 의료 영상과 3D volume에서 adapter 설계가 어떻게 달라져야 하는지
- prompt 품질이 낮을 때 HyP-Adpt가 얼마나 안정적으로 작동하는지
- MedSAM처럼 full fine-tuning한 방식과 실제 deployment 비용 차이가 얼마나 나는지
