const VERSIONED_PDF_PREFIX = "generated/cv"
const FALLBACK_PDF_KEY = `${VERSIONED_PDF_PREFIX}/cv-latest.pdf`

export function getCVLastModified(recordMap: unknown): string | null {
  if (!recordMap || typeof recordMap !== "object" || !("block" in recordMap)) {
    return null
  }

  const block = recordMap.block
  if (!block || typeof block !== "object") {
    return null
  }

  const pageId = Object.keys(block)[0]
  const pageEntry = (block as Record<string, { value?: { last_edited_time?: string | number | null } } | null | undefined>)[pageId]
  return pageEntry?.value?.last_edited_time?.toString() || null
}

export function buildCVPdfObjectKey(lastModified: string | null): string {
  if (!lastModified) {
    return FALLBACK_PDF_KEY
  }

  const sanitizedRevision = lastModified.replace(/[^0-9A-Za-z_-]/g, "-")
  return `${VERSIONED_PDF_PREFIX}/cv-${sanitizedRevision}.pdf`
}

export function getCVPdfCacheControl(lastModified: string | null): string {
  if (lastModified) {
    return "public, max-age=31536000, immutable"
  }

  return "public, max-age=60, stale-while-revalidate=86400"
}

function normalizeBaseUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null
  }

  return value.replace(/\/$/, "")
}

export function getCVRenderTargetUrl(requestUrl: string): string {
  const requestOrigin = new URL(requestUrl).origin
  const baseUrl = normalizeBaseUrl(process.env.PDF_RENDER_BASE_URL) || requestOrigin
  return `${baseUrl}/cv?print=true`
}
