"use client"

import { useEffect, useMemo, useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { ko } from "date-fns/locale"
import { AlertTriangle, Eye, GitCompareArrows, History, RotateCcw } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { getPosts } from "@/lib/blog-service"
import { getProjects } from "@/lib/project-service"
import { Badge } from "@shared/components/ui/badge"
import { Button } from "@shared/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@shared/components/ui/skeleton"
import { StatePanel } from "@shared/components/ui/state-panel"
import { HomePageRenderer } from "@/components/home/home-page-renderer"
import {
  getHomePageVersions,
  restoreHomePageVersion,
  type HomePageData,
  type HomePageDocument,
  type HomePageNotice,
  type HomePageVersion,
} from "@/lib/home-page-service"
import { shortVersionHash } from "@/lib/version-utils"

type PreviewMode = "view" | "compare" | null

export function HomeVersionHistory({
  currentVersionId,
  publishedVersionId,
  currentData,
  currentNotices,
  onVersionRestored,
}: {
  currentVersionId?: string | null
  publishedVersionId?: string | null
  currentData: HomePageData
  currentNotices: HomePageNotice[]
  onVersionRestored: (next: HomePageDocument) => void
}) {
  const { user } = useAuth()
  const [versions, setVersions] = useState<HomePageVersion[]>([])
  const [projects, setProjects] = useState<Awaited<ReturnType<typeof getProjects>>>([])
  const [posts, setPosts] = useState<Awaited<ReturnType<typeof getPosts>>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<PreviewMode>(null)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    currentVersionId || null,
  )
  const [isRestoring, setIsRestoring] = useState(false)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      setIsLoading(true)
      setError(null)

      try {
        const [versionData, projectData, postData] = await Promise.all([
          getHomePageVersions(),
          getProjects(true),
          getPosts(1, 6, true),
        ])
        if (!mounted) return
        setVersions(versionData)
        setProjects(projectData)
        setPosts(postData)
      } catch (loadError) {
        if (!mounted) return
        setError(
          loadError instanceof Error
            ? loadError.message
            : "홈 버전 히스토리를 불러오지 못했습니다.",
        )
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) || null,
    [selectedVersionId, versions],
  )

  useEffect(() => {
    if (currentVersionId) {
      setSelectedVersionId(currentVersionId)
    } else if (versions[0]?.id) {
      setSelectedVersionId(versions[0].id)
    }
  }, [currentVersionId, versions])

  const openPreview = (version: HomePageVersion, mode: Exclude<PreviewMode, null>) => {
    setSelectedVersionId(version.id)
    setPreviewMode(mode)
  }

  const handleRestore = async () => {
    if (!user || !selectedVersion || isRestoring) return

    setIsRestoring(true)
    setError(null)
    try {
      const restored = await restoreHomePageVersion({
        versionNumber: selectedVersion.version_number,
      })
      onVersionRestored(restored)
      setShowRestoreDialog(false)
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "선택한 홈 버전을 복원하지 못했습니다.",
      )
    } finally {
      setIsRestoring(false)
    }
  }

  if (isLoading) {
    return <Skeleton className="h-[20rem] w-full rounded-xl" />
  }

  if (error && versions.length === 0) {
    return (
      <StatePanel
        className="max-w-lg"
        tone="danger"
        size="compact"
        icon={<AlertTriangle className="h-5 w-5" />}
        title="히스토리를 불러오지 못했습니다"
        description={error}
      />
    )
  }

  if (versions.length === 0) {
    return (
      <StatePanel
        className="max-w-lg"
        size="compact"
        icon={<History className="h-5 w-5" />}
        title="저장된 버전이 없습니다"
        description="직접 저장한 홈 버전이 생기면 여기에 표시됩니다."
      />
    )
  }

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/60">
        <div className="grid grid-cols-[7rem_1fr_10rem_16rem] gap-3 border-b border-border/60 bg-muted/40 px-4 py-3 text-xs font-medium text-muted-foreground">
          <div>버전</div>
          <div>설명</div>
          <div>저장 시각</div>
          <div>작업</div>
        </div>
        <ScrollArea className="h-[22rem]">
          <div className="divide-y divide-border/60">
            {versions.map((version) => (
              <div
                key={version.id}
                className="grid grid-cols-[7rem_1fr_10rem_16rem] gap-3 px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">{shortVersionHash(version.id)}</span>
                  {version.id === currentVersionId ? <Badge variant="outline">현재</Badge> : null}
                  {version.id === publishedVersionId ? (
                    <Badge variant="secondary">공개</Badge>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {version.change_description || version.summary || version.title || "홈 페이지"}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(version.created_at), {
                      addSuffix: true,
                      locale: ko,
                    })}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(version.created_at), "MM.dd HH:mm")}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => openPreview(version, "view")}
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" />
                    보기
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => openPreview(version, "compare")}
                  >
                    <GitCompareArrows className="mr-1 h-3.5 w-3.5" />
                    비교
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      setSelectedVersionId(version.id)
                      setShowRestoreDialog(true)
                    }}
                  >
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    복원
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <Dialog open={previewMode !== null} onOpenChange={(open) => !open && setPreviewMode(null)}>
        <DialogContent className="max-w-[min(96vw,88rem)]">
          <DialogHeader>
            <DialogTitle>
              {previewMode === "compare"
                ? `현재 작업본과 ${shortVersionHash(selectedVersion?.id)} 비교`
                : `${shortVersionHash(selectedVersion?.id)} 보기`}
            </DialogTitle>
          </DialogHeader>

          {selectedVersion ? (
            previewMode === "compare" ? (
              <div className="grid max-h-[80vh] gap-4 overflow-auto lg:grid-cols-2">
                <div className="space-y-3">
                  <div className="text-sm font-semibold">현재 작업본</div>
                  <div className="overflow-hidden rounded-xl border border-border/60">
                    <HomePageRenderer
                      data={currentData}
                      notices={currentNotices}
                      projects={projects}
                      posts={posts}
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="text-sm font-semibold">
                    {shortVersionHash(selectedVersion.id)}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border/60">
                    <HomePageRenderer
                      data={selectedVersion.data}
                      notices={selectedVersion.notices}
                      projects={projects}
                      posts={posts}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-h-[80vh] overflow-auto">
                <div className="overflow-hidden rounded-xl border border-border/60">
                  <HomePageRenderer
                    data={selectedVersion.data}
                    notices={selectedVersion.notices}
                    projects={projects}
                    posts={posts}
                  />
                </div>
              </div>
            )
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이 버전으로 복원할까요?</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            선택한 버전을 현재 작업본으로 가져옵니다. 지금 작업 중인 내용도 새 버전으로 남습니다.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
              취소
            </Button>
            <Button onClick={handleRestore} disabled={isRestoring}>
              {isRestoring ? "복원 중..." : "복원"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
