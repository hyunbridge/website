"use client"

import { useState, useEffect } from "react"
import { useInView } from "react-intersection-observer"
import { type Post, getPosts } from "@/lib/blog-service"
import { PostCard } from "./post-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

interface PostListProps {
  initialPosts: Post[]
  isAdmin?: boolean
}

export function PostList({ initialPosts, isAdmin = false }: PostListProps) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [page, setPage] = useState<number>(1)
  const [hasMore, setHasMore] = useState<boolean>(initialPosts.length === 10)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: "100px",
  })

  useEffect(() => {
    async function loadMorePosts() {
      if (inView && hasMore && !isLoading) {
        setIsLoading(true)

        try {
          const nextPage = page + 1
          const newPosts = await getPosts(nextPage, 10, !isAdmin)

          if (newPosts.length > 0) {
            setPosts((prev) => [...prev, ...newPosts])
            setPage(nextPage)
          }

          if (newPosts.length < 10) {
            setHasMore(false)
          }
        } catch (error) {
          console.error("Error loading more posts:", error)
        } finally {
          setIsLoading(false)
        }
      }
    }

    loadMorePosts()
  }, [inView, hasMore, page, isLoading, isAdmin])

  if (posts.length === 0 && !isLoading) {
    return (
      <div className="text-center py-12">
        <h3 className="text-xl font-medium mb-2">No posts found</h3>
        <p className="text-muted-foreground">
          {isAdmin ? "Create your first blog post to get started." : "Check back later for new content."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} isAdmin={isAdmin} />
        ))}
      </div>

      {hasMore && (
        <div ref={ref} className="py-4">
          <LoadingSkeleton />
        </div>
      )}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <Card className="w-full">
      <div className="h-48 w-full">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="p-4 space-y-4">
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
      </div>
    </Card>
  )
}
