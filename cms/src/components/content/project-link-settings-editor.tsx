import { Plus, Trash2 } from "lucide-react"

import { Button } from "@shared/components/ui/button"
import { Input } from "@shared/components/ui/input"
import { Label } from "@shared/components/ui/label"

type ProjectLinkDraft = {
  id?: string
  label: string
  url: string
}

type ProjectLinkSettingsEditorProps = {
  links: ProjectLinkDraft[]
  newLinkLabel: string
  newLinkUrl: string
  onNewLinkLabelChange: (value: string) => void
  onNewLinkUrlChange: (value: string) => void
  onAddLink: () => void
  onRemoveLink: (index: number) => void
}

export function ProjectLinkSettingsEditor({
  links,
  newLinkLabel,
  newLinkUrl,
  onNewLinkLabelChange,
  onNewLinkUrlChange,
  onAddLink,
  onRemoveLink,
}: ProjectLinkSettingsEditorProps) {
  return (
    <div className="space-y-2 border-t pt-3">
      <Label className="text-xs">링크</Label>
      <div className="space-y-2">
        {links.length === 0 && (
          <p className="text-xs text-muted-foreground">아직 추가된 링크가 없습니다</p>
        )}
        {links.map((link, index) => (
          <div key={link.id || `${link.url}-${index}`} className="flex items-center gap-2">
            <div className="min-w-0 flex-1 rounded-md border px-2 py-1.5">
              <p className="truncate text-xs font-medium">{link.label || "제목 없는 링크"}</p>
              <p className="truncate text-[11px] text-muted-foreground">{link.url}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onRemoveLink(index)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div className="space-y-2 rounded-md border p-2">
        <Input
          value={newLinkLabel}
          onChange={(event) => onNewLinkLabelChange(event.target.value)}
          placeholder="라벨 (예: GitHub)"
          className="h-8 text-sm"
        />
        <div className="flex gap-2">
          <Input
            value={newLinkUrl}
            onChange={(event) => onNewLinkUrlChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onAddLink()}
            placeholder="https://..."
            className="h-8 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddLink}
            className="h-8"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
