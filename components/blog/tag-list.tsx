"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Pencil, Trash2 } from "lucide-react"
import { updateTag, deleteTag, type Tag } from "@/lib/blog-service"
import { toast } from "@/hooks/use-toast"

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
  onTagSelect 
}: TagListProps) {
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [tagName, setTagName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
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
      router.push(`/admin/blog/tags/${tag.id}/posts`)
    } else {
      router.push(`/blog/tags/${tag.id}`)
    }
  }

  const handleUpdateTag = async () => {
    if (!editingTag || !tagName.trim()) return

    try {
      setIsSubmitting(true)
      await updateTag(editingTag.id, tagName)
      toast({
        title: "Tag updated",
        description: "The tag has been updated successfully.",
      })
      setEditingTag(null)
      onTagsChange?.()
    } catch (error) {
      console.error("Error updating tag:", error)
      toast({
        title: "Error",
        description: "Failed to update tag. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteTag = async () => {
    if (!editingTag) return

    try {
      setIsDeleting(true)
      await deleteTag(editingTag.id)
      toast({
        title: "Tag deleted",
        description: "The tag has been deleted successfully.",
      })
      setEditingTag(null)
      onTagsChange?.()
    } catch (error) {
      console.error("Error deleting tag:", error)
      toast({
        title: "Error",
        description: "Failed to delete tag. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
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
                <span className="sr-only">Edit tag</span>
              </Button>
            )}
          </Badge>
        ))}
        {tags?.length === 0 && (
          <p className="text-muted-foreground">No tags available.</p>
        )}
      </div>

      <Dialog open={!!editingTag} onOpenChange={(open) => !open && setEditingTag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Tag Name</Label>
              <Input
                id="tag-name"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="Enter tag name"
              />
            </div>
          </div>
          <DialogFooter className="flex items-center justify-between mt-6">
            <Button 
              variant="destructive" 
              onClick={handleDeleteTag}
              disabled={isSubmitting}
            >
              Delete
            </Button>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingTag(null)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTag} disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
