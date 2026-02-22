import { supabase } from "@/lib/supabase"

const db: any = supabase

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
  is_published: boolean
  published_at: string | null
  published_version_id?: string | null
  current_version_id?: string | null
  enable_comments: boolean
  tags?: Tag[]
  author?: {
    full_name: string
    avatar_url: string | null
  }
}

export type Tag = {
  id: string
  name: string
  slug: string
}

export type PostVersion = {
  id: string
  version_number: number
  post_id: string
  title: string
  content: string
  summary?: string
  change_description: string | null
  created_at: string
  created_by: string | null
  creator?: {
    id: string
    username: string
    full_name: string | null
  } | null
}

export type PostImage = {
  id: string
  post_id: string
  url: string
  created_at: string
}

export type RecentPostSummary = {
  id: string
  title: string
  slug: string | null
  created_at: string
  published_at: string | null
}

export type CreatePostInput = Omit<
  Post,
  "id" | "created_at" | "updated_at" | "author" | "tags" | "published_at" | "published_version_id" | "current_version_id"
> & {
  published_at?: string | null
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
    body_text: string | null
    body_format: string
  }
  latestVersion: {
    id: string
    version_number: number
    title: string
    summary: string | null
    body_text: string | null
    body_format: string
    change_description: string | null
  } | null
}

type ContentItemRow = {
  id: string
  owner_id: string | null
  slug: string | null
  title: string
  summary: string | null
  cover_image: string | null
  status: string
  published_at: string | null
  current_version_id: string | null
  published_version_id: string | null
  created_at: string
  updated_at: string
}

type ContentVersionRow = {
  id: string
  content_item_id: string
  version_number: number
  title: string
  summary: string | null
  body_text: string | null
  body_format: string
  change_description: string | null
  created_at: string
  created_by: string | null
}

type AssetRow = {
  id: string
  object_key: string
  public_url: string
}

type ContentVersionAssetRefRow = {
  content_version_id: string
  asset_id: string
  usage_type: string
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
}

async function getAuthorMap(ownerIds: string[]) {
  const ids = Array.from(new Set(ownerIds.filter(Boolean)))
  if (ids.length === 0) return {} as Record<string, { full_name: string; avatar_url: string | null }>

  const { data, error } = await db.from("secure_profiles").select("id, full_name, avatar_url").in("id", ids)
  if (error || !data) {
    if (error) console.error("Error fetching authors:", error)
    return {}
  }

  return Object.fromEntries(data.map((row: any) => [row.id, { full_name: row.full_name || "", avatar_url: row.avatar_url }]))
}

async function getTagsByContentIds(contentIds: string[]) {
  const ids = Array.from(new Set(contentIds.filter(Boolean)))
  if (ids.length === 0) return {} as Record<string, Tag[]>

  const { data, error } = await db
    .from("content_item_tags")
    .select("content_item_id, tag_id")
    .in("content_item_id", ids)

  if (error || !data) {
    if (error) console.error("Error fetching content-item tags:", error)
    return {}
  }

  const tagIds = Array.from(new Set(data.map((r: any) => r.tag_id)))
  const { data: tags, error: tagsError } = await db.from("content_tags").select("id, name, slug").in("id", tagIds)
  if (tagsError || !tags) {
    if (tagsError) console.error("Error fetching tags:", tagsError)
    return {}
  }

  const tagMap = Object.fromEntries(tags.map((t: any) => [t.id, t]))
  const grouped: Record<string, Tag[]> = {}
  for (const row of data) {
    const tag = tagMap[row.tag_id]
    if (!tag) continue
    if (!grouped[row.content_item_id]) grouped[row.content_item_id] = []
    grouped[row.content_item_id].push(tag)
  }
  return grouped
}

async function getVersionByIds(versionIds: string[]) {
  const ids = Array.from(new Set(versionIds.filter(Boolean)))
  if (ids.length === 0) return {} as Record<string, ContentVersionRow>

  const { data, error } = await db
    .from("content_versions")
    .select("id, content_item_id, version_number, title, summary, body_text, body_format, change_description, created_at, created_by")
    .in("id", ids)

  if (error || !data) {
    if (error) console.error("Error fetching versions by ids:", error)
    return {}
  }

  return Object.fromEntries(data.map((v: any) => [v.id, v]))
}

