"use client"

import Link from "@/components/ui/app-link"
import { AlertCircle, ExternalLink, History } from "lucide-react"
import { Button } from "@shared/components/ui/button"
import { Alert, AlertDescription } from "@shared/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/components/ui/card"
import { Skeleton } from "@shared/components/ui/skeleton"
import { HomeSiteBuilder } from "@/components/home/home-site-builder"
import { HomeVersionHistory } from "@/components/home/version-history"
import { LazyVersionSaveDialog } from "@/components/admin/lazy-version-save-dialog"
import {
  VersionSaveButton,
  VersionSaveStatusButton,
} from "@/components/content/version-save-controls"
import { useHomeBuilderDraft } from "@/features/admin/hooks/use-home-builder-draft"

export default function AdminHomeBuilderPage() {
  const {
    authLoading,
    error,
    isLoading,
    isSavingVersion,
    notices,
    page,
    draftData,
    posts,
    projects,
    saveStatus,
    showHistory,
    setShowHistory,
    showSaveDialog,
    setShowSaveDialog,
    versionMessage,
    setVersionMessage,
    hasVersionableDraft,
    applyDraftData,
    openSaveDialog,
    handleSaveVersion,
    handleVersionRestored,
  } = useHomeBuilderDraft()

  if (authLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-[48rem] w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">홈</h1>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-muted/50 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <VersionSaveStatusButton
            status={saveStatus}
            disabled={
              isSavingVersion ||
              saveStatus === "pending" ||
              saveStatus === "saving" ||
              !hasVersionableDraft
            }
            onClick={openSaveDialog}
            size="md"
          />
        </div>

        <div className="flex-1" />

        <Button variant="ghost" size="sm" asChild>
          <Link href="/" target="_blank" rel="noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            공개 홈 보기
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory((current) => !current)}
          disabled={!page?.id}
        >
          <History className="mr-2 h-4 w-4" />
          히스토리
        </Button>
        <VersionSaveButton
          onClick={openSaveDialog}
          isSaving={isSavingVersion}
          disabled={
            isSavingVersion ||
            saveStatus === "pending" ||
            saveStatus === "saving" ||
            !hasVersionableDraft
          }
          className="text-xs gap-1.5"
        />
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {notices.length > 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {notices.map((notice) => (
              <span key={`${notice.code}:${notice.message}`} className="block">
                {notice.message}
              </span>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      {showHistory && page?.id ? (
        <Card>
          <CardHeader>
            <CardTitle>홈 히스토리</CardTitle>
            <CardDescription>저장된 버전을 보고 원하는 시점으로 다시 작업할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <HomeVersionHistory
              currentVersionId={page.currentVersionId}
              publishedVersionId={page.publishedVersionId}
              currentData={draftData}
              currentNotices={notices}
              onVersionRestored={handleVersionRestored}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <HomeSiteBuilder
            data={draftData}
            projects={projects}
            posts={posts}
            editable
            onChange={applyDraftData}
          />
        </CardContent>
      </Card>

      <LazyVersionSaveDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        title="홈 버전 저장"
        description="자동 저장과 별도로, 지금 상태를 홈 버전으로 남깁니다."
        message={versionMessage}
        onMessageChange={setVersionMessage}
        onConfirm={() => void handleSaveVersion(versionMessage.trim())}
        isSaving={isSavingVersion}
        confirmLabel="저장"
      />
    </div>
  )
}
