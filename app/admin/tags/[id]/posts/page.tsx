import { notFound } from "next/navigation"
import { Suspense } from "react"
import { getPostsByTagId } from "@/lib/blog-service"
import { PostList } from "@/components/blog/post-list"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import { BackLink } from "@/components/ui/back-link"

export default async function AdminTagPostsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tagId } = await params

  let posts: Awaited<ReturnType<typeof getPostsByTagId>>["posts"]
  let tag: Awaited<ReturnType<typeof getPostsByTagId>>["tag"]

  try {
    ;({ posts, tag } = await getPostsByTagId(tagId, 1, 10, false))
  } catch (error) {
    console.error("Error fetching posts by tag ID:", error)
    notFound()
  }

  return (
    <div>
      <div className="mb-8">
        <BackLink href="/admin/tags">Back to all tags</BackLink>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold mb-8">
        Posts tagged with &quot;{tag.name}&quot;
      </h1>

      <Suspense fallback={<LoadingSkeleton />}>
        <PostList initialPosts={posts} isAdmin />
      </Suspense>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="w-full">
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
      ))}
    </div>
  )
}
