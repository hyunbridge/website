"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { deletePost } from "@/lib/blog-service"
import { deleteFromS3 } from "@/lib/s3-service"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface DeletePostButtonProps {
  postId: string
  postTitle: string
}

export function DeletePostButton({ postId, postTitle }: DeletePostButtonProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDeletePost = async () => {
    if (!postId) return

    try {
      setIsDeleting(true)

      // Delete the post and get any associated image URLs
      const imageUrls = await deletePost(postId)

      // In a production environment, also delete the images from S3
      if (imageUrls.length > 0) {
        try {
          await deleteFromS3(imageUrls)
        } catch (error) {
          console.error("Error deleting images from S3:", error)
          // Continue even if image deletion fails
        }
      }

      setIsDeleteDialogOpen(false)

      // Redirect to the admin page after successful deletion
      router.push("/admin/blog/posts")
      router.refresh()
    } catch (error) {
      console.error("Error deleting post:", error)
      alert("Failed to delete post. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
        <Trash2 className="h-4 w-4 mr-2" />
        Delete Post
      </Button>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the post &quot;{postTitle}&quot; and all associated images. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeletePost()
              }}
              className="bg-destructive text-destructive-foreground"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