function mapItemToPost(
  item: ContentItemRow,
  currentVersion: ContentVersionRow | null,
  tags: Tag[] = [],
  author?: { full_name: string; avatar_url: string | null },
): Post {
  return {
    id: item.id,
    created_at: item.created_at,
    updated_at: item.updated_at,
    title: currentVersion?.title || item.title,
    slug: item.slug || item.id,
    content: currentVersion?.body_text || "[]",
    author_id: item.owner_id || "",
    summary: currentVersion?.summary || item.summary || "",
    cover_image: item.cover_image,
    is_published: item.status === "published",
    published_at: item.published_at,
    published_version_id: item.published_version_id,
    current_version_id: item.current_version_id,
    enable_comments: true,
    tags,
    author,
  }
}

async function getPostContentSettingsMap(contentIds: string[]) {
  const ids = Array.from(new Set(contentIds.filter(Boolean)))
  if (ids.length === 0) return {} as Record<string, { enable_comments: boolean }>
  const { data, error } = await db.from("post_contents").select("content_item_id, enable_comments").in("content_item_id", ids)
  if (error || !data) {
    if (error) console.error("Error fetching post settings:", error)
    return {}
  }
  return Object.fromEntries(data.map((r: any) => [r.content_item_id, { enable_comments: r.enable_comments !== false }]))
}

async function hydratePosts(items: ContentItemRow[]): Promise<Post[]> {
  const versionMap = await getVersionByIds(items.map((i) => i.current_version_id || "").filter(Boolean))
  const tagsMap = await getTagsByContentIds(items.map((i) => i.id))
  const authorMap = await getAuthorMap(items.map((i) => i.owner_id || "").filter(Boolean))
  const postSettingsMap = await getPostContentSettingsMap(items.map((i) => i.id))

  return items.map((item) => {
    const post = mapItemToPost(
      item,
      item.current_version_id ? versionMap[item.current_version_id] || null : null,
      tagsMap[item.id] || [],
      item.owner_id ? authorMap[item.owner_id] : undefined,
    )
    const settings = postSettingsMap[item.id]
    if (settings) post.enable_comments = settings.enable_comments
    return post
  })
}

export async function getBlogPostCount() {
  const { count, error } = await db
    .from("content_items")
    .select("id", { count: "exact", head: true })
    .eq("type", "post")
    .eq("status", "published")

  if (error) {
    console.error("Error fetching blog post count:", error)
    return 0
  }

  return count || 0
}

export async function getRecentPosts(limit = 5): Promise<RecentPostSummary[]> {
  const { data, error } = await db
    .from("content_items")
    .select("id, title, slug, created_at, published_at")
    .eq("type", "post")
    .order("published_at", { ascending: false })
    .limit(limit)

  if (error) {
    console.error("Error fetching recent posts:", error)
    return []
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    created_at: row.created_at,
    published_at: row.published_at,
  }))
}

export async function getPosts(page = 1, pageSize = 10, isPublished = true) {
  const startIndex = (page - 1) * pageSize
  let query = db
    .from("content_items")
    .select("*")
    .eq("type", "post")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(startIndex, startIndex + pageSize - 1)

  if (isPublished) {
    query = query.eq("status", "published")
  }

  const { data, error } = await query
  if (error) {
    console.error("Error fetching posts:", error)
    throw error
  }

  return hydratePosts((data || []) as ContentItemRow[])
}

export async function getPostBySlug(slug: string) {
  const { data, error } = await db
    .from("content_items")
    .select("*")
    .eq("type", "post")
    .eq("slug", slug)
    .maybeSingle()

  if (error) {
    console.error("Error fetching post by slug:", error)
    throw error
  }
  if (!data) return null

  const [post] = await hydratePosts([data as ContentItemRow])
  return post || null
}

export async function getPostById(id: string) {
  const { data, error } = await db
    .from("content_items")
    .select("*")
    .eq("type", "post")
    .eq("id", id)
    .single()

  if (error) {
    console.error("Error fetching post by id:", error)
    throw error
  }

  const [post] = await hydratePosts([data as ContentItemRow])
  return post
}

export async function getPostsByTag(tagSlug: string, page = 1, pageSize = 10) {
  const { data: tagData, error: tagError } = await db.from("content_tags").select("id").eq("slug", tagSlug).single()
  if (tagError) throw tagError
  return (await getPostsByTagId(tagData.id, page, pageSize, true)).posts
}

