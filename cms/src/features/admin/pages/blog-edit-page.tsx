"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "@/lib/app-router"
import { useAuth } from "@/contexts/auth-context"
import { getPostById } from "@/lib/blog-service"
import { readAdminContentLoadError } from "@/lib/admin-content-errors"
import { PostEditorView } from "@/components/blog/post-editor-view"
import type { Post } from "@/lib/blog-service"
import { Skeleton } from "@shared/components/ui/skeleton"
import { AlertTriangle, ArrowLeft } from "lucide-react"
import Link from "@/components/ui/app-link"
import { Button } from "@shared/components/ui/button"
import { StatePanel } from "@shared/components/ui/state-panel"

export default function EditPostPage() {
  const { id = "" } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.replace("/login")
      return
    }

    async function fetchPost() {
      try {
        const data = await getPostById(id)
        setPost(data)
      } catch (error) {
        setError(readAdminContentLoadError("게시글", error))
      } finally {
        setLoading(false)
      }
    }
    fetchPost()
  }, [id, user, authLoading, router])

  if (error) {
    return (
      <div className="container flex items-center justify-center py-8 md:py-12">
        <StatePanel
          className="max-w-lg"
          tone="danger"
          size="compact"
          icon={<AlertTriangle className="h-5 w-5" />}
          title="게시글을 열 수 없습니다"
          description={error}
          actions={
            <Button variant="outline" asChild>
              <Link href="/blog" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                게시글 목록으로 돌아가기
              </Link>
            </Button>
          }
        />
      </div>
    )
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

  return <PostEditorView post={post} mode="edit" />
}
