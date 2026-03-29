"use client"

import { format, formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import { motion } from "framer-motion"
import { ChevronRight, Clock } from "lucide-react"

import { Badge } from "@shared/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@shared/lib/utils"
import { shortVersionHash } from "@/lib/version-utils"

import type { VersionHistoryEntry } from "./version-history-types"

type VersionHistoryListProps = {
  versions: VersionHistoryEntry[]
  selectedIdx: number
  publishedVersionId?: string | null
  onSelect: (index: number) => void
}

export function VersionHistoryList({
  versions,
  selectedIdx,
  publishedVersionId,
  onSelect,
}: VersionHistoryListProps) {
  return (
    <div className="w-72 shrink-0 border-r bg-muted/10">
      <ScrollArea className="h-full max-h-[556px]">
        <div className="space-y-1 p-3">
          {versions.map((version, index) => {
            const isSelected = index === selectedIdx
            const createdAt = new Date(version.created_at)
            const isRecent = Date.now() - createdAt.getTime() < 86400000

            return (
              <motion.button
                key={version.id}
                onClick={() => onSelect(index)}
                className={cn(
                  "group relative w-full rounded-lg border p-3 text-left transition-all",
                  isSelected
                    ? "border-primary/20 bg-primary/10 shadow-sm"
                    : "border-transparent hover:bg-muted/60",
                )}
                whileHover={{ x: isSelected ? 0 : 2 }}
                transition={{ duration: 0.15 }}
              >
                {isSelected ? (
                  <motion.div
                    layoutId="version-indicator"
                    className="absolute bottom-3 left-0 top-3 w-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", duration: 0.3 }}
                  />
                ) : null}

                <div className="flex items-start gap-2.5 pl-2">
                  <div className="relative mt-1.5">
                    <div
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full ring-2",
                        isSelected
                          ? "bg-primary ring-primary/30"
                          : "bg-muted-foreground/30 ring-muted-foreground/10",
                      )}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs font-mono font-semibold",
                          isSelected ? "text-primary" : "text-muted-foreground",
                        )}
                      >
                        {shortVersionHash(version.id)}
                      </span>
                      {index === 0 ? (
                        <Badge className="h-4 border-0 bg-primary/20 px-1.5 py-0 text-[10px] text-primary">
                          최신
                        </Badge>
                      ) : null}
                      {version.id === publishedVersionId ? (
                        <Badge className="h-4 border-0 bg-green-500/20 px-1.5 py-0 text-[10px] text-green-600 dark:text-green-400">
                          공개
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mb-1 truncate text-sm font-medium">
                      {version.title || "제목 없음"}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span>
                        {isRecent
                          ? formatDistanceToNow(createdAt, { addSuffix: true, locale: ko })
                          : format(createdAt, "yyyy.MM.dd")}
                      </span>
                    </div>
                    {version.change_description ? (
                      <p className="mt-1 truncate text-[11px] italic text-muted-foreground/70">
                        {version.change_description}
                      </p>
                    ) : null}
                  </div>

                  <ChevronRight
                    className={cn(
                      "mt-1 h-3.5 w-3.5 shrink-0 transition-opacity",
                      isSelected
                        ? "text-primary opacity-100"
                        : "opacity-0 group-hover:opacity-50",
                    )}
                  />
                </div>
              </motion.button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
