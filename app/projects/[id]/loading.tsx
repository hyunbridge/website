import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function ProjectLoading() {
  return (
    <div className="container py-8 md:py-12">
      <Card className="bg-card w-full rounded-lg shadow-lg overflow-hidden">
        <div className="p-6">
          <Skeleton className="h-10 w-2/3 mb-6" />

          {/* Cover Image Skeleton */}
          <Skeleton className="w-full h-64 md:h-80 rounded-lg mb-6" />

          <div className="flex flex-wrap gap-2 mb-6">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>

          <div className="space-y-4 mb-8">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>

          <div className="space-y-6">
            <div>
              <Skeleton className="h-6 w-1/3 mb-2" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </div>
            </div>

            <div>
              <Skeleton className="h-6 w-1/4 mb-2" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>

            <div>
              <Skeleton className="h-6 w-1/3 mb-2" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Skeleton className="h-32 w-full rounded-md" />
                <Skeleton className="h-32 w-full rounded-md" />
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t">
            <Skeleton className="h-5 w-16 mb-4" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

