---
title: LangSmith
---

# LangSmith

LangSmith는 LLM 애플리케이션의 실행 과정을 추적하고, 문제를 디버깅하고, 이후 평가와 운영 관측으로 이어 가기 좋게 정리해 주는 도구입니다.

처음에는 tracing과 project 구성을 중심으로 익히고, 이후에는 evaluation, automation, feedback 흐름까지 확장하는 식이 안정적입니다.

## 글 목록

- [[libraries/langsmith/langsmith-online-code-evaluators|LangSmith online code evaluator로 운영 trace 품질 가드레일 걸기]]
- [[libraries/langsmith/langsmith-custom-run-id-feedback|LangSmith custom run ID로 feedback과 조회 흐름 안정적으로 연결하기]]
- [[libraries/langsmith/langsmith-evaluate-with-opentelemetry|LangSmith OpenTelemetry trace를 experiment로 평가하기]]
- [[libraries/langsmith/langsmith-upload-external-experiments-rest-api|LangSmith REST API로 외부 실험 결과 업로드하기]]
- [[libraries/langsmith/langsmith-create-feedback-list-feedback|LangSmith create_feedback와 list_feedback으로 사용자 평가 수집하고 분석하기]]
- [[libraries/langsmith/langsmith-tracing-sampling-conditional|LangSmith tracing sampling과 conditional tracing으로 필요한 trace만 남기기]]
- [[libraries/langsmith/langsmith-pytest-evals-ci|LangSmith pytest로 LLM eval과 회귀 테스트를 CI에 붙이기]]
- [[libraries/langsmith/langsmith-manage-evaluators-sdk|LangSmith evaluators를 SDK로 생성·수정·비용 추적하기]]
- [[libraries/langsmith/langsmith-trace-routing-projects-workspaces|LangSmith tracing_context로 trace를 project, workspace, replica로 라우팅하기]]
- [[libraries/langsmith/langsmith-evaluate-existing-experiment|LangSmith 기존 experiment에 evaluator만 다시 붙이기]]
- [[libraries/langsmith/langsmith-pairwise-evaluation-experiments|LangSmith pairwise evaluation으로 실험 결과 비교하기]]
- [[libraries/langsmith/langsmith-retry-failed-evaluation-examples|LangSmith evaluation에서 실패한 example만 재시도하기]]
- [[libraries/langsmith/langsmith-offline-evaluation-quickstart|LangSmith offline evaluation 빠르게 시작하기: dataset, evaluate(), aevaluate()]]
- [[libraries/langsmith/langsmith-evaluate-intermediate-steps|LangSmith evaluate()에서 중간 단계까지 평가하기: run/rootRun 실전 패턴]]
- [[libraries/langsmith/langsmith-tracing-quickstart|LangSmith tracing 빠르게 붙이기: traceable과 wrap_openai 실전 예제]]
- [[libraries/langsmith/langsmith-dataset-splits-version-tags|LangSmith dataset split과 version tag로 평가축 고정하기]]
- [[libraries/langsmith/langsmith-annotation-queues-sdk|LangSmith annotation queue로 사람 검토 흐름 만들기]]
- [[libraries/langsmith/langsmith-assertions-offline-evals|LangSmith assertion으로 human review를 offline eval로 연결하기]]
- [[libraries/langsmith/langsmith-presigned-feedback-tokens|LangSmith presigned feedback token으로 프론트엔드 사용자 평가 수집하기]]
- [[libraries/langsmith/langsmith-prompt-commit-tags-cache|LangSmith prompt commit tag로 프로젝트 배포 고정하기]]
- [[libraries/langsmith/langsmith-automation-rules-webhooks|LangSmith automation rule과 webhook으로 운영 알림 자동화하기]]
- [[libraries/langsmith/langsmith-threads-query-sdk|LangSmith thread_id로 멀티턴 상태 추적하고 SDK로 조회하기]]
- [[libraries/langsmith/langsmith-cli-traces-datasets-threads|LangSmith CLI로 trace, dataset, thread를 터미널에서 바로 보기]]
- [[libraries/langsmith/langsmith-bulk-export-s3-parquet|LangSmith bulk export로 trace를 S3/Parquet로 내보내기]]
- [[libraries/langsmith/langsmith-annotation-queue-rubric-sdk|LangSmith annotation queue rubric을 코드로 관리하기]]
- [[libraries/langsmith/langsmith-evaluate-with-attachments|LangSmith attachments로 멀티모달 evaluation 운영하기]]
- [[libraries/langsmith/langsmith-query-traces-sdk|LangSmith list_runs로 운영 trace를 정밀하게 조회하기]]
- [[libraries/langsmith/langsmith-experiment-metrics-sdk|LangSmith read_project(include_stats=True)로 experiment 지표 가져오기]]
- [[libraries/langsmith/langsmith-feedback-formulas-sdk|LangSmith feedback formula로 여러 평가 점수를 composite metric으로 묶기]]
- [[libraries/langsmith/langsmith-annotation-queue-sdk|LangSmith annotation queue를 Python SDK로 운영하기]]
- [[libraries/langsmith/langsmith-mask-sensitive-traces|LangSmith에서 민감정보를 가리고 trace를 남기는 방법]]
