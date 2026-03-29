export function shortVersionHash(value?: string | null, length = 7) {
  if (!value) return "-"
  return value.slice(0, length)
}

export function buildDefaultVersionMessage(
  kind: "post" | "project" | "home",
  title?: string | null,
) {
  const trimmedTitle = (title || "").trim()
  if (trimmedTitle) {
    return `${trimmedTitle} 업데이트`
  }

  switch (kind) {
    case "post":
      return "블로그 글 업데이트"
    case "project":
      return "프로젝트 업데이트"
    case "home":
      return "홈 구성 업데이트"
    default:
      return "콘텐츠 업데이트"
  }
}
