import { Suspense } from "react"
import { getPosts } from "@/lib/blog-service"
import { PostList } from "@/components/blog/post-list"
import { BlogCardListSkeleton } from "@/components/loading/blog-card-skeleton"

export const metadata = {
  title: "Blog | Hyungyo Seo",
  description: "Read my latest blog posts about web development, technology, and more.",
}

export const revalidate = 60 // 1 minute

export default async function BlogPage() {
  return (
    <div className="container py-8 md:py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">Blog</h1>
      <Suspense fallback={<LoadingSkeleton />}>
        <PostListWrapper />
      </Suspense>
    </div>
  )
}

async function PostListWrapper() {
  const posts = await getPosts(1, 10, true)
  return <PostList initialPosts={posts} />
}

function LoadingSkeleton() {
  return <BlogCardListSkeleton count={3} />
}
