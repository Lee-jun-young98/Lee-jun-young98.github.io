import { QuartzComponent, QuartzComponentProps } from "./types"
import { QuartzPluginData } from "../plugins/vfile"
import { FullSlug, resolveRelative } from "../util/path"
import { unescapeHTML } from "../util/escape"
import { Date as DisplayDate } from "./Date"

const topics = [
  {
    href: "papers/index",
    label: "논문 리뷰",
    subtitle: "연구를 이해하는 시간",
    description: "LLM · VLM · VLA 논문을 읽고 아이디어와 실험 결과를 정리합니다.",
    prefix: "papers/",
    code: "01",
  },
  {
    href: "libraries/index",
    label: "개발 노트",
    subtitle: "라이브러리를 공부하며",
    description: "LangChain · LangGraph · LangSmith의 문서와 예제를 공부한 노트입니다.",
    prefix: "libraries/",
    code: "02",
  },
  {
    href: "10_projects/index",
    label: "프로젝트",
    subtitle: "개인 실습과 프로젝트 정리",
    description: "직접 진행한 프로젝트와 작은 실습을 각 글의 범위에 맞춰 기록합니다.",
    prefix: "10_projects/",
    code: "03",
  },
]

export function isReadingNote(page: QuartzPluginData): boolean {
  const slug = String(page.slug ?? "")
  return (
    topics.some((topic) => slug.startsWith(topic.prefix)) &&
    !slug.endsWith("/index") &&
    !page.frontmatter?.draft
  )
}

export function noteDate(page: QuartzPluginData): globalThis.Date | undefined {
  const published =
    page.frontmatter?.date ?? page.frontmatter?.created ?? page.frontmatter?.published
  if (published) {
    const date = new globalThis.Date(String(published))
    if (!Number.isNaN(date.getTime())) return date
  }
  return page.dates?.modified
}

const featured = [
  {
    slug: "libraries/langgraph/postgres-checkpointer-production",
    title: "다시 시작해도 이어지는 에이전트",
    description: "PostgresSaver의 체크포인트 저장 방식과 사용 예제를 정리한 학습 노트.",
    category: "LangGraph",
  },
  {
    slug: "libraries/langchain/init-chat-model-runtime-configuration",
    title: "요청마다 모델을 안전하게 바꾸려면",
    description: "문서와 예제로 살펴본 런타임 모델 설정, 허용 필드와 설정 충돌.",
    category: "LangChain",
  },
  {
    slug: "libraries/langsmith/langsmith-production-trace-agent-backtesting",
    title: "새 에이전트, 배포 전에 검증하기",
    description: "trace를 활용한 에이전트 비교·평가 방법을 공부하고 정리한 노트.",
    category: "LangSmith",
  },
]

