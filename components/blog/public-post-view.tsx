"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { format } from "date-fns"
import type { Post } from "@/lib/blog-service"
import { BlockNoteEditor } from "./blocknote-editor"
import { Comments } from "./comments"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { StatePanel } from "@/components/ui/state-panel"
import { GlobeLock } from "lucide-react"
import { motion } from "framer-motion"
import { MORPH_LAYOUT_TRANSITION } from "@/lib/motion"
import { useNavigationIntent } from "@/components/navigation-intent-provider"

type PublishedSnapshot = {
  title: string
  content: string
  summary?: string | null
} | null

function parseBlockNoteJson(content?: string | null) {
  if (!content) return undefined
  try {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

export function PublicPostView({
  post,
  publishedSnapshot,
}: {
  post: Post
  publishedSnapshot: PublishedSnapshot
}) {
  const pathname = usePathname()
  const { getRecentIntent } = useNavigationIntent()
  const [deferSecondaryReveal, setDeferSecondaryReveal] = useState(false)
  const displayTitle = publishedSnapshot?.title || post.title
  const displayContent = publishedSnapshot?.content
  const initialBlocks = parseBlockNoteJson(displayContent)
  const authorName = post.author?.full_name || "Anonymous"
  const formattedDate = format(new Date(post.published_at || post.created_at), "MMMM d, yyyy")

  const secondaryRevealMotion = deferSecondaryReveal
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.16, delay: 0.1 },
      }
    : {
        initial: false as const,
        animate: { opacity: 1 },
        transition: { duration: 0.12 },
      }

  useEffect(() => {
    const intent = getRecentIntent()
    const isMorphArrival = !!intent && intent.kind === "blog-detail" && intent.href === pathname
    if (!isMorphArrival) {
      const timer = window.setTimeout(() => setDeferSecondaryReveal(false), 0)
      return () => window.clearTimeout(timer)
    }

    const showTimer = window.setTimeout(() => setDeferSecondaryReveal(true), 0)
    const hideTimer = window.setTimeout(() => setDeferSecondaryReveal(false), 220)
    return () => {
      window.clearTimeout(showTimer)
      window.clearTimeout(hideTimer)
    }
  }, [pathname, getRecentIntent])

  if (!displayContent) {
    return (
      <div className="container max-w-4xl mx-auto py-8 md:py-12">
        <StatePanel
          className="max-w-lg"
          size="compact"
          icon={<GlobeLock className="h-5 w-5" />}
          title="Not yet published"
          description="This post is still being worked on."
          actions={
            <Button variant="outline" asChild>
              <Link href="/blog">Back to all posts</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <motion.div transition={MORPH_LAYOUT_TRANSITION} className="container max-w-4xl mx-auto py-8 md:py-12">
      <div className="mb-6">
        <Link href="/blog" className="text-sm text-muted-foreground hover:underline">
          ← Back to all posts
        </Link>
      </div>

      {post.cover_image && (
        <motion.div
          layoutId={`blog-image-${post.id}`}
          transition={MORPH_LAYOUT_TRANSITION}
          className="mb-8 rounded-2xl overflow-hidden"
        >
          <Image
            src={post.cover_image}
            alt={displayTitle}
            width={1600}
            height={900}
            className="w-full h-64 md:h-80 object-cover"
            unoptimized
          />
        </motion.div>
      )}

      <motion.div layoutId={`blog-title-${post.id}`} transition={MORPH_LAYOUT_TRANSITION}>
        <h1 className="text-3xl md:text-5xl font-bold mb-4">{displayTitle}</h1>
      </motion.div>

      <motion.div className="flex flex-wrap items-center gap-4 mb-8" {...secondaryRevealMotion}>
        <div className="flex items-center gap-2">
          {post.author?.avatar_url ? (
            <Image
              src={post.author.avatar_url}
              alt={authorName}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full"
              unoptimized
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
              {authorName[0]?.toUpperCase()}
            </div>
          )}
          <span className="text-sm">{authorName}</span>
        </div>

        <span className="text-sm text-muted-foreground">{formattedDate}</span>

        {(post.tags?.length || 0) > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags!.map((tag) => (
              <Link key={tag.id} href={`/blog/tags/${tag.id}`}>
                <Badge variant="secondary" className="hover:bg-secondary/80 transition-colors">
                  {tag.name}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div className="blocknote-seamless" data-readonly="true" {...secondaryRevealMotion}>
        <BlockNoteEditor initialContent={initialBlocks} editable={false} />
      </motion.div>

      {post.enable_comments && (
        <motion.div {...secondaryRevealMotion}>
          <Comments postId={post.id} />
        </motion.div>
      )}
    </motion.div>
  )
}
