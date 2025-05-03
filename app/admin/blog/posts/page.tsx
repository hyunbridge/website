"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { PostList } from "@/components/blog/post-list"
import { Plus, Loader2 } from "lucide-react"
import { getPosts, createPost } from "@/lib/blog-service"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/auth-context"
import Chance from "chance"

const chance = new Chance()

export default function BlogPostsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [posts, setPosts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchPosts() {
      setIsLoading(true)
      try {
        const allPosts = await getPosts(1, 10, false)
        setPosts(allPosts)
      } catch (err) {
        console.error("Error fetching posts:", err)
        setError(err)
      } finally {
        setIsLoading(false)
      }
    }

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
        content: "",
        author_id: user.id,
        summary: "",
        cover_image: null,
        is_published: false,
        enable_comments: true,
      }

      const newPost = await createPost(draftData, [])
      router.push(`/admin/blog/edit/${newPost.id}?isNew=true`)
    } catch (error) {
      console.error("Error creating draft post:", error)
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

      {isLoading ? (
        <AdminPostListSkeleton />
      ) : error ? (
        <div className="p-4 border border-destructive text-destructive rounded-md">
          <p>Error loading posts. Please try again later.</p>
        </div>
      ) : (
        <PostList initialPosts={posts} isAdmin />
      )}
    </div>
  )
}

function AdminPostListSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="w-full">
          <div className="h-48 w-full">
            <Skeleton className="h-full w-full" />
          </div>
          <CardContent className="p-4 space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="flex justify-between">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