export async function getPostsByTagId(tagId: string, page = 1, pageSize = 10, onlyPublished = true) {
  const { data: tagData, error: tagError } = await db.from("content_tags").select("*").eq("id", tagId).single()
  if (tagError) throw tagError
  if (!tagData) throw new Error("Tag not found")

  const { data: mappings, error: mapError } = await db
    .from("content_item_tags")
    .select("content_item_id")
    .eq("tag_id", tagId)

  if (mapError) throw mapError

  const ids = (mappings || []).map((m: any) => m.content_item_id)
  if (ids.length === 0) return { tag: tagData as Tag, posts: [] as Post[] }

  let query = db
    .from("content_items")
    .select("*")
    .eq("type", "post")
    .in("id", ids)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (onlyPublished) {
    query = query.eq("status", "published")
  }

  const { data: items, error } = await query
  if (error) throw error

  return { tag: tagData as Tag, posts: await hydratePosts((items || []) as ContentItemRow[]) }
}

export async function getPublishedVersionSnapshot(versionId: string) {
  const { data, error } = await db
    .from("content_versions")
    .select("id, title, summary, body_text")
    .eq("id", versionId)
    .single()

  if (error) {
    console.error("Error fetching published version snapshot:", error)
    throw error
  }

  return {
    id: data.id,
    title: data.title,
    summary: data.summary,
    content: data.body_text || "[]",
  }
}

export async function getPostPublishedVersion(versionId: string) {
  return getPublishedVersionSnapshot(versionId)
}

export async function createPost(
  post: CreatePostInput,
  tagIds: string[],
) {
  const now = new Date().toISOString()
  const itemInsert = {
    type: "post",
    owner_id: post.author_id,
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    cover_image: post.cover_image ?? null,
    status: post.is_published ? "published" : "draft",
    published_at: post.is_published ? post.published_at || now : null,
    source: "supabase",
    created_at: now,
    updated_at: now,
  }

  const { data: item, error: itemError } = await db.from("content_items").insert([itemInsert]).select().single()
  if (itemError || !item) {
    console.error("Error creating content item:", itemError)
    throw itemError || new Error("Failed to create content item")
  }

  const { error: postContentsError } = await db
    .from("post_contents")
    .insert([{ content_item_id: item.id, enable_comments: post.enable_comments ?? true }])
  if (postContentsError) throw postContentsError

  const bodyText = post.content ?? "[]"
  let bodyFormat = "json"
  try {
    JSON.parse(bodyText)
  } catch {
    bodyFormat = "html"
  }

  const { data: version, error: versionError } = await db
    .from("content_versions")
    .insert([
      {
        content_item_id: item.id,
        version_number: 1,
        snapshot_status: post.is_published ? "published" : "draft",
        body_format: bodyFormat,
        title: post.title,
        summary: post.summary,
        body_text: bodyText,
        created_by: post.author_id,
        change_description: "Initial version",
      },
    ])
    .select("id")
    .single()

  if (versionError || !version) throw versionError || new Error("Failed to create initial version")

  const itemUpdate: any = {
    current_version_id: version.id,
    updated_at: now,
  }
  if (post.is_published) itemUpdate.published_version_id = version.id

  const { error: updateItemError } = await db.from("content_items").update(itemUpdate).eq("id", item.id)
  if (updateItemError) throw updateItemError

  if (tagIds.length > 0) {
    const relations = tagIds.map((tagId) => ({ content_item_id: item.id, tag_id: tagId }))
    const { error: tagError } = await db.from("content_item_tags").insert(relations)
    if (tagError) throw tagError
  }

  return (await getPostById(item.id)) as Post
}

export async function createDraftPostWithClient(client: any, userId: string, slug?: string) {
  const now = new Date().toISOString()
  const draftSlug = slug || `untitled-${Date.now().toString(36)}`

  const { data: item, error: itemError } = await client
    .from("content_items")
    .insert([
      {
        type: "post",
        owner_id: userId,
        title: "",
        slug: draftSlug,
        summary: "",
        status: "draft",
        source: "supabase",
        created_at: now,
        updated_at: now,
      },
    ])
    .select("id, slug")
    .single()
  if (itemError || !item) throw itemError || new Error("Failed to create content item")

  const { error: postContentsError } = await client
    .from("post_contents")
    .insert([{ content_item_id: item.id, enable_comments: true }])
  if (postContentsError) throw postContentsError

  const { data: version, error: versionError } = await client
    .from("content_versions")
    .insert([
      {
        content_item_id: item.id,
        version_number: 1,
        snapshot_status: "draft",
        body_format: "json",
        title: "",
        summary: "",
        body_text: JSON.stringify([]),
        created_by: userId,
        change_description: "Initial draft",
      },
    ])
    .select("id")
    .single()
  if (versionError || !version) throw versionError || new Error("Failed to create initial version")

  const { error: pointerError } = await client
    .from("content_items")
    .update({ current_version_id: version.id, updated_at: now })
    .eq("id", item.id)
  if (pointerError) throw pointerError

  return { id: item.id as string, slug: item.slug as string }
}

