import { supabase } from "@/lib/supabase"

const db: any = supabase

// ---------------------------------------------------------------------------
// Types (matching blog conventions)
// ---------------------------------------------------------------------------

export type ProjectTag = {
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
    title: string
    slug: string
    summary: string
    cover_image: string | null
    content: string // service returns serialized JSON or plain text body depending on body_format
    is_published: boolean
    published_at: string | null
    published_version_id?: string | null
    current_version_id?: string | null
    created_at: string
    updated_at: string
    owner_id: string

    // Project-specific fields from project_contents
    sort_order: number

    tags: ProjectTag[]
    links: ProjectLink[]
    owner?: {
        full_name: string
        avatar_url: string | null
    }
}

export type CreateProjectInput = {
    title: string
    slug?: string
    summary?: string
    content?: string
    cover_image?: string | null
    is_published?: boolean
    owner_id?: string
}

export type UpdateProjectInput = Partial<
    Omit<Project, "id" | "created_at" | "updated_at" | "tags" | "links">
>

export type ProjectSummary = Pick<
    Project,
    | "id"
    | "title"
    | "slug"
    | "summary"
    | "cover_image"
    | "is_published"
    | "published_at"
    | "created_at"
    | "updated_at"
    | "sort_order"
    | "tags"
>

export type Tag = {
    id: string
    name: string
    slug: string
}

export type ProjectVersioningState = {
    item: any
    currentVersion: any
    latestVersion: any
}

