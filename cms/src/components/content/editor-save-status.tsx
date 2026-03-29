import { AlertCircle, Check, Clock3, Loader2 } from "lucide-react"

export type EditorSaveStatus = "idle" | "pending" | "saving" | "saved" | "error"

type EditorSaveStatusProps = {
  status: EditorSaveStatus
  size?: "sm" | "md"
}

const iconClassNameBySize = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
} as const

export function getEditorSaveStatusLabel(status: EditorSaveStatus) {
  switch (status) {
    case "pending":
      return "변경 있음"
    case "saving":
      return "저장 중"
    case "saved":
      return "저장 완료"
    case "error":
      return "저장 실패"
    default:
      return "편집 중"
  }
}

export function EditorSaveStatus({ status, size = "sm" }: EditorSaveStatusProps) {
  const iconClassName = iconClassNameBySize[size]

  return (
    <>
      {status === "pending" && <Clock3 className={iconClassName} />}
      {status === "saving" && <Loader2 className={`${iconClassName} animate-spin`} />}
      {status === "saved" && <Check className={`${iconClassName} text-emerald-600`} />}
      {status === "error" && <AlertCircle className={`${iconClassName} text-destructive`} />}
      <span>{getEditorSaveStatusLabel(status)}</span>
    </>
  )
}
