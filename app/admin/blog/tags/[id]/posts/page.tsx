import { notFound } from "next/navigation"
import { Suspense } from "react"
import { getPostsByTagId } from "@/lib/blog-service"
import { PostList } from "@/components/blog/post-list"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import Link from "next/link"

export default async function AdminTagPostsPage({ params }: { params: { id: string } }) {
  try {
    const tagId = params.id
    // Modified function call order: tagId, page, pageSize, onlyPublished
    const { posts, tag } = await getPostsByTagId(tagId, 1, 10, false)

    return (
      <div>
        <div className="flex flex-col mb-8">
          <h1 className="text-3xl font-bold">Posts tagged with "{tag.name}"</h1>
          <Link href="/admin/blog/tags" className="text-sm text-muted-foreground hover:underline mt-2">
            ← Back to all tags
          </Link>
        </div>

        <Suspense fallback={<LoadingSkeleton />}>
          <PostList initialPosts={posts} isAdmin />
        </Suspense>
      </div>
    )
  } catch (error) {
    console.error("Error fetching posts by tag ID:", error)
    notFound()
  }
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
