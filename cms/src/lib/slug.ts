import { slugify } from "transliteration"

export function normalizeSlugInput(value: string) {
  return slugify(value, {
    lowercase: true,
    separator: "-",
    trim: true,
  })
}

export function buildEntitySlug(
  rawValue: string,
  fallbackSlug: string | null | undefined,
  fallbackPrefix: string,
  entityId: string,
) {
  const slug = normalizeSlugInput(rawValue)
  return slug || fallbackSlug || `${fallbackPrefix}-${entityId.slice(0, 8)}`
}

export function buildDraftSlug(rawValue: string, fallbackPrefix: string) {
  const slug = normalizeSlugInput(rawValue)
  const suffix = crypto.randomUUID().slice(0, 8)
  return slug ? `${slug}-${suffix}` : `${fallbackPrefix}-${suffix}`
}
