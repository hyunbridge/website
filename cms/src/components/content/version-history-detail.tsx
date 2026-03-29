"use client"

import { format } from "date-fns"
import { AnimatePresence, motion } from "framer-motion"
import { GitCompareArrows, RotateCcw } from "lucide-react"

import { Badge } from "@shared/components/ui/badge"
import { Button } from "@shared/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MarkdownPreview } from "@/components/editor/markdown-preview"
import { shortVersionHash } from "@/lib/version-utils"

import { ContentDiffViewer } from "./version-history-view"
import { normalizeMarkdownContent } from "./content-diff-viewer"
import type { VersionHistoryEntry } from "./version-history-types"

type VersionHistoryDetailProps = {
  selectedVersion: VersionHistoryEntry | null
  previousVersion: VersionHistoryEntry | null
  selectedIdx: number
  viewMode: "preview" | "diff"
  onRestoreClick: () => void
}

export function VersionHistoryDetail({
  selectedVersion,
  previousVersion,
  selectedIdx,
  viewMode,
  onRestoreClick,
}: VersionHistoryDetailProps) {
  if (!selectedVersion) {
    return <div className="flex min-w-0 flex-1 flex-col" />
  }

  const selectedContent = normalizeMarkdownContent(selectedVersion.content)

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b bg-background px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Badge variant="outline" className="shrink-0 font-mono">
            {shortVersionHash(selectedVersion.id)}
          </Badge>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{selectedVersion.title || "제목 없음"}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(selectedVersion.created_at), "yyyy.MM.dd HH:mm")}
              {selectedVersion.creator ? (
                <> · {selectedVersion.creator.full_name || selectedVersion.creator.username}</>
              ) : null}
            </p>
          </div>
        </div>

        {selectedIdx > 0 ? (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={onRestoreClick}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            복원
          </Button>
        ) : null}
      </div>

      <ScrollArea className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${selectedVersion.id}-${viewMode}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="p-5"
          >
            {viewMode === "preview" ? (
              <div className="content-article__surface">
                <MarkdownPreview content={selectedContent} />
              </div>
            ) : previousVersion ? (
              <ContentDiffViewer
                oldContent={previousVersion.content}
                newContent={selectedVersion.content}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <GitCompareArrows className="mb-3 h-8 w-8 opacity-50" />
                <p className="text-sm">첫 버전이라 비교할 이전 내용이 없습니다.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </ScrollArea>
    </div>
  )
}