export type ProjectVersion = {
    id: string
    version_number: number
    post_id: string // content_item_id
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

export type ProjectImage = {
    id: string
    post_id: string // project id
    url: string
    created_at: string
}

type AssetRow = {
    id: string
    owner_id: string | null
    asset_type: string
    storage_provider: string
    object_key: string
    public_url: string
    mime_type: string | null
    size_bytes: number | null
    created_at: string
    updated_at: string
}

type ContentVersionAssetRefRow = {
    content_version_id: string
    asset_id: string
    usage_type: string
}

type ProjectContentRow = {
    content_item_id: string
    sort_order: number | null
    links?: unknown
}

type ContentVersionRow = {
    id: string
    body_json?: unknown | null
    body_format?: string | null
}

// ---------------------------------------------------------------------------
// User Helpers
// ---------------------------------------------------------------------------

async function getAuthorMap(userIds: string[]): Promise<Record<string, { full_name: string; avatar_url: string | null }>> {
    const ids = Array.from(new Set(userIds.filter(Boolean)))
    if (ids.length === 0) return {}
    const { data, error } = await db.from("secure_profiles").select("id, full_name, avatar_url").in("id", ids)
    if (error || !data) return {}
    return Object.fromEntries(data.map((row: any) => [row.id, { full_name: row.full_name || "", avatar_url: row.avatar_url }]))
}

function formatDbError(error: any): string {
    if (!error) return "Unknown database error"
    if (typeof error === "string") return error
    const parts = [error.message, error.details, error.hint, error.code].filter(Boolean)
    return parts.length > 0 ? parts.join(" | ") : JSON.stringify(error)
}

function safeParseJson(value: string) {
    try {
        return JSON.parse(value)
    } catch {
        return null
    }
}

function getVersionContent(row?: { body_format?: string | null; body_json?: unknown | null } | null) {
    if (!row) return "[]"
    if (row.body_json !== undefined && row.body_json !== null) return JSON.stringify(row.body_json)
    return "[]"
}

function toVersionBodyColumns(content: string, bodyFormat: string) {
    if (bodyFormat !== "json") {
        throw new Error(`Unsupported body_format: ${bodyFormat}`)
    }
    const parsed = safeParseJson(content)
    if (parsed === null) {
        throw new Error("BlockNote content must be valid JSON")
    }
    return { body_json: parsed }
}

function normalizeVersionRow<T extends { body_json?: unknown | null; body_format?: string | null }>(row: T): T {
    return {
        ...row,
        body_json: row.body_json ?? [],
    }
}

function normalizeProjectLinks(value: unknown, projectId: string): ProjectLink[] {
    if (!Array.isArray(value)) return []

    return value
        .map((row: any, index) => {
            if (!row || typeof row !== "object") return null
            const label = typeof row.label === "string" ? row.label : ""
            const url = typeof row.url === "string" ? row.url : ""
            if (!label && !url) return null
            return {
                id: typeof row.id === "string" ? row.id : `${projectId}:${index}`,
                project_id: projectId,
                label,
                url,
                link_type: typeof row.link_type === "string" ? row.link_type : null,
                sort_order: typeof row.sort_order === "number" ? row.sort_order : index,
            } as ProjectLink
        })
        .filter(Boolean)
        .sort((a: any, b: any) => a.sort_order - b.sort_order) as ProjectLink[]
}

async function getProjectContentsMap(contentItemIds: string[]): Promise<Record<string, ProjectContentRow>> {
    const ids = Array.from(new Set(contentItemIds.filter(Boolean)))
    if (ids.length === 0) return {}

    const { data, error } = await db
        .from("project_contents")
        .select("content_item_id, sort_order, links")
        .in("content_item_id", ids)

    if (error) throw new Error(`Failed to fetch project contents: ${formatDbError(error)}`)

    return Object.fromEntries(((data || []) as ProjectContentRow[]).map((row) => [row.content_item_id, row]))
}

async function getProjectTagsMap(contentItemIds: string[]): Promise<Record<string, ProjectTag[]>> {
    const ids = Array.from(new Set(contentItemIds.filter(Boolean)))
    if (ids.length === 0) return {}

    const { data: mappings, error: mappingError } = await db
        .from("content_item_tags")
        .select("content_item_id, tag_id")
        .in("content_item_id", ids)
    if (mappingError) throw new Error(`Failed to fetch project tag mappings: ${formatDbError(mappingError)}`)

    const tagIds = Array.from(new Set((mappings || []).map((m: any) => m.tag_id).filter(Boolean)))
    if (tagIds.length === 0) return {}

    const { data: tags, error: tagError } = await db
        .from("content_tags")
        .select("id, name, slug")
        .in("id", tagIds)
    if (tagError) throw new Error(`Failed to fetch tags: ${formatDbError(tagError)}`)

    const tagMap = Object.fromEntries(((tags || []) as ProjectTag[]).map((tag) => [tag.id, tag]))
    const grouped: Record<string, ProjectTag[]> = {}
    for (const mapping of mappings || []) {
        const tag = tagMap[(mapping as any).tag_id]
        if (!tag) continue
        const contentItemId = (mapping as any).content_item_id
        if (!grouped[contentItemId]) grouped[contentItemId] = []
        grouped[contentItemId].push(tag)
    }
    return grouped
}

async function getVersionBodyMap(versionIds: string[]): Promise<Record<string, ContentVersionRow>> {
    const ids = Array.from(new Set(versionIds.filter(Boolean)))
    if (ids.length === 0) return {}

    const { data, error } = await db
        .from("content_versions")
        .select("id, body_json, body_format")
        .in("id", ids)
    if (error) throw new Error(`Failed to fetch content versions: ${formatDbError(error)}`)

    return Object.fromEntries(((data || []) as ContentVersionRow[]).map((row) => [row.id, normalizeVersionRow(row)]))
}

async function hydrateProjects(items: any[], versionPointer: "current" | "published" = "current"): Promise<Project[]> {
    if (!items.length) return []

    const itemIds = items.map((item) => item.id)
    const versionIds = items
        .map((item) => (versionPointer === "published" ? item.published_version_id : item.current_version_id))
        .filter(Boolean)
    const ownerIds = items.map((item) => item.owner_id).filter(Boolean)

    const [projectContentsMap, projectTagsMap, versionMap, authorMap] = await Promise.all([
        getProjectContentsMap(itemIds),
        getProjectTagsMap(itemIds),
        getVersionBodyMap(versionIds),
        getAuthorMap(ownerIds),
    ])

    return items.map((item) => {
        const versionId = versionPointer === "published" ? item.published_version_id : item.current_version_id
        const version = versionId ? versionMap[versionId] : null
        const owner = item.owner_id ? authorMap[item.owner_id] : undefined

        return mapToProject({
            ...item,
            project_contents: projectContentsMap[item.id] ? [projectContentsMap[item.id]] : [],
            tags: (projectTagsMap[item.id] || []).map((tag) => ({ content_tags: tag })),
            content_versions: version ? { body_json: version.body_json, body_format: version.body_format } : null,
        }, versionPointer === "published", owner)
    })
}

// ---------------------------------------------------------------------------
// READ Functions
// ---------------------------------------------------------------------------

export async function getProjects(onlyPublished = true): Promise<Project[]> {
    let query = db
        .from("content_items")
        .select("*")
        .eq("type", "project")
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })

    if (onlyPublished) {
        query = query.eq("status", "published")
    }

    const { data, error } = await query

    if (error) {
        throw new Error(`Failed to fetch projects: ${formatDbError(error)}`)
    }

    const projects = await hydrateProjects(data || [], "current")
    // Default sort: manual order first (lower sort_order first)
    return projects.sort((a: any, b: any) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
        return (a.title || "").localeCompare(b.title || "")
    })
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
    const { data, error } = await db
        .from("content_items")
        .select("*")
        .eq("type", "project")
        .eq("slug", slug)
        .eq("status", "published")
        .single()

    if (error || !data) {
        return null
    }

    const [project] = await hydrateProjects([data], "published")
    return project || null
}

