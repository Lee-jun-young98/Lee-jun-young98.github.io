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
    description: "LLM · VLM · VLA의 아이디어와 구조, 실험 결과를 깊이 읽습니다.",
    prefix: "papers/",
    code: "01",
  },
  {
    href: "libraries/index",
    label: "개발 노트",
    subtitle: "코드에서 운영까지",
    description: "LangChain · LangGraph · LangSmith로 배우는 실전 AI 시스템.",
    prefix: "libraries/",
    code: "02",
  },
  {
    href: "10_projects/index",
    label: "프로젝트",
    subtitle: "직접 만들며 배우기",
    description: "모델 학습부터 RAG, 서빙과 성능 개선까지의 구현 기록.",
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
    description: "PostgresSaver로 체크포인트와 실행 상태를 안전하게 보관하는 방법.",
    category: "LangGraph",
  },
  {
    slug: "libraries/langchain/init-chat-model-runtime-configuration",
    title: "요청마다 모델을 안전하게 바꾸려면",
    description: "런타임 모델 설정과 허용 필드, 설정 충돌을 다루는 실전 패턴.",
    category: "LangChain",
  },
  {
    slug: "libraries/langsmith/langsmith-production-trace-agent-backtesting",
    title: "새 에이전트, 배포 전에 검증하기",
    description: "운영 trace를 활용해 새 버전의 회귀를 찾고 결과를 비교합니다.",
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
          연구를 읽고,
          <br />
          시스템으로 만듭니다<span class="home-period">.</span>
        </h1>
        <p class="home-description">
          AI Systems Engineer 이준영의 공부와 구현 기록.
          <br />
          논문의 핵심부터 실제 서비스의 설계와 운영까지, 하나씩 연결합니다.
        </p>
        <a class="home-about internal" href={href("About")}>
          이 블로그에 대하여 <span aria-hidden="true">↗</span>
        </a>
      </header>

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

      <section class="home-section" aria-labelledby="featured-title">
        <div class="home-section-heading">
          <div>
            <p class="home-eyebrow">START HERE</p>
            <h2 id="featured-title">처음이라면, 이 글부터</h2>
          </div>
          <span class="home-section-note">함께 읽기 좋은 세 가지 노트</span>
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
          GitHub에서 구현 보기 <span aria-hidden="true">↗</span>
        </a>
      </aside>
    </article>
  )
}

export default Home
