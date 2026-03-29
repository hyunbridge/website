"use client"

import { GitCompareArrows, Minus, Plus } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@shared/lib/utils"
import { markdownToPlainText } from "./content-diff-viewer"

type DiffLine = {
  type: "added" | "removed" | "unchanged"
  content: string
}

function computeTextDiff(oldText: string, newText: string): DiffLine[] {
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

  let oldIndex = oldCount
  let newIndex = newCount
  const result: DiffLine[] = []
  while (oldIndex > 0 || newIndex > 0) {
    if (oldIndex > 0 && newIndex > 0 && oldLines[oldIndex - 1] === newLines[newIndex - 1]) {
      result.unshift({ type: "unchanged", content: oldLines[oldIndex - 1] })
      oldIndex--
      newIndex--
    } else if (
      newIndex > 0 &&
      (oldIndex === 0 || table[oldIndex][newIndex - 1] >= table[oldIndex - 1][newIndex])
    ) {
      result.unshift({ type: "added", content: newLines[newIndex - 1] })
      newIndex--
    } else if (oldIndex > 0) {
      result.unshift({ type: "removed", content: oldLines[oldIndex - 1] })
      oldIndex--
    }
  }
  return result
}

function getDiffStats(diffLines: DiffLine[]) {
  const added = diffLines.filter((line) => line.type === "added").length
  const removed = diffLines.filter((line) => line.type === "removed").length
  return { added, removed }
}

export function ContentDiffViewer({
  oldContent,
  newContent,
}: {
  oldContent: string
  newContent: string
}) {
  const oldText = markdownToPlainText(oldContent)
  const newText = markdownToPlainText(newContent)
  const diffLines = computeTextDiff(oldText, newText)
  const stats = getDiffStats(diffLines)

  if (diffLines.length === 0 || (stats.added === 0 && stats.removed === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <GitCompareArrows className="mb-3 h-8 w-8 opacity-50" />
        <p className="text-sm">선택한 두 버전 사이에 변경사항이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-emerald-500">
          <Plus className="h-3 w-3" />
          <span className="font-mono font-medium">{stats.added}개 추가</span>
        </div>
        <div className="flex items-center gap-1.5 text-red-500">
          <Minus className="h-3 w-3" />
          <span className="font-mono font-medium">{stats.removed}개 삭제</span>
        </div>
        <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          {stats.added > 0 ? (
            <div
              className="h-full bg-emerald-500/80"
              style={{ width: `${(stats.added / (stats.added + stats.removed)) * 100}%` }}
            />
          ) : null}
          {stats.removed > 0 ? (
            <div
              className="h-full bg-red-500/80"
              style={{ width: `${(stats.removed / (stats.added + stats.removed)) * 100}%` }}
            />
          ) : null}
        </div>
      </div>

      <ScrollArea className="max-h-[500px]">
        <div className="overflow-hidden rounded-lg border font-mono text-sm">
          {diffLines.map((line, index) => (
            <div
              key={`${index}:${line.type}:${line.content}`}
              className={cn(
                "flex items-start gap-3 border-b border-border/30 px-4 py-1 last:border-b-0",
                line.type === "added" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                line.type === "removed" &&
                  "bg-red-500/10 text-red-700 dark:text-red-300 line-through opacity-70",
                line.type === "unchanged" && "text-muted-foreground",
              )}
            >
              <span className="w-4 shrink-0 select-none text-center opacity-60">
                {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
              </span>
              <span className="whitespace-pre-wrap break-all">{line.content || "\u00A0"}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
