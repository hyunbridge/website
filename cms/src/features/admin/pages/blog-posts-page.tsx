"use client"

import { useState, useEffect } from "react"
import { useRouter } from "@/lib/app-router"
import { Button } from "@shared/components/ui/button"
import { AdminPostList } from "@/components/blog/admin-post-list"
import { BlogCardListSkeleton } from "@shared/components/loading/blog-card-skeleton"
import { Alert, AlertDescription } from "@shared/components/ui/alert"
import { Plus, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { getPosts, createPost, type Post } from "@/lib/blog-service"
import { useAuth } from "@/contexts/auth-context"
import { motion } from "framer-motion"
import { buildDraftSlug } from "@/lib/slug"

export default function BlogPostsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [errorMessage, setErrorMessage] = useState("")

  const fetchPosts = async () => {
    setIsLoading(true)
    setError(null)
    setErrorMessage("")

    try {
      const allPosts = await getPosts(1, 10, false)
      setPosts(allPosts)
    } catch (err) {
      console.error("Error fetching posts:", err)
      setError(err instanceof Error ? err : new Error(String(err)))
      setErrorMessage(
        err instanceof Error ? err.message : "게시글을 불러오지 못했습니다. 다시 시도해주세요.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPosts()
  }, [])

  const handleCreateNewPost = async () => {
    if (!user) return

    setIsCreatingDraft(true)
    try {
      // Format current date and time
      const now = new Date()
      const formattedDate = now.toLocaleDateString("ko-KR")
      const formattedTime = now.toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      })

      // Create draft post
      const draftTitle = `제목 없는 초안 - ${formattedDate} ${formattedTime}`
      const draftData = {
        title: draftTitle,
        slug: buildDraftSlug(draftTitle, "untitled"),
        content: "",
        summary: "",
        cover_image: null,
        enable_comments: true,
      }

      const newPost = await createPost(draftData, [])
      router.push(`/blog/edit/${newPost.id}?isNew=true`)
    } catch (error) {
      console.error("Error creating draft post:", error)
      setError(error instanceof Error ? error : new Error(String(error)))
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "새 게시글을 만들지 못했습니다. 다시 시도해주세요.",
      )
    } finally {
      setIsCreatingDraft(false)
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <h1 className="text-3xl font-bold">게시글</h1>
        <Button onClick={handleCreateNewPost} disabled={isCreatingDraft}>
          {isCreatingDraft ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              생성 중...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />새 게시글
            </>
          )}
        </Button>
      </motion.div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {errorMessage}
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={fetchPosts}
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              다시 시도
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <AdminPostListSkeleton />
      ) : !error ? (
        <AdminPostList initialPosts={posts} />
      ) : null}
    </div>
  )
}

function AdminPostListSkeleton() {
  return <BlogCardListSkeleton count={3} />
}
