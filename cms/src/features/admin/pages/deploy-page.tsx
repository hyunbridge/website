import { useEffect, useState } from "react"
import {
  getDeployDashboard,
  getDeployPreview,
  runDeploySync,
  type DeployJob,
  type DeployPreview,
} from "@/lib/deploy-service"
import { useResource } from "@/lib/use-resource"
import {
  DeployHistoryCard,
  DeployLiveStatusCard,
  DeployPageError,
  DeployPageHeader,
  DeployPreviewDialog,
  isActiveJobStatus,
} from "@/features/admin/pages/deploy-page-sections"

export default function DeployPage() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [isDeploying, setIsDeploying] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [preview, setPreview] = useState<DeployPreview | null>(null)

  const { data, error, isLoading } = useResource(() => getDeployDashboard(), [refreshKey])

  const refresh = () => setRefreshKey((value) => value + 1)

  const openPreview = async () => {
    setIsPreviewOpen(true)
    setIsPreviewLoading(true)
    setPreviewError(null)
    try {
      setPreview(await getDeployPreview())
    } catch (previewLoadError) {
      setPreviewError(
        previewLoadError instanceof Error
          ? previewLoadError.message
          : "배포 변경사항을 불러오지 못했습니다.",
      )
      setPreview(null)
    } finally {
      setIsPreviewLoading(false)
    }
  }

  const runDeploy = async () => {
    setIsDeploying(true)
    setDeployError(null)
    try {
      await runDeploySync()
      setIsPreviewOpen(false)
      refresh()
    } catch (deployRunError) {
      setDeployError(
        deployRunError instanceof Error
          ? deployRunError.message
          : "배포를 시작하지 못했습니다.",
      )
    } finally {
      setIsDeploying(false)
    }
  }

  const liveState = data?.live_state || null
  const jobs = data?.jobs || []
  const activeJob = jobs.find((job) => isActiveJobStatus(job.status)) || null
  const liveJob = jobs.find((job) => job.id === liveState?.last_deploy_job_id) || null
  const liveSummary = liveJob?.manifest?.summary
  const deployedAt = liveState?.last_successful_at || liveJob?.created_at || null
  const liveCommit = liveState?.live_commit_sha || liveJob?.commit_sha || null

  useEffect(() => {
    if (!activeJob) return
    const timer = window.setInterval(() => {
      refresh()
    }, 4000)
    return () => window.clearInterval(timer)
  }, [activeJob])

  return (
    <div className="space-y-6">
      <DeployPageHeader
        isPreviewLoading={isPreviewLoading}
        isDeploying={isDeploying}
        onOpenPreview={() => void openPreview()}
      />

      <DeployPageError error={deployError || error} />

      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-12 lg:col-span-4 flex flex-col gap-6">
          <DeployLiveStatusCard
            isLoading={isLoading}
            liveState={liveState}
            liveJob={liveJob}
            liveSummary={liveSummary}
            activeJob={activeJob}
            deployedAt={deployedAt}
            liveCommit={liveCommit}
          />
        </div>

        <div className="md:col-span-12 lg:col-span-8">
          <DeployHistoryCard isLoading={isLoading} jobs={jobs} />
        </div>
      </div>

      <DeployPreviewDialog
        open={isPreviewOpen}
        isPreviewLoading={isPreviewLoading}
        isDeploying={isDeploying}
        previewError={previewError}
        preview={preview}
        activeJob={activeJob}
        onOpenChange={setIsPreviewOpen}
        onRunDeploy={() => void runDeploy()}
      />
    </div>
  )
}