export async function updatePost(
  id: string,
  post: Partial<Omit<Post, "id" | "created_at" | "updated_at" | "author" | "tags">>,
  tagIds?: string[],
  createVersion = false,
  userId?: string,
  changeDescription?: string,
) {
  const now = new Date().toISOString()
  const { data: item, error: itemError } = await db.from("content_items").select("*").eq("id", id).single()
  if (itemError || !item) throw itemError || new Error("Post not found")

  let currentVersion: any = null
  if (item.current_version_id) {
    const { data, error } = await db.from("content_versions").select("*").eq("id", item.current_version_id).single()
    if (error) throw error
    currentVersion = data
  }

  const mergedTitle = post.title ?? currentVersion?.title ?? item.title
  const mergedSummary = post.summary ?? currentVersion?.summary ?? item.summary ?? ""
  const mergedContent = post.content ?? currentVersion?.body_text ?? "[]"

  const itemUpdates: any = { updated_at: now }
  if (post.slug !== undefined) itemUpdates.slug = post.slug
  if (post.cover_image !== undefined) itemUpdates.cover_image = post.cover_image
  if (post.author_id !== undefined) itemUpdates.owner_id = post.author_id
  if (post.is_published !== undefined) {
    itemUpdates.status = post.is_published ? "published" : "draft"
    itemUpdates.published_at = post.is_published ? post.published_at || now : null
  }
  itemUpdates.title = mergedTitle
  itemUpdates.summary = mergedSummary

  if (post.enable_comments !== undefined) {
    const { error: pcError } = await db
      .from("post_contents")
      .upsert({ content_item_id: id, enable_comments: post.enable_comments }, { onConflict: "content_item_id" })
    if (pcError) throw pcError
  }

  const shouldCreateVersion = createVersion || !item.current_version_id
  let activeVersionId = item.current_version_id

  if (shouldCreateVersion) {
    const { data: latest, error: latestError } = await db
      .from("content_versions")
      .select("version_number")
      .eq("content_item_id", id)
      .order("version_number", { ascending: false })
      .limit(1)
    if (latestError) throw latestError
    const nextVersion = latest?.[0]?.version_number ? latest[0].version_number + 1 : 1
    const { data: newVersion, error: insertErr } = await db
      .from("content_versions")
      .insert([
        {
          content_item_id: id,
          version_number: nextVersion,
          snapshot_status: (itemUpdates.status || item.status) === "published" ? "published" : "draft",
          body_format: currentVersion?.body_format || "json",
          title: mergedTitle,
          summary: mergedSummary,
          body_text: mergedContent,
          created_by: userId || item.owner_id,
          change_description: changeDescription || `Version ${nextVersion}`,
        },
      ])
      .select("id")
      .single()
    if (insertErr) throw insertErr
    activeVersionId = newVersion.id
    if (item.current_version_id) {
      await cloneVersionAssetRefs(item.current_version_id, activeVersionId)
    }
    itemUpdates.current_version_id = activeVersionId
  } else if (activeVersionId) {
    const { error: versionUpdateError } = await db
      .from("content_versions")
      .update({ title: mergedTitle, summary: mergedSummary, body_text: mergedContent })
      .eq("id", activeVersionId)
    if (versionUpdateError) throw versionUpdateError
  }

  if (post.is_published === true && activeVersionId) {
    itemUpdates.published_version_id = activeVersionId
  }
  if (post.is_published === false) {
    itemUpdates.published_version_id = null
  }

  const { error: updateError } = await db.from("content_items").update(itemUpdates).eq("id", id)
  if (updateError) throw updateError

  if (post.content !== undefined && activeVersionId) {
    await syncEmbeddedAssetRefsForVersion(id, activeVersionId, post.content)
  }

  if (tagIds !== undefined) {
    const { error: delErr } = await db.from("content_item_tags").delete().eq("content_item_id", id)
    if (delErr) throw delErr
    if (tagIds.length > 0) {
      const { error: insErr } = await db
        .from("content_item_tags")
        .insert(tagIds.map((tagId) => ({ content_item_id: id, tag_id: tagId })))
      if (insErr) throw insErr
    }
  }

  return (await getPostById(id)) as Post
}

