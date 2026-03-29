import { isApiError, request } from "./api-client"
import { createTemporaryId } from "@shared/lib/client-ids"

export type Tag = {
  id: string
  name: string
  slug: string
}

export type ProjectLink = {
  id: string
  project_id: string
  label: string
  url: string
  link_type: string | null
  sort_order: number
}

export type Project = {
  id: string
  created_at: string
  updated_at: string
  title: string
  slug: string
  content: string
  owner_id: string
  summary: string
  cover_image: string | null
  published_at: string | null
  sort_order: number
  tags: Tag[]
  links: ProjectLink[]
  owner?: {
    full_name: string
    avatar_url: string | null
  }
}

export type ProjectSummary = Pick<
  Project,
  | "id"
  | "title"
  | "slug"
  | "summary"
  | "cover_image"
  | "published_at"
  | "created_at"
  | "updated_at"
  | "sort_order"
  | "tags"
>

export type ProjectVersion = {
  id: string
  version_number: number
  project_id: string
  title: string
  slug: string
  content: string
  summary?: string
  published_at?: string | null
  cover_image?: string | null
  sort_order: number
  tags: Tag[]
  change_description: string | null
  created_at: string
  created_by: string | null
  links: ProjectLink[]
}

type ProjectVersioningState = {
  item: {
    id: string
    title: string
    summary: string | null
    current_version_id: string | null
    published_version_id: string | null
    status: string
  }
  currentVersion: {
    id: string
    title: string
    summary: string | null
    body_markdown: string
    change_description: string | null
  }
  latestVersion: {
    id: string
    version_number: number
    title: string
    summary: string | null
    body_markdown: string
    change_description: string | null
  } | null
}

type ProjectVersionResponse = {
  id: string
  version_number: number
  project_id: string
  title: string
  content: string
  summary?: string
  change_description: string | null
  created_at: string
  created_by: string | null
}

type CreateProjectInput = {
  title: string
  slug: string
  summary?: string
  content?: string
  cover_image?: string | null
}

type UpdateProjectInput = Partial<{
  title: string
  slug: string
  summary: string
  content: string
  cover_image: string | null
  published_at: string | null
  sort_order: number
  tag_ids: string[]
}>

type ProjectVersionInput = {
  projectId: string
  title: string
  content: string
  summary: string
  links?: Array<{
    id?: string
      label: string
      url: string
      link_type?: string | null
      sort_order?: number
  }>
  changeDescription?: string | null
}

function normalizeProjectLinks(
  links:
    | Array<{
        id?: string
        label: string
        url: string
        link_type?: string | null
        sort_order?: number
      }>
    | undefined,
  projectId: string,
) {
  return (links || []).map((link, index) => ({
    id: link.id || createTemporaryId("project-link"),
    project_id: projectId,
    label: link.label,
    url: link.url,
    link_type: link.link_type ?? null,
    sort_order: link.sort_order ?? index,
  }))
}

function sortProjects(projects: Project[]) {
  return [...projects].sort((left, right) => {
    if (left.sort_order !== right.sort_order) return left.sort_order - right.sort_order
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })
}

async function listProjectsRaw(includeDraft: boolean) {
  if (includeDraft) {
    return request<Project[]>("/admin/projects", {
      auth: true,
      query: {
        includeDraft: true,
      },
    })
  }

  return request<Project[]>("/projects")
}

export async function getProjects(publishedOnly = true) {
  const projects = await listProjectsRaw(!publishedOnly)
  return sortProjects(projects)
}

