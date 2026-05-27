import fs from "node:fs/promises"
import path from "node:path"

// Keep the GitHub Pages copy as generated Markdown text, not as Notion page links.
const notionToken = process.env.NOTION_TOKEN
const databaseId = process.env.NOTION_PAPERS_DATABASE_ID || "df3a2db6a13749c5b70eac452622298a"
const notionVersion = process.env.NOTION_VERSION || "2022-06-28"
const contentRoot = process.env.PAPERS_CONTENT_ROOT || "content/papers"
const assetRoot = path.join(contentRoot, "assets", "notion")
const assetPublicRoot = "/papers/assets/notion"
const siteUrl = (process.env.SITE_URL || "https://lee-jun-young98.github.io").replace(/\/$/, "")

if (!notionToken) {
  throw new Error("NOTION_TOKEN is required. Share the paper review database with the integration first.")
}

const categoryFolders = {
  "Generative AI": "generative-ai",
  LLM: "llm",
  Vision: "vision",
  MultiModal: "multimodal",
  Agent: "agent",
  "3D": "3d",
  Skill: "skill",
  Metrics: "metrics",
}

const categoryTitles = {
  "generative-ai": "Generative AI",
  llm: "LLM",
  vision: "Vision",
  multimodal: "MultiModal",
  agent: "Agent",
  "3d": "3D",
  skill: "Skill",
  metrics: "Metrics",
}

const categoryPriority = ["Agent", "3D", "MultiModal", "LLM", "Generative AI", "Vision", "Skill", "Metrics"]

const manualPaperReviews = [
  {
    title: "ReAct: Synergizing Reasoning and Acting in Language Models",
    folder: "llm",
    slug: "react-synergizing-reasoning-and-acting",
  },
  {
    title: "GLIP: Grounded Language-Image Pre-training",
    folder: "multimodal",
    slug: "glip-grounded-language-image-pre-training",
  },
  {
    title: "No time to train! Training-Free Reference-Based Instance Segmentation",
    folder: "vision",
    slug: "no-time-to-train-training-free-reference-based-instance-segmentation",
  },
  {
    title: "Swin Transformer: Hierarchical Vision Transformer using Shifted Windows",
    folder: "vision",
    slug: "swin-transformer-hierarchical-vision-transformer-using-shifted-windows",
    thumbnail: "/papers/assets/notion/swin-transformer-hierarchical-vision-transformer-using-shifted-windows-f489ce43a650.png",
  },
  {
    title: "SAM 2: Segment Anything in Images and Videos",
    folder: "vision",
    slug: "sam-2-segment-anything-in-images-and-videos",
    thumbnail: "/papers/assets/notion/sam-2-segment-anything-in-images-and-videos-2348d6e1cee5.png",
  },
  {
    title: "When Does Label Smoothing Help?",
    folder: "skill",
    slug: "when-does-label-smoothing-help",
    thumbnail: "/papers/assets/notion/when-does-label-smoothing-help-592b8ded30be.png",
  },
  {
    title: "Voyager: An Open-Ended Embodied Agent with Large Language Models",
    folder: "agent",
    slug: "voyager-open-ended-embodied-agent-with-large-language-models",
    thumbnail: "/papers/assets/agent/voyager-components.png",
  },
]

const manualOverridePageIds = new Set([
  "3698d6e1cee581fb9147c9108f141560",
  "1268d6e1cee58034ad34f957dc1e2b7d",
  "2298d6e1cee580af837dd872a256c2bb",
  "2ae41bf1181749c4b9250c9008e85e84",
  "14a8d6e1cee580c7b91ece8d0921ea93",
  "60398924e6504cadac522e54886464c8",
])