export async function getPostVersioningState(postId: string): Promise<PostVersioningState> {
  const { data: item, error: itemError } = await db
    .from("content_items")
    .select("id, title, summary, current_version_id, published_version_id, status")
    .eq("id", postId)
    .single()
  if (itemError || !item) throw itemError || new Error("Post not found")
  if (!item.current_version_id) throw new Error("Post has no current version")

  const { data: currentVersion, error: currentVersionError } = await db
    .from("content_versions")
    .select("id, title, summary, body_text, body_format")
    .eq("id", item.current_version_id)
    .single()
  if (currentVersionError || !currentVersion) throw currentVersionError || new Error("Current version not found")

  const { data: latestVersions, error: latestError } = await db
    .from("content_versions")
    .select("id, version_number, title, summary, body_text, body_format, change_description")
    .eq("content_item_id", postId)
    .order("version_number", { ascending: false })
    .limit(1)
  if (latestError) throw latestError

  return {
    item,
    currentVersion,
    latestVersion: latestVersions?.[0] || null,
  }
}

export async function updatePostVersionSnapshot(
  versionId: string,
  updates: { title?: string; content?: string; summary?: string; change_description?: string | null },
) {
  const payload: any = {}
  if (updates.title !== undefined) payload.title = updates.title
  if (updates.content !== undefined) payload.body_text = updates.content
  if (updates.summary !== undefined) payload.summary = updates.summary
  if (updates.change_description !== undefined) payload.change_description = updates.change_description

  const { error } = await db.from("content_versions").update(payload).eq("id", versionId)
  if (error) throw error

  if (updates.content !== undefined) {
    const { data: versionRow, error: versionRowError } = await db
      .from("content_versions")
      .select("content_item_id")
      .eq("id", versionId)
      .single()
    if (versionRowError) throw versionRowError
    await syncEmbeddedAssetRefsForVersion(versionRow.content_item_id, versionId, updates.content)
  }
}

export async function createPostVersionFromSnapshot(params: {
  postId: string
  versionNumber: number
  title: string
  content: string
  summary: string
  bodyFormat: string
  createdBy: string
  changeDescription: string
  snapshotStatus?: "draft" | "published" | "archived"
}) {
  const { data, error } = await db
    .from("content_versions")
    .insert([
      {
        content_item_id: params.postId,
        version_number: params.versionNumber,
        snapshot_status: params.snapshotStatus || "draft",
        body_format: params.bodyFormat,
        title: params.title,
        body_text: params.content,
        summary: params.summary,
        created_by: params.createdBy,
        change_description: params.changeDescription,
      },
    ])
    .select("id")
    .single()
  if (error || !data) throw error || new Error("Failed to create version")
  try {
    const { data: itemRow } = await db.from("content_items").select("current_version_id").eq("id", params.postId).single()
    if (itemRow?.current_version_id) {
      await cloneVersionAssetRefs(itemRow.current_version_id, data.id as string)
    }
  } catch (cloneError) {
    console.error("Failed to clone asset refs for new version:", cloneError)
  }
  if (params.bodyFormat === "json") {
    await syncEmbeddedAssetRefsForVersion(params.postId, data.id as string, params.content)
  }
  return data.id as string
}

