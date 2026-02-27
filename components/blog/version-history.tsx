"use client"

import { useState, useEffect, useMemo } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { getPostVersions, restorePostVersion } from "@/lib/blog-service"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  History,
  RotateCcw,
  Eye,
  GitCompareArrows,
  ChevronRight,
  Clock,
  Plus,
  Minus,
  AlertTriangle,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BlockNoteEditor } from "./blocknote-editor"
import { useToast } from "@/hooks/use-toast"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { StatePanel } from "@/components/ui/state-panel"

interface VersionHistoryProps {
  postId: string
  publishedVersionId?: string | null
  onVersionRestored: () => void
}

interface Version {
  id: string
  version_number: number
  post_id: string
  title: string
  content: string
  summary?: string
  change_description: string | null
  created_at: string
  created_by: string | null
  creator?: {
    id: string
    username: string
    full_name: string | null
  } | null
}

// ─── Text Diff Engine ───────────────────────────────────────────────
type DiffLine = {
  type: "added" | "removed" | "unchanged"
  content: string
}

type ParsedBlockNode = {
  type?: string
  text?: string
  content?: ParsedBlockNode[]
  children?: ParsedBlockNode[]
  props?: {
    level?: number
    checked?: boolean
  }
}

function computeTextDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")
  // Simple LCS-based diff
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to find diff
  let i = m, j = n
  const result: DiffLine[] = []
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      result.unshift({ type: "unchanged", content: oldLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ type: "added", content: newLines[j - 1] })
      j--
    } else if (i > 0) {
      result.unshift({ type: "removed", content: oldLines[i - 1] })
      i--
    }
  }

  return result
}

function blocksToPlainText(content: string): string {
  try {
    const blocks = JSON.parse(content)
    if (!Array.isArray(blocks)) return content

    function extractText(block: ParsedBlockNode): string {
      let text = ""
      if (block.content) {
        for (const item of block.content) {
          if (item.type === "text") {
            text += item.text || ""
          } else if (item.content) {
            text += extractText(item)
          }
        }
      }
      // Add child blocks (nested content)
      if (block.children && block.children.length > 0) {
        for (const child of block.children) {
          const childText = extractText(child)
          if (childText) text += "\n  " + childText
        }
      }
      return text
    }

    return blocks
      .map((block: ParsedBlockNode) => {
        const prefix =
          block.type === "heading" ? `${"#".repeat(block.props?.level || 1)} ` :
            block.type === "bulletListItem" ? "• " :
              block.type === "numberedListItem" ? "1. " :
                block.type === "checkListItem" ? (block.props?.checked ? "☑ " : "☐ ") :
                  block.type === "codeBlock" ? "```\n" :
                    ""
        const suffix = block.type === "codeBlock" ? "\n```" : ""
        const text = extractText(block)
        return text ? prefix + text + suffix : ""
      })
      .filter(Boolean)
      .join("\n")
  } catch {
    return content || ""
  }
}

// ─── Diff Stats ─────────────────────────────────────────────────────
function getDiffStats(diffLines: DiffLine[]) {
  const added = diffLines.filter(l => l.type === "added").length
  const removed = diffLines.filter(l => l.type === "removed").length
  return { added, removed }
}

