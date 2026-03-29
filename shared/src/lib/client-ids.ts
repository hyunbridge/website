export function createTemporaryId(prefix: string) {
  const normalizedPrefix = prefix.trim().replace(/[^a-z0-9_-]+/gi, "-") || "tmp"
  return `tmp_${normalizedPrefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`
}