export async function setPostCurrentVersion(postId: string, versionId: string, title: string, summary: string | null) {
  const { error } = await db
    .from("content_items")
    .update({
      current_version_id: versionId,
      title,
      summary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
  if (error) throw error
}

export async function publishPost(postId: string, versionId: string) {
  const now = new Date().toISOString()
  const { error: itemError } = await db
    .from("content_items")
    .update({
      status: "published",
      published_at: now,
      published_version_id: versionId,
      updated_at: now,
    })
    .eq("id", postId)
  if (itemError) throw itemError

  const { error: versionError } = await db
    .from("content_versions")
    .update({ snapshot_status: "published" })
    .eq("id", versionId)
  if (versionError) throw versionError

  return { published_at: now }
}

export async function unpublishPost(postId: string) {
  const { error } = await db
    .from("content_items")
    .update({
      status: "draft",
      published_version_id: null,
      published_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
  if (error) throw error
}

export async function renamePost(postId: string, title: string, slug: string) {
  const { data: item, error: itemError } = await db
    .from("content_items")
    .select("current_version_id")
    .eq("id", postId)
    .single()
  if (itemError) throw itemError

  const { error } = await db
    .from("content_items")
    .update({ title, slug, updated_at: new Date().toISOString() })
    .eq("id", postId)
  if (error) throw error

  if (item?.current_version_id) {
    const { error: versionError } = await db.from("content_versions").update({ title }).eq("id", item.current_version_id)
    if (versionError) throw versionError
  }
}

export async function addPostTag(postId: string, tagId: string) {
  const { error } = await db.from("content_item_tags").insert({ content_item_id: postId, tag_id: tagId })
  if (error) throw error
}

export async function removePostTag(postId: string, tagId: string) {
  const { error } = await db.from("content_item_tags").delete().eq("content_item_id", postId).eq("tag_id", tagId)
  if (error) throw error
}

export async function updatePostCoverImage(postId: string, coverImage: string) {
  const { error } = await db
    .from("content_items")
    .update({ cover_image: coverImage, updated_at: new Date().toISOString() })
    .eq("id", postId)
  if (error) throw error
}

export async function savePostDraftContent(postId: string, contentJson: string) {
  const { data: item, error: itemError } = await db
    .from("content_items")
    .select("current_version_id")
    .eq("id", postId)
    .single()
  if (itemError || !item?.current_version_id) throw itemError || new Error("Missing current version")

  const { error: versionError } = await db
    .from("content_versions")
    .update({ body_text: contentJson })
    .eq("id", item.current_version_id)
  if (versionError) throw versionError

  const { error: itemUpdateError } = await db
    .from("content_items")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", postId)
  if (itemUpdateError) throw itemUpdateError

  await syncEmbeddedAssetRefsForVersion(postId, item.current_version_id, contentJson)
}

function toS3Key(url: string): string | null {
  try {
    const parsed = new URL(url)
    const cdnBase = process.env.NEXT_PUBLIC_S3_CDN_URL
    if (cdnBase) {
      try {
        const cdnOrigin = new URL(cdnBase).origin
        if (parsed.origin !== cdnOrigin) return null
      } catch {
        // Ignore malformed CDN env and fall back to pathname extraction.
      }
    }
    const key = parsed.pathname.replace(/^\//, "") || null
    if (!key) return null
    if (!/^(assets|avatars)\//.test(key)) return null
    return key
  } catch {
    return null
  }
}

function extractTrackedAssetKeysFromBlocknoteJson(content: string): string[] {
  if (!content) return []
  try {
    const blocks = JSON.parse(content)
    const urls: string[] = []
    const walk = (node: any) => {
      if (!node) return
      if (Array.isArray(node)) {
        node.forEach(walk)
        return
      }
      if (typeof node !== "object") return
      if (typeof node.url === "string") urls.push(node.url)
      if (typeof node.src === "string") urls.push(node.src)
      for (const value of Object.values(node)) walk(value)
    }
    walk(blocks)
    return Array.from(new Set(urls.map(toS3Key).filter(Boolean) as string[]))
  } catch {
    return []
  }
}

async function getOrCreateAsset(params: {
  objectKey: string
  publicUrl: string
  ownerId?: string | null
  assetType?: string
  mimeType?: string | null
  sizeBytes?: number | null
}) {
  const { data, error } = await db
    .from("assets")
    .upsert(
      [
        {
          owner_id: params.ownerId ?? null,
          asset_type: params.assetType || "image",
          storage_provider: "s3",
          object_key: params.objectKey,
          public_url: params.publicUrl,
          mime_type: params.mimeType ?? null,
          size_bytes: params.sizeBytes ?? null,
        },
      ],
      { onConflict: "object_key" },
    )
    .select("id, object_key, public_url")
    .single()
  if (error || !data) throw error || new Error("Failed to upsert asset")
  return data as AssetRow
}

async function ensureVersionAssetRef(versionId: string, assetId: string, usageType: "embedded" | "cover") {
  const { error } = await db
    .from("content_version_assets")
    .upsert([{ content_version_id: versionId, asset_id: assetId, usage_type: usageType }], {
      onConflict: "content_version_id,asset_id,usage_type",
    })
  if (error) throw error
}

async function getCurrentVersionIdForPost(postId: string): Promise<string> {
  const { data, error } = await db.from("content_items").select("current_version_id").eq("id", postId).single()
  if (error || !data?.current_version_id) throw error || new Error("Missing current version")
  return data.current_version_id
}

async function cloneVersionAssetRefs(fromVersionId: string, toVersionId: string) {
  const { data, error } = await db
    .from("content_version_assets")
    .select("asset_id, usage_type")
    .eq("content_version_id", fromVersionId)
  if (error) throw error
  if (!data || data.length === 0) return

  const rows = (data as Array<{ asset_id: string; usage_type: string }>)
    .filter((r) => r.usage_type === "embedded" || r.usage_type === "cover")
    .map((r) => ({ content_version_id: toVersionId, asset_id: r.asset_id, usage_type: r.usage_type }))
  if (rows.length === 0) return

  const { error: insertError } = await db
    .from("content_version_assets")
    .upsert(rows, { onConflict: "content_version_id,asset_id,usage_type" })
  if (insertError) throw insertError
}

async function enqueueAssetDeletionJobs(assets: AssetRow[]) {
  if (assets.length === 0) return []

  const now = new Date().toISOString()
  const { error } = await db.from("asset_deletion_queue").upsert(
    assets.map((asset) => ({
      asset_id: asset.id,
      object_key: asset.object_key,
      status: "pending",
      next_attempt_at: now,
      last_error: null,
      locked_at: null,
      processed_at: null,
      updated_at: now,
    })),
    { onConflict: "asset_id" },
  )
  if (error) throw error
  return assets.map((a) => a.object_key)
}

async function enqueueOrphanedPostAssets(postId: string) {
  const { data: assets, error: assetsError } = await db.from("assets").select("id, object_key, public_url").like("object_key", `assets/${postId}/%`)
  if (assetsError) throw assetsError

  const assetRows = (assets || []) as AssetRow[]
  if (assetRows.length === 0) return []

  const { data: refs, error: refsError } = await db
    .from("content_version_assets")
    .select("asset_id")
    .in("asset_id", assetRows.map((a) => a.id))
  if (refsError) throw refsError

  const referencedAssetIds = new Set((refs || []).map((r: any) => r.asset_id))
  const orphaned = assetRows.filter((a) => !referencedAssetIds.has(a.id))
  if (orphaned.length === 0) return []

  return enqueueAssetDeletionJobs(orphaned)
}

async function syncEmbeddedAssetRefsForVersion(postId: string, versionId: string, contentJson: string) {
  const desiredKeys = extractTrackedAssetKeysFromBlocknoteJson(contentJson).filter((key) => key.startsWith(`assets/${postId}/`))

  const desiredAssets =
    desiredKeys.length > 0
      ? await db.from("assets").select("id, object_key").in("object_key", desiredKeys)
      : ({ data: [], error: null } as any)

  if (desiredAssets.error) throw desiredAssets.error
  const desiredRows = (desiredAssets.data || []) as Array<{ id: string; object_key: string }>
  const desiredIds = new Set(desiredRows.map((row) => row.id))

  const { data: existingRows, error: existingError } = await db
    .from("content_version_assets")
    .select("content_version_id, asset_id, usage_type")
    .eq("content_version_id", versionId)
    .eq("usage_type", "embedded")
  if (existingError) throw existingError

  const existing = (existingRows || []) as ContentVersionAssetRefRow[]
  const existingIds = new Set(existing.map((row) => row.asset_id))
  const toDelete = existing.filter((row) => !desiredIds.has(row.asset_id)).map((row) => row.asset_id)
  if (toDelete.length > 0) {
    const { error: deleteError } = await db
      .from("content_version_assets")
      .delete()
      .eq("content_version_id", versionId)
      .eq("usage_type", "embedded")
      .in("asset_id", toDelete)
    if (deleteError) throw deleteError
  }

  const toInsert = Array.from(desiredIds).filter((assetId) => !existingIds.has(assetId))
  if (toInsert.length > 0) {
    const { error: insertError } = await db
      .from("content_version_assets")
      .insert(toInsert.map((assetId) => ({ content_version_id: versionId, asset_id: assetId, usage_type: "embedded" })))
    if (insertError) throw insertError
  }

  await enqueueOrphanedPostAssets(postId)
}

export async function deletePost(id: string): Promise<string[]> {
  try {
    const { data: assets, error: assetsError } = await db.from("assets").select("id, object_key, public_url").like("object_key", `assets/${id}/%`)

    if (assetsError) {
      console.error("Error fetching assets for delete:", assetsError)
    }

    if ((assets || []).length > 0) {
      await enqueueAssetDeletionJobs((assets || []) as AssetRow[])
    }

    const { error } = await db.from("content_items").delete().eq("id", id)
    if (error) throw error

    return ((assets || []) as AssetRow[]).map((asset) => asset.object_key)
  } catch (error) {
    console.error("Error in deletePost:", error)
    throw error
  }
}

export async function getAllTags() {
  const { data, error } = await db.from("content_tags").select("*").order("name")
  if (error) throw error
  return (data || []) as Tag[]
}

export async function createTag(name: string) {
  const slug = slugify(name)
  const { data, error } = await db.from("content_tags").insert([{ name, slug }]).select().single()
  if (error) throw error
  return data as Tag
}

export async function updateTag(id: string, name: string): Promise<Tag> {
  const slug = slugify(name)
  const { data, error } = await db.from("content_tags").update({ name, slug }).eq("id", id).select().single()
  if (error) throw new Error("Failed to update tag")
  return data as Tag
}

export async function deleteTag(id: string) {
  const { error } = await db.from("content_tags").delete().eq("id", id)
  if (error) throw error
}

export async function recordPostImage(postId: string, url: string, usageType: "embedded" | "cover" = "embedded") {
  const objectKey = toS3Key(url)
  if (!objectKey) {
    throw new Error("Invalid S3 asset URL")
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const asset = await getOrCreateAsset({
    objectKey,
    publicUrl: url,
    ownerId: user?.id ?? null,
    assetType: "image",
  })
  const versionId = await getCurrentVersionIdForPost(postId)
  if (usageType === "cover") {
    const { error: clearCoverError } = await db
      .from("content_version_assets")
      .delete()
      .eq("content_version_id", versionId)
      .eq("usage_type", "cover")
      .neq("asset_id", asset.id)
    if (clearCoverError) throw clearCoverError
  }

  await ensureVersionAssetRef(versionId, asset.id, usageType)
  await enqueueOrphanedPostAssets(postId)

  const { data, error } = await db.from("assets").select("id, public_url, created_at").eq("id", asset.id).single()
  if (error || !data) throw error || new Error("Failed to fetch image after record")

  return {
    id: data.id,
    post_id: postId,
    url: data.public_url,
    created_at: data.created_at,
  } as PostImage
}

export async function getPostVersions(postId: string): Promise<PostVersion[]> {
  const { data, error } = await db
    .from("content_versions")
    .select("id, version_number, content_item_id, title, body_text, summary, change_description, created_at, created_by")
    .eq("content_item_id", postId)
    .order("version_number", { ascending: false })

  if (error) {
    console.error("Error fetching post versions:", error)
    throw error
  }

  const rows = data || []
  const authorMap = await getAuthorMap(rows.map((r: any) => r.created_by).filter(Boolean))

  return rows.map((version: any) => ({
    id: version.id,
    version_number: version.version_number,
    post_id: version.content_item_id,
    title: version.title,
    content: version.body_text || "[]",
    summary: version.summary ?? undefined,
    change_description: version.change_description,
    created_at: version.created_at,
    created_by: version.created_by,
    creator: version.created_by ? { id: version.created_by, username: "", ...authorMap[version.created_by] } : null,
  }))
}

export async function restorePostVersion(postId: string, versionNumber: number, userId: string) {
  const { data: versionData, error: versionError } = await db
    .from("content_versions")
    .select("*")
    .eq("content_item_id", postId)
    .eq("version_number", versionNumber)
    .single()

  if (versionError) throw versionError
  if (!versionData) throw new Error(`Version ${versionNumber} not found`)

  const { data: latest, error: latestErr } = await db
    .from("content_versions")
    .select("version_number")
    .eq("content_item_id", postId)
    .order("version_number", { ascending: false })
    .limit(1)
  if (latestErr) throw latestErr
  const nextVersionNumber = latest?.[0]?.version_number ? latest[0].version_number + 1 : 1

  const { data: newVersion, error: createErr } = await db
    .from("content_versions")
    .insert([
      {
        content_item_id: postId,
        version_number: nextVersionNumber,
        snapshot_status: "draft",
        body_format: versionData.body_format,
        title: versionData.title,
        summary: versionData.summary,
        body_text: versionData.body_text,
        body_json: versionData.body_json,
        rendered_html: versionData.rendered_html,
        created_by: userId,
        change_description: `Restored to version ${versionNumber}`,
      },
    ])
    .select("id")
    .single()
  if (createErr) throw createErr

  await cloneVersionAssetRefs(versionData.id, newVersion.id)

  const { error: itemUpdateErr } = await db
    .from("content_items")
    .update({
      title: versionData.title,
      summary: versionData.summary,
      current_version_id: newVersion.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
  if (itemUpdateErr) throw itemUpdateErr
}
