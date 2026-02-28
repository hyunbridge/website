"use client"

import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"
import { BackLink } from "@/components/ui/back-link"
import { MORPH_LAYOUT_TRANSITION } from "@/lib/motion"
import { useNavigationIntent } from "@/components/navigation-intent-provider"
import { SharedTransitionImage, SharedTransitionTitle } from "@/components/shared-content-transition"

export function PostDetailSkeleton() {
  const pathname = usePathname()
  const { getRecentIntent } = useNavigationIntent()
  const intent = getRecentIntent()
  const morphSource =
    intent && intent.kind === "blog-detail" && intent.href === pathname && intent.itemId
      ? {
          itemId: intent.itemId,
          title: intent.title,
          coverImage: intent.coverImage,
        }
      : null

  return (
    <motion.div transition={MORPH_LAYOUT_TRANSITION} className="container max-w-4xl mx-auto py-8 md:py-12">
      <div className="mb-6">
        <BackLink href="/blog">Back to all posts</BackLink>
      </div>

      {morphSource?.coverImage ? (
        <SharedTransitionImage
          kind="blog"
          itemId={morphSource.itemId}
          src={morphSource.coverImage}
          alt={morphSource.title || "Blog post cover"}
          containerClassName="mb-8 h-64 md:h-80 w-full rounded-2xl"
          overlayClassName="bg-background/20"
          sizes="(max-width: 1024px) 100vw, 896px"
          priority
        />
      ) : (
        <Skeleton className="mb-8 h-64 md:h-80 w-full rounded-2xl" />
      )}

      {morphSource?.title ? (
        <SharedTransitionTitle kind="blog" itemId={morphSource.itemId}>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">{morphSource.title}</h1>
        </SharedTransitionTitle>
      ) : (
        <Skeleton className="h-10 md:h-14 w-3/4 mb-4" />
      )}

      <div className="flex flex-wrap items-center gap-4 mb-8">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-4 w-32" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-10/12" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>

      <div className="mt-12 space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </motion.div>
  )
}
