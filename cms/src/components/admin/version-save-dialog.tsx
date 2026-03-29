"use client"

import { Loader2 } from "lucide-react"
import { Button } from "@shared/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/components/ui/dialog"
import { Input } from "@shared/components/ui/input"
import { Label } from "@shared/components/ui/label"

export type VersionSaveDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  message: string
  onMessageChange: (value: string) => void
  onConfirm: () => void
  isSaving?: boolean
  confirmLabel?: string
}

export function VersionSaveDialog({
  open,
  onOpenChange,
  title,
  description,
  message,
  onMessageChange,
  onConfirm,
  isSaving = false,
  confirmLabel = "저장",
}: VersionSaveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="version-save-message">변경 메모</Label>
          <Input
            id="version-save-message"
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            placeholder="이번에 바뀐 내용을 짧게 적어주세요"
            onKeyDown={(event) => {
              if (event.key === "Enter" && !isSaving && message.trim()) {
                event.preventDefault()
                onConfirm()
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            취소
          </Button>
          <Button type="button" onClick={onConfirm} disabled={isSaving || !message.trim()}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
