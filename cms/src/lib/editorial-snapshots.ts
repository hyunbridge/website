type SnapshotTag = {
  id: string
  name: string
  slug: string
}

type SnapshotLink = {
  label: string
  url: string
  link_type?: string | null
}

export function normalizeEditorialTags(tags: SnapshotTag[]) {
  return tags.map((tag) => ({
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
  }))
}

export function normalizeEditorialLinks(links: SnapshotLink[]) {
  return links.map((link) => ({
    label: (link.label || "").trim(),
    url: (link.url || "").trim(),
    link_type: link.link_type || undefined,
  }))
}

export function buildPostEditorialSnapshot(input: {
  title: string
  slug: string
  summary: string
  publishedAt: string | null
  coverImage: string | null
  enableComments: boolean
  tags: SnapshotTag[]
  content: string
}) {
  return JSON.stringify({
    title: input.title || "",
    slug: input.slug || "",
    summary: input.summary || "",
    publishedAt: input.publishedAt || null,
    coverImage: input.coverImage || null,
    enableComments: input.enableComments,
    tags: normalizeEditorialTags(input.tags),
    content: input.content || "",
  })
}

export function buildProjectEditorialSnapshot(input: {
  title: string
  slug: string
  summary: string
  publishedAt: string | null
  coverImage: string | null
  sortOrder: number
  tags: SnapshotTag[]
  links: SnapshotLink[]
  content: string
}) {
  return JSON.stringify({
    title: input.title || "",
    slug: input.slug || "",
    summary: input.summary || "",
    publishedAt: input.publishedAt || null,
    coverImage: input.coverImage || null,
    sortOrder: input.sortOrder,
    tags: normalizeEditorialTags(input.tags),
    links: normalizeEditorialLinks(input.links),
    content: input.content || "",
  })
}
