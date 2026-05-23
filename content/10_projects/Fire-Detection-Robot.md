---
title: Fire Detection Robot
type: project
status: draft
tags: [object-detection, yolo, edge-ai, portfolio]
source:
  - https://github.com/Lee-jun-young98/Fire_detection
  - https://www.notion.so/84b4ffd1ac1a4dff9c99a2df1a3a6099
---

# Fire Detection Robot

## 한 줄 요약

YOLO 기반 화재/연기 객체 탐지 모델을 학습하고 Jetson/OpenCV 연동까지 고려한 Edge AI 프로젝트.

## 확인된 자료

- AIHub 열화상/화재 발생 예측 데이터셋 참고
- YOLOX 기반 object detection
- 화재, 연기, 구름, 안개, 조명 등 다중 클래스 구성
- Jetson, OpenCV 카메라 연동 실험
- PyTorch, TFLite, ONNX 모델 파일 정리 흔적

## 이력서용 문장 초안

- AIHub 화재/연기 데이터셋을 활용해 YOLOX 기반 객체 탐지 모델을 학습
- 화재/연기와 구름/조명/안개 등 오탐 가능 클래스를 분리해 탐지 문제를 정의
- Jetson 및 OpenCV 카메라 연동을 고려해 Edge AI 추론 환경을 구성

## PPT에 넣을 자료

- 입력 영상 -> YOLO 탐지 -> 후처리 -> 알림/로봇 제어 흐름
- 클래스 목록
- 탐지 결과 이미지
- Jetson 또는 카메라 연동 사진
- 수상/졸업 프로젝트 자료