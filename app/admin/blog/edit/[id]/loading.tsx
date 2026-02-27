import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="container max-w-4xl mx-auto py-8 md:py-12">
      <div className="mb-6">
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-12 w-full rounded-xl mb-6" />
      <Skeleton className="h-10 w-3/4 mb-4" />
      <div className="flex items-center gap-4 mb-8">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/6" />
      </div>
    </div>
  )
}
