import type { ReactNode } from "react"

import { Loader2 } from "lucide-react"

import { Badge } from "@shared/components/ui/badge"
import { Button } from "@shared/components/ui/button"
import { Input } from "@shared/components/ui/input"
import { Label } from "@shared/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@shared/components/ui/dialog"

import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"

type ContentSettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  slugInputId: string
  slugValue: string
  onSlugChange: (value: string) => void
  slugPlaceholder: string
  urlPreview: string
  summaryValue: string
  onSummaryChange: (value: string) => void
  summaryPlaceholder: string
  summaryHint: string
  publicationSwitchId: string
  isPublished: boolean
  onPublishedChange: (value: boolean) => void
  isSaving: boolean
  onSave: () => void
  children?: ReactNode
  metadataChildren?: ReactNode
}

export function ContentSettingsDialog({
  open,
  onOpenChange,
  title,
  slugInputId,
  slugValue,
  onSlugChange,
  slugPlaceholder,
  urlPreview,
  summaryValue,
  onSummaryChange,
  summaryPlaceholder,
  summaryHint,
  publicationSwitchId,
  isPublished,
  onPublishedChange,
  isSaving,
  onSave,
  children,
  metadataChildren,
}: ContentSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl border-border/60 bg-background/90 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={slugInputId} className="text-xs">
              슬러그
            </Label>
            <Input
              id={slugInputId}
              value={slugValue}
              onChange={(event) => onSlugChange(event.target.value)}
              placeholder={slugPlaceholder}
              className="h-9 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">URL: {urlPreview}</p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">요약</Label>
            <Textarea
              value={summaryValue}
              onChange={(event) => onSummaryChange(event.target.value)}
              placeholder={summaryPlaceholder}
              className="min-h-20 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">{summaryHint}</p>
          </div>

          {metadataChildren}

          <div className="border-t pt-3">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <Label htmlFor={publicationSwitchId} className="text-xs">
                  공개 상태
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  공개로 바꾸면 다음 배포에 반영됩니다.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={isPublished ? "default" : "secondary"}>
                  {isPublished ? "공개" : "비공개"}
                </Badge>
                <Switch
                  id={publicationSwitchId}
                  checked={isPublished}
                  onCheckedChange={onPublishedChange}
                />
              </div>
            </div>
          </div>

          {children}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            취소
          </Button>
          <Button type="button" onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                저장 중...
              </>
            ) : (
              "설정 저장"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