export async function getProjectById(id: string): Promise<Project | null> {
    const { data, error } = await db
        .from("content_items")
        .select("*")
        .eq("type", "project")
        .eq("id", id)
        .single()

    if (error || !data) {
        return null
    }

    const [project] = await hydrateProjects([data], "current")
    return project || null
}

export async function getRecentProjects(limit = 3): Promise<ProjectSummary[]> {
    const { data, error } = await db
        .from("content_items")
        .select("id, title, slug, summary, cover_image, status, published_at, created_at, updated_at")
        .eq("type", "project")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(limit)

    if (error) throw new Error(`Failed to fetch recent projects: ${formatDbError(error)}`)

    const hydrated = await hydrateProjects(data || [], "published")
    return hydrated.map((item) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        summary: item.summary,
        cover_image: item.cover_image,
        is_published: item.is_published,
        published_at: item.published_at,
        created_at: item.created_at,
        updated_at: item.updated_at,
        sort_order: item.sort_order,
        tags: item.tags,
    }))
}

export async function getProjectCount(): Promise<number> {
    const { count, error } = await db
        .from("content_items")
        .select("*", { count: "exact", head: true })
        .eq("type", "project")
        .eq("status", "published")

    if (error) throw error
    return count || 0
}

function mapToProject(item: any, usePublishedVersion = false, owner?: { full_name: string; avatar_url: string | null }): Project {
    const projectContents = item.project_contents?.[0] || {}

    let content = "[]"
    if (usePublishedVersion && item.content_versions) {
        content = Array.isArray(item.content_versions)
            ? getVersionContent(item.content_versions[0])
            : getVersionContent(item.content_versions)
    } else if (!usePublishedVersion && item.content_versions) {
        content = Array.isArray(item.content_versions)
            ? getVersionContent(item.content_versions[0])
            : getVersionContent(item.content_versions)
    }

    const tags = item.tags
        ? item.tags
            .map((t: any) => t.content_tags)
            .filter(Boolean)
        : []

    const links = normalizeProjectLinks(projectContents.links, item.id)

    return {
        id: item.id,
        title: item.title || "",
        slug: item.slug,
        summary: item.summary || "",
        cover_image: item.cover_image,
        content,
        is_published: item.status === "published",
        published_at: item.published_at,
        published_version_id: item.published_version_id ?? null,
        current_version_id: item.current_version_id ?? null,
        created_at: item.created_at,
        updated_at: item.updated_at,
        owner_id: item.owner_id,

        // Project specific data
        sort_order: projectContents.sort_order || 0,

        tags,
        links,
        owner,
    }
}

// ---------------------------------------------------------------------------
// WRITE / CRUD Functions
// ---------------------------------------------------------------------------

