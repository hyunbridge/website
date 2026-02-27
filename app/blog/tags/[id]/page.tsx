import { notFound } from "next/navigation"
import { Suspense } from "react"
import { getPostsByTagId } from "@/lib/blog-service"
import { PostList } from "@/components/blog/post-list"
import { BlogCardListSkeleton } from "@/components/loading/blog-card-skeleton"
import Link from "next/link"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { tag } = await getPostsByTagId(id, 1, 1, true)

    return {
      title: `${tag.name} | Blog Tags | Hyungyo Seo`,
      description: `Browse blog posts tagged with ${tag.name}`,
    }
  } catch {
    return {
      title: "Tag | Blog Tags | Hyungyo Seo",
      description: "Browse blog posts by tag",
    }
  }
}

export default async function TagPostsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let tag: Awaited<ReturnType<typeof getPostsByTagId>>["tag"]

  try {
    ;({ tag } = await getPostsByTagId(id, 1, 1, true))
  } catch (error) {
    console.error("Error fetching posts by tag:", error)
    notFound()
  }

  return (
    <div className="container py-8 md:py-12">
      <div className="mb-8">
        <Link href="/blog/tags" className="text-sm text-muted-foreground hover:underline">
          ← Back to all tags
        </Link>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold mb-8">
        Posts tagged with &quot;{tag.name}&quot;
      </h1>

      <Suspense fallback={<LoadingSkeleton />}>
        <TagPostsListWrapper tagId={id} />
      </Suspense>
    </div>
  )
}

async function TagPostsListWrapper({ tagId }: { tagId: string }) {
  const { posts } = await getPostsByTagId(tagId, 1, 10, true)
  return <PostList initialPosts={posts} />
}

function LoadingSkeleton() {
  return <BlogCardListSkeleton count={3} />
}
