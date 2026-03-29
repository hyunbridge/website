"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "@/lib/app-router"
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
import { Pencil, Tags } from "lucide-react"
import { updateTag, deleteTag, type Tag } from "@/lib/blog-service"
import { toast } from "@shared/hooks/use-toast"
import { StatePanel } from "@shared/components/ui/state-panel"

interface TagListProps {
  tags?: Tag[]
  isAdmin?: boolean
  onTagsChange?: () => void
  selectedTags?: string[]
  onTagSelect?: (tagId: string) => void
}

export function TagList({
  tags = [], // Add default empty array
  isAdmin = false,
  onTagsChange,
  selectedTags = [],
  onTagSelect,
}: TagListProps) {
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [tagName, setTagName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleEditClick = (tag: Tag, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTag(tag)
    setTagName(tag.name)
  }

  const handleTagClick = (tag: Tag) => {
    if (onTagSelect) {
      onTagSelect(tag.id)
    } else if (isAdmin) {
      router.push(`/tags/${tag.id}/posts`)
    }
  }

  const handleUpdateTag = async () => {
    if (!editingTag || !tagName.trim()) return

    try {
      setIsSubmitting(true)
      await updateTag(editingTag.id, tagName)
      toast({
        title: "태그를 수정했습니다",
        description: "태그가 성공적으로 수정되었습니다.",
      })
      setEditingTag(null)
      onTagsChange?.()
    } catch (error) {
      console.error("Error updating tag:", error)
      toast({
        title: "오류",
        description: "태그를 수정하지 못했습니다. 다시 시도해주세요.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTag = async () => {
    if (!editingTag) return

    try {
      await deleteTag(editingTag.id)
      toast({
        title: "태그를 삭제했습니다",
        description: "태그가 성공적으로 삭제되었습니다.",
      })
      setEditingTag(null)
      onTagsChange?.()
    } catch (error) {
      console.error("Error deleting tag:", error)
      toast({
        title: "오류",
        description: "태그를 삭제하지 못했습니다. 다시 시도해주세요.",
        variant: "destructive",
      })
    } finally {
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {tags?.map((tag) => (
          <Badge
            key={tag.id}
            variant={selectedTags.includes(tag.id) ? "default" : "outline"}
            className="cursor-pointer text-sm py-1.5 px-3 flex items-center gap-1.5"
            onClick={() => handleTagClick(tag)}
          >
            {tag.name}
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 p-0 ml-1 text-muted-foreground hover:text-foreground"
                onClick={(e) => handleEditClick(tag, e)}
              >
                <Pencil className="h-3 w-3" />
                <span className="sr-only">태그 수정</span>
              </Button>
            )}
          </Badge>
        ))}
        {tags?.length === 0 && (
          <StatePanel
            className="max-w-lg"
            size="compact"
            icon={<Tags className="h-5 w-5" />}
            title="태그가 없습니다"
            description={
              isAdmin
                ? "게시글에 태그를 추가하면 여기에 표시됩니다."
                : "게시글이 게시되면 새로운 태그가 여기에 표시됩니다."
            }
          />
        )}
      </div>

      <Dialog open={!!editingTag} onOpenChange={(open) => !open && setEditingTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>태그 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tag-name">태그 이름</Label>
              <Input
                id="tag-name"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="태그 이름 입력"
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between mt-6">
            <Button variant="destructive" onClick={handleDeleteTag} disabled={isSubmitting}>
              삭제
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingTag(null)}>
                취소
              </Button>
              <Button onClick={handleUpdateTag} disabled={isSubmitting}>
                {isSubmitting ? "저장 중..." : "변경사항 저장"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
