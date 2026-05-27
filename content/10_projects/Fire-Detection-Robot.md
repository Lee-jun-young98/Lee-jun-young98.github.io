---
title: Fire Detection Robot
type: project
tags: [object-detection, yolo, edge-ai, portfolio]
source:
  - https://github.com/Lee-jun-young98/Fire_detection
---

# Fire Detection Robot

YOLO 기반으로 화재와 연기를 탐지하고, Jetson/OpenCV 연동을 고려한 edge AI 프로젝트입니다.

## Problem

화재 탐지는 단순한 객체 탐지보다 오탐과 미탐의 비용이 큽니다. 연기, 구름, 조명, 안개처럼 비슷하게 보이는 장면을 구분해야 하고, 실제 환경에서는 카메라 입력과 edge 장비의 추론 속도까지 고려해야 합니다.

## What I Built

- 화재/연기 객체 탐지 문제 정의
- YOLO 계열 모델을 활용한 detection 학습 구조 정리
- 화재, 연기, 구름, 안개, 조명 등 혼동 가능 클래스를 고려한 데이터 구성
- Jetson, OpenCV, camera input을 고려한 추론 흐름 검토
- PyTorch, TFLite, ONNX 변환 및 배포 가능성 정리

## What I Learned

- detection 프로젝트에서는 클래스 정의와 negative sample 구성이 중요하다는 점
- edge 환경에서는 정확도뿐 아니라 추론 속도와 모델 포맷도 함께 봐야 한다는 점
- 실제 로봇/카메라 연동을 고려하면 모델 개발과 시스템 구성이 함께 설계되어야 한다는 점

## Direction

탐지 결과 예시, 모델 변환 흐름, edge 추론 구조를 보강해 실제 동작 흐름이 보이는 프로젝트로 정리할 예정입니다.
