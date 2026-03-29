import {
  cloneHomePageData,
  createParagraphRichContent,
  duplicateHomePageSection,
  generateHomeId,
  getDefaultHomePageData,
  getEmptyHomePageData,
  getHomePageDataNotices,
  homeSectionPresets,
  inspectHomePageData,
  normalizeHomePageData,
  type HomeCardSection,
  type HomeCtaSection,
  type HomeEntryItem,
  type HomeHeroCard,
  type HomeHeroSection,
  type HomeLink,
  type HomePageData,
  type HomePageDocument,
  type HomePageNotice,
  type HomePageSection,
  type HomePlainSection,
  type HomePostFeedSection,
  type HomeProjectFeedSection,
  type HomeRichContent,
  type HomeSectionPreset,
  type HomeTheme,
  type HomeTimelineSection,
} from "@/lib/home-page-schema"
import { isApiError, request } from "./api-client"

export {
  cloneHomePageData,
  createParagraphRichContent,
  duplicateHomePageSection,
  generateHomeId,
  getDefaultHomePageData,
  getEmptyHomePageData,
  getHomePageDataNotices,
  homeSectionPresets,
  inspectHomePageData,
  normalizeHomePageData,
  type HomeCardSection,
  type HomeCtaSection,
  type HomeEntryItem,
  type HomeHeroCard,
  type HomeHeroSection,
  type HomeLink,
  type HomePageData,
  type HomePageDocument,
  type HomePageNotice,
  type HomePageSection,
  type HomePlainSection,
  type HomePostFeedSection,
  type HomeProjectFeedSection,
  type HomeRichContent,
  type HomeSectionPreset,
  type HomeTheme,
  type HomeTimelineSection,
}

export type HomePageVersion = {
  id: string
  page_id: string
  version_number: number
  title: string
  data: HomePageData
  notices: HomePageNotice[]
  summary: string | null
  change_description: string | null
  created_at: string
  created_by: string | null
}

type HomeDocumentDTO = {
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

function isInitialEmptyHomeDocument(document: HomeDocumentDTO) {
  return (
    document.data == null &&
    !document.updatedAt &&
    !document.publishedAt &&
    !document.currentVersionId &&
    !document.publishedVersionId
  )
}

function normalizeDocument(document: HomeDocumentDTO | null): HomePageDocument | null {
  if (!document) return null

  if (isInitialEmptyHomeDocument(document)) {
    return {
      id: document.id,
      ownerId: document.ownerId,
      status: document.status,
      updatedAt: document.updatedAt,
      publishedAt: document.publishedAt,
      currentVersionId: document.currentVersionId ?? null,
      publishedVersionId: document.publishedVersionId ?? null,
      data: getDefaultHomePageData(),
      notices: document.notices ?? [],
    }
  }

  const inspected = inspectHomePageData(document.data, { fallback: "default" })

  return {
    id: document.id,
    ownerId: document.ownerId,
    status: document.status,
    updatedAt: document.updatedAt,
    publishedAt: document.publishedAt,
    currentVersionId: document.currentVersionId ?? null,
    publishedVersionId: document.publishedVersionId ?? null,
    data: inspected.data,
    notices: document.notices && document.notices.length > 0 ? document.notices : inspected.notices,
  }
}

export async function getHomePage(includeDraft = false): Promise<HomePageDocument | null> {
  const path = includeDraft ? "/admin/home" : "/site/home"
  try {
    const response = await request<HomeDocumentDTO>(path, { auth: includeDraft })
    return normalizeDocument(response)
  } catch (error) {
    if (!includeDraft && isApiError(error) && error.status === 404) {
      return null
    }
    throw error
  }
}

export async function saveHomePageDraft(params: {
  data: HomePageData
  changeDescription?: string
}) {
  const response = await request<HomeDocumentDTO>("/admin/home/save", {
    method: "POST",
    auth: true,
    body: {
      data: params.data,
      changeDescription: params.changeDescription || "Draft changes",
    },
  })

  return normalizeDocument(response) as HomePageDocument
}

export async function saveHomePageVersion(changeDescription?: string) {
  const response = await request<HomeDocumentDTO>("/admin/home/current-version", {
    method: "POST",
    auth: true,
    body: {
      changeDescription: changeDescription || null,
    },
  })

  return normalizeDocument(response) as HomePageDocument
}

export async function getHomePageVersions() {
  const versions = await request<HomePageVersion[]>("/admin/home/versions", {
    auth: true,
  })

  return versions.map((version) => {
    const inspected = inspectHomePageData(version.data, { fallback: "default" })
    return {
      ...version,
      data: inspected.data,
      notices: version.notices && version.notices.length > 0 ? version.notices : inspected.notices,
    }
  })
}

export async function restoreHomePageVersion(params: {
  versionNumber: number
}) {
  const response = await request<HomeDocumentDTO>("/admin/home/restore", {
    method: "POST",
    auth: true,
    body: {
      versionNumber: params.versionNumber,
    },
  })

  return normalizeDocument(response) as HomePageDocument
}
