"use client"

import { usePathname } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { SharedTransitionImage, SharedTransitionTitle } from "@/components/shared-content-transition"
import { useNavigationIntent } from "@/components/navigation-intent-provider"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ProjectSkeleton } from "@/components/skeletons"

export default function ProjectsLoading() {
  const pathname = usePathname()
  const { getRecentIntent } = useNavigationIntent()
  const intent = getRecentIntent()
  const morphSource =
    intent && intent.kind === "projects-list" && intent.href === pathname && intent.itemId
      ? {
          itemId: intent.itemId,
          title: intent.title,
          coverImage: intent.coverImage,
        }
      : null

  return (
    <div className="container py-8 md:py-12">
      <Skeleton className="h-10 w-40 mb-8" />
      {morphSource ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="h-full overflow-hidden flex flex-col">
            {morphSource.coverImage ? (
              <SharedTransitionImage
                kind="project"
                itemId={morphSource.itemId}
                src={morphSource.coverImage}
                alt={morphSource.title || "Project cover"}
                containerClassName="h-48 w-full"
                overlayClassName="bg-background/20"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                priority
              />
            ) : (
              <Skeleton className="h-48 w-full rounded-none" />
            )}
            <CardHeader>
              {morphSource.title ? (
                <SharedTransitionTitle kind="project" itemId={morphSource.itemId}>
                  <CardTitle>{morphSource.title}</CardTitle>
                </SharedTransitionTitle>
              ) : (
                <Skeleton className="h-6 w-3/4" />
              )}
            </CardHeader>
            <CardContent className="flex-grow">
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
            <CardFooter>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="invisible">
                  placeholder
                </Badge>
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </CardFooter>
          </Card>
        </div>
      ) : (
        <ProjectSkeleton />
      )}
    </div>
  )
}
