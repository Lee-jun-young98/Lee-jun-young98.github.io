---
title: LangSmith
---

# LangSmith

LangSmith는 LLM 애플리케이션의 실행 과정을 추적하고, 문제를 디버깅하고, 이후 평가와 운영 관측으로 이어 가기 좋게 정리해 주는 도구다.

처음에는 tracing과 project 구성을 중심으로 익히고, 이후에는 evaluation, automation, feedback 흐름까지 확장하는 식이 안정적이다.

## 글 목록

- [[libraries/langsmith/langsmith-offline-evaluation-quickstart|LangSmith offline evaluation quickstart with dataset and evaluate()]]
- [[libraries/langsmith/langsmith-tracing-quickstart|LangSmith tracing 빠르게 붙이기: traceable과 wrap_openai 실전 예제]]
- [[libraries/langsmith/langsmith-dataset-splits-version-tags|LangSmith dataset split과 version tag로 평가 기준 고정하기]]
- [[libraries/langsmith/langsmith-annotation-queues-sdk|LangSmith annotation queue로 사람 검토 흐름 만들기]]
- [[libraries/langsmith/langsmith-prompt-commit-tags-cache|LangSmith prompt commit tag로 프롬프트 배포 고정하기]]
- [[libraries/langsmith/langsmith-automation-rules-webhooks|LangSmith automation rule과 webhook으로 운영 액션 자동화하기]]
- [[libraries/langsmith/langsmith-threads-query-sdk|LangSmith thread_id로 멀티턴 대화 추적하고 SDK로 조회하기]]
- [[libraries/langsmith/langsmith-query-traces-sdk|LangSmith list_runs로 운영 trace를 정밀하게 조회하기]]
- [[libraries/langsmith/langsmith-experiment-metrics-sdk|LangSmith read_project(include_stats=True)로 experiment 지표 가져오기]]