const knownPages = {
  "3698d6e1cee581fb9147c9108f141560": {
    slug: "react-synergizing-reasoning-and-acting",
    folder: "llm",
    aliases: ["/papers/react-synergizing-reasoning-and-acting"],
  },
  "1738d6e1cee580e2ab24c3260c5d314c": {
    slug: "ddpm-study-note",
    folder: "generative-ai",
    aliases: ["/papers/ddpm-study-note"],
  },
  "1778d6e1cee580cd8b78f9b185daf3b1": {
    slug: "latent-diffusion-models-study-note",
    folder: "generative-ai",
    aliases: ["/papers/latent-diffusion-models-study-note"],
  },
  "41d767916da746b3b58c8d28f16a65df": {
    slug: "medical-sam-adapter-study-note",
    folder: "vision",
    aliases: ["/papers/medical-sam-adapter-study-note"],
  },
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function notion(pathname, init = {}, attempt = 1) {
  const response = await fetch(`https://api.notion.com/v1${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${notionToken}`,
      "Notion-Version": notionVersion,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    if ((response.status === 429 || response.status >= 500) && attempt < 5) {
      const retryAfter = Number(response.headers.get("retry-after"))
      const delay = Number.isFinite(retryAfter) ? retryAfter * 1000 : attempt * 2500
      console.warn(`Notion API ${response.status}; retrying ${pathname} in ${delay}ms`)
      await sleep(delay)
      return notion(pathname, init, attempt + 1)
    }

    throw new Error(`Notion API ${response.status} ${response.statusText}: ${text}`)
  }

  return response.json()
}

async function queryDatabase() {
  const pages = []
  let start_cursor

  do {
    const body = { page_size: 100 }
    if (start_cursor) body.start_cursor = start_cursor

    const data = await notion(`/databases/${databaseId}/query`, {
      method: "POST",
      body: JSON.stringify(body),
    })

    pages.push(...data.results)
    start_cursor = data.has_more ? data.next_cursor : undefined
  } while (start_cursor)

  return pages
}

async function getChildren(blockId) {
  const blocks = []
  let start_cursor

  do {
    const query = new URLSearchParams({ page_size: "100" })
    if (start_cursor) query.set("start_cursor", start_cursor)

    const data = await notion(`/blocks/${blockId}/children?${query.toString()}`)
    blocks.push(...data.results)
    start_cursor = data.has_more ? data.next_cursor : undefined
  } while (start_cursor)

  return blocks
}

function pageKey(pageId) {
  return pageId.replaceAll("-", "")
}

function escapeYaml(value = "") {
  return String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')
}

function richTextToMarkdown(parts = []) {
  return parts
    .map((part) => {
      let text = part.plain_text || ""
      const href = part.href
      const annotations = part.annotations || {}

      if (annotations.code) text = `\`${text}\``
      if (annotations.bold) text = `**${text}**`
      if (annotations.italic) text = `_${text}_`
      if (annotations.strikethrough) text = `~~${text}~~`
      if (href) text = `[${text}](${href})`

      return text
    })
    .join("")
}

function getTitle(properties) {
  for (const property of Object.values(properties)) {
    if (property.type === "title") {
      return richTextToPlain(property.title).trim()
    }
  }
  return "Untitled"
}

function richTextToPlain(parts = []) {
  return parts.map((part) => part.plain_text || "").join("")
}

function displayTitle(title) {
  return title.replace(/\s+/g, " ").trim()
}

function getProperty(properties, name) {
  return properties[name]
}

function getMultiSelect(properties, name) {
  const property = getProperty(properties, name)
  return property?.type === "multi_select" ? property.multi_select.map((item) => item.name) : []
}

function getTextProperty(properties, name) {
  const property = getProperty(properties, name)
  if (!property) return ""

  if (property.type === "rich_text") return richTextToPlain(property.rich_text).trim()
  if (property.type === "select") return property.select?.name || ""
  if (property.type === "url") return property.url || ""
  if (property.type === "date") return property.date?.start || ""
  if (property.type === "people") return property.people.map((person) => person.name).filter(Boolean).join(", ")
  if (property.type === "multi_select") return property.multi_select.map((item) => item.name).join(", ")

  return ""
}

function slugify(title) {
  const ascii = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\uac00-\ud7a3]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return ascii || "untitled"
}

function chooseFolder(tableTags, override) {
  if (override?.folder) return override.folder

  const primary = categoryPriority.find((category) => tableTags.includes(category))
  return categoryFolders[primary] || "uncategorized"
}

function markdownList(values) {
  return values.map((value) => `  - "${escapeYaml(value)}"`).join("\n")
}

function absoluteUrl(url) {
  return /^https?:\/\//.test(url) ? url : `${siteUrl}${url.startsWith("/") ? "" : "/"}${url}`
}

function assetExtension(url) {
  const parsed = new URL(url)
  const extension = path.extname(decodeURIComponent(parsed.pathname)).toLowerCase()

  return extension && extension.length <= 12 ? extension : ".bin"
}

