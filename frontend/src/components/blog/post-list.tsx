"use client"

import { useState, useEffect } from "react"
import { useInView } from "react-intersection-observer"
import { type Post } from "@/lib/blog-service"
import { PostCard } from "@/components/blog/post-card"
import { BlogCardSkeleton } from "@shared/components/loading/blog-card-skeleton"
import { FileSearch, RefreshCw } from "lucide-react"
import { Button } from "@shared/components/ui/button"
import { StatePanel } from "@shared/components/ui/state-panel"

interface PostListProps {
  initialPosts: Post[]
  nextPageBasePath: string
  pageSize?: number
}

export function PostList({ initialPosts, nextPageBasePath, pageSize = 10 }: PostListProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [page, setPage] = useState<number>(1)
  const [hasMore, setHasMore] = useState<boolean>(initialPosts.length === pageSize)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "100px",
  })

  useEffect(() => {
    async function loadMorePosts() {
      if (inView && hasMore && !isLoading) {
        setIsLoading(true)
        setLoadMoreError(null)

        try {
          const nextPage = page + 1
          const response = await fetch(
            `${nextPageBasePath}${nextPageBasePath.includes("?") ? "&" : "?"}page=${nextPage}&pageSize=${pageSize}`,
            {
              cache: "no-store",
            },
          )

          if (!response.ok) {
            throw new Error(`Failed to fetch more posts: ${response.status}`)
          }

          const newPosts = (await response.json()) as Post[]

          if (newPosts.length > 0) {
            setPosts((prev) => [...prev, ...newPosts])
            setPage(nextPage)
          }

          if (newPosts.length < pageSize) {
            setHasMore(false)
          }
        } catch (error) {
          console.error("Error loading more posts:", error)
          setLoadMoreError(
            error instanceof Error ? error.message : "게시글을 더 불러오지 못했습니다.",
          )
        } finally {
          setIsLoading(false)
        }
      }
    }

    loadMorePosts()
  }, [inView, hasMore, page, isLoading, nextPageBasePath, pageSize])

  if (posts.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <StatePanel
          className="max-w-lg"
          size="compact"
          icon={<FileSearch className="h-5 w-5" />}
          title="게시글이 없습니다"
          description="새 글이 올라오면 여기에서 확인할 수 있습니다."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {posts.map((post, index) => (
          <PostCard key={post.id} post={post} index={index} />
        ))}
      </div>

      {hasMore ? (
        loadMoreError ? (
          <div className="py-4">
            <StatePanel
              size="compact"
              title="게시글을 더 불러오지 못했습니다"
              description={loadMoreError}
              actions={
                <Button variant="outline" size="sm" onClick={() => setLoadMoreError(null)}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  다시 시도
                </Button>
              }
            />
          </div>
        ) : (
          <div ref={ref} className="py-4">
            <LoadingSkeleton />
          </div>
        )
      ) : null}
    </div>
  )
}

function LoadingSkeleton() {
  return <BlogCardSkeleton />
}
