import { request } from "@/lib/api-client"

export type DeployJob = {
  id: string
  type: string
  status: "queued" | "dispatching" | "waiting_result" | "succeeded" | "failed"
  commit_sha?: string | null
  requested_by: string
  logs: string[]
  meta: Record<string, unknown>
  manifest?: DeployManifest | null
  created_at: string
  updated_at: string
  started_at?: string | null
  completed_at?: string | null
}

export type LiveDeployState = {
  id: string
  live_commit_sha: string
  last_deploy_job_id?: string | null
  last_successful_at?: string | null
  public_base_url?: string | null
}

export type DeployDashboard = {
  live_state?: LiveDeployState | null
  jobs: DeployJob[]
}

export type DeployPreviewSummary = {
  publish_count: number
  update_count: number
  unpublish_count: number
  total_count: number
}

export type DeployPreviewItem = {
  id: string
  kind: "home" | "post" | "project"
  title: string
  slug?: string | null
  change_type: "publish" | "update" | "unpublish"
  live_version_id?: string | null
  live_version_title?: string | null
  live_version_message?: string | null
  target_version_id?: string | null
  target_version_title?: string | null
  target_version_message?: string | null
}

export type DeployPreview = {
  live_state?: LiveDeployState | null
  summary: DeployPreviewSummary
  items: DeployPreviewItem[]
}

export type DeployManifestSummary = {
  publish_count: number
  update_count: number
  unpublish_count: number
  total_count: number
}

export type DeployManifestChange = {
  kind: "home" | "post" | "project"
  document_id: string
  title: string
  slug?: string | null
  change_type: "publish" | "update" | "unpublish"
  from?: string | null
  to?: string | null
  from_metadata?: string
  to_metadata?: string
  from_body?: string
  to_body?: string
  diff?: string
  commits?: DeployManifestCommit[]
}

export type DeployManifestCommit = {
  sha: string
  message: string
  author: string
  created_at: string
  diff?: string
}

export type DeployManifest = {
  schema_version: number
  kind: "deploy"
  published_at: string
  actor: string
  site_commit: string
  summary: DeployManifestSummary
  changes: DeployManifestChange[]
}

export async function getDeployDashboard() {
  return request<DeployDashboard>("/admin/deploy", { auth: true })
}

export async function getDeployPreview() {
  return request<DeployPreview>("/admin/deploy/preview", { auth: true })
}

export async function runDeploySync() {
  return request<DeployDashboard>("/admin/deploy/sync", {
    method: "POST",
    auth: true,
    body: {},
  })
}
