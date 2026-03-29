"use client"

import Image from "@shared/components/ui/app-image"
import { motion, type HTMLMotionProps } from "framer-motion"
import { GlobeLock } from "lucide-react"

import { BackLink } from "@/components/ui/back-link"
import Link from "@/components/ui/app-link"
import { MarkdownEditor } from "@/components/editor/markdown-editor"
import { MarkdownPreview } from "@/components/editor/markdown-preview"
import { Badge } from "@shared/components/ui/badge"
import { Button } from "@shared/components/ui/button"
import { Skeleton } from "@shared/components/ui/skeleton"
import { StatePanel } from "@shared/components/ui/state-panel"
import { MORPH_LAYOUT_TRANSITION } from "@shared/lib/motion"

import type { Post, Tag } from "@/lib/blog-service"

export function PostMeta({
  post,
  authorName,
  formattedDate,
  tags,
  className,
}: {
  post: Post
  authorName: string
  formattedDate: string
  tags: Tag[]
  className?: string
}) {
  return (
    <div className={className}>
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

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link key={tag.id} href={`/blog/tags/${tag.id}`}>
              <Badge variant="secondary" className="hover:bg-secondary/80 transition-colors">
                {tag.name}
              </Badge>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function PostReadOnlySkeleton({
  post,
  displayTitle,
  authorName,
  formattedDate,
  postTags,
}: {
  post: Post
  displayTitle: string
  authorName: string
  formattedDate: string
  postTags: Tag[]
}) {
  return (
    <motion.div transition={MORPH_LAYOUT_TRANSITION} className="content-article container">
      <div className="content-article__backlink">
        <BackLink href="/blog">전체 글로 돌아가기</BackLink>
      </div>

      {post.cover_image ? (
        <motion.div
          layoutId={`blog-image-${post.id}`}
          transition={MORPH_LAYOUT_TRANSITION}
          className="content-article__cover relative"
        >
          <Image
            src={post.cover_image}
            alt={displayTitle}
            width={1600}
            height={900}
            className="w-full h-64 md:h-80 object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-background/15" />
        </motion.div>
      ) : null}

      <motion.div layoutId={`blog-title-${post.id}`} transition={MORPH_LAYOUT_TRANSITION}>
        <h1 className="content-article__title">{displayTitle}</h1>
      </motion.div>

      <PostMeta
        post={post}
        authorName={authorName}
        formattedDate={formattedDate}
        tags={postTags}
        className="content-article__meta"
      />

      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-full" />
        </div>
        <Skeleton className="h-36 w-full rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>

      {post.enable_comments ? (
        <div className="mt-10 space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : null}
    </motion.div>
  )
}

export function PostNotPublishedState() {
  return (
    <div className="container max-w-4xl mx-auto py-8 md:py-12">
      <StatePanel
        className="max-w-lg"
        size="compact"
        icon={<GlobeLock className="h-5 w-5" />}
        title="아직 공개되지 않았습니다"
        description="이 글은 아직 작업 중입니다."
        actions={
          <Button variant="outline" asChild>
            <Link href="/blog">전체 글로 돌아가기</Link>
          </Button>
        }
      />
    </div>
  )
}

export function PostContentBody({
  isEditable,
  initialMarkdown,
  postId,
  onImageUpload,
  onDraftChange,
  motionProps,
}: {
  isEditable: boolean
  initialMarkdown: string
  postId: string
  onImageUpload: (file: File) => Promise<string>
  onDraftChange: (markdown: string) => void
  motionProps?: HTMLMotionProps<"div">
}) {
  return (
    <motion.div
      className={
        isEditable
          ? "content-article__body content-article__body--editable"
          : "content-article__body content-article__surface"
      }
      {...motionProps}
    >
      {isEditable ? (
        <MarkdownEditor
          content={initialMarkdown}
          className="markdown-content content-article__surface"
          onImageUpload={onImageUpload}
          onChange={(markdown) => {
            if (!postId) return
            onDraftChange(markdown)
          }}
        />
      ) : (
        <MarkdownPreview className="content-article__surface" content={initialMarkdown} />
      )}
    </motion.div>
  )
}
