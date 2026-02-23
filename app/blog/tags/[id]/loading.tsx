import { BlogCardListSkeleton } from "@/components/loading/blog-card-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function TagPostsLoading() {
  return (
    <div className="container py-8 md:py-12">
      <div className="mb-8">
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-10 w-80 max-w-full mb-8" />

      <BlogCardListSkeleton count={3} />
    </div>
  )
}
