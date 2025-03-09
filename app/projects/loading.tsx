import { Skeleton } from "@/components/ui/skeleton"
import { ProjectSkeleton } from "@/components/skeletons"

export default function ProjectsLoading() {
  return (
    <div className="container py-8 md:py-12">
      <Skeleton className="h-10 w-40 mb-8" />
      <ProjectSkeleton />
    </div>
  )
}

