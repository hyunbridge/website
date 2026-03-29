"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@shared/lib/utils"
import { MarkdownPreview } from "@/components/editor/markdown-preview"

type TextDiffLine = {
  kind: "added" | "removed" | "unchanged"
  content: string
}

type GitDiffLine = {
  kind: "header" | "hunk" | "added" | "removed" | "context"
  content: string
}

export function normalizeMarkdownContent(content?: string | null): string | undefined {
  return content || undefined
}

export function markdownToPlainText(content: string) {
  return content
}

function computeTextDiff(oldText: string, newText: string): TextDiffLine[] {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")
  const oldCount = oldLines.length
  const newCount = newLines.length
  const table: number[][] = Array.from({ length: oldCount + 1 }, () => Array(newCount + 1).fill(0))

  for (let oldIndex = 1; oldIndex <= oldCount; oldIndex++) {
    for (let newIndex = 1; newIndex <= newCount; newIndex++) {
      if (oldLines[oldIndex - 1] === newLines[newIndex - 1]) {
        table[oldIndex][newIndex] = table[oldIndex - 1][newIndex - 1] + 1
      } else {
        table[oldIndex][newIndex] = Math.max(
          table[oldIndex - 1][newIndex],
          table[oldIndex][newIndex - 1],
        )
      }
    }
  }

  const result: TextDiffLine[] = []
  let oldIndex = oldCount
  let newIndex = newCount

  while (oldIndex > 0 || newIndex > 0) {
    if (oldIndex > 0 && newIndex > 0 && oldLines[oldIndex - 1] === newLines[newIndex - 1]) {
      result.unshift({ kind: "unchanged", content: oldLines[oldIndex - 1] })
      oldIndex--
      newIndex--
    } else if (
      newIndex > 0 &&
      (oldIndex === 0 || table[oldIndex][newIndex - 1] >= table[oldIndex - 1][newIndex])
    ) {
      result.unshift({ kind: "added", content: newLines[newIndex - 1] })
      newIndex--
    } else if (oldIndex > 0) {
      result.unshift({ kind: "removed", content: oldLines[oldIndex - 1] })
      oldIndex--
    }
  }

  return result
}

function parseGitDiff(diff?: string | null): GitDiffLine[] {
  const value = diff?.trim()
  if (!value) return []
  return value.split("\n").map((line) => {
    if (line.startsWith("diff --git") || line.startsWith("--- ") || line.startsWith("+++ ")) {
      return { kind: "header", content: line }
    }
    if (line.startsWith("@@")) {
      return { kind: "hunk", content: line }
    }
    if (line.startsWith("+")) {
      return { kind: "added", content: line }
    }
    if (line.startsWith("-")) {
      return { kind: "removed", content: line }
    }
    return { kind: "context", content: line }
  })
}

export function TextDiffViewer({
  previous,
  current,
  body = false,
}: {
  previous?: string | null
  current?: string | null
  body?: boolean
}) {
  const left = body ? markdownToPlainText(previous || "") : previous || ""
  const right = body ? markdownToPlainText(current || "") : current || ""
  const lines = computeTextDiff(left, right)

  if (lines.every((line) => line.kind === "unchanged")) {
    return <div className="text-sm text-muted-foreground">변경사항이 없습니다.</div>
  }

  return (
    <ScrollArea className="max-h-[26rem] rounded-md border bg-background">
      <div className="font-mono text-xs">
        {lines.map((line, index) => (
          <div
            key={`${index}:${line.kind}:${line.content}`}
            className={cn(
              "border-b border-border/40 px-3 py-1.5 last:border-b-0",
              line.kind === "added" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              line.kind === "removed" && "bg-red-500/10 text-red-700 dark:text-red-300",
              line.kind === "unchanged" && "text-muted-foreground",
            )}
          >
            <div className="flex items-start gap-3">
              <span className="w-4 shrink-0 text-center opacity-60">
                {line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}
              </span>
              <code className="block whitespace-pre-wrap break-all">{line.content || " "}</code>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

export function GitDiffViewer({ diff }: { diff?: string | null }) {
  const lines = parseGitDiff(diff)

  if (lines.length === 0) {
    return <div className="text-sm text-muted-foreground">표시할 diff가 없습니다.</div>
  }

  return (
    <ScrollArea className="max-h-[26rem] rounded-md border bg-background">
      <div className="font-mono text-xs">
        {lines.map((line, index) => (
          <div
            key={`${index}:${line.content}`}
            className={cn(
              "border-b border-border/40 px-3 py-1.5 last:border-b-0",
              line.kind === "header" && "bg-slate-500/10 text-slate-700 dark:text-slate-300",
              line.kind === "hunk" && "bg-blue-500/10 text-blue-700 dark:text-blue-300",
              line.kind === "added" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
              line.kind === "removed" && "bg-red-500/10 text-red-700 dark:text-red-300",
              line.kind === "context" && "text-muted-foreground",
            )}
          >
            <code className="block whitespace-pre">{line.content || " "}</code>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

export function RenderedContentComparison({
  previous,
  current,
}: {
  previous?: string | null
  current?: string | null
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-lg border bg-background p-3">
        <div className="mb-2 text-xs text-muted-foreground">이전</div>
        {previous ? (
          <div className="content-article__surface">
            <MarkdownPreview content={previous} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">이전 본문이 없습니다.</div>
        )}
      </div>
      <div className="rounded-lg border bg-background p-3">
        <div className="mb-2 text-xs text-muted-foreground">이번</div>
        {current ? (
          <div className="content-article__surface">
            <MarkdownPreview content={current} />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">이번 본문이 없습니다.</div>
        )}
      </div>
    </div>
  )
}