async function downloadNotionAsset(url, block, context) {
  await fs.mkdir(assetRoot, { recursive: true })

  const filename = `${context.slug}-${pageKey(block.id).slice(0, 12)}${assetExtension(url)}`
  const filePath = path.join(assetRoot, filename)
  const publicPath = `${assetPublicRoot}/${filename}`

  try {
    await fs.access(filePath)
    return publicPath
  } catch {
    // Download the asset when it is not already committed in the repository.
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to download Notion asset ${response.status} ${response.statusText}: ${url}`)
  }

  await fs.writeFile(filePath, Buffer.from(await response.arrayBuffer()))

  return publicPath
}

function buildFrontmatter(page, metadata, body) {
  const lines = ["---"]
  lines.push(`title: "${escapeYaml(metadata.title)}"`)
  if (metadata.date) lines.push(`date: ${metadata.date}`)
  if (metadata.thumbnail) {
    lines.push(`thumbnail: "${escapeYaml(metadata.thumbnail)}"`)
    lines.push(`socialImage: "${escapeYaml(absoluteUrl(metadata.thumbnail))}"`)
  }
  lines.push("paper_sync: true")
  lines.push("tags:")
  lines.push(markdownList(["paper-review", ...metadata.tableTags, ...metadata.tasks]))
  if (metadata.author) lines.push(`author: "${escapeYaml(metadata.author)}"`)
  if (metadata.journal) lines.push(`journal: "${escapeYaml(metadata.journal)}"`)
  if (metadata.aliases.length > 0) {
    lines.push("aliases:")
    lines.push(markdownList(metadata.aliases))
  }
  lines.push("---")

  return `${lines.join("\n")}\n\n${body.trim()}\n`
}

async function blockToMarkdown(block, context, depth = 0) {
  const type = block.type
  const value = block[type]
  const children = block.has_children ? await blocksToMarkdown(await getChildren(block.id), context, depth + 1) : ""
  const indent = "  ".repeat(depth)

  switch (type) {
    case "paragraph": {
      const text = richTextToMarkdown(value.rich_text)
      return [text, children].filter(Boolean).join("\n\n")
    }
    case "heading_1":
      return `# ${richTextToMarkdown(value.rich_text)}`
    case "heading_2":
      return `## ${richTextToMarkdown(value.rich_text)}`
    case "heading_3":
      return `### ${richTextToMarkdown(value.rich_text)}`
    case "bulleted_list_item": {
      const text = `${indent}- ${richTextToMarkdown(value.rich_text)}`
      return [text, children].filter(Boolean).join("\n")
    }
    case "numbered_list_item": {
      const text = `${indent}1. ${richTextToMarkdown(value.rich_text)}`
      return [text, children].filter(Boolean).join("\n")
    }
    case "to_do": {
      const checked = value.checked ? "x" : " "
      const text = `${indent}- [${checked}] ${richTextToMarkdown(value.rich_text)}`
      return [text, children].filter(Boolean).join("\n")
    }
    case "toggle": {
      const summary = richTextToMarkdown(value.rich_text) || "Details"
      return `<details>\n<summary>${summary}</summary>\n\n${children}\n\n</details>`
    }
    case "quote": {
      const text = richTextToMarkdown(value.rich_text)
      return [text, children]
        .filter(Boolean)
        .join("\n\n")
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")
    }
    case "callout": {
      const text = richTextToMarkdown(value.rich_text)
      return ["> [!note]", text ? `> ${text}` : "", children ? children.split("\n").map((line) => `> ${line}`).join("\n") : ""]
        .filter(Boolean)
        .join("\n")
    }
    case "code": {
      const language = value.language === "plain text" ? "" : value.language
      return `\`\`\`${language}\n${richTextToPlain(value.rich_text)}\n\`\`\``
    }
    case "equation":
      return `$$\n${value.expression}\n$$`
    case "divider":
      return "---"
    case "image": {
      const sourceUrl = value.type === "external" ? value.external.url : value.file.url
      const url = value.type === "external" ? sourceUrl : await downloadNotionAsset(sourceUrl, block, context)
      const caption = richTextToPlain(value.caption)
      if (!context.thumbnail) context.thumbnail = url
      return `![${caption}](${url})`
    }
    case "file":
    case "pdf":
    case "video": {
      const sourceUrl = value.type === "external" ? value.external.url : value.file.url
      const url = value.type === "external" ? sourceUrl : await downloadNotionAsset(sourceUrl, block, context)
      const caption = richTextToPlain(value.caption) || url
      return `[${caption}](${url})`
    }
    case "bookmark":
    case "embed":
    case "link_preview":
      return `[${value.url}](${value.url})`
    case "table_of_contents":
      return ""
    case "child_page":
      return `## ${value.title}`
    case "unsupported":
      return ""
    default:
      return children
  }
}

async function blocksToMarkdown(blocks, context, depth = 0) {
  const chunks = []

  for (const block of blocks) {
    const markdown = await blockToMarkdown(block, context, depth)
    if (markdown.trim()) chunks.push(markdown)
  }

  return chunks.join("\n\n")
}

