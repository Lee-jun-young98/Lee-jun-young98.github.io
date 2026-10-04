import test from "node:test"
import assert from "node:assert/strict"
import { render } from "preact-render-to-string"
import { h } from "preact"
import Home, { noteDate } from "./Home"
import { QuartzComponentProps } from "./types"
import { QuartzPluginData } from "../plugins/vfile"
import { FullSlug } from "../util/path"

const note = (slug: string, date: string, draft = false): QuartzPluginData => ({
  slug: slug as FullSlug,
  frontmatter: { title: slug, date, draft, tags: [] },
})

test("recent notes follow publication dates and exclude directories, drafts, and static projects", () => {
  const files = [
    note("papers/index", "2030-01-01"),
    note("papers/vla/private-draft", "2030-01-01", true),
    note("10_projects/static-intro", "2030-01-01"),
    note("blog/privacy-policy", "2030-01-01"),
    ...Array.from({ length: 8 }, (_, i) =>
      note(`libraries/langgraph/note-${i}`, `2026-10-0${i + 1}`),
    ),
  ]
  const html = render(
    h(Home, {
      allFiles: files,
      fileData: { slug: "index" },
      cfg: { locale: "ko-KR" },
    } as QuartzComponentProps),
  )
  const recent = html.split('class="home-recent"')[1].split("</ul>")[0]
  assert.equal((recent.match(/class="recent-note internal"/g) ?? []).length, 6)
  assert.ok(recent.indexOf("note-7") < recent.indexOf("note-6"))
  for (const hidden of ["private-draft", "static-intro", "privacy-policy", "note-0", "note-1"])
    assert.ok(!recent.includes(hidden))
  assert.ok(!html.includes('href="./libraries/langgraph/postgres-checkpointer-production"'))
})

test("cloning the repository does not make an old note appear newly published", () => {
  const file = note("libraries/langgraph/older-note", "2026-07-09")
  file.dates = {
    created: new Date("2030-01-01"),
    modified: new Date("2030-01-01"),
    published: new Date("2030-01-01"),
  }
  assert.equal(noteDate(file)?.toISOString().slice(0, 10), "2026-07-09")
})
