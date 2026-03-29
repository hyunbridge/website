export function getPublicSiteUrl() {
  const configured = (import.meta.env.PUBLIC_SITE_URL as string | undefined)?.trim()
  if (configured) {
    return configured.replace(/\/+$/, "")
  }

  if (import.meta.env.DEV) {
    return "http://localhost:4321"
  }

  throw new Error("PUBLIC_SITE_URL is required for production builds")
}
