import { notFound } from "next/navigation"
import { Suspense } from "react"
import { getPostsByTagId } from "@/lib/blog-service"
import { PostList } from "@/components/blog/post-list"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"
import Link from "next/link"

export async function generateMetadata({ params }: { params: { id: string } }) {
  try {
    const { tag } = await getPostsByTagId(params.id, 1, 1, true)

    return {
      title: `${tag.name} | Blog Tags | Hyungyo Seo`,
      description: `Browse blog posts tagged with ${tag.name}`,
    }
  } catch (error) {
    return {
      title: "Tag | Blog Tags | Hyungyo Seo",
      description: "Browse blog posts by tag",
    }
  }
}

export default async function TagPostsPage({ params }: { params: { id: string } }) {
  try {
    const { tag, posts } = await getPostsByTagId(params.id, 1, 10, true)

    return (
      <div className="container py-8 md:py-12">
        <div className="mb-8">
          <Link href="/blog/tags" className="text-sm text-muted-foreground hover:underline">
            ← Back to all tags
          </Link>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold mb-8">Posts tagged with "{tag.name}"</h1>

        <Suspense fallback={<LoadingSkeleton />}>
          <PostList initialPosts={posts} />
        </Suspense>
      </div>
    )
  } catch (error) {
    console.error("Error fetching posts by tag:", error)
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
