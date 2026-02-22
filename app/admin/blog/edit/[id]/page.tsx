"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getPostById } from "@/lib/blog-service"
import { SeamlessPostView } from "@/components/blog/seamless-post-view"
import type { Post } from "@/lib/blog-service"
import { Skeleton } from "@/components/ui/skeleton"

export default function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.replace("/")
      return
    }

    async function fetchPost() {
      try {
        const data = await getPostById(resolvedParams.id)
        if (data.author_id !== user!.id) {
          setError("You don't have permission to edit this post.")
          return
        }
        setPost(data)
      } catch {
        setError("Post not found")
      } finally {
        setLoading(false)
      }
    }
    fetchPost()
  }, [resolvedParams.id, user, authLoading, router])

  if (error) {
    return <div className="p-8 text-destructive">{error}</div>
  }

  if (loading || authLoading || !post) {
    return (
      <div className="container max-w-4xl mx-auto py-8 md:py-12">
        {/* Back link skeleton */}
        <div className="mb-6">
          <Skeleton className="h-4 w-32" />
        </div>
        {/* Toolbar skeleton */}
        <Skeleton className="h-12 w-full rounded-xl mb-6" />
        {/* Title skeleton */}
        <Skeleton className="h-10 w-3/4 mb-4" />
        {/* Meta skeleton */}
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        {/* Content skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/6" />
        </div>
      </div>
    )
  }

  return <SeamlessPostView post={post} mode="edit" />
}
