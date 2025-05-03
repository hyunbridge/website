"use client"

import { useState, useEffect, useRef } from "react"
import { notFound, useRouter } from "next/navigation"
import { format } from "date-fns"
import { getPostBySlug } from "@/lib/blog-service"
import { Comments } from "@/components/blog/comments"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, ChevronDown } from "lucide-react"
import Link from "next/link"
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion"

// Import TiptapEditor
import { TiptapEditor } from "@/components/blog/tiptap-editor"

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const [post, setPost] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [hasScrolled, setHasScrolled] = useState(false)
  const router = useRouter()
  const containerRef = useRef(null)
  const contentRef = useRef(null)

  // Scroll animation values
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  })

  // Transform values based on scroll position
  const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.15])
  const imageBlur = useTransform(scrollYProgress, [0, 0.4], [0, 12])
  const gradientOpacity = useTransform(scrollYProgress, [0, 0.25], [0, 0.95])
  const scrollArrowOpacity = useTransform(scrollYProgress, [0, 0.1], [1, 0])

  useEffect(() => {
    async function fetchPost() {
      try {
        setIsLoading(true)
        const postData = await getPostBySlug(params.slug)

        // If the post is not published, return 404
        if (!postData.is_published) {
          return notFound()
        }

        setPost(postData)
      } catch (err) {
        console.error("Error fetching post:", err)
        setError(err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchPost()
  }, [params.slug])

  useEffect(() => {
    // Add scroll listener to detect when user has scrolled
    const handleScroll = () => {
      if (window.scrollY > 50 && !hasScrolled) {
        setHasScrolled(true)
      } else if (window.scrollY <= 50 && hasScrolled) {
        setHasScrolled(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [hasScrolled])

  const handleScrollDown = () => {
    if (contentRef.current) {
      const cardTop = contentRef.current.getBoundingClientRect().top + window.scrollY

      // Scroll to the card with smooth animation
      window.scrollTo({
        top: cardTop,
        behavior: "smooth",
      })
    }
  }

  if (error) {
    return (
      <div className="container py-8 md:py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load blog post. Please try again later or contact the administrator.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Link href="/blog" className="text-sm text-muted-foreground hover:underline">
            ← Back to all posts
          </Link>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return <BlogPostSkeleton />
  }

  if (!post) {
    notFound()
  }

  const publishedDate = post.published_at ? new Date(post.published_at) : new Date(post.created_at)
  const formattedDate = format(publishedDate, "MMMM d, yyyy")

  return (
    <div className="relative min-h-screen" ref={containerRef}>
      {/* Cover Image with parallax effect */}
      <div className="fixed top-0 left-0 w-full h-[100vh] z-0 overflow-hidden">
        <motion.div
          className="w-full h-full"
          style={{
            scale: imageScale,
          }}
        >
          <motion.img
            src={post.cover_image || "/placeholder.svg?height=600&width=1200&text=Blog+Post"}
            alt={post.title}
            className="w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{
              filter: `blur(${imageBlur.get()}px)`,
            }}
          />
          <motion.div
            className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background"
            style={{
              opacity: gradientOpacity,
            }}
          />
        </motion.div>
      </div>

      {/* Content Card - Scrolls over the image */}
      <div className="relative min-h-screen pt-[70vh]">
        {/* Scroll indicator arrow */}
        <AnimatePresence>
          {!hasScrolled && (
            <motion.div
              className="absolute top-[calc(70vh-48px)] left-1/2 transform -translate-x-1/2 z-20"
              initial={{ opacity: 1, y: 0 }}
              animate={{
                opacity: scrollArrowOpacity,
                y: [0, 10, 0],
              }}
              exit={{ opacity: 0, y: 20 }}
              transition={{
                opacity: { duration: 0.3 },
                y: { repeat: Number.POSITIVE_INFINITY, duration: 1.5, ease: "easeInOut" },
              }}
              onClick={handleScrollDown}
            >
              <div className="bg-background/80 backdrop-blur-sm p-3 rounded-full shadow-lg border border-border/50 cursor-pointer hover:bg-background/90 transition-colors">
                <ChevronDown className="h-6 w-6 text-foreground" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          ref={contentRef}
          className="bg-card w-full rounded-t-3xl shadow-2xl overflow-hidden border border-border z-10 relative"
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{
            boxShadow: "0 -10px 50px rgba(0, 0, 0, 0.15)",
          }}
        >
          <div className="p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
              <div className="mb-8">
                <Link href="/blog" className="text-sm text-muted-foreground hover:underline">
                  ← Back to all posts
                </Link>
              </div>

              <h1 className="text-3xl md:text-5xl font-bold mb-4">{post.title}</h1>

              <div className="flex flex-wrap items-center gap-4 mb-8">
                <div className="flex items-center gap-2">
                  {post.author?.avatar_url ? (
                    <img
                      src={post.author.avatar_url || "/placeholder.svg"}
                      alt={post.author.full_name || post.author.username}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      {(post.author?.full_name || post.author?.username || "A")[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm">{post.author?.full_name || post.author?.username || "Anonymous"}</span>
                </div>

                <span className="text-sm text-muted-foreground">{formattedDate}</span>

                {post.tags && post.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <Link key={tag.id} href={`/blog/tags/${tag.id}`}>
                        <Badge variant="secondary" className="hover:bg-secondary/80 transition-colors">
                          {tag.name}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Use TiptapEditor in read-only mode */}
              <div className="prose dark:prose-invert max-w-none">
                {post.content && <TiptapEditor content={post.content} onChange={() => {}} readOnly />}
              </div>

              {post.enable_comments && <Comments slug={post.slug} />}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

function BlogPostSkeleton() {
  return (
    <div className="w-full min-h-screen">
      {/* Fixed background skeleton */}
      <div className="fixed top-0 left-0 w-full h-[100vh] z-0">
        <Skeleton className="w-full h-full rounded-none" />
      </div>

      {/* Content skeleton */}
      <div className="relative min-h-screen pt-[70vh]">
        <div className="bg-card w-full rounded-t-3xl shadow-2xl overflow-hidden">
          <div className="p-6 md:p-8 max-w-4xl mx-auto">
            <Skeleton className="h-6 w-32 mb-8" />
            <Skeleton className="h-12 w-3/4 mb-4" />
            <Skeleton className="h-12 w-1/2 mb-8" />

            <div className="flex flex-wrap items-center gap-4 mb-8">
              <div className="flex items-center gap-2">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>

              <Skeleton className="h-4 w-32" />

              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-16 rounded-full" />
              </div>
            </div>

            <div className="space-y-4">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-5/6" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
