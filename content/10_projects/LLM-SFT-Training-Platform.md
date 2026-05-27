---
title: LLM SFT Training Platform
type: project
tags: [llm, sft, hydra, mlops, portfolio]
source:
  - https://github.com/Lee-jun-young98/ai-train-code-main
---

# LLM SFT Training Platform

Hydra 설정을 기반으로 QA CSV 데이터 전처리, LLM SFT 학습, 평가, 산출물 업로드까지 이어지는 학습 파이프라인을 구성한 프로젝트입니다.

## Problem

LLM 학습 프로젝트에서는 모델마다 프롬프트 형식, tokenizer 처리, LoRA 설정, 평가 방식, 산출물 저장 경로가 달라집니다. 이를 코드 안에 흩어두면 실험을 반복하거나 비교하기 어려워지고, 나중에 같은 조건으로 재현하기도 힘들어집니다.

## What I Built

- Hydra 기반 설정 구조로 모델, 데이터, 학습 옵션, 프롬프트를 분리
- GPT, Gemma3, HyperCLOVAX 계열 모델별 trainer 구조 정리
- QA CSV 데이터의 질문/답변 스키마 전처리 흐름 구성
- ROUGE 기반 평가 로직과 결과 저장 흐름 구성
- S3/MinIO 업로드를 고려한 학습 산출물 관리 구조 설계

## What I Learned

- 학습 코드는 모델 성능뿐 아니라 재현성과 설정 관리가 중요하다는 점
- 모델별 차이를 trainer 계층으로 분리하면 확장성이 좋아진다는 점
- 실험 결과를 남기려면 config, checkpoint, metric, output 경로가 함께 관리되어야 한다는 점

## Direction

다음 단계에서는 공개 가능한 샘플 데이터와 실행 예시를 정리해, 처음 보는 사람도 파이프라인 구조를 이해할 수 있도록 문서화할 예정입니다.
