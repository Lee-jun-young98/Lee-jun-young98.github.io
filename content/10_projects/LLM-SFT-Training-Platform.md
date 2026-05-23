---
title: LLM SFT Training Platform
type: project
status: draft
tags: [llm, sft, hydra, mlops, portfolio]
source:
  - https://github.com/Lee-jun-young98/ai-train-code-main
---

# LLM SFT Training Platform

## 한 줄 요약

Hydra 기반 설정으로 QA CSV 데이터를 전처리하고, `gpt`, `gemma3`, `hyperclovax` 계열 LLM의 SFT 학습/평가/산출물 업로드까지 실행하는 학습 파이프라인.

## 문제

LLM 학습 프로젝트에서는 모델별 프롬프트 형식, 전처리 방식, LoRA 설정, 평가 방식, 산출물 저장 경로가 자주 달라집니다. 이를 매번 수동으로 관리하면 재현성과 운영성이 떨어집니다.

## 접근

- Hydra 설정 파일로 모델/학습/데이터/프롬프트 설정 분리
- 모델별 trainer를 분리해 확장 가능한 구조 구성
- QA CSV의 질문/답변 스키마 정규화
- ROUGE 기반 평가 로직 구성
- S3/MinIO로 학습 산출물 업로드

## PPT에 넣을 자료

- 전체 학습 파이프라인 다이어그램
- `configs/`, `trainer/`, `preprocessing/`, `metrics/`, `utils/` 구조 캡처
- trainer 추가 흐름
- 산출물 업로드 경로 설명

## 블로그 글 방향

- Hydra로 LLM SFT 학습 파이프라인을 재현 가능하게 만들기
- GPT/Gemma/HyperCLOVAX trainer를 하나의 구조로 관리하기

## 공개 전 점검

- S3/API 설정 제거
- 내부 모델 경로 제거
- 공개 가능한 샘플 데이터만 사용