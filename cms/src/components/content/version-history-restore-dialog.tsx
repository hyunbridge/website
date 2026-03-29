"use client"

import { format } from "date-fns"
import { RotateCcw } from "lucide-react"

import { Badge } from "@shared/components/ui/badge"
import { Button } from "@shared/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/components/ui/dialog"
import { cn } from "@shared/lib/utils"
import { shortVersionHash } from "@/lib/version-utils"

import type { VersionHistoryEntry } from "./version-history-types"

type VersionHistoryRestoreDialogProps = {
  open: boolean
  version: VersionHistoryEntry | null
  isRestoring: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function VersionHistoryRestoreDialog({
  open,
  version,
  isRestoring,
  onOpenChange,
  onConfirm,
}: VersionHistoryRestoreDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            {shortVersionHash(version?.id)}로 복원
          </DialogTitle>
          <DialogDescription>
            이 버전을 현재 내용으로 가져옵니다. 지금 작업 중인 내용도 새 버전으로 남습니다.
          </DialogDescription>
        </DialogHeader>

        {version ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {shortVersionHash(version.id)}
              </Badge>
              <span className="text-sm font-medium">{version.title || "제목 없음"}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              저장 시각 {format(new Date(version.created_at), "yyyy.MM.dd HH:mm")}
              {version.creator ? (
                <> · {version.creator.full_name || version.creator.username}</>
              ) : null}
            </p>
            {version.change_description ? (
              <p className="text-xs italic text-muted-foreground">
                &quot;{version.change_description}&quot;
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isRestoring}>
            취소
          </Button>
          <Button onClick={onConfirm} disabled={isRestoring} className="gap-1.5">
            <RotateCcw className={cn("h-3.5 w-3.5", isRestoring && "animate-spin")} />
            {isRestoring ? "복원 중…" : "이 버전으로 복원"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
