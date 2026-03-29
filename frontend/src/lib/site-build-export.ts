import { buildApiUrl } from "@/lib/api-client"
import type { HomeDocumentDTO, Post, Project, Tag } from "@/lib/content-model"

type SiteBuildExport = {
  release: {
    live_commit_sha: string
    generated_at: string
  }
  home: HomeDocumentDTO | null
  posts: Post[]
  projects: Project[]
  tags: Tag[]
}

let siteBuildExportPromise: Promise<SiteBuildExport | null> | null = null

async function loadSiteBuildExport(): Promise<SiteBuildExport | null> {
  if (!import.meta.env.SSR || import.meta.env.DEV) {
    return null
  }

  const response = await fetch(buildApiUrl("/site/export"), {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`failed to load site build export: ${response.status}`)
  }

  return (await response.json()) as SiteBuildExport
}

export async function getSiteBuildExport(): Promise<SiteBuildExport | null> {
  siteBuildExportPromise ??= loadSiteBuildExport()
  return siteBuildExportPromise
}
