"use client"

import { usePathname } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { BlogCardListSkeleton } from "@/components/loading/blog-card-skeleton"
import { SharedTransitionImage, SharedTransitionTitle } from "@/components/shared-content-transition"
import { useNavigationIntent } from "@/components/navigation-intent-provider"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

export default function BlogLoading() {
  const pathname = usePathname()
  const { getRecentIntent } = useNavigationIntent()
  const intent = getRecentIntent()
  const morphSource =
    intent && intent.kind === "blog-list" && intent.href === pathname && intent.itemId
      ? {
          itemId: intent.itemId,
          title: intent.title,
          coverImage: intent.coverImage,
        }
      : null

  return (
    <div className="container py-8 md:py-12">
      <Skeleton className="h-10 w-32 mb-8" />

      {morphSource ? (
        <Card className="w-full overflow-hidden border border-border">
          {morphSource.coverImage ? (
            <SharedTransitionImage
              kind="blog"
              itemId={morphSource.itemId}
              src={morphSource.coverImage}
              alt={morphSource.title || "Blog post cover"}
              containerClassName="h-48 w-full"
              overlayClassName="bg-background/20"
              sizes="(max-width: 1024px) 100vw, 896px"
              priority
            />
          ) : (
            <Skeleton className="h-48 w-full rounded-none" />
          )}
          <CardHeader className="pb-3">
            {morphSource.title ? (
              <SharedTransitionTitle kind="blog" itemId={morphSource.itemId}>
                <CardTitle className="line-clamp-2">{morphSource.title}</CardTitle>
              </SharedTransitionTitle>
            ) : (
              <Skeleton className="h-6 w-3/4" />
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="invisible">
                placeholder
              </Badge>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-24" />
          </CardFooter>
        </Card>
      ) : (
        <BlogCardListSkeleton count={3} />
      )}
    </div>
  )
}
