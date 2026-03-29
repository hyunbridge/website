import { apiRequest, isApiError } from "@/lib/api-client"
import type { Project, ProjectLink } from "@/lib/content-model"
import { getSiteBuildExport } from "@/lib/site-build-export"

export type { Project, ProjectLink }

export async function getProjects(_publishedOnly = true): Promise<Project[]> {
  const site = await getSiteBuildExport()
  if (site) {
    return site.projects
  }

  return apiRequest<Project[]>("/projects", {
    cache: "no-store",
  })
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const site = await getSiteBuildExport()
  if (site) {
    return site.projects.find((project) => project.slug === slug) || null
  }

  try {
    return await apiRequest<Project>(`/projects/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    })
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function getProjectPublishedVersion(versionId: string) {
  return apiRequest<{ title: string; content: string; summary: string | null }>(
    `/projects/versions/${encodeURIComponent(versionId)}`,
    {
      cache: "no-store",
    },
  )
}