export async function createProject(input: CreateProjectInput): Promise<Project> {
    const now = new Date().toISOString()
    const slug = input.slug || `project-${Date.now().toString(36)}`

    // 1. Create content item
    const { data: item, error: itemError } = await db
        .from("content_items")
        .insert([
            {
                type: "project",
                owner_id: input.owner_id,
                title: input.title,
                slug,
                summary: input.summary || "",
                status: input.is_published ? "published" : "draft",
                source: "supabase",
                cover_image: input.cover_image || null,
                created_at: now,
                updated_at: now,
                published_at: input.is_published ? now : null,
            },
        ])
        .select()
        .single()

    if (itemError) throw itemError

    // 2. Create project_contents row
    const { error: pcError } = await db
        .from("project_contents")
        .insert([{ content_item_id: item.id, links: [] }])

    if (pcError) throw pcError

    // 3. Create initial version
    const { data: version, error: versionError } = await db
        .from("content_versions")
        .insert([
            {
                content_item_id: item.id,
                version_number: 1,
                snapshot_status: input.is_published ? "published" : "draft",
                body_format: "json", // Now defaulting to blocknote json
                title: input.title,
                summary: input.summary || "",
                ...toVersionBodyColumns(input.content || "[]", "json"),
                created_by: input.owner_id,
                change_description: "Initial creation",
            },
        ])
        .select("id")
        .single()

    if (versionError) throw versionError

    // 4. Update pointer
    const { error: pointerError } = await db
        .from("content_items")
        .update({
            current_version_id: version.id,
            published_version_id: input.is_published ? version.id : null
        })
        .eq("id", item.id)

    if (pointerError) throw pointerError

    const finalProject = await getProjectById(item.id)
    return finalProject!
}