function pageMetadata(page) {
  const properties = page.properties
  const title = getTitle(properties)
  const tableTags = getMultiSelect(properties, "Table tag")
  const tasks = getMultiSelect(properties, "Task")
  const progress = getMultiSelect(properties, "Progress")
  const override = knownPages[pageKey(page.id)]
  const folder = chooseFolder(tableTags, override)
  const slug = override?.slug || slugify(title)

  return {
    title,
    tableTags,
    tasks,
    progress,
    folder,
    slug,
    aliases: override?.aliases || [],
    author: getTextProperty(properties, "Author"),
    journal: getTextProperty(properties, "Jurnel") || getTextProperty(properties, "Journal"),
    date: getTextProperty(properties, "Date"),
  }
}

function shouldSyncPaper(metadata) {
  if (metadata.title.includes("작성중") || metadata.title.includes("진행중")) return false
  if (metadata.progress.length === 0) return true
  return metadata.progress.includes("Done")
}

function indexBody(title, papers) {
  const entries = papers
    .sort((a, b) => a.title.localeCompare(b.title, "ko"))
    .map((paper) => {
      const image = paper.thumbnail ? `\n\n![](${paper.thumbnail})` : ""
      return `## [${displayTitle(paper.title)}](/papers/${paper.folder}/${paper.slug})${image}`
    })
    .join("\n\n")

  return `---\ntitle: "${escapeYaml(title)}"\npaper_sync: true\n---\n\n${entries}\n`
}

function paperEntry(paper, level = "##") {
  const image = paper.thumbnail ? `\n\n![](${paper.thumbnail})` : ""
  return `${level} [${displayTitle(paper.title)}](/papers/${paper.folder}/${paper.slug})${image}`
}

function groupedIndexBody(title, papers, byFolder) {
  const sections = []

  for (const category of categoryPriority) {
    const folder = categoryFolders[category]
    const folderPapers = [...(byFolder.get(folder) || [])].sort((a, b) => a.title.localeCompare(b.title, "ko"))
    if (folderPapers.length === 0) continue

    const sectionTitle = categoryTitles[folder] || category
    const entries = folderPapers.map((paper) => paperEntry(paper, "###")).join("\n\n")
    sections.push(`## [${sectionTitle}](/papers/${folder}/)\n\n${entries}`)
  }

  return `---\ntitle: "${escapeYaml(title)}"\npaper_sync: true\n---\n\n${sections.join("\n\n")}\n`
}

async function removePreviouslySyncedMarkdown(directory) {
  let entries = []
  try {
    entries = await fs.readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error.code === "ENOENT") return
    throw error
  }

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== "assets") await removePreviouslySyncedMarkdown(entryPath)
      continue
    }

    if (!entry.name.endsWith(".md")) continue

    const content = await fs.readFile(entryPath, "utf8")
    if (content.includes("paper_sync: true") || content.includes("notion_synced: true")) {
      await fs.rm(entryPath)
    }
  }
}

async function main() {
  const pages = await queryDatabase()
  const synced = []

  await fs.mkdir(contentRoot, { recursive: true })
  await removePreviouslySyncedMarkdown(contentRoot)

  for (const page of pages) {
    const metadata = pageMetadata(page)
    if (manualOverridePageIds.has(pageKey(page.id))) {
      console.log(`skipped ${metadata.title} (manual blog override)`)
      continue
    }

    if (!shouldSyncPaper(metadata)) {
      console.log(`skipped ${metadata.title} (${metadata.progress.join(", ") || "no progress"})`)
      continue
    }

    const blocks = await getChildren(page.id)
    const context = { slug: metadata.slug, thumbnail: "" }
    const body = await blocksToMarkdown(blocks, context)
    metadata.thumbnail = context.thumbnail
    const filePath = path.join(contentRoot, metadata.folder, `${metadata.slug}.md`)

    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buildFrontmatter(page, metadata, body), "utf8")

    synced.push(metadata)
    console.log(`synced ${metadata.folder}/${metadata.slug}.md`)
  }

  const allPapers = [...synced, ...manualPaperReviews]
  const byFolder = new Map()
  for (const paper of allPapers) {
    const papers = byFolder.get(paper.folder) || []
    papers.push(paper)
    byFolder.set(paper.folder, papers)
  }

  await fs.writeFile(
    path.join(contentRoot, "index.md"),
    groupedIndexBody("\uB17C\uBB38 \uB9AC\uBDF0 \uB178\uD2B8", allPapers, byFolder),
    "utf8",
  )

  for (const folder of Object.values(categoryFolders)) {
    const papers = byFolder.get(folder) || []
    if (papers.length === 0) continue

    const title = categoryTitles[folder] || folder
    const indexPath = path.join(contentRoot, folder, "index.md")
    await fs.mkdir(path.dirname(indexPath), { recursive: true })
    await fs.writeFile(indexPath, indexBody(title, papers), "utf8")
  }

  console.log(`synced ${synced.length} Notion paper pages`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
