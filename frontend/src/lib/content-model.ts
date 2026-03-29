import type { HomePageNotice } from "@/lib/home-page-schema"

export type Tag = {
  id: string
  name: string
  slug: string
}

export type Post = {
  id: string
  created_at: string
  title: string
  slug: string
  content: string
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
  title: string
  slug: string
  content: string
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

export type HomeDocumentDTO = {
  id: string | null
  ownerId: string | null
  status: "draft" | "published" | "archived"
  updatedAt: string | null
  publishedAt: string | null
  currentVersionId?: string | null
  publishedVersionId?: string | null
  data: unknown
  notices?: HomePageNotice[]
}
