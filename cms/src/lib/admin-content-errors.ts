import { isApiError } from "@/lib/api-client"

export function readAdminContentLoadError(
  kind: "게시글" | "프로젝트",
  error: unknown,
) {
  if (isApiError(error) && error.status === 403) {
    return `이 ${kind}을 수정할 권한이 없습니다.`
  }
  if (isApiError(error) && error.status === 404) {
    return `${kind}을 찾을 수 없습니다.`
  }
  return `${kind}을 불러오지 못했습니다.`
}
