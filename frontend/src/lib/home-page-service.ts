import { apiRequest, isApiError } from "@/lib/api-client"
import {
  getEmptyHomePageData,
  parseStrictHomePageData,
  type HomeCardSection,
  type HomeCtaSection,
  type HomeHeroCard,
  type HomeHeroSection,
  type HomePageData,
  type HomePageDocument,
  type HomePageNotice,
  type HomePageSection,
  type HomePlainSection,
  type HomePostFeedSection,
  type HomeProjectFeedSection,
  type HomeRichContent,
  type HomeTimelineSection,
  type HomeTheme,
} from "@/lib/home-page-schema"
import type { HomeDocumentDTO } from "@/lib/content-model"
import { getSiteBuildExport } from "@/lib/site-build-export"

export {
  getEmptyHomePageData,
  type HomeCardSection,
  type HomeCtaSection,
  type HomeHeroCard,
  type HomeHeroSection,
  type HomePageData,
  type HomePageDocument,
  type HomePageNotice,
  type HomePageSection,
  type HomePlainSection,
  type HomePostFeedSection,
  type HomeProjectFeedSection,
  type HomeRichContent,
  type HomeTimelineSection,
  type HomeTheme,
}

function normalizeDocument(document: HomeDocumentDTO | null): HomePageDocument | null {
  if (!document) return null

  return {
    id: document.id,
    ownerId: document.ownerId,
    status: document.status,
    updatedAt: document.updatedAt,
    publishedAt: document.publishedAt,
    currentVersionId: document.currentVersionId ?? null,
    publishedVersionId: document.publishedVersionId ?? null,
    data: parseStrictHomePageData(document.data),
    notices: document.notices || [],
  }
}

export async function getHomePage(_includeDraft = false): Promise<HomePageDocument | null> {
  const site = await getSiteBuildExport()
  if (site) {
    return normalizeDocument(site.home)
  }

  try {
    const response = await apiRequest<HomeDocumentDTO>("/site/home", {
      cache: "no-store",
    })
    return normalizeDocument(response)
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null
    }
    throw error
  }
}