// ─── Diff Viewer Component ──────────────────────────────────────────
function DiffViewer({ oldContent, newContent }: { oldContent: string; newContent: string }) {
  const oldText = useMemo(() => blocksToPlainText(oldContent), [oldContent])
  const newText = useMemo(() => blocksToPlainText(newContent), [newContent])
  const diffLines = useMemo(() => computeTextDiff(oldText, newText), [oldText, newText])
  const stats = useMemo(() => getDiffStats(diffLines), [diffLines])

  if (diffLines.length === 0 || (stats.added === 0 && stats.removed === 0)) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <GitCompareArrows className="h-8 w-8 mb-3 opacity-50" />
        <p className="text-sm">No changes between these versions</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-emerald-500">
          <Plus className="h-3 w-3" />
          <span className="font-mono font-medium">{stats.added} added</span>
        </div>
        <div className="flex items-center gap-1.5 text-red-500">
          <Minus className="h-3 w-3" />
          <span className="font-mono font-medium">{stats.removed} removed</span>
        </div>
        {/* Visual bar */}
        <div className="flex-1 flex h-1.5 rounded-full overflow-hidden bg-muted">
          {stats.added > 0 && (
            <div
              className="bg-emerald-500/80 h-full"
              style={{ width: `${(stats.added / (stats.added + stats.removed)) * 100}%` }}
            />
          )}
          {stats.removed > 0 && (
            <div
              className="bg-red-500/80 h-full"
              style={{ width: `${(stats.removed / (stats.added + stats.removed)) * 100}%` }}
            />
          )}
        </div>
      </div>

      {/* Diff lines */}
      <ScrollArea className="max-h-[500px]">
        <div className="font-mono text-sm border rounded-lg overflow-hidden">
          {diffLines.map((line, idx) => (
            <div
              key={idx}
              className={cn(
                "px-4 py-1 border-b border-border/30 last:border-b-0 flex items-start gap-3",
                line.type === "added" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                line.type === "removed" && "bg-red-500/10 text-red-700 dark:text-red-300 line-through opacity-70",
                line.type === "unchanged" && "text-muted-foreground",
              )}
            >
              <span className="select-none w-4 shrink-0 text-center opacity-60">
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

// ─── Main Component ─────────────────────────────────────────────────
export function VersionHistory({ postId, publishedVersionId, onVersionRestored }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [viewMode, setViewMode] = useState<"preview" | "diff">("preview")
  const [isRestoring, setIsRestoring] = useState(false)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (!postId) return
    setIsLoading(true)
    getPostVersions(postId)
      .then((data) => { setVersions(data || []); setError(null) })
      .catch((err) => { setError(err instanceof Error ? err : new Error("Unknown error")); setVersions([]) })
      .finally(() => setIsLoading(false))
  }, [postId])

  const selectedVersion = versions[selectedIdx] || null
  const previousVersion = versions[selectedIdx + 1] || null

  const handleRestore = async () => {
    if (!user || !selectedVersion) return
    setIsRestoring(true)
    try {
      await restorePostVersion(postId, selectedVersion.version_number, user.id)
      toast({
        title: "Version restored",
        description: `Restored to v${selectedVersion.version_number}`,
      })
      setShowRestoreDialog(false)
      onVersionRestored()
    } catch {
      toast({
        title: "Error",
        description: "Failed to restore version.",
        variant: "destructive",
      })
    } finally {
      setIsRestoring(false)
    }
  }

  // Parse blocks for preview
  const selectedBlocks = useMemo(() => {
    if (!selectedVersion?.content) return undefined
    try {
      const parsed = JSON.parse(selectedVersion.content)
      return Array.isArray(parsed) ? parsed : undefined
    } catch { return undefined }
  }, [selectedVersion?.content])

  // ─── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex gap-6">
          <div className="w-72 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
          <div className="flex-1">
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  // ─── Error ────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <StatePanel
          size="compact"
          tone="danger"
          icon={<AlertTriangle className="h-5 w-5" />}
          title="Failed to load version history"
        />
      </div>
    )
  }

  // ─── Empty ────────────────────────────────────────────────────
  if (!versions.length) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <StatePanel
          size="compact"
          icon={<History className="h-5 w-5" />}
          title="No versions saved yet"
          description="Versions are created when you save."
        />
      </div>
    )
  }

  // ─── Main Layout ──────────────────────────────────────────────
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">Version History</span>
          <Badge variant="secondary" className="text-xs font-mono">
            {versions.length}
          </Badge>
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "preview" | "diff")}>
          <TabsList className="h-8">
            <TabsTrigger value="preview" className="text-xs h-7 gap-1.5 px-3">
              <Eye className="h-3 w-3" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="diff" className="text-xs h-7 gap-1.5 px-3">
              <GitCompareArrows className="h-3 w-3" />
              Changes
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex min-h-[400px] max-h-[600px]">
        {/* ── Timeline Sidebar ──────────────────────────────── */}
        <div className="w-72 border-r bg-muted/10 shrink-0">
          <ScrollArea className="h-full max-h-[556px]">
            <div className="p-3 space-y-1">
              {versions.map((version, idx) => {
                const isSelected = idx === selectedIdx
                const createdAt = new Date(version.created_at)
                const isRecent = Date.now() - createdAt.getTime() < 86400000 // 24h

                return (
                  <motion.button
                    key={version.id}
                    onClick={() => setSelectedIdx(idx)}
                    className={cn(
                      "w-full text-left rounded-lg p-3 transition-all relative group",
                      isSelected
                        ? "bg-primary/10 border border-primary/20 shadow-sm"
                        : "hover:bg-muted/60 border border-transparent",
                    )}
                    whileHover={{ x: isSelected ? 0 : 2 }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* Active indicator */}
                    {isSelected && (
                      <motion.div
                        layoutId="version-indicator"
                        className="absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-primary"
                        transition={{ type: "spring", duration: 0.3 }}
                      />
                    )}

                    <div className="flex items-start gap-2.5 pl-2">
                      {/* Timeline dot */}
                      <div className="mt-1.5 relative">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full ring-2 shrink-0",
                            isSelected
                              ? "bg-primary ring-primary/30"
                              : "bg-muted-foreground/30 ring-muted-foreground/10",
                          )}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Version number + time */}
                        <div className="flex items-center gap-2 mb-0.5">
                          <span
                            className={cn(
                              "text-xs font-mono font-semibold",
                              isSelected ? "text-primary" : "text-muted-foreground",
                            )}
                          >
                            v{version.version_number}
                          </span>
                          {idx === 0 && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-0">
                              Latest
                            </Badge>
                          )}
                          {version.id === publishedVersionId && (
                            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-green-500/20 text-green-600 dark:text-green-400 border-0">
                              Published
                            </Badge>
                          )}
                        </div>

                        {/* Title truncated */}
                        <p className="text-sm font-medium truncate mb-1">
                          {version.title || "Untitled"}
                        </p>

                        {/* Meta */}
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span>
                            {isRecent
                              ? formatDistanceToNow(createdAt, { addSuffix: true })
                              : format(createdAt, "MMM d, yyyy")}
                          </span>
                        </div>

                        {/* Change description */}
                        {version.change_description && (
                          <p className="text-[11px] text-muted-foreground/70 mt-1 truncate italic">
                            {version.change_description}
                          </p>
                        )}
                      </div>

                      {/* Select chevron */}
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 mt-1 shrink-0 transition-opacity",
                          isSelected ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-50",
                        )}
                      />
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* ── Content Area ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedVersion && (
            <>
              {/* Version detail header */}
              <div className="flex items-center justify-between px-5 py-3 border-b bg-background">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant="outline" className="font-mono shrink-0">
                    v{selectedVersion.version_number}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {selectedVersion.title || "Untitled"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(selectedVersion.created_at), "MMMM d, yyyy 'at' h:mm a")}
                      {selectedVersion.creator && (
                        <> · {selectedVersion.creator.full_name || selectedVersion.creator.username}</>
                      )}
                    </p>
                  </div>
                </div>

                {selectedIdx > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => setShowRestoreDialog(true)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restore
                  </Button>
                )}
              </div>

              {/* Content */}
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
                      <div className="blocknote-seamless">
                        <BlockNoteEditor
                          initialContent={selectedBlocks}
                          editable={false}
                        />
                      </div>
                    ) : (
                      previousVersion ? (
                        <DiffViewer
                          oldContent={previousVersion.content}
                          newContent={selectedVersion.content}
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                          <GitCompareArrows className="h-8 w-8 mb-3 opacity-50" />
                          <p className="text-sm">This is the first version — no previous version to compare</p>
                        </div>
                      )
                    )}
                  </motion.div>
                </AnimatePresence>
              </ScrollArea>
            </>
          )}
        </div>
      </div>

      {/* Restore Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Restore to v{selectedVersion?.version_number}
            </DialogTitle>
            <DialogDescription>
              This will replace the current content with this version. A new version will be created
              to preserve the current state. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {/* Preview summary */}
          {selectedVersion && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  v{selectedVersion.version_number}
                </Badge>
                <span className="text-sm font-medium">{selectedVersion.title || "Untitled"}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Created {format(new Date(selectedVersion.created_at), "MMMM d, yyyy 'at' h:mm a")}
                {selectedVersion.creator && (
                  <> by {selectedVersion.creator.full_name || selectedVersion.creator.username}</>
                )}
              </p>
              {selectedVersion.change_description && (
                <p className="text-xs text-muted-foreground italic">
                  &quot;{selectedVersion.change_description}&quot;
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowRestoreDialog(false)}
              disabled={isRestoring}
            >
              Cancel
            </Button>
            <Button onClick={handleRestore} disabled={isRestoring} className="gap-1.5">
              <RotateCcw className={cn("h-3.5 w-3.5", isRestoring && "animate-spin")} />
              {isRestoring ? "Restoring…" : "Restore this version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
