import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Globe,
  History,
  Loader2,
  RefreshCw,
} from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@shared/components/ui/alert"
import { Badge } from "@shared/components/ui/badge"
import { Button } from "@shared/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@shared/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@shared/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  GitDiffViewer,
  RenderedContentComparison,
  TextDiffViewer,
} from "@/components/content/content-diff-viewer"
import { shortVersionHash } from "@/lib/version-utils"
import { cn } from "@shared/lib/utils"
import type {
  DeployJob,
  DeployManifestSummary,
  DeployPreview,
  DeployPreviewItem,
  LiveDeployState,
} from "@/lib/deploy-service"

function formatDate(value?: string | null) {
  if (!value) return "-"
  return new Date(value).toLocaleString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function shortHash(value?: string | null) {
  return shortVersionHash(value, 10)
}

function changeTypeLabel(changeType: DeployPreviewItem["change_type"]) {
  switch (changeType) {
    case "publish":
      return "새 공개"
    case "update":
      return "업데이트"
    case "unpublish":
      return "공개 중단"
    default:
      return changeType
  }
}

function kindLabel(kind: DeployPreviewItem["kind"]) {
  switch (kind) {
    case "home":
      return "홈"
    case "post":
      return "블로그"
    case "project":
      return "프로젝트"
    default:
      return kind
  }
}

function changeTypeVariant(changeType: DeployPreviewItem["change_type"]) {
  switch (changeType) {
    case "publish":
      return "default"
    case "update":
      return "secondary"
    case "unpublish":
      return "destructive"
    default:
      return "outline"
  }
}

function readJobHeadline(job: DeployJob) {
  if (job.status === "queued") return "배포 대기 중"
  if (job.status === "dispatching") return "배포 준비 중"
  if (job.status === "waiting_result") return "배포 결과 확인 중"
  const manifest = job.manifest
  if (!manifest || manifest.changes.length === 0) return "배포 기록"
  if (manifest.changes.length === 1) {
    const [change] = manifest.changes
    return `${kindLabel(change.kind as DeployPreviewItem["kind"])} ${change.title}`
  }
  return `${manifest.summary.total_count}개 항목 반영`
}

function readJobDescription(job: DeployJob) {
  if (job.status === "queued") return "앞선 배포가 끝나면 자동으로 시작됩니다."
  if (job.status === "dispatching") return "배포를 준비 중입니다."
  if (job.status === "waiting_result") return "배포 결과를 기다리는 중입니다."
  if (job.status === "failed" && job.logs.length > 0) return job.logs[job.logs.length - 1]
  const manifest = job.manifest
  if (!manifest || manifest.changes.length === 0) return "반영된 변경이 없습니다."
  const names = manifest.changes
    .slice(0, 3)
    .map((change) => `${change.title} ${changeTypeLabel(change.change_type)}`)
  if (manifest.changes.length > 3) {
    names.push(`외 ${manifest.changes.length - 3}건`)
  }
  return names.join(" · ")
}

function readSummaryLabel(job: DeployJob) {
  const totalCount = job.manifest?.summary.total_count
  if (!totalCount || totalCount <= 0) return "변경 없음"
  return `${totalCount}건 반영`
}

function readJobItemsPreview(job: DeployJob) {
  const changes = job.manifest?.changes || []
  if (changes.length === 0) return ""
  const names = changes.slice(0, 2).map((change) => change.title)
  if (changes.length > 2) {
    names.push(`외 ${changes.length - 2}건`)
  }
  return names.join(" · ")
}

function readDeployStatusDescription(liveState: LiveDeployState | null, liveJob: DeployJob | null) {
  if (liveState?.last_successful_at) {
    return `${formatDate(liveState.last_successful_at)} 기준으로 사이트에 반영된 상태입니다.`
  }
  if (liveJob) {
    return `${formatDate(liveJob.created_at)} 기준으로 사이트에 반영된 상태입니다.`
  }
  return "아직 운영에 반영된 배포가 없습니다."
}

function summaryCount(
  summary: DeployManifestSummary | undefined | null,
  key: keyof DeployManifestSummary,
) {
  return summary?.[key] ?? 0
}

function jobStatusLabel(status: DeployJob["status"]) {
  switch (status) {
    case "queued":
      return "대기 중"
    case "dispatching":
      return "배포 준비 중"
    case "waiting_result":
      return "결과 대기"
    case "succeeded":
      return "성공"
    case "failed":
      return "실패"
    default:
      return status
  }
}

function jobStatusVariant(status: DeployJob["status"]) {
  switch (status) {
    case "queued":
      return "outline"
    case "dispatching":
      return "secondary"
    case "waiting_result":
      return "default"
    case "succeeded":
      return "secondary"
    case "failed":
      return "destructive"
    default:
      return "outline"
  }
}

function readPublicBaseUrl(value?: string | null) {
  if (!value) return "-"
  try {
    return new URL(value).host
  } catch {
    return value
  }
}

function renderChangeCountLabel(preview: DeployPreview) {
  if (preview.summary.total_count === 0) return "변경 없음"
  return `${preview.summary.total_count}건 변경`
}

function renderEmptyPreviewMessage(preview: DeployPreview) {
  if (!preview.live_state?.last_successful_at) {
    return "배포할 항목이 아직 없습니다. 저장한 뒤 공개로 바꾼 항목만 배포할 수 있습니다."
  }
  return "지금 배포할 변경이 없습니다."
}

export function isActiveJobStatus(status: DeployJob["status"]) {
  return status === "queued" || status === "dispatching" || status === "waiting_result"
}

export function DeployPageHeader({
  isPreviewLoading,
  isDeploying,
  onOpenPreview,
}: {
  isPreviewLoading: boolean
  isDeploying: boolean
  onOpenPreview: () => void
}) {
  return (
    <div className="flex items-center justify-between mb-8">
      <h1 className="text-3xl font-bold">배포</h1>
      <Button onClick={onOpenPreview} disabled={isPreviewLoading || isDeploying}>
        {isPreviewLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            계산 중...
          </>
        ) : (
          <>
            <RefreshCw className="h-4 w-4 mr-2" />
            변경사항 검토 및 배포
          </>
        )}
      </Button>
    </div>
  )
}

