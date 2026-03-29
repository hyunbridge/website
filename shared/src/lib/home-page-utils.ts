const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"])

export type HomeHrefResolution = {
  href: string
  isValid: boolean
  wasNormalized: boolean
}

export function resolveHomeHref(
  value: string | null | undefined,
  fallback = "/",
): HomeHrefResolution {
  const raw = typeof value === "string" ? value.trim() : ""
  if (!raw) {
    return { href: fallback, isValid: false, wasNormalized: false }
  }

  if (raw.startsWith("//")) {
    return { href: fallback, isValid: false, wasNormalized: false }
  }

  if (raw.startsWith("/") || raw.startsWith("#") || raw.startsWith("?")) {
    return { href: raw, isValid: true, wasNormalized: false }
  }

  try {
    const parsed = new URL(raw)
    if (SAFE_PROTOCOLS.has(parsed.protocol)) {
      return { href: raw, isValid: true, wasNormalized: false }
    }

    return { href: fallback, isValid: false, wasNormalized: false }
  } catch {
    // Relative paths fall through to the internal-route branch below.
  }

  if (!raw.startsWith(".") && !raw.includes(":") && !/\s/.test(raw)) {
    return { href: `/${raw}`, isValid: true, wasNormalized: true }
  }

  return { href: fallback, isValid: false, wasNormalized: false }
}

export function sanitizeHomeHref(value: string | null | undefined, fallback = "/") {
  return resolveHomeHref(value, fallback).href
}
