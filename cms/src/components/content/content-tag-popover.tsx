import { Plus, Tag as TagIcon, X } from "lucide-react"

import { Badge } from "@shared/components/ui/badge"
import { Button } from "@shared/components/ui/button"
import { Input } from "@shared/components/ui/input"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type ContentTag = {
  id: string
  name: string
  slug: string
}

type ContentTagPopoverProps = {
  selectedTags: ContentTag[]
  availableTags: ContentTag[]
  newTagName: string
  onNewTagNameChange: (value: string) => void
  onAddTag: (tag: ContentTag) => void | Promise<void>
  onRemoveTag: (tagId: string) => void | Promise<void>
  onCreateTag: () => void | Promise<void>
}

export function ContentTagPopover({
  selectedTags,
  availableTags,
  newTagName,
  onNewTagNameChange,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: ContentTagPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-xs">
          <TagIcon className="mr-1 h-3.5 w-3.5" />
          태그
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {selectedTags.map((tag) => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="cursor-pointer gap-1"
                onClick={() => onRemoveTag(tag.id)}
              >
                {tag.name}
                <X className="h-3 w-3" />
              </Badge>
            ))}
          </div>
          <div className="space-y-2 border-t pt-2">
            {availableTags.map((tag) => (
              <button
                key={tag.id}
                onClick={() => onAddTag(tag)}
                className="block w-full rounded px-2 py-1 text-left text-sm transition-colors hover:bg-muted"
              >
                {tag.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2 border-t pt-2">
            <Input
              placeholder="새 태그…"
              value={newTagName}
              onChange={(event) => onNewTagNameChange(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && onCreateTag()}
              className="h-8 text-sm"
            />
            <Button size="sm" variant="outline" onClick={onCreateTag} className="h-8">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
