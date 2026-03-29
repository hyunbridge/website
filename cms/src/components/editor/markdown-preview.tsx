"use client"

import { renderMarkdown } from "@shared/lib/markdown"
import { cn } from "@shared/lib/utils"

type MarkdownPreviewProps = {
  content?: string
  className?: string
}

const EMPTY_MARKDOWN = ""

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const renderedContent = renderMarkdown(content || EMPTY_MARKDOWN)

  return (
    <div className={cn("editor-content editor-content--readonly", className)}>
      <div
        className="ProseMirror markdown-content"
        dangerouslySetInnerHTML={{ __html: renderedContent }}
      />
    </div>
  )
}
