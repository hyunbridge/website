"use client"

import type { ReactNode } from "react"
import type { DraggableAttributes } from "@dnd-kit/core"
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities"
import { Copy, Eye, EyeOff, GripVertical, Trash2 } from "lucide-react"
import { Button } from "@shared/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { HomePageSection } from "@/lib/home-page-service"

type HomeBuilderSectionToolbarProps = {
  section: HomePageSection
  title: string
  icon: ReactNode
  controls?: ReactNode
  onVisibilityChange: (visible: boolean) => void
  onDuplicate: () => void
  onRemove: () => void
  attributes: DraggableAttributes
  listeners: SyntheticListenerMap | undefined
}

export function HomeBuilderSectionToolbar({
  section,
  title,
  icon,
  controls,
  onVisibilityChange,
  onDuplicate,
  onRemove,
  attributes,
  listeners,
}: HomeBuilderSectionToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border/50 bg-background/90 px-4 py-3 text-foreground backdrop-blur">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground"
        {...attributes}
        {...listeners}
        aria-label={`${title} 섹션 순서 이동`}
      >
        <GripVertical className="h-4 w-4" />
      </Button>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{title}</div>
        </div>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {controls}
        <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3">
          {section.visible ? (
            <Eye className="h-4 w-4 text-muted-foreground" />
          ) : (
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground">{section.visible ? "노출" : "숨김"}</span>
          <Switch
            checked={section.visible}
            onCheckedChange={onVisibilityChange}
            aria-label="섹션 노출 설정"
          />
        </div>
        <IconButton label="섹션 복제" onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
        </IconButton>
        <IconButton label="섹션 삭제" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  )
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={onClick}
      className="h-8 w-8 text-muted-foreground"
    >
      {children}
    </Button>
  )
}
