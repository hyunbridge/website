import { isApiError, request } from "./api-client"
import { normalizeSlugInput } from "./slug"

export type Tag = {
  id: string
  name: string
  slug: string
}

export type Post = {
  id: string
  created_at: string
  updated_at: string
  title: string
  slug: string
  content: string
  author_id: string
  summary: string
  cover_image: string | null
  published_at: string | null
  enable_comments: boolean
  tags?: Tag[]
  author?: {
    full_name: string
    avatar_url: string | null
  }
}

export type PostVersion = {
  id: string
  version_number: number
  post_id: string
  title: string
  slug: string
  content: string
  summary?: string
  published_at?: string | null
  cover_image?: string | null
  enable_comments: boolean
  tags: Tag[]
  change_description: string | null
  created_at: string
  created_by: string | null
}

export type RecentPostSummary = {
  id: string
  title: string
  slug: string | null
  created_at: string
  published_at: string | null
}

export type PostVersioningState = {
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

type CreatePostInput = {
  title: string
  slug: string
  content: string
  summary: string
  cover_image: string | null
  enable_comments: boolean
}

type UpdatePostInput = Partial<{
  title: string
  slug: string
  summary: string
  content: string
  cover_image: string | null
  published_at: string | null
  enable_comments: boolean
  tag_ids: string[]
}>

type VersionSnapshotInput = {
  title: string
  content: string
  summary: string
  change_description?: string | null
}

type CreateVersionInput = {
  postId: string
  title: string
  content: string
  summary: string
  changeDescription?: string | null
}

function sortPosts(posts: Post[]) {
  return [...posts].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime()
    const rightTime = new Date(right.created_at).getTime()
    return rightTime - leftTime
  })
}

async function listPostsRaw(includeDraft: boolean, page = 1, pageSize = 10, tagId?: string) {
  if (includeDraft) {
    return request<Post[]>("/admin/posts", {
      auth: true,
      query: {
        includeDraft: true,
        page,
        pageSize,
        tagId,
      },
    })
  }

  return request<Post[]>("/posts", {
    query: {
      page,
      pageSize,
      tagId,
    },
  })
}

export async function getPosts(page = 1, pageSize = 10, publishedOnly = true): Promise<Post[]> {
  return listPostsRaw(!publishedOnly, page, pageSize)
}

