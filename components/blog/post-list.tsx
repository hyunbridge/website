"use client"

import { useState, useEffect } from "react"
import { useInView } from "react-intersection-observer"
import { type Post, getPosts } from "@/lib/blog-service"
import { PostCard } from "./post-card"
import { BlogCardSkeleton } from "@/components/loading/blog-card-skeleton"
import { FileSearch } from "lucide-react"
import { StatePanel } from "@/components/ui/state-panel"

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
      <div className="flex items-center justify-center py-12">
        <StatePanel
          className="max-w-lg"
          size="compact"
          icon={<FileSearch className="h-5 w-5" />}
          title="No posts found"
          description={isAdmin ? "Create your first blog post to get started." : "Check back later for new content."}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {posts.map((post, index) => (
          <PostCard key={post.id} post={post} isAdmin={isAdmin} index={index} />
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
  return <BlogCardSkeleton />
}