const Home: QuartzComponent = (props: QuartzComponentProps) => {
  const { allFiles, fileData, cfg } = props
  const notes = allFiles.filter(isReadingNote)
  const recent = notes
    .filter((page) => !String(page.slug).startsWith("10_projects/"))
    .sort(
      (a, b) =>
        (noteDate(b)?.getTime() ?? 0) - (noteDate(a)?.getTime() ?? 0) ||
        String(a.slug).localeCompare(String(b.slug)),
    )
    .slice(0, 6)
  const href = (slug: string) => resolveRelative(fileData.slug!, slug as FullSlug)
  const picks = featured.filter((pick) => notes.some((page) => page.slug === pick.slug))

  return (
    <article class="home-page">
      <header class="home-intro">
        <p class="home-eyebrow">JUNYOUNG'S FIELD NOTES</p>
        <h1>
          AI를 개발하며,
          <br />
          배운 것을 기록합니다<span class="home-period">.</span>
        </h1>
        <p class="home-description">
          AI Engineer 이준영입니다. 영상 인식 서비스와 AI 학습·서빙 플랫폼을 개발해 왔습니다.
          <br />
          현재는 LLM Agent의 설계와 구현을 진행하고 있습니다.
        </p>
        <a class="home-about internal" href={href("About")}>
          이 블로그에 대하여 <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section class="home-work" aria-labelledby="work-title">
        <h2 id="work-title">실무에서 해온 일</h2>
        <dl>
          <div>
            <dt>AI 학습·서빙 플랫폼</dt>
            <dd>
              Kubernetes 기반 학습·서빙 환경과 Airflow 학습 파이프라인을 개발·운영했습니다. 학습
              상태 판정 로직을 구현하고 RAG 검색·응답 개선에 참여했습니다.
            </dd>
          </div>
          <div>
            <dt>Computer Vision 서비스</dt>
            <dd>
              하수관로 결함 탐지와 지능형 CCTV의 데이터 처리·모델 개발·서비스 연동을 맡았습니다.
              배포 이후 피드백 대응과 유지보수도 이어갔습니다.
            </dd>
          </div>
          <div>
            <dt>LLM Agent · 설계 및 구현 진행 중</dt>
            <dd>
              Planning → Dispatch → Retrieval → Verify 흐름의 시나리오와 개발·검증용 데이터를
              정의하고, LangGraph 기반 실행 흐름과 도구 연동을 구현하고 있습니다.
            </dd>
          </div>
        </dl>
      </section>

      <section class="home-section" aria-labelledby="study-title">
        <div class="home-section-heading">
          <h2 id="study-title">개인 학습과 실습 기록</h2>
        </div>
        <p class="home-study-description">
          논문을 읽고 라이브러리를 공부하며 남긴 글입니다. 문서·예제에서 배운 내용과 개인 실습을
          정리하며, 실무 경험은 해당 글에서 따로 밝힙니다.
        </p>
        <nav class="home-topics" aria-label="주제별 글 모음">
          {topics.map((topic) => (
            <a class="home-topic internal" href={href(topic.href)}>
              <span class="topic-number">{topic.code}</span>
              <span class="topic-subtitle">{topic.subtitle}</span>
              <h2>
                {topic.label} <span aria-hidden="true">↗</span>
              </h2>
              <p>{topic.description}</p>
              <span class="topic-count">
                {notes.filter((page) => String(page.slug).startsWith(topic.prefix)).length}개의 기록
              </span>
            </a>
          ))}
        </nav>
      </section>

      <section class="home-section" aria-labelledby="featured-title">
        <div class="home-section-heading">
          <div>
            <p class="home-eyebrow">START HERE</p>
            <h2 id="featured-title">함께 읽을 학습 노트</h2>
          </div>
        </div>
        <div class="home-featured">
          {picks.map((pick, index) => (
            <a class="featured-note internal" href={href(pick.slug)}>
              <span class="featured-index">0{index + 1}</span>
              <div>
                <span class="note-category">{pick.category}</span>
                <h3>{pick.title}</h3>
                <p>{pick.description}</p>
              </div>
              <span class="note-arrow" aria-hidden="true">
                ↗
              </span>
            </a>
          ))}
        </div>
      </section>

      <section class="home-section" aria-labelledby="recent-title">
        <div class="home-section-heading">
          <div>
            <p class="home-eyebrow">LATEST NOTES</p>
            <h2 id="recent-title">최근에 쓴 글</h2>
          </div>
          <a class="home-section-link internal" href={href("blog/index")}>
            글 모음 <span aria-hidden="true">↗</span>
          </a>
        </div>
        <ul class="home-recent">
          {recent.map((page) => {
            const topic = topics.find((item) => String(page.slug).startsWith(item.prefix))!
            const date = noteDate(page)
            const description = page.frontmatter?.description ?? page.description
            return (
              <li>
                <a class="recent-note internal" href={href(String(page.slug))}>
                  <div class="note-meta">
                    <span class="note-category">{topic.label}</span>
                    {date && <DisplayDate date={date} locale={cfg.locale} />}
                  </div>
                  <h3>{page.frontmatter?.title ?? page.slug}</h3>
                  {description && (
                    <p>{unescapeHTML(String(description)).replace(/\s+/g, " ").slice(0, 180)}</p>
                  )}
                  <span class="note-arrow" aria-hidden="true">
                    ↗
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      </section>
      <aside class="home-closing">
        <span>읽고, 만들고, 다시 기록합니다.</span>
        <a href="https://github.com/Lee-jun-young98">
          GitHub 프로필 <span aria-hidden="true">↗</span>
        </a>
      </aside>
    </article>
  )
}

export default Home
