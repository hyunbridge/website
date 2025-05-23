import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { CVSkeleton } from "./cv-skeleton"

export default function CVLoading() {
  return (
    <div className="container py-8 md:py-12">
      {/* Mobile: display without card */}
      <div className="md:hidden">
        <div className="flex flex-row items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-28" />
        </div>
        <CVSkeleton />
      </div>

      {/* Desktop: uses card layout */}
      <div className="hidden md:block">
        <Card className="bg-card w-full rounded-lg shadow-lg overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-28" />
          </CardHeader>
          <CardContent>
            <CVSkeleton />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
