import { Send } from "lucide-react"

import { Button } from "@shared/components/ui/button"

import {
  EditorSaveStatus,
  type EditorSaveStatus as SaveStatus,
} from "@/components/content/editor-save-status"

type VersionSaveStatusButtonProps = {
  status: SaveStatus
  disabled: boolean
  onClick: () => void
  size?: "sm" | "md"
}

type VersionSaveButtonProps = {
  disabled: boolean
  isSaving: boolean
  onClick: () => void
  label?: string
  className?: string
}

export function VersionSaveStatusButton({
  status,
  disabled,
  onClick,
  size = "sm",
}: VersionSaveStatusButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-default"
    >
      <EditorSaveStatus status={status} size={size} />
    </button>
  )
}

export function VersionSaveButton({
  disabled,
  isSaving,
  onClick,
  label = "저장",
  className,
}: VersionSaveButtonProps) {
  return (
    <Button
      variant="default"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={className ?? "text-xs gap-1.5"}
    >
      <Send className="h-3.5 w-3.5" />
      {isSaving ? "저장 중…" : label}
    </Button>
  )
}
