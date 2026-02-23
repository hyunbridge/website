import { BlogCardListSkeleton } from "@/components/loading/blog-card-skeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function BlogLoading() {
  return (
    <div className="container py-8 md:py-12">
      <Skeleton className="h-10 w-32 mb-8" />

      <BlogCardListSkeleton count={3} />
    </div>
  )
}
