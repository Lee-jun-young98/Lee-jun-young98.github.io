---
title: Pressure Ulcer AI
type: project
status: draft
tags: [medical-ai, computer-vision, classification, portfolio]
source:
  - https://github.com/Lee-jun-young98/pressure_ulcer
  - https://www.notion.so/01f037e00a174a6da6f5f3fbc66233c1
---

# Pressure Ulcer AI

## 한 줄 요약

욕창 환부 이미지를 기반으로 욕창 단계를 분류하는 의료 이미지 AI 프로젝트.

## 확인된 자료

- 삼성서울병원 제공 욕창 환부 이미지 데이터 사용
- 총 9,083건 데이터
- 6개 클래스 분류
- Train / Validation / Test = 7 / 1 / 2
- Docker, CUDA, GPU 서버 환경 사용

## 이력서용 문장 초안

- 삼성서울병원 욕창 환부 이미지 9,083건을 활용해 6개 클래스 욕창 단계 분류 모델을 설계 및 학습
- CNN/Transformer 기반 실험을 수행하고 의료 이미지 분류 모델 성능을 비교
- Grad-CAM 등 설명 가능성 기법을 활용해 임상 적용 가능성을 검토

## PPT에 넣을 자료

- 데이터 클래스 분포
- 전처리 흐름: 원본 이미지 -> crop bbox -> 모델 입력
- 모델 실험 비교표
- Grad-CAM 또는 예측 결과 이미지
- 최종 성능 수치

## 공개 전 점검

- 환자 이미지 비식별 처리 여부 확인
- 내부 성능 수치 공개 가능 여부 확인
- 병원명/데이터 출처 공개 가능 범위 확인