export async function updateProject(
    id: string,
    updates: UpdateProjectInput,
    tagIds?: string[],
    links?: Array<{ label: string; url: string; link_type?: string }>,
    createVersion = false,
    userId?: string,
    changeDescription?: string,
): Promise<Project> {
    const now = new Date().toISOString()

    // Find item and current version
    const { data: item, error: itemError } = await db.from("content_items").select("*").eq("id", id).single()
    if (itemError || !item) throw itemError || new Error("Project not found")

    let currentVersion: any = null
    if (item.current_version_id) {
        const { data, error } = await db.from("content_versions").select("*").eq("id", item.current_version_id).single()
        if (error) throw error
        currentVersion = data
    }

    const mergedTitle = updates.title ?? currentVersion?.title ?? item.title
    const mergedSummary = updates.summary ?? currentVersion?.summary ?? item.summary ?? ""
    const mergedContent = updates.content ?? getVersionContent(currentVersion) ?? "[]"

    // Prepare updates
    const itemUpdates: any = { updated_at: now }
    if (updates.slug !== undefined) itemUpdates.slug = updates.slug
    if (updates.cover_image !== undefined) itemUpdates.cover_image = updates.cover_image
    if (updates.is_published !== undefined) {
        itemUpdates.status = updates.is_published ? "published" : "draft"
        itemUpdates.published_at = updates.is_published ? updates.published_at || now : null
    }
    itemUpdates.title = mergedTitle
    itemUpdates.summary = mergedSummary

    // Update project-specific fields
    const pcUpdates: any = {}
    if (updates.sort_order !== undefined) pcUpdates.sort_order = updates.sort_order
    if (links !== undefined) {
        pcUpdates.links = links.map((link, index) => ({
            label: link.label,
            url: link.url,
            link_type: link.link_type || null,
            sort_order: index,
        }))
    }

    if (Object.keys(pcUpdates).length > 0) {
        pcUpdates.content_item_id = id
        const { error: pcError } = await db
            .from("project_contents")
            .upsert(pcUpdates, { onConflict: "content_item_id" })
        if (pcError) throw pcError
    }

    // Handle versioning
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
        const nextBodyFormat = currentVersion?.body_format || "json"
        const nextBodyColumns = toVersionBodyColumns(mergedContent, nextBodyFormat)

        const { data: newVersion, error: insertErr } = await db
            .from("content_versions")
            .insert([
                {
                    content_item_id: id,
                    version_number: nextVersion,
                    snapshot_status: (itemUpdates.status || item.status) === "published" ? "published" : "draft",
                    body_format: nextBodyFormat,
                    title: mergedTitle,
                    summary: mergedSummary,
                    body_json: nextBodyColumns.body_json,
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
        const currentBodyFormat = currentVersion?.body_format || "json"
        const bodyColumns = toVersionBodyColumns(mergedContent, currentBodyFormat)
        const { error: versionUpdateError } = await db
            .from("content_versions")
            .update({ title: mergedTitle, summary: mergedSummary, ...bodyColumns })
            .eq("id", activeVersionId)
        if (versionUpdateError) throw versionUpdateError
    }

    if (updates.is_published === true && activeVersionId) {
        itemUpdates.published_version_id = activeVersionId
    }
    if (updates.is_published === false) {
        itemUpdates.published_version_id = null
    }

    const { error: updateError } = await db.from("content_items").update(itemUpdates).eq("id", id)
    if (updateError) throw updateError

    if (updates.content !== undefined && activeVersionId) {
        await syncEmbeddedAssetRefsForVersion(id, activeVersionId, updates.content)
    }

    // Tags
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

    const result = await getProjectById(id)
    return result!
}

export async function deleteProject(id: string): Promise<string[]> {
    try {
        const { data: assets, error: assetsError } = await db.from("assets").select("id, object_key, public_url").like("object_key", `assets/${id}/%`)

        if (assetsError) {
            console.error("Error fetching assets for delete:", assetsError)
        }

        if ((assets || []).length > 0) {
            await enqueueAssetDeletionJobs((assets || []) as AssetRow[])
        }

        // project_contents and other relations will cascade
        const { error } = await db.from("content_items").delete().eq("id", id)
        if (error) throw error

        return ((assets || []) as AssetRow[]).map((asset) => asset.object_key)
    } catch (error) {
        console.error("Error in deleteProject:", error)
        throw error
    }
}

export async function publishProject(id: string, versionId?: string) {
    const now = new Date().toISOString()

    // If version is not provided, use current version
    let targetVersionId = versionId
    if (!targetVersionId) {
        const { data, error } = await db.from("content_items").select("current_version_id").eq("id", id).single()
        if (error || !data) throw error || new Error("Project not found")
        targetVersionId = data.current_version_id
    }

    const { error: itemError } = await db
        .from("content_items")
        .update({
            status: "published",
            published_version_id: targetVersionId,
            published_at: now,
            updated_at: now,
        })
        .eq("id", id)

    if (itemError) throw itemError

    if (targetVersionId) {
        const { error: versionError } = await db
            .from("content_versions")
            .update({ snapshot_status: "published" })
            .eq("id", targetVersionId)
        if (versionError) throw versionError
        if (versionError) throw versionError
    }

    return { published_at: now }
}

export async function getProjectPublishedVersion(versionId: string) {
    const { data, error } = await db
        .from("content_versions")
        .select("title, body_json, body_format, summary")
        .eq("id", versionId)
        .single()

    if (error || !data) throw error || new Error("Published version not found")
    return { title: data.title, content: getVersionContent(data), summary: data.summary }
}

export async function addProjectTag(projectId: string, tagId: string) {
    const { error } = await db.from("content_item_tags").insert({ content_item_id: projectId, tag_id: tagId })
    if (error) throw error
}

export async function removeProjectTag(projectId: string, tagId: string) {
    const { error } = await db.from("content_item_tags").delete().eq("content_item_id", projectId).eq("tag_id", tagId)
    if (error) throw error
}

export async function unpublishProject(id: string) {
    const { error } = await db
        .from("content_items")
        .update({
            status: "draft",
            published_version_id: null,
            published_at: null,
            updated_at: new Date().toISOString(),
        })
        .eq("id", id)

    if (error) throw error
}

export async function reorderProjects(items: { id: string; sort_order: number }[]) {
    const normalized = items.map((item) => ({
        id: item.id,
        sort_order: item.sort_order,
    }))

    const { error } = await db.rpc("reorder_project_contents", {
        p_items: normalized,
    })

    if (error) throw error
}

// ---------------------------------------------------------------------------
// BlockNote / Versioning & Auto-save (mirrored from blog-service)
// ---------------------------------------------------------------------------

export async function saveProjectDraftContent(projectId: string, contentJson: string) {
    const { data: item, error: itemError } = await db
        .from("content_items")
        .select("current_version_id")
        .eq("id", projectId)
        .single()
    if (itemError || !item?.current_version_id) throw itemError || new Error("Missing current version")

    const { error: versionError } = await db
        .from("content_versions")
        .update({ body_format: "json", ...toVersionBodyColumns(contentJson, "json") })
        .eq("id", item.current_version_id)
    if (versionError) throw versionError

    const { error: itemUpdateError } = await db
        .from("content_items")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", projectId)
    if (itemUpdateError) throw itemUpdateError

    await syncEmbeddedAssetRefsForVersion(projectId, item.current_version_id, contentJson)
}

export async function getProjectVersioningState(projectId: string): Promise<ProjectVersioningState> {
    const { data: item, error: itemError } = await db
        .from("content_items")
        .select("id, title, summary, current_version_id, published_version_id, status")
        .eq("id", projectId)
        .single()
    if (itemError || !item) throw itemError || new Error("Project not found")
    if (!item.current_version_id) throw new Error("Project has no current version")

    const { data: currentVersion, error: currentVersionError } = await db
        .from("content_versions")
        .select("id, title, summary, body_json, body_format")
        .eq("id", item.current_version_id)
        .single()
    if (currentVersionError || !currentVersion) throw currentVersionError || new Error("Current version not found")

    const { data: latestVersions, error: latestError } = await db
        .from("content_versions")
        .select("id, version_number, title, summary, body_json, body_format, change_description")
        .eq("content_item_id", projectId)
        .order("version_number", { ascending: false })
        .limit(1)
    if (latestError) throw latestError

    return {
        item,
        currentVersion: normalizeVersionRow(currentVersion),
        latestVersion: latestVersions?.[0] ? normalizeVersionRow(latestVersions[0]) : null,
    }
}

export async function updateProjectVersionSnapshot(
    versionId: string,
    updates: { title?: string; content?: string; summary?: string; change_description?: string | null },
) {
    const payload: any = {}
    if (updates.title !== undefined) payload.title = updates.title
    if (updates.summary !== undefined) payload.summary = updates.summary
    if (updates.change_description !== undefined) payload.change_description = updates.change_description

    let versionRowForContent: { content_item_id: string; body_format: string } | null = null
    if (updates.content !== undefined) {
        const { data: versionRow, error: versionRowError } = await db
            .from("content_versions")
            .select("content_item_id, body_format")
            .eq("id", versionId)
            .single()
        if (versionRowError) throw versionRowError
        versionRowForContent = versionRow
        Object.assign(payload, toVersionBodyColumns(updates.content, versionRow.body_format || "json"))
    }

    const { error } = await db.from("content_versions").update(payload).eq("id", versionId)
    if (error) throw error

    if (updates.content !== undefined && versionRowForContent) {
        await syncEmbeddedAssetRefsForVersion(versionRowForContent.content_item_id, versionId, updates.content)
    }
}

export async function createProjectVersionFromSnapshot(params: {
    projectId: string
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
                content_item_id: params.projectId,
                version_number: params.versionNumber,
                snapshot_status: params.snapshotStatus || "draft",
                body_format: params.bodyFormat,
                title: params.title,
                ...toVersionBodyColumns(params.content, params.bodyFormat),
                summary: params.summary,
                created_by: params.createdBy,
                change_description: params.changeDescription,
            },
        ])
        .select("id")
        .single()
    if (error || !data) throw error || new Error("Failed to create version")
    try {
        const { data: itemRow } = await db.from("content_items").select("current_version_id").eq("id", params.projectId).single()
        if (itemRow?.current_version_id) {
            await cloneVersionAssetRefs(itemRow.current_version_id, data.id as string)
        }
    } catch (cloneError) {
        console.error("Failed to clone asset refs for new version:", cloneError)
    }
    if (params.bodyFormat === "json") {
        await syncEmbeddedAssetRefsForVersion(params.projectId, data.id as string, params.content)
    }
    return data.id as string
}