export async function getProjectBySlug(slug: string) {
  try {
    return await request<Project>(`/projects/${encodeURIComponent(slug)}`)
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function getProjectById(id: string) {
  return request<Project>(`/admin/projects/${encodeURIComponent(id)}`, { auth: true })
}

export async function createProject(input: CreateProjectInput) {
  const created = await request<Project>("/admin/projects", {
    method: "POST",
    auth: true,
    body: {
      title: input.title,
      slug: input.slug,
      summary: input.summary || "",
    },
  })

  return updateProject(created.id, {
    content: input.content || "",
    cover_image: input.cover_image ?? null,
  })
}

export async function updateProject(
  id: string,
  patch: UpdateProjectInput,
  tagIDs?: string[],
  links?: Array<{
    id?: string
    label: string
    url: string
    link_type?: string | null
    sort_order?: number
  }>,
) {
  return request<Project>(`/admin/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    auth: true,
    body: {
      ...patch,
      ...(tagIDs ? { tag_ids: tagIDs } : {}),
      ...(links ? { links: normalizeProjectLinks(links, id) } : {}),
    },
  })
}

export async function publishProject(id: string) {
  return request<Project>(`/admin/projects/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    auth: true,
  })
}

export async function unpublishProject(id: string) {
  return request<Project>(`/admin/projects/${encodeURIComponent(id)}/publish`, {
    method: "DELETE",
    auth: true,
  })
}

export async function reorderProjects(items: Array<{ id: string; sort_order: number }>) {
  for (const item of items) {
    await updateProject(item.id, { sort_order: item.sort_order })
  }
}

export async function renameProject(id: string, title: string, slug: string) {
  return updateProject(id, { title, slug })
}

export async function saveProjectDraftContent(id: string, content: string) {
  return updateProject(id, { content })
}

export async function deleteProject(id: string) {
  return request(`/admin/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
    auth: true,
  })
}

export async function getProjectVersioningState(id: string) {
  return request<ProjectVersioningState>(
    `/admin/projects/${encodeURIComponent(id)}/version-state`,
    {
      auth: true,
    },
  )
}

export async function updateProjectVersionSnapshot(
  versionId: string,
  input: {
    title: string
    content: string
    summary: string
    links?: ProjectLink[]
    change_description?: string | null
  },
) {
  const response = await request<{ id: string }>(
    `/admin/projects/versions/${encodeURIComponent(versionId)}`,
    {
      method: "PATCH",
      auth: true,
      body: {
        title: input.title,
        content: input.content,
        summary: input.summary,
        links: normalizeProjectLinks(input.links, versionId),
        change_description: input.change_description ?? null,
      },
    },
  )
  return response.id
}

export async function createProjectVersionFromSnapshot(input: ProjectVersionInput) {
  const response = await request<{ id: string }>("/admin/projects/versions", {
    method: "POST",
    auth: true,
    body: {
      projectId: input.projectId,
      title: input.title,
      content: input.content,
      summary: input.summary,
      links: normalizeProjectLinks(input.links, input.projectId),
      changeDescription: input.changeDescription ?? null,
    },
  })

  return response.id
}

export async function setProjectCurrentVersion(
  projectId: string,
  versionId: string,
  title: string,
  summary: string,
) {
  return request(`/admin/projects/${encodeURIComponent(projectId)}/current-version`, {
    method: "POST",
    auth: true,
    body: { versionId, title, summary },
  })
}

export async function getProjectVersions(projectId: string) {
  const versions = await request<ProjectVersionResponse[]>(
    `/admin/projects/${encodeURIComponent(projectId)}/versions`,
    {
      auth: true,
    },
  )
  return versions as ProjectVersion[]
}

export async function restoreProjectVersion(projectId: string, versionNumber: number) {
  return request(`/admin/projects/${encodeURIComponent(projectId)}/restore`, {
    method: "POST",
    auth: true,
    body: { versionNumber },
  })
}

export async function getProjectPublishedVersion(versionId: string) {
  return request<{
    id: string
    title: string
    summary?: string | null
    content: string
    links?: ProjectLink[]
  }>(`/projects/versions/${encodeURIComponent(versionId)}`)
}

export async function getProjectCount() {
  const counts = await request<{ projectCount: number }>("/admin/dashboard", { auth: true })
  return counts.projectCount
}

export async function getRecentProjects(limit: number) {
  const projects = await request<Project[]>("/admin/projects", {
    auth: true,
    query: { includeDraft: true },
  })

  return [...projects]
    .sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    )
    .slice(0, limit)
    .map<ProjectSummary>((project) => ({
      id: project.id,
      title: project.title,
      slug: project.slug,
      summary: project.summary,
      cover_image: project.cover_image,
      published_at: project.published_at,
      created_at: project.created_at,
      updated_at: project.updated_at,
      sort_order: project.sort_order,
      tags: project.tags,
    }))
}

export async function addProjectTag(projectId: string, tagId: string) {
  const project = await getProjectById(projectId)
  const nextTagIDs = Array.from(new Set([...(project.tags || []).map((tag) => tag.id), tagId]))
  return updateProject(projectId, {}, nextTagIDs)
}

export async function removeProjectTag(projectId: string, tagId: string) {
  const project = await getProjectById(projectId)
  const nextTagIDs = (project.tags || [])
    .map((tag) => tag.id)
    .filter((currentTagID) => currentTagID !== tagId)
  return updateProject(projectId, {}, nextTagIDs)
}

export async function updateProjectCoverImage(projectId: string, coverImage: string | null) {
  return updateProject(projectId, { cover_image: coverImage })
}

export async function recordProjectImage(projectId: string, fileUrl: string, _usageType?: string) {
  return updateProjectCoverImage(projectId, fileUrl)
}
