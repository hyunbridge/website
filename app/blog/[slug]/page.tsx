import { notFound } from "next/navigation"
import { getPostBySlug, getPublishedVersionSnapshot } from "@/lib/blog-service"
import { SeamlessPostView } from "@/components/blog/seamless-post-view"
import type { Metadata } from "next"

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { slug } = await params
    const post = await getPostBySlug(slug)
    if (!post) {
      return { title: "Post Not Found" }
    }

    let metaTitle = post.title
    let metaDescription = post.summary || post.title
    if (post.is_published && post.published_version_id) {
      try {
        const publishedSnapshot = await getPublishedVersionSnapshot(post.published_version_id)
        metaTitle = publishedSnapshot.title || metaTitle
        metaDescription = publishedSnapshot.summary || publishedSnapshot.title || metaDescription
      } catch {
        // Fallback to posts row metadata if snapshot lookup fails
      }
    }

    return {
      title: `${metaTitle} | Hyungyo Seo`,
      description: metaDescription,
      openGraph: {
        title: metaTitle,
        description: metaDescription,
        ...(post.cover_image ? { images: [post.cover_image] } : {}),
      },
    }
  } catch {
    return { title: "Post Not Found" }
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  let post
  try {
    post = await getPostBySlug(slug)
  } catch {
    notFound()
  }

  if (!post) {
    notFound()
  }

  return <SeamlessPostView post={post} mode="view" />
}