export async function setProjectCurrentVersion(projectId: string, versionId: string, title: string, summary: string | null) {
    const { error } = await db
        .from("content_items")
        .update({
            current_version_id: versionId,
            title,
            summary,
            updated_at: new Date().toISOString(),
        })
        .eq("id", projectId)
    if (error) throw error
}

export async function renameProject(projectId: string, title: string, slug: string) {
    const { data: item, error: itemError } = await db
        .from("content_items")
        .select("current_version_id")
        .eq("id", projectId)
        .single()
    if (itemError) throw itemError

    const { error } = await db
        .from("content_items")
        .update({ title, slug, updated_at: new Date().toISOString() })
        .eq("id", projectId)
    if (error) throw error

    if (item?.current_version_id) {
        const { error: versionError } = await db.from("content_versions").update({ title }).eq("id", item.current_version_id)
        if (versionError) throw versionError
    }
}

export async function updateProjectCoverImage(projectId: string, coverImage: string) {
    const { error } = await db
        .from("content_items")
        .update({ cover_image: coverImage, updated_at: new Date().toISOString() })
        .eq("id", projectId)
    if (error) throw error
}

export async function getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
    const { data, error } = await db
        .from("content_versions")
        .select("id, version_number, content_item_id, title, body_json, body_format, summary, change_description, created_at, created_by")
        .eq("content_item_id", projectId)
        .order("version_number", { ascending: false })

    if (error) {
        console.error("Error fetching post versions:", error)
        throw error
    }

    const rows = data || []
    const authorMap = await getAuthorMap(rows.map((r: any) => r.created_by).filter(Boolean))

    return rows.map((rawVersion: any) => {
        const version = normalizeVersionRow(rawVersion)
        return {
            id: version.id,
            version_number: version.version_number,
            post_id: version.content_item_id,
            title: version.title,
            content: getVersionContent(version),
            summary: version.summary ?? undefined,
            change_description: version.change_description,
            created_at: version.created_at,
            created_by: version.created_by,
            creator: version.created_by ? { id: version.created_by, username: "", ...authorMap[version.created_by] } : null,
        }
    })
}

