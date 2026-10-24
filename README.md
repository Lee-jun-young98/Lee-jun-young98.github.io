# Junyoung AI Lab

개발하면서 확인한 내용과 논문을 읽으며 정리한 노트를 모으는 개인 기술 블로그입니다.

**사이트: [lee-jun-young98.github.io](https://lee-jun-young98.github.io)**

LLM Agent, 모델 학습·서빙, Computer Vision을 주로 다룹니다. 로봇 학습과 VLA는 공부하며 실험한 범위를 정리하고 있습니다. 글마다 구현 내용, 실험 결과, 아직 확인하지 못한 부분을 구분해 남기려고 합니다.

## 읽을거리

- [프로젝트](https://lee-jun-young98.github.io/10_projects/) — 구현 과정과 실험 기록
- [라이브러리 노트](https://lee-jun-young98.github.io/libraries/) — LangGraph·LangChain·LangSmith 사용법과 예제
- [논문 노트](https://lee-jun-young98.github.io/papers/) — 읽은 논문의 문제 설정, 방법, 결과 정리
- [블로그](https://lee-jun-young98.github.io/blog/) — 개발하며 배운 내용

## 저장소 구성

| 경로 | 내용 |
| --- | --- |
| `content/` | 사이트에 게시하는 Markdown 문서와 이미지 |
| `quartz/` | 사이트 생성기와 화면 구성 요소 |
| `quartz.config.ts` | 사이트 설정 |
| `quartz.layout.ts` | 페이지 배치 |
| `.github/workflows/deploy.yml` | GitHub Pages 빌드·배포 |

## 로컬에서 보기

배포 환경과 맞추려면 Node.js 24를 사용합니다.

```bash
npm ci
npx quartz build --serve
```

터미널에 표시된 주소로 접속하면 됩니다. 문서는 `content/`에서 수정하며, 정적 사이트만 생성하려면 `npx quartz build`를 실행합니다.

## 사이트 기반

[Quartz v4](https://quartz.jzhao.xyz/)를 바탕으로 구성했습니다. 사이트 생성기와 테마의 원저작자·라이선스는 [LICENSE.txt](LICENSE.txt)에 남겨두었습니다.
