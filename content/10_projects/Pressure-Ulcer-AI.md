---
title: Pressure Ulcer AI
type: project
tags: [medical-ai, computer-vision, classification, portfolio]
source:
  - https://github.com/Lee-jun-young98/pressure_ulcer
---

# Pressure Ulcer AI

욕창 상처 이미지를 기반으로 욕창 단계를 분류하는 의료 이미지 AI 프로젝트입니다.

## Problem

의료 이미지는 일반 이미지보다 데이터 품질, 클래스 불균형, 해석 가능성, 개인정보 보호를 더 신중하게 다뤄야 합니다. 단순히 분류 정확도만 보는 것이 아니라 모델이 어떤 영역을 보고 판단하는지, 실제 활용 가능성이 있는지도 함께 확인해야 합니다.

## What I Built

- 욕창 상처 이미지 데이터 기반 6개 클래스 분류 문제 정의
- train, validation, test 분리 흐름 구성
- CNN/Transformer 기반 모델 실험 방향 정리
- Docker, CUDA, GPU 서버 환경을 고려한 학습 구조 검토
- Grad-CAM 등 설명 가능성 기법 적용 방향 정리

## What I Learned

- 의료 AI에서는 데이터 전처리와 라벨 기준이 모델 성능만큼 중요하다는 점
- 이미지 분류 결과를 신뢰하려면 예측 근거를 함께 보여주는 과정이 필요하다는 점
- 민감한 데이터는 공개 범위와 비식별 처리 기준을 먼저 정해야 한다는 점

## Direction

공개 가능한 범위 안에서 데이터 흐름, 모델 비교 방식, 설명 가능성 결과를 정리해 의료 이미지 AI 포트폴리오 프로젝트로 다듬을 예정입니다.
