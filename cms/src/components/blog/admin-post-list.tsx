"use client"

import { useEffect, useState } from "react"
import { useInView } from "react-intersection-observer"
import { type Post, getPosts, getPostsByTagId } from "@/lib/blog-service"
import { PostCard } from "./post-card"
import { BlogCardSkeleton } from "@shared/components/loading/blog-card-skeleton"
import { FileSearch, RefreshCw } from "lucide-react"
import { Button } from "@shared/components/ui/button"
import { StatePanel } from "@shared/components/ui/state-panel"

type AdminPostListProps = {
  initialPosts: Post[]
  pageSize?: number
  tagId?: string
}

export function AdminPostList({ initialPosts, pageSize = 10, tagId }: AdminPostListProps) {
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
          const newPosts = tagId
            ? (await getPostsByTagId(tagId, nextPage, pageSize, false)).posts
            : await getPosts(nextPage, pageSize, false)

          if (newPosts.length > 0) {
            setPosts((prev) => [...prev, ...newPosts])
            setPage(nextPage)
          }

          if (newPosts.length < pageSize) {
            setHasMore(false)
          }
        } catch (error) {
          console.error("Error loading more admin posts:", error)
          setLoadMoreError(
            error instanceof Error ? error.message : "게시글을 더 불러오지 못했습니다.",
          )
        } finally {
          setIsLoading(false)
        }
      }
    }

    loadMorePosts()
  }, [inView, hasMore, page, isLoading, pageSize, tagId])

  if (posts.length === 0 && !isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <StatePanel
          className="max-w-lg"
          size="compact"
          icon={<FileSearch className="h-5 w-5" />}
          title="게시글이 없습니다"
          description="첫 블로그 글을 작성해보세요."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {posts.map((post, index) => (
          <PostCard key={post.id} post={post} isAdmin index={index} />
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
