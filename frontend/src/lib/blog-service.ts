import { apiRequest, isApiError } from "@/lib/api-client"
import type { Post, Tag } from "@/lib/content-model"
import { getSiteBuildExport } from "@/lib/site-build-export"

export type { Post, Tag }

export class TagNotFoundError extends Error {
  constructor(tagId: string) {
    super(`tag_not_found:${tagId}`)
    this.name = "TagNotFoundError"
  }
}

export async function getPosts(page = 1, pageSize = 10, _publishedOnly = true): Promise<Post[]> {
  const site = await getSiteBuildExport()
  if (site) {
    const start = Math.max(0, (Math.max(1, page) - 1) * Math.max(1, pageSize))
    return site.posts.slice(start, start + Math.max(1, pageSize))
  }

  return apiRequest<Post[]>("/posts", {
    query: { page, pageSize },
    cache: "no-store",
  })
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const site = await getSiteBuildExport()
  if (site) {
    return site.posts.find((post) => post.slug === slug) || null
  }

  try {
    return await apiRequest<Post>(`/posts/${encodeURIComponent(slug)}`, {
      cache: "no-store",
    })
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function getAllTags(): Promise<Tag[]> {
  const site = await getSiteBuildExport()
  if (site) {
    return site.tags
  }

  return apiRequest<Tag[]>("/tags", {
    cache: "no-store",
  })
}

export async function getPostsByTagId(
  tagId: string,
  page = 1,
  pageSize = 10,
  _publishedOnly = true,
) {
  const site = await getSiteBuildExport()
  if (site) {
    const tag = site.tags.find((candidate) => candidate.id === tagId) || null
    if (!tag) {
      throw new TagNotFoundError(tagId)
    }
    const filteredPosts = site.posts.filter((post) => (post.tags || []).some((candidate) => candidate.id === tagId))
    const start = Math.max(0, (Math.max(1, page) - 1) * Math.max(1, pageSize))
    return {
      tag,
      posts: filteredPosts.slice(start, start + Math.max(1, pageSize)),
    }
  }

  const [posts, tags] = await Promise.all([
    apiRequest<Post[]>("/posts", {
      query: { page, pageSize, tagId },
      cache: "no-store",
    }),
    getAllTags(),
  ])

  const tag = tags.find((candidate) => candidate.id === tagId) || null
  if (!tag) {
    throw new TagNotFoundError(tagId)
  }

  return { tag, posts }
}

export function isTagNotFoundError(value: unknown): value is TagNotFoundError {
  return value instanceof TagNotFoundError
}

export async function getPublishedVersionSnapshot(versionId: string) {
  return apiRequest<{ id: string; title: string; summary: string | null; content: string }>(
    `/posts/versions/${encodeURIComponent(versionId)}`,
    {
      cache: "no-store",
    },
  )
}