export async function restoreProjectVersion(projectId: string, versionNumber: number, userId: string) {
    const { data: versionData, error: versionError } = await db
        .from("content_versions")
        .select("*")
        .eq("content_item_id", projectId)
        .eq("version_number", versionNumber)
        .single()

    if (versionError) throw versionError
    if (!versionData) throw new Error(`Version ${versionNumber} not found`)

    const { data: latest, error: latestErr } = await db
        .from("content_versions")
        .select("version_number")
        .eq("content_item_id", projectId)
        .order("version_number", { ascending: false })
        .limit(1)
    if (latestErr) throw latestErr
    const nextVersionNumber = latest?.[0]?.version_number ? latest[0].version_number + 1 : 1

    const { data: newVersion, error: createErr } = await db
        .from("content_versions")
        .insert([
            {
                content_item_id: projectId,
                version_number: nextVersionNumber,
                snapshot_status: "draft",
                body_format: versionData.body_format,
                title: versionData.title,
                summary: versionData.summary,
                body_json: versionData.body_json,
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
        .eq("id", projectId)
    if (itemUpdateErr) throw itemUpdateErr
}

export async function recordProjectImage(projectId: string, url: string, usageType: "embedded" | "cover" = "embedded") {
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
    const versionId = await getCurrentVersionIdForPost(projectId)
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
    await enqueueOrphanedPostAssets(projectId)

    const { data, error } = await db.from("assets").select("id, public_url, created_at").eq("id", asset.id).single()
    if (error || !data) throw error || new Error("Failed to fetch image after record")

    return {
        id: data.id,
        post_id: projectId,
        url: data.public_url,
        created_at: data.created_at,
    } as ProjectImage
}

// ---------------------------------------------------------------------------
// Asset Helpers (private)
// ---------------------------------------------------------------------------

function toS3Key(url: string): string | null {
    try {
        const parsed = new URL(url)
        const cdnBase = process.env.NEXT_PUBLIC_S3_CDN_URL
        if (cdnBase) {
            try {
                const cdnOrigin = new URL(cdnBase).origin
                if (parsed.origin !== cdnOrigin) return null
            } catch {
                // Ignore fallback
            }
        }
        let key = parsed.pathname.replace(/^\//, "") || null
        const configuredBucket = process.env.S3_BUCKET || process.env.NEXT_PUBLIC_S3_BUCKET
        if (key && configuredBucket && key.startsWith(`${configuredBucket}/`)) {
            key = key.slice(configuredBucket.length + 1)
        }
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
