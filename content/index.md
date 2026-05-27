---
title: Junyoung AI Study Notes
---

# Junyoung AI Study Notes

AI 모델을 공부하고, 학습 파이프라인과 프로젝트로 검증하는 과정을 기록합니다.

현재는 LLM fine-tuning, computer vision, medical AI, generative AI, MLOps를 중심으로 공부하고 있습니다. 글은 완성된 결론보다 문제를 이해하고 실험으로 확인하는 흐름을 남기는 데 초점을 둡니다.

## Focus

- LLM fine-tuning과 SFT 학습 파이프라인
- Computer vision과 medical image AI
- Diffusion model, multimodal model, AI agent 논문 리뷰
- Docker, Hydra, GPU 서버, S3/MinIO 기반 실험 관리

## Projects

- [[10_projects/LLM-SFT-Training-Platform|LLM SFT Training Platform]]  
  Hydra 설정 기반으로 QA 데이터 전처리, 모델별 trainer, 평가, 산출물 업로드까지 이어지는 학습 파이프라인을 정리한 프로젝트입니다.

- [[10_projects/Pressure-Ulcer-AI|Pressure Ulcer AI]]  
  욕창 상처 이미지를 기반으로 단계 분류 모델을 설계하고, 의료 이미지 분류와 설명 가능성을 함께 검토한 프로젝트입니다.

- [[10_projects/Fire-Detection-Robot|Fire Detection Robot]]  
  YOLO 기반 화재/연기 객체 탐지 모델을 학습하고, Jetson/OpenCV 연동을 고려한 edge AI 프로젝트입니다.

## Study Notes

- [[papers/index|Paper Reviews]]  
  vision, generative AI, multimodal, agent, LLM 논문을 읽고 핵심 아이디어와 구현 관점을 정리합니다.

- [[blog/hydra-llm-sft-training-pipeline|Hydra로 LLM SFT 실험 설정 정리하기]]  
  LLM 학습 프로젝트에서 설정을 구조화하며 배운 점을 정리한 글입니다.

## Direction

저는 모델 자체를 이해하는 것에서 멈추지 않고, 데이터를 준비하고 실험을 재현하며 결과물을 운영 가능한 형태로 정리하는 AI engineer 방향을 목표로 공부하고 있습니다.
