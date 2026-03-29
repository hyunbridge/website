"use client"

import { useState } from "react"
import { useRouter } from "@/lib/app-router"
import { deletePost } from "@/lib/blog-service"
import { Button } from "@shared/components/ui/button"
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

      await deletePost(postId)

      setIsDeleteDialogOpen(false)

      // Redirect to the admin page after successful deletion
      router.push("/blog")
      router.refresh()
    } catch (error) {
      console.error("Error deleting post:", error)
      alert("게시글을 삭제하지 못했습니다. 다시 시도해주세요.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setIsDeleteDialogOpen(true)}>
        <Trash2 className="h-4 w-4 mr-2" />
        게시글 삭제
      </Button>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              게시글 &quot;{postTitle}&quot;과 연결된 이미지를 모두 영구 삭제합니다. 이 작업은
              되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeletePost()
              }}
              className="bg-destructive text-destructive-foreground"
              disabled={isDeleting}
            >
              {isDeleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