export function DeployPageError({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>오류 발생</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )
}

export function DeployLiveStatusCard({
  isLoading,
  liveState,
  liveJob,
  liveSummary,
  activeJob,
  deployedAt,
  liveCommit,
}: {
  isLoading: boolean
  liveState: LiveDeployState | null
  liveJob: DeployJob | null
  liveSummary: DeployManifestSummary | undefined
  activeJob: DeployJob | null
  deployedAt: string | null
  liveCommit: string | null
}) {
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-muted border-primary/10 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 p-6 opacity-10">
        <Globe className="h-24 w-24" />
      </div>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          현재 배포 상태
        </CardTitle>
        <CardDescription>
          {isLoading
            ? "배포 상태를 불러오는 중입니다..."
            : readDeployStatusDescription(liveState, liveJob)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {liveJob || liveState ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">현재 운영 상태</Badge>
              <Badge variant="outline">
                {deployedAt ? `${formatDate(deployedAt)} 배포` : "배포 시각 없음"}
              </Badge>
              {activeJob ? (
                <Badge variant={jobStatusVariant(activeJob.status)}>
                  {jobStatusLabel(activeJob.status)}
                </Badge>
              ) : null}
            </div>

            {liveJob ? (
              <div className="space-y-1">
                <div className="font-semibold text-lg text-foreground">{readJobHeadline(liveJob)}</div>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {readJobItemsPreview(liveJob) || readJobDescription(liveJob)}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-primary/10 bg-background/70 p-3">
                <div className="text-[11px] font-medium text-muted-foreground">운영 버전</div>
                <div className="mt-1 font-mono text-sm text-foreground">
                  {liveCommit ? shortHash(liveCommit) : "-"}
                </div>
              </div>
              <div className="rounded-xl border border-primary/10 bg-background/70 p-3">
                <div className="text-[11px] font-medium text-muted-foreground">공개 주소</div>
                <div className="mt-1 text-sm text-foreground break-all">
                  {readPublicBaseUrl(liveState?.public_base_url)}
                </div>
              </div>
              <div className="rounded-xl border border-primary/10 bg-background/70 p-3">
                <div className="text-[11px] font-medium text-muted-foreground">마지막 배포자</div>
                <div className="mt-1 text-sm text-foreground">{liveJob?.requested_by || "-"}</div>
              </div>
              <div className="rounded-xl border border-primary/10 bg-background/70 p-3">
                <div className="text-[11px] font-medium text-muted-foreground">반영된 변경</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary">새 공개 {summaryCount(liveSummary, "publish_count")}</Badge>
                  <Badge variant="secondary">업데이트 {summaryCount(liveSummary, "update_count")}</Badge>
                  <Badge variant="secondary">중단 {summaryCount(liveSummary, "unpublish_count")}</Badge>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-primary/10 text-xs text-muted-foreground">
              {activeJob
                ? `${formatDate(activeJob.created_at)}에 요청된 배포가 현재 ${jobStatusLabel(activeJob.status)} 상태입니다.`
                : liveSummary?.total_count
                  ? `최근 배포에서 총 ${liveSummary.total_count}건이 반영되었습니다.`
                  : "최근 배포에서 반영된 변경 건수가 없습니다."}
            </div>
          </div>
        ) : (
          <div className="py-4 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm text-muted-foreground">아직 공개된 버전이 없습니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function DeployHistoryCard({
  isLoading,
  jobs,
}: {
  isLoading: boolean
  jobs: DeployJob[]
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <History className="h-5 w-5" />
            배포 기록
          </CardTitle>
          <CardDescription className="mt-1">최근 반영된 배포 작업의 상세 내역입니다.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin mb-2 opacity-50" />
            기록을 불러오는 중입니다...
          </div>
        ) : jobs.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">아직 배포 기록이 없습니다.</div>
        ) : (
          <Accordion type="single" collapsible className="w-full">
            {jobs.map((job) => (
              <AccordionItem key={job.id} value={job.id} className="border-b px-6 py-2 last:border-b-0">
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3 w-full text-left mr-4">
                    <div className="flex flex-col gap-1 min-w-[140px]">
                      <span className="text-xs font-semibold text-muted-foreground">
                        {formatDate(job.created_at)}
                      </span>
                      <div className="flex gap-2 items-center">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                          {readSummaryLabel(job)}
                        </Badge>
                        <Badge variant={jobStatusVariant(job.status)} className="text-[10px] px-1.5 py-0 h-5">
                          {jobStatusLabel(job.status)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate text-foreground">
                        {readJobHeadline(job)}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {readJobItemsPreview(job) || readJobDescription(job)}
                      </div>
                    </div>
                    <div className="hidden lg:flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {job.requested_by}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                {job.manifest?.changes?.length ? (
                  <AccordionContent className="pb-6 pt-2">
                    <div className="bg-muted/30 rounded-xl border p-4 space-y-4">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                        변경 항목 ({job.manifest.changes.length})
                      </h4>
                      <Accordion type="multiple" className="w-full space-y-3">
                        {job.manifest.changes.map((change) => {
                          const changeKey = `${job.id}:${change.kind}:${change.document_id}`
                          return (
                            <AccordionItem
                              key={changeKey}
                              value={changeKey}
                              className="border bg-background rounded-lg px-2 overflow-hidden shadow-sm"
                            >
                              <AccordionTrigger className="hover:no-underline py-3 px-2">
                                <div className="flex flex-wrap items-center gap-2 text-left pr-4">
                                  <Badge variant="secondary" className="font-mono text-[10px]">
                                    {kindLabel(change.kind)}
                                  </Badge>
                                  <Badge variant={changeTypeVariant(change.change_type)} className="text-[10px]">
                                    {changeTypeLabel(change.change_type)}
                                  </Badge>
                                  <span className="font-medium text-sm text-foreground">
                                    {change.title}
                                  </span>
                                  {change.slug ? (
                                    <span className="text-xs text-muted-foreground max-w-[100px] truncate">
                                      /{change.slug}
                                    </span>
                                  ) : null}
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-5 pb-5">
                                <div className="space-y-6">
                                  {change.from_metadata !== change.to_metadata ? (
                                    <div className="space-y-2">
                                      <h5 className="text-sm font-semibold text-foreground">메타데이터</h5>
                                      <div className="rounded-lg border bg-background shadow-sm overflow-hidden p-4">
                                        <TextDiffViewer
                                          previous={change.from_metadata}
                                          current={change.to_metadata}
                                        />
                                      </div>
                                    </div>
                                  ) : null}

                                  <div className="space-y-2">
                                    <h5 className="text-sm font-semibold text-foreground">본문 렌더링</h5>
                                    <div className="rounded-lg border bg-background shadow-sm overflow-hidden p-4">
                                      <RenderedContentComparison
                                        previous={change.from_body}
                                        current={change.to_body}
                                      />
                                    </div>
                                  </div>

                                  {change.commits && change.commits.length > 0 ? (
                                    <div className="space-y-2">
                                      <h5 className="text-sm font-semibold text-foreground">저장 이력</h5>
                                      <div className="rounded-lg border bg-background shadow-sm overflow-hidden flex flex-col gap-0 p-1">
                                        <Accordion type="multiple" className="space-y-1">
                                          {change.commits.map((commit) => {
                                            const commitKey = `${job.id}:${change.document_id}:${commit.sha}`
                                            return (
                                              <AccordionItem
                                                key={commitKey}
                                                value={commitKey}
                                                className="border rounded-md px-3 bg-muted/10 last:border-b"
                                              >
                                                <AccordionTrigger className="hover:no-underline py-2">
                                                  <div className="flex flex-col lg:flex-row lg:items-center gap-3 text-left mr-4">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                      <span className="font-mono text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded shrink-0">
                                                        {shortHash(commit.sha)}
                                                      </span>
                                                      <span className="text-sm font-semibold text-foreground break-all">
                                                        {commit.message}
                                                      </span>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground shrink-0">
                                                      {formatDate(commit.created_at)} · {commit.author}
                                                    </div>
                                                  </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="pt-2 pb-3 border-t mt-1">
                                                  <GitDiffViewer diff={commit.diff} />
                                                </AccordionContent>
                                              </AccordionItem>
                                            )
                                          })}
                                        </Accordion>
                                      </div>
                                    </div>
                                  ) : null}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          )
                        })}
                      </Accordion>
                    </div>
                  </AccordionContent>
                ) : null}
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  )
}

export function DeployPreviewDialog({
  open,
  isPreviewLoading,
  isDeploying,
  previewError,
  preview,
  activeJob,
  onOpenChange,
  onRunDeploy,
}: {
  open: boolean
  isPreviewLoading: boolean
  isDeploying: boolean
  previewError: string | null
  preview: DeployPreview | null
  activeJob: DeployJob | null
  onOpenChange: (open: boolean) => void
  onRunDeploy: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <RefreshCw className={cn("h-5 w-5", isPreviewLoading && "animate-spin")} />
            배포 검토
          </DialogTitle>
        </DialogHeader>

        {isPreviewLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-sm text-muted-foreground space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            변경 내용을 확인하는 중입니다...
          </div>
        ) : null}

        {!isPreviewLoading && previewError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>검토 실패</AlertTitle>
            <AlertDescription>{previewError}</AlertDescription>
          </Alert>
        ) : null}

        {!isPreviewLoading && !previewError && preview ? (
          <div className="space-y-4">
            {preview.items.length > 0 ? (
              <div className="flex items-center justify-between pb-2 border-b">
                <span className="font-medium">반영될 변경</span>
                <Badge variant="secondary">{renderChangeCountLabel(preview)}</Badge>
              </div>
            ) : null}

            {preview.items.length === 0 ? (
              <Alert className="bg-muted">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm font-medium">
                  {renderEmptyPreviewMessage(preview)}
                </AlertDescription>
              </Alert>
            ) : (
              <ScrollArea className="max-h-[60vh] rounded-xl border bg-muted/10">
                <div className="space-y-3 p-4">
                  {preview.items.map((item) => (
                    <div
                      key={`${item.kind}:${item.id}`}
                      className="rounded-lg border bg-background p-4 shadow-sm transition-all hover:shadow-md"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {kindLabel(item.kind)}
                        </Badge>
                        <Badge variant={changeTypeVariant(item.change_type)} className="text-[10px]">
                          {changeTypeLabel(item.change_type)}
                        </Badge>
                        <span className="font-semibold text-sm">{item.title}</span>
                        {item.slug ? (
                          <span className="text-xs text-muted-foreground">/{item.slug}</span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : null}

        <DialogFooter className="pt-4 sm:justify-between border-t mt-4 flex-col sm:flex-row gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isDeploying}>
            취소
          </Button>
          <Button
            type="button"
            onClick={onRunDeploy}
            disabled={isDeploying || !preview || preview.items.length === 0}
            className="gap-2"
          >
            {isDeploying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
            {isDeploying ? "요청 중..." : "배포 요청"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
