import { Suspense } from "react"
import { getPosts } from "@/lib/blog-service"
import { PostList } from "@/components/blog/post-list"
import { Skeleton } from "@/components/ui/skeleton"
import { Card } from "@/components/ui/card"

export const metadata = {
  title: "Blog | Hyungyo Seo",
  description: "Read my latest blog posts about web development, technology, and more.",
}

export default async function BlogPage() {
  const posts = await getPosts(1, 10, true)

  return (
    <div className="container py-8 md:py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">Blog</h1>
      <Suspense fallback={<LoadingSkeleton />}>
        <PostList initialPosts={posts} />
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
