import MarkdownIt from "markdown-it"

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
})

export function renderMarkdown(content: string | null | undefined) {
  const source = (content || "").trim()
  if (!source) {
    return ""
  }
  return markdown.render(source)
}
