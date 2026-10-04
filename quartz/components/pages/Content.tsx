import { ComponentChildren } from "preact"
import { htmlToJsx } from "../../util/jsx"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../types"
import Home from "../Home"
import { toString } from "hast-util-to-string"
import { Root } from "hast"

const Content: QuartzComponent = (props: QuartzComponentProps) => {
  const { fileData, tree } = props
  if (fileData.slug === "index") return <Home {...props} />
  const root = tree as Root
  const firstElement = root.children.find((node) => node.type === "element")
  const duplicateTitle =
    firstElement?.type === "element" &&
    firstElement.tagName === "h1" &&
    toString(firstElement).trim() === fileData.frontmatter?.title.trim()
  const readingTree = duplicateTitle
    ? { ...root, children: root.children.filter((node) => node !== firstElement) }
    : tree
  const content = htmlToJsx(fileData.filePath!, readingTree) as ComponentChildren
  const classes: string[] = fileData.frontmatter?.cssclasses ?? []
  const classString = ["popover-hint", ...classes].join(" ")
  return <article class={classString}>{content}</article>
}

export default (() => Content) satisfies QuartzComponentConstructor
