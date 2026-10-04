import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { FullSlug, resolveRelative } from "../util/path"

export default (() => {
  const SiteNav: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    const slug = String(fileData.slug ?? "")
    const links = [
      { label: "홈", slug: "index", prefix: "index" },
      { label: "논문 리뷰", slug: "papers/index", prefix: "papers/" },
      { label: "개발 노트", slug: "libraries/index", prefix: "libraries/" },
      { label: "프로젝트", slug: "10_projects/index", prefix: "10_projects/" },
    ]
    return (
      <nav class="site-nav" aria-label="주요 메뉴">
        {links.map((link) => (
          <a
            class="internal"
            href={resolveRelative(fileData.slug!, link.slug as FullSlug)}
            aria-current={
              (link.prefix === "index" ? slug === "index" : slug.startsWith(link.prefix))
                ? "page"
                : undefined
            }
          >
            {link.label}
          </a>
        ))}
      </nav>
    )
  }
  return SiteNav
}) satisfies QuartzComponentConstructor
