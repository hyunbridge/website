type EnvBag = Record<string, string | undefined>

const env = import.meta.env as EnvBag

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = env[key]
    if (typeof value === "string" && value.length > 0) {
      return value
    }
  }
  return undefined
}

export function getConfiguredApiBaseUrl() {
  const configured = readEnv("VITE_API_BASE_URL")
  if (configured) {
    return configured
  }

  if (import.meta.env.DEV) {
    return "http://localhost:8080/api/v1"
  }

  throw new Error("VITE_API_BASE_URL is required for the CMS")
}

export function getConfiguredSiteUrl() {
  const configured = readEnv("VITE_SITE_URL")
  if (configured) {
    return configured
  }

  if (import.meta.env.DEV) {
    return "http://localhost:4321"
  }

  throw new Error("VITE_SITE_URL is required for the CMS")
}

export const SITE_URL = getConfiguredSiteUrl()
export const TURNSTILE_SITE_KEY = readEnv("VITE_TURNSTILE_SITE_KEY")
export const GISCUS_REPO = readEnv("VITE_GISCUS_REPO") || ""
export const GISCUS_REPO_ID = readEnv("VITE_GISCUS_REPO_ID") || ""
export const GISCUS_CATEGORY = readEnv("VITE_GISCUS_CATEGORY") || ""
export const GISCUS_CATEGORY_ID = readEnv("VITE_GISCUS_CATEGORY_ID") || ""
export const OBJECT_STORAGE_BUCKET = readEnv("VITE_S3_BUCKET")
export const OBJECT_STORAGE_ENDPOINT = readEnv("VITE_S3_ENDPOINT")
export const OBJECT_STORAGE_REGION = readEnv("VITE_S3_REGION") || "auto"
export const OBJECT_STORAGE_CDN_URL = readEnv("VITE_S3_CDN_URL")
