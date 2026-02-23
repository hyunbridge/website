"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PostList } from "@/components/blog/post-list"
import { BlogCardListSkeleton } from "@/components/loading/blog-card-skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Plus, Loader2, AlertCircle, RefreshCw } from "lucide-react"
import { getPosts, createPost, type Post } from "@/lib/blog-service"
import { useAuth } from "@/contexts/auth-context"
import Chance from "chance"

const chance = new Chance()

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
      setErrorMessage(err instanceof Error ? err.message : "Failed to load posts. Please try again.")
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
      const formattedDate = now.toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
      const formattedTime = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })

      // Generate random slug (2 random words + random number)
      const randomWord1 = chance.word({ length: chance.integer({ min: 1, max: 7 }) })
      const randomWord2 = chance.word({ length: chance.integer({ min: 1, max: 7 }) })
      const randomNum = chance.integer({ min: 10, max: 99 })

      // Create draft post
      const draftData = {
        title: `Untitled Draft - ${formattedDate}, ${formattedTime}`,
        slug: `${randomWord1}-${randomWord2}-${randomNum}`,
        content: "[]",
        author_id: user.id,
        summary: "",
        cover_image: null,
        is_published: false,
        published_at: null,
        enable_comments: true,
      }

      const newPost = await createPost(draftData, [])
      router.push(`/admin/blog/edit/${newPost.id}?isNew=true`)
    } catch (error) {
      console.error("Error creating draft post:", error)
      setError(error instanceof Error ? error : new Error(String(error)))
      setErrorMessage(error instanceof Error ? error.message : "Failed to create new post. Please try again.")
    } finally {
      setIsCreatingDraft(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Posts</h1>
        <Button onClick={handleCreateNewPost} disabled={isCreatingDraft}>
          {isCreatingDraft ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              New Post
            </>
          )}
        </Button>
      </div>

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
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <AdminPostListSkeleton />
      ) : !error ? (
        <PostList initialPosts={posts} isAdmin />
      ) : null}
    </div>
  )
}

function AdminPostListSkeleton() {
  return <BlogCardListSkeleton count={3} />
}
