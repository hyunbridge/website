import type { ReactNode } from "react"

import { ChevronDown, History, ImageIcon, Settings, Trash2 } from "lucide-react"

import { Button } from "@shared/components/ui/button"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { type EditorSaveStatus as SaveStatus } from "@/components/content/editor-save-status"
import {
  VersionSaveButton,
  VersionSaveStatusButton,
} from "@/components/content/version-save-controls"

type ContentEditorToolbarProps = {
  saveStatus: SaveStatus
  saveDisabled: boolean
  isSavingVersion: boolean
  onOpenSaveDialog: () => void
  onOpenSettings: () => void
  onOpenHistory: () => void
  onOpenCoverUpload: () => void
  onDelete: () => void
  children?: ReactNode
}

export function ContentEditorToolbar({
  saveStatus,
  saveDisabled,
  isSavingVersion,
  onOpenSaveDialog,
  onOpenSettings,
  onOpenHistory,
  onOpenCoverUpload,
  onDelete,
  children,
}: ContentEditorToolbarProps) {
  return (
    <div className="content-article__toolbar flex flex-wrap items-center gap-3 rounded-xl border border-border/50 bg-muted/50 p-3">
      <VersionSaveStatusButton
        onClick={onOpenSaveDialog}
        disabled={saveDisabled}
        status={saveStatus}
      />

      <div className="flex-1" />

      <Button variant="ghost" size="sm" className="text-xs" onClick={onOpenSettings}>
        <Settings className="mr-1 h-3.5 w-3.5" />
        설정
      </Button>

      <Button variant="ghost" size="sm" onClick={onOpenCoverUpload} className="text-xs">
        <ImageIcon className="mr-1 h-3.5 w-3.5" />
        커버
      </Button>

      {children}

      <Button variant="ghost" size="sm" onClick={onOpenHistory} className="text-xs">
        <History className="mr-1 h-3.5 w-3.5" />
        기록
      </Button>

      <div className="flex items-center">
        <VersionSaveButton
          onClick={onOpenSaveDialog}
          isSaving={isSavingVersion}
          disabled={saveDisabled}
          className="rounded-r-none text-xs gap-1.5"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="rounded-l-none border-l border-primary-foreground/20 px-1.5"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem
              onClick={onDelete}
              className="gap-2 text-sm text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