export async function getPostsByTagId(
  tagId: string,
  page = 1,
  pageSize = 10,
  publishedOnly = true,
) {
  const [posts, tags] = await Promise.all([
    listPostsRaw(!publishedOnly, page, pageSize, tagId),
    getAllTags(!publishedOnly),
  ])
  const tag = tags.find((candidate) => candidate.id === tagId) || null

  if (!tag) {
    throw new Error("tag_not_found")
  }

  return { posts, tag }
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  try {
    return await request<Post>(`/posts/${encodeURIComponent(slug)}`)
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function getPostById(id: string): Promise<Post> {
  return request<Post>(`/admin/posts/${encodeURIComponent(id)}`, { auth: true })
}

export async function createPost(input: CreatePostInput, tags: string[] = []) {
  const created = await request<Post>("/admin/posts", {
    method: "POST",
    auth: true,
    body: {
      title: input.title,
      slug: input.slug,
      summary: input.summary,
    },
  })

  const patch: UpdatePostInput = {
    content: input.content,
    cover_image: input.cover_image,
    enable_comments: input.enable_comments,
    tag_ids: tags,
  }

  return updatePost(created.id, patch)
}

export async function updatePost(id: string, patch: UpdatePostInput) {
  return request<Post>(`/admin/posts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    auth: true,
    body: patch,
  })
}

export async function publishPost(id: string) {
  return request<Post>(`/admin/posts/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    auth: true,
  })
}

export async function unpublishPost(id: string) {
  return request<Post>(`/admin/posts/${encodeURIComponent(id)}/publish`, {
    method: "DELETE",
    auth: true,
  })
}

export async function renamePost(id: string, title: string, slug: string) {
  return updatePost(id, { title, slug })
}

export async function savePostDraftContent(id: string, content: string) {
  return updatePost(id, { content })
}

export async function deletePost(id: string) {
  return request(`/admin/posts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    auth: true,
  })
}

export async function getPostVersioningState(id: string) {
  return request<PostVersioningState>(`/admin/posts/${encodeURIComponent(id)}/version-state`, {
    auth: true,
  })
}

export async function updatePostVersionSnapshot(versionId: string, input: VersionSnapshotInput) {
  const response = await request<{ id: string }>(
    `/admin/posts/versions/${encodeURIComponent(versionId)}`,
    {
      method: "PATCH",
      auth: true,
      body: {
        title: input.title,
        content: input.content,
        summary: input.summary,
        change_description: input.change_description ?? null,
      },
    },
  )
  return response.id
}

export async function createPostVersionFromSnapshot(input: CreateVersionInput) {
  const response = await request<{ id: string }>("/admin/posts/versions", {
    method: "POST",
    auth: true,
    body: {
      postId: input.postId,
      title: input.title,
      content: input.content,
      summary: input.summary,
      changeDescription: input.changeDescription ?? null,
    },
  })

  return response.id
}

export async function setPostCurrentVersion(
  postId: string,
  versionId: string,
  title: string,
  summary: string,
) {
  return request(`/admin/posts/${encodeURIComponent(postId)}/current-version`, {
    method: "POST",
    auth: true,
    body: { versionId, title, summary },
  })
}

export async function getPostVersions(postId: string) {
  return request<PostVersion[]>(`/admin/posts/${encodeURIComponent(postId)}/versions`, {
    auth: true,
  })
}

export async function restorePostVersion(postId: string, versionNumber: number) {
  return request(`/admin/posts/${encodeURIComponent(postId)}/restore`, {
    method: "POST",
    auth: true,
    body: { versionNumber },
  })
}

export async function getPostPublishedVersion(versionId: string) {
  return request<{ id: string; title: string; summary?: string | null; content: string }>(
    `/posts/versions/${encodeURIComponent(versionId)}`,
  )
}

export async function getPublishedVersionSnapshot(versionId: string) {
  return getPostPublishedVersion(versionId)
}

export async function getBlogPostCount() {
  const counts = await request<{ postCount: number }>("/admin/dashboard", { auth: true })
  return counts.postCount
}

export async function getRecentPosts(limit: number) {
  const posts = await request<Post[]>("/admin/posts", {
    auth: true,
    query: { includeDraft: true, page: 1, pageSize: Math.max(limit, 20) },
  })

  return sortPosts(posts)
    .slice(0, limit)
    .map<RecentPostSummary>((post) => ({
      id: post.id,
      title: post.title,
      slug: post.slug || null,
      created_at: post.created_at,
      published_at: post.published_at || null,
    }))
}

export async function getAllTags(authenticated = true) {
  return request<Tag[]>(
    authenticated ? "/admin/tags" : "/tags",
    authenticated ? { auth: true } : undefined,
  )
}

export async function createTag(name: string) {
  return request<Tag>("/admin/tags", {
    method: "POST",
    auth: true,
    body: { name, slug: normalizeSlugInput(name) },
  })
}

export async function updateTag(id: string, name: string) {
  return request<Tag>(`/admin/tags/${encodeURIComponent(id)}`, {
    method: "PATCH",
    auth: true,
    body: { name, slug: normalizeSlugInput(name) },
  })
}

export async function deleteTag(id: string) {
  return request(`/admin/tags/${encodeURIComponent(id)}`, {
    method: "DELETE",
    auth: true,
  })
}

export async function addPostTag(postId: string, tagId: string) {
  const post = await getPostById(postId)
  const nextTagIDs = Array.from(new Set([...(post.tags || []).map((tag) => tag.id), tagId]))
  return updatePost(postId, { tag_ids: nextTagIDs })
}

export async function removePostTag(postId: string, tagId: string) {
  const post = await getPostById(postId)
  const nextTagIDs = (post.tags || [])
    .map((tag) => tag.id)
    .filter((currentTagID) => currentTagID !== tagId)
  return updatePost(postId, { tag_ids: nextTagIDs })
}

export async function updatePostCoverImage(postId: string, coverImage: string | null) {
  return updatePost(postId, { cover_image: coverImage })
}

export async function recordPostImage(postId: string, fileUrl: string, _usageType?: string) {
  return updatePostCoverImage(postId, fileUrl)
}
