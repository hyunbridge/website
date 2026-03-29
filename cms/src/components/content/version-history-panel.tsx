"use client"

import { useState, useEffect } from "react"
import { History, Eye, GitCompareArrows, AlertTriangle } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Badge } from "@shared/components/ui/badge"
import { Skeleton } from "@shared/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@shared/hooks/use-toast"
import { StatePanel } from "@shared/components/ui/state-panel"
import { shortVersionHash } from "@/lib/version-utils"
import { VersionHistoryList } from "./version-history-list"
import { VersionHistoryDetail } from "./version-history-detail"
import { VersionHistoryRestoreDialog } from "./version-history-restore-dialog"
import type { VersionHistoryEntry } from "./version-history-types"

type VersionHistoryPanelProps = {
  itemId: string
  publishedVersionId?: string | null
  onVersionRestored: () => void
  loadVersions: (itemId: string) => Promise<VersionHistoryEntry[]>
  restoreVersion: (itemId: string, versionNumber: number) => Promise<unknown>
}

export function VersionHistoryPanel({
  itemId,
  publishedVersionId,
  onVersionRestored,
  loadVersions,
  restoreVersion,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<VersionHistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [viewMode, setViewMode] = useState<"preview" | "diff">("preview")
  const [isRestoring, setIsRestoring] = useState(false)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const { user } = useAuth()
  const { toast } = useToast()

  useEffect(() => {
    if (!itemId) return
    setIsLoading(true)
    loadVersions(itemId)
      .then((data) => {
        setVersions(data || [])
        setError(null)
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error("Unknown error"))
        setVersions([])
      })
      .finally(() => setIsLoading(false))
  }, [itemId, loadVersions])

  const selectedVersion = versions[selectedIdx] || null
  const previousVersion = versions[selectedIdx + 1] || null

  const handleRestore = async () => {
    if (!user || !selectedVersion) return
    setIsRestoring(true)
    try {
      await restoreVersion(itemId, selectedVersion.version_number)
      toast({
        title: "버전을 복원했습니다",
        description: `${shortVersionHash(selectedVersion.id)} 버전으로 돌아갔습니다.`,
      })
      setShowRestoreDialog(false)
      onVersionRestored()
    } catch {
      toast({
        title: "복원하지 못했습니다",
        description: "버전을 복원하지 못했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsRestoring(false)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="mb-6 flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="flex gap-6">
          <div className="w-72 space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </div>
          <div className="flex-1">
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <StatePanel
          size="compact"
          tone="danger"
          icon={<AlertTriangle className="h-5 w-5" />}
          title="버전 기록을 불러오지 못했습니다"
        />
      </div>
    )
  }

  if (!versions.length) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <StatePanel
          size="compact"
          icon={<History className="h-5 w-5" />}
          title="아직 저장된 버전이 없습니다"
          description="직접 저장한 버전이 생기면 여기에 표시됩니다."
        />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">버전 기록</span>
          <Badge variant="secondary" className="font-mono text-xs">
            {versions.length}
          </Badge>
        </div>
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "preview" | "diff")}>
          <TabsList className="h-8">
            <TabsTrigger value="preview" className="h-7 gap-1.5 px-3 text-xs">
              <Eye className="h-3 w-3" />
              미리보기
            </TabsTrigger>
            <TabsTrigger value="diff" className="h-7 gap-1.5 px-3 text-xs">
              <GitCompareArrows className="h-3 w-3" />
              변경사항
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex min-h-[400px] max-h-[600px]">
        <VersionHistoryList
          versions={versions}
          selectedIdx={selectedIdx}
          publishedVersionId={publishedVersionId}
          onSelect={setSelectedIdx}
        />
        <VersionHistoryDetail
          selectedVersion={selectedVersion}
          previousVersion={previousVersion}
          selectedIdx={selectedIdx}
          viewMode={viewMode}
          onRestoreClick={() => setShowRestoreDialog(true)}
        />
      </div>

      <VersionHistoryRestoreDialog
        open={showRestoreDialog}
        version={selectedVersion}
        isRestoring={isRestoring}
        onOpenChange={setShowRestoreDialog}
        onConfirm={handleRestore}
      />
    </div>
  )
}
